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
                if      (o.status === 'CONFIRMED')   confirmed++;
                else if (o.status === 'PROCESSING')  processing++;
                else if (o.status === 'DELIVERED')   delivered++;
                else if (o.status === 'RETURNED')    returned++;
            });
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