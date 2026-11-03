(() => {
  "use strict";

  const SUPABASE_URL = "https://oqqnuqlsykwuxzosnndl.supabase.co";
  const SUPABASE_KEY = "sb_publishable_wr2bZohWBVs_mpIpHt6L8A_wZspM33b";

  const { createClient } = window.supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const $ = (id) => document.getElementById(id);
  const els = {
    loginView: $("loginView"),
    dashboardView: $("dashboardView"),
    loginForm: $("loginForm"),
    emailInput: $("emailInput"),
    passwordInput: $("passwordInput"),
    loginButton: $("loginButton"),
    loginError: $("loginError"),
    adminEmail: $("adminEmail"),
    logoutButton: $("logoutButton"),
    refreshButton: $("refreshButton"),
    lastUpdated: $("lastUpdated"),
    statsGrid: $("statsGrid"),
    userCount: $("userCount"),
    searchInput: $("searchInput"),
    usersBody: $("usersBody"),
    emptyState: $("emptyState"),
    loadingState: $("loadingState"),
    detailOverlay: $("detailOverlay"),
    detailTitle: $("detailTitle"),
    detailBody: $("detailBody"),
    closeDetail: $("closeDetail"),
    toast: $("toast"),
  };

  let users = [];
  let loading = false;
  let searchTimer = 0;
  let toastTimer = 0;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    try {
      const { data } = await db.auth.getSession();
      if (!data.session) return;
      if (await isAdmin()) {
        await enterDashboard(data.session.user);
      } else {
        await db.auth.signOut();
        setLoginError("Akun ini bukan owner Hootch.");
      }
    } catch (error) {
      setLoginError(error.message || "Gagal memeriksa sesi.");
    }
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", handleLogin);
    els.logoutButton.addEventListener("click", handleLogout);
    els.refreshButton.addEventListener("click", () => loadDashboard());
    els.searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(loadDashboard, 280);
    });
    els.closeDetail.addEventListener("click", closeDetail);
    els.detailOverlay.addEventListener("click", (event) => {
      if (event.target === els.detailOverlay) closeDetail();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDetail();
    });
    els.usersBody.addEventListener("click", (event) => {
      const button = event.target.closest("[data-user-id]");
      if (!button) return;
      const user = users.find((item) => item.user_id === button.dataset.userId);
      if (user) openDetail(user);
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

      if (!(await isAdmin())) {
        await db.auth.signOut();
        throw new Error("Akun ini bukan owner Hootch.");
      }

      els.passwordInput.value = "";
      await enterDashboard(data.user);
    } catch (error) {
      setLoginError(error.message || "Gagal masuk.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    await db.auth.signOut();
    showLogin();
  }

  async function isAdmin() {
    const { data, error } = await db.rpc("is_app_admin");
    if (error) throw error;
    return data === true;
  }

  async function enterDashboard(user) {
    els.loginView.classList.add("hidden");
    els.dashboardView.classList.remove("hidden");
    els.adminEmail.textContent = user.email || "";
    await loadDashboard();
  }

  function showLogin() {
    closeDetail();
    els.dashboardView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
    els.adminEmail.textContent = "";
    users = [];
    els.usersBody.innerHTML = "";
    els.statsGrid.innerHTML = "";
    els.userCount.textContent = "";
    els.lastUpdated.textContent = "";
  }

  async function loadDashboard() {
    if (loading) return;
    loading = true;
    setLoading(true);

    try {
      const search = els.searchInput.value.trim();
      const [overview, list] = await Promise.all([
        db.rpc("admin_overview"),
        db.rpc("admin_list_users", { p_search: search, p_limit: 200, p_offset: 0 }),
      ]);

      if (overview.error) throw overview.error;
      if (list.error) throw list.error;

      renderStats(overview.data || {});
      users = Array.isArray(list.data) ? list.data : [];
      renderUsers();
      els.lastUpdated.textContent = `Diperbarui ${formatTime(new Date())}`;
    } catch (error) {
      if (isAuthorizationError(error)) {
        await db.auth.signOut();
        setLoginError("Sesi berakhir atau akun ini bukan owner Hootch.");
      } else {
        toast(error.message || "Gagal memuat data.");
      }
    } finally {
      loading = false;
      setLoading(false);
    }
  }

  function isAuthorizationError(error) {
    const message = String(error && error.message ? error.message : "");
    return error && (error.code === "42501" || /not authorized|jwt|permission denied/i.test(message));
  }

  function renderStats(data) {
    const cards = [
      { label: "Pengguna", value: number(data.users), note: "Akun terdaftar" },
      { label: "Outlet", value: number(data.stores), note: "Toko aktif di cloud" },
      { label: "Langganan aktif", value: number(data.active_subscriptions), note: "Status active" },
      { label: "Trial", value: number(data.trials), note: "Sedang mencoba" },
      { label: "Menunggu bayar", value: number(data.pending_payments), note: "Perlu tindakan" },
    ];

    els.statsGrid.innerHTML = cards
      .map(
        (card) => `
          <article class="stat-card">
            <span class="stat-label">${escapeHtml(card.label)}</span>
            <strong class="stat-value">${card.value}</strong>
            <span class="stat-note">${escapeHtml(card.note)}</span>
          </article>`
      )
      .join("");
  }

  function renderUsers() {
    els.userCount.textContent = `${users.length} akun ditemukan`;
    els.emptyState.classList.toggle("hidden", users.length > 0);

    if (!users.length) {
      els.usersBody.innerHTML = "";
      return;
    }

    els.usersBody.innerHTML = users.map(renderUserRow).join("");
  }

  function renderUserRow(user) {
    const stores = storeList(user);
    const subscription = summarizeSubscription(stores);
    const lastActivity = latestDate([
      user.last_sign_in_at,
      ...stores.map((store) => store.last_sync_at),
    ]);
    const name = String(user.full_name || "").trim() || user.email || "Tanpa nama";
    const secondary = String(user.full_name || "").trim() ? user.email || "" : "Nama profil belum diisi";

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="avatar">${escapeHtml(initials(name))}</div>
            <div>
              <strong title="${escapeAttr(name)}">${escapeHtml(name)}</strong>
              <span title="${escapeAttr(secondary)}">${escapeHtml(secondary)}</span>
            </div>
          </div>
        </td>
        <td>${renderStoreChips(stores)}</td>
        <td>${renderSubscription(subscription)}</td>
        <td class="activity">
          <span>${escapeHtml(formatDate(lastActivity))}</span>
          <span class="sub">${escapeHtml(relativeTime(lastActivity))}</span>
        </td>
        <td>
          <button class="btn btn-ghost btn-small" type="button" data-user-id="${escapeAttr(user.user_id)}">Detail</button>
        </td>
      </tr>`;
  }

  function renderStoreChips(stores) {
    if (!stores.length) {
      return '<span class="muted">Belum punya outlet</span>';
    }

    const chips = stores.slice(0, 2).map(
      (store) => `
        <span class="chip" title="${escapeAttr(store.name || "Tanpa nama")}">
          ${escapeHtml(store.name || "Tanpa nama")}
          <small>${escapeHtml(roleLabel(store.role))}</small>
        </span>`
    );

    if (stores.length > 2) {
      chips.push(`<span class="chip">+${stores.length - 2}</span>`);
    }

    return `<div class="chips">${chips.join("")}</div>`;
  }

  function renderSubscription(subscription) {
    return `<span class="badge badge-${escapeAttr(subscription.status)}">
      ${escapeHtml(planLabel(subscription.plan))} &middot; ${escapeHtml(statusLabel(subscription.status))}
    </span>`;
  }

  function openDetail(user) {
    const stores = storeList(user);
    const name = String(user.full_name || "").trim() || user.email || "Pengguna";
    els.detailTitle.textContent = name;
    els.detailBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-meta"><span>Email</span><strong>${escapeHtml(user.email || "-")}</strong></div>
        <div class="detail-meta"><span>Terdaftar</span><strong>${escapeHtml(formatDate(user.joined_at))}</strong></div>
        <div class="detail-meta"><span>Login terakhir</span><strong>${escapeHtml(formatDate(user.last_sign_in_at))}</strong></div>
        <div class="detail-meta"><span>Status email</span><strong>${user.email_confirmed ? "Terverifikasi" : "Belum verifikasi"}</strong></div>
        <div class="detail-meta"><span>Jumlah outlet</span><strong>${stores.length}</strong></div>
        <div class="detail-meta"><span>User ID</span><strong>${escapeHtml(user.user_id)}</strong></div>
      </div>
      <h3>Outlet</h3>
      <div class="store-list">
        ${stores.length ? stores.map(renderStoreCard).join("") : '<div class="empty">Belum punya outlet.</div>'}
      </div>`;

    els.detailOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function renderStoreCard(store) {
    const status = store.status || "trial";
    return `
      <article class="store-card">
        <div class="store-card-head">
          <div>
            <h3>${escapeHtml(store.name || "Tanpa nama")}</h3>
            <p>${escapeHtml(roleLabel(store.role))} &middot; ${escapeHtml(planLabel(store.plan))}</p>
          </div>
          <span class="badge badge-${escapeAttr(status)}">${escapeHtml(statusLabel(status))}</span>
        </div>
        <div class="store-metrics">
          <div class="metric"><span>Produk</span><strong>${number(store.products)}</strong></div>
          <div class="metric"><span>Transaksi</span><strong>${number(store.txns)}</strong></div>
          <div class="metric"><span>Sinkron</span><strong>${escapeHtml(shortDate(store.last_sync_at))}</strong></div>
          <div class="metric"><span>Periode</span><strong>${escapeHtml(shortDate(store.current_period_end || store.trial_ends_at))}</strong></div>
        </div>
      </article>`;
  }

  function closeDetail() {
    els.detailOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function storeList(user) {
    return Array.isArray(user.stores) ? user.stores : [];
  }

  function summarizeSubscription(stores) {
    if (!stores.length) return { plan: "free", status: "free" };

    const rank = { active: 4, trial: 3, past_due: 2, cancelled: 1 };
    const sorted = [...stores].sort(
      (a, b) => (rank[b.status] || 0) - (rank[a.status] || 0)
    );
    const best = sorted[0];
    return {
      plan: best.plan || "free",
      status: best.status || "trial",
    };
  }

  function latestDate(values) {
    const dates = values
      .map((value) => (value ? new Date(value) : null))
      .filter((date) => date && !Number.isNaN(date.getTime()));
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((date) => date.getTime())));
  }

  function formatDate(value) {
    if (!value) return "Belum ada";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Belum ada";
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function shortDate(value) {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function relativeTime(value) {
    if (!value) return "Belum pernah aktif";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Belum pernah aktif";

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

  function roleLabel(role) {
    return { owner: "Owner", admin: "Admin", cashier: "Kasir" }[role] || "Anggota";
  }

  function planLabel(plan) {
    const value = String(plan || "free").toLowerCase();
    if (value === "pro") return "Pro";
    if (value === "business") return "Business";
    return "Free";
  }

  function statusLabel(status) {
    return {
      active: "Aktif",
      trial: "Trial",
      past_due: "Menunggu bayar",
      cancelled: "Batal",
      free: "Free",
    }[status] || "Trial";
  }

  function initials(value) {
    const text = String(value || "H").trim();
    return text.slice(0, 1).toUpperCase() || "H";
  }

  function number(value) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function setLoginBusy(busy) {
    els.loginButton.disabled = busy;
    els.loginButton.textContent = busy ? "Memeriksa..." : "Masuk";
  }

  function setLoginError(message) {
    els.loginError.textContent = message || "";
  }

  function setLoading(visible) {
    els.loadingState.classList.toggle("hidden", !visible);
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 3600);
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
})();
