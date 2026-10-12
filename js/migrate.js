// ======= migrate.js — one-time data migrations, each guarded by its own flag =======
// Rules: never delete user data, never overwrite a value the user may have edited,
// only fill in what is missing. A failing step is logged and the app still starts.

const Migrate = (() => {
  const TRACK_TO_AREA = { t1: 'a6', t2: 'a1', t3: 'a2', t4: 'a5', t5: 'a4', t6: 'a3' };

  function normalizeTask(t) {
    if (t.trackId && !t.areaId) t.areaId = TRACK_TO_AREA[t.trackId] || null;
    delete t.trackId;
    if (t.areaId === undefined) t.areaId = null;
    if (!t.id) t.id = U.uid('t');
    if (!t.srcId) t.srcId = t.id;
    if (!t.time) t.time = '09:00';
    if (!t.endTime || U.toMin(t.endTime) <= U.toMin(t.time)) t.endTime = U.fromMin(U.toMin(t.time) + 30);
    t.infoOnly = !!t.infoOnly; t.optional = !!t.optional; t.core = !!t.core && !t.optional && !t.infoOnly;
    if (t.xp == null) t.xp = t.infoOnly ? 0 : 10;
    if (t.desc == null) t.desc = '';
    if (!t.tag) {
      const title = U.norm(t.title), desc = U.norm(t.desc);
      if (t.areaId === 'a1' && title.startsWith('gym')) t.tag = 'gym';
      else if (desc.includes('use the language')) t.tag = 'speaking';
      else if (title.includes('weekly review')) t.tag = 'review';
      else t.tag = '';
    }
    return t;
  }

  // Adds keys that are missing (deeply for plain objects), never replaces existing values.
  function fillMissing(target, defaults) {
    for (const [k, v] of Object.entries(defaults)) {
      if (target[k] === undefined) target[k] = U.clone(v);
      else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) fillMissing(target[k], v);
    }
    return target;
  }

  async function seedFresh() {
    const s = Defaults.settings();
    STEPS.forEach(st => { s.migrations[st.id] = true; });
    await Repo.putMany('areas', U.clone(Defaults.areas));
    await Repo.putMany('modes', U.clone(Defaults.modes));
    await Repo.putMany('templates', U.clone(Defaults.dayTemplates));
    await Repo.putMany('weekPlan', U.clone(Defaults.weekPlans));
    await Repo.putMany('boards', U.clone(Defaults.boards));
    await seedTools();
    await DB.put('settings', s);
  }

  async function seedTools() {
    if (!(await Repo.all('guideline')).length) await Repo.putMany('guideline', U.clone(Defaults.guidelines));
    if (!(await Repo.all('workoutTemplate')).length) await Repo.putMany('workoutTemplate', U.clone(Defaults.workoutTemplates));
    if (!(await Repo.all('cando')).length) {
      const list = [];
      Object.entries(Defaults.canDo).forEach(([level, items]) => items.forEach((text, i) => list.push({ id: `cd_${level}_${i}`, level, text, done: false, order: i })));
      await Repo.putMany('cando', list);
    }
    if (!(await Repo.all('portfolioTarget')).length) {
      await Repo.putMany('portfolioTarget', Defaults.portfolioTargets.map((p, i) => ({ id: `pt_${i}`, ...p, deadline: '', done: 0 })));
    }
  }

  // Replaces the weekday/weekend templates with the current defaults. The previous version of each one is
  // kept as a hidden copy, so nothing is lost. Future days that were created but never touched (nothing
  // ticked, never edited) are removed so they are re-planned from the new week; anything else is left alone.
  async function refreshWeekTemplates(stamp, label) {
    const sig = (list) => JSON.stringify((list || []).map(t => [t.title, t.time, t.endTime]).sort());
    const today = U.todayStr();
    const days = await DB.getAll('dayInstances');
    for (const fresh of Defaults.dayTemplates.filter(t => /^tpl_d\d$/.test(t.id))) {
      const old = await DB.get('templates', fresh.id);
      if (old && sig(old.tasks) === sig(fresh.tasks)) continue;
      if (old) await Repo.put('templates', { ...U.clone(old), id: `${old.id}_${stamp}`, name: `${old.name} (${label})`, legacy: true });
      await Repo.put('templates', { ...(old || {}), ...U.clone(fresh) });
      const oldSig = old ? sig(old.tasks) : null;
      for (const d of days) {
        if (d.date <= today || d.templateId !== fresh.id || d.updatedAt || (d.completedTaskIds || []).length || sig(d.baseTasks || d.tasks) !== oldSig) continue;
        await DB.delete('dayInstances', d.date);
      }
    }
  }

  const STEPS = [
    { id: 'v5_settings', run: async (s) => {
      const days = await DB.getAll('dayInstances');
      const first = days.map(d => d.date).sort()[0];
      if (!Array.isArray(s.ruleHistory) || !s.ruleHistory.length) {
        s.ruleHistory = [{ from: '2000-01-01', rule: s.streakRule || 'core', pct: s.streakRulePercentage || 80, min: s.streakRuleMinTasks || 3 }];
      }
      fillMissing(s, Defaults.settings());
      s.pebblesStart = Number(s.pebbles) || 0;
      s.startDate = first || U.todayStr();
    } },
    { id: 'v5_areas', run: async () => {
      const list = await DB.getAll('areas');
      const byId = Object.fromEntries(list.map(a => [a.id, a]));
      for (const d of Defaults.areas) {
        const a = byId[d.id];
        if (!a) { await Repo.put('areas', U.clone(d)); continue; }
        if (a.name === 'Research (spine surgery)') a.name = 'Research';
        // Old builds saved some wrong starting values; fix only those exact, never-edited values.
        if (a.id === 'a1' && a.streakType === 'weekly' && a.target === 3) a.target = 4;
        if (a.id === 'a3' && a.streakType === 'weekly' && a.target === 3) { a.streakType = 'daily'; a.target = 1; }
        a.measure = a.measure || (a.targetType === 'minutes' ? 'minutes' : 'tasks');
        a.pebblesStart = a.pebblesStart ?? (Number(a.pebbles) || 0);
        a.protectWithModes = a.protectWithModes ?? a.protectsWithModes ?? true;
        a.workingDaysOnly = a.workingDaysOnly ?? (a.id === 'a3');
        a.restDays = Array.isArray(a.restDays) ? a.restDays : [];
        if (a.workingDaysOnly && a.id === 'a3' && a.restDays.join() === '0,6') a.restDays = []; // working-day logic covers weekends now
        fillMissing(a, d);
        await Repo.put('areas', a);
      }
      for (const a of list) if (!Defaults.areas.find(d => d.id === a.id)) {
        fillMissing(a, { order: 10, streakType: 'none', measure: 'tasks', target: 1, restDays: [], pebblesStart: 0, protectWithModes: true, workingDaysOnly: false, paused: false, archived: false, mascot: 'otter', icon: 'ph-circle' });
        await Repo.put('areas', a);
      }
    } },
    { id: 'v5_modes', run: async () => {
      const list = await DB.getAll('modes');
      for (const d of Defaults.modes) {
        const m = list.find(x => x.id === d.id);
        if (!m) await Repo.put('modes', U.clone(d));
        else { fillMissing(m, d); await Repo.put('modes', m); }
      }
      for (const m of list) if (!Defaults.modes.find(d => d.id === m.id)) {
        fillMissing(m, { action: 'none', templateId: '', areaId: '', protectsStreak: false, isMinimum: false, quiet: false, nonWorking: false, icon: 'ph-circle' });
        await Repo.put('modes', m);
      }
    } },
    { id: 'v5_templates', run: async (s) => {
      // Old builds stored ONE template with seven embedded days. Split it into named day
      // templates (keeping every task the user had) plus a week plan that maps weekdays to them.
      const list = await DB.getAll('templates');
      const legacy = list.filter(t => t.days && !t.legacy);
      for (const old of legacy) {
        const dayIds = {};
        for (let dw = 0; dw < 7; dw++) {
          const src = old.days[dw] || old.days[String(dw)];
          const def = Defaults.dayTemplates.find(t => t.id === `tpl_d${dw}`);
          const id = old.id === 'temp_default' ? `tpl_d${dw}` : `${old.id}_d${dw}`;
          const name = old.id === 'temp_default' ? def.name : `${old.name} (${U.DOW3[dw]})`;
          if (!list.find(t => t.id === id)) {
            await Repo.put('templates', { id, kind: 'day', name, modeId: (src && src.modeId) || 'm_normal',
              tasks: ((src && src.tasks) || []).map(t => normalizeTask(U.clone(t))) });
          }
          dayIds[dw] = id;
        }
        const wpId = old.id === 'temp_default' ? 'wp_normal' : `wp_${old.id}`;
        await Repo.put('weekPlan', { id: wpId, name: old.id === 'temp_default' ? 'Normal term' : old.name, days: dayIds });
        old.legacy = true; // kept (not deleted) so nothing is ever lost
        await Repo.put('templates', old);
      }
      const now = await DB.getAll('templates');
      for (const d of Defaults.dayTemplates) if (!now.find(t => t.id === d.id)) await Repo.put('templates', U.clone(d));
      if (!(await Repo.all('weekPlan')).length) await Repo.putMany('weekPlan', U.clone(Defaults.weekPlans));
      if (!s.weekPlanSchedule || !s.weekPlanSchedule.length) s.weekPlanSchedule = [{ from: '2000-01-01', weekPlanId: 'wp_normal' }];
    } },
    { id: 'v5_weekendFix', run: async () => {
      // Stage 1 fix: Saturday had become a copy of Friday evening. Replace the weekend templates
      // and any FUTURE Saturdays/Sundays already created (today and the past are left alone).
      for (const dw of [6, 0]) {
        const tpl = await DB.get('templates', `tpl_d${dw}`);
        if (tpl) { tpl.tasks = Defaults.weekendTasks(dw); tpl.name = dw === 6 ? 'Weekend (Saturday)' : 'Weekend (Sunday)'; await Repo.put('templates', tpl); }
      }
      const today = U.todayStr();
      for (const d of await DB.getAll('dayInstances')) {
        const dw = U.dow(d.date);
        if (d.date > today && (dw === 6 || dw === 0) && !(d.completedTaskIds || []).length) {
          d.tasks = Defaults.weekendTasks(dw);
          d.templateId = `tpl_d${dw}`;
          await DB.put('dayInstances', d);
        }
      }
    } },
    { id: 'v5_days', run: async () => {
      const all = await DB.getAll('dayInstances');
      for (const d of all) {
        d.tasks = (d.tasks || []).map(normalizeTask).sort(U.by(t => t.time));
        d.completedTaskIds = Array.isArray(d.completedTaskIds) ? d.completedTaskIds : [];
        d.modeId = d.modeId || 'm_normal';
        d.planned = true;
      }
      await DB.putMany('dayInstances', all);
    } },
    { id: 'v5_boards', run: async () => {
      const boards = await DB.getAll('boards');
      for (const d of Defaults.boards) {
        const b = boards.find(x => x.id === d.id);
        if (!b) { await Repo.put('boards', U.clone(d)); continue; }
        if (b.trackId) { b.areaId = b.areaId || TRACK_TO_AREA[b.trackId]; delete b.trackId; }
        if (b.id === 'b2' && !b.stageChecklists) {
          const up = (b.stages || []).find(s => U.norm(s.name) === 'upload');
          b.stageChecklists = up ? { [up.id]: U.clone(d.stageChecklists.s7) } : {};
        }
        fillMissing(b, { areaId: d.areaId, projectType: d.projectType, order: d.order, staleDays: d.staleDays, video: !!d.video });
        await Repo.put('boards', b);
      }
      const all = await DB.getAll('boards');
      for (const c of await DB.getAll('cards')) {
        const b = all.find(x => x.id === c.boardId);
        c.areaId = c.areaId ?? (b ? b.areaId : null);
        c.enteredStageAt = c.enteredStageAt || (c.updatedAt || c.createdAt || new Date().toISOString()).slice(0, 10);
        c.nextAction = c.nextAction || ''; c.notes = c.notes || ''; c.due = c.due || '';
        await Repo.put('cards', c);
      }
    } },
    { id: 'v5_logs', run: async () => {
      const today = U.todayStr();
      for (const w of await DB.getAll('wins')) {
        w.title = w.title || w.description || 'Win';
        w.areaId = w.areaId ?? (TRACK_TO_AREA[w.trackId] || null); delete w.trackId;
        w.type = w.type || 'other'; w.date = w.date || today;
        await Repo.put('wins', w);
      }
      for (const q of await DB.getAll('clinicalQuestions')) {
        q.areaId = q.areaId || 'a3'; q.date = q.date || today; q.answered = !!q.answered;
        await Repo.put('clinicalQuestions', q);
      }
      for (const t of await DB.getAll('topics')) {
        const steps = [1, 7, 30, 90];
        t.areaId = t.areaId || 'a4';
        t.reviewOn = t.reviewOn ?? true;
        t.mapStatus = t.mapStatus || 'revised';
        t.step = t.step ?? Math.max(0, steps.indexOf(t.intervalDays || 1));
        t.nextReview = t.nextReview || t.nextReviewDate || today;
        t.reviews = t.reviews || [];
        await Repo.put('topics', t);
      }
      for (const w of await DB.getAll('waitingOn')) {
        w.date = w.date || (w.requestedDate ? U.dateStr(new Date(w.requestedDate)) : today);
        w.followUpDays = w.followUpDays ?? 7; w.who = w.who || ''; w.done = !!w.done;
        await Repo.put('waitingOn', w);
      }
      for (const d of await DB.getAll('deadlines')) { d.areaId = d.areaId ?? null; d.type = d.type || 'other'; await Repo.put('deadlines', d); }
      for (const i of await DB.getAll('inbox')) { i.status = i.status || 'inbox'; i.text = i.text || i.title || ''; await Repo.put('inbox', i); }
    } },
    { id: 'v5_tools', run: seedTools },
    { id: 'v6_settings', run: async (s) => { fillMissing(s, Defaults.settings()); } },
    { id: 'v6_gymRoutine', run: async () => {
      // Your A/B/C routine + cardio. Old starting templates are removed only if never edited.
      const have = await Repo.all('workoutTemplate');
      for (const t of Defaults.workoutTemplates) if (!have.find(x => x.id === t.id)) await Repo.put('workoutTemplate', U.clone(t));
      const sig = (t) => JSON.stringify([t.name, (t.exercises || []).map(e => [e.name, e.muscle, Number(e.sets), Number(e.reps)])]);
      for (const old of Defaults.oldWorkoutTemplates) {
        const cur = have.find(x => x.id === old.id);
        if (cur && sig(cur) === sig(old)) await Repo.del('workoutTemplate', old.id);
      }
      // Weekday gym blocks still carrying a starting name ("Gym", or "Gym (or rest day)" from the first
      // version) get the week plan; renamed ones are your edits and are left alone.
      const today = U.todayStr();
      const upd = (t, dw) => {
        const g = Defaults.gymWeek[dw];
        if (!g || t.tag !== 'gym' || !['gym', 'gym (or rest day)'].includes(U.norm(t.title))) return false;
        t.title = g[0]; t.desc = g[1]; t.workoutTemplateId = g[2]; return true;
      };
      for (const dw of [1, 2, 3, 4, 5]) {
        const tpl = await DB.get('templates', `tpl_d${dw}`);
        if (tpl && tpl.tasks.filter(t => upd(t, dw)).length) await Repo.put('templates', tpl);
      }
      for (const d of await DB.getAll('dayInstances')) {
        if (d.date < today) continue;
        const dw = U.dow(d.date);
        const n = [...d.tasks, ...(d.baseTasks || [])].filter(t => !(d.completedTaskIds || []).includes(t.id) && upd(t, dw)).length;
        if (n) await DB.put('dayInstances', d);
      }
    } },
    { id: 'v6_tags', run: async () => {
      // Sloth icon for downtime blocks; jobs-list button on the ward round. Only untagged tasks change.
      const tagFor = (t) => {
        if (t.tag) return null;
        if (/^(lunch|settle in|dinner|shower|free time|wind down|break)/i.test(String(t.title).trim())) return 'downtime';
        if (/^ward round/i.test(String(t.title).trim())) return 'ward';
        return null;
      };
      const fix = (list) => (list || []).filter(t => { const g = tagFor(t); if (g) t.tag = g; return !!g; }).length;
      for (const tpl of await DB.getAll('templates')) if (!tpl.legacy && fix(tpl.tasks)) await Repo.put('templates', tpl);
      const today = U.todayStr();
      for (const d of await DB.getAll('dayInstances')) if (d.date >= today && fix(d.tasks) + fix(d.baseTasks)) await DB.put('dayInstances', d);
    } },
    { id: 'v6_medtwinsWeekly', run: async () => {
      // MedTwins: weekly streak (videos can't be daily).
      const a = await DB.get('areas', 'a5');
      if (a && a.streakType !== 'weekly') { a.streakType = 'weekly'; a.target = 1; a.measure = 'tasks'; await Repo.put('areas', a); }
    } },
    { id: 'v7_schedule', run: async () => {
      // New week (11 Oct 2026): accelerated German plan + fitness plan.
      await refreshWeekTemplates('pre_2026_10_11', 'before 11 Oct 2026');
      if (!(await DB.get('templates', 'tpl_shortgerman'))) await Repo.put('templates', U.clone(Defaults.dayTemplates.find(t => t.id === 'tpl_shortgerman')));
      if (!(await DB.get('modes', 'm_shortgerman'))) await Repo.put('modes', U.clone(Defaults.modes.find(m => m.id === 'm_shortgerman')));
      // Workout templates: replaced only if they still match the previous starting version exactly.
      const prev = {
        wt_a: ['Train A — Push', 'Bench press', 'Incline bench press', 'Shoulder press', 'Lateral raises', 'Triceps dips / triceps pushdown', 'Abs'],
        wt_b: ['Train B — Pull', 'Lat pulldown / pull-up', 'Chin-up / close-grip pulldown', 'Seated row', 'Biceps curls', 'Deadlift', 'Abs'],
        wt_c: ['Train C — Legs', 'Leg press', 'Lunges', 'Leg extension', 'Leg curls', 'Calf raises'],
        wt_cardio: ['Cardio — run']
      };
      const haveWt = await Repo.all('workoutTemplate');
      for (const t of Defaults.workoutTemplates) {
        const cur = haveWt.find(x => x.id === t.id);
        if (!cur) { await Repo.put('workoutTemplate', U.clone(t)); continue; }
        if (JSON.stringify([cur.name, ...(cur.exercises || []).map(e => e.name)]) === JSON.stringify(prev[t.id])) await Repo.put('workoutTemplate', { ...cur, ...U.clone(t) });
      }
    } },
    // Rotation from 12 Oct 2026: work 9–5 Mon–Thu, Friday for German, research and study.
    // The days of the rotation are then planned in advance by Programme.ensureDays().
    { id: 'v8_rota', run: () => refreshWeekTemplates('pre_2026_10_12', 'before the 9–5 rota') },
    { id: 'v9_youtube', run: async () => {
      // MedTwins blocks on Friday evening and weekend afternoons. Only adds: the block goes into the Friday/
      // weekend templates and into every future day planned from them. Friday's evening free time and food
      // log move to after the block, but only where they still have their starting times.
      const prefix = { 5: 'w5_', 6: 'sat_', 0: 'sun_' };
      const fit = (list, dw, date) => {
        if (!list || list.some(t => t.srcId === `${prefix[dw]}yt`)) return false;
        list.push(Defaults.ytTask(prefix[dw], dw));
        if (dw === 5) {
          const free = list.find(t => t.srcId === 'w5_free2' && t.time === '20:15' && t.endTime === '23:30');
          if (free) free.time = '21:45';
          const food = date && list.find(t => t.srcId === `pg_food_${date}` && t.time === '20:15');
          if (food) { food.time = '21:45'; food.endTime = '21:50'; }
        }
        list.sort(U.by(t => t.time));
        return true;
      };
      for (const dw of [5, 6, 0]) {
        const tpl = await DB.get('templates', `tpl_d${dw}`);
        if (tpl && fit(tpl.tasks, dw)) await Repo.put('templates', tpl);
      }
      const today = U.todayStr();
      for (const d of await DB.getAll('dayInstances')) {
        const dw = U.dow(d.date);
        if (d.date <= today || !prefix[dw] || d.templateId !== `tpl_d${dw}`) continue;
        if (fit(d.baseTasks || d.tasks, dw, d.date)) await DB.put('dayInstances', d);
      }
    } },
    { id: 'v10_goetheFirst', run: async (s) => {
      // The Goethe / grammar homework moves to the start of each German session (fresh brain), in the
      // templates and in today's and future planned days. A block moves only if it still has its planned
      // time and is not ticked, so your own changes stay. Also: Otto's backflip became a happy dance.
      const today = U.todayStr();
      const days = await DB.getAll('dayInstances');
      const german = /_(anki|speak|brk1|write|brk2|res|lingq)$/;
      for (const fresh of Defaults.dayTemplates.filter(t => /^tpl_d\d$/.test(t.id))) {
        const tpl = await DB.get('templates', fresh.id);
        if (!tpl) continue;
        const moves = {};
        for (const nt of fresh.tasks) {
          const ot = german.test(nt.srcId) && tpl.tasks.find(t => t.srcId === nt.srcId);
          if (ot && (ot.time !== nt.time || ot.endTime !== nt.endTime || ot.desc !== nt.desc)) moves[nt.srcId] = { from: [ot.time, ot.endTime], to: nt };
        }
        if (!Object.keys(moves).length) continue;
        const apply = (list, done) => {
          let n = 0;
          for (const t of list || []) {
            const mv = moves[t.srcId];
            if (!mv || done.includes(t.id) || t.time !== mv.from[0] || t.endTime !== mv.from[1]) continue;
            t.time = mv.to.time; t.endTime = mv.to.endTime;
            if (t.srcId.endsWith('_res')) t.desc = mv.to.desc;
            n++;
          }
          if (n) list.sort(U.by(t => t.time));
          return n;
        };
        if (apply(tpl.tasks, [])) await Repo.put('templates', tpl);
        for (const d of days) {
          if (d.date < today || d.templateId !== fresh.id) continue;
          const done = d.completedTaskIds || [];
          if (apply(d.tasks, done) + apply(d.baseTasks, done)) await DB.put('dayInstances', d);
        }
      }
      const swap = { "{streak} days. I'm doing a happy flip!": "{streak} days. I'm doing a happy dance!", "Day complete! I'm doing a backflip.": 'Day complete! Time for a happy splash.' };
      const msgs = s.otter && s.otter.messages;
      if (msgs) for (const k of Object.keys(msgs)) if (Array.isArray(msgs[k])) msgs[k] = msgs[k].map(m => swap[m] || m);
    } }
  ];

  async function run() {
    let s = await DB.get('settings', 'global');
    if (!s) { await seedFresh(); return { fresh: true }; }
    s.migrations = s.migrations || {};
    const report = [];
    for (const step of STEPS) {
      if (s.migrations[step.id]) continue;
      try {
        await step.run(s);
        s.migrations[step.id] = true;
        report.push(step.id);
      } catch (e) {
        console.error(`Migration ${step.id} failed:`, e);
      }
      await DB.put('settings', s); // save after every step so a later failure keeps earlier work
    }
    return { fresh: false, ran: report };
  }

  return { run, normalizeTask, fillMissing };
})();
window.Migrate = Migrate;
