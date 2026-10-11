// ======= util.js — small shared helpers (dates, times, text, files) =======
// All dates in the app are LOCAL calendar dates as 'YYYY-MM-DD' strings.
// Never use toISOString() for a calendar date: in the UK it gives the previous
// day between midnight and 1am (BST).

const U = {
  pad(n) { return String(n).padStart(2, '0'); },

  dateStr(d) { return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`; },
  todayStr() { return U.dateStr(new Date()); },
  // Noon avoids daylight-saving edge cases when adding days.
  parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); },
  addDays(s, n) { const d = U.parseDate(s); d.setDate(d.getDate() + n); return U.dateStr(d); },
  diffDays(a, b) { return Math.round((U.parseDate(b) - U.parseDate(a)) / 86400000); }, // b - a
  dow(s) { return U.parseDate(s).getDay(); }, // 0 = Sunday
  weekStart(s) { const dw = U.dow(s); return U.addDays(s, dw === 0 ? -6 : 1 - dw); }, // Monday
  monthStr(s) { return s.slice(0, 7); },
  quarterStr(s) { const m = Number(s.slice(5, 7)); return `${s.slice(0, 4)}-Q${Math.ceil(m / 3)}`; },
  DOW: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  DOW3: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fmtDate(s, opts = {}) {
    if (!s) return '';
    const d = U.parseDate(s);
    const base = `${d.getDate()} ${U.MONTHS[d.getMonth()].slice(0, 3)}`;
    const withDow = opts.dow === false ? base : `${U.DOW3[d.getDay()]} ${base}`;
    return opts.year ? `${withDow} ${d.getFullYear()}` : withDow;
  },
  relDay(s) {
    const n = U.diffDays(U.todayStr(), s);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? `in ${n} days` : `${-n} days ago`;
  },

  // Times are 'HH:MM'; '24:00' is allowed as an end time (midnight).
  toMin(t) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); },
  fromMin(m) { m = Math.max(0, Math.min(1440, Math.round(m))); return `${U.pad(Math.floor(m / 60))}:${U.pad(m % 60)}`; },
  durMin(task) { return Math.max(0, U.toMin(task.endTime || task.time) - U.toMin(task.time)); },
  fmtDur(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
  },
  nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  uid(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; },
  clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); },
  sum(arr, f = x => x) { return arr.reduce((a, x) => a + (Number(f(x)) || 0), 0); },
  by(f) { return (a, b) => { const x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; }; },
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); },

  downloadText(filename, text, mime = 'text/plain') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
  // Share sheet on iPhone; falls back to copying to the clipboard.
  async shareText(title, text) {
    if (navigator.share) {
      try { await navigator.share({ title, text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return 'failed'; }
  },
  // Opens the system file picker (Files app on iPhone). Resolves to a File or null.
  pickFile(accept) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      input.style.display = 'none';
      input.onchange = () => { resolve(input.files[0] || null); input.remove(); };
      document.body.appendChild(input);
      input.click();
    });
  },
  readFileText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  },
  // Only after a real tap (browsers block it otherwise); iPhone Safari ignores it anyway.
  vibrate(ms = 30) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { /* not supported */ } }
};

window.U = U;
window.getLocalDateStr = U.dateStr;
