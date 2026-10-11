// ======= boards.js — boards with editable stages, cards, checklists and research project tools =======

const Boards = {
  ASSIGNEES: ['Me', 'Twin', 'Both'],
  FORMATS: ['Short', 'Big words (short)', 'Long video', 'Reaction', 'Big challenge'],

  async all() { return (await DB.getAll('boards')).sort(U.by(b => b.order ?? 99)); },
  async cardsOf(boardId) { return (await DB.getAll('cards')).filter(c => c.boardId === boardId && !c.archived); },
  stageOf(board, id) { return (board.stages || []).find(s => s.id === id) || (board.stages || [])[0]; },
  stageIndex(board, id) { return Math.max(0, (board.stages || []).findIndex(s => s.id === id)); },
  isLast(board, stageId) { const st = board.stages || []; return !!st.length && st[st.length - 1].id === stageId; },
  daysInStage(card) { return U.diffDays(card.enteredStageAt || U.todayStr(), U.todayStr()); },
  staleLimit(board, stageId) { const s = Boards.stageOf(board, stageId); return Number((s && s.staleDays) || board.staleDays || 21); },
  isStuck(board, card) { return !Boards.isLast(board, card.stageId) && Boards.daysInStage(card) > Boards.staleLimit(board, card.stageId); },

  // ---------- boards hub ----------
  async renderHub() {
    const boards = await Boards.all();
    const cards = (await DB.getAll('cards')).filter(c => !c.archived);
    return `${UI.header('Boards', { back: false, right: '<button class="icon-btn" data-act="add" aria-label="New board"><i class="ph ph-plus"></i></button>' })}
      <div class="list">${boards.map(b => {
        const list = cards.filter(c => c.boardId === b.id);
        const stuck = list.filter(c => Boards.isStuck(b, c)).length;
        const a = App.areaById(b.areaId);
        return UI.row({ icon: b.video ? 'ph-video-camera' : b.projectType ? 'ph-flask' : 'ph-kanban', color: a ? a.color : '', title: U.esc(b.name),
          sub: `${list.length} card${list.length === 1 ? '' : 's'} · ${(b.stages || []).length} stages${stuck ? ` · <b style="color:var(--warn)">${stuck} stuck</b>` : ''}${a ? ` · ${U.esc(a.name)}` : ''}`,
          act: 'open', data: { id: b.id } });
      }).join('') || UI.empty('No boards yet.', 'ph-kanban')}</div>
      <div class="list">${Nav.views.waiting ? UI.row({ icon: 'ph-hand-palm', title: 'Waiting on', sub: 'Things other people owe you', act: 'go', data: { view: 'waiting' } }) : ''}
        ${Nav.views.deadlines ? UI.row({ icon: 'ph-hourglass-medium', title: 'Deadlines', sub: 'Countdowns linked to boards and areas', act: 'go', data: { view: 'deadlines' } }) : ''}</div>
      <p class="muted small">Research project boards hold one project type each: editing a board's stages changes that type's stage list.</p>`;
  },
  hubActions() {
    return {
      open: (el) => Nav.go('board', { id: el.dataset.id }),
      go: (el) => Nav.go(el.dataset.view),
      add: async () => {
        const f = await UI.form('New board', [
          { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Grant application, Exam prep' },
          { name: 'areaId', type: 'select', label: 'Area', value: '', options: UI.areaOptions(true) },
          { name: 'stages', type: 'textarea', label: 'Stages (one per line)', value: 'To do\nDoing\nDone', rows: 5 },
          { name: 'staleDays', type: 'number', label: 'Highlight cards stuck longer than (days)', value: 21, min: 1 }
        ], { submit: 'Create board' });
        if (!f) return;
        const names = f.stages.split('\n').map(x => x.trim()).filter(Boolean);
        const boards = await Boards.all();
        const stale = Number(f.staleDays) || 21;
        const b = await Repo.put('boards', { id: U.uid('b'), name: f.name, areaId: f.areaId || null, order: boards.length + 1, projectType: false, video: false,
          staleDays: stale, stages: (names.length ? names : ['To do', 'Done']).map(n => ({ id: U.uid('s'), name: n, staleDays: stale })), stageChecklists: {} });
        await App.changed({ celebrate: false });
        Nav.go('board', { id: b.id });
      }
    };
  },

  // ---------- one board ----------
  cardHtml(board, c) {
    const a = App.areaById(c.areaId || board.areaId);
    const stuck = Boards.isStuck(board, c);
    const due = c.due ? `<span class="tag ${c.due < U.todayStr() ? 'bad' : U.diffDays(U.todayStr(), c.due) <= 7 ? 'warn' : ''}">due ${U.fmtDate(c.due)}</span>` : '';
    return `<button class="kcard ${stuck ? 'stuck' : ''}" style="--c:${a ? a.color : 'var(--line)'}" data-act="card" data-id="${c.id}">
      <div class="t">${U.esc(c.title)}</div>
      ${c.nextAction ? `<div class="na"><i class="ph ph-arrow-right"></i> ${U.esc(c.nextAction)}</div>` : ''}
      <div class="meta">${due}${board.video && c.videoType ? `<span class="tag good">${U.esc(c.videoType)}</span>` : ''}${board.video && c.assignee ? `<span class="tag info">${U.esc(c.assignee)}</span>` : ''}${c.specialty ? `<span class="tag">${U.esc(c.specialty)}</span>` : ''}
        ${stuck ? `<span class="tag warn">stuck ${Boards.daysInStage(c)} days</span>` : `<span class="tag">${Boards.daysInStage(c)}d in stage</span>`}</div></button>`;
  },
  async renderBoard({ id, stage, fmt }) {
    const b = await DB.get('boards', id);
    if (!b) return `${UI.header('Board')}${UI.empty('Board not found.')}`;
    const allCards = await Boards.cardsOf(id);
    const cards = b.video && fmt ? allCards.filter(c => (c.videoType || '') === fmt) : allCards;
    const showStage = stage || 'all';
    const stages = (b.stages || []).filter(s => showStage === 'all' || s.id === showStage);
    return `${UI.header(b.name, { right: `<button class="icon-btn" data-act="addCard" aria-label="Add card"><i class="ph ph-plus"></i></button>
        <button class="icon-btn" data-act="menu" aria-label="Board options"><i class="ph ph-dots-three-outline"></i></button>` })}
      ${b.video ? `<div class="chips" style="margin-bottom:6px"><button class="chip ${!fmt ? 'on' : ''}" data-act="fmt" data-v="">All formats</button>${Boards.FORMATS.map(x => `<button class="chip ${fmt === x ? 'on' : ''}" data-act="fmt" data-v="${U.esc(x)}">${U.esc(x)} (${allCards.filter(c => c.videoType === x).length})</button>`).join('')}</div>` : ''}
      <div class="chips" style="margin-bottom:10px"><button class="chip ${showStage === 'all' ? 'on' : ''}" data-act="filter" data-v="all">All (${cards.length})</button>
        ${(b.stages || []).map(s => `<button class="chip ${showStage === s.id ? 'on' : ''}" data-act="filter" data-v="${s.id}">${U.esc(s.name)} (${cards.filter(c => c.stageId === s.id).length})</button>`).join('')}</div>
      ${stages.map(s => {
        const list = cards.filter(c => c.stageId === s.id).sort(U.by(c => c.due || '9999'));
        return `<div class="stage"><div class="stage-head">${U.esc(s.name)} <span class="badge">${list.length}</span>
          ${(b.stageChecklists || {})[s.id] ? '<i class="ph ph-list-checks" aria-label="Has a checklist"></i>' : ''}</div>
          ${list.map(c => Boards.cardHtml(b, c)).join('') || (showStage === 'all' ? '' : '<p class="muted small" style="margin:0 4px 8px">No cards.</p>')}</div>`;
      }).join('')}`;
  },
  boardActions({ id, stage, fmt }) {
    return {
      filter: (el) => Nav.go('board', { id, stage: el.dataset.v, fmt }, { replace: true }),
      fmt: (el) => Nav.go('board', { id, stage, fmt: el.dataset.v }, { replace: true }),
      card: (el) => Nav.go('card', { id: el.dataset.id }),
      addCard: async () => { const b = await DB.get('boards', id); await Boards.newCardSheet({ boardId: id, areaId: b.areaId }); },
      menu: async () => {
        const b = await DB.get('boards', id);
        const v = await UI.choose(b.name, [
          { value: 'stages', label: 'Edit stages', sub: 'Add, rename, reorder, delete, stuck limits, checklists', icon: 'ph-columns' },
          { value: 'edit', label: 'Rename / area / stuck limit', icon: 'ph-pencil-simple' },
          ...(b.video ? [{ value: 'share', label: 'Share board summary', sub: 'Text to send to your twin', icon: 'ph-share-network' }] : []),
          { value: 'archived', label: 'Archived cards', icon: 'ph-archive' },
          { value: 'del', label: 'Delete board', icon: 'ph-trash', danger: true }]);
        if (v === 'stages') Nav.go('boardStages', { id });
        else if (v === 'edit') {
          const f = await UI.form('Board', [{ name: 'name', label: 'Name', value: b.name, required: true },
            { name: 'areaId', type: 'select', label: 'Area', value: b.areaId || '', options: UI.areaOptions(true) },
            { name: 'staleDays', type: 'number', label: 'Default "stuck" limit (days)', value: b.staleDays || 21, min: 1 },
            { name: 'video', type: 'checkbox', label: 'Video board (assignee Me / Twin / Both, share summary)', value: !!b.video },
            { name: 'projectType', type: 'checkbox', label: 'Research project type (offered by "Start project")', value: !!b.projectType }]);
          if (f) { Object.assign(b, f, { areaId: f.areaId || null, staleDays: Number(f.staleDays) || 21 }); await Repo.put('boards', b); await App.changed({ celebrate: false }); }
        } else if (v === 'share') Boards.shareSummary(b);
        else if (v === 'archived') Nav.go('archivedCards', { id });
        else if (v === 'del') {
          const n = (await Boards.cardsOf(id)).length;
          if (await UI.confirm(`Delete "${b.name}"${n ? ` and its ${n} card${n > 1 ? 's' : ''}` : ''}? This cannot be undone.`, { ok: 'Delete board', danger: true })) {
            for (const c of await DB.getAll('cards')) if (c.boardId === id) await Repo.del('cards', c.id);
            await Repo.del('boards', id); await App.changed({ celebrate: false }); Nav.go('boards', {}, { root: true });
          }
        }
      }
    };
  },
  async summaryText(b) {
    const cards = await Boards.cardsOf(b.id);
    const lines = [`${b.name} — ${U.fmtDate(U.todayStr(), { year: true })}`, ''];
    for (const s of b.stages || []) {
      const list = cards.filter(c => c.stageId === s.id);
      if (!list.length) continue;
      lines.push(s.name.toUpperCase());
      list.forEach(c => lines.push(`• ${c.title}${c.assignee ? ` [${c.assignee}]` : ''}${c.nextAction ? ` → next: ${c.nextAction}` : ''}${c.due ? ` (due ${U.fmtDate(c.due)})` : ''}${c.publishDate ? ` (publish ${U.fmtDate(c.publishDate)})` : ''}`));
      lines.push('');
    }
    return lines.join('\n');
  },
  async shareSummary(b) {
    const text = await Boards.summaryText(b);
    const r = await U.shareText(b.name, text);
    if (r === 'failed') UI.sheet({ title: 'Board summary', html: `<p class="sheet-text">Select and copy:</p><textarea rows="12" readonly>${U.esc(text)}</textarea>` });
    else UI.toast(r === 'copied' ? 'Summary copied — paste it in a message' : r === 'shared' ? 'Shared' : 'Cancelled', 'ph-share-network');
  },

  // New card: choose board + stage (used by boards, inbox triage, "turn into video", ideas).
  async newCardSheet({ title = '', areaId = null, boardId = '', stageId = '', notes = '', nextAction = '', extra = {} } = {}) {
    const boards = await Boards.all();
    if (!boards.length) { UI.toast('Create a board first', 'ph-kanban'); return null; }
    const b0 = boards.find(b => b.id === boardId) || boards[0];
    const stageOptions = (b) => (b.stages || []).map(s => ({ value: s.id, label: s.name }));
    const f = await UI.form('New card', [
      { name: 'title', label: 'Title', value: title, required: true },
      { name: 'boardId', type: 'select', label: 'Board', value: b0.id, options: boards.map(b => ({ value: b.id, label: b.name })) },
      { name: 'stageId', type: 'select', label: 'Stage', value: stageId || (b0.stages[0] || {}).id, options: stageOptions(b0) },
      { name: 'nextAction', label: 'Next action', value: nextAction, placeholder: 'The very next physical step' },
      { name: 'due', type: 'date', label: 'Due date (optional)' },
      { name: 'notes', type: 'textarea', label: 'Notes', value: notes, rows: 2 }
    ], { submit: 'Add card', onMount: (form) => {
      const bs = form.querySelector('[name="boardId"]'), ss = form.querySelector('[name="stageId"]');
      bs.addEventListener('change', () => {
        const b = boards.find(x => x.id === bs.value);
        ss.innerHTML = stageOptions(b).map(o => `<option value="${o.value}">${U.esc(o.label)}</option>`).join('');
      });
    } });
    if (!f) return null;
    const b = boards.find(x => x.id === f.boardId);
    const sid = (b.stages.find(s => s.id === f.stageId) || b.stages[0]).id;
    const card = await Repo.put('cards', { id: U.uid('c'), title: f.title, boardId: b.id, stageId: sid,
      nextAction: f.nextAction, due: f.due, notes: f.notes, areaId: areaId || b.areaId || null, assignee: b.video ? 'Both' : '',
      enteredStageAt: U.todayStr(), history: [{ stageId: sid, date: U.todayStr() }], ...extra });
    UI.toast(`Added to ${b.name}`, 'ph-kanban');
    await App.changed({ celebrate: false });
    return card;
  },

  // ---------- stages editor ----------
  async renderStages({ id }) {
    const b = await DB.get('boards', id);
    const cards = await Boards.cardsOf(id);
    return `${UI.header(`${b.name}: stages`, { right: '<button class="icon-btn" data-act="add" aria-label="Add stage"><i class="ph ph-plus"></i></button>' })}
      <div class="list">${(b.stages || []).map((s, i) => {
        const cl = (b.stageChecklists || {})[s.id];
        return `<div class="row"><button class="row-main" data-act="edit" data-i="${i}" style="text-align:left"><span class="row-title">${i + 1}. ${U.esc(s.name)}</span>
          <span class="row-sub">${cards.filter(c => c.stageId === s.id).length} cards · stuck after ${s.staleDays || b.staleDays || 21} days${cl ? ` · checklist (${cl.length})` : ''}</span></button>
          <button class="icon-btn" data-act="up" data-i="${i}" aria-label="Move up" ${i ? '' : 'disabled'}><i class="ph ph-arrow-up"></i></button>
          <button class="icon-btn" data-act="down" data-i="${i}" aria-label="Move down" ${i < b.stages.length - 1 ? '' : 'disabled'}><i class="ph ph-arrow-down"></i></button></div>`;
      }).join('')}</div>
      <p class="muted small">Tap a stage to rename it, change its stuck limit, add a checklist or delete it. A card can only move on from a stage once that stage's checklist is ticked (e.g. the pre-upload check).</p>`;
  },
  stagesActions({ id }) {
    const save = async (b) => { await Repo.put('boards', b); await App.changed({ celebrate: false }); };
    const swap = async (i, d) => { const b = await DB.get('boards', id); const j = i + d; if (j < 0 || j >= b.stages.length) return; [b.stages[i], b.stages[j]] = [b.stages[j], b.stages[i]]; await save(b); };
    return {
      up: (el) => swap(Number(el.dataset.i), -1),
      down: (el) => swap(Number(el.dataset.i), 1),
      add: async () => {
        const b = await DB.get('boards', id);
        const f = await UI.form('New stage', [{ name: 'name', label: 'Name', required: true },
          { name: 'after', type: 'select', label: 'Place after', value: b.stages.length ? b.stages[b.stages.length - 1].id : '', options: [{ value: '', label: '(first)' }, ...b.stages.map(s => ({ value: s.id, label: s.name }))] }]);
        if (!f) return;
        const i = f.after ? b.stages.findIndex(s => s.id === f.after) + 1 : 0;
        b.stages.splice(i, 0, { id: U.uid('s'), name: f.name, staleDays: b.staleDays || 21 });
        await save(b);
      },
      edit: async (el) => {
        const b = await DB.get('boards', id);
        const s = b.stages[Number(el.dataset.i)];
        const cl = (b.stageChecklists || {})[s.id] || [];
        const f = await UI.form('Stage', [{ name: 'name', label: 'Name', value: s.name, required: true },
          { name: 'staleDays', type: 'number', label: 'Highlight cards stuck here longer than (days)', value: s.staleDays || b.staleDays || 21, min: 1 },
          { name: 'checklist', type: 'textarea', label: 'Checklist before leaving this stage (one per line, optional)', value: cl.join('\n'), rows: 4 }],
        { buttons: [{ label: 'Delete stage', value: 'del', danger: true }] });
        if (!f) return;
        if (f._button === 'del') {
          if (b.stages.length < 2) { UI.toast('A board needs at least one stage', 'ph-warning'); return; }
          const cards = (await Boards.cardsOf(id)).filter(c => c.stageId === s.id);
          const target = b.stages.find(x => x.id !== s.id);
          if (!(await UI.confirm(`Delete "${s.name}"?${cards.length ? ` Its ${cards.length} card(s) move to "${target.name}".` : ''}`, { ok: 'Delete', danger: true }))) return;
          for (const c of cards) { c.stageId = target.id; c.enteredStageAt = U.todayStr(); await Repo.put('cards', c); }
          b.stages = b.stages.filter(x => x.id !== s.id);
          if (b.stageChecklists) delete b.stageChecklists[s.id];
        } else {
          s.name = f.name; s.staleDays = Number(f.staleDays) || 21;
          b.stageChecklists = b.stageChecklists || {};
          const items = f.checklist.split('\n').map(x => x.trim()).filter(Boolean);
          if (items.length) b.stageChecklists[s.id] = items; else delete b.stageChecklists[s.id];
        }
        await save(b);
      }
    };
  },

  // ---------- one card ----------
  async renderCard({ id, tab = 'card' }) {
    const c = await DB.get('cards', id);
    if (!c) return `${UI.header('Card')}${UI.empty('This card no longer exists.')}`;
    const b = await DB.get('boards', c.boardId);
    if (!b) return `${UI.header(c.title)}${UI.empty('Its board was deleted.')}`;
    const s = Boards.stageOf(b, c.stageId);
    const idx = Boards.stageIndex(b, c.stageId);
    const research = b.projectType || c.ideaId;
    const cl = (b.stageChecklists || {})[c.stageId];
    const checks = (c.checks || {})[c.stageId] || [];
    const tabs = research ? ['card', 'checklists', 'journals', 'log'] : ['card'];
    const tabLabel = { card: 'Card', checklists: 'Reporting', journals: 'Journals', log: 'Decisions' };
    let body = '';
    if (tab === 'card') {
      body = `<div class="card">
        <div class="muted small">${U.esc(b.name)} · stage ${idx + 1} of ${b.stages.length}</div>
        <h2 style="margin:2px 0 6px">${U.esc(s ? s.name : '')}</h2>
        ${Boards.isStuck(b, c) ? `<div class="note warn"><i class="ph ph-warning"></i><span>Stuck for ${Boards.daysInStage(c)} days (limit ${Boards.staleLimit(b, c.stageId)}). What's the smallest next step?</span></div>` : `<div class="muted small">${Boards.daysInStage(c)} days in this stage</div>`}
        <div class="btn-wrap">
          <button class="btn btn-small btn-ghost" data-act="move" data-d="-1" ${idx ? '' : 'disabled'}><i class="ph ph-arrow-left"></i> Back</button>
          <button class="btn btn-small btn-primary" data-act="move" data-d="1" ${idx < b.stages.length - 1 ? '' : 'disabled'}>Next stage <i class="ph ph-arrow-right"></i></button>
          <button class="btn btn-small btn-ghost" data-act="pickStage"><i class="ph ph-columns"></i> Stage…</button></div></div>
        ${cl ? `<div class="card"><h3><i class="ph ph-list-checks"></i> Before leaving "${U.esc(s.name)}"</h3>
          ${cl.map((it, i) => `<label class="check-row"><input type="checkbox" data-change="check" data-i="${i}" ${checks[i] ? 'checked' : ''}><span>${U.esc(it)}</span></label>`).join('')}</div>` : ''}
        <div class="card"><dl class="kv">
          <dt>Next action</dt><dd>${U.esc(c.nextAction || '—')}</dd>
          <dt>Due</dt><dd>${c.due ? `${U.fmtDate(c.due, { year: true })} (${U.relDay(c.due)})` : '—'}</dd>
          <dt>Area</dt><dd>${U.esc((App.areaById(c.areaId) || {}).name || '—')}</dd>
          ${b.video ? `<dt>Format</dt><dd>${U.esc(c.videoType || '—')}</dd><dt>Assignee</dt><dd>${U.esc(c.assignee || '—')}</dd><dt>Publish</dt><dd>${c.publishDate ? U.fmtDate(c.publishDate, { year: true }) : '—'}</dd>` : ''}
          ${c.specialty ? `<dt>Specialty</dt><dd>${U.esc(c.specialty)}</dd>` : ''}
          <dt>Notes</dt><dd class="pre">${U.esc(c.notes || '—')}</dd></dl>
          <div class="btn-wrap"><button class="btn btn-small btn-ghost" data-act="edit"><i class="ph ph-pencil-simple"></i> Edit</button>
            ${c.nextAction ? '<button class="btn btn-small btn-ghost" data-act="sendDay"><i class="ph ph-calendar-plus"></i> Send next action to a day</button>' : ''}
            ${c.nextAction ? '<button class="btn btn-small btn-ghost" data-act="actionDone"><i class="ph ph-check"></i> Next action done</button>' : ''}
            ${!b.video && window.Logs ? '<button class="btn btn-small btn-ghost" data-act="video"><i class="ph ph-video-camera"></i> Turn into video</button>' : ''}
            ${c.ideaId && Nav.views.idea ? '<button class="btn btn-small btn-ghost" data-act="idea"><i class="ph ph-lightbulb"></i> Linked idea</button>' : ''}
            ${window.Logs ? '<button class="btn btn-small btn-ghost" data-act="deadline"><i class="ph ph-hourglass-medium"></i> Add deadline</button>' : ''}
            <button class="btn btn-small btn-ghost" data-act="archive"><i class="ph ph-archive"></i> Archive</button>
            <button class="btn btn-small btn-danger-ghost" data-act="del"><i class="ph ph-trash"></i> Delete</button></div></div>
        <div class="section-title">History</div>
        <div class="card flat small">${(c.history || []).map(h => `<div>${U.fmtDate(h.date, { year: true })}: ${U.esc((Boards.stageOf(b, h.stageId) || {}).name || '?')}</div>`).join('') || 'No history yet.'}</div>`;
    } else if (tab === 'checklists') {
      const lib = await Repo.all('guideline');
      const att = c.guidelines || [];
      body = `${att.map((g, gi) => {
        const def = lib.find(x => x.id === g.id) || { name: '(deleted checklist)', items: [] };
        const n = def.items.filter((_, i) => (g.checked || [])[i]).length;
        return `<div class="card"><div class="cal-head"><h3>${U.esc(def.name)}</h3><span class="tag">${n}/${def.items.length}</span></div>${UI.progress(n, def.items.length)}
          ${def.items.map((it, i) => `<label class="check-row"><input type="checkbox" data-change="gcheck" data-g="${gi}" data-i="${i}" ${(g.checked || [])[i] ? 'checked' : ''}><span>${U.esc(it)}</span></label>`).join('')}
          <button class="btn btn-small btn-danger-ghost" data-act="detach" data-g="${gi}">Remove from project</button></div>`;
      }).join('') || UI.empty('No reporting checklist attached yet.', 'ph-list-checks')}
        <button class="btn btn-primary btn-block" data-act="attach"><i class="ph ph-plus"></i> Attach a checklist (STROBE, CONSORT, PRISMA, CARE…)</button>
        ${Nav.views.guidelines ? '<button class="btn btn-ghost btn-block" data-act="go" data-view="guidelines">Edit the checklist library</button>' : ''}`;
    } else if (tab === 'journals') {
      body = `${(c.journals || []).map((j, ji) => `<div class="card"><div class="cal-head"><h3>${U.esc(j.name)}</h3><span class="tag ${j.status === 'accepted' ? 'good' : j.status === 'rejected' ? 'bad' : ''}">${U.esc(j.status || 'target')}</span></div>
          <dl class="kv small">${j.wordLimit ? `<dt>Word limit</dt><dd>${U.esc(j.wordLimit)}</dd>` : ''}${j.format ? `<dt>Format</dt><dd class="pre">${U.esc(j.format)}</dd>` : ''}${j.link ? `<dt>Link</dt><dd>${U.esc(j.link)}</dd>` : ''}</dl>
          ${(j.history || []).length ? `<div class="small" style="margin-top:6px">${j.history.map(h => `<div>${U.fmtDate(h.date, { year: true })}: <b>${U.esc(h.event)}</b>${h.note ? ` — ${U.esc(h.note)}` : ''}</div>`).join('')}</div>` : ''}
          <div class="btn-wrap"><button class="btn btn-small btn-primary" data-act="jEvent" data-j="${ji}">Log submission event</button>
            <button class="btn btn-small btn-ghost" data-act="jEdit" data-j="${ji}"><i class="ph ph-pencil-simple"></i> Edit</button></div></div>`).join('') || UI.empty('No target journals yet.', 'ph-newspaper')}
        <button class="btn btn-primary btn-block" data-act="jAdd"><i class="ph ph-plus"></i> Add target journal</button>`;
    } else if (tab === 'log') {
      body = `${[...(c.decisions || [])].reverse().map(d => `<div class="card"><div class="muted tiny">${U.fmtDate(d.date, { year: true })}</div><div style="font-weight:800" class="pre">${U.esc(d.text)}</div>${d.why ? `<div class="small muted pre">Why: ${U.esc(d.why)}</div>` : ''}</div>`).join('') || UI.empty('No decisions logged yet. Record analysis choices and why you made them.', 'ph-notebook')}
        <button class="btn btn-primary btn-block" data-act="dAdd"><i class="ph ph-plus"></i> Log a decision</button>`;
    }
    return `${UI.header(c.title)}
      ${tabs.length > 1 ? `<div class="seg" style="margin-bottom:12px">${tabs.map(t => `<button class="${tab === t ? 'on' : ''}" data-act="tab" data-v="${t}">${tabLabel[t]}</button>`).join('')}</div>` : ''}
      ${body}`;
  },
  // Moves a card (respects the stage checklist). Returns true when moved.
  async moveCard(c, b, stageId) {
    const from = c.stageId;
    const cl = (b.stageChecklists || {})[from];
    const fwd = Boards.stageIndex(b, stageId) > Boards.stageIndex(b, from);
    if (cl && fwd && cl.some((_, i) => !((c.checks || {})[from] || [])[i])) {
      await UI.confirm(`Tick every item in the "${Boards.stageOf(b, from).name}" checklist first.`, { ok: 'OK', cancel: 'Close', title: 'Checklist not complete' });
      return false;
    }
    c.stageId = stageId; c.enteredStageAt = U.todayStr();
    c.history = [...(c.history || []), { stageId, date: U.todayStr() }];
    await Repo.put('cards', c);
    UI.toast(`Moved to ${Boards.stageOf(b, stageId).name}`, 'ph-arrow-right');
    await App.changed({ celebrate: false });
    if (Boards.isLast(b, stageId)) {
      await Otto.celebrate({ title: 'Finished!', sub: `"${c.title}" reached ${Boards.stageOf(b, stageId).name}.`, big: false, kind: (App.areaById(c.areaId) || {}).mascot || 'otter', button: 'Nice!' });
      if (window.Logs && await UI.confirm(`Add "${c.title}" to your Wins log?`, { ok: 'Add win', title: 'Log a win?' })) {
        await Logs.addWin({ title: c.title, type: b.video ? 'video' : b.projectType ? 'paperAccepted' : 'other', areaId: c.areaId, date: U.todayStr(), cardId: c.id });
      }
    }
    return true;
  },
  cardActions({ id }) {
    const load = async () => { const c = await DB.get('cards', id); const b = await DB.get('boards', c.boardId); return { c, b }; };
    const save = async (c, msg) => { await Repo.put('cards', c); if (msg) UI.toast(msg); await App.changed({ celebrate: false }); };
    return {
      tab: (el) => Nav.go('card', { id, tab: el.dataset.v }, { replace: true }),
      go: (el) => Nav.go(el.dataset.view),
      move: async (el) => { const { c, b } = await load(); const i = Boards.stageIndex(b, c.stageId) + Number(el.dataset.d); if (b.stages[i]) await Boards.moveCard(c, b, b.stages[i].id); },
      pickStage: async () => {
        const { c, b } = await load();
        const v = await UI.choose('Move to stage', b.stages.map((s, i) => ({ value: s.id, label: `${i + 1}. ${s.name}${s.id === c.stageId ? '  ✓' : ''}` })));
        if (v && v !== c.stageId) await Boards.moveCard(c, b, v);
      },
      // Saves the whole checklist from the screen, so quick successive ticks can't overwrite each other.
      check: async () => {
        const states = [...document.querySelectorAll('#view [data-change="check"]')].map(cb => cb.checked);
        const { c } = await load();
        c.checks = { ...(c.checks || {}), [c.stageId]: states };
        await Repo.put('cards', c);
      },
      edit: async () => {
        const { c, b } = await load();
        const fields = [{ name: 'title', label: 'Title', value: c.title, required: true },
          { name: 'nextAction', label: 'Next action', value: c.nextAction },
          { name: 'due', type: 'date', label: 'Due date', value: c.due },
          { name: 'areaId', type: 'select', label: 'Area', value: c.areaId || '', options: UI.areaOptions(true) },
          { name: 'notes', type: 'textarea', label: 'Notes', value: c.notes, rows: 4 }];
        if (b.video) fields.push({ name: 'videoType', type: 'select', label: 'Format', value: c.videoType || '', options: [{ value: '', label: '—' }, ...Boards.FORMATS.map(x => ({ value: x, label: x }))] },
          { name: 'assignee', type: 'select', label: 'Assignee', value: c.assignee || 'Both', options: Boards.ASSIGNEES.map(a => ({ value: a, label: a })) },
          { name: 'publishDate', type: 'date', label: 'Planned publish date (content calendar)', value: c.publishDate || '' });
        if (b.projectType) fields.push({ name: 'specialty', type: 'select', label: 'Specialty', value: c.specialty || '', options: [{ value: '', label: '—' }, ...App.settings.research.specialties.map(s => ({ value: s, label: s }))] });
        const f = await UI.form('Edit card', fields);
        if (f) { Object.assign(c, f, { areaId: f.areaId || null }); await save(c, 'Saved'); }
      },
      sendDay: async () => {
        const { c } = await load();
        const d = await More.scheduleSheet(c.nextAction, c.areaId);
        if (d) { UI.toast(`Next action added to ${U.fmtDate(d)}`, 'ph-calendar-plus'); await App.changed({ celebrate: false }); }
      },
      actionDone: async () => {
        const { c } = await load();
        const f = await UI.form('Next action done!', [{ name: 'next', label: 'What is the new next action?', placeholder: 'Leave empty if none' }], { submit: 'Save' });
        if (!f) return;
        c.actionsDone = [...(c.actionsDone || []), { date: U.todayStr(), text: c.nextAction }];
        c.nextAction = f.next; await save(c, 'Nice work');
      },
      video: async () => { const { c } = await load(); Logs.turnIntoVideo({ title: c.title, notes: c.notes, source: `Board card: ${c.title}`, areaId: c.areaId }); },
      idea: async () => { const { c } = await load(); Nav.go('idea', { id: c.ideaId }); },
      deadline: async () => { const { c, b } = await load(); Logs.editDeadline(null, { title: c.title, areaId: c.areaId, boardId: b.id, cardId: c.id }); },
      archive: async () => { const { c } = await load(); c.archived = true; await save(c, 'Archived'); Nav.back(); },
      del: async () => {
        const { c } = await load();
        if (await UI.confirm(`Delete "${c.title}"? This cannot be undone.`, { ok: 'Delete', danger: true })) { await Repo.del('cards', id); await App.changed({ celebrate: false }); Nav.back(); }
      },
      attach: async () => {
        const { c } = await load();
        const lib = await Repo.all('guideline');
        const v = await UI.choose('Attach a reporting checklist', lib.map(g => ({ value: g.id, label: g.name, sub: `${g.items.length} items` })));
        if (!v) return;
        c.guidelines = [...(c.guidelines || []), { id: v, checked: [] }]; await save(c, 'Checklist attached');
      },
      detach: async (el) => {
        const { c } = await load();
        if (!(await UI.confirm('Remove this checklist (and its ticks) from the project?', { ok: 'Remove', danger: true }))) return;
        c.guidelines.splice(Number(el.dataset.g), 1); await save(c);
      },
      gcheck: async (el) => {
        const gi = Number(el.dataset.g);
        const states = [...document.querySelectorAll(`#view [data-change="gcheck"][data-g="${gi}"]`)].map(cb => cb.checked);
        const { c } = await load();
        c.guidelines[gi].checked = states;
        await Repo.put('cards', c); Nav.refresh();
      },
      jAdd: () => Boards.editJournal(id, null),
      jEdit: (el) => Boards.editJournal(id, Number(el.dataset.j)),
      jEvent: async (el) => {
        const { c } = await load();
        const j = c.journals[Number(el.dataset.j)];
        const f = await UI.form(`${j.name}: log event`, [
          { name: 'event', type: 'select', label: 'What happened', value: 'submitted', options: ['submitted', 'under review', 'revisions requested', 'resubmitted', 'rejected', 'accepted', 'withdrawn'].map(x => ({ value: x, label: x })) },
          { name: 'date', type: 'date', label: 'Date', value: U.todayStr(), required: true },
          { name: 'note', label: 'Note (optional)' }]);
        if (!f) return;
        j.history = [...(j.history || []), f]; j.status = f.event;
        await save(c, 'Logged');
        if (window.Logs && (f.event === 'submitted' || f.event === 'accepted') && await UI.confirm(`Add "${c.title}" (${f.event} to ${j.name}) to your Wins log?`, { ok: 'Add win', title: 'Log a win?' })) {
          await Logs.addWin({ title: `${c.title} — ${f.event} to ${j.name}`, type: f.event === 'accepted' ? 'paperAccepted' : 'paperSubmitted', areaId: 'a2', date: f.date, cardId: c.id });
        }
      },
      dAdd: async () => {
        const { c } = await load();
        const f = await UI.form('Log a decision', [{ name: 'text', type: 'textarea', label: 'What was decided', required: true, rows: 2 },
          { name: 'why', type: 'textarea', label: 'Why', rows: 3 }, { name: 'date', type: 'date', label: 'Date', value: U.todayStr() }]);
        if (f) { c.decisions = [...(c.decisions || []), f]; await save(c, 'Decision logged'); }
      }
    };
  },
  async editJournal(cardId, ji) {
    const c = await DB.get('cards', cardId);
    const j = ji == null ? null : c.journals[ji];
    const f = await UI.form(j ? 'Edit journal' : 'Target journal', [
      { name: 'name', label: 'Journal', value: j ? j.name : '', required: true },
      { name: 'wordLimit', label: 'Word limit', value: j ? j.wordLimit : '', placeholder: 'e.g. 3,000 words; abstract 250' },
      { name: 'format', type: 'textarea', label: 'Formatting notes', value: j ? j.format : '', rows: 3 },
      { name: 'link', label: 'Author guidelines link', value: j ? j.link : '' }
    ], { buttons: j ? [{ label: 'Delete journal', value: 'del', danger: true }] : [] });
    if (!f) return;
    c.journals = c.journals || [];
    if (f._button === 'del') c.journals.splice(ji, 1);
    else if (j) Object.assign(j, f);
    else c.journals.push({ ...f, status: 'target', history: [] });
    await Repo.put('cards', c); await App.changed({ celebrate: false });
  },

  async renderArchived({ id }) {
    const list = (await DB.getAll('cards')).filter(c => c.boardId === id && c.archived);
    return `${UI.header('Archived cards')}<div class="list">${list.map(c => UI.row({ icon: 'ph-archive', title: U.esc(c.title), sub: 'Tap to restore', act: 'restore', data: { id: c.id } })).join('') || UI.empty('No archived cards.', 'ph-archive')}</div>`;
  },
  archivedActions() {
    return { restore: async (el) => { const c = await DB.get('cards', el.dataset.id); c.archived = false; await Repo.put('cards', c); UI.toast('Restored'); await App.changed({ celebrate: false }); } };
  }
};
window.Boards = Boards;

Nav.register('boards', { tab: 'boards', render: () => Boards.renderHub(), actions: () => Boards.hubActions() });
Nav.register('board', { tab: 'boards', render: (p) => Boards.renderBoard(p), actions: (p) => Boards.boardActions(p) });
Nav.register('boardStages', { tab: 'boards', render: (p) => Boards.renderStages(p), actions: (p) => Boards.stagesActions(p) });
Nav.register('card', { tab: 'boards', render: (p) => Boards.renderCard(p), actions: (p) => Boards.cardActions(p) });
Nav.register('archivedCards', { tab: 'boards', render: (p) => Boards.renderArchived(p), actions: () => Boards.archivedActions() });
Nav.register('mtBoard', { tab: 'boards', render: (p) => Boards.renderBoard({ ...p, id: 'b2' }), actions: () => Boards.boardActions({ id: 'b2' }) });
Nav.register('researchBoards', { tab: 'boards', render: async () => {
  const boards = (await Boards.all()).filter(b => b.projectType);
  const cards = (await DB.getAll('cards')).filter(c => !c.archived);
  return `${UI.header('Research projects')}${boards.map(b => {
    const list = cards.filter(c => c.boardId === b.id);
    return `<div class="section-title">${U.esc(b.name)} <button data-act="open" data-id="${b.id}">Open board</button></div>
      ${list.map(c => Boards.cardHtml(b, c).replace('</div></button>', ` <span class="tag info">${U.esc(Boards.stageOf(b, c.stageId).name)}</span></div></button>`)).join('') || '<p class="muted small" style="margin:0 4px 8px">No projects.</p>'}`;
  }).join('')}`;
}, actions: () => ({ open: (el) => Nav.go('board', { id: el.dataset.id }), card: (el) => Nav.go('card', { id: el.dataset.id }) }) });
