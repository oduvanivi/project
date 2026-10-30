/* ИС «ПроектОрг» — работающий макет АИС (Практическое занятие № 5, задание 2).
   Одностраничное приложение без сервера: данные хранятся в localStorage браузера,
   сеанс — в sessionStorage. Механизмы защиты реализованы на стороне клиента в учебных целях. */
(function () {
  'use strict';

  /* ================= SHA-256 (для хранения паролей в виде хэша) ================= */
  function sha256(ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const maxWord = Math.pow(2, 32);
    let result = '';
    const words = [];
    const bitLen = ascii.length * 8;
    let hash = [], k = [], pc = 0;
    const isComp = {};
    for (let c = 2; pc < 64; c++) {
      if (!isComp[c]) {
        for (let i = 0; i < 313; i += c) isComp[i] = c;
        hash[pc] = (Math.pow(c, 0.5) * maxWord) | 0;
        k[pc++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const old = hash;
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
    return result;
  }
  const utf8 = s => unescape(encodeURIComponent(s));
  const pwHash = (login, pw) => sha256(utf8('PO|' + String(login).toLowerCase() + '|' + pw + '|salt-2026'));

  /* ================= Утилиты ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
  const fdate = s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '—';
  const z2 = n => String(n).padStart(2, '0');
  const iso = (d = new Date()) => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
  const fdt = ts => { const d = new Date(ts); return z2(d.getDate()) + '.' + z2(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + z2(d.getHours()) + ':' + z2(d.getMinutes()) + ':' + z2(d.getSeconds()); };
  const ftime = ts => { const d = new Date(ts); return z2(d.getHours()) + ':' + z2(d.getMinutes()); };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + z2(s % 60); };
  const short = fio => { const p = String(fio).split(' '); return p.length < 2 ? fio : p[0] + ' ' + p.slice(1).map(x => x[0] + '.').join(' '); };
  const initials = fio => String(fio).split(' ').slice(0, 2).map(x => x[0] || '').join('');
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
  const byId = (arr, id) => arr.find(x => x.id === id);
  const go = path => { if (location.hash !== '#/' + path) location.hash = '#/' + path; else render(); };

  /* ================= Хранилище ================= */
  const STORE = 'proektorg.db', SESS = 'proektorg.session', FLASH = 'proektorg.flash', THEME = 'proektorg.theme';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } }
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* нет sessionStorage */ } }
  };
  let db;
  function freshDb() { return window.PO_SEED((l, p) => pwHash(l, p)); }
  function loadDb() {
    try { const d = JSON.parse(ls.get(STORE)); if (d && d.version === window.PO_SEED_VERSION) return d; } catch (e) { /* повреждённые данные */ }
    return null;
  }
  const save = () => ls.set(STORE, JSON.stringify(db));
  db = loadDb() || freshDb();
  save();

  const emp = id => byId(db.employees, id);
  const dept = id => byId(db.departments, id);
  const cust = id => byId(db.customers, id);
  const proj = id => byId(db.projects, id);
  const contract = id => byId(db.contracts, id);
  const contractSum = cid => db.links.filter(l => l.contractId === cid).reduce((s, l) => s + l.amount, 0);
  const projectCost = pid => db.links.filter(l => l.projectId === pid).reduce((s, l) => s + l.amount, 0);
  const canLead = e => e && (e.category === 'Инженер' || e.category === 'Конструктор');

  /* ================= Роли и права (ТБ-3) ================= */
  const ROLES = {
    sysadmin: { name: 'Администратор системы', short: 'Адм. системы', chip: 'gray' },
    secadmin: { name: 'Администратор безопасности', short: 'Адм. ИБ', chip: 'red' },
    pm: { name: 'Руководитель проекта (договора)', short: 'РП', chip: 'indigo' },
    head: { name: 'Начальник отдела', short: 'Нач. отдела', chip: 'sky' },
    hr: { name: 'Кадровик', short: 'Кадровик', chip: 'violet' },
    buh: { name: 'Бухгалтер (экономист)', short: 'Экономист', chip: 'green' },
    spec: { name: 'Специалист', short: 'Специалист', chip: 'amber' },
    guest: { name: 'Гость', short: 'Гость', chip: 'gray' }
  };
  const PERMS = {
    'contracts.view': ['pm', 'head', 'buh'],
    'contracts.edit': ['pm'],
    'money.view': ['pm', 'head', 'buh'],
    'projects.view': ['pm', 'head', 'buh', 'spec', 'guest'],
    'projects.edit': ['pm'],
    'employees.view': ['hr', 'head', 'pm', 'spec'],
    'employees.edit': ['hr'],
    'pd.view': ['hr', 'head', 'pm'],
    'pd.unmask': ['hr'],
    'equipment.view': ['pm', 'head', 'spec'],
    'equipment.transfer': ['head'],
    'equipment.assign': ['pm'],
    'subs.view': ['pm', 'buh'],
    'subs.edit': ['pm'],
    'departments.view': ['hr', 'head'],
    'departments.edit': ['hr'],
    'reports.view': ['pm', 'head', 'buh', 'hr'],
    'audit.view': ['secadmin'],
    'users.view': ['sysadmin', 'secadmin'],
    'users.manage': ['sysadmin'],
    'users.unlock': ['secadmin'],
    'policy.edit': ['secadmin']
  };
  let me = null;
  const can = (perm, role) => (PERMS[perm] || []).includes(role || (me && me.role));

  const MENU = [
    { sec: 'Работа' },
    { id: 'dashboard', label: 'Главная', icon: 'home' },
    { id: 'contracts', label: 'Договоры', icon: 'file', perm: 'contracts.view' },
    { id: 'projects', label: 'Проекты', icon: 'layers', perm: 'projects.view' },
    { id: 'employees', label: 'Сотрудники', icon: 'users', perm: 'employees.view' },
    { id: 'equipment', label: 'Оборудование', icon: 'cpu', perm: 'equipment.view' },
    { id: 'subcontractors', label: 'Субподрядчики', icon: 'briefcase', perm: 'subs.view' },
    { id: 'departments', label: 'Отделы', icon: 'building', perm: 'departments.view' },
    { id: 'reports', label: 'Отчёты', icon: 'chart', perm: 'reports.view' },
    { sec: 'Безопасность' },
    { id: 'audit', label: 'Журнал событий', icon: 'shield', perm: 'audit.view', tag: 'ИБ' },
    { id: 'users', label: 'Учётные записи', icon: 'key', perm: 'users.view' },
    { id: 'policy', label: 'Политика безопасности', icon: 'lock', perm: 'policy.edit' },
    { sec: 'Справка' },
    { id: 'about', label: 'О прототипе', icon: 'info' }
  ];
  function menuFor(role) {
    const out = [];
    let sec = null;
    MENU.forEach(m => {
      if (m.sec) { sec = m; return; }
      if (m.perm && !can(m.perm, role)) return;
      if (sec) { out.push(sec); sec = null; }
      out.push(m);
    });
    return out;
  }

  /* ================= Иконки ================= */
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16V6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.4 18.4 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    transfer: '<path d="M17 3l4 4-4 4M21 7H7M7 21l-4-4 4-4M3 17h14"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    ruble: '<path d="M8 21V3h6a5 5 0 0 1 0 10H6M6 17h9"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    logo: '<path d="M6 20V5h12v15M10 20v-9h4v9M3 20h18"/>'
  };
  const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;

  /* ================= Журнал событий (ТБ-6) ================= */
  const TYPES = { AUTH: 'Аутентификация', SEC: 'Безопасность', ACCESS: 'Доступ', PD: 'ПДн', DATA: 'Данные', ADMIN: 'Администрирование', REPORT: 'Отчёты' };
  let ip = ss.get('proektorg.ip');
  if (!ip) { ip = '10.20.' + (5 + Math.floor(Math.random() * 4)) + '.' + (20 + Math.floor(Math.random() * 200)); ss.set('proektorg.ip', ip); }
  function audit(type, action, object, details = '', result = 'успех', who) {
    const u = who || me;
    db.audit.unshift({ id: db.seq.audit++, ts: Date.now(), login: u ? u.login : '—', role: u ? u.role : '—', ip, type, action, object, details, result });
    if (db.audit.length > 2000) db.audit.length = 2000;
    save();
  }

  /* ================= Модальные окна, уведомления ================= */
  function modal({ title, body, foot = '', wide = false, icon = '', closable = true, onMount }) {
    const el = document.createElement('div');
    el.className = 'modal-back';
    el.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">${icon}<h3>${esc(title)}</h3>${closable ? `<button class="icon-btn" data-close aria-label="Закрыть">${ic('x')}</button>` : ''}</div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    $('#modal-root').appendChild(el);
    const listeners = [];
    const close = () => { if (!el.isConnected) return; el.remove(); document.removeEventListener('keydown', onKey); listeners.forEach(f => f()); };
    const onKey = e => { if (e.key === 'Escape' && closable) close(); };
    document.addEventListener('keydown', onKey);
    el.addEventListener('mousedown', e => { if (e.target === el && closable) close(); });
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    const api = { el, close, onClose: f => listeners.push(f) };
    if (onMount) onMount(el, close, api);
    const f = el.querySelector('[autofocus]') || el.querySelector('input, select, textarea');
    if (f) setTimeout(() => f.focus(), 30);
    return api;
  }
  const closeAllModals = () => $$('#modal-root .modal-back').forEach(m => m.remove());

  // Подтверждение опасных действий: опционально — ввод контрольного слова и выбор основания
  function confirmAction({ title, text, ok = 'Подтвердить', danger = true, word = null, reasons = null }) {
    return new Promise(resolve => {
      let result = false;
      const body = `<p class="small" style="font-size:14px">${text}</p>
        ${reasons ? `<label class="field" style="margin-top:14px"><span>Основание <span class="req">*</span></span>
          <select id="cf-reason"><option value="">— выберите основание —</option>${reasons.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>` : ''}
        ${word ? `<label class="field" style="margin-top:14px"><span>Для подтверждения введите: <b class="mono">${esc(word)}</b></span><input id="cf-word" autocomplete="off" spellcheck="false"></label>` : ''}`;
      const m = modal({
        title, body,
        icon: `<div class="${danger ? 'danger-ico' : 'warn-ico'}">${ic(danger ? 'alert' : 'shield')}</div>`,
        foot: `<button class="btn" data-close>Отмена</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${esc(ok)}</button>`,
        onMount(el, close) {
          const okBtn = $('#cf-ok', el), w = $('#cf-word', el), rs = $('#cf-reason', el);
          const upd = () => { okBtn.disabled = (w && w.value.trim() !== word) || (rs && !rs.value); };
          upd();
          if (w) w.addEventListener('input', upd);
          if (rs) rs.addEventListener('change', upd);
          okBtn.addEventListener('click', () => { result = rs ? rs.value : true; close(); });
        }
      });
      m.onClose(() => resolve(result));
    });
  }

  function toast(msg, kind = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = ic(kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info') + `<span>${esc(msg)}</span>`;
    $('#toast-root').appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* ================= Сеанс, тайм-аут бездействия ================= */
  let sess = null;
  try { sess = JSON.parse(ss.get(SESS)); } catch (e) { sess = null; }
  const saveSess = () => ss.set(SESS, sess ? JSON.stringify(sess) : null);
  if (sess) {
    me = db.users.find(u => u.login === sess.login && u.active) || null;
    if (!me || Date.now() - sess.last > db.policy.idleMinutes * 60000) {
      if (me) audit('AUTH', 'Завершение сеанса по бездействию', 'Сеанс', 'Тайм-аут ' + db.policy.idleMinutes + ' мин', 'успех', me);
      me = null; sess = null; saveSess();
    }
  }
  let warn = null;
  function touch() {
    if (!sess || warn) return;
    const n = Date.now();
    if (n - sess.last > 1500) { sess.last = n; saveSess(); }
  }
  ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart', 'wheel'].forEach(ev => document.addEventListener(ev, touch, { passive: true, capture: true }));

  function startSession(user) {
    me = user;
    sess = { login: user.login, started: Date.now(), last: Date.now() };
    saveSess();
  }
  function logout(reason) {
    if (me) {
      if (reason === 'timeout') audit('AUTH', 'Завершение сеанса по бездействию', 'Сеанс', 'Тайм-аут ' + db.policy.idleMinutes + ' мин');
      else audit('AUTH', 'Выход из системы', 'Сеанс');
    }
    me = null; sess = null; saveSess();
    closeAllModals(); warn = null;
    if (reason === 'timeout') ss.set(FLASH, JSON.stringify({ kind: 'warn', text: `Сеанс завершён автоматически после ${db.policy.idleMinutes} мин бездействия. Войдите в систему повторно.` }));
    else ss.set(FLASH, JSON.stringify({ kind: 'info', text: 'Вы вышли из системы. Сеанс завершён.' }));
    go('login');
  }
  function openWarn() {
    warn = modal({
      title: 'Сеанс скоро будет завершён', closable: false,
      icon: `<div class="warn-ico">${ic('clock')}</div>`,
      body: `<p>Вы не выполняли действий в системе. В целях безопасности сеанс будет автоматически завершён через:</p>
             <div class="big-timer" id="warn-timer">1:00</div>
             <p class="muted small">Тайм-аут бездействия — ${db.policy.idleMinutes} мин (политика безопасности).</p>`,
      foot: `<button class="btn" id="w-out">${ic('logout', 'sm')} Выйти</button><button class="btn primary" id="w-stay">Продолжить работу</button>`,
      onMount(el, close) {
        $('#w-stay', el).onclick = () => { close(); warn = null; sess.last = Date.now(); saveSess(); };
        $('#w-out', el).onclick = () => { close(); warn = null; logout(); };
      }
    });
  }
  let revealed = {}; // empId -> время окончания показа ПДн
  setInterval(() => {
    const now = Date.now();
    // обратный отсчёт блокировки на странице входа
    $$('[data-until]').forEach(el => {
      const left = +el.dataset.until - now;
      el.textContent = mmss(left);
      if (left <= 0 && el.closest('#login-msg')) { el.closest('#login-msg').innerHTML = alertBox('info', 'Срок блокировки истёк. Можно повторить вход.'); }
    });
    // истечение показа ПДн
    Object.keys(revealed).forEach(id => {
      if (revealed[id] <= now) { delete revealed[id]; if (location.hash === '#/employees/' + id) render(); }
      else { const t = $('#pd-left'); if (t) t.textContent = Math.ceil((revealed[id] - now) / 1000); }
    });
    if (!sess || !me) return;
    const left = db.policy.idleMinutes * 60000 - (now - sess.last);
    const chip = $('#sess-left');
    if (chip) { chip.textContent = mmss(left); chip.closest('.session-chip').classList.toggle('warn', left <= 60000); }
    if (left <= 0) { if (warn) { warn.close(); warn = null; } logout('timeout'); return; }
    if (left <= 60000 && !warn) openWarn();
    if (warn) { const t = $('#warn-timer'); if (t) t.textContent = mmss(left); }
  }, 1000);

  /* ================= Общие элементы интерфейса ================= */
  const alertBox = (kind, html) => `<div class="alert ${kind}">${ic(kind === 'danger' ? 'lock' : kind === 'warn' ? 'alert' : kind === 'success' ? 'check' : 'info')}<div>${html}</div></div>`;
  const STATUS_CHIP = {
    'Заключение': 'sky', 'Выполнение': 'indigo', 'Завершение': 'amber', 'Закрыт': 'gray',
    'Планирование': 'sky', 'В работе': 'indigo', 'Приостановлен': 'amber', 'Завершён': 'green',
    'Передано': 'sky', 'Принято': 'green'
  };
  const chip = (text, color) => `<span class="chip ${color || STATUS_CHIP[text] || 'gray'}"><span class="dot"></span>${esc(text)}</span>`;
  const roleChip = role => `<span class="chip ${ROLES[role] ? ROLES[role].chip : 'gray'}">${esc(ROLES[role] ? ROLES[role].name : role)}</span>`;
  const secret = (label = 'Скрыто · коммерческая тайна') => `<span class="secret" title="Недостаточно прав для просмотра стоимостных показателей">${ic('lock', 'sm')}${label}</span>`;
  const moneyCell = n => can('money.view') ? `<span class="nowrap">${money(n)}</span>` : secret('скрыто');
  const progress = p => `<div class="prog-cell"><div class="progress ${p >= 100 ? 'done' : ''}" style="flex:1"><i style="width:${p}%"></i></div><span>${p}%</span></div>`;
  const empLink = id => { const e = emp(id); if (!e) return '—'; return can('employees.view') && empVisible(e) ? `<a href="#/employees/${e.id}">${esc(short(e.fio))}</a>` : esc(short(e.fio)); };
  const projLink = id => { const p = proj(id); return p ? (can('projects.view') ? `<a href="#/projects/${p.id}">${esc(p.code)}</a>` : esc(p.code)) : '—'; };
  const empVisible = e => !(me && me.role === 'head') || e.deptId === myDept();
  const myDept = () => { const e = me && emp(me.empId); return e ? e.deptId : null; };

  // Маскирование персональных данных (принцип минимизации, ст. 5 ФЗ № 152-ФЗ)
  const MASK = {
    passport: v => '**** **' + v.slice(-4),
    snils: v => '***-***-*** ' + v.slice(-2),
    phone: v => '+7 (***) ***-' + v.slice(-5),
    email: v => v[0] + '•••@' + v.split('@')[1],
    birthDate: v => '**.**.' + v.slice(0, 4),
    address: v => v.split(',')[0] + ', ***'
  };

  // Универсальная таблица с сортировкой
  const ui = {};
  const uiState = (key, def) => (ui[key] = ui[key] || def);
  function dataTable(key, cols, rows, opts = {}) {
    const st = ui[key];
    const col = cols.find(c => c.key === st.sort);
    if (col) {
      const val = col.sortVal || (r => r[col.key]);
      rows = rows.slice().sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'string' ? x.localeCompare(y, 'ru') : x - y) * st.dir; });
    }
    if (!rows.length) return `<div class="empty">${ic('search')}<div>Записи не найдены. Измените условия поиска или фильтры.</div></div>`;
    return `<div class="table-wrap"><table class="tbl" data-tkey="${key}"><thead><tr>${cols.map(c =>
      `<th ${c.sortable === false ? '' : `data-sort="${c.key}"`} class="${c.num ? 'num' : ''}">${c.label}${st.sort === c.key ? `<span class="arr">${st.dir > 0 ? '↑' : '↓'}</span>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr ${opts.href ? `class="link" data-href="${opts.href(r)}"` : ''}${opts.attr ? opts.attr(r) : ''}>${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.cell(r)}</td>`).join('')}</tr>`).join('')}</tbody>
      ${opts.foot || ''}</table></div>`;
  }

  // Валидация форм: правила -> сообщение об ошибке или ''
  function validate(form, rules) {
    let ok = true, first = null;
    Object.entries(rules).forEach(([name, fn]) => {
      const inp = form.elements[name];
      const field = inp && (inp.closest ? inp.closest('.field') : null) || form.querySelector(`[data-field="${name}"]`);
      const msg = fn(inp ? inp.value : null, form);
      if (field) {
        field.classList.toggle('invalid', !!msg);
        const e = field.querySelector('.err');
        if (e) e.textContent = msg || '';
      }
      if (msg) { ok = false; if (!first) first = inp && inp.focus ? inp : null; }
    });
    if (first) first.focus();
    return ok;
  }
  const BAD_CHARS = /[<>{}$`\\]/;
  const V = {
    req: (v, m = 'Обязательное поле') => (!v || !String(v).trim()) ? m : '',
    text: (min, max) => v => { v = (v || '').trim(); if (!v) return 'Обязательное поле'; if (v.length < min) return `Не менее ${min} символов`; if (v.length > max) return `Не более ${max} символов`; if (BAD_CHARS.test(v)) return 'Недопустимые символы: < > { } $ ` \\'; return ''; },
    date: v => !v ? 'Укажите дату' : !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v)) ? 'Неверный формат даты (ДД.ММ.ГГГГ)' : ''
  };
  const field = (label, control, { req = false, hint = '', full = false } = {}) =>
    `<label class="field ${full ? 'full' : ''}"><span>${label}${req ? ' <span class="req">*</span>' : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}<span class="err"></span></label>`;
  const options = (list, sel, ph) => (ph ? `<option value="">${ph}</option>` : '') + list.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(t)}</option>`; }).join('');

  function downloadCSV(name, header, rows) {
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = '﻿' + [header, ...rows].map(r => r.map(q).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ================= Каркас страницы ================= */
  function shell(active, crumbs, content) {
    const theme = document.documentElement.dataset.theme;
    const items = menuFor(me.role).map(m => m.sec ? `<div class="nav-sec">${m.sec}</div>`
      : `<a href="#/${m.id}" class="${active === m.id ? 'active' : ''}">${ic(m.icon)}<span>${m.label}</span>${m.tag ? `<span class="tag">${m.tag}</span>` : ''}</a>`).join('');
    return `<div class="layout" id="layout">
      <aside class="sidebar" aria-label="Главное меню">
        <div class="brand"><div class="brand-mark"><svg viewBox="0 0 24 24">${I.logo}</svg></div><div><b>ПроектОрг</b><span>ИС проектной организации</span></div></div>
        <nav class="nav">${items}</nav>
        <div class="side-foot"><span class="pill">${ic('shieldCheck', 'sm')} УЗ-4</span><span class="pill">${ic('lock', 'sm')} КТ</span><div>Прототип v0.5 · синтетические данные</div></div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn burger" data-act="nav" aria-label="Меню">${ic('menu')}</button>
          <div class="crumbs">${crumbs}</div>
          <div class="spacer"></div>
          <span class="session-chip" title="До автоматического завершения сеанса при бездействии">${ic('clock', 'sm')}<span class="lbl">Сеанс:</span> <b id="sess-left">${mmss(db.policy.idleMinutes * 60000 - (Date.now() - sess.last))}</b></span>
          <button class="icon-btn" data-act="theme" title="Сменить тему" aria-label="Сменить тему">${ic(theme === 'dark' ? 'sun' : 'moon')}</button>
          <div class="user-menu">
            <button class="user-btn" data-act="usermenu" aria-haspopup="true"><span class="avatar">${esc(initials(me.fio))}</span><span class="who"><b>${esc(short(me.fio))}</b><span>${esc(ROLES[me.role].name)}</span></span></button>
          </div>
        </header>
        <main class="page" id="page">${content}</main>
      </div></div>`;
  }
  const crumb = (...parts) => parts.map((p, i) => i === parts.length - 1 ? `<b>${p}</b>` : p).join(' <span>/</span> ');
  const head = (title, sub = '', actions = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  const back = (href, label) => `<a class="back" href="#/${href}">${ic('back', 'sm')} ${label}</a>`;

  /* ================= Страница входа (ТБ-1) ================= */
  function attemptsOf(login) { return db.attempts[login] || (db.attempts[login] = { count: 0, lockedUntil: 0 }); }
  function lockMsg(until) {
    return alertBox('danger', `<b>Учётная запись временно заблокирована</b><br>Превышено допустимое число неуспешных попыток входа (${db.policy.maxAttempts}). Повторите попытку через <span class="countdown" data-until="${until}">${mmss(until - Date.now())}</span> или обратитесь к администратору безопасности.`);
  }
  function pageLogin() {
    let flash = null;
    try { flash = JSON.parse(ss.get(FLASH)); } catch (e) { flash = null; }
    ss.set(FLASH, null);
    const demo = db.users.map(u => `<button type="button" data-demo="${esc(u.login)}"><span class="avatar" style="width:28px;height:28px;font-size:11px">${esc(initials(u.fio))}</span><span style="flex:1;min-width:0"><b class="mono">${esc(u.login)}</b><br><span class="muted small">${esc(ROLES[u.role].name)}</span></span></button>`).join('');
    return `<div class="auth">
      <section class="auth-brand">
        <div class="brand"><div class="brand-mark"><svg viewBox="0 0 24 24">${I.logo}</svg></div><div><b>ПроектОрг</b><span style="color:#94a3b8">Информационная система</span></div></div>
        <h1>Информационная система проектной организации</h1>
        <p class="lead">Учёт кадров, договоров, проектов, оборудования и субподрядных работ в едином защищённом информационном пространстве.</p>
        <ul class="auth-features">
          <li>${ic('users')}<span>Ролевая модель доступа: 8 ролей, принцип минимальных привилегий</span></li>
          <li>${ic('eyeOff')}<span>Маскирование персональных данных (152-ФЗ, УЗ-4)</span></li>
          <li>${ic('activity')}<span>Журнал действий пользователей для администратора ИБ</span></li>
          <li>${ic('clock')}<span>Блокировка после 5 попыток и тайм-аут сеанса</span></li>
        </ul>
        <div class="auth-foot">Прототип (V-модель ЖЦ, этап 4 «Прототипирование»). Используются только синтетические данные.</div>
      </section>
      <section class="auth-side">
        <div class="auth-card">
          <h2>Вход в систему</h2>
          <p class="muted">Введите учётные данные, выданные администратором</p>
          <form id="login-form" novalidate autocomplete="off">
            <div id="login-msg">${flash ? alertBox(flash.kind, esc(flash.text)) : ''}</div>
            ${field('Логин', '<input name="login" maxlength="40" autocomplete="username" spellcheck="false" autofocus>', { req: true })}
            ${field('Пароль', '<input name="password" type="password" maxlength="64" autocomplete="current-password">', { req: true })}
            <div class="caps hidden" id="caps">${ic('alert', 'sm')} Включён Caps Lock</div>
            <button class="btn primary block" type="submit">${ic('lock', 'sm')} Войти</button>
            <div class="legal">${ic('shield', 'sm')}<span>Доступ разрешён только уполномоченным пользователям. Все действия регистрируются в журнале событий. Система обрабатывает персональные данные и сведения, составляющие коммерческую тайну.</span></div>
            <p class="muted small" style="text-align:center">Забыли пароль? Обратитесь к администратору системы.</p>
          </form>
        </div>
        <details class="demo">
          <summary>${ic('key', 'sm')} Демо-учётные записи прототипа</summary>
          <p class="pw">Пароль для всех учётных записей: <b class="mono">Proekt#Org2026</b><br>Нажмите на запись, чтобы подставить логин.</p>
          <div class="demo-list">${demo}</div>
        </details>
        <a href="#/about" class="small" style="font-weight:700">${ic('info', 'sm')} О прототипе: схема навигации и чек-лист безопасности</a>
      </section>
    </div>`;
  }
  function mountLogin() {
    const f = $('#login-form');
    const msg = $('#login-msg');
    $$('[data-demo]').forEach(b => b.onclick = () => { f.login.value = b.dataset.demo; f.password.value = ''; f.password.focus(); });
    f.password.addEventListener('keyup', e => $('#caps').classList.toggle('hidden', !(e.getModifierState && e.getModifierState('CapsLock'))));
    f.onsubmit = e => {
      e.preventDefault();
      if (!validate(f, { login: V.req, password: V.req })) return;
      const login = f.login.value.trim().toLowerCase();
      const pw = f.password.value;
      const at = attemptsOf(login);
      const now = Date.now();
      if (at.lockedUntil > now) {
        audit('AUTH', 'Попытка входа в заблокированную учётную запись', 'Учётная запись ' + login, '', 'отказ', { login, role: roleOfLogin(login) });
        msg.innerHTML = lockMsg(at.lockedUntil); f.password.value = ''; return;
      }
      const user = db.users.find(u => u.login === login);
      if (user && user.active && user.hash === pwHash(login, pw)) {
        at.count = 0; at.lockedUntil = 0;
        user.lastLogin = now;
        startSession(user);
        audit('AUTH', 'Вход в систему', 'Сеанс');
        save();
        go('dashboard');
        return;
      }
      at.count++;
      const n = at.count;
      audit('AUTH', 'Неуспешная попытка входа', 'Сеанс', `Неверный логин или пароль (${n}/${db.policy.maxAttempts})`, 'отказ', { login, role: roleOfLogin(login) });
      if (n >= db.policy.maxAttempts) {
        at.lockedUntil = now + db.policy.lockMinutes * 60000; at.count = 0;
        audit('SEC', 'Блокировка учётной записи', 'Учётная запись ' + login, `Превышено число попыток входа (${db.policy.maxAttempts}); блокировка на ${db.policy.lockMinutes} мин`, 'отказ', { login, role: roleOfLogin(login) });
        msg.innerHTML = lockMsg(at.lockedUntil);
      } else {
        const left = db.policy.maxAttempts - n;
        msg.innerHTML = alertBox(left <= 2 ? 'warn' : 'danger', `<b>Неверный логин или пароль.</b>${left <= 3 ? ` Осталось попыток: ${left}. После ${db.policy.maxAttempts} неуспешных попыток учётная запись будет заблокирована на ${db.policy.lockMinutes} мин.` : ''}`);
      }
      save();
      f.password.value = ''; f.password.focus();
    };
  }
  const roleOfLogin = l => { const u = db.users.find(x => x.login === l); return u ? u.role : '—'; };

  /* ================= Смена пароля (ТБ-1, ТБ-2) ================= */
  function pwRules(pw, login) {
    return [
      [pw.length >= db.policy.minLength, `Не менее ${db.policy.minLength} символов`],
      [/[A-ZА-ЯЁ]/.test(pw) && /[a-zа-яё]/.test(pw), 'Прописные и строчные буквы'],
      [/\d/.test(pw), 'Цифры'],
      [/[^A-Za-zА-Яа-яЁё0-9]/.test(pw), 'Специальные символы (!, #, % …)'],
      [!pw.toLowerCase().includes(login.split('.').pop()), 'Не содержит логин']
    ];
  }
  function changePassword(forced) {
    const body = `${forced ? alertBox('warn', 'При первом входе необходимо сменить пароль, выданный администратором (ТБ-2).') + '<div style="height:12px"></div>' : ''}
      <form id="pw-form" novalidate class="stack">
        ${field('Текущий пароль', '<input type="password" name="old" autocomplete="current-password">', { req: true })}
        ${field('Новый пароль', '<input type="password" name="pw" autocomplete="new-password">', { req: true })}
        <div><div class="strength"><i id="pw-str"></i></div><ul class="rules" id="pw-rules"></ul></div>
        ${field('Повторите новый пароль', '<input type="password" name="pw2" autocomplete="new-password">', { req: true })}
      </form>`;
    modal({
      title: forced ? 'Обязательная смена пароля' : 'Смена пароля', closable: !forced, body,
      icon: `<div class="warn-ico">${ic('key')}</div>`,
      foot: `${forced ? `<button class="btn" data-act="logout">Выйти</button>` : '<button class="btn" data-close>Отмена</button>'}<button class="btn primary" form="pw-form" type="submit">Сменить пароль</button>`,
      onMount(el, close) {
        const f = $('#pw-form', el);
        const draw = () => {
          const rules = pwRules(f.pw.value, me.login);
          const score = rules.filter(r => r[0]).length;
          $('#pw-rules', el).innerHTML = rules.map(r => `<li class="${r[0] ? 'ok' : ''}">${ic(r[0] ? 'check' : 'x', 'sm')} ${r[1]}</li>`).join('');
          const s = $('#pw-str', el); s.style.width = score * 20 + '%'; s.style.background = score < 3 ? 'var(--danger)' : score < 5 ? 'var(--warn)' : 'var(--success)';
        };
        draw();
        f.pw.addEventListener('input', draw);
        f.onsubmit = e => {
          e.preventDefault();
          const ok = validate(f, {
            old: v => !v ? 'Введите текущий пароль' : pwHash(me.login, v) !== me.hash ? 'Текущий пароль указан неверно' : '',
            pw: (v) => { if (!v) return 'Введите новый пароль'; const bad = pwRules(v, me.login).find(r => !r[0]); if (bad) return 'Не выполнено: ' + bad[1].toLowerCase(); if (v === f.old.value) return 'Новый пароль должен отличаться от текущего'; return ''; },
            pw2: v => v !== f.pw.value ? 'Пароли не совпадают' : ''
          });
          if (!ok) { if (f.old.closest('.field').classList.contains('invalid')) audit('SEC', 'Смена пароля', 'Учётная запись ' + me.login, 'Неверный текущий пароль', 'отказ'); return; }
          me.hash = pwHash(me.login, f.pw.value); me.mustChange = false; me.pwChanged = Date.now();
          audit('SEC', 'Смена пароля', 'Учётная запись ' + me.login, forced ? 'Обязательная смена при первом входе' : '');
          save(); close(); toast('Пароль изменён');
        };
      }
    });
  }

  /* ================= Главная ================= */
  function pageDashboard() {
    const h = new Date().getHours();
    const greet = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const name = me.role === 'guest' ? '' : ', ' + (me.fio.split(' ')[1] || me.fio);
    const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const top = head(`${greet}${esc(name)}`, `${esc(ROLES[me.role].name)} · ${today}`);
    const kpi = (icon, tone, val, lbl, sub = '') => `<div class="card kpi"><div class="ico tone-${tone}">${ic(icon)}</div><div><div class="lbl">${lbl}</div><div class="val">${val}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>`;
    const day = Date.now() - 864e5;

    if (me.role === 'secadmin') {
      const ev = db.audit.filter(a => a.ts > day);
      const fails = ev.filter(a => a.type === 'AUTH' && a.result === 'отказ').length;
      const denied = ev.filter(a => a.type === 'ACCESS').length;
      const locked = Object.entries(db.attempts).filter(([, a]) => a.lockedUntil > Date.now());
      const secEv = db.audit.filter(a => ['AUTH', 'SEC', 'ACCESS', 'PD', 'ADMIN'].includes(a.type)).slice(0, 8);
      const p = db.policy;
      return top + `<div class="grid g4">${kpi('activity', 'indigo', ev.length, 'Событий за 24 ч')}${kpi('ban', 'red', fails, 'Неуспешных входов за 24 ч')}${kpi('lock', 'amber', locked.length, 'Заблокировано учётных записей', locked.map(l => l[0]).join(', '))}${kpi('shield', 'violet', denied, 'Отказов в доступе за 24 ч')}</div>
        <div class="grid g-main" style="margin-top:16px">
          <div class="card"><div class="card-head"><h3>${ic('activity')} Последние события безопасности</h3><a class="btn sm" href="#/audit">Журнал событий</a></div>
            ${auditTable(secEv, true)}</div>
          <div class="stack">
            <div class="card"><div class="card-head"><h3>${ic('lock')} Политика безопасности</h3><a class="btn sm" href="#/policy">Изменить</a></div>
              <div class="card-body"><dl class="props">
                <dt>Попыток входа</dt><dd>${p.maxAttempts}</dd><dt>Блокировка</dt><dd>${p.lockMinutes} мин</dd>
                <dt>Тайм-аут сеанса</dt><dd>${p.idleMinutes} мин</dd><dt>Длина пароля</dt><dd>от ${p.minLength} символов</dd>
                <dt>Смена пароля</dt><dd>каждые ${p.maxAgeDays} дн.</dd><dt>Хранение журнала</dt><dd>не менее ${p.retentionMonths} мес.</dd></dl></div></div>
            ${alertBox('info', 'Журнал событий доступен только администратору безопасности. Записи журнала не могут быть изменены или удалены (ТБ-6).')}
          </div></div>`;
    }
    if (me.role === 'sysadmin') {
      const u = db.users;
      const locked = u.filter(x => (db.attempts[x.login] || {}).lockedUntil > Date.now()).length;
      const old = u.filter(x => x.mustChange || Date.now() - x.pwChanged > db.policy.maxAgeDays * 864e5).length;
      const byRole = Object.keys(ROLES).map(r => [ROLES[r].name, u.filter(x => x.role === r).length]);
      return top + `<div class="grid g4">${kpi('users', 'indigo', u.length, 'Учётных записей')}${kpi('check', 'green', u.filter(x => x.active).length, 'Активных')}${kpi('lock', 'amber', locked, 'Заблокировано')}${kpi('key', 'red', old, 'Требуют смены пароля')}</div>
        <div class="grid g2" style="margin-top:16px">
          <div class="card"><div class="card-head"><h3>${ic('key')} Учётные записи по ролям</h3><a class="btn sm" href="#/users">Управление</a></div><div class="card-body"><div class="bars">${bars(byRole)}</div></div></div>
          <div class="stack">${alertBox('info', '<b>Разделение полномочий.</b> Администратор системы управляет учётными записями и ролями, но не имеет доступа к журналу событий и не может разблокировать учётные записи — это функции администратора безопасности (ТБ-3: совмещение ролей запрещено).')}
          ${alertBox('warn', 'Новые учётные записи создаются с временным паролем; при первом входе пользователь обязан сменить пароль (ТБ-2).')}</div></div>`;
    }
    // Бизнес-роли
    const k = [];
    const activeC = db.contracts.filter(c => c.status !== 'Закрыт');
    const inWork = db.projects.filter(p => p.status === 'В работе');
    if (can('contracts.view')) k.push(kpi('file', 'indigo', activeC.length, 'Действующих договоров', `из ${db.contracts.length} зарегистрированных`));
    if (can('projects.view')) k.push(kpi('layers', 'sky', inWork.length, 'Проектов в работе', `всего ${db.projects.length}`));
    if (can('money.view')) k.push(kpi('ruble', 'green', (activeC.reduce((s, c) => s + contractSum(c.id), 0) / 1e6).toFixed(1).replace('.', ',') + ' млн ₽', 'Портфель действующих договоров'));
    if (can('equipment.view')) { const busy = db.equipment.filter(q => q.projectId).length; k.push(kpi('cpu', 'amber', Math.round(busy / db.equipment.length * 100) + '%', 'Занятость оборудования', `${busy} из ${db.equipment.length} единиц`)); }
    if (me.role === 'hr') { k.push(kpi('users', 'violet', db.employees.length, 'Сотрудников')); k.push(kpi('building', 'sky', db.departments.length, 'Отделов')); }
    if (me.role === 'spec') { const mine = db.projects.filter(p => p.team.includes(me.empId)); k.push(kpi('user', 'violet', mine.length, 'Моих проектов')); }
    let main = '', side = '';
    if (can('projects.view')) {
      const list = (me.role === 'spec' ? db.projects.filter(p => p.team.includes(me.empId)) : inWork).slice(0, 8);
      main = `<div class="card"><div class="card-head"><h3>${ic('layers')} ${me.role === 'spec' ? 'Мои проекты' : 'Проекты в работе'}</h3><a class="btn sm" href="#/projects">Все проекты</a></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Код</th><th>Наименование</th><th>Выполнение</th><th>Срок</th></tr></thead><tbody>
        ${list.map(p => `<tr class="link" data-href="#/projects/${p.id}"><td class="mono nowrap">${esc(p.code)}</td><td>${esc(p.name)}</td><td style="min-width:140px">${progress(p.progress)}</td><td class="nowrap">${fdate(p.end)}</td></tr>`).join('')}
        </tbody></table></div></div>`;
      const soon = db.projects.filter(p => p.status !== 'Завершён' && (new Date(p.end) - Date.now()) < 75 * 864e5).sort((a, b) => a.end.localeCompare(b.end));
      side = `<div class="card"><div class="card-head"><h3>${ic('calendar')} Ближайшие сроки</h3></div><div class="card-body"><ul class="list-plain">
        ${soon.length ? soon.map(p => { const d = Math.ceil((new Date(p.end) - Date.now()) / 864e5); return `<li><div class="grow"><a href="#/projects/${p.id}" class="t-main">${esc(p.code)}</a><div class="muted small">${esc(p.name)}</div></div>${chip(d < 0 ? 'просрочен' : d + ' дн.', d < 0 ? 'red' : d < 30 ? 'amber' : 'sky')}</li>`; }).join('') : '<li class="muted">Нет проектов с близким сроком</li>'}
        </ul></div></div>`;
    }
    if (me.role === 'hr') {
      const cats = ['Конструктор', 'Инженер', 'Техник', 'Лаборант', 'Прочий персонал'].map(c => [c, db.employees.filter(e => e.category === c).length]);
      main = `<div class="card"><div class="card-head"><h3>${ic('users')} Состав по категориям</h3><a class="btn sm" href="#/employees">Сотрудники</a></div><div class="card-body"><div class="bars">${bars(cats)}</div></div></div>`;
      side = `<div class="card"><div class="card-head"><h3>${ic('building')} Отделы</h3><a class="btn sm" href="#/departments">Структура</a></div><div class="card-body"><div class="bars">${bars(db.departments.map(d => [d.code, db.employees.filter(e => e.deptId === d.id).length]))}</div></div></div>`;
    }
    if (can('money.view') && can('contracts.view')) {
      const st = ['Заключение', 'Выполнение', 'Завершение', 'Закрыт'].map(s => [s, db.contracts.filter(c => c.status === s).reduce((a, c) => a + contractSum(c.id), 0)]);
      side += `<div class="card" style="margin-top:16px"><div class="card-head"><h3>${ic('ruble')} Стоимость договоров по статусам</h3><span class="stamp">КТ</span></div><div class="card-body"><div class="bars">${bars(st, v => (v / 1e6).toFixed(1).replace('.', ',') + ' млн')}</div></div></div>`;
    }
    const note = me.role === 'guest' ? alertBox('info', 'Гостевой доступ: доступен только просмотр общих сведений о проектах. Стоимостные показатели и персональные данные скрыты.') + '<div style="height:16px"></div>' : '';
    return top + note + `<div class="grid g4">${k.join('')}</div><div class="grid g-main" style="margin-top:16px"><div>${main}</div><div>${side}</div></div>`;
  }
  function bars(rows, fmt = v => v) {
    const max = Math.max(1, ...rows.map(r => r[1]));
    return rows.map(([l, v]) => `<div class="bar-row" style="grid-template-columns:minmax(90px,170px) 1fr auto"><span>${esc(l)}</span><div class="bar"><i style="width:${v / max * 100}%"></i></div><b class="nowrap">${fmt(v)}</b></div>`).join('');
  }

  /* ================= Договоры ================= */
  const C_STATUSES = ['Заключение', 'Выполнение', 'Завершение', 'Закрыт'];
  function pageContracts() {
    const st = uiState('contracts', { q: '', status: '', customer: '', from: '', to: '', sort: 'signDate', dir: -1 });
    return head('Договоры', 'Регистрация договоров с заказчиками. Стоимость договора рассчитывается автоматически как сумма стоимостей проектных работ.',
      can('contracts.edit') ? `<a class="btn primary" href="#/contracts/new">${ic('plus', 'sm')} Новый договор</a>` : '') +
      `<div class="card"><div class="toolbar" id="flt">
        <div class="search">${ic('search', 'sm')}<input class="input" name="q" placeholder="Поиск по номеру, заказчику, предмету" value="${esc(st.q)}" maxlength="60"></div>
        <select name="status" aria-label="Статус">${options(C_STATUSES, st.status, 'Все статусы')}</select>
        <select name="customer" aria-label="Заказчик">${options(db.customers.map(c => [c.id, c.name]), st.customer, 'Все заказчики')}</select>
        <span class="muted small">Заключён с</span><input type="date" name="from" value="${st.from}" aria-label="Дата с"><span class="muted small">по</span><input type="date" name="to" value="${st.to}" aria-label="Дата по">
        <button class="btn ghost sm" data-act="reset-flt" data-key="contracts">${ic('refresh', 'sm')} Сбросить</button>
        <span class="count" id="cnt"></span></div><div id="tbl"></div></div>`;
  }
  function drawContracts() {
    const st = ui.contracts;
    const q = st.q.trim().toLowerCase();
    const rows = db.contracts.filter(c => (!q || [c.number, c.subject, cust(c.customerId).name].join(' ').toLowerCase().includes(q))
      && (!st.status || c.status === st.status) && (!st.customer || c.customerId === st.customer)
      && (!st.from || c.signDate >= st.from) && (!st.to || c.signDate <= st.to));
    $('#cnt').textContent = `Найдено: ${rows.length}`;
    const cols = [
      { key: 'number', label: 'Номер', cell: c => `<span class="mono t-main nowrap">${esc(c.number)}</span>` },
      { key: 'customer', label: 'Заказчик', sortVal: c => cust(c.customerId).name, cell: c => esc(cust(c.customerId).name) },
      { key: 'subject', label: 'Предмет договора', cell: c => `<div style="max-width:360px">${esc(c.subject)}</div><div class="t-sub">Проектов: ${db.links.filter(l => l.contractId === c.id).length}</div>` },
      { key: 'signDate', label: 'Заключён', cell: c => `<span class="nowrap">${fdate(c.signDate)}</span>` },
      { key: 'endDate', label: 'Срок', cell: c => `<span class="nowrap">${fdate(c.endDate)}</span>` },
      { key: 'status', label: 'Статус', cell: c => chip(c.status) },
      { key: 'manager', label: 'Руководитель', sortVal: c => emp(c.managerId).fio, cell: c => `<span class="nowrap">${esc(short(emp(c.managerId).fio))}</span>` },
      { key: 'sum', label: 'Сумма', num: true, sortable: can('money.view'), sortVal: c => contractSum(c.id), cell: c => moneyCell(contractSum(c.id)) }
    ];
    $('#tbl').innerHTML = dataTable('contracts', cols, rows, { href: c => '#/contracts/' + c.id });
  }

  function pageContractCard({ id }) {
    const c = contract(id);
    if (!c) return notFound('Договор не найден');
    const links = db.links.filter(l => l.contractId === c.id);
    const team = [...new Set(links.flatMap(l => proj(l.projectId).team))].map(emp).filter(Boolean);
    const hist = db.audit.filter(a => a.type === 'DATA' && a.object === 'Договор ' + c.number).slice(0, 8);
    const stepIdx = C_STATUSES.indexOf(c.status);
    const actions = can('contracts.edit') ? `<a class="btn" href="#/contracts/${c.id}/edit">${ic('edit', 'sm')} Редактировать</a><button class="btn danger-ghost" data-act="del-contract" data-id="${c.id}">${ic('trash', 'sm')} Удалить</button>` : '';
    return back('contracts', 'Все договоры') + `<div class="detail-head"><div class="title"><h1>Договор <span class="mono">${esc(c.number)}</span></h1>
        <div class="meta-row">${chip(c.status)}<span class="stamp">${ic('lock', 'sm')} Коммерческая тайна</span><span class="muted small">${esc(cust(c.customerId).name)}</span></div></div><div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div>
      <div class="grid g-main" style="margin-top:18px"><div class="stack">
        <div class="card"><div class="card-head"><h3>${ic('file')} Сведения о договоре</h3></div><div class="card-body"><dl class="props">
          <dt>Заказчик</dt><dd>${esc(cust(c.customerId).name)} <span class="muted small">ИНН ${esc(cust(c.customerId).inn)}</span></dd>
          <dt>Контактное лицо</dt><dd>${esc(cust(c.customerId).contact)}</dd>
          <dt>Предмет договора</dt><dd>${esc(c.subject)}</dd>
          <dt>Дата заключения</dt><dd>${fdate(c.signDate)}</dd>
          <dt>Срок исполнения</dt><dd>${fdate(c.endDate)}</dd>
          <dt>Руководитель договора</dt><dd>${empLink(c.managerId)} <span class="muted small">${esc(emp(c.managerId).category)}, ${esc(dept(emp(c.managerId).deptId).code)}</span></dd>
        </dl></div></div>
        <div class="card"><div class="card-head"><h3>${ic('layers')} Проекты в рамках договора</h3><span class="muted small">${links.length} ${plural(links.length, 'проект', 'проекта', 'проектов')}</span></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Код</th><th>Наименование</th><th>Статус</th><th>Выполнение</th><th class="num">Стоимость работ</th></tr></thead><tbody>
          ${links.map(l => { const p = proj(l.projectId); return `<tr class="link" data-href="#/projects/${p.id}"><td class="mono">${esc(p.code)}</td><td>${esc(p.name)}${db.links.filter(x => x.projectId === p.id).length > 1 ? '<div class="t-sub">Выполняется в рамках нескольких договоров</div>' : ''}</td><td>${chip(p.status)}</td><td style="min-width:120px">${progress(p.progress)}</td><td class="num">${moneyCell(l.amount)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Проекты ещё не привязаны</td></tr>'}
          </tbody>${links.length ? `<tfoot><tr><td colspan="4" class="t-main">Итого по договору</td><td class="num t-main">${moneyCell(contractSum(c.id))}</td></tr></tfoot>` : ''}</table></div></div>
        <div class="card"><div class="card-head"><h3>${ic('users')} Группа исполнителей</h3><span class="muted small">сотрудники из ${new Set(team.map(e => e.deptId)).size} отделов</span></div><div class="card-body"><ul class="list-plain">
          ${team.map(e => `<li><span class="avatar">${esc(initials(e.fio))}</span><div class="grow"><div class="t-main">${empLink(e.id)}</div><div class="muted small">${esc(e.position)}</div></div><span class="chip gray">${esc(dept(e.deptId).code)}</span></li>`).join('')}
        </ul></div></div>
      </div><div class="stack">
        <div class="card card-pad"><div class="muted small" style="font-weight:700">Стоимость договора</div><div class="big-sum">${can('money.view') ? money(contractSum(c.id)) : secret()}</div>
          <p class="muted small" style="margin-top:6px">Рассчитывается автоматически как сумма стоимостей проектных работ, выполняемых в рамках договора (ТЗ, п. 4.1).</p></div>
        <div class="card"><div class="card-head"><h3>${ic('activity')} Статус договора</h3></div><div class="card-body">
          ${C_STATUSES.map((s, i) => `<div class="stage ${i < stepIdx || c.status === 'Закрыт' ? 'done' : i === stepIdx ? 'cur' : ''}"><span class="b">${i < stepIdx || c.status === 'Закрыт' ? ic('check', 'sm') : ''}</span>${s}</div>`).join('')}</div></div>
        <div class="card"><div class="card-head"><h3>${ic('clock')} История изменений</h3></div><div class="card-body">
          ${hist.length ? `<ul class="timeline">${hist.map(a => `<li><b>${esc(a.action)}</b><div class="muted small">${fdt(a.ts)} · ${esc(a.login)}</div>${a.details ? `<div class="small">${esc(a.details)}</div>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Изменений не зарегистрировано</p>'}
        </div></div>
      </div></div>`;
  }

  function pageContractForm({ id }) {
    const c = id ? contract(id) : null;
    if (id && !c) return notFound('Договор не найден');
    const links = c ? db.links.filter(l => l.contractId === c.id) : [{ projectId: '', amount: '' }];
    const leaders = db.employees.filter(canLead).sort((a, b) => a.fio.localeCompare(b.fio, 'ru'));
    const nextNum = 'Д-' + new Date().getFullYear() + '/' + String(db.seq.contract + 15).padStart(3, '0');
    return back(c ? 'contracts/' + c.id : 'contracts', c ? 'К карточке договора' : 'Все договоры') +
      head(c ? 'Редактирование договора' : 'Новый договор', 'Поля, отмеченные <span style="color:var(--danger)">*</span>, обязательны. Значения выбираются из справочников.') +
      `<form class="card" id="c-form" novalidate><div class="card-body"><div class="form-grid">
        ${field('Номер договора', `<input name="number" value="${esc(c ? c.number : nextNum)}" maxlength="12" placeholder="Д-2026/030" class="mono">`, { req: true, hint: 'Формат: Д-ГГГГ/NNN' })}
        ${field('Заказчик', `<select name="customerId">${options(db.customers.map(x => [x.id, x.name]), c && c.customerId, '— выберите заказчика —')}</select>`, { req: true })}
        ${field('Предмет договора', `<textarea name="subject" maxlength="200">${esc(c ? c.subject : '')}</textarea>`, { req: true, full: true, hint: 'От 5 до 200 символов' })}
        ${field('Дата заключения', `<input type="date" name="signDate" value="${c ? c.signDate : iso()}">`, { req: true })}
        ${field('Срок исполнения', `<input type="date" name="endDate" value="${c ? c.endDate : ''}">`, { req: true, hint: 'Не раньше даты заключения' })}
        ${field('Статус', `<select name="status">${options(C_STATUSES, c ? c.status : 'Заключение')}</select>`, { req: true })}
        ${field('Руководитель договора', `<select name="managerId">${options(leaders.map(e => [e.id, `${e.fio} — ${e.category}, ${dept(e.deptId).code}`]), c && c.managerId, '— выберите сотрудника —')}</select>`, { req: true, hint: 'Только инженеры и конструкторы (ТЗ)' })}
        <div class="full field" data-field="links"><span>Проекты и стоимость работ по договору</span>
          <div id="links">${links.map(linkRow).join('')}</div>
          <div><button type="button" class="btn sm" data-act="add-link">${ic('plus', 'sm')} Добавить проект</button></div>
          <span class="err"></span>
        </div>
        <div class="full sum-live"><span>Сумма договора (рассчитывается автоматически)</span><span id="sum-live" class="big-sum" style="font-size:20px">0 ₽</span></div>
      </div></div>
      <div class="form-actions"><a class="btn" href="#/${c ? 'contracts/' + c.id : 'contracts'}">Отмена</a><button class="btn primary" type="submit">${ic('check', 'sm')} ${c ? 'Сохранить изменения' : 'Зарегистрировать договор'}</button></div></form>`;
  }
  function linkRow(l) {
    return `<div class="link-row"><select name="lp" aria-label="Проект">${options(db.projects.map(p => [p.id, `${p.code} — ${p.name}`]), l.projectId, '— проект —')}</select>
      <input name="la" type="number" min="1" step="1000" placeholder="Стоимость, ₽" value="${l.amount}" aria-label="Стоимость работ"><button type="button" class="icon-btn" data-act="rm-link" aria-label="Удалить строку">${ic('x', 'sm')}</button></div>`;
  }
  function mountContractForm({ id }) {
    const f = $('#c-form');
    if (!f) return;
    const c = id ? contract(id) : null;
    const sum = () => { $('#sum-live').textContent = money($$('[name="la"]', f).reduce((s, i) => s + (+i.value > 0 ? +i.value : 0), 0)); };
    sum();
    f.addEventListener('input', sum);
    f.addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'add-link') { $('#links').insertAdjacentHTML('beforeend', linkRow({ projectId: '', amount: '' })); }
      if (a.dataset.act === 'rm-link') { a.closest('.link-row').remove(); sum(); }
    });
    f.onsubmit = e => {
      e.preventDefault();
      const rows = $$('.link-row', f).map(r => ({ projectId: $('[name="lp"]', r).value, amount: +$('[name="la"]', r).value })).filter(r => r.projectId || r.amount);
      const ok = validate(f, {
        number: v => { v = v.trim(); if (!v) return 'Обязательное поле'; if (!/^Д-\d{4}\/\d{3}$/.test(v)) return 'Неверный формат. Пример: Д-2026/030'; if (db.contracts.some(x => x.number === v && x !== c)) return 'Договор с таким номером уже зарегистрирован'; return ''; },
        customerId: v => V.req(v, 'Выберите заказчика'),
        subject: V.text(5, 200),
        signDate: V.date,
        endDate: (v, form) => V.date(v) || (v <= form.signDate.value ? 'Срок исполнения должен быть позже даты заключения' : ''),
        status: V.req,
        managerId: v => V.req(v, 'Выберите руководителя договора'),
        links: (v, form) => {
          if (rows.some(r => !r.projectId)) return 'Выберите проект в каждой строке';
          if (rows.some(r => !(r.amount > 0) || r.amount > 1e10)) return 'Стоимость работ должна быть положительным числом';
          if (new Set(rows.map(r => r.projectId)).size !== rows.length) return 'Проект указан повторно';
          if (!rows.length && form.status.value !== 'Заключение') return 'Для статуса «' + form.status.value + '» необходимо указать хотя бы один проект';
          return '';
        }
      });
      if (!ok) { toast('Проверьте правильность заполнения формы', 'err'); return; }
      const data = { number: f.number.value.trim(), customerId: f.customerId.value, subject: f.subject.value.trim(), signDate: f.signDate.value, endDate: f.endDate.value, status: f.status.value, managerId: f.managerId.value };
      if (c) {
        const before = contractSum(c.id);
        const diff = [];
        const names = { number: 'Номер', customerId: 'Заказчик', subject: 'Предмет', signDate: 'Дата заключения', endDate: 'Срок', status: 'Статус', managerId: 'Руководитель' };
        const show = (k, v) => k === 'customerId' ? cust(v).name : k === 'managerId' ? short(emp(v).fio) : k.endsWith('Date') ? fdate(v) : v;
        Object.keys(data).forEach(k => { if (c[k] !== data[k]) diff.push(`${names[k]}: ${show(k, c[k])} → ${show(k, data[k])}`); });
        Object.assign(c, data);
        db.links = db.links.filter(l => l.contractId !== c.id).concat(rows.map(r => ({ contractId: c.id, ...r })));
        const after = contractSum(c.id);
        if (before !== after) diff.push(`Сумма: ${money(before)} → ${money(after)}`);
        audit('DATA', 'Изменение договора', 'Договор ' + c.number, diff.join('; ') || 'Без изменений');
        save(); toast('Изменения сохранены'); go('contracts/' + c.id);
      } else {
        const nc = { id: 'k' + db.seq.contract++, ...data };
        db.contracts.push(nc);
        rows.forEach(r => db.links.push({ contractId: nc.id, ...r }));
        audit('DATA', 'Регистрация договора', 'Договор ' + nc.number, `${cust(nc.customerId).name}; сумма ${money(contractSum(nc.id))}`);
        save(); toast('Договор зарегистрирован'); go('contracts/' + nc.id);
      }
    };
  }

  /* ================= Проекты ================= */
  const P_STATUSES = ['Планирование', 'В работе', 'Приостановлен', 'Завершён'];
  function pageProjects() {
    const st = uiState('projects', { q: '', status: '', manager: '', sort: 'code', dir: 1 });
    const managers = [...new Set(db.projects.map(p => p.managerId))].map(emp);
    return head('Проекты', 'Паспорта проектов, сроки, выполнение и группы исполнителей.', can('projects.edit') ? `<a class="btn primary" href="#/projects/new">${ic('plus', 'sm')} Новый проект</a>` : '') +
      `<div class="card"><div class="toolbar" id="flt">
        <div class="search">${ic('search', 'sm')}<input class="input" name="q" placeholder="Поиск по коду или наименованию" value="${esc(st.q)}" maxlength="60"></div>
        <select name="status" aria-label="Статус">${options(P_STATUSES, st.status, 'Все статусы')}</select>
        <select name="manager" aria-label="Руководитель">${options(managers.map(e => [e.id, short(e.fio)]), st.manager, 'Все руководители')}</select>
        ${me.role === 'spec' ? `<label class="small" style="display:flex;gap:6px;align-items:center;font-weight:600"><input type="checkbox" name="mine" ${st.mine ? 'checked' : ''}> Только мои</label>` : ''}
        <button class="btn ghost sm" data-act="reset-flt" data-key="projects">${ic('refresh', 'sm')} Сбросить</button>
        <span class="count" id="cnt"></span></div><div id="tbl"></div></div>`;
  }
  function drawProjects() {
    const st = ui.projects;
    const q = st.q.trim().toLowerCase();
    const rows = db.projects.filter(p => (!q || (p.code + ' ' + p.name).toLowerCase().includes(q)) && (!st.status || p.status === st.status) && (!st.manager || p.managerId === st.manager) && (!st.mine || p.team.includes(me.empId)));
    $('#cnt').textContent = `Найдено: ${rows.length}`;
    const cols = [
      { key: 'code', label: 'Код', cell: p => `<span class="mono t-main">${esc(p.code)}</span>` },
      { key: 'name', label: 'Наименование', cell: p => `<div style="max-width:380px" class="t-main">${esc(p.name)}</div><div class="t-sub">Договоров: ${db.links.filter(l => l.projectId === p.id).length} · Исполнителей: ${p.team.length}</div>` },
      { key: 'manager', label: 'Руководитель', sortVal: p => emp(p.managerId).fio, cell: p => `<span class="nowrap">${esc(short(emp(p.managerId).fio))}</span>` },
      { key: 'end', label: 'Сроки', cell: p => `<span class="nowrap small">${fdate(p.start)} –<br>${fdate(p.end)}</span>` },
      { key: 'status', label: 'Статус', cell: p => chip(p.status) },
      { key: 'progress', label: 'Выполнение', cell: p => `<div style="min-width:130px">${progress(p.progress)}</div>` },
      { key: 'cost', label: 'Стоимость', num: true, sortable: can('money.view'), sortVal: p => projectCost(p.id), cell: p => moneyCell(projectCost(p.id)) }
    ];
    $('#tbl').innerHTML = dataTable('projects', cols, rows, { href: p => '#/projects/' + p.id });
  }
  function pageProjectCard({ id }) {
    const p = proj(id);
    if (!p) return notFound('Проект не найден');
    const links = db.links.filter(l => l.projectId === p.id);
    const eq = db.equipment.filter(q => q.projectId === p.id);
    const works = db.subworks.filter(w => w.projectId === p.id);
    const stages = ['Сбор исходных данных', 'Эскизный проект', 'Проектная документация', 'Рабочая документация', 'Экспертиза и сдача'];
    const done = Math.floor(p.progress / 20);
    const team = p.team.map(emp).filter(Boolean);
    const isGuest = me.role === 'guest';
    return back('projects', 'Все проекты') + `<div class="detail-head"><div class="title"><div class="muted mono">${esc(p.code)}</div><h1>${esc(p.name)}</h1>
      <div class="meta-row">${chip(p.status)}${can('money.view') ? '<span class="stamp">' + ic('lock', 'sm') + ' Коммерческая тайна</span>' : ''}</div></div>
      ${can('projects.edit') ? `<div class="actions"><a class="btn" href="#/projects/${p.id}/edit">${ic('edit', 'sm')} Редактировать</a></div>` : ''}</div>
      <div class="grid g-main" style="margin-top:18px"><div class="stack">
        <div class="card"><div class="card-head"><h3>${ic('info')} Паспорт проекта</h3></div><div class="card-body"><dl class="props">
          <dt>Руководитель проекта</dt><dd>${empLink(p.managerId)}</dd>
          <dt>Сроки</dt><dd>${fdate(p.start)} — ${fdate(p.end)}</dd>
          <dt>Выполнение</dt><dd style="display:block">${progress(p.progress)}</dd>
          <dt>Стоимость работ</dt><dd>${moneyCell(projectCost(p.id))}</dd>
        </dl></div></div>
        ${isGuest ? '' : `<div class="card"><div class="card-head"><h3>${ic('file')} Договоры</h3><span class="muted small">проект может выполняться в рамках нескольких договоров</span></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Номер</th><th>Заказчик</th><th>Статус</th><th class="num">Стоимость работ</th></tr></thead><tbody>
          ${links.map(l => { const c = contract(l.contractId); return `<tr ${can('contracts.view') ? `class="link" data-href="#/contracts/${c.id}"` : ''}><td class="mono">${esc(c.number)}</td><td>${esc(cust(c.customerId).name)}</td><td>${chip(c.status)}</td><td class="num">${moneyCell(l.amount)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Нет договоров</td></tr>'}
          </tbody></table></div></div>`}
        <div class="card"><div class="card-head"><h3>${ic('users')} Группа исполнителей</h3><span class="muted small">${team.length} чел. из ${new Set(team.map(e => e.deptId)).size} отделов</span></div><div class="card-body"><ul class="list-plain">
          ${team.map(e => `<li><span class="avatar">${esc(initials(e.fio))}</span><div class="grow"><div class="t-main">${isGuest ? esc(short(e.fio)) : empLink(e.id)}${e.id === p.managerId ? ' <span class="chip indigo">РП</span>' : ''}</div><div class="muted small">${esc(e.position)}</div></div><span class="chip gray">${esc(e.category)}</span><span class="chip gray">${esc(dept(e.deptId).code)}</span></li>`).join('')}
        </ul></div></div>
        ${works.length && !isGuest ? `<div class="card"><div class="card-head"><h3>${ic('briefcase')} Субподрядные работы</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Субподрядчик</th><th>Объём работ</th><th>Срок</th><th>Статус</th><th class="num">Стоимость</th></tr></thead><tbody>
          ${works.map(w => `<tr><td>${esc(byId(db.subcontractors, w.subId).name)}</td><td>${esc(w.scope)}</td><td>${fdate(w.deadline)}</td><td>${chip(w.status)}</td><td class="num">${moneyCell(w.cost)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      </div><div class="stack">
        <div class="card"><div class="card-head"><h3>${ic('activity')} Этапы</h3></div><div class="card-body">
          ${stages.map((s, i) => `<div class="stage ${i < done ? 'done' : i === done && p.progress < 100 ? 'cur' : ''}"><span class="b">${i < done ? ic('check', 'sm') : ''}</span>${s}</div>`).join('')}</div></div>
        ${isGuest ? '' : `<div class="card"><div class="card-head"><h3>${ic('cpu')} Оборудование</h3>${can('equipment.assign') && p.status !== 'Завершён' ? `<button class="btn sm" data-act="assign-eq" data-id="${p.id}">${ic('plus', 'sm')} Назначить</button>` : ''}</div><div class="card-body">
          <ul class="list-plain">${eq.map(q => `<li><div class="grow"><div class="t-main">${esc(q.name)}</div><div class="muted small mono">${esc(q.inv)} · ${q.ownership === 'common' ? 'коллективное' : esc(dept(q.deptId).code)}</div></div>${can('equipment.assign') ? `<button class="btn sm ghost" data-act="release-eq" data-id="${q.id}" title="Освободить">${ic('x', 'sm')}</button>` : ''}</li>`).join('') || '<li class="muted small">Оборудование не назначено</li>'}</ul>
          <p class="muted small" style="margin-top:8px">Оборудование назначается группе, только если оно не используется в другом проекте (ТБ-7).</p></div></div>`}
      </div></div>`;
  }
  function pageProjectForm({ id }) {
    const p = id ? proj(id) : null;
    if (id && !p) return notFound('Проект не найден');
    const leaders = db.employees.filter(canLead);
    const team = p ? p.team : [];
    const checks = db.departments.map(d => `<div class="grp">${esc(d.name)}</div>` + db.employees.filter(e => e.deptId === d.id).map(e => `<label><input type="checkbox" name="team" value="${e.id}" ${team.includes(e.id) ? 'checked' : ''}> ${esc(short(e.fio))} <span class="muted small">${esc(e.category)}</span></label>`).join('')).join('');
    return back(p ? 'projects/' + p.id : 'projects', p ? 'К карточке проекта' : 'Все проекты') + head(p ? 'Редактирование проекта' : 'Новый проект') +
      `<form class="card" id="p-form" novalidate><div class="card-body"><div class="form-grid">
        ${field('Код проекта', `<input name="code" class="mono" maxlength="8" value="${esc(p ? p.code : 'ПР-' + (100 + db.seq.project))}">`, { req: true, hint: 'Формат: ПР-NNN' })}
        ${field('Руководитель проекта', `<select name="managerId">${options(leaders.map(e => [e.id, `${e.fio} — ${e.category}`]), p && p.managerId, '— выберите —')}</select>`, { req: true, hint: 'Только инженеры и конструкторы' })}
        ${field('Наименование', `<input name="name" maxlength="200" value="${esc(p ? p.name : '')}">`, { req: true, full: true })}
        ${field('Дата начала', `<input type="date" name="start" value="${p ? p.start : iso()}">`, { req: true })}
        ${field('Дата окончания', `<input type="date" name="end" value="${p ? p.end : ''}">`, { req: true })}
        ${field('Статус', `<select name="status">${options(P_STATUSES, p ? p.status : 'Планирование')}</select>`, { req: true })}
        ${field('Выполнение, %', `<input type="number" name="progress" min="0" max="100" value="${p ? p.progress : 0}">`, { req: true })}
        <div class="field full" data-field="team"><span>Группа исполнителей (сотрудники разных отделов) <span class="req">*</span></span><div class="checks">${checks}</div><span class="err"></span></div>
      </div></div><div class="form-actions"><a class="btn" href="#/${p ? 'projects/' + p.id : 'projects'}">Отмена</a><button class="btn primary">${ic('check', 'sm')} Сохранить</button></div></form>`;
  }
  function mountProjectForm({ id }) {
    const f = $('#p-form');
    if (!f) return;
    const p = id ? proj(id) : null;
    f.onsubmit = e => {
      e.preventDefault();
      const team = $$('[name="team"]:checked', f).map(i => i.value);
      const ok = validate(f, {
        code: v => !/^ПР-\d{3}$/.test(v.trim()) ? 'Формат: ПР-NNN' : db.projects.some(x => x.code === v.trim() && x !== p) ? 'Код уже используется' : '',
        managerId: v => V.req(v, 'Выберите руководителя'),
        name: V.text(5, 200),
        start: V.date,
        end: (v, form) => V.date(v) || (v <= form.start.value ? 'Дата окончания должна быть позже даты начала' : ''),
        progress: (v, form) => !/^\d{1,3}$/.test(v) || +v > 100 ? 'Целое число от 0 до 100' : form.status.value === 'Завершён' && +v !== 100 ? 'Для завершённого проекта выполнение 100%' : '',
        team: (v, form) => !team.length ? 'Выберите хотя бы одного исполнителя' : !team.includes(form.managerId.value) ? 'Руководитель должен входить в группу исполнителей' : ''
      });
      if (!ok) { toast('Проверьте правильность заполнения формы', 'err'); return; }
      const data = { code: f.code.value.trim(), name: f.name.value.trim(), managerId: f.managerId.value, start: f.start.value, end: f.end.value, status: f.status.value, progress: +f.progress.value, team };
      if (data.status === 'Завершён') db.equipment.filter(q => p && q.projectId === p.id).forEach(q => { q.projectId = null; });
      if (p) {
        const d = [];
        if (p.status !== data.status) d.push(`Статус: ${p.status} → ${data.status}`);
        if (p.progress !== data.progress) d.push(`Выполнение: ${p.progress}% → ${data.progress}%`);
        if (p.end !== data.end) d.push(`Срок: ${fdate(p.end)} → ${fdate(data.end)}`);
        Object.assign(p, data);
        audit('DATA', 'Изменение проекта', 'Проект ' + p.code, d.join('; ') || 'Изменены реквизиты');
        save(); toast('Проект сохранён'); go('projects/' + p.id);
      } else {
        const np = { id: 'p' + db.seq.project++, ...data };
        db.projects.push(np);
        audit('DATA', 'Создание проекта', 'Проект ' + np.code, np.name);
        save(); toast('Проект создан'); go('projects/' + np.id);
      }
    };
  }

  /* ================= Сотрудники ================= */
  const CATS = ['Конструктор', 'Инженер', 'Техник', 'Лаборант', 'Прочий персонал'];
  const QUALS = ['Высшая', 'I категория', 'II категория', 'Без категории'];
  const EQ_TYPES = () => [...new Set(db.equipment.map(q => q.type))].sort();
  function pageEmployees() {
    const st = uiState('employees', { q: '', dept: '', cat: '', sort: 'fio', dir: 1 });
    const restricted = me.role === 'head';
    return head('Сотрудники', restricted ? `Сотрудники вашего отдела: ${esc(dept(myDept()).name)}` : 'Реестр сотрудников по категориям и отделам. Каждый сотрудник относится строго к одному отделу.',
      can('employees.edit') ? `<a class="btn primary" href="#/employees/new">${ic('plus', 'sm')} Новый сотрудник</a>` : '') +
      (me.role === 'spec' ? alertBox('info', 'Для роли «Специалист» доступен служебный справочник сотрудников без персональных данных.') + '<div style="height:14px"></div>' : '') +
      `<div class="card"><div class="toolbar" id="flt">
        <div class="search">${ic('search', 'sm')}<input class="input" name="q" placeholder="Поиск по ФИО или должности" value="${esc(st.q)}" maxlength="60"></div>
        ${restricted ? '' : `<select name="dept" aria-label="Отдел">${options(db.departments.map(d => [d.id, d.name]), st.dept, 'Все отделы')}</select>`}
        <select name="cat" aria-label="Категория">${options(CATS, st.cat, 'Все категории')}</select>
        <button class="btn ghost sm" data-act="reset-flt" data-key="employees">${ic('refresh', 'sm')} Сбросить</button>
        <span class="count" id="cnt"></span></div><div id="tbl"></div></div>`;
  }
  function catAttr(e) {
    if (e.category === 'Конструктор') return `<span class="chip violet">Авт. свидетельств: ${e.certs}</span>`;
    if (e.category === 'Техник') return `<span class="chip sky" title="${esc(e.skills.join(', '))}">Обслуживает: ${e.skills.length} вид. обор.</span>`;
    if (e.category === 'Инженер') return '<span class="chip indigo">Может быть РП</span>';
    return '<span class="muted">—</span>';
  }
  function drawEmployees() {
    const st = ui.employees;
    const q = st.q.trim().toLowerCase();
    const rows = db.employees.filter(e => empVisible(e) && (!q || (e.fio + ' ' + e.position).toLowerCase().includes(q)) && (!st.dept || e.deptId === st.dept) && (!st.cat || e.category === st.cat));
    $('#cnt').textContent = `Найдено: ${rows.length}`;
    const cols = [
      { key: 'fio', label: 'Сотрудник', cell: e => `<div style="display:flex;gap:10px;align-items:center"><span class="avatar">${esc(initials(e.fio))}</span><div><div class="t-main">${esc(e.fio)}</div><div class="t-sub">${esc(e.position)}</div></div></div>` },
      { key: 'category', label: 'Категория', cell: e => esc(e.category) },
      { key: 'dept', label: 'Отдел', sortVal: e => dept(e.deptId).name, cell: e => `<span title="${esc(dept(e.deptId).name)}" class="chip gray">${esc(dept(e.deptId).code)}</span>${dept(e.deptId).head === e.id ? ' <span class="chip indigo">нач.</span>' : ''}` },
      { key: 'qualification', label: 'Квалификация', cell: e => esc(e.qualification) },
      { key: 'attr', label: 'Специфика категории', sortable: false, cell: catAttr }
    ];
    if (can('pd.view')) cols.push({ key: 'phone', label: 'Телефон', sortable: false, cell: e => `<span class="masked">${esc(MASK.phone(e.phone))}</span>` });
    $('#tbl').innerHTML = dataTable('employees', cols, rows, { href: e => '#/employees/' + e.id });
  }
  function pageEmployeeCard({ id }) {
    const e = emp(id);
    if (!e) return notFound('Сотрудник не найден');
    const d = dept(e.deptId);
    const projs = db.projects.filter(p => p.team.includes(e.id));
    const show = revealed[e.id] > Date.now();
    const pdRows = [['passport', 'Паспорт'], ['snils', 'СНИЛС'], ['birthDate', 'Дата рождения'], ['phone', 'Телефон'], ['email', 'E-mail'], ['address', 'Адрес регистрации']];
    const pdVal = k => show ? `<span class="mono">${esc(k === 'birthDate' ? fdate(e[k]) : e[k])}</span>` : `<span class="masked">${esc(MASK[k](e[k]))}</span> ${ic('lock', 'sm')}`;
    const pd = can('pd.view') ? `<div class="card pd-box"><div class="card-head" style="border-color:color-mix(in srgb,var(--warn) 25%,var(--border))"><h3>${ic('shield')} Персональные данные</h3>${chip(show ? 'открыто' : 'маскировано', show ? 'amber' : 'green')}</div><div class="card-body">
        <dl class="props">${pdRows.map(([k, l]) => `<dt>${l}</dt><dd>${pdVal(k)}</dd>`).join('')}</dl>
        ${show ? `<div style="margin-top:12px">${alertBox('warn', `Данные открыты для просмотра. Маска будет восстановлена через <b id="pd-left">30</b> с. Событие зарегистрировано в журнале.`)}</div>`
          : can('pd.unmask') ? `<button class="btn" style="margin-top:12px;width:100%" data-act="unmask" data-id="${e.id}">${ic('eye', 'sm')} Показать персональные данные</button>`
          : `<p class="muted small" style="margin-top:10px">${ic('lock', 'sm')} Раскрытие ПДн доступно только кадровой службе.</p>`}
        <p class="muted small" style="margin-top:10px">ПДн отображаются в маскированном виде по принципу минимизации (ст. 5, 19 ФЗ № 152-ФЗ; УЗ-4). Каждый просмотр регистрируется.</p>
      </div></div>` : `<div class="card card-pad">${alertBox('info', 'Персональные данные сотрудника недоступны для вашей роли.')}</div>`;
    const spec = e.category === 'Конструктор' ? `<dt>Авторские свидетельства</dt><dd>${e.certs}</dd>` :
      e.category === 'Техник' ? `<dt>Обслуживаемое оборудование</dt><dd>${e.skills.map(s => `<span class="chip sky">${esc(s)}</span>`).join(' ') || '—'}</dd>` : '';
    return back('employees', 'Все сотрудники') + `<div class="detail-head"><span class="avatar lg">${esc(initials(e.fio))}</span><div class="title"><h1>${esc(e.fio)}</h1><div class="muted">${esc(e.position)}</div>
      <div class="meta-row"><span class="chip violet">${esc(e.category)}</span><span class="chip gray">${esc(d.name)}</span>${d.head === e.id ? '<span class="chip indigo">Начальник отдела</span>' : ''}</div></div>
      ${can('employees.edit') ? `<div class="actions" style="display:flex;gap:8px"><a class="btn" href="#/employees/${e.id}/edit">${ic('edit', 'sm')} Редактировать</a><button class="btn danger-ghost" data-act="del-emp" data-id="${e.id}">${ic('trash', 'sm')} Удалить</button></div>` : ''}</div>
      <div class="grid g-main" style="margin-top:18px"><div class="stack">
        <div class="card"><div class="card-head"><h3>${ic('briefcase')} Служебные сведения</h3></div><div class="card-body"><dl class="props">
          <dt>Отдел</dt><dd>${esc(d.name)}</dd><dt>Должность</dt><dd>${esc(e.position)}</dd><dt>Категория</dt><dd>${esc(e.category)}</dd>
          <dt>Квалификация</dt><dd>${esc(e.qualification)}</dd>${spec}
          <dt>Руководство договорами/проектами</dt><dd>${canLead(e) ? chip('допускается', 'green') : chip('не допускается', 'gray')}</dd>
          ${can('pd.view') ? `<dt>Дата приёма</dt><dd>${fdate(e.hireDate)}</dd>` : ''}
        </dl></div></div>
        <div class="card"><div class="card-head"><h3>${ic('layers')} Участие в проектах</h3><span class="muted small">${projs.length}</span></div><div class="card-body"><ul class="list-plain">
          ${projs.map(p => `<li><div class="grow"><a class="t-main" href="#/projects/${p.id}">${esc(p.code)}</a> <span class="muted small">${esc(p.name)}</span></div>${p.managerId === e.id ? '<span class="chip indigo">РП</span>' : ''}${chip(p.status)}</li>`).join('') || '<li class="muted small">Не участвует в проектах</li>'}</ul></div></div>
        ${e.history.length ? `<div class="card"><div class="card-head"><h3>${ic('transfer')} История перемещений между отделами</h3></div><div class="card-body"><ul class="timeline">
          ${e.history.map(h => `<li><b>${fdate(h.date)}</b>: ${esc(dept(h.from) ? dept(h.from).name : h.from)} → ${esc(dept(h.to) ? dept(h.to).name : h.to)}<div class="muted small">${esc(h.note)}</div></li>`).join('')}</ul></div></div>` : ''}
      </div><div>${pd}</div></div>`;
  }
  function pageEmployeeForm({ id }) {
    const e = id ? emp(id) : null;
    if (id && !e) return notFound('Сотрудник не найден');
    const types = EQ_TYPES();
    const pdHint = e ? 'Оставьте пустым, чтобы не изменять. Текущее: ' : '';
    return back(e ? 'employees/' + e.id : 'employees', e ? 'К карточке сотрудника' : 'Все сотрудники') + head(e ? 'Редактирование сотрудника' : 'Новый сотрудник', 'Ввод данных с проверкой формата. Персональные данные при редактировании не отображаются.') +
      `<form class="card" id="e-form" novalidate><div class="card-body"><div class="form-grid">
        ${field('ФИО', `<input name="fio" maxlength="80" value="${esc(e ? e.fio : '')}" placeholder="Фамилия Имя Отчество">`, { req: true, full: true, hint: 'Кириллица, с заглавной буквы' })}
        ${field('Категория', `<select name="category">${options(CATS, e && e.category, '— выберите —')}</select>`, { req: true })}
        ${field('Отдел', `<select name="deptId">${options(db.departments.map(d => [d.id, d.name]), e && e.deptId, '— выберите —')}</select>`, { req: true, hint: 'Сотрудник может состоять только в одном отделе' })}
        ${field('Должность', `<input name="position" maxlength="100" value="${esc(e ? e.position : '')}">`, { req: true })}
        ${field('Квалификация', `<select name="qualification">${options(QUALS, e ? e.qualification : 'Без категории')}</select>`, { req: true })}
        <div class="full" id="cat-certs">${field('Количество авторских свидетельств', `<input type="number" name="certs" min="0" max="500" value="${e ? e.certs : 0}">`, { hint: 'Для конструкторов' })}</div>
        <div class="field full" id="cat-skills" data-field="skills"><span>Оборудование, которое может обслуживать техник</span><div class="checks">${types.map(t => `<label><input type="checkbox" name="skills" value="${esc(t)}" ${e && e.skills.includes(t) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div><span class="err"></span></div>
        <div class="full" style="margin-top:6px">${alertBox('warn', '<b>Персональные данные.</b> Обрабатываются в соответствии с 152-ФЗ. Вводите только данные, необходимые для кадрового учёта.')}</div>
        ${field('Серия и номер паспорта', `<input name="passport" class="mono" maxlength="11" placeholder="${e ? esc(MASK.passport(e.passport)) : '4510 123456'}">`, { req: !e, hint: (pdHint ? pdHint + esc(MASK.passport(e.passport)) : 'Формат: 4510 123456') })}
        ${field('СНИЛС', `<input name="snils" class="mono" maxlength="14" placeholder="${e ? esc(MASK.snils(e.snils)) : '123-456-789 01'}">`, { req: !e, hint: e ? 'Оставьте пустым, чтобы не изменять' : 'Формат: 123-456-789 01' })}
        ${field('Дата рождения', `<input type="date" name="birthDate" value="">`, { req: !e, hint: e ? 'Оставьте пустым, чтобы не изменять' : 'Возраст от 18 до 80 лет' })}
        ${field('Дата приёма на работу', `<input type="date" name="hireDate" value="${e ? e.hireDate : iso()}">`, { req: true })}
        ${field('Телефон', `<input name="phone" class="mono" maxlength="18" placeholder="${e ? esc(MASK.phone(e.phone)) : '+7 (916) 123-45-67'}">`, { req: !e, hint: e ? 'Оставьте пустым, чтобы не изменять' : 'Формат: +7 (916) 123-45-67' })}
        ${field('Служебный e-mail', `<input name="email" type="email" maxlength="60" value="${esc(e ? e.email : '')}">`, { req: true })}
        ${field('Основание перевода (при смене отдела)', `<input name="note" maxlength="100" placeholder="Приказ № __-к">`, { full: true })}
      </div></div><div class="form-actions"><a class="btn" href="#/${e ? 'employees/' + e.id : 'employees'}">Отмена</a><button class="btn primary">${ic('check', 'sm')} Сохранить</button></div></form>`;
  }
  function mountEmployeeForm({ id }) {
    const f = $('#e-form');
    if (!f) return;
    const e = id ? emp(id) : null;
    const toggle = () => { $('#cat-certs').classList.toggle('hidden', f.category.value !== 'Конструктор'); $('#cat-skills').classList.toggle('hidden', f.category.value !== 'Техник'); };
    toggle();
    f.category.addEventListener('change', toggle);
    f.phone.addEventListener('input', () => { // автоформат телефона
      const d = f.phone.value.replace(/\D/g, '').replace(/^[78]/, '').slice(0, 10);
      if (!d) return;
      f.phone.value = '+7 (' + d.slice(0, 3) + (d.length > 3 ? ') ' + d.slice(3, 6) : '') + (d.length > 6 ? '-' + d.slice(6, 8) : '') + (d.length > 8 ? '-' + d.slice(8, 10) : '');
    });
    const opt = (re, msg) => v => (!v && e) ? '' : !v ? 'Обязательное поле' : re.test(v.trim()) ? '' : msg;
    f.onsubmit = ev => {
      ev.preventDefault();
      const age = v => { const b = new Date(v); const n = new Date(); return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0); };
      const ok = validate(f, {
        fio: v => !/^[А-ЯЁ][а-яё-]+ [А-ЯЁ][а-яё-]+( [А-ЯЁ][а-яё-]+)?$/.test(v.trim()) ? 'Введите ФИО кириллицей: Фамилия Имя Отчество' : '',
        category: v => V.req(v, 'Выберите категорию'),
        deptId: v => V.req(v, 'Выберите отдел'),
        position: V.text(2, 100),
        certs: (v, form) => form.category.value === 'Конструктор' && (!/^\d{1,3}$/.test(v) || +v > 500) ? 'Целое число от 0 до 500' : '',
        skills: (v, form) => form.category.value === 'Техник' && !$$('[name="skills"]:checked', form).length ? 'Укажите хотя бы один вид оборудования' : '',
        passport: opt(/^\d{4} \d{6}$/, 'Формат: 4510 123456'),
        snils: opt(/^\d{3}-\d{3}-\d{3} \d{2}$/, 'Формат: 123-456-789 01'),
        birthDate: v => (!v && e) ? '' : V.date(v) || (age(v) < 18 || age(v) > 80 ? 'Возраст должен быть от 18 до 80 лет' : ''),
        hireDate: v => V.date(v) || (v > iso() ? 'Дата приёма не может быть в будущем' : ''),
        phone: opt(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, 'Формат: +7 (916) 123-45-67'),
        email: v => !/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v.trim()) ? 'Неверный формат e-mail' : '',
        note: (v, form) => e && form.deptId.value !== e.deptId && !v.trim() ? 'Укажите основание перевода в другой отдел' : (BAD_CHARS.test(v) ? 'Недопустимые символы' : '')
      });
      if (!ok) { toast('Проверьте правильность заполнения формы', 'err'); return; }
      const data = { fio: f.fio.value.trim(), category: f.category.value, deptId: f.deptId.value, position: f.position.value.trim(), qualification: f.qualification.value, hireDate: f.hireDate.value, email: f.email.value.trim(),
        certs: f.category.value === 'Конструктор' ? +f.certs.value : 0, skills: f.category.value === 'Техник' ? $$('[name="skills"]:checked', f).map(i => i.value) : [] };
      ['passport', 'snils', 'birthDate', 'phone'].forEach(k => { if (f[k].value.trim()) data[k] = f[k].value.trim(); });
      if (e) {
        const changes = [];
        if (e.deptId !== data.deptId) {
          if (dept(e.deptId).head === e.id) { toast('Сотрудник — начальник отдела. Сначала назначьте другого начальника.', 'err'); return; }
          e.history.push({ date: iso(), from: e.deptId, to: data.deptId, note: f.note.value.trim() });
          changes.push(`Отдел: ${dept(e.deptId).code} → ${dept(data.deptId).code}`);
        }
        ['category', 'position', 'qualification'].forEach(k => { if (e[k] !== data[k]) changes.push(`${{ category: 'Категория', position: 'Должность', qualification: 'Квалификация' }[k]}: ${e[k]} → ${data[k]}`); });
        const pdChanged = ['passport', 'snils', 'birthDate', 'phone'].filter(k => data[k] && data[k] !== e[k]);
        if (pdChanged.length) changes.push('Изменены ПДн: ' + pdChanged.length + ' поля (значения не журналируются)');
        Object.assign(e, data);
        audit('DATA', 'Изменение карточки сотрудника', 'Сотрудник ' + short(e.fio), changes.join('; ') || 'Изменены служебные сведения');
        save(); toast('Карточка сотрудника сохранена'); go('employees/' + e.id);
      } else {
        const ne = { id: 'e' + db.seq.employee++, address: 'г. Москва, ***', history: [], ...data };
        db.employees.push(ne);
        audit('DATA', 'Добавление сотрудника', 'Сотрудник ' + short(ne.fio), `${ne.category}, ${dept(ne.deptId).code}`);
        save(); toast('Сотрудник добавлен'); go('employees/' + ne.id);
      }
    };
  }

  /* ================= Оборудование ================= */
  function pageEquipment() {
    const st = uiState('equipment', { q: '', own: '', busy: '', dept: '', sort: 'inv', dir: 1 });
    const busy = db.equipment.filter(q => q.projectId).length;
    return head('Оборудование', 'Реестр оборудования отделов и коллективной собственности, контроль занятости в проектах.') +
      `<div class="grid g3" style="margin-bottom:16px">
        <div class="card kpi"><div class="ico tone-indigo">${ic('cpu')}</div><div><div class="lbl">Всего единиц</div><div class="val">${db.equipment.length}</div></div></div>
        <div class="card kpi"><div class="ico tone-amber">${ic('layers')}</div><div><div class="lbl">Занято в проектах</div><div class="val">${busy}</div></div></div>
        <div class="card kpi"><div class="ico tone-green">${ic('check')}</div><div><div class="lbl">Свободно</div><div class="val">${db.equipment.length - busy}</div></div></div></div>
      <div class="card"><div class="toolbar" id="flt">
        <div class="search">${ic('search', 'sm')}<input class="input" name="q" placeholder="Инвентарный номер или наименование" value="${esc(st.q)}" maxlength="60"></div>
        <select name="own" aria-label="Принадлежность">${options([['dept', 'Оборудование отделов'], ['common', 'Коллективная собственность']], st.own, 'Любая принадлежность')}</select>
        <select name="busy" aria-label="Занятость">${options([['free', 'Свободно'], ['busy', 'Занято в проекте']], st.busy, 'Любая занятость')}</select>
        <select name="dept" aria-label="Отдел">${options(db.departments.map(d => [d.id, d.code + ' — ' + d.name]), st.dept, 'Все отделы')}</select>
        <button class="btn ghost sm" data-act="reset-flt" data-key="equipment">${ic('refresh', 'sm')} Сбросить</button>
        <span class="count" id="cnt"></span></div><div id="tbl"></div></div>`;
  }
  const techsFor = q => db.employees.filter(e => e.category === 'Техник' && e.skills.includes(q.type));
  function drawEquipment() {
    const st = ui.equipment;
    const s = st.q.trim().toLowerCase();
    const rows = db.equipment.filter(q => (!s || (q.inv + ' ' + q.name + ' ' + q.type).toLowerCase().includes(s)) && (!st.own || q.ownership === st.own) && (!st.busy || (st.busy === 'busy') === !!q.projectId) && (!st.dept || q.deptId === st.dept));
    $('#cnt').textContent = `Найдено: ${rows.length}`;
    const cols = [
      { key: 'inv', label: 'Инв. №', cell: q => `<span class="mono t-main">${esc(q.inv)}</span>` },
      { key: 'name', label: 'Наименование', cell: q => `<div class="t-main">${esc(q.name)}</div><div class="t-sub">${esc(q.type)}</div>` },
      { key: 'own', label: 'Принадлежность', sortVal: q => q.ownership + (q.deptId || ''), cell: q => q.ownership === 'common' ? chip('Коллективная', 'violet') : `<span class="chip gray" title="${esc(dept(q.deptId).name)}">Отдел: ${esc(dept(q.deptId).code)}</span>` },
      { key: 'project', label: 'Занятость', sortVal: q => q.projectId ? proj(q.projectId).code : '', cell: q => q.projectId ? `<span class="chip amber"><span class="dot"></span>Занято: ${esc(proj(q.projectId).code)}</span>` : chip('Свободно', 'green') },
      { key: 'techs', label: 'Обслуживают техники', sortable: false, cell: q => techsFor(q).map(e => esc(short(e.fio))).join(', ') || '<span class="muted">—</span>' }
    ];
    $('#tbl').innerHTML = dataTable('equipment', cols, rows, { attr: q => ` class="link" data-act="eq-card" data-id="${q.id}"` });
  }
  function equipmentCard(qid) {
    const q = byId(db.equipment, qid);
    const p = q.projectId && proj(q.projectId);
    const acts = [];
    if (can('equipment.transfer') && q.ownership === 'dept') acts.push(`<button class="btn" data-act="eq-transfer" data-id="${q.id}">${ic('transfer', 'sm')} Передать в другой отдел</button>`);
    if (can('equipment.assign')) acts.push(q.projectId ? `<button class="btn" data-act="release-eq" data-id="${q.id}">${ic('x', 'sm')} Освободить</button>` : `<button class="btn primary" data-act="eq-assign" data-id="${q.id}">${ic('plus', 'sm')} Назначить на проект</button>`);
    modal({
      title: q.name, wide: true,
      icon: `<div class="warn-ico" style="background:var(--primary-soft);color:var(--primary)">${ic('cpu')}</div>`,
      body: `<dl class="props"><dt>Инвентарный номер</dt><dd class="mono">${esc(q.inv)}</dd><dt>Тип</dt><dd>${esc(q.type)}</dd>
        <dt>Принадлежность</dt><dd>${q.ownership === 'common' ? 'Коллективная собственность организации' : 'Отдел: ' + esc(dept(q.deptId).name)}</dd>
        <dt>Занятость</dt><dd>${p ? `Используется в проекте ${projLink(p.id)} — ${esc(p.name)}` : chip('Свободно', 'green')}</dd>
        <dt>Обслуживают техники</dt><dd>${techsFor(q).map(e => esc(e.fio)).join('<br>') || 'нет техников с допуском'}</dd></dl>
        ${q.history.length ? `<h4 style="margin:16px 0 8px">История передачи</h4><ul class="timeline">${q.history.map(h => `<li><b>${fdate(h.date)}</b>: ${esc(dept(h.from).name)} → ${esc(dept(h.to).name)}<div class="muted small">${esc(h.note)}</div></li>`).join('')}</ul>` : ''}`,
      foot: `<button class="btn" data-close>Закрыть</button>${acts.join('')}`,
      onMount(el, close) { el.addEventListener('click', e => { if (e.target.closest('[data-act]')) close(); }, true); }
    });
  }
  function assignEquipment(projectId, eqId) {
    const free = db.equipment.filter(q => !q.projectId);
    const busy = db.equipment.filter(q => q.projectId);
    const activeP = db.projects.filter(p => p.status !== 'Завершён');
    modal({
      title: 'Назначение оборудования на проект',
      body: `<form id="as-form" class="stack" novalidate>
        ${field('Проект', `<select name="p">${options(activeP.map(p => [p.id, p.code + ' — ' + p.name]), projectId, '— выберите проект —')}</select>`, { req: true })}
        ${field('Оборудование', `<select name="q"><option value="">— выберите оборудование —</option><optgroup label="Свободное">${free.map(q => `<option value="${q.id}" ${q.id === eqId ? 'selected' : ''}>${esc(q.inv + ' — ' + q.name)}</option>`).join('')}</optgroup><optgroup label="Занятое (недоступно)">${busy.map(q => `<option value="${q.id}" disabled>${esc(q.inv + ' — ' + q.name)} · занято в ${esc(proj(q.projectId).code)}</option>`).join('')}</optgroup></select>`, { req: true, hint: 'Оборудование, используемое в другом проекте, назначить нельзя (ТБ-7)' })}
      </form>`,
      foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" form="as-form">Назначить</button>`,
      onMount(el, close) {
        const f = $('#as-form', el);
        f.onsubmit = e => {
          e.preventDefault();
          if (!validate(f, { p: v => V.req(v, 'Выберите проект'), q: v => V.req(v, 'Выберите оборудование') })) return;
          const q = byId(db.equipment, f.q.value), p = proj(f.p.value);
          if (q.projectId) { // контроль целостности: двойное закрепление
            audit('DATA', 'Назначение оборудования на проект', q.inv + ' ' + q.name, `Отклонено: оборудование занято в проекте ${proj(q.projectId).code}`, 'отказ');
            toast('Оборудование уже занято в другом проекте', 'err'); return;
          }
          q.projectId = p.id;
          audit('DATA', 'Назначение оборудования на проект', q.inv + ' ' + q.name, 'Проект ' + p.code);
          save(); close(); toast(`${q.inv} назначено на проект ${p.code}`); render();
        };
      }
    });
  }

  /* ================= Субподрядчики ================= */
  const W_STATUSES = ['Передано', 'В работе', 'Принято'];
  function pageSubs() {
    const st = uiState('subworks', { q: '', status: '', sub: '', sort: 'deadline', dir: 1 });
    const subRows = db.subcontractors.map(s => { const w = db.subworks.filter(x => x.subId === s.id); return `<tr><td class="t-main">${esc(s.name)}</td><td class="mono">${esc(s.inn)}</td><td>${esc(s.profile)}</td><td class="num">${w.length}</td><td class="num">${moneyCell(w.reduce((a, x) => a + x.cost, 0))}</td></tr>`; }).join('');
    return head('Субподрядчики', 'Справочник субподрядных организаций и учёт переданных объёмов работ по проектам.', can('subs.edit') ? `<button class="btn primary" data-act="new-work">${ic('plus', 'sm')} Передать объём работ</button>` : '') +
      `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${ic('briefcase')} Справочник субподрядных организаций</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Организация</th><th>ИНН</th><th>Профиль</th><th class="num">Работ</th><th class="num">Сумма</th></tr></thead><tbody>${subRows}</tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>${ic('layers')} Переданные объёмы работ</h3></div><div class="toolbar" id="flt">
        <div class="search">${ic('search', 'sm')}<input class="input" name="q" placeholder="Поиск по объёму работ или проекту" value="${esc(st.q)}" maxlength="60"></div>
        <select name="sub" aria-label="Субподрядчик">${options(db.subcontractors.map(s => [s.id, s.name]), st.sub, 'Все субподрядчики')}</select>
        <select name="status" aria-label="Статус">${options(W_STATUSES, st.status, 'Все статусы')}</select>
        <span class="count" id="cnt"></span></div><div id="tbl"></div></div>`;
  }
  function drawSubs() {
    const st = ui.subworks;
    const s = st.q.trim().toLowerCase();
    const rows = db.subworks.filter(w => (!s || (w.scope + ' ' + proj(w.projectId).code + ' ' + proj(w.projectId).name).toLowerCase().includes(s)) && (!st.sub || w.subId === st.sub) && (!st.status || w.status === st.status));
    $('#cnt').textContent = `Найдено: ${rows.length}`;
    $('#tbl').innerHTML = dataTable('subworks', [
      { key: 'sub', label: 'Субподрядчик', sortVal: w => byId(db.subcontractors, w.subId).name, cell: w => esc(byId(db.subcontractors, w.subId).name) },
      { key: 'project', label: 'Проект', sortVal: w => proj(w.projectId).code, cell: w => projLink(w.projectId) },
      { key: 'scope', label: 'Объём работ', cell: w => esc(w.scope) },
      { key: 'deadline', label: 'Срок', cell: w => `<span class="nowrap">${fdate(w.deadline)}</span>` },
      { key: 'status', label: 'Статус', cell: w => chip(w.status) },
      { key: 'cost', label: 'Стоимость', num: true, sortable: can('money.view'), cell: w => moneyCell(w.cost) }
    ], rows);
  }
  function newWork() {
    modal({
      title: 'Передача объёма работ субподрядчику', wide: true,
      body: `<form id="w-form" class="form-grid" novalidate>
        ${field('Субподрядчик', `<select name="subId">${options(db.subcontractors.map(s => [s.id, s.name]), '', '— выберите —')}</select>`, { req: true })}
        ${field('Проект', `<select name="projectId">${options(db.projects.filter(p => p.status !== 'Завершён').map(p => [p.id, p.code + ' — ' + p.name]), '', '— выберите —')}</select>`, { req: true })}
        ${field('Объём работ', '<input name="scope" maxlength="150">', { req: true, full: true })}
        ${field('Стоимость, ₽', '<input name="cost" type="number" min="1" step="1000">', { req: true })}
        ${field('Срок выполнения', '<input name="deadline" type="date">', { req: true })}
      </form>`,
      foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" form="w-form">Сохранить</button>`,
      onMount(el, close) {
        const f = $('#w-form', el);
        f.onsubmit = e => {
          e.preventDefault();
          const ok = validate(f, {
            subId: v => V.req(v, 'Выберите субподрядчика'), projectId: v => V.req(v, 'Выберите проект'), scope: V.text(5, 150),
            cost: v => !(+v > 0) || +v > 1e9 ? 'Положительное число' : '',
            deadline: (v, form) => V.date(v) || (v < iso() ? 'Срок не может быть в прошлом' : form.projectId.value && v > proj(form.projectId.value).end ? 'Срок позже окончания проекта (' + fdate(proj(form.projectId.value).end) + ')' : '')
          });
          if (!ok) return;
          const w = { id: 'w' + db.seq.subwork++, subId: f.subId.value, projectId: f.projectId.value, scope: f.scope.value.trim(), cost: +f.cost.value, deadline: f.deadline.value, status: 'Передано' };
          db.subworks.push(w);
          audit('DATA', 'Передача объёма работ субподрядчику', byId(db.subcontractors, w.subId).name, `${proj(w.projectId).code}: ${w.scope}; ${money(w.cost)}`);
          save(); close(); toast('Объём работ передан субподрядчику'); render();
        };
      }
    });
  }

  /* ================= Отделы ================= */
  function pageDepartments() {
    return head('Организационная структура', 'Справочник отделов, начальники отделов и состав сотрудников.') + `<div class="grid g3">${db.departments.map(d => {
      const list = db.employees.filter(e => e.deptId === d.id);
      const h = emp(d.head);
      const cats = CATS.map(c => [c, list.filter(e => e.category === c).length]).filter(c => c[1]);
      return `<div class="card"><div class="card-head"><h3><span class="chip indigo">${esc(d.code)}</span> ${esc(d.name)}</h3></div><div class="card-body">
        <div style="display:flex;gap:10px;align-items:center"><span class="avatar">${esc(initials(h.fio))}</span><div class="grow"><div class="muted small">Начальник отдела</div><div class="t-main">${empLink(h.id)}</div></div>
        ${can('departments.edit') ? `<button class="btn sm" data-act="set-head" data-id="${d.id}">Назначить</button>` : ''}</div>
        <div class="meta-row" style="margin-top:12px">${cats.map(c => `<span class="chip gray">${esc(c[0])}: ${c[1]}</span>`).join('')}</div>
        <div class="muted small" style="margin-top:10px">Сотрудников: <b>${list.length}</b> · Оборудования: <b>${db.equipment.filter(q => q.deptId === d.id).length}</b></div>
        <details style="margin-top:10px"><summary class="small" style="cursor:pointer;font-weight:700;color:var(--primary)">Состав отдела</summary><ul class="list-plain">${list.map(e => `<li class="small"><span class="grow">${empLink(e.id)}</span><span class="muted">${esc(e.position)}</span></li>`).join('')}</ul></details>
      </div></div>`;
    }).join('')}</div>`;
  }
  async function setHead(did) {
    const d = dept(did);
    const list = db.employees.filter(e => e.deptId === d.id);
    modal({
      title: 'Назначение начальника отдела',
      body: `<p class="muted">${esc(d.name)}</p><form id="h-form" novalidate style="margin-top:12px">${field('Начальник отдела', `<select name="e">${options(list.map(e => [e.id, e.fio + ' — ' + e.position]), d.head)}</select>`, { req: true, hint: 'Начальником может быть только сотрудник этого отдела' })}</form>`,
      foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" form="h-form">Назначить</button>`,
      onMount(el, close) {
        $('#h-form', el).onsubmit = async ev => {
          ev.preventDefault();
          const nid = ev.target.e.value;
          if (nid === d.head) { close(); return; }
          close();
          if (!await confirmAction({ title: 'Подтвердите назначение', text: `Назначить <b>${esc(emp(nid).fio)}</b> начальником отдела «${esc(d.name)}»?`, danger: false, ok: 'Назначить' })) return;
          const old = emp(d.head);
          d.head = nid;
          audit('DATA', 'Назначение начальника отдела', d.name, `${short(old.fio)} → ${short(emp(nid).fio)}`);
          save(); toast('Начальник отдела назначен'); render();
        };
      }
    });
  }

  /* ================= Отчёты ================= */
  const REPORTS = [
    { id: 'contracts', name: 'Договоры за период', desc: 'Перечень и стоимость договоров', ok: () => can('contracts.view') && can('money.view'), grif: 'kt', period: true, status: C_STATUSES },
    { id: 'projects', name: 'Выполнение проектов', desc: 'Статусы, сроки, процент выполнения', ok: () => can('projects.view') && me.role !== 'guest', grif: () => can('money.view') ? 'kt' : 'dsp', status: P_STATUSES },
    { id: 'staff', name: 'Кадровый состав', desc: 'Численность по отделам и категориям', ok: () => ['hr', 'head'].includes(me.role), grif: 'pd' },
    { id: 'equipment', name: 'Использование оборудования', desc: 'Занятость оборудования в проектах', ok: () => can('equipment.view'), grif: 'dsp' },
    { id: 'subs', name: 'Субподрядные работы', desc: 'Объёмы, сроки и стоимость', ok: () => can('subs.view'), grif: 'kt', status: W_STATUSES }
  ];
  const GRIF = {
    kt: ['Коммерческая тайна', 'Содержит сведения, составляющие коммерческую тайну (98-ФЗ)'],
    pd: ['Конфиденциально', 'Содержит персональные данные (152-ФЗ)'],
    dsp: ['Для служебного пользования', 'Только для работников организации']
  };
  function pageReports() {
    const list = REPORTS.filter(r => r.ok());
    const st = uiState('reports', { type: list[0].id, from: new Date().getFullYear() + '-01-01', to: iso(), status: '', built: false });
    if (!list.find(r => r.id === st.type)) st.type = list[0].id;
    const r = REPORTS.find(x => x.id === st.type);
    return head('Отчёты', 'Формирование печатных форм с грифом ограничения доступа. Печать и экспорт регистрируются в журнале.') +
      `<div class="report-layout"><div class="stack no-print">
        <div class="card report-types">${list.map(x => `<button data-act="rep-type" data-id="${x.id}" class="${x.id === st.type ? 'active' : ''}"><b>${x.name}</b><span>${x.desc}</span></button>`).join('')}</div>
        <form class="card card-body stack" id="rep-form" novalidate>
          ${r.period ? field('Период: с', `<input type="date" name="from" value="${st.from}">`, { req: true }) + field('по', `<input type="date" name="to" value="${st.to}">`, { req: true }) : ''}
          ${r.status ? field('Статус', `<select name="status">${options(r.status, st.status, 'Все')}</select>`) : ''}
          <button class="btn primary">${ic('chart', 'sm')} Сформировать</button>
        </form></div>
        <div id="rep-out">${st.built ? buildReport(r, st) : `<div class="card empty">${ic('file')}<div>Выберите отчёт и параметры, затем нажмите «Сформировать».</div></div>`}</div></div>`;
  }
  function reportData(r, st) {
    const S = st.status;
    if (r.id === 'contracts') {
      const rows = db.contracts.filter(c => c.signDate >= st.from && c.signDate <= st.to && (!S || c.status === S)).sort((a, b) => a.signDate.localeCompare(b.signDate));
      return { head: ['№', 'Номер', 'Заказчик', 'Предмет договора', 'Дата', 'Статус', 'Сумма, ₽'], num: [6], rows: rows.map((c, i) => [i + 1, c.number, cust(c.customerId).name, c.subject, fdate(c.signDate), c.status, contractSum(c.id)]), total: ['Итого', rows.reduce((s, c) => s + contractSum(c.id), 0)], sub: `за период с ${fdate(st.from)} по ${fdate(st.to)}${S ? ', статус «' + S + '»' : ''}` };
    }
    if (r.id === 'projects') {
      const rows = db.projects.filter(p => !S || p.status === S);
      const money_ = can('money.view');
      return { head: ['Код', 'Наименование', 'Руководитель', 'Сроки', 'Статус', '%'].concat(money_ ? ['Стоимость, ₽'] : []), num: money_ ? [5, 6] : [5], rows: rows.map(p => [p.code, p.name, short(emp(p.managerId).fio), fdate(p.start) + ' – ' + fdate(p.end), p.status, p.progress].concat(money_ ? [projectCost(p.id)] : [])), total: money_ ? ['Итого', rows.reduce((s, p) => s + projectCost(p.id), 0)] : null, sub: `по состоянию на ${fdate(iso())}${S ? ', статус «' + S + '»' : ''}` };
    }
    if (r.id === 'staff') {
      const deps = me.role === 'head' ? [dept(myDept())] : db.departments;
      const rows = deps.map(d => { const l = db.employees.filter(e => e.deptId === d.id); return [d.name, short(emp(d.head).fio), ...CATS.map(c => l.filter(e => e.category === c).length), l.length]; });
      return { head: ['Отдел', 'Начальник', 'Констр.', 'Инженеры', 'Техники', 'Лаборанты', 'Прочие', 'Всего'], num: [2, 3, 4, 5, 6, 7], rows, total: ['Итого', ...[2, 3, 4, 5, 6, 7].map(i => rows.reduce((s, x) => s + x[i], 0))], totalSpan: 2, sub: `по состоянию на ${fdate(iso())}` };
    }
    if (r.id === 'equipment') {
      const rows = db.equipment;
      const busy = rows.filter(q => q.projectId).length;
      return { head: ['Инв. №', 'Наименование', 'Принадлежность', 'Проект', 'Состояние'], num: [], rows: rows.map(q => [q.inv, q.name, q.ownership === 'common' ? 'Коллективная' : dept(q.deptId).code, q.projectId ? proj(q.projectId).code : '—', q.projectId ? 'Занято' : 'Свободно']), note: `Занятость оборудования: ${busy} из ${rows.length} (${Math.round(busy / rows.length * 100)}%)`, sub: `по состоянию на ${fdate(iso())}` };
    }
    const rows = db.subworks.filter(w => !S || w.status === S);
    return { head: ['Субподрядчик', 'Проект', 'Объём работ', 'Срок', 'Статус', 'Стоимость, ₽'], num: [5], rows: rows.map(w => [byId(db.subcontractors, w.subId).name, proj(w.projectId).code, w.scope, fdate(w.deadline), w.status, w.cost]), total: ['Итого', rows.reduce((s, w) => s + w.cost, 0)], sub: `по состоянию на ${fdate(iso())}${S ? ', статус «' + S + '»' : ''}` };
  }
  function buildReport(r, st) {
    const d = reportData(r, st);
    const g = GRIF[typeof r.grif === 'function' ? r.grif() : r.grif];
    const stamp = fdt(Date.now());
    const wm = Array.from({ length: 14 }, () => `${me.login}  ·  ${stamp}  ·  ${me.login}  ·  ${stamp}`).join('\n');
    const fmt = (v, i) => d.num.includes(i) && typeof v === 'number' && i === d.head.length - 1 && d.head[i].includes('₽') ? Math.round(v).toLocaleString('ru-RU') : esc(v);
    const span = d.totalSpan || d.head.length - 1;
    return `<div class="no-print" style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn" data-act="rep-csv">${ic('download', 'sm')} Экспорт CSV</button><button class="btn primary" data-act="rep-print">${ic('printer', 'sm')} Печать</button></div>
      <div class="doc" id="doc"><div class="wm"><div>${esc(wm)}</div></div>
        <div class="doc-top"><div><b>${esc(db.org)}</b><br>Информационная система «ПроектОрг»</div><div class="grif">${esc(g[0])}<br><span style="font-weight:400;text-transform:none">${esc(db.org)}</span><br><span style="font-weight:400;text-transform:none">Экз. № 1</span></div></div>
        <h2>${esc(r.name)}</h2><div class="doc-sub">${esc(d.sub)}</div>
        <table><thead><tr>${d.head.map((h, i) => `<th class="${d.num.includes(i) ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${d.rows.map(row => `<tr>${row.map((v, i) => `<td class="${d.num.includes(i) ? 'num' : ''}">${fmt(v, i)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${d.head.length}" style="text-align:center">Нет данных за выбранный период</td></tr>`}</tbody>
        ${d.total ? `<tfoot><tr><td colspan="${span}">${d.total[0]}</td>${d.total.slice(1).map(v => `<td class="num">${Math.round(v).toLocaleString('ru-RU')}</td>`).join('')}</tr></tfoot>` : ''}</table>
        ${d.note ? `<p style="margin-top:12px">${esc(d.note)}</p>` : ''}
        <div class="sign"><div>Исполнитель: ${esc(short(me.fio))} ____________</div><div>Руководитель: ____________ / ____________ /</div></div>
        <div class="doc-foot">${esc(g[1])}. Сформировано в ИС «ПроектОрг» пользователем ${esc(me.login)} (${esc(ROLES[me.role].name)}) ${stamp}. Копирование и передача третьим лицам без разрешения запрещены.</div>
      </div>`;
  }

  /* ================= Журнал событий (только Адм. ИБ) ================= */
  function auditTable(rows, compact) {
    if (!rows.length) return `<div class="empty">${ic('search')}<div>События не найдены</div></div>`;
    return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Время</th><th>Пользователь</th>${compact ? '' : '<th>IP-адрес</th><th>Тип</th>'}<th>Действие</th>${compact ? '' : '<th>Объект</th><th>Подробности</th>'}<th>Результат</th></tr></thead><tbody>
      ${rows.map(a => `<tr><td class="nowrap mono small">${fdt(a.ts)}</td><td class="nowrap"><span class="mono">${esc(a.login)}</span>${compact ? '' : `<div class="t-sub">${esc(ROLES[a.role] ? ROLES[a.role].short : a.role)}</div>`}</td>
        ${compact ? '' : `<td class="mono small">${esc(a.ip)}</td><td><span class="chip gray">${esc(TYPES[a.type] || a.type)}</span></td>`}
        <td class="t-main">${esc(a.action)}${compact ? `<div class="t-sub">${esc(a.object)}</div>` : ''}</td>${compact ? '' : `<td>${esc(a.object)}</td><td class="small" style="min-width:220px;max-width:340px">${esc(a.details)}</td>`}
        <td>${a.result === 'успех' ? chip('успех', 'green') : chip('отказ', 'red')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function pageAudit() {
    const st = uiState('audit', { q: '', type: '', result: '', user: '', from: '', to: '' });
    const logins = [...new Set(db.audit.map(a => a.login))].sort();
    return head('Журнал событий', 'Регистрация действий пользователей и событий безопасности (ТБ-6). Доступ — только администратор безопасности.',
      `<button class="btn" data-act="audit-csv">${ic('download', 'sm')} Экспорт журнала</button>`) +
      alertBox('info', `Журнал ведётся в режиме «только добавление»: записи не могут быть изменены или удалены пользователями. Срок хранения — не менее ${db.policy.retentionMonths} месяцев.`) +
      `<div class="card" style="margin-top:16px"><div class="toolbar" id="flt">
        <div class="search">${ic('search', 'sm')}<input class="input" name="q" placeholder="Поиск по действию, объекту, подробностям" value="${esc(st.q)}" maxlength="60"></div>
        <select name="type" aria-label="Тип">${options(Object.entries(TYPES), st.type, 'Все типы')}</select>
        <select name="result" aria-label="Результат">${options([['успех', 'Успех'], ['отказ', 'Отказ']], st.result, 'Любой результат')}</select>
        <select name="user" aria-label="Пользователь">${options(logins, st.user, 'Все пользователи')}</select>
        <input type="date" name="from" value="${st.from}" aria-label="С"><input type="date" name="to" value="${st.to}" aria-label="По">
        <button class="btn ghost sm" data-act="reset-flt" data-key="audit">${ic('refresh', 'sm')} Сбросить</button>
        <span class="count" id="cnt"></span></div><div id="tbl"></div></div>`;
  }
  function filteredAudit() {
    const st = ui.audit;
    const q = st.q.trim().toLowerCase();
    return db.audit.filter(a => (!q || [a.action, a.object, a.details, a.login, a.ip].join(' ').toLowerCase().includes(q)) && (!st.type || a.type === st.type) && (!st.result || a.result === st.result) && (!st.user || a.login === st.user)
      && (!st.from || iso(new Date(a.ts)) >= st.from) && (!st.to || iso(new Date(a.ts)) <= st.to));
  }
  function drawAudit() {
    const rows = filteredAudit();
    $('#cnt').textContent = `Записей: ${rows.length} · отказов: ${rows.filter(a => a.result === 'отказ').length}`;
    $('#tbl').innerHTML = auditTable(rows.slice(0, 300));
  }

  /* ================= Учётные записи ================= */
  function pageUsers() {
    const now = Date.now();
    const rows = db.users.map(u => {
      const at = db.attempts[u.login] || { count: 0, lockedUntil: 0 };
      const locked = at.lockedUntil > now;
      const pwAge = Math.floor((now - u.pwChanged) / 864e5);
      const status = !u.active ? chip('Отключена', 'gray') : locked ? `<span class="chip red"><span class="dot"></span>Заблокирована · <span data-until="${at.lockedUntil}">${mmss(at.lockedUntil - now)}</span></span>` : u.mustChange ? chip('Требуется смена пароля', 'amber') : chip('Активна', 'green');
      const acts = [];
      if (can('users.unlock') && locked) acts.push(`<button class="btn sm" data-act="unlock" data-id="${u.login}">${ic('unlock', 'sm')} Разблокировать</button>`);
      if (can('users.manage') && u.login !== me.login) {
        acts.push(`<button class="btn sm" data-act="user-role" data-id="${u.login}">Роль</button>`);
        acts.push(`<button class="btn sm" data-act="user-reset" data-id="${u.login}">Сброс пароля</button>`);
        acts.push(`<button class="btn sm ${u.active ? 'danger-ghost' : ''}" data-act="user-toggle" data-id="${u.login}">${u.active ? 'Отключить' : 'Включить'}</button>`);
      }
      return `<tr><td><div class="t-main mono">${esc(u.login)}</div><div class="t-sub">${esc(u.fio)}</div></td><td>${roleChip(u.role)}</td><td>${status}</td>
        <td class="num">${at.count || 0}</td><td class="nowrap small">${u.lastLogin ? fdt(u.lastLogin) : '—'}</td>
        <td class="nowrap small ${pwAge > db.policy.maxAgeDays ? 'check-no' : ''}">${pwAge} дн. назад${pwAge > db.policy.maxAgeDays ? ' ' + chip('истёк', 'red') : ''}</td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">${acts.join('') || '<span class="muted small">—</span>'}</div></td></tr>`;
    }).join('');
    return head('Учётные записи', me.role === 'secadmin' ? 'Контроль состояния учётных записей и разблокировка. Управление ролями выполняет администратор системы.' : 'Создание учётных записей и назначение ролей. Разблокировка и журнал — функции администратора безопасности.',
      can('users.manage') ? `<button class="btn primary" data-act="user-new">${ic('plus', 'sm')} Новая учётная запись</button>` : '') +
      `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Учётная запись</th><th>Роль</th><th>Состояние</th><th class="num">Неусп. попыток</th><th>Последний вход</th><th>Пароль изменён</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="grid g2" style="margin-top:16px">${alertBox('info', '<b>Одна роль на пользователя.</b> Права минимально необходимые и проверяются при каждом переходе. Совмещение ролей администратора системы и администратора безопасности запрещено (ТБ-3).')}${alertBox('warn', `Пароль действует ${db.policy.maxAgeDays} дней. Права доступа пересматриваются не реже 1 раза в квартал.`)}</div>`;
  }
  function userForm() {
    const emps = db.employees.filter(e => !db.users.some(u => u.empId === e.id));
    modal({
      title: 'Новая учётная запись', wide: true,
      body: `<form id="u-form" class="form-grid" novalidate>
        ${field('Логин', '<input name="login" class="mono" maxlength="30" placeholder="i.ivanov">', { req: true, hint: 'Латиница в нижнем регистре, цифры, точка' })}
        ${field('Роль', `<select name="role">${options(Object.entries(ROLES).map(([k, v]) => [k, v.name]), '', '— выберите роль —')}</select>`, { req: true })}
        ${field('Сотрудник', `<select name="empId">${options(emps.map(e => [e.id, e.fio + ' — ' + e.position]), '', '— выберите сотрудника —')}</select>`, { req: true, full: true, hint: 'Учётная запись выдаётся конкретному работнику (уникальная, ТБ-1)' })}
      </form>`,
      foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" form="u-form">Создать</button>`,
      onMount(el, close) {
        const f = $('#u-form', el);
        f.onsubmit = e => {
          e.preventDefault();
          const ok = validate(f, {
            login: v => !/^[a-z][a-z0-9._-]{2,29}$/.test(v.trim()) ? 'От 3 символов: латиница, цифры, . _ -' : db.users.some(u => u.login === v.trim()) ? 'Логин уже существует' : '',
            role: v => V.req(v, 'Выберите роль'), empId: v => V.req(v, 'Выберите сотрудника')
          });
          if (!ok) return;
          const tmp = tempPassword();
          const u = { login: f.login.value.trim(), fio: emp(f.empId.value).fio, role: f.role.value, empId: f.empId.value, active: true, mustChange: true, hash: pwHash(f.login.value.trim(), tmp), pwChanged: Date.now(), lastLogin: 0 };
          db.users.push(u);
          audit('ADMIN', 'Создание учётной записи', 'Учётная запись ' + u.login, `Роль: ${ROLES[u.role].name}; сотрудник ${short(u.fio)}`);
          save(); close(); showTemp(u.login, tmp); render();
        };
      }
    });
  }
  function tempPassword() {
    const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '#%!@&*'];
    const rnd = n => { const a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] % n; };
    let p = sets.map(s => s[rnd(s.length)]).join('');
    const all = sets.join('');
    while (p.length < 14) p += all[rnd(all.length)];
    return p.split('').sort(() => rnd(3) - 1).join('');
  }
  function showTemp(login, tmp) {
    modal({
      title: 'Временный пароль', icon: `<div class="warn-ico">${ic('key')}</div>`,
      body: `<p>Временный пароль для <b class="mono">${esc(login)}</b> отображается <b>один раз</b>. Передайте его пользователю по защищённому каналу.</p>
        <div class="big-timer mono" style="font-size:26px;padding:14px;background:var(--surface-3);border-radius:12px;margin:14px 0;user-select:all">${esc(tmp)}</div>
        <p class="muted small">При первом входе пользователь обязан сменить пароль (ТБ-2). Сам пароль в журнал не записывается.</p>`,
      foot: '<button class="btn primary" data-close>Готово</button>'
    });
  }

  /* ================= Политика безопасности ================= */
  const POLICY = [
    ['maxAttempts', 'Допустимое число неуспешных попыток входа', 3, 10, 'ТБ-1: 5 попыток'],
    ['lockMinutes', 'Время блокировки учётной записи, мин', 1, 60, 'ТБ-1: 15 минут'],
    ['idleMinutes', 'Тайм-аут бездействия сеанса, мин', 1, 30, 'Для демонстрации на защите можно установить 1 мин'],
    ['minLength', 'Минимальная длина пароля, символов', 8, 32, 'ТБ-1: не менее 12'],
    ['maxAgeDays', 'Срок действия пароля, дней', 30, 180, 'ТБ-1: не реже 1 раза в 90 дней'],
    ['retentionMonths', 'Срок хранения журнала событий, мес.', 6, 36, 'ТБ-6: не менее 6 месяцев']
  ];
  function pagePolicy() {
    return head('Политика безопасности', 'Параметры парольной политики, блокировки и сеансов. Изменения регистрируются в журнале.') +
      `<form class="card" id="pol-form" novalidate><div class="card-body"><div class="form-grid">
        ${POLICY.map(([k, l, mn, mx, hint]) => field(l, `<input type="number" name="${k}" min="${mn}" max="${mx}" value="${db.policy[k]}">`, { req: true, hint: `Допустимо ${mn}–${mx}. ${hint}` })).join('')}
      </div></div><div class="form-actions"><button type="button" class="btn" data-act="pol-default">Значения по ТЗ</button><button class="btn primary">${ic('check', 'sm')} Сохранить политику</button></div></form>
      <div class="grid g2" style="margin-top:16px">
        <div class="card card-body"><h3 style="font-size:15px;margin-bottom:8px">${ic('lock', 'sm')} Требования к паролю (ТБ-1)</h3><ul class="rules">${pwRules('', 'x').map(r => `<li>${ic('check', 'sm')} ${r[1]}</li>`).join('')}</ul></div>
        <div class="card card-body"><h3 style="font-size:15px;margin-bottom:8px">${ic('shield', 'sm')} Защита канала и данных (полная версия)</h3><p class="small muted">TLS ≥ 1.2, HTTP → HTTPS (ТБ-5); заголовки CSP и X-Content-Type-Options (ТБ-4); БД в выделенном сегменте (ТБ-10) и на территории РФ (ТБ-11).</p></div>
      </div>`;
  }
  function mountPolicy() {
    const f = $('#pol-form');
    f.onsubmit = async e => {
      e.preventDefault();
      const rules = {};
      POLICY.forEach(([k, , mn, mx]) => { rules[k] = v => !/^\d+$/.test(v) || +v < mn || +v > mx ? `Целое число от ${mn} до ${mx}` : ''; });
      if (!validate(f, rules)) return;
      const diff = POLICY.filter(([k]) => +f[k].value !== db.policy[k]).map(([k, l]) => `${l}: ${db.policy[k]} → ${f[k].value}`);
      if (!diff.length) { toast('Изменений нет', 'info'); return; }
      if (!await confirmAction({ title: 'Изменить политику безопасности?', text: 'Будут изменены параметры:<br>' + diff.map(esc).join('<br>'), danger: false, ok: 'Применить' })) return;
      POLICY.forEach(([k]) => { db.policy[k] = +f[k].value; });
      audit('SEC', 'Изменение политики безопасности', 'Политика безопасности', diff.join('; '));
      save(); toast('Политика безопасности сохранена'); render();
    };
  }

  /* ================= О прототипе ================= */
  function navScheme() {
    const W = 1100, rowH = 54, top = 24;
    const mods = [
      ['Договоры', 'РП, Нач. отд., Экономист', 'Карточка договора', 'Форма договора (РП)'],
      ['Проекты', 'РП, Нач. отд., Эконом., Спец., Гость', 'Карточка проекта', 'Назначение оборудования (РП)'],
      ['Сотрудники', 'Кадровик, Нач. отд., РП, Спец.', 'Карточка (маскирование ПДн)', 'Форма сотрудника (Кадровик)'],
      ['Оборудование', 'РП, Нач. отд., Спец.', 'Карточка оборудования', 'Передача / назначение'],
      ['Субподрядчики', 'РП, Экономист', 'Объёмы работ', 'Передача объёма (РП)'],
      ['Отделы', 'Кадровик, Нач. отд.', 'Состав отдела', 'Назначение начальника'],
      ['Отчёты', 'РП, Нач. отд., Эконом., Кадровик', 'Печатная форма с грифом', 'Печать / экспорт CSV'],
      ['Журнал событий', 'Только Адм. ИБ', 'Фильтр и поиск', 'Экспорт журнала'],
      ['Учётные записи', 'Адм. системы, Адм. ИБ', 'Роль / блокировка', 'Временный пароль'],
      ['Политика безопасности', 'Только Адм. ИБ', null, null]
    ];
    const H = top * 2 + mods.length * rowH;
    const box = (x, y, w, h, t, sub, cls) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="${cls}"/><text x="${x + 12}" y="${y + (sub ? 19 : h / 2 + 5)}" class="t1">${esc(t)}</text>${sub ? `<text x="${x + 12}" y="${y + 35}" class="t2">${esc(sub)}</text>` : ''}</g>`;
    const line = (x1, y1, x2, y2, dash) => `<path d="M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" class="ln${dash ? ' dash' : ''}" marker-end="url(#ar)"/>`;
    const mid = top + mods.length * rowH / 2 - 22;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Схема навигации между экранами">
      <style>.b0{fill:var(--primary-soft);stroke:var(--primary)}.b1{fill:var(--surface);stroke:var(--border-strong)}.b2{fill:var(--surface-2);stroke:var(--border)}.b3{fill:var(--danger-soft);stroke:var(--danger)}
      .t1{font:700 13px Manrope,sans-serif;fill:var(--text)}.t2{font:500 11px Manrope,sans-serif;fill:var(--muted)}.ln{fill:none;stroke:var(--muted);stroke-width:1.3}.dash{stroke-dasharray:5 4;stroke:var(--danger)}</style>
      <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="var(--muted)"/></marker></defs>`;
    s += box(10, mid, 150, 44, 'Вход в систему', 'все роли', 'b0');
    s += box(200, mid, 160, 44, 'Главное окно', 'меню по роли', 'b0');
    s += line(160, mid + 22, 200, mid + 22);
    s += `<path d="M280 ${mid + 44} C 280 ${H - 6}, 85 ${H - 6}, 85 ${mid + 46}" class="ln dash" marker-end="url(#ar)"/><text x="120" y="${H - 10}" class="t2" style="fill:var(--danger)">выход / тайм-аут сеанса</text>`;
    mods.forEach((m, i) => {
      const y = top + i * rowH;
      const sec = i >= 7;
      s += line(360, mid + 22, 420, y + 22);
      s += box(420, y, 230, 44, m[0], m[1], sec ? 'b3' : 'b1');
      if (m[2]) { s += line(650, y + 22, 690, y + 22); s += box(690, y, 200, 44, m[2], null, 'b2'); }
      if (m[3]) { s += line(890, y + 22, 920, y + 22); s += box(920, y, 170, 44, m[3], null, 'b2'); }
    });
    return s + '</svg>';
  }
  function miniMenu(role, title) {
    return `<div class="mini-side"><h4>${title}</h4><div class="r">${esc(ROLES[role].name)}</div>${menuFor(role).filter(m => !m.sec).map(m => `<div class="it ${['audit', 'users', 'policy'].includes(m.id) ? 'sec' : ''}">${ic(m.icon, 'sm')} ${m.label}</div>`).join('')}</div>`;
  }
  function pageAbout() {
    const forms = [
      ['Вход в систему', 'Логин, скрытый пароль, блокировка после 5 попыток с отсчётом времени', me ? null : '#/login'],
      ['Главное окно с меню по роли', 'Меню строится по матрице прав; 8 ролей', '#/dashboard'],
      ['Список объектов (поиск и фильтр)', 'Договоры, проекты, сотрудники, оборудование', '#/contracts'],
      ['Карточка объекта (маскирование ПДн)', 'Паспорт ****1234, СНИЛС, телефон, e-mail', '#/employees/e17'],
      ['Отчёт / печатная форма с грифом', '«Коммерческая тайна», «Конфиденциально», водяной знак', '#/reports'],
      ['Журнал действий пользователей', 'Только администратор безопасности', '#/audit']
    ];
    const check = [
      ['Аутентификация перед доступом к данным', 'Да — экран «Вход в систему»; без сеанса все разделы недоступны; пароли хранятся только в виде хэша SHA-256 с солью', 'Серверная аутентификация, хэширование Argon2id/bcrypt, передача по TLS ≥ 1.2 (ТБ-1, ТБ-5)'],
      ['Блокировка после неуспешных попыток входа', 'Да — 5 попыток → блокировка на 15 мин с отсчётом; событие в журнале; разблокировка администратором ИБ («Учётные записи»)', 'Счётчик попыток в БД на сервере, задержка ответа, уведомление администратора ИБ, ограничение по IP'],
      ['Меню и функции зависят от роли', 'Да — 8 ролей (ТБ-3), меню и кнопки по матрице прав; прямой переход по адресу → «Доступ запрещён» + запись в журнал', 'Проверка прав на сервере при каждом запросе; роли и RLS в PostgreSQL (ПЗ № 6)'],
      ['Маскирование персональных данных', 'Да — карточка сотрудника: паспорт **** **3456, СНИЛС, телефон, e-mail, дата рождения; раскрытие только кадровику с основанием на 30 с', 'Маскирование на стороне сервера/СУБД (представления), ПДн не передаются клиенту без права'],
      ['Проверка корректности вводимых данных', 'Да — формы договора, проекта, сотрудника: обязательные поля, форматы (номер, дата, паспорт, СНИЛС, телефон), списки вместо ручного ввода, экранирование вывода', 'Повторная серверная валидация, параметризованные запросы, CSP (ТБ-4)'],
      ['Подтверждение удаления и других опасных действий', 'Да — удаление договора/сотрудника (ввод номера/фамилии), снятие маски, разблокировка, смена роли, экспорт журнала, изменение политики', 'Дополнительно — повторная аутентификация для критичных операций'],
      ['Журнал действий пользователей', 'Да — «Журнал событий» (только Адм. ИБ): входы, отказы, блокировки, изменения со старым/новым значением, печать отчётов', 'Append-only журнал на сервере, синхронизация времени, хранение ≥ 6 мес., передача в SIEM (ТБ-6)'],
      ['Автоматическое завершение сеанса при бездействии', 'Да — тайм-аут 10 мин (настраивается), предупреждение за 60 с, индикатор в шапке', 'Серверное время жизни сессии, инвалидация токена']
    ];
    const accounts = db.users.map(u => `<tr><td class="mono t-main">${esc(u.login)}</td><td>${roleChip(u.role)}</td><td class="small">${esc({
      secadmin: 'Журнал событий, разблокировка, политика безопасности', sysadmin: 'Учётные записи и роли (без журнала)', pm: 'Договоры, проекты, назначение оборудования, субподряд',
      head: 'Сотрудники своего отдела (ПДн маскированы), передача оборудования', hr: 'Сотрудники, раскрытие ПДн, отделы, кадровые отчёты', buh: 'Стоимостные показатели, отчёты',
      spec: 'Свои проекты, справочник сотрудников без ПДн', guest: 'Только общие сведения о проектах'
    }[u.role])}</td></tr>`).join('');
    const content = head('О прототипе ИС «ПроектОрг»', 'Практическое занятие № 5, задание 2: макеты экранных форм с элементами защиты. Работающий макет на синтетических данных.',
      `<button class="btn danger-ghost" data-act="reset-db">${ic('refresh', 'sm')} Сбросить демо-данные</button>`) +
      `<div class="stack">
      <div class="card"><div class="card-head"><h3>${ic('layers')} Экранные формы макета</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>№</th><th>Форма</th><th>Элементы защиты</th><th></th></tr></thead><tbody>
        ${forms.map((f, i) => `<tr><td>${i + 1}</td><td class="t-main">${f[0]}</td><td class="small">${f[1]}</td><td>${f[2] ? `<a class="btn sm" href="${f[2]}">Открыть</a>` : '<span class="muted small">выйдите из системы</span>'}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>${ic('users')} Ролевое меню: вариант пользователя и вариант администратора</h3></div><div class="card-body"><div class="menu-compare">
        ${miniMenu('spec', 'Пользователь')}${miniMenu('pm', 'Руководитель проекта')}${miniMenu('secadmin', 'Администратор безопасности')}${miniMenu('sysadmin', 'Администратор системы')}</div></div></div>
      <div class="card"><div class="card-head"><h3>${ic('link')} Схема навигации между экранами</h3><span class="muted small">под модулем указаны роли, которым он доступен</span></div><div class="scheme-wrap">${navScheme()}</div></div>
      <div class="card"><div class="card-head"><h3>${ic('shieldCheck')} Чек-лист безопасности прототипа</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>№</th><th>Требование безопасности интерфейса</th><th>Реализовано в прототипе (да/нет, где)</th><th>Как будет реализовано в полной версии</th></tr></thead><tbody>
        ${check.map((c, i) => `<tr><td>${i + 1}</td><td class="t-main">${c[0]}</td><td class="small"><span class="check-yes">${c[1].slice(0, 2)}</span>${esc(c[1].slice(2))}</td><td class="small">${esc(c[2])}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>${ic('key')} Демо-учётные записи</h3><span class="muted small">пароль: <b class="mono">Proekt#Org2026</b></span></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Логин</th><th>Роль</th><th>Основные функции</th></tr></thead><tbody>${accounts}</tbody></table></div></div>
      ${alertBox('warn', '<b>Ограничения учебного макета.</b> Прототип работает в браузере без сервера: данные хранятся в localStorage, поэтому механизмы защиты демонстрируют поведение интерфейса. В полной версии проверки выполняются на сервере и в СУБД PostgreSQL. Все данные вымышлены (ст. 5 ФЗ № 152-ФЗ).')}
      </div>`;
    if (me) return content;
    return `<div class="page" style="margin:0 auto">${back('login', 'Ко входу в систему')}${content}</div>`;
  }

  /* ================= Служебные страницы ================= */
  function notFound(text = 'Страница не найдена') {
    return `<div class="denied"><div class="ico" style="background:var(--surface-3);color:var(--muted)">${ic('search', 'lg')}</div><h1>${esc(text)}</h1><p>Запрошенный объект отсутствует или был удалён.</p><a class="btn" href="#/dashboard">На главную</a></div>`;
  }
  function denied(section) {
    return `<div class="denied"><div class="ico">${ic('lock', 'lg')}</div><h1>Доступ запрещён</h1><p>Раздел «${esc(section)}» недоступен для роли «${esc(ROLES[me.role].name)}». Попытка доступа зарегистрирована в журнале событий.</p><a class="btn primary" href="#/dashboard">На главную</a></div>`;
  }

  /* ================= Маршрутизация ================= */
  const PAGES = {
    dashboard: { title: 'Главная', render: pageDashboard },
    contracts: { title: 'Договоры', perm: 'contracts.view', render: pageContracts, draw: drawContracts },
    contractCard: { title: 'Договоры', menu: 'contracts', perm: 'contracts.view', render: pageContractCard },
    contractForm: { title: 'Договоры', menu: 'contracts', perm: 'contracts.edit', render: pageContractForm, mount: mountContractForm },
    projects: { title: 'Проекты', perm: 'projects.view', render: pageProjects, draw: drawProjects },
    projectCard: { title: 'Проекты', menu: 'projects', perm: 'projects.view', render: pageProjectCard },
    projectForm: { title: 'Проекты', menu: 'projects', perm: 'projects.edit', render: pageProjectForm, mount: mountProjectForm },
    employees: { title: 'Сотрудники', perm: 'employees.view', render: pageEmployees, draw: drawEmployees },
    employeeCard: { title: 'Сотрудники', menu: 'employees', perm: 'employees.view', render: pageEmployeeCard, guard: ({ id }) => !emp(id) || empVisible(emp(id)) },
    employeeForm: { title: 'Сотрудники', menu: 'employees', perm: 'employees.edit', render: pageEmployeeForm, mount: mountEmployeeForm },
    equipment: { title: 'Оборудование', perm: 'equipment.view', render: pageEquipment, draw: drawEquipment },
    subcontractors: { title: 'Субподрядчики', perm: 'subs.view', render: pageSubs, draw: drawSubs, key: 'subworks' },
    departments: { title: 'Отделы', perm: 'departments.view', render: pageDepartments },
    reports: { title: 'Отчёты', perm: 'reports.view', render: pageReports, mount: mountReports },
    audit: { title: 'Журнал событий', perm: 'audit.view', render: pageAudit, draw: drawAudit },
    users: { title: 'Учётные записи', perm: 'users.view', render: pageUsers },
    policy: { title: 'Политика безопасности', perm: 'policy.edit', render: pagePolicy, mount: mountPolicy },
    about: { title: 'О прототипе', render: pageAbout, public: true },
    login: { public: true }
  };
  function resolve() {
    const seg = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const [a, b, c] = seg;
    const entity = { contracts: 'contract', projects: 'project', employees: 'employee' }[a];
    if (entity && b) return b === 'new' ? { page: entity + 'Form' } : c === 'edit' ? { page: entity + 'Form', id: b } : { page: entity + 'Card', id: b };
    if (!a) return { page: me ? 'dashboard' : 'login' };
    return PAGES[a] ? { page: a } : { page: '404' };
  }
  let current = null;
  function render() {
    const r = resolve();
    const app = $('#app');
    $$('.dropdown').forEach(d => d.remove());
    if (!me && !(PAGES[r.page] && PAGES[r.page].public)) { if (location.hash !== '#/login') { location.hash = '#/login'; return; } r.page = 'login'; }
    if (me && r.page === 'login') { location.hash = '#/dashboard'; return; }
    if (r.page === 'login') { current = null; app.innerHTML = pageLogin(); mountLogin(); document.title = 'Вход · ИС «ПроектОрг»'; return; }
    if (!me) { current = null; app.innerHTML = pageAbout(); document.title = 'О прототипе · ИС «ПроектОрг»'; return; }
    const P = PAGES[r.page];
    current = P;
    if (!P) { app.innerHTML = shell('', crumb('Главная', 'Не найдено'), notFound()); return; }
    const active = P.menu || r.page;
    const crumbs = crumb(`<a href="#/dashboard">ПроектОрг</a>`, r.id && P.menu ? `<a href="#/${P.menu}">${P.title}</a>` : P.title, ...(r.id || r.page.endsWith('Form') ? [r.page.endsWith('Form') ? (r.id ? 'Редактирование' : 'Создание') : 'Карточка'] : []));
    let html;
    if ((P.perm && !can(P.perm)) || (P.guard && !P.guard(r))) {
      audit('ACCESS', 'Попытка доступа к разделу', `Раздел «${P.title}»${r.id ? ' (' + r.id + ')' : ''}`, `Недостаточно прав роли «${ROLES[me.role].name}»`, 'отказ');
      html = denied(P.title);
      app.innerHTML = shell(active, crumbs, html);
    } else {
      app.innerHTML = shell(active, crumbs, P.render(r));
      if (P.draw) bindFilters(P.key || r.page, P.draw);
      if (P.mount) P.mount(r);
    }
    document.title = (P.title || 'ИС') + ' · ИС «ПроектОрг»';
    window.scrollTo(0, 0);
    if (me.mustChange && !$('#pw-form')) changePassword(true);
  }
  function bindFilters(key, draw) {
    const box = $('#flt');
    if (box) box.addEventListener('input', e => {
      const t = e.target;
      if (!t.name) return;
      ui[key][t.name] = t.type === 'checkbox' ? t.checked : t.value;
      draw();
    });
    current.redraw = draw;
    draw();
  }
  function mountReports() {
    const f = $('#rep-form');
    f.onsubmit = e => {
      e.preventDefault();
      const st = ui.reports;
      const r = REPORTS.find(x => x.id === st.type);
      if (r.period && !validate(f, { from: V.date, to: (v, form) => V.date(v) || (v < form.from.value ? 'Дата окончания раньше даты начала' : '') })) return;
      if (f.from) { st.from = f.from.value; st.to = f.to.value; }
      st.status = f.status ? f.status.value : '';
      st.built = true;
      audit('REPORT', 'Формирование отчёта', `Отчёт «${r.name}»`, r.period ? `Период ${fdate(st.from)}–${fdate(st.to)}` : '');
      $('#rep-out').innerHTML = buildReport(r, st);
    };
  }

  /* ================= Обработчики действий ================= */
  const ACTIONS = {
    nav() { $('#layout').classList.toggle('nav-open'); },
    theme() {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next; ls.set(THEME, next);
      $$('[data-act="theme"]').forEach(b => { b.innerHTML = ic(next === 'dark' ? 'sun' : 'moon'); });
    },
    usermenu(el) {
      const old = $('.dropdown');
      if (old) { old.remove(); return; }
      el.parentElement.insertAdjacentHTML('beforeend', `<div class="dropdown"><div class="dd-head"><b>${esc(me.fio)}</b><div class="muted small mono">${esc(me.login)}</div><div style="margin-top:6px">${roleChip(me.role)}</div></div>
        <button data-act="pw">${ic('key', 'sm')} Сменить пароль</button><button data-act="about">${ic('info', 'sm')} О прототипе</button><button class="danger" data-act="logout">${ic('logout', 'sm')} Выйти</button></div>`);
    },
    pw() { changePassword(false); },
    about() { go('about'); },
    logout() { logout(); },
    'reset-flt'(el) {
      delete ui[el.dataset.key];
      render();
    },
    async 'del-contract'(el) {
      const c = contract(el.dataset.id);
      if (!await confirmAction({ title: 'Удаление договора', text: `Договор <b>${esc(c.number)}</b> и его связи с проектами будут удалены без возможности восстановления. Сведения о стоимости работ будут исключены из учёта.`, word: c.number, ok: 'Удалить договор' })) return;
      db.contracts = db.contracts.filter(x => x !== c);
      const sum = contractSum(c.id);
      db.links = db.links.filter(l => l.contractId !== c.id);
      audit('DATA', 'Удаление договора', 'Договор ' + c.number, `${cust(c.customerId).name}; сумма ${money(sum)}`);
      save(); toast('Договор удалён'); go('contracts');
    },
    async 'del-emp'(el) {
      const e = emp(el.dataset.id);
      const lead = db.projects.find(p => p.managerId === e.id) || db.contracts.find(c => c.managerId === e.id);
      if (lead || db.departments.some(d => d.head === e.id)) { toast('Удаление невозможно: сотрудник является руководителем договора, проекта или отдела', 'err'); audit('DATA', 'Удаление сотрудника', 'Сотрудник ' + short(e.fio), 'Отклонено: нарушение целостности связей', 'отказ'); return; }
      const surname = e.fio.split(' ')[0];
      if (!await confirmAction({ title: 'Удаление сотрудника', text: `Карточка <b>${esc(e.fio)}</b> и его персональные данные будут удалены. Сотрудник будет исключён из групп исполнителей проектов.`, word: surname, ok: 'Удалить' })) return;
      db.employees = db.employees.filter(x => x !== e);
      db.projects.forEach(p => { p.team = p.team.filter(id => id !== e.id); });
      audit('DATA', 'Удаление сотрудника', 'Сотрудник ' + short(e.fio), 'Персональные данные уничтожены');
      save(); toast('Сотрудник удалён'); go('employees');
    },
    async unmask(el) {
      const e = emp(el.dataset.id);
      const reason = await confirmAction({ title: 'Просмотр персональных данных', danger: false, ok: 'Показать на 30 с',
        text: `Будут показаны персональные данные сотрудника <b>${esc(e.fio)}</b>. Просмотр допускается только для выполнения служебных обязанностей и будет зарегистрирован в журнале.`,
        reasons: ['Оформление кадровых документов', 'Проверка данных по запросу сотрудника', 'Подготовка отчётности в СФР / ФНС', 'Оформление допуска к объекту заказчика'] });
      if (!reason) return;
      revealed[e.id] = Date.now() + 30000;
      audit('PD', 'Просмотр ПДн (снятие маски)', 'Сотрудник ' + short(e.fio), 'Поля: паспорт, СНИЛС, дата рождения, телефон, e-mail, адрес; основание: ' + reason);
      render();
    },
    'eq-card'(el) { equipmentCard(el.dataset.id); },
    'assign-eq'(el) { assignEquipment(el.dataset.id, null); },
    'eq-assign'(el) { assignEquipment(null, el.dataset.id); },
    async 'release-eq'(el) {
      const q = byId(db.equipment, el.dataset.id);
      if (!await confirmAction({ title: 'Освободить оборудование?', text: `${esc(q.inv)} «${esc(q.name)}» будет откреплено от проекта ${esc(proj(q.projectId).code)}.`, danger: false, ok: 'Освободить' })) return;
      const code = proj(q.projectId).code;
      q.projectId = null;
      audit('DATA', 'Освобождение оборудования', q.inv + ' ' + q.name, 'Откреплено от проекта ' + code);
      save(); toast('Оборудование освобождено'); render();
    },
    'eq-transfer'(el) {
      const q = byId(db.equipment, el.dataset.id);
      modal({
        title: 'Передача оборудования в другой отдел',
        body: `<p><b class="mono">${esc(q.inv)}</b> ${esc(q.name)}<br><span class="muted">Текущий отдел: ${esc(dept(q.deptId).name)}</span></p>
          <form id="tr-form" novalidate class="stack" style="margin-top:12px">${field('Отдел-получатель', `<select name="d">${options(db.departments.filter(d => d.id !== q.deptId).map(d => [d.id, d.name]), '', '— выберите отдел —')}</select>`, { req: true })}
          ${field('Основание', '<input name="note" maxlength="100" placeholder="Служебная записка № ...">', { req: true })}</form>`,
        foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" form="tr-form">Передать</button>`,
        onMount(m, close) {
          const f = $('#tr-form', m);
          f.onsubmit = ev => {
            ev.preventDefault();
            if (!validate(f, { d: v => V.req(v, 'Выберите отдел'), note: V.text(3, 100) })) return;
            const from = q.deptId;
            q.history.push({ date: iso(), from, to: f.d.value, note: f.note.value.trim() });
            q.deptId = f.d.value;
            audit('DATA', 'Передача оборудования в отдел', q.inv + ' ' + q.name, `${dept(from).name} → ${dept(q.deptId).name}`);
            save(); close(); toast('Оборудование передано'); render();
          };
        }
      });
    },
    'new-work'() { newWork(); },
    'set-head'(el) { setHead(el.dataset.id); },
    'rep-type'(el) { ui.reports.type = el.dataset.id; ui.reports.built = false; ui.reports.status = ''; render(); },
    'rep-print'() {
      const r = REPORTS.find(x => x.id === ui.reports.type);
      audit('REPORT', 'Печать отчёта', `Отчёт «${r.name}»`, 'Гриф: ' + GRIF[typeof r.grif === 'function' ? r.grif() : r.grif][0]);
      window.print();
    },
    async 'rep-csv'() {
      const r = REPORTS.find(x => x.id === ui.reports.type);
      if (!await confirmAction({ title: 'Экспорт отчёта', danger: false, ok: 'Экспортировать', text: `Файл будет содержать сведения ограниченного доступа (гриф «${GRIF[typeof r.grif === 'function' ? r.grif() : r.grif][0]}»). Храните его только на учтённых носителях.` })) return;
      const d = reportData(r, ui.reports);
      downloadCSV(`report_${r.id}_${iso()}.csv`, d.head, d.rows);
      audit('REPORT', 'Экспорт отчёта (CSV)', `Отчёт «${r.name}»`);
      toast('Файл сформирован');
    },
    async 'audit-csv'() {
      const reason = await confirmAction({ title: 'Экспорт журнала событий', danger: false, ok: 'Экспортировать', text: 'Журнал содержит служебную информацию. Экспорт регистрируется.', reasons: ['Расследование инцидента', 'Плановый анализ журналов', 'Запрос ответственного за обработку ПДн', 'Архивирование'] });
      if (!reason) return;
      const rows = filteredAudit();
      downloadCSV(`audit_${iso()}.csv`, ['Время', 'Пользователь', 'Роль', 'IP', 'Тип', 'Действие', 'Объект', 'Подробности', 'Результат'], rows.map(a => [fdt(a.ts), a.login, a.role, a.ip, TYPES[a.type], a.action, a.object, a.details, a.result]));
      audit('SEC', 'Экспорт журнала событий', 'Журнал событий', `Записей: ${rows.length}; основание: ${reason}`);
      toast('Журнал выгружен'); drawAudit();
    },
    async unlock(el) {
      const login = el.dataset.id;
      const reason = await confirmAction({ title: 'Разблокировать учётную запись?', danger: false, ok: 'Разблокировать', text: `Учётная запись <b class="mono">${esc(login)}</b> заблокирована после неуспешных попыток входа. Перед разблокировкой убедитесь, что попытки выполнял сам пользователь.`, reasons: ['Обращение пользователя, личность подтверждена', 'Ошибка ввода пароля пользователем', 'По результатам проверки инцидента'] });
      if (!reason) return;
      db.attempts[login] = { count: 0, lockedUntil: 0 };
      audit('SEC', 'Разблокировка учётной записи', 'Учётная запись ' + login, reason);
      save(); toast('Учётная запись разблокирована'); render();
    },
    'user-new'() { userForm(); },
    'user-role'(el) {
      const u = db.users.find(x => x.login === el.dataset.id);
      modal({
        title: 'Изменение роли пользователя',
        body: `<p><b class="mono">${esc(u.login)}</b> — ${esc(u.fio)}</p><form id="r-form" novalidate style="margin-top:12px">${field('Новая роль', `<select name="role">${options(Object.entries(ROLES).map(([k, v]) => [k, v.name]), u.role)}</select>`, { req: true, hint: 'Пользователю назначается одна роль' })}</form>`,
        foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" form="r-form">Далее</button>`,
        onMount(m, close) {
          $('#r-form', m).onsubmit = async ev => {
            ev.preventDefault();
            const role = ev.target.role.value;
            close();
            if (role === u.role) return;
            const reason = await confirmAction({ title: 'Подтвердите изменение роли', text: `Роль <b>${esc(ROLES[u.role].name)}</b> → <b>${esc(ROLES[role].name)}</b>. Права доступа пользователя изменятся при следующем переходе.`, reasons: ['Приказ о переводе', 'Изменение должностных обязанностей', 'Заявка руководителя подразделения'], ok: 'Изменить роль' });
            if (!reason) return;
            audit('ADMIN', 'Изменение роли пользователя', 'Учётная запись ' + u.login, `Роль: ${ROLES[u.role].name} → ${ROLES[role].name}; основание: ${reason}`);
            u.role = role; save(); toast('Роль изменена'); render();
          };
        }
      });
    },
    async 'user-reset'(el) {
      const u = db.users.find(x => x.login === el.dataset.id);
      if (!await confirmAction({ title: 'Сбросить пароль?', text: `Для <b class="mono">${esc(u.login)}</b> будет сформирован временный пароль. Текущий пароль перестанет действовать.`, word: u.login, ok: 'Сбросить' })) return;
      const tmp = tempPassword();
      u.hash = pwHash(u.login, tmp); u.mustChange = true; u.pwChanged = Date.now();
      audit('ADMIN', 'Сброс пароля', 'Учётная запись ' + u.login, 'Выдан временный пароль; требуется смена при входе');
      save(); showTemp(u.login, tmp); render();
    },
    async 'user-toggle'(el) {
      const u = db.users.find(x => x.login === el.dataset.id);
      if (!await confirmAction({ title: u.active ? 'Отключить учётную запись?' : 'Включить учётную запись?', text: u.active ? `Пользователь <b class="mono">${esc(u.login)}</b> не сможет войти в систему (например, при увольнении).` : `Пользователь <b class="mono">${esc(u.login)}</b> снова сможет войти в систему.`, danger: u.active, word: u.active ? u.login : null, ok: u.active ? 'Отключить' : 'Включить' })) return;
      u.active = !u.active;
      audit('ADMIN', u.active ? 'Включение учётной записи' : 'Отключение учётной записи', 'Учётная запись ' + u.login);
      save(); toast(u.active ? 'Учётная запись включена' : 'Учётная запись отключена'); render();
    },
    'pol-default'() { const f = $('#pol-form'); Object.entries({ maxAttempts: 5, lockMinutes: 15, idleMinutes: 10, minLength: 12, maxAgeDays: 90, retentionMonths: 6 }).forEach(([k, v]) => { f[k].value = v; }); },
    async 'reset-db'() {
      if (!await confirmAction({ title: 'Сбросить демо-данные?', text: 'Все изменения в этом браузере (договоры, сотрудники, журнал, пароли, блокировки) будут заменены исходными синтетическими данными.', word: 'СБРОС', ok: 'Сбросить' })) return;
      db = freshDb(); save();
      me = null; sess = null; saveSess();
      Object.keys(ui).forEach(k => delete ui[k]);
      toast('Демо-данные восстановлены');
      go('login');
    }
  };

  document.addEventListener('click', e => {
    const sortTh = e.target.closest('th[data-sort]');
    if (sortTh) {
      const key = sortTh.closest('table').dataset.tkey;
      if (key && ui[key]) {
        const k = sortTh.dataset.sort;
        ui[key].dir = ui[key].sort === k ? -ui[key].dir : 1;
        ui[key].sort = k;
        if (current && current.redraw) current.redraw();
      }
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act && ACTIONS[act.dataset.act] && !act.closest('#c-form')) {
      e.preventDefault();
      if (!act.closest('.dropdown') || act.dataset.act !== 'usermenu') $$('.dropdown').forEach(d => { if (act.dataset.act !== 'usermenu') d.remove(); });
      ACTIONS[act.dataset.act](act);
      return;
    }
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a, button')) { location.hash = row.dataset.href; return; }
    if (!e.target.closest('.user-menu')) $$('.dropdown').forEach(d => d.remove());
    if (e.target.closest('.nav a')) { const l = $('#layout'); if (l) l.classList.remove('nav-open'); }
    if (e.target.classList && e.target.classList.contains('layout')) e.target.classList.remove('nav-open');
  });

  /* ================= Запуск ================= */
  const savedTheme = ls.get(THEME);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  window.addEventListener('hashchange', render);
  window.addEventListener('storage', e => { if (e.key === STORE) { const d = loadDb(); if (d) db = d; } });
  render();
})();
