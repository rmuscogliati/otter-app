// ======= days.js — day plans, templates, week plans, modes and shifts =======
// A "day" (dayInstances store) is the plan for one date. It is created from a day template
// (or blank / copied) the first time it is needed, and after that it never changes when
// templates change — so history is never rewritten.

const Days = {
  // ---------- lookups (data cached on App by App.loadCore) ----------
  dayTemplates() { return (App.templates || []).filter(t => !t.legacy && !t.days).sort(U.by(t => t.name.toLowerCase())); },
  templateById(id) { return (App.templates || []).find(t => t.id === id); },
  modeById(id) { return (App.modes || []).find(m => m.id === id); },

  weekPlanFor(date) {
    const sched = [...(App.settings.weekPlanSchedule || [])].sort(U.by(s => s.from));
    let id = sched.length ? sched[0].weekPlanId : 'wp_normal';
    for (const s of sched) if (s.from <= date) id = s.weekPlanId;
    return (App.weekPlans || []).find(w => w.id === id) || (App.weekPlans || [])[0];
  },
  defaultTemplateFor(date) {
    const wp = Days.weekPlanFor(date);
    const id = wp && wp.days ? wp.days[U.dow(date)] : null;
    return Days.templateById(id) || null;
  },

  // Shift planner: single dates (shifts store) win over repeating patterns.
  shiftFor(date) {
    const single = (App.shifts || []).find(s => s.date === date);
    if (single) return { ...single, source: 'single' };
    for (const p of (App.patterns || [])) {
      if (!p.start || date < p.start || (p.until && date > p.until)) continue;
      const every = Math.max(1, Number(p.every) || 1);
      if (U.diffDays(p.start, date) % every === 0) return { date, modeId: p.modeId, label: p.label, source: 'pattern', patternId: p.id };
    }
    return null;
  },
  // The mode a date would get if it were created now.
  plannedModeId(date) {
    const sh = Days.shiftFor(date);
    if (sh) return sh.modeId;
    const tpl = Days.defaultTemplateFor(date);
    return (tpl && tpl.modeId) || 'm_normal';
  },

  // ---------- reading & creating days ----------
  get(date) { return DB.get('dayInstances', date); },
  async ensure(date) { return (await Days.get(date)) || Days.create(date, 'default'); },

  async create(date, option = 'default') {
    let tasks = [], templateId = '';
    if (option === 'default') {
      const tpl = Days.defaultTemplateFor(date);
      if (tpl) { tasks = U.clone(tpl.tasks); templateId = tpl.id; }
    } else if (option && option.templateId) {
      const tpl = Days.templateById(option.templateId);
      if (tpl) { tasks = U.clone(tpl.tasks); templateId = tpl.id; }
    } else if (option === 'yesterday' || option === 'lastweek') {
      const src = await Days.get(U.addDays(date, option === 'yesterday' ? -1 : -7));
      if (src) { tasks = U.clone(src.baseTasks || src.tasks); templateId = src.templateId || ''; }
      else {
        const tpl = Days.defaultTemplateFor(U.addDays(date, option === 'yesterday' ? -1 : -7));
        if (tpl) { tasks = U.clone(tpl.tasks); templateId = tpl.id; }
      }
    }
    tasks.forEach(t => { if (!t.srcId) t.srcId = t.id; });
    const day = { date, tasks: tasks.sort(U.by(t => t.time)), completedTaskIds: [], modeId: 'm_normal', templateId, planned: true, createdAt: new Date().toISOString() };
    const sh = Days.shiftFor(date);
    const tpl = Days.templateById(templateId);
    const modeId = sh ? sh.modeId : ((tpl && tpl.modeId) || 'm_normal');
    Days.applyMode(day, modeId, { fromTemplate: tpl });
    for (const hook of Days.createHooks) { try { hook(day); } catch (e) { console.error(e); } }
    await DB.put('dayInstances', day);
    // A shift planned in advance on a day with a gym session: move the session to a nearby free day.
    const mode = sh && Days.modeById(modeId);
    if (mode && mode.protectsStreak && mode.action === 'replace') await Days.moveGymAround(date);
    return day;
  },
  createHooks: [], // other modules can add recurring tasks (e.g. the weekly watch-list check)

  // Switching modes swaps the task list and keeps the normal plan in baseTasks so you can switch back.
  applyMode(day, modeId, { fromTemplate } = {}) {
    const mode = Days.modeById(modeId) || Days.modeById('m_normal') || { id: 'm_normal', action: 'none' };
    const base = day.baseTasks || day.tasks;
    const tpl = Days.templateById(mode.templateId);
    // A day created straight from the mode's own template needs no swap.
    if (fromTemplate && tpl && fromTemplate.id === tpl.id) { day.modeId = mode.id; return day; }
    if (mode.action === 'replace' && tpl) {
      day.baseTasks = base;
      day.tasks = U.clone(tpl.tasks);
    } else if (mode.action === 'replaceArea' && tpl) {
      day.baseTasks = base;
      day.tasks = [...U.clone(base).filter(t => t.areaId !== mode.areaId || t.core), ...U.clone(tpl.tasks)];
    } else {
      day.tasks = base;
      delete day.baseTasks;
    }
    day.tasks.forEach(t => { if (!t.srcId) t.srcId = t.id; });
    day.tasks.sort(U.by(t => t.time));
    day.modeId = mode.id;
    return day;
  },

  async save(day) {
    day.tasks.sort(U.by(t => t.time));
    day.updatedAt = new Date().toISOString();
    await DB.put('dayInstances', day);
    return day;
  },

  async setMode(date, modeId) {
    const day = await Days.ensure(date);
    Days.applyMode(day, modeId);
    await Days.save(day);
    const mode = Days.modeById(modeId);
    if (mode && mode.protectsStreak && mode.action === 'replace') await Days.moveGymAround(date);
    return day;
  },

  isDone(day, taskId) { return (day.completedTaskIds || []).includes(taskId); },
  async toggleTask(date, taskId) {
    const day = await Days.ensure(date);
    const task = day.tasks.find(t => t.id === taskId);
    if (!task || task.infoOnly) return { day, task, done: false, changed: false };
    const done = !Days.isDone(day, taskId);
    day.completedTaskIds = done ? [...day.completedTaskIds, taskId] : day.completedTaskIds.filter(id => id !== taskId);
    await Days.save(day);
    for (const hook of Days.toggleHooks) { try { await hook(day, task, done); } catch (e) { console.error(e); } }
    return { day, task, done, changed: true };
  },
  toggleHooks: [],

  // ---------- task edits with "only this day" / "this day and all future <weekday>s" ----------
  async upsertTask(date, task, scope = 'day') {
    const day = await Days.ensure(date);
    const i = day.tasks.findIndex(t => t.id === task.id);
    if (!task.srcId) task.srcId = task.id;
    if (i >= 0) day.tasks[i] = task; else day.tasks.push(task);
    if (day.baseTasks) { // keep the normal plan in sync when editing inside a mode
      const j = day.baseTasks.findIndex(t => t.id === task.id);
      if (j >= 0) day.baseTasks[j] = U.clone(task);
    }
    await Days.save(day);
    if (scope === 'future') await Days.applyToTemplate(day, task, 'upsert');
    return day;
  },
  async deleteTask(date, taskId, scope = 'day') {
    const day = await Days.ensure(date);
    const task = day.tasks.find(t => t.id === taskId);
    day.tasks = day.tasks.filter(t => t.id !== taskId);
    if (day.baseTasks) day.baseTasks = day.baseTasks.filter(t => t.id !== taskId);
    day.completedTaskIds = day.completedTaskIds.filter(id => id !== taskId);
    await Days.save(day);
    if (scope === 'future' && task) await Days.applyToTemplate(day, task, 'delete');
    return day;
  },
  templateForDay(day) { return Days.templateById(day.templateId) || Days.defaultTemplateFor(day.date); },
  async applyToTemplate(day, task, op) {
    const tpl = Days.templateForDay(day);
    if (!tpl) return;
    const key = task.srcId || task.id;
    const clean = U.clone(task); clean.id = key; clean.srcId = key;
    const i = tpl.tasks.findIndex(t => (t.srcId || t.id) === key);
    if (op === 'delete') { if (i >= 0) tpl.tasks.splice(i, 1); }
    else if (i >= 0) tpl.tasks[i] = clean; else tpl.tasks.push(clean);
    tpl.tasks.sort(U.by(t => t.time));
    await Repo.put('templates', tpl);
    // Future days already created from this template (never today or the past) follow the change.
    const all = await DB.getAll('dayInstances');
    for (const d of all) {
      if (d.date <= day.date || d.templateId !== tpl.id || d.baseTasks) continue;
      const j = d.tasks.findIndex(t => (t.srcId || t.id) === key);
      if (op === 'delete') { if (j >= 0) { d.tasks.splice(j, 1); } }
      else {
        const copy = U.clone(task); copy.srcId = key; copy.id = j >= 0 ? d.tasks[j].id : key;
        if (j >= 0) d.tasks[j] = copy; else d.tasks.push(copy);
      }
      d.tasks.sort(U.by(t => t.time));
      await DB.put('dayInstances', d);
    }
    await App.loadCore();
  },

  // "Save this day as a template"
  async saveDayAsTemplate(day, name) {
    const tasks = U.clone(day.baseTasks || day.tasks).map(t => { const id = U.uid('tt'); return { ...t, id, srcId: id }; });
    const tpl = await Repo.put('templates', { id: U.uid('tpl'), kind: 'day', name, modeId: day.modeId === 'm_normal' ? 'm_normal' : day.modeId, tasks });
    await App.loadCore();
    return tpl;
  },
  // "Save changes to template": overwrite the day's template with this day's plan.
  async saveDayIntoTemplate(day) {
    const tpl = Days.templateForDay(day);
    if (!tpl) return null;
    tpl.tasks = U.clone(day.baseTasks || day.tasks).map(t => ({ ...t, id: t.srcId || t.id, srcId: t.srcId || t.id }));
    await Repo.put('templates', tpl);
    await App.loadCore();
    return tpl;
  },

  // ---------- shift planner ----------
  async addShift(date, modeId, label) {
    await Repo.put('shifts', { date, modeId, label: label || '' });
    await App.loadCore();
    await Days.reapplyShift(date);
  },
  async removeShift(date) {
    await Repo.del('shifts', date);
    await App.loadCore();
    await Days.reapplyShift(date);
  },
  async savePattern(p) {
    await Repo.put('shiftPattern', p);
    await App.loadCore();
    for (const d of Days.patternDates(p, 120)) await Days.reapplyShift(d);
  },
  async deletePattern(p) {
    const dates = Days.patternDates(p, 120);
    await Repo.del('shiftPattern', p.id);
    await App.loadCore();
    for (const d of dates) await Days.reapplyShift(d);
  },
  patternDates(p, horizonDays = 60) {
    const out = [];
    const today = U.todayStr();
    const end = U.addDays(today, horizonDays);
    const every = Math.max(1, Number(p.every) || 1);
    let d = p.start;
    if (!d) return out;
    while (d < today) d = U.addDays(d, every);
    while (d <= end && (!p.until || d <= p.until)) { out.push(d); d = U.addDays(d, every); }
    return out;
  },
  // Only future (or today's untouched) days are changed; the past is never rewritten.
  async reapplyShift(date) {
    if (date < U.todayStr()) return;
    const day = await Days.get(date);
    // Not planned yet: plan it now (up to 3 weeks ahead) so the shift and any gym move show straight away.
    if (!day) { if (Days.shiftFor(date) && U.diffDays(U.todayStr(), date) <= 21) await Days.create(date, 'default'); return; }
    if (day.completedTaskIds.length) return;
    const sh = Days.shiftFor(date);
    const tpl = Days.templateById(day.templateId);
    const modeId = sh ? sh.modeId : ((tpl && tpl.modeId) || 'm_normal');
    if (day.modeId === modeId) return;
    Days.applyMode(day, modeId);
    await Days.save(day);
    const mode = Days.modeById(modeId);
    if (mode && mode.protectsStreak && mode.action === 'replace') await Days.moveGymAround(date);
  },

  // Gym planner: when a night/on-call replaces a day that had a gym session, move that session
  // to the next day in the following 3 days that has no shift and no gym session yet.
  async moveGymAround(date) {
    if (!App.settings.gym || !App.settings.gym.autoMoveGym || date < U.todayStr()) return null;
    const day = await Days.get(date);
    const base = (day && day.baseTasks) || [];
    const gym = base.find(t => t.tag === 'gym' && !t.optional);
    if (!gym) return null;
    for (let i = 1; i <= 3; i++) {
      const d2 = U.addDays(date, i);
      if (Days.shiftFor(d2)) continue;
      const target = await Days.ensure(d2);
      const mode = Days.modeById(target.modeId);
      if (mode && mode.protectsStreak) continue;
      if (target.tasks.some(t => t.tag === 'gym' && !t.optional)) continue;
      const copy = { ...U.clone(gym), id: U.uid('t'), srcId: U.uid('t'), desc: `Moved from ${U.fmtDate(date)} (shift)` };
      const opt = target.tasks.find(t => t.tag === 'gym');
      if (opt) { copy.time = opt.time; copy.endTime = opt.endTime; target.tasks = target.tasks.filter(t => t !== opt); }
      target.tasks.push(copy);
      await Days.save(target);
      UI.toast(`Gym moved to ${U.fmtDate(d2)} because of the shift`, 'ph-barbell');
      return d2;
    }
    return null;
  }
};
window.Days = Days;
