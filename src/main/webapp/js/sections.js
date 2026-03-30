// ═══════════════════════════════════════════════════════
// sections.js — Categories CRUD
// ═══════════════════════════════════════════════════════

async function loadCategories() {
    const tbody = document.getElementById('catsTableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="4">
        <div class="spinner-border spinner-border-sm me-2" style="color:var(--primary)"></div>Loading...
    </td></tr>`;

    try {
        const res = await fetch(`${API}/categories`);
        allCategories = await res.json();

        if (!allCategories.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 text-muted">
                <i class="bi bi-tags" style="font-size:2rem;display:block;margin-bottom:8px"></i>
                No categories yet.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = allCategories.map(cat => `
            <tr>
                <td>${cat.imageUrl
                ? `<img src="${cat.imageUrl}" width="48" height="48" style="object-fit:cover;border-radius:8px">`
                : '<div style="width:48px;height:48px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center">🏷️</div>'
            }</td>
                <td><strong>${cat.name||'—'}</strong></td>
                <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:5px;font-size:0.8rem">${cat.categoryId||'—'}</code></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1"
                        onclick='openEditCatModal(${JSON.stringify(cat).replace(/'/g,"&#39;")})'>
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger"
                        onclick="deleteCategory('${cat.firestoreId}','${esc(cat.name)}')">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>`
        ).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">${e.message}</td></tr>`;
    }
}

function openAddCatModal() {
    document.getElementById('catFirestoreId').value = '';
    document.getElementById('catName').value = '';
    document.getElementById('catImageUrl').value = '';
    document.getElementById('catImageFile').value = '';
    document.getElementById('catImgPreview').style.display = 'none';
    document.getElementById('catModalLabel').textContent = 'Add Category';
    new bootstrap.Modal(document.getElementById('catModal')).show();
}

function openEditCatModal(cat) {
    document.getElementById('catFirestoreId').value = cat.firestoreId || '';
    document.getElementById('catName').value        = cat.name || '';
    document.getElementById('catImageUrl').value    = cat.imageUrl || '';
    document.getElementById('catModalLabel').textContent = 'Edit Category';
    const prev = document.getElementById('catImgPreview');
    if (cat.imageUrl) { prev.src = cat.imageUrl; prev.style.display = 'block'; }
    else prev.style.display = 'none';
    new bootstrap.Modal(document.getElementById('catModal')).show();
}

function previewCatImage(event) {
    const f = event.target.files[0]; if (!f) return;
    const p = document.getElementById('catImgPreview');
    p.src = URL.createObjectURL(f); p.style.display = 'block';
}

async function saveCategory() {
    const name = document.getElementById('catName').value.trim();
    if (!name) { showToast('Category name required', false); return; }

    const fileInput = document.getElementById('catImageFile');
    if (fileInput.files.length > 0) {
        const url = await uploadToStorage(fileInput.files[0], 'categories/'+Date.now()+'_'+fileInput.files[0].name, 'catUploadProgress');
        if (!url) return;
        document.getElementById('catImageUrl').value = url;
    }

    const catData = { name, imageUrl: document.getElementById('catImageUrl').value };
    const fid = document.getElementById('catFirestoreId').value;
    const isEdit = fid !== '';

    try {
        const res = await fetch(isEdit ? `${API}/categories/${fid}` : `${API}/categories`, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(catData)
        });
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('catModal')).hide();
            showToast(isEdit ? 'Category updated!' : 'Category added!');
            allCategories = []; // reset cache
            loadCategories();
        }
    } catch (e) { showToast('Failed: ' + e.message, false); }
}

async function deleteCategory(fid, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
        const res = await fetch(`${API}/categories/${fid}`, { method: 'DELETE' });
        if (res.ok) { showToast('Category deleted!'); allCategories=[]; loadCategories(); }
    } catch (e) { showToast('Failed', false); }
}


// ═══════════════════════════════════════════════════════
// banners.js — Banners (direct Firestore, no Java API)
// ═══════════════════════════════════════════════════════

async function loadBanners() {
    const grid = document.getElementById('bannersGrid');
    grid.innerHTML = `<div class="col-12 text-center py-5 text-muted">
        <div class="spinner-border spinner-border-sm me-2" style="color:var(--primary)"></div>Loading banners...
    </div>`;

    try {
        const snap = await fbDb.collection('banners').orderBy('order').get();
        setEl('statTotalBanners', snap.size);

        if (snap.empty) {
            grid.innerHTML = `<div class="col-12">
                <div class="banner-upload-zone" onclick="openAddBannerModal()">
                    <i class="bi bi-image-fill"></i>
                    <div class="fw-semibold">No banners yet</div>
                    <div class="small">Click to add your first banner</div>
                </div>
            </div>`;
            return;
        }

        grid.innerHTML = snap.docs.map(doc => {
            const b = doc.data();
            return `<div class="col-md-4 col-sm-6">
                <div class="banner-card">
                    <img src="${b.imageUrl}" alt="${b.title||'Banner'}">
                    <div class="banner-card-body">
                        <div>
                            <div class="fw-semibold" style="font-size:0.875rem">${b.title||'(no label)'}</div>
                            <div class="small text-muted">Order position: ${b.order}</div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <div class="banner-order-dot">${b.order}</div>
                            <button class="btn btn-sm btn-outline-primary"
                                onclick='openEditBannerModal("${doc.id}", ${JSON.stringify(b).replace(/'/g,"&#39;")})'
                                title="Edit"><i class="bi bi-pencil-square"></i></button>
                            <button class="btn btn-sm btn-outline-danger"
                                onclick="deleteBanner('${doc.id}','${esc(b.title||'Banner')}')"
                                title="Delete"><i class="bi bi-trash3"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('') + `<div class="col-md-4 col-sm-6">
            <div class="banner-upload-zone" onclick="openAddBannerModal()" style="min-height:220px">
                <i class="bi bi-plus-circle"></i>
                <div class="fw-semibold">Add Banner</div>
            </div>
        </div>`;

    } catch (e) {
        grid.innerHTML = `<div class="col-12 text-danger py-3">${e.message}</div>`;
    }
}

function openAddBannerModal() {
    ['bannerFirestoreId','bannerTitle','bannerImageUrl'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('bannerOrder').value = '1';
    document.getElementById('bannerImageFile').value = '';
    document.getElementById('bannerImgPreview').style.display = 'none';
    document.getElementById('bannerModalLabel').textContent = 'Add Banner';
    new bootstrap.Modal(document.getElementById('bannerModal')).show();
}

function openEditBannerModal(docId, b) {
    document.getElementById('bannerFirestoreId').value = docId;
    document.getElementById('bannerTitle').value = b.title || '';
    document.getElementById('bannerOrder').value = b.order || 1;
    document.getElementById('bannerImageUrl').value = b.imageUrl || '';
    document.getElementById('bannerModalLabel').textContent = 'Edit Banner';
    const p = document.getElementById('bannerImgPreview');
    if (b.imageUrl) { p.src = b.imageUrl; p.style.display = 'block'; }
    else p.style.display = 'none';
    new bootstrap.Modal(document.getElementById('bannerModal')).show();
}

function previewBannerImage(event) {
    const f = event.target.files[0]; if (!f) return;
    const p = document.getElementById('bannerImgPreview');
    p.src = URL.createObjectURL(f); p.style.display = 'block';
}

async function saveBanner() {
    const fileInput = document.getElementById('bannerImageFile');
    if (fileInput.files.length > 0) {
        const url = await uploadToStorage(fileInput.files[0], 'banners/'+Date.now()+'_'+fileInput.files[0].name, 'bannerUploadProgress');
        if (!url) return;
        document.getElementById('bannerImageUrl').value = url;
    }

    const imageUrl = document.getElementById('bannerImageUrl').value;
    if (!imageUrl) { showToast('Please select an image', false); return; }

    const bannerData = {
        imageUrl,
        title: document.getElementById('bannerTitle').value.trim(),
        order: parseInt(document.getElementById('bannerOrder').value) || 1
    };

    const docId = document.getElementById('bannerFirestoreId').value;
    try {
        if (docId) await fbDb.collection('banners').doc(docId).update(bannerData);
        else       await fbDb.collection('banners').add(bannerData);

        bootstrap.Modal.getInstance(document.getElementById('bannerModal')).hide();
        showToast(docId ? 'Banner updated!' : 'Banner added!');
        loadBanners();
    } catch (e) { showToast('Failed: ' + e.message, false); }
}

async function deleteBanner(docId, title) {
    if (!confirm(`Delete banner "${title}"?`)) return;
    try {
        await fbDb.collection('banners').doc(docId).delete();
        showToast('Banner deleted!'); loadBanners();
    } catch (e) { showToast('Failed', false); }
}


// ═══════════════════════════════════════════════════════
// orders.js — Orders section
// ═══════════════════════════════════════════════════════

async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="7">
        <div class="spinner-border spinner-border-sm me-2" style="color:var(--primary)"></div>Loading orders...
    </td></tr>`;

    try {
        const res = await fetch(`${API}/orders`);
        const orders = await res.json();

        if (!orders.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">
                <i class="bi bi-bag" style="font-size:2rem;display:block;margin-bottom:8px"></i>
                No orders yet.
            </td></tr>`;
            return;
        }

        const statusClass = {
            CONFIRMED: 'badge-confirmed', PROCESSING: 'badge-processing',
            DELIVERED: 'badge-delivered', RETURNED:   'badge-returned',
            PAID:      'badge-confirmed'
        };

        tbody.innerHTML = orders.map(o => {
            let dateStr = '—';
            const secs = o.orderDate?._seconds || o.orderDate?.seconds;
            if (secs) dateStr = new Date(secs * 1000).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            const cls = statusClass[o.status] || 'badge-returned';
            const ship = o.shippingAddress || {};

            // Build items list
            const items = (o.orderItems || []).map(item => {
                const attrs = (item.attributes || []).map(a => `${a.name}: ${a.value}`).join(', ');
                return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    ${item.productImage ? `<img src="${item.productImage}" width="36" height="36" style="border-radius:6px;object-fit:cover;border:1px solid #e2e8f0">` : ''}
                    <div>
                        <div style="font-size:0.8rem;font-weight:600">${item.productTitle||'—'}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted)">
                            Qty: ${item.quantity||1} &nbsp;|&nbsp; ${item.rentalWeeks||1} week(s) &nbsp;|&nbsp; LKR ${(item.unitPrice||0).toFixed(2)}/wk
                            ${attrs ? `<br><span style="color:#6b7280">${attrs}</span>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');

            return `<tr>
                <td>
                    <code style="font-size:0.72rem;background:#f1f5f9;padding:2px 6px;border-radius:5px;display:block;margin-bottom:4px">${o.orderId||o.firestoreId||'—'}</code>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${dateStr}</div>
                </td>
                <td>
                    <div style="font-weight:600;font-size:0.85rem">${ship.name||'—'}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${ship.email||'—'}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${ship.contact||'—'}</div>
                </td>
                <td style="max-width:180px">
                    <div style="font-size:0.78rem">${ship.address1||'—'}${ship.address2 ? ', '+ship.address2 : ''}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${ship.city||''} ${ship.postcode||''}</div>
                </td>
                <td style="min-width:200px">${items||'<span style="color:var(--text-muted);font-size:0.8rem">No items</span>'}</td>
                <td><strong style="color:var(--primary)">LKR ${(o.totalAmount||0).toFixed(2)}</strong></td>
                <td><span class="badge-pill ${cls}">${o.status||'UNKNOWN'}</span></td>
                <td>
                    <select class="form-select form-select-sm mb-1" id="st_${o.firestoreId}" style="font-size:0.78rem">
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="RETURNED">RETURNED</option>
                    </select>
                    <button class="btn btn-sm btn-primary w-100" onclick="updateOrderStatus('${o.firestoreId}')"
                            style="background:var(--primary);border:none;font-size:0.78rem">Update</button>
                </td>
            </tr>`;
        }).join('');

        orders.forEach(o => {
            const sel = document.getElementById('st_' + o.firestoreId);
            if (sel && o.status) sel.value = o.status;
        });

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">${e.message}</td></tr>`;
    }
}

async function updateOrderStatus(fid) {
    const status = document.getElementById('st_' + fid).value;
    try {
        const res = await fetch(`${API}/orders/${fid}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) { showToast('Status → ' + status); loadOrders(); }
    } catch (e) { showToast('Failed', false); }
}


// ═══════════════════════════════════════════════════════
// users.js — Users section (read-only view)
// ═══════════════════════════════════════════════════════

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="2">
        <div class="spinner-border spinner-border-sm me-2" style="color:var(--primary)"></div>Loading...
    </td></tr>`;

    try {
        const res = await fetch(`${API}/users`);
        const users = await res.json();

        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="2" class="text-center py-5 text-muted">
                <i class="bi bi-people" style="font-size:2rem;display:block;margin-bottom:8px"></i>
                No registered users yet.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td><strong>${u.name||'—'}</strong></td>
                <td>${u.email||'—'}</td>
            </tr>`
        ).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center text-danger py-4">${e.message}</td></tr>`;
    }
}


// ═══════════════════════════════════════════════════════
// SHARED UTILITIES — used by all section files
// ═══════════════════════════════════════════════════════

// Toast notification
function showToast(message, success = true) {
    const toast = document.getElementById('toast');
    toast.className = 'toast align-items-center text-white border-0 '
        + (success ? 'bg-success' : 'bg-danger');
    document.getElementById('toastMsg').textContent = message;
    new bootstrap.Toast(toast, { delay: 3500 }).show();
}

// Set element text
function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// Escape string for inline HTML attributes
function esc(s) {
    return (s||'').replace(/'/g,"&#39;").replace(/"/g,'&quot;');
}

// Upload a file to Firebase Storage and return the public download URL
async function uploadToStorage(file, path, progressId) {
    const prog = progressId ? document.getElementById(progressId) : null;
    if (prog) prog.style.display = 'block';
    try {
        const snap = await fbStorage.ref().child(path).put(file);
        const url  = await snap.ref.getDownloadURL();
        if (prog) prog.style.display = 'none';
        return url;
    } catch (e) {
        if (prog) prog.style.display = 'none';
        showToast('Image upload failed: ' + e.message, false);
        return null;
    }
}