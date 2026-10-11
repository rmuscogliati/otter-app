// ======= plan.js — calendar, templates, week plans, shifts, modes, areas, holidays =======

const Plan = {
  STATUS_LABEL: { complete: 'Complete', minimum: 'Minimum routine', protected: 'Protected (mode)', pebble: 'Saved by a pebble',
    partial: 'Partly done', missed: 'Missed', rest: 'Rest (no required tasks)', holiday: 'Holiday', today: 'Today (in progress)', future: 'Planned', none: 'Before you started' },

  // ---------- month calendar (used by Plan › Calendar and the streak page) ----------
  calendarCard(month, view) {
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`;
    const daysIn = new Date(y, m, 0).getDate();
    const lead = (U.dow(first) + 6) % 7; // Monday first
    const today = U.todayStr();
    const statuses = (App.streaks && App.streaks.overall.statuses) || {};
    let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < lead; i++) cells += '<div class="day blank"></div>';
    for (let d = 1; d <= daysIn; d++) {
      const ds = `${month}-${U.pad(d)}`;
      let st = ds > today ? 'future' : (statuses[ds] || (ds < App.settings.startDate ? 'none' : 'missed'));
      const sh = ds >= today ? Days.shiftFor(ds) : null;
      const mk = sh ? `<span class="mk"><i class="ph-fill ${(Days.modeById(sh.modeId) || {}).icon || 'ph-moon'}"></i></span>` : '';
      cells += `<button class="day cs-${st} ${ds === today ? 'today' : ''}" data-act="calDay" data-date="${ds}" aria-label="${U.fmtDate(ds)}: ${Plan.STATUS_LABEL[st] || st}">${d}${mk}</button>`;
    }
    const prev = U.monthStr(U.addDays(first, -1)), next = U.monthStr(U.addDays(first, 32));
    return `<div class="card"><div class="cal-head">
        <button class="icon-btn" data-act="calMonth" data-month="${prev}" aria-label="Previous month"><i class="ph ph-caret-left"></i></button>
        <h2>${U.MONTHS[m - 1]} ${y}</h2>
        <button class="icon-btn" data-act="calMonth" data-month="${next}" aria-label="Next month"><i class="ph ph-caret-right"></i></button></div>
      <div class="cal">${cells}</div>
      <div class="legend">${['complete', 'partial', 'minimum', 'protected', 'missed', 'pebble', 'rest'].map(s => `<span><i class="cs-${s}"></i>${Plan.STATUS_LABEL[s]}</span>`).join('')}</div></div>`;
  },
  calendarActions(view) {
    return {
      calMonth: (el) => Nav.go(view, { ...Nav.current().params, month: el.dataset.month }, { replace: true }),
      calDay: (el) => Plan.daySheet(el.dataset.date)
    };
  },
  async daySheet(date) {
    const day = await Days.get(date);
    const today = U.todayStr();
    const statuses = (App.streaks && App.streaks.overall.statuses) || {};
    const st = date > today ? 'future' : (statuses[date] || 'missed');
    const mode = day ? Days.modeById(day.modeId) : Days.modeById(Days.plannedModeId(date));
    const sh = Days.shiftFor(date);
    const tasks = day ? day.tasks.filter(t => !t.infoOnly) : [];
    const done = new Set(day ? day.completedTaskIds : []);
    const html = `<p class="sheet-text"><span class="tag cs-${st}" style="color:inherit">${Plan.STATUS_LABEL[st] || st}</span>
        ${mode ? `<span class="tag">${U.esc(mode.name)}</span>` : ''}${sh ? `<span class="tag info">Shift: ${U.esc(sh.label || (Days.modeById(sh.modeId) || {}).name || '')}</span>` : ''}</p>
      ${day ? (tasks.length ? `<div class="list">${tasks.map(t => `<div class="row"><span class="row-icon" style="--row-color:${(App.areaById(t.areaId) || {}).color || '#888'}"><i class="ph ${done.has(t.id) ? 'ph-check-circle' : 'ph-circle'}"></i></span>
          <span class="row-main"><span class="row-title">${U.esc(t.title)}${t.core ? ' ★' : ''}</span><span class="row-sub">${t.time}–${t.endTime}${t.optional ? ' · optional' : ''}</span></span></div>`).join('')}</div>` : UI.empty('No tickable tasks on this day.'))
        : `<p class="muted">${date < today ? 'The app was not opened and nothing was planned on this day.' : 'Not planned yet.'}</p>`}
      <button class="btn btn-primary btn-block" data-act="open"><i class="ph ph-calendar-check"></i> ${day ? 'Open this day' : 'Plan this day'}</button>
      ${date >= today ? `<button class="btn btn-ghost btn-block" data-act="shift"><i class="ph ph-moon"></i> Set a shift / day mode</button>` : ''}`;
    UI.sheet({ title: U.fmtDate(date, { year: true }), html, onMount: (el, close) => UI.on(el, {
      open: () => { close(); App.date = date; Nav.go('today', {}, { root: true }); },
      shift: async () => { close(); await Plan.editShift({ date }); }
    }) });
  },

  // ---------- hub ----------
  renderHub() {
    const wp = Days.weekPlanFor(U.todayStr());
    const upcoming = Plan.upcomingShifts(30).length;
    return `${UI.header('Plan', { back: false })}
      <div class="list">
        ${UI.row({ icon: 'ph-calendar', title: 'Calendar & history', sub: 'Every day coloured by status. Tap a day to plan it.', act: 'go', data: { view: 'calendar' } })}
        ${UI.row({ icon: 'ph-stack', title: 'Day templates', sub: `${Days.dayTemplates().length} templates`, act: 'go', data: { view: 'templates' } })}
        ${UI.row({ icon: 'ph-calendar-dots', title: 'Week plans', sub: `Active: ${U.esc(wp ? wp.name : '–')} · default template per weekday`, act: 'go', data: { view: 'weekplans' } })}
        ${UI.row({ icon: 'ph-moon-stars', title: 'Shift planner', sub: `${upcoming} shift day${upcoming === 1 ? '' : 's'} in the next 30 days`, act: 'go', data: { view: 'shifts' } })}
        ${UI.row({ icon: 'ph-swap', title: 'Day modes', sub: App.modes.map(m => m.name).join(', '), act: 'go', data: { view: 'modes' } })}
        ${UI.row({ icon: 'ph-squares-four', title: 'Areas', sub: 'Add, rename, recolour, reorder, pause or archive', act: 'go', data: { view: 'areasManage' } })}
        ${UI.row({ icon: 'ph-airplane-tilt', title: 'Holiday mode', sub: 'Pause chosen areas without breaking streaks', act: 'go', data: { view: 'holidays' } })}
        ${Nav.views.capacity ? UI.row({ icon: 'ph-gauge', title: 'Capacity check', sub: 'Planned hours vs free hours for a week', act: 'go', data: { view: 'capacity' } }) : ''}
      </div>
      <div class="note"><i class="ph ph-info"></i><span>Templates are only starting points. Each day keeps its own plan, and editing a template never changes past days.</span></div>`;
  },
  hubActions() { return { go: (el) => Nav.go(el.dataset.view) }; },

  // ---------- templates ----------
  renderTemplates() {
    const wps = App.weekPlans;
    const usedBy = (id) => wps.flatMap(w => Object.entries(w.days || {}).filter(([, t]) => t === id).map(([d]) => `${U.DOW3[d]}${wps.length > 1 ? ` (${w.name})` : ''}`));
    return `${UI.header('Day templates', { right: '<button class="icon-btn" data-act="add" aria-label="New template"><i class="ph ph-plus"></i></button>' })}
      <div class="list">${Days.dayTemplates().map(t => {
        const used = usedBy(t.id);
        return UI.row({ icon: 'ph-stack', title: U.esc(t.name), sub: `${t.tasks.length} tasks${used.length ? ` · default for ${used.join(', ')}` : ''}`, act: 'open', data: { id: t.id } });
      }).join('')}</div>
      <p class="muted small">Tip: on any day, use ⋯ › "Save this day as a new template".</p>`;
  },
  templatesActions() {
    return {
      open: (el) => Nav.go('template', { id: el.dataset.id }),
      add: async () => {
        const v = await UI.form('New template', [{ name: 'name', label: 'Name', required: true, placeholder: 'e.g. Exam period day' },
          { name: 'copy', type: 'select', label: 'Start from', options: [{ value: '', label: 'Empty' }, ...Days.dayTemplates().map(t => ({ value: t.id, label: `Copy of ${t.name}` }))] }]);
        if (!v) return;
        const src = Days.templateById(v.copy);
        const tpl = await Repo.put('templates', { id: U.uid('tpl'), kind: 'day', name: v.name, modeId: src ? src.modeId : 'm_normal', tasks: src ? U.clone(src.tasks) : [] });
        await App.changed({ celebrate: false });
        Nav.go('template', { id: tpl.id });
      }
    };
  },
  renderTemplate({ id }) {
    const t = Days.templateById(id);
    if (!t) return `${UI.header('Template')}${UI.empty('Template not found.')}`;
    const mode = Days.modeById(t.modeId);
    return `${UI.header(t.name, { right: '<button class="icon-btn" data-act="menu" aria-label="Template options"><i class="ph ph-dots-three-outline"></i></button>' })}
      <p class="muted small" style="margin-bottom:8px">Day mode: <b>${U.esc(mode ? mode.name : 'Normal')}</b> · ${t.tasks.length} tasks · tasks are ordered by start time.</p>
      ${t.tasks.map(task => {
        const a = App.areaById(task.areaId);
        return `<div class="task ${task.infoOnly ? 'info' : ''} ${task.optional ? 'optional' : ''}" style="--c:${a ? a.color : 'var(--line)'}">
          <button class="task-main" data-act="edit" data-id="${task.id}"><span class="task-text"><span class="task-time">${task.time}–${task.endTime}</span>
          <span class="task-title">${U.esc(task.title)} ${task.core ? '<i class="ph-fill ph-star star"></i>' : ''}</span>
          <span class="task-desc">${U.esc(a ? a.name : 'No area')}${task.infoOnly ? ' · info only' : ` · ${task.xp ?? 10} XP`}${task.desc ? ` · ${U.esc(task.desc)}` : ''}</span></span></button>
          <div class="task-side"><button data-act="edit" data-id="${task.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div></div>`;
      }).join('') || UI.empty('No tasks yet.')}
      <button class="btn btn-primary btn-block" data-act="addTask"><i class="ph ph-plus"></i> Add task</button>`;
  },
  templateActions({ id }) {
    return {
      edit: (el) => { const t = Days.templateById(id); TaskEditor.open({ templateId: id, task: t.tasks.find(x => x.id === el.dataset.id) }); },
      addTask: () => TaskEditor.open({ templateId: id }),
      menu: async () => {
        const t = Days.templateById(id);
        const v = await UI.choose(t.name, [
          { value: 'rename', label: 'Rename / change day mode', icon: 'ph-pencil-simple' },
          { value: 'dup', label: 'Duplicate', icon: 'ph-copy' },
          { value: 'del', label: 'Delete template', icon: 'ph-trash', danger: true }]);
        if (v === 'rename') {
          const f = await UI.form('Template', [{ name: 'name', label: 'Name', value: t.name, required: true },
            { name: 'modeId', type: 'select', label: 'Day mode for days made from it', value: t.modeId || 'm_normal', options: App.modes.map(m => ({ value: m.id, label: m.name })) }]);
          if (f) { t.name = f.name; t.modeId = f.modeId; await Repo.put('templates', t); await App.changed({ celebrate: false }); }
        } else if (v === 'dup') {
          const copy = await Repo.put('templates', { id: U.uid('tpl'), kind: 'day', name: `${t.name} (copy)`, modeId: t.modeId, tasks: U.clone(t.tasks) });
          await App.changed({ celebrate: false }); Nav.go('template', { id: copy.id }, { replace: true });
        } else if (v === 'del') {
          const used = App.weekPlans.filter(w => Object.values(w.days || {}).includes(id));
          const inModes = App.modes.filter(m => m.templateId === id);
          if (used.length || inModes.length) {
            await UI.confirm(`"${t.name}" is still used by ${[...used.map(w => `week plan "${w.name}"`), ...inModes.map(m => `day mode "${m.name}"`)].join(', ')}. Choose another template there first.`, { ok: 'OK', cancel: 'Close', title: 'Template in use' });
            return;
          }
          if (await UI.confirm(`Delete "${t.name}"? Days already planned from it keep their tasks.`, { ok: 'Delete', danger: true })) {
            await Repo.del('templates', id); await App.changed({ celebrate: false }); Nav.back();
          }
        }
      }
    };
  },

  // ---------- week plans ----------
  renderWeekPlans() {
    const sched = [...(App.settings.weekPlanSchedule || [])].sort(U.by(s => s.from));
    const cur = Days.weekPlanFor(U.todayStr());
    const opts = Days.dayTemplates();
    return `${UI.header('Week plans', { right: '<button class="icon-btn" data-act="addPlan" aria-label="New week plan"><i class="ph ph-plus"></i></button>' })}
      <p class="muted small" style="margin-bottom:10px">A week plan chooses the default template for each weekday. Switch to another plan from any date (e.g. "Exam period" from 1 March).</p>
      ${App.weekPlans.map(w => `<div class="card">
        <div class="cal-head"><h3>${U.esc(w.name)} ${cur && cur.id === w.id ? '<span class="tag good">active now</span>' : ''}</h3>
          <button class="icon-btn" data-act="planMenu" data-id="${w.id}" aria-label="Options"><i class="ph ph-dots-three-outline"></i></button></div>
        ${[1, 2, 3, 4, 5, 6, 0].map(d => `<div class="field" style="display:grid;grid-template-columns:52px 1fr;gap:8px;align-items:center;margin-bottom:6px">
          <b>${U.DOW3[d]}</b><select data-change="setDay" data-plan="${w.id}" data-dow="${d}">
          ${opts.map(t => `<option value="${t.id}" ${(w.days || {})[d] === t.id ? 'selected' : ''}>${U.esc(t.name)}</option>`).join('')}</select></div>`).join('')}
      </div>`).join('')}
      <div class="section-title">Switching schedule <button data-act="addSwitch">+ Switch from a date</button></div>
      <div class="list">${sched.map((s, i) => {
        const w = App.weekPlans.find(x => x.id === s.weekPlanId);
        return UI.row({ icon: 'ph-arrow-right', title: `${i === 0 ? 'From the start' : `From ${U.fmtDate(s.from, { year: true })}`}: ${U.esc(w ? w.name : '?')}`,
          sub: i === 0 ? 'Base plan' : 'Tap to remove this switch', act: i === 0 ? '' : 'delSwitch', data: { from: s.from }, right: i === 0 ? '' : '<i class="ph ph-trash row-caret"></i>' });
      }).join('')}</div>`;
  },
  weekPlansActions() {
    return {
      setDay: async (el) => {
        const w = App.weekPlans.find(x => x.id === el.dataset.plan);
        w.days = { ...(w.days || {}), [el.dataset.dow]: el.value };
        await Repo.put('weekPlan', w); UI.toast(`${U.DOW[el.dataset.dow]} now starts from "${Days.templateById(el.value).name}"`);
        await App.changed({ celebrate: false });
      },
      addPlan: async () => {
        const f = await UI.form('New week plan', [{ name: 'name', label: 'Name', required: true, placeholder: 'e.g. Exam period' },
          { name: 'copy', type: 'select', label: 'Start from', options: App.weekPlans.map(w => ({ value: w.id, label: `Copy of ${w.name}` })) }]);
        if (!f) return;
        const src = App.weekPlans.find(w => w.id === f.copy);
        await Repo.put('weekPlan', { id: U.uid('wp'), name: f.name, days: U.clone(src ? src.days : {}) });
        await App.changed({ celebrate: false });
      },
      planMenu: async (el) => {
        const w = App.weekPlans.find(x => x.id === el.dataset.id);
        const v = await UI.choose(w.name, [{ value: 'rename', label: 'Rename', icon: 'ph-pencil-simple' }, { value: 'use', label: 'Use from a date…', icon: 'ph-calendar-check' },
          { value: 'del', label: 'Delete', icon: 'ph-trash', danger: true }]);
        if (v === 'rename') {
          const f = await UI.form('Rename', [{ name: 'name', label: 'Name', value: w.name, required: true }]);
          if (f) { w.name = f.name; await Repo.put('weekPlan', w); await App.changed({ celebrate: false }); }
        } else if (v === 'use') Plan.addSwitch(w.id);
        else if (v === 'del') {
          if ((App.settings.weekPlanSchedule || []).some(s => s.weekPlanId === w.id)) {
            await UI.confirm('This week plan is in the switching schedule. Remove it from the schedule first.', { ok: 'OK', title: 'In use' }); return;
          }
          if (await UI.confirm(`Delete week plan "${w.name}"?`, { ok: 'Delete', danger: true })) { await Repo.del('weekPlan', w.id); await App.changed({ celebrate: false }); }
        }
      },
      addSwitch: () => Plan.addSwitch(),
      delSwitch: async (el) => {
        if (!(await UI.confirm(`Remove the switch from ${U.fmtDate(el.dataset.from)}?`, { ok: 'Remove', danger: true }))) return;
        App.settings.weekPlanSchedule = App.settings.weekPlanSchedule.filter(s => s.from !== el.dataset.from);
        await App.saveSettings(); await App.changed({ celebrate: false });
      }
    };
  },
  async addSwitch(planId) {
    const f = await UI.form('Switch week plan', [
      { name: 'weekPlanId', type: 'select', label: 'Week plan', value: planId || '', options: App.weekPlans.map(w => ({ value: w.id, label: w.name })) },
      { name: 'from', type: 'date', label: 'From date', value: U.addDays(U.todayStr(), 1), required: true }
    ], { submit: 'Add switch', intro: '<p class="sheet-text">Days from this date that are not planned yet will start from this week plan. Days already planned keep their plan.</p>' });
    if (!f) return;
    App.settings.weekPlanSchedule = [...(App.settings.weekPlanSchedule || []).filter(s => s.from !== f.from), { from: f.from, weekPlanId: f.weekPlanId }];
    await App.saveSettings(); UI.toast('Switch added'); await App.changed({ celebrate: false });
  },

  // ---------- shift planner ----------
  upcomingShifts(days) {
    const out = [];
    const today = U.todayStr();
    for (let i = 0; i <= days; i++) { const d = U.addDays(today, i); const sh = Days.shiftFor(d); if (sh) out.push(sh); }
    return out;
  },
  renderShifts() {
    const up = Plan.upcomingShifts(60);
    return `${UI.header('Shift planner')}
      <p class="muted small" style="margin-bottom:10px">Enter on-calls, nights and days off in advance. The day mode is applied automatically, and gym sessions move around night shifts.</p>
      <div class="btn-row" style="margin-top:0"><button class="btn btn-primary" data-act="addOne"><i class="ph ph-plus"></i> Single date</button>
        <button class="btn btn-ghost" data-act="addPattern"><i class="ph ph-repeat"></i> Repeating</button></div>
      <div class="section-title">Repeating patterns</div>
      <div class="list">${App.patterns.map(p => UI.row({ icon: 'ph-repeat', title: U.esc(p.label || (Days.modeById(p.modeId) || {}).name || 'Pattern'),
        sub: `Every ${p.every} day${p.every > 1 ? 's' : ''} from ${U.fmtDate(p.start)}${p.until ? ` until ${U.fmtDate(p.until)}` : ''} · ${U.esc((Days.modeById(p.modeId) || {}).name || '')}`, act: 'editPattern', data: { id: p.id } })).join('') || UI.empty('No repeating patterns.', 'ph-repeat')}</div>
      <div class="section-title">Next 60 days</div>
      <div class="list">${up.map(s => UI.row({ icon: (Days.modeById(s.modeId) || {}).icon || 'ph-moon', title: `${U.fmtDate(s.date)} · ${U.esc(s.label || (Days.modeById(s.modeId) || {}).name || '')}`,
        sub: s.source === 'pattern' ? 'From a repeating pattern' : 'Single date · tap to change', act: s.source === 'pattern' ? 'editPattern' : 'editOne', data: { date: s.date, id: s.patternId || '' } })).join('') || UI.empty('No shifts planned.', 'ph-moon')}</div>`;
  },
  shiftsActions() {
    return {
      addOne: () => Plan.editShift({}),
      editOne: (el) => Plan.editShift({ date: el.dataset.date }),
      addPattern: () => Plan.editPattern(null),
      editPattern: (el) => Plan.editPattern(App.patterns.find(p => p.id === el.dataset.id))
    };
  },
  async editShift({ date }) {
    const existing = date ? App.shifts.find(s => s.date === date) : null;
    const f = await UI.form(existing ? 'Edit shift' : 'Add a shift / day mode', [
      { name: 'date', type: 'date', label: 'Date', value: date || U.todayStr(), required: true },
      { name: 'modeId', type: 'select', label: 'Day mode', value: existing ? existing.modeId : 'm_night', options: App.modes.map(m => ({ value: m.id, label: m.name })) },
      { name: 'label', label: 'Label (optional)', value: existing ? existing.label : '', placeholder: 'e.g. Night shift, Late finish' }
    ], { submit: 'Save', buttons: existing ? [{ label: 'Remove shift', value: 'del', danger: true }] : [] });
    if (!f) return;
    if (f._button === 'del') { await Days.removeShift(date); UI.toast('Shift removed'); }
    else {
      if (existing && existing.date !== f.date) await Days.removeShift(existing.date);
      await Days.addShift(f.date, f.modeId, f.label); UI.toast(`Shift saved for ${U.fmtDate(f.date)}`, 'ph-moon');
    }
    await App.changed({ celebrate: false });
  },
  async editPattern(p) {
    const f = await UI.form(p ? 'Edit pattern' : 'Repeating shift', [
      { name: 'label', label: 'Label', value: p ? p.label : 'On-call', required: true },
      { name: 'modeId', type: 'select', label: 'Day mode', value: p ? p.modeId : 'm_night', options: App.modes.map(m => ({ value: m.id, label: m.name })) },
      { name: 'start', type: 'date', label: 'First date', value: p ? p.start : U.todayStr(), required: true },
      { name: 'every', type: 'number', label: 'Repeat every … days', value: p ? p.every : 4, min: 1, step: 1, hint: 'e.g. 4 = every 4th day, 7 = weekly' },
      { name: 'until', type: 'date', label: 'Until (optional)', value: p ? p.until : '' }
    ], { submit: 'Save pattern', buttons: p ? [{ label: 'Delete pattern', value: 'del', danger: true }] : [] });
    if (!f) return;
    if (f._button === 'del') { await Days.deletePattern(p); UI.toast('Pattern deleted'); }
    else await Days.savePattern({ ...(p || { id: U.uid('pat') }), label: f.label, modeId: f.modeId, start: f.start, every: Math.max(1, Number(f.every) || 1), until: f.until || '' });
    await App.changed({ celebrate: false });
  },

  // ---------- day modes ----------
  renderModes() {
    return `${UI.header('Day modes', { right: '<button class="icon-btn" data-act="add" aria-label="New mode"><i class="ph ph-plus"></i></button>' })}
      <div class="list">${App.modes.map(m => UI.row({ icon: m.icon || 'ph-circle', title: U.esc(m.name),
        sub: [m.protectsStreak ? '🛡 protects the streak' : '', m.isMinimum ? 'minimum routine' : '', m.quiet ? 'quiet' : '', m.nonWorking ? 'day off' : '',
          m.action === 'replace' ? `uses "${U.esc((Days.templateById(m.templateId) || {}).name || '?')}"` : m.action === 'replaceArea' ? `replaces ${U.esc((App.areaById(m.areaId) || {}).name || '')} tasks` : 'keeps the plan'].filter(Boolean).join(' · '),
        act: 'edit', data: { id: m.id } })).join('')}</div>
      <p class="muted small">Switch a day's mode from Today (the mode chip) in two taps, or in advance with the shift planner.</p>`;
  },
  modesActions() { return { add: () => Plan.editMode(null), edit: (el) => Plan.editMode(App.modes.find(m => m.id === el.dataset.id)) }; },
  async editMode(m) {
    const isNew = !m;
    const tplOpts = [{ value: '', label: '—' }, ...Days.dayTemplates().map(t => ({ value: t.id, label: t.name }))];
    const f = await UI.form(isNew ? 'New day mode' : m.name, [
      { name: 'name', label: 'Name', value: m ? m.name : '', required: true },
      { name: 'action', type: 'select', label: 'What it does to the day', value: m ? m.action : 'none', options: [
        { value: 'none', label: 'Keep the day\'s plan' }, { value: 'replace', label: 'Replace the plan with a template' }, { value: 'replaceArea', label: 'Replace one area\'s tasks (keep core) + add a template' }] },
      { name: 'templateId', type: 'select', label: 'Template', value: m ? m.templateId : '', options: tplOpts },
      { name: 'areaId', type: 'select', label: 'Area (for "replace one area")', value: m ? m.areaId : '', options: UI.areaOptions(true, '—') },
      { name: 'protectsStreak', type: 'checkbox', label: '🛡 Protects the streak (the day never breaks it)', value: m ? m.protectsStreak : false },
      { name: 'isMinimum', type: 'checkbox', label: 'Minimum routine (counts as a streak day when its tasks are done)', value: m ? m.isMinimum : false },
      { name: 'nonWorking', type: 'checkbox', label: 'Day off (rest day for "working days only" areas)', value: m ? m.nonWorking : false },
      { name: 'quiet', type: 'checkbox', label: 'Quiet (no in-app reminders)', value: m ? m.quiet : false },
      { name: 'icon', type: 'select', label: 'Icon', value: m ? m.icon : 'ph-circle', options: ['ph-sun', 'ph-moon', 'ph-flashlight', 'ph-umbrella', 'ph-heart', 'ph-chalkboard-teacher', 'ph-airplane-tilt', 'ph-books', 'ph-circle'].map(i => ({ value: i, label: i.replace('ph-', '') })) }
    ], { submit: 'Save', buttons: !isNew && m.id !== 'm_normal' ? [{ label: 'Delete mode', value: 'del', danger: true }] : [],
      validate: v => (v.action !== 'none' && !v.templateId) ? 'Choose the template this mode uses.' : (v.action === 'replaceArea' && !v.areaId) ? 'Choose which area\'s tasks it replaces.' : null });
    if (!f) return;
    if (f._button === 'del') {
      if (await UI.confirm(`Delete "${m.name}"? Days that used it keep their tasks.`, { ok: 'Delete', danger: true })) { await Repo.del('modes', m.id); await App.changed({ celebrate: false }); }
      return;
    }
    await Repo.put('modes', { ...(m || { id: U.uid('m') }), ...f });
    UI.toast('Mode saved'); await App.changed({ celebrate: false });
  },

  // ---------- areas ----------
  renderAreasManage() {
    return `${UI.header('Areas', { right: '<button class="icon-btn" data-act="add" aria-label="New area"><i class="ph ph-plus"></i></button>' })}
      <div class="list">${App.areas.map((a, i) => `<div class="row" style="--row-color:${a.color}">
        <span class="row-icon"><i class="ph ${a.icon || 'ph-circle'}"></i></span>
        <button class="row-main" data-act="edit" data-id="${a.id}" style="text-align:left"><span class="row-title">${U.esc(a.name)}${a.archived ? ' <span class="tag">archived</span>' : a.paused ? ' <span class="tag">paused</span>' : ''}</span>
          <span class="row-sub">${a.streakType === 'none' ? 'No streak' : `${a.streakType === 'weekly' ? 'Weekly' : 'Daily'} · target ${a.target}${a.measure === 'minutes' ? ' min' : ''}`}</span></button>
        <button class="icon-btn" data-act="up" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}><i class="ph ph-arrow-up"></i></button>
        <button class="icon-btn" data-act="down" data-i="${i}" aria-label="Move down" ${i === App.areas.length - 1 ? 'disabled' : ''}><i class="ph ph-arrow-down"></i></button></div>`).join('')}</div>`;
  },
  areasManageActions() {
    const move = async (i, d) => {
      const list = [...App.areas];
      const j = i + d;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((a, k) => { a.order = k + 1; });
      await Repo.putMany('areas', list); await App.changed({ celebrate: false });
    };
    return { add: () => Areas.editArea(null), edit: (el) => Areas.editArea(el.dataset.id), up: (el) => move(Number(el.dataset.i), -1), down: (el) => move(Number(el.dataset.i), 1) };
  },

  // ---------- holidays ----------
  renderHolidays() {
    const list = [...(App.settings.holidays || [])].sort(U.by(h => h.from));
    return `${UI.header('Holiday mode', { right: '<button class="icon-btn" data-act="add" aria-label="Add holiday"><i class="ph ph-plus"></i></button>' })}
      <p class="muted small" style="margin-bottom:10px">During a holiday, the chosen areas (and optionally the overall streak) are paused: those days never break a streak.</p>
      <div class="list">${list.map(h => UI.row({ icon: 'ph-airplane-tilt', title: `${U.fmtDate(h.from)} – ${U.fmtDate(h.to, { year: true })}`,
        sub: [h.overall ? 'Overall streak' : '', ...(h.areaIds || []).map(id => (App.areaById(id) || {}).name)].filter(Boolean).join(', ') || 'Nothing paused',
        act: 'edit', data: { id: h.id } })).join('') || UI.empty('No holidays planned.', 'ph-airplane-tilt')}</div>`;
  },
  holidaysActions() {
    const edit = async (h) => {
      const f = await UI.form(h ? 'Edit holiday' : 'Add holiday', [
        { type: 'html', html: '<div class="two">' },
        { name: 'from', type: 'date', label: 'From', value: h ? h.from : U.todayStr(), required: true },
        { name: 'to', type: 'date', label: 'To', value: h ? h.to : U.addDays(U.todayStr(), 7), required: true },
        { type: 'html', html: '</div>' },
        { name: 'overall', type: 'checkbox', label: 'Pause the overall streak too', value: h ? h.overall : true },
        { name: 'areaIds', type: 'checks', label: 'Pause these areas', value: h ? h.areaIds : App.visibleAreas().map(a => a.id), options: App.visibleAreas().map(a => ({ value: a.id, label: a.name })) }
      ], { buttons: h ? [{ label: 'Delete', value: 'del', danger: true }] : [], validate: v => v.to < v.from ? 'The end date is before the start date.' : null });
      if (!f) return;
      let list = (App.settings.holidays || []).filter(x => !h || x.id !== h.id);
      if (f._button !== 'del') list.push({ id: h ? h.id : U.uid('hol'), from: f.from, to: f.to, overall: f.overall, areaIds: f.areaIds });
      App.settings.holidays = list; await App.saveSettings(); await App.changed({ celebrate: false });
    };
    return { add: () => edit(null), edit: (el) => edit(App.settings.holidays.find(h => h.id === el.dataset.id)) };
  }
};
window.Plan = Plan;

Nav.register('plan', { tab: 'plan', render: () => Plan.renderHub(), actions: () => Plan.hubActions() });
Nav.register('calendar', { tab: 'plan', render: (p) => `${UI.header('Calendar & history')}${Plan.calendarCard(p.month || U.monthStr(U.todayStr()), 'calendar')}
  <p class="muted small">Tap any day: see what was done, or plan it in advance (past days can be edited too).</p>`, actions: () => Plan.calendarActions('calendar') });
Nav.register('templates', { tab: 'plan', render: () => Plan.renderTemplates(), actions: () => Plan.templatesActions() });
Nav.register('template', { tab: 'plan', render: (p) => Plan.renderTemplate(p), actions: (p) => Plan.templateActions(p) });
Nav.register('weekplans', { tab: 'plan', render: () => Plan.renderWeekPlans(), actions: () => Plan.weekPlansActions() });
Nav.register('shifts', { tab: 'plan', render: () => Plan.renderShifts(), actions: () => Plan.shiftsActions() });
Nav.register('modes', { tab: 'plan', render: () => Plan.renderModes(), actions: () => Plan.modesActions() });
Nav.register('areasManage', { tab: 'plan', render: () => Plan.renderAreasManage(), actions: () => Plan.areasManageActions() });
Nav.register('holidays', { tab: 'plan', render: () => Plan.renderHolidays(), actions: () => Plan.holidaysActions() });
