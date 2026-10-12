// ======= otter.js — Otto (and friends): messages, moods, celebrations, unlockables =======

const Otto = {
  name() { return App.settings.otterName || 'Otto'; },
  show() { return App.settings.showMascots !== false; },

  // Fill {placeholders} in a message.
  fill(msg, vars) { return String(msg).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); },
  pick(list, seed) {
    if (!list || !list.length) return '';
    return list[Math.abs(seed) % list.length];
  },
  daySeed() { const t = U.todayStr(); return Number(t.replace(/-/g, '')) + new Date().getHours(); },

  // Context-aware mood + message for the Today screen.
  async context(day) {
    const s = App.settings, st = App.streaks;
    const msgs = (s.otter && s.otter.messages) || Defaults.otterMessages;
    const mode = Days.modeById(day.modeId);
    const p = Streaks.dayProgress(day);
    const hour = new Date().getHours();
    const isToday = day.date === U.todayStr();
    const vars = { name: Otto.name(), streak: st ? st.overall.current : 0 };
    let state = 'idle', key = 'normal';
    const yesterday = st && st.overall.statuses[U.addDays(U.todayStr(), -1)];
    const energy = isToday ? await Repo.get('energy', `en_${day.date}`) : null;
    if (p.met && isToday) { state = 'celebrate'; key = 'complete'; }
    else if (mode && mode.protectsStreak && mode.quiet) { state = 'night'; key = 'night'; }
    else if (mode && mode.isMinimum) { state = 'sleepy'; key = 'minimum'; }
    else if (energy && energy.value <= 2) { state = 'tired'; key = 'lowEnergy'; }
    else if (isToday && yesterday === 'pebble' && s.pebbleNoticeFor !== U.todayStr()) { state = 'idle'; key = 'pebble'; }
    else if (isToday && hour >= 20 && p.pending.length) { state = 'hopeful'; key = 'atRisk'; vars.task = p.pending[0].title; }
    else if (isToday && hour < 11) { key = 'morning'; }
    else if (vars.streak >= 3) { key = 'streak'; }
    // Nothing happening (a lunch, dinner or free-time block right now): Otto floats on his back.
    const nowM = U.nowMin();
    if (state === 'idle' && isToday && day.tasks.some(t => (t.tag === 'downtime' || (t.infoOnly && !t.areaId)) && U.toMin(t.time) <= nowM && nowM < U.toMin(t.endTime))) state = 'float';
    // Upcoming deadline wins over plain messages.
    if (['normal', 'morning', 'streak'].includes(key)) {
      const dl = (App.cache.deadlinesSoon || [])[0];
      if (dl && U.diffDays(U.todayStr(), dl.date) <= 3) { key = 'deadline'; vars.deadline = dl.title; vars.days = U.relDay(dl.date); }
    }
    let text = s.otter && s.otter.messagesOn === false ? '' : Otto.fill(Otto.pick(msgs[key] || msgs.normal, Otto.daySeed()), vars);
    const acc = [...((s.otter && s.otter.equipped) || [])];
    if (key === 'pebble') acc.push('pebble');
    return { state, text, acc, key };
  },

  // A single place to draw Otto anywhere.
  html(state = 'idle', size = 120, extraAcc = []) {
    if (!Otto.show()) return '';
    const acc = [...new Set([...((App.settings.otter && App.settings.otter.equipped) || []), ...extraAcc])];
    const pebbles = App.streaks ? App.streaks.overall.pebbles : 0;
    return Mascot.svg('otter', { state, size, acc, pebbles, title: Otto.name() });
  },

  // Briefly show Otto holding the area's prop, then a cheer (Today screen).
  react(areaId, done) {
    const host = document.querySelector('.hero-otter');
    if (!host || !Otto.show()) return;
    const props = done ? (Mascot.AREA_PROPS[areaId] || []) : [];
    host.innerHTML = Otto.html(done ? 'celebrate' : 'idle', host.dataset.size ? Number(host.dataset.size) : 118, props);
  },

  // ---- area mascots ----
  areaMessage(area, res) {
    const m = area.messages || Defaults.areaMessages;
    const vars = { streak: res ? res.current : 0, area: area.name, task: '' };
    let key = 'going';
    if (!res || res.paused) key = 'rest';
    else if (res.todayKind === 'rest' || res.todayKind === 'protected' || res.todayKind === 'holiday') key = 'rest';
    else if (!res.needs) key = 'met';
    else if (res.current === 0) key = 'zero';
    else if (new Date().getHours() >= 19) key = 'atRisk';
    return { key, text: Otto.fill(Otto.pick(m[key] || Defaults.areaMessages[key], Otto.daySeed() + area.id.length), vars) };
  },
  areaState(key) { return { met: 'celebrate', rest: 'sleepy', atRisk: 'hopeful', zero: 'idle', going: 'idle' }[key] || 'idle'; },

  // ---- celebrations ----
  confetti(host) {
    if (document.body.classList.contains('anim-off') || document.body.classList.contains('anim-reduced')) return '';
    const colors = ['#FFD43B', '#FF8787', '#74C0FC', '#B197FC', '#69DB7C', '#FFA94D'];
    let html = '';
    for (let i = 0; i < 36; i++) {
      html += `<i class="confetti" style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.8).toFixed(2)}s;animation-duration:${(1.8 + Math.random() * 1.4).toFixed(2)}s;transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`;
    }
    return html;
  },
  celebrate({ title, sub = '', kind = 'otter', acc = [], button = 'Keep going', big = true }) {
    return new Promise(resolve => {
      const host = document.getElementById('celebrate-host');
      host.innerHTML = `<div class="celebrate ${big ? 'big' : ''}" role="dialog" aria-label="${U.esc(title)}">
        <div class="confetti-wrap">${Otto.confetti()}</div>
        <div class="celebrate-card">
          ${Otto.show() ? Mascot.svg(kind, { state: 'big', size: 180, acc: kind === 'otter' ? [...((App.settings.otter && App.settings.otter.equipped) || []), ...acc] : acc }) : ''}
          <h2>${U.esc(title)}</h2>${sub ? `<p>${U.esc(sub)}</p>` : ''}
          <button class="btn btn-primary btn-block" data-close>${U.esc(button)}</button>
        </div></div>`;
      U.vibrate([30, 40, 30]);
      host.querySelector('[data-close]').onclick = () => { host.innerHTML = ''; resolve(); };
    });
  },
  async dayComplete() {
    await Otto.celebrate({ title: 'Day complete!', sub: `${Otto.name()} is doing a happy dance. Proud of you!`, big: false, button: 'Yay!' });
  },
  async milestones() {
    const pend = Streaks.pendingMilestones();
    if (!pend.list || !pend.list.length) return;
    for (const m of pend.list) {
      const area = m.areaId ? App.areaById(m.areaId) : null;
      await Otto.celebrate({
        title: `${m.m}-${area && area.streakType === 'weekly' ? 'week' : 'day'} streak!`,
        sub: area ? `${area.name}: ${Mascot.KINDS[area.mascot] ? Mascot.KINDS[area.mascot].name : ''} is throwing a party.` : `${Otto.name()} is so proud of you.`,
        kind: area ? (area.mascot || 'otter') : 'otter'
      });
    }
    pend.all.forEach(o => { App.settings.milestonesShown[o.key] = true; });
    await App.saveSettings();
  },

  // ---- unlockable outfits ----
  UNLOCKS: [
    { id: 'scarf', name: 'German flag scarf', how: '30-day German streak', test: c => c.longest.a6 >= 30 },
    { id: 'gradcap', name: 'Graduation cap', how: '20 topic reviews', test: c => c.topicReviews >= 20 },
    { id: 'clapper', name: 'Clapperboard', how: 'A published video in the Wins log', test: c => c.wins.video >= 1 },
    { id: 'labcoat', name: 'Lab coat', how: 'A research paper submitted (Wins log)', test: c => c.wins.paperSubmitted >= 1 || c.wins.paperAccepted >= 1 },
    { id: 'goggles', name: 'Lab goggles', how: '3 research projects started', test: c => c.projects >= 3 },
    { id: 'stethoscope', name: 'Stethoscope', how: '10 clinical questions answered', test: c => c.cqAnswered >= 10 },
    { id: 'headband', name: 'Gym headband', how: '20 workouts logged', test: c => c.workouts >= 20 },
    { id: 'glasses', name: 'Reading glasses', how: '10 papers summarised', test: c => c.summarised >= 10 },
    { id: 'sunglasses', name: 'Cool sunglasses', how: 'Earn 1,000 XP', test: c => c.xp >= 1000 },
    { id: 'partyhat', name: 'Party hat', how: 'A 7-day overall streak', test: c => c.longest.overall >= 7 },
    { id: 'medal', name: 'Gold medal', how: 'A 100-day overall streak', test: c => c.longest.overall >= 100 },
    { id: 'nightcap', name: 'Night cap', how: 'Earn 2,500 XP', test: c => c.xp >= 2500 }
  ],
  async unlockCounts() {
    const [wins, topics, cqs, workouts, reading, cards] = await Promise.all([DB.getAll('wins'), DB.getAll('topics'), DB.getAll('clinicalQuestions'),
      Repo.all('workout'), Repo.all('reading'), DB.getAll('cards')]);
    const st = App.streaks || { overall: { longest: 0 }, areas: {}, xp: { total: 0 } };
    const longest = { overall: st.overall.longest };
    Object.entries(st.areas).forEach(([id, r]) => { longest[id] = r.longest; });
    return {
      longest, xp: st.xp.total,
      topicReviews: U.sum(topics, t => (t.reviews || []).length),
      wins: { video: wins.filter(w => w.type === 'video').length, paperSubmitted: wins.filter(w => w.type === 'paperSubmitted').length, paperAccepted: wins.filter(w => w.type === 'paperAccepted').length },
      cqAnswered: cqs.filter(q => q.answered).length,
      workouts: workouts.length,
      summarised: reading.filter(r => r.status === 'summarised').length,
      projects: cards.filter(c => c.ideaId).length
    };
  },
  async unlocked() {
    const c = await Otto.unlockCounts();
    return Otto.UNLOCKS.map(u => ({ ...u, open: !!u.test(c) }));
  }
};
window.Otto = Otto;
