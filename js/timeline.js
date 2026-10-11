// ======= timeline.js — 24-hour day view with touch drag-to-move and drag-to-resize =======
// Pointer events (work on iPhone Safari). Long-press a block to move it; drag the small
// handle at its bottom edge to change the length. Everything snaps to 5 minutes.

const Timeline = {
  PX: 1.1,        // pixels per minute
  SNAP: 5,
  LONG_PRESS: 350,
  lastScroll: null, // keeps the scroll position when the same day re-renders

  layout(tasks) {
    // Very short tasks are drawn taller than their length, so lay them out with that height
    // (otherwise their titles would collide with the next task).
    const minLen = Math.ceil(20 / Timeline.PX);
    const items = tasks.map(t => ({ t, s: U.toMin(t.time), real: U.toMin(t.endTime), e: Math.max(U.toMin(t.endTime), U.toMin(t.time) + minLen) }))
      .sort((a, b) => a.s - b.s || b.e - a.e);
    // Group tasks that overlap (directly or through a chain); only those share the width.
    const clusters = [];
    let cur = null, curEnd = -1;
    for (const it of items) {
      if (!cur || it.s >= curEnd) { cur = []; clusters.push(cur); curEnd = it.e; } else curEnd = Math.max(curEnd, it.e);
      cur.push(it);
    }
    for (const cl of clusters) {
      const colEnds = [];
      for (const it of cl) {
        let c = colEnds.findIndex(end => end <= it.s);
        if (c === -1) { c = colEnds.length; colEnds.push(it.e); } else colEnds[c] = it.e;
        it.col = c;
      }
      cl.forEach(it => { it.cols = colEnds.length; });
    }
    return items;
  },
  freeGaps(tasks) {
    const iv = tasks.map(t => [U.toMin(t.time), U.toMin(t.endTime)]).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cursor = 0, busy = 0;
    for (const [s, e] of iv) {
      if (s > cursor) gaps.push([cursor, s]);
      if (e > cursor) { busy += e - Math.max(s, cursor); cursor = e; }
    }
    if (cursor < 1440) gaps.push([cursor, 1440]);
    return { gaps, free: 1440 - busy };
  },

  html(day) {
    const PX = Timeline.PX, H = 1440 * PX;
    const done = new Set(day.completedTaskIds);
    const items = Timeline.layout(day.tasks);
    const { gaps, free } = Timeline.freeGaps(day.tasks);
    let labels = '', lines = '';
    for (let h = 0; h <= 24; h++) {
      labels += `<div class="tl-label" style="top:${h * 60 * PX}px">${U.pad(h % 24 === 0 && h ? 24 : h)}:00</div>`;
      lines += `<div class="tl-hour" style="top:${h * 60 * PX}px"></div>`;
      if (h < 24) lines += `<div class="tl-half" style="top:${(h * 60 + 30) * PX}px"></div>`;
    }
    const gapHtml = gaps.filter(([s, e]) => e - s >= 30).map(([s, e]) =>
      `<div class="tl-free" style="top:${s * PX + 2}px;height:${(e - s) * PX - 4}px">Free ${U.fmtDur(e - s)}</div>`).join('');
    const blocks = items.map(it => {
      const a = App.areaById(it.t.areaId);
      const w = 100 / it.cols;
      const short = (it.real - it.s) * PX < 34;
      return `<div class="tl-block ${it.t.infoOnly ? 'info' : ''} ${done.has(it.t.id) ? 'done' : ''} ${short ? 'short' : ''}" data-id="${it.t.id}"
        style="--c:${a ? a.color : '#adb5bd'};top:${it.s * PX}px;height:${Math.max(20, (it.real - it.s) * PX - 2)}px;left:calc(${it.col * w}% + 3px);width:calc(${w}% - 6px)">
        <b>${it.t.core ? '★ ' : ''}${U.esc(it.t.title)}</b><span class="t">${it.t.time}–${it.t.endTime}</span>
        <div class="tl-resize" data-resize="${it.t.id}" aria-label="Drag to change the length"></div></div>`;
    }).join('');
    const isToday = day.date === U.todayStr();
    const now = isToday ? `<div class="tl-now" style="top:${U.nowMin() * PX}px"></div>` : '';
    return `<div class="tl-head"><span><i class="ph ph-clock"></i> Free time: ${U.fmtDur(free)}</span>
        <span class="muted tiny">Tap empty space to add · hold a block to move it</span></div>
      <div class="tl-scroll" id="tl-scroll"><div class="tl" style="height:${H + 12}px;padding-top:6px">
        <div class="tl-labels" style="height:${H}px">${labels}</div>
        <div class="tl-grid" id="tl-grid" style="height:${H}px">${lines}${gapHtml}${blocks}${now}</div>
      </div></div>`;
  },

  mount(root, day) {
    const PX = Timeline.PX, SNAP = Timeline.SNAP;
    const scroller = root.querySelector('#tl-scroll');
    const grid = root.querySelector('#tl-grid');
    if (!grid) return;
    // Scroll: keep position on re-render of the same day, otherwise jump to now (or 07:00).
    const key = day.date;
    if (Timeline.lastScroll && Timeline.lastScroll.key === key) scroller.scrollTop = Timeline.lastScroll.top;
    else {
      const target = day.date === U.todayStr() ? U.nowMin() - 90 : 7 * 60;
      scroller.scrollTop = Math.max(0, target * PX);
    }
    scroller.addEventListener('scroll', () => { Timeline.lastScroll = { key, top: scroller.scrollTop }; }, { passive: true });

    const snap = (m) => Math.round(m / SNAP) * SNAP;
    const yToMin = (clientY) => (clientY - grid.getBoundingClientRect().top) / PX;
    let st = null; // drag state

    const tip = (el, text) => {
      let t = grid.querySelector('.tl-tip');
      if (!t) { t = document.createElement('div'); t.className = 'tl-tip'; grid.appendChild(t); }
      t.textContent = text; t.style.top = `${Math.max(0, el.offsetTop - 22)}px`;
    };
    const clearTip = () => { const t = grid.querySelector('.tl-tip'); if (t) t.remove(); };

    // Prevent the page from scrolling while dragging (iOS needs a non-passive touchmove).
    grid.addEventListener('touchmove', (e) => { if (st && st.active) e.preventDefault(); }, { passive: false });

    grid.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('[data-resize]');
      const block = e.target.closest('.tl-block');
      if (!block) return;
      const task = day.tasks.find(t => t.id === block.dataset.id);
      if (!task) return;
      const s = U.toMin(task.time), en = U.toMin(task.endTime);
      st = { block, task, s, en, startY: e.clientY, pointerId: e.pointerId, active: false, moved: false,
        mode: handle ? 'resize' : 'move', grabOffset: yToMin(e.clientY) - s };
      if (handle) {
        st.active = true;
        block.classList.add('dragging');
        try { block.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
      } else {
        st.timer = setTimeout(() => {
          if (!st || st.moved) return;
          st.active = true;
          block.classList.add('dragging');
          try { block.setPointerCapture(st.pointerId); } catch (err) { /* ignore */ }
          U.vibrate(20);
          tip(block, `${task.time}–${task.endTime}`);
        }, Timeline.LONG_PRESS);
      }
    });
    grid.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.pointerId) return;
      if (!st.active) { if (Math.abs(e.clientY - st.startY) > 8) { st.moved = true; clearTimeout(st.timer); } return; }
      e.preventDefault();
      const dur = st.en - st.s;
      if (st.mode === 'move') {
        let ns = snap(yToMin(e.clientY) - st.grabOffset);
        ns = U.clamp(ns, 0, 1440 - dur);
        st.ns = ns; st.ne = ns + dur;
        st.block.style.top = `${ns * PX}px`;
      } else {
        // Move the end by how far the finger has travelled (no jump when the handle is first grabbed).
        let ne = snap(st.en + (e.clientY - st.startY) / PX);
        ne = U.clamp(ne, st.s + SNAP, 1440);
        st.ns = st.s; st.ne = ne;
        st.block.style.height = `${Math.max(18, (ne - st.s) * PX - 2)}px`;
      }
      tip(st.block, `${U.fromMin(st.ns)}–${U.fromMin(st.ne)}`);
    });
    const finish = async (e, cancelled) => {
      if (!st || (e && e.pointerId !== st.pointerId)) return;
      clearTimeout(st.timer);
      const s0 = st; st = null;
      clearTip();
      if (s0.active) {
        s0.block.classList.remove('dragging');
        if (cancelled || s0.ns == null || (s0.ns === s0.s && s0.ne === s0.en)) { await Nav.refresh(); return; }
        const t = { ...s0.task, time: U.fromMin(s0.ns), endTime: U.fromMin(s0.ne) };
        await Days.upsertTask(day.date, t, 'day');
        UI.toast(`Moved to ${t.time}–${t.endTime}`, 'ph-clock');
        await App.changed({ celebrate: false });
      } else if (!s0.moved && !cancelled && s0.mode === 'move') {
        TaskEditor.open({ date: day.date, task: s0.task });
      }
    };
    grid.addEventListener('pointerup', (e) => finish(e, false));
    grid.addEventListener('pointercancel', (e) => finish(e, true));
    grid.addEventListener('contextmenu', (e) => e.preventDefault());

    // Tap on empty space adds a task at that time (rounded to 15 min).
    grid.addEventListener('click', (e) => {
      if (e.target.closest('.tl-block')) return;
      const m = Math.floor(yToMin(e.clientY) / 15) * 15;
      TaskEditor.open({ date: day.date, start: U.clamp(m, 0, 1425) });
    });
  }
};
window.Timeline = Timeline;
