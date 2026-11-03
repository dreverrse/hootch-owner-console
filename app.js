(() => {
  "use strict";

  const SUPABASE_URL = "https://oqqnuqlsykwuxzosnndl.supabase.co";
  const SUPABASE_KEY = "sb_publishable_wr2bZohWBVs_mpIpHt6L8A_wZspM33b";
  const PROJECT_REF = "oqqnuqlsykwuxzosnndl";
  const READ_KEY = "hootch_read_notifs";
  const THEME_KEY = "hootch_admin_theme";

  const { createClient } = window.supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const $ = (id) => document.getElementById(id);
  const els = {
    loginView: $("loginView"),
    appView: $("appView"),
    loginForm: $("loginForm"),
    emailInput: $("emailInput"),
    passwordInput: $("passwordInput"),
    loginButton: $("loginButton"),
    loginError: $("loginError"),
    page: $("page"),
    nav: $("nav"),
    sidebar: $("sidebar"),
    sidebarBackdrop: $("sidebarBackdrop"),
    sidebarToggle: $("sidebarToggle"),
    logoutButton: $("logoutButton"),
    globalSearch: $("globalSearch"),
    quickActionButton: $("quickActionButton"),
    quickMenu: $("quickMenu"),
    themeToggle: $("themeToggle"),
    notifButton: $("notifButton"),
    notifBadge: $("notifBadge"),
    notifPanel: $("notifPanel"),
    notifList: $("notifList"),
    closeNotif: $("closeNotif"),
    markAllRead: $("markAllRead"),
    settingsButton: $("settingsButton"),
    profileButton: $("profileButton"),
    profileAvatar: $("profileAvatar"),
    profileName: $("profileName"),
    profileRole: $("profileRole"),
    workspaceName: $("workspaceName"),
    drawerOverlay: $("drawerOverlay"),
    drawerEyebrow: $("drawerEyebrow"),
    drawerTitle: $("drawerTitle"),
    drawerBody: $("drawerBody"),
    closeDrawer: $("closeDrawer"),
    toast: $("toast"),
  };

  const state = {
    me: null,
    session: null,
    route: "dashboard",
    renderSeq: 0,
    charts: {},
    dashboard: null,
    notifications: [],
    readNotifs: loadReadNotifs(),
    months: 12,
    analyticsMonths: 12,
    userSearch: "",
    userStatus: "all",
    subscriptionSearch: "",
    subscriptionStatus: "all",
    subscriptionPlan: "all",
    paymentSearch: "",
    paymentStatus: "all",
    supportSearch: "",
    supportStatus: "all",
    auditSearch: "",
  };

  let toastTimer = 0;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindStaticEvents();
    applyTheme(localStorage.getItem(THEME_KEY) || "light", false);
    if (window.Chart) {
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = getComputedStyle(document.body).color;
    }

    try {
      const { data } = await db.auth.getSession();
      if (data.session) {
        state.session = data.session;
        await enterApp(data.session.user);
      }
    } catch (error) {
      setLoginError(error.message || "Gagal memeriksa sesi.");
    }
  }

  function bindStaticEvents() {
    els.loginForm.addEventListener("submit", handleLogin);
    els.logoutButton.addEventListener("click", handleLogout);
    els.nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-route]");
      if (!button) return;
      closeSidebar();
      closeDrawer();
      navigate(button.dataset.route);
    });

    els.sidebarToggle.addEventListener("click", () => {
      const open = els.sidebar.classList.toggle("open");
      els.sidebarBackdrop.classList.toggle("hidden", !open);
    });
    els.sidebarBackdrop.addEventListener("click", closeSidebar);

    els.themeToggle.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next, true);
      navigate(state.route);
    });

    els.notifButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleNotifPanel();
    });
    els.closeNotif.addEventListener("click", closeNotifPanel);
    els.markAllRead.addEventListener("click", markAllNotificationsRead);
    els.notifList.addEventListener("click", handleNotificationClick);

    els.quickActionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleQuickMenu();
    });
    els.quickMenu.addEventListener("click", handleQuickAction);

    els.settingsButton.addEventListener("click", () => navigate("settings"));
    els.profileButton.addEventListener("click", () => navigate("settings"));

    els.globalSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      state.userSearch = els.globalSearch.value.trim();
      navigate("users");
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-nav]");
      if (!button || !state.me) return;
      closeSidebar();
      closeDrawer();
      navigate(button.dataset.nav);
    });

    els.closeDrawer.addEventListener("click", closeDrawer);
    els.drawerOverlay.addEventListener("click", (event) => {
      if (event.target === els.drawerOverlay) closeDrawer();
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("#quickActionButton") && !event.target.closest("#quickMenu")) {
        closeQuickMenu();
      }
      if (!event.target.closest("#notifButton") && !event.target.closest("#notifPanel")) {
        closeNotifPanel();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDrawer();
        closeQuickMenu();
        closeNotifPanel();
        closeSidebar();
      }
    });

    window.addEventListener("hashchange", () => {
      if (!state.me) return;
      const route = routeFromHash();
      if (route !== state.route) navigate(route, false);
    });

    db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") showLogin();
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");

    const email = els.emailInput.value.trim();
    const password = els.passwordInput.value;
    if (!email || !password) {
      setLoginError("Email dan password wajib diisi.");
      return;
    }

    setLoginBusy(true);
    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.session = data.session;
      await enterApp(data.user);
      els.passwordInput.value = "";
    } catch (error) {
      await db.auth.signOut();
      setLoginError(isAuthError(error) ? "Akun ini bukan owner/admin aktif." : error.message || "Gagal masuk.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    await db.auth.signOut();
    showLogin();
  }

  async function enterApp(user) {
    try {
      state.me = await rpc("admin_me");
    } catch (error) {
      await db.auth.signOut();
      showLogin();
      setLoginError("Akun ini tidak memiliki akses admin aktif.");
      return;
    }

    els.loginView.classList.add("hidden");
    els.appView.classList.remove("hidden");
    els.profileName.textContent = displayName(state.me);
    els.profileRole.textContent = roleLabel(state.me.role);
    els.profileAvatar.textContent = initials(displayName(state.me));
    els.workspaceName.textContent = `${displayName(state.me)} Workspace`;

    await navigate(routeFromHash(), false);
    await refreshNotifications();
  }

  function showLogin() {
    state.me = null;
    state.session = null;
    state.dashboard = null;
    state.notifications = [];
    destroyCharts();
    closeDrawer();
    closeQuickMenu();
    closeNotifPanel();
    closeSidebar();
    els.appView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
    els.page.innerHTML = "";
    setLoginError("");
  }

  function routeFromHash() {
    const raw = String(window.location.hash || "").replace(/^#\/?/, "").trim();
    return raw || "dashboard";
  }

  async function navigate(route, updateHash = true) {
    if (!state.me) return;
    const clean = String(route || "dashboard").replace(/^#\/?/, "").split("?")[0] || "dashboard";
    state.route = clean;
    if (updateHash && window.location.hash !== `#/${clean}`) {
      history.replaceState(null, "", `#/${clean}`);
    }

    setActiveNav(clean);
    closeQuickMenu();
    closeNotifPanel();
    destroyCharts();
    els.page.innerHTML = skeletonPage();
    const seq = ++state.renderSeq;

    try {
      const html = await renderRoute(clean);
      if (seq !== state.renderSeq) return;
      els.page.innerHTML = html;
      afterRender(clean);
      iconRefresh();
    } catch (error) {
      if (seq !== state.renderSeq) return;
      if (isAuthError(error)) {
        await db.auth.signOut();
        showLogin();
        setLoginError("Sesi berakhir atau akun ini bukan admin aktif.");
        return;
      }
      els.page.innerHTML = errorState(error);
      const retry = $("retryButton");
      if (retry) retry.addEventListener("click", () => navigate(state.route));
      iconRefresh();
    }
  }

  async function renderRoute(route) {
    switch (route) {
      case "dashboard": return renderDashboardPage();
      case "users": return renderUsersPage();
      case "admins": return renderAdminsPage();
      case "subscriptions": return renderSubscriptionsPage();
      case "transactions": return renderTransactionsPage();
      case "plans": return renderPlansPage();
      case "features": return renderFeaturesPage();
      case "integrations": return renderIntegrationsPage();
      case "monitoring": return renderMonitoringPage();
      case "notifications": return renderNotificationsPage();
      case "announcements": return renderAnnouncementsPage();
      case "support": return renderSupportPage();
      case "analytics": return renderAnalyticsPage();
      case "audit": return renderAuditPage();
      case "settings": return renderSettingsPage();
      default: return renderDashboardPage();
    }
  }

  function afterRender(route) {
    if (route === "dashboard") {
      createDashboardCharts();
      bindQuickCards();
    }
    if (route === "analytics") {
      createAnalyticsCharts();
      document.querySelectorAll("[data-months]").forEach((button) => {
        button.addEventListener("click", () => {
          state.analyticsMonths = Number(button.dataset.months) || 12;
          navigate("analytics");
        });
      });
    }
    if (route === "users") {
      bindTextSearch("usersSearch", "userSearch", "users");
      bindSelect("usersStatus", "userStatus", "users");
      bindUserActions();
    }
    if (route === "admins") {
      const add = $("addAdminButton");
      if (add) add.addEventListener("click", () => openAdminForm());
      bindAdminActions();
    }
    if (route === "subscriptions") {
      bindTextSearch("subsSearch", "subscriptionSearch", "subscriptions");
      bindSelect("subsStatus", "subscriptionStatus", "subscriptions");
      bindSelect("subsPlan", "subscriptionPlan", "subscriptions");
      const add = $("recordPaymentButton");
      if (add) add.addEventListener("click", () => openPaymentForm());
      bindSubscriptionActions();
    }
    if (route === "transactions") {
      bindTextSearch("txSearch", "paymentSearch", "transactions");
      bindSelect("txStatus", "paymentStatus", "transactions");
      const add = $("txRecordButton");
      if (add) add.addEventListener("click", () => openPaymentForm());
      bindPaymentActions();
    }
    if (route === "plans") {
      const add = $("addPlanButton");
      if (add) add.addEventListener("click", () => openPlanForm());
      bindPlanActions();
    }
    if (route === "features") {
      bindFeatureToggles();
      bindSettingsForm("featureSettingsForm", true);
    }
    if (route === "monitoring") {
      const refresh = $("refreshHealthButton");
      if (refresh) refresh.addEventListener("click", () => navigate("monitoring"));
    }
    if (route === "notifications") {
      const mark = $("markAllReadPage");
      if (mark) mark.addEventListener("click", markAllNotificationsRead);
    }
    if (route === "announcements") {
      const add = $("addAnnouncementButton");
      if (add) add.addEventListener("click", () => openAnnouncementForm());
      bindAnnouncementActions();
    }
    if (route === "support") {
      bindTextSearch("supportSearch", "supportSearch", "support");
      bindSelect("supportStatus", "supportStatus", "support");
      bindSupportActions();
    }
    if (route === "audit") {
      bindTextSearch("auditSearch", "auditSearch", "audit");
    }
    if (route === "settings") {
      bindSettingsForm("generalSettingsForm", false);
      const signOutAll = $("signOutAllButton");
      if (signOutAll) signOutAll.addEventListener("click", signOutEverywhere);
    }
    if (route === "integrations") {
      bindCopyButtons();
    }
  }

  async function rpc(name, params = {}) {
    const { data, error } = await db.rpc(name, params);
    if (error) {
      if (isAuthError(error) && state.me) {
        await db.auth.signOut();
        showLogin();
        setLoginError("Sesi berakhir atau akun ini bukan admin aktif.");
      }
      throw error;
    }
    return data;
  }

  async function loadDashboard(months = state.months) {
    const data = await rpc("admin_dashboard", { p_months: months });
    state.dashboard = data;
    if (Array.isArray(data.notifications)) {
      state.notifications = data.notifications;
      renderNotificationUI();
    }
    return data;
  }

  async function refreshNotifications() {
    try {
      const data = await rpc("admin_notifications");
      state.notifications = Array.isArray(data) ? data : [];
      renderNotificationUI();
    } catch (error) {
      if (!isAuthError(error)) toast("Gagal memuat notifikasi.", true);
    }
  }

  async function renderDashboardPage() {
    const data = await loadDashboard();
    const s = data.stats || {};
    const health = data.system_health || {};
    const overview = data.subscription_overview || {};
    const name = firstName(displayName(state.me));
    const activity = Array.isArray(data.recent_activity) ? data.recent_activity : [];
    const plans = Array.isArray(data.plan_distribution) ? data.plan_distribution : [];

    return `
      <section class="welcome-band">
        <div>
          <p class="eyebrow">${escapeHtml(greeting())}</p>
          <h1>Selamat datang kembali, ${escapeHtml(name)}</h1>
          <p>Ini ringkasan Hootch hari ini. Pantau pertumbuhan pengguna, pendapatan, dan kesehatan platform dalam satu tampilan.</p>
          <div class="welcome-meta">
            <span class="welcome-chip"><i data-lucide="calendar-days"></i>${escapeHtml(formatLongDate(new Date()))}</span>
            <span class="welcome-chip"><i data-lucide="circle-check"></i>Platform operasional</span>
            <span class="welcome-chip"><i data-lucide="shield-check"></i>${escapeHtml(roleLabel(state.me.role))}</span>
          </div>
        </div>
        <div class="welcome-illustration"><i data-lucide="store"></i></div>
      </section>

      <section class="stats-grid" aria-label="Statistik utama">
        ${statCard("Pengguna", number(s.total_users), `+${number(s.new_users_30d)} dalam 30 hari`, "users", "accent")}
        ${statCard("Outlet", number(s.total_stores), "Toko terdaftar", "store")}
        ${statCard("Langganan aktif", number(s.active_subscriptions), `${number(s.trials)} trial berjalan`, "credit-card", "success")}
        ${statCard("MRR", compactIDR(s.mrr), "Pendapatan berulang", "trending-up")}
        ${statCard("Pendapatan bulan ini", compactIDR(s.revenue_month), `${number(s.paid_payments)} pembayaran lunas`, "badge-dollar-sign", "warning")}
        ${statCard("Support terbuka", number(s.open_support), `${number(s.pending_payments)} pembayaran tertunda`, "life-buoy", s.open_support > 0 ? "danger" : "")}
      </section>

      <div class="grid-2">
        <section class="panel">
          <div class="panel-head">
            <div><h2>Pendapatan</h2><p>Tren pembayaran langganan ${number(state.months)} bulan terakhir.</p></div>
            <span class="badge badge-active">${compactIDR(s.revenue_total)} total</span>
          </div>
          <div class="chart-box"><canvas id="revenueChart" aria-label="Grafik pendapatan"></canvas></div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <div><h2>Ringkasan langganan</h2><p>Distribusi status outlet saat ini.</p></div>
            <button class="btn btn-ghost btn-small" type="button" data-nav="subscriptions">Kelola</button>
          </div>
          <div class="panel-body">
            <div class="overview-list">
              ${overviewRow("Aktif", overview.active, "success", "Langganan berbayar")}
              ${overviewRow("Trial", overview.trial, "warning", "Masa percobaan")}
              ${overviewRow("Menunggu bayar", overview.past_due, "danger", "Perlu tindak lanjut")}
              ${overviewRow("Free", overview.free, "muted", "Belum berlangganan")}
              ${overviewRow("Berakhir 7 hari", overview.expiring_7d, "purple", "Segera berakhir")}
            </div>
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="panel">
          <div class="panel-head">
            <div><h2>Pertumbuhan pengguna</h2><p>Akun dan outlet baru per bulan.</p></div>
            <button class="btn btn-ghost btn-small" type="button" data-nav="analytics">Analitik</button>
          </div>
          <div class="chart-box"><canvas id="userChart" aria-label="Grafik pertumbuhan pengguna"></canvas></div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <div><h2>Aktivitas terbaru</h2><p>Kejadian penting di platform.</p></div>
            <button class="btn btn-ghost btn-small" type="button" data-nav="audit">Audit log</button>
          </div>
          <div class="panel-body">
            ${activity.length ? `<div class="activity-list">${activity.map(activityItem).join("")}</div>` : emptyInline("Belum ada aktivitas", "Aktivitas pengguna, pembayaran, dan support akan muncul di sini.")}
          </div>
        </section>
      </div>

      <div class="grid-3">
        <section class="panel">
          <div class="panel-head"><div><h2>Kesehatan sistem</h2><p>Status nyata dari backend.</p></div><span class="health-status">Operational</span></div>
          <div class="panel-body">
            <div class="health-grid">
              <div class="health-card"><span>Database</span><strong>${escapeHtml(health.database || "operational")}</strong></div>
              <div class="health-card"><span>Sinkron terakhir</span><strong>${escapeHtml(relativeTime(health.last_sync_at))}</strong></div>
              <div class="health-card"><span>Outlet</span><strong>${number(health.stores)}</strong></div>
              <div class="health-card"><span>Pengguna</span><strong>${number(health.users)}</strong></div>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Aksi cepat</h2><p>Pekerjaan owner yang sering dipakai.</p></div></div>
          <div class="panel-body">
            <div class="quick-grid">
              <button class="quick-card" type="button" data-quick-card="payment"><i data-lucide="badge-dollar-sign"></i><span class="quick-copy"><strong>Catat bayar</strong><span>Pembayaran manual</span></span></button>
              <button class="quick-card" type="button" data-quick-card="admin"><i data-lucide="user-plus"></i><span class="quick-copy"><strong>Tambah admin</strong><span>Kelola akses</span></span></button>
              <button class="quick-card" type="button" data-quick-card="announcement"><i data-lucide="megaphone"></i><span class="quick-copy"><strong>Pengumuman</strong><span>Info ke pengguna</span></span></button>
              <button class="quick-card" type="button" data-quick-card="support"><i data-lucide="life-buoy"></i><span class="quick-copy"><strong>Support</strong><span>Balas tiket</span></span></button>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Distribusi paket</h2><p>Outlet per paket langganan.</p></div></div>
          <div class="panel-body">
            ${plans.length ? `<div class="overview-list">${plans.map((item) => overviewRow(planLabel(item.plan), item.count, item.plan === "free" ? "muted" : "purple", "Outlet terdaftar")).join("")}</div>` : emptyInline("Belum ada data paket", "Tambahkan paket dan langganan untuk melihat distribusi.")}
          </div>
        </section>
      </div>`;
  }

  async function renderUsersPage() {
    const users = await rpc("admin_list_users", {
      p_search: state.userSearch,
      p_status: state.userStatus,
      p_limit: 200,
      p_offset: 0,
    });

    return `
      ${pageHead("Pengguna", "Kelola akun, outlet, dan status akses pengguna Hootch.", `<button class="btn btn-ghost" type="button" data-nav="analytics"><i data-lucide="chart-no-axes-combined"></i>Analitik</button>`)}
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-input"><span class="sr-only">Cari pengguna</span><input id="usersSearch" type="search" placeholder="Cari email, nama, atau outlet..." value="${escapeAttr(state.userSearch)}"></label>
          <select id="usersStatus" class="filter-select" aria-label="Filter status pengguna">
            ${option("all", "Semua status", state.userStatus)}
            ${option("active", "Aktif", state.userStatus)}
            ${option("suspended", "Suspended", state.userStatus)}
            ${option("unverified", "Belum verifikasi", state.userStatus)}
            ${option("admin", "Admin", state.userStatus)}
          </select>
        </div>
        <div class="toolbar-right"><span class="muted">${number(users.length)} akun ditemukan</span></div>
      </div>
      <div class="table-panel">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Pengguna</th><th>Outlet</th><th>Langganan</th><th>Status</th><th>Terakhir aktif</th><th class="right">Aksi</th></tr></thead>
            <tbody id="usersBody">${users.length ? users.map(userRow).join("") : `<tr><td colspan="6">${emptyInline("Tidak ada pengguna", "Coba ubah kata kunci atau filter status.")}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderAdminsPage() {
    const admins = await rpc("admin_list_admins");
    const canManage = state.me.role === "owner";

    return `
      ${pageHead("Admin", "Atur siapa yang boleh mengakses owner console.", canManage ? `<button id="addAdminButton" class="btn btn-primary" type="button"><i data-lucide="user-plus"></i>Tambah admin</button>` : "")}
      <div class="table-panel">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Admin</th><th>Role</th><th>Status</th><th>Ditambahkan</th><th class="right">Aksi</th></tr></thead>
            <tbody id="adminsBody">
              ${admins.length ? admins.map((admin) => adminRow(admin, canManage)).join("") : `<tr><td colspan="5">${emptyInline("Belum ada admin", "Tambahkan akun admin untuk membantu operasional.")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderSubscriptionsPage() {
    const [subs, plans] = await Promise.all([
      rpc("admin_list_subscriptions", {
        p_search: state.subscriptionSearch,
        p_status: state.subscriptionStatus,
        p_plan: state.subscriptionPlan,
        p_limit: 200,
        p_offset: 0,
      }),
      rpc("admin_list_plans"),
    ]);

    return `
      ${pageHead("Langganan", "Kelola paket, status, dan periode langganan setiap outlet.", `<button id="recordPaymentButton" class="btn btn-primary" type="button"><i data-lucide="badge-dollar-sign"></i>Catat pembayaran</button>`)}
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-input"><span class="sr-only">Cari langganan</span><input id="subsSearch" type="search" placeholder="Cari outlet atau email..." value="${escapeAttr(state.subscriptionSearch)}"></label>
          <select id="subsStatus" class="filter-select" aria-label="Filter status langganan">
            ${option("all", "Semua status", state.subscriptionStatus)}
            ${option("active", "Aktif", state.subscriptionStatus)}
            ${option("trial", "Trial", state.subscriptionStatus)}
            ${option("past_due", "Menunggu bayar", state.subscriptionStatus)}
            ${option("cancelled", "Batal", state.subscriptionStatus)}
          </select>
          <select id="subsPlan" class="filter-select" aria-label="Filter paket">
            ${option("all", "Semua paket", state.subscriptionPlan)}
            ${plans.map((plan) => option(plan.code, plan.name, state.subscriptionPlan)).join("")}
          </select>
        </div>
        <div class="toolbar-right"><span class="muted">${number(subs.length)} langganan</span></div>
      </div>
      <div class="table-panel">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Outlet</th><th>Paket</th><th>Status</th><th>Nilai</th><th>Periode berakhir</th><th class="right">Aksi</th></tr></thead>
            <tbody id="subscriptionsBody">
              ${subs.length ? subs.map((sub) => subscriptionRow(sub, plans)).join("") : `<tr><td colspan="6">${emptyInline("Belum ada langganan", "Catat pembayaran pertama untuk mengaktifkan langganan outlet.")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderTransactionsPage() {
    const payments = await rpc("admin_list_payments", {
      p_search: state.paymentSearch,
      p_status: state.paymentStatus,
      p_limit: 200,
      p_offset: 0,
    });

    return `
      ${pageHead("Transaksi", "Riwayat pembayaran langganan platform. Ini bukan transaksi kasir outlet.", `<button id="txRecordButton" class="btn btn-primary" type="button"><i data-lucide="plus"></i>Catat pembayaran</button>`)}
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-input"><span class="sr-only">Cari transaksi</span><input id="txSearch" type="search" placeholder="Cari outlet, email, atau referensi..." value="${escapeAttr(state.paymentSearch)}"></label>
          <select id="txStatus" class="filter-select" aria-label="Filter status transaksi">
            ${option("all", "Semua status", state.paymentStatus)}
            ${option("paid", "Lunas", state.paymentStatus)}
            ${option("pending", "Pending", state.paymentStatus)}
            ${option("failed", "Gagal", state.paymentStatus)}
            ${option("refunded", "Refund", state.paymentStatus)}
          </select>
        </div>
        <div class="toolbar-right"><span class="muted">${number(payments.length)} transaksi</span></div>
      </div>
      <div class="table-panel">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Outlet</th><th>Paket</th><th>Jumlah</th><th>Status</th><th>Metode</th><th>Tanggal</th><th class="right">Aksi</th></tr></thead>
            <tbody id="paymentsBody">
              ${payments.length ? payments.map(paymentRow).join("") : `<tr><td colspan="7">${emptyInline("Belum ada transaksi", "Pembayaran langganan yang dicatat akan muncul di sini.")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderPlansPage() {
    const plans = await rpc("admin_list_plans");

    return `
      ${pageHead("Paket langganan", "Atur harga, limit, dan fitur setiap paket Hootch.", `<button id="addPlanButton" class="btn btn-primary" type="button"><i data-lucide="plus"></i>Tambah paket</button>`)}
      <div class="card-grid">
        ${plans.map(planCard).join("")}
      </div>`;
  }

  async function renderFeaturesPage() {
    const [features, settings] = await Promise.all([rpc("admin_list_features"), rpc("admin_get_settings")]);

    return `
      ${pageHead("Aplikasi & fitur", "Kontrol fitur platform dan pengaturan dasar aplikasi.")}
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><div><h2>Feature flags</h2><p>Aktifkan atau matikan fitur tanpa deploy ulang.</p></div></div>
          <div class="panel-body">
            ${features.length ? features.map(featureRow).join("") : emptyInline("Belum ada fitur", "Tambahkan feature flag untuk mengontrol rilis fitur.")}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Pengaturan aplikasi</h2><p>Nilai ini dipakai oleh panel dan operasional.</p></div></div>
          <div class="panel-body">
            <form id="featureSettingsForm">
              <div class="form-grid">
                <label class="field span-2">Nama platform<input name="platform_name" value="${escapeAttr(settings.platform_name || "Hootch")}" required></label>
                <label class="field">Email support<input name="support_email" type="email" value="${escapeAttr(settings.support_email || "")}" required></label>
                <label class="field">Zona waktu<select name="timezone">${timezoneOptions(settings.timezone || "Asia/Jakarta")}</select></label>
                <label class="field">Masa trial (hari)<input name="trial_days" type="number" min="0" value="${escapeAttr(settings.trial_days ?? 14)}"></label>
                <label class="field">Mode maintenance<select name="maintenance_mode">${option("false", "Nonaktif", String(settings.maintenance_mode))}${option("true", "Aktif", String(settings.maintenance_mode))}</select></label>
              </div>
              <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan pengaturan</button></div>
            </form>
          </div>
        </section>
      </div>`;
  }

  async function renderIntegrationsPage() {
    const health = await rpc("admin_health");

    return `
      ${pageHead("API & integrasi", "Koneksi platform dan konfigurasi publik. Secret key tidak pernah dimuat di browser.")}
      <div class="grid-2-equal">
        <section class="panel">
          <div class="panel-head"><div><h2>Supabase</h2><p>Backend autentikasi, database, dan API.</p></div><span class="badge badge-operational">Terhubung</span></div>
          <div class="panel-body">
            <div class="kv-grid">
              <div class="kv"><span>Project URL</span><strong>${escapeHtml(SUPABASE_URL)}</strong></div>
              <div class="kv"><span>Project ref</span><strong>${escapeHtml(PROJECT_REF)}</strong></div>
              <div class="kv"><span>Status database</span><strong>${escapeHtml(health.database || "operational")}</strong></div>
              <div class="kv"><span>Sinkron terakhir</span><strong>${escapeHtml(relativeTime(health.last_sync_at))}</strong></div>
            </div>
            <div class="drawer-section">
              <h3>Publishable key</h3>
              <div class="code-line"><span>${maskKey(SUPABASE_KEY)}</span><button class="btn btn-ghost btn-small" type="button" data-copy="${escapeAttr(SUPABASE_KEY)}">Salin</button></div>
              <p class="muted small" style="margin-top:8px">Key ini aman untuk client. Service role dan secret key tidak boleh dimasukkan ke panel ini.</p>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Distribusi & rilis</h2><p>Kanal aplikasi Android dan hosting panel.</p></div></div>
          <div class="panel-body">
            <div class="overview-list">
              ${integrationRow("GitHub Release", "APK production", "active")}
              ${integrationRow("GitHub Pages", "Owner console", "active")}
              ${integrationRow("Supabase Auth", "Email & Google", "active")}
              ${integrationRow("Manual transfer", "Pembayaran langganan", "warning")}
            </div>
            <div class="drawer-section">
              <h3>Endpoint database</h3>
              <div class="code-line"><span>${escapeHtml(SUPABASE_URL.replace("https://", ""))}</span><button class="btn btn-ghost btn-small" type="button" data-copy="${escapeAttr(SUPABASE_URL)}">Salin</button></div>
            </div>
          </div>
        </section>
      </div>`;
  }

  async function renderMonitoringPage() {
    const health = await rpc("admin_health");
    const lastSync = health.last_sync_at ? relativeTime(health.last_sync_at) : "Belum pernah";

    return `
      ${pageHead("Monitoring", "Status nyata database dan aktivitas platform.", `<button id="refreshHealthButton" class="btn btn-ghost" type="button"><i data-lucide="refresh-cw"></i>Muat ulang</button>`)}
      <div class="stats-grid">
        ${statCard("Database", health.database === "operational" ? "Normal" : health.database, "Koneksi PostgreSQL", "database", "success")}
        ${statCard("Sinkron terakhir", lastSync, "Snapshot outlet", "refresh-cw")}
        ${statCard("Pengguna", number(health.users), "Akun terdaftar", "users")}
        ${statCard("Outlet", number(health.stores), "Toko aktif", "store")}
        ${statCard("Pembayaran tertunda", number(health.pending_payments), `${number(health.failed_payments)} gagal`, "clock", health.pending_payments > 0 ? "warning" : "")}
        ${statCard("Support terbuka", number(health.open_support), "Perlu respons", "life-buoy", health.open_support > 0 ? "danger" : "")}
      </div>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><div><h2>Status layanan</h2><p>Pemeriksaan langsung ke backend.</p></div><span class="health-status">Operational</span></div>
          <div class="panel-body">
            <div class="overview-list">
              ${integrationRow("Database", "PostgreSQL", health.database === "operational" ? "active" : "danger")}
              ${integrationRow("Snapshot sync", lastSync, health.last_sync_at ? "active" : "warning")}
              ${integrationRow("Pembayaran", `${number(health.pending_payments)} pending`, health.pending_payments ? "warning" : "active")}
              ${integrationRow("Support", `${number(health.open_support)} terbuka`, health.open_support ? "danger" : "active")}
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Kapasitas</h2><p>Metrik penyimpanan dan data.</p></div></div>
          <div class="panel-body">
            <div class="health-grid">
              <div class="health-card"><span>Ukuran database</span><strong>${escapeHtml(formatBytes(health.db_size_bytes))}</strong></div>
              <div class="health-card"><span>Snapshot outlet</span><strong>${number(health.snapshots)}</strong></div>
              <div class="health-card"><span>Pembayaran gagal</span><strong>${number(health.failed_payments)}</strong></div>
              <div class="health-card"><span>Dicek pada</span><strong>${escapeHtml(formatTime(health.checked_at))}</strong></div>
            </div>
          </div>
        </section>
      </div>`;
  }

  async function renderNotificationsPage() {
    const items = await rpc("admin_notifications");
    state.notifications = Array.isArray(items) ? items : [];
    renderNotificationUI();

    return `
      ${pageHead("Notifikasi", "Pusat aktivitas pembayaran, support, dan langganan.", `<button id="markAllReadPage" class="btn btn-ghost" type="button"><i data-lucide="check-check"></i>Tandai semua dibaca</button>`)}
      <section class="panel">
        <div class="panel-body flush">
          ${state.notifications.length ? `<div class="notif-list">${state.notifications.map(notificationItem).join("")}</div>` : emptyInline("Tidak ada notifikasi", "Aktivitas baru akan muncul di sini.")}
        </div>
      </section>`;
  }

  async function renderAnnouncementsPage() {
    const items = await rpc("admin_list_announcements");

    return `
      ${pageHead("Pengumuman", "Kirim informasi produk dan maintenance ke pengguna.", `<button id="addAnnouncementButton" class="btn btn-primary" type="button"><i data-lucide="plus"></i>Buat pengumuman</button>`)}
      <div class="card-grid">
        ${items.length ? items.map(announcementCard).join("") : `<div class="info-card">${emptyInline("Belum ada pengumuman", "Buat pengumuman pertama untuk menginformasikan perubahan penting.")}</div>`}
      </div>`;
  }

  async function renderSupportPage() {
    const items = await rpc("admin_list_support", {
      p_status: state.supportStatus,
      p_search: state.supportSearch,
      p_limit: 200,
      p_offset: 0,
    });

    return `
      ${pageHead("Support", "Balas pertanyaan dan masalah pengguna.")}
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-input"><span class="sr-only">Cari support</span><input id="supportSearch" type="search" placeholder="Cari subjek, pesan, atau email..." value="${escapeAttr(state.supportSearch)}"></label>
          <select id="supportStatus" class="filter-select" aria-label="Filter status support">
            ${option("all", "Semua status", state.supportStatus)}
            ${option("open", "Open", state.supportStatus)}
            ${option("in_progress", "In progress", state.supportStatus)}
            ${option("resolved", "Resolved", state.supportStatus)}
            ${option("closed", "Closed", state.supportStatus)}
          </select>
        </div>
        <div class="toolbar-right"><span class="muted">${number(items.length)} tiket</span></div>
      </div>
      <div class="table-panel">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Subjek</th><th>Pengguna</th><th>Prioritas</th><th>Status</th><th>Dibuat</th><th class="right">Aksi</th></tr></thead>
            <tbody id="supportBody">
              ${items.length ? items.map(supportRow).join("") : `<tr><td colspan="6">${emptyInline("Tidak ada tiket support", "Tiket baru dari pengguna akan muncul di sini.")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderAnalyticsPage() {
    const [data, stores] = await Promise.all([
      loadDashboard(state.analyticsMonths),
      rpc("admin_list_stores", { p_search: "", p_status: "all", p_limit: 8, p_offset: 0 }),
    ]);
    const s = data.stats || {};
    const topStores = [...stores].sort((a, b) => Number(b.txns || 0) - Number(a.txns || 0)).slice(0, 5);

    return `
      ${pageHead("Analitik", "Tren pendapatan, pengguna, dan paket dari data nyata.", `<div class="segmented">${[1, 3, 6, 12].map((m) => `<button class="${state.analyticsMonths === m ? "active" : ""}" type="button" data-months="${m}">${m === 1 ? "30 hari" : `${m} bulan`}</button>`).join("")}</div>`)}
      <div class="stats-grid">
        ${statCard("Pendapatan total", compactIDR(s.revenue_total), "Pembayaran lunas", "badge-dollar-sign", "accent")}
        ${statCard("Pendapatan bulan ini", compactIDR(s.revenue_month), "Periode berjalan", "trending-up")}
        ${statCard("MRR", compactIDR(s.mrr), "Langganan aktif", "repeat")}
        ${statCard("Pengguna baru", number(s.new_users_30d), "30 hari terakhir", "user-plus", "success")}
        ${statCard("Outlet", number(s.total_stores), "Terdaftar", "store")}
        ${statCard("Support", number(s.open_support), "Terbuka", "life-buoy", s.open_support ? "warning" : "")}
      </div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><div><h2>Tren pendapatan</h2><p>Pembayaran lunas per bulan.</p></div></div><div class="chart-box"><canvas id="analyticsRevenueChart"></canvas></div></section>
        <section class="panel"><div class="panel-head"><div><h2>Pertumbuhan pengguna</h2><p>Akun dan outlet baru.</p></div></div><div class="chart-box"><canvas id="analyticsUserChart"></canvas></div></section>
      </div>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><div><h2>Distribusi paket</h2><p>Outlet per paket.</p></div></div>
          <div class="chart-box small"><canvas id="analyticsPlanChart"></canvas></div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Outlet paling aktif</h2><p>Berdasarkan jumlah transaksi tersinkron.</p></div></div>
          <div class="panel-body">
            ${topStores.length ? `<div class="overview-list">${topStores.map((store) => overviewRow(store.name, `${number(store.txns)} tx`, "purple", `${number(store.products)} produk · ${planLabel(store.plan)}`)).join("")}</div>` : emptyInline("Belum ada outlet", "Data outlet akan muncul setelah pengguna mendaftar.")}
          </div>
        </section>
      </div>`;
  }

  async function renderAuditPage() {
    const items = await rpc("admin_list_audit", {
      p_search: state.auditSearch,
      p_limit: 200,
      p_offset: 0,
    });

    return `
      ${pageHead("Audit log", "Jejak tindakan sensitif yang dilakukan admin.")}
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-input"><span class="sr-only">Cari audit</span><input id="auditSearch" type="search" placeholder="Cari aksi, target, atau admin..." value="${escapeAttr(state.auditSearch)}"></label>
        </div>
        <div class="toolbar-right"><span class="muted">${number(items.length)} catatan</span></div>
      </div>
      <div class="table-panel">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Aksi</th><th>Target</th><th>Admin</th><th>Payload</th><th>Waktu</th></tr></thead>
            <tbody>
              ${items.length ? items.map(auditRow).join("") : `<tr><td colspan="5">${emptyInline("Belum ada audit log", "Tindakan admin seperti perubahan langganan atau suspend user akan tercatat.")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderSettingsPage() {
    const [settings, features] = await Promise.all([rpc("admin_get_settings"), rpc("admin_list_features")]);
    const lastSignIn = state.session && state.session.user ? state.session.user.last_sign_in_at : null;

    return `
      ${pageHead("Pengaturan", "Kelola identitas platform, keamanan sesi, dan profil owner.")}
      <div class="settings-grid">
        <div>
          <section class="panel">
            <div class="panel-head"><div><h2>Umum</h2><p>Informasi dasar yang dipakai panel dan operasional.</p></div></div>
            <div class="panel-body">
              <form id="generalSettingsForm">
                <div class="form-grid">
                  <label class="field span-2">Nama platform<input name="platform_name" value="${escapeAttr(settings.platform_name || "Hootch")}" required></label>
                  <label class="field">Email support<input name="support_email" type="email" value="${escapeAttr(settings.support_email || "")}" required></label>
                  <label class="field">Zona waktu<select name="timezone">${timezoneOptions(settings.timezone || "Asia/Jakarta")}</select></label>
                  <label class="field">Masa trial (hari)<input name="trial_days" type="number" min="0" value="${escapeAttr(settings.trial_days ?? 14)}"></label>
                  <label class="field">Mode maintenance<select name="maintenance_mode">${option("false", "Nonaktif", String(settings.maintenance_mode))}${option("true", "Aktif", String(settings.maintenance_mode))}</select></label>
                </div>
                <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan perubahan</button></div>
              </form>
            </div>
          </section>
          <section class="panel" style="margin-top:16px">
            <div class="panel-head"><div><h2>Fitur aktif</h2><p>Ringkasan feature flag yang sedang berjalan.</p></div><button class="btn btn-ghost btn-small" type="button" data-nav="features">Kelola</button></div>
            <div class="panel-body">
              ${features.map((feature) => `<div class="setting-row"><div class="setting-copy"><strong>${escapeHtml(feature.name)}</strong><span>${escapeHtml(feature.description || feature.key)}</span></div>${statusBadge(feature.enabled ? "active" : "cancelled")}</div>`).join("")}
            </div>
          </section>
        </div>
        <div>
          <section class="panel">
            <div class="panel-head"><div><h2>Profil owner</h2><p>Akun yang sedang mengakses panel.</p></div></div>
            <div class="panel-body">
              <div class="user-cell" style="margin-bottom:16px">
                <div class="avatar avatar-lg">${escapeHtml(initials(displayName(state.me)))}</div>
                <div><strong>${escapeHtml(displayName(state.me))}</strong><span>${escapeHtml(state.me.email || "")}</span></div>
              </div>
              <div class="kv-grid">
                <div class="kv"><span>Role</span><strong>${escapeHtml(roleLabel(state.me.role))}</strong></div>
                <div class="kv"><span>Status</span><strong>Aktif</strong></div>
                <div class="kv"><span>Login terakhir</span><strong>${escapeHtml(formatDateTime(lastSignIn))}</strong></div>
                <div class="kv"><span>User ID</span><strong style="font-size:10px">${escapeHtml(state.me.user_id)}</strong></div>
              </div>
            </div>
          </section>
          <section class="panel" style="margin-top:16px">
            <div class="panel-head"><div><h2>Keamanan</h2><p>Kontrol sesi dan akses admin.</p></div></div>
            <div class="panel-body">
              <div class="setting-row"><div class="setting-copy"><strong>Sesi aktif</strong><span>Semua perangkat yang masih login dengan akun ini.</span></div><button id="signOutAllButton" class="btn btn-danger btn-small" type="button">Keluar semua</button></div>
              <div class="setting-row"><div class="setting-copy"><strong>Kelola admin</strong><span>Atur role owner, admin, finance, dan support.</span></div><button class="btn btn-ghost btn-small" type="button" data-nav="admins">Buka</button></div>
              <div class="setting-row"><div class="setting-copy"><strong>Audit trail</strong><span>Semua tindakan sensitif dicatat otomatis.</span></div><button class="btn btn-ghost btn-small" type="button" data-nav="audit">Lihat</button></div>
            </div>
          </section>
        </div>
      </div>`;
  }

  function createDashboardCharts() {
    const data = state.dashboard;
    if (!data) return;
    const revenue = Array.isArray(data.revenue_series) ? data.revenue_series : [];
    const users = Array.isArray(data.user_series) ? data.user_series : [];
    createRevenueChart("revenueChart", revenue);
    createUserChart("userChart", users);
  }

  function createAnalyticsCharts() {
    const data = state.dashboard;
    if (!data) return;
    const revenue = Array.isArray(data.revenue_series) ? data.revenue_series : [];
    const users = Array.isArray(data.user_series) ? data.user_series : [];
    const plans = Array.isArray(data.plan_distribution) ? data.plan_distribution : [];
    createRevenueChart("analyticsRevenueChart", revenue);
    createUserChart("analyticsUserChart", users);
    createPlanChart("analyticsPlanChart", plans);
  }

  function createRevenueChart(id, series) {
    const canvas = $(id);
    if (!canvas || !window.Chart) return;
    destroyChart(id);
    const c = chartTheme();
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 260);
    gradient.addColorStop(0, c.purpleFill);
    gradient.addColorStop(1, c.purpleClear);

    state.charts[id] = new Chart(canvas, {
      type: "line",
      data: {
        labels: series.map((item) => item.label),
        datasets: [{
          label: "Pendapatan",
          data: series.map((item) => Number(item.revenue || 0)),
          borderColor: c.purple,
          backgroundColor: gradient,
          fill: true,
          borderWidth: 2.5,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: c.purple,
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
        }],
      },
      options: chartOptions(true),
    });
  }

  function createUserChart(id, series) {
    const canvas = $(id);
    if (!canvas || !window.Chart) return;
    destroyChart(id);
    const c = chartTheme();

    state.charts[id] = new Chart(canvas, {
      type: "line",
      data: {
        labels: series.map((item) => item.label),
        datasets: [
          {
            label: "Pengguna",
            data: series.map((item) => Number(item.users || 0)),
            borderColor: c.purple,
            backgroundColor: c.purpleFill,
            fill: true,
            borderWidth: 2.5,
            tension: 0.38,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: "Outlet",
            data: series.map((item) => Number(item.stores || 0)),
            borderColor: c.success,
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 4],
            tension: 0.38,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: chartOptions(false, true),
    });
  }

  function createPlanChart(id, plans) {
    const canvas = $(id);
    if (!canvas || !window.Chart) return;
    destroyChart(id);
    const c = chartTheme();
    const labels = plans.map((item) => planLabel(item.plan));
    const values = plans.map((item) => Number(item.count || 0));

    state.charts[id] = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: [c.purple, c.success, c.warning, c.danger, c.muted],
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, color: c.muted, font: { size: 10 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${number(ctx.raw)}` } },
        },
      },
    });
  }

  function chartOptions(currency = false, legend = false) {
    const c = chartTheme();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: legend ? { display: true, position: "bottom", align: "start", labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, color: c.muted, font: { size: 10 }, padding: 14 } } : { display: false },
        tooltip: {
          backgroundColor: c.tooltipBg,
          titleColor: c.tooltipInk,
          bodyColor: c.tooltipInk,
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: { label: (ctx) => currency ? formatIDR(ctx.parsed.y) : `${number(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: c.muted, font: { size: 10 }, maxRotation: 0 } },
        y: {
          beginAtZero: true,
          grid: { color: c.grid },
          border: { display: false },
          ticks: { color: c.muted, font: { size: 10 }, callback: (value) => currency ? compactIDR(value) : number(value) },
        },
      },
    };
  }

  function chartTheme() {
    const dark = document.documentElement.dataset.theme === "dark";
    return {
      purple: "#7164e8",
      success: "#42b99a",
      warning: "#f2b65d",
      danger: "#e77985",
      muted: dark ? "#a8a4bf" : "#85859a",
      grid: dark ? "rgba(255,255,255,0.07)" : "rgba(32,32,53,0.06)",
      purpleFill: dark ? "rgba(113,100,232,0.28)" : "rgba(113,100,232,0.16)",
      purpleClear: "rgba(113,100,232,0)",
      tooltipBg: dark ? "#2a2546" : "#171735",
      tooltipInk: "#ffffff",
    };
  }

  function destroyChart(id) {
    if (state.charts[id]) {
      state.charts[id].destroy();
      delete state.charts[id];
    }
  }

  function destroyCharts() {
    Object.values(state.charts).forEach((chart) => chart.destroy());
    state.charts = {};
  }

  function statCard(label, value, note, icon, tone = "") {
    return `<article class="stat-card ${escapeAttr(tone)}">
      <div class="stat-top"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-icon"><i data-lucide="${escapeAttr(icon)}"></i></span></div>
      <strong class="stat-value">${escapeHtml(value)}</strong>
      <span class="stat-note">${escapeHtml(note)}</span>
    </article>`;
  }

  function overviewRow(label, value, tone, sub) {
    return `<div class="overview-row">
      <div class="overview-left"><span class="overview-dot ${escapeAttr(tone)}"></span><div><div class="overview-name">${escapeHtml(label)}</div><div class="overview-sub">${escapeHtml(sub)}</div></div></div>
      <strong class="overview-value">${number(value)}</strong>
    </div>`;
  }

  function activityItem(item) {
    const type = String(item.type || "audit");
    return `<div class="activity-item">
      <span class="activity-icon ${escapeAttr(type)}"><i data-lucide="${activityIcon(type)}"></i></span>
      <div class="activity-copy"><strong>${escapeHtml(item.title || "Aktivitas")}</strong><span>${escapeHtml(item.detail || "")}</span></div>
      <time class="activity-time">${escapeHtml(relativeTime(item.created_at))}</time>
    </div>`;
  }

  function userRow(user) {
    const stores = Array.isArray(user.stores) ? user.stores : [];
    const name = String(user.full_name || "").trim() || user.email || "Tanpa nama";
    const secondary = String(user.full_name || "").trim() ? user.email || "" : "Nama profil belum diisi";
    const canManage = state.me && ["owner", "admin"].includes(state.me.role);
    return `<tr>
      <td><div class="user-cell"><div class="avatar">${escapeHtml(initials(name))}</div><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(secondary)}</span></div></div></td>
      <td>${renderStoreChips(stores)}</td>
      <td><div class="cell-stack"><strong>${escapeHtml(planLabel(user.plan))}</strong><span>${escapeHtml(statusLabel(user.subscription_status))}</span></div></td>
      <td>${statusBadge(user.status)}${user.is_admin ? ` <span class="badge badge-owner">${escapeHtml(roleLabel(user.admin_role))}</span>` : ""}</td>
      <td><div class="cell-stack"><strong>${escapeHtml(relativeTime(user.last_sign_in_at))}</strong><span>${escapeHtml(shortDate(user.last_sign_in_at))}</span></div></td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-small" type="button" data-user-detail="${escapeAttr(user.user_id)}">Detail</button>
        ${canManage ? `<button class="btn ${user.status === "suspended" ? "btn-success" : "btn-danger"} btn-small" type="button" data-user-status="${escapeAttr(user.user_id)}" data-next-status="${user.status === "suspended" ? "active" : "suspended"}">${user.status === "suspended" ? "Aktifkan" : "Suspend"}</button>` : ""}
      </div></td>
    </tr>`;
  }

  function renderStoreChips(stores) {
    if (!stores.length) return '<span class="muted">Belum punya outlet</span>';
    const chips = stores.slice(0, 2).map((store) => `<span class="chip" title="${escapeAttr(store.name || "Tanpa nama")}">${escapeHtml(store.name || "Tanpa nama")}<small>${escapeHtml(roleLabel(store.role))}</small></span>`);
    if (stores.length > 2) chips.push(`<span class="chip">+${stores.length - 2}</span>`);
    return `<div class="chips">${chips.join("")}</div>`;
  }

  function adminRow(admin, canManage) {
    const isSelf = admin.user_id === state.me.user_id;
    return `<tr>
      <td><div class="user-cell"><div class="avatar">${escapeHtml(initials(admin.display_name || admin.email))}</div><div><strong>${escapeHtml(admin.display_name || admin.email || "Admin")}</strong><span>${escapeHtml(admin.email || "")}</span></div></div></td>
      <td><span class="badge badge-${escapeAttr(admin.role)}">${escapeHtml(roleLabel(admin.role))}</span></td>
      <td>${statusBadge(admin.status)}</td>
      <td>${escapeHtml(shortDate(admin.created_at))}</td>
      <td><div class="row-actions">
        ${canManage ? `<button class="btn btn-ghost btn-small" type="button" data-admin-edit="${escapeAttr(admin.user_id)}">Ubah</button>` : ""}
        ${canManage && !isSelf ? `<button class="btn btn-danger btn-small" type="button" data-admin-delete="${escapeAttr(admin.user_id)}">Hapus</button>` : ""}
      </div></td>
    </tr>`;
  }

  function subscriptionRow(sub) {
    return `<tr>
      <td><div class="cell-stack"><strong>${escapeHtml(sub.store_name)}</strong><span>${escapeHtml(sub.owner_email || "")}</span></div></td>
      <td><span class="badge badge-${escapeAttr(sub.plan === "free" ? "free" : "owner")}">${escapeHtml(planLabel(sub.plan))}</span></td>
      <td>${statusBadge(sub.status)}</td>
      <td>${formatIDR(sub.amount)}</td>
      <td>${escapeHtml(shortDate(sub.current_period_end || sub.trial_ends_at))}</td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-small" type="button" data-sub-edit="${escapeAttr(sub.store_id)}" data-store="${escapeAttr(sub.store_name)}" data-plan="${escapeAttr(sub.plan)}" data-status="${escapeAttr(sub.status)}" data-amount="${escapeAttr(sub.amount)}" data-period="${escapeAttr(sub.current_period_end || "")}" data-note="${escapeAttr(sub.payment_note || "")}">Ubah</button>
        <button class="btn btn-soft btn-small" type="button" data-pay-store="${escapeAttr(sub.store_id)}" data-store="${escapeAttr(sub.store_name)}" data-plan="${escapeAttr(sub.plan)}">Catat bayar</button>
      </div></td>
    </tr>`;
  }

  function paymentRow(payment) {
    return `<tr>
      <td><div class="cell-stack"><strong>${escapeHtml(payment.store_name)}</strong><span>${escapeHtml(payment.owner_email || "")}</span></div></td>
      <td><span class="badge badge-owner">${escapeHtml(planLabel(payment.plan_code))}</span></td>
      <td class="strong">${formatIDR(payment.amount)}</td>
      <td>${statusBadge(payment.status)}</td>
      <td>${escapeHtml(methodLabel(payment.method))}</td>
      <td><div class="cell-stack"><strong>${escapeHtml(shortDate(payment.paid_at || payment.created_at))}</strong><span>${escapeHtml(payment.reference || "Tanpa referensi")}</span></div></td>
      <td><div class="row-actions"><button class="btn btn-ghost btn-small" type="button" data-pay-store="${escapeAttr(payment.store_id)}" data-store="${escapeAttr(payment.store_name)}" data-plan="${escapeAttr(payment.plan_code)}">Catat lagi</button></div></td>
    </tr>`;
  }

  function planCard(plan) {
    const features = Array.isArray(plan.features) ? plan.features : [];
    return `<article class="info-card">
      <div class="info-card-head"><div><h3>${escapeHtml(plan.name)}</h3><p>${escapeHtml(plan.description || "Paket langganan Hootch.")}</p></div>${statusBadge(plan.is_active ? "active" : "cancelled")}</div>
      <div class="price">${formatIDR(plan.price_monthly)}<small> / bulan</small></div>
      <p class="muted">${number(plan.subscribers)} outlet · ${number(plan.max_stores)} outlet · ${number(plan.max_members)} anggota</p>
      <ul class="feature-list">${features.map((feature) => `<li><i data-lucide="check"></i><span>${escapeHtml(feature)}</span></li>`).join("")}</ul>
      <div class="form-actions" style="justify-content:flex-start"><button class="btn btn-ghost btn-small" type="button" data-plan-edit="${escapeAttr(plan.code)}">Ubah paket</button></div>
    </article>`;
  }

  function featureRow(feature) {
    return `<div class="setting-row">
      <div class="setting-copy"><strong>${escapeHtml(feature.name)}</strong><span>${escapeHtml(feature.description || feature.key)} · rollout ${number(feature.rollout)}%</span></div>
      <label class="switch"><input type="checkbox" data-feature-key="${escapeAttr(feature.key)}" ${feature.enabled ? "checked" : ""}><span></span></label>
    </div>`;
  }

  function announcementCard(item) {
    return `<article class="info-card">
      <div class="info-card-head"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(audienceLabel(item.audience))} · ${escapeHtml(shortDate(item.created_at))}</p></div>${statusBadge(item.status)}</div>
      <p class="muted" style="margin-top:14px;white-space:pre-line">${escapeHtml(item.body)}</p>
      <div class="form-actions" style="justify-content:flex-start">
        <button class="btn btn-ghost btn-small" type="button" data-announcement-edit="${escapeAttr(item.id)}">Ubah</button>
        <button class="btn btn-danger btn-small" type="button" data-announcement-delete="${escapeAttr(item.id)}">Hapus</button>
      </div>
    </article>`;
  }

  function supportRow(item) {
    return `<tr>
      <td><div class="cell-stack"><strong>${escapeHtml(item.subject)}</strong><span>${escapeHtml(truncate(item.message, 90))}</span></div></td>
      <td><div class="cell-stack"><strong>${escapeHtml(item.user_email || "Pengguna")}</strong><span>${escapeHtml(item.store_name || "")}</span></div></td>
      <td><span class="badge badge-${item.priority === "high" ? "past_due" : item.priority === "low" ? "cancelled" : "trial"}">${escapeHtml(priorityLabel(item.priority))}</span></td>
      <td>${statusBadge(item.status)}</td>
      <td>${escapeHtml(relativeTime(item.created_at))}</td>
      <td><div class="row-actions"><button class="btn btn-ghost btn-small" type="button" data-support-id="${escapeAttr(item.id)}">Buka</button></div></td>
    </tr>`;
  }

  function auditRow(item) {
    return `<tr>
      <td><div class="cell-stack"><strong>${escapeHtml(item.action)}</strong><span>${escapeHtml(item.target_type || "record")}</span></div></td>
      <td><span class="muted">${escapeHtml(item.target_id || "-")}</span></td>
      <td>${escapeHtml(item.admin_email || "Sistem")}</td>
      <td><span class="muted small">${escapeHtml(truncate(JSON.stringify(item.payload || {}), 70))}</span></td>
      <td><div class="cell-stack"><strong>${escapeHtml(relativeTime(item.created_at))}</strong><span>${escapeHtml(formatDateTime(item.created_at))}</span></div></td>
    </tr>`;
  }

  function notificationItem(item) {
    const read = isNotificationRead(item.id);
    return `<button class="notif-item ${read ? "" : "unread"}" type="button" data-notif-id="${escapeAttr(item.id)}" data-notif-type="${escapeAttr(item.type)}">
      <span class="activity-icon ${escapeAttr(item.type)}"><i data-lucide="${notificationIcon(item.type)}"></i></span>
      <span class="notif-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span><time>${escapeHtml(relativeTime(item.created_at))}</time></span>
    </button>`;
  }

  function integrationRow(name, detail, tone) {
    return `<div class="overview-row"><div class="overview-left"><span class="overview-dot ${escapeAttr(tone)}"></span><div><div class="overview-name">${escapeHtml(name)}</div><div class="overview-sub">${escapeHtml(detail)}</div></div></div><span class="badge badge-${tone === "active" ? "active" : tone}">${tone === "active" ? "Aktif" : tone === "warning" ? "Perhatian" : "Gangguan"}</span></div>`;
  }

  function pageHead(title, subtitle, actions = "") {
    return `<header class="page-head"><div><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(subtitle)}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</header>`;
  }

  function emptyInline(title, message) {
    return `<div class="empty-state"><span class="empty-icon"><i data-lucide="inbox"></i></span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
  }

  function skeletonPage() {
    return `<div class="skeleton-page"><div class="skeleton hero"></div><div class="skeleton grid"></div><div class="skeleton row"></div><div class="skeleton row"></div></div>`;
  }

  function errorState(error) {
    return `<div class="error-state"><span class="empty-icon"><i data-lucide="triangle-alert"></i></span><h2>Gagal memuat halaman</h2><p>${escapeHtml(error.message || "Terjadi kesalahan saat mengambil data.")}</p><button id="retryButton" class="btn btn-primary" type="button">Coba lagi</button></div>`;
  }

  function bindTextSearch(id, key, route) {
    const input = $(id);
    if (!input) return;
    let timer = 0;
    input.addEventListener("input", () => {
      state[key] = input.value;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => rerenderWithFocus(route, id), 320);
    });
  }

  function bindSelect(id, key, route) {
    const select = $(id);
    if (!select) return;
    select.addEventListener("change", () => {
      state[key] = select.value;
      navigate(route);
    });
  }

  async function rerenderWithFocus(route, id) {
    const input = $(id);
    const position = input && typeof input.selectionStart === "number" ? input.selectionStart : null;
    await navigate(route);
    const next = $(id);
    if (next) {
      next.focus();
      if (position != null && next.setSelectionRange) next.setSelectionRange(position, position);
    }
  }

  function bindUserActions() {
    const body = $("usersBody");
    if (!body) return;
    body.addEventListener("click", async (event) => {
      const detail = event.target.closest("[data-user-detail]");
      if (detail) {
        await openUserDetail(detail.dataset.userDetail);
        return;
      }
      const status = event.target.closest("[data-user-status]");
      if (status) {
        await changeUserStatus(status.dataset.userStatus, status.dataset.nextStatus);
      }
    });
  }

  function bindAdminActions() {
    const body = $("adminsBody");
    if (!body) return;
    body.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-admin-edit]");
      if (edit) {
        const admins = await rpc("admin_list_admins");
        const admin = admins.find((item) => item.user_id === edit.dataset.adminEdit);
        if (admin) openAdminForm(admin);
        return;
      }
      const remove = event.target.closest("[data-admin-delete]");
      if (remove) await deleteAdmin(remove.dataset.adminDelete);
    });
  }

  function bindSubscriptionActions() {
    const body = $("subscriptionsBody");
    if (!body) return;
    body.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-sub-edit]");
      if (edit) {
        openSubscriptionForm({
          store_id: edit.dataset.subEdit,
          store_name: edit.dataset.store,
          plan: edit.dataset.plan,
          status: edit.dataset.status,
          amount: Number(edit.dataset.amount || 0),
          current_period_end: edit.dataset.period,
          payment_note: edit.dataset.note,
        });
        return;
      }
      const pay = event.target.closest("[data-pay-store]");
      if (pay) await openPaymentForm(pay.dataset.payStore, pay.dataset.store, pay.dataset.plan);
    });
  }

  function bindPaymentActions() {
    const body = $("paymentsBody");
    if (!body) return;
    body.addEventListener("click", async (event) => {
      const pay = event.target.closest("[data-pay-store]");
      if (pay) await openPaymentForm(pay.dataset.payStore, pay.dataset.store, pay.dataset.plan);
    });
  }

  function bindPlanActions() {
    const grid = document.querySelector(".card-grid");
    if (!grid) return;
    grid.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-plan-edit]");
      if (!edit) return;
      const plans = await rpc("admin_list_plans");
      const plan = plans.find((item) => item.code === edit.dataset.planEdit);
      if (plan) openPlanForm(plan);
    });
  }

  function bindFeatureToggles() {
    document.querySelectorAll("[data-feature-key]").forEach((input) => {
      input.addEventListener("change", async () => {
        input.disabled = true;
        try {
          await rpc("admin_toggle_feature", { p_key: input.dataset.featureKey, p_enabled: input.checked, p_rollout: 100 });
          toast(`${input.checked ? "Fitur diaktifkan" : "Fitur dinonaktifkan"}.`);
        } catch (error) {
          input.checked = !input.checked;
          toast(error.message || "Gagal mengubah fitur.", true);
        } finally {
          input.disabled = false;
        }
      });
    });
  }

  function bindAnnouncementActions() {
    const grid = document.querySelector(".card-grid");
    if (!grid) return;
    grid.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-announcement-edit]");
      if (edit) {
        const items = await rpc("admin_list_announcements");
        const item = items.find((row) => row.id === edit.dataset.announcementEdit);
        if (item) openAnnouncementForm(item);
        return;
      }
      const remove = event.target.closest("[data-announcement-delete]");
      if (remove) await deleteAnnouncement(remove.dataset.announcementDelete);
    });
  }

  function bindSupportActions() {
    const body = $("supportBody");
    if (!body) return;
    body.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-support-id]");
      if (!button) return;
      const items = await rpc("admin_list_support", { p_status: "all", p_search: "", p_limit: 200, p_offset: 0 });
      const item = items.find((row) => row.id === button.dataset.supportId);
      if (item) openSupportDetail(item);
    });
  }

  function bindSettingsForm(id) {
    const form = $(id);
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      setBusy(button, true, "Menyimpan...");
      try {
        const data = new FormData(form);
        const values = {
          platform_name: String(data.get("platform_name") || "").trim(),
          support_email: String(data.get("support_email") || "").trim(),
          timezone: String(data.get("timezone") || "Asia/Jakarta"),
          trial_days: Number(data.get("trial_days") || 0),
          maintenance_mode: String(data.get("maintenance_mode")) === "true",
        };
        for (const [key, value] of Object.entries(values)) {
          await rpc("admin_save_setting", { p_key: key, p_value: value });
        }
        toast("Pengaturan disimpan.");
        navigate(state.route);
      } catch (error) {
        toast(error.message || "Gagal menyimpan pengaturan.", true);
      } finally {
        setBusy(button, false);
      }
    });
  }

  function bindCopyButtons() {
    document.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.copy);
          toast("Disalin ke clipboard.");
        } catch {
          toast("Clipboard tidak tersedia.", true);
        }
      });
    });
  }

  async function openUserDetail(userId) {
    openDrawer("DETAIL PENGGUNA", "Memuat pengguna...", skeletonPage());
    try {
      const detail = await rpc("admin_user_detail", { p_user_id: userId });
      const user = detail.user || {};
      const stores = Array.isArray(detail.stores) ? detail.stores : [];
      const payments = Array.isArray(detail.payments) ? detail.payments : [];
      const support = Array.isArray(detail.support) ? detail.support : [];
      const name = user.full_name || user.email || "Pengguna";

      setDrawer("DETAIL PENGGUNA", name, `
        <div class="detail-grid">
          <div class="detail-meta"><span>Email</span><strong>${escapeHtml(user.email || "-")}</strong></div>
          <div class="detail-meta"><span>Status</span><strong>${escapeHtml(statusLabel(user.status))}</strong></div>
          <div class="detail-meta"><span>Terdaftar</span><strong>${escapeHtml(formatDate(user.joined_at))}</strong></div>
          <div class="detail-meta"><span>Login terakhir</span><strong>${escapeHtml(formatDateTime(user.last_sign_in_at))}</strong></div>
          <div class="detail-meta"><span>Email terverifikasi</span><strong>${user.email_confirmed ? "Ya" : "Belum"}</strong></div>
          <div class="detail-meta"><span>User ID</span><strong style="font-size:10px">${escapeHtml(user.user_id || userId)}</strong></div>
        </div>
        <div class="drawer-section">
          <div class="panel-head" style="padding:0 0 10px"><div><h3>Outlet (${stores.length})</h3></div></div>
          <div class="store-list">${stores.length ? stores.map(storeCard).join("") : emptyInline("Belum punya outlet", "Pengguna ini belum membuat outlet.")}</div>
        </div>
        <div class="drawer-section">
          <h3>Pembayaran terakhir</h3>
          ${payments.length ? `<div class="overview-list">${payments.map((payment) => overviewRow(payment.plan_code, formatIDR(payment.amount), payment.status === "paid" ? "success" : payment.status === "pending" ? "warning" : "danger", `${statusLabel(payment.status)} · ${shortDate(payment.paid_at || payment.created_at)}`)).join("")}</div>` : `<p class="muted">Belum ada pembayaran.</p>`}
        </div>
        <div class="drawer-section">
          <h3>Support</h3>
          ${support.length ? `<div class="overview-list">${support.map((item) => overviewRow(item.subject, statusLabel(item.status), item.status === "resolved" ? "success" : "warning", shortDate(item.created_at))).join("")}</div>` : `<p class="muted">Belum ada tiket support.</p>`}
        </div>
        ${state.me && ["owner", "admin"].includes(state.me.role) ? `<div class="form-actions">
          <button class="btn ${user.status === "suspended" ? "btn-success" : "btn-danger"}" type="button" data-drawer-user-status="${escapeAttr(user.user_id || userId)}" data-next-status="${user.status === "suspended" ? "active" : "suspended"}">${user.status === "suspended" ? "Aktifkan pengguna" : "Suspend pengguna"}</button>
        </div>` : ""}`);

      const action = els.drawerBody.querySelector("[data-drawer-user-status]");
      if (action) {
        action.addEventListener("click", async () => {
          await changeUserStatus(action.dataset.drawerUserStatus, action.dataset.nextStatus);
        });
      }
    } catch (error) {
      setDrawer("DETAIL PENGGUNA", "Gagal memuat", `<p class="muted">${escapeHtml(error.message || "Gagal memuat detail pengguna.")}</p>`);
    }
  }

  function storeCard(store) {
    return `<article class="store-card">
      <div class="store-card-head"><div><h3>${escapeHtml(store.name || "Tanpa nama")}</h3><p>${escapeHtml(roleLabel(store.role))} · ${escapeHtml(planLabel(store.plan))}</p></div>${statusBadge(store.status)}</div>
      <div class="store-metrics">
        <div class="metric"><span>Produk</span><strong>${number(store.products)}</strong></div>
        <div class="metric"><span>Transaksi</span><strong>${number(store.txns)}</strong></div>
        <div class="metric"><span>Sinkron</span><strong>${escapeHtml(shortDate(store.last_sync_at))}</strong></div>
        <div class="metric"><span>Periode</span><strong>${escapeHtml(shortDate(store.current_period_end || store.trial_ends_at))}</strong></div>
      </div>
    </article>`;
  }

  async function changeUserStatus(userId, status) {
    const label = status === "suspended" ? "Suspend" : "Aktifkan";
    if (!window.confirm(`${label} pengguna ini?`)) return;
    try {
      await rpc("admin_set_user_status", { p_user_id: userId, p_status: status });
      closeDrawer();
      toast(`Pengguna ${status === "suspended" ? "disuspend" : "diaktifkan"}.`);
      navigate("users");
    } catch (error) {
      toast(error.message || "Gagal mengubah status pengguna.", true);
    }
  }

  function openAdminForm(admin = null) {
    const editing = Boolean(admin && admin.user_id);
    openDrawer(editing ? "UBAH ADMIN" : "TAMBAH ADMIN", editing ? admin.email : "Admin baru", `
      <form id="adminForm">
        <div class="form-grid">
          <label class="field span-2">Email admin<input name="email" type="email" value="${escapeAttr(admin ? admin.email || "" : "")}" ${editing ? "readonly" : ""} required></label>
          <label class="field">Nama tampilan<input name="display_name" value="${escapeAttr(admin ? admin.display_name || "" : "")}" placeholder="Nama admin"></label>
          <label class="field">Role<select name="role">${["owner", "admin", "finance", "support"].map((role) => option(role, roleLabel(role), admin ? admin.role : "admin")).join("")}</select></label>
          <label class="field">Status<select name="status">${option("active", "Aktif", admin ? admin.status : "active")}${option("suspended", "Suspended", admin ? admin.status : "active")}</select></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? "Simpan perubahan" : "Tambah admin"}</button></div>
      </form>`);

    const form = $("adminForm");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      setBusy(button, true, "Menyimpan...");
      try {
        await rpc("admin_save_admin", {
          p_email: String(data.get("email") || "").trim(),
          p_role: String(data.get("role") || "admin"),
          p_status: String(data.get("status") || "active"),
          p_display_name: String(data.get("display_name") || "").trim() || null,
        });
        closeDrawer();
        toast(editing ? "Admin diperbarui." : "Admin ditambahkan.");
        navigate("admins");
      } catch (error) {
        toast(error.message || "Gagal menyimpan admin.", true);
      } finally {
        setBusy(button, false);
      }
    });
  }

  async function deleteAdmin(userId) {
    if (!window.confirm("Hapus akses admin ini?")) return;
    try {
      await rpc("admin_delete_admin", { p_user_id: userId });
      toast("Akses admin dihapus.");
      navigate("admins");
    } catch (error) {
      toast(error.message || "Gagal menghapus admin.", true);
    }
  }

  async function openSubscriptionForm(sub) {
    openDrawer("LANGGANAN", sub.store_name || "Ubah langganan", skeletonPage());
    try {
      const plans = await rpc("admin_list_plans");
      const activePlans = plans.filter((plan) => plan.is_active || plan.code === sub.plan);
      setDrawer("LANGGANAN", sub.store_name || "Ubah langganan", `
        <form id="subscriptionForm">
          <input type="hidden" name="store_id" value="${escapeAttr(sub.store_id)}">
          <div class="form-grid">
            <label class="field span-2">Outlet<input value="${escapeAttr(sub.store_name || "")}" readonly></label>
            <label class="field">Paket<select name="plan">${activePlans.map((plan) => option(plan.code, `${plan.name} · ${formatIDR(plan.price_monthly)}`, sub.plan)).join("")}</select></label>
            <label class="field">Status<select name="status">${["active", "trial", "past_due", "cancelled"].map((status) => option(status, statusLabel(status), sub.status)).join("")}</select></label>
            <label class="field">Nilai langganan (Rp)<input name="amount" type="number" min="0" value="${escapeAttr(sub.amount || 0)}"></label>
            <label class="field">Periode berakhir<input name="current_period_end" type="datetime-local" value="${escapeAttr(toLocalInput(sub.current_period_end))}"></label>
            <label class="field span-2">Catatan<textarea name="payment_note" placeholder="Catatan pembayaran atau perpanjangan">${escapeHtml(sub.payment_note || "")}</textarea></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan langganan</button></div>
        </form>`);

      const form = $("subscriptionForm");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const data = new FormData(form);
        setBusy(button, true, "Menyimpan...");
        try {
          await rpc("admin_update_subscription", {
            p_store_id: String(data.get("store_id")),
            p_plan: String(data.get("plan")),
            p_status: String(data.get("status")),
            p_amount: Number(data.get("amount") || 0),
            p_current_period_end: fromLocalInput(data.get("current_period_end")),
            p_payment_note: String(data.get("payment_note") || "").trim() || null,
          });
          closeDrawer();
          toast("Langganan diperbarui.");
          navigate("subscriptions");
        } catch (error) {
          toast(error.message || "Gagal menyimpan langganan.", true);
        } finally {
          setBusy(button, false);
        }
      });
    } catch (error) {
      setDrawer("LANGGANAN", "Gagal memuat", `<p class="muted">${escapeHtml(error.message || "Gagal memuat paket.")}</p>`);
    }
  }

  async function openPaymentForm(storeId = null, storeName = "", planCode = "") {
    openDrawer("PEMBAYARAN", "Catat pembayaran", skeletonPage());
    try {
      const [plans, stores] = await Promise.all([
        rpc("admin_list_plans"),
        storeId ? Promise.resolve([]) : rpc("admin_list_stores", { p_search: "", p_status: "all", p_limit: 200, p_offset: 0 }),
      ]);
      const activePlans = plans.filter((plan) => plan.is_active);
      if (!activePlans.length) throw new Error("Belum ada paket aktif.");
      if (!storeId && !stores.length) throw new Error("Belum ada outlet yang bisa dibayar.");

      const selectedPlan = activePlans.find((plan) => plan.code === planCode) || activePlans[0];
      const selectedStatus = "paid";
      const selectedMethod = "manual";
      const storeField = storeId
        ? `<input type="hidden" name="store_id" value="${escapeAttr(storeId)}"><label class="field span-2">Outlet<input value="${escapeAttr(storeName || "")}" readonly></label>`
        : `<label class="field span-2">Outlet<select name="store_id" required>${stores.map((store) => option(store.store_id, `${store.name} · ${store.owner_email || ""}`, storeId)).join("")}</select></label>`;

      setDrawer("PEMBAYARAN", "Catat pembayaran", `
        <form id="paymentForm">
          <div class="form-grid">
            ${storeField}
            <label class="field">Paket<select name="plan" id="paymentPlan">${activePlans.map((plan) => option(plan.code, `${plan.name} · ${formatIDR(plan.price_monthly)}`, selectedPlan.code)).join("")}</select></label>
            <label class="field">Jumlah (Rp)<input name="amount" id="paymentAmount" type="number" min="0" value="${escapeAttr(selectedPlan.price_monthly || 0)}" required></label>
            <label class="field">Status<select name="status">${option("paid", "Lunas", selectedStatus)}${option("pending", "Pending", selectedStatus)}${option("failed", "Gagal", selectedStatus)}${option("refunded", "Refund", selectedStatus)}</select></label>
            <label class="field">Metode<select name="method">${option("manual", "Manual", selectedMethod)}${option("bank_transfer", "Transfer bank", selectedMethod)}${option("cash", "Tunai", selectedMethod)}${option("e_wallet", "E-wallet", selectedMethod)}</select></label>
            <label class="field">Referensi<input name="reference" placeholder="No. transfer / catatan"></label>
            <label class="field">Periode berakhir<input name="period_end" type="datetime-local" value="${escapeAttr(toLocalInput(defaultPeriodEnd()))}"></label>
            <label class="field span-2">Catatan<textarea name="note" placeholder="Catatan pembayaran"></textarea></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan pembayaran</button></div>
        </form>`);

      const form = $("paymentForm");
      const planSelect = $("paymentPlan");
      const amountInput = $("paymentAmount");
      planSelect.addEventListener("change", () => {
        const plan = activePlans.find((item) => item.code === planSelect.value);
        if (plan) amountInput.value = plan.price_monthly || 0;
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const data = new FormData(form);
        setBusy(button, true, "Menyimpan...");
        try {
          await rpc("admin_record_payment", {
            p_store_id: String(data.get("store_id")),
            p_plan_code: String(data.get("plan")),
            p_amount: Number(data.get("amount") || 0),
            p_method: String(data.get("method") || "manual"),
            p_status: String(data.get("status") || "paid"),
            p_reference: String(data.get("reference") || "").trim() || null,
            p_period_start: null,
            p_period_end: fromLocalInput(data.get("period_end")),
            p_note: String(data.get("note") || "").trim() || null,
          });
          closeDrawer();
          toast("Pembayaran dicatat.");
          navigate(state.route === "subscriptions" ? "subscriptions" : "transactions");
        } catch (error) {
          toast(error.message || "Gagal mencatat pembayaran.", true);
        } finally {
          setBusy(button, false);
        }
      });
    } catch (error) {
      setDrawer("PEMBAYARAN", "Gagal memuat", `<p class="muted">${escapeHtml(error.message || "Gagal memuat data pembayaran.")}</p>`);
    }
  }

  function openPlanForm(plan = null) {
    const editing = Boolean(plan);
    const features = plan && Array.isArray(plan.features) ? plan.features.join("\n") : "";
    const activeValue = plan && plan.is_active === false ? "false" : "true";
    openDrawer(editing ? "UBAH PAKET" : "TAMBAH PAKET", editing ? plan.name : "Paket baru", `
      <form id="planForm">
        <div class="form-grid">
          <label class="field">Kode paket<input name="code" value="${escapeAttr(plan ? plan.code : "")}" ${editing ? "readonly" : ""} placeholder="pro" required></label>
          <label class="field">Nama paket<input name="name" value="${escapeAttr(plan ? plan.name : "")}" placeholder="Pro" required></label>
          <label class="field span-2">Deskripsi<textarea name="description" placeholder="Deskripsi singkat paket">${escapeHtml(plan ? plan.description || "" : "")}</textarea></label>
          <label class="field">Harga bulanan (Rp)<input name="price_monthly" type="number" min="0" value="${escapeAttr(plan ? plan.price_monthly : 0)}"></label>
          <label class="field">Harga tahunan (Rp)<input name="price_yearly" type="number" min="0" value="${escapeAttr(plan ? plan.price_yearly : 0)}"></label>
          <label class="field">Maks outlet<input name="max_stores" type="number" min="1" value="${escapeAttr(plan ? plan.max_stores : 1)}"></label>
          <label class="field">Maks anggota<input name="max_members" type="number" min="1" value="${escapeAttr(plan ? plan.max_members : 1)}"></label>
          <label class="field">Urutan<input name="sort_order" type="number" value="${escapeAttr(plan ? plan.sort_order : 0)}"></label>
          <label class="field">Status<select name="is_active">${option("true", "Aktif", activeValue)}${option("false", "Nonaktif", activeValue)}</select></label>
          <label class="field span-2">Fitur (satu per baris)<textarea name="features" placeholder="1 outlet&#10;Kasir dan stok&#10;Sinkron cloud">${escapeHtml(features)}</textarea></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? "Simpan paket" : "Tambah paket"}</button></div>
      </form>`);

    const form = $("planForm");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const featureLines = String(data.get("features") || "").split("\n").map((line) => line.trim()).filter(Boolean);
      setBusy(button, true, "Menyimpan...");
      try {
        await rpc("admin_save_plan", {
          p_code: String(data.get("code") || "").trim().toLowerCase(),
          p_name: String(data.get("name") || "").trim(),
          p_description: String(data.get("description") || "").trim(),
          p_price_monthly: Number(data.get("price_monthly") || 0),
          p_price_yearly: Number(data.get("price_yearly") || 0),
          p_max_stores: Number(data.get("max_stores") || 1),
          p_max_members: Number(data.get("max_members") || 1),
          p_features: featureLines,
          p_is_active: String(data.get("is_active")) === "true",
          p_sort_order: Number(data.get("sort_order") || 0),
        });
        closeDrawer();
        toast(editing ? "Paket diperbarui." : "Paket ditambahkan.");
        navigate("plans");
      } catch (error) {
        toast(error.message || "Gagal menyimpan paket.", true);
      } finally {
        setBusy(button, false);
      }
    });
  }

  function openAnnouncementForm(item = null) {
    const editing = Boolean(item);
    openDrawer(editing ? "UBAH PENGUMUMAN" : "PENGUMUMAN BARU", editing ? item.title : "Buat pengumuman", `
      <form id="announcementForm">
        <div class="form-grid">
          <label class="field span-2">Judul<input name="title" value="${escapeAttr(item ? item.title : "")}" placeholder="Judul pengumuman" required></label>
          <label class="field">Audiens<select name="audience">${["all", "free", "paid"].map((value) => option(value, audienceLabel(value), item ? item.audience : "all")).join("")}</select></label>
          <label class="field">Status<select name="status">${["draft", "published", "archived"].map((value) => option(value, statusLabel(value), item ? item.status : "draft")).join("")}</select></label>
          <label class="field span-2">Isi pengumuman<textarea name="body" placeholder="Tulis informasi untuk pengguna..." required>${escapeHtml(item ? item.body : "")}</textarea></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? "Simpan pengumuman" : "Buat pengumuman"}</button></div>
      </form>`);

    const form = $("announcementForm");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      setBusy(button, true, "Menyimpan...");
      try {
        await rpc("admin_save_announcement", {
          p_id: item ? item.id : null,
          p_title: String(data.get("title") || "").trim(),
          p_body: String(data.get("body") || "").trim(),
          p_audience: String(data.get("audience") || "all"),
          p_status: String(data.get("status") || "draft"),
        });
        closeDrawer();
        toast(editing ? "Pengumuman diperbarui." : "Pengumuman dibuat.");
        navigate("announcements");
      } catch (error) {
        toast(error.message || "Gagal menyimpan pengumuman.", true);
      } finally {
        setBusy(button, false);
      }
    });
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm("Hapus pengumuman ini?")) return;
    try {
      await rpc("admin_delete_announcement", { p_id: id });
      toast("Pengumuman dihapus.");
      navigate("announcements");
    } catch (error) {
      toast(error.message || "Gagal menghapus pengumuman.", true);
    }
  }

  function openSupportDetail(item) {
    openDrawer("SUPPORT", item.subject || "Tiket support", `
      <div class="detail-grid">
        <div class="detail-meta"><span>Pengguna</span><strong>${escapeHtml(item.user_email || "Pengguna")}</strong></div>
        <div class="detail-meta"><span>Outlet</span><strong>${escapeHtml(item.store_name || "-")}</strong></div>
        <div class="detail-meta"><span>Status</span><strong>${escapeHtml(statusLabel(item.status))}</strong></div>
        <div class="detail-meta"><span>Prioritas</span><strong>${escapeHtml(priorityLabel(item.priority))}</strong></div>
        <div class="detail-meta"><span>Dibuat</span><strong>${escapeHtml(formatDateTime(item.created_at))}</strong></div>
        <div class="detail-meta"><span>Dibalas</span><strong>${escapeHtml(item.replied_at ? formatDateTime(item.replied_at) : "Belum")}</strong></div>
      </div>
      <div class="drawer-section">
        <h3>Pesan pengguna</h3>
        <div class="kv"><strong style="white-space:pre-line;font-weight:500">${escapeHtml(item.message || "")}</strong></div>
      </div>
      <form id="supportReplyForm" class="drawer-section">
        <div class="form-grid">
          <label class="field span-2">Balasan admin<textarea name="reply" placeholder="Tulis balasan..." required>${escapeHtml(item.admin_reply || "")}</textarea></label>
          <label class="field">Status<select name="status">${["in_progress", "resolved", "closed"].map((value) => option(value, statusLabel(value), item.status === "open" ? "in_progress" : item.status)).join("")}</select></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Kirim balasan</button></div>
      </form>`);

    const form = $("supportReplyForm");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      setBusy(button, true, "Mengirim...");
      try {
        await rpc("admin_reply_support", {
          p_id: item.id,
          p_reply: String(data.get("reply") || "").trim(),
          p_status: String(data.get("status") || "resolved"),
        });
        closeDrawer();
        toast("Balasan support dikirim.");
        navigate("support");
      } catch (error) {
        toast(error.message || "Gagal mengirim balasan.", true);
      } finally {
        setBusy(button, false);
      }
    });
  }

  function openDrawer(eyebrow, title, body) {
    setDrawer(eyebrow, title, body);
    els.drawerOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function setDrawer(eyebrow, title, body) {
    els.drawerEyebrow.textContent = eyebrow;
    els.drawerTitle.textContent = title;
    els.drawerBody.innerHTML = body;
    iconRefresh();
  }

  function closeDrawer() {
    els.drawerOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = label || "Memproses...";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  function bindQuickCards() {
    document.querySelectorAll("[data-quick-card]").forEach((button) => {
      button.addEventListener("click", () => handleQuickActionValue(button.dataset.quickCard));
    });
  }

  function toggleQuickMenu() {
    const hidden = els.quickMenu.classList.contains("hidden");
    closeNotifPanel();
    els.quickMenu.classList.toggle("hidden", !hidden);
    if (hidden) iconRefresh();
  }

  function closeQuickMenu() {
    els.quickMenu.classList.add("hidden");
  }

  async function handleQuickAction(event) {
    const button = event.target.closest("[data-quick]");
    if (!button) return;
    closeQuickMenu();
    await handleQuickActionValue(button.dataset.quick);
  }

  async function handleQuickActionValue(action) {
    closeQuickMenu();
    if (action === "payment") await openPaymentForm();
    else if (action === "admin") openAdminForm();
    else if (action === "announcement") openAnnouncementForm();
    else if (action === "support") navigate("support");
  }

  function toggleNotifPanel() {
    const hidden = els.notifPanel.classList.contains("hidden");
    closeQuickMenu();
    if (hidden) {
      renderNotificationUI();
      els.notifPanel.classList.remove("hidden");
      iconRefresh();
    } else {
      els.notifPanel.classList.add("hidden");
    }
  }

  function closeNotifPanel() {
    els.notifPanel.classList.add("hidden");
  }

  function renderNotificationUI() {
    const unread = state.notifications.filter((item) => !isNotificationRead(item.id)).length;
    els.notifBadge.textContent = unread > 9 ? "9+" : String(unread);
    els.notifBadge.classList.toggle("hidden", unread === 0);
    els.notifList.innerHTML = state.notifications.length
      ? state.notifications.map(notificationItem).join("")
      : emptyInline("Tidak ada notifikasi", "Aktivitas baru akan muncul di sini.");
    iconRefresh();
  }

  async function handleNotificationClick(event) {
    const button = event.target.closest("[data-notif-id]");
    if (!button) return;
    state.readNotifs.add(button.dataset.notifId);
    saveReadNotifs();
    renderNotificationUI();
    closeNotifPanel();
    const type = button.dataset.notifType;
    if (type === "financial") navigate("transactions");
    else if (type === "system") navigate("support");
    else if (type === "security") navigate("subscriptions");
    else navigate("notifications");
  }

  function markAllNotificationsRead() {
    state.notifications.forEach((item) => state.readNotifs.add(item.id));
    saveReadNotifs();
    renderNotificationUI();
    toast("Semua notifikasi ditandai dibaca.");
    if (state.route === "notifications") navigate("notifications");
  }

  function isNotificationRead(id) {
    return state.readNotifs.has(id);
  }

  function loadReadNotifs() {
    try {
      const value = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
      return new Set(Array.isArray(value) ? value : []);
    } catch {
      return new Set();
    }
  }

  function saveReadNotifs() {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(state.readNotifs).slice(-500)));
  }

  function notificationIcon(type) {
    return {
      financial: "badge-dollar-sign",
      system: "life-buoy",
      security: "shield-alert",
      user: "user-round",
    }[type] || "bell";
  }

  function activityIcon(type) {
    return {
      payment: "badge-dollar-sign",
      financial: "badge-dollar-sign",
      support: "life-buoy",
      store: "store",
      audit: "scroll-text",
      security: "shield-alert",
      user: "user-round",
    }[type] || "activity";
  }

  function applyTheme(theme, persist) {
    const value = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = value;
    if (persist) localStorage.setItem(THEME_KEY, value);
    els.themeToggle.innerHTML = `<i data-lucide="${value === "dark" ? "sun" : "moon"}"></i>`;
    if (window.Chart) {
      Chart.defaults.color = getComputedStyle(document.body).color;
    }
    iconRefresh();
  }

  async function signOutEverywhere() {
    if (!window.confirm("Keluar dari semua perangkat?")) return;
    try {
      await db.auth.signOut({ scope: "global" });
    } catch {
      await db.auth.signOut();
    }
    showLogin();
    toast("Semua sesi telah dikeluarkan.");
  }

  function setActiveNav(route) {
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.route === route);
    });
  }

  function closeSidebar() {
    els.sidebar.classList.remove("open");
    els.sidebarBackdrop.classList.add("hidden");
  }

  function iconRefresh() {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
  }

  function displayName(me) {
    return (me && (me.display_name || me.email)) || "Owner";
  }

  function firstName(value) {
    return String(value || "Owner").trim().split(/\s+/)[0] || "Owner";
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 11) return "SELAMAT PAGI";
    if (hour < 15) return "SELAMAT SIANG";
    if (hour < 19) return "SELAMAT SORE";
    return "SELAMAT MALAM";
  }

  function roleLabel(role) {
    return {
      owner: "Owner",
      admin: "Admin",
      finance: "Finance",
      support: "Support",
      cashier: "Kasir",
    }[role] || "Anggota";
  }

  function planLabel(plan) {
    const value = String(plan || "free").toLowerCase();
    if (value === "free") return "Free";
    if (value === "pro") return "Pro";
    if (value === "business") return "Business";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function statusLabel(status) {
    return {
      active: "Aktif",
      trial: "Trial",
      past_due: "Menunggu bayar",
      cancelled: "Batal",
      free: "Free",
      suspended: "Suspended",
      paid: "Lunas",
      pending: "Pending",
      failed: "Gagal",
      refunded: "Refund",
      open: "Open",
      in_progress: "In progress",
      resolved: "Resolved",
      closed: "Closed",
      published: "Published",
      draft: "Draft",
      archived: "Arsip",
      operational: "Operational",
    }[status] || capitalize(String(status || ""));
  }

  function statusBadge(value) {
    return `<span class="badge badge-${safeClass(value)}">${escapeHtml(statusLabel(value))}</span>`;
  }

  function audienceLabel(value) {
    return { all: "Semua pengguna", free: "Pengguna Free", paid: "Pengguna berbayar" }[value] || "Semua pengguna";
  }

  function priorityLabel(value) {
    return { high: "Tinggi", normal: "Normal", low: "Rendah" }[value] || "Normal";
  }

  function methodLabel(value) {
    return {
      manual: "Manual",
      bank_transfer: "Transfer bank",
      cash: "Tunai",
      e_wallet: "E-wallet",
    }[value] || capitalize(String(value || "Manual"));
  }

  function number(value) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatIDR(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function compactIDR(value) {
    const amount = Number(value || 0);
    if (amount >= 1_000_000_000) return `Rp ${trimDecimal(amount / 1_000_000_000)} M`;
    if (amount >= 1_000_000) return `Rp ${trimDecimal(amount / 1_000_000)} jt`;
    if (amount >= 1_000) return `Rp ${trimDecimal(amount / 1_000)} rb`;
    return `Rp ${number(amount)}`;
  }

  function trimDecimal(value) {
    return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return "Belum ada";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return "Belum ada";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function shortDate(value) {
    const date = parseDate(value);
    if (!date) return "-";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
  }

  function formatTime(value) {
    const date = parseDate(value);
    if (!date) return "-";
    return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function formatLongDate(value) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  }

  function relativeTime(value) {
    const date = parseDate(value);
    if (!date) return "Belum ada";
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} hari lalu`;
    return shortDate(date);
  }

  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function truncate(value, max) {
    const text = String(value || "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function initials(value) {
    const words = String(value || "H").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "H";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  function maskKey(value) {
    const text = String(value || "");
    if (text.length < 18) return text;
    return `${text.slice(0, 14)}...${text.slice(-4)}`;
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!bytes) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${units[index]}`;
  }

  function option(value, label, selected) {
    return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function timezoneOptions(selected) {
    return ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"].map((zone) => option(zone, zone, selected)).join("");
  }

  function toLocalInput(value) {
    const date = parseDate(value);
    if (!date) return "";
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromLocalInput(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function defaultPeriodEnd() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  }

  function safeClass(value) {
    return String(value || "cancelled").toLowerCase().replace(/[^a-z0-9_]/g, "") || "cancelled";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function isAuthError(error) {
    const message = String(error && error.message ? error.message : "");
    return Boolean(error && (error.code === "42501" || /not authorized|jwt|permission denied|invalid claim/i.test(message)));
  }

  function setLoginError(message) {
    els.loginError.textContent = message || "";
  }

  function setLoginBusy(busy) {
    els.loginButton.disabled = busy;
    els.loginButton.textContent = busy ? "Memeriksa..." : "Masuk";
  }

  function toast(message, error = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle("error", Boolean(error));
    els.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 3600);
  }
})();
