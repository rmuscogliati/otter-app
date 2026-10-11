// ======= today.js — the Today screen (any date), the streak page and day planning =======

const Today = {
  justToggled: null,
  bannerHooks: [], // async (day) => [{cls, icon, text, act, data}] from reminders, deadlines, reviews…

  ring(have, need) {
    const r = 22, c = 2 * Math.PI * r;
    const pct = need > 0 ? U.clamp(have / need, 0, 1) : 1;
    return `<svg class="ring" viewBox="0 0 56 56" aria-label="${Math.round(pct * 100)}% done"><circle class="bg" cx="28" cy="28" r="${r}"/>
      <circle class="fg" cx="28" cy="28" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" transform="rotate(-90 28 28)"/>
      <text x="28" y="33" text-anchor="middle">${Math.round(pct * 100)}%</text></svg>`;
  },

  statusText(day, p) {
    const mode = Days.modeById(day.modeId);
    if (p.met) return { text: day.date === U.todayStr() ? 'Streak safe for today ✓' : 'This day counted ✓', safe: true };
    if (mode && mode.protectsStreak) return { text: `Streak protected (${mode.name})`, safe: true };
    if (p.rest) return { text: 'No required tasks on this plan', safe: true };
    return { text: `${p.have} of ${p.need} ${p.label} done to keep your streak`, safe: false };
  },

  taskCard(t, day) {
    const a = App.areaById(t.areaId);
    const done = Days.isDone(day, t.id);
    // Downtime blocks (lunch, settle in, dinner, free time, wind down) get the sloth instead of an area mascot.
    const sloth = t.tag === 'downtime' || (!a && t.infoOnly);
    const ico = !Otto.show() ? (a ? `<i class="ph ${a.icon || 'ph-circle'}" style="color:${a.color}"></i>` : '')
      : sloth ? Mascot.svg('sloth', { face: true, size: 32, state: done ? 'celebrate' : /wind down|sleep|bed/i.test(t.title) ? 'sleepy' : 'idle' })
      : a ? Mascot.svg(a.mascot, { face: true, size: 32, state: done ? 'celebrate' : 'idle' }) : '';
    const cls = [t.infoOnly ? 'info' : '', done && !t.infoOnly ? 'done' : '', t.optional ? 'optional' : '', Today.justToggled === t.id ? 'pop' : ''].join(' ');
    const extra = t.tag === 'gym' && window.Gym ? `<button data-act="workout" data-id="${t.id}" aria-label="Log workout"><i class="ph ${t.workoutTemplateId === 'wt_cardio' ? 'ph-sneaker-move' : 'ph-barbell'}"></i></button>`
      : t.tag === 'ward' && window.WardJobs ? `<button data-act="wardJobs" aria-label="Ward jobs list"><i class="ph ph-list-checks"></i></button>`
      : t.tag === 'review' ? `<button data-act="openReview" aria-label="Open weekly review"><i class="ph ph-clipboard-text"></i></button>`
      : (window.Focus && !t.infoOnly ? `<button data-act="focus" data-id="${t.id}" aria-label="Focus timer"><i class="ph ph-timer"></i></button>` : '');
    return `<div class="task ${cls}" style="--c:${a ? a.color : 'var(--line)'}">
      <button class="task-main" data-act="${t.infoOnly ? 'edit' : 'tick'}" data-id="${t.id}" aria-pressed="${done}">
        <span class="task-ico mascot-slot">${ico}</span>
        <span class="task-text">
          <span class="task-time">${t.time}–${t.endTime}</span>
          <span class="task-title">${U.esc(t.title)} ${t.core ? '<i class="ph-fill ph-star star" aria-label="core"></i>' : ''}</span>
          ${t.desc ? `<span class="task-desc">${U.esc(t.desc)}</span>` : ''}
        </span>
        ${t.infoOnly ? '' : '<span class="task-check"><i class="ph ph-check"></i></span>'}
      </button>
      <div class="task-side">
        <button data-act="edit" data-id="${t.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button>
        ${extra}
      </div></div>`;
  },

  async render() {
    const date = App.date;
    const today = U.todayStr();
    let day = await Days.get(date);
    if (!day && date === today) day = await Days.create(date, 'default');
    const head = `<div class="today-top">
        <button class="icon-btn" data-act="prevDay" aria-label="Previous day"><i class="ph ph-caret-left"></i></button>
        <button class="date-title" data-act="pickDate">${date === today ? 'Today' : U.esc(U.relDay(date)).replace(/^./, c => c.toUpperCase())}<small>${U.fmtDate(date, { year: true })}</small></button>
        <button class="icon-btn" data-act="nextDay" aria-label="Next day"><i class="ph ph-caret-right"></i></button>
        ${window.Search ? '<button class="icon-btn" data-act="search" aria-label="Search"><i class="ph ph-magnifying-glass"></i></button>' : ''}
      </div>
      ${date !== today ? `<button class="banner info" data-act="goToday"><i class="ph ph-arrow-u-up-left lead"></i>Planning ${U.fmtDate(date)} · back to today</button>` : ''}`;

    if (!day) return head + Today.unplannedHtml(date);

    const p = Streaks.dayProgress(day);
    const st = App.streaks;
    const status = Today.statusText(day, p);
    const ctx = await Otto.context(day);
    const mode = Days.modeById(day.modeId);
    const streakNum = st ? st.overall.current : 0;
    const banners = [];
    for (const h of Today.bannerHooks) { try { banners.push(...(await h(day))); } catch (e) { console.error(e); } }

    const chips = App.visibleAreas().map(a => {
      const r = st && st.areas[a.id];
      return `<button class="chip area-chip" style="--c:${a.color}" data-act="area" data-id="${a.id}">
        <i class="ph-fill ph-fire"></i>${r && !r.paused ? r.current : '–'}${r && r.needs ? ' ·' : ''} <span class="tiny">${U.esc(a.name)}</span></button>`;
    }).join('');

    const list = day.tasks.length ? day.tasks.map(t => Today.taskCard(t, day)).join('') : UI.empty('Nothing planned. Tap + to add a task, or choose a template.', 'ph-calendar-blank');
    const body = App.todayMode === 'timeline' ? Timeline.html(day) : `<div id="task-list">${list}</div>`;

    return `${head}
      <section class="hero">
        <div class="hero-otter mascot-slot" data-size="118">${Otto.html(ctx.state, 118, ctx.acc)}</div>
        <div class="hero-right">
          ${ctx.text ? `<div class="bubble">${U.esc(ctx.text)}</div>` : ''}
          <button class="streak-box" data-act="streak" aria-label="Streak details">
            <i class="ph-fill ph-fire flame ${streakNum ? '' : 'off'}"></i>
            <span><span class="streak-num">${streakNum}</span><span class="streak-meta"><span>day streak</span>${st && st.overall.pebbles ? `<span style="white-space:nowrap">${'●'.repeat(st.overall.pebbles)} pebble${st.overall.pebbles > 1 ? 's' : ''}</span>` : ''}</span></span>
            ${Today.ring(p.have, p.need)}
          </button>
          <div class="status-line ${status.safe ? 'safe' : ''}">${U.esc(status.text)}</div>
        </div>
      </section>
      ${banners.map(b => `<button class="banner ${b.cls || 'info'}" data-act="${b.act || 'noop'}" ${Object.entries(b.data || {}).map(([k, v]) => `data-${k}="${U.esc(v)}"`).join(' ')}>
        <i class="ph ${b.icon || 'ph-info'} lead"></i><span>${U.esc(b.text)}</span>${b.dismiss ? `<span class="x" data-act="dismiss" data-key="${U.esc(b.dismiss)}" aria-label="Dismiss"><i class="ph ph-x"></i></span>` : ''}</button>`).join('')}
      <div class="chips">${chips}</div>
      <div class="btn-wrap" style="margin:6px 0 10px">
        <div class="seg" style="flex:1"><button class="${App.todayMode === 'list' ? 'on' : ''}" data-act="mode" data-v="list"><i class="ph ph-list-bullets"></i> List</button>
          <button class="${App.todayMode === 'timeline' ? 'on' : ''}" data-act="mode" data-v="timeline"><i class="ph ph-clock"></i> Timeline</button></div>
        <button class="chip mode-chip" data-act="dayMode"><i class="ph ${mode ? mode.icon || 'ph-sun' : 'ph-sun'}"></i>${U.esc(mode ? mode.name : 'Normal')}</button>
        <button class="chip" data-act="dayMenu" aria-label="Day options"><i class="ph ph-dots-three"></i></button>
      </div>
      ${body}`;
  },

  unplannedHtml(date) {
    const tpl = Days.defaultTemplateFor(date);
    const sh = Days.shiftFor(date);
    return `<div class="card">
      <h2>No plan for ${U.fmtDate(date)} yet</h2>
      <p class="muted small" style="margin:4px 0 10px">${sh ? `Shift planner: ${U.esc(Days.modeById(sh.modeId)?.name || '')}. ` : ''}Choose how to start this day. You can change everything afterwards.</p>
      <div class="choice-list">
        <button class="choice" data-act="plan" data-opt="default"><i class="ph ph-calendar-check"></i><span><b>Default template</b><small>${U.esc(tpl ? tpl.name : 'none set')}</small></span></button>
        <button class="choice" data-act="plan" data-opt="pick"><i class="ph ph-stack"></i><span><b>Another template…</b><small>Normal workday, Day off, On-call, Study day…</small></span></button>
        <button class="choice" data-act="plan" data-opt="blank"><i class="ph ph-file"></i><span><b>Blank day</b><small>Plan all 24 hours yourself</small></span></button>
        <button class="choice" data-act="plan" data-opt="yesterday"><i class="ph ph-copy"></i><span><b>Copy yesterday</b><small>${U.fmtDate(U.addDays(date, -1))}</small></span></button>
        <button class="choice" data-act="plan" data-opt="lastweek"><i class="ph ph-arrow-counter-clockwise"></i><span><b>Copy same weekday last week</b><small>${U.fmtDate(U.addDays(date, -7))}</small></span></button>
      </div></div>`;
  },

  async pickTemplate(title = 'Choose a template') {
    return UI.choose(title, Days.dayTemplates().map(t => ({ value: t.id, label: t.name, sub: `${t.tasks.length} tasks`, icon: 'ph-stack' })));
  },
  async planDay(date, opt) {
    let option = opt;
    if (opt === 'pick') { const id = await Today.pickTemplate(); if (!id) return; option = { templateId: id }; }
    const existing = await Days.get(date);
    if (existing) await DB.delete('dayInstances', date);
    await Days.create(date, option);
    UI.toast(`Planned ${U.fmtDate(date)}`, 'ph-calendar-check');
    await App.changed({ celebrate: false });
  },

  actions() {
    return {
      tick: async (el) => {
        const res = await Days.toggleTask(App.date, el.dataset.id);
        if (!res.changed) return;
        Today.justToggled = res.done ? res.task.id : null;
        U.vibrate(res.done ? 25 : 10);
        if (res.done && res.task.xp) UI.toast(`+${res.task.xp} XP`, 'ph-star');
        const before = Streaks.dayProgress({ ...res.day, completedTaskIds: res.day.completedTaskIds.filter(id => id !== res.task.id) }).met;
        await App.changed();
        Otto.react(res.task.areaId, res.done);
        const after = Streaks.dayProgress(res.day).met;
        if (res.done && after && !before && res.day.date === U.todayStr()) setTimeout(() => Otto.dayComplete(), 700);
        setTimeout(() => { Today.justToggled = null; }, 600);
      },
      edit: async (el) => {
        const day = await Days.ensure(App.date);
        const task = day.tasks.find(t => t.id === el.dataset.id);
        if (task) TaskEditor.open({ date: App.date, task });
      },
      focus: async (el) => {
        const day = await Days.ensure(App.date);
        const task = day.tasks.find(t => t.id === el.dataset.id);
        if (task && window.Focus) Focus.start({ task, date: App.date });
      },
      workout: (el) => { if (window.Gym) Gym.startFromTask(App.date, el.dataset.id); },
      openReview: () => Nav.go('weeklyReview'),
      wardJobs: () => Nav.go('wardJobs', {}),
      prevDay: () => { App.date = U.addDays(App.date, -1); Nav.refresh(); },
      nextDay: () => { App.date = U.addDays(App.date, 1); Nav.refresh(); },
      goToday: () => { App.date = U.todayStr(); Nav.refresh(); },
      pickDate: async () => {
        const v = await UI.form('Go to date', [{ name: 'date', type: 'date', label: 'Date', value: App.date, required: true }], { submit: 'Open' });
        if (v && v.date) { App.date = v.date; Nav.refresh(); }
      },
      search: () => Nav.go('search'),
      streak: () => Nav.go('streak'),
      area: (el) => Nav.go('area', { id: el.dataset.id }),
      mode: (el) => { App.todayMode = el.dataset.v; Nav.refresh(); },
      plan: (el) => Today.planDay(App.date, el.dataset.opt),
      dayMode: async () => {
        const day = await Days.ensure(App.date);
        const v = await UI.choose('Switch this day to…', App.modes.map(m => ({
          value: m.id, label: m.name + (m.id === day.modeId ? '  ✓' : ''), icon: m.icon || 'ph-circle',
          sub: [m.protectsStreak ? 'Protects the streak' : '', m.isMinimum ? 'Counts when its few tasks are done' : '', m.action === 'replace' ? 'Swaps in a smaller plan' : m.action === 'replaceArea' ? 'Replaces one area\'s tasks' : ''].filter(Boolean).join(' · ')
        })));
        if (!v || v === day.modeId) return;
        await Days.setMode(App.date, v);
        UI.toast(`Switched to ${Days.modeById(v).name}`, 'ph-swap');
        await App.changed();
      },
      dayMenu: async () => {
        const day = await Days.ensure(App.date);
        const tpl = Days.templateForDay(day);
        const v = await UI.choose(`${U.fmtDate(App.date)}`, [
          { value: 'add', label: 'Add a task', icon: 'ph-plus' },
          { value: 'replan', label: 'Start this day again from…', sub: 'Template, blank, copy yesterday or last week', icon: 'ph-arrow-clockwise' },
          { value: 'saveNew', label: 'Save this day as a new template', icon: 'ph-floppy-disk' },
          ...(tpl ? [{ value: 'saveInto', label: `Save changes to "${tpl.name}"`, sub: 'Future days made from it will follow', icon: 'ph-upload-simple' }] : []),
          { value: 'calendar', label: 'Open the calendar', icon: 'ph-calendar' }
        ]);
        if (v === 'add') TaskEditor.open({ date: App.date });
        else if (v === 'replan') {
          const opt = await UI.choose('Start this day from…', [
            { value: 'default', label: 'Default template', sub: (Days.defaultTemplateFor(App.date) || {}).name || '', icon: 'ph-calendar-check' },
            { value: 'pick', label: 'Another template…', icon: 'ph-stack' },
            { value: 'blank', label: 'Blank day', icon: 'ph-file' },
            { value: 'yesterday', label: 'Copy yesterday', icon: 'ph-copy' },
            { value: 'lastweek', label: 'Copy same weekday last week', icon: 'ph-arrow-counter-clockwise' }
          ], { text: 'This replaces the current plan for this day (ticks are cleared). Templates are not changed.' });
          if (opt) Today.planDay(App.date, opt);
        } else if (v === 'saveNew') {
          const f = await UI.form('Save as template', [{ name: 'name', label: 'Template name', required: true, value: `${U.DOW[U.dow(App.date)]} plan` }], { submit: 'Save template' });
          if (f) { await Days.saveDayAsTemplate(day, f.name); UI.toast(`Template "${f.name}" saved`, 'ph-floppy-disk'); await App.changed({ celebrate: false }); }
        } else if (v === 'saveInto') {
          if (await UI.confirm(`Replace the tasks in "${tpl.name}" with this day's plan? Past days are not changed.`, { ok: 'Save to template' })) {
            await Days.saveDayIntoTemplate(day); UI.toast('Template updated'); await App.changed({ celebrate: false });
          }
        } else if (v === 'calendar') Nav.go('calendar');
      },
      dismiss: async (el, e) => {
        e.stopPropagation();
        App.settings.reminders.dismissed[el.dataset.key] = U.todayStr();
        await App.saveSettings(); Nav.refresh();
      },
      go: (el) => Nav.go(el.dataset.view, el.dataset.param ? { id: el.dataset.param } : {}),
      noop: () => {}
    };
  },

  // ---------- streak page ----------
  async renderStreak() {
    const st = App.streaks, s = App.settings;
    const r = Streaks.ruleFor(U.todayStr());
    const month = Nav.current().params.month || U.monthStr(U.todayStr());
    return `${UI.header('Your streak')}
      <section class="hero">
        <div class="hero-otter mascot-slot">${Otto.html(st.overall.current ? 'celebrate' : 'idle', 110, st.overall.pebbles ? ['pebble'] : [])}</div>
        <div class="hero-right">
          <div class="streak-box"><i class="ph-fill ph-fire flame ${st.overall.current ? '' : 'off'}"></i><span><span class="streak-num">${st.overall.current}</span><span class="streak-meta">current streak</span></span></div>
          <div class="muted small">Longest: <b>${st.overall.longest}</b> · Pebbles: <b>${st.overall.pebbles}</b> of 2</div>
          <div class="muted small">XP this week: <b>${st.xp.week}</b> · total <b>${st.xp.total}</b></div>
        </div>
      </section>
      <div class="card"><h3>How a day counts: ${U.esc(Streaks.ruleName(r))}</h3>
        <p class="muted small" style="margin-top:4px">${U.esc(Streaks.ruleText(r))}</p>
        <p class="muted small" style="margin-top:6px">Days in a streak-protecting mode (e.g. night shift) keep your streak without adding to it. Minimum routine days count when their few tasks are done. If you miss a day, a pebble is used automatically; you earn one pebble for every 7 days in a row (you can hold 2).</p>
        <button class="btn btn-ghost btn-small" style="margin-top:8px" data-act="rule"><i class="ph ph-sliders"></i> Change the rule</button></div>
      ${Plan.calendarCard(month, 'streak')}
      <div class="card"><h3>XP</h3><p class="muted small">Each ticked task gives the XP set on it (edit any task to change it). Wins (+25), topic reviews (+5) and focus time (+1 per 5 min) add bonus XP.</p></div>`;
  },
  streakActions() {
    return {
      rule: () => Nav.go('settings'),
      ...Plan.calendarActions('streak')
    };
  }
};
window.Today = Today;

Nav.register('today', { tab: 'today', render: () => Today.render(), actions: () => Today.actions(),
  mounted: async (el) => { if (App.todayMode === 'timeline') { const day = await Days.get(App.date); if (day) Timeline.mount(el, day); } } });
Nav.register('streak', { tab: 'today', render: () => Today.renderStreak(), actions: () => Today.streakActions() });
