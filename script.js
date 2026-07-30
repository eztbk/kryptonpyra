// ============================================================
// SECTION 24: CONFIGURATION & SETTINGS (ADMIN CONTROLLABLE)
// ============================================================

const CONFIG_KEY = 'krypton_pyra_config';

function getDefaultConfig() {
    return {
        miningEnabled: true,
        miningScheduleEnabled: false,
        miningStartHour: 16,
        miningStartMinute: 0,
        miningEndHour: 18,
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
        serviceChargeRate: 0.04
    };
}

function loadConfig() {
    let config = null;
    try {
        const stored = localStorage.getItem(CONFIG_KEY);
        if (stored) {
            config = JSON.parse(stored);
            const defaults = getDefaultConfig();
            config = deepMerge(defaults, config);
        }
    } catch (e) {
        console.warn('Failed to load config, using defaults:', e);
    }
    if (!config) {
        config = getDefaultConfig();
        saveConfig(config);
    }
    return config;
}

function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
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

const AdminAPI = {
    getConfig: loadConfig,
    saveConfig: saveConfig,
    getProfitTiers: function() {
        const config = loadConfig();
        return config.profitTiers || [];
    },
    getTierForAmount: function(amount) {
        const tiers = this.getProfitTiers();
        return tiers.find(t => 
            t.enabled && 
            amount >= t.minAmount && 
            (t.maxAmount === null || amount < t.maxAmount)
        ) || null;
    },
    getProfitRate: function(amount) {
        const tier = this.getTierForAmount(amount);
        return tier ? tier.dailyProfitRate : 0;
    },
    isMiningEnabled: function() {
        const config = loadConfig();
        return config.miningEnabled !== false;
    },
    isScheduleEnabled: function() {
        const config = loadConfig();
        return config.miningScheduleEnabled === true;
    },
    getMiningSchedule: function() {
        const config = loadConfig();
        return {
            startHour: config.miningStartHour !== undefined ? config.miningStartHour : 16,
            startMinute: config.miningStartMinute || 0,
            endHour: config.miningEndHour !== undefined ? config.miningEndHour : 18,
            endMinute: config.miningEndMinute || 0
        };
    },
    getMiningDuration: function() {
        const config = loadConfig();
        return config.miningDurationSeconds || 30;
    },
    getReferralCommissionRate: function() {
        const config = loadConfig();
        return config.referralCommissionRate || 0.05;
    },
    getServiceChargeRate: function() {
        const config = loadConfig();
        return config.serviceChargeRate || 0.04;
    }
};

// ============================================================
// SECTION 24B: PLATFORM FEES / COMPANY WALLETS / DEPOSIT POOL / REVENUE
// ============================================================

const FEES_KEY = 'krypton_platform_fees';
const MAIN_WALLETS_KEY = 'krypton_main_wallets';
const DEPOSIT_POOL_KEY = 'krypton_deposit_pool';
const USED_DEPOSIT_POOL_KEY = 'krypton_used_deposit_pool';
const DEPOSITS_KEY = 'krypton_deposits';
const WITHDRAWALS_KEY = 'krypton_withdrawals';
const REVENUE_KEY = 'krypton_company_revenue';
const REVENUE_BREAKDOWN_KEY = 'krypton_revenue_breakdown';
const ANNOUNCEMENT_KEY = 'krypton_current_announcement';

// عقد USDT الرسمي على شبكة TRON (TRC20) — للتحقق الحقيقي من البلوكشين
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

function generateStrongPassword(length = 16) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let pass = '';
    const arr = new Uint32Array(length);
    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(arr);
    } else {
        for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 1e9);
    }
    for (let i = 0; i < length; i++) pass += chars[arr[i] % chars.length];
    return pass;
}

function loadFees() {
    let fees = null;
    try {
        const stored = localStorage.getItem(FEES_KEY);
        if (stored) fees = JSON.parse(stored);
    } catch (e) { /* ignore */ }
    if (!fees) {
        const oldConfig = loadConfig();
        fees = {
            depositFee: 0.02,
            withdrawFee: 0.02,
            miningFee: (oldConfig && oldConfig.serviceChargeRate) || 0.04,
            squadToWalletsShare: 0.01
        };
        localStorage.setItem(FEES_KEY, JSON.stringify(fees));
    }
    return fees;
}
function saveFees(fees) { localStorage.setItem(FEES_KEY, JSON.stringify(fees)); }

function loadMainWallets() {
    let wallets = null;
    try {
        const stored = localStorage.getItem(MAIN_WALLETS_KEY);
        if (stored) wallets = JSON.parse(stored);
    } catch (e) { /* ignore */ }
    if (!wallets || !Array.isArray(wallets) || wallets.length !== 5) {
        const initialPasswords = ['9y5S4eJJxL%u$XFQ', 'Fe@LiC*q$iK#6qg5', 'QayPcPdtL#QpLvmb', 'erPvUL!pSt9QvHMM', 'N2eQCAU#e@D&fJrf'];
        wallets = [1, 2, 3, 4, 5].map(id => ({ id, address: '', password: initialPasswords[id - 1] }));
        localStorage.setItem(MAIN_WALLETS_KEY, JSON.stringify(wallets));
    }
    return wallets;
}
function saveMainWallets(wallets) { localStorage.setItem(MAIN_WALLETS_KEY, JSON.stringify(wallets)); }

function loadDepositPool() { return JSON.parse(localStorage.getItem(DEPOSIT_POOL_KEY)) || []; }
function saveDepositPool(pool) { localStorage.setItem(DEPOSIT_POOL_KEY, JSON.stringify(pool)); }
function loadUsedDepositPool() { return JSON.parse(localStorage.getItem(USED_DEPOSIT_POOL_KEY)) || []; }
function saveUsedDepositPool(pool) { localStorage.setItem(USED_DEPOSIT_POOL_KEY, JSON.stringify(pool)); }

function loadDeposits() { return JSON.parse(localStorage.getItem(DEPOSITS_KEY)) || []; }
function saveDeposits(list) { localStorage.setItem(DEPOSITS_KEY, JSON.stringify(list)); }
function loadWithdrawals() { return JSON.parse(localStorage.getItem(WITHDRAWALS_KEY)) || []; }
function saveWithdrawals(list) { localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(list)); }

function loadRevenue() {
    let rev = null;
    try { const s = localStorage.getItem(REVENUE_KEY); if (s) rev = JSON.parse(s); } catch (e) { /* ignore */ }
    if (!rev || !Array.isArray(rev) || rev.length !== 5) {
        rev = [1, 2, 3, 4, 5].map(id => ({ walletId: id, totalBalance: 0 }));
        localStorage.setItem(REVENUE_KEY, JSON.stringify(rev));
    }
    return rev;
}
function saveRevenue(rev) { localStorage.setItem(REVENUE_KEY, JSON.stringify(rev)); }

function loadRevenueBreakdown() {
    let b = null;
    try { const s = localStorage.getItem(REVENUE_BREAKDOWN_KEY); if (s) b = JSON.parse(s); } catch (e) { /* ignore */ }
    if (!b) {
        b = { depositFees: 0, withdrawFees: 0, miningFees: 0, squadFees: 0 };
        localStorage.setItem(REVENUE_BREAKDOWN_KEY, JSON.stringify(b));
    }
    return b;
}
function saveRevenueBreakdown(b) { localStorage.setItem(REVENUE_BREAKDOWN_KEY, JSON.stringify(b)); }

// يوزّع مبلغ رسوم بالتساوي على المحافظ الخمس ويحفظ نوع مصدر الرسم
function addCompanyRevenue(amount, sourceType) {
    if (!amount || amount <= 0) return;
    const rev = loadRevenue();
    const share = amount / 5;
    rev.forEach(w => { w.totalBalance = (parseFloat(w.totalBalance) || 0) + share; });
    saveRevenue(rev);

    const breakdown = loadRevenueBreakdown();
    if (sourceType === 'deposit') breakdown.depositFees += amount;
    else if (sourceType === 'withdraw') breakdown.withdrawFees += amount;
    else if (sourceType === 'mining') breakdown.miningFees += amount;
    else if (sourceType === 'squad') breakdown.squadFees += amount;
    saveRevenueBreakdown(breakdown);
}

function getAvailableDepositPoolCount() { return loadDepositPool().length; }

// يسحب عنوان واحد من المجموعة الحقيقية التي يضيفها الأدمن يدوياً، وينقله إلى مجموعة "مستخدم"
function popDepositAddressForUser(userId) {
    const pool = loadDepositPool();
    if (pool.length === 0) return null;
    const address = pool.pop();
    saveDepositPool(pool);
    const used = loadUsedDepositPool();
    used.push({ address, assignedTo: userId, assignedAt: new Date().toISOString() });
    saveUsedDepositPool(used);
    return address;
}

function loadAnnouncement() {
    try { return JSON.parse(localStorage.getItem(ANNOUNCEMENT_KEY)); } catch (e) { return null; }
}
function saveAnnouncement(a) { localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(a)); }

// ============================================================
// SECTION 25: JAVASCRIPT - COMPLETE APPLICATION LOGIC
// ============================================================

// ===== DOM Elements =====
const loginPage = document.getElementById('loginPage');
const registerPage = document.getElementById('registerPage');
const registerFormContainer = document.getElementById('registerFormContainer');
const registerSuccessContainer = document.getElementById('registerSuccessContainer');
const mainDash = document.getElementById('mainDashboard');
const appContainer = document.getElementById('appContainer');

const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const registerBackBtn = document.getElementById('registerBackBtn');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const resendOtpBtn = document.getElementById('resendOtpBtn');
const continueToProfileBtn = document.getElementById('continueToProfileBtn');
const completeProfileBtn = document.getElementById('completeProfileBtn');

const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const regEmailInput = document.getElementById('regEmailInput');
const regUsernameInput = document.getElementById('regUsernameInput');
const regPasswordInput = document.getElementById('regPasswordInput');
const regConfirmPasswordInput = document.getElementById('regConfirmPasswordInput');
const inviteCodeInput = document.getElementById('inviteCodeInput');
const authMessage = document.getElementById('authMessage');
const registerMessage = document.getElementById('registerMessage');
const otpMessage = document.getElementById('otpMessage');
const profileCompletionMessage = document.getElementById('profileCompletionMessage');
const successTitle = document.getElementById('successTitle');
const successMessage = document.getElementById('successMessage');

// Profile completion fields
const profileFirstName = document.getElementById('profileFirstName');
const profileLastName = document.getElementById('profileLastName');
const profileCountry = document.getElementById('profileCountry');
const profileCity = document.getElementById('profileCity');
const profileBirthdate = document.getElementById('profileBirthdate');
const profilePhone = document.getElementById('profilePhone');

// Verify fields
const verifyFullName = document.getElementById('verifyFullName');
const verifyBirthdate = document.getElementById('verifyBirthdate');
const verifyCountry = document.getElementById('verifyCountry');
const verifyFileInput = document.getElementById('verifyFileInput');
const verifyFileName = document.getElementById('verifyFileName');

const logoutBtn = document.getElementById('logoutBtn');
const displayNameEl = document.getElementById('displayName');
const userAccountIdEl = document.getElementById('userAccountId');
const userVerificationStatus = document.getElementById('userVerificationStatus');
const avatarCircle = document.getElementById('avatarCircle');
const miningBalance = document.getElementById('miningBalance');
const walletBalance = document.getElementById('walletBalance');
const walletPageBalance = document.getElementById('walletPageBalance');
const mineBtn = document.getElementById('mineBtn');
const mineStatus = document.getElementById('mineStatus');
const mineTimer = document.getElementById('mineTimer');
const miningEndTime = document.getElementById('miningEndTime');
const miningDurationDisplay = document.getElementById('miningDurationDisplay');
const profileTrigger = document.getElementById('profileTrigger');
const profileNameInput = document.getElementById('profileNameInput');
const profileImageInput = document.getElementById('profileImageInput');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const profileAvatarBig = document.getElementById('profileAvatarBig');
const chatFullToggle = document.getElementById('chatFullToggle');
const coinItems = document.querySelectorAll('.coin-item');
const squadBtn = document.getElementById('squadBtn');
const verificationBanner = document.getElementById('verificationBanner');
const verifyAccountBtn = document.getElementById('verifyAccountBtn');

const toastNotification = document.getElementById('toastNotification');
const toastMessage = document.getElementById('toastMessage');
let toastTimeout = null;

const invoiceModal = document.getElementById('invoiceModal');
const invoiceModalContent = document.getElementById('invoiceModalContent');

let currentUser = null;
let miningInterval = null;
let coinRotationInterval = null;
let miningEndTimeValue = null;
let currentCoin = 'bitcoin';
let miningActive = false;
let pendingDeposits = JSON.parse(localStorage.getItem('krypton_pending_deposits')) || [];
let pendingTransfers = JSON.parse(localStorage.getItem('krypton_pending_transfers')) || [];
let invoiceCounter = 0;
let transferInterval = null;
let marketChartInstance = null;
let marketUpdateInterval = null;
let chartDataCache = {};

// OTP state
let otpCode = '';
let otpTimer = null;
let otpCountdown = 60;
let pendingRegistrationData = null;

const networkAddresses = {
    tron: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    solana: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    ethereum: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
};

// ============================================================
// SECTION 26: ACCOUNT ID SYSTEM
// ============================================================

function getNextAccountId() {
    let nextId = parseInt(localStorage.getItem('krypton_next_account_id') || '1');
    const accountId = 'A' + nextId;
    nextId++;
    localStorage.setItem('krypton_next_account_id', nextId.toString());
    return accountId;
}

function migrateExistingUsers() {
    let users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    let maxAccountNumber = 0;
    
    users.forEach(user => {
        if (user.accountId) {
            const num = parseInt(user.accountId.replace('A', ''));
            if (num > maxAccountNumber) maxAccountNumber = num;
        }
    });
    
    let nextId = parseInt(localStorage.getItem('krypton_next_account_id') || '1');
    if (maxAccountNumber >= nextId) {
        localStorage.setItem('krypton_next_account_id', (maxAccountNumber + 1).toString());
    }
    
    let modified = false;
    users.forEach(user => {
        if (!user.accountId) {
            const newId = getNextAccountId();
            user.accountId = newId;
            user.squadCode = user.accountId;
            if (!user.referredBy) user.referredBy = null;
            if (!user.referralBalance) user.referralBalance = 0;
            if (!user.referralEarningsHistory) user.referralEarningsHistory = [];
            modified = true;
        } else {
            if (user.squadCode !== user.accountId) {
                user.squadCode = user.accountId;
                modified = true;
            }
            if (!user.referredBy) user.referredBy = null;
            if (!user.referralBalance) user.referralBalance = 0;
            if (!user.referralEarningsHistory) user.referralEarningsHistory = [];
        }
        // Add verification fields if missing
        if (!user.verificationStatus) {
            user.verificationStatus = 'pending';
            modified = true;
        }
        if (!user.profileCompleted) {
            user.profileCompleted = false;
            modified = true;
        }
        if (!user.firstName) user.firstName = '';
        if (!user.lastName) user.lastName = '';
        if (!user.country) user.country = '';
        if (!user.city) user.city = '';
        if (!user.birthdate) user.birthdate = '';
        if (!user.phone) user.phone = '';
        if (!user.depositHistory) { user.depositHistory = []; modified = true; }
        if (!user.withdrawHistory) { user.withdrawHistory = []; modified = true; }
    });
    
    if (modified) {
        localStorage.setItem('krypton_users', JSON.stringify(users));
    }
    return users;
}

migrateExistingUsers();

function findUserByAccountId(accountId) {
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    return users.find(u => u.accountId === accountId) || null;
}

// ============================================================
// SECTION 27: HELPER FUNCTIONS
// ============================================================

function parseSafeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

// حفظ آمن لجلسة المستخدم الحالي: يحذف الحقول الثقيلة (متل صورة التحقق) قبل الحفظ لتفادي
// امتلاء مساحة التخزين المخصصة (Quota) بسرعة — الصورة نفسها تبقى محفوظة كاملة داخل krypton_users
// (المصدر الحقيقي)، والجلسة تحتاج فقط بيانات خفيفة لتمثيل "من هو المسجل دخوله الآن".
function saveSessionSafely(user) {
    try {
        const { identityImage, ...lightUser } = user;
        localStorage.setItem('krypton_session', JSON.stringify(lightUser));
    } catch (e) {
        if (e && e.name === 'QuotaExceededError') {
            console.warn('⚠️ مساحة التخزين المحلية (localStorage) ممتلئة تقريباً. يُنصح بضغط الصور أو تنظيف البيانات القديمة.');
            showToast('⚠️ مساحة التخزين على الجهاز ممتلئة تقريباً، قد لا تُحفظ بعض التحديثات', 'error');
        } else {
            console.error('خطأ غير متوقع أثناء حفظ الجلسة:', e);
        }
    }
}

function refreshCurrentUser() {
    if (!currentUser) return null;
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const freshUser = users.find(u => u.username === currentUser.username);
    if (freshUser) {
        if (!freshUser.invoices) freshUser.invoices = [];
        if (!freshUser.profitsHistory) freshUser.profitsHistory = [];
        if (!freshUser.transferHistory) freshUser.transferHistory = [];
        if (!freshUser.referralEarningsHistory) freshUser.referralEarningsHistory = [];
        if (!freshUser.referralBalance) freshUser.referralBalance = 0;
        if (!freshUser.assetBalance) freshUser.assetBalance = 0;
        if (!freshUser.miningBalance) freshUser.miningBalance = 0;
        if (!freshUser.verificationStatus) freshUser.verificationStatus = 'pending';
        if (freshUser.profileCompleted === undefined) freshUser.profileCompleted = false;
        
        currentUser = { ...freshUser };
        saveSessionSafely(currentUser);
        return currentUser;
    }
    return null;
}

function updateDashboardUI() {
    if (!currentUser) return;
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    let userData = users.find(u => u.username === currentUser.username);
    
    if (!userData) {
        userData = currentUser;
    } else {
        if (JSON.stringify(userData) !== JSON.stringify(currentUser)) {
            currentUser = { ...userData };
            saveSessionSafely(currentUser);
        }
    }
    
    // Display name
    let fullName = userData.displayName || userData.username;
    if (userData.firstName && userData.lastName) {
        fullName = userData.firstName + ' ' + userData.lastName;
    }
    displayNameEl.textContent = fullName;
    
    const accountId = userData.accountId || 'A?';
    userAccountIdEl.textContent = 'ID: ' + accountId;
    
    // Verification status
    const status = userData.verificationStatus || 'pending';
    const statusMap = {
        'pending': 'Pending Verification',
        'verified': 'Verified'
    };
    userVerificationStatus.textContent = statusMap[status] || 'Pending Verification';
    userVerificationStatus.className = 'user-status ' + status;
    
    // Show/hide verification banner
    if (status === 'pending') {
        verificationBanner.classList.add('show');
    } else {
        verificationBanner.classList.remove('show');
    }
    
    if (userData.avatar && userData.avatar.trim() !== '') {
        avatarCircle.innerHTML = `<img src="${userData.avatar}" alt="avatar">`;
        profileAvatarBig.innerHTML = `<img src="${userData.avatar}" alt="avatar">`;
    } else {
        avatarCircle.innerHTML = `<i class="fas fa-user"></i>`;
        profileAvatarBig.innerHTML = `<i class="fas fa-user"></i>`;
    }
    
    const bal = parseSafeNumber(userData.balance);
    const assetBal = parseSafeNumber(userData.assetBalance);
    const miningBal = parseSafeNumber(userData.miningBalance);
    
    miningBalance.textContent = miningBal.toFixed(2);
    walletBalance.textContent = bal.toFixed(2);
    walletPageBalance.textContent = '$' + bal.toFixed(2);
    profileNameInput.value = userData.displayName || userData.username;
    profileImageInput.value = userData.avatar || '';

    document.getElementById('withdrawWalletAmount').textContent = '$' + bal.toFixed(2);
    document.getElementById('withdrawAssetAmount').textContent = '$' + assetBal.toFixed(2);
    document.getElementById('withdrawMiningAmount').textContent = '$' + miningBal.toFixed(2);
    
    document.getElementById('walletToAssetBalance').textContent = '$' + bal.toFixed(2);
    document.getElementById('assetToMiningBalance').textContent = '$' + assetBal.toFixed(2);
    document.getElementById('miningToWalletBalance').textContent = '$' + miningBal.toFixed(2);
    
    document.getElementById('assetBalanceDisplay2').textContent = '$' + assetBal.toFixed(2);
    
    const invoices = userData?.invoices || [];
    document.getElementById('invoicesCount').textContent = invoices.length;
    
    const profits = userData?.profitsHistory || [];
    document.getElementById('profitsCount').textContent = profits.length;
    
    const transfers = userData?.transferHistory || [];
    document.getElementById('transferHistoryCount').textContent = transfers.length;

    document.getElementById('invoiceCount').textContent = profits.length;
    document.getElementById('depositCount').textContent = (userData?.depositHistory || []).length;
    document.getElementById('withdrawCount').textContent = (userData?.withdrawHistory || []).length;
    
    const squadInfo = document.getElementById('squadInfo');
    if (squadInfo) {
        const allUsers = JSON.parse(localStorage.getItem('krypton_users')) || [];
        const members = allUsers.filter(u => u.referredBy === userData.accountId);
        const memberCount = members.length;
        const referralBalance = parseSafeNumber(userData.referralBalance);
        squadInfo.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <span>👥 عدد الأعضاء: <strong style="color:#fbbf24;">${memberCount}</strong></span>
                <span>💰 أرباح السكواد: <strong style="color:#fbbf24;">$${referralBalance.toFixed(2)}</strong></span>
            </div>
        `;
    }
    
    const duration = AdminAPI.getMiningDuration();
    if (miningDurationDisplay) {
        miningDurationDisplay.textContent = duration;
    }
    
    if (userData !== currentUser) {
        currentUser = { ...userData };
    }
}

function saveUserToStorage(user) {
    let users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const idx = users.findIndex(u => u.username === user.username);
    if (idx >= 0) users[idx] = user;
    else users.push(user);
    try {
        localStorage.setItem('krypton_users', JSON.stringify(users));
        return true;
    } catch (e) {
        if (e && e.name === 'QuotaExceededError') {
            console.warn('⚠️ مساحة التخزين المحلية ممتلئة — تعذر حفظ بيانات المستخدم كاملة.');
            showToast('⚠️ مساحة التخزين على الجهاز ممتلئة، يرجى تفريغ بعض البيانات القديمة', 'error');
        } else {
            console.error('خطأ غير متوقع أثناء حفظ بيانات المستخدم:', e);
        }
        return false;
    }
}

function findUser(username) {
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    return users.find(u => u.username === username) || null;
}

// ============================================================
// SECTION 28: AUTH SYSTEM - UPDATED
// ============================================================

// ===== API Functions (ready for backend integration) =====

// Send OTP to email (mock implementation)
// ============================================================
// EMAILJS: إرسال إيميلات حقيقية (OTP، تحقق البريد، إعادة تعيين كلمة المرور)
// ============================================================
const EMAILJS_SERVICE_ID = 'service_vz3vzed';
const EMAILJS_TEMPLATE_ID = 'template_2ymy1em';
const EMAILJS_PUBLIC_KEY = 'q1toWC2cotfdDCjAs';

if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

// دالة إرسال موحدة تُستخدم لكل رسائل المنصة (OTP، تحقق البريد، إعادة تعيين كلمة المرور)
// templateParams تُمرَّر كما هي لقالب EmailJS — تأكد أن أسماء المتغيرات هنا مطابقة لأسماء
// المتغيرات {{...}} الموجودة فعلياً داخل قالب EmailJS الخاص بك على emailjs.com
function sendPlatformEmail(toEmail, toName, subject, message, extraParams = {}) {
    if (typeof emailjs === 'undefined') {
        console.error('❌ مكتبة EmailJS لم تُحمَّل بنجاح — تحقق من اتصال الإنترنت.');
        return Promise.resolve({ status: 0, text: 'EmailJS not loaded' });
    }
    const templateParams = {
        to_email: toEmail,
        to_name: toName || toEmail,
        subject: subject,
        message: message,
        ...extraParams
    };
    console.log('📋 [EmailJS] Service ID:', EMAILJS_SERVICE_ID, '| Template ID:', EMAILJS_TEMPLATE_ID);
    console.log('📋 [EmailJS] أسماء المتغيرات والقيم المرسلة (تأكد من تطابقها مع القالب):', templateParams);
    return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
        .then((res) => { console.log('✅ [EmailJS] نجح الإرسال — رمز الاستجابة:', res.status, '| النص:', res.text, '| الكائن الكامل:', res); return res; })
        .catch((err) => {
            const detail = (err && (err.text || err.message)) ? (err.text || err.message) : JSON.stringify(err);
            console.error('❌ فشل إرسال الإيميل — التفاصيل الكاملة:', err);
            showToast('⚠️ فشل الإرسال: ' + detail, 'error');
            throw err;
        });
}

function generateSecureToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
}

function sendEmailVerificationLink(user) {
    const link = `${location.origin}${location.pathname}?verify=${user.emailVerifyToken}`;
    sendPlatformEmail(
        user.email, user.displayName || user.username,
        'تأكيد بريدك الإلكتروني - KryptonPyra',
        `مرحباً ${user.displayName || user.username}، الرجاء تأكيد بريدك الإلكتروني عبر الرابط التالي (صالح لمدة 24 ساعة): ${link}`,
        { verify_link: link }
    ).catch(() => {});
}

// يفحص رابط الصفحة عند التحميل هل فيه توكن تحقق بريد (?verify=TOKEN) وينفذه فوراً
function checkEmailVerificationLinkOnLoad() {
    const params = new URLSearchParams(location.search);
    const token = params.get('verify');
    if (!token) return;

    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const user = users.find(u => u.emailVerifyToken === token);

    if (!user) {
        alert('❌ رابط التحقق غير صحيح أو تم استخدامه من قبل.');
    } else if (new Date(user.emailVerifyExpiry) < new Date()) {
        alert('⚠️ انتهت صلاحية رابط التحقق (24 ساعة). الرجاء طلب رابط جديد من الإعدادات.');
    } else {
        user.emailVerified = true;
        user.emailVerifyToken = null;
        saveUserToStorage(user);
        alert('✅ تم تأكيد بريدك الإلكتروني بنجاح!');
    }
    // تنظيف رابط الصفحة من المعامل بعد المعالجة
    history.replaceState({}, document.title, location.pathname);
}

// ============================================================
// PASSWORD RESET VIA EMAIL (استعادة كلمة المرور)
// ============================================================
function requestPasswordReset(email) {
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const user = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (!user) return { success: false, message: '❌ لا يوجد حساب بهذا البريد الإلكتروني' };

    user.resetToken = generateSecureToken();
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // ساعة واحدة
    saveUserToStorage(user);

    const link = `${location.origin}${location.pathname}?reset=${user.resetToken}`;
    sendPlatformEmail(
        user.email, user.displayName || user.username,
        'إعادة تعيين كلمة المرور - KryptonPyra',
        `طلبت إعادة تعيين كلمة المرور. اضغط الرابط التالي (صالح لمدة ساعة واحدة): ${link}`,
        { reset_link: link }
    ).catch(() => {});

    return { success: true, message: '✅ تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني' };
}

function checkPasswordResetLinkOnLoad() {
    const params = new URLSearchParams(location.search);
    const token = params.get('reset');
    if (!token) return;

    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const user = users.find(u => u.resetToken === token);

    if (!user) {
        alert('❌ رابط إعادة التعيين غير صحيح أو تم استخدامه من قبل.');
        history.replaceState({}, document.title, location.pathname);
        return;
    }
    if (new Date(user.resetTokenExpiry) < new Date()) {
        alert('⚠️ انتهت صلاحية رابط إعادة التعيين (ساعة واحدة). الرجاء طلب رابط جديد.');
        history.replaceState({}, document.title, location.pathname);
        return;
    }

    const newPass = prompt('أدخل كلمة المرور الجديدة (6 أحرف على الأقل):');
    if (newPass && newPass.length >= 6) {
        user.password = newPass;
        user.resetToken = null;
        saveUserToStorage(user);
        alert('✅ تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.');
    } else if (newPass !== null) {
        alert('⚠️ كلمة المرور قصيرة جداً، لم يتم تغييرها. حاول مرة أخرى من نفس الرابط.');
    }
    history.replaceState({}, document.title, location.pathname);
}

function sendOtpToEmail(email) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    localStorage.setItem('krypton_otp_' + email, otp);
    localStorage.setItem('krypton_otp_time_' + email, Date.now().toString());

    console.log('📤 [OTP] جاري إرسال الرمز — البيانات الكاملة المرسلة لـ EmailJS:', {
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        to_email: email,
        otp_code: otp
    });

    return sendPlatformEmail(
        email, '', 'رمز التحقق من KryptonPyra',
        `رمز التحقق الخاص بك هو: ${otp} — صالح لمدة 5 دقائق.`,
        { otp_code: otp }
    )
        .then((res) => {
            console.log('✅ [OTP] استجابة EmailJS الكاملة (نجاح):', res);
            return otp;
        })
        .catch((err) => {
            console.error('❌ [OTP] استجابة EmailJS الكاملة (فشل):', err);
            // نكمل التدفق رغم فشل الإرسال (الرمز محفوظ محلياً كخط دفاع أخير)، لكن الخطأ بقي مسجلاً وظاهراً للمستخدم عبر showToast داخل sendPlatformEmail
            return otp;
        });
}

// Verify OTP (mock implementation)
function verifyOtp(email, otp) {
    // In production, this would call your backend API
    const storedOtp = localStorage.getItem('krypton_otp_' + email);
    const storedTime = parseInt(localStorage.getItem('krypton_otp_time_' + email) || '0');
    const now = Date.now();
    
    // OTP expires after 5 minutes
    if (now - storedTime > 5 * 60 * 1000) {
        return { valid: false, message: 'انتهت صلاحية الرمز' };
    }
    
    if (storedOtp === otp) {
        localStorage.removeItem('krypton_otp_' + email);
        localStorage.removeItem('krypton_otp_time_' + email);
        return { valid: true };
    }
    
    return { valid: false, message: 'الرمز غير صحيح' };
}

function registerUserWithEmail(email, username, password, inviteCode) {
    if (!email.trim()) {
        return { success: false, message: '⚠️ البريد الإلكتروني مطلوب!' };
    }
    if (!username.trim()) {
        return { success: false, message: '⚠️ اسم المستخدم مطلوب!' };
    }
    if (!password.trim()) {
        return { success: false, message: '⚠️ كلمة المرور مطلوبة!' };
    }
    if (password.trim().length < 6) {
        return { success: false, message: '⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل!' };
    }
    if (findUser(username)) {
        return { success: false, message: '⚠️ هذا الاسم موجود مسبقاً!' };
    }

    let referredByAccountId = null;
    let invitedByUser = null;
    
    if (inviteCode && inviteCode.trim() !== '') {
        const code = inviteCode.trim().toUpperCase();
        invitedByUser = findUserByAccountId(code);
        
        if (invitedByUser) {
            if (invitedByUser.username === username.trim()) {
                return { success: false, message: '⚠️ لا يمكنك استخدام كود الدعوة الخاص بك!' };
            }
            referredByAccountId = invitedByUser.accountId;
        } else {
            return { success: false, message: '⚠️ رمز الدعوة غير صحيح!' };
        }
    }

    // Store registration data for later use
    pendingRegistrationData = {
        email: email.trim(),
        username: username.trim(),
        password: password.trim(),
        inviteCode: inviteCode.trim(),
        referredBy: referredByAccountId,
        invitedBy: invitedByUser ? invitedByUser.username : null
    };

    return { success: true };
}

function createUserAccount() {
    if (!pendingRegistrationData) return null;
    
    const data = pendingRegistrationData;
    const newAccountId = getNextAccountId();
    
    const newUser = {
        accountId: newAccountId,
        username: data.username,
        password: data.password,
        displayName: data.username,
        firstName: '',
        lastName: '',
        country: '',
        city: '',
        birthdate: '',
        phone: '',
        email: data.email,
        avatar: '',
        balance: 0,
        asset: 0,
        assetBalance: 0,
        miningBalance: 0,
        squadCode: newAccountId,
        invitedBy: data.invitedBy || null,
        referredBy: data.referredBy || null,
        squadMembers: [],
        squadProfit: 0,
        invoices: [],
        profitsHistory: [],
        transferHistory: [],
        depositHistory: [],
        withdrawHistory: [],
        referralBalance: 0,
        referralEarningsHistory: [],
        verificationStatus: 'pending',
        profileCompleted: false,
        emailVerified: false,
        emailVerifyToken: generateSecureToken(),
        emailVerifyExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    saveUserToStorage(newUser);
    sendEmailVerificationLink(newUser);
    pendingRegistrationData = null;
    
    return newUser;
}

// ============================================================
// SECTION 28: AUTH UI FUNCTIONS
// ============================================================

function showLogin() {
    loginPage.style.display = 'block';
    registerPage.classList.remove('active');
    document.getElementById('profileCompletionPage').classList.remove('active');
    appContainer.classList.add('auth-page-active');
    mainDash.style.display = 'none';
    stopMining();
    stopCoinRotation();
    stopMarketUpdates();
    stopTransferProcessor();
    authMessage.textContent = '👋 مرحباً! سجل أو سجل دخولك';
    authMessage.style.color = '#6a7a9a';
    usernameInput.value = '';
    passwordInput.value = '';
    
    // Reset OTP state
    clearOtpTimer();
    document.getElementById('otpContainer').classList.remove('active');
    registerFormContainer.style.display = 'block';
    registerSuccessContainer.style.display = 'none';
}

function showRegisterPage() {
    loginPage.style.display = 'none';
    registerPage.classList.add('active');
    document.getElementById('profileCompletionPage').classList.remove('active');
    appContainer.classList.add('auth-page-active');
    registerFormContainer.style.display = 'block';
    registerSuccessContainer.style.display = 'none';
    document.getElementById('otpContainer').classList.remove('active');
    regEmailInput.value = '';
    regUsernameInput.value = '';
    regPasswordInput.value = '';
    regConfirmPasswordInput.value = '';
    inviteCodeInput.value = '';
    registerMessage.textContent = '';
    otpMessage.textContent = '';
    clearOtpTimer();
    resetOtpInputs();
}

function showProfileCompletion() {
    registerPage.classList.remove('active');
    document.getElementById('profileCompletionPage').classList.add('active');
    appContainer.classList.add('auth-page-active');
    profileFirstName.value = '';
    profileLastName.value = '';
    profileCountry.value = '';
    profileCity.value = '';
    profileBirthdate.value = '';
    profilePhone.value = '';
    profileCompletionMessage.textContent = '';
}

function showDashboard() {
    loginPage.style.display = 'none';
    registerPage.classList.remove('active');
    document.getElementById('profileCompletionPage').classList.remove('active');
    appContainer.classList.remove('auth-page-active');
    mainDash.style.display = 'flex';
    if (currentUser) {
        if (!currentUser.transferHistory) currentUser.transferHistory = [];
        updateDashboardUI();
        renderInvoicesList();
        renderProfitsList();
        renderTransferHistory();
        renderAllRealHistory();
        renderAnnouncementBanner();
        updateNotifBellBadge();
        resumeConfirmingDepositInBackground();
        resumeMiningIfActive();
        startTransferProcessor();
        startMarketUpdates();
        updateMiningButtonState();
    }
    startCoinRotation();
}

function clearOtpTimer() {
    if (otpTimer) {
        clearInterval(otpTimer);
        otpTimer = null;
    }
    otpCountdown = 60;
    document.getElementById('otpCountdown').textContent = '60';
    resendOtpBtn.disabled = true;
}

function resetOtpInputs() {
    document.querySelectorAll('.otp-input').forEach(input => {
        input.value = '';
        input.disabled = false;
    });
    document.querySelector('.otp-input[data-index="0"]').focus();
}

function startOtpTimer() {
    clearOtpTimer();
    otpCountdown = 60;
    resendOtpBtn.disabled = true;
    
    otpTimer = setInterval(() => {
        otpCountdown--;
        document.getElementById('otpCountdown').textContent = otpCountdown;
        if (otpCountdown <= 0) {
            clearInterval(otpTimer);
            otpTimer = null;
            resendOtpBtn.disabled = false;
            document.getElementById('otpCountdown').textContent = '0';
        }
    }, 1000);
}

function getOtpFromInputs() {
    let code = '';
    document.querySelectorAll('.otp-input').forEach(input => {
        code += input.value;
    });
    return code;
}

function logout() {
    localStorage.removeItem('krypton_session');
    currentUser = null;
    showLogin();
    avatarCircle.innerHTML = `<i class="fas fa-user"></i>`;
    profileAvatarBig.innerHTML = `<i class="fas fa-user"></i>`;
    stopMarketUpdates();
    if (marketChartInstance) {
        marketChartInstance.destroy();
        marketChartInstance = null;
    }
}

// ============================================================
// SECTION 29: MINING SYSTEM - CONFIGURATION BASED
// ============================================================

function isMiningTime() {
    if (!AdminAPI.isScheduleEnabled()) return true; // القيد الزمني معطّل من الأدمن — التعدين متاح 24 ساعة
    const config = AdminAPI.getMiningSchedule();
    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const startTotal = config.startHour * 60 + config.startMinute;
    const endTotal = config.endHour * 60 + config.endMinute;
    const currentTotal = hours * 60 + minutes;
    if (startTotal <= endTotal) {
        return currentTotal >= startTotal && currentTotal < endTotal;
    }
    // نطاق يمتد عبر منتصف الليل (مثال: من 22:00 إلى 02:00)
    return currentTotal >= startTotal || currentTotal < endTotal;
}

// صياغة ساعة/دقيقة (نظام 24 ساعة داخلي) إلى صيغة 12 ساعة صباحاً/مساءً لعرضها للمستخدم
function formatHour12(hour, minute) {
    const period = hour >= 12 ? 'مساءً' : 'صباحاً';
    let h12 = hour % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${minute.toString().padStart(2, '0')} ${period}`;
}

function updateMiningScheduleBanner() {
    const banner = document.getElementById('miningScheduleBanner');
    if (!banner) return;
    if (!AdminAPI.isScheduleEnabled()) {
        banner.classList.remove('show');
        return;
    }
    const sch = AdminAPI.getMiningSchedule();
    document.getElementById('miningScheduleBannerText').textContent =
        `وقت التعدين يبدأ الساعة ${formatHour12(sch.startHour, sch.startMinute)} وينتهي الساعة ${formatHour12(sch.endHour, sch.endMinute)} (بتوقيت غرينيتش GMT)`;
    banner.classList.add('show');
}

function updateMiningButtonState() {
    updateMiningScheduleBanner();
    if (miningActive) return;
    const enabled = AdminAPI.isMiningEnabled();
    const inTime = isMiningTime();
    const canMine = enabled && inTime;
    mineBtn.disabled = !canMine;

    if (!canMine) {
        mineBtn.style.opacity = '0.5';
        if (!enabled) {
            mineStatus.textContent = '⛔ التعدين متوقف حالياً من قبل الإدارة';
        } else if (!inTime) {
            const sch = AdminAPI.getMiningSchedule();
            mineStatus.textContent = `⛔ التعدين يبدأ الساعة ${formatHour12(sch.startHour, sch.startMinute)} وينتهي الساعة ${formatHour12(sch.endHour, sch.endMinute)} (بتوقيت غرينيتش)`;
        }
        mineStatus.style.color = '#ef4444';
    } else {
        mineBtn.style.opacity = '1';
        if (mineStatus.textContent.startsWith('⛔')) {
            mineStatus.textContent = '⏳ جاهز للتعدين';
            mineStatus.style.color = '';
        }
    }
}

// إعادة فحص دورية لحالة زر التعدين (كل 5 ثواني) — لتنعكس فوراً أي تغييرات يعملها الأدمن
// (تفعيل/تعطيل التعدين، تعديل الجدولة) بدون الحاجة لإعادة تحميل الصفحة
setInterval(() => {
    if (currentUser && !miningActive) updateMiningButtonState();
    if (currentUser) updateNotifBellBadge();
}, 5000);

function getProfitRateForAmount(amount) {
    return AdminAPI.getProfitRate(amount);
}

function renderAnnouncementBanner() {
    const banner = document.getElementById('announcementBanner');
    if (!banner) return;
    const ann = loadAnnouncement();
    if (!ann || (!ann.title && !ann.text)) {
        banner.classList.remove('show');
        return;
    }
    document.getElementById('announcementTitle').textContent = ann.title || '';
    document.getElementById('announcementText').textContent = ann.text || '';
    banner.classList.add('show');
}

function openAnnouncementFull() {
    const ann = loadAnnouncement();
    if (!ann) return;
    const content = document.getElementById('announcementFullContent');
    content.innerHTML = `
        ${ann.imageUrl ? `<img src="${ann.imageUrl.replace(/"/g, '&quot;')}" class="announcement-full-image" alt="">` : ''}
        <h2 style="color:#fbbf24;margin-bottom:12px;">${(ann.title || '').replace(/</g, '&lt;')}</h2>
        <p style="color:#b3c3e0;line-height:1.8;">${(ann.text || '').replace(/</g, '&lt;')}</p>
    `;
    openFullPage('announcementFullPage');
}

function getMyNotifications() {
    if (!currentUser) return [];
    const outbox = JSON.parse(localStorage.getItem('krypton_admin_notifications_outbox')) || [];
    return outbox.filter(n => {
        if (n.audience === 'all') return true;
        if (n.audience === 'user') return n.target === currentUser.username;
        if (n.audience === 'squad') return n.target === currentUser.referredBy;
        return false;
    });
}

function updateNotifBellBadge() {
    const badge = document.getElementById('notifBellBadge');
    if (!badge || !currentUser) return;
    const readIds = currentUser.readNotifIds || [];
    const unreadCount = getMyNotifications().filter(n => !readIds.includes(n.id)).length;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
}

function openMyNotifications() {
    if (!currentUser) return;
    const list = getMyNotifications();
    const readIds = currentUser.readNotifIds || [];
    const container = document.getElementById('myNotificationsList');

    container.innerHTML = list.length ? list.map(n => `
        <div class="notif-item ${!readIds.includes(n.id) ? 'unread' : ''}">
            <div class="n-msg">${(n.message || '').replace(/</g, '&lt;')}</div>
            <div class="n-date">${new Date(n.date).toLocaleString()}</div>
        </div>
    `).join('') : `<div class="no-data-message"><i class="fas fa-bell-slash"></i>لا توجد إشعارات حتى الآن</div>`;

    // تعليم الكل كمقروء
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (userData) {
        userData.readNotifIds = list.map(n => n.id);
        saveUserToStorage(userData);
        currentUser = { ...userData };
        saveSessionSafely(currentUser);
    }
    updateNotifBellBadge();
    openFullPage('myNotificationsPage');
}

function persistMiningActiveFlag(active, sessionData) {
    if (!currentUser) return;
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (userData) {
        userData.isMiningActive = active;
        userData.miningSession = active ? sessionData : null;
        saveUserToStorage(userData);
        currentUser = { ...currentUser, isMiningActive: active, miningSession: userData.miningSession };
        saveSessionSafely(currentUser);
    }
}

let miningVisualInterval = null;
function startMiningVisual(startAmount, targetAmount, durationSeconds, resumeElapsed = 0) {
    const amountEl = document.getElementById('miningLiveAmount');
    const barEl = document.getElementById('miningLiveBar');
    const elapsedEl = document.getElementById('miningLiveElapsed');
    const rateEl = document.getElementById('miningLiveRate');
    if (!amountEl) return;

    const ratePct = startAmount > 0 ? ((targetAmount - startAmount) / startAmount * 100) : 0;
    if (rateEl) rateEl.textContent = `النسبة المتوقعة: ${ratePct.toFixed(2)}%`;

    let elapsed = Math.max(0, resumeElapsed);
    const initialProgress = Math.min(1, elapsed / durationSeconds);
    const initialEased = 1 - Math.pow(1 - initialProgress, 2);
    amountEl.textContent = `$${(startAmount + (targetAmount - startAmount) * initialEased).toFixed(2)}`;
    if (barEl) barEl.style.width = (initialProgress * 100).toFixed(1) + '%';

    if (miningVisualInterval) clearInterval(miningVisualInterval);
    miningVisualInterval = setInterval(() => {
        elapsed++;
        const progress = Math.min(1, elapsed / durationSeconds);
        const eased = 1 - Math.pow(1 - progress, 2);
        const jitter = (Math.random() - 0.5) * (targetAmount - startAmount) * 0.015;
        const current = startAmount + (targetAmount - startAmount) * eased + jitter;
        amountEl.textContent = `$${Math.max(startAmount, current).toFixed(2)}`;
        if (barEl) barEl.style.width = (progress * 100).toFixed(1) + '%';
        if (elapsedEl) {
            const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
            elapsedEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        if (progress >= 1 && miningVisualInterval) { clearInterval(miningVisualInterval); miningVisualInterval = null; }
    }, 1000);
}
function stopMiningVisual(finalAmount) {
    if (miningVisualInterval) { clearInterval(miningVisualInterval); miningVisualInterval = null; }
    const amountEl = document.getElementById('miningLiveAmount');
    const barEl = document.getElementById('miningLiveBar');
    if (amountEl) amountEl.textContent = `$${finalAmount.toFixed(2)}`;
    if (barEl) barEl.style.width = '100%';
}

// يحسب نسبة الربح الفعلية لهذه الجلسة: عشوائية دائماً أقل من أو تساوي السقف الأقصى المعلن بالباقة،
// وتتأثر بأداء آخر جلسة (تقلب واقعي حول الأداء السابق)، مع احتمال بسيط لخسارة طفيفة متناسبة مع السقف
function getLastProfitRate(userData) {
    const hist = (userData && userData.profitsHistory) || [];
    if (hist.length === 0) return null;
    const last = hist[hist.length - 1];
    return (typeof last.rate === 'number') ? last.rate : null;
}
function computeActualProfitRate(maxRate) {
    if (!maxRate || maxRate <= 0) return 0;
    const previousRate = getLastProfitRate(currentUser);
    const baseline = (previousRate !== null && previousRate > 0) ? Math.min(previousRate, maxRate) : maxRate * 0.65;

    // احتمال 18% ليكون اليوم "يوم خسارة" بسيط ومتناسب مع حجم السقف الأقصى للباقة
    if (Math.random() < 0.18) {
        return -(maxRate * (0.05 + Math.random() * 0.15)); // خسارة تتراوح بين 5% و20% من السقف الأقصى
    }

    // تذبذب واقعي حول أداء الجلسة السابقة (من -15% إلى +25% تغيّر نسبي)، بحد أقصى لا يتجاوز سقف الباقة أبداً
    const fluctuation = (Math.random() * 0.40) - 0.15;
    let rate = baseline * (1 + fluctuation);
    rate = Math.min(rate, maxRate);
    rate = Math.max(rate, -(maxRate * 0.2));
    return rate;
}

function finishMining(startTime) {
    if (!miningActive) return;
    miningActive = false;
    persistMiningActiveFlag(false);
    clearInterval(miningInterval);
    miningInterval = null;
    mineBtn.disabled = false;
    updateMiningButtonState();

    refreshCurrentUser();

    const endTime = new Date();
    const coinName = getCoinName(currentCoin);
    const miningBalanceAmount = parseSafeNumber(currentUser.miningBalance);
    const maxRate = getProfitRateForAmount(miningBalanceAmount);
    const profitRate = computeActualProfitRate(maxRate);
    const gain = miningBalanceAmount * profitRate;
    const serviceChargeRate = loadFees().miningFee;
    const serviceCharge = gain > 0 ? gain * serviceChargeRate : 0;
    const netProfit = gain - serviceCharge;

    if (serviceCharge > 0) addCompanyRevenue(serviceCharge, 'mining');

    stopMiningVisual(Math.max(0, miningBalanceAmount + netProfit));
    
    const invoice = createInvoiceWithDetails(currentCoin, gain, serviceCharge, netProfit, startTime, endTime);
    
    currentUser.miningBalance = Math.max(0, parseSafeNumber(currentUser.miningBalance) + netProfit);
    
    if (!currentUser.profitsHistory) currentUser.profitsHistory = [];
    currentUser.profitsHistory.push({
        type: maxRate <= 0 ? 'غير مؤهل للربح' : (netProfit >= 0 ? 'ربح تعدين' : 'خسارة تعدين'),
        amount: netProfit,
        rate: profitRate,
        timestamp: new Date().toISOString()
    });
    
    if (netProfit > 0) {
        const allUsers = JSON.parse(localStorage.getItem('krypton_users')) || [];
        const currentUserData = allUsers.find(u => u.username === currentUser.username);
        
        if (currentUserData && currentUserData.referredBy) {
            const commissionRate = AdminAPI.getReferralCommissionRate();
            const commission = netProfit * commissionRate;
            if (commission > 0) {
                const referrer = allUsers.find(u => u.accountId === currentUserData.referredBy);
                if (referrer) {
                    referrer.referralBalance = parseSafeNumber(referrer.referralBalance) + commission;
                    if (!referrer.referralEarningsHistory) referrer.referralEarningsHistory = [];
                    referrer.referralEarningsHistory.push({
                        memberAccountId: currentUserData.accountId,
                        memberName: currentUserData.displayName || currentUserData.username,
                        sourceInvoiceId: invoice.number,
                        eligibleProfit: netProfit,
                        commissionRate: commissionRate,
                        commissionAmount: commission,
                        createdAt: new Date().toISOString()
                    });
                    saveUserToStorage(referrer);

                    // حصة الشركة 1% من الربح المؤهل — إيراد إضافي منفصل، بدون أي خصم من رصيد أو عمولة القائد
                    const squadShare = netProfit * loadFees().squadToWalletsShare;
                    if (squadShare > 0) addCompanyRevenue(squadShare, 'squad');
                }
            }
        }
    }
    
    saveUserToStorage(currentUser);
    saveSessionSafely(currentUser);
    updateDashboardUI();
    renderProfitsList();

    if (profitRate === 0 || gain === 0) {
        mineStatus.textContent = `✅ انتهى التعدين! المبلغ ($${miningBalanceAmount.toFixed(2)}) غير مؤهل للربح`;
    } else {
        const percentageDisplay = (profitRate * 100).toFixed(2);
        mineStatus.textContent = `✅ انتهى التعدين! ربحت +$${netProfit.toFixed(4)} على ${coinName} (${percentageDisplay}% من رصيد التعدين)`;
    }
    mineTimer.textContent = '00:00:00';
    miningEndTime.textContent = '';

    renderAllRealHistory();
}

function createInvoiceWithDetails(coin, grossProfit, serviceCharge, netProfit, startTime, endTime) {
    const invoiceNumber = String(invoiceCounter + 1).padStart(3, '0');
    invoiceCounter++;

    const invoice = {
        number: `KPY-${invoiceNumber}`,
        coin: coin,
        coinName: getCoinName(coin),
        actualProfit: grossProfit,
        serviceCharge: serviceCharge,
        netProfit: netProfit,
        startTime: startTime,
        endTime: endTime,
        timestamp: new Date().toISOString()
    };

    if (currentUser) {
        if (!currentUser.invoices) currentUser.invoices = [];
        currentUser.invoices.unshift(invoice);
        saveUserToStorage(currentUser);
        saveSessionSafely(currentUser);
        renderInvoicesList();
    }

    return invoice;
}

function resumeMiningIfActive() {
    refreshCurrentUser();
    if (!currentUser || !currentUser.isMiningActive || !currentUser.miningSession) return;
    if (miningActive) return; // جلسة شغالة أصلاً بهاي النافذة نفسها

    const session = currentUser.miningSession;
    const endTime = new Date(session.endTime);
    const now = new Date();
    const remainingMs = endTime - now;

    currentCoin = session.coin || currentCoin;
    document.querySelectorAll('.coin-item').forEach(item => item.classList.toggle('active', item.dataset.coin === currentCoin));

    if (!AdminAPI.isMiningEnabled()) {
        // الأدمن أوقف التعدين للجميع أثناء غياب المستخدم — أنهِ الجلسة فوراً واحسب الأرباح حتى الآن
        miningActive = true;
        finishMining(new Date(session.startTime));
        return;
    }

    if (remainingMs <= 0) {
        // خلصت مدة التعدين وانته كان طالع من الصفحة — احسب الأرباح فوراً الآن متل ما لو ضل قاعد
        miningActive = true;
        finishMining(new Date(session.startTime));
        return;
    }

    // لسا في وقت متبقي — كمّل العد التنازلي والمؤشر الحي بالضبط من نفس المكان (بدون تصفير)
    miningActive = true;
    mineBtn.disabled = true;
    miningEndTimeValue = endTime;
    const coinName = getCoinName(currentCoin);
    mineStatus.textContent = `⛏️ التعدين مستمر على ${coinName}...`;
    miningEndTime.textContent = `⏰ ينتهي الساعة: ${miningEndTimeValue.toLocaleTimeString()}`;

    const totalDuration = session.durationSeconds || Math.max(1, Math.round((endTime - new Date(session.startTime)) / 1000));
    const elapsedSeconds = totalDuration - Math.ceil(remainingMs / 1000);

    const fees = loadFees();
    const rate = getProfitRateForAmount(session.startBalance);
    const estimatedGross = session.startBalance * rate;
    const estimatedNet = estimatedGross - (estimatedGross * fees.miningFee);
    startMiningVisual(session.startBalance, session.startBalance + estimatedNet, totalDuration, elapsedSeconds);

    let secondsLeft = Math.ceil(remainingMs / 1000);
    const startTime = new Date(session.startTime);

    miningInterval = setInterval(() => {
        if (!AdminAPI.isMiningEnabled()) {
            mineStatus.textContent = '⛔ تم إيقاف التعدين من قبل الإدارة — جاري احتساب أرباحك حتى هذه اللحظة...';
            finishMining(startTime);
            return;
        }
        secondsLeft--;
        if (secondsLeft <= 0) {
            finishMining(startTime);
            return;
        }
        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const secs = secondsLeft % 60;
        mineTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function startMining() {
    if (!currentUser) { alert('الرجاء تسجيل الدخول أولاً!'); return; }
    if (miningActive) return;

    refreshCurrentUser();

    if (!AdminAPI.isMiningEnabled()) {
        updateMiningButtonState();
        return;
    }

    if (!isMiningTime()) {
        updateMiningButtonState();
        return;
    }

    const miningBal = parseSafeNumber(currentUser.miningBalance);
    
    if (miningBal <= 0) {
        alert('⚠️ لا يوجد رصيد تعدين. قم أولاً بتحويل مبلغ إلى رصيد التعدين.');
        mineBtn.disabled = true;
        mineStatus.textContent = '⛔ لا يوجد رصيد تعدين. قم بتحويل مبلغ أولاً.';
        setTimeout(() => {
            mineBtn.disabled = false;
            updateMiningButtonState();
            mineStatus.textContent = '⏳ جاهز للتعدين';
        }, 3000);
        return;
    }

    const durationSeconds = AdminAPI.getMiningDuration();

    miningActive = true;
    const now = new Date();
    miningEndTimeValue = new Date(now.getTime() + durationSeconds * 1000);
    persistMiningActiveFlag(true, {
        startTime: now.toISOString(),
        endTime: miningEndTimeValue.toISOString(),
        durationSeconds: durationSeconds,
        coin: currentCoin,
        startBalance: miningBal
    });
    mineBtn.disabled = true;
    const coinName = getCoinName(currentCoin);
    
    mineStatus.textContent = `⛏️ بدأ التعدين على ${coinName}...`;
    miningEndTime.textContent = `⏰ ينتهي الساعة: ${miningEndTimeValue.toLocaleTimeString()}`;

    const fees = loadFees();
    const rate = getProfitRateForAmount(miningBal);
    const estimatedGross = miningBal * rate;
    const estimatedNet = estimatedGross - (estimatedGross * fees.miningFee);
    startMiningVisual(miningBal, miningBal + estimatedNet, durationSeconds);

    let secondsLeft = durationSeconds;
    const startTime = now;
    
    miningInterval = setInterval(() => {
        if (!AdminAPI.isMiningEnabled()) {
            mineStatus.textContent = '⛔ تم إيقاف التعدين من قبل الإدارة — جاري احتساب أرباحك حتى هذه اللحظة...';
            finishMining(startTime);
            return;
        }
        secondsLeft--;
        if (secondsLeft <= 0) { 
            finishMining(startTime); 
            return; 
        }
        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const secs = secondsLeft % 60;
        mineTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopMining() {
    if (miningInterval) { clearInterval(miningInterval); miningInterval = null; }
    miningActive = false;
    mineBtn.disabled = false;
    updateMiningButtonState();
    mineTimer.textContent = '';
    miningEndTime.textContent = '';
    mineStatus.textContent = '⏳ جاهز للتعدين';
}

// ============================================================
// SECTION 30: SQUAD SYSTEM
// ============================================================

function openSquadFullPage() {
    if (!currentUser) return;
    document.getElementById('squadFullPage').classList.add('active');
    document.getElementById('mainDashboard').style.display = 'none';
    renderSquadFullPageContent();
}

function closeSquadFullPage() {
    document.getElementById('squadFullPage').classList.remove('active');
    document.getElementById('mainDashboard').style.display = 'flex';
}

function transferSquadEarnings() {
    if (!currentUser) return;
    refreshCurrentUser();
    
    const referralBalance = parseSafeNumber(currentUser.referralBalance);
    
    if (referralBalance <= 0) {
        showToast('لا يوجد أرباح متاحة للتحويل.', 'warning');
        return;
    }
    
    const amount = referralBalance;
    const now = new Date();
    
    currentUser.balance = parseSafeNumber(currentUser.balance) + amount;
    currentUser.referralBalance = 0;
    
    if (!currentUser.transferHistory) currentUser.transferHistory = [];
    
    const transferRecord = {
        id: 'SQ-' + Date.now().toString(36).toUpperCase(),
        from: 'squad',
        to: 'wallet',
        amount: amount,
        type: 'Squad Transfer',
        description: 'Transfer from Squad Earnings',
        status: 'completed',
        created_at: now.toISOString(),
        expected_completion: now.toISOString()
    };
    
    currentUser.transferHistory.unshift(transferRecord);
    
    saveUserToStorage(currentUser);
    saveSessionSafely(currentUser);
    
    updateDashboardUI();
    renderTransferHistory();
    
    showToast('تم تحويل أرباح السكواد إلى محفظتك بنجاح.', 'success');
    
    if (document.getElementById('squadFullPage').classList.contains('active')) {
        renderSquadFullPageContent();
    }
}

function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toastNotification.className = 'toast-notification';
    
    if (type === 'success') {
        toastNotification.style.background = '#22c55e';
    } else if (type === 'warning') {
        toastNotification.style.background = '#f59e0b';
    } else if (type === 'error') {
        toastNotification.style.background = '#ef4444';
    } else {
        toastNotification.style.background = '#fbbf24';
        toastNotification.style.color = '#0b0e1a';
    }
    
    setTimeout(() => {
        toastNotification.classList.add('show');
    }, 50);
    
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastNotification.classList.remove('show');
    }, 3000);
}

function submitJoinReferralCode() {
    if (!currentUser) return;
    const msgEl = document.getElementById('joinReferralCodeMsg');
    const codeInput = document.getElementById('joinReferralCodeInput');
    const code = (codeInput.value || '').trim().toUpperCase();

    if (!code) {
        msgEl.textContent = '⚠️ الرجاء إدخال كود الدعوة';
        msgEl.style.color = '#ef4444';
        return;
    }

    refreshCurrentUser();
    if (currentUser.referredBy) {
        msgEl.textContent = '❌ أنت منضم لسكواد أصلاً، لا يمكن تغييره';
        msgEl.style.color = '#ef4444';
        return;
    }

    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (!userData) return;

    if (code === userData.accountId) {
        msgEl.textContent = '❌ لا يمكنك استخدام كود الدعوة الخاص بك';
        msgEl.style.color = '#ef4444';
        return;
    }

    const referrer = users.find(u => u.accountId === code);
    if (!referrer) {
        msgEl.textContent = '❌ كود الدعوة غير صحيح';
        msgEl.style.color = '#ef4444';
        return;
    }

    // ربط نهائي — لا يمكن التراجع عنه
    userData.referredBy = code;
    saveUserToStorage(userData);
    currentUser = { ...userData };
    saveSessionSafely(currentUser);

    msgEl.textContent = '✅ تم ربط حسابك بالسكواد بنجاح!';
    msgEl.style.color = '#22c55e';
    showToast('✅ تم الانضمام للسكواد بنجاح!', 'success');

    setTimeout(() => { renderSquadFullPageContent(); }, 1000);
}

function renderSquadFullPageContent() {
    const container = document.getElementById('squadFullPageContent');
    if (!container) return;
    
    if (!currentUser) {
        container.innerHTML = '<div class="no-data-message"><i class="fas fa-user"></i>الرجاء تسجيل الدخول أولاً</div>';
        return;
    }
    
    refreshCurrentUser();
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username) || currentUser;
    
    const accountId = userData.accountId || 'A?';
    const referralBalance = parseSafeNumber(userData.referralBalance);
    const referralEarningsHistory = userData.referralEarningsHistory || [];
    
    const members = users.filter(u => u.referredBy === accountId);
    const memberCount = members.length;
    
    const hasBalance = referralBalance > 0;
    
    let html = `
        <div class="section-card" style="background:rgba(10,14,26,0.7);border-color:#fbbf24;">
            <div style="text-align:center;margin-bottom:16px;">
                <h3 style="color:#fbbf24;font-size:1.3rem;margin-bottom:4px;">
                    <i class="fas fa-rocket"></i> سكوادك
                </h3>
                <div style="color:#8896b0;font-size:0.85rem;margin-bottom:8px;">
                    كود الدعوة الخاص بك
                </div>
                <div class="squad-code-display">
                    ${accountId}
                </div>
                <button class="btn btn-outline" style="margin-top:10px;width:auto;padding:8px 20px;" onclick="copySquadCodeFromFullPage()">
                    <i class="fas fa-copy"></i> نسخ كود الدعوة
                </button>
            </div>
        </div>
        
        <div class="section-card" style="background:rgba(10,14,26,0.7);">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="squad-stat-box">
                    <div class="stat-label">عدد أعضاء السكواد</div>
                    <div class="stat-value">${memberCount}</div>
                </div>
                <div class="squad-stat-box">
                    <div class="stat-label">إجمالي أرباحك من السكواد</div>
                    <div class="stat-value">$${referralBalance.toFixed(2)}</div>
                </div>
            </div>
        </div>

        ${!userData.referredBy ? `
        <div class="section-card" style="background:rgba(10,14,26,0.7);border-color:#3b82f6;">
            <h3 style="color:#3b82f6;font-size:0.95rem;margin-bottom:10px;"><i class="fas fa-link"></i> الانضمام لسكواد عبر كود دعوة</h3>
            <p style="color:#8896b0;font-size:0.75rem;margin-bottom:10px;">إذا حصلت على كود دعوة من صديق، أدخله هون. تنويه: هاد الإجراء نهائي ولا يمكن تغييره لاحقاً.</p>
            <div style="display:flex;gap:8px;">
                <input type="text" id="joinReferralCodeInput" placeholder="مثال: A12" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid #2a3650;border-radius:10px;padding:10px 14px;color:#fff;font-size:0.85rem;">
                <button class="btn btn-primary" style="width:auto;padding:10px 18px;" onclick="submitJoinReferralCode()"><i class="fas fa-check"></i> ربط</button>
            </div>
            <div id="joinReferralCodeMsg" style="font-size:0.75rem;margin-top:8px;text-align:center;min-height:16px;"></div>
        </div>
        ` : `
        <div class="section-card" style="background:rgba(10,14,26,0.7);border-color:#22c55e;">
            <div style="color:#22c55e;font-size:0.82rem;text-align:center;"><i class="fas fa-check-circle"></i> أنت منضم لسكواد القائد: <b>${userData.referredBy}</b></div>
        </div>
        `}
    `;

    html += `
        <div class="section-card squad-transfer-card" style="background:rgba(10,14,26,0.7);border-color:#fbbf24;">
            <div style="margin-bottom:8px;">
                <span style="color:#8896b0;font-size:0.8rem;">💰 رصيد أرباح السكواد المتاح: <strong style="color:#fbbf24;">$${referralBalance.toFixed(2)}</strong></span>
            </div>
            <button class="btn-transfer-squad" id="transferSquadBtn" ${!hasBalance ? 'disabled' : ''}>
                <i class="fas fa-wallet"></i> تحويل أرباح السكواد إلى المحفظة
            </button>
            ${!hasBalance ? '<div class="transfer-status">لا يوجد أرباح متاحة للتحويل.</div>' : ''}
        </div>
    `;
    
    let topMember = null;
    let topCommission = -1;
    if (memberCount > 0) {
        members.forEach(member => {
            let commissionEarned = 0;
            (userData.referralEarningsHistory || []).forEach(entry => {
                if (entry.memberAccountId === member.accountId) commissionEarned += entry.commissionAmount || 0;
            });
            if (commissionEarned > topCommission) { topCommission = commissionEarned; topMember = member; }
        });
    }

    html += `
        <div class="section-card" style="background:rgba(10,14,26,0.7);">
            <h3 style="color:#fbbf24;font-size:1rem;margin-bottom:12px;">
                <i class="fas fa-user-friends"></i> أعضاء السكواد
            </h3>
            ${topMember && topCommission > 0 ? `
            <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
                <i class="fas fa-crown" style="color:#fbbf24;font-size:1.2rem;"></i>
                <div>
                    <div style="color:#fbbf24;font-size:0.82rem;font-weight:700;">🏆 أفضل عضو: ${topMember.displayName || topMember.username}</div>
                    <div style="color:#8896b0;font-size:0.72rem;">أعلى ربح حققه لك: $${topCommission.toFixed(2)}</div>
                </div>
            </div>` : ''}
            <div style="max-height:300px;overflow-y:auto;">
    `;
    
    if (memberCount === 0) {
        html += `
            <div class="no-data-message">
                <i class="fas fa-users"></i>
                لا يوجد أعضاء في السكواد حتى الآن<br>
                <span style="font-size:0.7rem;">شارك كود الدعوة الخاص بك مع أصدقائك</span>
            </div>
        `;
    } else {
        members.forEach(member => {
            let eligibleProfit = 0;
            let commissionEarned = 0;
            
            if (userData.referralEarningsHistory) {
                userData.referralEarningsHistory.forEach(entry => {
                    if (entry.memberAccountId === member.accountId) {
                        eligibleProfit += entry.eligibleProfit || 0;
                        commissionEarned += entry.commissionAmount || 0;
                    }
                });
            }
            
            html += `
                <div class="squad-member-row">
                    <div>
                        <div class="member-name">${member.displayName || member.username}</div>
                        <div class="member-id">ID: ${member.accountId}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="member-profit-label">ربح العضو المؤهل</div>
                        <div class="member-profit">$${eligibleProfit.toFixed(2)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="member-profit-label">ربحك منه (5%)</div>
                        <div class="member-commission">+$${commissionEarned.toFixed(2)}</div>
                    </div>
                </div>
            `;
        });
    }
    
    html += `</div></div>`;
    
    if (referralEarningsHistory.length > 0) {
        html += `
            <div class="section-card" style="background:rgba(10,14,26,0.7);">
                <h3 style="color:#fbbf24;font-size:1rem;margin-bottom:12px;">
                    <i class="fas fa-history"></i> آخر أرباح السكواد
                </h3>
                <div style="max-height:200px;overflow-y:auto;">
        `;
        
        const recentEarnings = referralEarningsHistory.slice(-10).reverse();
        recentEarnings.forEach(earning => {
            html += `
                <div class="squad-earning-item">
                    <div>
                        <div class="earning-name">${earning.memberName}</div>
                        <div class="earning-id">${earning.memberAccountId}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="member-profit-label">ربح مؤهل</div>
                        <div class="earning-profit">$${(earning.eligibleProfit || 0).toFixed(2)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="member-profit-label">عمولتك (5%)</div>
                        <div class="earning-commission">+$${(earning.commissionAmount || 0).toFixed(2)}</div>
                    </div>
                    <div class="earning-date">${new Date(earning.createdAt).toLocaleString()}</div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    html += `
        <button class="btn btn-outline" style="width:100%;margin-top:8px;" onclick="closeSquadFullPage()">
            <i class="fas fa-arrow-right"></i> رجوع
        </button>
    `;
    
    container.innerHTML = html;

    const transferBtn = document.getElementById('transferSquadBtn');
    if (transferBtn) {
        transferBtn.addEventListener('click', transferSquadEarnings);
    }
}

function copySquadCodeFromFullPage() {
    if (!currentUser) return;
    const text = currentUser.accountId || 'A?';
    navigator.clipboard.writeText(text).then(() => {
        showToast('تم نسخ كود الدعوة!', 'success');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('تم نسخ كود الدعوة!', 'success');
    });
}

// ============================================================
// SECTION 31: TRANSFER SYSTEM
// ============================================================

function createTransfer(from, to, amount, isInstant = false) {
    refreshCurrentUser();
    const now = new Date();
    let expectedCompletion;
    let status = 'pending';
    
    if (isInstant) {
        expectedCompletion = new Date(now.getTime());
        status = 'completed';
    } else {
        expectedCompletion = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        status = 'pending';
    }
    
    const transfer = {
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        from: from,
        to: to,
        amount: parseFloat(amount),
        created_at: now.toISOString(),
        expected_completion: expectedCompletion.toISOString(),
        status: status
    };
    
    if (!currentUser.transferHistory) currentUser.transferHistory = [];
    currentUser.transferHistory.unshift(transfer);
    saveUserToStorage(currentUser);
    saveSessionSafely(currentUser);
    renderTransferHistory();
    updateDashboardUI();
    return transfer;
}

function startTransferProcessor() {
    if (transferInterval) return;
    transferInterval = setInterval(() => {
        processPendingTransfers();
    }, 10000);
}

function stopTransferProcessor() {
    if (transferInterval) { clearInterval(transferInterval); transferInterval = null; }
}

function processPendingTransfers() {
    if (!currentUser || !currentUser.transferHistory) return;
    refreshCurrentUser();
    
    const now = new Date();
    let updated = false;
    let transfersToComplete = [];
    
    currentUser.transferHistory.forEach(transfer => {
        if (transfer.status === 'pending') {
            const expected = new Date(transfer.expected_completion);
            if (now >= expected) {
                transfer.status = 'completed';
                transfersToComplete.push(transfer);
                updated = true;
            }
        }
    });
    
    if (updated) {
        transfersToComplete.forEach(transfer => {
            if (transfer.from === 'wallet' && transfer.to === 'asset') {
                currentUser.assetBalance = parseSafeNumber(currentUser.assetBalance) + transfer.amount;
            } else if (transfer.from === 'asset' && transfer.to === 'mining') {
                currentUser.miningBalance = parseSafeNumber(currentUser.miningBalance) + transfer.amount;
            } else if (transfer.from === 'mining' && transfer.to === 'wallet') {
                currentUser.balance = parseSafeNumber(currentUser.balance) + transfer.amount;
            }
        });
        
        saveUserToStorage(currentUser);
        saveSessionSafely(currentUser);
        renderTransferHistory();
        updateDashboardUI();
    }
}

function isTransferBlockedByMining(msgElId) {
    if (currentUser && currentUser.isMiningActive) {
        const msgEl = document.getElementById(msgElId);
        if (msgEl) {
            msgEl.textContent = '⚠️ لا يمكن تحويل رصيد التعدين أثناء التعدين. انتظر حتى تنتهي الجلسة.';
            msgEl.style.color = '#ef4444';
        }
        return true;
    }
    return false;
}

function executeTransfer(from, to, amount, isInstant = false) {
    refreshCurrentUser();
    if (!currentUser) {
        return { success: false, message: 'الرجاء تسجيل الدخول أولاً!' };
    }
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (!userData) {
        return { success: false, message: 'بيانات المستخدم غير موجودة!' };
    }
    
    let balanceKey = '';
    let displayName = '';
    
    if (from === 'wallet') {
        balanceKey = 'balance';
        displayName = 'المحفظة';
    } else if (from === 'asset') {
        balanceKey = 'assetBalance';
        displayName = 'الأسست';
    } else if (from === 'mining') {
        balanceKey = 'miningBalance';
        displayName = 'التعدين';
    } else {
        return { success: false, message: 'مصدر غير صحيح!' };
    }
    
    let currentBalance = parseSafeNumber(userData[balanceKey]);
    
    if (amount > currentBalance) {
        return { success: false, message: `الرصيد غير كافٍ في ${displayName}! المتاح: $${currentBalance.toFixed(2)}` };
    }
    
    userData[balanceKey] = parseSafeNumber(userData[balanceKey]) - amount;
    
    const transfer = {
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        from: from,
        to: to,
        amount: parseFloat(amount),
        created_at: new Date().toISOString(),
        expected_completion: new Date(Date.now() + (isInstant ? 0 : 24 * 60 * 60 * 1000)).toISOString(),
        status: isInstant ? 'completed' : 'pending'
    };
    
    if (!userData.transferHistory) userData.transferHistory = [];
    userData.transferHistory.unshift(transfer);
    
    if (isInstant) {
        if (to === 'asset') {
            userData.assetBalance = parseSafeNumber(userData.assetBalance) + amount;
        } else if (to === 'wallet') {
            userData.balance = parseSafeNumber(userData.balance) + amount;
        } else if (to === 'mining') {
            userData.miningBalance = parseSafeNumber(userData.miningBalance) + amount;
        }
        transfer.status = 'completed';
    }
    
    saveUserToStorage(userData);
    currentUser = { ...userData };
    saveSessionSafely(currentUser);
    
    renderTransferHistory();
    updateDashboardUI();
    
    return { success: true, transfer: transfer };
}

function renderTransferHistory() {
    const container = document.getElementById('transferHistoryList');
    const menuContainer = document.getElementById('transferHistoryListMenu');
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = currentUser ? users.find(u => u.username === currentUser.username) : null;
    const transfers = userData?.transferHistory || [];
    
    const renderItems = (target) => {
        if (!target) return;
        
        if (transfers.length === 0) {
            target.innerHTML = `
                <div style="text-align:center;color:#8896b0;padding:16px;font-size:0.8rem;">
                    <i class="fas fa-exchange-alt" style="font-size:2rem;display:block;margin-bottom:10px;color:#2a3650;"></i>
                    لا توجد تحويلات بعد
                </div>
            `;
            return;
        }

        target.innerHTML = '';
        transfers.forEach((transfer) => {
            const statusClass = transfer.status === 'completed' ? 'completed' : 
                               transfer.status === 'failed' ? 'failed' : 'pending';
            const statusText = transfer.status === 'completed' ? 'مكتمل' : 
                              transfer.status === 'failed' ? 'فشل' : 'قيد المعالجة';
            
            let fromLabel = '';
            if (transfer.from === 'wallet') fromLabel = 'المحفظة';
            else if (transfer.from === 'asset') fromLabel = 'الأسست';
            else if (transfer.from === 'mining') fromLabel = 'التعدين';
            else if (transfer.from === 'squad') fromLabel = 'السكواد';
            else fromLabel = transfer.from;
            
            let toLabel = '';
            if (transfer.to === 'wallet') toLabel = 'المحفظة';
            else if (transfer.to === 'asset') toLabel = 'الأسست';
            else if (transfer.to === 'mining') toLabel = 'التعدين';
            else toLabel = transfer.to;
            
            const expectedDate = new Date(transfer.expected_completion);
            const isPending = transfer.status === 'pending';
            
            let typeDisplay = `🔄 ${fromLabel} → ${toLabel}`;
            if (transfer.type === 'Squad Transfer') {
                typeDisplay = `🏆 ${transfer.description || 'تحويل أرباح السكواد'}`;
            }
            
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <span class="type">${typeDisplay}</span>
                <span class="amount">${transfer.amount.toFixed(2)} USDT</span>
                <span class="date">${new Date(transfer.created_at).toLocaleDateString()}</span>
                <span class="status ${statusClass}">${statusText}</span>
                ${isPending ? `<span style="font-size:0.5rem;color:#fbbf24;width:100%;text-align:left;">⏳ ينتهي ${expectedDate.toLocaleString()}</span>` : ''}
            `;
            target.appendChild(div);
        });
    };
    
    renderItems(container);
    renderItems(menuContainer);
}

// ============================================================
// SECTION 32: INVOICE SYSTEM
// ============================================================

function renderInvoicesList() {
    const container = document.getElementById('invoicesModalList');
    if (!container) return;
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = currentUser ? users.find(u => u.username === currentUser.username) : null;
    const invoices = userData?.invoices || [];
    
    if (invoices.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;color:#8896b0;padding:16px;font-size:0.8rem;">
                <i class="fas fa-file-invoice" style="font-size:2rem;display:block;margin-bottom:10px;color:#2a3650;"></i>
                لا توجد فواتير بعد
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    invoices.forEach((inv) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="type">📄 فاتورة #${inv.number}</span>
            <span class="amount">+$${inv.netProfit.toFixed(4)}</span>
            <span class="date">${new Date(inv.timestamp).toLocaleDateString()}</span>
            <button class="invoice-btn" onclick="openInvoiceModal('${inv.number}')">
                <i class="fas fa-eye"></i> عرض
            </button>
        `;
        container.appendChild(div);
    });
}

function openInvoiceModal(invoiceNumber) {
    const invoices = currentUser?.invoices || [];
    const invoice = invoices.find(inv => inv.number === invoiceNumber);
    if (!invoice) return;

    invoiceModalContent.innerHTML = `
        <div class="invoice-detail-row">
            <span class="label">📋 رقم الفاتورة</span>
            <span class="value gold">${invoice.number}</span>
        </div>
        <div class="invoice-detail-row">
            <span class="label">💰 العملة</span>
            <span class="value">${invoice.coinName}</span>
        </div>
        <div class="invoice-detail-row">
            <span class="label">📈 الربح الفعلي</span>
            <span class="value positive">+$${invoice.actualProfit.toFixed(4)}</span>
        </div>
        <div class="invoice-detail-row">
            <span class="label">📊 رسوم المنصة</span>
            <span class="value negative">-$${invoice.serviceCharge.toFixed(4)}</span>
        </div>
        <div class="invoice-detail-row" style="border-bottom:2px solid rgba(255,215,0,0.2);">
            <span class="label">✅ صافي الربح</span>
            <span class="value gold">+$${invoice.netProfit.toFixed(4)}</span>
        </div>
        <div class="invoice-detail-row">
            <span class="label">⏱️ وقت البدء</span>
            <span class="value">${new Date(invoice.startTime).toLocaleString()}</span>
        </div>
        <div class="invoice-detail-row">
            <span class="label">⏱️ وقت الانتهاء</span>
            <span class="value">${new Date(invoice.endTime).toLocaleString()}</span>
        </div>
        <div class="invoice-total-section">
            <span class="total-label">💰 صافي الربح</span>
            <span>+$${invoice.netProfit.toFixed(4)}</span>
        </div>
        <div class="invoice-date">
            📅 تم الإضافة: ${new Date(invoice.timestamp).toLocaleString()}
        </div>
    `;

    invoiceModal.classList.add('active');
}

function closeInvoiceModal() {
    invoiceModal.classList.remove('active');
}

invoiceModal.addEventListener('click', function(e) {
    if (e.target === this) {
        closeInvoiceModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeInvoiceModal();
    }
});

function renderProfitsList() {
    const container = document.getElementById('profitsList');
    if (!container) return;
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = currentUser ? users.find(u => u.username === currentUser.username) : null;
    const profits = userData?.profitsHistory || [];
    
    if (profits.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;color:#8896b0;padding:16px;font-size:0.8rem;">
                <i class="fas fa-chart-pie" style="font-size:2rem;display:block;margin-bottom:10px;color:#2a3650;"></i>
                لا توجد أرباح مسجلة بعد
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    profits.forEach((profit) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="type">📊 ${profit.type || 'ربح تعدين'}</span>
            <span class="amount">+$${profit.amount.toFixed(4)}</span>
            <span class="date">${new Date(profit.timestamp).toLocaleDateString()}</span>
            <span class="status completed">مكتمل</span>
        `;
        container.appendChild(div);
    });
}

// ============================================================
// SECTION 32B: REAL DEPOSIT / WITHDRAW HISTORY (replaces static demo data)
// ============================================================

function getCurrentUserRecord() {
    if (!currentUser) return null;
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    return users.find(u => u.username === currentUser.username) || null;
}

function renderEmptyHistory(container, icon, text) {
    container.innerHTML = `
        <div style="text-align:center;color:#8896b0;padding:16px;font-size:0.8rem;">
            <i class="fas ${icon}" style="font-size:2rem;display:block;margin-bottom:10px;color:#2a3650;"></i>
            ${text}
        </div>
    `;
}

// عمود "الأرباح اليومية" بصفحة القائمة — يعرض نفس سجل الأرباح الحقيقي (profitsHistory)
function renderDailyProfitsColumn() {
    const container = document.getElementById('invoiceList');
    if (!container) return;
    const userData = getCurrentUserRecord();
    const profits = userData?.profitsHistory || [];

    if (profits.length === 0) {
        renderEmptyHistory(container, 'fa-coins', 'لا توجد أرباح يومية بعد');
        return;
    }
    container.innerHTML = '';
    profits.forEach((profit) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="type">💰 ${profit.type || 'ربح تعدين'}</span>
            <span class="amount">+$${(parseFloat(profit.amount) || 0).toFixed(4)}</span>
            <span class="date">${new Date(profit.timestamp).toLocaleString()}</span>
            <span class="status completed">مكتمل</span>
        `;
        container.appendChild(div);
    });
}

// عمود "الإيداع" بصفحة القائمة — سجل إيداعات حقيقي لكل مستخدم (depositHistory)
function renderDepositsColumn() {
    const container = document.getElementById('depositList');
    if (!container) return;
    const userData = getCurrentUserRecord();
    const deposits = userData?.depositHistory || [];

    if (deposits.length === 0) {
        renderEmptyHistory(container, 'fa-arrow-up', 'لا توجد عمليات إيداع بعد');
        return;
    }
    container.innerHTML = '';
    deposits.forEach((dep) => {
        const statusClass = dep.status === 'completed' ? 'completed' : dep.status === 'rejected' ? 'failed' : 'pending';
        const statusText = dep.status === 'completed' ? 'مكتمل' : dep.status === 'rejected' ? 'مرفوض' : 'قيد المعالجة';
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="type">📥 إيداع${dep.network ? ' (' + dep.network + ')' : ''}</span>
            <span class="amount">+$${(parseFloat(dep.amount) || 0).toFixed(2)}</span>
            <span class="date">${new Date(dep.timestamp).toLocaleString()}</span>
            <span class="status ${statusClass}">${statusText}</span>
        `;
        container.appendChild(div);
    });
}

// عمود "السحب" بصفحة القائمة — سجل سحوبات حقيقي لكل مستخدم (withdrawHistory)
function renderWithdrawalsColumn() {
    const container = document.getElementById('withdrawList');
    if (!container) return;
    const userData = getCurrentUserRecord();
    const withdraws = userData?.withdrawHistory || [];

    if (withdraws.length === 0) {
        renderEmptyHistory(container, 'fa-arrow-down', 'لا توجد عمليات سحب بعد');
        return;
    }
    container.innerHTML = '';
    withdraws.forEach((w) => {
        const sourceLabel = w.source === 'asset' ? 'الأسست' : w.source === 'mining' ? 'التعدين' : 'المحفظة';
        const statusClass = w.status === 'completed' ? 'completed' : w.status === 'rejected' ? 'failed' : 'pending';
        const statusText = w.status === 'completed' ? 'مكتمل' : w.status === 'rejected' ? 'مرفوض' : 'قيد المعالجة';
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="type">📤 سحب (${sourceLabel})</span>
            <span class="amount">-$${(parseFloat(w.amount) || 0).toFixed(2)}</span>
            <span class="date">${new Date(w.timestamp).toLocaleString()}</span>
            <span class="status ${statusClass}">${statusText}</span>
        `;
        container.appendChild(div);
    });
}

// بطاقة "آخر العمليات" بصفحة المحفظة — دمج حقيقي لكل العمليات (إيداع + سحب + أرباح) مرتبة بالتاريخ
function renderWalletHistoryCard() {
    const container = document.getElementById('walletHistory');
    if (!container) return;
    const userData = getCurrentUserRecord();
    if (!userData) { renderEmptyHistory(container, 'fa-history', 'لا توجد عمليات بعد'); return; }

    const items = [];
    (userData.depositHistory || []).forEach(d => items.push({
        kind: 'deposit', label: '📥 إيداع', amount: parseFloat(d.amount) || 0, sign: '+',
        date: d.timestamp, status: d.status
    }));
    (userData.withdrawHistory || []).forEach(w => items.push({
        kind: 'withdraw', label: '📤 سحب', amount: parseFloat(w.amount) || 0, sign: '-',
        date: w.timestamp, status: w.status
    }));
    (userData.profitsHistory || []).forEach(p => items.push({
        kind: 'profit', label: '💰 ' + (p.type || 'ربح تعدين'), amount: parseFloat(p.amount) || 0, sign: '+',
        date: p.timestamp, status: 'completed'
    }));

    if (items.length === 0) {
        renderEmptyHistory(container, 'fa-history', 'لا توجد عمليات بعد');
        return;
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = '';
    items.slice(0, 15).forEach((it) => {
        const statusClass = it.status === 'completed' ? 'completed' : it.status === 'rejected' ? 'failed' : 'pending';
        const statusText = it.status === 'completed' ? 'مكتمل' : it.status === 'rejected' ? 'مرفوض' : 'قيد المعالجة';
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="type">${it.label}</span>
            <span class="amount">${it.sign}$${it.amount.toFixed(2)}</span>
            <span class="date">${new Date(it.date).toLocaleString()}</span>
            <span class="status ${statusClass}">${statusText}</span>
        `;
        container.appendChild(div);
    });
}

function renderAllRealHistory() {
    renderDailyProfitsColumn();
    renderDepositsColumn();
    renderWithdrawalsColumn();
    renderWalletHistoryCard();
}

// ============================================================
// SECTION 33: COIN ROTATION & CHART
// ============================================================

function startCoinRotation() {
    if (coinRotationInterval) return;
    coinRotationInterval = setInterval(rotateCoin, 120000);
}

function stopCoinRotation() {
    if (coinRotationInterval) { clearInterval(coinRotationInterval); coinRotationInterval = null; }
}

const coins = ['bitcoin', 'ethereum', 'solana'];
let coinIndex = 0;

function rotateCoin() {
    coinItems.forEach(item => item.classList.remove('active'));
    coinIndex = (coinIndex + 1) % coins.length;
    currentCoin = coins[coinIndex];
    document.querySelector(`.coin-item[data-coin="${currentCoin}"]`).classList.add('active');
    if (miningActive) {
        mineStatus.textContent = `⛏️ جاري التعدين على ${getCoinName(currentCoin)}...`;
    }
    updateMarketChart(currentCoin);
}

function getCoinName(coin) {
    const names = { bitcoin: 'بيتكوين', ethereum: 'إيثيريوم', solana: 'سولانا' };
    return names[coin] || coin;
}

// ============================================================
// SECTION 34: MARKET CHART
// ============================================================

const BINANCE_SYMBOLS = {
    bitcoin: 'BTCUSDT',
    ethereum: 'ETHUSDT',
    solana: 'SOLUSDT'
};

async function fetchMarketData(coinId) {
    try {
        const symbol = BINANCE_SYMBOLS[coinId];
        if (!symbol) throw new Error('Invalid coin symbol');
        
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=7`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        
        const prices = data.map(candle => [
            candle[0],
            parseFloat(candle[4])
        ]);
        
        return { prices };
    } catch (error) {
        console.error('Market data fetch error:', error);
        return null;
    }
}

async function fetchCurrentPrice(coinId) {
    try {
        const symbol = BINANCE_SYMBOLS[coinId];
        if (!symbol) throw new Error('Invalid coin symbol');
        
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        
        return {
            usd: parseFloat(data.lastPrice),
            usd_24h_change: parseFloat(data.priceChangePercent)
        };
    } catch (error) {
        console.error('Price fetch error:', error);
        return null;
    }
}

function initMarketChart() {
    const ctx = document.getElementById('marketChart').getContext('2d');
    if (marketChartInstance) {
        marketChartInstance.destroy();
    }
    
    marketChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'السعر (USD)',
                data: [],
                borderColor: '#fbbf24',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: false,
                    grid: {
                        display: false
                    }
                },
                y: {
                    display: false,
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

async function updateMarketChart(coinId) {
    const priceEl = document.getElementById('currentPrice');
    const changeEl = document.getElementById('priceChange');
    
    if (!coinId) coinId = currentCoin || 'bitcoin';
    
    priceEl.textContent = 'جاري التحميل...';
    changeEl.textContent = '...';
    changeEl.className = 'change';
    
    try {
        const [historical, priceData] = await Promise.all([
            fetchMarketData(coinId),
            fetchCurrentPrice(coinId)
        ]);
        
        if (!historical || !priceData) {
            throw new Error('Failed to fetch market data');
        }
        
        const currentPrice = priceData.usd || 0;
        const change24h = priceData.usd_24h_change || 0;
        
        priceEl.textContent = '$' + currentPrice.toFixed(2);
        changeEl.textContent = (change24h >= 0 ? '+' : '') + change24h.toFixed(2) + '%';
        changeEl.className = 'change ' + (change24h >= 0 ? 'positive' : 'negative');
        
        if (marketChartInstance) {
            const prices = historical.prices || [];
            const labels = prices.map(p => {
                const d = new Date(p[0]);
                return d.toLocaleDateString('ar');
            });
            const data = prices.map(p => p[1]);
            
            marketChartInstance.data.labels = labels;
            marketChartInstance.data.datasets[0].data = data;
            marketChartInstance.update('none');
        }
        
        chartDataCache[coinId] = {
            price: currentPrice,
            change: change24h,
            historical: historical.prices || []
        };
        
    } catch (error) {
        console.error('Market chart update error:', error);
        
        if (chartDataCache[coinId]) {
            const cached = chartDataCache[coinId];
            priceEl.textContent = '$' + cached.price.toFixed(2);
            changeEl.textContent = (cached.change >= 0 ? '+' : '') + cached.change.toFixed(2) + '%';
            changeEl.className = 'change ' + (cached.change >= 0 ? 'positive' : 'negative');
            
            if (marketChartInstance && cached.historical && cached.historical.length > 0) {
                const prices = cached.historical;
                const labels = prices.map(p => {
                    const d = new Date(p[0]);
                    return d.toLocaleDateString('ar');
                });
                const data = prices.map(p => p[1]);
                
                marketChartInstance.data.labels = labels;
                marketChartInstance.data.datasets[0].data = data;
                marketChartInstance.update('none');
            }
            
            priceEl.textContent += ' (مخبأ)';
        } else {
            priceEl.textContent = 'تعذر تحميل بيانات السوق';
            changeEl.textContent = '--';
            changeEl.className = 'change';
        }
    }
}

function startMarketUpdates() {
    if (marketUpdateInterval) return;
    
    if (!marketChartInstance) {
        initMarketChart();
    }
    
    updateMarketChart(currentCoin);
    
    marketUpdateInterval = setInterval(() => {
        updateMarketChart(currentCoin);
    }, 60000);
}

function stopMarketUpdates() {
    if (marketUpdateInterval) {
        clearInterval(marketUpdateInterval);
        marketUpdateInterval = null;
    }
}

// ============================================================
// SECTION 35: UI HELPERS
// ============================================================

function openFullPage(pageId) {
    document.getElementById(pageId).classList.add('active');
    mainDash.style.display = 'none';
}

function closeFullPage(pageId) {
    document.getElementById(pageId).classList.remove('active');
    mainDash.style.display = 'flex';
}

function closeVerifyFullPage() {
    document.getElementById('verifyFullPage').classList.remove('active');
    mainDash.style.display = 'flex';
}

function sendChatMessage() {
    const input = document.getElementById('chatFullInput');
    const msg = input.value.trim();
    if (!msg) return;
    const messages = document.getElementById('chatFullMessages');
    const div = document.createElement('div');
    div.className = 'msg self';
    div.innerHTML = `<strong>أنت:</strong> ${msg}<span class="time">${new Date().toLocaleTimeString()}</span>`;
    messages.appendChild(div);
    input.value = '';
    messages.scrollTop = messages.scrollHeight;
    setTimeout(() => {
        const reply = document.createElement('div');
        reply.className = 'msg';
        reply.innerHTML = `<strong>الموظف:</strong> تم استلام رسالتك! سأقوم بمساعدتك حالاً.<span class="time">${new Date().toLocaleTimeString()}</span>`;
        messages.appendChild(reply);
        messages.scrollTop = messages.scrollHeight;
    }, 1000);
}

function copyDepositAddress() {
    const text = document.getElementById('depositAddressText').textContent;
    navigator.clipboard.writeText(text);
    const icon = document.getElementById('copyIcon');
    const label = document.getElementById('copyBtnLabel');
    if (icon && label) {
        icon.className = 'fas fa-check';
        label.textContent = 'تم النسخ!';
        setTimeout(() => {
            icon.className = 'fas fa-copy';
            label.textContent = 'نسخ العنوان';
        }, 2000);
    }
    showToast('تم نسخ العنوان بنجاح', 'success');
}

function setMaxAmount(inputId, balanceId) {
    refreshCurrentUser();
    const balanceEl = document.getElementById(balanceId);
    const balanceText = balanceEl.textContent.replace('$', '').trim();
    const balance = parseFloat(balanceText) || 0;
    const input = document.getElementById(inputId);
    if (input) {
        input.value = balance.toFixed(2);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// ============================================================
// SECTION 36: EVENT LISTENERS
// ============================================================

// Auth - Register
registerBtn.addEventListener('click', showRegisterPage);
registerBackBtn.addEventListener('click', showLogin);

// Send OTP
sendOtpBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    
    const email = regEmailInput.value.trim();
    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value.trim();
    const confirmPassword = regConfirmPasswordInput.value.trim();
    const inviteCode = inviteCodeInput.value.trim();
    
    // Validate
    if (!email) {
        registerMessage.textContent = '⚠️ البريد الإلكتروني مطلوب!';
        registerMessage.style.color = '#ef4444';
        return;
    }
    if (!username) {
        registerMessage.textContent = '⚠️ اسم المستخدم مطلوب!';
        registerMessage.style.color = '#ef4444';
        return;
    }
    if (!password) {
        registerMessage.textContent = '⚠️ كلمة المرور مطلوبة!';
        registerMessage.style.color = '#ef4444';
        return;
    }
    if (password.length < 6) {
        registerMessage.textContent = '⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل!';
        registerMessage.style.color = '#ef4444';
        return;
    }
    if (password !== confirmPassword) {
        registerMessage.textContent = '⚠️ كلمة المرور وتأكيدها غير متطابقين!';
        registerMessage.style.color = '#ef4444';
        return;
    }
    
    const result = registerUserWithEmail(email, username, password, inviteCode);
    
    if (!result.success) {
        registerMessage.textContent = result.message;
        registerMessage.style.color = '#ef4444';
        return;
    }
    
    registerMessage.textContent = '📧 جاري إرسال رمز التحقق...';
    registerMessage.style.color = '#fbbf24';
    
    // Send OTP
    await sendOtpToEmail(email);
    
    // Show OTP section
    document.getElementById('otpEmailDisplay').textContent = email;
    document.getElementById('otpContainer').classList.add('active');
    registerFormContainer.style.display = 'none';
    registerMessage.textContent = '✅ تم إرسال رمز التحقق إلى بريدك الإلكتروني';
    registerMessage.style.color = '#22c55e';
    
    resetOtpInputs();
    startOtpTimer();
});

// Resend OTP
resendOtpBtn.addEventListener('click', async function() {
    const email = regEmailInput.value.trim();
    if (!email) return;
    
    resendOtpBtn.disabled = true;
    await sendOtpToEmail(email);
    startOtpTimer();
    otpMessage.textContent = '✅ تم إعادة إرسال الرمز';
    otpMessage.style.color = '#22c55e';
});

// Verify OTP
verifyOtpBtn.addEventListener('click', function() {
    const email = regEmailInput.value.trim();
    const otp = getOtpFromInputs();
    
    if (otp.length !== 6) {
        otpMessage.textContent = '⚠️ الرجاء إدخال الرمز المكون من 6 أرقام';
        otpMessage.style.color = '#ef4444';
        return;
    }
    
    const result = verifyOtp(email, otp);
    
    if (!result.valid) {
        otpMessage.textContent = result.message || '⚠️ الرمز غير صحيح';
        otpMessage.style.color = '#ef4444';
        return;
    }
    
    otpMessage.textContent = '✅ تم التحقق بنجاح! جاري إنشاء الحساب...';
    otpMessage.style.color = '#22c55e';
    
    // Create user account
    const newUser = createUserAccount();
    
    if (!newUser) {
        otpMessage.textContent = '❌ حدث خطأ في إنشاء الحساب';
        otpMessage.style.color = '#ef4444';
        return;
    }
    
    // Auto-login
    currentUser = { ...newUser };
    saveSessionSafely(currentUser);
    
    // Show success
    document.getElementById('otpContainer').classList.remove('active');
    registerSuccessContainer.style.display = 'block';
    successTitle.textContent = `🎉 تم إنشاء الحساب بنجاح!`;
    successMessage.textContent = `مرحباً بك ${newUser.username} (${newUser.accountId}) في منصة KryptonPyra.`;
    
    // Continue to profile completion
    continueToProfileBtn.onclick = function() {
        showProfileCompletion();
        updateDashboardUI();
    };
});

// Complete Profile
completeProfileBtn.addEventListener('click', function() {
    const firstName = profileFirstName.value.trim();
    const lastName = profileLastName.value.trim();
    const country = profileCountry.value;
    const city = profileCity.value.trim();
    const birthdate = profileBirthdate.value;
    const phone = profilePhone.value.trim();
    
    if (!firstName) {
        profileCompletionMessage.textContent = '⚠️ الاسم الأول مطلوب!';
        profileCompletionMessage.style.color = '#ef4444';
        return;
    }
    if (!lastName) {
        profileCompletionMessage.textContent = '⚠️ اسم العائلة مطلوب!';
        profileCompletionMessage.style.color = '#ef4444';
        return;
    }
    if (!country) {
        profileCompletionMessage.textContent = '⚠️ الدولة مطلوبة!';
        profileCompletionMessage.style.color = '#ef4444';
        return;
    }
    if (!city) {
        profileCompletionMessage.textContent = '⚠️ المدينة مطلوبة!';
        profileCompletionMessage.style.color = '#ef4444';
        return;
    }
    if (!birthdate) {
        profileCompletionMessage.textContent = '⚠️ تاريخ الميلاد مطلوب!';
        profileCompletionMessage.style.color = '#ef4444';
        return;
    }
    if (!phone) {
        profileCompletionMessage.textContent = '⚠️ رقم الهاتف مطلوب!';
        profileCompletionMessage.style.color = '#ef4444';
        return;
    }
    
    // Update user
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    
    if (userData) {
        userData.firstName = firstName;
        userData.lastName = lastName;
        userData.country = country;
        userData.city = city;
        userData.birthdate = birthdate;
        userData.phone = phone;
        userData.profileCompleted = true;
        userData.displayName = firstName + ' ' + lastName;
        
        saveUserToStorage(userData);
        currentUser = { ...userData };
        saveSessionSafely(currentUser);
        
        profileCompletionMessage.textContent = '✅ تم حفظ البيانات بنجاح!';
        profileCompletionMessage.style.color = '#22c55e';
        
        setTimeout(() => {
            showDashboard();
        }, 500);
    } else {
        profileCompletionMessage.textContent = '❌ حدث خطأ في حفظ البيانات';
        profileCompletionMessage.style.color = '#ef4444';
    }
});

// Login
document.getElementById('forgotPasswordLink').addEventListener('click', function() {
    const email = prompt('أدخل بريدك الإلكتروني المسجل لإرسال رابط إعادة تعيين كلمة المرور:');
    if (!email) return;
    const result = requestPasswordReset(email.trim().toLowerCase());
    authMessage.textContent = result.message;
    authMessage.style.color = result.success ? '#22c55e' : '#ef4444';
});

loginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    const u = usernameInput.value.trim().toLowerCase();
    const p = passwordInput.value.trim();
    if (!u || !p) {
        authMessage.textContent = '⚠️ أدخل البريد الإلكتروني وكلمة المرور!';
        authMessage.style.color = '#f59e0b';
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    // البحث بالبريد الإلكتروني أولاً (الطريقة الجديدة)، وإذا لم يوجد جرّب اسم المستخدم (توافق مع الحسابات القديمة)
    const user = users.find(x => (x.email || '').toLowerCase() === u) || users.find(x => x.username.toLowerCase() === u);
    if (!user) {
        authMessage.textContent = '❌ لا يوجد حساب بهذا البريد الإلكتروني!';
        authMessage.style.color = '#ef4444';
        return;
    }
    if (user.password !== p) {
        authMessage.textContent = '❌ كلمة المرور خاطئة!';
        authMessage.style.color = '#ef4444';
        return;
    }
    
    currentUser = { ...user };
    saveSessionSafely(currentUser);
    authMessage.textContent = '✅ تم الدخول بنجاح!';
    authMessage.style.color = '#22c55e';
    
    // Check if profile is completed
    if (!currentUser.profileCompleted) {
        showProfileCompletion();
        updateDashboardUI();
        return;
    }
    
    showDashboard();
});

// Logout
logoutBtn.addEventListener('click', function() { logout(); });

// Mining
mineBtn.addEventListener('click', startMining);

// Profile / Settings
profileTrigger.addEventListener('click', function() {
    if (currentUser) {
        refreshCurrentUser();
        profileNameInput.value = currentUser.displayName || currentUser.username;
        profileImageInput.value = currentUser.avatar || '';
        document.getElementById('settingsUserId').textContent = currentUser.accountId || '--';
        document.getElementById('settingsEmailInput').value = currentUser.email || '';
        const emailStatusEl = document.getElementById('settingsEmailVerifyStatus');
        if (currentUser.emailVerified) {
            emailStatusEl.innerHTML = '<span style="color:#22c55e;"><i class="fas fa-check-circle"></i> بريد موثّق</span>';
        } else {
            emailStatusEl.innerHTML = '<span style="color:#f59e0b;"><i class="fas fa-exclamation-circle"></i> بريد غير موثّق بعد</span>';
        }
        document.getElementById('settingsCurrentPassword').value = '';
        document.getElementById('settingsNewPassword').value = '';
        document.getElementById('settingsConfirmPassword').value = '';
        document.getElementById('settingsEmailMsg').textContent = '';
        document.getElementById('settingsPasswordMsg').textContent = '';

        const verifyBadgeEl = document.getElementById('settingsVerifyBadge');
        const vStatus = currentUser.verificationStatus || 'pending';
        if (vStatus === 'verified') {
            verifyBadgeEl.innerHTML = '<i class="fas fa-check-circle"></i> حساب موثّق';
            verifyBadgeEl.className = 'settings-verify-badge verified';
        } else if (vStatus === 'rejected') {
            verifyBadgeEl.innerHTML = '<i class="fas fa-times-circle"></i> تم رفض التوثيق';
            verifyBadgeEl.className = 'settings-verify-badge rejected';
        } else {
            verifyBadgeEl.innerHTML = '<i class="fas fa-hourglass-half"></i> بانتظار التوثيق';
            verifyBadgeEl.className = 'settings-verify-badge pending';
        }

        if (currentUser.avatar) {
            profileAvatarBig.innerHTML = `<img src="${currentUser.avatar}" alt="avatar">`;
        } else {
            profileAvatarBig.innerHTML = `<i class="fas fa-user"></i>`;
        }

        openFullPage('settingsFullPage');
    }
});

saveProfileBtn.addEventListener('click', function() {
    if (!currentUser) return;
    const newName = profileNameInput.value.trim() || currentUser.username;
    const newAvatar = profileImageInput.value.trim();
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (userData) {
        userData.displayName = newName;
        userData.avatar = newAvatar;
        saveUserToStorage(userData);
        currentUser = { ...userData };
        saveSessionSafely(currentUser);
        updateDashboardUI();
        showToast('✅ تم حفظ الاسم والصورة بنجاح', 'success');
    }
});

document.getElementById('resendVerifyEmailBtn').addEventListener('click', function() {
    if (!currentUser) return;
    refreshCurrentUser();
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (!userData) return;

    if (userData.emailVerified) {
        document.getElementById('settingsEmailMsg').textContent = 'بريدك موثّق أصلاً، لا حاجة لإعادة الإرسال.';
        document.getElementById('settingsEmailMsg').style.color = '#22c55e';
        return;
    }

    userData.emailVerifyToken = generateSecureToken();
    userData.emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    saveUserToStorage(userData);
    currentUser = { ...userData };
    saveSessionSafely(currentUser);

    sendEmailVerificationLink(userData);
    document.getElementById('settingsEmailMsg').textContent = '✅ تم إرسال رابط تحقق جديد إلى بريدك الإلكتروني';
    document.getElementById('settingsEmailMsg').style.color = '#22c55e';
    showToast('✅ تم إرسال رابط التحقق', 'success');
});

// Settings: change email
document.getElementById('saveEmailBtn').addEventListener('click', function() {
    if (!currentUser) return;
    const msgEl = document.getElementById('settingsEmailMsg');
    const newEmail = document.getElementById('settingsEmailInput').value.trim().toLowerCase();

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        msgEl.textContent = '⚠️ الرجاء إدخال بريد إلكتروني صحيح';
        msgEl.style.color = '#ef4444';
        return;
    }

    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const emailTaken = users.some(u => u.username !== currentUser.username && (u.email || '').toLowerCase() === newEmail);
    if (emailTaken) {
        msgEl.textContent = '❌ هذا البريد الإلكتروني مستخدم من قبل حساب آخر';
        msgEl.style.color = '#ef4444';
        return;
    }

    const userData = users.find(u => u.username === currentUser.username);
    if (userData) {
        const emailChanged = userData.email !== newEmail;
        userData.email = newEmail;
        if (emailChanged) {
            userData.emailVerified = false;
            userData.emailVerifyToken = generateSecureToken();
            userData.emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
        saveUserToStorage(userData);
        currentUser = { ...userData };
        saveSessionSafely(currentUser);
        if (emailChanged) {
            sendEmailVerificationLink(userData);
            msgEl.textContent = '✅ تم تحديث البريد — تم إرسال رابط تحقق جديد إليه';
        } else {
            msgEl.textContent = '✅ تم تحديث البريد الإلكتروني بنجاح';
        }
        msgEl.style.color = '#22c55e';
        showToast('✅ تم تحديث البريد الإلكتروني', 'success');
    }
});

// Settings: change password (requires current password as security verification)
document.getElementById('saveNewPasswordBtn').addEventListener('click', function() {
    if (!currentUser) return;
    const msgEl = document.getElementById('settingsPasswordMsg');
    const currentPass = document.getElementById('settingsCurrentPassword').value;
    const newPass = document.getElementById('settingsNewPassword').value;
    const confirmPass = document.getElementById('settingsConfirmPassword').value;

    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (!userData) return;

    if (currentPass !== userData.password) {
        msgEl.textContent = '❌ كلمة المرور الحالية غير صحيحة';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!newPass || newPass.length < 6) {
        msgEl.textContent = '⚠️ كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (newPass !== confirmPass) {
        msgEl.textContent = '⚠️ كلمة المرور الجديدة وتأكيدها غير متطابقين';
        msgEl.style.color = '#ef4444';
        return;
    }

    // تغيير كلمة المرور فقط — لا يمس الجلسة الحالية ولا الرصيد ولا التعدين ولا الإحالات ولا السكواد
    userData.password = newPass;
    saveUserToStorage(userData);
    currentUser = { ...userData };
    saveSessionSafely(currentUser);

    document.getElementById('settingsCurrentPassword').value = '';
    document.getElementById('settingsNewPassword').value = '';
    document.getElementById('settingsConfirmPassword').value = '';
    msgEl.textContent = '✅ تم تغيير كلمة المرور بنجاح';
    msgEl.style.color = '#22c55e';
    showToast('✅ تم تغيير كلمة المرور بنجاح', 'success');
});

// Chat
chatFullToggle.addEventListener('click', function() {
    if (currentUser) { openFullPage('chatFull'); document.getElementById('chatFullInput').focus(); }
});

document.getElementById('chatFullInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendChatMessage();
});

// Navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(this.dataset.page).classList.add('active');
    });
});

// Squad
document.getElementById('squadBtn').addEventListener('click', openSquadFullPage);

// Transfers
document.getElementById('transfersBtn').addEventListener('click', function() {
    if (!currentUser) return;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('pageTransfers').classList.add('active');
    renderTransferHistory();
});

// Wallet -> Asset
document.getElementById('walletToAssetBtn').addEventListener('click', function() {
    if (!currentUser) { alert('الرجاء تسجيل الدخول أولاً!'); return; }
    refreshCurrentUser();
    if (isTransferBlockedByMining('walletToAssetMessage')) return;
    
    const amount = parseFloat(document.getElementById('walletToAssetAmount').value);
    const msgEl = document.getElementById('walletToAssetMessage');
    
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
        msgEl.textContent = '⚠️ الرجاء إدخال مبلغ صحيح!';
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (!userData) {
        msgEl.textContent = '❌ حدث خطأ في بيانات المستخدم!';
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const balance = parseSafeNumber(userData.balance);
    
    if (amount > balance) {
        msgEl.textContent = `❌ الرصيد غير كافٍ! المتاح: $${balance.toFixed(2)}`;
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const result = executeTransfer('wallet', 'asset', amount, true);
    
    if (result.success) {
        msgEl.textContent = `✅ تم تحويل $${amount.toFixed(2)} من المحفظة إلى الأسست بنجاح!`;
        msgEl.style.color = '#22c55e';
        document.getElementById('walletToAssetAmount').value = '';
        updateDashboardUI();
    } else {
        msgEl.textContent = result.message;
        msgEl.style.color = '#ef4444';
    }
});

// Asset -> Mining
document.getElementById('assetToMiningTransferBtn').addEventListener('click', function() {
    if (!currentUser) { alert('الرجاء تسجيل الدخول أولاً!'); return; }
    refreshCurrentUser();
    if (isTransferBlockedByMining('assetToMiningTransferMessage')) return;
    
    const amount = parseFloat(document.getElementById('assetToMiningTransferAmount').value);
    const msgEl = document.getElementById('assetToMiningTransferMessage');
    
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
        msgEl.textContent = '⚠️ الرجاء إدخال مبلغ صحيح!';
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (!userData) {
        msgEl.textContent = '❌ حدث خطأ في بيانات المستخدم!';
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const balance = parseSafeNumber(userData.assetBalance);
    
    if (amount > balance) {
        msgEl.textContent = `❌ الرصيد غير كافٍ! المتاح: $${balance.toFixed(2)}`;
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const result = executeTransfer('asset', 'mining', amount, false);
    
    if (result.success) {
        msgEl.textContent = `✅ تم إنشاء طلب تحويل $${amount.toFixed(2)} من الأسست إلى التعدين (قيد المعالجة 24 ساعة)`;
        msgEl.style.color = '#fbbf24';
        document.getElementById('assetToMiningTransferAmount').value = '';
        updateDashboardUI();
    } else {
        msgEl.textContent = result.message;
        msgEl.style.color = '#ef4444';
    }
});

// Mining -> Wallet
document.getElementById('miningToWalletBtn').addEventListener('click', function() {
    if (!currentUser) { alert('الرجاء تسجيل الدخول أولاً!'); return; }
    refreshCurrentUser();
    if (isTransferBlockedByMining('miningToWalletMessage')) return;
    
    const amount = parseFloat(document.getElementById('miningToWalletAmount').value);
    const msgEl = document.getElementById('miningToWalletMessage');
    
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
        msgEl.textContent = '⚠️ الرجاء إدخال مبلغ صحيح!';
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (!userData) {
        msgEl.textContent = '❌ حدث خطأ في بيانات المستخدم!';
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const balance = parseSafeNumber(userData.miningBalance);
    
    if (amount > balance) {
        msgEl.textContent = `❌ الرصيد غير كافٍ! المتاح: $${balance.toFixed(2)}`;
        msgEl.style.color = '#ef4444';
        return;
    }
    
    const result = executeTransfer('mining', 'wallet', amount, false);
    
    if (result.success) {
        msgEl.textContent = `✅ تم إنشاء طلب تحويل $${amount.toFixed(2)} من التعدين إلى المحفظة (قيد المعالجة 24 ساعة)`;
        msgEl.style.color = '#fbbf24';
        document.getElementById('miningToWalletAmount').value = '';
        updateDashboardUI();
    } else {
        msgEl.textContent = result.message;
        msgEl.style.color = '#ef4444';
    }
});

// Deposit
document.getElementById('depositBtn').addEventListener('click', function() {
    if (!currentUser) return;
    document.getElementById('depositMessage').textContent = '';
    document.getElementById('depositSuccessBox').classList.remove('show');
    document.getElementById('depositFormContainer').style.display = 'block';
    document.getElementById('networkSelection').classList.remove('show');
    document.getElementById('networkAddressBox').classList.remove('show');
    setDepositStep(1);

    refreshCurrentUser();
    if (currentUser.pendingDeposit && currentUser.pendingDeposit.expiresAt && new Date(currentUser.pendingDeposit.expiresAt) > new Date()) {
        resumePendingDepositUI();
    } else {
        document.getElementById('depositAmount').value = '';
        document.getElementById('depositFeeNote').textContent = '';
        document.getElementById('depositReceiptCard').classList.remove('show');
    }
    openFullPage('depositFull');
});

document.getElementById('depositAmount').addEventListener('input', function() {
    const amount = parseFloat(this.value);
    const fees = loadFees();
    const feeNote = document.getElementById('depositFeeNote');
    const card = document.getElementById('depositReceiptCard');
    if (amount && amount > 0) {
        const fee = amount * fees.depositFee;
        const net = amount - fee;
        feeNote.textContent = `سيتم خصم ${(fees.depositFee * 100).toFixed(0)}% رسوم شبكة ($${fee.toFixed(2)}) — ستتلقى $${net.toFixed(2)} USDT`;
        document.getElementById('rcAmount').textContent = `$${amount.toFixed(2)}`;
        document.getElementById('rcFee').textContent = `-$${fee.toFixed(2)}`;
        document.getElementById('rcNet').textContent = `$${net.toFixed(2)}`;
        card.classList.add('show');
    } else {
        feeNote.textContent = '';
        card.classList.remove('show');
    }
});

document.getElementById('showNetworksBtn').addEventListener('click', function() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
        document.getElementById('depositMessage').textContent = '⚠️ الرجاء إدخال مبلغ صحيح!';
        document.getElementById('depositMessage').style.color = '#ef4444';
        return;
    }

    refreshCurrentUser();
    if (currentUser.pendingDeposit && currentUser.pendingDeposit.expiresAt && new Date(currentUser.pendingDeposit.expiresAt) > new Date()) {
        resumePendingDepositUI();
        return;
    }

    const address = popDepositAddressForUser(currentUser.accountId || currentUser.username);
    if (!address) {
        document.getElementById('depositMessage').textContent = '⚠️ لا توجد عناوين إيداع متاحة حالياً، الرجاء المحاولة لاحقاً أو التواصل مع الدعم.';
        document.getElementById('depositMessage').style.color = '#ef4444';
        return;
    }

    const fees = loadFees();
    const fee = amount * fees.depositFee;
    const netAmount = amount - fee;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const depositId = 'DEP' + Date.now() + Math.random().toString(36).substring(2, 6);
    const deposits = loadDeposits();
    deposits.unshift({
        id: depositId,
        userId: currentUser.username,
        amount: amount,
        fee: fee,
        netAmount: netAmount,
        assignedAddress: address,
        status: 'pending',
        txHash: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    });
    saveDeposits(deposits);

    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (userData) {
        userData.pendingDeposit = { depositId, address, amount, expiresAt: expiresAt.toISOString() };
        saveUserToStorage(userData);
        currentUser = { ...userData };
        saveSessionSafely(currentUser);
    }

    renderDepositAddressUI(address, amount, netAmount, expiresAt);
});

let depositCountdownInterval = null;
function renderDepositAddressUI(address, amount, netAmount, expiresAt) {
    document.getElementById('depositMessage').textContent = '';
    document.getElementById('depositAddressText').textContent = address;
    document.getElementById('depositExactAmount').textContent = `$${amount.toFixed(2)}`;
    document.getElementById('networkSelection').classList.add('show');
    document.getElementById('networkAddressBox').classList.add('show');
    setDepositStep(2);

    const mins = Math.max(0, Math.round((new Date(expiresAt) - new Date()) / 60000));
    document.getElementById('depositExpiryNote').textContent = `⏰ صالح لمدة ${Math.floor(mins / 60)} ساعة و${mins % 60} دقيقة تقريباً`;

    if (depositCountdownInterval) clearInterval(depositCountdownInterval);
    const updateCountdown = () => {
        const chip = document.getElementById('depositCountdownChip');
        if (!chip) { clearInterval(depositCountdownInterval); return; }
        const remainMs = new Date(expiresAt) - new Date();
        if (remainMs <= 0) {
            chip.innerHTML = '<i class="fas fa-clock"></i> انتهت الصلاحية';
            clearInterval(depositCountdownInterval);
            return;
        }
        const h = Math.floor(remainMs / 3600000);
        const m = Math.floor((remainMs % 3600000) / 60000);
        const s = Math.floor((remainMs % 60000) / 1000);
        chip.innerHTML = `<i class="fas fa-clock"></i> ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };
    updateCountdown();
    depositCountdownInterval = setInterval(updateCountdown, 1000);
}

function setDepositStep(step) {
    document.querySelectorAll('#depositStepTrack .step-node').forEach(node => {
        node.classList.toggle('active', parseInt(node.dataset.step) <= step);
    });
}

function resumePendingDepositUI() {
    const pd = currentUser.pendingDeposit;
    if (!pd) return;
    document.getElementById('depositAmount').value = pd.amount;
    const fees = loadFees();
    const fee = pd.amount * fees.depositFee;
    const net = pd.amount - fee;
    document.getElementById('depositFeeNote').textContent = `سيتم خصم ${(fees.depositFee * 100).toFixed(0)}% رسوم شبكة ($${fee.toFixed(2)}) — ستتلقى $${net.toFixed(2)} USDT`;
    document.getElementById('rcAmount').textContent = `$${pd.amount.toFixed(2)}`;
    document.getElementById('rcFee').textContent = `-$${fee.toFixed(2)}`;
    document.getElementById('rcNet').textContent = `$${net.toFixed(2)}`;
    document.getElementById('depositReceiptCard').classList.add('show');
    renderDepositAddressUI(pd.address, pd.amount, net, pd.expiresAt);

    const deposits = loadDeposits();
    const dep = deposits.find(d => d.id === pd.depositId);
    if (dep && dep.status === 'confirming') {
        setDepositStep(3);
        document.getElementById('depositFormContainer').style.display = 'none';
        document.getElementById('depositSuccessBox').classList.add('show');
        document.getElementById('depositSuccessIcon').className = 'fas fa-hourglass-half';
        document.getElementById('depositSuccessTitle').textContent = '⏳ جاري التحقق من البلوكشين...';
        document.getElementById('depositSuccessText').textContent = 'يرجى عدم إغلاق الصفحة — يتم فحص شبكة TRON فعلياً للتأكد من وصول المبلغ.';
        pollBlockchainForDeposit(dep.id);
    }
}

document.getElementById('confirmDepositBtn').addEventListener('click', function() {
    refreshCurrentUser();
    const pd = currentUser.pendingDeposit;
    if (!pd) {
        document.getElementById('depositMessage').textContent = '⚠️ الرجاء الحصول على عنوان إيداع أولاً!';
        document.getElementById('depositMessage').style.color = '#ef4444';
        return;
    }

    const deposits = loadDeposits();
    const dep = deposits.find(d => d.id === pd.depositId);
    if (!dep) return;

    dep.status = 'confirming';
    dep.updatedAt = new Date().toISOString();
    saveDeposits(deposits);

    setDepositStep(3);
    document.getElementById('depositFormContainer').style.display = 'none';
    document.getElementById('depositSuccessBox').classList.add('show');
    document.getElementById('depositSuccessIcon').className = 'fas fa-hourglass-half';
    document.getElementById('depositSuccessIcon').style.color = '#fbbf24';
    document.getElementById('depositSuccessTitle').textContent = '⏳ جاري التحقق من البلوكشين...';
    document.getElementById('depositSuccessText').textContent = 'يرجى عدم إغلاق الصفحة — يتم فحص شبكة TRON فعلياً للتأكد من وصول المبلغ.';

    pollBlockchainForDeposit(dep.id);
});

// فحص حقيقي (وليس تمثيلياً) — يسأل شبكة TRON مباشرة عبر TronGrid العامة هل وصلت المعاملة فعلياً
async function checkBlockchainForAddress(address, expectedAmount) {
    try {
        const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=20&contract_address=${USDT_TRC20_CONTRACT}`;
        const res = await fetch(url);
        if (res.status === 429) {
            console.warn('TronGrid: تم تجاوز حد الطلبات مؤقتاً (429)، سيُعاد الفحص بفاصل زمني أطول.');
            return { found: false, rateLimited: true };
        }
        if (!res.ok) return { found: false };
        const data = await res.json();
        if (!data || !Array.isArray(data.data)) return { found: false };

        for (const tx of data.data) {
            if (tx.to === address) {
                const value = parseFloat(tx.value) / 1e6;
                if (value >= expectedAmount * 0.98) {
                    return { found: true, txHash: tx.transaction_id, value };
                }
            }
        }
        return { found: false };
    } catch (e) {
        console.warn('تعذر الفحص المباشر للبلوكشين حالياً (شبكة/CORS)، سيعاد المحاولة:', e);
        return { found: false };
    }
}

const activePollingDeposits = new Set();

async function pollBlockchainForDeposit(depositId, maxAttempts = 60, intervalMs = 15000) {
    if (activePollingDeposits.has(depositId)) return; // فحص شغال أصلاً لنفس الطلب، لا تكرره
    activePollingDeposits.add(depositId);

    let attempts = 0;
    let currentInterval = intervalMs;
    try {
        while (attempts < maxAttempts) {
            const deposits = loadDeposits();
            const dep = deposits.find(d => d.id === depositId);
            if (!dep || dep.status === 'completed' || dep.status === 'failed') return;

            const result = await checkBlockchainForAddress(dep.assignedAddress, dep.amount);

            const latestDeposits = loadDeposits();
            const latestDep = latestDeposits.find(d => d.id === depositId);
            if (!latestDep || latestDep.status === 'failed') return;

            if (result && result.found) {
                latestDep.status = 'completed';
                latestDep.txHash = result.txHash;
                latestDep.updatedAt = new Date().toISOString();
                saveDeposits(latestDeposits);
                completeDepositForUser(latestDep);
                return;
            }

            // إذا واجهنا حظر مؤقت (429) من TronGrid، نزيد فترة الانتظار تدريجياً بدل تكرار الضرب على نفس الحد
            currentInterval = result && result.rateLimited ? Math.min(currentInterval * 1.8, 60000) : intervalMs;

            attempts++;
            if (document.getElementById('depositSuccessBox').classList.contains('show')) {
                document.getElementById('depositSuccessText').textContent =
                    `⏳ لسا ما وصلت المعاملة على البلوكشين... جاري إعادة الفحص (محاولة ${attempts}/${maxAttempts})`;
            }
            await new Promise(r => setTimeout(r, currentInterval));
        }
    } finally {
        activePollingDeposits.delete(depositId);
    }
}

function completeDepositForUser(dep) {
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === dep.userId);
    if (!userData) return;

    userData.balance = parseSafeNumber(userData.balance) + dep.netAmount;
    if (!userData.depositHistory) userData.depositHistory = [];
    userData.depositHistory.unshift({
        id: dep.id,
        amount: dep.amount,
        network: 'USDT - TRC20',
        status: 'completed',
        timestamp: new Date().toISOString()
    });
    userData.pendingDeposit = null;
    saveUserToStorage(userData);

    addCompanyRevenue(dep.fee, 'deposit');

    if (currentUser && currentUser.username === userData.username) {
        currentUser = { ...userData };
        saveSessionSafely(currentUser);
        updateDashboardUI();
        renderAllRealHistory();
        const icon = document.getElementById('depositSuccessIcon');
        if (icon) { icon.className = 'fas fa-check-circle'; icon.style.color = '#22c55e'; }
        const title = document.getElementById('depositSuccessTitle');
        if (title) title.textContent = '✅ تم تأكيد الإيداع!';
        const txt = document.getElementById('depositSuccessText');
        if (txt) txt.textContent = `✅ تم تأكيد إيداع $${dep.amount.toFixed(2)} USDT! تمت إضافة $${dep.netAmount.toFixed(2)} لمحفظتك.`;
        showToast(`✅ تم تأكيد إيداع $${dep.amount.toFixed(2)} USDT!`, 'success');
    }
}

function cancelPendingDepositRequest() {
    refreshCurrentUser();
    const pd = currentUser.pendingDeposit;
    if (!pd) return;

    const deposits = loadDeposits();
    const dep = deposits.find(d => d.id === pd.depositId);
    if (dep && (dep.status === 'pending' || dep.status === 'confirming')) {
        dep.status = 'failed';
        dep.updatedAt = new Date().toISOString();
        saveDeposits(deposits);
    }

    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (userData) {
        userData.pendingDeposit = null;
        saveUserToStorage(userData);
        currentUser = { ...userData };
        saveSessionSafely(currentUser);
    }
}

document.getElementById('cancelDepositBtn').addEventListener('click', function() {
    if (depositCountdownInterval) clearInterval(depositCountdownInterval);
    cancelPendingDepositRequest();
    document.getElementById('networkSelection').classList.remove('show');
    document.getElementById('networkAddressBox').classList.remove('show');
    document.getElementById('depositMessage').textContent = 'تم إلغاء الطلب.';
    document.getElementById('depositMessage').style.color = '#8896b0';
    setDepositStep(1);
});

document.getElementById('cancelConfirmingDepositBtn').addEventListener('click', function() {
    if (depositCountdownInterval) clearInterval(depositCountdownInterval);
    cancelPendingDepositRequest();
    document.getElementById('depositSuccessBox').classList.remove('show');
    document.getElementById('depositFormContainer').style.display = 'block';
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositFeeNote').textContent = '';
    document.getElementById('depositReceiptCard').classList.remove('show');
    document.getElementById('networkSelection').classList.remove('show');
    document.getElementById('networkAddressBox').classList.remove('show');
    document.getElementById('depositMessage').textContent = 'تم إلغاء الطلب.';
    document.getElementById('depositMessage').style.color = '#8896b0';
    setDepositStep(1);
    showToast('تم إلغاء طلب الإيداع.', 'info');
});

document.getElementById('backToWalletBtn').addEventListener('click', function() {
    closeFullPage('depositFull');
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.nav-tab[data-page="pageWallet"]').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('pageWallet').classList.add('active');
    document.getElementById('depositFormContainer').style.display = 'block';
    document.getElementById('depositSuccessBox').classList.remove('show');
    document.getElementById('depositMessage').textContent = '';
});

// إذا كانت هناك عملية إيداع "قيد التحقق" من قبل جلسة سابقة، استأنف الفحص بالخلفية بصمت
function resumeConfirmingDepositInBackground() {
    if (!currentUser || !currentUser.pendingDeposit) return;
    const deposits = loadDeposits();
    const dep = deposits.find(d => d.id === currentUser.pendingDeposit.depositId);
    if (dep && dep.status === 'confirming') {
        pollBlockchainForDeposit(dep.id);
    }
}

// Withdraw
let selectedWithdrawType = null;

document.getElementById('withdrawBtn').addEventListener('click', function() {
    if(!currentUser) return;
    document.getElementById('withdrawAction').style.display = 'none';
    document.getElementById('withdrawMessage').textContent = '';
    document.getElementById('withdrawAmountInput').value = '';
    selectedWithdrawType = null;
    updateDashboardUI();
    document.querySelectorAll('#withdrawOptions .source-card').forEach(opt => opt.classList.remove('selected'));
    openFullPage('withdrawFull');
});

document.querySelectorAll('#withdrawOptions .source-card').forEach(opt => {
    opt.addEventListener('click', function() {
        if (this.dataset.type !== 'wallet') {
            document.getElementById('withdrawMessage').textContent = '⚠️ السحب متاح من رصيد المحفظة فقط!';
            document.getElementById('withdrawMessage').style.color = '#f59e0b';
            return;
        }
        
        document.querySelectorAll('#withdrawOptions .source-card').forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        selectedWithdrawType = this.dataset.type;
        document.getElementById('withdrawAction').style.display = 'block';
        document.getElementById('withdrawMessage').textContent = '';
        document.getElementById('withdrawAmountInput').focus();
    });
});

function isValidTronAddress(addr) {
    return typeof addr === 'string' && /^T[a-zA-Z0-9]{33}$/.test(addr.trim());
}

document.getElementById('withdrawAmountInput').addEventListener('input', updateWithdrawFeeNote);
function updateWithdrawFeeNote() {
    const amount = parseFloat(document.getElementById('withdrawAmountInput').value);
    const fees = loadFees();
    const note = document.getElementById('withdrawFeeNote');
    const card = document.getElementById('withdrawReceiptCard');
    if (amount && amount > 0) {
        const fee = amount * fees.withdrawFee;
        const net = amount - fee;
        note.textContent = `سيتم خصم ${(fees.withdrawFee * 100).toFixed(0)}% رسوم شبكة ($${fee.toFixed(2)}) — سيصلك $${net.toFixed(2)} USDT`;
        document.getElementById('wRcAmount').textContent = `$${amount.toFixed(2)}`;
        document.getElementById('wRcFee').textContent = `-$${fee.toFixed(2)}`;
        document.getElementById('wRcNet').textContent = `$${net.toFixed(2)}`;
        card.classList.add('show');
    } else {
        note.textContent = '';
        card.classList.remove('show');
    }
}

document.getElementById('confirmWithdrawBtn').addEventListener('click', function() {
    if (!selectedWithdrawType) {
        document.getElementById('withdrawMessage').textContent = '⚠️ الرجاء اختيار مصدر السحب';
        document.getElementById('withdrawMessage').style.color = '#ef4444';
        return;
    }

    refreshCurrentUser();
    if (currentUser.isMiningActive) {
        document.getElementById('withdrawMessage').textContent = '⚠️ لا يمكن السحب أثناء التعدين. انتظر حتى تنتهي الجلسة.';
        document.getElementById('withdrawMessage').style.color = '#ef4444';
        return;
    }

    const amount = parseFloat(document.getElementById('withdrawAmountInput').value);
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
        document.getElementById('withdrawMessage').textContent = '⚠️ الرجاء إدخال مبلغ صحيح';
        document.getElementById('withdrawMessage').style.color = '#ef4444';
        return;
    }

    const address = (document.getElementById('withdrawAddressInput').value || '').trim();
    if (!isValidTronAddress(address)) {
        document.getElementById('withdrawMessage').textContent = '⚠️ عنوان المحفظة غير صحيح! يجب أن يبدأ بحرف T ويتكون من 34 حرفاً (TRC20)';
        document.getElementById('withdrawMessage').style.color = '#ef4444';
        return;
    }

    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    if (!userData) {
        document.getElementById('withdrawMessage').textContent = '❌ حدث خطأ في بيانات المستخدم!';
        document.getElementById('withdrawMessage').style.color = '#ef4444';
        return;
    }

    const fees = loadFees();
    const fee = amount * fees.withdrawFee;
    const totalDeduct = amount + fee;

    const available = parseSafeNumber(userData.balance);
    if (totalDeduct > available) {
        document.getElementById('withdrawMessage').textContent = `❌ الرصيد غير كافٍ! المطلوب (المبلغ + الرسوم): $${totalDeduct.toFixed(2)} — المتاح: $${available.toFixed(2)}`;
        document.getElementById('withdrawMessage').style.color = '#ef4444';
        return;
    }

    userData.balance = parseSafeNumber(userData.balance) - totalDeduct;

    const withdrawId = 'WD' + Date.now() + Math.random().toString(36).substring(2, 6);
    const withdrawals = loadWithdrawals();
    withdrawals.unshift({
        id: withdrawId,
        userId: userData.username,
        amount: amount,
        fee: fee,
        netAmount: amount,
        userWalletAddress: address,
        network: 'USDT - TRC20',
        status: 'pending',
        createdAt: new Date().toISOString()
    });
    saveWithdrawals(withdrawals);

    if (!userData.withdrawHistory) userData.withdrawHistory = [];
    userData.withdrawHistory.unshift({
        id: withdrawId,
        amount: amount,
        source: 'wallet',
        address: address,
        status: 'pending',
        timestamp: new Date().toISOString()
    });

    saveUserToStorage(userData);
    currentUser = { ...userData };
    saveSessionSafely(currentUser);
    updateDashboardUI();
    renderAllRealHistory();

    document.getElementById('withdrawMessage').textContent = `✅ تم تقديم طلب سحب $${amount.toFixed(2)} USDT بنجاح. بانتظار موافقة الإدارة.`;
    document.getElementById('withdrawMessage').style.color = '#22c55e';
    showToast('✅ تم تقديم طلب السحب. في انتظار موافقة الإدارة.', 'success');

    document.getElementById('withdrawAmountInput').value = '';
    document.getElementById('withdrawAddressInput').value = '';
    document.getElementById('withdrawFeeNote').textContent = '';
    document.getElementById('withdrawAction').style.display = 'none';
});

// History Grid
document.querySelectorAll('.history-col').forEach(col => {
    col.addEventListener('click', function() {
        document.querySelectorAll('.history-col').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        
        const listId = this.dataset.list;
        
        switch(listId) {
            case 'invoicesModalList':
                renderInvoicesList();
                break;
            case 'profitsList':
                renderProfitsList();
                break;
            case 'transferHistoryListMenu':
                renderTransferHistory();
                break;
        }
        
        document.querySelectorAll('.history-list').forEach(list => list.classList.add('hidden'));
        
        const target = document.getElementById(listId);
        if (target) {
            target.classList.remove('hidden');
            
            const hasData = target.children.length > 0;
            if (!hasData && (listId === 'invoicesModalList' || listId === 'profitsList' || listId === 'transferHistoryListMenu')) {
                const isEmptyMessage = target.querySelector('div[style*="text-align:center"]');
                if (!isEmptyMessage && target.children.length === 0) {
                    let icon = 'fa-inbox';
                    let msg = 'لا توجد بيانات بعد';
                    if (listId === 'invoicesModalList') {
                        icon = 'fa-file-invoice';
                        msg = 'لا توجد فواتير بعد';
                    } else if (listId === 'profitsList') {
                        icon = 'fa-chart-pie';
                        msg = 'لا توجد أرباح مسجلة بعد';
                    } else if (listId === 'transferHistoryListMenu') {
                        icon = 'fa-exchange-alt';
                        msg = 'لا توجد تحويلات بعد';
                    }
                    target.innerHTML = `
                        <div style="text-align:center;color:#8896b0;padding:16px;font-size:0.8rem;">
                            <i class="fas ${icon}" style="font-size:2rem;display:block;margin-bottom:10px;color:#2a3650;"></i>
                            ${msg}
                        </div>
                    `;
                }
            }
        }
    });
});

// Coin items
coinItems.forEach(item => {
    item.addEventListener('click', function() {
        const coin = this.dataset.coin;
        if (coin === currentCoin) return;
        
        coinItems.forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        currentCoin = coin;
        
        updateMarketChart(coin);
        
        if (miningActive) {
            mineStatus.textContent = `⛏️ جاري التعدين على ${getCoinName(coin)}...`;
        }
    });
});

// Verify Account
verifyAccountBtn.addEventListener('click', function() {
    if (!currentUser) return;
    
    // Populate verify fields
    const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
    const userData = users.find(u => u.username === currentUser.username);
    
    if (userData) {
        let fullName = userData.displayName || userData.username;
        if (userData.firstName && userData.lastName) {
            fullName = userData.firstName + ' ' + userData.lastName;
        }
        verifyFullName.textContent = fullName || '-';
        verifyBirthdate.textContent = userData.birthdate || '-';
        verifyCountry.textContent = userData.country || '-';
        verifyFileName.textContent = 'لم يتم اختيار ملف';
        document.getElementById('verifyMessage').textContent = '';
        document.getElementById('verifyFileInput').value = '';
    }
    
    document.getElementById('verifyFullPage').classList.add('active');
    mainDash.style.display = 'none';
});

// File upload for verification
verifyFileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        verifyFileName.textContent = this.files[0].name;
    } else {
        verifyFileName.textContent = 'لم يتم اختيار ملف';
    }
});

// يضغط صورة التحقق (يصغّر الأبعاد ويقلل الجودة) قبل الحفظ لتفادي امتلاء مساحة
// التخزين المحلية بسرعة — صورة كاميرا خام (3-5 ميجابايت) تنزل لعشرات الكيلوبايتات فقط
function compressImageDataUrl(rawDataUrl, maxWidth = 900, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = function() { resolve(rawDataUrl); }; // لو فشل الضغط لأي سبب، استخدم الأصلية كحل أخير
        img.src = rawDataUrl;
    });
}

// Submit verification - مع التعديل الحاسم لحفظ الصورة
document.getElementById('submitVerificationBtn').addEventListener('click', function() {
    const file = verifyFileInput.files[0];
    const btn = this;
    
    if (!file) {
        document.getElementById('verifyMessage').textContent = '⚠️ الرجاء رفع صورة الهوية أو جواز السفر';
        document.getElementById('verifyMessage').style.color = '#ef4444';
        return;
    }
    
    document.getElementById('verifyMessage').textContent = '⏳ جاري إرسال الطلب...';
    document.getElementById('verifyMessage').style.color = '#fbbf24';
    btn.disabled = true;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const rawFileData = e.target.result;
        const compressedFileData = await compressImageDataUrl(rawFileData);
        
        // Simulate submission
        setTimeout(() => {
            const users = JSON.parse(localStorage.getItem('krypton_users')) || [];
            const userData = users.find(u => u.username === currentUser.username);
            
            if (userData) {
                userData.identityImage = compressedFileData; // حفظ الصورة المضغوطة فعلياً
                userData.verificationStatus = 'pending';
                userData.verificationSubmittedAt = new Date().toISOString();
                const saved = saveUserToStorage(userData);

                if (!saved) {
                    document.getElementById('verifyMessage').textContent = '❌ تعذر حفظ الطلب — مساحة التخزين على الجهاز ممتلئة. تواصل مع الدعم.';
                    document.getElementById('verifyMessage').style.color = '#ef4444';
                    btn.disabled = false;
                    return;
                }

                currentUser = { ...userData };
                saveSessionSafely(currentUser);
                updateDashboardUI();
                
                document.getElementById('verifyMessage').textContent = '✅ تم إرسال طلب التحقق بنجاح! في انتظار المراجعة.';
                document.getElementById('verifyMessage').style.color = '#22c55e';
                
                setTimeout(() => {
                    closeVerifyFullPage();
                    showToast('✅ تم إرسال طلب التحقق بنجاح! في انتظار المراجعة.', 'success');
                }, 1500);
            }
            
            btn.disabled = false;
        }, 2000);
    };
    reader.readAsDataURL(file);
});

// OTP input auto-advance
document.querySelectorAll('.otp-input').forEach((input, index) => {
    input.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length === 1 && index < 5) {
            const next = document.querySelector(`.otp-input[data-index="${index + 1}"]`);
            if (next) next.focus();
        }
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && this.value === '' && index > 0) {
            const prev = document.querySelector(`.otp-input[data-index="${index - 1}"]`);
            if (prev) prev.focus();
        }
    });
    
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const digits = paste.replace(/[^0-9]/g, '').slice(0, 6);
        const inputs = document.querySelectorAll('.otp-input');
        digits.split('').forEach((digit, i) => {
            if (inputs[i]) {
                inputs[i].value = digit;
            }
        });
        const lastIndex = Math.min(digits.length, 5);
        const nextInput = document.querySelector(`.otp-input[data-index="${lastIndex}"]`);
        if (nextInput) nextInput.focus();
    });
});

// ============================================================
// SECTION 37: ADMIN HELPER FUNCTIONS (Console Only)
// ============================================================

window.Admin = {
    getConfig: AdminAPI.getConfig,
    saveConfig: AdminAPI.saveConfig,
    getProfitTiers: AdminAPI.getProfitTiers,
    setProfitTiers: function(tiers) {
        const config = AdminAPI.getConfig();
        config.profitTiers = tiers;
        AdminAPI.saveConfig(config);
        console.log('✅ تم تحديث الباقات بنجاح');
    },
    setMiningSchedule: function(startHour, startMinute, endHour, endMinute) {
        const config = AdminAPI.getConfig();
        config.miningStartHour = startHour;
        config.miningStartMinute = startMinute || 0;
        config.miningEndHour = endHour;
        config.miningEndMinute = endMinute || 0;
        AdminAPI.saveConfig(config);
        console.log('✅ تم تحديث مواعيد التعدين');
    },
    setMiningEnabled: function(enabled) {
        const config = AdminAPI.getConfig();
        config.miningEnabled = enabled;
        AdminAPI.saveConfig(config);
        console.log(`✅ تم ${enabled ? 'تفعيل' : 'إيقاف'} التعدين`);
        updateMiningButtonState();
    },
    setMiningDuration: function(seconds) {
        const config = AdminAPI.getConfig();
        config.miningDurationSeconds = seconds;
        AdminAPI.saveConfig(config);
        console.log(`✅ تم تحديث مدة التعدين إلى ${seconds} ثانية`);
        updateDashboardUI();
    },
    viewConfig: function() {
        console.log('📋 الإعدادات الحالية:', AdminAPI.getConfig());
        return AdminAPI.getConfig();
    },
    resetToDefaults: function() {
        const defaults = getDefaultConfig();
        AdminAPI.saveConfig(defaults);
        console.log('✅ تم إعادة الإعدادات إلى الوضع الافتراضي');
        updateMiningButtonState();
        updateDashboardUI();
    }
};

// ============================================================
// SECTION 38: INITIALIZATION
// ============================================================

// Check for existing session
checkEmailVerificationLinkOnLoad();
checkPasswordResetLinkOnLoad();

const savedSession = JSON.parse(localStorage.getItem('krypton_session'));
if (savedSession) {
    const user = findUser(savedSession.username);
    if (user && user.password === savedSession.password) {
        currentUser = { ...user };
        if (!currentUser.invoices) currentUser.invoices = [];
        if (!currentUser.profitsHistory) currentUser.profitsHistory = [];
        if (!currentUser.transferHistory) currentUser.transferHistory = [];
        if (!currentUser.referralEarningsHistory) currentUser.referralEarningsHistory = [];
        if (!currentUser.referralBalance) currentUser.referralBalance = 0;
        if (!currentUser.verificationStatus) currentUser.verificationStatus = 'pending';
        if (currentUser.profileCompleted === undefined) currentUser.profileCompleted = false;
        if (currentUser.accountId && currentUser.squadCode !== currentUser.accountId) {
            currentUser.squadCode = currentUser.accountId;
            saveUserToStorage(currentUser);
        }
        
        // Check if profile is completed
        if (!currentUser.profileCompleted) {
            showProfileCompletion();
            updateDashboardUI();
        } else {
            showDashboard();
        }
    } else {
        localStorage.removeItem('krypton_session');
        showLogin();
    }
} else {
    showLogin();
}

// Update mining button state periodically
setInterval(() => {
    if (currentUser && !miningActive) {
        updateMiningButtonState();
    }
}, 60000);

// ============================================================
// SECTION 39: CONSOLE LOGS
// ============================================================

console.log('✅ KryptonPyra Platform is ready!');
console.log('✅ نظام التعدين يعتمد على الإعدادات من ملف التكوين');
console.log('✅ تم تجهيز النظام للتحكم من لوحة الإدارة');
console.log('📋 استخدم Admin.viewConfig() لعرض الإعدادات الحالية');
console.log('📋 استخدم Admin.setMiningEnabled(true/false) لتشغيل/إيقاف التعدين');
console.log('📋 استخدم Admin.setMiningDuration(seconds) لتغيير مدة التعدين');
console.log('📋 استخدم Admin.setProfitTiers([...]) لتعديل الباقات');
console.log('📋 استخدم Admin.setMiningSchedule(18, 0, 20, 0) لتعديل مواعيد التعدين');
console.log('📝 Users:', JSON.parse(localStorage.getItem('krypton_users')) || []);
console.log('📋 Pending Deposits:', pendingDeposits);
console.log('📋 Pending Transfers:', pendingTransfers);
console.log('🔧 approveDeposit(index) | rejectDeposit(index)');
console.log('🔧 approveTransfer(index) | rejectTransfer(index)');
console.log('🔧 approveWithdraw(index) | rejectWithdraw(index)');

// Admin approval functions
window.approveDeposit = function(index) {
    const deposit = pendingDeposits[index];
    if (!deposit) { console.log('❌ الطلب غير موجود'); return; }
    const user = findUser(deposit.username);
    if (user) {
        user.balance = parseSafeNumber(user.balance) + deposit.amount;
        saveUserToStorage(user);
        if (currentUser && currentUser.username === deposit.username) {
            currentUser.balance = user.balance;
            saveSessionSafely(currentUser);
            updateDashboardUI();
        }
        console.log(`✅ تمت الموافقة على إيداع $${deposit.amount.toFixed(2)} للمستخدم ${deposit.displayName}`);
    }
    pendingDeposits.splice(index, 1);
    localStorage.setItem('krypton_pending_deposits', JSON.stringify(pendingDeposits));
    console.log('📋 الطلبات المتبقية:', pendingDeposits);
};

window.rejectDeposit = function(index) {
    const deposit = pendingDeposits[index];
    if (!deposit) { console.log('❌ الطلب غير موجود'); return; }
    console.log(`❌ تم رفض إيداع $${deposit.amount.toFixed(2)} للمستخدم ${deposit.displayName}`);
    pendingDeposits.splice(index, 1);
    localStorage.setItem('krypton_pending_deposits', JSON.stringify(pendingDeposits));
    console.log('📋 الطلبات المتبقية:', pendingDeposits);
};

window.approveTransfer = function(index) {
    const transfer = pendingTransfers[index];
    if (!transfer) { console.log('❌ الطلب غير موجود'); return; }
    const user = findUser(transfer.username);
    if (user) {
        user.assetBalance = parseSafeNumber(user.assetBalance) + transfer.amount;
        saveUserToStorage(user);
        if (currentUser && currentUser.username === transfer.username) {
            currentUser.assetBalance = user.assetBalance;
            saveSessionSafely(currentUser);
            updateDashboardUI();
        }
        console.log(`✅ تمت الموافقة على تحويل $${transfer.amount.toFixed(2)} للمستخدم ${transfer.displayName}`);
    }
    pendingTransfers.splice(index, 1);
    localStorage.setItem('krypton_pending_transfers', JSON.stringify(pendingTransfers));
    console.log('📋 طلبات التحويل المتبقية:', pendingTransfers);
};

window.rejectTransfer = function(index) {
    const transfer = pendingTransfers[index];
    if (!transfer) { console.log('❌ الطلب غير موجود'); return; }
    console.log(`❌ تم رفض تحويل $${transfer.amount.toFixed(2)} للمستخدم ${transfer.displayName}`);
    pendingTransfers.splice(index, 1);
    localStorage.setItem('krypton_pending_transfers', JSON.stringify(pendingTransfers));
    console.log('📋 طلبات التحويل المتبقية:', pendingTransfers);
};

window.approveWithdraw = function(index) {
    const withdraws = JSON.parse(localStorage.getItem('krypton_pending_withdraws')) || [];
    const withdraw = withdraws[index];
    if (!withdraw) { console.log('❌ الطلب غير موجود'); return; }
    console.log(`✅ تمت الموافقة على سحب $${withdraw.amount.toFixed(2)} للمستخدم ${withdraw.displayName}`);
    withdraws.splice(index, 1);
    localStorage.setItem('krypton_pending_withdraws', JSON.stringify(withdraws));
    console.log('📋 طلبات السحب المتبقية:', withdraws);
};

window.rejectWithdraw = function(index) {
    const withdraws = JSON.parse(localStorage.getItem('krypton_pending_withdraws')) || [];
    const withdraw = withdraws[index];
    if (!withdraw) { console.log('❌ الطلب غير موجود'); return; }
    
    const user = findUser(withdraw.username);
    if (user) {
        if (withdraw.source === 'wallet') {
            user.balance = parseSafeNumber(user.balance) + withdraw.amount;
        } else if (withdraw.source === 'asset') {
            user.assetBalance = parseSafeNumber(user.assetBalance) + withdraw.amount;
        } else if (withdraw.source === 'mining') {
            user.miningBalance = parseSafeNumber(user.miningBalance) + withdraw.amount;
        }
        saveUserToStorage(user);
        if (currentUser && currentUser.username === withdraw.username) {
            if (withdraw.source === 'wallet') currentUser.balance = user.balance;
            else if (withdraw.source === 'asset') currentUser.assetBalance = user.assetBalance;
            else if (withdraw.source === 'mining') currentUser.miningBalance = user.miningBalance;
            saveSessionSafely(currentUser);
            updateDashboardUI();
        }
    }
    
    console.log(`❌ تم رفض سحب $${withdraw.amount.toFixed(2)} وتم إرجاع المبلغ للمستخدم ${withdraw.displayName}`);
    withdraws.splice(index, 1);
    localStorage.setItem('krypton_pending_withdraws', JSON.stringify(withdraws));
    console.log('📋 طلبات السحب المتبقية:', withdraws);
};

window.showPendingDeposits = function() {
    console.log('📋 طلبات الإيداع المعلقة:', pendingDeposits);
    return pendingDeposits;
};

window.showPendingTransfers = function() {
    console.log('📋 طلبات التحويل المعلقة:', pendingTransfers);
    return pendingTransfers;
};

window.showPendingWithdraws = function() {
    const withdraws = JSON.parse(localStorage.getItem('krypton_pending_withdraws')) || [];
    console.log('📋 طلبات السحب المعلقة:', withdraws);
    return withdraws;
};

console.log('✅ تم تطبيق نظام الإعدادات المركزي بنجاح!');
console.log('✅ جميع نسب الأرباح والباقات قابلة للتعديل من لوحة الإدارة');
console.log('✅ يمكن تحديد ساعات تعدين محددة من لوحة تحكم Admin');
console.log('✅ يمكن تعديل جميع الإعدادات عبر Admin.* في الكونسول');