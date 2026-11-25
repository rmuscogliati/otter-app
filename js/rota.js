// ======= rota.js — a dated work rota (your private file holds the dates; this file holds no personal data) =======
// A rota record is { id, kind: 'rota', label, from, until, days: { 'YYYY-MM-DD': code } }.
// Codes: S standard day 08:00–17:00 · L long day 08:00–20:30 · N first night (20:00–24:00) ·
// NN end of one night and start of the next · E last night ends 08:30 · O off.
// Days are planned from the rota; a day you ticked or edited is kept and only gains a note with the shift.

const Rota = {
  CODES: { S: 'Standard day 08:00–17:00', L: 'Long day 08:00–20:30', N: 'Night 20:00–08:30', NN: 'Night (finish 08:30, start again 20:00)', E: 'Night finishes 08:30', O: 'Off' },
  record(date) { return (App.rotas || []).find(r => date >= r.from && date <= r.until) || null; },
  code(date) { const r = Rota.record(date); return r ? (r.days[date] || 'O') : null; },
  isNight(c) { return c === 'N' || c === 'NN' || c === 'E'; },
  // Long days and nights show in the calendar and shift planner.
  shiftFor(date) {
    const c = Rota.code(date);
    if (c === 'L') return { date, modeId: Days.modeById('m_longday') ? 'm_longday' : 'm_normal', label: Rota.CODES.L, source: 'rota' };
    return Rota.isNight(c) ? { date, modeId: 'm_night', label: Rota.CODES[c], source: 'rota' } : null;
  },

  // ---------- lifting sessions: A / B / C keep Mon / Wed / Fri; a lost one moves to a free day that week ----------
  liftFor(date) {
    const mon = U.addDays(date, -((U.dow(date) + 6) % 7));
    const week = [0, 1, 2, 3, 4, 5, 6];
    const free = week.map(i => { const c = Rota.code(U.addDays(mon, i)) || (i < 4 ? 'S' : 'O'); return c === 'O' || (c === 'S' && i !== 1); });
    const at = {}, lost = [];
    for (const w of [{ day: 0, dw: 1 }, { day: 2, dw: 3 }, { day: 4, dw: 5 }]) { if (free[w.day]) at[w.day] = w; else lost.push(w); }
    for (const w of lost) {
      const opts = week.filter(i => free[i] && !at[i] && !(at[i - 1] && at[i + 1]))
        .map(i => ({ i, score: (at[i - 1] ? 3 : 0) + (at[i + 1] ? 3 : 0) + Math.abs(i - w.day) }))
        .sort((a, b) => a.score - b.score || a.i - b.i);
      if (opts[0]) at[opts[0].i] = w;
    }
    const w = at[(U.dow(date) + 6) % 7];
    return w ? w.dw : null; // the weekday whose session this is (1 = A, 3 = B, 5 = C)
  },
  // A Sunday spent at work moves its weekly review and fitness check-in to the next day off (up to 2 days later).
  reviewMoved(date) {
    if (Rota.code(date) !== 'O') return false;
    for (let k = 1; k <= 2; k++) {
      const d = U.addDays(date, -k), c = Rota.code(d);
      if (U.dow(d) === 0) return c === 'L' || Rota.isNight(c);
      if (c === 'O') return false;
    }
    return false;
  },

  // ---------- the plan for one rota day ----------
  tasksFor(date) {
    const c = Rota.code(date), dw = U.dow(date), p = `r${dw}_`;
    const tpl = Days.defaultTemplateFor(date);
    const normal = tpl ? U.clone(tpl.tasks) : [];
    const T = Defaults.task, info = { info: true, tag: 'downtime' };
    const lift = Rota.liftFor(date), gw = lift && Defaults.gymWeek[lift];
    const gym = (a, b) => T(p + 'gym', a, b, gw[0], gw[1], 'a1', { core: true, xp: 30, tag: 'gym', wt: gw[2] });
    const weekend = dw === 0 || dw === 5 || dw === 6;
    const ward = () => [T(p + 'ward', '08:00', '12:00', 'Ward round', 'Write your jobs list after the round', 'a3', { info: true, tag: 'ward' }),
      T(p + 'lunch', '12:00', '13:00', 'Lunch break', '', null, info)];
    let list;
    if (c === 'S' && !weekend) {
      list = normal;
      const w = list.find(t => t.tag === 'ward');
      if (w && w.time === '09:00') w.time = '08:00';
    } else if (c === 'S') {
      list = [...ward(), T(p + 'clin', '13:00', '17:00', 'Clinical work', '', 'a3', { info: true }), T(p + 'travel', '17:00', '17:40', 'Travel home', '', null, info),
        T(p + 'dinner', '19:30', '20:15', 'Dinner and shower', '', null, info), ...Defaults.germanBlock(p, 1, '20:15')];
    } else if (c === 'O' && weekend) {
      list = normal;
    } else if (c === 'O') {
      list = [T(p + 'ready', '09:00', '10:30', 'Get ready and settle in', 'Day off: up at 9:00, nothing planned until 10:30.', null, info), ...Defaults.germanBlock(p, dw, '10:30')];
      let m = U.toMin(list[list.length - 1].endTime);
      const add = (k, mins, ...rest) => { list.push(T(p + k, U.fromMin(m), U.fromMin(m + mins), ...rest)); m += mins; };
      add('lunch', 60, 'Lunch break', '', null, info);
      add('research', 75, 'Research block', 'Next action on an active project (Research tab)', 'a2', { xp: 30 });
      add('study', 60, 'Study block', 'Question bank or topic reviews', 'a4', { xp: 30 });
      if (dw === 2) {
        list.push(gw ? gym('16:15', '17:30') : T(p + 'gym', '16:30', '16:55', 'Easy walk (Tuesday cardio)', '', 'a1', { core: true, xp: 30, tag: 'gym', wt: 'wt_cardio' }),
          ...normal.filter(t => /goethe$/.test(t.srcId)), T(p + 'dinner', '19:30', '20:15', 'Dinner', '', null, info));
      } else {
        list.push(gw ? gym('18:10', '19:30') : T(p + 'rest', '18:10', '19:30', 'Rest', 'No gym today. Ordinary comfortable movement is enough.', null, info),
          T(p + 'dinner', '19:30', '20:15', 'Dinner and shower', '', null, info));
      }
      const moved = Rota.reviewMoved(date);
      if (moved) {
        const sun = Days.templateById('tpl_d0');
        const slots = dw === 2 ? [['sun_review', '20:15', '20:45'], ['sun_fitcheck', '20:45', '21:00']] : [['sun_review', '17:00', '17:30'], ['sun_fitcheck', '17:30', '17:45']];
        for (const [k, a, b] of slots) {
          const t = sun && sun.tasks.find(x => x.srcId === k);
          if (t) list.push({ ...U.clone(t), time: a, endTime: b });
        }
      }
      list.push(T(p + 'free', moved && dw === 2 ? '21:15' : '20:15', '23:30', 'Free time', 'Partner, hobbies, projects', null, info),
        T(p + 'wind', '23:30', '24:00', 'Wind down', 'Prepare for bed (aim for 7–9 h of sleep)', null, { tag: 'downtime' }));
    } else if (c === 'L') {
      const short = Defaults.dayTemplates.find(x => x.id === 'tpl_shortgerman').tasks;
      list = [...ward(), T(p + 'clin', '13:00', '20:30', 'Long day', 'Until 20:30', 'a3', { info: true }), T(p + 'travel', '20:30', '21:10', 'Travel home', '', null, info),
        T(p + 'dinner', '21:10', '21:45', 'Dinner and shower', '', null, info),
        T(p + 'anki', '21:45', '22:15', 'Anki (short)', 'After a long shift: due reviews, up to 30 min', 'a6', { core: true, xp: 15 }),
        ...[['sg_speak', '22:15', '22:25'], ['sg_write', '22:25', '22:35'], ['sg_lingq', '22:35', '22:45']]
          .map(([k, a, b]) => ({ ...U.clone(short.find(x => x.srcId === k)), id: p + k, srcId: p + k, time: a, endTime: b, optional: true })),
        T(p + 'wind', '22:50', '23:30', 'Wind down', 'Long day done: straight to bed if you can', null, { tag: 'downtime' })];
    } else {
      const shift = (k, a, b) => T(p + k, a, b, 'Night shift', 'Look after yourself first', 'a3', { info: true });
      const opt = (k, a, b, title, desc) => T(p + k, a, b, title, desc, 'a6', { optional: true, xp: 10 });
      list = [];
      if (c !== 'N') list.push(shift('nightend', '00:00', '08:30'), T(p + 'home', '08:30', '09:10', 'Travel home', '', null, info));
      if (c === 'N') list.push(T(p + 'ready', '09:30', '11:00', 'Slow morning', 'First night tonight: no rush', null, info));
      if (c === 'N' && dw !== 2) list.push(opt('res', '11:00', '11:35', 'Goethe exercises (if you feel fresh)', ''));
      if (c === 'N') list.push(opt('anki', '11:45', '12:30', 'Anki', 'Due reviews'), T(p + 'lunch', '12:30', '13:30', 'Lunch', '', null, info), T(p + 'nap', '15:00', '17:30', 'Nap before the night', '', null, info));
      if (c === 'NN') list.push(T(p + 'sleep', '09:30', '16:30', 'Sleep', 'Phone on silent, curtains closed', null, info), opt('anki', '17:15', '17:45', 'Anki (short)', 'Only if you feel up to it'));
      if (c === 'E') {
        list.push(T(p + 'sleep', '09:30', '14:00', 'Sleep', 'Short sleep, so you can sleep tonight', null, info), opt('anki', '15:30', '16:00', 'Anki (short)', 'Only if you feel up to it'),
          T(p + 'dinner', '19:00', '20:00', 'Dinner and shower', '', null, info), T(p + 'free', '20:00', '21:30', 'Free time', '', null, info),
          T(p + 'wind', '21:30', '22:30', 'Wind down', 'Early night to reset', null, { tag: 'downtime' }));
      } else {
        list.push(T(p + 'dinner', '18:00', '19:00', 'Dinner', '', null, info), T(p + 'go', '19:20', '20:00', 'Travel to work', '', null, info), shift('night', '20:00', '24:00'));
      }
    }
    // Lifting follows the week's plan on ordinary evenings, Fridays and weekends.
    if (gw && (c === 'S' || (c === 'O' && weekend))) {
      const cur = list.find(t => t.tag === 'gym' && !t.optional);
      if (!cur || cur.workoutTemplateId !== gw[2]) {
        list = list.filter(t => t !== cur && !/_rest$/.test(t.srcId));
        list.push(dw === 6 ? gym('18:50', '20:00') : dw === 0 ? gym('16:05', '17:10') : gym('18:10', '19:30'));
      }
    }
    if (dw === 2 && (c === 'L' || c === 'N' || c === 'NN')) list.push(T(p + 'clash', '18:00', '18:05', 'Goethe lesson clashes with your shift', 'Ask about a catch-up (18:00–19:30)', 'a6', { info: true }));
    return list.sort(U.by(t => t.time));
  },
  // Changes when the shift, or the week's lifting around it, changes.
  sig(date) { return `${Rota.code(date)}|${Rota.liftFor(date) || ''}|${Rota.reviewMoved(date) ? 'r' : ''}`; },
  stamp(day) { day.rota = Rota.sig(day.date); day.modeId = (Rota.shiftFor(day.date) || {}).modeId || 'm_normal'; return day; },

  // Plans every day of the rota from today on. Safe to run at every start.
  async apply() {
    const today = U.todayStr();
    const out = { made: 0, kept: 0 };
    for (const r of App.rotas || []) {
      for (let d = r.from > today ? r.from : today; d <= r.until; d = U.addDays(d, 1)) {
        const day = await Days.get(d), s = Rota.sig(d);
        if (day && day.rota === s) continue;
        if (day && (day.updatedAt || (day.completedTaskIds || []).length)) {
          // Your own version of this day stays; it only gains (or updates) a note with the shift.
          const id = `rota_note_${d}`;
          const note = { id, srcId: id, time: '07:00', endTime: '07:05', title: `Rota: ${Rota.CODES[Rota.code(d)]}`, desc: 'You had already changed this day, so its plan was kept.', areaId: null, core: false, optional: false, infoOnly: true, xp: 0, tag: '' };
          day.tasks = [note, ...day.tasks.filter(t => t.id !== id)].sort(U.by(t => t.time));
          day.rota = s;
          await DB.put('dayInstances', day);
          out.kept++;
          continue;
        }
        if (day) await DB.delete('dayInstances', d);
        await Days.create(d, 'default');
        out.made++;
      }
    }
    return out;
  },

  // ---------- screen: see the rota, and change a day after a swap ----------
  render() {
    const today = U.todayStr();
    const r = (App.rotas || []).filter(x => x.until >= today).sort(U.by(x => x.from))[0];
    if (!r) return `${UI.header('Rota')}${UI.empty('No rota yet. Add your private file under More.', 'ph-calendar-dots')}`;
    const dates = [];
    for (let d = r.from > today ? r.from : today; d <= r.until; d = U.addDays(d, 1)) dates.push(d);
    const icon = (c) => Rota.isNight(c) ? 'ph-moon' : c === 'L' ? 'ph-clock' : c === 'S' ? 'ph-sun' : 'ph-umbrella';
    const rows = dates.map(d => {
      const c = Rota.code(d);
      const head = U.dow(d) === 1 || d === dates[0] ? `<div class="section-title">Week of ${U.fmtDate(U.addDays(d, -((U.dow(d) + 6) % 7)))}</div>` : '';
      return `${head}${UI.row({ icon: icon(c), title: `${U.fmtDate(d)} · ${Rota.CODES[c]}`, cls: 'card', act: 'day', data: { date: d } })}`;
    }).join('');
    return `${UI.header('Rota')}<p class="muted small" style="margin:0 4px 10px">${U.fmtDate(r.from, { year: true })} to ${U.fmtDate(r.until, { year: true })}. Swapped a shift? Tap the day to change it.</p>${rows}`;
  },
  actions() {
    return {
      day: async (el) => {
        const d = el.dataset.date, r = Rota.record(d);
        const v = await UI.choose(U.fmtDate(d, { year: true }), Object.entries(Rota.CODES).map(([value, label]) => ({ value, label, icon: value === Rota.code(d) ? 'ph-check-circle' : 'ph-circle' })),
          { text: 'Changes this day only. For a night, also set the next day (it finishes at 08:30).' });
        if (!v || v === Rota.code(d)) return;
        r.days[d] = v;
        await Repo.put('rota', r);
        await App.loadCore();
        await Rota.apply();
        await App.changed({ celebrate: false });
      }
    };
  }
};
window.Rota = Rota;
Nav.register('rota', { tab: 'plan', render: () => Rota.render(), actions: () => Rota.actions() });
