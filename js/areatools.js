// ======= areatools.js — Clinical work, Medical study, MedTwins and German tools =======

// Small helper for simple "list of records" screens (add / edit / delete with a form).
const Simple = {
  async edit(kind, rec, fields, { title, defaults = {}, after } = {}) {
    const f = await UI.form(rec ? `Edit ${title}` : `New ${title}`, fields(rec || {}), { buttons: rec ? [{ label: 'Delete', value: 'del', danger: true }] : [] });
    if (!f) return null;
    if (f._button === 'del') { if (!(await UI.confirm(`Delete this ${title}?`, { ok: 'Delete', danger: true }))) return null; await Repo.del(kind, rec.id); }
    else { const obj = await Repo.put(kind, { ...(rec || { id: U.uid(kind.slice(0, 3)), ...defaults }), ...f }); if (after) await after(obj, rec); }
    await App.changed({ celebrate: false });
    return f;
  }
};

const Clinical = {
  ROLES: ['Observed', 'Assisted', 'Performed (supervised)', 'Performed (independent)', 'Supervised others'],
  categories() { return (App.settings.clinical && App.settings.clinical.caseCategories) || ['Spinal procedure', 'Orthopaedic procedure', 'Ward procedure', 'Clinic', 'Emergency / on-call', 'Teaching case', 'Other']; },

  // ---------- case / procedure log ----------
  async renderCases({ cat = '' } = {}) {
    const all = (await Repo.all('case')).sort(U.by(c => c.date)).reverse();
    const list = all.filter(c => !cat || c.category === cat);
    const counts = {};
    all.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
    return `${UI.header('Case / procedure log', { right: '<button class="icon-btn" data-act="add" aria-label="Log a case"><i class="ph ph-plus"></i></button>' })}
      ${Logs.PID_NOTE}
      <div class="card"><h3>Counts by category (${all.length} total)</h3><div class="bars" style="margin-top:8px">
        ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<button class="bar-row" data-act="cat" data-v="${U.esc(k)}" style="text-align:left"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(k)}</span>
          <span class="track"><span class="fill" style="width:${Math.round(100 * n / Math.max(...Object.values(counts)))}%;background:#0CA678"></span></span><span>${n}</span></button>`).join('') || '<p class="muted small">No cases yet.</p>'}</div>
        ${cat ? `<button class="btn btn-small btn-ghost" data-act="cat" data-v="" style="margin-top:8px">Show all categories</button>` : ''}</div>
      ${list.map(c => UI.row({ icon: 'ph-first-aid-kit', color: '#0CA678', cls: 'card', title: U.esc(c.title), sub: `${U.fmtDate(c.date, { year: true })} · ${U.esc(c.category)} · ${U.esc(c.role || '')}`, act: 'edit', data: { id: c.id } })).join('')
        || UI.empty('Nothing logged here yet.', 'ph-first-aid-kit')}
      <button class="btn btn-ghost btn-block" data-act="cats"><i class="ph ph-tag"></i> Edit categories</button>`;
  },
  casesActions(p = {}) {
    const fields = (c) => [
      { name: 'title', label: 'Procedure / case type (no identifiers)', value: c.title || '', required: true, placeholder: 'e.g. Lumbar microdiscectomy' },
      { name: 'date', type: 'date', label: 'Date', value: c.date || U.todayStr(), required: true },
      { name: 'category', type: 'select', label: 'Category', value: c.category || Clinical.categories()[0], options: Clinical.categories().map(x => ({ value: x, label: x })) },
      { name: 'role', type: 'select', label: 'My role', value: c.role || Clinical.ROLES[1], options: Clinical.ROLES.map(x => ({ value: x, label: x })) },
      { name: 'notes', type: 'textarea', label: 'Learning points (no identifiers)', value: c.notes || '', rows: 3 }];
    const edit = (c) => Simple.edit('case', c, fields, { title: 'case' });
    return {
      add: () => edit(null),
      edit: async (el) => edit(await Repo.get('case', el.dataset.id)),
      cat: (el) => Nav.go('cases', { cat: el.dataset.v }, { replace: true }),
      cats: async () => {
        const f = await UI.form('Case categories', [{ name: 'c', type: 'textarea', label: 'One per line', value: Clinical.categories().join('\n'), rows: 8, required: true }]);
        if (!f) return;
        App.settings.clinical = { ...(App.settings.clinical || {}), caseCategories: f.c.split('\n').map(x => x.trim()).filter(Boolean) };
        await App.saveSettings(); await App.changed({ celebrate: false });
      }
    };
  },

  // ---------- portfolio tracker ----------
  async renderPortfolio() {
    const list = await Repo.all('portfolioTarget');
    const dl = (App.settings.clinical || {}).portfolioDeadline || '';
    return `${UI.header('Portfolio tracker', { right: '<button class="icon-btn" data-act="add" aria-label="Add target"><i class="ph ph-plus"></i></button>' })}
      <div class="card"><div class="cal-head"><h3>Deadline</h3><button class="btn btn-small btn-ghost" data-act="deadline">${dl ? `${U.fmtDate(dl, { year: true })} (${U.relDay(dl)})` : 'Set a deadline'}</button></div>
        <p class="muted small">Overall: ${U.sum(list, x => Math.min(x.done, x.target))} of ${U.sum(list, x => x.target)} done</p>${UI.progress(U.sum(list, x => Math.min(x.done, x.target)), U.sum(list, x => x.target), '#0CA678')}</div>
      ${list.map(t => `<div class="card"><div class="cal-head"><div><b>${U.esc(t.name)}</b><div class="muted tiny">${t.done} of ${t.target}${t.deadline ? ` · due ${U.fmtDate(t.deadline)}` : ''}</div></div>
        <div style="display:flex;gap:4px"><button class="icon-btn" data-act="dec" data-id="${t.id}" aria-label="Minus one"><i class="ph ph-minus"></i></button>
        <button class="icon-btn" data-act="inc" data-id="${t.id}" aria-label="Plus one"><i class="ph ph-plus"></i></button>
        <button class="icon-btn" data-act="edit" data-id="${t.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div></div>
        ${UI.progress(t.done, t.target, t.done >= t.target ? 'var(--good)' : '#0CA678')}</div>`).join('') || UI.empty('No targets yet.', 'ph-folders')}`;
  },
  portfolioActions() {
    const bump = async (id, d) => { const t = await Repo.get('portfolioTarget', id); t.done = Math.max(0, (Number(t.done) || 0) + d); await Repo.put('portfolioTarget', t); if (d > 0) UI.toast(`${t.name}: ${t.done} of ${t.target}`, 'ph-folders'); await App.changed({ celebrate: false }); };
    const fields = (t) => [{ name: 'name', label: 'What', value: t.name || '', required: true, placeholder: 'e.g. Case-based discussions' },
      { name: 'target', type: 'number', label: 'Target', value: t.target || 4, min: 1 }, { name: 'done', type: 'number', label: 'Done so far', value: t.done || 0, min: 0 },
      { name: 'deadline', type: 'date', label: 'Own deadline (optional)', value: t.deadline || '' }];
    return {
      inc: (el) => bump(el.dataset.id, 1), dec: (el) => bump(el.dataset.id, -1),
      add: () => Simple.edit('portfolioTarget', null, fields, { title: 'target' }),
      edit: async (el) => Simple.edit('portfolioTarget', await Repo.get('portfolioTarget', el.dataset.id), fields, { title: 'target' }),
      deadline: async () => {
        const f = await UI.form('Portfolio deadline', [{ name: 'd', type: 'date', label: 'Date (e.g. ARCP)', value: (App.settings.clinical || {}).portfolioDeadline || '' }]);
        if (!f) return;
        App.settings.clinical = { ...(App.settings.clinical || {}), portfolioDeadline: f.d };
        await App.saveSettings(); await App.changed({ celebrate: false });
      }
    };
  },

  // ---------- certificates & mandatory training ----------
  async renderCerts() {
    const list = (await Repo.all('cert')).sort(U.by(c => c.expires || '9999'));
    const today = U.todayStr();
    return `${UI.header('Certificates & training', { right: '<button class="icon-btn" data-act="add" aria-label="Add"><i class="ph ph-plus"></i></button>' })}
      <p class="muted small" style="margin-bottom:10px">In-app reminders appear on Today 30 and 7 days before expiry.</p>
      ${list.map(c => { const n = c.expires ? U.diffDays(today, c.expires) : null;
        return UI.row({ icon: 'ph-certificate', color: '#0CA678', cls: 'card', title: U.esc(c.name), sub: c.expires ? `Expires ${U.fmtDate(c.expires, { year: true })}` : 'No expiry date', act: 'edit', data: { id: c.id },
          right: n == null ? '' : `<span class="tag ${n < 0 ? 'bad' : n <= 7 ? 'bad' : n <= 30 ? 'warn' : 'good'}">${n < 0 ? 'expired' : `${n}d`}</span>` }); }).join('') || UI.empty('Nothing tracked yet (BLS, ALS, safeguarding, information governance…).', 'ph-certificate')}`;
  },
  certsActions() {
    const fields = (c) => [{ name: 'name', label: 'Certificate / training', value: c.name || '', required: true }, { name: 'done', type: 'date', label: 'Completed on', value: c.done || '' },
      { name: 'expires', type: 'date', label: 'Expires on', value: c.expires || '' }, { name: 'notes', type: 'textarea', label: 'Notes / where to renew', value: c.notes || '', rows: 2 }];
    return { add: () => Simple.edit('cert', null, fields, { title: 'certificate' }), edit: async (el) => Simple.edit('cert', await Repo.get('cert', el.dataset.id), fields, { title: 'certificate' }) };
  },

  // ---------- courses, study leave, teaching ----------
  CPD: { course: ['Course', 'ph-certificate'], leave: ['Study leave', 'ph-airplane-tilt'], teaching: ['Teaching delivered', 'ph-chalkboard-teacher'] },
  async renderCPD({ type = '' } = {}) {
    const all = (await Repo.all('cpd')).sort(U.by(c => c.date)).reverse();
    const list = all.filter(c => !type || c.type === type);
    return `${UI.header('Courses, leave & teaching', { right: '<button class="icon-btn" data-act="add" aria-label="Add"><i class="ph ph-plus"></i></button>' })}
      <div class="chips" style="margin-bottom:8px"><button class="chip ${!type ? 'on' : ''}" data-act="type" data-v="">All (${all.length})</button>
        ${Object.entries(Clinical.CPD).map(([k, [l]]) => `<button class="chip ${type === k ? 'on' : ''}" data-act="type" data-v="${k}">${l} (${all.filter(c => c.type === k).length})</button>`).join('')}</div>
      <p class="muted small" style="margin:0 4px 8px">Total: ${U.sum(list, c => c.hours)} hours · ${U.sum(list.filter(c => c.type === 'leave'), c => c.days)} study-leave days</p>
      ${list.map(c => UI.row({ icon: (Clinical.CPD[c.type] || Clinical.CPD.course)[1], color: '#0CA678', cls: 'card', title: U.esc(c.title),
        sub: `${U.fmtDate(c.date, { year: true })} · ${(Clinical.CPD[c.type] || [''])[0]}${c.hours ? ` · ${c.hours} h` : ''}${c.days ? ` · ${c.days} days` : ''}`, act: 'edit', data: { id: c.id } })).join('') || UI.empty('Nothing logged yet.', 'ph-chalkboard-teacher')}
      <button class="btn btn-ghost btn-block" data-act="export"><i class="ph ph-export"></i> Export as text</button>`;
  },
  cpdActions(p = {}) {
    const fields = (c) => [{ name: 'type', type: 'select', label: 'Type', value: c.type || 'course', options: Object.entries(Clinical.CPD).map(([v, [l]]) => ({ value: v, label: l })) },
      { name: 'title', label: 'Title', value: c.title || '', required: true }, { name: 'date', type: 'date', label: 'Date', value: c.date || U.todayStr(), required: true },
      { name: 'hours', type: 'number', label: 'CPD hours', value: c.hours || '', min: 0, step: 0.5 }, { name: 'days', type: 'number', label: 'Study-leave days (if any)', value: c.days || '', min: 0, step: 0.5 },
      { name: 'notes', type: 'textarea', label: 'Notes / feedback', value: c.notes || '', rows: 2 }];
    return {
      type: (el) => Nav.go('cpd', { type: el.dataset.v }, { replace: true }),
      add: () => Simple.edit('cpd', null, fields, { title: 'entry' }),
      edit: async (el) => Simple.edit('cpd', await Repo.get('cpd', el.dataset.id), fields, { title: 'entry' }),
      export: async () => {
        const all = (await Repo.all('cpd')).sort(U.by(c => c.date));
        Logs.exportText('Courses, leave & teaching', ['Courses, study leave and teaching', '', ...all.map(c => `• ${U.fmtDate(c.date, { year: true, dow: false })} — ${(Clinical.CPD[c.type] || [''])[0]}: ${c.title}${c.hours ? ` (${c.hours} h)` : ''}${c.days ? ` (${c.days} days)` : ''}`)].join('\n'), 'cpd');
      }
    };
  }
};
window.Clinical = Clinical;

const Study = {
  // ---------- question banks & study log (Osmosis, Passmed, PasTest, Quesmed, eMRCS, flashcards, practice…) ----------
  resources() { return (App.settings.study && App.settings.study.resources) || Defaults.studyResources; },
  async sessions() { return (await Repo.all('studySession')).sort(U.by(s => `${s.date}${s.createdAt || ''}`)).reverse(); },
  async renderQbank({ res = '' } = {}) {
    const all = await Study.sessions();
    const topics = (await DB.getAll('topics')).sort(U.by(t => t.title.toLowerCase()));
    const weak = Number(App.settings.study.weakPct) || 60;
    const ws = U.weekStart(U.todayStr());
    const week = all.filter(s => s.date >= ws);
    const pct = (c, d) => d ? Math.round(100 * c / d) : null;
    const names = [...new Set([...Study.resources(), ...all.map(s => s.resource)])].filter(Boolean);
    const stat = (list) => ({ n: list.length, min: U.sum(list, s => s.minutes), q: U.sum(list, s => s.questions), c: U.sum(list, s => s.correct) });
    const wk = stat(week);
    const tpct = (t) => pct(t.qCorrect || 0, t.qDone);
    const weakTopics = topics.filter(t => t.qDone && tpct(t) < weak).sort((a, b) => tpct(a) - tpct(b));
    const list = all.filter(s => !res || s.resource === res);
    return `${UI.header('Question banks & study log', { right: '<button class="icon-btn" data-act="log" aria-label="Log a study session"><i class="ph ph-plus"></i></button>' })}
      <div class="card"><h3>This week</h3><p class="small" style="margin-top:4px">${wk.n} session${wk.n === 1 ? '' : 's'} · ${U.fmtDur(wk.min)}${wk.q ? ` · ${wk.q} questions (${pct(wk.c, wk.q)}% correct)` : ''}</p></div>
      <button class="btn btn-primary btn-block" data-act="log" style="margin:0 0 12px"><i class="ph ph-exam"></i> Log a study session</button>
      <div class="section-title">Resources <button data-act="editRes">Edit list</button></div>
      <div class="tools">${names.map(n => { const s = stat(all.filter(x => x.resource === n)); const w = all.filter(x => x.resource === n && x.date >= ws).length;
        return `<button class="tool" style="--c:#7048E8;${res === n ? 'box-shadow:0 0 0 2px #7048E8' : ''}" data-act="res" data-v="${U.esc(n)}"><i class="ph ph-exam"></i><span>${U.esc(n)}<small>${s.n ? `${s.n} sessions · ${w} this week${s.q ? ` · ${pct(s.c, s.q)}% of ${s.q}` : ''}` : 'Not used yet'}</small></span></button>`; }).join('')}</div>
      ${weakTopics.length ? `<div class="section-title">Weak topics (under ${weak}%)</div>${weakTopics.map(t => `<div class="card" style="box-shadow:0 0 0 2px var(--warn)"><div class="cal-head"><b>${U.esc(t.title)}</b><span class="tag warn">${tpct(t)}%</span></div>
        <div class="muted tiny">${t.qCorrect || 0} of ${t.qDone} correct</div>${UI.progress(tpct(t), 100, 'var(--warn)')}</div>`).join('')}` : ''}
      <div class="section-title">${res ? `${U.esc(res)} sessions <button data-act="res" data-v="">Show all</button>` : 'Recent sessions'}</div>
      ${list.slice(0, 40).map(s => { const t = topics.find(x => x.id === s.topicId);
        return UI.row({ icon: /flashcard|anatomy/i.test(s.resource) ? 'ph-cards' : /practice|skill|surgical/i.test(s.resource) ? 'ph-scissors' : 'ph-exam', color: '#7048E8', cls: 'card',
          title: `${U.esc(s.resource)}${s.minutes ? ` · ${U.fmtDur(s.minutes)}` : ''}`,
          sub: `${U.fmtDate(s.date)}${s.questions ? ` · ${s.correct || 0}/${s.questions} (${pct(s.correct || 0, s.questions)}%)` : ''}${t ? ` · ${U.esc(t.title)}` : ''}${s.note ? ` · ${U.esc(s.note)}` : ''}`, act: 'edit', data: { id: s.id } }); }).join('')
        || UI.empty('No sessions logged yet.', 'ph-exam')}`;
  },
  // Adds (sign 1) or removes (sign -1) a session's questions from its topic's totals.
  async applyToTopic(s, sign) {
    if (!s || !s.topicId || !Number(s.questions)) return;
    const t = await DB.get('topics', s.topicId);
    if (!t) return;
    t.qDone = Math.max(0, (Number(t.qDone) || 0) + sign * Number(s.questions));
    t.qCorrect = Math.max(0, (Number(t.qCorrect) || 0) + sign * (Number(s.correct) || 0));
    await Repo.put('topics', t);
  },
  async editSession(s = null) {
    const topics = (await DB.getAll('topics')).sort(U.by(t => t.title.toLowerCase()));
    const f = await UI.form(s ? 'Study session' : 'Log a study session', [
      { name: 'resource', type: 'select', label: 'Resource', value: s ? s.resource : (App.settings.study.lastResource || Study.resources()[0]), options: [...new Set([...Study.resources(), ...(s ? [s.resource] : [])])].map(r => ({ value: r, label: r })) },
      { type: 'html', html: '<div class="two">' },
      { name: 'date', type: 'date', label: 'Date', value: s ? s.date : U.todayStr(), required: true },
      { name: 'minutes', type: 'number', label: 'Minutes', value: s ? s.minutes : 30, min: 0 },
      { name: 'questions', type: 'number', label: 'Questions done', value: s ? s.questions || '' : '', min: 0 },
      { name: 'correct', type: 'number', label: 'Correct', value: s ? s.correct || '' : '', min: 0 },
      { type: 'html', html: '</div>' },
      { name: 'topicId', type: 'select', label: 'Topic (optional, feeds weak-topic tracking)', value: s ? s.topicId || '' : '', options: [{ value: '', label: '—' }, ...topics.map(t => ({ value: t.id, label: t.title })), { value: '__new', label: '+ New topic…' }] },
      { name: 'newTopic', label: 'New topic name (if new)' },
      { name: 'note', label: 'Note (e.g. suturing, knot tying, upper limb)', value: s ? s.note || '' : '' }
    ], { submit: 'Save session', buttons: s ? [{ label: 'Delete session', value: 'del', danger: true }] : [],
      validate: v => Number(v.correct) > Number(v.questions) ? 'Correct cannot be more than questions done.' : (v.topicId === '__new' && !v.newTopic ? 'Name the new topic.' : (!(Number(v.minutes) > 0) && !(Number(v.questions) > 0) ? 'Add minutes or questions.' : null)) });
    if (!f) return;
    if (s) await Study.applyToTopic(s, -1);
    if (f._button === 'del') {
      if (await UI.confirm('Delete this session?', { ok: 'Delete', danger: true })) await Repo.del('studySession', s.id); else await Study.applyToTopic(s, 1);
      await App.changed({ celebrate: false }); return;
    }
    let topicId = f.topicId;
    if (topicId === '__new') {
      const t = await Repo.put('topics', { id: U.uid('top'), title: f.newTopic, areaId: 'a4', mapStatus: 'notStarted', reviewOn: true, step: -1, reviews: [], qDone: 0, qCorrect: 0 });
      topicId = t.id;
    }
    const obj = await Repo.put('studySession', { ...(s || { id: U.uid('ss') }), resource: f.resource, date: f.date, minutes: Number(f.minutes) || 0,
      questions: Number(f.questions) || 0, correct: Number(f.correct) || 0, topicId, note: f.note });
    await Study.applyToTopic(obj, 1);
    App.settings.study.lastResource = f.resource; await App.saveSettings();
    UI.toast(obj.questions ? `${Math.round(100 * obj.correct / obj.questions)}% — counts for Medical study` : 'Session logged — counts for Medical study', 'ph-exam');
    await App.changed();
  },
  qbankActions(p = {}) {
    return {
      log: () => Study.editSession(null),
      edit: async (el) => Study.editSession(await Repo.get('studySession', el.dataset.id)),
      res: (el) => Nav.go('qbank', { res: el.dataset.v }, { replace: true }),
      editRes: async () => {
        const f = await UI.form('Study resources', [{ name: 'r', type: 'textarea', label: 'One per line (question banks, flashcards, practice…)', value: Study.resources().join('\n'), rows: 9, required: true }]);
        if (!f) return;
        App.settings.study.resources = f.r.split('\n').map(x => x.trim()).filter(Boolean);
        await App.saveSettings(); await App.changed({ celebrate: false });
      }
    };
  },

  // ---------- exam countdown + plan ----------
  async renderExams() {
    const exams = (await Repo.all('exam')).sort(U.by(e => e.date));
    const topics = await DB.getAll('topics');
    const today = U.todayStr();
    return `${UI.header('Exam countdown', { right: '<button class="icon-btn" data-act="add" aria-label="Add exam"><i class="ph ph-plus"></i></button>' })}
      ${exams.map(e => {
        const n = U.diffDays(today, e.date);
        const pool = topics.filter(t => !e.group || (t.group || '') === e.group);
        const left = pool.filter(t => t.mapStatus !== 'confident').sort(U.by(t => t.mapStatus === 'revised' ? 1 : 0));
        const weeks = Math.max(1, Math.ceil(Math.max(0, n) / 7));
        const per = Math.ceil(left.length / weeks);
        const plan = [];
        for (let w = 0; w < weeks && w * per < left.length; w++) plan.push({ ws: U.addDays(U.weekStart(today), 7 * w), topics: left.slice(w * per, (w + 1) * per) });
        return `<div class="card"><div class="cal-head"><div><h3>${U.esc(e.name)}</h3><div class="muted small">${U.fmtDate(e.date, { year: true })}${e.group ? ` · topics in "${U.esc(e.group)}"` : ' · all topics'}</div></div>
          <div style="text-align:center"><div style="font-size:1.8rem;font-weight:900">${Math.max(0, n)}</div><div class="tiny muted">days</div></div></div>
          <p class="small" style="margin-top:6px"><b>${left.length}</b> topic${left.length === 1 ? '' : 's'} not yet confident → about <b>${per}</b> per week over ${weeks} week${weeks === 1 ? '' : 's'}.</p>
          ${plan.length ? `<details style="margin-top:6px"><summary class="small" style="font-weight:800;min-height:44px">Study plan by week</summary>${plan.map(p => `<div class="small" style="margin-top:6px"><b>Week of ${U.fmtDate(p.ws)}</b>: ${p.topics.map(t => U.esc(t.title)).join(', ')}</div>`).join('')}</details>` : ''}
          <button class="btn btn-small btn-ghost" data-act="edit" data-id="${e.id}" style="margin-top:8px"><i class="ph ph-pencil-simple"></i> Edit</button></div>`;
      }).join('') || UI.empty('No exams yet. Add one and its remaining topics are spread across the weeks.', 'ph-timer')}
      <p class="muted small">Topics come from the topic map. Give topics a group (e.g. "FRCS Part A") to plan one exam at a time.</p>`;
  },
  examsActions() {
    const fields = (e) => [{ name: 'name', label: 'Exam', value: e.name || '', required: true }, { name: 'date', type: 'date', label: 'Date', value: e.date || U.addDays(U.todayStr(), 90), required: true },
      { name: 'group', label: 'Only topics in this group (optional)', value: e.group || '' }];
    const after = async (e) => {
      const dls = await DB.getAll('deadlines');
      const d = dls.find(x => x.examId === e.id);
      await Repo.put('deadlines', { ...(d || { id: U.uid('dl'), examId: e.id, done: false }), title: `Exam: ${e.name}`, date: e.date, areaId: 'a4', source: 'Exam countdown' });
    };
    return { add: () => Simple.edit('exam', null, fields, { title: 'exam', after }), edit: async (el) => Simple.edit('exam', await Repo.get('exam', el.dataset.id), fields, { title: 'exam', after }) };
  },

  // ---------- journal / guideline watch list ----------
  async renderWatch() {
    const list = (await Repo.all('watch')).sort(U.by(w => w.lastChecked || ''));
    const s = App.settings.study;
    return `${UI.header('Journal & guideline watch', { right: '<button class="icon-btn" data-act="add" aria-label="Add"><i class="ph ph-plus"></i></button>' })}
      <div class="note"><i class="ph ph-calendar-check"></i><span>A "Check journals & guidelines" task is added every ${U.DOW[s.watchDay]} at ${U.esc(s.watchTime)} while this list has items. <button data-act="when" style="text-decoration:underline;font-weight:800;min-height:44px">Change</button></span></div>
      ${list.map(w => `<div class="card"><div class="cal-head"><div><b>${U.esc(w.name)}</b><div class="muted tiny">${w.lastChecked ? `Checked ${U.relDay(w.lastChecked)}` : 'Never checked'}</div></div>
        <div style="display:flex;gap:4px">${w.url ? `<a class="icon-btn" href="${U.esc(w.url)}" target="_blank" rel="noopener" aria-label="Open"><i class="ph ph-arrow-square-out"></i></a>` : ''}
        <button class="icon-btn" data-act="checked" data-id="${w.id}" aria-label="Checked today"><i class="ph ph-check-circle"></i></button>
        <button class="icon-btn" data-act="edit" data-id="${w.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div></div>
        ${w.notes ? `<p class="small muted pre">${U.esc(w.notes)}</p>` : ''}</div>`).join('') || UI.empty('Add journals or guideline pages to keep an eye on.', 'ph-binoculars')}`;
  },
  watchActions() {
    const fields = (w) => [{ name: 'name', label: 'Journal / guideline', value: w.name || '', required: true }, { name: 'url', label: 'Link', value: w.url || '' }, { name: 'notes', type: 'textarea', label: 'Notes / latest change', value: w.notes || '', rows: 2 }];
    return {
      add: () => Simple.edit('watch', null, fields, { title: 'item' }),
      edit: async (el) => Simple.edit('watch', await Repo.get('watch', el.dataset.id), fields, { title: 'item' }),
      checked: async (el) => { const w = await Repo.get('watch', el.dataset.id); w.lastChecked = U.todayStr(); await Repo.put('watch', w); UI.toast('Marked as checked'); await App.changed({ celebrate: false }); },
      when: async () => {
        const s = App.settings.study;
        const f = await UI.form('Weekly check', [{ name: 'watchDay', type: 'select', label: 'Day', value: s.watchDay, options: [1, 2, 3, 4, 5, 6, 0].map(d => ({ value: d, label: U.DOW[d] })) },
          { name: 'watchTime', type: 'time', label: 'Time', value: s.watchTime }]);
        if (f) { s.watchDay = Number(f.watchDay); s.watchTime = f.watchTime; await App.saveSettings(); await App.changed({ celebrate: false }); }
      }
    };
  }
};
window.Study = Study;

const MedTwins = {
  // Video goal (default one every 14 days), measured from the last "Video published" win.
  async videoGoal() {
    const every = Number((App.settings.medtwins || {}).videoEveryDays) || 14;
    const vids = (await DB.getAll('wins')).filter(w => w.type === 'video' && w.date <= U.todayStr()).sort(U.by(w => w.date));
    const last = vids[vids.length - 1] || null;
    const days = last ? U.diffDays(last.date, U.todayStr()) : null;
    return { every, last, days, dueIn: last ? every - days : null };
  },
  score(i) { return (Number(i.interest) || 0) * 2 - (Number(i.effort) || 0) + (i.evergreen ? 2 : 0); },

  // ---------- idea bank ----------
  async renderIdeas({ show = 'idea' } = {}) {
    const all = await Repo.all('videoIdea');
    const list = all.filter(i => (i.status || 'idea') === show).sort((a, b) => MedTwins.score(b) - MedTwins.score(a));
    // Your sorted idea list (Shorts, long videos, reactions…) lives as cards in the MedTwins board's first stage.
    const board = (await DB.getAll('boards')).find(b => b.video);
    const first = board && (board.stages || [])[0];
    const onBoard = first ? (await DB.getAll('cards')).filter(c => c.boardId === board.id && c.stageId === first.id && !c.archived).length : 0;
    const newer = (App.settings.profileVersion || '') < App.PRIVATE_FILE_VERSION;
    const pointer = onBoard ? `<button class="banner info" data-act="boardIdeas"><i class="ph ph-kanban lead"></i><span><b>${onBoard} video ideas</b> are on the ${U.esc(board.name)} board (${U.esc(first.name)} stage), sorted by format. Tap to open.</span></button>`
      : newer ? `<button class="banner info" data-act="addPrivate"><i class="ph ph-arrow-circle-down lead"></i><span><b>Your video ideas aren't in the app yet.</b> Tap to add otter-private-data.json from Google Drive.</span></button>` : '';
    return `${UI.header('Video idea bank', { right: '<button class="icon-btn" data-act="add" aria-label="Add idea"><i class="ph ph-plus"></i></button>' })}${pointer}
      <div class="seg" style="margin-bottom:10px"><button class="${show === 'idea' ? 'on' : ''}" data-act="show" data-v="idea">Ideas (${all.filter(i => (i.status || 'idea') === 'idea').length})</button>
        <button class="${show === 'onBoard' ? 'on' : ''}" data-act="show" data-v="onBoard">On the board (${all.filter(i => i.status === 'onBoard').length})</button>
        <button class="${show === 'parked' ? 'on' : ''}" data-act="show" data-v="parked">Parked</button></div>
      <p class="muted small" style="margin:0 4px 8px">Score = interest × 2 − effort (+2 if evergreen). Highest first.</p>
      ${list.map(i => `<div class="card"><div class="cal-head"><b>${U.esc(i.title)}</b><span class="tag good">${MedTwins.score(i)}</span></div>
        <div class="muted tiny">Interest ${i.interest}/5 · effort ${i.effort}/5${i.evergreen ? ' · evergreen' : ''}${i.source ? ` · from ${U.esc(i.source)}` : ''}</div>
        ${i.notes ? `<p class="small pre" style="margin-top:4px">${U.esc(i.notes)}</p>` : ''}
        <div class="btn-wrap">${show !== 'onBoard' ? `<button class="btn btn-small btn-primary" data-act="toBoard" data-id="${i.id}"><i class="ph ph-kanban"></i> Send to MedTwins board</button>` : ''}
          <button class="btn btn-small btn-ghost" data-act="edit" data-id="${i.id}"><i class="ph ph-pencil-simple"></i> Score / edit</button></div></div>`).join('') || UI.empty('No video ideas here. Use "Turn into video" anywhere, or +.', 'ph-lightbulb')}`;
  },
  ideasActions() {
    const fields = (i) => [{ name: 'title', label: 'Idea', value: i.title || '', required: true }, { name: 'notes', type: 'textarea', label: 'Angle / notes', value: i.notes || '', rows: 2 },
      { type: 'html', html: '<div class="two">' },
      { name: 'interest', type: 'select', label: 'Interest (1–5)', value: i.interest || 3, options: [1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) })) },
      { name: 'effort', type: 'select', label: 'Effort (1–5)', value: i.effort || 3, options: [1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) })) },
      { type: 'html', html: '</div>' },
      { name: 'evergreen', type: 'checkbox', label: 'Evergreen (stays relevant for years)', value: !!i.evergreen },
      { name: 'status', type: 'select', label: 'Status', value: i.status || 'idea', options: [{ value: 'idea', label: 'Idea' }, { value: 'onBoard', label: 'On the board' }, { value: 'parked', label: 'Parked' }] }];
    return {
      show: (el) => Nav.go('videoIdeas', { show: el.dataset.v }, { replace: true }),
      boardIdeas: async () => { const b = (await DB.getAll('boards')).find(x => x.video); if (b) Nav.go('board', { id: b.id, stage: (b.stages || [])[0]?.id }); },
      addPrivate: () => More.addPrivateFile(),
      add: () => Simple.edit('videoIdea', null, fields, { title: 'video idea', defaults: { source: '' } }),
      edit: async (el) => Simple.edit('videoIdea', await Repo.get('videoIdea', el.dataset.id), fields, { title: 'video idea' }),
      toBoard: async (el) => {
        const i = await Repo.get('videoIdea', el.dataset.id);
        const card = await Boards.newCardSheet({ title: i.title, notes: i.notes, boardId: 'b2', areaId: 'a5' });
        if (card) { i.status = 'onBoard'; i.cardId = card.id; await Repo.put('videoIdea', i); await App.changed({ celebrate: false }); }
      }
    };
  },

  // ---------- content calendar ----------
  async renderCalendar({ month } = {}) {
    month = month || U.monthStr(U.todayStr());
    const boards = (await DB.getAll('boards')).filter(b => b.video);
    const cards = (await DB.getAll('cards')).filter(c => !c.archived && boards.some(b => b.id === c.boardId));
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`, daysIn = new Date(y, m, 0).getDate(), lead = (U.dow(first) + 6) % 7;
    let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < lead; i++) cells += '<div class="day blank"></div>';
    for (let d = 1; d <= daysIn; d++) {
      const ds = `${month}-${U.pad(d)}`;
      const n = cards.filter(c => c.publishDate === ds).length;
      cells += `<div class="day ${n ? 'cs-protected' : ''} ${ds === U.todayStr() ? 'today' : ''}">${d}${n ? `<span class="mk">🎬${n > 1 ? n : ''}</span>` : ''}</div>`;
    }
    const upcoming = cards.filter(c => c.publishDate && c.publishDate >= U.todayStr()).sort(U.by(c => c.publishDate));
    const unscheduled = cards.filter(c => !c.publishDate);
    const prev = U.monthStr(U.addDays(first, -1)), next = U.monthStr(U.addDays(first, 32));
    return `${UI.header('Content calendar')}
      <div class="card"><div class="cal-head"><button class="icon-btn" data-act="month" data-v="${prev}" aria-label="Previous month"><i class="ph ph-caret-left"></i></button>
        <h2>${U.MONTHS[m - 1]} ${y}</h2><button class="icon-btn" data-act="month" data-v="${next}" aria-label="Next month"><i class="ph ph-caret-right"></i></button></div><div class="cal">${cells}</div></div>
      <div class="section-title">Planned publish dates</div>
      ${upcoming.map(c => UI.row({ icon: 'ph-video-camera', color: '#D6336C', cls: 'card', title: U.esc(c.title), sub: `${U.fmtDate(c.publishDate, { year: true })} (${U.relDay(c.publishDate)})${c.assignee ? ` · ${U.esc(c.assignee)}` : ''}`, act: 'date', data: { id: c.id } })).join('') || UI.empty('No publish dates planned.', 'ph-calendar')}
      ${unscheduled.length ? `<div class="section-title">No date yet</div>${unscheduled.map(c => UI.row({ icon: 'ph-calendar-plus', cls: 'card', title: U.esc(c.title), sub: 'Tap to set a publish date', act: 'date', data: { id: c.id } })).join('')}` : ''}`;
  },
  calendarActions(p = {}) {
    return {
      month: (el) => Nav.go('contentCal', { month: el.dataset.v }, { replace: true }),
      date: async (el) => {
        const c = await DB.get('cards', el.dataset.id);
        const f = await UI.form(c.title, [{ name: 'publishDate', type: 'date', label: 'Planned publish date', value: c.publishDate || '' }], { buttons: [{ label: 'Open card', value: 'open' }] });
        if (!f) return;
        if (f._button === 'open') return Nav.go('card', { id: c.id });
        c.publishDate = f.publishDate; await Repo.put('cards', c); await App.changed({ celebrate: false });
      }
    };
  },

  // ---------- script template, filming and repurposing checklists ----------
  async renderKit() {
    const mt = App.settings.medtwins;
    const boards = (await DB.getAll('boards')).filter(b => b.video);
    const cards = (await DB.getAll('cards')).filter(c => !c.archived && boards.some(b => b.id === c.boardId && Boards.stageIndex(b, c.stageId) >= b.stages.length - 2));
    const film = mt.filmChecks || [];
    return `${UI.header('Script & checklists')}
      <div class="card"><div class="cal-head"><h3>Script template</h3><button class="icon-btn" data-act="editScript" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div>
        <pre class="pre small" style="font-family:inherit;margin-top:6px">${U.esc(mt.scriptTemplate)}</pre>
        <button class="btn btn-small btn-ghost" data-act="copyScript"><i class="ph ph-copy"></i> Copy / share</button></div>
      <div class="card"><div class="cal-head"><h3>Filming & equipment</h3><button class="icon-btn" data-act="editFilm" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div>
        ${mt.filmChecklist.map((it, i) => `<label class="check-row"><input type="checkbox" data-change="film" data-i="${i}" ${film[i] ? 'checked' : ''}><span>${U.esc(it)}</span></label>`).join('')}
        <button class="btn btn-small btn-ghost" data-act="resetFilm">Reset for next shoot</button></div>
      <div class="card"><div class="cal-head"><h3>Repurposing after upload</h3><button class="icon-btn" data-act="editRep" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div>
        ${cards.map(c => `<div style="margin-top:8px"><b class="small">${U.esc(c.title)}</b>${mt.repurposeChecklist.map((it, i) => `<label class="check-row"><input type="checkbox" data-change="rep" data-id="${c.id}" data-i="${i}" ${(c.repurpose || [])[i] ? 'checked' : ''}><span>${U.esc(it)}</span></label>`).join('')}</div>`).join('')
          || `<p class="muted small">Videos in the last two board stages appear here. Steps: ${mt.repurposeChecklist.map(U.esc).join(', ')}.</p>`}</div>`;
  },
  kitActions() {
    const mt = () => App.settings.medtwins;
    const save = async () => { await App.saveSettings(); await App.changed({ celebrate: false }); };
    const editList = async (key, title) => {
      const f = await UI.form(title, [{ name: 'v', type: 'textarea', label: 'One item per line', value: mt()[key].join('\n'), rows: 8, required: true }]);
      if (f) { mt()[key] = f.v.split('\n').map(x => x.trim()).filter(Boolean); await save(); }
    };
    return {
      editScript: async () => { const f = await UI.form('Script template', [{ name: 'v', type: 'textarea', label: 'Template', value: mt().scriptTemplate, rows: 14 }]); if (f) { mt().scriptTemplate = f.v; await save(); } },
      copyScript: async () => { const r = await U.shareText('Script template', mt().scriptTemplate); UI.toast(r === 'copied' ? 'Copied' : r === 'shared' ? 'Shared' : 'Select and copy the text', 'ph-copy'); },
      editFilm: () => editList('filmChecklist', 'Filming & equipment checklist'),
      editRep: () => editList('repurposeChecklist', 'Repurposing checklist'),
      film: async (el) => { const a = mt().filmChecks = mt().filmChecks || []; a[Number(el.dataset.i)] = el.checked; await App.saveSettings(); },
      resetFilm: async () => { mt().filmChecks = []; await save(); },
      rep: async (el) => {
        const states = [...document.querySelectorAll(`#view [data-change="rep"][data-id="${el.dataset.id}"]`)].map(cb => cb.checked);
        const c = await DB.get('cards', el.dataset.id); c.repurpose = states; await Repo.put('cards', c);
      }
    };
  },

  // ---------- manual analytics ----------
  async renderStats({ metric = 'views' } = {}) {
    const all = (await Repo.all('videoStat')).sort(U.by(s => s.date)).reverse();
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = U.parseDate(`${U.monthStr(U.todayStr())}-01`); d.setMonth(d.getMonth() - i); months.push(U.monthStr(U.dateStr(d))); }
    const val = (mo) => U.sum(all.filter(s => U.monthStr(s.date) === mo), s => s[metric]);
    const max = Math.max(1, ...months.map(val));
    const label = { views: 'Views', watchHours: 'Watch time (h)', subs: 'Subscribers gained' };
    return `${UI.header('Video analytics', { right: '<button class="icon-btn" data-act="add" aria-label="Add entry"><i class="ph ph-plus"></i></button>' })}
      <p class="muted small" style="margin-bottom:8px">Enter numbers by hand from YouTube Studio (nothing is connected online).</p>
      ${await (async () => {
        const snaps = (await Repo.all('channelStat')).sort(U.by(s => s.date));
        const last = snaps[snaps.length - 1], prev = snaps[snaps.length - 2];
        return `<div class="card"><div class="cal-head"><h3>Channel</h3><button class="btn btn-small btn-ghost" data-act="channel">Update</button></div>
          ${last ? `<p class="small"><b>${Number(last.subscribers).toLocaleString('en-GB')}</b> subscribers · <b>${last.videos}</b> videos <span class="muted">(${U.fmtDate(last.date, { year: true })})</span>
            ${prev ? `<br><span class="muted">${Number(last.subscribers) - Number(prev.subscribers) >= 0 ? '+' : ''}${(Number(last.subscribers) - Number(prev.subscribers)).toLocaleString('en-GB')} subscribers since ${U.fmtDate(prev.date)}</span>` : ''}</p>` : '<p class="muted small">No snapshot yet.</p>'}</div>`;
      })()}
      <div class="seg" style="margin-bottom:10px">${Object.entries(label).map(([k, l]) => `<button class="${metric === k ? 'on' : ''}" data-act="metric" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="card"><h3>${label[metric]} per month</h3><div class="vbars">${months.map(mo => `<div class="vb" style="--c:#D6336C"><span>${Math.round(val(mo) * 10) / 10}</span><div style="height:${Math.round(100 * val(mo) / max)}%"></div>${U.MONTHS[Number(mo.slice(5)) - 1].slice(0, 3)}</div>`).join('')}</div></div>
      ${all.map(s => UI.row({ icon: 'ph-chart-line-up', color: '#D6336C', cls: 'card', title: U.esc(s.video), sub: `${U.fmtDate(s.date, { year: true })} · ${s.views || 0} views · ${s.watchHours || 0} h · +${s.subs || 0} subs`, act: 'edit', data: { id: s.id } })).join('') || UI.empty('No entries yet.', 'ph-chart-line-up')}`;
  },
  statsActions(p = {}) {
    const fields = (s) => [{ name: 'video', label: 'Video', value: s.video || '', required: true }, { name: 'date', type: 'date', label: 'Date of these numbers', value: s.date || U.todayStr(), required: true },
      { type: 'html', html: '<div class="two">' }, { name: 'views', type: 'number', label: 'Views', value: s.views || '', min: 0 }, { name: 'watchHours', type: 'number', label: 'Watch time (h)', value: s.watchHours || '', min: 0, step: 0.1 }, { type: 'html', html: '</div>' },
      { name: 'subs', type: 'number', label: 'Subscribers gained', value: s.subs || '', min: 0 }];
    const fix = async (o) => { o.views = Number(o.views) || 0; o.watchHours = Number(o.watchHours) || 0; o.subs = Number(o.subs) || 0; await Repo.put('videoStat', o); };
    return {
      metric: (el) => Nav.go('videoStats', { metric: el.dataset.v }, { replace: true }),
      channel: async () => {
        const snaps = (await Repo.all('channelStat')).sort(U.by(s => s.date));
        const last = snaps[snaps.length - 1] || {};
        const f = await UI.form('Channel snapshot', [{ name: 'date', type: 'date', label: 'Date', value: U.todayStr(), required: true },
          { type: 'html', html: '<div class="two">' }, { name: 'subscribers', type: 'number', label: 'Subscribers', value: last.subscribers || '', min: 0, required: true },
          { name: 'videos', type: 'number', label: 'Videos', value: last.videos || '', min: 0 }, { type: 'html', html: '</div>' }]);
        if (!f) return;
        await Repo.put('channelStat', { id: `ch_${f.date}`, date: f.date, subscribers: Number(f.subscribers) || 0, videos: Number(f.videos) || 0 });
        await App.changed({ celebrate: false });
      },
      add: () => Simple.edit('videoStat', null, fields, { title: 'entry', after: fix }),
      edit: async (el) => Simple.edit('videoStat', await Repo.get('videoStat', el.dataset.id), fields, { title: 'entry', after: fix })
    };
  }
};
window.MedTwins = MedTwins;

const German = {
  LEVELS: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  // ---------- Goethe exam ----------
  async renderGoethe() {
    const g = App.settings.german;
    const n = g.examDate ? U.diffDays(U.todayStr(), g.examDate) : null;
    const cd = await Repo.all('cando');
    const lvl = (l) => cd.filter(c => c.level === l);
    return `${UI.header('Goethe exam')}
      <section class="area-hero" style="--c:#E8A400"><div class="mascot-slot">${Otto.show() ? Mascot.svg('macaw', { state: n != null && n <= 14 ? 'hopeful' : 'idle', size: 96 }) : ''}</div>
        <div><div style="font-size:2.4rem;font-weight:900;line-height:1">${n == null ? '–' : Math.max(0, n)}</div><div class="small" style="font-weight:800">${n == null ? 'Set your exam date' : n < 0 ? 'Exam done!' : 'days to go'}</div>
          <div class="small" style="margin-top:4px">${U.esc(g.currentLevel)} → <b>${U.esc(g.targetLevel)}</b>${g.examDate ? ` · ${U.fmtDate(g.examDate, { year: true })}` : ''}</div></div></section>
      <button class="btn btn-primary btn-block" data-act="edit"><i class="ph ph-pencil-simple"></i> Exam date & levels</button>
      <div class="card" style="margin-top:12px"><h3>Can-do progress for ${U.esc(g.targetLevel)}</h3>
        ${lvl(g.targetLevel).length ? `${UI.progress(lvl(g.targetLevel).filter(c => c.done).length, lvl(g.targetLevel).length, '#E8A400')}<p class="small muted" style="margin-top:4px">${lvl(g.targetLevel).filter(c => c.done).length} of ${lvl(g.targetLevel).length} statements ticked</p>` : '<p class="muted small">No can-do statements for this level yet.</p>'}
        <button class="btn btn-small btn-ghost" data-act="go" data-view="cando" style="margin-top:6px">Open the can-do checklist</button></div>`;
  },
  goetheActions() {
    return {
      go: (el) => Nav.go(el.dataset.view),
      edit: async () => {
        const g = App.settings.german;
        const f = await UI.form('Goethe exam', [{ name: 'examDate', type: 'date', label: 'Exam date', value: g.examDate },
          { name: 'currentLevel', type: 'select', label: 'Current level', value: g.currentLevel, options: German.LEVELS.map(l => ({ value: l, label: l })) },
          { name: 'targetLevel', type: 'select', label: 'Target level', value: g.targetLevel, options: German.LEVELS.map(l => ({ value: l, label: l })) }]);
        if (!f) return;
        Object.assign(g, f); await App.saveSettings();
        const dls = await DB.getAll('deadlines');
        const d = dls.find(x => x.goethe);
        if (f.examDate) await Repo.put('deadlines', { ...(d || { id: U.uid('dl'), goethe: true, done: false }), title: `Goethe ${f.targetLevel} exam`, date: f.examDate, areaId: 'a6', source: 'Goethe exam' });
        await App.changed({ celebrate: false });
      }
    };
  },

  // ---------- can-do checklist ----------
  async renderCando({ level } = {}) {
    const all = await Repo.all('cando');
    const levels = [...new Set([...German.LEVELS.filter(l => all.some(c => c.level === l)), App.settings.german.targetLevel])].sort();
    level = level || App.settings.german.targetLevel;
    const list = all.filter(c => c.level === level).sort(U.by(c => c.order ?? 99));
    return `${UI.header('Can-do checklist', { right: '<button class="icon-btn" data-act="add" aria-label="Add statement"><i class="ph ph-plus"></i></button>' })}
      <div class="chips" style="margin-bottom:8px">${levels.map(l => `<button class="chip ${l === level ? 'on' : ''}" data-act="level" data-v="${l}">${l} (${all.filter(c => c.level === l && c.done).length}/${all.filter(c => c.level === l).length})</button>`).join('')}</div>
      <div class="list">${list.map(c => `<div class="row"><label class="check-row" style="flex:1;margin:0"><input type="checkbox" data-change="tick" data-id="${c.id}" ${c.done ? 'checked' : ''}><span>${U.esc(c.text)}</span></label>
        <button class="icon-btn" data-act="edit" data-id="${c.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div>`).join('') || UI.empty('No statements for this level yet.', 'ph-check-square')}</div>`;
  },
  candoActions(p = {}) {
    const level = p.level || App.settings.german.targetLevel;
    const fields = (c) => [{ name: 'text', label: 'I can…', value: c.text || 'I can ', required: true },
      { name: 'level', type: 'select', label: 'Level', value: c.level || level, options: German.LEVELS.map(l => ({ value: l, label: l })) }];
    return {
      level: (el) => Nav.go('cando', { level: el.dataset.v }, { replace: true }),
      tick: async (el) => { const c = await Repo.get('cando', el.dataset.id); c.done = el.checked; c.doneDate = el.checked ? U.todayStr() : ''; await Repo.put('cando', c); if (el.checked) UI.toast('Ja! Ticked', 'ph-check-square'); await App.changed({ celebrate: false }); },
      add: () => Simple.edit('cando', null, fields, { title: 'statement', defaults: { done: false, order: 99 } }),
      edit: async (el) => Simple.edit('cando', await Repo.get('cando', el.dataset.id), fields, { title: 'statement' })
    };
  },

  // ---------- mistakes log ----------
  async renderMistakes({ show = 'all' } = {}) {
    const all = (await Repo.all('mistake')).sort((a, b) => (b.count || 1) - (a.count || 1) || (b.lastSeen || '').localeCompare(a.lastSeen || ''));
    const rec = Number((App.settings.german || {}).recurringAt) || 3;
    const list = show === 'recurring' ? all.filter(m => (m.count || 1) >= rec && !m.mastered) : show === 'mastered' ? all.filter(m => m.mastered) : all.filter(m => !m.mastered);
    return `${UI.header('Mistakes log', { right: '<button class="icon-btn" data-act="add" aria-label="Add mistake"><i class="ph ph-plus"></i></button>' })}
      <div class="seg" style="margin-bottom:10px"><button class="${show === 'all' ? 'on' : ''}" data-act="show" data-v="all">Active</button>
        <button class="${show === 'recurring' ? 'on' : ''}" data-act="show" data-v="recurring">⚑ Recurring (${all.filter(m => (m.count || 1) >= rec && !m.mastered).length})</button>
        <button class="${show === 'mastered' ? 'on' : ''}" data-act="show" data-v="mastered">Mastered</button></div>
      ${list.map(m => `<div class="card" style="${(m.count || 1) >= rec && !m.mastered ? 'box-shadow:0 0 0 2px var(--warn)' : ''}">
        <div class="small"><s style="color:var(--bad)">${U.esc(m.error)}</s></div><div style="font-weight:800;color:var(--good)">${U.esc(m.correction)}</div>
        ${m.note ? `<div class="muted small pre">${U.esc(m.note)}</div>` : ''}
        <div class="muted tiny">${m.count || 1}× · last ${U.fmtDate(m.lastSeen || m.date)}${(m.count || 1) >= rec ? ' · ⚑ recurring — review it' : ''}</div>
        <div class="btn-wrap">${m.mastered ? '' : `<button class="btn btn-small btn-ghost" data-act="again" data-id="${m.id}">Made it again (+1)</button><button class="btn btn-small btn-ghost" data-act="master" data-id="${m.id}">Mastered ✓</button>`}
          <button class="btn btn-small btn-ghost" data-act="edit" data-id="${m.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div></div>`).join('') || UI.empty('No mistakes logged. Fehler sind Freunde!', 'ph-warning-circle')}`;
  },
  mistakesActions() {
    const fields = (m) => [{ name: 'error', label: 'What I said / wrote', value: m.error || '', required: true }, { name: 'correction', label: 'Correct version', value: m.correction || '', required: true },
      { name: 'note', type: 'textarea', label: 'Rule / note', value: m.note || '', rows: 2 }];
    const upd = async (id, fn, msg) => { const m = await Repo.get('mistake', id); fn(m); await Repo.put('mistake', m); UI.toast(msg); await App.changed({ celebrate: false }); };
    return {
      show: (el) => Nav.go('mistakes', { show: el.dataset.v }, { replace: true }),
      add: () => Simple.edit('mistake', null, fields, { title: 'mistake', defaults: { count: 1, date: U.todayStr(), lastSeen: U.todayStr(), mastered: false } }),
      edit: async (el) => Simple.edit('mistake', await Repo.get('mistake', el.dataset.id), fields, { title: 'mistake' }),
      again: (el) => upd(el.dataset.id, m => { m.count = (m.count || 1) + 1; m.lastSeen = U.todayStr(); }, 'Logged again — it\'s flagged for review'),
      master: (el) => upd(el.dataset.id, m => { m.mastered = true; }, 'Mastered! Toll!')
    };
  },

  // ---------- speaking minutes ----------
  async askSpeaking(date, task) {
    const v = await UI.choose('How many minutes did you speak?', [5, 10, 15, 20, 30, 45].map(n => ({ value: n, label: `${n} minutes` })).concat([{ value: 'skip', label: 'Skip', sub: 'Don\'t log minutes this time' }]),
      { text: `Logged under Speaking minutes for "${task.title}".` });
    if (!v || v === 'skip') return;
    await Repo.put('speaking', { id: `sp_${date}_${task.id}`, date, minutes: Number(v), taskId: task.id, note: task.title });
    UI.toast(`${v} speaking minutes logged`, 'ph-microphone');
    await App.changed({ celebrate: false });
  },
  async renderSpeaking() {
    const all = (await Repo.all('speaking')).sort(U.by(s => s.date)).reverse();
    const wsNow = U.weekStart(U.todayStr());
    const weeks = [5, 4, 3, 2, 1, 0].map(i => U.addDays(wsNow, -7 * i));
    const tot = (ws) => U.sum(all.filter(s => s.date >= ws && s.date < U.addDays(ws, 7)), s => s.minutes);
    const max = Math.max(1, ...weeks.map(tot));
    const target = Number((App.settings.german || {}).speakingTarget) || 60;
    return `${UI.header('Speaking minutes', { right: '<button class="icon-btn" data-act="add" aria-label="Log minutes"><i class="ph ph-plus"></i></button>' })}
      <div class="card"><div class="cal-head"><h3>This week: ${tot(wsNow)} min</h3><button class="btn btn-small btn-ghost" data-act="target">Target ${target}</button></div>${UI.progress(tot(wsNow), target, '#E8A400')}</div>
      <div class="card"><h3>Minutes per week</h3><div class="vbars">${weeks.map(ws => `<div class="vb" style="--c:#E8A400"><span>${tot(ws)}</span><div style="height:${Math.round(100 * tot(ws) / max)}%"></div>${U.fmtDate(ws, { dow: false })}</div>`).join('')}</div></div>
      <p class="muted small">Ticking a "Use the language" task (or any task marked as speaking practice) asks how many minutes you spoke.</p>
      ${all.slice(0, 30).map(s => UI.row({ icon: 'ph-microphone', color: '#E8A400', title: `${s.minutes} min`, sub: `${U.fmtDate(s.date, { year: true })}${s.note ? ` · ${U.esc(s.note)}` : ''}`, act: 'edit', data: { id: s.id }, cls: 'card' })).join('')}`;
  },
  speakingActions() {
    const fields = (s) => [{ name: 'date', type: 'date', label: 'Date', value: s.date || U.todayStr(), required: true }, { name: 'minutes', type: 'number', label: 'Minutes', value: s.minutes || 15, min: 1, required: true },
      { name: 'note', label: 'What (tutor, partner, voice note…)', value: s.note || '' }];
    const fix = async (o) => { o.minutes = Number(o.minutes) || 0; await Repo.put('speaking', o); };
    return {
      add: () => Simple.edit('speaking', null, fields, { title: 'entry', after: fix }),
      edit: async (el) => Simple.edit('speaking', await Repo.get('speaking', el.dataset.id), fields, { title: 'entry', after: fix }),
      target: async () => {
        const f = await UI.form('Weekly speaking target', [{ name: 't', type: 'number', label: 'Minutes per week', value: Number((App.settings.german || {}).speakingTarget) || 60, min: 5 }]);
        if (f) { App.settings.german.speakingTarget = Number(f.t) || 60; await App.saveSettings(); await App.changed({ celebrate: false }); }
      }
    };
  }
};
window.German = German;

// ---------- hooks into the rest of the app ----------
// Ticking a speaking task asks for minutes (after the tick animation).
Days.toggleHooks.push(async (day, task, done) => { if (done && task.tag === 'speaking') setTimeout(() => German.askSpeaking(day.date, task), 900); });
// Weekly "check for updates" task on the chosen day while the watch list has items.
Days.createHooks.push((day) => {
  const s = App.settings.study || {};
  if (U.dow(day.date) !== Number(s.watchDay) || !App.cache.watchCount) return;
  if (day.tasks.some(t => t.tag === 'watch')) return;
  const start = s.watchTime || '17:00';
  const id = U.uid('t');
  day.tasks.push({ id, srcId: id, time: start, endTime: U.fromMin(U.toMin(start) + 20), title: 'Check journals & guidelines', desc: 'Your watch list', areaId: 'a4', core: false, optional: true, infoOnly: false, xp: 10, tag: 'watch' });
});
// Area streak sources.
Streaks.extraSources.push(async () => [
  ...(await Repo.all('case')).map(c => ({ areaId: 'a3', date: c.date, n: 1, tag: 'case' })),
  ...(await DB.getAll('topics')).flatMap(t => [...new Set((t.qSessions || []).map(q => q.date))].map(d => ({ areaId: t.areaId || 'a4', date: d, n: 1, tag: 'qbank' }))),
  ...(await Repo.all('speaking')).map(s => ({ areaId: 'a6', date: s.date, n: 1, tag: 'speaking' })),
  ...(await Repo.all('studySession')).map(s => ({ areaId: 'a4', date: s.date, n: 1, tag: 'study' })),
  // MedTwins (weekly): moving a video card on, or finishing its next action, counts as a session.
  ...await (async () => {
    const vb = (await DB.getAll('boards')).filter(b => b.video).map(b => b.id);
    return (await DB.getAll('cards')).filter(c => vb.includes(c.boardId)).flatMap(c => [...(c.history || []).slice(1), ...(c.actionsDone || [])]
      .map(h => ({ areaId: c.areaId || 'a5', date: h.date, n: 1, tag: 'video' })));
  })()
]);
// Area page extras.
Areas.extraHooks.a6 = async () => {
  const g = App.settings.german;
  if (!g.examDate) return '';
  const n = U.diffDays(U.todayStr(), g.examDate);
  return n < 0 ? '' : `<button class="banner warn" data-act="goTool" data-view="goethe"><i class="ph ph-graduation-cap lead"></i>Goethe ${U.esc(g.targetLevel)} exam in ${n} day${n === 1 ? '' : 's'}</button>`;
};
Areas.extraActions.a6 = () => ({ goTool: (el) => Nav.go(el.dataset.view) });
Areas.extraHooks.a4 = async () => {
  const exams = (await Repo.all('exam')).filter(e => e.date >= U.todayStr()).sort(U.by(e => e.date));
  const due = Logs.dueTopics(await DB.getAll('topics'));
  return `${exams[0] ? `<button class="banner warn" data-act="goTool" data-view="exams"><i class="ph ph-timer lead"></i>${U.esc(exams[0].name)} in ${U.diffDays(U.todayStr(), exams[0].date)} days</button>` : ''}
    ${due.length ? `<button class="banner info" data-act="goTool" data-view="topics"><i class="ph ph-brain lead"></i>${due.length} topic review${due.length > 1 ? 's' : ''} due</button>` : ''}`;
};
Areas.extraActions.a4 = () => ({ goTool: (el) => Nav.go(el.dataset.view) });
Areas.extraHooks.a5 = async () => {
  const next = (await DB.getAll('cards')).filter(c => !c.archived && c.publishDate && c.publishDate >= U.todayStr()).sort(U.by(c => c.publishDate))[0];
  const g = await MedTwins.videoGoal();
  const goal = `<button class="banner ${g.last && g.dueIn < 0 ? 'warn' : g.last ? 'good' : 'info'}" data-act="videoGoal"><i class="ph ph-video-camera lead"></i><span>Video goal: one every ${g.every} days · ${g.last
    ? `last published ${g.days === 0 ? 'today' : `${g.days} day${g.days === 1 ? '' : 's'} ago`} · ${g.dueIn < 0 ? `${-g.dueIn} days overdue` : g.dueIn === 0 ? 'next one due today' : `next due in ${g.dueIn} days`}`
    : 'no published video logged yet (log one in Wins, or finish a card on the MedTwins board)'}</span></button>`;
  return `${goal}<div class="btn-wrap" style="margin-top:4px"><button class="btn btn-ghost" data-act="shareBoard"><i class="ph ph-share-network"></i> Share board summary</button></div>
    ${next ? `<button class="banner info" data-act="goTool" data-view="contentCal" style="margin-top:8px"><i class="ph ph-video-camera lead"></i>Next publish: ${U.esc(next.title)} · ${U.fmtDate(next.publishDate)}</button>` : ''}`;
};
Areas.extraActions.a5 = () => ({ goTool: (el) => Nav.go(el.dataset.view),
  videoGoal: async () => {
    const f = await UI.form('Video goal', [{ name: 'd', type: 'number', label: 'Publish one video every … days', value: Number(App.settings.medtwins.videoEveryDays) || 14, min: 1, max: 90 }]);
    if (f) { App.settings.medtwins.videoEveryDays = Number(f.d) || 14; await App.saveSettings(); await App.changed({ celebrate: false }); }
  }, shareBoard: async () => { const b = await DB.get('boards', 'b2'); if (b) Boards.shareSummary(b); else UI.toast('MedTwins board not found', 'ph-warning'); } });
Areas.extraHooks.a3 = async () => {
  const soon = (await Repo.all('cert')).filter(c => c.expires && U.diffDays(U.todayStr(), c.expires) <= 30).sort(U.by(c => c.expires));
  const jc = window.WardJobs ? WardJobs.counts(await WardJobs.get(U.todayStr())) : null;
  return (jc ? `<button class="banner ${jc.urgent ? 'bad' : jc.open ? 'info' : 'good'}" data-act="goTool" data-view="wardJobs"><i class="ph ph-list-checks lead"></i>${jc.total ? `Ward jobs today: ${jc.done} of ${jc.total} done${jc.urgent ? ` · ${jc.urgent} urgent` : ''}` : 'Ward jobs: write today\'s list after the round'}</button>` : '') + soon.map(c => `<button class="banner ${U.diffDays(U.todayStr(), c.expires) <= 7 ? 'bad' : 'warn'}" data-act="goTool" data-view="certs"><i class="ph ph-certificate lead"></i>${U.esc(c.name)} ${c.expires < U.todayStr() ? 'has expired' : `expires ${U.relDay(c.expires)}`}</button>`).join('');
};
Areas.extraActions.a3 = () => ({ goTool: (el) => Nav.go(el.dataset.view) });

Nav.register('cases', { tab: 'today', render: (p) => Clinical.renderCases(p), actions: (p) => Clinical.casesActions(p) });
Nav.register('portfolio', { tab: 'today', render: () => Clinical.renderPortfolio(), actions: () => Clinical.portfolioActions() });
Nav.register('certs', { tab: 'today', render: () => Clinical.renderCerts(), actions: () => Clinical.certsActions() });
Nav.register('cpd', { tab: 'today', render: (p) => Clinical.renderCPD(p), actions: (p) => Clinical.cpdActions(p) });
Nav.register('qbank', { tab: 'today', render: () => Study.renderQbank(), actions: () => Study.qbankActions() });
Nav.register('exams', { tab: 'today', render: () => Study.renderExams(), actions: () => Study.examsActions() });
Nav.register('watch', { tab: 'today', render: () => Study.renderWatch(), actions: () => Study.watchActions() });
Nav.register('videoIdeas', { tab: 'today', render: (p) => MedTwins.renderIdeas(p), actions: () => MedTwins.ideasActions() });
Nav.register('contentCal', { tab: 'today', render: (p) => MedTwins.renderCalendar(p), actions: (p) => MedTwins.calendarActions(p) });
Nav.register('mtKit', { tab: 'today', render: () => MedTwins.renderKit(), actions: () => MedTwins.kitActions() });
Nav.register('videoStats', { tab: 'today', render: (p) => MedTwins.renderStats(p), actions: (p) => MedTwins.statsActions(p) });
Nav.register('goethe', { tab: 'today', render: () => German.renderGoethe(), actions: () => German.goetheActions() });
Nav.register('cando', { tab: 'today', render: (p) => German.renderCando(p), actions: (p) => German.candoActions(p) });
Nav.register('mistakes', { tab: 'today', render: (p) => German.renderMistakes(p), actions: () => German.mistakesActions() });
Nav.register('speaking', { tab: 'today', render: () => German.renderSpeaking(), actions: () => German.speakingActions() });
