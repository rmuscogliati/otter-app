// ======= areas.js — the area strip, each area's page, and area settings =======

const Areas = {
  // Tools shown on each area page. A tool only appears once its screen exists (no dead buttons).
  TOOLS: {
    a1: [['gym', 'Workout log', 'ph-barbell'], ['cardio', 'Runs & cardio', 'ph-sneaker-move'], ['gymTemplates', 'Workout templates', 'ph-list-checks'], ['gymPRs', 'Personal records', 'ph-trophy'], ['gymVolume', 'Weekly volume', 'ph-chart-bar'], ['health', 'Health sync', 'ph-heartbeat']],
    a2: [['ideas', 'Research ideas', 'ph-lightbulb'], ['researchBoards', 'Projects', 'ph-kanban'], ['reading', 'Reading queue', 'ph-books'], ['guidelines', 'Reporting checklists', 'ph-list-checks'],
      ['opportunities', 'Conferences & grants', 'ph-presentation'], ['publications', 'Publications', 'ph-newspaper'], ['deadlines', 'Deadlines', 'ph-hourglass-medium'], ['waiting', 'Waiting on', 'ph-hand-palm']],
    a3: [['wardJobs', 'Ward jobs', 'ph-list-checks'], ['clinicalQs', 'Clinical questions', 'ph-question'], ['shifts', 'Shift planner', 'ph-calendar-dots'], ['cases', 'Case / procedure log', 'ph-first-aid-kit'],
      ['portfolio', 'Portfolio tracker', 'ph-folders'], ['certs', 'Certificates & training', 'ph-certificate'], ['cpd', 'Courses, leave & teaching', 'ph-chalkboard-teacher']],
    a4: [['topics', 'Topic map & spaced review', 'ph-brain'], ['qbank', 'Question banks & study log', 'ph-exam'], ['exams', 'Exam countdown', 'ph-timer'], ['watch', 'Journal & guideline watch', 'ph-binoculars']],
    a5: [['videoIdeas', 'Idea bank', 'ph-lightbulb'], ['mtBoard', 'MedTwins board', 'ph-kanban'], ['contentCal', 'Content calendar', 'ph-calendar'], ['videoStats', 'Analytics', 'ph-chart-line-up'], ['mtKit', 'Script & checklists', 'ph-clipboard-text']],
    a6: [['germanTasks', 'German tasks', 'ph-translate'], ['goethe', 'Goethe exam', 'ph-graduation-cap'], ['cando', 'Can-do checklist', 'ph-check-square'], ['mistakes', 'Mistakes log', 'ph-warning-circle'], ['speaking', 'Speaking minutes', 'ph-microphone']]
  },
  COMMON_TOOLS: [['wins', 'Wins', 'ph-trophy'], ['goals', 'Goals', 'ph-target'], ['timeStats', 'Time spent', 'ph-clock']],
  extraHooks: {}, // areaId -> async () => html (e.g. the research summary)

  renderStrip() {
    const host = document.getElementById('area-strip');
    if (!host || !App.settings) return;
    const cur = Nav.current();
    const activeId = cur && cur.name === 'area' ? cur.params.id : null;
    host.innerHTML = App.visibleAreas().map(a => {
      const r = App.streaks && App.streaks.areas[a.id];
      const face = Otto.show() ? Mascot.svg(a.mascot || 'otter', { face: true, size: 40, state: r && !r.needs && !r.paused ? 'celebrate' : 'idle', title: a.name })
        : `<i class="ph ${a.icon || 'ph-circle'}" style="font-size:1.3rem;color:${a.color}"></i>`;
      return `<button class="area-btn ${a.id === activeId ? 'active' : ''} ${a.paused ? 'paused' : ''}" style="--c:${a.color}" data-area="${a.id}" aria-label="${U.esc(a.name)}: streak ${r ? r.current : 0}${r && r.needs ? ', still needs something' : ''}">
        <span class="face">${face}</span>
        <span class="num"><i class="ph-fill ph-fire"></i>${r && !r.paused ? r.current : '–'}</span>
        ${r && r.needs ? '<span class="needs"></span>' : ''}</button>`;
    }).join('');
  },

  miniCalendar(area, r) {
    const today = U.todayStr();
    const start = U.addDays(U.weekStart(today), -21);
    let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="dow">${d}</div>`).join('');
    const weeks = [];
    for (let w = 0; w < 4; w++) {
      const ws = U.addDays(start, w * 7);
      weeks.push(ws);
      for (let i = 0; i < 7; i++) {
        const d = U.addDays(ws, i);
        let cls = 'cs-future';
        if (d <= today && d >= App.settings.startDate) {
          const du = (r.dayUnits || {})[d] || { units: 0, kind: 'normal' };
          if (area.streakType === 'weekly') cls = du.units > 0 ? 'cs-complete' : (du.kind !== 'normal' ? `cs-${du.kind === 'protected' ? 'protected' : 'rest'}` : 'cs-none');
          else {
            const s = r.dayStatus[d];
            cls = s ? `cs-${s}` : 'cs-none';
          }
        }
        cells += `<div class="day ${cls} ${d === today ? 'today' : ''}" title="${U.fmtDate(d)}">${U.parseDate(d).getDate()}</div>`;
      }
    }
    let weekRow = '';
    if (area.streakType === 'weekly') {
      weekRow = `<div class="legend" style="margin-top:8px">${weeks.map(ws => {
        const s = ws === U.weekStart(today) ? (r.week.units >= r.week.target ? 'complete' : 'pending') : (r.weekStatus[ws] || 'none');
        const label = { complete: '✓ counted', pebble: '● pebble', missed: '✗ missed', partial: '✗ missed', rest: 'rest', pending: 'this week', none: '–' }[s] || s;
        return `<span><i class="cs-${s}"></i>Week of ${U.fmtDate(ws, { dow: false })}: ${label}</span>`;
      }).join('')}</div>`;
    }
    return `<div class="mini-cal cal">${cells}</div>${weekRow}
      <div class="legend"><span><i class="cs-complete"></i>Counted</span><span><i class="cs-pebble"></i>Pebble</span><span><i class="cs-missed"></i>Missed</span><span><i class="cs-rest"></i>Rest</span><span><i class="cs-protected"></i>Protected</span></div>`;
  },

  toolsHtml(area) {
    const list = [...(Areas.TOOLS[area.id] || []), ...Areas.COMMON_TOOLS].filter(([view]) => Nav.views[view]);
    if (!list.length) return '';
    return `<div class="section-title">Tools</div><div class="tools">${list.map(([view, label, icon]) =>
      `<button class="tool" style="--c:${area.color}" data-act="tool" data-view="${view}"><i class="ph ${icon}"></i><span>${U.esc(label)}</span></button>`).join('')}</div>`;
  },

  async render({ id }) {
    const area = App.areaById(id);
    if (!area) return `${UI.header('Area')}${UI.empty('This area no longer exists.')}`;
    const r = (App.streaks && App.streaks.areas[id]) || { current: 0, longest: 0, pebbles: 0, week: { units: 0, target: 1 }, dayStatus: {}, weekStatus: {}, dayUnits: {}, todayUnits: 0, target: 1 };
    const msg = Otto.areaMessage(area, r);
    const day = await Days.ensure(U.todayStr());
    const tasks = day.tasks.filter(t => t.areaId === id);
    const unit = area.streakType === 'weekly' ? 'week' : 'day';
    const prog = area.streakType === 'weekly'
      ? `<div class="small" style="margin-top:6px;font-weight:700">This week: ${r.week.units} of ${r.week.target} ${area.measure === 'minutes' ? 'min' : ''}</div>${UI.progress(r.week.units, r.week.target, '#fff')}`
      : area.streakType === 'daily' ? `<div class="small" style="margin-top:6px;font-weight:700">Today: ${r.todayUnits} of ${r.target} ${area.measure === 'minutes' ? 'min' : ''}${r.todayKind !== 'normal' ? ` (${r.todayKind} day)` : ''}</div>${UI.progress(r.todayUnits, r.target, '#fff')}` : '';
    const extra = Areas.extraHooks[id] ? await Areas.extraHooks[id]() : '';
    const mascotState = msg.key === 'met' && (r.current >= 7) ? 'big' : Otto.areaState(msg.key);
    return `${UI.header(area.name, { right: `<button class="icon-btn" data-act="settings" aria-label="Area settings"><i class="ph ph-gear-six"></i></button>` })}
      <section class="area-hero" style="--c:${area.color}">
        <div class="mascot-slot area-mascots">${Otto.show() ? Mascot.svg(area.mascot || 'otter', { state: mascotState, size: 104 }) : ''}
          ${Otto.show() && (Mascot.AREA_PROPS[id] || []).length ? `<span class="otto-buddy" aria-label="${U.esc(Otto.name())} in ${U.esc(area.name)} gear">${Otto.html('idle', 50, Mascot.AREA_PROPS[id])}</span>` : ''}</div>
        <div>
          <div class="bubble">${U.esc(msg.text)}</div>
          ${r.paused ? '<div class="small" style="margin-top:6px;font-weight:800">Streak paused</div>' : `<div class="area-stats">
            <div>${r.current}<small>${unit} streak</small></div><div>${r.longest}<small>longest</small></div><div>${'●'.repeat(r.pebbles) || '0'}<small>pebbles</small></div></div>${prog}`}
        </div>
      </section>
      <div class="section-title">Today's ${U.esc(area.name)} tasks <button data-act="addTask">+ Add</button></div>
      ${tasks.length ? tasks.map(t => Today.taskCard(t, day)).join('') : UI.empty('Nothing for this area today.', 'ph-coffee')}
      ${extra}
      ${r.paused ? '' : `<div class="section-title">Last 4 weeks</div><div class="card">${Areas.miniCalendar(area, r)}</div>`}
      ${Areas.toolsHtml(area)}
      <div class="card flat small muted" style="margin-top:12px">${U.esc(Areas.ruleText(area))}</div>`;
  },
  ruleText(a) {
    if (a.streakType === 'none') return 'No streak for this area: it just tracks your work.';
    const what = a.measure === 'minutes' ? `${a.target} minutes logged with the focus timer` : `${a.target} completed task${a.target > 1 ? 's' : ''} (optional tasks don't count)`;
    const extra = [];
    if (a.restDays && a.restDays.length) extra.push(`rest days: ${a.restDays.map(d => U.DOW3[d]).join(', ')}`);
    if (a.workingDaysOnly) extra.push('only working days count (days whose plan has this area\'s blocks; days off from the shift planner are rest days)');
    if (a.protectWithModes) extra.push('streak-protecting modes (e.g. night shift) also protect this streak');
    return `${a.streakType === 'weekly' ? 'Weekly' : 'Daily'} streak: at least ${what} per ${a.streakType === 'weekly' ? 'week (Mon–Sun)' : 'day'}. ${extra.length ? `Also: ${extra.join('; ')}.` : ''} Pebbles: 1 earned every 7 in a row (max 2), used automatically.`;
  },
  actions({ id }) {
    return {
      tick: async (el) => {
        const res = await Days.toggleTask(U.todayStr(), el.dataset.id);
        if (res.changed && res.done && res.task.xp) UI.toast(`+${res.task.xp} XP`, 'ph-star');
        await App.changed();
      },
      edit: async (el) => {
        const day = await Days.ensure(U.todayStr());
        const task = day.tasks.find(t => t.id === el.dataset.id);
        if (task) TaskEditor.open({ date: U.todayStr(), task });
      },
      focus: async (el) => {
        const day = await Days.ensure(U.todayStr());
        const task = day.tasks.find(t => t.id === el.dataset.id);
        if (task && window.Focus) Focus.start({ task, date: U.todayStr() });
      },
      workout: (el) => { if (window.Gym) Gym.startFromTask(U.todayStr(), el.dataset.id); },
      openReview: () => Nav.go('weeklyReview'),
      wardJobs: () => Nav.go('wardJobs', {}),
      addTask: () => TaskEditor.open({ date: U.todayStr(), preset: { areaId: id } }),
      settings: () => Areas.editArea(id),
      tool: (el) => Nav.go(el.dataset.view, { areaId: id }),
      ...(Areas.extraActions[id] ? Areas.extraActions[id]() : {})
    };
  },
  extraActions: {},

  MASCOTS: [['otter', 'Giant otter'], ['jaguar', 'Jaguar'], ['anteater', 'Giant anteater'], ['capybara', 'Capybara'], ['tamarin', 'Golden lion tamarin'], ['toucan', 'Toco toucan'], ['macaw', 'Hyacinth macaw'], ['sloth', 'Sloth']],
  ICONS: ['ph-barbell', 'ph-flask', 'ph-stethoscope', 'ph-book-open-text', 'ph-video-camera', 'ph-translate', 'ph-heart', 'ph-briefcase', 'ph-music-notes', 'ph-paint-brush', 'ph-house', 'ph-users', 'ph-leaf', 'ph-star'],

  async editArea(id) {
    const isNew = !id;
    const a = isNew ? { id: U.uid('area'), name: '', color: '#0CA678', mascot: 'otter', icon: 'ph-star', order: App.areas.length + 1, streakType: 'daily', measure: 'tasks',
      target: 1, restDays: [], workingDaysOnly: false, pebblesStart: 0, protectWithModes: true, paused: false, archived: false } : U.clone(App.areaById(id));
    const r = App.streaks && App.streaks.areas[a.id];
    const vals = await UI.form(isNew ? 'New area' : `${a.name} settings`, [
      { name: 'name', label: 'Name', value: a.name, required: true },
      { type: 'html', html: '<div class="two">' },
      { name: 'color', type: 'color', label: 'Colour', value: a.color },
      { name: 'icon', type: 'select', label: 'Icon', value: a.icon, options: Areas.ICONS.map(i => ({ value: i, label: i.replace('ph-', '').replace(/-/g, ' ') })) },
      { type: 'html', html: '</div>' },
      { name: 'mascot', type: 'select', label: 'Mascot', value: a.mascot, options: Areas.MASCOTS.map(([v, l]) => ({ value: v, label: l })) },
      { name: 'streakType', type: 'select', label: 'Streak type', value: a.streakType, options: [{ value: 'daily', label: 'Daily streak' }, { value: 'weekly', label: 'Weekly target' }, { value: 'none', label: 'No streak (just tracking)' }] },
      { type: 'html', html: '<div class="two">' },
      { name: 'measure', type: 'select', label: 'What counts', value: a.measure, options: [{ value: 'tasks', label: 'Tasks completed' }, { value: 'minutes', label: 'Minutes (focus timer)' }] },
      { name: 'target', type: 'number', label: 'Target', value: a.target, min: 1, step: 1, hint: 'Per day or per week' },
      { type: 'html', html: '</div>' },
      { name: 'restDays', type: 'checks', label: 'Rest days (never break the streak)', value: a.restDays, options: [1, 2, 3, 4, 5, 6, 0].map(d => ({ value: d, label: U.DOW3[d] })) },
      { name: 'workingDaysOnly', type: 'checkbox', label: 'Only count working days (days off and shift days without this area are rest days)', value: a.workingDaysOnly },
      { name: 'protectWithModes', type: 'checkbox', label: 'Streak-protecting day modes also protect this streak', value: a.protectWithModes },
      { name: 'pebblesStart', type: 'number', label: `Bonus pebbles${r ? ` (now holding ${r.pebbles})` : ''}`, value: a.pebblesStart || 0, min: 0, max: 2, step: 1, hint: 'Pebbles are also earned automatically: 1 per 7 in a row, max 2.' },
      { name: 'paused', type: 'checkbox', label: 'Pause this area (streak frozen)', value: a.paused },
      ...(isNew ? [] : [{ name: 'archived', type: 'checkbox', label: 'Archive (hidden, history kept)', value: a.archived }])
    ], { submit: isNew ? 'Create area' : 'Save', buttons: isNew ? [] : [{ label: 'Edit mascot messages', value: 'messages' }] });
    if (!vals) return;
    if (vals._button === 'messages') return Areas.editMessages(a.id);
    Object.assign(a, vals, { target: Math.max(1, Number(vals.target) || 1), restDays: vals.restDays.map(Number), pebblesStart: U.clamp(Number(vals.pebblesStart) || 0, 0, 2) });
    await Repo.put('areas', a);
    UI.toast(isNew ? 'Area created' : 'Area saved');
    await App.changed({ celebrate: false });
  },
  async editMessages(id) {
    const a = U.clone(App.areaById(id));
    const m = a.messages || U.clone(Defaults.areaMessages);
    const labels = { zero: 'Streak at zero', going: 'Streak going ({streak} = number)', met: 'Done for today / this week', atRisk: 'Evening, still to do', rest: 'Rest / protected day' };
    const vals = await UI.form(`${a.name}: mascot messages`, Object.keys(labels).map(k => ({ name: k, type: 'textarea', label: labels[k], value: (m[k] || []).join('\n'), hint: 'One message per line' })), { submit: 'Save messages' });
    if (!vals) return;
    a.messages = {};
    Object.keys(labels).forEach(k => { a.messages[k] = vals[k].split('\n').map(x => x.trim()).filter(Boolean); if (!a.messages[k].length) a.messages[k] = Defaults.areaMessages[k]; });
    await Repo.put('areas', a);
    UI.toast('Messages saved');
    await App.changed({ celebrate: false });
  }
};
window.Areas = Areas;

Nav.register('area', { tab: 'today', render: (p) => Areas.render(p), actions: (p) => Areas.actions(p),
  mounted: () => Areas.renderStrip() });
