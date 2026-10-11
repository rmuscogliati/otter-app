// ======= research.js — private research ideas, projects, reading queue, checklists, grants, publications =======
// PRIVACY: this file contains NO idea text. Ideas only ever arrive on the device, from a file you pick
// ("Import ideas from file") or from your own backup. They are stored in IndexedDB only.

const Research = {
  PROSPECTS: ['strong', 'promising', 'moderate', 'conditional', 'limited', 'low'],
  FEAS: ['high', 'moderate–high', 'moderate', 'moderate–low', 'low'],
  STATUSES: ['unchanged', 'merged', 'redesigned', 'new', 'dropped'],
  TIMING: { now: 'Can do now', later: 'Later: needs patient access/partnership' },
  prospectsScore(i) { const k = Research.PROSPECTS.indexOf(i.prospectsLevel); return k < 0 ? -1 : Research.PROSPECTS.length - k; },
  feasScore(i) { const k = Research.FEAS.indexOf(i.feasibilityLevel); return k < 0 ? -1 : Research.FEAS.length - k; },
  key(i) { return `${i.sourceList || ''}|${i.rank || ''}|${U.norm(i.title)}`; },

  // ---------- Markdown import parser (runs on the device; never invents or rewrites text) ----------
  unescapeMd(s) { return s.replace(/\\([\\`*_{}\[\]()#+\-.!=~|>])/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); },
  matchSpecialty(heading, list) {
    const n = (s) => U.norm(s).replace(/^public health:\s*/, '').replace(/\band\b/g, '&').replace(/[()]/g, '');
    const h = n(heading);
    return list.find(s => n(s) === h) || list.find(s => h && (h.includes(n(s)) || n(s).includes(h))) || heading;
  },
  parse(text, specialties) {
    const lines = text.replace(/\r/g, '').split('\n');
    const ideas = [], failed = [], partial = [];
    let timing = 'now', heading = '', cur = null;
    const flush = () => { if (cur) { Research.parseEntry(cur, ideas, failed, partial, specialties); cur = null; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (/^#{1,2}\s/.test(line)) {
        flush();
        const t = U.norm(Research.unescapeMd(line.replace(/^#+/, '')));
        if (/part 2|later/.test(t)) timing = 'later'; else if (/part 1|can do now/.test(t)) timing = 'now';
        continue;
      }
      if (/^#{3,}\s/.test(line)) { flush(); heading = Research.unescapeMd(line.replace(/^#+/, '')); continue; }
      if (/^\*\*\\?\[List/.test(line)) { flush(); cur = { text: line, timing, heading }; continue; }
      if (!line) { flush(); continue; }
      if (cur) cur.text += ' ' + line;
    }
    flush();
    return { ideas, failed, partial };
  },
  parseEntry(e, ideas, failed, partial, specialties) {
    const t = Research.unescapeMd(e.text);
    const hm = t.match(/^\[List\s*(\d+)\s*·\s*#\s*(\d+)\]\s*(.*)$/);
    if (!hm) { failed.push({ key: t.slice(0, 18), why: 'label not recognised' }); return; }
    const [, list, rank, rest] = hm;
    const keyLabel = `List ${list} · #${rank}`;
    let pIdx = rest.search(/\s—\s*Publication prospects:/i);
    let title, tail;
    if (pIdx >= 0) { title = rest.slice(0, pIdx).trim(); tail = rest.slice(pIdx).replace(/^\s*—\s*/, ''); }
    else { const d = rest.indexOf(' — '); if (d < 0) { failed.push({ key: keyLabel, why: 'no "Title —" separator' }); return; } title = rest.slice(0, d).trim(); tail = rest.slice(d + 3); }
    if (!title) { failed.push({ key: keyLabel, why: 'empty title' }); return; }
    const pm = tail.match(/Publication prospects:\s*([^;]+);/i);
    const fm = tail.match(/feasibility:\s*([^;]+?)(?:;|\.\s|\.$)/i);
    const im = tail.match(/\bIF\s+([^.\[]*?)\s*→\s*([^.\[;]*?)\s*(?:\.|;|\[|$)/);
    const sm = tail.match(/\[Status:\s*([^\]]+)\]/i);
    let desc = sm ? tail.slice(tail.indexOf(sm[0]) + sm[0].length) : (im ? tail.slice(tail.indexOf(im[0]) + im[0].length) : tail.replace(/^.*?feasibility:[^;.]*[;.]\s*/i, ''));
    desc = desc.trim();
    const sentences = desc.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const firstCheck = (sentences.find(s => /\bfirst (check|confirm|step|task|test|establish|verify)/i.test(s)) || '').trim();
    const op = t.match(/Overall position:\s*([^.\]]+)/i);
    // Longest label first, so "moderate–low" is not read as "moderate".
    const level = (s, list) => { const x = U.norm(s).replace(/-/g, '–'); return [...list].sort((a, b) => b.length - a.length).find(l => x.startsWith(l)) || ''; };
    const statusText = sm ? sm[1].trim() : '';
    const status = Research.STATUSES.find(s => U.norm(statusText).startsWith(s)) || (statusText ? 'unchanged' : 'unchanged');
    const idea = {
      title, specialty: Research.matchSpecialty(e.heading, specialties), timing: e.timing,
      sourceList: Number(list), rank: Number(rank), sourceKey: keyLabel,
      prospects: pm ? pm[1].trim() : '', prospectsLevel: pm ? level(pm[1], Research.PROSPECTS) : '',
      feasibility: fm ? fm[1].trim() : '', feasibilityLevel: fm ? level(fm[1], Research.FEAS) : '',
      ifCurrent: im ? im[1].trim() : '', ifTarget: im ? im[2].trim() : '',
      statusText, status, overallPosition: op ? op[1].trim() : '', top10: /potential top 10\b/i.test(t),
      description: desc, firstCheck, noveltyUnverified: /novelty[^.]{0,60}unverified|unverified novelty/i.test(t)
    };
    const missing = [!pm && 'prospects', !fm && 'feasibility', !im && 'IF range', !sm && 'status'].filter(Boolean);
    if (missing.length) partial.push({ key: keyLabel, missing });
    ideas.push(idea);
  },
  async importFile() {
    const file = await U.pickFile('.md,.markdown,.txt,text/markdown,text/plain');
    if (!file) return;
    const text = await U.readFileText(file);
    const s = App.settings;
    const { ideas, failed, partial } = Research.parse(text, s.research.specialties);
    if (!ideas.length && !failed.length) { await UI.confirm('No idea entries were found in this file. Entries must start with a label like **[List 2 · #6]**.', { ok: 'OK', title: 'Nothing to import' }); return; }
    const existing = await Repo.all('idea');
    const have = new Set(existing.map(Research.key));
    const fresh = ideas.filter(i => !have.has(Research.key(i)));
    // New specialties found in headings are added to the editable list.
    const newSpecs = [...new Set(fresh.map(i => i.specialty))].filter(x => x && !s.research.specialties.includes(x));
    if (newSpecs.length) { s.research.specialties = [...s.research.specialties, ...newSpecs]; await App.saveSettings(); }
    await Repo.putMany('idea', fresh.map(i => ({ ...i, id: U.uid('idea'), imported: true, importedAt: U.todayStr(), notes: '', starred: false, archived: false })));
    const per = {};
    ideas.forEach(i => { per[i.specialty] = (per[i.specialty] || 0) + 1; });
    const summary = { file: file.name, date: new Date().toISOString(), parsed: ideas.length, added: fresh.length, skipped: ideas.length - fresh.length, per, failed, partial };
    s.research.lastImport = summary; await App.saveSettings();
    await App.changed({ celebrate: false });
    Research.showImportSummary(summary);
  },
  showImportSummary(sum) {
    UI.sheet({ title: 'Import summary', tall: true, html: `
      <p class="sheet-text"><b>${sum.parsed}</b> entries parsed from ${U.esc(sum.file)}: <b>${sum.added}</b> added, <b>${sum.skipped}</b> already in the app (left unchanged, notes kept).</p>
      <div class="list">${Object.entries(sum.per).sort(U.by(([k]) => k)).map(([k, n]) => `<div class="row"><span class="row-main"><span class="row-title">${U.esc(k)}</span></span><b>${n}</b></div>`).join('')}
        <div class="row"><span class="row-main"><span class="row-title">Total</span></span><b>${U.sum(Object.values(sum.per))}</b></div></div>
      <h3 style="margin-top:12px">Failed to parse: ${sum.failed.length}</h3>
      ${sum.failed.length ? `<div class="small">${sum.failed.map(f => `<div>${U.esc(f.key)} — ${U.esc(f.why)}</div>`).join('')}</div>` : '<p class="muted small">None.</p>'}
      ${sum.partial.length ? `<h3 style="margin-top:12px">Imported with a field missing: ${sum.partial.length}</h3><div class="small">${sum.partial.map(p => `<div>${U.esc(p.key)}: no ${U.esc(p.missing.join(', '))}</div>`).join('')}</div>` : ''}
      <button class="btn btn-primary btn-block" data-sheet-close>Done</button>` });
  },

  // ---------- ideas screen ----------
  filterIdeas(all, p) {
    const q = U.norm(p.q);
    let list = all.filter(i => {
      if (i.archived && !p.archived) return false;
      if (!i.archived && p.archived) return false;
      if (i.status === 'dropped' && !p.dropped && !p.archived) return false;
      if (p.view === 'top' && !(i.starred || i.top10)) return false;
      if (p.spec && i.specialty !== p.spec) return false;
      if (p.timing && i.timing !== p.timing) return false;
      if (p.status && i.status !== p.status) return false;
      if (p.feas && i.feasibilityLevel !== p.feas) return false;
      if (p.pros && i.prospectsLevel !== p.pros) return false;
      if (q && !U.norm([i.title, i.description, i.notes, i.specialty, i.sourceKey].join(' ')).includes(q)) return false;
      return true;
    });
    const sort = p.sort || 'rank';
    const rank = (i) => (i.sourceList || 99) * 1000 + (i.rank || 999);
    if (sort === 'prospects') list.sort((a, b) => Research.prospectsScore(b) - Research.prospectsScore(a) || rank(a) - rank(b));
    else if (sort === 'feasibility') list.sort((a, b) => Research.feasScore(b) - Research.feasScore(a) || rank(a) - rank(b));
    else list.sort((a, b) => rank(a) - rank(b));
    return list;
  },
  ideaRow(i) {
    return `<button class="kcard" style="--c:${i.timing === 'later' ? '#868E96' : '#1C7ED6'}" data-act="idea" data-id="${i.id}">
      <div class="t">${i.starred ? '<i class="ph-fill ph-star star" style="color:#F59F00"></i> ' : ''}${U.esc(i.title)}</div>
      <div class="meta"><span class="tag">${U.esc(i.sourceKey || 'own idea')}</span><span class="tag">${U.esc(i.specialty || '—')}</span>
        ${i.prospectsLevel ? `<span class="tag ${['strong', 'promising'].includes(i.prospectsLevel) ? 'good' : ''}">${U.esc(i.prospectsLevel)}</span>` : ''}
        ${i.feasibilityLevel ? `<span class="tag info">feas. ${U.esc(i.feasibilityLevel)}</span>` : ''}
        ${i.top10 ? '<span class="tag warn">potential top 10</span>' : ''}${i.status && i.status !== 'unchanged' ? `<span class="tag">${U.esc(i.status)}</span>` : ''}
        ${i.projectCardId ? '<span class="tag good">project</span>' : ''}${i.timing === 'later' ? '<span class="tag">later</span>' : ''}</div></button>`;
  },
  async renderIdeas(p = {}) {
    const all = await Repo.all('idea');
    const list = Research.filterIdeas(all, p);
    const specs = App.settings.research.specialties;
    const sel = (name, label, opts) => `<div class="field" style="margin:0"><label for="if_${name}">${label}</label><select id="if_${name}" data-change="filter" data-k="${name}">
      <option value="">All</option>${opts.map(([v, l]) => `<option value="${U.esc(v)}" ${String(p[name] || '') === String(v) ? 'selected' : ''}>${U.esc(l)}</option>`).join('')}</select></div>`;
    const nDropped = all.filter(i => i.status === 'dropped' && !i.archived).length;
    return `${UI.header('Research ideas', { right: '<button class="icon-btn" data-act="add" aria-label="Add idea"><i class="ph ph-plus"></i></button><button class="icon-btn" data-act="menu" aria-label="Import and options"><i class="ph ph-dots-three-outline"></i></button>' })}
      <div class="note"><i class="ph ph-lock-simple"></i><span>Private: ideas live only on this device (and in backups you export). They are never part of the app's code or website.</span></div>
      ${all.length ? '' : `<div class="card"><h3>No ideas yet</h3><p class="muted small" style="margin:4px 0 10px">Import your Markdown ideas file (e.g. research-ideas.md) from the Files app, or add ideas by hand.</p>
        <button class="btn btn-primary btn-block" data-act="import"><i class="ph ph-file-arrow-up"></i> Import ideas from file</button></div>`}
      <div class="seg" style="margin-bottom:10px"><button class="${p.view !== 'top' && !p.archived ? 'on' : ''}" data-act="view" data-v="">All ideas</button>
        <button class="${p.view === 'top' ? 'on' : ''}" data-act="view" data-v="top">★ Top picks (${all.filter(i => (i.starred || i.top10) && !i.archived).length})</button></div>
      <input type="search" placeholder="Search ideas…" value="${U.esc(p.q || '')}" data-change="search" aria-label="Search ideas" style="margin-bottom:8px">
      <details class="card flat" ${p.spec || p.timing || p.status || p.feas || p.pros ? 'open' : ''}><summary style="font-weight:800;min-height:44px">Filters & sort</summary>
        <div class="two" style="margin-top:8px">${sel('spec', 'Specialty', specs.map(s => [s, s]))}${sel('timing', 'Timing', Object.entries(Research.TIMING))}
          ${sel('status', 'Status', Research.STATUSES.map(s => [s, s]))}${sel('feas', 'Feasibility', Research.FEAS.map(s => [s, s]))}
          ${sel('pros', 'Prospects', Research.PROSPECTS.map(s => [s, s]))}
          <div class="field" style="margin:0"><label for="if_sort">Sort by</label><select id="if_sort" data-change="filter" data-k="sort">
            ${[['rank', 'Rank (list, #)'], ['prospects', 'Publication prospects'], ['feasibility', 'Feasibility']].map(([v, l]) => `<option value="${v}" ${(p.sort || 'rank') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <label class="check-row" style="margin-top:6px"><input type="checkbox" data-change="toggle" data-k="dropped" ${p.dropped ? 'checked' : ''}><span>Show dropped ideas (${nDropped}, kept as background)</span></label>
        <label class="check-row"><input type="checkbox" data-change="toggle" data-k="archived" ${p.archived ? 'checked' : ''}><span>Show archived instead</span></label></details>
      <p class="muted small" style="margin:8px 4px">${list.length} idea${list.length === 1 ? '' : 's'}</p>
      ${list.map(Research.ideaRow).join('') || UI.empty('No ideas match these filters.', 'ph-lightbulb')}`;
  },
  ideasActions(p = {}) {
    const go = (np) => Nav.go('ideas', np, { replace: true });
    return {
      idea: (el) => Nav.go('idea', { id: el.dataset.id }),
      view: (el) => go({ ...p, view: el.dataset.v, archived: false }),
      filter: (el) => go({ ...p, [el.dataset.k]: el.value }),
      toggle: (el) => go({ ...p, [el.dataset.k]: el.checked }),
      search: (el) => go({ ...p, q: el.value }),
      import: () => Research.importFile(),
      add: () => Research.editIdea(null),
      menu: async () => {
        const last = App.settings.research.lastImport;
        const v = await UI.choose('Research ideas', [
          { value: 'import', label: 'Import ideas from file', sub: 'Pick your Markdown file. Re-importing never duplicates or overwrites notes.', icon: 'ph-file-arrow-up' },
          ...(last ? [{ value: 'summary', label: 'Last import summary', sub: `${U.fmtDate(U.dateStr(new Date(last.date)))} · ${last.parsed} parsed`, icon: 'ph-list-numbers' }] : []),
          { value: 'specs', label: 'Edit specialty tags', icon: 'ph-tag' }]);
        if (v === 'import') Research.importFile();
        else if (v === 'summary') Research.showImportSummary(last);
        else if (v === 'specs') More.settingsActions().edit({ dataset: { key: 'research' } });
      }
    };
  },
  async renderIdea({ id }) {
    const i = await Repo.get('idea', id);
    if (!i) return `${UI.header('Idea')}${UI.empty('Idea not found.')}`;
    const card = i.projectCardId ? await DB.get('cards', i.projectCardId) : null;
    const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
    return `${UI.header(i.sourceKey || 'Idea', { right: `<button class="icon-btn" data-act="star" aria-label="${i.starred ? 'Remove from shortlist' : 'Shortlist'}"><i class="ph${i.starred ? '-fill' : ''} ph-star" style="color:#F59F00"></i></button>` })}
      <div class="card"><h2 style="margin-bottom:6px">${U.esc(i.title)}</h2>
        <div>${i.top10 ? '<span class="tag warn">potential top 10</span>' : ''}${i.noveltyUnverified ? '<span class="tag bad">novelty unverified</span>' : ''}
          <span class="tag">${U.esc(i.status || '')}</span>${i.archived ? '<span class="tag">archived</span>' : ''}</div>
        <dl class="kv" style="margin-top:10px">${row('Specialty', U.esc(i.specialty))}${row('Timing', U.esc(Research.TIMING[i.timing] || ''))}${row('Source', U.esc(i.sourceKey || 'Added by hand'))}
          ${row('Prospects', U.esc(i.prospects))}${row('Feasibility', U.esc(i.feasibility))}${row('Impact factor', i.ifCurrent || i.ifTarget ? `${U.esc(i.ifCurrent)} → ${U.esc(i.ifTarget)}` : '')}
          ${row('Status', U.esc(i.statusText || i.status))}${row('Overall position', U.esc(i.overallPosition))}</dl></div>
      ${i.firstCheck ? `<div class="note"><i class="ph ph-magnifying-glass"></i><span><b>First check:</b> ${U.esc(i.firstCheck)}</span></div>` : ''}
      <div class="card"><h3>Description</h3><p class="small pre" style="margin-top:4px">${U.esc(i.description || '—')}</p></div>
      <div class="card"><h3>My notes</h3><textarea id="idea-notes" rows="4" placeholder="Your thoughts, search terms, possible collaborators…">${U.esc(i.notes || '')}</textarea>
        <button class="btn btn-small btn-ghost" data-act="saveNotes" style="margin-top:6px"><i class="ph ph-floppy-disk"></i> Save notes</button></div>
      <div class="btn-wrap">
        ${card ? `<button class="btn btn-primary" data-act="openProject"><i class="ph ph-kanban"></i> Open project</button>` : `<button class="btn btn-primary" data-act="start"><i class="ph ph-rocket-launch"></i> Start project</button>`}
        ${i.firstCheck ? '<button class="btn btn-ghost" data-act="firstTask"><i class="ph ph-calendar-plus"></i> Add first check as a task</button>' : ''}
        <button class="btn btn-ghost" data-act="video"><i class="ph ph-video-camera"></i> Turn into video</button>
        <button class="btn btn-ghost" data-act="edit"><i class="ph ph-pencil-simple"></i> Edit</button>
        <button class="btn btn-ghost" data-act="archive"><i class="ph ph-archive"></i> ${i.archived ? 'Unarchive' : 'Archive'}</button></div>`;
  },
  ideaActions({ id }) {
    const get = () => Repo.get('idea', id);
    const save = async (i, msg) => { await Repo.put('idea', i); if (msg) UI.toast(msg); await App.changed({ celebrate: false }); };
    return {
      star: async () => { const i = await get(); i.starred = !i.starred; await save(i, i.starred ? 'Shortlisted ★' : 'Removed from shortlist'); },
      saveNotes: async () => { const i = await get(); i.notes = document.getElementById('idea-notes').value; await save(i, 'Notes saved'); },
      start: async () => Research.startProject(await get()),
      openProject: async () => { const i = await get(); Nav.go('card', { id: i.projectCardId }); },
      firstTask: async () => { const i = await get(); const d = await More.scheduleSheet(i.firstCheck, 'a2'); if (d) UI.toast(`First check added to ${U.fmtDate(d)}`, 'ph-calendar-plus'); },
      video: async () => { const i = await get(); Logs.turnIntoVideo({ title: i.title, notes: '', source: 'Research idea', areaId: 'a2' }); },
      edit: async () => Research.editIdea(await get()),
      archive: async () => { const i = await get(); i.archived = !i.archived; await save(i, i.archived ? 'Archived' : 'Restored'); }
    };
  },
  async editIdea(i) {
    const specs = App.settings.research.specialties;
    const f = await UI.form(i ? 'Edit idea' : 'Add idea', [
      { name: 'title', label: 'Title', value: i ? i.title : '', required: true },
      { name: 'specialty', type: 'select', label: 'Specialty', value: i ? i.specialty : specs[0], options: specs.map(s => ({ value: s, label: s })) },
      { name: 'timing', type: 'select', label: 'Timing', value: i ? i.timing : 'now', options: Object.entries(Research.TIMING).map(([v, l]) => ({ value: v, label: l })) },
      { type: 'html', html: '<div class="two">' },
      { name: 'prospectsLevel', type: 'select', label: 'Prospects', value: i ? i.prospectsLevel : '', options: [{ value: '', label: '—' }, ...Research.PROSPECTS.map(s => ({ value: s, label: s }))] },
      { name: 'feasibilityLevel', type: 'select', label: 'Feasibility', value: i ? i.feasibilityLevel : '', options: [{ value: '', label: '—' }, ...Research.FEAS.map(s => ({ value: s, label: s }))] },
      { name: 'ifCurrent', label: 'IF now', value: i ? i.ifCurrent : '', placeholder: '2–4' },
      { name: 'ifTarget', label: 'IF target', value: i ? i.ifTarget : '', placeholder: '5–7' },
      { type: 'html', html: '</div>' },
      { name: 'status', type: 'select', label: 'Status', value: i ? i.status : 'new', options: Research.STATUSES.map(s => ({ value: s, label: s })) },
      { name: 'description', type: 'textarea', label: 'Description', value: i ? i.description : '', rows: 4 },
      { name: 'firstCheck', type: 'textarea', label: 'First check', value: i ? i.firstCheck : '', rows: 2 },
      { name: 'noveltyUnverified', type: 'checkbox', label: 'Novelty unverified', value: i ? i.noveltyUnverified : true },
      { name: 'top10', type: 'checkbox', label: 'Potential top 10', value: i ? i.top10 : false }
    ], { buttons: i ? [{ label: 'Delete idea', value: 'del', danger: true }] : [] });
    if (!f) return;
    if (f._button === 'del') {
      if (await UI.confirm('Delete this idea permanently? (Archive keeps it as background instead.)', { ok: 'Delete', danger: true })) { await Repo.del('idea', i.id); await App.changed({ celebrate: false }); Nav.back(); }
      return;
    }
    const obj = { ...(i || { id: U.uid('idea'), imported: false, notes: '', starred: false, archived: false, sourceKey: '', sourceList: 99, rank: 999 }), ...f };
    obj.prospects = obj.prospects || f.prospectsLevel; obj.feasibility = obj.feasibility || f.feasibilityLevel;
    if (i && i.prospectsLevel !== f.prospectsLevel) obj.prospects = f.prospectsLevel;
    if (i && i.feasibilityLevel !== f.feasibilityLevel) obj.feasibility = f.feasibilityLevel;
    await Repo.put('idea', obj);
    UI.toast(i ? 'Saved' : 'Idea added'); await App.changed({ celebrate: false });
    if (!i) Nav.go('idea', { id: obj.id });
  },

  // ---------- projects ----------
  async activeProjects() {
    const boards = (await DB.getAll('boards')).filter(b => b.projectType);
    const cards = (await DB.getAll('cards')).filter(c => !c.archived && boards.some(b => b.id === c.boardId && !Boards.isLast(b, c.stageId)));
    return { boards, cards };
  },
  async startProject(idea) {
    const { boards, cards } = await Research.activeProjects();
    if (!boards.length) { UI.toast('No research project boards. Mark a board as "Research project type" first.', 'ph-warning'); return; }
    const limit = App.settings.research.activeLimit || 3;
    const v = await UI.choose('Project type', boards.map(b => ({ value: b.id, label: b.name, sub: b.stages.map(s => s.name).join(' → '), icon: 'ph-flask' })),
      { text: cards.length >= limit ? `Heads-up: you already have ${cards.length} active projects (your limit is ${limit}). Starting another may spread you thin.` : '' });
    if (!v) return;
    const b = boards.find(x => x.id === v);
    const card = await Repo.put('cards', { id: U.uid('c'), title: idea.title, boardId: b.id, stageId: b.stages[0].id, nextAction: idea.firstCheck || '', due: '', notes: '',
      areaId: 'a2', ideaId: idea.id, specialty: idea.specialty, enteredStageAt: U.todayStr(), history: [{ stageId: b.stages[0].id, date: U.todayStr() }], guidelines: [], journals: [], decisions: [] });
    idea.projectCardId = card.id; await Repo.put('idea', idea);
    UI.toast(`Project started on "${b.name}"`, 'ph-rocket-launch');
    await App.changed({ celebrate: false });
    Nav.go('card', { id: card.id });
  },

  // ---------- reading queue ----------
  READ: { toRead: 'To read', read: 'Read', summarised: 'Summarised' },
  async renderReading({ show = 'toRead' } = {}) {
    const all = (await Repo.all('reading')).sort(U.by(r => r.createdAt || ''));
    const list = all.filter(r => (r.status || 'toRead') === show);
    const cards = await DB.getAll('cards');
    return `${UI.header('Reading queue', { right: '<button class="icon-btn" data-act="add" aria-label="Add paper"><i class="ph ph-plus"></i></button>' })}
      <div class="seg" style="margin-bottom:12px">${Object.entries(Research.READ).map(([k, l]) => `<button class="${show === k ? 'on' : ''}" data-act="show" data-v="${k}">${l} (${all.filter(r => (r.status || 'toRead') === k).length})</button>`).join('')}</div>
      ${list.map(r => {
        const c = cards.find(x => x.id === r.cardId);
        const link = r.doi ? (/^https?:/i.test(r.doi) ? r.doi : `https://doi.org/${r.doi.replace(/^doi:\s*/i, '')}`) : '';
        return `<div class="card"><div style="font-weight:800">${U.esc(r.title)}</div>
          <div class="muted tiny">${U.esc(r.authors || '')}${c ? ` · project: ${U.esc(c.title)}` : ''}${r.specialty ? ` · ${U.esc(r.specialty)}` : ''}</div>
          ${r.takeaway ? `<p class="small" style="margin-top:4px">💡 ${U.esc(r.takeaway)}</p>` : ''}
          ${link ? `<p class="tiny"><a class="tap-link" href="${U.esc(link)}" target="_blank" rel="noopener">${U.esc(r.doi)}</a></p>` : ''}
          <div class="btn-wrap">${show === 'toRead' ? `<button class="btn btn-small btn-primary" data-act="set" data-id="${r.id}" data-v="read">Mark read</button>` : ''}
            ${show !== 'summarised' ? `<button class="btn btn-small ${show === 'read' ? 'btn-primary' : 'btn-ghost'}" data-act="summ" data-id="${r.id}">Summarise</button>` : ''}
            <button class="btn btn-small btn-ghost" data-act="edit" data-id="${r.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div></div>`;
      }).join('') || UI.empty('Nothing here.', 'ph-books')}`;
  },
  readingActions(p = {}) {
    const get = (id) => Repo.get('reading', id);
    return {
      show: (el) => Nav.go('reading', { show: el.dataset.v }, { replace: true }),
      add: () => Research.editReading(null),
      edit: async (el) => Research.editReading(await get(el.dataset.id)),
      set: async (el) => { const r = await get(el.dataset.id); r.status = el.dataset.v; r.readDate = U.todayStr(); await Repo.put('reading', r); UI.toast('Marked as read'); await App.changed({ celebrate: false }); },
      summ: async (el) => {
        const r = await get(el.dataset.id);
        const f = await UI.form('One-line takeaway', [{ name: 'takeaway', type: 'textarea', label: 'What is the one thing to remember?', value: r.takeaway || '', required: true, rows: 3 }]);
        if (!f) return;
        r.takeaway = f.takeaway; r.status = 'summarised'; r.summarisedDate = U.todayStr();
        await Repo.put('reading', r); UI.toast('Summarised — counts for Research today', 'ph-books'); await App.changed();
      }
    };
  },
  async editReading(r) {
    const cards = (await Research.activeProjects()).cards;
    const f = await UI.form(r ? 'Edit paper' : 'Add to reading queue', [
      { name: 'title', label: 'Title', value: r ? r.title : '', required: true },
      { name: 'authors', label: 'Authors / journal / year', value: r ? r.authors : '' },
      { name: 'doi', label: 'DOI or link', value: r ? r.doi : '', placeholder: '10.xxxx/… or https://…' },
      { name: 'cardId', type: 'select', label: 'Linked project', value: r ? r.cardId || '' : '', options: [{ value: '', label: '—' }, ...cards.map(c => ({ value: c.id, label: c.title }))] },
      { name: 'specialty', type: 'select', label: 'Specialty', value: r ? r.specialty || '' : '', options: [{ value: '', label: '—' }, ...App.settings.research.specialties.map(s => ({ value: s, label: s }))] },
      { name: 'status', type: 'select', label: 'Status', value: r ? r.status || 'toRead' : 'toRead', options: Object.entries(Research.READ).map(([v, l]) => ({ value: v, label: l })) },
      { name: 'takeaway', type: 'textarea', label: 'One-line takeaway', value: r ? r.takeaway || '' : '', rows: 2 }
    ], { buttons: r ? [{ label: 'Delete', value: 'del', danger: true }] : [] });
    if (!f) return;
    if (f._button === 'del') { if (await UI.confirm('Remove this paper?', { ok: 'Delete', danger: true })) await Repo.del('reading', r.id); }
    else {
      const obj = { ...(r || { id: U.uid('rd') }), ...f };
      if (f.status === 'summarised' && !obj.summarisedDate) obj.summarisedDate = U.todayStr();
      await Repo.put('reading', obj);
    }
    await App.changed({ celebrate: false });
  },

  // ---------- reporting-guideline library ----------
  async renderGuidelines() {
    const list = await Repo.all('guideline');
    return `${UI.header('Reporting checklists', { right: '<button class="icon-btn" data-act="add" aria-label="Add checklist"><i class="ph ph-plus"></i></button>' })}
      <p class="muted small" style="margin-bottom:10px">Attach these to a research project (open the project card › Reporting). Edit the items to match the version you use.</p>
      <div class="list">${list.map(g => UI.row({ icon: 'ph-list-checks', title: U.esc(g.name), sub: `${g.items.length} items`, act: 'edit', data: { id: g.id } })).join('')}</div>`;
  },
  guidelinesActions() {
    const edit = async (g) => {
      const f = await UI.form(g ? g.name : 'New checklist', [{ name: 'name', label: 'Name', value: g ? g.name : '', required: true },
        { name: 'items', type: 'textarea', label: 'Items (one per line)', value: g ? g.items.join('\n') : '', rows: 12, required: true }],
      { buttons: g ? [{ label: 'Delete checklist', value: 'del', danger: true }] : [] });
      if (!f) return;
      if (f._button === 'del') { if (await UI.confirm(`Delete "${g.name}"? Projects that use it lose its ticks.`, { ok: 'Delete', danger: true })) await Repo.del('guideline', g.id); }
      else await Repo.put('guideline', { ...(g || { id: U.uid('gl') }), name: f.name, items: f.items.split('\n').map(x => x.trim()).filter(Boolean) });
      await App.changed({ celebrate: false });
    };
    return { add: () => edit(null), edit: async (el) => edit(await Repo.get('guideline', el.dataset.id)) };
  },

  // ---------- conferences, grants, fellowships (feed Deadlines) ----------
  OPP_TYPES: { conference: 'Conference abstract', grant: 'Grant', fellowship: 'Fellowship', prize: 'Prize / award', other: 'Other' },
  OPP_STATUS: ['considering', 'preparing', 'submitted', 'accepted', 'rejected', 'skipped'],
  async renderOpps() {
    const list = (await Repo.all('opportunity')).sort(U.by(o => o.deadline || '9999'));
    const today = U.todayStr();
    return `${UI.header('Conferences & grants', { right: '<button class="icon-btn" data-act="add" aria-label="Add"><i class="ph ph-plus"></i></button>' })}
      <p class="muted small" style="margin-bottom:10px">Each deadline here also appears in Deadlines (and on Today when it's close).</p>
      ${list.map(o => UI.row({ icon: o.type === 'conference' ? 'ph-presentation' : 'ph-medal', cls: 'card', title: U.esc(o.name),
        sub: `${Research.OPP_TYPES[o.type] || o.type} · ${o.deadline ? `${U.fmtDate(o.deadline, { year: true })} (${U.relDay(o.deadline)})` : 'no deadline'} · ${U.esc(o.status)}`,
        act: 'edit', data: { id: o.id }, right: o.deadline && o.deadline >= today && !['submitted', 'accepted', 'rejected', 'skipped'].includes(o.status) && U.diffDays(today, o.deadline) <= 14 ? '<span class="tag warn">soon</span>' : '' })).join('')
        || UI.empty('No conferences or grants tracked yet.', 'ph-presentation')}`;
  },
  oppsActions() { return { add: () => Research.editOpp(null), edit: async (el) => Research.editOpp(await Repo.get('opportunity', el.dataset.id)) }; },
  async editOpp(o) {
    const cards = (await Research.activeProjects()).cards;
    const f = await UI.form(o ? 'Edit' : 'Conference / grant', [
      { name: 'name', label: 'Name', value: o ? o.name : '', required: true },
      { name: 'type', type: 'select', label: 'Type', value: o ? o.type : 'conference', options: Object.entries(Research.OPP_TYPES).map(([v, l]) => ({ value: v, label: l })) },
      { name: 'deadline', type: 'date', label: 'Deadline', value: o ? o.deadline : '' },
      { name: 'status', type: 'select', label: 'Status', value: o ? o.status : 'considering', options: Research.OPP_STATUS.map(s => ({ value: s, label: s })) },
      { name: 'cardId', type: 'select', label: 'Linked project', value: o ? o.cardId || '' : '', options: [{ value: '', label: '—' }, ...cards.map(c => ({ value: c.id, label: c.title }))] },
      { name: 'link', label: 'Link', value: o ? o.link : '' },
      { name: 'notes', type: 'textarea', label: 'Notes', value: o ? o.notes : '', rows: 2 }
    ], { buttons: o ? [{ label: 'Delete', value: 'del', danger: true }] : [] });
    if (!f) return;
    const dls = await DB.getAll('deadlines');
    if (f._button === 'del') {
      if (!(await UI.confirm('Delete this and its deadline?', { ok: 'Delete', danger: true }))) return;
      await Repo.del('opportunity', o.id);
      for (const d of dls.filter(d => d.oppId === o.id)) await Repo.del('deadlines', d.id);
    } else {
      const obj = await Repo.put('opportunity', { ...(o || { id: U.uid('op') }), ...f });
      const d = dls.find(x => x.oppId === obj.id);
      if (obj.deadline) {
        await Repo.put('deadlines', { ...(d || { id: U.uid('dl'), oppId: obj.id }), title: `${obj.name} (${Research.OPP_TYPES[obj.type] || obj.type})`, date: obj.deadline,
          areaId: 'a2', boardId: d ? d.boardId || '' : '', cardId: obj.cardId || '', source: 'Conferences & grants', notes: obj.notes || '', done: ['submitted', 'accepted', 'rejected', 'skipped'].includes(obj.status) });
      } else if (d) await Repo.del('deadlines', d.id);
      if (obj.status === 'accepted' && (!o || o.status !== 'accepted') && await UI.confirm(`Log "${obj.name}" as a win?`, { ok: 'Add win', title: 'Accepted!' })) {
        await Logs.addWin({ title: obj.name, type: obj.type === 'conference' ? 'presentation' : 'grant', areaId: 'a2', date: U.todayStr() });
      }
    }
    await App.changed({ celebrate: false });
  },

  // ---------- publications & presentations (from the Wins log) ----------
  PUB_TYPES: ['paperAccepted', 'paperSubmitted', 'presentation', 'grant'],
  pubList(all, filter) {
    return all.filter(w => Research.PUB_TYPES.includes(w.type) && (filter !== 'first' || (Logs.PAPER_TYPES.includes(w.type) && Logs.isFirst(w)))).sort(U.by(w => w.date)).reverse();
  },
  async renderPubs({ filter = '' } = {}) {
    const all = await DB.getAll('wins');
    const papers = all.filter(w => Logs.PAPER_TYPES.includes(w.type));
    const firsts = papers.filter(Logs.isFirst);
    const wins = Research.pubList(all, filter);
    const n = (a) => papers.filter(w => w.authorship === a).length;
    return `${UI.header('Publications & presentations')}
      <div class="card"><h3>${papers.length} paper${papers.length === 1 ? '' : 's'} · ${firsts.length} first or joint first author</h3>
        <p class="muted small" style="margin-top:4px">${n('first')} first · ${n('joint-first')} joint first (listed 2nd) · ${n('co')} co-author${n('senior') ? ` · ${n('senior')} senior` : ''}. Tap a paper to change your authorship.</p></div>
      <div class="seg" style="margin-bottom:10px"><button class="${filter ? '' : 'on'}" data-act="filter" data-v="">All</button><button class="${filter === 'first' ? 'on' : ''}" data-act="filter" data-v="first">First & joint first (${firsts.length})</button></div>
      <p class="muted small" style="margin-bottom:8px">Built automatically from your Wins log (papers, presentations, grants).</p>
      <button class="btn btn-primary btn-block" data-act="export" style="margin:0 0 12px"><i class="ph ph-export"></i> Export ${filter ? 'these' : 'all'} as text for your CV</button>
      ${wins.map(w => UI.row({ icon: (Logs.WIN_TYPES[w.type] || [])[1] || 'ph-star', cls: 'card', title: U.esc(w.title),
        sub: `${U.fmtDate(w.date, { year: true })} · ${(Logs.WIN_TYPES[w.type] || [''])[0]}${Logs.authorshipLabel(w) ? ` · <b>${Logs.authorshipLabel(w)}</b>` : ''}${w.notes ? ` · ${U.esc(w.notes)}` : ''}`, act: 'win', data: { id: w.id } })).join('')
        || UI.empty('No publications or presentations logged yet.', 'ph-newspaper')}
      <button class="btn btn-ghost btn-block" data-act="add"><i class="ph ph-plus"></i> Log a publication or presentation</button>`;
  },
  pubsActions(p = {}) {
    return {
      filter: (el) => Nav.go('publications', { filter: el.dataset.v }, { replace: true }),
      export: async () => {
        const wins = Research.pubList(await DB.getAll('wins'), p.filter);
        Logs.exportText('Publications & presentations', Logs.winsText(wins, p.filter ? 'Publications (first or joint first author)' : 'Publications, presentations and grants'), 'publications');
      },
      win: async (el) => Logs.editWin(await DB.get('wins', el.dataset.id)),
      add: () => Logs.editWin(null)
    };
  },

  // ---------- Research area summary (shown on the Research area page) ----------
  async areaSummary() {
    const { boards, cards } = await Research.activeProjects();
    const ideas = (await Repo.all('idea')).filter(i => !i.archived);
    const limit = App.settings.research.activeLimit || 3;
    const short = ideas.filter(i => i.starred);
    const per = {};
    ideas.filter(i => i.status !== 'dropped').forEach(i => { per[i.specialty || '—'] = (per[i.specialty || '—'] || 0) + 1; });
    const stuck = cards.filter(c => Boards.isStuck(boards.find(b => b.id === c.boardId), c));
    const pubs = (await DB.getAll('wins')).filter(w => w.type === 'paperAccepted').sort(U.by(w => w.date)).reverse();
    const firstAuthor = pubs.filter(Logs.isFirst).length;
    const pubCard = pubs.length ? `<button class="card" data-act="go" data-view="publications" style="display:block;width:100%;text-align:left">
      <div class="cal-head"><h3><i class="ph ph-newspaper"></i> ${pubs.length} published paper${pubs.length === 1 ? '' : 's'}</h3><span class="tag good">${firstAuthor} first / joint first</span></div>
      <p class="small muted">Latest: ${U.esc(pubs[0].title)} (${U.fmtDate(pubs[0].date, { year: true })})</p></button>` : '';
    return `<div class="section-title">Research portfolio <button data-act="go" data-view="ideas">All ideas</button></div>${pubCard}
      ${cards.length > limit ? `<div class="note warn"><i class="ph ph-warning"></i><span>${cards.length} active projects — above your limit of ${limit}. Consider pausing or finishing one before starting another.</span></div>` : ''}
      <div class="card"><div class="cal-head"><h3>${cards.length} active project${cards.length === 1 ? '' : 's'}</h3><span class="tag ${cards.length > limit ? 'warn' : 'good'}">limit ${limit}</span></div>
        ${boards.map(b => {
          const list = cards.filter(c => c.boardId === b.id);
          if (!list.length) return '';
          return `<div class="small" style="margin-top:6px"><b>${U.esc(b.name)}</b></div>${list.map(c => `<button class="row" data-act="openCard" data-id="${c.id}" style="min-height:44px;padding:6px 4px">
            <span class="row-main"><span class="row-title" style="font-size:.9rem">${U.esc(c.title)}</span><span class="row-sub">${U.esc(Boards.stageOf(b, c.stageId).name)}${stuck.includes(c) ? ' · <b style="color:var(--warn)">stuck</b>' : ''}${c.nextAction ? ` · next: ${U.esc(c.nextAction)}` : ''}</span></span></button>`).join('')}`;
        }).join('') || '<p class="muted small">No active projects. Open an idea and tap "Start project".</p>'}</div>
      <div class="card"><h3>★ Shortlisted ideas (${short.length})</h3>
        ${short.slice(0, 8).map(i => `<button class="row" data-act="openIdea" data-id="${i.id}" style="min-height:44px;padding:6px 4px"><span class="row-main"><span class="row-title" style="font-size:.9rem">${U.esc(i.title)}</span><span class="row-sub">${U.esc(i.specialty || '')}${i.prospectsLevel ? ` · ${U.esc(i.prospectsLevel)}` : ''}</span></span></button>`).join('')
          || '<p class="muted small">Star ideas to shortlist them.</p>'}
        ${short.length > 8 ? `<button class="btn btn-small btn-ghost" data-act="go" data-view="ideas" data-top="1">See all ${short.length}</button>` : ''}</div>
      <div class="card"><h3>Ideas per specialty</h3>
        ${Object.keys(per).length ? `<div class="bars" style="margin-top:8px">${Object.entries(per).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<button class="bar-row" data-act="spec" data-v="${U.esc(k)}" style="text-align:left">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(k)}</span><span class="track"><span class="fill" style="width:${Math.round(100 * n / Math.max(...Object.values(per)))}%;background:#1C7ED6"></span></span><span>${n}</span></button>`).join('')}</div>`
          : `<p class="muted small">No ideas yet.</p><button class="btn btn-small btn-primary" data-act="import" style="margin-top:6px"><i class="ph ph-file-arrow-up"></i> Import ideas from file</button>`}</div>`;
  }
};
window.Research = Research;

Areas.extraHooks.a2 = () => Research.areaSummary();
Areas.extraActions.a2 = () => ({
  go: (el) => Nav.go(el.dataset.view, el.dataset.top ? { view: 'top' } : {}),
  openCard: (el) => Nav.go('card', { id: el.dataset.id }),
  openIdea: (el) => Nav.go('idea', { id: el.dataset.id }),
  spec: (el) => Nav.go('ideas', { spec: el.dataset.v }),
  import: () => Research.importFile()
});
// Summarising a paper counts as a Research session for the area streak.
Streaks.extraSources.push(async () => (await Repo.all('reading')).filter(r => r.summarisedDate).map(r => ({ areaId: 'a2', date: r.summarisedDate, n: 1, tag: 'reading' })));

Nav.register('ideas', { tab: 'more', render: (p) => Research.renderIdeas(p), actions: (p) => Research.ideasActions(p) });
Nav.register('idea', { tab: 'more', render: (p) => Research.renderIdea(p), actions: (p) => Research.ideaActions(p) });
Nav.register('reading', { tab: 'more', render: (p) => Research.renderReading(p), actions: (p) => Research.readingActions(p) });
Nav.register('guidelines', { tab: 'more', render: () => Research.renderGuidelines(), actions: () => Research.guidelinesActions() });
Nav.register('opportunities', { tab: 'more', render: () => Research.renderOpps(), actions: () => Research.oppsActions() });
Nav.register('publications', { tab: 'more', render: (p) => Research.renderPubs(p), actions: (p) => Research.pubsActions(p) });
