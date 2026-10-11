// ======= more.js — More hub, inbox triage, settings, backup and the Otter screen =======

const More = {
  // Rows only appear for screens that exist.
  async renderHub() {
    const inbox = (await DB.getAll('inbox')).filter(i => (i.status || 'inbox') === 'inbox');
    const link = (view, icon, title, sub, badge = '') => Nav.views[view] ? UI.row({ icon, title, sub, act: 'go', data: { view }, right: `${badge}<i class="ph ph-caret-right row-caret"></i>` }) : '';
    const last = App.settings.lastBackupAt;
    // Until your private-data file has been added (or while a newer one exists), a shortcut to it sits at the top.
    const pv = App.settings.profileVersion || '';
    const setup = !pv ? `<button class="banner info" data-act="addPrivate"><i class="ph ph-user-circle-plus lead"></i>
      <span><b>Add your private data</b> — one file: publications, videos, LinkedIn and research ideas</span></button>`
      : pv < App.PRIVATE_FILE_VERSION ? `<button class="banner info" data-act="addPrivate"><i class="ph ph-arrow-circle-down lead"></i>
      <span><b>New in your private file</b> — add otter-private-data.json again from Google Drive (your MedTwins video ideas). Nothing is added twice.</span></button>` : '';
    return `${UI.header('More', { back: false })}${setup}
      <div class="list">
        ${link('inbox', 'ph-tray', 'Inbox', 'Quick captures to triage any time', inbox.length ? `<span class="badge">${inbox.length}</span>` : '')}
        ${link('search', 'ph-magnifying-glass', 'Search', 'Tasks, ideas, cards, logs and notes')}
        ${link('goals', 'ph-target', 'Goals', 'Quarterly goals → monthly milestones → weekly priorities')}
      </div>
      <div class="section-title">Logs</div>
      <div class="list">
        ${link('wins', 'ph-trophy', 'Wins log', 'Outputs and badges, export for your CV')}
        ${link('clinicalQs', 'ph-question', 'Clinical questions', 'Questions, answers and reflections')}
        ${link('topics', 'ph-brain', 'Topics & spaced review', 'Topic map and due reviews')}
        ${link('deadlines', 'ph-hourglass-medium', 'Deadlines', 'Countdowns')}
        ${link('waiting', 'ph-hand-palm', 'Waiting on', 'Follow-ups with other people')}
        ${link('ideas', 'ph-lightbulb', 'Research ideas', 'Private: only on this device')}
      </div>
      <div class="section-title">Stats & you</div>
      <div class="list">
        ${link('streak', 'ph-fire', 'Streak & XP', 'Calendar, pebbles, rule')}
        ${link('timeStats', 'ph-clock', 'Time per area', 'Focus timer and manual entries')}
        ${link('energy', 'ph-battery-medium', 'Energy & sleep', 'Check-ins over time')}
        ${link('health', 'ph-heartbeat', 'Health sync', 'Steps, food and Forest time from Apple Health')}
        ${link('otterScreen', 'ph-t-shirt', `${U.esc(Otto.name())}'s wardrobe`, 'Unlocked and locked outfits')}
      </div>
      <div class="section-title">App</div>
      <div class="list">
        ${link('settings', 'ph-gear-six', 'Settings', 'Streak rule, otter, appearance, reminders')}
        ${link('backup', 'ph-download-simple', 'Backup', last ? `Last export ${U.relDay(U.dateStr(new Date(last)))}` : 'Never exported yet')}
      </div>
      <p class="muted tiny" style="text-align:center;margin-top:10px">All data stays on this device. No account, no server.<br>App version ${U.esc(App.VERSION || '')}</p>`;
  },

  // One file, one tap: your private-data file (publications, videos, LinkedIn, research ideas),
  // a merge file, or a research-ideas Markdown file. Nothing you already have is replaced.
  async addPrivateFile() {
    const file = await U.pickFile('.json,.md,.markdown,.txt,application/json,text/markdown,text/plain');
    if (!file) return;
    try {
      const text = await U.readFileText(file);
      const lines = [];
      if (/^\s*\{/.test(text)) {
        const data = JSON.parse(text);
        const r = await DB.mergeData(text);
        lines.push(`${r.added + r.updated} item${r.added + r.updated === 1 ? '' : 's'} added (publications, videos, LinkedIn…)${r.skipped ? `, ${r.skipped} already in the app` : ''}`);
        if (data.ideasMarkdown) {
          const s = await Research.importText(data.ideasMarkdown, file.name, { quiet: true });
          if (s) lines.push(`${s.added} research idea${s.added === 1 ? '' : 's'} added${s.skipped ? `, ${s.skipped} already there` : ''}${s.failed.length ? ` · ${s.failed.length} could not be read` : ''}`);
        }
        if (data._profileVersion) { App.settings.profileVersion = data._profileVersion; await App.saveSettings(); }
      } else {
        const s = await Research.importText(text, file.name, { quiet: true });
        if (!s) throw new Error('This file has no Otter data or research ideas in it. Nothing was changed.');
        lines.push(`${s.added} research idea${s.added === 1 ? '' : 's'} added${s.skipped ? `, ${s.skipped} already there` : ''}`);
      }
      await App.changed({ celebrate: false });
      await UI.confirm(lines.join('. ') + '. Your own entries were not changed.', { ok: 'Great', cancel: 'Close', title: 'Done' });
    } catch (e) { await UI.confirm(e.message, { ok: 'OK', title: 'Could not add this file' }); }
  },

  // ---------- inbox ----------
  async renderInbox({ tab = 'inbox' } = {}) {
    const all = (await DB.getAll('inbox')).sort(U.by(i => i.createdAt || ''));
    const items = all.filter(i => (i.status || 'inbox') === tab);
    const n = s => all.filter(i => (i.status || 'inbox') === s).length;
    return `${UI.header('Inbox', { right: '<button class="icon-btn" data-act="capture" aria-label="Capture"><i class="ph ph-plus"></i></button>' })}
      <div class="seg" style="margin-bottom:12px"><button class="${tab === 'inbox' ? 'on' : ''}" data-act="tab" data-v="inbox">To triage (${n('inbox')})</button>
        <button class="${tab === 'someday' ? 'on' : ''}" data-act="tab" data-v="someday">Someday (${n('someday')})</button></div>
      ${items.map(i => `<div class="card">
        <div class="pre" style="font-weight:700">${U.esc(i.text || i.title)}</div>
        <div class="muted tiny" style="margin-top:2px">${U.esc(i.date ? U.fmtDate(i.date) : '')}${i.areaId ? ` · ${U.esc((App.areaById(i.areaId) || {}).name || '')}` : ''}</div>
        <div class="btn-wrap">
          <button class="btn btn-small btn-primary" data-act="schedule" data-id="${i.id}"><i class="ph ph-calendar-plus"></i> Schedule</button>
          <button class="btn btn-small btn-ghost" data-act="board" data-id="${i.id}"><i class="ph ph-kanban"></i> Board</button>
          <button class="btn btn-small btn-ghost" data-act="clinical" data-id="${i.id}"><i class="ph ph-question"></i> Clinical Q</button>
          ${tab === 'inbox' ? `<button class="btn btn-small btn-ghost" data-act="someday" data-id="${i.id}"><i class="ph ph-cloud"></i> Someday</button>` : `<button class="btn btn-small btn-ghost" data-act="back" data-id="${i.id}"><i class="ph ph-tray"></i> To inbox</button>`}
          <button class="btn btn-small btn-ghost" data-act="editItem" data-id="${i.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button>
          <button class="btn btn-small btn-danger-ghost" data-act="del" data-id="${i.id}" aria-label="Delete"><i class="ph ph-trash"></i></button>
        </div></div>`).join('') || UI.empty(tab === 'inbox' ? 'Inbox zero! Capture ideas with the + button.' : 'Nothing parked for someday.', 'ph-tray')}`;
  },
  inboxActions({ tab = 'inbox' } = {}) {
    const get = (id) => DB.get('inbox', id);
    const done = async (msg) => { if (msg) UI.toast(msg); await App.changed({ celebrate: false }); };
    return {
      tab: (el) => Nav.go('inbox', { tab: el.dataset.v }, { replace: true }),
      capture: () => App.quickCapture(),
      schedule: async (el) => {
        const item = await get(el.dataset.id);
        const r = await More.scheduleSheet(item.text || item.title, item.areaId);
        if (r) { await Repo.del('inbox', item.id); done(`Added to ${U.fmtDate(r)}`); }
      },
      board: async (el) => {
        const item = await get(el.dataset.id);
        if (!window.Boards) return;
        const card = await Boards.newCardSheet({ title: item.text || item.title, areaId: item.areaId });
        if (card) { await Repo.del('inbox', item.id); done('Moved to the board'); }
      },
      clinical: async (el) => {
        const item = await get(el.dataset.id);
        await Repo.put('clinicalQuestions', { id: U.uid('cq'), question: item.text || item.title, date: U.todayStr(), areaId: 'a3', answered: false });
        await Repo.del('inbox', item.id); done('Added to clinical questions');
      },
      someday: async (el) => { const item = await get(el.dataset.id); item.status = 'someday'; await Repo.put('inbox', item); done('Parked for someday'); },
      back: async (el) => { const item = await get(el.dataset.id); item.status = 'inbox'; await Repo.put('inbox', item); done(); },
      editItem: async (el) => {
        const item = await get(el.dataset.id);
        const f = await UI.form('Edit', [{ name: 'text', type: 'textarea', label: 'Text', value: item.text || item.title, required: true },
          { name: 'areaId', type: 'select', label: 'Area', value: item.areaId || '', options: UI.areaOptions(true) }]);
        if (f) { item.text = f.text; item.areaId = f.areaId || null; await Repo.put('inbox', item); done('Saved'); }
      },
      del: async (el) => { if (await UI.confirm('Delete this item?', { ok: 'Delete', danger: true })) { await Repo.del('inbox', el.dataset.id); done('Deleted'); } }
    };
  },
  // Date + start/end → a task on that day. Returns the date or null.
  async scheduleSheet(title, areaId) {
    const f = await UI.form('Schedule as a task', [
      { name: 'title', label: 'Task', value: title, required: true },
      { name: 'date', type: 'date', label: 'Day', value: U.todayStr(), required: true },
      { type: 'html', html: '<div class="two">' },
      { name: 'time', type: 'time', label: 'Start', value: '18:00' },
      { name: 'endTime', type: 'time', label: 'End', value: '18:30' },
      { type: 'html', html: '</div>' },
      { type: 'durations', start: 'time', end: 'endTime' },
      { name: 'areaId', type: 'select', label: 'Area', value: areaId || '', options: UI.areaOptions(true) }
    ], { submit: 'Add to that day', validate: v => U.toMin(v.endTime) <= U.toMin(v.time) ? 'The end time must be after the start time.' : null });
    if (!f) return null;
    const id = U.uid('t');
    await Days.upsertTask(f.date, { id, srcId: id, title: f.title, time: f.time, endTime: f.endTime, areaId: f.areaId || null, desc: '', core: false, optional: false, infoOnly: false, xp: 10, tag: '' }, 'day');
    return f.date;
  },

  // ---------- settings ----------
  renderSettings() {
    const s = App.settings;
    const r = Streaks.ruleFor(U.todayStr());
    const yes = b => b ? 'On' : 'Off';
    const sec = (key, icon, title, sub) => UI.row({ icon, title, sub, act: 'edit', data: { key } });
    return `${UI.header('Settings')}
      <div class="list">
        ${sec('rule', 'ph-fire', 'Overall streak rule', Streaks.ruleName(r))}
        ${sec('otter', 'ph-smiley', 'Otter', `${U.esc(Otto.name())} · daily messages ${yes(s.otter.messagesOn !== false)}`)}
        ${sec('messages', 'ph-chat-circle-text', 'Edit the otter\'s messages', 'Morning, streak, minimum routine, night shift…')}
        ${sec('look', 'ph-paint-brush', 'Appearance & motion', `Theme ${s.theme} · animations ${s.animations} · mascots ${yes(s.showMascots !== false)}`)}
        ${sec('reminders', 'ph-bell-ringing', 'In-app reminders', 'Shown as banners when you open the app')}
        ${sec('energy', 'ph-battery-medium', 'Energy, sleep & burnout guard', `Check-in after ${s.energy.time} · ${yes(s.energy.enabled)}`)}
        ${sec('planning', 'ph-calendar', 'Planning', `Deadlines on Today within ${s.deadlineWindow} days · review on ${U.DOW[s.reviewDay]}`)}
        ${sec('review', 'ph-clipboard-text', 'Weekly review steps', `${(s.reviewSteps || []).filter(x => x.enabled).length} steps`)}
        ${sec('research', 'ph-flask', 'Research', `Active project limit ${s.research.activeLimit} · ${s.research.specialties.length} specialties`)}
        ${sec('gym', 'ph-barbell', 'Gym', `Rest timer ${s.gym.restSec}s · move gym around night shifts ${yes(s.gym.autoMoveGym)}`)}
        ${sec('focus', 'ph-timer', 'Focus timer', `${s.focus.minutes} minutes`)}
      </div>`;
  },
  settingsActions() {
    const s = App.settings;
    const save = async (msg = 'Settings saved') => { await App.saveSettings(); App.applyPrefs(); UI.toast(msg); await App.changed({ celebrate: false }); };
    const lines = (txt) => String(txt || '').split('\n').map(x => x.trim()).filter(Boolean);
    const forms = {
      rule: async () => {
        const r = Streaks.ruleFor(U.todayStr());
        const f = await UI.form('Overall streak rule', [
          { name: 'rule', type: 'select', label: 'A day counts when…', value: r.rule, options: [
            { value: 'core', label: 'All core tasks (★) are done' }, { value: 'all', label: 'All required tasks are done' },
            { value: 'percentage', label: 'A percentage of required tasks is done' }, { value: 'min', label: 'At least X tasks are done' }] },
          { name: 'pct', type: 'number', label: 'Percentage (for the % rule)', value: r.pct || 80, min: 1, max: 100 },
          { name: 'min', type: 'number', label: 'X (for the "at least X" rule)', value: r.min || 3, min: 1, max: 30 }
        ], { submit: 'Apply from today', intro: '<p class="sheet-text">The new rule applies from today onwards. Past days keep the status they had.</p>' });
        if (!f) return;
        const today = U.todayStr();
        s.ruleHistory = [...(s.ruleHistory || []).filter(h => h.from !== today), { from: today, rule: f.rule, pct: Number(f.pct) || 80, min: Number(f.min) || 3 }];
        s.streakRule = f.rule; s.streakRulePercentage = Number(f.pct) || 80; s.streakRuleMinTasks = Number(f.min) || 3;
        await save('Rule changed from today');
      },
      otter: async () => {
        const f = await UI.form('Otter', [
          { name: 'name', label: 'Name', value: s.otterName, required: true },
          { name: 'messagesOn', type: 'checkbox', label: 'Show a daily message', value: s.otter.messagesOn !== false },
          { name: 'showMascots', type: 'checkbox', label: 'Show mascots in the app', value: s.showMascots !== false }
        ]);
        if (!f) return;
        s.otterName = f.name; s.otter.messagesOn = f.messagesOn; s.showMascots = f.showMascots; await save();
      },
      messages: async () => {
        const labels = { morning: 'Mornings', normal: 'Normal days', streak: 'Streak going ({streak})', atRisk: 'Evening, core tasks left ({task})', complete: 'Day complete',
          minimum: 'Minimum routine', night: 'Night shift / on-call', deadline: 'Deadline coming ({deadline} {days})', review: 'Weekly review', pebble: 'Pebble used', lowEnergy: 'Low energy' };
        const m = s.otter.messages || U.clone(Defaults.otterMessages);
        const f = await UI.form('Otter messages', Object.keys(labels).map(k => ({ name: k, type: 'textarea', label: labels[k], value: (m[k] || []).join('\n'), hint: 'One message per line. Keep them kind!' })),
          { submit: 'Save messages', buttons: [{ label: 'Restore the starting messages', value: 'reset' }] });
        if (!f) return;
        if (f._button === 'reset') s.otter.messages = U.clone(Defaults.otterMessages);
        else { s.otter.messages = {}; Object.keys(labels).forEach(k => { s.otter.messages[k] = lines(f[k]); if (!s.otter.messages[k].length) s.otter.messages[k] = Defaults.otterMessages[k]; }); }
        await save('Messages saved');
      },
      look: async () => {
        const f = await UI.form('Appearance & motion', [
          { name: 'theme', type: 'select', label: 'Theme', value: s.theme, options: [{ value: 'auto', label: 'Match iPhone (light/dark)' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] },
          { name: 'animations', type: 'select', label: 'Animations', value: s.animations, options: [{ value: 'on', label: 'On' }, { value: 'reduced', label: 'Reduced (no idle motion or confetti)' }, { value: 'off', label: 'Off' }], hint: 'The iPhone "Reduce Motion" setting is always respected too.' },
          { name: 'showMascots', type: 'checkbox', label: 'Show mascots', value: s.showMascots !== false }
        ]);
        if (!f) return;
        Object.assign(s, f); await save();
      },
      reminders: async () => {
        const labels = { coreAfter21: 'Core tasks not done after 21:00', deadlines: 'Deadlines within 3 days', topics: 'Topic reviews due', waiting: 'Waiting-on follow-ups due',
          certs: 'Certificates expiring (30 and 7 days)', stuck: 'Research projects stuck too long', backup: 'Weekly backup reminder', videoGoal: 'MedTwins video due (goal: one every 2 weeks)' };
        const f = await UI.form('In-app reminders', Object.keys(labels).map(k => ({ name: k, type: 'checkbox', label: labels[k], value: s.reminders[k] !== false })));
        if (!f) return;
        Object.assign(s.reminders, f); await save();
      },
      energy: async () => {
        const f = await UI.form('Energy, sleep & burnout guard', [
          { name: 'enabled', type: 'checkbox', label: 'Ask "Energy 1–5?" once a day', value: s.energy.enabled },
          { name: 'time', type: 'time', label: 'Ask on the first open after', value: s.energy.time },
          { name: 'burnoutAvg', type: 'number', label: 'Burnout guard: average energy at or below', value: s.energy.burnoutAvg, min: 1, max: 5, step: 0.5 },
          { name: 'burnoutDays', type: 'number', label: '…over this many check-ins', value: s.energy.burnoutDays, min: 2, max: 14 },
          { name: 'sleep', type: 'checkbox', label: 'Optional sleep log (asks in the morning)', value: s.sleep.enabled }
        ]);
        if (!f) return;
        Object.assign(s.energy, { enabled: f.enabled, time: f.time, burnoutAvg: Number(f.burnoutAvg) || 2, burnoutDays: Number(f.burnoutDays) || 5 });
        s.sleep.enabled = f.sleep; await save();
      },
      planning: async () => {
        const f = await UI.form('Planning', [
          { name: 'deadlineWindow', type: 'number', label: 'Show deadlines on Today within (days)', value: s.deadlineWindow, min: 1, max: 90 },
          { name: 'reviewDay', type: 'select', label: 'Weekly review day', value: s.reviewDay, options: [0, 1, 2, 3, 4, 5, 6].map(d => ({ value: d, label: U.DOW[d] })) },
          { name: 'intervals', label: 'Spaced review intervals (days, comma separated)', value: (s.topicIntervals || [1, 7, 30, 90]).join(', ') }
        ], { validate: v => lines(v.intervals.replace(/,/g, '\n')).some(x => !(Number(x) > 0)) ? 'Intervals must be positive numbers.' : null });
        if (!f) return;
        s.deadlineWindow = Number(f.deadlineWindow) || 14; s.reviewDay = Number(f.reviewDay);
        s.topicIntervals = f.intervals.split(',').map(x => Math.round(Number(x.trim()))).filter(x => x > 0);
        await save();
      },
      review: () => Nav.go('reviewSteps'),
      research: async () => {
        const f = await UI.form('Research', [
          { name: 'activeLimit', type: 'number', label: 'Warn me above this many active projects', value: s.research.activeLimit, min: 1, max: 20 },
          { name: 'specialties', type: 'textarea', label: 'Specialty tags (one per line)', value: s.research.specialties.join('\n'), rows: 9 }
        ]);
        if (!f) return;
        s.research.activeLimit = Number(f.activeLimit) || 3;
        s.research.specialties = lines(f.specialties);
        await save();
      },
      gym: async () => {
        const f = await UI.form('Gym', [
          { name: 'restSec', type: 'number', label: 'Rest timer (seconds)', value: s.gym.restSec, min: 10, max: 600 },
          { name: 'autoMoveGym', type: 'checkbox', label: 'Move gym sessions around night shifts / on-calls', value: s.gym.autoMoveGym }
        ]);
        if (!f) return;
        s.gym.restSec = Number(f.restSec) || 90; s.gym.autoMoveGym = f.autoMoveGym; await save();
      },
      focus: async () => {
        const f = await UI.form('Focus timer', [{ name: 'minutes', type: 'number', label: 'Default length (minutes)', value: s.focus.minutes, min: 1, max: 180 }]);
        if (!f) return;
        s.focus.minutes = Number(f.minutes) || 25; await save();
      }
    };
    return { edit: (el) => forms[el.dataset.key] && forms[el.dataset.key]() };
  },

  // ---------- backup ----------
  renderBackup() {
    const last = App.settings.lastBackupAt;
    return `${UI.header('Backup')}
      <div class="card"><h3><i class="ph ph-download-simple"></i> Export backup</h3>
        <p class="muted small" style="margin:4px 0 10px">Saves everything (tasks, streaks, boards, logs, research ideas) to one .json file. Keep it private: it contains your unpublished ideas.
        ${last ? `Last export: ${U.fmtDate(U.dateStr(new Date(last)), { year: true })}.` : 'You have not exported yet.'}</p>
        <button class="btn btn-primary btn-block" data-act="export"><i class="ph ph-download-simple"></i> Export backup file</button></div>
      <div class="card"><h3><i class="ph ph-upload-simple"></i> Import backup</h3>
        <p class="muted small" style="margin:4px 0 10px">Replaces ALL data on this device with the backup. On iPhone, the Files app opens so you can pick the file (iCloud Drive, Downloads…).</p>
        <button class="btn btn-ghost btn-block" data-act="import"><i class="ph ph-upload-simple"></i> Choose a backup file…</button></div>
      <div class="card"><h3><i class="ph ph-git-merge"></i> Add your private data / items from a file</h3>
        <p class="muted small" style="margin:4px 0 10px">Adds items from an Otter merge file (for example your publications and videos) without replacing anything. Items already in the app are skipped, so it's safe to run twice.</p>
        <button class="btn btn-ghost btn-block" data-act="merge"><i class="ph ph-git-merge"></i> Choose a merge file…</button></div>
      <div class="card flat"><h3>Erase everything</h3><p class="muted small" style="margin:4px 0 10px">Deletes all data on this device. Export first!</p>
        <button class="btn btn-danger-ghost btn-block" data-act="erase"><i class="ph ph-trash"></i> Erase all data</button></div>`;
  },
  backupActions() {
    return {
      export: async () => {
        App.settings.lastBackupAt = new Date().toISOString();
        await App.saveSettings();
        const data = await DB.exportData();
        U.downloadText(`otter-backup-${U.todayStr()}.json`, data, 'application/json');
        UI.toast('Backup file downloaded', 'ph-download-simple');
        await App.changed({ celebrate: false });
      },
      import: async () => {
        const file = await U.pickFile('.json,application/json,text/plain');
        if (!file) return;
        const text = await U.readFileText(file);
        if (!(await UI.confirm(`Replace everything on this device with "${file.name}"? This cannot be undone.`, { ok: 'Replace my data', danger: true }))) return;
        try {
          await DB.importData(text);
          UI.toast('Backup restored. Reloading…', 'ph-check-circle');
          setTimeout(() => location.reload(), 800);
        } catch (e) { await UI.confirm(e.message, { ok: 'OK', title: 'Import failed' }); }
      },
      merge: () => More.addPrivateFile(),
      erase: async () => {
        if (!(await UI.confirm('Erase ALL data on this device?', { ok: 'Continue', danger: true }))) return;
        if (!(await UI.confirm('Really erase everything? Your streaks, plans and ideas will be gone unless you have a backup.', { ok: 'Erase everything', danger: true, title: 'Last check' }))) return;
        DB.db.close();
        indexedDB.deleteDatabase('OtterDB').onsuccess = () => location.reload();
      }
    };
  },

  // ---------- Otter screen ----------
  async renderOtter() {
    const items = await Otto.unlocked();
    const eq = App.settings.otter.equipped || [];
    return `${UI.header(`${Otto.name()}'s wardrobe`)}
      <section class="hero" style="grid-template-columns:1fr;justify-items:center">
        <div class="mascot-slot">${Mascot.svg('otter', { state: 'idle', size: 170, acc: eq, pebbles: App.streaks ? App.streaks.overall.pebbles : 0 })}</div>
        <div class="muted small">${items.filter(i => i.open).length} of ${items.length} unlocked · tap an unlocked item to wear it</div>
      </section>
      <div class="tools">${items.map(i => `<button class="tool" data-act="${i.open ? 'wear' : 'locked'}" data-id="${i.id}" style="${i.open ? '' : 'opacity:.55'}">
        <span class="mascot-slot" style="width:44px;height:44px;flex:0 0 auto">${Mascot.svg('otter', { size: 44, acc: [i.id], state: 'idle', cls: 'm-static' })}</span>
        <span>${U.esc(i.name)}<small>${i.open ? (eq.includes(i.id) ? '✓ Wearing' : 'Unlocked') : `🔒 ${U.esc(i.how)}`}</small></span></button>`).join('')}</div>`;
  },
  otterActions() {
    return {
      wear: async (el) => {
        const eq = new Set(App.settings.otter.equipped || []);
        eq.has(el.dataset.id) ? eq.delete(el.dataset.id) : eq.add(el.dataset.id);
        App.settings.otter.equipped = [...eq];
        await App.saveSettings(); await App.changed({ celebrate: false });
      },
      locked: (el) => { const u = Otto.UNLOCKS.find(x => x.id === el.dataset.id); UI.toast(`Locked: ${u.how}`, 'ph-lock'); }
    };
  },

  // ---------- weekly review steps editor ----------
  renderReviewSteps() {
    const steps = App.settings.reviewSteps || [];
    const TYPES = { lastWeek: 'Look back at last week', inbox: 'Clear the inbox', boards: 'Boards, waiting-on, deadlines', priorities: 'Choose priorities', schedule: 'Place into days', backup: 'Backup reminder', question: 'Your own question' };
    return `${UI.header('Weekly review steps', { right: '<button class="icon-btn" data-act="add" aria-label="Add question"><i class="ph ph-plus"></i></button>' })}
      <div class="list">${steps.map((s, i) => `<div class="row"><span class="row-icon"><i class="ph ${s.enabled ? 'ph-check-square' : 'ph-square'}"></i></span>
        <button class="row-main" data-act="edit" data-i="${i}" style="text-align:left"><span class="row-title">${i + 1}. ${U.esc(s.title)}</span><span class="row-sub">${U.esc(TYPES[s.type] || s.type)}${s.prompt ? ` · ${U.esc(s.prompt)}` : ''}</span></button>
        <button class="icon-btn" data-act="up" data-i="${i}" aria-label="Move up"><i class="ph ph-arrow-up"></i></button></div>`).join('')}</div>
      <p class="muted small">Tap a step to rename it, change its question or switch it off. + adds your own question.</p>`;
  },
  reviewStepsActions() {
    const s = App.settings;
    const save = async () => { await App.saveSettings(); await App.changed({ celebrate: false }); };
    return {
      add: async () => {
        const f = await UI.form('New question', [{ name: 'title', label: 'Step title', required: true, value: 'Reflect' }, { name: 'prompt', type: 'textarea', label: 'Question', required: true }]);
        if (f) { s.reviewSteps.push({ id: U.uid('rs'), type: 'question', title: f.title, prompt: f.prompt, enabled: true }); await save(); }
      },
      edit: async (el) => {
        const st = s.reviewSteps[Number(el.dataset.i)];
        const f = await UI.form('Edit step', [{ name: 'title', label: 'Title', value: st.title, required: true }, { name: 'prompt', type: 'textarea', label: 'Question / note', value: st.prompt },
          { name: 'enabled', type: 'checkbox', label: 'Include this step', value: st.enabled }], { buttons: st.type === 'question' ? [{ label: 'Delete step', value: 'del', danger: true }] : [] });
        if (!f) return;
        if (f._button === 'del') s.reviewSteps.splice(Number(el.dataset.i), 1); else Object.assign(st, f);
        await save();
      },
      up: async (el) => {
        const i = Number(el.dataset.i);
        if (i > 0) { [s.reviewSteps[i - 1], s.reviewSteps[i]] = [s.reviewSteps[i], s.reviewSteps[i - 1]]; await save(); }
      }
    };
  }
};
window.More = More;

Nav.register('more', { tab: 'more', render: () => More.renderHub(), actions: () => ({ go: (el) => Nav.go(el.dataset.view), addPrivate: () => More.addPrivateFile() }) });
Nav.register('inbox', { tab: 'more', render: (p) => More.renderInbox(p), actions: (p) => More.inboxActions(p) });
Nav.register('settings', { tab: 'more', render: () => More.renderSettings(), actions: () => More.settingsActions() });
Nav.register('backup', { tab: 'more', render: () => More.renderBackup(), actions: () => More.backupActions() });
Nav.register('otterScreen', { tab: 'more', render: () => More.renderOtter(), actions: () => More.otterActions() });
Nav.register('reviewSteps', { tab: 'more', render: () => More.renderReviewSteps(), actions: () => More.reviewStepsActions() });
