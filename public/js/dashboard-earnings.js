/**
 * Creator Earnings Dashboard JavaScript
 * Handles earnings display, charts, transactions, and payout management
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initEarningsDashboard();
});

// Global state
let earningsData = null;
let revenueChart = null;
let breakdownChart = null;

/**
 * Initialize the earnings dashboard
 */
async function initEarningsDashboard() {
    try {
        // Load all data in parallel
        await Promise.all([
            loadEarnings(),
            loadMonthlyData(),
            loadSubscriberStats(),
            loadRecentTransactions(),
            loadRecentTips(),
            loadPayoutHistory(),
            loadPayoutSettings()
        ]);
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing earnings dashboard:', error);
        showToast(window.earningsTranslations?.loadError || 'Failed to load earnings data', 'error');
    }
}

/**
 * Load earnings summary
 */
async function loadEarnings() {
    try {
        const response = await fetch('/api/creator/earnings');
        const result = await response.json();
        
        if (result.success) {
            earningsData = result.data;
            updateEarningsDisplay(result.data);
        }
    } catch (error) {
        console.error('Error loading earnings:', error);
    }
}

/**
 * Update earnings display elements
 */
function updateEarningsDisplay(data) {
    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };
    
    // Update balance displays
    const availableBalance = formatCurrency(data.payouts.availableBalance);
    document.getElementById('availableBalance').textContent = availableBalance;
    document.getElementById('availableBalanceMobile').textContent = availableBalance;
    document.getElementById('availableBalanceSettings').textContent = availableBalance;
    document.getElementById('modalAvailableBalance').textContent = availableBalance;
    
    // Update stats
    document.getElementById('totalEarnings').textContent = formatCurrency(data.allTime.netRevenue);
    document.getElementById('monthlyEarnings').textContent = formatCurrency(data.currentMonth.netRevenue);
    document.getElementById('tipsEarnings').textContent = formatCurrency(data.allTime.tipsRevenue);
    
    // Update payout summary
    document.getElementById('totalPaidOut').textContent = formatCurrency(data.payouts.totalPaidOut);
    document.getElementById('pendingPayout').textContent = formatCurrency(data.payouts.pendingPayout);
    
    // Enable/disable payout button
    const canPayout = data.canRequestPayout;
    document.getElementById('requestPayoutBtn').disabled = !canPayout;
    document.getElementById('requestPayoutBtnMobile').disabled = !canPayout;
    
    // Set max payout amount
    const payoutAmountInput = document.getElementById('payoutAmount');
    if (payoutAmountInput) {
        payoutAmountInput.max = data.payouts.availableBalance;
        payoutAmountInput.value = Math.min(data.payouts.availableBalance, data.minimumPayout || 50);
    }
    
    // Update breakdown percentages
    const total = data.allTime.grossRevenue || 1;
    const subPercent = ((data.allTime.subscriptionRevenue / total) * 100).toFixed(1);
    const tipPercent = ((data.allTime.tipsRevenue / total) * 100).toFixed(1);
    
    document.getElementById('subscriptionPercent').textContent = subPercent + '%';
    document.getElementById('tipsPercent').textContent = tipPercent + '%';
    
    // Update breakdown chart
    updateBreakdownChart(data.allTime.subscriptionRevenue, data.allTime.tipsRevenue);
}

/**
 * Load monthly earnings data for chart
 */
async function loadMonthlyData(months = 12) {
    try {
        const response = await fetch(`/api/creator/earnings/monthly?months=${months}`);
        const result = await response.json();
        
        if (result.success) {
            updateRevenueChart(result.data);
        }
    } catch (error) {
        console.error('Error loading monthly data:', error);
    }
}

/**
 * Update the revenue chart
 */
function updateRevenueChart(data) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    const labels = data.map(d => d.monthLabel);
    const subscriptionData = data.map(d => d.subscriptionRevenue);
    const tipsData = data.map(d => d.tipsRevenue);
    const netData = data.map(d => d.netRevenue);
    
    if (revenueChart) {
        revenueChart.destroy();
    }
    
    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: window.earningsTranslations?.subscriptions || 'Subscriptions',
                    data: subscriptionData,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 4,
                    stack: 'stack'
                },
                {
                    label: window.earningsTranslations?.tips || 'Tips',
                    data: tipsData,
                    backgroundColor: 'rgba(139, 92, 246, 0.8)',
                    borderRadius: 4,
                    stack: 'stack'
                },
                {
                    label: window.earningsTranslations?.netEarnings || 'Net Earnings',
                    data: netData,
                    type: 'line',
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#3b82f6',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.raw.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: false,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update the breakdown pie chart
 */
function updateBreakdownChart(subscriptionRevenue, tipsRevenue) {
    const ctx = document.getElementById('breakdownChart');
    if (!ctx) return;
    
    if (breakdownChart) {
        breakdownChart.destroy();
    }
    
    const hasData = subscriptionRevenue > 0 || tipsRevenue > 0;
    
    breakdownChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                window.earningsTranslations?.subscriptions || 'Subscriptions',
                window.earningsTranslations?.tips || 'Tips'
            ],
            datasets: [{
                data: hasData ? [subscriptionRevenue, tipsRevenue] : [1, 0],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '60%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (!hasData) return 'No data yet';
                            return context.label + ': $' + context.raw.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Load subscriber statistics
 */
async function loadSubscriberStats() {
    try {
        const response = await fetch('/api/creator/earnings/subscribers');
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('activeSubscribers').textContent = result.data.activeSubscribers || 0;
            document.getElementById('newSubscribers').textContent = 
                `+${result.data.newThisMonth || 0} ${window.earningsTranslations?.thisMonth || 'this month'}`;
        }
    } catch (error) {
        console.error('Error loading subscriber stats:', error);
    }
}

/**
 * Load recent transactions
 */
async function loadRecentTransactions() {
    try {
        const response = await fetch('/api/creator/transactions?limit=5');
        const result = await response.json();
        
        const container = document.getElementById('transactionsList');
        if (!container) return;
        
        if (result.success && result.data.transactions.length > 0) {
            container.innerHTML = result.data.transactions.map(tx => `
                <div class="list-group-item transaction-item ${tx.type} border-0 py-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge ${tx.type === 'tip' ? 'tip-badge' : 'subscription-badge'} me-2">
                                ${tx.type === 'tip' ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-star-fill"></i>'}
                                ${tx.type}
                            </span>
                            <small class="text-muted">${formatDate(tx.createdAt)}</small>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-success">+$${tx.netAmount.toFixed(2)}</div>
                            <small class="text-muted">($${tx.grossAmount.toFixed(2)} - ${window.platformCommission}% fee)</small>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-1"></i>
                    <p class="mb-0 mt-2">${window.earningsTranslations?.noTransactions || 'No transactions yet'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

/**
 * Load recent tips
 */
async function loadRecentTips() {
    try {
        const response = await fetch('/api/creator/tips?limit=5');
        const result = await response.json();
        
        const container = document.getElementById('tipsList');
        if (!container) return;
        
        if (result.success && result.data.length > 0) {
            container.innerHTML = result.data.map(tip => `
                <div class="list-group-item border-0 py-3">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-purple-100 p-2 me-3" style="background: #f3e8ff;">
                            <i class="bi bi-heart-fill text-purple" style="color: #7c3aed;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="fw-semibold">${tip.tipper?.nickname || 'Anonymous'}</div>
                            ${tip.message ? `<small class="text-muted">"${tip.message}"</small>` : ''}
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-success">+$${tip.netAmount.toFixed(2)}</div>
                            <small class="text-muted">${formatDate(tip.createdAt)}</small>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-heart fs-1"></i>
                    <p class="mb-0 mt-2">${window.earningsTranslations?.noTips || 'No tips yet'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading tips:', error);
    }
}

/**
 * Load payout history
 */
async function loadPayoutHistory() {
    try {
        const response = await fetch('/api/creator/payouts/history?limit=10');
        const result = await response.json();
        
        const tbody = document.getElementById('payoutHistoryTable');
        if (!tbody) return;
        
        if (result.success && result.data.payouts.length > 0) {
            tbody.innerHTML = result.data.payouts.map(payout => `
                <tr>
                    <td>${formatDate(payout.createdAt)}</td>
                    <td class="fw-bold">$${payout.amount.toFixed(2)}</td>
                    <td>
                        <span class="badge ${getStatusBadgeClass(payout.status)}">
                            ${payout.status}
                        </span>
                    </td>
                    <td><i class="bi bi-bank"></i> Bank Transfer</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-1"></i>
                        <p class="mb-0 mt-2">${window.earningsTranslations?.noPayouts || 'No payouts yet'}</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading payout history:', error);
    }
}

/**
 * Load payout settings
 */
async function loadPayoutSettings() {
    try {
        const response = await fetch('/api/creator/payouts/settings');
        const result = await response.json();
        
        if (result.success) {
            const settings = result.data;
            document.getElementById('payoutSchedule').value = settings.payoutSchedule || 'monthly';
            document.getElementById('customMinimum').value = settings.minimumPayout || window.minimumPayout;
            document.getElementById('autoPayoutEnabled').checked = settings.autoPayoutEnabled || false;
        }
    } catch (error) {
        console.error('Error loading payout settings:', error);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Payout request buttons
    document.getElementById('requestPayoutBtn')?.addEventListener('click', openPayoutModal);
    document.getElementById('requestPayoutBtnMobile')?.addEventListener('click', openPayoutModal);
    
    // Confirm payout
    document.getElementById('confirmPayoutBtn')?.addEventListener('click', requestPayout);
    
    // Payout settings form
    document.getElementById('payoutSettingsForm')?.addEventListener('submit', savePayoutSettings);
    
    // Chart period selector
    document.getElementById('chartPeriod')?.addEventListener('change', function() {
        loadMonthlyData(parseInt(this.value));
    });
    
    // Refresh buttons
    document.getElementById('refreshPayouts')?.addEventListener('click', loadPayoutHistory);
}

/**
 * Open payout modal
 */
function openPayoutModal() {
    if (!earningsData?.canRequestPayout) {
        showToast(window.earningsTranslations?.insufficientBalance || 'Insufficient balance for payout', 'warning');
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('payoutModal'));
    const payoutAmountInput = document.getElementById('payoutAmount');
    
    if (payoutAmountInput && earningsData) {
        payoutAmountInput.max = earningsData.payouts.availableBalance;
        payoutAmountInput.value = earningsData.payouts.availableBalance;
    }
    
    modal.show();
}

/**
 * Request payout
 */
async function requestPayout() {
    const amount = parseFloat(document.getElementById('payoutAmount')?.value);
    
    if (!amount || amount < window.minimumPayout) {
        showToast(`Minimum payout is $${window.minimumPayout}`, 'error');
        return;
    }
    
    if (amount > earningsData?.payouts?.availableBalance) {
        showToast('Amount exceeds available balance', 'error');
        return;
    }
    
    const confirmBtn = document.getElementById('confirmPayoutBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
    
    try {
        const response = await fetch('/api/creator/payouts/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(window.earningsTranslations?.payoutRequested || 'Payout requested successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('payoutModal'))?.hide();
            
            // Refresh data
            await Promise.all([loadEarnings(), loadPayoutHistory()]);
        } else {
            showToast(result.error || 'Failed to request payout', 'error');
        }
    } catch (error) {
        console.error('Error requesting payout:', error);
        showToast('Failed to request payout', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="bi bi-send"></i> ${window.earningsTranslations?.confirmPayout || 'Confirm Payout'}`;
    }
}

/**
 * Save payout settings
 */
async function savePayoutSettings(e) {
    e.preventDefault();
    
    const settings = {
        payoutSchedule: document.getElementById('payoutSchedule')?.value,
        minimumPayout: parseInt(document.getElementById('customMinimum')?.value) || window.minimumPayout,
        autoPayoutEnabled: document.getElementById('autoPayoutEnabled')?.checked || false
    };
    
    try {
        const response = await fetch('/api/creator/payouts/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(window.earningsTranslations?.settingsSaved || 'Settings saved successfully!', 'success');
        } else {
            showToast(result.error || 'Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings', 'error');
    }
}

/**
 * Format date helper
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Get status badge class
 */
function getStatusBadgeClass(status) {
    switch (status) {
        case 'completed':
            return 'bg-success';
        case 'pending':
            return 'bg-warning text-dark';
        case 'processing':
            return 'bg-info';
        case 'failed':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Check if there's a global toast function
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    
    // Fallback to creating our own toast
    const toastContainer = document.querySelector('.toast-container') || createToastContainer();
    
    const toastId = 'toast-' + Date.now();
    const bgClass = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning text-dark',
        info: 'bg-info'
    }[type] || 'bg-info';
    
    const toastHtml = `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

/**
 * Create toast container
 */
function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}
