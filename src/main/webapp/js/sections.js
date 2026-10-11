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
                <td><strong>${cat.name||'-'}</strong></td>
                <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:5px;font-size:0.8rem">${cat.categoryId||'-'}</code></td>
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

// Every status an order can have. PAID is what the mobile app sets after payment,
// the other four are set by the admin. PAID is now in the dropdown, so it is no
// longer shown as an empty box.
const STATUS_OPTIONS = ['PAID', 'CONFIRMED', 'PROCESSING', 'DELIVERED', 'RETURNED'];

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
            let dateStr = '-';
            const secs = o.orderDate?._seconds || o.orderDate?.seconds;
            if (secs) dateStr = new Date(secs * 1000).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            const cls = statusClass[o.status] || 'badge-returned';
            const ship = o.shippingAddress || {};

            // Dropdown options: always show the CURRENT status as selected.
            // (If an order has an unexpected status, it is added to the list too.)
            const statusList = (!o.status || STATUS_OPTIONS.includes(o.status))
                ? STATUS_OPTIONS : [o.status, ...STATUS_OPTIONS];
            const optionsHtml = statusList.map(s =>
                `<option value="${s}"${s === o.status ? ' selected' : ''}>${s}</option>`).join('');

            // Build items list
            const items = (o.orderItems || []).map(item => {
                const attrs = (item.attributes || []).map(a => `${a.name}: ${a.value}`).join(', ');
                return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    ${item.productImage ? `<img src="${item.productImage}" width="36" height="36" style="border-radius:6px;object-fit:cover;border:1px solid #e2e8f0">` : ''}
                    <div>
                        <div style="font-size:0.8rem;font-weight:600">${item.productTitle||'-'}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted)">
                            Qty: ${item.quantity||1} &nbsp;|&nbsp; ${item.rentalWeeks||1} week(s) &nbsp;|&nbsp; LKR ${(item.unitPrice||0).toFixed(2)}/wk
                            ${attrs ? `<br><span style="color:#6b7280">${attrs}</span>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');

            return `<tr>
                <td>
                    <code style="font-size:0.72rem;background:#f1f5f9;padding:2px 6px;border-radius:5px;display:block;margin-bottom:4px">${o.orderId||o.firestoreId||'-'}</code>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${dateStr}</div>
                </td>
                <td>
                    <div style="font-weight:600;font-size:0.85rem">${ship.name||'-'}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${ship.email||'-'}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${ship.contact||'-'}</div>
                </td>
                <td style="max-width:180px">
                    <div style="font-size:0.78rem">${ship.address1||'-'}${ship.address2 ? ', '+ship.address2 : ''}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${ship.city||''} ${ship.postcode||''}</div>
                </td>
                <td style="min-width:170px">${items||'<span style="color:var(--text-muted);font-size:0.8rem">No items</span>'}</td>
                <td><strong style="color:var(--primary)">LKR ${(o.totalAmount||0).toFixed(2)}</strong></td>
                <td><span class="badge-pill ${cls}">${o.status||'UNKNOWN'}</span></td>
                <td class="status-update-cell">
                    <select class="form-select form-select-sm mb-1" id="st_${o.firestoreId}" style="font-size:0.78rem">
                        ${optionsHtml}
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

// ============================================================================
// USERS - customer list with order statistics, search / filter / sort, a details
//         popup, a printable report and CSV export.
// Data: GET /users (name, email, photo id) + GET /orders, matched by userId.
// Everything here is read-only: nothing is changed in the database.
// ============================================================================

let usersAll      = [];   // every user + their order statistics
let usersFiltered = [];   // users currently shown (after search / filter / sort)
const userPhotoCache = {};   // photo id -> download URL (so we ask Storage only once)

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="8">
        <div class="spinner-border spinner-border-sm me-2" style="color:var(--primary)"></div>Loading users...
    </td></tr>`;

    try {
        // Ask for users and orders at the same time
        const [uRes, oRes] = await Promise.all([fetch(`${API}/users`), fetch(`${API}/orders`)]);
        if (!uRes.ok) throw new Error(`Users API returned HTTP ${uRes.status}. Is Main.java running?`);
        const users = await uRes.json();

        // If orders fail to load we still show the users (their stats will be zero)
        let orders = [];
        if (oRes.ok) {
            try { orders = await oRes.json(); } catch (e) { orders = []; }
        }

        // Group orders by the user who placed them
        const byUser = {};
        orders.forEach(o => {
            if (!o.userId) return;
            if (!byUser[o.userId]) byUser[o.userId] = [];
            byUser[o.userId].push(o);
        });

        usersAll = users.map(u => {
            const id = u.firestoreId || u.uid || '';
            const os = (byUser[id] || []).slice().sort((a, b) => {
                const da = ohDate(a), db = ohDate(b);
                if (!da && !db) return 0;
                if (!da) return 1;
                if (!db) return -1;
                return db - da;                       // newest first
            });
            const latestShip = (os[0] && os[0].shippingAddress) || {};
            return {
                id,
                name:  u.name  || '',
                email: u.email || '',
                pic:   u.profilePicUrl || '',
                orders: os,
                orderCount: os.length,
                active: os.filter(o => o.status !== 'RETURNED').length,   // not yet returned
                books:  os.reduce((s, o) => s + (o.orderItems || [])
                    .reduce((n, i) => n + (i.quantity || 1), 0), 0),
                spent:  os.reduce((s, o) => s + (o.totalAmount || 0), 0),
                lastDate:  os.length ? ohDate(os[0]) : null,
                firstDate: os.length ? ohDate(os[os.length - 1]) : null,
                phone: latestShip.contact || '',
                city:  latestShip.city || '',
                address: [latestShip.address1, latestShip.address2, latestShip.city, latestShip.postcode]
                    .filter(Boolean).join(', ')
            };
        });

        applyUserFilters();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">${ohEsc(e.message)}</td></tr>`;
    }
}

function applyUserFilters() {
    const q      = (document.getElementById('userSearch').value || '').trim().toLowerCase();
    const filter = document.getElementById('userFilter').value;
    const sort   = document.getElementById('userSort').value;

    usersFiltered = usersAll.filter(u => {
        if (filter === 'customers' && u.orderCount === 0) return false;
        if (filter === 'nocustomers' && u.orderCount > 0) return false;
        if (filter === 'active' && u.active === 0) return false;
        if (q) {
            const hay = [u.name, u.email, u.phone, u.city, u.id].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    usersFiltered.sort((a, b) => {
        if (sort === 'orders') return b.orderCount - a.orderCount;
        if (sort === 'spent')  return b.spent - a.spent;
        if (sort === 'recent') return (b.lastDate ? b.lastDate.getTime() : 0) - (a.lastDate ? a.lastDate.getTime() : 0);
        return (a.name || '').localeCompare(b.name || '');          // default: name A-Z
    });

    renderUsers();
}

function clearUserFilters() {
    document.getElementById('userSearch').value = '';
    document.getElementById('userFilter').value = '';
    document.getElementById('userSort').value   = 'name';
    applyUserFilters();
}

function userInitial(u) {
    return ohEsc((u.name || u.email || '?').trim().charAt(0).toUpperCase());
}

function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    const list  = usersFiltered;

    // ---- summary cards ----
    setEl('uCount',     list.length);
    setEl('uCustomers', list.filter(u => u.orderCount > 0).length);
    setEl('uActive',    list.reduce((s, u) => s + u.active, 0));
    setEl('uRevenue',   ohMoney(list.reduce((s, u) => s + u.spent, 0)));

    // ---- line of text that appears only on the printed report ----
    const filterLabel = { '': 'All users', customers: 'With orders',
        nocustomers: 'No orders yet', active: 'With active orders' };
    const q = (document.getElementById('userSearch').value || '').trim();
    const parts = [
        'Generated: ' + new Date().toLocaleString('en-GB'),
        'Filter: ' + filterLabel[document.getElementById('userFilter').value],
    ];
    if (q) parts.push('Search: "' + q + '"');
    parts.push('Users: ' + list.length,
        'Total order value: ' + ohMoney(list.reduce((s, u) => s + u.spent, 0)));
    document.getElementById('uPrintMeta').textContent = parts.join('   |   ');

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">
            <i class="bi bi-people" style="font-size:2rem;display:block;margin-bottom:8px"></i>
            No users match your filters.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(u => `<tr>
        <td>
            <div class="user-cell">
                <div class="user-avatar-sm" id="uav_${ohEsc(u.id)}">${userInitial(u)}</div>
                <div>
                    <div style="font-weight:600;font-size:0.88rem">${ohEsc(u.name) || '-'}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${ohEsc(u.email) || '-'}</div>
                </div>
            </div>
        </td>
        <td>
            <div style="font-size:0.82rem">${ohEsc(u.phone) || '-'}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${ohEsc(u.city)}</div>
        </td>
        <td class="text-center">${u.orderCount}</td>
        <td class="text-center">${u.active
        ? `<span class="badge-pill badge-processing">${u.active}</span>` : '<span style="color:var(--text-muted)">0</span>'}</td>
        <td class="text-center">${u.books}</td>
        <td style="white-space:nowrap"><strong style="color:var(--primary)">${ohMoney(u.spent)}</strong></td>
        <td style="white-space:nowrap">${u.lastDate ? ohFmtDate(u.lastDate) : '-'}</td>
        <td class="no-print">
            <button class="btn btn-sm btn-outline-secondary" onclick="viewUser('${ohEsc(u.id)}')">
                <i class="bi bi-eye"></i> View
            </button>
        </td>
    </tr>`).join('');

    loadUserAvatars(list);
}

// Profile photos are stored in Firebase Storage (profile_images/<id>).
// We load them after the table is drawn; if one fails we keep the letter circle.
async function userPhotoUrl(photoId) {
    if (!photoId) return null;
    if (userPhotoCache[photoId] !== undefined) return userPhotoCache[photoId];
    try {
        userPhotoCache[photoId] = await fbStorage.ref('profile_images/' + photoId).getDownloadURL();
    } catch (e) {
        userPhotoCache[photoId] = null;
    }
    return userPhotoCache[photoId];
}

function loadUserAvatars(list) {
    list.forEach(async u => {
        const url = await userPhotoUrl(u.pic);
        const el  = document.getElementById('uav_' + u.id);
        if (url && el) el.innerHTML = `<img src="${ohEsc(url)}" alt="">`;
    });
}

// ---- details popup ----
async function viewUser(id) {
    const u = usersAll.find(x => x.id === id);
    if (!u) return;

    const photo = await userPhotoUrl(u.pic);
    const avatar = photo
        ? `<div class="user-avatar-lg"><img src="${ohEsc(photo)}" alt=""></div>`
        : `<div class="user-avatar-lg">${userInitial(u)}</div>`;

    const orderRows = u.orders.length ? u.orders.map(o => {
        const cls = OH_STATUS_CLASS[o.status] || 'badge-returned';
        return `<tr>
            <td style="white-space:nowrap">${ohFmtDate(ohDate(o))}</td>
            <td><code style="font-size:0.72rem">${ohEsc(o.orderId || o.firestoreId || '')}</code></td>
            <td style="font-size:0.8rem">${ohEsc(ohItemsText(o))}</td>
            <td style="white-space:nowrap">${ohMoney(o.totalAmount)}</td>
            <td><span class="badge-pill ${cls}">${ohEsc(o.status || 'UNKNOWN')}</span></td>
        </tr>`;
    }).join('') : `<tr><td colspan="5" class="text-center text-muted py-3">This user has not placed any orders yet.</td></tr>`;

    document.getElementById('userModalTitle').textContent = u.name || 'User details';
    document.getElementById('userModalBody').innerHTML = `
        <div class="user-profile-head">
            ${avatar}
            <div>
                <div style="font-size:1.15rem;font-weight:800">${ohEsc(u.name) || '-'}</div>
                <div style="color:var(--text-muted)">${ohEsc(u.email) || '-'}</div>
                <code style="font-size:0.7rem">${ohEsc(u.id)}</code>
            </div>
        </div>

        <div class="oh-summary" style="margin:16px 0">
            <div class="oh-sum-card"><div class="oh-sum-value">${u.orderCount}</div><div class="oh-sum-label">Orders</div></div>
            <div class="oh-sum-card"><div class="oh-sum-value">${u.active}</div><div class="oh-sum-label">Active orders</div></div>
            <div class="oh-sum-card"><div class="oh-sum-value">${u.books}</div><div class="oh-sum-label">Books rented</div></div>
            <div class="oh-sum-card"><div class="oh-sum-value" style="font-size:1rem">${ohMoney(u.spent)}</div><div class="oh-sum-label">Total spent</div></div>
        </div>

        <div class="row g-3 mb-3" style="font-size:0.88rem">
            <div class="col-md-6"><strong>Phone:</strong> ${ohEsc(u.phone) || '-'}</div>
            <div class="col-md-6"><strong>Customer since:</strong> ${u.firstDate ? ohFmtDate(u.firstDate) : '-'}</div>
            <div class="col-md-6"><strong>Last order:</strong> ${u.lastDate ? ohFmtDate(u.lastDate) : '-'}</div>
            <div class="col-md-6"><strong>Delivery address:</strong> ${ohEsc(u.address) || '-'}</div>
        </div>

        <h6 style="font-weight:700">Order history</h6>
        <div class="table-responsive">
            <table class="table">
                <thead><tr><th>Date</th><th>Order</th><th>Books</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>${orderRows}</tbody>
            </table>
        </div>`;

    document.getElementById('userModalPrintBtn').onclick = () => printUserReport(u.id);
    new bootstrap.Modal(document.getElementById('userModal')).show();
}

// ---- print the whole (filtered) users list ----
function printUsersReport() {
    if (!usersFiltered.length) { showToast('Nothing to print', false); return; }
    document.body.classList.add('printing-users');
    window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing-users'));

// ---- export the (filtered) users list as CSV ----
function exportUsersCsv() {
    if (!usersFiltered.length) { showToast('Nothing to export', false); return; }

    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Name', 'Email', 'Phone', 'City', 'Orders', 'Active orders',
        'Books rented', 'Total spent (LKR)', 'Last order', 'User ID']];
    usersFiltered.forEach(u => rows.push([
        u.name, u.email, u.phone, u.city, u.orderCount, u.active, u.books,
        u.spent.toFixed(2), u.lastDate ? ohFmtDate(u.lastDate) : '', u.id
    ]));

    const csv  = '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bookloop-users-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('CSV exported (' + usersFiltered.length + ' users)');
}

// ---- print ONE customer report (opens a small window) ----
function printUserReport(id) {
    const u = usersAll.find(x => x.id === id);
    if (!u) return;

    const rows = u.orders.map(o => `<tr>
        <td>${ohFmtDate(ohDate(o))}</td>
        <td>${ohEsc(o.orderId || o.firestoreId || '')}</td>
        <td>${ohEsc(ohItemsText(o))}</td>
        <td style="text-align:right">${ohMoney(o.totalAmount)}</td>
        <td>${ohEsc(o.status || '')}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center">No orders yet</td></tr>';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>Customer report ${ohEsc(u.name)}</title>
        <style>
            body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:32px}
            h1{margin:0;color:#8D4E2C} .muted{color:#666;font-size:13px}
            table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
            th{background:#f0e6de;text-align:left;padding:7px;border:1px solid #ddd}
            td{padding:7px;border:1px solid #ddd}
            .grid{display:flex;flex-wrap:wrap;gap:8px 32px;margin-top:16px;font-size:14px}
            .stats{display:flex;gap:12px;margin-top:16px}
            .stat{flex:1;border:1px solid #ddd;border-radius:8px;padding:10px}
            .stat b{display:block;font-size:17px;color:#8D4E2C}
        </style></head><body>
        <h1>BookLoop</h1>
        <div class="muted">Customer Report | Generated ${new Date().toLocaleString('en-GB')}</div>
        <h2 style="margin:18px 0 2px">${ohEsc(u.name) || '-'}</h2>
        <div class="muted">${ohEsc(u.email)} | User ID: ${ohEsc(u.id)}</div>
        <div class="grid">
            <div><strong>Phone:</strong> ${ohEsc(u.phone) || '-'}</div>
            <div><strong>Customer since:</strong> ${u.firstDate ? ohFmtDate(u.firstDate) : '-'}</div>
            <div><strong>Last order:</strong> ${u.lastDate ? ohFmtDate(u.lastDate) : '-'}</div>
            <div><strong>Address:</strong> ${ohEsc(u.address) || '-'}</div>
        </div>
        <div class="stats">
            <div class="stat"><b>${u.orderCount}</b>Orders</div>
            <div class="stat"><b>${u.active}</b>Active orders</div>
            <div class="stat"><b>${u.books}</b>Books rented</div>
            <div class="stat"><b>${ohMoney(u.spent)}</b>Total spent</div>
        </div>
        <table>
            <thead><tr><th>Date</th><th>Order</th><th>Books</th><th style="text-align:right">Total</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        </body></html>`;

    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { showToast('Please allow pop-ups to print the report', false); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
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


// ============================================================================
// ORDER HISTORY  - history tab: search, filter, print report, export CSV,
//                  print a single invoice.
// Uses the same GET /orders API as the Orders page (read-only, nothing is changed).
// ============================================================================

let historyOrders   = [];   // every order from the server (newest first)
let historyFiltered = [];   // the orders currently shown (after filters)

const OH_STATUS_CLASS = {
    PAID: 'badge-confirmed', CONFIRMED: 'badge-confirmed', PROCESSING: 'badge-processing',
    DELIVERED: 'badge-delivered', RETURNED: 'badge-returned'
};

// ---- small helpers ----
function ohEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ohDate(o) {
    const secs = o.orderDate && (o.orderDate._seconds || o.orderDate.seconds);
    return secs ? new Date(secs * 1000) : null;
}
function ohFmtDate(d) {
    return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}
function ohMoney(n) {
    return 'LKR ' + Number(n || 0).toLocaleString('en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function ohItemsText(o) {
    return (o.orderItems || []).map(i =>
        `${i.productTitle || 'Book'} x${i.quantity || 1} (${i.rentalWeeks || 1} wk)`).join(' | ');
}

// ---- load (called every time the History tab is opened) ----
async function loadOrderHistory() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="7">
        <div class="spinner-border spinner-border-sm me-2" style="color:var(--primary)"></div>Loading order history...
    </td></tr>`;

    try {
        const res = await fetch(`${API}/orders`);
        if (!res.ok) throw new Error(`Orders API returned HTTP ${res.status}. Is Main.java running?`);
        const orders = await res.json();

        // newest first (orders without a date go last)
        orders.sort((a, b) => {
            const da = ohDate(a), db = ohDate(b);
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return db - da;
        });

        historyOrders = orders;
        applyHistoryFilters();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">${ohEsc(e.message)}</td></tr>`;
    }
}

// ---- filters + render ----
function applyHistoryFilters() {
    const q      = (document.getElementById('historySearch').value || '').trim().toLowerCase();
    const status = document.getElementById('historyStatus').value;
    const from   = document.getElementById('historyFrom').value;   // yyyy-mm-dd or ''
    const to     = document.getElementById('historyTo').value;

    const fromD = from ? new Date(from + 'T00:00:00') : null;
    const toD   = to   ? new Date(to   + 'T23:59:59') : null;

    historyFiltered = historyOrders.filter(o => {
        if (status && o.status !== status) return false;

        const d = ohDate(o);
        if (fromD && (!d || d < fromD)) return false;
        if (toD   && (!d || d > toD))   return false;

        if (q) {
            const ship = o.shippingAddress || {};
            const hay = [o.orderId, o.firestoreId, o.status, ship.name, ship.email, ship.contact,
                ship.city, ohItemsText(o)].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    renderOrderHistory();
}

function clearHistoryFilters() {
    document.getElementById('historySearch').value = '';
    document.getElementById('historyStatus').value = '';
    document.getElementById('historyFrom').value   = '';
    document.getElementById('historyTo').value     = '';
    applyHistoryFilters();
}

function renderOrderHistory() {
    const tbody = document.getElementById('historyTableBody');
    const list  = historyFiltered;

    // ---- summary cards ----
    const totalValue = list.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const books      = list.reduce((s, o) => s + (o.orderItems || [])
        .reduce((n, i) => n + (i.quantity || 1), 0), 0);
    const finished   = list.filter(o => o.status === 'DELIVERED' || o.status === 'RETURNED').length;

    setEl('ohCount',    list.length);
    setEl('ohTotal',    ohMoney(totalValue));
    setEl('ohBooks',    books);
    setEl('ohFinished', finished);

    // ---- text shown only on the printed report ----
    const status = document.getElementById('historyStatus').value;
    const from   = document.getElementById('historyFrom').value;
    const to     = document.getElementById('historyTo').value;
    const q      = (document.getElementById('historySearch').value || '').trim();
    const parts  = [
        'Generated: ' + new Date().toLocaleString('en-GB'),
        'Status: ' + (status || 'All'),
        'Dates: ' + (from || to ? ((from || 'start') + ' to ' + (to || 'today')) : 'All'),
    ];
    if (q) parts.push('Search: "' + q + '"');
    parts.push('Orders: ' + list.length, 'Total: ' + ohMoney(totalValue));
    document.getElementById('ohPrintMeta').textContent = parts.join('   |   ');

    // ---- table ----
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">
            <i class="bi bi-clock-history" style="font-size:2rem;display:block;margin-bottom:8px"></i>
            No orders match your filters.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(o => {
        const ship = o.shippingAddress || {};
        const cls  = OH_STATUS_CLASS[o.status] || 'badge-returned';
        const items = (o.orderItems || []).map(i =>
            `<div style="font-size:0.8rem">${ohEsc(i.productTitle || 'Book')}
                <span style="color:var(--text-muted)">x${i.quantity || 1} &middot; ${i.rentalWeeks || 1} wk</span></div>`
        ).join('') || '<span style="color:var(--text-muted);font-size:0.8rem">No items</span>';

        return `<tr>
            <td style="white-space:nowrap">${ohFmtDate(ohDate(o))}</td>
            <td><code style="font-size:0.72rem;background:#f1f5f9;padding:2px 6px;border-radius:5px">${ohEsc(o.orderId || o.firestoreId || '')}</code></td>
            <td>
                <div style="font-weight:600;font-size:0.85rem">${ohEsc(ship.name)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${ohEsc(ship.contact)}</div>
            </td>
            <td style="min-width:170px">${items}</td>
            <td style="white-space:nowrap"><strong style="color:var(--primary)">${ohMoney(o.totalAmount)}</strong></td>
            <td><span class="badge-pill ${cls}">${ohEsc(o.status || 'UNKNOWN')}</span></td>
            <td class="no-print">
                <button class="btn btn-sm btn-outline-secondary" title="Print invoice"
                        onclick="printOrderInvoice('${ohEsc(o.firestoreId)}')">
                    <i class="bi bi-printer"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ---- print the whole (filtered) report ----
function printOrderHistory() {
    if (!historyFiltered.length) { showToast('Nothing to print', false); return; }
    // The print CSS only applies while this class is on <body>
    document.body.classList.add('printing-history');
    window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing-history'));

// ---- export the (filtered) list as a CSV file (opens in Excel) ----
function exportHistoryCsv() {
    if (!historyFiltered.length) { showToast('Nothing to export', false); return; }

    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Order ID', 'Date', 'Customer', 'Email', 'Contact', 'Address',
        'Items', 'Total (LKR)', 'Status']];

    historyFiltered.forEach(o => {
        const ship = o.shippingAddress || {};
        const addr = [ship.address1, ship.address2, ship.city, ship.postcode].filter(Boolean).join(', ');
        rows.push([o.orderId || o.firestoreId || '', ohFmtDate(ohDate(o)), ship.name || '',
            ship.email || '', ship.contact || '', addr, ohItemsText(o),
            (o.totalAmount || 0).toFixed(2), o.status || '']);
    });

    const csv  = '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');   // BOM so Excel reads it right
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bookloop-orders-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('CSV exported (' + historyFiltered.length + ' orders)');
}

// ---- print ONE order as an invoice (opens a small window) ----
function printOrderInvoice(fid) {
    const o = historyOrders.find(x => x.firestoreId === fid);
    if (!o) return;

    const ship = o.shippingAddress || {};
    let sum = 0;
    const lines = (o.orderItems || []).map(i => {
        const qty = i.quantity || 1, wks = i.rentalWeeks || 1, unit = i.unitPrice || 0;
        const line = qty * wks * unit;
        sum += line;
        return `<tr>
            <td>${ohEsc(i.productTitle || 'Book')}</td>
            <td style="text-align:center">${qty}</td>
            <td style="text-align:center">${wks}</td>
            <td style="text-align:right">${ohMoney(unit)}</td>
            <td style="text-align:right">${ohMoney(line)}</td>
        </tr>`;
    }).join('');

    const other = (o.totalAmount || 0) - sum;
    const otherRow = other > 0.005
        ? `<tr><td colspan="4" style="text-align:right">Delivery / other charges</td>
               <td style="text-align:right">${ohMoney(other)}</td></tr>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>Invoice ${ohEsc(o.orderId || '')}</title>
        <style>
            body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:32px}
            h1{margin:0;color:#8D4E2C} .muted{color:#666;font-size:13px}
            table{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px}
            th{background:#f0e6de;text-align:left;padding:8px;border:1px solid #ddd}
            td{padding:8px;border:1px solid #ddd}
            .total td{font-weight:bold;font-size:15px}
            .row{display:flex;justify-content:space-between;margin-top:18px;gap:24px}
        </style></head><body>
        <h1>BookLoop</h1>
        <div class="muted">Book Renting App - Rental Invoice</div>
        <div class="row">
            <div>
                <strong>Billed to</strong><br>
                ${ohEsc(ship.name)}<br>
                ${ohEsc(ship.address1)}${ship.address2 ? ', ' + ohEsc(ship.address2) : ''}<br>
                ${ohEsc(ship.city)} ${ohEsc(ship.postcode)}<br>
                ${ohEsc(ship.contact)}<br>${ohEsc(ship.email)}
            </div>
            <div style="text-align:right">
                <strong>Order</strong> ${ohEsc(o.orderId || o.firestoreId || '')}<br>
                <strong>Date</strong> ${ohFmtDate(ohDate(o))}<br>
                <strong>Status</strong> ${ohEsc(o.status || '')}
            </div>
        </div>
        <table>
            <thead><tr><th>Book</th><th style="text-align:center">Qty</th>
                <th style="text-align:center">Weeks</th>
                <th style="text-align:right">Price / week</th>
                <th style="text-align:right">Amount</th></tr></thead>
            <tbody>${lines}${otherRow}
                <tr class="total"><td colspan="4" style="text-align:right">Total</td>
                    <td style="text-align:right">${ohMoney(o.totalAmount)}</td></tr>
            </tbody>
        </table>
        <p class="muted" style="margin-top:28px">Thank you for renting with BookLoop.</p>
        </body></html>`;

    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { showToast('Please allow pop-ups to print the invoice', false); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
}