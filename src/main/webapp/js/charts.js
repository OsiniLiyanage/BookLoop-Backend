// ═══════════════════════════════════════════════════════
// charts.js — Dashboard statistics and charts
// FIX: Added console logging so you can see exactly what
//      the API returns. Added fallback if chart canvas
//      doesn't exist yet.
// ═══════════════════════════════════════════════════════

let ordersBarChart = null;
let booksBarChart  = null;

// ── Load dashboard stats from Java API ──────────────────────────────

async function loadDashboard() {
    console.log('loadDashboard() called — fetching from', API + '/dashboard');

    try {
        const res = await fetch(`${API}/dashboard`);

        if (!res.ok) {
            throw new Error(`API returned HTTP ${res.status}. Is Main.java running?`);
        }

        const data = await res.json();
        console.log('Dashboard data received:', data);

        // Fill stat cards
        setEl('statTotalBooks',    data.totalBooks      ?? 0);
        setEl('statTotalOrders',   data.totalOrders     ?? 0);
        setEl('statTotalUsers',    data.totalUsers      ?? 0);
        setEl('statPendingOrders', data.pendingOrders   ?? 0);
        setEl('statActiveBooks',   data.activeBooks     ?? 0);
        setEl('statInactiveBooks', data.inactiveBooks   ?? 0);
        setEl('statTotalCats',     data.totalCategories ?? 0);

        // Draw charts after data is ready
        renderOrderStatusChart();
        renderBookStatusChart(data);

    } catch (e) {
        console.error('loadDashboard error:', e);
        showToast('Dashboard load failed: ' + e.message, false);

        // Show zeros instead of "—" so user knows data fetch ran but returned nothing
        ['statTotalBooks','statTotalOrders','statTotalUsers','statPendingOrders',
            'statActiveBooks','statInactiveBooks','statTotalCats'].forEach(id => setEl(id, '0'));
    }

    // Banner count comes from Firestore directly (not Java API)
    try {
        const snap = await fbDb.collection('banners').get();
        setEl('statTotalBanners', snap.size);
    } catch (e) {
        console.warn('Banner count error:', e.message);
        setEl('statTotalBanners', '0');
    }

    // Seller income cards + income chart + top earning books (from orders)
    loadIncome();
}

// ── Bar Chart: Orders by Status ──────────────────────────────────────

async function renderOrderStatusChart() {
    const ctx = document.getElementById('orderStatusChart');
    if (!ctx) return;

    let confirmed = 0, processing = 0, delivered = 0, returned = 0;

    try {
        const res = await fetch(`${API}/orders`);
        if (res.ok) {
            const orders = await res.json();
            orders.forEach(o => {
                if      (o.status === 'CONFIRMED' || o.status === 'PAID') confirmed++;   // PAID = new order from the app
                else if (o.status === 'PROCESSING')  processing++;
                else if (o.status === 'DELIVERED')   delivered++;
                else if (o.status === 'RETURNED')    returned++;
            });
            // Keep the "Pending Orders" card in step with the chart (CONFIRMED + PAID)
            setEl('statPendingOrders', confirmed);
        }
    } catch (e) {
        console.warn('Orders chart data error:', e.message);
    }

    // Destroy old chart before creating new one (prevents canvas error)
    if (ordersBarChart) { ordersBarChart.destroy(); ordersBarChart = null; }

    ordersBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Confirmed', 'Processing', 'Delivered', 'Returned'],
            datasets: [{
                label: 'Orders',
                data: [confirmed, processing, delivered, returned],
                backgroundColor: [
                    'rgba(251, 191, 36,  0.85)',
                    'rgba(59,  130, 246, 0.85)',
                    'rgba(34,  197, 94,  0.85)',
                    'rgba(156, 163, 175, 0.85)',
                ],
                borderColor: ['#f59e0b','#3b82f6','#22c55e','#9ca3af'],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} order${ctx.parsed.y !== 1 ? 's' : ''}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, precision: 0 },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ── Doughnut Chart: Book Availability ───────────────────────────────

function renderBookStatusChart(data) {
    const ctx = document.getElementById('bookStatusChart');
    if (!ctx) return;

    const active   = data.activeBooks   ?? 0;
    const inactive = data.inactiveBooks ?? 0;

    if (booksBarChart) { booksBarChart.destroy(); booksBarChart = null; }

    booksBarChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Available', 'Unavailable'],
            datasets: [{
                data: [active, inactive],
                backgroundColor: ['rgba(34,197,94,0.85)', 'rgba(239,68,68,0.85)'],
                borderColor:     ['#22c55e', '#ef4444'],
                borderWidth: 2,
                hoverOffset: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 16, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} books`
                    }
                }
            },
            cutout: '65%',
        }
    });
}


// ═══════════════════════════════════════════════════════
// INCOME — Seller earnings, calculated from the orders
//   Total Income  = sum of totalAmount of all orders
//   This Month    = same, only orders placed this month
//   Average Order = Total Income / number of orders
//   Books Rented  = total copies across all order items
//   Top books     = unitPrice x quantity x rentalWeeks per book
// ═══════════════════════════════════════════════════════

let incomeChartObj = null;

function incomeFmt(n, decimals = 0) {
    return 'LKR ' + Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
    });
}

function incomeEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

// Firestore timestamps arrive as { _seconds } or { seconds } (same as the Orders page)
function incomeOrderDate(order) {
    const d = order.orderDate;
    if (!d) return null;
    const secs = d._seconds != null ? d._seconds : d.seconds;
    if (secs != null) return new Date(secs * 1000);
    if (typeof d === 'number') return new Date(d);
    if (typeof d === 'string') { const t = new Date(d); return isNaN(t) ? null : t; }
    return null;
}

async function loadIncome() {
    try {
        const res = await fetch(`${API}/orders`);
        if (!res.ok) throw new Error(`Orders API returned HTTP ${res.status}`);
        const orders = await res.json();

        const now = new Date();
        let total = 0, monthTotal = 0, booksRented = 0;

        // Buckets for the last 6 months (oldest first)
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key:   d.getFullYear() + '-' + d.getMonth(),
                label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
                total: 0
            });
        }

        const byBook = {};

        orders.forEach(o => {
            const amount = Number(o.totalAmount) || 0;
            total += amount;

            const dt = incomeOrderDate(o);
            if (dt) {
                if (dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()) {
                    monthTotal += amount;
                }
                const bucket = months.find(m => m.key === dt.getFullYear() + '-' + dt.getMonth());
                if (bucket) bucket.total += amount;
            }

            (o.orderItems || []).forEach(item => {
                const qty   = Number(item.quantity)    || 1;
                const weeks = Number(item.rentalWeeks) || 1;
                const price = Number(item.unitPrice)   || 0;
                booksRented += qty;

                const id = item.productId || item.productTitle || 'unknown';
                if (!byBook[id]) byBook[id] = { title: item.productTitle || 'Untitled', rented: 0, income: 0 };
                byBook[id].rented += qty;
                byBook[id].income += price * qty * weeks;
            });
        });

        // Stat cards
        setEl('statIncomeTotal', incomeFmt(total));
        setEl('statIncomeMonth', incomeFmt(monthTotal));
        setEl('statIncomeAvg',   incomeFmt(orders.length ? total / orders.length : 0));
        setEl('statBooksRented', booksRented);

        renderIncomeChart(months);
        renderTopBooks(Object.values(byBook));

    } catch (e) {
        console.warn('Income load error:', e.message);
        ['statIncomeTotal', 'statIncomeMonth', 'statIncomeAvg'].forEach(id => setEl(id, 'LKR 0'));
        setEl('statBooksRented', '0');
        renderTopBooks([]);
    }
}

function renderIncomeChart(months) {
    const ctx = document.getElementById('incomeChart');
    if (!ctx) return;

    if (incomeChartObj) { incomeChartObj.destroy(); incomeChartObj = null; }

    incomeChartObj = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Income (LKR)',
                data: months.map(m => m.total),
                backgroundColor: 'rgba(141, 78, 44, 0.85)',
                borderColor: '#8D4E2C',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ' ' + incomeFmt(c.parsed.y, 2) } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: v => v >= 1000 ? (v / 1000) + 'k' : v
                    }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderTopBooks(books) {
    const tbody = document.getElementById('topBooksBody');
    if (!tbody) return;

    if (!books.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No rentals yet.</td></tr>`;
        return;
    }

    const top = books.sort((a, b) => b.income - a.income).slice(0, 5);
    tbody.innerHTML = top.map((b, i) => `
        <tr>
            <td><span class="top-book-rank">${i + 1}</span></td>
            <td class="top-book-cell"><div class="top-book-title" title="${incomeEsc(b.title)}">${incomeEsc(b.title)}</div></td>
            <td class="text-end">${b.rented}</td>
            <td class="text-end text-nowrap"><strong style="color:var(--primary)">${incomeFmt(b.income)}</strong></td>
        </tr>`).join('');
}