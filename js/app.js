// ======= app.js — start-up, shared state and the always-visible chrome =======

const App = {
  VERSION: 'v22 · 11 Oct 2026', // shown under More; keep in step with VERSION in sw.js
  PRIVATE_FILE_VERSION: '2026-10-11b', // newest otter-private-data.json; More asks you to add it while yours is older
  settings: null, areas: [], modes: [], templates: [], weekPlans: [], shifts: [], patterns: [],
  streaks: null, cache: {}, date: U.todayStr(), todayMode: 'list',
  openHooks: [], // run once after the first screen appears (energy check-in, reminders, milestones)

  async init() {
    try {
      await DB.init();
      await Migrate.run();
      const profile = await App.loadProfileFile();
      await App.loadCore();
      App.applyPrefs();
      App.bindChrome();
      await App.recompute();
      if (window.Programme) await Programme.ensureDays(); // plan the days of the current rotation in advance
      App.renderStrip();
      await Nav.go('today', {}, { root: true });
      if (profile) UI.toast(profile, 'ph-user-circle');
      App.watchClock();
      setTimeout(App.afterOpen, 350);
    } catch (e) {
      console.error('Start-up failed:', e);
      document.getElementById('view').innerHTML = `<div class="error-box"><h3>Something went wrong loading the app</h3>
        <p>${U.esc(e && e.message)}</p><p>Your data has not been changed. Try closing and reopening the app.</p></div>`;
    }
  },

  // Your publications and MedTwins channel (profile-data.json) load automatically when the app runs
  // from your own computer, once per file version. The file never goes to the public website (it is
  // not in the upload folder); it reaches your iPhone inside your backup.
  async loadProfileFile() {
    if (!/^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)$/.test(location.hostname)) return null;
    try {
      const res = await fetch('profile-data.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const text = await res.text();
      const version = JSON.parse(text)._profileVersion || '';
      const s = await DB.get('settings', 'global');
      if (!s || (version && s.profileVersion === version)) return null;
      const r = await DB.mergeData(text);
      s.profileVersion = version; await DB.put('settings', s);
      return r.added || r.updated ? `Added your publications and MedTwins videos (${r.added + r.updated} items)` : null;
    } catch (e) { console.warn('Profile file not loaded:', e.message); return null; }
  },

  async loadCore() {
    const [settings, areas, modes, templates, weekPlans, shifts, patterns] = await Promise.all([
      DB.get('settings', 'global'), DB.getAll('areas'), DB.getAll('modes'), DB.getAll('templates'),
      Repo.all('weekPlan'), DB.getAll('shifts'), Repo.all('shiftPattern')]);
    App.settings = settings;
    App.areas = areas.sort(U.by(a => a.order ?? 99));
    App.modes = modes.sort(U.by(m => m.name.toLowerCase()));
    App.templates = templates; App.weekPlans = weekPlans; App.shifts = shifts; App.patterns = patterns;
  },
  areaById(id) { return App.areas.find(a => a.id === id); },
  visibleAreas() { return App.areas.filter(a => !a.archived); },
  async saveSettings() { await DB.put('settings', App.settings); },

  applyPrefs() {
    const s = App.settings;
    if (s.theme === 'light' || s.theme === 'dark') document.documentElement.dataset.theme = s.theme;
    else delete document.documentElement.dataset.theme;
    document.body.classList.toggle('anim-reduced', s.animations === 'reduced');
    document.body.classList.toggle('anim-off', s.animations === 'off');
    document.body.classList.toggle('no-mascots', s.showMascots === false);
  },

  async recompute() {
    await Streaks.compute();
    const today = U.todayStr();
    const win = Number(App.settings.deadlineWindow) || 14;
    const dls = (await DB.getAll('deadlines')).filter(d => !d.done && d.date >= today && U.diffDays(today, d.date) <= win);
    App.cache.deadlinesSoon = dls.sort(U.by(d => d.date));
    App.cache.watchCount = (await Repo.all('watch')).length; // the weekly watch-list task needs it synchronously
  },

  // Call after ANY data change: streaks, strip and the current screen all update together.
  async changed({ celebrate = true } = {}) {
    await App.loadCore();
    await App.recompute();
    App.renderStrip();
    await Nav.refresh();
    if (celebrate) await Otto.milestones();
  },

  renderStrip() { if (window.Areas) Areas.renderStrip(); },

  bindChrome() {
    document.getElementById('tabbar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      UI.closeAll();
      if (b.dataset.tab === 'today') App.date = U.todayStr();
      Nav.go(b.dataset.tab, {}, { root: true });
    });
    document.getElementById('area-strip').addEventListener('click', (e) => {
      const b = e.target.closest('[data-area]');
      if (b) { UI.closeAll(); Nav.go('area', { id: b.dataset.area }); }
    });
    document.getElementById('fab').addEventListener('click', App.plusMenu);
  },

  async plusMenu() {
    const date = App.date;
    const label = date === U.todayStr() ? 'today' : U.fmtDate(date);
    const opts = [
      { value: 'task', label: `Add task to ${label}`, sub: 'With a start and end time', icon: 'ph-calendar-plus' },
      { value: 'capture', label: 'Quick capture idea', sub: 'Saved to your inbox for later', icon: 'ph-lightbulb' }
    ];
    if (window.Focus) opts.push({ value: 'focus', label: 'Start focus timer', sub: `${(App.settings.focus && App.settings.focus.minutes) || 25} minutes`, icon: 'ph-timer' });
    if (window.Logs) opts.push({ value: 'win', label: 'Log a win', sub: 'Paper, video, presentation…', icon: 'ph-trophy' });
    const v = await UI.choose('Add', opts);
    if (v === 'task') TaskEditor.open({ date });
    else if (v === 'capture') App.quickCapture();
    else if (v === 'focus') Focus.start({});
    else if (v === 'win') Logs.editWin();
  },
  async quickCapture() {
    const vals = await UI.form('Quick capture', [
      { name: 'text', type: 'textarea', label: 'Idea, task or question', rows: 3, required: true, placeholder: 'Type it before you forget…' },
      { name: 'areaId', type: 'select', label: 'Area (optional)', options: UI.areaOptions(true, 'No area'), value: '' }
    ], { submit: 'Save to inbox' });
    if (!vals) return;
    await Repo.put('inbox', { id: U.uid('in'), text: vals.text, areaId: vals.areaId || null, status: 'inbox', date: U.todayStr() });
    UI.toast('Saved to your inbox', 'ph-tray');
    await App.changed({ celebrate: false });
  },

  // Midnight rollover: if the app stays open overnight, "today" moves on and streaks recompute.
  watchClock() {
    let last = U.todayStr();
    const check = async () => {
      const now = U.todayStr();
      if (now !== last) {
        if (App.date === last) App.date = now;
        last = now;
        await App.changed({ celebrate: false });
      }
    };
    setInterval(check, 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  },

  async afterOpen() {
    for (const hook of App.openHooks) { try { await hook(); } catch (e) { console.error(e); } }
    await Otto.milestones();
  }
};
window.App = App;

document.addEventListener('DOMContentLoaded', App.init);
