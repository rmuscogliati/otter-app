// ======= programme.js — a dated plan that runs for a fixed period (e.g. one rotation) =======
// Every day in the period is planned in advance from the week's templates, and the date-dependent parts
// are added on creation: cardio minutes that step up every two weeks, the food log and weigh-in, the
// two-weekly reviews and the end-of-rotation reminder. Days you already planned or edited are never touched.

const Programme = {
  // Current rotation: work 9–5 Mon–Thu, German plan + fitness plan, until the next rotation starts.
  list: [{ id: 'rot_2026_10', name: 'Current rotation', from: '2026-10-12', until: '2026-12-03', next: 'your next rotation' }],
  // Cardio minutes per two-week stage: [Tuesday, Saturday, Sunday]. Longer-term target 45 / 45 / 60.
  STAGES: [[25, 25, 30], [30, 30, 35], [35, 35, 40], [40, 40, 45], [45, 45, 60]],

  active(date) { return Programme.list.find(p => date >= p.from && date <= p.until) || null; },
  week(p, date) { return Math.floor(U.diffDays(p.from, date) / 7) + 1; },

  // Runs from Days.createHooks for every new day inside the period.
  extras(day) {
    const code = window.Rota && day.rota ? Rota.code(day.date) : null; // on a rota the fitness plan carries on
    const p = Programme.active(day.date) || (code ? Programme.list[0] : null);
    if (!p) return;
    const dw = U.dow(day.date), wk = Programme.week(p, day.date);
    const stageNo = Math.min(Programme.STAGES.length - 1, Math.floor((wk - 1) / 2));
    const st = Programme.STAGES[stageNo];
    const id = (k) => `pg_${k}_${day.date}`;
    const add = (k, time, end, title, desc, areaId, o = {}) => {
      if (day.tasks.some(t => t.id === id(k))) return;
      day.tasks.push({ id: id(k), srcId: id(k), time, endTime: end, title, desc, areaId, core: false, optional: !!o.optional, infoOnly: false, xp: o.xp ?? 5, tag: o.tag || '' });
    };
    // Cardio: minutes for this stage (weeks 1–2, 3–4, …).
    for (const t of day.tasks.filter(t => t.tag === 'gym' && t.workoutTemplateId === 'wt_cardio')) {
      const mins = dw === 0 ? st[2] : st[0];
      t.title = `${t.title.replace(/ — \d+ min$/, '')} — ${mins} min`;
      t.endTime = U.fromMin(Math.min(24 * 60, U.toMin(t.time) + mins));
      for (const f of day.tasks) if (f.infoOnly && f.time > t.time && f.time < t.endTime && f.endTime > t.endTime) f.time = t.endTime; // free time starts after it
      t.desc = `Weeks ${stageNo * 2 + 1}${stageNo === Programme.STAGES.length - 1 ? ' onwards' : `–${stageNo * 2 + 2}`} stage: ${st[0]} / ${st[1]} / ${st[2]} min (Tue / Sat / Sun). Easy, effort 3–4/10, full sentences possible; include an easy start and finish. Stay at a stage longer if recovery needs it.`
        + (dw === 0 && wk >= 5 ? ' Optional now (after 4 consistent weeks): 8 min warm-up, 4 × (1 min at 7/10 + 2 min easy), 5 min cool-down. No all-out efforts; skip if your legs need an easy day.' : '');
    }
    // Every day: weigh-in (morning) and food log (evening), both optional.
    const weekend = dw === 0 || dw === 6, night = !!code && Rota.isNight(code), early = code === 'S' || code === 'L';
    const lateStart = code ? code === 'O' : weekend || dw === 5; // up at 9:00 on days off
    if (!night) add('weigh', lateStart ? '09:30' : early ? '06:50' : '08:00', lateStart ? '09:35' : early ? '06:55' : '08:05', 'Morning weigh-in + steps',
      'After the toilet, before food (3–7 times a week; compare 7-day averages). Note yesterday\'s steps: aim first for an 8,000 weekly average, then 8,500–9,000.', 'a1', { optional: true });
    const firstTwo = wk <= 2;
    const foodAt = code === 'L' ? '22:45' : dw === 5 ? '21:45' : weekend || code === 'O' ? '21:00' : '23:00';
    if (!night) add('food', foodAt, U.fromMin(U.toMin(foodAt) + 5), 'Food log',
      (firstTwo ? 'Weeks 1–2: log what you normally eat and drink, without changing anything yet (include drinks and weekends). ' : 'Log food and drinks, including weekends. ')
      + 'Protein 1.6–2.0 g/kg/day over 3–4 meals; about 30 g fibre; protein + vegetables/fruit + carbohydrate at main meals; measure oils, sauces and snacks; don\'t eat back watch calories.', 'a1', { optional: true });
    // Sundays at the end of each two-week block: the fortnightly reviews.
    const check = day.tasks.find(t => t.srcId === 'sun_fitcheck');
    const fortnight = check && Programme.week(p, U.addDays(day.date, -dw)) % 2 === 0; // dw > 0 when a rota moved it
    if (fortnight && check) {
      check.title = 'Fitness check-in + 2-week review';
      check.endTime = U.fromMin(U.toMin(check.time) + 30);
      if (wk === 2) check.desc = 'Set your calorie target from the last 2 weeks of logging: if your weight was stable, eat 250–350 kcal/day less than your logged average; if you are already losing about 0.25–0.5% a week, keep intake steady. ' + check.desc;
      if (wk < Programme.STAGES.length * 2 - 1) check.desc += ' Next week the cardio stage steps up: repeat this stage instead if recovery is not good.';
    }
    const after = check ? U.toMin(check.endTime) : 20 * 60;
    if (dw === 0 && wk === 2) add('germanreview', U.fromMin(after), U.fromMin(after + 15), 'Review the German plan', 'Two weeks in: is it crowding out sleep or recovery? Adjust the plan if needed.', 'a6', { xp: 10 });
    // Last day of the period: hand over to the next rotation.
    const ends = code ? Rota.record(day.date).until : p.until;
    if (day.date === ends) add('handover', code === 'L' ? '21:10' : '17:40', code === 'L' ? '21:25' : '17:55', `Rotation ends: plan for ${p.next}`, `Send the rota and schedule for ${p.next} so the plan from ${U.fmtDate(U.addDays(ends, 1))} can be set up.`, null, { xp: 10 });
    day.tasks.sort(U.by(t => t.time));
  },

  // Plans every day from today (or the start) to the end of each period, once per day.
  async ensureDays() {
    const today = U.todayStr();
    let made = 0;
    for (const p of Programme.list) {
      if (p.until < today) continue;
      for (let d = p.from > today ? p.from : today; d <= p.until; d = U.addDays(d, 1)) {
        if (await Days.get(d)) continue;
        await Days.create(d, 'default');
        made++;
      }
    }
    return made;
  }
};
window.Programme = Programme;
Days.createHooks.push((day) => Programme.extras(day));
