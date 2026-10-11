// ======= streaks.js — overall + per-area streaks, pebbles, XP and milestones =======
// Streaks are RE-COMPUTED from the saved days every time (a replay from the first day),
// so they are always consistent: days the app wasn't opened count as missed (unless a
// shift/holiday protects them), pebbles are earned and spent in order, and a rule change
// applies only from the date it was made (settings.ruleHistory).

const Streaks = {
  MILESTONES: [7, 30, 100],
  MAX_PEBBLES: 2,
  COUNTING: ['complete', 'minimum'],
  NEUTRAL: ['protected', 'rest', 'holiday', 'none', 'paused'],

  ruleFor(date) {
    const hist = [...(App.settings.ruleHistory || [])].sort(U.by(r => r.from));
    let r = hist[0] || { rule: 'core', pct: 80, min: 3 };
    for (const h of hist) if (h.from <= date) r = h;
    return r.rule === 'x-tasks' ? { ...r, rule: 'min' } : r; // older builds called it 'x-tasks'
  },
  ruleText(r) {
    switch (r.rule) {
      case 'all': return 'A day counts when every required task is ticked. Optional and info-only blocks never count.';
      case 'percentage': return `A day counts when at least ${r.pct}% of the required tasks are ticked. Optional and info-only blocks never count.`;
      case 'min': return `A day counts when at least ${r.min} tasks are ticked (or all of them, if the day has fewer). Info-only blocks never count.`;
      default: return 'A day counts when all its core tasks (★) are ticked. Everything else is bonus XP. On a day with no core tasks, ticking any one required task is enough.';
    }
  },
  ruleName(r) { return { core: 'Core tasks only', all: 'All required tasks', percentage: `${r.pct}% of required tasks`, min: `At least ${r.min} tasks` }[r.rule] || r.rule; },

  // How far a day is towards the overall rule.
  dayProgress(day, r = Streaks.ruleFor(day.date)) {
    const done = new Set(day.completedTaskIds || []);
    const tickable = day.tasks.filter(t => !t.infoOnly);
    const required = tickable.filter(t => !t.optional);
    let need = 0, have = 0, label = 'tasks';
    if (r.rule === 'core') {
      const core = required.filter(t => t.core);
      if (core.length) { need = core.length; have = core.filter(t => done.has(t.id)).length; label = 'core tasks'; }
      else if (required.length) { need = 1; have = required.some(t => done.has(t.id)) ? 1 : 0; label = 'task'; }
    } else if (r.rule === 'all') {
      need = required.length; have = required.filter(t => done.has(t.id)).length;
    } else if (r.rule === 'percentage') {
      need = Math.ceil(required.length * (r.pct || 80) / 100); have = required.filter(t => done.has(t.id)).length;
    } else if (r.rule === 'min') {
      need = Math.min(r.min || 3, tickable.length); have = tickable.filter(t => done.has(t.id)).length;
    }
    const hasCore = required.some(t => t.core);
    const pending = required.filter(t => !done.has(t.id) && (r.rule !== 'core' || !hasCore || t.core));
    return { need, have, met: need > 0 && have >= need, rest: need === 0, label, pending };
  },

  holidayFor(date, areaId) {
    return (App.settings.holidays || []).find(h => h.from <= date && date <= h.to &&
      (areaId ? (h.areaIds || []).includes(areaId) : !!h.overall));
  },

  // ---- data needed for a full replay ----
  async loadCtx() {
    const [days, cqs, timeLogs, wins, topics, extra] = await Promise.all([
      DB.getAll('dayInstances'), DB.getAll('clinicalQuestions'), Repo.all('timeLog'), DB.getAll('wins'), DB.getAll('topics'),
      Promise.all(Streaks.extraSources.map(f => f().catch(e => { console.error(e); return []; })))
    ]);
    const dayMap = Object.fromEntries(days.map(d => [d.date, d]));
    const events = {}; // events[areaId][date] = [{n, tag}]
    const addEv = (areaId, date, n = 1, tag = '') => {
      if (!areaId || !date) return;
      ((events[areaId] = events[areaId] || {})[date] = events[areaId][date] || []).push({ n, tag });
    };
    cqs.forEach(q => addEv(q.areaId || 'a3', q.date));
    extra.flat().forEach(e => addEv(e.areaId, e.date, e.n || 1, e.tag || ''));
    const minutes = {}; // minutes[areaId][date]
    timeLogs.forEach(l => { if (!l.areaId) return; const m = (minutes[l.areaId] = minutes[l.areaId] || {}); m[l.date] = (m[l.date] || 0) + (Number(l.minutes) || 0); });
    return { dayMap, events, minutes, timeLogs, wins, topics, days };
  },
  extraSources: [], // tool modules register async () => [{areaId, date, n, tag}]

  overallStatus(date, ctx) {
    if (Streaks.holidayFor(date, null)) return 'holiday';
    const day = ctx.dayMap[date];
    if (!day) {
      if (date < App.settings.startDate) return 'none';
      const mode = Days.modeById(Days.plannedModeId(date));
      return mode && mode.protectsStreak ? 'protected' : 'missed';
    }
    const mode = Days.modeById(day.modeId);
    const p = Streaks.dayProgress(day);
    if (p.met) return mode && mode.isMinimum ? 'minimum' : 'complete';
    if (mode && mode.protectsStreak) return 'protected';
    if (p.rest) return 'rest';
    return p.have > 0 ? 'partial' : 'missed';
  },

  // Replays a sequence of unit statuses into streak numbers with pebbles.
  replay(seq, pebblesStart, longestFloor = 0) {
    let streak = 0, longest = longestFloor, pebbles = Math.min(Streaks.MAX_PEBBLES, pebblesStart || 0), runStart = null;
    const out = {};
    for (const { key, status } of seq) {
      let st = status;
      if (Streaks.COUNTING.includes(st)) {
        streak++; runStart = runStart || key;
        if (streak % 7 === 0) pebbles = Math.min(Streaks.MAX_PEBBLES, pebbles + 1);
      } else if (!Streaks.NEUTRAL.includes(st)) {
        if (pebbles > 0) { pebbles--; st = 'pebble'; } else { streak = 0; runStart = null; }
      }
      longest = Math.max(longest, streak);
      out[key] = st;
    }
    return { streak, longest, pebbles, runStart, statuses: out };
  },

  // ---- areas ----
  isWorkingDay(area, date, ctx) {
    const day = ctx.dayMap[date];
    const modeId = day ? day.modeId : Days.plannedModeId(date);
    const mode = Days.modeById(modeId);
    if (mode && mode.nonWorking) return false;
    let tasks = day ? day.tasks : null;
    if (!tasks) { const tpl = Days.defaultTemplateFor(date); tasks = tpl ? tpl.tasks : []; }
    return tasks.some(t => t.areaId === area.id);
  },
  areaUnits(area, date, ctx) {
    if (area.measure === 'minutes') return (ctx.minutes[area.id] || {})[date] || 0;
    const day = ctx.dayMap[date];
    let n = 0;
    const doneTags = new Set();
    if (day) {
      const done = new Set(day.completedTaskIds);
      day.tasks.forEach(t => { if (t.areaId === area.id && !t.infoOnly && !t.optional && done.has(t.id)) { n++; if (t.tag) doneTags.add(t.tag); } });
    }
    for (const e of ((ctx.events[area.id] || {})[date] || [])) if (!e.tag || !doneTags.has(e.tag)) { n += e.n; if (e.tag) doneTags.add(e.tag); }
    return n;
  },
  areaDayKind(area, date, ctx) {
    if (Streaks.holidayFor(date, area.id)) return 'holiday';
    if ((area.restDays || []).includes(U.dow(date))) return 'rest';
    if (area.workingDaysOnly && !Streaks.isWorkingDay(area, date, ctx)) return 'rest';
    const day = ctx.dayMap[date];
    const mode = Days.modeById(day ? day.modeId : Days.plannedModeId(date));
    if (mode && mode.protectsStreak && area.protectWithModes) return 'protected';
    return 'normal';
  },
  computeArea(area, ctx, today) {
    const start = App.settings.startDate;
    const res = { id: area.id, current: 0, longest: 0, pebbles: 0, needs: false, todayUnits: 0, target: area.target || 1,
      week: { units: 0, target: area.target || 1 }, dayStatus: {}, weekStatus: {}, runStart: null, todayKind: 'normal' };
    if (area.archived || area.paused || area.streakType === 'none') { res.paused = true; }
    const target = Math.max(1, Number(area.target) || 1);
    // Per-day units/kinds for the last ~5 weeks (mini calendar) and the whole history for the replay.
    const dates = [];
    for (let d = start; d <= today; d = U.addDays(d, 1)) dates.push(d);
    const kinds = {}, units = {};
    dates.forEach(d => { kinds[d] = Streaks.areaDayKind(area, d, ctx); units[d] = Streaks.areaUnits(area, d, ctx); });
    res.todayUnits = units[today] || 0;
    res.todayKind = kinds[today];

    if (area.streakType === 'weekly') {
      const seq = [];
      const ws0 = U.weekStart(start), wsNow = U.weekStart(today);
      for (let ws = ws0; ws <= wsNow; ws = U.addDays(ws, 7)) {
        let u = 0, avail = 0;
        for (let i = 0; i < 7; i++) {
          const d = U.addDays(ws, i);
          if (d < start || d > today) { if (d > today) avail++; continue; }
          u += units[d]; if (kinds[d] === 'normal') avail++;
        }
        const eff = Math.min(target, avail);
        let st;
        if (eff === 0) st = 'rest';
        else if (u >= eff) st = 'complete';
        else st = ws === wsNow ? 'pending' : (u > 0 ? 'partial' : 'missed');
        if (ws === wsNow) { res.week = { units: u, target: eff || target }; if (st !== 'pending') seq.push({ key: ws, status: st }); else res.weekStatus[ws] = 'pending'; }
        else seq.push({ key: ws, status: st });
      }
      const r = Streaks.replay(seq, area.pebblesStart, area.longestFloor || 0);
      Object.assign(res.weekStatus, r.statuses);
      Object.assign(res, { current: r.streak, longest: r.longest, pebbles: r.pebbles, runStart: r.runStart });
      res.needs = !res.paused && res.week.units < res.week.target;
      res.unit = 'week';
    } else {
      const seq = [];
      for (const d of dates) {
        let st;
        const k = kinds[d];
        if (units[d] >= target) st = 'complete';
        else if (k !== 'normal') st = k;
        else st = units[d] > 0 ? 'partial' : 'missed';
        if (d === today && !Streaks.COUNTING.includes(st)) { res.dayStatus[d] = st === 'missed' || st === 'partial' ? 'pending' : st; continue; }
        seq.push({ key: d, status: st });
      }
      const r = Streaks.replay(seq, area.pebblesStart, area.longestFloor || 0);
      Object.assign(res.dayStatus, r.statuses);
      Object.assign(res, { current: r.streak, longest: r.longest, pebbles: r.pebbles, runStart: r.runStart });
      res.needs = !res.paused && res.todayUnits < target && kinds[today] === 'normal';
      res.unit = 'day';
    }
    // Day-level marks for the mini calendar (did this day contribute?)
    res.dayUnits = {};
    dates.slice(-42).forEach(d => { res.dayUnits[d] = { units: units[d], kind: kinds[d] }; });
    return res;
  },

  // ---- XP: per task (editable) + small bonuses for real outputs ----
  xp(ctx, today) {
    const ws = U.weekStart(today);
    let total = 0, week = 0;
    const add = (date, n) => { total += n; if (date >= ws && date <= today) week += n; };
    for (const d of ctx.days) {
      const done = new Set(d.completedTaskIds || []);
      d.tasks.forEach(t => { if (!t.infoOnly && done.has(t.id)) add(d.date, Number(t.xp ?? 10) || 0); });
    }
    ctx.wins.forEach(w => add(w.date, 25));
    ctx.topics.forEach(t => (t.reviews || []).forEach(r => add(r.date, 5)));
    ctx.timeLogs.forEach(l => add(l.date, Math.floor((Number(l.minutes) || 0) / 5)));
    return { total, week };
  },

  async compute() {
    const today = U.todayStr();
    const ctx = await Streaks.loadCtx();
    const start = App.settings.startDate || today;
    const seq = [];
    for (let d = start; d < today; d = U.addDays(d, 1)) seq.push({ key: d, status: Streaks.overallStatus(d, ctx) });
    const r = Streaks.replay(seq, App.settings.pebblesStart, Number(App.settings.longestStreak) || 0);
    const todayStatus = Streaks.overallStatus(today, ctx);
    let current = r.streak, pebbles = r.pebbles, longest = r.longest, runStart = r.runStart;
    const todayCounts = Streaks.COUNTING.includes(todayStatus);
    if (todayCounts) {
      current++; runStart = runStart || today;
      if (current % 7 === 0) pebbles = Math.min(Streaks.MAX_PEBBLES, pebbles + 1);
      longest = Math.max(longest, current);
    }
    const statuses = { ...r.statuses, [today]: todayCounts ? todayStatus : (['protected', 'rest', 'holiday'].includes(todayStatus) ? todayStatus : 'today') };
    const areas = {};
    for (const a of App.areas) areas[a.id] = Streaks.computeArea(a, ctx, today);
    const res = { today, overall: { current, longest, pebbles, runStart, todayStatus, todayCounts, statuses }, areas, xp: Streaks.xp(ctx, today) };
    App.streaks = res;
    return res;
  },

  // Milestones not yet celebrated (7/30/100), overall and per area. Keyed by the run start so a
  // new streak can celebrate again after a reset.
  pendingMilestones() {
    const s = App.streaks, shown = App.settings.milestonesShown || {}, out = [];
    if (!s) return out;
    const check = (scope, cur, runStart, areaId) => {
      for (const m of Streaks.MILESTONES) {
        const key = `${scope}:${m}:${runStart}`;
        if (cur >= m && runStart && !shown[key]) out.push({ key, m, areaId });
      }
    };
    check('overall', s.overall.current, s.overall.runStart, null);
    for (const a of App.areas) { const r = s.areas[a.id]; if (r && !r.paused) check(a.id, r.current, r.runStart, a.id); }
    // Only celebrate the highest pending milestone per scope.
    const best = {};
    out.forEach(o => { const sc = o.areaId || 'overall'; if (!best[sc] || best[sc].m < o.m) best[sc] = o; });
    return { list: Object.values(best), all: out };
  }
};
window.Streaks = Streaks;
