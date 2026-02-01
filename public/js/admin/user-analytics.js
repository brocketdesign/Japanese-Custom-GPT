let userGrowthChart, genderChart, nationalityChart, contentTrendsChart;
let userLocationChart, chatStartSourcesChart, behaviorTrendsChart;

// Initialize dashboard
$(document).ready(function() {
    loadAnalyticsData();
    loadBehaviorTrackingData();
    
    $('#refreshData').on('click', function() {
        $(this).html('<span class="spinner-border spinner-border-sm me-2"></span>Refreshing...');
        loadAnalyticsData();
        loadBehaviorTrackingData();
    });
});

// Load all analytics data
async function loadAnalyticsData() {
    try {
        const response = await fetch('/admin/api/analytics/dashboard');
        const data = await response.json();
        
        if (data.success) {
            updateStatCards(data.stats);
            renderCharts(data);
            updateAdditionalStats(data.stats);
            
            $('#lastUpdated').text(new Date(data.lastUpdated).toLocaleString('ja-JP'));
            $('#loadingSpinner').hide();
            $('#dashboardContent').fadeIn();
            $('#refreshData').html('<i class="bi bi-arrow-clockwise me-2"></i>Refresh');
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
        $('#loadingSpinner').html('<div class="alert alert-danger">Failed to load analytics data</div>');
    }
}

// Update stat cards
function updateStatCards(stats) {
    // Total Users
    animateValue('totalUsers', 0, stats.totalUsers, 1000);
    updateChangeIndicator('userChange', stats.userGrowth);
    
    // Total Images
    animateValue('totalImages', 0, stats.totalImages, 1000);
    updateChangeIndicator('imageChange', stats.imageGrowth);
    
    // Total Messages
    animateValue('totalMessages', 0, stats.totalMessages, 1000);
    updateChangeIndicator('messageChange', stats.messageGrowth);
    
    // Average Messages
    animateValue('avgMessages', 0, stats.avgMessagesPerUser, 1000, 1);
}

// Update additional stats
function updateAdditionalStats(stats) {
    // Premium Users
    $('#premiumUsers').text(stats.premiumUsers);
    const premiumPercentage = ((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1);
    $('#premiumPercentage').text(premiumPercentage + '%');
    $('#premiumProgress').css('width', premiumPercentage + '%');
    
    // Total Likes
    $('#totalLikes').text(stats.totalLikes.toLocaleString());
    $('#likesPerUser').text((stats.totalLikes / stats.totalUsers).toFixed(1) + '/user');
    
    // Average Images Per User
    $('#avgImagesPerUser').text((stats.totalImages / stats.totalUsers).toFixed(1));
    $('#activeGenerators').text(stats.activeImageGenerators + ' active');
}

// Render all charts
function renderCharts(data) {
    renderUserGrowthChart(data.userGrowth);
    renderGenderChart(data.genderDistribution);
    renderNationalityChart(data.nationalityDistribution);
    renderContentTrendsChart(data.contentTrends);
}

// User Growth Chart
function renderUserGrowthChart(growthData) {
    const ctx = document.getElementById('userGrowthChart').getContext('2d');
    
    if (userGrowthChart) {
        userGrowthChart.destroy();
    }
    
    userGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: growthData.labels,
            datasets: [{
                label: 'New Users',
                data: growthData.values,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Gender Distribution Chart
function renderGenderChart(genderData) {
    const ctx = document.getElementById('genderChart').getContext('2d');
    
    if (genderChart) {
        genderChart.destroy();
    }
    
    genderChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: genderData.labels,
            datasets: [{
                data: genderData.values,
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(245, 87, 108, 0.8)',
                    'rgba(158, 158, 158, 0.8)'
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: { size: 12, weight: '600' },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Nationality Distribution Chart
function renderNationalityChart(nationalityData) {
    const ctx = document.getElementById('nationalityChart').getContext('2d');
    
    if (nationalityChart) {
        nationalityChart.destroy();
    }
    
    nationalityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nationalityData.labels,
            datasets: [{
                label: 'Users',
                data: nationalityData.values,
                backgroundColor: 'rgba(79, 172, 254, 0.8)',
                borderColor: 'rgba(79, 172, 254, 1)',
                borderWidth: 2,
                borderRadius: 8,
                hoverBackgroundColor: 'rgba(79, 172, 254, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Content Trends Chart
function renderContentTrendsChart(trendsData) {
    const ctx = document.getElementById('contentTrendsChart').getContext('2d');
    
    if (contentTrendsChart) {
        contentTrendsChart.destroy();
    }
    
    contentTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendsData.labels,
            datasets: [
                {
                    label: 'Images',
                    data: trendsData.images,
                    borderColor: '#f5576c',
                    backgroundColor: 'rgba(245, 87, 108, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Messages',
                    data: trendsData.messages,
                    borderColor: '#ffa726',
                    backgroundColor: 'rgba(255, 167, 38, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: { size: 12, weight: '600' },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Update change indicator
function updateChangeIndicator(elementId, changePercent) {
    const element = $(`#${elementId}`);
    const isPositive = changePercent >= 0;
    const icon = isPositive ? 'bi-arrow-up' : 'bi-arrow-down';
    const color = isPositive ? 'inherit' : 'opacity-75';
    
    element.html(`
        <i class="bi ${icon}"></i> 
        <span>${Math.abs(changePercent).toFixed(1)}%</span> from last week
    `).addClass(color);
}

// Animate number counting
function animateValue(id, start, end, duration, decimals = 0) {
    const obj = document.getElementById(id);
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(function() {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        obj.textContent = current.toFixed(decimals).toLocaleString();
    }, 16);
}

// ============================================
// User Behavior Tracking Functions
// ============================================

// Load behavior tracking data
async function loadBehaviorTrackingData() {
    try {
        // Load aggregate stats
        const statsResponse = await fetch('/api/tracking/admin/stats');
        const statsData = await statsResponse.json();
        
        if (statsData) {
            updateBehaviorStats(statsData);
            renderUserLocationChart(statsData.locations);
            renderChatStartSourcesChart(statsData.startChatSources);
        }
        
        // Load trends data
        const trendsResponse = await fetch('/api/tracking/admin/trends?days=7');
        const trendsData = await trendsResponse.json();
        
        if (trendsData && trendsData.length > 0) {
            renderBehaviorTrendsChart(trendsData);
        }
    } catch (error) {
        console.error('Error loading behavior tracking data:', error);
    }
}

// Update behavior tracking stat cards
function updateBehaviorStats(data) {
    if (!data || !data.events) return;
    
    // Chat Sessions Started
    $('#totalChatStarts').text(data.events.startChat?.count?.toLocaleString() || '0');
    $('#uniqueChatStartUsers').text((data.events.startChat?.uniqueUsers || 0) + ' users');
    
    // Messages Sent (Tracked)
    $('#totalTrackedMessages').text(data.events.messageSent?.count?.toLocaleString() || '0');
    $('#uniqueMessageUsers').text((data.events.messageSent?.uniqueUsers || 0) + ' users');
    
    // Premium Modal Views
    $('#totalPremiumViews').text(data.events.premiumView?.count?.toLocaleString() || '0');
    $('#uniquePremiumViewUsers').text((data.events.premiumView?.uniqueUsers || 0) + ' users');
}

// User Location Chart
function renderUserLocationChart(locationData) {
    const ctx = document.getElementById('userLocationChart');
    if (!ctx) return;
    
    if (userLocationChart) {
        userLocationChart.destroy();
    }
    
    const countries = locationData?.byCountry || [];
    const labels = countries.map(c => c.country);
    const values = countries.map(c => c.count);
    
    userLocationChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels.slice(0, 10),
            datasets: [{
                label: 'Users',
                data: values.slice(0, 10),
                backgroundColor: 'rgba(76, 175, 80, 0.7)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Chat Start Sources Chart
function renderChatStartSourcesChart(sourcesData) {
    const ctx = document.getElementById('chatStartSourcesChart');
    if (!ctx) return;
    
    if (chatStartSourcesChart) {
        chatStartSourcesChart.destroy();
    }
    
    const sources = sourcesData || [];
    const labels = sources.map(s => formatSourceLabel(s.source));
    const values = sources.map(s => s.count);
    
    const colors = [
        'rgba(102, 126, 234, 0.7)',
        'rgba(245, 87, 108, 0.7)',
        'rgba(76, 175, 80, 0.7)',
        'rgba(255, 167, 38, 0.7)',
        'rgba(156, 39, 176, 0.7)',
        'rgba(0, 188, 212, 0.7)',
        'rgba(255, 82, 82, 0.7)',
        'rgba(139, 195, 74, 0.7)'
    ];
    
    chatStartSourcesChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, values.length),
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: { size: 11, weight: '600' },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Behavior Trends Chart
function renderBehaviorTrendsChart(trendsData) {
    const ctx = document.getElementById('behaviorTrendsChart');
    if (!ctx) return;
    
    if (behaviorTrendsChart) {
        behaviorTrendsChart.destroy();
    }
    
    const labels = trendsData.map(t => t.date);
    const startChatData = trendsData.map(t => t.startChat);
    const messageSentData = trendsData.map(t => t.messageSent);
    const premiumViewData = trendsData.map(t => t.premiumView);
    
    behaviorTrendsChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Chat Sessions',
                    data: startChatData,
                    borderColor: 'rgba(76, 175, 80, 1)',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgba(76, 175, 80, 1)'
                },
                {
                    label: 'Messages Sent',
                    data: messageSentData,
                    borderColor: 'rgba(33, 150, 243, 1)',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgba(33, 150, 243, 1)'
                },
                {
                    label: 'Premium Views',
                    data: premiumViewData,
                    borderColor: 'rgba(156, 39, 176, 1)',
                    backgroundColor: 'rgba(156, 39, 176, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgba(156, 39, 176, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: { size: 12, weight: '600' },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Format source label for display
function formatSourceLabel(source) {
    if (!source) return 'Unknown';
    return source
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}