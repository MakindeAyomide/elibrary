const API_BASE = '/api';

const state = {
  materials: [],
  categories: [],
  activeTab: 'all',
  search: '',
  category: 'all',
  sort: 'newest',
  uploaderName: localStorage.getItem('elibrary_user') || ''
};

// ---------- DOM refs ----------
const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const emptyStateText = document.getElementById('emptyStateText');
const statusBar = document.getElementById('statusBar');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const tabs = document.querySelectorAll('.tab');
const userInitial = document.getElementById('userInitial');
const userChip = document.getElementById('userChip');

const uploadOverlay = document.getElementById('uploadOverlay');
const openUploadBtn = document.getElementById('openUploadBtn');
const closeUploadBtn = document.getElementById('closeUploadBtn');
const cancelUploadBtn = document.getElementById('cancelUploadBtn');
const uploadForm = document.getElementById('uploadForm');
const formError = document.getElementById('formError');
const submitText = document.getElementById('submitText');
const submitBtn = document.getElementById('submitUploadBtn');
const uploaderField = document.getElementById('uploaderField');
const fUploader = document.getElementById('fUploader');

const pdfInput = document.getElementById('fPdf');
const pdfDrop = document.getElementById('pdfDrop');
const pdfText = document.getElementById('pdfText');
const coverInput = document.getElementById('fCover');
const coverDrop = document.getElementById('coverDrop');
const coverText = document.getElementById('coverText');
const categoryList = document.getElementById('categoryList');

const detailOverlay = document.getElementById('detailOverlay');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const detailTitle = document.getElementById('detailTitle');
const detailBody = document.getElementById('detailBody');

const toast = document.getElementById('toast');

// ---------- Init ----------
init();

async function init() {
  updateUserChip();
  bindEvents();
  await Promise.all([loadCategories(), loadMaterials()]);
}

function updateUserChip() {
  if (state.uploaderName) {
    userInitial.textContent = state.uploaderName.trim().charAt(0).toUpperCase();
    userChip.title = state.uploaderName;
  } else {
    userInitial.textContent = '?';
    userChip.title = 'No name set yet — it will be asked when you upload';
  }
}

function bindEvents() {
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      render();
    }, 250);
  });

  categoryFilter.addEventListener('change', (e) => {
    state.category = e.target.value;
    render();
  });

  sortFilter.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeTab = tab.dataset.tab;
      render();
    });
  });

  openUploadBtn.addEventListener('click', openUploadModal);
  closeUploadBtn.addEventListener('click', closeUploadModal);
  cancelUploadBtn.addEventListener('click', closeUploadModal);
  uploadOverlay.addEventListener('click', (e) => { if (e.target === uploadOverlay) closeUploadModal(); });
  closeDetailBtn.addEventListener('click', () => detailOverlay.classList.add('hidden'));
  detailOverlay.addEventListener('click', (e) => { if (e.target === detailOverlay) detailOverlay.classList.add('hidden'); });

  pdfInput.addEventListener('change', () => {
    if (pdfInput.files[0]) {
      pdfText.textContent = pdfInput.files[0].name;
      pdfDrop.classList.add('has-file');
    }
  });
  coverInput.addEventListener('change', () => {
    if (coverInput.files[0]) {
      coverText.textContent = coverInput.files[0].name;
      coverDrop.classList.add('has-file');
    }
  });

  uploadForm.addEventListener('submit', handleUpload);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeUploadModal();
      detailOverlay.classList.add('hidden');
    }
  });
}

// ---------- Data loading ----------
async function loadMaterials() {
  statusBar.textContent = 'Loading the catalog…';
  try {
    const res = await fetch(`${API_BASE}/materials`);
    state.materials = await res.json();
    render();
  } catch (err) {
    statusBar.textContent = 'Could not reach the server. Is it running?';
    console.error(err);
  }
}

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    state.categories = await res.json();
    categoryFilter.innerHTML = '<option value="all">All categories</option>' +
      state.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    categoryList.innerHTML = state.categories.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
  } catch (err) {
    console.error(err);
  }
}

// ---------- Rendering ----------
function getFilteredMaterials() {
  let list = [...state.materials];

  if (state.activeTab === 'mine') {
    if (!state.uploaderName) return [];
    list = list.filter(m => m.uploadedBy.toLowerCase() === state.uploaderName.toLowerCase());
  }

  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.author.toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (state.category !== 'all') {
    list = list.filter(m => m.category === state.category);
  }

  switch (state.sort) {
    case 'oldest':
      list.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
      break;
    case 'title':
      list.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'downloads':
      list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
      break;
    default:
      list.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  }

  return list;
}

function render() {
  const list = getFilteredMaterials();

  const totalLabel = state.activeTab === 'mine' ? 'in your uploads' : 'in the catalog';
  statusBar.textContent = `${list.length} ${list.length === 1 ? 'item' : 'items'} ${totalLabel}`;

  if (list.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    if (state.activeTab === 'mine' && !state.uploaderName) {
      emptyStateText.textContent = "You haven't uploaded anything from this device yet. Upload your first material to see it here.";
    } else if (state.activeTab === 'mine') {
      emptyStateText.textContent = "You haven't uploaded anything yet — your uploads will appear here.";
    } else if (state.search || state.category !== 'all') {
      emptyStateText.textContent = 'No materials match your search or filter. Try clearing them.';
    } else {
      emptyStateText.textContent = 'Be the first to upload a reference material.';
    }
    return;
  }

  emptyState.classList.add('hidden');
  grid.innerHTML = list.map(cardTemplate).join('');

  grid.querySelectorAll('[data-download]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadMaterial(btn.dataset.download);
    });
  });
  grid.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetail(btn.dataset.share);
    });
  });
  grid.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMaterial(btn.dataset.delete);
    });
  });
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

function cardTemplate(m) {
  const coverHtml = m.coverFilename
    ? `<img src="/uploads/covers/${m.coverFilename}" alt="Cover for ${escapeHtml(m.title)}" loading="lazy">`
    : `<div class="cover-fallback">${escapeHtml(initialsFromTitle(m.title))}</div>`;

  const isMine = state.uploaderName && m.uploadedBy.toLowerCase() === state.uploaderName.toLowerCase();

  return `
    <article class="card" data-id="${m.id}">
      <div class="card-cover">
        ${coverHtml}
        <span class="card-category">${escapeHtml(m.category)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(m.title)}</h3>
        <span class="card-author">${escapeHtml(m.author)}</span>
        <div class="card-meta">
          <span>${formatDate(m.uploadDate)}</span>
          <span>${m.downloads || 0} downloads</span>
        </div>
      </div>
      <div class="card-actions">
        <button data-download="${m.id}" title="Download">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M5 21h14"/></svg>
          Get
        </button>
        <button data-share="${m.id}" title="Share / details">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          Share
        </button>
        ${isMine ? `<button class="btn-danger" data-delete="${m.id}" title="Remove your upload">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>` : ''}
      </div>
    </article>
  `;
}

// ---------- Detail modal ----------
function openDetail(id) {
  const m = state.materials.find(x => x.id === id);
  if (!m) return;

  detailTitle.textContent = m.title;
  const link = `${window.location.origin}/api/materials/${m.id}/download`;
  const coverHtml = m.coverFilename
    ? `<img class="detail-cover" src="/uploads/covers/${m.coverFilename}" alt="Cover for ${escapeHtml(m.title)}">`
    : '';

  detailBody.innerHTML = `
    ${coverHtml}
    <p class="card-author" style="margin-bottom:4px;">by ${escapeHtml(m.author)} · ${escapeHtml(m.category)}</p>
    ${m.description ? `<p class="detail-description">${escapeHtml(m.description)}</p>` : ''}
    ${m.tags && m.tags.length ? `<p class="card-meta" style="border:none;padding:0;margin-bottom:14px;">Tags: ${m.tags.map(escapeHtml).join(', ')}</p>` : ''}
    <div class="detail-meta-row">
      <span>Uploaded by ${escapeHtml(m.uploadedBy)}</span>
      <span>${formatDate(m.uploadDate)}</span>
    </div>
    <div class="detail-meta-row" style="margin-top:-10px;">
      <span>${formatBytes(m.fileSize)}</span>
      <span>${m.downloads || 0} downloads</span>
    </div>
    <div class="detail-actions">
      <button class="btn btn-primary" id="detailDownloadBtn">Download PDF</button>
      <button class="btn btn-secondary" id="detailShareBtn">Share file</button>
    </div>
  `;

  detailOverlay.classList.remove('hidden');

  document.getElementById('detailDownloadBtn').addEventListener('click', () => downloadMaterial(m.id));
  document.getElementById('detailShareBtn').addEventListener('click', () => shareMaterialFile(m));
}

async function shareMaterialFile(material) {
  if (!navigator.share) {
    return showToast('File sharing is not supported on this device.');
  }

  const pdfUrl = `/uploads/pdfs/${encodeURIComponent(material.pdfFilename)}`;
  try {
    const res = await fetch(pdfUrl);
    if (!res.ok) throw new Error('Failed to fetch file');
    const blob = await res.blob();
    const file = new File([blob], material.pdfOriginalName || `${material.title}.pdf`, { type: 'application/pdf' });

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return showToast('File sharing is not supported by this browser.');
    }

    await navigator.share({
      files: [file],
      title: `Alexandaria: ${material.title}`,
      text: `Sharing "${material.title}" from Alexandaria`
    });
    showToast('File shared successfully');
  } catch (err) {
    console.error('Share failed', err);
    showToast('Unable to share the file directly.');
  }
}

// ---------- Actions ----------
function downloadMaterial(id) {
  window.open(`${API_BASE}/materials/${id}/download`, '_blank');
  setTimeout(loadMaterials, 800);
}

async function deleteMaterial(id) {
  if (!confirm('Remove this material from the library? This cannot be undone.')) return;
  try {
    const res = await fetch(`${API_BASE}/materials/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    showToast('Material removed');
    await loadMaterials();
  } catch (err) {
    showToast('Could not remove this material');
    console.error(err);
  }
}

// ---------- Upload modal ----------
function openUploadModal() {
  formError.classList.add('hidden');
  uploadForm.reset();
  pdfText.textContent = 'Choose or drop a PDF';
  coverText.textContent = 'Choose or drop a cover image';
  pdfDrop.classList.remove('has-file');
  coverDrop.classList.remove('has-file');

  if (state.uploaderName) {
    fUploader.value = state.uploaderName;
    uploaderField.querySelector('label').textContent = 'Your name *';
  }

  uploadOverlay.classList.remove('hidden');
}

function closeUploadModal() {
  uploadOverlay.classList.add('hidden');
}

async function handleUpload(e) {
  e.preventDefault();
  formError.classList.add('hidden');

  const formData = new FormData(uploadForm);

  if (!pdfInput.files[0]) {
    showFormError('Please choose a PDF file to upload.');
    return;
  }

  submitBtn.disabled = true;
  submitText.textContent = 'Uploading…';

  try {
    const res = await fetch(`${API_BASE}/materials`, { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    state.uploaderName = formData.get('uploadedBy').trim();
    localStorage.setItem('elibrary_user', state.uploaderName);
    updateUserChip();

    closeUploadModal();
    showToast('Material uploaded');
    await Promise.all([loadCategories(), loadMaterials()]);
  } catch (err) {
    showFormError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = 'Upload material';
  }
}

function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove('hidden');
}

// ---------- Utilities ----------
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 250);
  }, 2200);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

function initialsFromTitle(title) {
  return title.split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
