// ═══════════════════════════════════════════════════════
// books.js — Books section (load, add, edit, delete, toggle)
// ═══════════════════════════════════════════════════════

let allBooks      = [];
let allCategories = [];  // cached for the category dropdown
let bookImageQueue    = [];   // File objects chosen this session
let existingImageUrls = [];   // Already-uploaded URLs (when editing)

// ── Load books table ─────────────────────────────────────────────────

async function loadBooks() {
    const tbody = document.getElementById('booksTableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="9">
        <div class="spinner-border spinner-border-sm me-2" style="color:var(--primary)"></div>Loading books...
    </td></tr>`;

    try {
        const res = await fetch(`${API}/books`);
        allBooks = await res.json();

        if (!allBooks.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted">
                <i class="bi bi-book" style="font-size:2rem;display:block;margin-bottom:8px"></i>
                No books yet. Click <strong>Add New Book</strong> to get started.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = allBooks.map(book => {
            const img    = (book.images && book.images.length) ? book.images[0] : '';
            const status = book.status
                ? '<span class="badge-pill badge-available">Available</span>'
                : '<span class="badge-pill badge-unavailable">Unavailable</span>';
            const rating = book.rating ? `⭐ ${parseFloat(book.rating).toFixed(1)}` : '—';

            return `<tr>
                <td>${img
                ? `<img src="${img}" width="40" height="58" style="object-fit:cover;border-radius:6px;border:1px solid #eee">`
                : '<div style="width:40px;height:58px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.2rem">📚</div>'
            }</td>
                <td>
                    <div style="font-weight:600">${book.title || '—'}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted)">${book.author || ''}</div>
                </td>
                <td>${book.categoryId || '—'}</td>
                <td><strong>LKR ${book.price || 0}</strong><div style="font-size:0.72rem;color:var(--text-muted)">/week</div></td>
                <td>${book.stockCount ?? '—'}</td>
                <td>${rating}</td>
                <td>${status}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1"
                        onclick='openEditBookModal(${JSON.stringify(book).replace(/'/g,"&#39;")})' title="Edit">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm ${book.status ? 'btn-outline-warning' : 'btn-outline-success'} me-1"
                        onclick="toggleBookStatus('${book.firestoreId}', ${!!book.status})"
                        title="${book.status ? 'Deactivate' : 'Activate'}">
                        <i class="bi bi-${book.status ? 'toggle-on' : 'toggle-off'}"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger"
                        onclick="deleteBook('${book.firestoreId}', '${esc(book.title)}')">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">${e.message}</td></tr>`;
    }
}

// ── Open ADD modal ───────────────────────────────────────────────────

function openAddBookModal() {
    resetBookForm();
    document.getElementById('bookModalLabel').textContent = 'Add New Book';
    loadCategoryDropdown();
    new bootstrap.Modal(document.getElementById('bookModal')).show();
}

// ── Open EDIT modal ──────────────────────────────────────────────────

function openEditBookModal(book) {
    resetBookForm();
    document.getElementById('bookFirestoreId').value  = book.firestoreId || '';
    document.getElementById('bookTitle').value        = book.title || '';
    document.getElementById('bookAuthor').value       = book.author || '';
    document.getElementById('bookDescription').value  = book.description || '';
    document.getElementById('bookPrice').value        = book.price || '';
    document.getElementById('bookStock').value        = book.stockCount || '';
    document.getElementById('bookRating').value       = book.rating || '';
    document.getElementById('bookStatus').value       = String(book.status !== false);
    document.getElementById('bookModalLabel').textContent = 'Edit Book';

    existingImageUrls = book.images ? [...book.images] : [];
    renderBookImageGrid();

    loadCategoryDropdown(book.categoryId);
    new bootstrap.Modal(document.getElementById('bookModal')).show();
}

function resetBookForm() {
    ['bookFirestoreId','bookTitle','bookAuthor','bookDescription',
        'bookPrice','bookStock','bookRating'].forEach(id =>
        document.getElementById(id).value = '');
    document.getElementById('bookStatus').value = 'true';
    document.getElementById('bookImageFiles').value = '';
    bookImageQueue    = [];
    existingImageUrls = [];
    renderBookImageGrid();
}

// ── Category dropdown ────────────────────────────────────────────────

async function loadCategoryDropdown(selectedId = '') {
    const sel = document.getElementById('bookCategory');
    sel.innerHTML = '<option value="">Select Category</option>';
    try {
        if (!allCategories.length) {
            const res = await fetch(`${API}/categories`);
            allCategories = await res.json();
        }
        allCategories.forEach(cat => {
            const o = document.createElement('option');
            o.value = cat.categoryId;
            o.textContent = cat.name;
            if (cat.categoryId === selectedId) o.selected = true;
            sel.appendChild(o);
        });
    } catch (_) {}
}

// ── Multi-image handling ─────────────────────────────────────────────

function handleBookImagesSelected(event) {
    const files     = Array.from(event.target.files);
    const remaining = 5 - existingImageUrls.length - bookImageQueue.length;
    if (remaining <= 0) { showToast('Max 5 images. Remove one first.', false); event.target.value=''; return; }
    bookImageQueue.push(...files.slice(0, remaining));
    if (files.length > remaining) showToast(`Only ${remaining} slot(s) left — added first ${remaining}.`, false);
    event.target.value = '';
    renderBookImageGrid();
}

function renderBookImageGrid() {
    const grid = document.getElementById('bookImagesGrid');
    grid.innerHTML = '';

    existingImageUrls.forEach((url, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'book-img-thumb';
        wrap.innerHTML = `
            <img src="${url}" alt="Cover ${i+1}">
            <span class="img-badge">${i===0?'Main':'#'+(i+1)}</span>
            <button class="img-remove" onclick="removeExistingImg(${i})" title="Remove">✕</button>`;
        grid.appendChild(wrap);
    });

    bookImageQueue.forEach((file, i) => {
        const gi = existingImageUrls.length + i;
        const wrap = document.createElement('div');
        wrap.className = 'book-img-thumb';
        wrap.innerHTML = `
            <img src="${URL.createObjectURL(file)}" alt="New">
            <span class="img-badge">${gi===0?'Main':'#'+(gi+1)}</span>
            <button class="img-remove" onclick="removeQueuedImg(${i})" title="Remove">✕</button>`;
        grid.appendChild(wrap);
    });
}

function removeExistingImg(i) { existingImageUrls.splice(i,1); renderBookImageGrid(); }
function removeQueuedImg(i)   { bookImageQueue.splice(i,1); renderBookImageGrid(); }

// ── Save book (add or edit) ──────────────────────────────────────────

async function saveBook() {
    const title  = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const price  = document.getElementById('bookPrice').value;
    const stock  = document.getElementById('bookStock').value;

    if (!title || !author || !price || !stock) {
        showToast('Fill in Title, Author, Price and Stock.', false); return;
    }

    // Upload any newly selected images to Firebase Storage
    if (bookImageQueue.length > 0) {
        document.getElementById('bookUploadProgress').style.display = 'block';
        for (const file of bookImageQueue) {
            const url = await uploadToStorage(file, 'books/' + Date.now() + '_' + file.name, 'bookUploadProgress');
            if (!url) { document.getElementById('bookUploadProgress').style.display='none'; return; }
            existingImageUrls.push(url);
        }
        bookImageQueue = [];
        document.getElementById('bookUploadProgress').style.display = 'none';
    }

    const bookData = {
        title,
        author,
        description: document.getElementById('bookDescription').value.trim(),
        price:       parseFloat(price),
        stockCount:  parseInt(stock),
        categoryId:  document.getElementById('bookCategory').value,
        status:      document.getElementById('bookStatus').value === 'true',
        images:      existingImageUrls,
        rating:      parseFloat(document.getElementById('bookRating').value) || 0.0
    };

    const fid    = document.getElementById('bookFirestoreId').value;
    const isEdit = fid !== '';

    try {
        const res = await fetch(isEdit ? `${API}/books/${fid}` : `${API}/books`, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });

        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('bookModal')).hide();
            showToast(isEdit ? 'Book updated!' : 'Book added successfully!');
            loadBooks();
        } else {
            const err = await res.json().catch(()=>({}));
            showToast('Error: ' + (err.error || 'Unknown'), false);
        }
    } catch (e) {
        showToast('Failed to save: ' + e.message, false);
    }
}

// ── Toggle status ────────────────────────────────────────────────────

async function toggleBookStatus(fid, currentStatus) {
    try {
        const res = await fetch(`${API}/books/${fid}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: !currentStatus })
        });
        if (res.ok) { showToast('Status updated!'); loadBooks(); }
    } catch (e) { showToast('Failed', false); }
}

// ── Delete book ──────────────────────────────────────────────────────

async function deleteBook(fid, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
        const res = await fetch(`${API}/books/${fid}`, { method: 'DELETE' });
        if (res.ok) { showToast('Book deleted!'); loadBooks(); }
    } catch (e) { showToast('Failed to delete', false); }
}

// helper
function esc(s) { return (s||'').replace(/'/g,"&#39;").replace(/"/g,'&quot;'); }