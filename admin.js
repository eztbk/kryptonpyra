/* ================================================================
   KryptonPyra — Admin Control Center
   admin.js
   ------------------------------------------------------------------
   يعمل هذا الملف بشكل مستقل تماماً عن script.js (صفحة المستخدم) ويقرأ
   ويكتب على نفس مفاتيح localStorage التي تستخدمها منصة المستخدم، بحيث
   تكون أي عملية إدارية (تعديل باقة تعدين، تغيير نسبة عمولة، تعديل رصيد...)
   لها تأثير فوري وحقيقي على تجربة المستخدم.

   لا توجد بيانات وهمية هنا: كل ما يُعرض في الجداول والإحصائيات يُقرأ من
   localStorage الفعلي للمشروع. الأقسام التي لا يوجد لها مصدر بيانات
   حقيقي بعد داخل script.js (مثل الحظر الفعلي لتسجيل الدخول، أو تعطيل
   نظام Squad كلياً) تُخزَّن هنا بشكل حقيقي وتعمل ضمن لوحة الإدارة، لكنها
   بحاجة لخطاف بسيط داخل script.js ليتم تفعيلها فعلياً على واجهة المستخدم
   (موضح كل مكان بتعليق «// [LIVE]» أو «// [STORED-ONLY]»).
   ================================================================ */

'use strict';

/* ============================================================
   SECTION 1: STORAGE KEYS
   ============================================================ */
const K = {
  USERS: 'krypton_users',
  CONFIG: 'krypton_pyra_config',
  DEPOSITS: 'krypton_deposits',
  WITHDRAWS: 'krypton_withdrawals',
  TRANSFERS_LEGACY: 'krypton_pending_transfers', // قديم/غير مستخدم فعلياً من واجهة المستخدم الحالية
  SESSION_USER: 'krypton_session',
  NEXT_ACCOUNT_ID: 'krypton_next_account_id',

  // مفاتيح النظام المالي الجديد (رسوم / محافظ الشركة / مجموعة عناوين الإيداع / الإيرادات)
  FEES: 'krypton_platform_fees',
  MAIN_WALLETS: 'krypton_main_wallets',
  DEPOSIT_POOL: 'krypton_deposit_pool',
  USED_DEPOSIT_POOL: 'krypton_used_deposit_pool',
  REVENUE: 'krypton_company_revenue',
  REVENUE_BREAKDOWN: 'krypton_revenue_breakdown',
  ANNOUNCEMENT: 'krypton_current_announcement',

  // مفاتيح خاصة بلوحة الإدارة فقط (بيانات حقيقية جديدة تخص الإدارة)
  ADMIN_ACCOUNTS: 'krypton_admin_accounts',
  ADMIN_SESSION: 'krypton_admin_session',
  ADMIN_ROLES: 'krypton_admin_roles',
  ADMIN_ACTIVITY: 'krypton_admin_activity_log',
  ADMIN_NOTIFICATIONS: 'krypton_admin_notifications_outbox',
  ADMIN_SUPPORT_NOTES: 'krypton_admin_support_notes',
  ADMIN_WALLET_NETWORKS: 'krypton_admin_wallet_networks',
  ADMIN_API_SETTINGS: 'krypton_admin_api_settings',
  ADMIN_VERIFY_NOTES: 'krypton_admin_verification_notes'
};

/* ============================================================
   SECTION 2: SAFE JSON STORAGE HELPERS
   ============================================================ */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null ? fallback : parsed;
  } catch (e) {
    console.warn('[Admin] تعذرت قراءة المفتاح', key, e);
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('[Admin] تعذرت الكتابة على المفتاح', key, e);
    toast('error', 'خطأ في الحفظ', 'تعذر حفظ البيانات محلياً.');
    return false;
  }
}

function getUsers() { return readJSON(K.USERS, []); }
function setUsers(v) { return writeJSON(K.USERS, v); }

function getDeposits() { return readJSON(K.DEPOSITS, []); }
function setDeposits(v) { return writeJSON(K.DEPOSITS, v); }

function getWithdraws() { return readJSON(K.WITHDRAWS, []); }
function setWithdraws(v) { return writeJSON(K.WITHDRAWS, v); }

function getFees() {
  return readJSON(K.FEES, { depositFee: 0.02, withdrawFee: 0.02, miningFee: 0.04, squadToWalletsShare: 0.01 });
}
function setFees(v) { return writeJSON(K.FEES, v); }

function getMainWallets() {
  let w = readJSON(K.MAIN_WALLETS, null);
  if (!w || !Array.isArray(w) || w.length !== 5) {
    const initialPasswords = ['9y5S4eJJxL%u$XFQ', 'Fe@LiC*q$iK#6qg5', 'QayPcPdtL#QpLvmb', 'erPvUL!pSt9QvHMM', 'N2eQCAU#e@D&fJrf'];
    w = [1, 2, 3, 4, 5].map(id => ({ id, address: '', password: initialPasswords[id - 1] }));
    setMainWallets(w);
  }
  return w;
}
function setMainWallets(v) { return writeJSON(K.MAIN_WALLETS, v); }

function getDepositPool() { return readJSON(K.DEPOSIT_POOL, []); }
function setDepositPool(v) { return writeJSON(K.DEPOSIT_POOL, v); }
function getUsedDepositPool() { return readJSON(K.USED_DEPOSIT_POOL, []); }

function getRevenue() {
  let r = readJSON(K.REVENUE, null);
  if (!r || !Array.isArray(r) || r.length !== 5) {
    r = [1, 2, 3, 4, 5].map(id => ({ walletId: id, totalBalance: 0 }));
    writeJSON(K.REVENUE, r);
  }
  return r;
}
function getRevenueBreakdown() {
  return readJSON(K.REVENUE_BREAKDOWN, { depositFees: 0, withdrawFees: 0, miningFees: 0, squadFees: 0 });
}
function addRevenueManually(amount, sourceType) {
  if (!amount || amount <= 0) return;
  const rev = getRevenue();
  const share = amount / 5;
  rev.forEach(w => { w.totalBalance = (num(w.totalBalance)) + share; });
  writeJSON(K.REVENUE, rev);
  const b = getRevenueBreakdown();
  if (sourceType === 'withdraw') b.withdrawFees += amount;
  writeJSON(K.REVENUE_BREAKDOWN, b);
}

function getAnnouncement() { return readJSON(K.ANNOUNCEMENT, null); }
function setAnnouncement(v) { return writeJSON(K.ANNOUNCEMENT, v); }

function getLegacyTransferQueue() { return readJSON(K.TRANSFERS_LEGACY, []); }
function setLegacyTransferQueue(v) { return writeJSON(K.TRANSFERS_LEGACY, v); }

function getAdminAccounts() { return readJSON(K.ADMIN_ACCOUNTS, []); }
function setAdminAccounts(v) { return writeJSON(K.ADMIN_ACCOUNTS, v); }

function getAdminRoles() { return readJSON(K.ADMIN_ROLES, []); }
function setAdminRoles(v) { return writeJSON(K.ADMIN_ROLES, v); }

function getActivityLog() { return readJSON(K.ADMIN_ACTIVITY, []); }
function setActivityLog(v) { return writeJSON(K.ADMIN_ACTIVITY, v); }

function getAdminNotifOutbox() { return readJSON(K.ADMIN_NOTIFICATIONS, []); }
function setAdminNotifOutbox(v) { return writeJSON(K.ADMIN_NOTIFICATIONS, v); }

function getSupportNotes() { return readJSON(K.ADMIN_SUPPORT_NOTES, []); }
function setSupportNotes(v) { return writeJSON(K.ADMIN_SUPPORT_NOTES, v); }

function getVerifyNotes() { return readJSON(K.ADMIN_VERIFY_NOTES, []); }
function setVerifyNotes(v) { return writeJSON(K.ADMIN_VERIFY_NOTES, v); }

function getApiSettings() {
  return readJSON(K.ADMIN_API_SETTINGS, { baseUrl: '', apiKey: '', backendConnected: false });
}
function setApiSettings(v) { return writeJSON(K.ADMIN_API_SETTINGS, v); }

/* ---- إعدادات شبكات المحافظ (عناوين الإيداع الحقيقية المستخدمة من صفحة المستخدم) ---- */
function getDefaultNetworks() {
  return [
    { id: 'tron', name: 'TRON', symbol: 'TRC20', icon: 'fa-brands fa-tron', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', enabled: true },
    { id: 'solana', name: 'Solana', symbol: 'SOL', icon: 'fa-solid fa-bolt', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', enabled: true },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ERC20', icon: 'fa-brands fa-ethereum', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', enabled: true },
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', icon: 'fa-brands fa-bitcoin', address: '', enabled: false },
    { id: 'bnb', name: 'BNB Chain', symbol: 'BEP20', icon: 'fa-solid fa-cubes', address: '', enabled: false },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', icon: 'fa-solid fa-diamond', address: '', enabled: false }
  ];
}
function getNetworks() {
  const stored = readJSON(K.ADMIN_WALLET_NETWORKS, null);
  if (!stored) { const d = getDefaultNetworks(); writeJSON(K.ADMIN_WALLET_NETWORKS, d); return d; }
  return stored;
}
function setNetworks(v) { return writeJSON(K.ADMIN_WALLET_NETWORKS, v); }

/* ============================================================
   SECTION 3: PLATFORM CONFIG (نفس المفتاح الذي تقرأه منصة المستخدم)
   ============================================================ */
function getDefaultConfig() {
  return {
    miningEnabled: true,
    miningStartHour: 18,
    miningStartMinute: 0,
    miningEndHour: 20,
    miningEndMinute: 0,
    miningDurationSeconds: 30,
    profitTiers: [
      { id: 'tier_1', minAmount: 20, maxAmount: 100, dailyProfitRate: 0.027, enabled: true },
      { id: 'tier_2', minAmount: 100, maxAmount: 500, dailyProfitRate: 0.030, enabled: true },
      { id: 'tier_3', minAmount: 500, maxAmount: 900, dailyProfitRate: 0.035, enabled: true },
      { id: 'tier_4', minAmount: 900, maxAmount: 1500, dailyProfitRate: 0.040, enabled: true },
      { id: 'tier_5', minAmount: 1500, maxAmount: 2500, dailyProfitRate: 0.045, enabled: true },
      { id: 'tier_6', minAmount: 2500, maxAmount: 5000, dailyProfitRate: 0.050, enabled: true },
      { id: 'tier_7', minAmount: 5000, maxAmount: 10000, dailyProfitRate: 0.055, enabled: true },
      { id: 'tier_8', minAmount: 10000, maxAmount: 15000, dailyProfitRate: 0.060, enabled: true },
      { id: 'tier_9', minAmount: 15000, maxAmount: 25000, dailyProfitRate: 0.065, enabled: true }
    ],
    referralCommissionRate: 0.05,
    serviceChargeRate: 0.04,
    // --- إعدادات إضافية أضافتها لوحة الإدارة (حقيقية ومخزّنة، سيتم توضيح حالة التفعيل الحي لكل منها في الواجهة) ---
    squadSystemEnabled: true,           // [STORED-ONLY] يحتاج قراءة من script.js ليمنع فعلياً
    transferDelayHours: 24,             // [STORED-ONLY] المهلة الحالية 24 ساعة مضبوطة داخل الكود
    maintenanceMode: false,             // [STORED-ONLY]
    siteName: 'KryptonPyra',
    siteCurrency: 'USDT',
    siteTimezone: 'Asia/Amman',
    siteLanguage: 'ar',
    depositFeeRate: 0,
    withdrawalFeeRate: 0,
    transferFeeRate: 0,
    minDeposit: 10,
    minWithdrawal: 10
  };
}
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
function getConfig() {
  const stored = readJSON(K.CONFIG, null);
  const defaults = getDefaultConfig();
  if (!stored) { writeJSON(K.CONFIG, defaults); return defaults; }
  return deepMerge(defaults, stored);
}
function setConfig(cfg) { return writeJSON(K.CONFIG, cfg); }

/* ============================================================
   SECTION 4: NUMBER / DATE HELPERS
   ============================================================ */
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function money(v) { return '$' + num(v).toFixed(2); }
function pct(v) { return (num(v) * 100).toFixed(2) + '%'; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('ar-JO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  const dd = Math.floor(h / 24);
  return `منذ ${dd} يوم`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function userDisplay(u) { return (u && (u.displayName || u.username)) || 'غير معروف'; }
function initialsOf(name) {
  const s = String(name || '؟').trim();
  return s.slice(0, 2).toUpperCase();
}

/* ============================================================
   SECTION 5: ACTIVITY LOG (سجل حقيقي لكل ما يفعله المشرف)
   ============================================================ */
function logActivity(action, details) {
  const log = getActivityLog();
  log.unshift({
    id: uid(),
    admin: (currentAdmin && currentAdmin.username) || 'admin',
    action,
    details: details || '',
    date: new Date().toISOString()
  });
  if (log.length > 500) log.length = 500;
  setActivityLog(log);
}

/* ============================================================
   SECTION 6: ADMIN ACCOUNTS / AUTH (نظام صلاحيات حقيقي خاص باللوحة)
   ============================================================ */
function ensureSeedAdmin() {
  let accounts = getAdminAccounts();
  if (!accounts.length) {
    accounts = [{
      id: uid(), username: 'admin', password: '123456', displayName: 'المدير العام',
      role: 'super_admin', active: true, createdAt: new Date().toISOString()
    }];
    setAdminAccounts(accounts);
  }
  let roles = getAdminRoles();
  if (!roles.length) {
    roles = [
      { id: 'super_admin', name: 'مدير عام', permissions: ['all'] },
      { id: 'moderator', name: 'مشرف محتوى', permissions: ['users.view', 'verification.manage', 'support.manage'] },
      { id: 'finance', name: 'مالية', permissions: ['deposits.manage', 'withdrawals.manage', 'transfers.manage', 'wallets.manage'] }
    ];
    setAdminRoles(roles);
  }
}

let currentAdmin = null;

function tryAdminLogin(username, password) {
  const accounts = getAdminAccounts();
  const acc = accounts.find(a => a.username === username.trim());
  if (!acc) return { success: false, message: '❌ اسم المستخدم غير موجود.' };
  if (!acc.active) return { success: false, message: '⛔ هذا الحساب موقوف.' };
  if (acc.password !== password) return { success: false, message: '❌ كلمة المرور غير صحيحة.' };
  currentAdmin = acc;
  writeJSON(K.ADMIN_SESSION, { id: acc.id, username: acc.username, loginAt: new Date().toISOString() });
  logActivity('تسجيل دخول', `دخول المشرف ${acc.username} إلى لوحة التحكم`);
  return { success: true };
}

function restoreAdminSession() {
  const s = readJSON(K.ADMIN_SESSION, null);
  if (!s) return false;
  const accounts = getAdminAccounts();
  const acc = accounts.find(a => a.id === s.id && a.active);
  if (!acc) return false;
  currentAdmin = acc;
  return true;
}

function adminLogout() {
  logActivity('تسجيل خروج', `خروج المشرف ${currentAdmin ? currentAdmin.username : ''}`);
  localStorage.removeItem(K.ADMIN_SESSION);
  currentAdmin = null;
  location.reload();
}

/* ============================================================
   SECTION 7: TOAST NOTIFICATIONS
   ============================================================ */
function toast(type, title, msg) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} tico"></i>
    <div class="tbody"><b>${esc(title)}</b><span>${esc(msg || '')}</span></div>
    <i class="fa-solid fa-xmark tclose"></i>`;
  el.querySelector('.tclose').addEventListener('click', () => removeToast(el));
  stack.appendChild(el);
  setTimeout(() => removeToast(el), 4500);
}
function removeToast(el) {
  if (!el || !el.parentNode) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 250);
}

/* ============================================================
   SECTION 8: MODAL SYSTEM
   ============================================================ */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('show');
}
function showDetailModal(title, icon, bodyHtml) {
  document.getElementById('genericDetailTitle').textContent = title;
  document.getElementById('genericDetailIcon').className = 'fa-solid ' + (icon || 'fa-circle-info');
  document.getElementById('genericDetailBody').innerHTML = bodyHtml;
  openModal('genericDetailModal');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    closeCtxMenu();
  }
});

/* ---- نافذة تأكيد عامة (Confirmation Dialog) ---- */
let confirmCallback = null;
function askConfirm({ title, message, okText, okClass, icon, onConfirm }) {
  document.getElementById('confirmTitle').textContent = title || 'تأكيد الإجراء';
  document.getElementById('confirmMessage').innerHTML = message || 'هل أنت متأكد؟';
  const okBtn = document.getElementById('confirmOkBtn');
  okBtn.textContent = okText || 'تأكيد';
  okBtn.className = 'btn ' + (okClass || 'btn-danger');
  const iconEl = document.getElementById('confirmIcon');
  iconEl.className = 'confirm-icon ' + (okClass === 'btn-success' ? 'ic-green' : okClass === 'btn-gold' ? 'ic-gold' : 'ic-red');
  iconEl.innerHTML = `<i class="fa-solid ${icon || 'fa-triangle-exclamation'}"></i>`;
  confirmCallback = onConfirm;
  openModal('confirmModal');
}
document.getElementById && document.addEventListener('DOMContentLoaded', () => {
  const okBtn = document.getElementById('confirmOkBtn');
  if (okBtn) okBtn.addEventListener('click', () => {
    closeModal('confirmModal');
    if (typeof confirmCallback === 'function') confirmCallback();
    confirmCallback = null;
  });
});

/* ============================================================
   SECTION 9: CONTEXT MENU (عام لأي جدول)
   ============================================================ */
let ctxCurrentItems = [];
function openCtxMenu(x, y, items) {
  const menu = document.getElementById('ctxMenu');
  menu.innerHTML = items.map(it => {
    if (it === '-') return '<div class="ctx-sep"></div>';
    return `<div class="ctx-item ${it.danger ? 'danger' : ''}" data-act="${it.act || ''}"><i class="fa-solid ${it.icon}"></i> ${esc(it.label)}</div>`;
  }).join('');
  ctxCurrentItems = items;
  menu.querySelectorAll('.ctx-item').forEach((el, i) => {
    const realItems = items.filter(it => it !== '-');
    el.addEventListener('click', () => {
      closeCtxMenu();
      const item = realItems[i] || realItems.find(r => r.act === el.dataset.act);
    });
  });
  // اربط كل عنصر مباشرة بدالته onClick عبر data attribute بديل: أبسط اعتماد closures
  let idx = 0;
  menu.querySelectorAll('.ctx-item').forEach((el) => {
    const it = items.filter(x2 => x2 !== '-')[idx++];
    el.onclick = () => { closeCtxMenu(); if (it && typeof it.onClick === 'function') it.onClick(); };
  });
  menu.style.top = Math.min(y, window.innerHeight - (items.length * 38 + 20)) + 'px';
  menu.style.left = Math.min(x, window.innerWidth - 210) + 'px';
  menu.classList.add('show');
}
function closeCtxMenu() {
  const menu = document.getElementById('ctxMenu');
  if (menu) menu.classList.remove('show');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.ctx-menu')) closeCtxMenu();
});

/* ============================================================
   SECTION 10: SKELETON LOADING (عند تبديل الصفحات)
   ============================================================ */
function skeletonRows(cols, rows = 5) {
  let html = '';
  for (let r = 0; r < rows; r++) {
    html += '<tr class="sk-row">';
    for (let c = 0; c < cols; c++) {
      const w = 40 + Math.floor(Math.random() * 50);
      html += `<td><div class="sk sk-line" style="width:${w}%"></div></td>`;
    }
    html += '</tr>';
  }
  return html;
}

/* ============================================================
   SECTION 11: GENERIC DATATABLE ENGINE
   ------------------------------------------------------------
   يستخدمه كل جدول في اللوحة: بحث + فلترة + فرز + Pagination + تحديد الكل
   ============================================================ */
const tableState = {}; // { tableId: { page, sortKey, sortDir, search, filters, pageSize, selected:Set } }

function initTableState(id, pageSize = 10) {
  if (!tableState[id]) {
    tableState[id] = { page: 1, sortKey: null, sortDir: 1, search: '', filters: {}, pageSize, selected: new Set() };
  }
  return tableState[id];
}

function applyTableQuery(id, data, searchFields) {
  const st = initTableState(id);
  let rows = data.slice();

  if (st.search && st.search.trim() !== '') {
    const q = st.search.trim().toLowerCase();
    rows = rows.filter(r => searchFields.some(f => String(getPath(r, f) ?? '').toLowerCase().includes(q)));
  }
  Object.keys(st.filters).forEach(fk => {
    const fv = st.filters[fk];
    if (fv && fv !== 'all') rows = rows.filter(r => String(getPath(r, fk)) === String(fv));
  });
  if (st.sortKey) {
    rows.sort((a, b) => {
      const av = getPath(a, st.sortKey), bv = getPath(b, st.sortKey);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * st.sortDir;
      return String(av ?? '').localeCompare(String(bv ?? ''), 'ar') * st.sortDir;
    });
  }
  return rows;
}
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function paginate(id, rows) {
  const st = initTableState(id);
  const totalPages = Math.max(1, Math.ceil(rows.length / st.pageSize));
  if (st.page > totalPages) st.page = totalPages;
  const start = (st.page - 1) * st.pageSize;
  return { pageRows: rows.slice(start, start + st.pageSize), totalPages, total: rows.length, start };
}
function renderPagination(id, totalPages, total, start, shown) {
  const st = initTableState(id);
  const box = document.getElementById(id + '_pagination');
  if (!box) return;
  let btns = '';
  const pagesToShow = new Set([1, totalPages, st.page, st.page - 1, st.page + 1]);
  let last = 0;
  for (let p = 1; p <= totalPages; p++) {
    if (!pagesToShow.has(p)) continue;
    if (p - last > 1) btns += `<button disabled>…</button>`;
    btns += `<button class="${p === st.page ? 'active' : ''}" onclick="gotoPage('${id}',${p})">${p}</button>`;
    last = p;
  }
  box.innerHTML = `
    <div class="info">عرض ${total === 0 ? 0 : start + 1}–${Math.min(start + shown, total)} من ${total}</div>
    <div class="page-btns">
      <button ${st.page <= 1 ? 'disabled' : ''} onclick="gotoPage('${id}',${st.page - 1})"><i class="fa-solid fa-chevron-right"></i></button>
      ${btns}
      <button ${st.page >= totalPages ? 'disabled' : ''} onclick="gotoPage('${id}',${st.page + 1})"><i class="fa-solid fa-chevron-left"></i></button>
    </div>`;
}
function gotoPage(id, p) {
  const st = initTableState(id);
  st.page = p;
  rerenderRegistry[id] && rerenderRegistry[id]();
}
function setSearch(id, val) { initTableState(id).search = val; initTableState(id).page = 1; rerenderRegistry[id] && rerenderRegistry[id](); }
function setFilter(id, key, val) { initTableState(id).filters[key] = val; initTableState(id).page = 1; rerenderRegistry[id] && rerenderRegistry[id](); }
function setSort(id, key) {
  const st = initTableState(id);
  if (st.sortKey === key) st.sortDir *= -1; else { st.sortKey = key; st.sortDir = 1; }
  rerenderRegistry[id] && rerenderRegistry[id]();
}
const rerenderRegistry = {};

/* ============================================================
   SECTION 12: NAVIGATION / ROUTER
   ============================================================ */
const PAGE_RENDERERS = {}; // pageId -> function to call when page becomes active

function goToPage(pageId) {
  document.querySelectorAll('.side-link').forEach(l => l.classList.toggle('active', l.dataset.page === pageId));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');
  const titleMap = PAGE_TITLES[pageId] || { title: pageId, sub: '' };
  document.getElementById('topbarTitle').textContent = titleMap.title;
  document.getElementById('topbarSub').textContent = titleMap.sub;
  closeSidebarMobile();
  if (typeof PAGE_RENDERERS[pageId] === 'function') PAGE_RENDERERS[pageId]();
  location.hash = pageId;
}
function closeSidebarMobile() {
  document.getElementById('sidebarPanel').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.side-link').forEach(link => {
    link.addEventListener('click', () => goToPage(link.dataset.page));
  });
  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.getElementById('sidebarPanel').classList.add('open');
    document.getElementById('sidebarBackdrop').classList.add('show');
  });
  document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebarMobile);
});

const PAGE_TITLES = {
  pageDashboard: { title: 'لوحة التحكم', sub: 'نظرة شاملة على أداء المنصة' },
  pageUsers: { title: 'إدارة المستخدمين', sub: 'كل حسابات المنصة وأرصدتها' },
  pageVerification: { title: 'طلبات التحقق', sub: 'مراجعة KYC للمستخدمين' },
  pageMining: { title: 'نظام التعدين', sub: 'التحكم الكامل بجدولة التعدين وباقات الربح' },
  pageDeposits: { title: 'الإيداعات', sub: 'طلبات إيداع الأموال' },
  pageWithdrawals: { title: 'السحوبات', sub: 'طلبات سحب الأموال' },
  pageTransfers: { title: 'التحويلات الداخلية', sub: 'محفظة ⇄ أسست ⇄ تعدين' },
  pageWallets: { title: 'المحافظ والشبكات', sub: 'عناوين الإيداع لكل شبكة' },
  pageAssets: { title: 'أرصدة Assets', sub: 'أرصدة الأسست لكل مستخدم' },
  pageSquads: { title: 'نظام Squad', sub: 'الفرق، الإحالات، والعمولات' },
  pageNotifications: { title: 'الإشعارات', sub: 'إرسال إشعارات للمستخدمين' },
  pageSettings: { title: 'الإعدادات العامة', sub: 'ضبط هوية وسياسات المنصة' },
  pageReports: { title: 'التقارير', sub: 'تقارير مالية وتشغيلية قابلة للتصدير' },
  pageStatistics: { title: 'الإحصائيات', sub: 'تحليل بياني متقدم' },
  pageLogs: { title: 'السجلات', sub: 'كل العمليات المسجلة في المنصة' },
  pageSupport: { title: 'الدعم الفني', sub: 'ملاحظات وتذاكر المستخدمين' },
  pageProfile: { title: 'حسابي الشخصي', sub: 'بيانات دخولك إلى اللوحة' },
  pageAdmins: { title: 'المشرفون', sub: 'إدارة حسابات فريق الإدارة' },
  pageRoles: { title: 'الأدوار الوظيفية', sub: 'تعريف أدوار فريق الإدارة' },
  pagePermissions: { title: 'الصلاحيات', sub: 'مصفوفة صلاحيات كل دور' },
  pageSecurity: { title: 'الأمان', sub: 'كلمة مرور اللوحة وسجل الدخول' },
  pageMaintenance: { title: 'وضع الصيانة', sub: 'إغلاق المنصة مؤقتاً عن المستخدمين' },
  pageApi: { title: 'إعدادات API', sub: 'تجهيز الربط مع الخادم الخلفي' },
  pageSystem: { title: 'معلومات النظام', sub: 'حالة التخزين والبيئة الحالية' },
  pageActivity: { title: 'سجل نشاط الإدارة', sub: 'كل إجراء قام به فريق الإدارة' },
  pageDatabase: { title: 'قاعدة البيانات', sub: 'نسخ احتياطي واستيراد/تصدير كامل البيانات' }
};

/* ============================================================
   SECTION 13: DASHBOARD
   ============================================================ */
let dashCharts = { main: null };
let dashRange = 'daily';

function computeDashboardData() {
  const users = getUsers();
  const deposits = getDeposits();
  const withdraws = getWithdraws();
  const pendingDeposits = deposits.filter(d => d.status === 'pending' || d.status === 'confirming');
  const pendingWithdraws = withdraws.filter(w => w.status === 'pending');
  const cfg = getConfig();

  let totalWallet = 0, totalMining = 0, totalAsset = 0, totalProfit = 0, totalFees = 0;
  let verified = 0, pendingV = 0, rejectedV = 0, banned = 0, squads = 0, miningSessions = 0;
  const allInvoices = [];
  const allProfits = [];

  users.forEach(u => {
    totalWallet += num(u.balance);
    totalMining += num(u.miningBalance);
    totalAsset += num(u.assetBalance);
    if (u.verificationStatus === 'verified') verified++;
    else if (u.verificationStatus === 'rejected') rejectedV++;
    else pendingV++;
    if (u.banned) banned++;
    if (users.some(m => m.referredBy === u.accountId)) squads++;
    (u.invoices || []).forEach(inv => { allInvoices.push({ ...inv, username: u.username, displayName: userDisplay(u) }); totalProfit += num(inv.netProfit); totalFees += num(inv.serviceCharge); miningSessions++; });
    (u.profitsHistory || []).forEach(p => allProfits.push({ ...p, username: u.username, displayName: userDisplay(u) }));
  });

  allInvoices.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    users, deposits, withdraws, pendingDeposits, pendingWithdraws, cfg,
    totalUsers: users.length, verified, pendingV, rejectedV, banned, squads, miningSessions,
    totalWallet, totalMining, totalAsset, totalProfit, totalFees,
    pendingDepositsSum: pendingDeposits.reduce((s, d) => s + num(d.amount), 0),
    pendingWithdrawsSum: pendingWithdraws.reduce((s, w) => s + num(w.amount), 0),
    allInvoices, allProfits
  };
}

function refreshLowPoolBadge() {
  const badge = document.getElementById('badgeLowPool');
  if (!badge) return;
  const count = getDepositPool().length;
  badge.style.display = count < 10 ? 'inline-flex' : 'none';
}

function renderDashboard() {
  refreshLowPoolBadge();
  const d = computeDashboardData();
  const grid = document.getElementById('dashStatsGrid');
  const cards = [
    { label: 'إجمالي المستخدمين', value: d.totalUsers, ic: 'ic-gold', icon: 'fa-users' },
    { label: 'حسابات موثّقة', value: d.verified, ic: 'ic-green', icon: 'fa-shield-check' },
    { label: 'طلبات تحقق معلقة', value: d.pendingV, ic: 'ic-orange', icon: 'fa-id-card-clip' },
    { label: 'حسابات مرفوضة', value: d.rejectedV, ic: 'ic-red', icon: 'fa-user-xmark' },
    { label: 'حسابات محظورة', value: d.banned, ic: 'ic-red', icon: 'fa-ban' },
    { label: 'عدد السكوادات النشطة', value: d.squads, ic: 'ic-purple', icon: 'fa-users-rectangle' },
    { label: 'جلسات تعدين مكتملة', value: d.miningSessions, ic: 'ic-blue', icon: 'fa-hammer' },
    { label: 'إيداعات معلقة', value: d.pendingDeposits.length, ic: 'ic-green', icon: 'fa-arrow-down' },
    { label: 'سحوبات معلقة', value: d.pendingWithdraws.length, ic: 'ic-red', icon: 'fa-arrow-up' },
    { label: 'إجمالي رصيد المحافظ', value: money(d.totalWallet), ic: 'ic-gold', icon: 'fa-wallet' },
    { label: 'إجمالي رصيد التعدين', value: money(d.totalMining), ic: 'ic-gold', icon: 'fa-coins' },
    { label: 'إجمالي رصيد Assets', value: money(d.totalAsset), ic: 'ic-gold', icon: 'fa-cubes' },
    { label: 'إجمالي الأرباح الموزعة', value: money(d.totalProfit), ic: 'ic-green', icon: 'fa-chart-line' },
    { label: 'إجمالي رسوم المنصة', value: money(d.totalFees), ic: 'ic-blue', icon: 'fa-percent' }
  ];
  grid.innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="top"><div class="ic ${c.ic}"><i class="fa-solid ${c.icon}"></i></div></div>
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>`).join('');

  renderList('dashRecentRegs', d.users.slice(-6).reverse().map(u => ({
    title: userDisplay(u), sub: u.email || u.username, tag: u.accountId
  })), 'fa-user-plus');

  renderList('dashRecentMining', d.allInvoices.slice(0, 6).map(inv => ({
    title: `${userDisplay({ displayName: inv.displayName })} — ${inv.coinName || ''}`,
    sub: fmtDate(inv.timestamp), tag: money(inv.netProfit)
  })), 'fa-hammer');

  renderList('dashRecentDeposits', d.deposits.slice(0, 6).map(x => {
    const u = d.users.find(y => y.username === x.userId);
    return { title: u ? userDisplay(u) : x.userId, sub: depositStatusText(x.status), tag: money(x.amount) };
  }), 'fa-arrow-down');

  renderList('dashRecentWithdraws', d.withdraws.slice(0, 6).map(x => {
    const u = d.users.find(y => y.username === x.userId);
    return { title: u ? userDisplay(u) : x.userId, sub: withdrawStatusText(x.status), tag: money(x.amount) };
  }), 'fa-arrow-up');

  renderList('dashRecentVerify', d.users.filter(u => u.verificationStatus === 'pending').slice(0, 6).map(u => ({
    title: userDisplay(u), sub: 'بانتظار المراجعة', tag: u.accountId
  })), 'fa-id-card');

  renderList('dashRecentActivity', getActivityLog().slice(0, 6).map(a => ({
    title: a.action, sub: a.details, tag: timeAgo(a.date)
  })), 'fa-clock-rotate-left');

  renderDashboardChart(d);
}

function renderList(containerId, items, icon) {
  const box = document.getElementById(containerId);
  if (!box) return;
  if (!items.length) { box.innerHTML = `<div class="empty-state" style="padding:24px 10px;"><i class="fa-solid ${icon}"></i><p>لا توجد بيانات بعد</p></div>`; return; }
  box.innerHTML = items.map(it => `
    <div class="tl-item">
      <div class="tl-dot"><i class="fa-solid ${icon}"></i></div>
      <div class="tl-body" style="flex:1;">
        <b>${esc(it.title)}</b>
        <span>${esc(it.sub)}</span>
      </div>
      <div class="cell-gold" style="font-size:.78rem;font-weight:800;">${esc(it.tag)}</div>
    </div>`).join('');
}

function setDashRange(range) {
  dashRange = range;
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.toggle('active', t.dataset.range === range));
  renderDashboardChart(computeDashboardData());
}

function renderDashboardChart(d) {
  const ctx = document.getElementById('dashChart');
  if (!ctx || typeof Chart === 'undefined') return;
  const buckets = buildTimeBuckets(d.allInvoices, dashRange, inv => inv.timestamp, inv => num(inv.netProfit));
  if (dashCharts.main) dashCharts.main.destroy();
  dashCharts.main = new Chart(ctx, {
    type: 'line',
    data: {
      labels: buckets.labels,
      datasets: [{
        label: 'الأرباح الموزعة (USDT)',
        data: buckets.values,
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(251,191,36,.12)',
        fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: '#fbbf24'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#a8b3cc' } } },
      scales: {
        x: { ticks: { color: '#6b7690' }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: '#6b7690' }, grid: { color: 'rgba(255,255,255,.04)' } }
      }
    }
  });
}

function buildTimeBuckets(items, range, getDate, getValue) {
  const now = new Date();
  const buckets = [];
  let count, fmt, stepMs;
  if (range === 'daily') { count = 7; stepMs = 86400000; fmt = d => d.toLocaleDateString('ar-JO', { weekday: 'short' }); }
  else if (range === 'weekly') { count = 8; stepMs = 7 * 86400000; fmt = d => 'أسبوع ' + d.toLocaleDateString('ar-JO', { day: '2-digit', month: '2-digit' }); }
  else if (range === 'monthly') { count = 6; stepMs = 30 * 86400000; fmt = d => d.toLocaleDateString('ar-JO', { month: 'short' }); }
  else { count = 5; stepMs = 365 * 86400000; fmt = d => d.getFullYear(); }

  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(now.getTime() - i * stepMs);
    buckets.push({ label: fmt(end), start: now.getTime() - (i + 1) * stepMs, end: now.getTime() - i * stepMs, value: 0 });
  }
  items.forEach(it => {
    const t = new Date(getDate(it)).getTime();
    if (isNaN(t)) return;
    const b = buckets.find(bb => t > bb.start && t <= bb.end);
    if (b) b.value += getValue(it);
  });
  return { labels: buckets.map(b => b.label), values: buckets.map(b => Math.round(b.value * 100) / 100) };
}
PAGE_RENDERERS.pageDashboard = renderDashboard;

/* ============================================================
   SECTION 14: USERS PAGE
   ============================================================ */
function renderUsersPage() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = skeletonRows(7, 6);
  setTimeout(() => renderUsersTable(), 180);
  document.getElementById('usersFilterStatus').onchange = e => setFilter('usersTbl', 'verificationStatus', e.target.value);
  document.getElementById('usersSearchInput').oninput = e => setSearch('usersTbl', e.target.value);
}
rerenderRegistry.usersTbl = renderUsersTable;

function renderUsersTable() {
  const users = getUsers();
  const st = initTableState('usersTbl', 10);
  let rows = applyTableQuery('usersTbl', users, ['username', 'displayName', 'email', 'accountId']);
  const { pageRows, totalPages, total, start } = paginate('usersTbl', rows);
  const tbody = document.getElementById('usersTableBody');

  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><i class="fa-solid fa-users big-ic"></i>لا يوجد مستخدمون مطابقون.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(u => {
      const statusBadge = u.verificationStatus === 'verified' ? '<span class="badge badge-green">موثّق</span>'
        : u.verificationStatus === 'rejected' ? '<span class="badge badge-red">مرفوض</span>'
        : '<span class="badge badge-gold">معلّق</span>';
      const bannedBadge = u.banned ? '<span class="badge badge-red">محظور</span>' : (u.disabled ? '<span class="badge badge-gray">موقوف</span>' : '<span class="badge badge-green">نشط</span>');
      return `
      <tr>
        <td class="chk-col"><input type="checkbox" class="row-chk" data-uname="${esc(u.username)}" onchange="toggleUserSelect('${esc(u.username)}',this.checked)"></td>
        <td>
          <div class="user-cell">
            <div class="av">${esc(initialsOf(userDisplay(u)))}</div>
            <div class="meta"><b>${esc(userDisplay(u))}</b><span>${esc(u.accountId || '')}</span></div>
          </div>
        </td>
        <td class="cell-muted">${esc(u.email || '—')}</td>
        <td class="cell-gold">${money(u.balance)}</td>
        <td class="cell-gold">${money(u.miningBalance)}</td>
        <td class="cell-gold">${money(u.assetBalance)}</td>
        <td>${statusBadge} ${bannedBadge}</td>
        <td>
          <div class="action-cell">
            <button class="btn btn-xs btn-info" onclick="openUserView('${esc(u.username)}')"><i class="fa-solid fa-eye"></i></button>
            <button class="btn btn-xs btn-gold" onclick="openUserEdit('${esc(u.username)}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-xs btn-ghost" onclick="openUserMoreMenu(event,'${esc(u.username)}')"><i class="fa-solid fa-ellipsis-vertical"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }
  renderPagination('usersTbl', totalPages, total, start, pageRows.length);
  document.getElementById('usersCountLabel').textContent = `${users.length} مستخدم`;
  updateBulkBar('usersTbl', 'usersBulkBar');
}

function toggleUserSelect(username, checked) {
  const st = initTableState('usersTbl');
  if (checked) st.selected.add(username); else st.selected.delete(username);
  updateBulkBar('usersTbl', 'usersBulkBar');
}
function toggleSelectAllUsers(checked) {
  document.querySelectorAll('#usersTableBody .row-chk').forEach(chk => { chk.checked = checked; toggleUserSelect(chk.dataset.uname, checked); });
}
function updateBulkBar(tblId, barId) {
  const st = initTableState(tblId);
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.classList.toggle('show', st.selected.size > 0);
  const countEl = bar.querySelector('.sel-count');
  if (countEl) countEl.textContent = st.selected.size;
}
function bulkUserAction(action) {
  const st = initTableState('usersTbl');
  if (!st.selected.size) return;
  const names = Array.from(st.selected);
  const actionsMap = {
    ban: { field: 'banned', value: true, label: 'حظر' },
    unban: { field: 'banned', value: false, label: 'رفع الحظر عن' },
    disable: { field: 'disabled', value: true, label: 'إيقاف' },
    enable: { field: 'disabled', value: false, label: 'تفعيل' },
    delete: { label: 'حذف' }
  };
  const conf = actionsMap[action];
  askConfirm({
    title: `${conf.label} ${names.length} مستخدم`,
    message: `سيتم ${conf.label} <b>${names.length}</b> حساب محدد. هل تريد المتابعة؟`,
    okText: 'تأكيد', okClass: action === 'delete' || action === 'ban' ? 'btn-danger' : 'btn-success',
    icon: action === 'delete' ? 'fa-trash' : 'fa-ban',
    onConfirm: () => {
      let users = getUsers();
      if (action === 'delete') {
        users = users.filter(u => !names.includes(u.username));
      } else {
        users.forEach(u => { if (names.includes(u.username)) u[conf.field] = conf.value; });
      }
      setUsers(users);
      logActivity(`إجراء جماعي: ${conf.label}`, `${names.length} مستخدم`);
      st.selected.clear();
      toast('success', 'تم التنفيذ', `${conf.label} ${names.length} حساب بنجاح.`);
      renderUsersTable();
    }
  });
}

function openUserMoreMenu(e, username) {
  e.stopPropagation();
  const u = getUsers().find(x => x.username === username);
  if (!u) return;
  const rect = e.target.closest('button').getBoundingClientRect();
  openCtxMenu(rect.left, rect.bottom + 6, [
    { label: 'إعادة تعيين كلمة المرور', icon: 'fa-key', onClick: () => resetUserPassword(username) },
    { label: 'إعادة تعيين OTP', icon: 'fa-rotate', onClick: () => resetUserOtp(username) },
    { label: 'تصفير رصيد التعدين', icon: 'fa-hammer', onClick: () => resetUserMining(username) },
    { label: 'إعادة التحقق للمعلّق', icon: 'fa-id-card', onClick: () => resetUserVerification(username) },
    '-',
    { label: u.banned ? 'رفع الحظر' : 'حظر المستخدم', icon: 'fa-ban', onClick: () => toggleBan(username) },
    { label: u.disabled ? 'تفعيل الحساب' : 'إيقاف الحساب', icon: 'fa-power-off', onClick: () => toggleDisabled(username) },
    { label: 'تسجيل خروج إجباري', icon: 'fa-right-from-bracket', onClick: () => forceLogout(username) },
    '-',
    { label: 'عرض السجل الكامل', icon: 'fa-clock-rotate-left', onClick: () => openUserView(username, 'history') },
    { label: 'شجرة الإحالة', icon: 'fa-sitemap', onClick: () => openUserView(username, 'squad') },
    '-',
    { label: 'حذف الحساب', icon: 'fa-trash', danger: true, onClick: () => deleteUser(username) }
  ]);
}

function mutateUser(username, fn, successMsg, activityLabel) {
  const users = getUsers();
  const u = users.find(x => x.username === username);
  if (!u) { toast('error', 'غير موجود', 'تعذر إيجاد المستخدم.'); return; }
  fn(u);
  setUsers(users);
  logActivity(activityLabel || 'تعديل مستخدم', userDisplay(u));
  toast('success', 'تم التحديث', successMsg || `تم تحديث حساب ${userDisplay(u)}.`);
  renderUsersTable();
  if (typeof PAGE_RENDERERS.pageDashboard === 'function' && document.getElementById('pageDashboard').classList.contains('active')) renderDashboard();
}

function resetUserPassword(username) {
  askConfirm({
    title: 'إعادة تعيين كلمة المرور', icon: 'fa-key', okClass: 'btn-gold',
    message: `سيتم تعيين كلمة مرور جديدة مؤقتة للمستخدم <b>${esc(username)}</b>.`,
    onConfirm: () => {
      const temp = Math.random().toString(36).slice(2, 8);
      mutateUser(username, u => u.password = temp, `كلمة المرور الجديدة: ${temp}`, 'إعادة تعيين كلمة مرور');
    }
  });
}
function resetUserOtp(username) {
  localStorage.removeItem('krypton_otp_' + username);
  logActivity('إعادة تعيين OTP', username);
  toast('success', 'تم', 'تم إلغاء رمز OTP الحالي لهذا الحساب.');
}
function resetUserMining(username) {
  askConfirm({
    title: 'تصفير رصيد التعدين', icon: 'fa-hammer',
    message: `سيتم تصفير رصيد التعدين بالكامل للمستخدم <b>${esc(username)}</b>. هذا الإجراء لا يمكن التراجع عنه.`,
    onConfirm: () => mutateUser(username, u => u.miningBalance = 0, 'تم تصفير رصيد التعدين.', 'تصفير رصيد تعدين')
  });
}
function resetUserVerification(username) {
  mutateUser(username, u => u.verificationStatus = 'pending', 'أعيدت حالة التحقق إلى معلّق.', 'إعادة فتح التحقق');
}
function toggleBan(username) {
  mutateUser(username, u => u.banned = !u.banned, 'تم تحديث حالة الحظر.', 'تبديل حالة الحظر');
}
function toggleDisabled(username) {
  mutateUser(username, u => u.disabled = !u.disabled, 'تم تحديث حالة التفعيل.', 'تبديل حالة التفعيل');
}
function forceLogout(username) {
  const session = readJSON(K.SESSION_USER, null);
  if (session && session.username === username) localStorage.removeItem(K.SESSION_USER);
  logActivity('تسجيل خروج إجباري', username);
  toast('success', 'تم', `سيتم تسجيل خروج ${username} إذا كانت الجلسة مفتوحة على هذا المتصفح.`);
}
function deleteUser(username) {
  askConfirm({
    title: 'حذف الحساب نهائياً', icon: 'fa-trash',
    message: `سيتم حذف حساب <b>${esc(username)}</b> وكل بياناته نهائياً. هذا الإجراء لا يمكن التراجع عنه.`,
    onConfirm: () => {
      let users = getUsers().filter(u => u.username !== username);
      setUsers(users);
      logActivity('حذف مستخدم', username);
      toast('success', 'تم الحذف', `تم حذف حساب ${username}.`);
      renderUsersTable(); renderDashboard();
    }
  });
}

/* ---- إضافة مستخدم جديد يدوياً ---- */
function openAddUserModal() { document.getElementById('addUserForm').reset(); openModal('addUserModal'); }
function submitAddUser() {
  const username = document.getElementById('newUserUsername').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value.trim();
  if (!username || !password) { toast('warn', 'بيانات ناقصة', 'اسم المستخدم وكلمة المرور مطلوبان.'); return; }
  const users = getUsers();
  if (users.some(u => u.username === username)) { toast('error', 'موجود مسبقاً', 'اسم المستخدم مستخدم مسبقاً.'); return; }
  let nextId = parseInt(localStorage.getItem(K.NEXT_ACCOUNT_ID) || '1');
  const accountId = 'A' + nextId;
  localStorage.setItem(K.NEXT_ACCOUNT_ID, (nextId + 1).toString());
  users.push({
    accountId, username, password, displayName: username, firstName: '', lastName: '', country: '', city: '',
    birthdate: '', phone: '', email, avatar: '', balance: 0, asset: 0, assetBalance: 0, miningBalance: 0,
    squadCode: accountId, invitedBy: null, referredBy: null, squadMembers: [], squadProfit: 0, invoices: [],
    profitsHistory: [], transferHistory: [], referralBalance: 0, referralEarningsHistory: [],
    verificationStatus: 'pending', profileCompleted: true
  });
  setUsers(users);
  logActivity('إنشاء مستخدم يدوياً', username);
  closeModal('addUserModal');
  toast('success', 'تمت الإضافة', `تم إنشاء حساب ${username}.`);
  renderUsersTable(); renderDashboard();
}

/* ---- تعديل بيانات أساسية ---- */
function openUserEdit(username) {
  const u = getUsers().find(x => x.username === username);
  if (!u) return;
  document.getElementById('editUserOriginalUsername').value = username;
  document.getElementById('editUserDisplayName').value = u.displayName || '';
  document.getElementById('editUserEmail').value = u.email || '';
  document.getElementById('editUserUsername').value = u.username || '';
  document.getElementById('editUserWallet').value = num(u.balance);
  document.getElementById('editUserMining').value = num(u.miningBalance);
  document.getElementById('editUserAsset').value = num(u.assetBalance);
  document.getElementById('editUserSquadBalance').value = num(u.referralBalance);
  openModal('editUserModal');
}
function submitUserEdit() {
  const original = document.getElementById('editUserOriginalUsername').value;
  const users = getUsers();
  const u = users.find(x => x.username === original);
  if (!u) return;
  const newUsername = document.getElementById('editUserUsername').value.trim();
  if (newUsername !== u.username && users.some(x => x.username === newUsername)) {
    toast('error', 'اسم مستخدم مكرر', 'يوجد مستخدم آخر بهذا الاسم.'); return;
  }
  u.displayName = document.getElementById('editUserDisplayName').value.trim() || u.username;
  u.email = document.getElementById('editUserEmail').value.trim();
  u.username = newUsername || u.username;
  u.balance = num(document.getElementById('editUserWallet').value);
  u.miningBalance = num(document.getElementById('editUserMining').value);
  u.assetBalance = num(document.getElementById('editUserAsset').value);
  u.referralBalance = num(document.getElementById('editUserSquadBalance').value);
  setUsers(users);
  logActivity('تعديل بيانات مستخدم', newUsername);
  closeModal('editUserModal');
  toast('success', 'تم الحفظ', 'تم تحديث بيانات المستخدم.');
  renderUsersTable(); renderDashboard();
}

/* ---- إضافة/خصم رصيد سريع ---- */
function openBalanceAdjust(username) {
  document.getElementById('balanceAdjustUsername').value = username;
  document.getElementById('balanceAdjustAmount').value = '';
  openModal('balanceAdjustModal');
}
function submitBalanceAdjust(direction) {
  const username = document.getElementById('balanceAdjustUsername').value;
  const type = document.getElementById('balanceAdjustType').value;
  const amount = num(document.getElementById('balanceAdjustAmount').value);
  if (amount <= 0) { toast('warn', 'قيمة غير صالحة', 'أدخل مبلغاً أكبر من صفر.'); return; }
  const fieldMap = { wallet: 'balance', mining: 'miningBalance', asset: 'assetBalance', squad: 'referralBalance' };
  const field = fieldMap[type];
  mutateUser(username, u => {
    const current = num(u[field]);
    u[field] = direction === 'add' ? current + amount : Math.max(0, current - amount);
  }, `${direction === 'add' ? 'تمت إضافة' : 'تم خصم'} ${money(amount)}.`, `${direction === 'add' ? 'إضافة' : 'خصم'} رصيد`);
  closeModal('balanceAdjustModal');
}

/* ---- عرض شامل للمستخدم (Tabs) ---- */
function openUserView(username, tab) {
  const u = getUsers().find(x => x.username === username);
  if (!u) return;
  document.getElementById('userViewTitle').textContent = userDisplay(u);
  document.getElementById('userViewSubtitle').textContent = `${u.accountId || ''} · ${u.email || ''}`;
  document.getElementById('userViewAvatar').textContent = initialsOf(userDisplay(u));

  document.getElementById('uvOverview').innerHTML = `
    <div class="grid-2">
      <div class="form-group"><label>اسم المستخدم</label><div class="form-control" style="opacity:.8;">${esc(u.username)}</div></div>
      <div class="form-group"><label>الاسم المعروض</label><div class="form-control" style="opacity:.8;">${esc(u.displayName || '—')}</div></div>
      <div class="form-group"><label>البريد الإلكتروني</label><div class="form-control" style="opacity:.8;">${esc(u.email || '—')}</div></div>
      <div class="form-group"><label>تحقق البريد</label><div class="form-control" style="opacity:.9;">${u.emailVerified ? '<span style="color:#22c55e;">✅ موثّق</span>' : '<span style="color:#f59e0b;">⚠️ غير موثّق</span>'}</div></div>
      <div class="form-group"><label>رقم الحساب</label><div class="form-control" style="opacity:.8;">${esc(u.accountId || '—')}</div></div>
      <div class="form-group"><label>الدولة / المدينة</label><div class="form-control" style="opacity:.8;">${esc(u.country || '—')} / ${esc(u.city || '—')}</div></div>
      <div class="form-group"><label>الهاتف</label><div class="form-control" style="opacity:.8;">${esc(u.phone || '—')}</div></div>
    </div>
    <div class="grid-3" style="margin-top:6px;">
      <div class="stat-card"><div class="label">المحفظة</div><div class="value">${money(u.balance)}</div></div>
      <div class="stat-card"><div class="label">التعدين</div><div class="value">${money(u.miningBalance)}</div></div>
      <div class="stat-card"><div class="label">الأسست</div><div class="value">${money(u.assetBalance)}</div></div>
    </div>`;

  const allHist = [
    ...(u.transferHistory || []).map(h => ({ kind: 'تحويل', label: `${h.from} ← ${h.to}`, amount: h.amount, date: h.created_at, status: h.status })),
    ...(u.invoices || []).map(h => ({ kind: 'فاتورة تعدين', label: h.coinName || h.coin, amount: h.netProfit, date: h.timestamp, status: 'مكتمل' })),
    ...(u.profitsHistory || []).map(h => ({ kind: 'ربح', label: h.type, amount: h.amount, date: h.timestamp, status: 'مكتمل' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById('uvHistory').innerHTML = allHist.length ? `
    <div class="table-wrap"><table class="dt"><thead><tr><th>النوع</th><th>التفاصيل</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th></tr></thead>
    <tbody>${allHist.slice(0, 40).map(h => `<tr><td>${esc(h.kind)}</td><td>${esc(h.label)}</td><td class="cell-gold">${money(h.amount)}</td><td class="cell-muted">${fmtDate(h.date)}</td><td>${esc(h.status)}</td></tr>`).join('')}</tbody></table></div>
  ` : `<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i><p>لا يوجد سجل عمليات بعد لهذا المستخدم.</p></div>`;

  const users = getUsers();
  const members = users.filter(m => m.referredBy === u.accountId);
  document.getElementById('uvSquad').innerHTML = `
    <div class="grid-2">
      <div class="stat-card"><div class="label">رمز الدعوة الخاص به</div><div class="value" style="font-size:1.1rem;">${esc(u.squadCode || u.accountId || '—')}</div></div>
      <div class="stat-card"><div class="label">رصيد أرباح السكواد</div><div class="value">${money(u.referralBalance)}</div></div>
    </div>
    <h4 style="margin:16px 0 8px;color:var(--text-2);font-size:.85rem;">أعضاء الفريق (${members.length})</h4>
    ${members.length ? `<div class="table-wrap"><table class="dt"><thead><tr><th>العضو</th><th>البريد</th><th>حالة التحقق</th></tr></thead>
      <tbody>${members.map(m => `<tr><td>${esc(userDisplay(m))}</td><td class="cell-muted">${esc(m.email || '—')}</td><td>${m.verificationStatus === 'verified' ? '<span class="badge badge-green">موثّق</span>' : '<span class="badge badge-gold">معلّق</span>'}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty-state" style="padding:24px;"><i class="fa-solid fa-user-group"></i><p>لا يوجد أعضاء في هذا السكواد بعد.</p></div>`}`;

  document.getElementById('uvKyc').innerHTML = u.identityImage
    ? `<div class="img-viewer"><img src="${u.identityImage}" onclick="this.classList.toggle('zoomed')"></div>
       <div class="grid-2" style="margin-top:14px;">
         <div class="form-group"><label>تاريخ الميلاد</label><div class="form-control" style="opacity:.8">${esc(u.birthdate || '—')}</div></div>
         <div class="form-group"><label>الدولة</label><div class="form-control" style="opacity:.8">${esc(u.country || '—')}</div></div>
       </div>`
    : `<div class="empty-state"><i class="fa-solid fa-id-card"></i><p>لم يقم هذا المستخدم برفع وثيقة تحقق بعد.</p></div>`;

  currentUserViewUsername = username;
  renderUserNotesTab(username);

  document.querySelectorAll('#userViewModal .subtab').forEach(t => t.classList.toggle('active', t.dataset.tab === (tab || 'overview')));
  document.querySelectorAll('#userViewModal .subpage').forEach(p => p.classList.toggle('active', p.id === 'uv' + capitalize(tab || 'overview')));
  openModal('userViewModal');
}
function switchUserViewTab(tab) {
  document.querySelectorAll('#userViewModal .subtab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('#userViewModal .subpage').forEach(p => p.classList.toggle('active', p.id === 'uv' + capitalize(tab)));
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

let currentUserViewUsername = null;
function renderUserNotesTab(username) {
  const notes = getSupportNotes().filter(n => n.username === username);
  document.getElementById('uvNotes').innerHTML = `
    <div class="form-group">
      <label>إضافة ملاحظة إدارية</label>
      <textarea class="form-control" id="newUserNoteText" placeholder="اكتب ملاحظة داخلية عن هذا الحساب..."></textarea>
      <button class="btn btn-gold btn-sm" style="margin-top:8px;" onclick="addUserNote()"><i class="fa-solid fa-plus"></i> إضافة</button>
    </div>
    <div class="timeline">${notes.length ? notes.map(n => `
      <div class="tl-item"><div class="tl-dot"><i class="fa-solid fa-note-sticky"></i></div>
      <div class="tl-body"><b>${esc(n.text)}</b><span>${esc(n.admin)} · ${fmtDate(n.date)}</span></div></div>`).join('') : '<div class="empty-state" style="padding:20px;"><i class="fa-solid fa-note-sticky"></i><p>لا توجد ملاحظات بعد.</p></div>'}</div>`;
}
function addUserNote() {
  const text = document.getElementById('newUserNoteText').value.trim();
  if (!text || !currentUserViewUsername) return;
  const notes = getSupportNotes();
  notes.unshift({ id: uid(), username: currentUserViewUsername, text, admin: (currentAdmin && currentAdmin.username) || 'admin', date: new Date().toISOString() });
  setSupportNotes(notes);
  logActivity('إضافة ملاحظة', currentUserViewUsername);
  renderUserNotesTab(currentUserViewUsername);
  toast('success', 'أُضيفت الملاحظة', '');
}
PAGE_RENDERERS.pageUsers = renderUsersPage;

/* ============================================================
   SECTION 15: VERIFICATION PAGE
   ============================================================ */
let verifyTab = 'pending';
function setVerifyTab(tab) {
  verifyTab = tab;
  document.querySelectorAll('#pageVerification .subtab').forEach(t => t.classList.toggle('active', t.dataset.vtab === tab));
  renderVerificationTable();
}
function renderVerificationPage() {
  document.getElementById('verifySearchInput').oninput = e => setSearch('verifyTbl', e.target.value);
  renderVerificationTable();
}
rerenderRegistry.verifyTbl = renderVerificationTable;

function renderVerificationTable() {
  const users = getUsers().filter(u => (u.verificationStatus || 'pending') === verifyTab);
  const rows = applyTableQuery('verifyTbl', users, ['username', 'displayName', 'email']);
  const { pageRows, totalPages, total, start } = paginate('verifyTbl', rows);
  const tbody = document.getElementById('verifyTableBody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><i class="fa-solid fa-id-card big-ic"></i>لا توجد طلبات في هذا التبويب.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(u => `
      <tr>
        <td><div class="user-cell"><div class="av">${esc(initialsOf(userDisplay(u)))}</div><div class="meta"><b>${esc(userDisplay(u))}</b><span>${esc(u.accountId || '')}</span></div></div></td>
        <td class="cell-muted">${esc(u.country || '—')}</td>
        <td class="cell-muted">${u.identityImage ? '<span class="badge badge-blue">مرفوعة</span>' : '<span class="badge badge-gray">غير مرفوعة</span>'}</td>
        <td>${verifyBadge(u.verificationStatus)}</td>
        <td>
          <div class="action-cell">
            <button class="btn btn-xs btn-info" onclick="viewKycDoc('${esc(u.username)}')"><i class="fa-solid fa-eye"></i> عرض</button>
            ${verifyTab !== 'verified' ? `<button class="btn btn-xs btn-success" onclick="setVerification('${esc(u.username)}','verified')"><i class="fa-solid fa-check"></i></button>` : ''}
            ${verifyTab !== 'rejected' ? `<button class="btn btn-xs btn-danger" onclick="setVerification('${esc(u.username)}','rejected')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            ${verifyTab !== 'pending' ? `<button class="btn btn-xs btn-warn" onclick="setVerification('${esc(u.username)}','pending')"><i class="fa-solid fa-rotate-left"></i> إعادة الطلب</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  }
  renderPagination('verifyTbl', totalPages, total, start, pageRows.length);
}
function verifyBadge(s) {
  if (s === 'verified') return '<span class="badge badge-green">موثّق</span>';
  if (s === 'rejected') return '<span class="badge badge-red">مرفوض</span>';
  return '<span class="badge badge-gold">معلّق</span>';
}
function viewKycDoc(username) {
  const u = getUsers().find(x => x.username === username);
  if (!u) return;
  document.getElementById('kycDocUsername').textContent = userDisplay(u);
  document.getElementById('kycDocBody').innerHTML = u.identityImage
    ? `<div class="img-viewer"><img src="${u.identityImage}" onclick="this.classList.toggle('zoomed')"></div>`
    : `<div class="empty-state"><i class="fa-solid fa-file-circle-xmark"></i><p>لم يتم رفع أي وثيقة من هذا المستخدم.</p></div>`;
  document.getElementById('kycActionUsername').value = username;
  const notes = getVerifyNotes().filter(n => n.username === username);
  document.getElementById('kycNotesBox').innerHTML = notes.length ? notes.map(n => `<div class="tl-item"><div class="tl-dot"><i class="fa-solid fa-note-sticky"></i></div><div class="tl-body"><b>${esc(n.text)}</b><span>${esc(n.admin)} · ${fmtDate(n.date)}</span></div></div>`).join('') : '<span class="cell-muted" style="font-size:.78rem;">لا توجد ملاحظات.</span>';
  openModal('kycModal');
}
function addKycNote() {
  const username = document.getElementById('kycActionUsername').value;
  const text = document.getElementById('kycNoteInput').value.trim();
  if (!text) return;
  const notes = getVerifyNotes();
  notes.unshift({ id: uid(), username, text, admin: (currentAdmin && currentAdmin.username) || 'admin', date: new Date().toISOString() });
  setVerifyNotes(notes);
  document.getElementById('kycNoteInput').value = '';
  viewKycDoc(username);
}
function setVerification(username, status) {
  mutateUser(username, u => u.verificationStatus = status, `الحالة الجديدة: ${status === 'verified' ? 'موثّق' : status === 'rejected' ? 'مرفوض' : 'معلّق'}`, 'تحديث حالة التحقق');
  if (status === 'rejected' || status === 'verified') {
    const outbox = getAdminNotifOutbox();
    outbox.unshift({
      id: uid(),
      message: status === 'verified' ? '✅ تم توثيق حسابك بنجاح!' : '❌ تم رفض طلب التحقق من هويتك. يرجى مراجعة الملاحظات وإعادة رفع الوثيقة.',
      audience: 'user', target: username, date: new Date().toISOString()
    });
    setAdminNotifOutbox(outbox);
  }
  renderVerificationTable();
  closeModal('kycModal');
}

/* ============================================================
   SECTION 16: MINING PAGE (جدولة + باقات الربح — يعمل مباشرة Live)
   ============================================================ */
function to24Hour(h12, period) {
  h12 = parseInt(h12) || 12;
  if (period === 'AM') return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}
function to12Hour(h24) {
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h12, period };
}

function renderMiningPage() {
  const cfg = getConfig();
  document.getElementById('mineGlobalToggle').checked = cfg.miningEnabled !== false;
  document.getElementById('mineScheduleToggle').checked = cfg.miningScheduleEnabled === true;

  const totalSeconds = cfg.miningDurationSeconds || 30;
  document.getElementById('mineDurHours').value = Math.floor(totalSeconds / 3600);
  document.getElementById('mineDurMinutes').value = Math.floor((totalSeconds % 3600) / 60);
  document.getElementById('mineDurSeconds').value = totalSeconds % 60;

  const start = to12Hour(cfg.miningStartHour !== undefined ? cfg.miningStartHour : 16);
  const end = to12Hour(cfg.miningEndHour !== undefined ? cfg.miningEndHour : 18);
  document.getElementById('mineStartHour12').value = start.h12;
  document.getElementById('mineStartPeriod').value = start.period;
  document.getElementById('mineStartMinute').value = cfg.miningStartMinute || 0;
  document.getElementById('mineEndHour12').value = end.h12;
  document.getElementById('mineEndPeriod').value = end.period;
  document.getElementById('mineEndMinute').value = cfg.miningEndMinute || 0;

  renderTierCards();
  toggleMiningScheduleFields();
}
function toggleMiningScheduleFields() {
  const on = document.getElementById('mineScheduleToggle').checked;
  const fields = document.getElementById('mineScheduleFields');
  fields.style.opacity = on ? '1' : '.4';
  fields.style.pointerEvents = on ? 'auto' : 'none';
}
function activateMiningScheduleNow() {
  document.getElementById('mineScheduleToggle').checked = true;
  toggleMiningScheduleFields();
  saveMiningSchedule();
  toast('success', 'تم التفعيل الفوري', 'أصبح التعدين مسموحاً الآن فقط خلال الوقت المكتوب أعلاه (بتوقيت غرينيتش) لجميع المستخدمين.');
}
function saveMiningSchedule() {
  const cfg = getConfig();
  cfg.miningEnabled = document.getElementById('mineGlobalToggle').checked;
  cfg.miningScheduleEnabled = document.getElementById('mineScheduleToggle').checked;

  const startHour12 = parseInt(document.getElementById('mineStartHour12').value) || 12;
  const startMinute = parseInt(document.getElementById('mineStartMinute').value) || 0;
  const endHour12 = parseInt(document.getElementById('mineEndHour12').value) || 12;
  const endMinute = parseInt(document.getElementById('mineEndMinute').value) || 0;

  cfg.miningStartHour = to24Hour(startHour12, document.getElementById('mineStartPeriod').value);
  cfg.miningStartMinute = Math.min(59, Math.max(0, startMinute));
  cfg.miningEndHour = to24Hour(endHour12, document.getElementById('mineEndPeriod').value);
  cfg.miningEndMinute = Math.min(59, Math.max(0, endMinute));

  const dh = parseInt(document.getElementById('mineDurHours').value) || 0;
  const dm = parseInt(document.getElementById('mineDurMinutes').value) || 0;
  const ds = parseInt(document.getElementById('mineDurSeconds').value) || 0;
  cfg.miningDurationSeconds = Math.max(5, dh * 3600 + dm * 60 + ds);

  setConfig(cfg);
  logActivity('تحديث جدولة التعدين', cfg.miningScheduleEnabled
    ? `${cfg.miningStartHour}:${cfg.miningStartMinute} → ${cfg.miningEndHour}:${cfg.miningEndMinute} GMT، مدة ${cfg.miningDurationSeconds}ث`
    : `بدون قيد وقت (24 ساعة)، مدة ${cfg.miningDurationSeconds}ث`);
  toast('success', 'تم الحفظ', cfg.miningScheduleEnabled ? 'إعدادات وقت التعدين (بتوقيت غرينيتش) تعمل الآن مباشرة لجميع المستخدمين.' : 'التعدين متاح الآن على مدار 24 ساعة لجميع المستخدمين.');
}
function stopMiningForEveryone() {
  const cfg = getConfig();
  cfg.miningEnabled = false;
  setConfig(cfg);
  document.getElementById('mineGlobalToggle').checked = false;
  logActivity('إيقاف التعدين للجميع');
  toast('success', 'تم الإيقاف فوراً', 'تم إيقاف التعدين لجميع المستخدمين الآن.');
}
function startMiningForEveryone() {
  const cfg = getConfig();
  cfg.miningEnabled = true;
  setConfig(cfg);
  document.getElementById('mineGlobalToggle').checked = true;
  logActivity('تفعيل التعدين للجميع');
  toast('success', 'تم التفعيل فوراً', 'أصبح التعدين متاحاً لجميع المستخدمين الآن (ضمن الساعات المحددة إن وُجدت).');
}

function renderTierCards() {
  const cfg = getConfig();
  const box = document.getElementById('tiersGrid');
  if (!cfg.profitTiers.length) { box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-layer-group"></i><p>لا توجد باقات ربح بعد.</p></div>`; return; }
  box.innerHTML = cfg.profitTiers.map((t, i) => `
    <div class="tier-card ${t.enabled ? '' : 'disabled'}">
      <div class="tier-head"><b>${esc(t.id)}</b>${t.enabled ? '<span class="badge badge-green">مفعّلة</span>' : '<span class="badge badge-gray">معطّلة</span>'}</div>
      <div class="tier-row"><span>الحد الأدنى</span><b>${money(t.minAmount)}</b></div>
      <div class="tier-row"><span>الحد الأقصى</span><b>${t.maxAmount === null ? 'بلا حد' : money(t.maxAmount)}</b></div>
      <div class="tier-row"><span>نسبة الربح اليومي</span><b class="cell-gold">${pct(t.dailyProfitRate)}</b></div>
      <div class="tier-actions">
        <button class="btn btn-xs btn-gold" onclick="openTierEdit(${i})"><i class="fa-solid fa-pen"></i> تعديل</button>
        <button class="btn btn-xs ${t.enabled ? 'btn-warn' : 'btn-success'}" onclick="toggleTier(${i})"><i class="fa-solid ${t.enabled ? 'fa-pause' : 'fa-play'}"></i></button>
        <button class="btn btn-xs btn-danger" onclick="deleteTier(${i})"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}
function toggleTier(i) {
  const cfg = getConfig(); cfg.profitTiers[i].enabled = !cfg.profitTiers[i].enabled; setConfig(cfg);
  logActivity('تبديل حالة باقة ربح', cfg.profitTiers[i].id); renderTierCards();
}
function deleteTier(i) {
  const cfg = getConfig();
  askConfirm({
    title: 'حذف الباقة', icon: 'fa-trash',
    message: `سيتم حذف الباقة <b>${esc(cfg.profitTiers[i].id)}</b> نهائياً.`,
    onConfirm: () => { const c2 = getConfig(); const removed = c2.profitTiers.splice(i, 1); setConfig(c2); logActivity('حذف باقة ربح', removed[0] && removed[0].id); renderTierCards(); toast('success', 'تم الحذف', ''); }
  });
}
function openTierAdd() {
  document.getElementById('tierEditIndex').value = '-1';
  document.getElementById('tierIdInput').value = 'tier_' + (getConfig().profitTiers.length + 1);
  document.getElementById('tierMinInput').value = 0;
  document.getElementById('tierMaxInput').value = 100;
  document.getElementById('tierRateInput').value = 3;
  document.getElementById('tierEnabledInput').checked = true;
  openModal('tierModal');
}
function openTierEdit(i) {
  const t = getConfig().profitTiers[i];
  document.getElementById('tierEditIndex').value = i;
  document.getElementById('tierIdInput').value = t.id;
  document.getElementById('tierMinInput').value = t.minAmount;
  document.getElementById('tierMaxInput').value = t.maxAmount === null ? '' : t.maxAmount;
  document.getElementById('tierRateInput').value = (t.dailyProfitRate * 100);
  document.getElementById('tierEnabledInput').checked = t.enabled;
  openModal('tierModal');
}
function submitTier() {
  const i = parseInt(document.getElementById('tierEditIndex').value);
  const cfg = getConfig();
  const maxRaw = document.getElementById('tierMaxInput').value;
  const tier = {
    id: document.getElementById('tierIdInput').value.trim() || uid(),
    minAmount: num(document.getElementById('tierMinInput').value),
    maxAmount: maxRaw === '' ? null : num(maxRaw),
    dailyProfitRate: num(document.getElementById('tierRateInput').value) / 100,
    enabled: document.getElementById('tierEnabledInput').checked
  };
  if (i === -1) cfg.profitTiers.push(tier); else cfg.profitTiers[i] = tier;
  setConfig(cfg);
  logActivity(i === -1 ? 'إضافة باقة ربح' : 'تعديل باقة ربح', tier.id);
  closeModal('tierModal');
  renderTierCards();
  toast('success', 'تم الحفظ', 'الباقة تعمل الآن مباشرة على حساب أرباح التعدين لكل المستخدمين.');
}
PAGE_RENDERERS.pageVerification = renderVerificationPage;
PAGE_RENDERERS.pageMining = renderMiningPage;

/* ============================================================
   SECTION 17: DEPOSITS PAGE (طابور حقيقي krypton_pending_deposits)
   ============================================================ */
function renderDepositsPage() {
  document.getElementById('depositsSearchInput').oninput = e => setSearch('depositsTbl', e.target.value);
  renderDepositsTable();
}
rerenderRegistry.depositsTbl = renderDepositsTable;
function depositStatusText(status) {
  const map = { pending: 'بانتظار الإرسال', confirming: 'قيد التحقق', completed: 'مكتمل', failed: 'ملغى' };
  return map[status] || status || '—';
}
function withdrawStatusText(status) {
  const map = { pending: 'بانتظار الموافقة', completed: 'مكتمل', rejected: 'مرفوض' };
  return map[status] || status || '—';
}
function depositStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-warning">بانتظار الإرسال</span>',
    confirming: '<span class="badge badge-info">قيد التحقق من البلوكشين</span>',
    completed: '<span class="badge badge-success">مكتمل</span>',
    failed: '<span class="badge badge-danger">فشل/ملغى</span>'
  };
  return map[status] || `<span class="badge badge-muted">${esc(status || '—')}</span>`;
}
function renderDepositsTable() {
  const users = getUsers();
  const deposits = getDeposits().map((d, i) => {
    const u = users.find(x => x.username === d.userId);
    return { ...d, _i: i, displayName: u ? (u.displayName || u.username) : d.userId };
  });
  const rows = applyTableQuery('depositsTbl', deposits, ['userId', 'displayName', 'assignedAddress', 'txHash']);
  const { pageRows, totalPages, total, start } = paginate('depositsTbl', rows);
  const tbody = document.getElementById('depositsTableBody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7"><i class="fa-solid fa-arrow-down big-ic"></i>لا توجد طلبات إيداع حالياً.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(d => `
      <tr>
        <td>${esc(d.displayName)}</td>
        <td class="cell-green">${money(d.amount)}</td>
        <td class="cell-muted">${money(d.fee)}</td>
        <td class="cell-gold">${money(d.netAmount)}</td>
        <td class="cell-muted" style="font-size:.7rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(d.assignedAddress || '')}">${esc(d.assignedAddress || '—')}</td>
        <td>${depositStatusBadge(d.status)}</td>
        <td><div class="action-cell">
          <button class="btn btn-xs btn-info" onclick="viewDepositDetails(${d._i})"><i class="fa-solid fa-eye"></i> عرض</button>
          ${d.status === 'pending' || d.status === 'confirming' ? `<button class="btn btn-xs btn-danger" onclick="markDepositFailed(${d._i})"><i class="fa-solid fa-xmark"></i> إلغاء</button>` : ''}
        </div></td>
      </tr>`).join('');
  }
  renderPagination('depositsTbl', totalPages, total, start, pageRows.length);
  document.getElementById('depositsCountLabel').textContent = `${deposits.length} طلب`;
}
function viewDepositDetails(index) {
  const list = getDeposits(); const item = list[index]; if (!item) return;
  showDetailModal('تفاصيل الإيداع', 'fa-arrow-down', `
      <div class="detail-grid">
        <div class="detail-item"><label>المستخدم</label><div class="val">${esc(item.userId)}</div></div>
        <div class="detail-item"><label>الحالة</label><div class="val">${depositStatusBadge(item.status)}</div></div>
        <div class="detail-item"><label>المبلغ</label><div class="val gold">${money(item.amount)}</div></div>
        <div class="detail-item"><label>الرسوم (2%)</label><div class="val">${money(item.fee)}</div></div>
        <div class="detail-item"><label>الصافي المضاف</label><div class="val gold">${money(item.netAmount)}</div></div>
        <div class="detail-item"><label>العنوان المخصص</label><div class="val" style="font-size:.72rem;">${esc(item.assignedAddress || '—')}</div></div>
        <div class="detail-item full"><label>هاش المعاملة (Tx Hash)</label><div class="val" style="font-size:.7rem;word-break:break-all;">${esc(item.txHash || 'لم يتم التأكيد بعد')}</div></div>
        <div class="detail-item"><label>وقت الإنشاء</label><div class="val">${new Date(item.createdAt).toLocaleString()}</div></div>
        <div class="detail-item"><label>آخر تحديث</label><div class="val">${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}</div></div>
      </div>`);
}
function markDepositFailed(index) {
  const list = getDeposits(); const item = list[index]; if (!item) return;
  askConfirm({
    title: 'إلغاء طلب الإيداع', icon: 'fa-xmark',
    message: `سيتم إلغاء طلب إيداع <b>${money(item.amount)}</b> من <b>${esc(item.userId)}</b> وتحرير العنوان المخصص له.`,
    onConfirm: () => {
      item.status = 'failed';
      item.updatedAt = new Date().toISOString();
      setDeposits(list);
      const users = getUsers();
      const u = users.find(x => x.username === item.userId);
      if (u && u.pendingDeposit && u.pendingDeposit.depositId === item.id) { u.pendingDeposit = null; setUsers(users); }
      logActivity('إلغاء طلب إيداع', `${item.userId} — ${money(item.amount)}`);
      toast('success', 'تم الإلغاء', '');
      renderDepositsTable();
    }
  });
}

/* ============================================================
   SECTION 18: WITHDRAWALS PAGE
   ============================================================ */
function renderWithdrawalsPage() {
  document.getElementById('withdrawalsSearchInput').oninput = e => setSearch('withdrawTbl', e.target.value);
  renderWithdrawalsTable();
}
rerenderRegistry.withdrawTbl = renderWithdrawalsTable;
function withdrawStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-warning">بانتظار الموافقة</span>',
    completed: '<span class="badge badge-success">مكتمل</span>',
    rejected: '<span class="badge badge-danger">مرفوض</span>'
  };
  return map[status] || `<span class="badge badge-muted">${esc(status || '—')}</span>`;
}
function renderWithdrawalsTable() {
  const users = getUsers();
  const list = getWithdraws().map((w, i) => {
    const u = users.find(x => x.username === w.userId);
    return { ...w, _i: i, displayName: u ? (u.displayName || u.username) : w.userId };
  });
  const rows = applyTableQuery('withdrawTbl', list, ['userId', 'displayName', 'userWalletAddress']);
  const { pageRows, totalPages, total, start } = paginate('withdrawTbl', rows);
  const tbody = document.getElementById('withdrawTableBody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7"><i class="fa-solid fa-arrow-up big-ic"></i>لا توجد طلبات سحب حالياً.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(w => `
      <tr>
        <td>${esc(w.displayName)}</td>
        <td class="cell-red">${money(w.amount - w.fee)}</td>
        <td class="cell-muted">${money(w.fee)}</td>
        <td class="cell-muted" style="font-size:.72rem;white-space:nowrap;">${esc(w.network || 'USDT - TRC20')}</td>
        <td class="cell-muted" style="font-size:.7rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(w.userWalletAddress || '')}">${esc(w.userWalletAddress || '—')}</td>
        <td>${withdrawStatusBadge(w.status)}</td>
        <td><div class="action-cell">
          <button class="btn btn-xs btn-info" onclick="viewWithdrawDetails(${w._i})"><i class="fa-solid fa-eye"></i> عرض</button>
          ${w.status === 'pending' ? `
          <button class="btn btn-xs btn-success" onclick="approveWithdrawReq(${w._i})"><i class="fa-solid fa-check"></i> موافقة</button>
          <button class="btn btn-xs btn-danger" onclick="rejectWithdrawReq(${w._i})"><i class="fa-solid fa-xmark"></i> رفض</button>` : ''}
        </div></td>
      </tr>`).join('');
  }
  renderPagination('withdrawTbl', totalPages, total, start, pageRows.length);
  document.getElementById('withdrawCountLabel').textContent = `${list.length} طلب`;
}
function viewWithdrawDetails(index) {
  const list = getWithdraws(); const item = list[index]; if (!item) return;
  showDetailModal('تفاصيل طلب السحب', 'fa-arrow-up', `
      <div class="detail-grid">
        <div class="detail-item"><label>المستخدم</label><div class="val">${esc(item.userId)}</div></div>
        <div class="detail-item"><label>الحالة</label><div class="val">${withdrawStatusBadge(item.status)}</div></div>
        <div class="detail-item"><label>المبلغ المطلوب (إجمالي)</label><div class="val">${money(item.amount)}</div></div>
        <div class="detail-item"><label>الرسوم (2%)</label><div class="val">${money(item.fee)}</div></div>
        <div class="detail-item"><label>الصافي المستحق للمستخدم</label><div class="val gold">${money(item.amount - item.fee)}</div></div>
        <div class="detail-item"><label>الشبكة</label><div class="val">${esc(item.network || 'USDT - TRC20')}</div></div>
        <div class="detail-item full"><label>عنوان المحفظة</label><div class="val" style="font-size:.72rem;word-break:break-all;">${esc(item.userWalletAddress || '—')}</div></div>
        <div class="detail-item"><label>وقت الطلب</label><div class="val">${new Date(item.createdAt).toLocaleString()}</div></div>
      </div>`);
}
function approveWithdrawReq(index) {
  const list = getWithdraws(); const item = list[index]; if (!item) return;
  askConfirm({
    title: 'الموافقة على السحب', icon: 'fa-check', okClass: 'btn-success',
    message: `تأكيد إتمام تحويل <b>${money(item.amount)}</b> يدوياً إلى عنوان <b>${esc(item.userWalletAddress)}</b> لـ <b>${esc(item.userId)}</b>، ثم تعليم الطلب كمكتمل.`,
    onConfirm: () => {
      item.status = 'completed';
      item.updatedAt = new Date().toISOString();
      setWithdraws(list);
      addRevenueManually(item.fee, 'withdraw');
      const users = getUsers();
      const u = users.find(x => x.username === item.userId);
      if (u && u.withdrawHistory) {
        const h = u.withdrawHistory.find(x => x.id === item.id);
        if (h) h.status = 'completed';
        setUsers(users);
      }
      logActivity('الموافقة على سحب', `${item.userId} — ${money(item.amount)}`);
      toast('success', 'تمت الموافقة', 'تم تعليم الطلب كمكتمل وإضافة الرسوم لإيرادات الشركة.');
      renderWithdrawalsTable(); renderDashboard();
    }
  });
}
function rejectWithdrawReq(index) {
  const list = getWithdraws(); const item = list[index]; if (!item) return;
  askConfirm({
    title: 'رفض طلب السحب وإرجاع المبلغ', icon: 'fa-xmark',
    message: `سيتم إرجاع <b>${money(item.amount + item.fee)}</b> (المبلغ + الرسوم) إلى محفظة <b>${esc(item.userId)}</b>.`,
    onConfirm: () => {
      const users = getUsers();
      const u = users.find(x => x.username === item.userId);
      if (u) {
        u.balance = num(u.balance) + num(item.amount) + num(item.fee);
        if (u.withdrawHistory) {
          const h = u.withdrawHistory.find(x => x.id === item.id);
          if (h) h.status = 'rejected';
        }
        setUsers(users);
      }
      item.status = 'rejected';
      item.updatedAt = new Date().toISOString();
      setWithdraws(list);
      logActivity('رفض سحب وإرجاع المبلغ', `${item.userId} — ${money(item.amount + item.fee)}`);
      toast('success', 'تم الرفض', 'تم إرجاع المبلغ كاملاً (مع الرسوم) للمستخدم.'); renderWithdrawalsTable(); renderDashboard();
    }
  });
}

/* ============================================================
   SECTION 19: TRANSFERS PAGE (تجميع من transferHistory لكل مستخدم)
   ============================================================ */
let transferSubTab = 'all';
function setTransferSubTab(tab) { transferSubTab = tab; document.querySelectorAll('#pageTransfers .subtab').forEach(t => t.classList.toggle('active', t.dataset.ttab === tab)); renderTransfersTable(); }
function renderTransfersPage() {
  document.getElementById('transfersSearchInput').oninput = e => setSearch('transfersTbl', e.target.value);
  renderTransfersTable();
}
rerenderRegistry.transfersTbl = renderTransfersTable;
function getAllTransfers() {
  const users = getUsers();
  const all = [];
  users.forEach(u => (u.transferHistory || []).forEach(t => all.push({ ...t, username: u.username, displayName: userDisplay(u) })));
  all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return all;
}
function renderTransfersTable() {
  let all = getAllTransfers();
  if (transferSubTab !== 'all') all = all.filter(t => `${t.from}-${t.to}` === transferSubTab || t.status === transferSubTab);
  const rows = applyTableQuery('transfersTbl', all, ['username', 'displayName']);
  const { pageRows, totalPages, total, start } = paginate('transfersTbl', rows);
  const tbody = document.getElementById('transfersTableBody');
  const labelOf = k => ({ wallet: 'المحفظة', asset: 'الأسست', mining: 'التعدين' }[k] || k);
  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><i class="fa-solid fa-arrow-right-arrow-left big-ic"></i>لا توجد تحويلات مطابقة.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(t => {
      const statusBadge = t.status === 'completed' ? '<span class="badge badge-green">مكتمل</span>' : t.status === 'failed' ? '<span class="badge badge-red">فشل</span>' : '<span class="badge badge-gold">قيد المعالجة</span>';
      return `<tr>
        <td>${esc(t.displayName)}</td>
        <td>${labelOf(t.from)} ← ${labelOf(t.to)}</td>
        <td class="cell-gold">${money(t.amount)}</td>
        <td class="cell-muted">${fmtDate(t.created_at)}</td>
        <td>${statusBadge}</td>
        <td><div class="action-cell">
          ${t.status === 'pending' ? `<button class="btn btn-xs btn-success" onclick="forceCompleteTransfer('${esc(t.username)}','${t.id}')"><i class="fa-solid fa-forward"></i> إتمام الآن</button>
          <button class="btn btn-xs btn-danger" onclick="reverseTransfer('${esc(t.username)}','${t.id}')"><i class="fa-solid fa-rotate-left"></i> إرجاع</button>` : `<span class="cell-muted">—</span>`}
        </div></td>
      </tr>`;
    }).join('');
  }
  renderPagination('transfersTbl', totalPages, total, start, pageRows.length);
}
function findUserTransfer(username, id) {
  const users = getUsers();
  const u = users.find(x => x.username === username);
  if (!u) return null;
  const t = (u.transferHistory || []).find(x => x.id === id);
  return { users, u, t };
}
function forceCompleteTransfer(username, id) {
  const ctx = findUserTransfer(username, id); if (!ctx || !ctx.t) return;
  askConfirm({
    title: 'إتمام التحويل الآن', icon: 'fa-forward', okClass: 'btn-success',
    message: `سيتم إنهاء التحويل فوراً وإضافة <b>${money(ctx.t.amount)}</b> إلى الرصيد الهدف بدلاً من انتظار المهلة.`,
    onConfirm: () => {
      const map = { wallet: 'balance', asset: 'assetBalance', mining: 'miningBalance' };
      ctx.u[map[ctx.t.to]] = num(ctx.u[map[ctx.t.to]]) + num(ctx.t.amount);
      ctx.t.status = 'completed';
      setUsers(ctx.users);
      logActivity('إتمام تحويل يدوياً', `${username} — ${money(ctx.t.amount)}`);
      toast('success', 'تم الإتمام', ''); renderTransfersTable(); renderDashboard();
    }
  });
}
function reverseTransfer(username, id) {
  const ctx = findUserTransfer(username, id); if (!ctx || !ctx.t) return;
  askConfirm({
    title: 'إرجاع التحويل', icon: 'fa-rotate-left', okClass: 'btn-danger',
    message: `سيتم إلغاء التحويل وإرجاع <b>${money(ctx.t.amount)}</b> إلى الرصيد المصدر.`,
    onConfirm: () => {
      const map = { wallet: 'balance', asset: 'assetBalance', mining: 'miningBalance' };
      ctx.u[map[ctx.t.from]] = num(ctx.u[map[ctx.t.from]]) + num(ctx.t.amount);
      ctx.t.status = 'failed';
      setUsers(ctx.users);
      logActivity('إرجاع تحويل', `${username} — ${money(ctx.t.amount)}`);
      toast('success', 'تم الإرجاع', ''); renderTransfersTable(); renderDashboard();
    }
  });
}
PAGE_RENDERERS.pageDeposits = renderDepositsPage;
PAGE_RENDERERS.pageWithdrawals = renderWithdrawalsPage;
PAGE_RENDERERS.pageTransfers = renderTransfersPage;

/* ============================================================
   SECTION 20B: COMPANY WALLETS PAGE (محافظ الشركة + مجموعة الإيداع)
   ============================================================ */
function renderCompanyWalletsPage() {
  const wallets = getMainWallets();
  const grid = document.getElementById('mainWalletsGrid');
  grid.innerHTML = wallets.map((w, i) => `
    <div class="net-card">
      <div class="net-top"><div class="ic"><i class="fa-solid fa-wallet"></i></div><div style="flex:1;"><b>محفظة الشركة #${w.id}</b></div></div>
      <div class="form-group"><label>عنوان USDT-TRC20</label><input class="form-control" style="font-size:.75rem;" id="mw_addr_${i}" value="${esc(w.address || '')}" placeholder="TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"></div>
      <div class="form-group"><label>كلمة المرور</label><input class="form-control" style="font-size:.75rem;" id="mw_pass_${i}" value="${esc(w.password || '')}"></div>
    </div>`).join('');

  const usedPool = getUsedDepositPool().slice().reverse();
  const usedBody = document.getElementById('usedPoolTableBody');
  usedBody.innerHTML = usedPool.length ? usedPool.slice(0, 50).map(u => `
    <tr><td style="font-size:.72rem;">${esc(u.address)}</td><td>${esc(u.assignedTo || '—')}</td><td class="cell-muted">${fmtDate(u.assignedAt)}</td></tr>
  `).join('') : `<tr class="empty-row"><td colspan="3">لا توجد عناوين مستخدمة بعد.</td></tr>`;

  updatePoolAvailableLabel();
}
function updatePoolAvailableLabel() {
  const count = getDepositPool().length;
  document.getElementById('poolAvailableLabel').textContent = `المجموعة المتاحة: ${count} عنوان`;
  document.getElementById('depositPoolTextarea').value = getDepositPool().join('\n');
  const warn = document.getElementById('lowPoolWarning');
  if (warn) warn.style.display = count < 10 ? 'flex' : 'none';
  const badge = document.getElementById('badgeLowPool');
  if (badge) badge.style.display = count < 10 ? 'inline-flex' : 'none';
}
function saveMainWalletsForm() {
  const wallets = getMainWallets();
  wallets.forEach((w, i) => {
    w.address = (document.getElementById(`mw_addr_${i}`).value || '').trim();
    w.password = (document.getElementById(`mw_pass_${i}`).value || '').trim();
  });
  setMainWallets(wallets);
  logActivity('تحديث محافظ الشركة');
  toast('success', 'تم الحفظ', 'تم تحديث عناوين وكلمات مرور محافظ الشركة الخمس.');
}
function saveDepositPoolForm() {
  const raw = document.getElementById('depositPoolTextarea').value || '';
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  setDepositPool(lines);
  logActivity('تحديث مجموعة عناوين الإيداع', `${lines.length} عنوان`);
  toast('success', 'تم الحفظ', `تم حفظ ${lines.length} عنوان في المجموعة.`);
  updatePoolAvailableLabel();
}
PAGE_RENDERERS.pageCompanyWallets = renderCompanyWalletsPage;

/* ============================================================
   SECTION 20: WALLETS / NETWORKS PAGE
   ------------------------------------------------------------
   ملاحظة: script.js الحالي يقرأ عناوين الشبكات من متغيّر ثابت داخل
   الكود (networkAddresses) وليس من هذا التخزين. التعديل هنا [STORED-ONLY]
   إلى أن يُربط script.js بقراءة نفس المفتاح لاحقاً.
   ============================================================ */
function renderWalletsPage() {
  const nets = getNetworks();
  const box = document.getElementById('networksGrid');
  box.innerHTML = nets.map((n, i) => `
    <div class="net-card">
      <div class="net-top">
        <div class="ic"><i class="${n.icon}"></i></div>
        <div style="flex:1;"><b>${esc(n.name)}</b><div class="cell-muted" style="font-size:.7rem;">${esc(n.symbol)}</div></div>
        ${n.enabled ? '<span class="badge badge-green">مفعّلة</span>' : '<span class="badge badge-gray">معطّلة</span>'}
      </div>
      <div class="net-addr">${esc(n.address || 'لم يُحدد عنوان بعد')}</div>
      <div class="tier-actions">
        <button class="btn btn-xs btn-gold" onclick="openNetworkEdit(${i})"><i class="fa-solid fa-pen"></i> تعديل العنوان</button>
        <button class="btn btn-xs btn-ghost" onclick="copyNetworkAddr(${i})"><i class="fa-solid fa-copy"></i></button>
        <button class="btn btn-xs ${n.enabled ? 'btn-warn' : 'btn-success'}" onclick="toggleNetwork(${i})"><i class="fa-solid ${n.enabled ? 'fa-pause' : 'fa-play'}"></i></button>
      </div>
    </div>`).join('');
}
function toggleNetwork(i) { const n = getNetworks(); n[i].enabled = !n[i].enabled; setNetworks(n); logActivity('تبديل حالة شبكة محفظة', n[i].name); renderWalletsPage(); }
function copyNetworkAddr(i) {
  const n = getNetworks()[i];
  navigator.clipboard && navigator.clipboard.writeText(n.address || '').then(() => toast('success', 'تم النسخ', n.address || ''));
}
function openNetworkEdit(i) {
  const n = getNetworks()[i];
  document.getElementById('netEditIndex').value = i;
  document.getElementById('netEditName').textContent = n.name;
  document.getElementById('netAddressInput').value = n.address || '';
  openModal('networkModal');
}
function submitNetworkEdit() {
  const i = parseInt(document.getElementById('netEditIndex').value);
  const nets = getNetworks();
  nets[i].address = document.getElementById('netAddressInput').value.trim();
  setNetworks(nets);
  logActivity('تعديل عنوان شبكة', nets[i].name);
  closeModal('networkModal');
  renderWalletsPage();
  toast('success', 'تم الحفظ', 'تم تحديث عنوان الشبكة (تفعيل القراءة الفعلية من script.js يحتاج ربطاً لاحقاً).');
}

/* ============================================================
   SECTION 21: ASSETS PAGE (أرصدة Assets لكل مستخدم)
   ============================================================ */
function renderAssetsPage() {
  document.getElementById('assetsSearchInput').oninput = e => setSearch('assetsTbl', e.target.value);
  renderAssetsTable();
}
rerenderRegistry.assetsTbl = renderAssetsTable;
function renderAssetsTable() {
  const users = getUsers();
  const rows = applyTableQuery('assetsTbl', users, ['username', 'displayName']);
  const { pageRows, totalPages, total, start } = paginate('assetsTbl', rows);
  const tbody = document.getElementById('assetsTableBody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4"><i class="fa-solid fa-cubes big-ic"></i>لا يوجد مستخدمون.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(u => `
      <tr>
        <td><div class="user-cell"><div class="av">${esc(initialsOf(userDisplay(u)))}</div><div class="meta"><b>${esc(userDisplay(u))}</b><span>${esc(u.accountId || '')}</span></div></div></td>
        <td class="cell-gold">${money(u.assetBalance)}</td>
        <td class="cell-muted">${money(u.balance)}</td>
        <td><div class="action-cell"><button class="btn btn-xs btn-gold" onclick="openBalanceAdjust('${esc(u.username)}');document.getElementById('balanceAdjustType').value='asset';"><i class="fa-solid fa-pen"></i> تعديل</button></div></td>
      </tr>`).join('');
  }
  renderPagination('assetsTbl', totalPages, total, start, pageRows.length);
}

/* ============================================================
   SECTION 22: SQUADS PAGE
   ============================================================ */
function renderSquadsPage() {
  const cfg = getConfig();
  document.getElementById('squadSystemToggle').checked = cfg.squadSystemEnabled !== false;
  document.getElementById('squadGlobalRate').value = (cfg.referralCommissionRate * 100).toFixed(2);
  document.getElementById('squadsSearchInput').oninput = e => setSearch('squadsTbl', e.target.value);
  renderSquadsTable();
}
function saveSquadGlobalSettings() {
  const cfg = getConfig();
  cfg.squadSystemEnabled = document.getElementById('squadSystemToggle').checked;
  cfg.referralCommissionRate = num(document.getElementById('squadGlobalRate').value) / 100;
  setConfig(cfg);
  logActivity('تحديث إعدادات Squad العامة', `نسبة العمولة ${pct(cfg.referralCommissionRate)}`);
  toast('success', 'تم الحفظ', 'نسبة العمولة العامة تعمل الآن مباشرة. تعطيل النظام كلياً يحتاج ربطاً إضافياً في script.js.');
}
rerenderRegistry.squadsTbl = renderSquadsTable;
function renderSquadsTable() {
  const users = getUsers();
  const leaders = users.filter(u => users.some(m => m.referredBy === u.accountId));
  const rows = applyTableQuery('squadsTbl', leaders, ['username', 'displayName']);
  const { pageRows, totalPages, total, start } = paginate('squadsTbl', rows);
  const tbody = document.getElementById('squadsTableBody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><i class="fa-solid fa-users-rectangle big-ic"></i>لا توجد سكوادات نشطة بعد.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(u => {
      const members = users.filter(m => m.referredBy === u.accountId);
      return `<tr>
        <td><div class="user-cell"><div class="av">${esc(initialsOf(userDisplay(u)))}</div><div class="meta"><b>${esc(userDisplay(u))}</b><span>${esc(u.squadCode || u.accountId || '')}</span></div></div></td>
        <td>${members.length}</td>
        <td class="cell-gold">${money(u.referralBalance)}</td>
        <td>${u.squadDisabled ? '<span class="badge badge-gray">معطّل</span>' : '<span class="badge badge-green">نشط</span>'}</td>
        <td><div class="action-cell">
          <button class="btn btn-xs btn-info" onclick="openUserView('${esc(u.username)}','squad')"><i class="fa-solid fa-eye"></i> عرض</button>
          <button class="btn btn-xs btn-gold" onclick="openSquadRateEdit('${esc(u.username)}')"><i class="fa-solid fa-percent"></i> نسبة خاصة</button>
          <button class="btn btn-xs ${u.squadDisabled ? 'btn-success' : 'btn-warn'}" onclick="toggleSquad('${esc(u.username)}')"><i class="fa-solid ${u.squadDisabled ? 'fa-play' : 'fa-pause'}"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  }
  renderPagination('squadsTbl', totalPages, total, start, pageRows.length);
}
function toggleSquad(username) { mutateUser(username, u => u.squadDisabled = !u.squadDisabled, 'تم تحديث حالة السكواد.', 'تبديل حالة سكواد'); renderSquadsTable(); }
function openSquadRateEdit(username) {
  const u = getUsers().find(x => x.username === username);
  document.getElementById('squadRateUsername').value = username;
  document.getElementById('squadRateInput').value = u.customCommissionRate != null ? (u.customCommissionRate * 100) : '';
  openModal('squadRateModal');
}
function submitSquadRate() {
  const username = document.getElementById('squadRateUsername').value;
  const raw = document.getElementById('squadRateInput').value;
  mutateUser(username, u => { u.customCommissionRate = raw === '' ? null : num(raw) / 100; }, 'تم حفظ نسبة العمولة الخاصة.', 'تعديل نسبة عمولة سكواد خاصة');
  closeModal('squadRateModal');
  renderSquadsTable();
}
PAGE_RENDERERS.pageWallets = renderWalletsPage;
PAGE_RENDERERS.pageAssets = renderAssetsPage;
PAGE_RENDERERS.pageSquads = renderSquadsPage;

/* ============================================================
   SECTION 23: NOTIFICATIONS PAGE
   ------------------------------------------------------------
   [STORED-ONLY]: script.js لا يقرأ حالياً من هذا الصندوق لعرض إشعارات
   داخل واجهة المستخدم؛ الإرسال هنا حقيقي ومخزّن ويحتاج ربطاً بسيطاً
   داخل script.js ليظهر فعلياً كإشعار In-App لدى المستخدم.
   ============================================================ */
let notifAudience = 'all';
function setNotifAudience(a) {
  notifAudience = a;
  document.querySelectorAll('.audience-opt').forEach(el => el.classList.toggle('active', el.dataset.aud === a));
  document.getElementById('notifTargetWrap').style.display = a === 'all' ? 'none' : 'block';
}
function renderNotificationsPage() {
  const users = getUsers();
  document.getElementById('notifUserSelect').innerHTML = users.map(u => `<option value="${esc(u.username)}">${esc(userDisplay(u))} (${esc(u.accountId || '')})</option>`).join('');
  const leaders = users.filter(u => users.some(m => m.referredBy === u.accountId));
  document.getElementById('notifSquadSelect').innerHTML = leaders.map(u => `<option value="${esc(u.accountId)}">${esc(userDisplay(u))} — سكواد ${esc(u.squadCode || u.accountId)}</option>`).join('');
  renderNotifHistory();

  const ann = getAnnouncement();
  document.getElementById('announceTitle').value = ann ? (ann.title || '') : '';
  document.getElementById('announceText').value = ann ? (ann.text || '') : '';
  document.getElementById('announceImage').value = ann ? (ann.imageUrl || '') : '';
}
function saveAnnouncementForm() {
  const title = document.getElementById('announceTitle').value.trim();
  const text = document.getElementById('announceText').value.trim();
  const imageUrl = document.getElementById('announceImage').value.trim();
  if (!title && !text) { toast('warn', 'الإعلان فارغ', 'أدخل عنوان أو نص الإعلان أولاً.'); return; }
  setAnnouncement({ title, text, imageUrl, updatedAt: new Date().toISOString() });
  logActivity('نشر إعلان', title);
  toast('success', 'تم النشر', 'سيظهر الإعلان الآن في شريط أعلى منصة المستخدم.');
}
function clearAnnouncementForm() {
  setAnnouncement(null);
  document.getElementById('announceTitle').value = '';
  document.getElementById('announceText').value = '';
  document.getElementById('announceImage').value = '';
  logActivity('إزالة الإعلان الحالي');
  toast('success', 'تمت الإزالة', 'لن يظهر أي إعلان للمستخدمين الآن.');
}
function sendNotification() {
  const message = document.getElementById('notifMessageInput').value.trim();
  if (!message) { toast('warn', 'الرسالة فارغة', 'اكتب نص الإشعار أولاً.'); return; }
  const outbox = getAdminNotifOutbox();
  const entry = {
    id: uid(), message, audience: notifAudience, date: new Date().toISOString(),
    target: notifAudience === 'user' ? document.getElementById('notifUserSelect').value
      : notifAudience === 'squad' ? document.getElementById('notifSquadSelect').value : null
  };
  outbox.unshift(entry);
  setAdminNotifOutbox(outbox);
  logActivity('إرسال إشعار', `${notifAudience} — ${message.slice(0, 40)}`);
  document.getElementById('notifMessageInput').value = '';
  toast('success', 'تم الإرسال', 'تم تسجيل الإشعار. عرضه داخل التطبيق يحتاج ربطاً بسيطاً بواجهة المستخدم.');
  renderNotifHistory();
}
function renderNotifHistory() {
  const outbox = getAdminNotifOutbox();
  const tbody = document.getElementById('notifHistoryBody');
  if (!outbox.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="4"><i class="fa-solid fa-bell big-ic"></i>لا توجد إشعارات مرسلة بعد.</td></tr>`; return; }
  tbody.innerHTML = outbox.slice(0, 30).map(n => `
    <tr><td>${esc(n.message)}</td>
    <td>${n.audience === 'all' ? '<span class="badge badge-gold">الجميع</span>' : n.audience === 'squad' ? '<span class="badge badge-blue">سكواد</span>' : '<span class="badge badge-purple">مستخدم</span>'}</td>
    <td class="cell-muted">${esc(n.target || '—')}</td>
    <td class="cell-muted">${fmtDate(n.date)}</td></tr>`).join('');
}

/* ============================================================
   SECTION 24: SETTINGS PAGE
   ============================================================ */
function renderSettingsPage() {
  const cfg = getConfig();
  const fees = getFees();
  document.getElementById('setSiteName').value = cfg.siteName;
  document.getElementById('setCurrency').value = cfg.siteCurrency;
  document.getElementById('setTimezone').value = cfg.siteTimezone;
  document.getElementById('setLanguage').value = cfg.siteLanguage;
  document.getElementById('setReferralRate').value = (cfg.referralCommissionRate * 100).toFixed(2);
  document.getElementById('setServiceFee').value = (fees.miningFee * 100).toFixed(2);
  document.getElementById('setDepositFee').value = (fees.depositFee * 100).toFixed(2);
  document.getElementById('setWithdrawFee').value = (fees.withdrawFee * 100).toFixed(2);
  document.getElementById('setSquadShare').value = (fees.squadToWalletsShare * 100).toFixed(2);
  document.getElementById('setTransferFee').value = (cfg.transferFeeRate * 100).toFixed(2);
  document.getElementById('setMinDeposit').value = cfg.minDeposit;
  document.getElementById('setMinWithdraw').value = cfg.minWithdrawal;
  document.getElementById('setTransferDelay').value = cfg.transferDelayHours;
  document.getElementById('setMaintenanceToggle').checked = !!cfg.maintenanceMode;
}
function saveGeneralSettings() {
  const cfg = getConfig();
  cfg.siteName = document.getElementById('setSiteName').value.trim() || 'KryptonPyra';
  cfg.siteCurrency = document.getElementById('setCurrency').value.trim() || 'USDT';
  cfg.siteTimezone = document.getElementById('setTimezone').value;
  cfg.siteLanguage = document.getElementById('setLanguage').value;
  cfg.referralCommissionRate = num(document.getElementById('setReferralRate').value) / 100;
  cfg.transferFeeRate = num(document.getElementById('setTransferFee').value) / 100;
  cfg.minDeposit = num(document.getElementById('setMinDeposit').value);
  cfg.minWithdrawal = num(document.getElementById('setMinWithdraw').value);
  cfg.transferDelayHours = num(document.getElementById('setTransferDelay').value);
  cfg.maintenanceMode = document.getElementById('setMaintenanceToggle').checked;
  setConfig(cfg);

  const fees = getFees();
  fees.miningFee = num(document.getElementById('setServiceFee').value) / 100;
  fees.depositFee = num(document.getElementById('setDepositFee').value) / 100;
  fees.withdrawFee = num(document.getElementById('setWithdrawFee').value) / 100;
  fees.squadToWalletsShare = num(document.getElementById('setSquadShare').value) / 100;
  setFees(fees);

  logActivity('حفظ الإعدادات العامة والرسوم');
  toast('success', 'تم الحفظ', 'الرسوم (إيداع/سحب/تعدين/سكواد) فعّالة فوراً على المنصة.');
}

/* ============================================================
   SECTION 25: REPORTS PAGE (تقارير محسوبة من بيانات حقيقية + تصدير CSV)
   ============================================================ */
function renderReportsPage() {
  const d = computeDashboardData();
  document.getElementById('reportSummary').innerHTML = `
    <div class="grid-4">
      <div class="stat-card"><div class="label">إجمالي المستخدمين</div><div class="value">${d.totalUsers}</div></div>
      <div class="stat-card"><div class="label">إجمالي أرصدة المنصة</div><div class="value">${money(d.totalWallet + d.totalMining + d.totalAsset)}</div></div>
      <div class="stat-card"><div class="label">إجمالي الأرباح الموزعة</div><div class="value">${money(d.totalProfit)}</div></div>
      <div class="stat-card"><div class="label">إجمالي رسوم المنصة</div><div class="value">${money(d.totalFees)}</div></div>
    </div>`;
  const topUsers = d.users.slice().sort((a, b) => (num(b.balance) + num(b.miningBalance) + num(b.assetBalance)) - (num(a.balance) + num(a.miningBalance) + num(a.assetBalance))).slice(0, 10);
  document.getElementById('reportTopUsers').innerHTML = topUsers.length ? `
    <div class="table-wrap"><table class="dt"><thead><tr><th>#</th><th>المستخدم</th><th>إجمالي الرصيد</th></tr></thead>
    <tbody>${topUsers.map((u, i) => `<tr><td>${i + 1}</td><td>${esc(userDisplay(u))}</td><td class="cell-gold">${money(num(u.balance) + num(u.miningBalance) + num(u.assetBalance))}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty-state"><i class="fa-solid fa-ranking-star"></i><p>لا يوجد بيانات كافية بعد.</p></div>`;

  renderCompanyRevenueReport();
}
function renderCompanyRevenueReport() {
  const rev = getRevenue();
  const breakdown = getRevenueBreakdown();
  const total = rev.reduce((s, w) => s + num(w.totalBalance), 0);

  let box = document.getElementById('companyRevenueBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'companyRevenueBox';
    document.getElementById('reportTopUsers').closest('.card').insertAdjacentElement('afterend', box);
  }
  box.innerHTML = `
    <div class="card">
      <div class="card-head"><h3><i class="fa-solid fa-sack-dollar"></i> إيرادات الشركة (من الرسوم)</h3><span class="cell-muted" style="font-size:.8rem;">الإجمالي: ${money(total)}</span></div>
      <div class="grid-4">
        <div class="stat-card"><div class="label">رسوم الإيداع (2%)</div><div class="value">${money(breakdown.depositFees)}</div></div>
        <div class="stat-card"><div class="label">رسوم السحب (2%)</div><div class="value">${money(breakdown.withdrawFees)}</div></div>
        <div class="stat-card"><div class="label">رسوم التعدين (4%)</div><div class="value">${money(breakdown.miningFees)}</div></div>
        <div class="stat-card"><div class="label">حصة السكواد (1%)</div><div class="value">${money(breakdown.squadFees)}</div></div>
      </div>
      <div class="table-wrap" style="margin-top:14px;">
        <table class="dt"><thead><tr><th>المحفظة</th><th>الرصيد المتراكم</th></tr></thead>
        <tbody>${rev.map(w => `<tr><td>محفظة الشركة #${w.walletId}</td><td class="cell-gold">${money(w.totalBalance)}</td></tr>`).join('')}</tbody></table>
      </div>
    </div>`;
}
function exportUsersCSV() {
  const users = getUsers();
  const header = ['accountId', 'username', 'displayName', 'email', 'balance', 'miningBalance', 'assetBalance', 'referralBalance', 'verificationStatus'];
  const csvRows = [header.join(',')];
  users.forEach(u => csvRows.push(header.map(h => `"${String(u[h] ?? '').replace(/"/g, '""')}"`).join(',')));
  downloadFile('users_export.csv', csvRows.join('\n'), 'text/csv');
  logActivity('تصدير تقرير المستخدمين CSV');
}
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('success', 'تم التصدير', name);
}

/* ============================================================
   SECTION 26: STATISTICS PAGE (رسوم بيانية موسّعة)
   ============================================================ */
let statCharts = {};
function renderLeaderboards() {
  // بلاتينيوم: أعلى 10 مودعين حسب إجمالي الإيداعات المكتملة فعلياً
  const users = getUsers();
  const deposits = getDeposits().filter(d => d.status === 'completed');
  const totalsByUser = {};
  deposits.forEach(d => { totalsByUser[d.userId] = (totalsByUser[d.userId] || 0) + num(d.amount); });
  const platinum = Object.keys(totalsByUser)
    .map(userId => {
      const u = users.find(x => x.username === userId);
      return { username: userId, displayName: u ? userDisplay(u) : userId, total: totalsByUser[userId] };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const platBody = document.getElementById('platinumLeaderboardBody');
  if (platBody) {
    platBody.innerHTML = platinum.length ? platinum.map((p, i) => `
      <tr><td>${i + 1}</td><td>${esc(p.displayName)}</td><td class="cell-gold">${money(p.total)}</td></tr>
    `).join('') : `<tr class="empty-row"><td colspan="3">لا توجد إيداعات مكتملة بعد.</td></tr>`;
  }

  // ذهبي: أعلى 10 قادة سكواد حسب أرباح السكواد (referralBalance) وعدد الأعضاء
  const gold = users
    .filter(u => u.accountId)
    .map(u => {
      const members = users.filter(m => m.referredBy === u.accountId).length;
      return { displayName: userDisplay(u), members, referralBalance: num(u.referralBalance) };
    })
    .filter(g => g.members > 0 || g.referralBalance > 0)
    .sort((a, b) => b.referralBalance - a.referralBalance || b.members - a.members)
    .slice(0, 10);

  const goldBody = document.getElementById('goldLeaderboardBody');
  if (goldBody) {
    goldBody.innerHTML = gold.length ? gold.map((g, i) => `
      <tr><td>${i + 1}</td><td>${esc(g.displayName)}</td><td class="cell-muted">${g.members}</td><td class="cell-gold">${money(g.referralBalance)}</td></tr>
    `).join('') : `<tr class="empty-row"><td colspan="4">لا توجد سكوادات نشطة بعد.</td></tr>`;
  }
}

function renderStatisticsPage() {
  renderLeaderboards();
  const d = computeDashboardData();
  if (typeof Chart === 'undefined') return;
  const byStatus = [
    { label: 'موثّق', value: d.verified, color: '#22c55e' },
    { label: 'معلّق', value: d.pendingV, color: '#fbbf24' },
    { label: 'مرفوض', value: d.rejectedV, color: '#ef4444' }
  ];
  drawChart('statVerifyChart', 'doughnut', byStatus.map(b => b.label), [{ data: byStatus.map(b => b.value), backgroundColor: byStatus.map(b => b.color), borderWidth: 0 }]);

  const balances = [
    { label: 'المحفظة', value: d.totalWallet }, { label: 'التعدين', value: d.totalMining }, { label: 'الأسست', value: d.totalAsset }
  ];
  drawChart('statBalanceChart', 'bar', balances.map(b => b.label), [{ data: balances.map(b => b.value), backgroundColor: '#fbbf24', borderRadius: 6 }]);

  const buckets = buildTimeBuckets(d.allInvoices, 'monthly', i => i.timestamp, i => 1);
  drawChart('statSessionsChart', 'line', buckets.labels, [{ label: 'جلسات تعدين', data: buckets.values, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.12)', fill: true, tension: .35 }]);
}
function drawChart(canvasId, type, labels, datasets) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (statCharts[canvasId]) statCharts[canvasId].destroy();
  statCharts[canvasId] = new Chart(ctx, {
    type, data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: type === 'doughnut', labels: { color: '#a8b3cc' } } },
      scales: type === 'doughnut' ? {} : { x: { ticks: { color: '#6b7690' }, grid: { display: false } }, y: { ticks: { color: '#6b7690' }, grid: { color: 'rgba(255,255,255,.04)' } } }
    }
  });
}
PAGE_RENDERERS.pageNotifications = renderNotificationsPage;
PAGE_RENDERERS.pageSettings = renderSettingsPage;
PAGE_RENDERERS.pageReports = renderReportsPage;
PAGE_RENDERERS.pageStatistics = renderStatisticsPage;

/* ============================================================
   SECTION 27: LOGS PAGE (سجلات حقيقية من كل مصدر بيانات)
   ============================================================ */
let logsSubTab = 'admin';
function setLogsSubTab(tab) { logsSubTab = tab; document.querySelectorAll('#pageLogs .subtab').forEach(t => t.classList.toggle('active', t.dataset.ltab === tab)); renderLogsTable(); }
function renderLogsPage() {
  document.getElementById('logsSearchInput').oninput = e => setSearch('logsTbl', e.target.value);
  renderLogsTable();
}
rerenderRegistry.logsTbl = renderLogsTable;
function collectLogsForTab(tab) {
  const users = getUsers();
  if (tab === 'admin') return getActivityLog().map(a => ({ who: a.admin, action: a.action, detail: a.details, date: a.date }));
  if (tab === 'mining') { const all = []; users.forEach(u => (u.invoices || []).forEach(i => all.push({ who: userDisplay(u), action: 'جلسة تعدين', detail: `${i.coinName || i.coin} — صافي ${money(i.netProfit)}`, date: i.timestamp }))); return all.sort((a, b) => new Date(b.date) - new Date(a.date)); }
  if (tab === 'transfer') return getAllTransfers().map(t => ({ who: t.displayName, action: `${t.from} ← ${t.to}`, detail: money(t.amount), date: t.created_at }));
  if (tab === 'verification') return getVerifyNotes().map(n => ({ who: n.admin, action: 'ملاحظة تحقق', detail: `${n.username}: ${n.text}`, date: n.date }));
  if (tab === 'deposit') return getDeposits().map(d => ({ who: (users.find(u => u.username === d.userId) ? userDisplay(users.find(u => u.username === d.userId)) : d.userId), action: `إيداع (${depositStatusText(d.status)})`, detail: money(d.amount), date: d.createdAt || new Date().toISOString() }));
  if (tab === 'withdraw') return getWithdraws().map(w => ({ who: (users.find(u => u.username === w.userId) ? userDisplay(users.find(u => u.username === w.userId)) : w.userId), action: `سحب (${withdrawStatusText(w.status)})`, detail: money(w.amount), date: w.createdAt || new Date().toISOString() }));
  return [];
}
function renderLogsTable() {
  const rows = applyTableQuery('logsTbl', collectLogsForTab(logsSubTab), ['who', 'action', 'detail']);
  const { pageRows, totalPages, total, start } = paginate('logsTbl', rows);
  const tbody = document.getElementById('logsTableBody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4"><i class="fa-solid fa-file-lines big-ic"></i>لا توجد سجلات في هذا القسم.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(r => `<tr><td>${esc(r.who)}</td><td>${esc(r.action)}</td><td class="cell-muted">${esc(r.detail)}</td><td class="cell-muted">${fmtDate(r.date)}</td></tr>`).join('');
  }
  renderPagination('logsTbl', totalPages, total, start, pageRows.length);
}
function exportLogsCSV() {
  const rows = collectLogsForTab(logsSubTab);
  const csv = ['who,action,detail,date', ...rows.map(r => `"${r.who}","${r.action}","${String(r.detail).replace(/"/g, '""')}","${r.date}"`)].join('\n');
  downloadFile(`logs_${logsSubTab}.csv`, csv, 'text/csv');
}

/* ============================================================
   SECTION 28: SUPPORT PAGE (ملاحظات/تذاكر إدارية حقيقية لكل مستخدم)
   ============================================================ */
function renderSupportPage() {
  document.getElementById('supportSearchInput').oninput = e => setSearch('supportTbl', e.target.value);
  const users = getUsers();
  document.getElementById('supportUserSelect').innerHTML = users.map(u => `<option value="${esc(u.username)}">${esc(userDisplay(u))}</option>`).join('');
  renderSupportTable();
}
function submitSupportNote() {
  const username = document.getElementById('supportUserSelect').value;
  const text = document.getElementById('supportNoteInput').value.trim();
  if (!text) { toast('warn', 'اكتب نص الملاحظة', ''); return; }
  const notes = getSupportNotes();
  notes.unshift({ id: uid(), username, text, admin: (currentAdmin && currentAdmin.username) || 'admin', date: new Date().toISOString(), status: 'open' });
  setSupportNotes(notes);
  document.getElementById('supportNoteInput').value = '';
  logActivity('إضافة تذكرة دعم', username);
  toast('success', 'أُضيفت التذكرة', '');
  renderSupportTable();
}
rerenderRegistry.supportTbl = renderSupportTable;
function renderSupportTable() {
  const notes = getSupportNotes();
  const rows = applyTableQuery('supportTbl', notes, ['username', 'text']);
  const { pageRows, totalPages, total, start } = paginate('supportTbl', rows);
  const tbody = document.getElementById('supportTableBody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><i class="fa-solid fa-headset big-ic"></i>لا توجد تذاكر دعم بعد.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(n => `
      <tr><td>${esc(n.username)}</td><td>${esc(n.text)}</td><td class="cell-muted">${esc(n.admin)}</td>
      <td>${n.status === 'closed' ? '<span class="badge badge-gray">مغلقة</span>' : '<span class="badge badge-green">مفتوحة</span>'}</td>
      <td><button class="btn btn-xs ${n.status === 'closed' ? 'btn-success' : 'btn-warn'}" onclick="toggleSupportStatus('${n.id}')">${n.status === 'closed' ? 'إعادة فتح' : 'إغلاق'}</button></td></tr>`).join('');
  }
  renderPagination('supportTbl', totalPages, total, start, pageRows.length);
}
function toggleSupportStatus(id) {
  const notes = getSupportNotes();
  const n = notes.find(x => x.id === id); if (!n) return;
  n.status = n.status === 'closed' ? 'open' : 'closed';
  setSupportNotes(notes);
  renderSupportTable();
}

/* ============================================================
   SECTION 29: PROFILE PAGE (حساب المشرف الحالي)
   ============================================================ */
function renderProfilePage() {
  if (!currentAdmin) return;
  document.getElementById('profDisplayName').value = currentAdmin.displayName || '';
  document.getElementById('profUsername').value = currentAdmin.username || '';
  document.getElementById('profRole').value = roleName(currentAdmin.role);
  document.getElementById('profAvatarLetter').textContent = initialsOf(currentAdmin.displayName || currentAdmin.username);
}
function roleName(roleId) { const r = getAdminRoles().find(x => x.id === roleId); return r ? r.name : roleId; }
function saveProfile() {
  const accounts = getAdminAccounts();
  const acc = accounts.find(a => a.id === currentAdmin.id);
  acc.displayName = document.getElementById('profDisplayName').value.trim() || acc.username;
  setAdminAccounts(accounts);
  currentAdmin = acc;
  document.getElementById('adminMiniName').textContent = acc.displayName;
  document.getElementById('adminMiniAvatar').textContent = initialsOf(acc.displayName);
  logActivity('تعديل الملف الشخصي');
  toast('success', 'تم الحفظ', '');
}
function changeOwnPassword() {
  const oldP = document.getElementById('profOldPassword').value;
  const newP = document.getElementById('profNewPassword').value;
  if (currentAdmin.password !== oldP) { toast('error', 'كلمة المرور الحالية غير صحيحة', ''); return; }
  if (newP.length < 4) { toast('warn', 'كلمة مرور قصيرة', 'يجب أن تكون 4 أحرف على الأقل.'); return; }
  const accounts = getAdminAccounts();
  const acc = accounts.find(a => a.id === currentAdmin.id);
  acc.password = newP; setAdminAccounts(accounts); currentAdmin = acc;
  document.getElementById('profOldPassword').value = ''; document.getElementById('profNewPassword').value = '';
  logActivity('تغيير كلمة مرور اللوحة');
  toast('success', 'تم التحديث', 'تم تغيير كلمة المرور بنجاح.');
}
PAGE_RENDERERS.pageLogs = renderLogsPage;
PAGE_RENDERERS.pageSupport = renderSupportPage;
PAGE_RENDERERS.pageProfile = renderProfilePage;

/* ============================================================
   SECTION 30: ADMINS PAGE (فريق الإدارة — نظام حقيقي خاص باللوحة)
   ============================================================ */
function renderAdminsPage() { renderAdminsTable(); }
function renderAdminsTable() {
  const accounts = getAdminAccounts();
  const tbody = document.getElementById('adminsTableBody');
  tbody.innerHTML = accounts.map(a => `
    <tr>
      <td><div class="user-cell"><div class="av">${esc(initialsOf(a.displayName || a.username))}</div><div class="meta"><b>${esc(a.displayName || a.username)}</b><span>@${esc(a.username)}</span></div></div></td>
      <td>${esc(roleName(a.role))}</td>
      <td>${a.active ? '<span class="badge badge-green">نشط</span>' : '<span class="badge badge-gray">موقوف</span>'}</td>
      <td class="cell-muted">${fmtDate(a.createdAt)}</td>
      <td><div class="action-cell">
        <button class="btn btn-xs btn-gold" onclick="openAdminEdit('${a.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-xs ${a.active ? 'btn-warn' : 'btn-success'}" onclick="toggleAdminActive('${a.id}')"><i class="fa-solid fa-power-off"></i></button>
        ${a.username !== 'admin' ? `<button class="btn btn-xs btn-danger" onclick="deleteAdmin('${a.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div></td>
    </tr>`).join('');
}
function openAddAdminModal() {
  document.getElementById('adminEditId').value = '';
  document.getElementById('adminFormUsername').value = '';
  document.getElementById('adminFormDisplayName').value = '';
  document.getElementById('adminFormPassword').value = '';
  fillRoleSelect('adminFormRole');
  openModal('adminFormModal');
}
function openAdminEdit(id) {
  const a = getAdminAccounts().find(x => x.id === id); if (!a) return;
  document.getElementById('adminEditId').value = id;
  document.getElementById('adminFormUsername').value = a.username;
  document.getElementById('adminFormDisplayName').value = a.displayName;
  document.getElementById('adminFormPassword').value = '';
  fillRoleSelect('adminFormRole', a.role);
  openModal('adminFormModal');
}
function fillRoleSelect(selectId, selected) {
  const roles = getAdminRoles();
  document.getElementById(selectId).innerHTML = roles.map(r => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
}
function submitAdminForm() {
  const id = document.getElementById('adminEditId').value;
  const username = document.getElementById('adminFormUsername').value.trim();
  const displayName = document.getElementById('adminFormDisplayName').value.trim() || username;
  const password = document.getElementById('adminFormPassword').value;
  const role = document.getElementById('adminFormRole').value;
  if (!username) { toast('warn', 'اسم المستخدم مطلوب', ''); return; }
  let accounts = getAdminAccounts();
  if (id) {
    const a = accounts.find(x => x.id === id);
    a.username = username; a.displayName = displayName; a.role = role;
    if (password) a.password = password;
  } else {
    if (accounts.some(x => x.username === username)) { toast('error', 'اسم مستخدم مكرر', ''); return; }
    if (!password) { toast('warn', 'كلمة المرور مطلوبة', ''); return; }
    accounts.push({ id: uid(), username, displayName, password, role, active: true, createdAt: new Date().toISOString() });
  }
  setAdminAccounts(accounts);
  logActivity(id ? 'تعديل حساب مشرف' : 'إضافة مشرف جديد', username);
  closeModal('adminFormModal');
  renderAdminsTable();
  toast('success', 'تم الحفظ', '');
}
function toggleAdminActive(id) {
  const accounts = getAdminAccounts();
  const a = accounts.find(x => x.id === id);
  a.active = !a.active; setAdminAccounts(accounts);
  logActivity('تبديل حالة مشرف', a.username);
  renderAdminsTable();
}
function deleteAdmin(id) {
  askConfirm({
    title: 'حذف حساب مشرف', icon: 'fa-trash',
    message: 'سيتم حذف هذا الحساب من فريق الإدارة نهائياً.',
    onConfirm: () => {
      const accounts = getAdminAccounts().filter(x => x.id !== id);
      setAdminAccounts(accounts);
      logActivity('حذف مشرف', id);
      renderAdminsTable(); toast('success', 'تم الحذف', '');
    }
  });
}

/* ============================================================
   SECTION 31: ROLES PAGE
   ============================================================ */
function renderRolesPage() { renderRolesTable(); }
function renderRolesTable() {
  const roles = getAdminRoles();
  const box = document.getElementById('rolesGrid');
  box.innerHTML = roles.map((r, i) => `
    <div class="tier-card">
      <div class="tier-head"><b>${esc(r.name)}</b><span class="badge badge-gold">${r.permissions.length} صلاحية</span></div>
      <div class="cell-muted" style="font-size:.76rem;">${esc(r.permissions.join('، '))}</div>
      <div class="tier-actions">
        <button class="btn btn-xs btn-gold" onclick="openRoleEdit(${i})"><i class="fa-solid fa-pen"></i> تعديل</button>
        ${!['super_admin'].includes(r.id) ? `<button class="btn btn-xs btn-danger" onclick="deleteRole(${i})"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
    </div>`).join('');
}
const ALL_PERMISSIONS = ['users.view', 'users.manage', 'verification.manage', 'mining.manage', 'deposits.manage', 'withdrawals.manage', 'transfers.manage', 'wallets.manage', 'squads.manage', 'notifications.send', 'settings.manage', 'support.manage', 'admins.manage'];
function openRoleAdd() {
  document.getElementById('roleEditIndex').value = '-1';
  document.getElementById('roleNameInput').value = '';
  renderPermChecklist([]);
  openModal('roleModal');
}
function openRoleEdit(i) {
  const r = getAdminRoles()[i];
  document.getElementById('roleEditIndex').value = i;
  document.getElementById('roleNameInput').value = r.name;
  renderPermChecklist(r.permissions);
  openModal('roleModal');
}
function renderPermChecklist(selected) {
  document.getElementById('rolePermsList').innerHTML = ALL_PERMISSIONS.map(p => `
    <label class="switch-row" style="cursor:pointer;">
      <div class="t"><b>${esc(p)}</b></div>
      <input type="checkbox" value="${p}" class="perm-chk" ${selected.includes(p) || selected.includes('all') ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--gold);">
    </label>`).join('');
}
function submitRole() {
  const i = parseInt(document.getElementById('roleEditIndex').value);
  const name = document.getElementById('roleNameInput').value.trim();
  if (!name) { toast('warn', 'اسم الدور مطلوب', ''); return; }
  const perms = Array.from(document.querySelectorAll('.perm-chk:checked')).map(c => c.value);
  const roles = getAdminRoles();
  const role = { id: i === -1 ? uid() : roles[i].id, name, permissions: perms };
  if (i === -1) roles.push(role); else roles[i] = role;
  setAdminRoles(roles);
  logActivity(i === -1 ? 'إضافة دور جديد' : 'تعديل دور', name);
  closeModal('roleModal');
  renderRolesTable();
  toast('success', 'تم الحفظ', '');
}
function deleteRole(i) {
  const roles = getAdminRoles();
  askConfirm({ title: 'حذف الدور', icon: 'fa-trash', message: `سيتم حذف الدور <b>${esc(roles[i].name)}</b>.`, onConfirm: () => { const r2 = getAdminRoles(); r2.splice(i, 1); setAdminRoles(r2); renderRolesTable(); toast('success', 'تم الحذف', ''); } });
}

/* ============================================================
   SECTION 32: PERMISSIONS PAGE (مصفوفة عرض)
   ============================================================ */
function renderPermissionsPage() {
  const roles = getAdminRoles();
  const head = '<th>الصلاحية</th>' + roles.map(r => `<th>${esc(r.name)}</th>`).join('');
  const body = ALL_PERMISSIONS.map(p => {
    const cells = roles.map(r => (r.permissions.includes(p) || r.permissions.includes('all'))
      ? '<td style="text-align:center;color:var(--green);"><i class="fa-solid fa-check"></i></td>'
      : '<td style="text-align:center;color:var(--text-3);"><i class="fa-solid fa-minus"></i></td>').join('');
    return `<tr><td>${esc(p)}</td>${cells}</tr>`;
  }).join('');
  document.getElementById('permMatrixHead').innerHTML = head;
  document.getElementById('permMatrixBody').innerHTML = body;
}

/* ============================================================
   SECTION 33: SECURITY PAGE
   ============================================================ */
function renderSecurityPage() {
  const log = getActivityLog().filter(a => a.action.includes('تسجيل دخول') || a.action.includes('تسجيل خروج'));
  const box = document.getElementById('securityLoginHistory');
  box.innerHTML = log.length ? log.slice(0, 15).map(a => `
    <div class="tl-item"><div class="tl-dot"><i class="fa-solid fa-right-to-bracket"></i></div>
    <div class="tl-body"><b>${esc(a.action)} — ${esc(a.admin)}</b><span>${fmtDate(a.date)}</span></div></div>`).join('')
    : `<div class="empty-state" style="padding:24px;"><i class="fa-solid fa-shield-halved"></i><p>لا يوجد سجل دخول بعد.</p></div>`;
}

/* ============================================================
   SECTION 34: MAINTENANCE PAGE
   ============================================================ */
function renderMaintenancePage() {
  const cfg = getConfig();
  document.getElementById('maintenanceToggleBig').checked = !!cfg.maintenanceMode;
  document.getElementById('maintenanceMsgInput').value = cfg.maintenanceMessage || 'المنصة تحت الصيانة حالياً، نعتذر عن الإزعاج، سنعود قريباً.';
}
function saveMaintenance() {
  const cfg = getConfig();
  cfg.maintenanceMode = document.getElementById('maintenanceToggleBig').checked;
  cfg.maintenanceMessage = document.getElementById('maintenanceMsgInput').value.trim();
  setConfig(cfg);
  logActivity('تبديل وضع الصيانة', cfg.maintenanceMode ? 'تفعيل' : 'إيقاف');
  toast('success', 'تم الحفظ', 'ملاحظة: عرض شاشة الصيانة فعلياً على واجهة المستخدم يحتاج ربطاً بسيطاً في index.html/script.js لقراءة هذا الحقل.');
}

/* ============================================================
   SECTION 35: API SETTINGS PAGE
   ============================================================ */
function renderApiPage() {
  const s = getApiSettings();
  document.getElementById('apiBaseUrl').value = s.baseUrl || '';
  document.getElementById('apiKeyInput').value = s.apiKey || '';
  document.getElementById('apiConnectedToggle').checked = !!s.backendConnected;
}
function saveApiSettings() {
  const s = { baseUrl: document.getElementById('apiBaseUrl').value.trim(), apiKey: document.getElementById('apiKeyInput').value.trim(), backendConnected: document.getElementById('apiConnectedToggle').checked };
  setApiSettings(s);
  logActivity('تحديث إعدادات API');
  toast('success', 'تم الحفظ', 'هذه الإعدادات جاهزة لربط المشروع لاحقاً بخادم PHP/MySQL.');
}

/* ============================================================
   SECTION 36: SYSTEM PAGE (معلومات حقيقية عن البيئة الحالية)
   ============================================================ */
function renderSystemPage() {
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; }
  const kb = (bytes / 1024).toFixed(1);
  document.getElementById('sysStorageUsage').textContent = `${kb} KB`;
  document.getElementById('sysKeysCount').textContent = localStorage.length;
  document.getElementById('sysUserAgent').textContent = navigator.userAgent;
  document.getElementById('sysLang').textContent = navigator.language;
  document.getElementById('sysOnline').textContent = navigator.onLine ? 'متصل' : 'غير متصل';
  document.getElementById('sysScreen').textContent = `${screen.width}×${screen.height}`;
}

/* ============================================================
   SECTION 37: ACTIVITY PAGE (سجل نشاط الإدارة الكامل)
   ============================================================ */
function renderActivityPage() {
  document.getElementById('activitySearchInput').oninput = e => setSearch('activityTbl', e.target.value);
  renderActivityTable();
}
rerenderRegistry.activityTbl = renderActivityTable;
function renderActivityTable() {
  const log = getActivityLog();
  const rows = applyTableQuery('activityTbl', log, ['admin', 'action', 'details']);
  const { pageRows, totalPages, total, start } = paginate('activityTbl', rows);
  const tbody = document.getElementById('activityTableBody');
  if (!pageRows.length) tbody.innerHTML = `<tr class="empty-row"><td colspan="4"><i class="fa-solid fa-clock-rotate-left big-ic"></i>لا يوجد نشاط مسجّل بعد.</td></tr>`;
  else tbody.innerHTML = pageRows.map(a => `<tr><td>${esc(a.admin)}</td><td>${esc(a.action)}</td><td class="cell-muted">${esc(a.details)}</td><td class="cell-muted">${fmtDate(a.date)}</td></tr>`).join('');
  renderPagination('activityTbl', totalPages, total, start, pageRows.length);
}
function clearActivityLog() {
  askConfirm({ title: 'مسح سجل النشاط', icon: 'fa-trash', message: 'سيتم مسح كامل سجل نشاط الإدارة نهائياً.', onConfirm: () => { setActivityLog([]); renderActivityTable(); toast('success', 'تم المسح', ''); } });
}

/* ============================================================
   SECTION 38: DATABASE PAGE (نسخ احتياطي / استيراد وتصدير حقيقي)
   ============================================================ */
function renderDatabasePage() {
  const keys = Object.values(K);
  const box = document.getElementById('dbKeysList');
  box.innerHTML = keys.map(k => {
    const raw = localStorage.getItem(k);
    const size = raw ? (raw.length / 1024).toFixed(1) : '0';
    return `<div class="switch-row"><div class="t"><b>${esc(k)}</b><span>${size} KB</span></div></div>`;
  }).join('');
}
function exportFullBackup() {
  const dump = {};
  Object.values(K).forEach(k => { const v = localStorage.getItem(k); if (v !== null) dump[k] = v; });
  downloadFile(`kryptonpyra_backup_${Date.now()}.json`, JSON.stringify(dump, null, 2), 'application/json');
  logActivity('تصدير نسخة احتياطية كاملة');
}
function importFullBackup(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      askConfirm({
        title: 'استيراد نسخة احتياطية', icon: 'fa-upload', okClass: 'btn-danger',
        message: 'سيتم استبدال كل بيانات المنصة الحالية بالبيانات الموجودة في هذا الملف. هذا الإجراء لا يمكن التراجع عنه.',
        onConfirm: () => {
          Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
          logActivity('استيراد نسخة احتياطية');
          toast('success', 'تم الاستيراد', 'أعد تحميل الصفحة لتطبيق كافة التغييرات.');
          setTimeout(() => location.reload(), 1200);
        }
      });
    } catch (e) { toast('error', 'ملف غير صالح', 'تعذّرت قراءة الملف.'); }
  };
  reader.readAsText(file);
}
function wipeAllData() {
  askConfirm({
    title: 'مسح كامل البيانات', icon: 'fa-triangle-exclamation', okClass: 'btn-danger',
    message: '<b style="color:var(--red)">تحذير خطير:</b> سيتم حذف جميع المستخدمين والإعدادات والسجلات نهائياً من هذا المتصفح. لا يمكن التراجع.',
    onConfirm: () => {
      Object.values(K).forEach(k => localStorage.removeItem(k));
      logActivity('مسح كامل البيانات');
      toast('success', 'تم المسح', 'سيتم إعادة تحميل الصفحة.');
      setTimeout(() => location.reload(), 1200);
    }
  });
}
PAGE_RENDERERS.pageAdmins = renderAdminsPage;
PAGE_RENDERERS.pageRoles = renderRolesPage;
PAGE_RENDERERS.pagePermissions = renderPermissionsPage;
PAGE_RENDERERS.pageSecurity = renderSecurityPage;
PAGE_RENDERERS.pageMaintenance = renderMaintenancePage;
PAGE_RENDERERS.pageApi = renderApiPage;
PAGE_RENDERERS.pageSystem = renderSystemPage;
PAGE_RENDERERS.pageActivity = renderActivityPage;
PAGE_RENDERERS.pageDatabase = renderDatabasePage;

/* ============================================================
   SECTION 39: TOPBAR GLOBAL SEARCH + CLOCK + SIDEBAR BADGES
   ============================================================ */
function updateClock() {
  const el = document.getElementById('topClock');
  if (!el) return;
  const now = new Date();
  el.innerHTML = `<b>${now.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' })}</b>${now.toLocaleDateString('ar-JO', { weekday: 'long', day: '2-digit', month: 'short' })}`;
}
function updateSidebarBadges() {
  const d = computeDashboardData();
  setBadge('badgeUsers', d.totalUsers);
  setBadge('badgeVerification', d.pendingV);
  setBadge('badgeDeposits', d.pendingDeposits.length);
  setBadge('badgeWithdrawals', d.pendingWithdraws.length);
  document.getElementById('headerBellCount').textContent = d.pendingDeposits.length + d.pendingWithdraws.length + d.pendingV;
  document.getElementById('headerBellCount').style.display = (d.pendingDeposits.length + d.pendingWithdraws.length + d.pendingV) > 0 ? 'flex' : 'none';
}
function setBadge(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  el.style.display = val > 0 ? 'inline-flex' : 'none';
}
function globalSearch(query) {
  if (!query || query.trim().length < 2) return;
  const q = query.trim().toLowerCase();
  const users = getUsers();
  const hit = users.find(u => (u.username || '').toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.accountId || '').toLowerCase().includes(q));
  if (hit) { goToPage('pageUsers'); setTimeout(() => openUserView(hit.username), 250); }
  else toast('info', 'لا توجد نتائج', `لم يتم إيجاد مستخدم مطابق لـ "${query}"`);
}

/* ============================================================
   SECTION 40: LOGIN SCREEN WIRING
   ============================================================ */
function submitAdminLogin() {
  const u = document.getElementById('adminLoginUser').value.trim();
  const p = document.getElementById('adminLoginPass').value.trim();
  const msg = document.getElementById('loginMsg');
  if (!u || !p) { msg.textContent = '⚠️ أدخل اسم المستخدم وكلمة المرور.'; return; }
  const res = tryAdminLogin(u, p);
  if (!res.success) { msg.textContent = res.message; return; }
  msg.textContent = '';
  enterAdminApp();
}
function enterAdminApp() {
  document.getElementById('loginWrapper').style.display = 'none';
  document.getElementById('adminApp').style.display = 'block';
  document.getElementById('adminMiniName').textContent = currentAdmin.displayName || currentAdmin.username;
  document.getElementById('adminMiniAvatar').textContent = initialsOf(currentAdmin.displayName || currentAdmin.username);
  updateClock(); setInterval(updateClock, 30000);
  updateSidebarBadges(); setInterval(updateSidebarBadges, 5000);
  const startPage = (location.hash && document.getElementById(location.hash.slice(1))) ? location.hash.slice(1) : 'pageDashboard';
  goToPage(startPage);
}

/* ============================================================
   SECTION 41: BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  ensureSeedAdmin();

  document.getElementById('appLoadingScreen').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('appLoadingScreen').style.display = 'none';
    if (restoreAdminSession()) {
      enterAdminApp();
    } else {
      document.getElementById('loginWrapper').style.display = 'flex';
    }
  }, 700);

  document.getElementById('adminLoginBtn').addEventListener('click', submitAdminLogin);
  document.getElementById('adminLoginPass').addEventListener('keydown', e => { if (e.key === 'Enter') submitAdminLogin(); });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    askConfirm({ title: 'تسجيل الخروج', icon: 'fa-right-from-bracket', okClass: 'btn-gold', message: 'هل تريد تسجيل الخروج من لوحة التحكم؟', onConfirm: adminLogout });
  });
  document.getElementById('globalSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') globalSearch(e.target.value); });

  document.querySelectorAll('.chart-tab').forEach(t => t.addEventListener('click', () => setDashRange(t.dataset.range)));
  document.querySelectorAll('.audience-opt').forEach(t => t.addEventListener('click', () => setNotifAudience(t.dataset.aud)));
  document.querySelectorAll('[data-vtab]').forEach(t => t.addEventListener('click', () => setVerifyTab(t.dataset.vtab)));
  document.querySelectorAll('[data-ttab]').forEach(t => t.addEventListener('click', () => setTransferSubTab(t.dataset.ttab)));
  document.querySelectorAll('[data-ltab]').forEach(t => t.addEventListener('click', () => setLogsSubTab(t.dataset.ltab)));
});
