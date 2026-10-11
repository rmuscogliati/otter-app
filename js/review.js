// ======= review.js — weekly & monthly review, goals, capacity check, global search, in-app reminders =======

const Review = {
  // The week being planned: next week from Friday onwards, otherwise this week.
  weeks() {
    const today = U.todayStr();
    const ws = U.weekStart(today);
    const next = [5, 6, 0].includes(U.dow(today)) ? U.addDays(ws, 7) : ws;
    return { last: U.addDays(next, -7), next };
  },
  otter(text) {
    return `<section class="hero">${Otto.show() ? `<div class="hero-otter mascot-slot" style="width:96px;height:96px">${Otto.html('idle', 96, ['clipboard', 'glasses'])}</div>` : ''}
      <div class="hero-right"><div class="bubble">${U.esc(text)}</div></div></section>`;
  },

  // ---------- plans & capacity ----------
  async planFor(date) {
    const day = await Days.get(date);
    if (day) return day.tasks;
    let tasks = U.clone((Days.defaultTemplateFor(date) || {}).tasks || []);
    const sh = Days.shiftFor(date);
    const mode = sh && Days.modeById(sh.modeId);
    const tpl = mode && Days.templateById(mode.templateId);
    if (mode && tpl && mode.action === 'replace') tasks = U.clone(tpl.tasks);
    return tasks;
  },
  async capacity(ws) {
    const sleep = Math.round((Number((App.settings.capacity || {}).sleepHours) || 8) * 60);
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(ws, i);
      const tasks = await Review.planFor(d);
      const planned = U.sum(tasks.filter(t => !t.infoOnly), U.durMin);
      const blocked = U.sum(tasks.filter(t => t.infoOnly && !/free time/i.test(t.title)), U.durMin);
      const free = Math.max(0, 1440 - sleep - blocked);
      out.push({ date: d, planned, blocked, free, over: planned > free });
    }
    const planned = U.sum(out, x => x.planned), free = U.sum(out, x => x.free);
    return { days: out, planned, free, over: planned > free, tight: planned > free * 0.85 };
  },
  capacityHtml(c) {
    return `<div class="card ${c.over ? '' : 'flat'}" style="${c.over ? 'box-shadow:0 0 0 2px var(--bad)' : c.tight ? 'box-shadow:0 0 0 2px var(--warn)' : ''}">
      <div class="cal-head"><h3>Planned ${U.fmtDur(c.planned)} of ${U.fmtDur(c.free)} free</h3><span class="tag ${c.over ? 'bad' : c.tight ? 'warn' : 'good'}">${c.over ? 'overcommitted' : c.tight ? 'tight' : 'ok'}</span></div>
      ${c.over ? '<p class="small" style="color:var(--bad);font-weight:700">You have planned more than your free hours. Drop or move something — rest is part of the plan.</p>' : c.tight ? '<p class="small muted">Over 85% of your free time is planned. Leave some slack for the unexpected.</p>' : ''}
      <div class="bars" style="margin-top:8px">${c.days.map(d => `<div class="bar-row"><span>${U.fmtDate(d.date)}</span><span class="track"><span class="fill" style="width:${Math.min(100, Math.round(100 * d.planned / Math.max(1, d.free)))}%;background:${d.over ? 'var(--bad)' : 'var(--good)'}"></span></span>
        <span>${U.fmtDur(d.planned)}/${U.fmtDur(d.free)}</span></div>`).join('')}</div>
      <p class="tiny muted" style="margin-top:6px">Free = 24 h − ${(App.settings.capacity || {}).sleepHours || 8} h sleep − info-only blocks (work, meals). Planned = tickable tasks.</p></div>`;
  },
  async renderCapacity({ week } = {}) {
    const ws = week || Review.weeks().next;
    const c = await Review.capacity(ws);
    return `${UI.header('Capacity check')}
      <div class="cal-head card"><button class="icon-btn" data-act="week" data-v="${U.addDays(ws, -7)}" aria-label="Previous week"><i class="ph ph-caret-left"></i></button>
        <b>Week of ${U.fmtDate(ws, { year: true })}</b><button class="icon-btn" data-act="week" data-v="${U.addDays(ws, 7)}" aria-label="Next week"><i class="ph ph-caret-right"></i></button></div>
      ${Review.capacityHtml(c)}
      <button class="btn btn-ghost btn-block" data-act="sleep"><i class="ph ph-bed"></i> Hours of sleep to keep free: ${(App.settings.capacity || {}).sleepHours || 8}</button>`;
  },
  capacityActions() {
    return {
      week: (el) => Nav.go('capacity', { week: el.dataset.v }, { replace: true }),
      sleep: async () => {
        const f = await UI.form('Capacity', [{ name: 'h', type: 'number', label: 'Hours of sleep per night', value: (App.settings.capacity || {}).sleepHours || 8, min: 4, max: 12, step: 0.5 }]);
        if (f) { App.settings.capacity = { ...(App.settings.capacity || {}), sleepHours: Number(f.h) || 8 }; await App.saveSettings(); await App.changed({ celebrate: false }); }
      }
    };
  },

  // ---------- review hub ----------
  async renderHub() {
    const { next } = Review.weeks();
    const wr = await Repo.get('weeklyReview', `wr_${next}`);
    const month = Review.monthToReview();
    const mr = await Repo.get('monthlyReview', `mr_${month}`);
    const isDay = U.dow(U.todayStr()) === Number(App.settings.reviewDay);
    return `${UI.header('Review', { back: false })}
      ${Review.otter(wr && wr.completedAt ? 'Review done for this week. Lovely work!' : isDay ? 'It\'s review day! Fifteen calm minutes, step by step.' : 'Ready when you are. I\'ll bring the clipboard.')}
      <button class="btn btn-primary btn-block" data-act="weekly" style="margin:0 0 8px"><i class="ph ph-clipboard-text"></i> ${wr && wr.completedAt ? 'Open weekly review again' : wr ? 'Continue weekly review' : 'Start weekly review'}</button>
      <p class="muted small" style="text-align:center;margin-bottom:12px">Planning the week of ${U.fmtDate(next, { year: true })}</p>
      <div class="list">
        ${UI.row({ icon: 'ph-calendar-check', title: `Monthly review — ${U.MONTHS[Number(month.slice(5)) - 1]}`, sub: mr && mr.completedAt ? 'Done ✓' : 'Wins, what slipped, research, goals', act: 'go', data: { view: 'monthlyReview' } })}
        ${UI.row({ icon: 'ph-target', title: 'Goals', sub: 'Quarterly → monthly → weekly', act: 'go', data: { view: 'goals' } })}
        ${UI.row({ icon: 'ph-gauge', title: 'Capacity check', sub: 'Planned vs free hours', act: 'go', data: { view: 'capacity' } })}
        ${UI.row({ icon: 'ph-list-numbers', title: 'Edit review steps', sub: 'Rename, reorder, add your own questions', act: 'go', data: { view: 'reviewSteps' } })}
      </div>
      <div class="section-title">Past reviews</div>
      <div class="list">${(await Repo.all('weeklyReview')).filter(r => r.completedAt).sort(U.by(r => r.week)).reverse().slice(0, 8)
        .map(r => UI.row({ icon: 'ph-check-circle', title: `Week of ${U.fmtDate(r.week, { year: true })}`, sub: `Completed ${U.fmtDate(r.completedAt.slice(0, 10))}`, act: 'past', data: { id: r.id } })).join('') || UI.empty('No reviews yet.', 'ph-clipboard-text')}</div>`;
  },
  hubActions() {
    return {
      weekly: () => Nav.go('weeklyReview', { step: 0 }),
      go: (el) => Nav.go(el.dataset.view),
      past: async (el) => {
        const r = await Repo.get('weeklyReview', el.dataset.id);
        const steps = App.settings.reviewSteps || [];
        UI.sheet({ title: `Week of ${U.fmtDate(r.week)}`, html: Object.entries(r.answers || {}).map(([k, v]) => `<h3>${U.esc((steps.find(s => s.id === k) || {}).title || k)}</h3><p class="small pre" style="margin-bottom:8px">${U.esc(v)}</p>`).join('') || '<p class="muted">No written answers.</p>' });
      }
    };
  },

  // ---------- weekly review wizard ----------
  steps() { return (App.settings.reviewSteps || []).filter(s => s.enabled); },
  async record() {
    const { next, last } = Review.weeks();
    return (await Repo.get('weeklyReview', `wr_${next}`)) || { id: `wr_${next}`, week: next, lastWeek: last, answers: {}, step: 0 };
  },
  answerBox(step, rec) {
    return step.prompt ? `<div class="field" style="margin-top:10px"><label for="rv-answer">${U.esc(step.prompt)}</label><textarea id="rv-answer" rows="3">${U.esc((rec.answers || {})[step.id] || '')}</textarea></div>` : '';
  },
  async stepBody(step, rec) {
    const { last, next } = Review.weeks();
    const today = U.todayStr();
    switch (step.type) {
      case 'lastWeek': {
        const st = App.streaks;
        const lastEnd = U.addDays(last, 6);
        let counted = 0, n = 0;
        for (let i = 0; i < 7; i++) { const d = U.addDays(last, i); if (d > today) break; n++; if (['complete', 'minimum', 'protected', 'pebble', 'rest', 'holiday'].includes(st.overall.statuses[d])) counted++; }
        const wins = (await DB.getAll('wins')).filter(w => w.date >= last && w.date <= lastEnd);
        const logs = (await Repo.all('timeLog')).filter(l => l.date >= last && l.date <= lastEnd);
        const en = (await Repo.all('energy')).filter(e => e.date >= last && e.date <= lastEnd);
        const sl = (await Repo.all('sleep')).filter(e => e.date >= last && e.date <= lastEnd);
        const days = (await DB.getAll('dayInstances')).filter(d => d.date >= last && d.date <= lastEnd);
        const req = days.flatMap(d => d.tasks.filter(t => !t.infoOnly && !t.optional).map(t => Days.isDone(d, t.id)));
        const goals = (await Repo.all('goal')).filter(g => g.quarter === U.quarterStr(today));
        return `<div class="card"><h3>Week of ${U.fmtDate(last)}</h3><dl class="kv" style="margin-top:6px">
          <dt>Days kept</dt><dd>${counted} of ${n} (streak now ${st.overall.current})</dd>
          <dt>Tasks done</dt><dd>${req.filter(Boolean).length} of ${req.length} required (${req.length ? Math.round(100 * req.filter(Boolean).length / req.length) : 0}%)</dd>
          <dt>Wins</dt><dd>${wins.length ? wins.map(w => U.esc(w.title)).join('; ') : '—'}</dd>
          <dt>Energy</dt><dd>${en.length ? `${(U.sum(en, e => e.value) / en.length).toFixed(1)} average (${en.length} check-ins)` : '—'}</dd>
          <dt>Sleep</dt><dd>${sl.length ? `${(U.sum(sl, e => e.hours) / sl.length).toFixed(1)} h average` : '—'}</dd></dl></div>
          <div class="card"><h3>Areas</h3>${App.visibleAreas().map(a => { const r = st.areas[a.id]; const mins = U.sum(logs.filter(l => l.areaId === a.id), l => l.minutes);
            return `<div class="small" style="margin-top:4px"><span class="dot" style="background:${a.color}"></span> <b>${U.esc(a.name)}</b>: ${r && !r.paused ? `streak ${r.current} ${r.unit === 'week' ? 'weeks' : 'days'}` : 'no streak'}${r && r.unit === 'week' ? ` · ${r.weekStatus[last] === 'complete' ? 'target met ✓' : r.weekStatus[last] || ''}` : ''}${mins ? ` · ${U.fmtDur(mins)} logged` : ''}</div>`; }).join('')}</div>
          ${goals.length ? `<div class="card"><h3>Quarterly goals (${U.quarterStr(today)})</h3>${goals.map(g => { const ms = g.milestones || []; const d = ms.filter(m => m.done).length;
            return `<div class="small" style="margin-top:6px"><b>${U.esc(g.title)}</b> · ${d}/${ms.length} milestones</div>${UI.progress(g.done ? 1 : d, g.done ? 1 : ms.length || 1, (App.areaById(g.areaId) || {}).color || 'var(--accent)')}`; }).join('')}</div>` : ''}`;
      }
      case 'inbox': {
        const items = (await DB.getAll('inbox')).filter(i => (i.status || 'inbox') === 'inbox');
        return items.map(i => `<div class="card"><div class="pre" style="font-weight:700">${U.esc(i.text || i.title)}</div>
          <div class="btn-wrap"><button class="btn btn-small btn-primary" data-act="schedule" data-id="${i.id}"><i class="ph ph-calendar-plus"></i> Schedule</button>
          <button class="btn btn-small btn-ghost" data-act="board" data-id="${i.id}"><i class="ph ph-kanban"></i> Board</button>
          <button class="btn btn-small btn-ghost" data-act="clinical" data-id="${i.id}"><i class="ph ph-question"></i> Clinical Q</button>
          <button class="btn btn-small btn-ghost" data-act="someday" data-id="${i.id}"><i class="ph ph-cloud"></i> Someday</button>
          <button class="btn btn-small btn-danger-ghost" data-act="del" data-id="${i.id}" aria-label="Delete"><i class="ph ph-trash"></i></button></div></div>`).join('') || UI.empty('Inbox zero! 🎉', 'ph-tray');
      }
      case 'boards': {
        const boards = await DB.getAll('boards');
        const stuck = (await DB.getAll('cards')).filter(c => !c.archived).filter(c => { const b = boards.find(x => x.id === c.boardId); return b && Boards.isStuck(b, c); });
        const waiting = (await DB.getAll('waitingOn')).filter(w => !w.done);
        const dls = (await DB.getAll('deadlines')).filter(d => !d.done && d.date >= today && U.diffDays(today, d.date) <= 14).sort(U.by(d => d.date));
        return `<div class="section-title">Stuck cards (${stuck.length})</div>${stuck.map(c => UI.row({ icon: 'ph-warning', cls: 'card', title: U.esc(c.title), sub: `${U.esc((boards.find(b => b.id === c.boardId) || {}).name || '')} · ${Boards.daysInStage(c)} days in stage`, act: 'card', data: { id: c.id } })).join('') || '<p class="muted small">Nothing stuck.</p>'}
          <div class="section-title">Waiting on (${waiting.length})</div>${waiting.map(w => UI.row({ icon: 'ph-hand-palm', cls: 'card', title: U.esc(w.title), sub: `${U.esc(w.who || '')} · ${Logs.followDue(w) <= today ? '<b>follow up now</b>' : `follow up ${U.relDay(Logs.followDue(w))}`}`, act: 'go', data: { view: 'waiting' } })).join('') || '<p class="muted small">Not waiting on anyone.</p>'}
          <div class="section-title">Deadlines in the next 14 days (${dls.length})</div>${dls.map(d => UI.row({ icon: 'ph-hourglass-medium', cls: 'card', title: U.esc(d.title), sub: `${U.fmtDate(d.date)} (${U.relDay(d.date)})`, act: 'go', data: { view: 'deadlines' } })).join('') || '<p class="muted small">No deadlines coming up.</p>'}`;
      }
      case 'priorities': {
        const prios = (await Repo.all('weekPriority')).filter(p => p.week === next);
        const month = U.monthStr(next);
        const goals = (await Repo.all('goal')).filter(g => g.quarter === U.quarterStr(next) && !g.done);
        return `<p class="muted small" style="margin:0 4px 8px">For the week of ${U.fmtDate(next)}. Leave a box empty if an area needs nothing.</p>
          ${App.visibleAreas().filter(a => !a.paused).map(a => {
            const mine = prios.filter(p => p.areaId === a.id);
            const sugg = goals.filter(g => g.areaId === a.id).flatMap(g => (g.milestones || []).filter(m => !m.done && (!m.month || m.month <= month)).map(m => ({ g, m })));
            return `<div class="card" style="border-left:5px solid ${a.color}"><h3>${U.esc(a.name)}</h3>
              ${[0, 1, 2].map(i => `<input type="text" class="prio-in" data-area="${a.id}" data-id="${mine[i] ? mine[i].id : ''}" value="${U.esc(mine[i] ? mine[i].text : '')}" placeholder="Priority ${i + 1}${i ? ' (optional)' : ''}" style="margin-top:6px" aria-label="${U.esc(a.name)} priority ${i + 1}">`).join('')}
              ${sugg.length ? `<div class="chips" style="margin-top:6px">${sugg.slice(0, 4).map(({ m }) => `<button class="chip" data-act="suggest" data-area="${a.id}" data-text="${U.esc(m.text)}">+ ${U.esc(m.text)}</button>`).join('')}</div>` : ''}</div>`;
          }).join('')}`;
      }
      case 'schedule': {
        const prios = (await Repo.all('weekPriority')).filter(p => p.week === next);
        const cap = await Review.capacity(next);
        const dayOpts = [...Array(7)].map((_, i) => U.addDays(next, i)).filter(d => d >= today);
        return `${prios.map(p => { const a = App.areaById(p.areaId);
          return `<div class="card" style="border-left:5px solid ${a ? a.color : 'var(--line)'}"><b>${U.esc(p.text)}</b><div class="muted tiny">${U.esc(a ? a.name : '')}${p.scheduledDate ? ` · placed on ${U.fmtDate(p.scheduledDate)} ✓` : ''}</div>
            ${p.scheduledDate ? '' : `<div class="two" style="margin-top:6px"><select data-pd="${p.id}" aria-label="Day">${dayOpts.map(d => `<option value="${d}">${U.fmtDate(d)}</option>`).join('')}</select>
              <input type="time" value="18:00" data-pt="${p.id}" aria-label="Start time"></div>
              <div class="btn-wrap">${[30, 60, 90].map(m => `<button class="btn btn-small ${m === 60 ? 'btn-primary' : 'btn-ghost'}" data-act="place" data-id="${p.id}" data-m="${m}">Place ${m} min</button>`).join('')}</div>`}</div>`; }).join('')
          || UI.empty('No priorities chosen. Go back a step to add some.', 'ph-target')}
          <div class="section-title">Capacity for that week</div>${Review.capacityHtml(cap)}`;
      }
      case 'backup': {
        const lb = App.settings.lastBackupAt;
        return `<div class="card"><p class="small">Your data lives only on this device. A weekly export keeps it safe (it includes your private research ideas, so keep the file private).</p>
          <p class="muted small" style="margin-top:6px">${lb ? `Last export: ${U.fmtDate(U.dateStr(new Date(lb)), { year: true })}` : 'Never exported yet.'}</p>
          <button class="btn btn-primary btn-block" data-act="export"><i class="ph ph-download-simple"></i> Export backup now</button></div>`;
      }
      default: return '';
    }
  },
  async renderWizard({ step = 0 }) {
    const steps = Review.steps();
    const rec = await Review.record();
    step = U.clamp(Number(step) || 0, 0, steps.length);
    if (step === steps.length) {
      return `${UI.header('Weekly review')}${Review.otter('All done! You\'ve looked back, cleared the decks and planned the week. Proud of you.')}
        <button class="btn btn-primary btn-block" data-act="finish"><i class="ph ph-check-circle"></i> Finish review</button>
        <button class="btn btn-ghost btn-block" data-act="go" data-step="${steps.length - 1}">Back</button>`;
    }
    const s = steps[step];
    const tips = { lastWeek: 'Let\'s look back first. No judgement, just noticing.', inbox: 'Let\'s empty the inbox: decide what each thing is.', boards: 'Quick sweep of boards, people you\'re waiting on and deadlines.',
      priorities: 'Pick 1–3 priorities per area for next week.', schedule: 'Now give each priority a real slot in a day.', backup: 'Last step: a backup, so nothing is ever lost.', question: s.prompt || 'Take a moment with this one.' };
    return `${UI.header(`Review ${step + 1}/${steps.length}`)}
      ${Review.otter(tips[s.type] || s.title)}
      <div class="progress" style="margin-bottom:12px"><div style="width:${Math.round(100 * step / steps.length)}%;background:var(--accent)"></div></div>
      <h2 style="margin:0 4px 8px">${U.esc(s.title)}</h2>
      ${await Review.stepBody(s, rec)}
      ${Review.answerBox(s, rec)}
      <div class="btn-row"><button class="btn btn-ghost" data-act="go" data-step="${step - 1}" ${step ? '' : 'disabled'}><i class="ph ph-arrow-left"></i> Back</button>
        <button class="btn btn-primary" data-act="go" data-step="${step + 1}">Next <i class="ph ph-arrow-right"></i></button></div>`;
  },
  wizardActions({ step = 0 }) {
    const steps = Review.steps();
    const s = steps[Number(step)];
    const inbox = More.inboxActions({});
    const saveStep = async () => {
      const rec = await Review.record();
      const box = document.getElementById('rv-answer');
      if (box && s) rec.answers = { ...(rec.answers || {}), [s.id]: box.value };
      if (s && s.type === 'priorities') await Review.savePriorities(rec.week);
      rec.step = Number(step);
      await Repo.put('weeklyReview', rec);
    };
    return {
      go: async (el) => { await saveStep(); Nav.go('weeklyReview', { step: Number(el.dataset.step) }, { replace: true }); },
      finish: async () => {
        const rec = await Review.record();
        rec.completedAt = new Date().toISOString(); await Repo.put('weeklyReview', rec);
        await App.changed({ celebrate: false });
        await Otto.celebrate({ title: 'Weekly review done!', sub: `${Otto.name()} files the clipboard away. Have a good week.`, acc: ['clipboard'], big: false, button: 'Thanks, Otto' });
        Nav.go('review', {}, { root: true });
      },
      ...inbox,
      card: (el) => Nav.go('card', { id: el.dataset.id }),
      suggest: (el) => {
        const inputs = [...document.querySelectorAll(`.prio-in[data-area="${el.dataset.area}"]`)];
        const empty = inputs.find(i => !i.value.trim());
        if (empty) { empty.value = el.dataset.text; el.remove(); } else UI.toast('Three priorities already — that\'s plenty!', 'ph-target');
      },
      place: async (el) => {
        const p = await Repo.get('weekPriority', el.dataset.id);
        const date = document.querySelector(`[data-pd="${p.id}"]`).value;
        const start = document.querySelector(`[data-pt="${p.id}"]`).value || '18:00';
        const id = U.uid('t');
        await Days.upsertTask(date, { id, srcId: id, title: p.text, time: start, endTime: U.fromMin(Math.min(1440, U.toMin(start) + Number(el.dataset.m))), areaId: p.areaId, desc: 'Weekly priority', core: false, optional: false, infoOnly: false, xp: 20, tag: 'priority', priorityId: p.id }, 'day');
        p.scheduledDate = date; await Repo.put('weekPriority', p);
        UI.toast(`Placed on ${U.fmtDate(date)} at ${start}`, 'ph-calendar-check');
        await App.changed({ celebrate: false });
      },
      export: () => More.backupActions().export()
    };
  },
  async savePriorities(week) {
    const inputs = [...document.querySelectorAll('.prio-in')];
    if (!inputs.length) return;
    const existing = (await Repo.all('weekPriority')).filter(p => p.week === week);
    const keep = new Set();
    for (const i of inputs) {
      const text = i.value.trim();
      if (!text) continue;
      const old = existing.find(p => p.id === i.dataset.id);
      const rec = old && old.areaId === i.dataset.area ? { ...old, text } : { id: U.uid('wp'), week, areaId: i.dataset.area, text, done: false, scheduledDate: '' };
      keep.add(rec.id); await Repo.put('weekPriority', rec);
    }
    for (const p of existing) if (!keep.has(p.id) && inputs.some(i => i.dataset.id === p.id)) await Repo.del('weekPriority', p.id);
  },

  // ---------- monthly review ----------
  monthToReview() { const t = U.todayStr(); return Number(t.slice(8)) <= 7 ? U.monthStr(U.addDays(`${U.monthStr(t)}-01`, -1)) : U.monthStr(t); },
  MONTH_STEPS: [['wins', 'Wins this month'], ['slipped', 'What slipped'], ['research', 'Research: moved or stalled'], ['goals', 'Adjust goals'], ['templates', 'Adjust templates & plans']],
  async renderMonthly({ step = 0 }) {
    const month = Review.monthToReview();
    const id = `mr_${month}`;
    const rec = (await Repo.get('monthlyReview', id)) || { id, month, answers: {} };
    const from = `${month}-01`, to = `${month}-31`;
    const today = U.todayStr();
    step = U.clamp(Number(step) || 0, 0, Review.MONTH_STEPS.length);
    const name = `${U.MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
    if (step === Review.MONTH_STEPS.length) {
      return `${UI.header(`Monthly review`)}${Review.otter(`That's ${name} reviewed. On to the next one!`)}
        <button class="btn btn-primary btn-block" data-act="finish"><i class="ph ph-check-circle"></i> Finish</button><button class="btn btn-ghost btn-block" data-act="go" data-step="${step - 1}">Back</button>`;
    }
    const [key, title] = Review.MONTH_STEPS[step];
    let body = '', prompt = '';
    if (key === 'wins') {
      const wins = (await DB.getAll('wins')).filter(w => w.date >= from && w.date <= to).sort(U.by(w => w.date));
      body = wins.map(w => UI.row({ icon: (Logs.WIN_TYPES[w.type] || Logs.WIN_TYPES.other)[1], cls: 'card', title: U.esc(w.title), sub: U.fmtDate(w.date), right: '' })).join('') || UI.empty('No wins logged this month — anything to add?', 'ph-trophy');
      body += '<button class="btn btn-ghost btn-block" data-act="win"><i class="ph ph-plus"></i> Log a win</button>';
      prompt = 'What are you proudest of this month?';
    } else if (key === 'slipped') {
      const st = App.streaks.overall.statuses;
      const missed = Object.entries(st).filter(([d, s]) => d >= from && d <= to && ['missed', 'partial'].includes(s)).length;
      const prios = (await Repo.all('weekPriority')).filter(p => p.week >= U.weekStart(from) && p.week <= to);
      const notDone = [];
      for (const p of prios) { if (p.scheduledDate) { const d = await Days.get(p.scheduledDate); const t = d && d.tasks.find(x => x.priorityId === p.id); if (!(t && Days.isDone(d, t.id))) notDone.push(p); } else notDone.push(p); }
      const overdue = (await DB.getAll('deadlines')).filter(d => !d.done && d.date < today && d.date >= from);
      body = `<div class="card"><dl class="kv"><dt>Days missed / partial</dt><dd>${missed}</dd><dt>Priorities not done</dt><dd>${notDone.length ? notDone.map(p => U.esc(p.text)).join('; ') : '—'}</dd>
        <dt>Overdue deadlines</dt><dd>${overdue.length ? overdue.map(d => U.esc(d.title)).join('; ') : '—'}</dd></dl></div>`;
      prompt = 'What got in the way, and what would make it easier next month?';
    } else if (key === 'research') {
      const { boards, cards } = await Research.activeProjects();
      const moved = cards.filter(c => (c.history || []).some(h => h.date >= from && h.date <= to) || (c.actionsDone || []).some(a => a.date >= from && a.date <= to));
      const stalled = cards.filter(c => !moved.includes(c));
      const row = (c) => UI.row({ icon: 'ph-flask', cls: 'card', title: U.esc(c.title), sub: `${U.esc(Boards.stageOf(boards.find(b => b.id === c.boardId), c.stageId).name)} · ${Boards.daysInStage(c)} days in stage`, act: 'card', data: { id: c.id } });
      body = `<div class="section-title">Moved (${moved.length})</div>${moved.map(row).join('') || '<p class="muted small">None.</p>'}<div class="section-title">Stalled (${stalled.length})</div>${stalled.map(row).join('') || '<p class="muted small">None.</p>'}`;
      prompt = 'Which project gets your energy next month? Anything to pause or drop?';
    } else if (key === 'goals') {
      const goals = (await Repo.all('goal')).filter(g => g.quarter === U.quarterStr(from) || g.quarter === U.quarterStr(today));
      body = goals.map(g => { const ms = g.milestones || []; return `<div class="card"><b>${U.esc(g.title)}</b> <span class="muted tiny">${U.esc(g.quarter)} · ${ms.filter(m => m.done).length}/${ms.length}</span>
        ${ms.map((m, i) => `<label class="check-row"><input type="checkbox" data-change="ms" data-g="${g.id}" data-i="${i}" ${m.done ? 'checked' : ''}><span>${U.esc(m.text)}${m.month ? ` <span class="muted tiny">${U.esc(m.month)}</span>` : ''}</span></label>`).join('')}</div>`; }).join('') || UI.empty('No goals for this quarter yet.', 'ph-target');
      body += '<button class="btn btn-ghost btn-block" data-act="goto" data-view="goals"><i class="ph ph-target"></i> Open Goals to add or change</button>';
      prompt = 'Any goal to change, add or let go of?';
    } else {
      body = `<div class="list">${UI.row({ icon: 'ph-stack', title: 'Day templates', sub: 'Edit the starting points for your days', act: 'goto', data: { view: 'templates' } })}
        ${UI.row({ icon: 'ph-calendar-dots', title: 'Week plans', sub: 'Default template per weekday; switch from a date', act: 'goto', data: { view: 'weekplans' } })}
        ${UI.row({ icon: 'ph-squares-four', title: 'Areas & streak targets', act: 'goto', data: { view: 'areasManage' } })}</div>`;
      prompt = 'What will you change in your routine?';
    }
    return `${UI.header(`${name}: ${step + 1}/${Review.MONTH_STEPS.length}`)}
      ${Review.otter({ wins: 'Let\'s start with the good stuff.', slipped: 'Now, gently: what slipped? No guilt — just data.', research: 'How did your research projects move?', goals: 'Do your goals still fit?', templates: 'Last: does your routine need a tweak?' }[key])}
      <div class="progress" style="margin-bottom:12px"><div style="width:${Math.round(100 * step / Review.MONTH_STEPS.length)}%;background:var(--accent)"></div></div>
      <h2 style="margin:0 4px 8px">${title}</h2>${body}
      <div class="field" style="margin-top:10px"><label for="rv-answer">${U.esc(prompt)}</label><textarea id="rv-answer" rows="3">${U.esc((rec.answers || {})[key] || '')}</textarea></div>
      <div class="btn-row"><button class="btn btn-ghost" data-act="go" data-step="${step - 1}" ${step ? '' : 'disabled'}><i class="ph ph-arrow-left"></i> Back</button>
        <button class="btn btn-primary" data-act="go" data-step="${step + 1}">Next <i class="ph ph-arrow-right"></i></button></div>`;
  },
  monthlyActions({ step = 0 }) {
    const month = Review.monthToReview();
    const id = `mr_${month}`;
    const save = async () => {
      const rec = (await Repo.get('monthlyReview', id)) || { id, month, answers: {} };
      const box = document.getElementById('rv-answer');
      const st = Review.MONTH_STEPS[Number(step)];
      if (box && st) rec.answers = { ...(rec.answers || {}), [st[0]]: box.value };
      await Repo.put('monthlyReview', rec);
      return rec;
    };
    return {
      go: async (el) => { await save(); Nav.go('monthlyReview', { step: Number(el.dataset.step) }, { replace: true }); },
      goto: async (el) => { await save(); Nav.go(el.dataset.view); },
      card: async (el) => { await save(); Nav.go('card', { id: el.dataset.id }); },
      win: () => Logs.editWin(null),
      ms: async (el) => { const g = await Repo.get('goal', el.dataset.g); g.milestones[Number(el.dataset.i)].done = el.checked; await Repo.put('goal', g); },
      finish: async () => {
        const rec = await save(); rec.completedAt = new Date().toISOString(); await Repo.put('monthlyReview', rec);
        await Otto.celebrate({ title: 'Monthly review done!', sub: 'A whole month, looked at kindly.', acc: ['clipboard'], big: false });
        Nav.go('review', {}, { root: true });
      }
    };
  },

  // ---------- goals: quarterly → monthly milestones → weekly priorities ----------
  async renderGoals({ quarter } = {}) {
    quarter = quarter || U.quarterStr(U.todayStr());
    const [y, q] = [Number(quarter.slice(0, 4)), Number(quarter.slice(6))];
    const prevQ = q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`, nextQ = q === 4 ? `${y + 1}-Q1` : `${y}-Q${q + 1}`;
    const goals = (await Repo.all('goal')).filter(g => g.quarter === quarter);
    const prios = await Repo.all('weekPriority');
    const months = [0, 1, 2].map(i => `${y}-${U.pad((q - 1) * 3 + 1 + i)}`);
    return `${UI.header('Goals', { right: '<button class="icon-btn" data-act="add" aria-label="Add goal"><i class="ph ph-plus"></i></button>' })}
      <div class="cal-head card"><button class="icon-btn" data-act="q" data-v="${prevQ}" aria-label="Previous quarter"><i class="ph ph-caret-left"></i></button>
        <b>${quarter} · ${months.map(m => U.MONTHS[Number(m.slice(5)) - 1].slice(0, 3)).join('–')}</b><button class="icon-btn" data-act="q" data-v="${nextQ}" aria-label="Next quarter"><i class="ph ph-caret-right"></i></button></div>
      ${App.visibleAreas().map(a => {
        const list = goals.filter(g => g.areaId === a.id);
        if (!list.length) return '';
        return `<div class="section-title" style="color:${a.color}">${U.esc(a.name)}</div>${list.map(g => {
          const ms = g.milestones || [];
          const linked = prios.filter(p => p.goalId === g.id || ms.some(m => p.text === m.text));
          return `<div class="card" style="border-left:5px solid ${a.color}"><div class="cal-head"><b>${g.done ? '✓ ' : ''}${U.esc(g.title)}</b>
            <button class="icon-btn" data-act="edit" data-id="${g.id}" aria-label="Edit goal"><i class="ph ph-pencil-simple"></i></button></div>
            ${UI.progress(g.done ? 1 : ms.filter(m => m.done).length, g.done ? 1 : ms.length || 1, a.color)}
            ${months.map(mo => { const mm = ms.map((m, i) => ({ m, i })).filter(x => x.m.month === mo); return mm.length ? `<div class="tiny muted" style="margin-top:6px;font-weight:800">${U.MONTHS[Number(mo.slice(5)) - 1]}</div>
              ${mm.map(({ m, i }) => `<label class="check-row" style="min-height:38px"><input type="checkbox" data-change="ms" data-id="${g.id}" data-i="${i}" ${m.done ? 'checked' : ''}><span>${U.esc(m.text)}</span></label>`).join('')}` : ''; }).join('')}
            ${ms.filter(m => !m.month).map(m => `<div class="small">• ${U.esc(m.text)}</div>`).join('')}
            ${linked.length ? `<div class="tiny muted" style="margin-top:4px">Weekly priorities: ${linked.map(p => U.esc(p.text)).join(' · ')}</div>` : ''}
            <button class="btn btn-small btn-ghost" data-act="addMs" data-id="${g.id}" style="margin-top:6px"><i class="ph ph-plus"></i> Milestone</button></div>`;
        }).join('')}`;
      }).join('') || UI.empty('No goals for this quarter. Tap + to add one per area.', 'ph-target')}
      <p class="muted small">Weekly priorities are chosen in the weekly review; this month's open milestones are suggested there.</p>`;
  },
  goalsActions(p = {}) {
    const quarter = p.quarter || U.quarterStr(U.todayStr());
    return {
      q: (el) => Nav.go('goals', { quarter: el.dataset.v }, { replace: true }),
      add: () => Review.editGoal(null, quarter),
      edit: async (el) => Review.editGoal(await Repo.get('goal', el.dataset.id), quarter),
      ms: async (el) => {
        const g = await Repo.get('goal', el.dataset.id); g.milestones[Number(el.dataset.i)].done = el.checked;
        await Repo.put('goal', g); if (el.checked) UI.toast('Milestone done!', 'ph-flag'); await App.changed({ celebrate: false });
      },
      addMs: async (el) => {
        const g = await Repo.get('goal', el.dataset.id);
        const [y, q] = [Number(g.quarter.slice(0, 4)), Number(g.quarter.slice(6))];
        const months = [0, 1, 2].map(i => `${y}-${U.pad((q - 1) * 3 + 1 + i)}`);
        const f = await UI.form('Monthly milestone', [{ name: 'text', label: 'Milestone', required: true },
          { name: 'month', type: 'select', label: 'Month', value: months.find(m => m >= U.monthStr(U.todayStr())) || months[0], options: months.map(m => ({ value: m, label: U.MONTHS[Number(m.slice(5)) - 1] })) }]);
        if (!f) return;
        g.milestones = [...(g.milestones || []), { id: U.uid('ms'), text: f.text, month: f.month, done: false }];
        await Repo.put('goal', g); await App.changed({ celebrate: false });
      }
    };
  },
  async editGoal(g, quarter) {
    const f = await UI.form(g ? 'Edit goal' : 'New quarterly goal', [
      { name: 'title', label: 'Goal', value: g ? g.title : '', required: true, placeholder: 'e.g. Submit the systematic review' },
      { name: 'areaId', type: 'select', label: 'Area', value: g ? g.areaId : (App.visibleAreas()[0] || {}).id, options: UI.areaOptions(false) },
      { name: 'quarter', label: 'Quarter (YYYY-Qn)', value: g ? g.quarter : quarter, required: true },
      { name: 'milestones', type: 'textarea', label: 'Milestones (one per line: text | YYYY-MM)', rows: 4, value: g ? (g.milestones || []).map(m => `${m.text}${m.month ? ` | ${m.month}` : ''}`).join('\n') : '' },
      ...(g ? [{ name: 'done', type: 'checkbox', label: 'Goal achieved', value: g.done }] : [])
    ], { buttons: g ? [{ label: 'Delete goal', value: 'del', danger: true }] : [], validate: v => /^\d{4}-Q[1-4]$/.test(v.quarter) ? null : 'Quarter must look like 2026-Q4.' });
    if (!f) return;
    if (f._button === 'del') { if (await UI.confirm('Delete this goal?', { ok: 'Delete', danger: true })) await Repo.del('goal', g.id); }
    else {
      const old = g ? g.milestones || [] : [];
      const milestones = f.milestones.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const [text, month = ''] = l.split('|').map(x => x.trim());
        const prev = old.find(m => m.text === text);
        return { id: prev ? prev.id : U.uid('ms'), text, month: /^\d{4}-\d{2}$/.test(month) ? month : '', done: prev ? prev.done : false };
      });
      await Repo.put('goal', { ...(g || { id: U.uid('goal') }), title: f.title, areaId: f.areaId, quarter: f.quarter, milestones, done: !!f.done });
    }
    await App.changed({ celebrate: false });
  },

  // ---------- global search ----------
  async search(q) {
    q = U.norm(q);
    if (q.length < 2) return [];
    const hit = (...xs) => xs.some(x => U.norm(x).includes(q));
    const out = [];
    const add = (group, icon, title, sub, view, params = {}) => out.push({ group, icon, title, sub, view, params });
    const [days, ideas, cards, inbox, wins, cqs, topics, waiting, dls, boards] = await Promise.all([DB.getAll('dayInstances'), Repo.all('idea'), DB.getAll('cards'), DB.getAll('inbox'), DB.getAll('wins'),
      DB.getAll('clinicalQuestions'), DB.getAll('topics'), DB.getAll('waitingOn'), DB.getAll('deadlines'), DB.getAll('boards')]);
    const seen = new Set();
    days.sort(U.by(d => d.date)).reverse().forEach(d => d.tasks.forEach(t => { if (hit(t.title, t.desc) && !seen.has(`${t.title}|${d.date}`) && seen.size < 40) { seen.add(`${t.title}|${d.date}`); add('Tasks', 'ph-check-square', t.title, `${U.fmtDate(d.date, { year: true })} ${t.time}`, 'today', { date: d.date }); } }));
    Days.dayTemplates().forEach(tp => tp.tasks.forEach(t => { if (hit(t.title, t.desc)) add('Templates', 'ph-stack', t.title, tp.name, 'template', { id: tp.id }); }));
    ideas.forEach(i => { if (hit(i.title, i.description, i.notes, i.specialty)) add('Research ideas', 'ph-lightbulb', i.title, `${i.sourceKey || 'own idea'} · ${i.specialty || ''}`, 'idea', { id: i.id }); });
    cards.forEach(c => { if (hit(c.title, c.nextAction, c.notes, ...(c.decisions || []).map(d => d.text + ' ' + d.why))) add('Board cards', 'ph-kanban', c.title, (boards.find(b => b.id === c.boardId) || {}).name || '', 'card', { id: c.id }); });
    inbox.forEach(i => { if (hit(i.text)) add('Inbox', 'ph-tray', i.text, i.status || 'inbox', 'inbox', { tab: i.status || 'inbox' }); });
    wins.forEach(w => { if (hit(w.title, w.notes)) add('Wins', 'ph-trophy', w.title, U.fmtDate(w.date, { year: true }), 'wins'); });
    cqs.forEach(c => { if (hit(c.question, c.answer, c.source, ...(c.reflection ? Object.values(c.reflection) : []))) add('Clinical questions', 'ph-question', c.question, c.answered ? 'answered' : 'open', 'clinicalQs', { show: c.answered ? 'answered' : 'open' }); });
    topics.forEach(t => { if (hit(t.title, t.notes, t.group)) add('Topics', 'ph-brain', t.title, Logs.STATUS[t.mapStatus || 'notStarted'], 'topics', { show: 'all' }); });
    waiting.forEach(w => { if (hit(w.title, w.who, w.notes)) add('Waiting on', 'ph-hand-palm', w.title, w.who || '', 'waiting', { show: w.done ? 'done' : 'open' }); });
    dls.forEach(d => { if (hit(d.title, d.notes)) add('Deadlines', 'ph-hourglass-medium', d.title, U.fmtDate(d.date, { year: true }), 'deadlines'); });
    const recs = [['reading', 'Reading queue', 'ph-books', r => [r.title, r.authors, r.takeaway], 'reading', r => ({ show: r.status || 'toRead' })],
      ['mistake', 'German mistakes', 'ph-warning-circle', r => [r.error, r.correction, r.note], 'mistakes'], ['case', 'Case log', 'ph-first-aid-kit', r => [r.title, r.notes, r.category], 'cases'],
      ['videoIdea', 'Video ideas', 'ph-video-camera', r => [r.title, r.notes], 'videoIdeas', r => ({ show: r.status || 'idea' })], ['goal', 'Goals', 'ph-target', r => [r.title, ...(r.milestones || []).map(m => m.text)], 'goals', r => ({ quarter: r.quarter })],
      ['cpd', 'Courses & teaching', 'ph-chalkboard-teacher', r => [r.title, r.notes], 'cpd'], ['cert', 'Certificates', 'ph-certificate', r => [r.name, r.notes], 'certs'],
      ['opportunity', 'Conferences & grants', 'ph-presentation', r => [r.name, r.notes], 'opportunities'], ['watch', 'Watch list', 'ph-binoculars', r => [r.name, r.notes], 'watch']];
    for (const [kind, group, icon, fields, view, params] of recs) {
      (await Repo.all(kind)).forEach(r => { if (hit(...fields(r))) add(group, icon, fields(r)[0], '', view, params ? params(r) : {}); });
    }
    return out.filter(r => Nav.views[r.view]);
  },
  renderSearch({ q = '' } = {}) {
    return `${UI.header('Search')}
      <input type="search" id="search-in" value="${U.esc(q)}" placeholder="Tasks, ideas, cards, logs, notes…" aria-label="Search" autocomplete="off">
      <div id="search-out" style="margin-top:10px"><p class="muted small">Type at least 2 letters.</p></div>`;
  },
  mountSearch(el, { q = '' } = {}) {
    const input = el.querySelector('#search-in'), outEl = el.querySelector('#search-out');
    let timer = null, token = 0;
    const run = async () => {
      const my = ++token;
      const res = await Review.search(input.value);
      if (my !== token) return;
      Nav.current().params.q = input.value;
      if (U.norm(input.value).length < 2) { outEl.innerHTML = '<p class="muted small">Type at least 2 letters.</p>'; return; }
      const groups = [...new Set(res.map(r => r.group))];
      outEl.innerHTML = groups.map(g => `<div class="section-title">${U.esc(g)} (${res.filter(r => r.group === g).length})</div><div class="list">${res.filter(r => r.group === g).slice(0, 25).map((r, i) =>
        UI.row({ icon: r.icon, title: U.esc(r.title), sub: U.esc(r.sub), act: 'open', data: { i: res.indexOf(r) } })).join('')}</div>`).join('') || UI.empty('Nothing found.', 'ph-magnifying-glass');
      outEl._res = res;
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 200); });
    outEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="open"]');
      if (!b) return;
      const r = outEl._res[Number(b.dataset.i)];
      if (r.view === 'today') { App.date = r.params.date; Nav.go('today', {}, { root: true }); } else Nav.go(r.view, r.params);
    });
    if (q) run(); else setTimeout(() => input.focus(), 100);
  },

  // ---------- in-app reminders (banners on Today when you open the app) ----------
  async reminders(day) {
    const today = U.todayStr();
    if (day.date !== today) return [];
    const r = App.settings.reminders;
    const mode = Days.modeById(day.modeId);
    if (mode && mode.quiet) return [];
    const out = [];
    const add = (key, cls, icon, text, view, params = {}) => { const k = `${key}_${today}`; if (!r.dismissed[k]) out.push({ cls, icon, text, act: 'go', data: { view, ...(params.id ? { param: params.id } : {}) }, dismiss: k }); };
    if (r.coreAfter21 !== false && U.nowMin() >= 21 * 60) {
      const p = Streaks.dayProgress(day);
      if (!p.met && !(mode && mode.protectsStreak) && p.pending.length) out.push({ cls: 'warn', icon: 'ph-star', text: `Still time for ${p.pending.slice(0, 2).map(t => t.title).join(' and ')}. Small and doable!`, act: 'noop', dismiss: `core_${today}` });
    }
    if (r.deadlines !== false) for (const d of (App.cache.deadlinesSoon || []).filter(d => U.diffDays(today, d.date) <= 3)) add(`dl${d.id}`, 'bad', 'ph-alarm', `${d.title} is ${U.relDay(d.date)}`, 'deadlines');
    if (r.topics !== false) { const due = Logs.dueTopics(await DB.getAll('topics')); if (due.length) add('topics', 'info', 'ph-brain', `${due.length} topic review${due.length > 1 ? 's' : ''} due today`, 'topics'); }
    if (r.waiting !== false) { const w = (await DB.getAll('waitingOn')).filter(x => !x.done && Logs.followDue(x) <= today); if (w.length) add('waiting', 'info', 'ph-hand-palm', `Time to follow up: ${w.slice(0, 2).map(x => x.title).join(', ')}${w.length > 2 ? ` +${w.length - 2}` : ''}`, 'waiting'); }
    if (r.certs !== false) for (const c of (await Repo.all('cert')).filter(c => c.expires)) {
      const n = U.diffDays(today, c.expires);
      if (n <= 30 && n >= -30) add(`cert${c.id}${n <= 7 ? '7' : '30'}`, n <= 7 ? 'bad' : 'warn', 'ph-certificate', n < 0 ? `${c.name} has expired` : `${c.name} expires in ${n} day${n === 1 ? '' : 's'}`, 'certs');
    }
    if (r.stuck !== false) {
      const { boards, cards } = await Research.activeProjects();
      const stuck = cards.filter(c => Boards.isStuck(boards.find(b => b.id === c.boardId), c));
      if (stuck.length) add('stuck', 'warn', 'ph-flask', `${stuck.length} research project${stuck.length > 1 ? 's' : ''} stuck: ${stuck[0].title}${stuck.length > 1 ? '…' : ''}`, stuck.length === 1 ? 'card' : 'researchBoards', stuck.length === 1 ? { id: stuck[0].id } : {});
    }
    if (r.videoGoal !== false && window.MedTwins) {
      const g = await MedTwins.videoGoal();
      if (g.last && g.dueIn <= 3) add(`video${g.last.date}`, g.dueIn < 0 ? 'warn' : 'info', 'ph-video-camera', g.dueIn < 0 ? `MedTwins: next video is ${-g.dueIn} days past your ${g.every}-day goal — no pressure, just a nudge` : `MedTwins: next video due ${g.dueIn === 0 ? 'today' : `in ${g.dueIn} days`}`, 'area', { id: 'a5' });
    }
    if (r.backup !== false) {
      const lb = App.settings.lastBackupAt ? U.dateStr(new Date(App.settings.lastBackupAt)) : null;
      const days = lb ? U.diffDays(lb, today) : U.diffDays(App.settings.startDate, today);
      if (days >= 7) add(`backup${U.weekStart(today)}`, 'info', 'ph-download-simple', lb ? `Last backup ${days} days ago — export one now?` : 'You haven\'t exported a backup yet — keep your data safe', 'backup');
    }
    return out;
  }
};
window.Review = Review;

Today.bannerHooks.push((day) => Review.reminders(day));

Nav.register('review', { tab: 'review', render: () => Review.renderHub(), actions: () => Review.hubActions() });
Nav.register('weeklyReview', { tab: 'review', render: (p) => Review.renderWizard(p), actions: (p) => Review.wizardActions(p) });
Nav.register('monthlyReview', { tab: 'review', render: (p) => Review.renderMonthly(p), actions: (p) => Review.monthlyActions(p) });
Nav.register('goals', { tab: 'review', render: (p) => Review.renderGoals(p), actions: (p) => Review.goalsActions(p) });
Nav.register('capacity', { tab: 'plan', render: (p) => Review.renderCapacity(p), actions: () => Review.capacityActions() });
Nav.register('search', { tab: 'more', render: (p) => Review.renderSearch(p), mounted: (el, p) => Review.mountSearch(el, p) });
