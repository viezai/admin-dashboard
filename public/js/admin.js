/**
 * ViezAI Admin Dashboard - Frontend Controller
 * OpenAI / Vercel Minimalist Dark Theme Client SPA
 */

// Application State
const state = {
  token: localStorage.getItem('viezai_admin_token') || '',
  contacts: [],
  stats: null,
  filters: {
    search: '',
    status: '',
    page: 1,
    limit: 15
  },
  pagination: {
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1
  },
  activeContact: null
};

// DOM Selectors
const elements = {
  loginView: document.getElementById('loginView'),
  dashboardView: document.getElementById('dashboardView'),
  loginForm: document.getElementById('loginForm'),
  adminKeyInput: document.getElementById('adminKeyInput'),
  loginError: document.getElementById('loginError'),
  logoutBtn: document.getElementById('logoutBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),

  // KPIs
  kpiTotal: document.getElementById('kpiTotal'),
  kpiNew: document.getElementById('kpiNew'),
  kpiContacting: document.getElementById('kpiContacting'),
  kpiCompleted: document.getElementById('kpiCompleted'),

  // Search & Filter
  searchInput: document.getElementById('searchInput'),
  filterButtons: document.querySelectorAll('.filter-btn'),

  // Contacts Table
  contactsTbody: document.getElementById('contactsTbody'),
  contactsCountInfo: document.getElementById('contactsCountInfo'),
  paginationPrev: document.getElementById('paginationPrev'),
  paginationNext: document.getElementById('paginationNext'),
  paginationCurrent: document.getElementById('paginationCurrent'),

  // Detail Modal
  detailModal: document.getElementById('detailModal'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  detailName: document.getElementById('detailName'),
  detailEmail: document.getElementById('detailEmail'),
  detailCompany: document.getElementById('detailCompany'),
  detailNeed: document.getElementById('detailNeed'),
  detailDate: document.getElementById('detailDate'),
  detailIp: document.getElementById('detailIp'),
  detailMessage: document.getElementById('detailMessage'),
  detailStatusSelect: document.getElementById('detailStatusSelect'),
  detailNotesInput: document.getElementById('detailNotesInput'),
  saveContactBtn: document.getElementById('saveContactBtn'),
  deleteContactBtn: document.getElementById('deleteContactBtn'),

  // Toast
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toastMessage')
};

// API Helper
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('API Error:', err);
    return { ok: false, status: 0, data: { error: 'Lỗi kết nối máy chủ.' } };
  }
}

// Show Toast
function showToast(message, type = 'success') {
  if (!elements.toast || !elements.toastMessage) return;
  elements.toastMessage.textContent = message;
  elements.toast.className = `toast ${type} show`;
  setTimeout(() => {
    elements.toast.className = 'toast';
  }, 3500);
}

// Authentication Handlers
async function checkAuth() {
  if (!state.token) {
    showLoginView();
    return;
  }

  const res = await apiRequest('/api/auth/verify');
  if (res.ok && res.data.valid) {
    showDashboardView();
    loadDashboardData();
  } else {
    state.token = '';
    localStorage.removeItem('viezai_admin_token');
    showLoginView();
  }
}

function showLoginView() {
  elements.loginView.style.display = 'flex';
  elements.dashboardView.style.display = 'none';
  elements.logoutBtn.style.display = 'none';
  if (elements.adminKeyInput) elements.adminKeyInput.value = '';
}

function showDashboardView() {
  elements.loginView.style.display = 'none';
  elements.dashboardView.style.display = 'block';
  elements.logoutBtn.style.display = 'inline-flex';
}

async function handleLogin(e) {
  e.preventDefault();
  const key = elements.adminKeyInput.value.trim();
  if (!key) {
    elements.loginError.textContent = 'Vui lòng nhập mã khóa quản trị.';
    elements.loginError.style.display = 'block';
    return;
  }

  elements.loginError.style.display = 'none';
  const res = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ key })
  });

  if (res.ok && res.data.success) {
    state.token = res.data.token;
    localStorage.setItem('viezai_admin_token', state.token);
    showToast('Đăng nhập thành công', 'success');
    showDashboardView();
    loadDashboardData();
  } else {
    elements.loginError.textContent = res.data.error || 'Mật khẩu quản trị không chính xác.';
    elements.loginError.style.display = 'block';
  }
}

function handleLogout() {
  state.token = '';
  localStorage.removeItem('viezai_admin_token');
  showLoginView();
  showToast('Đã đăng xuất.', 'success');
}

// Load KPIs and Contacts
async function loadDashboardData() {
  await Promise.all([fetchStats(), fetchContacts()]);
}

async function fetchStats() {
  const res = await apiRequest('/api/stats');
  if (res.ok && res.data.success) {
    state.stats = res.data.data;
    renderStats();
  }
}

function renderStats() {
  if (!state.stats) return;
  elements.kpiTotal.textContent = state.stats.total || 0;
  elements.kpiNew.textContent = state.stats.new_leads || 0;
  elements.kpiContacting.textContent = state.stats.contacting || 0;
  elements.kpiCompleted.textContent = state.stats.completed || 0;
}

async function fetchContacts() {
  const query = new URLSearchParams({
    page: state.filters.page,
    limit: state.filters.limit,
    search: state.filters.search,
    status: state.filters.status
  });

  elements.contactsTbody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-state">Đang tải dữ liệu khách hàng...</td>
    </tr>
  `;

  const res = await apiRequest(`/api/contacts?${query.toString()}`);
  if (res.ok && res.data.success) {
    state.contacts = res.data.data;
    state.pagination = res.data.pagination;
    renderContacts();
    renderPagination();
  } else {
    elements.contactsTbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state" style="color: var(--accent-rose);">
          Lỗi: ${res.data.error || 'Không thể tải danh sách liên hệ.'}
        </td>
      </tr>
    `;
  }
}

function getStatusBadge(status) {
  const map = {
    'new': { text: 'Mới nhận', cls: 'status-new' },
    'contacting': { text: 'Đang liên hệ', cls: 'status-contacting' },
    'completed': { text: 'Hoàn thành', cls: 'status-completed' },
    'archived': { text: 'Lưu trữ', cls: 'status-archived' }
  };
  const item = map[status] || { text: status, cls: 'status-archived' };
  return `<span class="status-pill ${item.cls}">${item.text}</span>`;
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderContacts() {
  if (!state.contacts || state.contacts.length === 0) {
    elements.contactsTbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-icon">📭</div>
          <div>Không tìm thấy lượt liên hệ nào phù hợp.</div>
        </td>
      </tr>
    `;
    elements.contactsCountInfo.textContent = '0 kết quả';
    return;
  }

  elements.contactsCountInfo.textContent = `Hiển thị ${state.contacts.length} / ${state.pagination.total} liên hệ`;

  const rowsHtml = state.contacts.map(c => `
    <tr style="cursor: pointer;" onclick="openDetailModal(${c.id})">
      <td>
        <div class="contact-name">${escapeHtml(c.full_name)}</div>
        <div class="contact-email">${escapeHtml(c.email)}</div>
      </td>
      <td>
        <span class="contact-company">${escapeHtml(c.company || '—')}</span>
      </td>
      <td>
        <span class="contact-need">${escapeHtml(c.need || '—')}</span>
      </td>
      <td>
        ${getStatusBadge(c.status)}
      </td>
      <td>
        <span class="contact-date">${formatDate(c.created_at)}</span>
      </td>
      <td style="text-align: right;" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="openDetailModal(${c.id})">Chi tiết</button>
      </td>
    </tr>
  `).join('');

  elements.contactsTbody.innerHTML = rowsHtml;
}

function renderPagination() {
  const { page, totalPages, total } = state.pagination;
  elements.paginationCurrent.textContent = `Trang ${page} / ${totalPages || 1}`;
  elements.paginationPrev.disabled = page <= 1;
  elements.paginationNext.disabled = page >= totalPages;
}

// Modal Handlers
window.openDetailModal = async function(id) {
  const res = await apiRequest(`/api/contacts/${id}`);
  if (res.ok && res.data.success) {
    state.activeContact = res.data.data;
    populateModal(state.activeContact);
    elements.detailModal.classList.add('open');
  } else {
    showToast('Không thể tải chi tiết liên hệ.', 'error');
  }
};

function populateModal(contact) {
  elements.detailName.textContent = contact.full_name;
  elements.detailEmail.textContent = contact.email;
  elements.detailCompany.textContent = contact.company || 'Chưa cung cấp';
  elements.detailNeed.textContent = contact.need || 'Chưa cung cấp';
  elements.detailDate.textContent = formatDate(contact.created_at);
  elements.detailIp.textContent = contact.ip_address || '—';
  elements.detailMessage.textContent = contact.message || '(Không có nội dung lời nhắn)';
  elements.detailStatusSelect.value = contact.status || 'new';
  elements.detailNotesInput.value = contact.notes || '';
}

function closeModal() {
  elements.detailModal.classList.remove('open');
  state.activeContact = null;
}

async function handleSaveContact() {
  if (!state.activeContact) return;
  const status = elements.detailStatusSelect.value;
  const notes = elements.detailNotesInput.value.trim();

  const res = await apiRequest(`/api/contacts/${state.activeContact.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes })
  });

  if (res.ok && res.data.success) {
    showToast('Đã lưu thông tin liên hệ', 'success');
    closeModal();
    loadDashboardData();
  } else {
    showToast(res.data.error || 'Lỗi khi cập nhật', 'error');
  }
}

async function handleDeleteContact() {
  if (!state.activeContact) return;
  const confirmDelete = confirm(`Bạn có chắc chắn muốn xóa lượt liên hệ của "${state.activeContact.full_name}"?`);
  if (!confirmDelete) return;

  const res = await apiRequest(`/api/contacts/${state.activeContact.id}`, {
    method: 'DELETE'
  });

  if (res.ok && res.data.success) {
    showToast('Đã xóa liên hệ thành công', 'success');
    closeModal();
    loadDashboardData();
  } else {
    showToast(res.data.error || 'Lỗi khi xóa liên hệ', 'error');
  }
}

// Export CSV Handler
function handleExportCsv() {
  if (!state.token) return;
  const url = `/api/contacts/export/csv?token=${encodeURIComponent(state.token)}`;
  window.open(url, '_blank');
}

// Debounced Search
let searchTimeout;
function handleSearch(e) {
  clearTimeout(searchTimeout);
  const term = e.target.value.trim();
  searchTimeout = setTimeout(() => {
    state.filters.search = term;
    state.filters.page = 1;
    fetchContacts();
  }, 350);
}

// Filter Status Button Click
function handleFilterClick(e) {
  const btn = e.currentTarget;
  const status = btn.getAttribute('data-status') || '';

  elements.filterButtons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  state.filters.status = status;
  state.filters.page = 1;
  fetchContacts();
}

// Setup Event Listeners
function initEventListeners() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.refreshBtn.addEventListener('click', loadDashboardData);
  elements.exportCsvBtn.addEventListener('click', handleExportCsv);

  elements.searchInput.addEventListener('input', handleSearch);
  elements.filterButtons.forEach(btn => {
    btn.addEventListener('click', handleFilterClick);
  });

  elements.paginationPrev.addEventListener('click', () => {
    if (state.filters.page > 1) {
      state.filters.page--;
      fetchContacts();
    }
  });

  elements.paginationNext.addEventListener('click', () => {
    if (state.filters.page < state.pagination.totalPages) {
      state.filters.page++;
      fetchContacts();
    }
  });

  elements.modalCloseBtn.addEventListener('click', closeModal);
  elements.detailModal.addEventListener('click', (e) => {
    if (e.target === elements.detailModal) closeModal();
  });

  elements.saveContactBtn.addEventListener('click', handleSaveContact);
  elements.deleteContactBtn.addEventListener('click', handleDeleteContact);

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.detailModal.classList.contains('open')) {
      closeModal();
    }
  });
}

// Application Startup
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  checkAuth();
});