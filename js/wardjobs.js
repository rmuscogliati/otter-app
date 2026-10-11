// ======= wardjobs.js — jobs list after the ward round: beds → jobs, ticked off through the day =======
// One list per day (records kind 'wardList', id wl_YYYY-MM-DD). Bed/bay numbers only: never names or identifiers.

const WardJobs = {
  _queue: Promise.resolve(),
  // Every change goes through one queue, so quick successive taps can't overwrite each other.
  change(date, fn) {
    WardJobs._queue = WardJobs._queue.then(async () => {
      const list = await WardJobs.get(date);
      const msg = await fn(list);
      await Repo.put('wardList', list);
      if (msg) UI.toast(msg, 'ph-list-checks');
    }).catch(e => console.error(e));
    return WardJobs._queue;
  },
  async get(date) { return (await Repo.get('wardList', `wl_${date}`)) || { id: `wl_${date}`, kind: 'wardList', date, beds: [] }; },
  templates() { return (App.settings.clinical && App.settings.clinical.jobTemplates) || Defaults.wardJobTemplates; },
  counts(list) {
    const jobs = list.beds.flatMap(b => b.jobs);
    return { total: jobs.length, done: jobs.filter(j => j.done).length, urgent: jobs.filter(j => j.urgent && !j.done).length, open: jobs.filter(j => !j.done).length };
  },
  async previousOpen(date) {
    const lists = (await Repo.all('wardList')).filter(l => l.date < date).sort(U.by(l => l.date));
    const prev = lists[lists.length - 1];
    if (!prev) return null;
    const open = prev.beds.map(b => ({ ...b, jobs: b.jobs.filter(j => !j.done) })).filter(b => b.jobs.length);
    return open.length ? { date: prev.date, beds: open, n: U.sum(open, b => b.jobs.length) } : null;
  },
  nextBedLabel(list) {
    const nums = list.beds.map(b => Number((String(b.label).match(/\d+/) || [])[0])).filter(n => n > 0);
    return `Bed ${nums.length ? Math.max(...nums) + 1 : 1}`;
  },
  text(list) {
    const lines = [`Ward jobs — ${U.fmtDate(list.date, { year: true })}`, ''];
    list.beds.forEach(b => {
      lines.push(`${b.label}${b.note ? ` (${b.note})` : ''}`);
      b.jobs.forEach(j => lines.push(`  ${j.done ? '☑' : '☐'} ${j.text}${j.urgent && !j.done ? ' (URGENT)' : ''}`));
    });
    const c = WardJobs.counts(list);
    lines.push('', `${c.done} of ${c.total} done${c.open ? ` · ${c.open} still to do` : ''}`);
    return lines.join('\n');
  },

  async render({ date } = {}) {
    date = date || U.todayStr();
    const list = await WardJobs.get(date);
    const c = WardJobs.counts(list);
    const prev = !list.beds.length ? await WardJobs.previousOpen(date) : null;
    const tpls = WardJobs.templates();
    return `${UI.header('Ward jobs', { right: '<button class="icon-btn" data-act="share" aria-label="Share as handover text"><i class="ph ph-share-network"></i></button><button class="icon-btn" data-act="menu" aria-label="Options"><i class="ph ph-dots-three-outline"></i></button>' })}
      <div class="cal-head card"><button class="icon-btn" data-act="day" data-v="${U.addDays(date, -1)}" aria-label="Previous day"><i class="ph ph-caret-left"></i></button>
        <button data-act="day" data-v="${U.todayStr()}" style="font-weight:800;min-height:44px">${date === U.todayStr() ? 'Today' : U.fmtDate(date, { year: true })}</button>
        <button class="icon-btn" data-act="day" data-v="${U.addDays(date, 1)}" aria-label="Next day"><i class="ph ph-caret-right"></i></button></div>
      <div class="note warn"><i class="ph ph-shield-warning"></i><span>Bed or bay numbers only. No names, dates of birth, hospital numbers or other identifiers.</span></div>
      ${c.total ? `<div class="card"><div class="cal-head"><h3>${c.done} of ${c.total} jobs done</h3>${c.urgent ? `<span class="tag bad">${c.urgent} urgent</span>` : c.open ? '' : '<span class="tag good">all done ✓</span>'}</div>${UI.progress(c.done, c.total, '#0CA678')}</div>` : ''}
      ${prev ? `<button class="banner info" data-act="carry"><i class="ph ph-arrow-bend-down-right lead"></i><span>Carry over ${prev.n} unfinished job${prev.n > 1 ? 's' : ''} from ${U.fmtDate(prev.date)}</span></button>` : ''}
      ${list.beds.map((b, bi) => `<div class="card" style="border-left:5px solid #0CA678">
        <div class="cal-head"><button data-act="bedMenu" data-b="${bi}" style="text-align:left;min-height:44px;flex:1"><h3>${U.esc(b.label)}</h3>${b.note ? `<div class="muted small">${U.esc(b.note)}</div>` : ''}</button>
          <span class="tag ${b.jobs.every(j => j.done) && b.jobs.length ? 'good' : ''}">${b.jobs.filter(j => j.done).length}/${b.jobs.length}</span></div>
        ${b.jobs.map((j, ji) => `<div class="job-row ${j.done ? 'done' : ''}"><label class="check-row" style="flex:1;margin:0"><input type="checkbox" data-change="toggle" data-b="${bi}" data-j="${ji}" ${j.done ? 'checked' : ''}>
          <span>${j.urgent && !j.done ? '<i class="ph-fill ph-warning-circle" style="color:var(--bad)" aria-label="urgent"></i> ' : ''}${U.esc(j.text)}</span></label>
          <button class="icon-btn" data-act="jobMenu" data-b="${bi}" data-j="${ji}" aria-label="Job options"><i class="ph ph-dots-three"></i></button></div>`).join('')}
        <div class="chips" style="margin-top:6px">${tpls.map(t => `<button class="chip" data-act="addJob" data-b="${bi}" data-text="${U.esc(t)}">+ ${U.esc(t)}</button>`).join('')}</div>
        <div class="job-add"><input type="text" placeholder="Other job…" data-input="${bi}" aria-label="New job for ${U.esc(b.label)}"><button class="btn btn-small btn-primary" data-act="addCustom" data-b="${bi}">Add</button></div></div>`).join('')
        || (prev ? '' : UI.empty('No jobs yet. After the ward round, add each bed and its jobs.', 'ph-list-checks'))}
      <button class="btn btn-primary btn-block" data-act="addBed"><i class="ph ph-bed"></i> Add bed / patient</button>`;
  },
  actions({ date } = {}) {
    date = date || U.todayStr();
    const done = async (msg) => { if (msg) UI.toast(msg, 'ph-list-checks'); await App.changed({ celebrate: false }); };
    return {
      day: (el) => Nav.go('wardJobs', { date: el.dataset.v }, { replace: true }),
      addBed: async () => {
        const list = await WardJobs.get(date);
        const f = await UI.form('Add bed / patient', [{ name: 'label', label: 'Bed / bay (no names)', value: WardJobs.nextBedLabel(list), required: true },
          { name: 'note', label: 'Short note (optional, no identifiers)', placeholder: 'e.g. post-op day 2' }], { intro: Logs.PID_NOTE, submit: 'Add bed' });
        if (!f) return;
        await WardJobs.change(date, (l) => { l.beds.push({ id: U.uid('bed'), label: f.label, note: f.note, jobs: [] }); });
        await done();
      },
      addJob: async (el) => {
        await WardJobs.change(date, (l) => { l.beds[Number(el.dataset.b)].jobs.push({ id: U.uid('job'), text: el.dataset.text, done: false, urgent: false }); });
        await done();
      },
      addCustom: async (el) => {
        const input = document.querySelector(`#view [data-input="${el.dataset.b}"]`);
        const text = (input && input.value || '').trim();
        if (!text) { if (input) input.focus(); return; }
        await WardJobs.change(date, (l) => { l.beds[Number(el.dataset.b)].jobs.push({ id: U.uid('job'), text, done: false, urgent: false }); });
        await done();
      },
      toggle: async (el) => {
        const b = Number(el.dataset.b), j = Number(el.dataset.j), checked = el.checked;
        await WardJobs.change(date, (l) => { const job = l.beds[b].jobs[j]; job.done = checked; job.doneDate = checked ? U.todayStr() : ''; });
        U.vibrate(checked ? 20 : 8);
        const list = await WardJobs.get(date);
        const c = WardJobs.counts(list);
        if (checked && c.total && !c.open) { await App.changed({ celebrate: false }); await Otto.celebrate({ title: 'All jobs done!', sub: 'Every bed sorted. The capybara approves.', kind: 'capybara', big: false, button: 'Brilliant' }); }
        else await done();
      },
      jobMenu: async (el) => {
        const b = Number(el.dataset.b), j = Number(el.dataset.j);
        const job = (await WardJobs.get(date)).beds[b].jobs[j];
        const v = await UI.choose(job.text, [{ value: 'edit', label: 'Edit text', icon: 'ph-pencil-simple' }, { value: 'urgent', label: job.urgent ? 'Not urgent' : 'Mark as urgent', icon: 'ph-warning-circle' },
          { value: 'task', label: 'Also add to my day as a task', icon: 'ph-calendar-plus' }, { value: 'del', label: 'Delete job', icon: 'ph-trash', danger: true }]);
        if (v === 'edit') {
          const f = await UI.form('Edit job', [{ name: 'text', label: 'Job', value: job.text, required: true }]);
          if (f) await WardJobs.change(date, (l) => { l.beds[b].jobs[j].text = f.text; });
        } else if (v === 'urgent') await WardJobs.change(date, (l) => { l.beds[b].jobs[j].urgent = !l.beds[b].jobs[j].urgent; });
        else if (v === 'task') { const bed = (await WardJobs.get(date)).beds[b]; await More.scheduleSheet(`${bed.label}: ${job.text}`, 'a3'); }
        else if (v === 'del') await WardJobs.change(date, (l) => { l.beds[b].jobs.splice(j, 1); });
        else return;
        await done();
      },
      bedMenu: async (el) => {
        const b = Number(el.dataset.b);
        const bed = (await WardJobs.get(date)).beds[b];
        const v = await UI.choose(bed.label, [{ value: 'edit', label: 'Rename / note', icon: 'ph-pencil-simple' }, { value: 'up', label: 'Move up', icon: 'ph-arrow-up' },
          { value: 'del', label: 'Remove bed and its jobs', icon: 'ph-trash', danger: true }]);
        if (v === 'edit') {
          const f = await UI.form('Bed', [{ name: 'label', label: 'Bed / bay (no names)', value: bed.label, required: true }, { name: 'note', label: 'Short note (no identifiers)', value: bed.note || '' }], { intro: Logs.PID_NOTE });
          if (f) await WardJobs.change(date, (l) => { Object.assign(l.beds[b], f); });
        } else if (v === 'up' && b > 0) await WardJobs.change(date, (l) => { [l.beds[b - 1], l.beds[b]] = [l.beds[b], l.beds[b - 1]]; });
        else if (v === 'del') { if (await UI.confirm(`Remove ${bed.label} and its ${bed.jobs.length} job(s)?`, { ok: 'Remove', danger: true })) await WardJobs.change(date, (l) => { l.beds.splice(b, 1); }); else return; }
        else return;
        await done();
      },
      carry: async () => {
        const prev = await WardJobs.previousOpen(date);
        if (!prev) return;
        await WardJobs.change(date, (l) => {
          prev.beds.forEach(pb => {
            const same = l.beds.find(x => U.norm(x.label) === U.norm(pb.label));
            const jobs = pb.jobs.map(j => ({ ...j, id: U.uid('job'), carried: prev.date }));
            if (same) same.jobs.push(...jobs); else l.beds.push({ id: U.uid('bed'), label: pb.label, note: pb.note || '', jobs });
          });
        });
        await done(`${prev.n} job${prev.n > 1 ? 's' : ''} carried over`);
      },
      share: async () => {
        const list = await WardJobs.get(date);
        if (!list.beds.length) { UI.toast('Nothing to share yet', 'ph-list-checks'); return; }
        Logs.exportText('Ward jobs (handover)', WardJobs.text(list), 'ward-jobs');
      },
      menu: async () => {
        const v = await UI.choose('Ward jobs', [{ value: 'tpl', label: 'Edit quick-add jobs', sub: WardJobs.templates().slice(0, 4).join(', ') + '…', icon: 'ph-list-plus' },
          { value: 'clear', label: 'Remove finished jobs', icon: 'ph-broom' }]);
        if (v === 'tpl') {
          const f = await UI.form('Quick-add jobs', [{ name: 't', type: 'textarea', label: 'One per line', value: WardJobs.templates().join('\n'), rows: 12, required: true }]);
          if (!f) return;
          App.settings.clinical = { ...(App.settings.clinical || {}), jobTemplates: f.t.split('\n').map(x => x.trim()).filter(Boolean) };
          await App.saveSettings(); await done('Saved');
        } else if (v === 'clear') {
          if (!(await UI.confirm('Remove the finished jobs from this list? (They still count for your Clinical streak.)', { ok: 'Remove', title: 'Tidy up' }))) return;
          await WardJobs.change(date, (l) => {
            l.doneLog = [...(l.doneLog || []), ...l.beds.flatMap(b => b.jobs.filter(j => j.done).map(j => ({ doneDate: j.doneDate || date })))];
            l.beds.forEach(b => { b.jobs = b.jobs.filter(j => !j.done); });
          });
          await done();
        }
      }
    };
  }
};
window.WardJobs = WardJobs;

// Finished jobs count towards the Clinical work streak (one per day).
Streaks.extraSources.push(async () => (await Repo.all('wardList')).flatMap(l => [...l.beds.flatMap(b => b.jobs.filter(j => j.done)), ...(l.doneLog || [])])
  .map(j => ({ areaId: 'a3', date: j.doneDate || '', n: 1, tag: 'jobs' })).filter(e => e.date));

// Today: open jobs reminder (on today's plan only).
Today.bannerHooks.push(async (day) => {
  if (day.date !== U.todayStr()) return [];
  const c = WardJobs.counts(await WardJobs.get(day.date));
  if (!c.open) return [];
  return [{ cls: c.urgent ? 'bad' : 'info', icon: 'ph-list-checks', text: `Ward jobs: ${c.open} left${c.urgent ? ` (${c.urgent} urgent)` : ''}`, act: 'go', data: { view: 'wardJobs' } }];
});

Nav.register('wardJobs', { tab: 'today', render: (p) => WardJobs.render(p), actions: (p) => WardJobs.actions(p) });
