// ======= logs.js — waiting-on, deadlines, wins & badges, clinical questions, spaced topic review =======

const Logs = {
  WIN_TYPES: {
    paperSubmitted: ['Paper submitted', 'ph-paper-plane-tilt'], paperAccepted: ['Paper accepted / published', 'ph-newspaper'],
    presentation: ['Presentation / poster', 'ph-presentation-chart'], video: ['Video published', 'ph-video-camera'],
    grant: ['Grant / award / fellowship', 'ph-medal'], exam: ['Exam passed', 'ph-graduation-cap'], course: ['Course / certificate', 'ph-certificate'],
    chapter: ['Chapter / module finished', 'ph-book-open'], teaching: ['Teaching delivered', 'ph-chalkboard-teacher'], degree: ['Degree / qualification', 'ph-graduation-cap'], role: ['Role / leadership', 'ph-users-three'], pr: ['Personal record', 'ph-barbell'], other: ['Other win', 'ph-star']
  },
  PID_NOTE: '<div class="note warn"><i class="ph ph-shield-warning"></i><span>Never record patient-identifiable details: no names, dates of birth, hospital numbers, exact dates or rare details that could identify someone.</span></div>',
  areaFilterChips(view, params, current) {
    return `<div class="chips" style="margin-bottom:8px"><button class="chip ${!current ? 'on' : ''}" data-act="fArea" data-v="">All areas</button>
      ${App.visibleAreas().map(a => `<button class="chip ${current === a.id ? 'on' : ''}" data-act="fArea" data-v="${a.id}">${U.esc(a.name)}</button>`).join('')}</div>`;
  },

  // ---------- waiting on ----------
  followDue(w) { return U.addDays(w.lastFollowUp || w.date, Number(w.followUpDays) || 7); },
  async renderWaiting({ show = 'open' } = {}) {
    const all = (await DB.getAll('waitingOn')).sort(U.by(w => Logs.followDue(w)));
    const list = all.filter(w => show === 'done' ? w.done : !w.done);
    const today = U.todayStr();
    return `${UI.header('Waiting on', { right: '<button class="icon-btn" data-act="add" aria-label="Add"><i class="ph ph-plus"></i></button>' })}
      <div class="seg" style="margin-bottom:12px"><button class="${show === 'open' ? 'on' : ''}" data-act="show" data-v="open">Open (${all.filter(w => !w.done).length})</button>
        <button class="${show === 'done' ? 'on' : ''}" data-act="show" data-v="done">Received (${all.filter(w => w.done).length})</button></div>
      ${list.map(w => {
        const due = Logs.followDue(w);
        return `<div class="card"><div class="cal-head"><div><div style="font-weight:800">${U.esc(w.title)}</div>
          <div class="muted small">From ${U.esc(w.who || '?')} · asked ${U.fmtDate(w.date)} (${U.diffDays(w.date, today)} days ago)</div></div>
          ${w.done ? '<span class="tag good">received</span>' : due <= today ? '<span class="tag warn">follow up</span>' : `<span class="tag">follow up ${U.relDay(due)}</span>`}</div>
          ${w.notes ? `<p class="small muted pre">${U.esc(w.notes)}</p>` : ''}
          ${(w.followUps || []).length ? `<p class="tiny muted">Followed up: ${w.followUps.map(d => U.fmtDate(d)).join(', ')}</p>` : ''}
          <div class="btn-wrap">${w.done ? `<button class="btn btn-small btn-ghost" data-act="reopen" data-id="${w.id}">Reopen</button>` : `
            <button class="btn btn-small btn-primary" data-act="received" data-id="${w.id}"><i class="ph ph-check"></i> Received</button>
            <button class="btn btn-small btn-ghost" data-act="followed" data-id="${w.id}"><i class="ph ph-paper-plane-tilt"></i> I followed up</button>`}
            <button class="btn btn-small btn-ghost" data-act="edit" data-id="${w.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div></div>`;
      }).join('') || UI.empty(show === 'open' ? 'Not waiting on anyone. Lovely.' : 'Nothing received yet.', 'ph-hand-palm')}`;
  },
  waitingActions() {
    const upd = async (id, fn, msg) => { const w = await DB.get('waitingOn', id); fn(w); await Repo.put('waitingOn', w); if (msg) UI.toast(msg); await App.changed({ celebrate: false }); };
    return {
      show: (el) => Nav.go('waiting', { show: el.dataset.v }, { replace: true }),
      add: () => Logs.editWaiting(null),
      edit: async (el) => Logs.editWaiting(await DB.get('waitingOn', el.dataset.id)),
      received: (el) => upd(el.dataset.id, w => { w.done = true; w.doneDate = U.todayStr(); }, 'Marked as received'),
      reopen: (el) => upd(el.dataset.id, w => { w.done = false; }),
      followed: (el) => upd(el.dataset.id, w => { w.followUps = [...(w.followUps || []), U.todayStr()]; w.lastFollowUp = U.todayStr(); }, 'Next follow-up scheduled')
    };
  },
  async editWaiting(w) {
    const f = await UI.form(w ? 'Edit' : 'Waiting on…', [
      { name: 'title', label: 'What are you waiting for?', value: w ? w.title : '', required: true, placeholder: 'e.g. Statistician: analysis plan comments' },
      { name: 'who', label: 'Who', value: w ? w.who : '', placeholder: 'Co-author, ethics committee, journal…' },
      { type: 'html', html: '<div class="two">' },
      { name: 'date', type: 'date', label: 'Date requested', value: w ? w.date : U.todayStr(), required: true },
      { name: 'followUpDays', type: 'number', label: 'Follow up after (days)', value: w ? w.followUpDays : 7, min: 1 },
      { type: 'html', html: '</div>' },
      { name: 'areaId', type: 'select', label: 'Area', value: w ? w.areaId || '' : 'a2', options: UI.areaOptions(true) },
      { name: 'notes', type: 'textarea', label: 'Notes', value: w ? w.notes : '', rows: 2 }
    ], { buttons: w ? [{ label: 'Delete', value: 'del', danger: true }] : [] });
    if (!f) return;
    if (f._button === 'del') { if (await UI.confirm('Delete this item?', { ok: 'Delete', danger: true })) await Repo.del('waitingOn', w.id); }
    else await Repo.put('waitingOn', { ...(w || { id: U.uid('w'), done: false }), ...f, followUpDays: Number(f.followUpDays) || 7, areaId: f.areaId || null });
    await App.changed({ celebrate: false });
  },

  // ---------- deadlines ----------
  async renderDeadlines({ show = 'open', areaId = '' } = {}) {
    const today = U.todayStr();
    const boards = await DB.getAll('boards');
    const all = (await DB.getAll('deadlines')).sort(U.by(d => d.date));
    const list = all.filter(d => (show === 'done' ? d.done : !d.done) && (!areaId || d.areaId === areaId));
    return `${UI.header('Deadlines', { right: '<button class="icon-btn" data-act="add" aria-label="Add deadline"><i class="ph ph-plus"></i></button>' })}
      <div class="seg" style="margin-bottom:8px"><button class="${show === 'open' ? 'on' : ''}" data-act="show" data-v="open">Upcoming</button><button class="${show === 'done' ? 'on' : ''}" data-act="show" data-v="done">Done</button></div>
      ${Logs.areaFilterChips('deadlines', {}, areaId)}
      ${list.map(d => {
        const n = U.diffDays(today, d.date);
        const cls = d.done ? 'good' : n < 0 ? 'bad' : n <= 7 ? 'warn' : n <= (App.settings.deadlineWindow || 14) ? 'info' : '';
        const a = App.areaById(d.areaId), b = boards.find(x => x.id === d.boardId);
        return `<button class="row card" style="margin-bottom:8px;--row-color:${a ? a.color : 'var(--brand)'}" data-act="edit" data-id="${d.id}">
          <span class="row-icon"><i class="ph ph-hourglass-medium"></i></span>
          <span class="row-main"><span class="row-title">${U.esc(d.title)}</span>
            <span class="row-sub">${U.fmtDate(d.date, { year: true })}${a ? ` · ${U.esc(a.name)}` : ''}${b ? ` · ${U.esc(b.name)}` : ''}${d.source ? ` · ${U.esc(d.source)}` : ''}</span></span>
          <span class="tag ${cls}" style="white-space:nowrap">${d.done ? 'done' : n < 0 ? `${-n}d overdue` : n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'}`}</span></button>`;
      }).join('') || UI.empty('No deadlines here.', 'ph-hourglass-medium')}
      <p class="muted small">Deadlines within ${App.settings.deadlineWindow || 14} days appear on Today (change in Settings › Planning).</p>`;
  },
  deadlinesActions(p) {
    return {
      show: (el) => Nav.go('deadlines', { ...p, show: el.dataset.v }, { replace: true }),
      fArea: (el) => Nav.go('deadlines', { ...p, areaId: el.dataset.v }, { replace: true }),
      add: () => Logs.editDeadline(null, { areaId: p.areaId || '' }),
      edit: async (el) => Logs.editDeadline(await DB.get('deadlines', el.dataset.id))
    };
  },
  async editDeadline(d, preset = {}) {
    const boards = await Boards.all();
    const v = d || preset;
    const f = await UI.form(d ? 'Edit deadline' : 'New deadline', [
      { name: 'title', label: 'What', value: v.title || '', required: true, placeholder: 'Abstract deadline, resubmission, exam…' },
      { name: 'date', type: 'date', label: 'Date', value: v.date || U.addDays(U.todayStr(), 14), required: true },
      { name: 'areaId', type: 'select', label: 'Area', value: v.areaId || '', options: UI.areaOptions(true) },
      { name: 'boardId', type: 'select', label: 'Linked board (optional)', value: v.boardId || '', options: [{ value: '', label: '—' }, ...boards.map(b => ({ value: b.id, label: b.name }))] },
      { name: 'notes', type: 'textarea', label: 'Notes', value: v.notes || '', rows: 2 },
      ...(d ? [{ name: 'done', type: 'checkbox', label: 'Done', value: d.done }] : [])
    ], { buttons: d ? [{ label: 'Delete', value: 'del', danger: true }] : [] });
    if (!f) return null;
    if (f._button === 'del') { if (await UI.confirm('Delete this deadline?', { ok: 'Delete', danger: true })) await Repo.del('deadlines', d.id); }
    else await Repo.put('deadlines', { ...(d || { id: U.uid('dl'), done: false, cardId: preset.cardId || '', source: preset.source || '', oppId: preset.oppId || '' }), ...f, areaId: f.areaId || null });
    UI.toast('Saved'); await App.changed({ celebrate: false });
    return true;
  },

  // ---------- wins ----------
  AUTHORSHIP: { first: 'First author', 'joint-first': 'Joint first author', co: 'Co-author', senior: 'Senior / last author' },
  PAPER_TYPES: ['paperSubmitted', 'paperAccepted'],
  // First or joint first (older wins without the field fall back to their notes).
  isFirst(w) { return w.authorship ? ['first', 'joint-first'].includes(w.authorship) : /\b(joint )?first author/i.test(w.notes || ''); },
  authorshipLabel(w) { return Logs.PAPER_TYPES.includes(w.type) && w.authorship ? Logs.AUTHORSHIP[w.authorship] || '' : ''; },
  async addWin(w) {
    const win = await Repo.put('wins', { id: U.uid('win'), notes: '', ...w });
    UI.toast('Win logged! +25 XP', 'ph-trophy');
    await App.changed();
    const a = App.areaById(w.areaId);
    await Otto.celebrate({ title: 'New win!', sub: w.title, big: false, kind: a ? a.mascot : 'otter', button: 'Woohoo' });
    return win;
  },
  async editWin(w = null) {
    const f = await UI.form(w ? 'Edit win' : 'Log a win', [
      { name: 'title', label: 'What did you achieve?', value: w ? w.title : '', required: true },
      { name: 'type', type: 'select', label: 'Type', value: w ? w.type : 'other', options: Object.entries(Logs.WIN_TYPES).map(([v, [l]]) => ({ value: v, label: l })) },
      { name: 'date', type: 'date', label: 'Date', value: w ? w.date : U.todayStr(), required: true },
      { name: 'areaId', type: 'select', label: 'Area', value: w ? w.areaId || '' : '', options: UI.areaOptions(true) },
      { name: 'authorship', type: 'select', label: 'Your authorship (for papers)', value: w ? w.authorship || '' : '', options: [{ value: '', label: '—' }, ...Object.entries(Logs.AUTHORSHIP).map(([v, l]) => ({ value: v, label: l }))] },
      { name: 'notes', type: 'textarea', label: 'Details (journal, conference, link…)', value: w ? w.notes : '', rows: 2 }
    ], { buttons: w ? [{ label: 'Delete', value: 'del', danger: true }] : [] });
    if (!f) return;
    if (f._button === 'del') { if (await UI.confirm('Delete this win?', { ok: 'Delete', danger: true })) { await Repo.del('wins', w.id); await App.changed({ celebrate: false }); } return; }
    if (w) { await Repo.put('wins', { ...w, ...f, areaId: f.areaId || null }); await App.changed({ celebrate: false }); }
    else await Logs.addWin({ ...f, areaId: f.areaId || null });
  },
  badges(wins) {
    // Every earned level per win type, plus the next level still to earn.
    const out = [];
    for (const [type, [label, icon]] of Object.entries(Logs.WIN_TYPES)) {
      const n = wins.filter(w => w.type === type).length;
      for (const lvl of [1, 5, 10, 25]) {
        const b = { type, label: lvl === 1 ? `First: ${label}` : `${lvl} × ${label}`, icon, open: n >= lvl, lvl };
        out.push(b);
        if (!b.open) break;
      }
    }
    return out;
  },
  filterWins(wins, { areaId = '', from = '', to = '' }) {
    return wins.filter(w => (!areaId || w.areaId === areaId) && (!from || w.date >= from) && (!to || w.date <= to)).sort(U.by(w => w.date)).reverse();
  },
  winsText(list, heading = 'Wins') {
    const lines = [heading, ''];
    for (const [type, [label]] of Object.entries(Logs.WIN_TYPES)) {
      const g = list.filter(w => w.type === type);
      if (!g.length) continue;
      lines.push(label.toUpperCase());
      g.forEach(w => lines.push(`• ${U.fmtDate(w.date, { year: true, dow: false })} — ${w.title}${Logs.authorshipLabel(w) ? ` [${Logs.authorshipLabel(w)}]` : ''}${w.notes ? ` (${w.notes.replace(/\n/g, '; ')})` : ''}`));
      lines.push('');
    }
    return lines.join('\n');
  },
  async renderWins(p = {}) {
    const all = await DB.getAll('wins');
    const list = Logs.filterWins(all, p);
    const badges = Logs.badges(all);
    return `${UI.header('Wins log', { right: '<button class="icon-btn" data-act="add" aria-label="Log a win"><i class="ph ph-plus"></i></button>' })}
      ${Logs.areaFilterChips('wins', p, p.areaId)}
      <div class="two" style="margin-bottom:8px"><div class="field"><label for="wf">From</label><input id="wf" type="date" value="${p.from || ''}" data-change="from"></div>
        <div class="field"><label for="wt">To</label><input id="wt" type="date" value="${p.to || ''}" data-change="to"></div></div>
      <button class="btn btn-ghost btn-block" data-act="export" style="margin:0 0 12px"><i class="ph ph-export"></i> Export ${list.length} win${list.length === 1 ? '' : 's'} as text (CV / portfolio)</button>
      ${list.map(w => {
        const [label, icon] = Logs.WIN_TYPES[w.type] || Logs.WIN_TYPES.other;
        const a = App.areaById(w.areaId);
        return UI.row({ icon, color: a ? a.color : '', title: U.esc(w.title), sub: `${U.fmtDate(w.date, { year: true })} · ${label}${Logs.authorshipLabel(w) ? ` · <b>${Logs.authorshipLabel(w)}</b>` : ''}${a ? ` · ${U.esc(a.name)}` : ''}`, act: 'edit', data: { id: w.id }, cls: 'card' });
      }).join('') || UI.empty('No wins in this view yet. Every output counts!', 'ph-trophy')}
      <div class="section-title">Badges (${badges.filter(b => b.open).length} earned)</div>
      <div class="tools">${badges.map(b => `<div class="tool" style="${b.open ? '' : 'opacity:.45'}"><i class="ph${b.open ? '-fill' : ''} ${b.icon}"></i><span>${U.esc(b.label)}<small>${b.open ? 'Earned' : 'Locked'}</small></span></div>`).join('')}</div>`;
  },
  winsActions(p = {}) {
    return {
      fArea: (el) => Nav.go('wins', { ...p, areaId: el.dataset.v }, { replace: true }),
      from: (el) => Nav.go('wins', { ...p, from: el.value }, { replace: true }),
      to: (el) => Nav.go('wins', { ...p, to: el.value }, { replace: true }),
      add: () => Logs.editWin(null),
      edit: async (el) => Logs.editWin(await DB.get('wins', el.dataset.id)),
      export: async () => {
        const list = Logs.filterWins(await DB.getAll('wins'), p);
        Logs.exportText('Wins', Logs.winsText(list, `Wins${p.from || p.to ? ` (${p.from || '…'} to ${p.to || '…'})` : ''}`), 'wins');
      }
    };
  },
  // Shows text with Share / Copy / Download options.
  exportText(title, text, filename) {
    UI.sheet({ title, html: `<textarea rows="12" readonly style="font-size:.85rem">${U.esc(text)}</textarea>
      <div class="btn-row"><button class="btn btn-primary" data-act="share"><i class="ph ph-share-network"></i> Share / copy</button>
      <button class="btn btn-ghost" data-act="dl"><i class="ph ph-download-simple"></i> .txt file</button></div>`,
    onMount: (el) => UI.on(el, {
      share: async () => { const r = await U.shareText(title, text); UI.toast(r === 'copied' ? 'Copied' : r === 'shared' ? 'Shared' : r === 'cancelled' ? 'Cancelled' : 'Select the text and copy it', 'ph-copy'); },
      dl: () => U.downloadText(`${filename}-${U.todayStr()}.txt`, text)
    }) });
  },

  // ---------- clinical questions ----------
  async renderCQs({ show = 'open' } = {}) {
    const all = (await DB.getAll('clinicalQuestions')).sort(U.by(q => q.date)).reverse();
    const list = all.filter(q => show === 'answered' ? q.answered : !q.answered);
    return `${UI.header('Clinical questions', { right: '<button class="icon-btn" data-act="add" aria-label="New question"><i class="ph ph-plus"></i></button>' })}
      ${Logs.PID_NOTE}
      <div class="seg" style="margin-bottom:12px"><button class="${show === 'open' ? 'on' : ''}" data-act="show" data-v="open">To answer (${all.filter(q => !q.answered).length})</button>
        <button class="${show === 'answered' ? 'on' : ''}" data-act="show" data-v="answered">Answered (${all.filter(q => q.answered).length})</button></div>
      ${list.map(q => `<div class="card"><div class="muted tiny">${U.fmtDate(q.date, { year: true })}${q.reflection ? ' · reflection written' : ''}</div>
        <div style="font-weight:800" class="pre">${U.esc(q.question)}</div>
        ${q.answered ? `<p class="small pre" style="margin-top:4px">${U.esc(q.answer || '')}</p>${q.source ? `<p class="tiny muted">Source: ${U.esc(q.source)}</p>` : ''}` : ''}
        <div class="btn-wrap">${q.answered ? `<button class="btn btn-small btn-primary" data-act="reflect" data-id="${q.id}"><i class="ph ph-notebook"></i> ${q.reflection ? 'Edit reflection' : 'Turn into CPD reflection'}</button>`
          : `<button class="btn btn-small btn-primary" data-act="answer" data-id="${q.id}"><i class="ph ph-check"></i> Answer</button>`}
          ${q.reflection ? `<button class="btn btn-small btn-ghost" data-act="export" data-id="${q.id}"><i class="ph ph-export"></i> Export</button>` : ''}
          <button class="btn btn-small btn-ghost" data-act="video" data-id="${q.id}"><i class="ph ph-video-camera"></i> Turn into video</button>
          <button class="btn btn-small btn-ghost" data-act="edit" data-id="${q.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div></div>`).join('')
        || UI.empty(show === 'open' ? 'No open questions. Capture one when it comes up on the ward.' : 'No answered questions yet.', 'ph-question')}
      ${show === 'answered' && all.some(q => q.reflection) ? '<button class="btn btn-ghost btn-block" data-act="exportAll"><i class="ph ph-export"></i> Export all reflections as text</button>' : ''}`;
  },
  reflectionText(q) {
    const r = q.reflection || {};
    return `CPD reflection — ${U.fmtDate(r.date || q.date, { year: true, dow: false })}\nClinical question: ${q.question}\nAnswer: ${q.answer || ''}${q.source ? `\nSource: ${q.source}` : ''}\n\nWhat happened:\n${r.happened || ''}\n\nWhat I learned:\n${r.learned || ''}\n\nWhat I will change:\n${r.change || ''}\n`;
  },
  cqActions() {
    const get = (id) => DB.get('clinicalQuestions', id);
    const save = async (q, msg) => { await Repo.put('clinicalQuestions', q); if (msg) UI.toast(msg); await App.changed({ celebrate: false }); };
    return {
      show: (el) => Nav.go('clinicalQs', { show: el.dataset.v }, { replace: true }),
      add: () => Logs.editCQ(null),
      edit: async (el) => Logs.editCQ(await get(el.dataset.id)),
      answer: async (el) => {
        const q = await get(el.dataset.id);
        const f = await UI.form('Answer', [{ name: 'answer', type: 'textarea', label: 'Short answer', value: q.answer || '', required: true, rows: 4 },
          { name: 'source', label: 'Source (guideline, paper, senior…)', value: q.source || '' }], { intro: Logs.PID_NOTE });
        if (!f) return;
        Object.assign(q, f, { answered: true, answeredDate: U.todayStr() });
        await save(q, 'Answered! +XP');
        if (await UI.confirm('Turn this into a CPD / portfolio reflection now?', { ok: 'Write reflection', cancel: 'Later', title: 'Reflection' })) Logs.reflect(q.id);
      },
      reflect: (el) => Logs.reflect(el.dataset.id),
      export: async (el) => { const q = await get(el.dataset.id); Logs.exportText('Reflection', Logs.reflectionText(q), 'reflection'); },
      exportAll: async () => {
        const list = (await DB.getAll('clinicalQuestions')).filter(q => q.reflection).sort(U.by(q => q.date));
        Logs.exportText('Reflections', list.map(Logs.reflectionText).join('\n----------\n\n'), 'reflections');
      },
      video: async (el) => { const q = await get(el.dataset.id); Logs.turnIntoVideo({ title: q.question, notes: q.answer || '', source: 'Clinical question', areaId: 'a3' }); }
    };
  },
  async editCQ(q) {
    const f = await UI.form(q ? 'Edit question' : 'New clinical question', [
      { name: 'question', type: 'textarea', label: 'Question', value: q ? q.question : '', required: true, rows: 3, placeholder: 'e.g. When should anticoagulation restart after spinal surgery?' },
      { name: 'date', type: 'date', label: 'Date', value: q ? q.date : U.todayStr() },
      ...(q && q.answered ? [{ name: 'answer', type: 'textarea', label: 'Answer', value: q.answer, rows: 3 }, { name: 'source', label: 'Source', value: q.source }] : [])
    ], { intro: Logs.PID_NOTE, buttons: q ? [{ label: 'Delete', value: 'del', danger: true }] : [] });
    if (!f) return;
    if (f._button === 'del') { if (await UI.confirm('Delete this question?', { ok: 'Delete', danger: true })) await Repo.del('clinicalQuestions', q.id); }
    else await Repo.put('clinicalQuestions', { ...(q || { id: U.uid('cq'), answered: false, areaId: 'a3' }), ...f });
    UI.toast(q ? 'Saved' : 'Question logged'); await App.changed({ celebrate: false });
  },
  async reflect(id) {
    const q = await DB.get('clinicalQuestions', id);
    const r = q.reflection || {};
    const f = await UI.form('CPD / portfolio reflection', [
      { name: 'happened', type: 'textarea', label: 'What happened', value: r.happened || '', rows: 3 },
      { name: 'learned', type: 'textarea', label: 'What I learned', value: r.learned || q.answer || '', rows: 3 },
      { name: 'change', type: 'textarea', label: 'What I will change', value: r.change || '', rows: 3 }
    ], { intro: Logs.PID_NOTE, submit: 'Save reflection' });
    if (!f) return;
    q.reflection = { ...f, date: r.date || U.todayStr() };
    await Repo.put('clinicalQuestions', q);
    UI.toast('Reflection saved — counts for Clinical work today', 'ph-notebook');
    await App.changed();
  },

  // ---------- spaced topic review ----------
  STATUS: { notStarted: 'Not started', revised: 'Revised', confident: 'Confident' },
  intervals() { const v = App.settings.topicIntervals; return Array.isArray(v) && v.length ? v : [1, 7, 30, 90]; },
  nextAfter(topic, rating, date = U.todayStr()) {
    const iv = Logs.intervals();
    let step = Number(topic.step) || 0;
    if (rating === 'hard') step = 0;
    else if (rating === 'easy') step += 2;
    else step += 1;
    let days;
    if (step < iv.length) days = iv[step];
    else days = Math.round(iv[iv.length - 1] * Math.pow(rating === 'easy' ? 2 : 1.5, step - iv.length + 1));
    if (rating === 'hard') days = iv[0];
    return { step, nextReview: U.addDays(date, days), days };
  },
  dueTopics(topics) { const t = U.todayStr(); return topics.filter(x => x.reviewOn !== false && x.nextReview && x.nextReview <= t); },
  async renderTopics({ show = 'due' } = {}) {
    const all = (await DB.getAll('topics')).sort(U.by(t => t.title.toLowerCase()));
    const due = Logs.dueTopics(all);
    const list = show === 'due' ? due : all.filter(t => show === 'all' || t.mapStatus === show);
    const cov = all.length ? Math.round(100 * U.sum(all, t => t.mapStatus === 'confident' ? 1 : t.mapStatus === 'revised' ? 0.5 : 0) / all.length) : 0;
    return `${UI.header('Topics & spaced review', { right: '<button class="icon-btn" data-act="add" aria-label="Add topic"><i class="ph ph-plus"></i></button>' })}
      <div class="card"><div class="cal-head"><h3>Coverage ${cov}%</h3><span class="muted small">${all.filter(t => t.mapStatus === 'confident').length} confident · ${all.filter(t => t.mapStatus === 'revised').length} revised · ${all.filter(t => (t.mapStatus || 'notStarted') === 'notStarted').length} not started</span></div>
        ${UI.progress(cov, 100, '#7048E8')}<p class="tiny muted" style="margin-top:4px">Confident = 1, revised = ½, not started = 0. Reviews at ${Logs.intervals().join(', ')} days (edit in Settings › Planning).</p></div>
      <div class="chips" style="margin-bottom:8px">${[['due', `Due (${due.length})`], ['all', `All (${all.length})`], ['notStarted', 'Not started'], ['revised', 'Revised'], ['confident', 'Confident']]
        .map(([v, l]) => `<button class="chip ${show === v ? 'on' : ''}" data-act="show" data-v="${v}">${l}</button>`).join('')}</div>
      ${list.map(t => {
        const isDue = due.includes(t);
        const pct = t.qDone ? Math.round(100 * (t.qCorrect || 0) / t.qDone) : null;
        return `<div class="card"><div class="cal-head"><div><div style="font-weight:800">${U.esc(t.title)}</div>
          <div class="muted tiny">${Logs.STATUS[t.mapStatus || 'notStarted']}${t.reviewOn === false ? ' · review off' : t.nextReview ? ` · next review ${U.relDay(t.nextReview)}` : ''}${(t.reviews || []).length ? ` · ${t.reviews.length} reviews` : ''}${pct != null ? ` · Qbank ${pct}% of ${t.qDone}` : ''}</div></div>
          ${isDue ? '<span class="tag warn">due</span>' : ''}</div>
          <div class="btn-wrap">${isDue ? ['easy', 'okay', 'hard'].map(r => `<button class="btn btn-small ${r === 'okay' ? 'btn-primary' : 'btn-ghost'}" data-act="rate" data-id="${t.id}" data-r="${r}">${r === 'easy' ? '😀 Easy' : r === 'okay' ? '🙂 Okay' : '😓 Hard'}</button>`).join('') : ''}
            <button class="btn btn-small btn-ghost" data-act="status" data-id="${t.id}">${Logs.STATUS[t.mapStatus || 'notStarted']} ▾</button>
            <button class="btn btn-small btn-ghost" data-act="video" data-id="${t.id}" aria-label="Turn into video"><i class="ph ph-video-camera"></i></button>
            <button class="btn btn-small btn-ghost" data-act="edit" data-id="${t.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div></div>`;
      }).join('') || UI.empty(show === 'due' ? 'No reviews due. Well done!' : 'No topics here yet.', 'ph-brain')}`;
  },
  topicsActions(p = {}) {
    const get = (id) => DB.get('topics', id);
    return {
      show: (el) => Nav.go('topics', { ...p, show: el.dataset.v }, { replace: true }),
      add: () => Logs.editTopic(null),
      edit: async (el) => Logs.editTopic(await get(el.dataset.id)),
      rate: async (el) => {
        const t = await get(el.dataset.id);
        const n = Logs.nextAfter(t, el.dataset.r);
        t.step = n.step; t.nextReview = n.nextReview;
        t.reviews = [...(t.reviews || []), { date: U.todayStr(), rating: el.dataset.r }];
        if ((t.mapStatus || 'notStarted') === 'notStarted') t.mapStatus = 'revised';
        await Repo.put('topics', t);
        UI.toast(`Next review in ${n.days} day${n.days === 1 ? '' : 's'} · +5 XP`, 'ph-brain');
        await App.changed();
      },
      status: async (el) => {
        const t = await get(el.dataset.id);
        const v = await UI.choose(t.title, Object.entries(Logs.STATUS).map(([k, l]) => ({ value: k, label: l + (k === (t.mapStatus || 'notStarted') ? '  ✓' : '') })));
        if (!v) return;
        t.mapStatus = v;
        if (v !== 'notStarted' && t.reviewOn !== false && !t.nextReview) { t.nextReview = U.addDays(U.todayStr(), Logs.intervals()[0]); t.step = 0; }
        await Repo.put('topics', t); await App.changed({ celebrate: false });
      },
      video: async (el) => { const t = await get(el.dataset.id); Logs.turnIntoVideo({ title: t.title, notes: t.notes || '', source: 'Study topic', areaId: 'a4' }); }
    };
  },
  async editTopic(t, preset = {}) {
    const f = await UI.form(t ? 'Edit topic' : 'New topic', [
      { name: 'title', label: 'Topic', value: t ? t.title : preset.title || '', required: true, placeholder: 'e.g. A guideline or condition to revise' },
      { name: 'mapStatus', type: 'select', label: 'Status', value: t ? t.mapStatus || 'notStarted' : 'revised', options: Object.entries(Logs.STATUS).map(([v, l]) => ({ value: v, label: l })) },
      { name: 'reviewOn', type: 'checkbox', label: 'Schedule spaced reviews', value: t ? t.reviewOn !== false : true },
      { name: 'group', label: 'Group / syllabus section (optional)', value: t ? t.group || '' : '' },
      { name: 'notes', type: 'textarea', label: 'Notes', value: t ? t.notes || '' : '', rows: 2 }
    ], { buttons: t ? [{ label: 'Delete topic', value: 'del', danger: true }] : [] });
    if (!f) return;
    if (f._button === 'del') { if (await UI.confirm('Delete this topic and its review history?', { ok: 'Delete', danger: true })) await Repo.del('topics', t.id); }
    else {
      const base = t || { id: U.uid('top'), areaId: 'a4', step: -1, reviews: [], qDone: 0, qCorrect: 0 };
      const obj = { ...base, ...f };
      // The first review uses interval 1 (step 0); rating it "okay" then moves on to interval 2.
      if (!t && f.reviewOn && f.mapStatus !== 'notStarted') { obj.nextReview = U.addDays(U.todayStr(), Logs.intervals()[0]); obj.step = 0; }
      if (!f.reviewOn) obj.nextReview = obj.nextReview || '';
      await Repo.put('topics', obj);
    }
    await App.changed({ celebrate: false });
  },

  // ---------- "Turn into video" → MedTwins idea bank ----------
  async turnIntoVideo({ title, notes = '', source = '', areaId = null }) {
    const f = await UI.form('Turn into a video idea', [
      { name: 'title', label: 'Video idea', value: title, required: true },
      { name: 'notes', type: 'textarea', label: 'Angle / notes', value: notes, rows: 3 }
    ], { submit: 'Send to idea bank', intro: '<p class="sheet-text">Saved in the MedTwins idea bank. Check it contains no patient-identifiable information and nothing from unpublished research you want to keep private.</p>' });
    if (!f) return null;
    const idea = await Repo.put('videoIdea', { id: U.uid('vi'), title: f.title, notes: f.notes, source, fromAreaId: areaId, interest: 3, effort: 3, evergreen: false, status: 'idea' });
    UI.toast('Sent to the MedTwins idea bank', 'ph-video-camera');
    await App.changed({ celebrate: false });
    return idea;
  }
};
window.Logs = Logs;

// Today: deadlines within the window (Settings › Planning) as one countdown line. The urgent
// 3-day alerts and due topic reviews are in-app reminders (review.js) and can be switched off.
Today.bannerHooks.push(async (day) => {
  if (day.date !== U.todayStr()) return [];
  const dls = (App.cache.deadlinesSoon || []).filter(d => U.diffDays(U.todayStr(), d.date) > 3 || App.settings.reminders.deadlines === false);
  if (!dls.length) return [];
  const n = (d) => U.diffDays(U.todayStr(), d.date);
  return [{ cls: 'info', icon: 'ph-hourglass-medium', act: 'go', data: { view: 'deadlines' },
    text: dls.slice(0, 2).map(d => `${d.title} ${n(d) === 0 ? 'today' : n(d) === 1 ? 'tomorrow' : `in ${n(d)}d`}`).join(' · ') + (dls.length > 2 ? ` · +${dls.length - 2} more` : '') }];
});

// Area streak sources: reflections count for Clinical work, topic reviews for Medical study.
Streaks.extraSources.push(async () => {
  const out = [];
  (await DB.getAll('clinicalQuestions')).forEach(q => { if (q.reflection && q.reflection.date) out.push({ areaId: 'a3', date: q.reflection.date, n: 1, tag: 'reflection' }); });
  (await DB.getAll('topics')).forEach(t => {
    const days = [...new Set((t.reviews || []).map(r => r.date))];
    days.forEach(d => out.push({ areaId: t.areaId || 'a4', date: d, n: 1, tag: 'topicReview' }));
  });
  return out;
});

Nav.register('waiting', { tab: 'more', render: (p) => Logs.renderWaiting(p), actions: () => Logs.waitingActions() });
Nav.register('deadlines', { tab: 'more', render: (p) => Logs.renderDeadlines(p), actions: (p) => Logs.deadlinesActions(p) });
Nav.register('wins', { tab: 'more', render: (p) => Logs.renderWins(p), actions: (p) => Logs.winsActions(p) });
Nav.register('clinicalQs', { tab: 'more', render: (p) => Logs.renderCQs(p), actions: () => Logs.cqActions() });
Nav.register('topics', { tab: 'more', render: (p) => Logs.renderTopics(p), actions: (p) => Logs.topicsActions(p) });
