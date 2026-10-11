// ======= task-editor.js — one editor for every task (on a day or inside a template) =======

const TaskEditor = {
  TAGS: [
    { value: '', label: 'None' },
    { value: 'gym', label: 'Gym session (opens the workout log)' },
    { value: 'speaking', label: 'Speaking practice (logs German speaking minutes)' },
    { value: 'review', label: 'Weekly review (opens the review)' },
    { value: 'ward', label: 'Ward round (opens the ward jobs list)' },
    { value: 'downtime', label: 'Downtime / rest (shows the sloth)' }
  ],

  // open({date, task}) edits a task on a day; open({templateId, task}) edits a template task.
  // Missing task = new task. start = suggested start time in minutes.
  async open({ date = null, templateId = null, task = null, start = null, preset = {} } = {}) {
    const isNew = !task;
    const startMin = start != null ? start : (date === U.todayStr() ? Math.ceil((U.nowMin() + 1) / 15) * 15 : 9 * 60);
    const t = task ? U.clone(task) : {
      id: U.uid('t'), title: '', time: U.fromMin(Math.min(startMin, 1410)), endTime: U.fromMin(Math.min(startMin + 30, 1440)),
      desc: '', areaId: null, core: false, optional: false, infoOnly: false, xp: 10, tag: '', ...preset
    };
    t.srcId = t.srcId || t.id;
    const day = date ? await Days.ensure(date) : null;
    const tpl = templateId ? Days.templateById(templateId) : (day ? Days.templateForDay(day) : null);
    const weekday = date ? U.DOW[U.dow(date)] : '';
    const fields = [
      { name: 'title', label: 'Title', value: t.title, required: true, placeholder: 'e.g. Anki' },
      { type: 'html', html: '<div class="two">' },
      { name: 'time', type: 'time', label: 'Start', value: t.time },
      { name: 'endTime', type: 'time', label: 'End', value: t.endTime === '24:00' ? '23:59' : t.endTime },
      { type: 'html', html: '</div>' },
      { type: 'durations', start: 'time', end: 'endTime' },
      { name: 'areaId', type: 'select', label: 'Area', value: t.areaId || '', options: UI.areaOptions(true, 'No area (overall streak only)') },
      { name: 'desc', type: 'textarea', label: 'What to do (optional)', value: t.desc, rows: 2 },
      { name: 'core', type: 'checkbox', label: '★ Core task (needed for the streak)', value: t.core },
      { name: 'optional', type: 'checkbox', label: 'Optional (never counts against you)', value: t.optional },
      { name: 'infoOnly', type: 'checkbox', label: 'Info only (a time block, not tickable)', value: t.infoOnly },
      { name: 'xp', type: 'number', label: 'XP when ticked', value: t.xp ?? 10, min: 0, max: 500, step: 1 },
      { name: 'tag', type: 'select', label: 'Special type', value: t.tag || '', options: TaskEditor.TAGS }
    ];
    if (isNew && date && tpl) fields.push({ name: 'addToTemplate', type: 'checkbox', label: `Also add to the "${tpl.name}" template (all future ${weekday}s)`, value: false });
    const buttons = [];
    if (!isNew && date && window.Focus && !t.infoOnly) buttons.push({ label: 'Start focus timer', value: 'focus' });
    if (!isNew) buttons.push({ label: 'Delete task', value: 'delete', danger: true });
    const vals = await UI.form(isNew ? 'New task' : 'Edit task', fields, {
      submit: isNew ? 'Add task' : 'Save',
      buttons,
      validate: (v) => {
        if (!v.time || !v.endTime) return 'Please set a start and an end time.';
        const end = v.endTime === '23:59' ? 1440 : U.toMin(v.endTime);
        if (end <= U.toMin(v.time)) return 'The end time must be after the start time.';
        if (v.core && v.optional) return 'A task can be core or optional, not both.';
        if (v.core && v.infoOnly) return 'An info-only block cannot be a core task.';
        return null;
      }
    });
    if (!vals) return null;

    if (vals._button === 'focus') { Focus.start({ task: t, date }); return null; }
    if (vals._button === 'delete') {
      if (templateId) {
        if (!(await UI.confirm(`Delete "${t.title}" from this template? Past days are not changed.`, { ok: 'Delete', danger: true }))) return null;
        await Days.applyToTemplate({ date: U.todayStr(), templateId: tpl.id }, t, 'delete');
      } else {
        const scope = await TaskEditor.askScope(date, tpl, 'Delete');
        if (!scope) return null;
        await Days.deleteTask(date, t.id, scope);
      }
      UI.toast('Task deleted', 'ph-trash');
      await App.changed({ celebrate: false });
      return null;
    }

    Object.assign(t, {
      title: vals.title, time: vals.time, endTime: vals.endTime === '23:59' ? '24:00' : vals.endTime,
      areaId: vals.areaId || null, desc: vals.desc, core: vals.core, optional: vals.optional,
      infoOnly: vals.infoOnly, xp: vals.infoOnly ? 0 : (Number(vals.xp) || 0), tag: vals.tag
    });

    if (templateId) {
      await Days.applyToTemplate({ date: U.todayStr(), templateId: tpl.id }, t, 'upsert');
    } else if (isNew) {
      await Days.upsertTask(date, t, vals.addToTemplate ? 'future' : 'day');
    } else {
      const scope = await TaskEditor.askScope(date, tpl, 'Save');
      if (!scope) return null;
      await Days.upsertTask(date, t, scope);
    }
    UI.toast(isNew ? 'Task added' : 'Saved');
    await App.changed({ celebrate: false });
    return t;
  },

  // "Only this day" or "This day and all future <weekday>s" (updates the template; the past never changes).
  async askScope(date, tpl, verb) {
    if (!tpl) return 'day';
    const wd = U.DOW[U.dow(date)];
    return UI.choose(`${verb} for…`, [
      { value: 'day', label: date === U.todayStr() ? 'Only today' : `Only ${U.fmtDate(date)}`, icon: 'ph-calendar-blank' },
      { value: 'future', label: `This day and all future ${wd}s`, sub: `Also updates the "${tpl.name}" template. Past days never change.`, icon: 'ph-calendar-check' }
    ]);
  }
};
window.TaskEditor = TaskEditor;
