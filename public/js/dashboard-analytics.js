/**
 * Analytics Dashboard JavaScript
 * Phase 5: Content & Traffic Features
 * Handles chart rendering and data fetching
 */

const analyticsDashboard = {
  // State
  currentPeriod: 'last_30_days',
  charts: {},
  data: null,
  isCreator: window.isCreator || false,
  translations: window.analyticsTranslations || {},

  /**
   * Initialize the dashboard
   */
  async init() {
    this.bindEvents();
    await this.loadAnalytics();
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Period selector
    document.getElementById('periodSelect')?.addEventListener('change', async (e) => {
      this.currentPeriod = e.target.value;
      await this.loadAnalytics();
    });

    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('refreshBtn');
      btn.classList.add('spin');
      await this.loadAnalytics();
      setTimeout(() => btn.classList.remove('spin'), 500);
    });

    // Export button
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      this.exportAnalytics();
    });

    // Performance chart metric toggle
    document.querySelectorAll('[data-metric]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-metric]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.updatePerformanceChart(e.target.dataset.metric);
      });
    });

    // Top posts sort toggle
    document.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        await this.loadTopPosts(e.target.dataset.sort);
      });
    });
  },

  /**
   * Load all analytics data
   */
  async loadAnalytics() {
    try {
      // Show loading state
      this.showLoading();

      // Fetch dashboard analytics
      const response = await fetch(`/api/analytics/dashboard?period=${this.currentPeriod}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load analytics');
      }

      this.data = result.analytics;

      // Update UI
      this.updateStats();
      this.renderCharts();
      this.renderTopPosts();
      this.updateScheduleStats();

      if (this.isCreator) {
        this.updateCreatorStats();
        this.renderDemographics();
      }

      // Hide loading
      this.hideLoading();

    } catch (error) {
      console.error('[Analytics] Error loading analytics:', error);
      this.hideLoading();
      this.showError('Failed to load analytics data');
    }
  },

  /**
   * Update stat cards
   */
  updateStats() {
    if (!this.data) return;

    const posts = this.data.posts || {};
    
    // Animate number updates
    this.animateValue('totalViews', posts.totalViews || 0);
    this.animateValue('totalLikes', posts.totalLikes || 0);
    this.animateValue('totalPosts', posts.totalPosts || 0);
    
    document.getElementById('engagementRate').textContent = 
      (posts.engagementRate || 0) + '%';
  },

  /**
   * Update creator-specific stats
   */
  updateCreatorStats() {
    if (!this.data || !this.isCreator) return;

    const subscribers = this.data.subscribers || {};
    const revenue = this.data.revenue || {};

    this.animateValue('totalSubscribers', subscribers.totalSubscribers || 0);
    this.animateValue('newSubscribers', subscribers.newSubscribers || 0);
    
    document.getElementById('totalRevenue').textContent = 
      this.formatCurrency(revenue.totalNet || 0);
    document.getElementById('churnRate').textContent = 
      (subscribers.churnRate || 0) + '%';

    // Update change indicators
    const netGrowth = subscribers.netGrowth || 0;
    const subscribersChangeEl = document.getElementById('subscribersChange');
    if (subscribersChangeEl) {
      subscribersChangeEl.textContent = netGrowth >= 0 ? `+${netGrowth}` : netGrowth;
      subscribersChangeEl.className = `stat-change ${netGrowth >= 0 ? 'positive' : 'negative'}`;
    }
  },

  /**
   * Update schedule statistics
   */
  async updateScheduleStats() {
    try {
      const response = await fetch(`/api/analytics/schedules?period=${this.currentPeriod}`);
      const result = await response.json();

      if (result.success) {
        const metrics = result.metrics;
        document.getElementById('scheduleTotal').textContent = metrics.total || 0;
        document.getElementById('scheduleActive').textContent = metrics.active || 0;
        document.getElementById('schedulePending').textContent = metrics.pending || 0;
        document.getElementById('scheduleCompleted').textContent = metrics.completed || 0;
        document.getElementById('scheduleFailed').textContent = metrics.failed || 0;
        document.getElementById('scheduleSuccessRate').textContent = 
          (metrics.successRate || 100) + '%';
      }
    } catch (error) {
      console.error('[Analytics] Error loading schedule stats:', error);
    }
  },

  /**
   * Render all charts
   */
  renderCharts() {
    this.renderPerformanceChart();
    this.renderContentTypeChart();
    
    if (this.isCreator) {
      this.renderRevenueChart();
      this.renderSubscriberChart();
    }
  },

  /**
   * Render performance chart
   */
  renderPerformanceChart() {
    const ctx = document.getElementById('performanceChart')?.getContext('2d');
    if (!ctx) return;

    const timeline = this.data?.postsOverTime || [];

    // Destroy existing chart
    if (this.charts.performance) {
      this.charts.performance.destroy();
    }

    const labels = timeline.map(t => this.formatDate(t.date));
    const viewsData = timeline.map(t => t.views || 0);
    const likesData = timeline.map(t => t.likes || 0);
    const postsData = timeline.map(t => t.posts || 0);

    this.charts.performance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: this.translations.views || 'Views',
            data: viewsData,
            borderColor: '#6E20F4',
            backgroundColor: 'rgba(110, 32, 244, 0.1)',
            fill: true,
            tension: 0.4,
            hidden: false
          },
          {
            label: this.translations.likes || 'Likes',
            data: likesData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4,
            hidden: true
          },
          {
            label: this.translations.posts || 'Posts',
            data: postsData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            hidden: true
          }
        ]
      },
      options: this.getChartOptions()
    });
  },

  /**
   * Update performance chart based on selected metric
   */
  updatePerformanceChart(metric) {
    if (!this.charts.performance) return;

    const datasets = this.charts.performance.data.datasets;
    datasets.forEach((ds, index) => {
      if (metric === 'views') {
        ds.hidden = index !== 0;
      } else if (metric === 'likes') {
        ds.hidden = index !== 1;
      } else if (metric === 'posts') {
        ds.hidden = index !== 2;
      }
    });

    this.charts.performance.update();
  },

  /**
   * Render content type distribution chart
   */
  async renderContentTypeChart() {
    const ctx = document.getElementById('contentTypeChart')?.getContext('2d');
    if (!ctx) return;

    try {
      const response = await fetch(`/api/analytics/content-types?period=${this.currentPeriod}`);
      const result = await response.json();

      if (!result.success) return;

      const distribution = result.distribution || [];

      // Destroy existing chart
      if (this.charts.contentType) {
        this.charts.contentType.destroy();
      }

      if (distribution.length === 0) {
        // Show empty state
        return;
      }

      const labels = distribution.map(d => 
        d.type === 'image' ? (this.translations.image || 'Image') : 
        d.type === 'video' ? (this.translations.video || 'Video') : d.type
      );
      const data = distribution.map(d => d.count);
      const colors = ['#6E20F4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

      this.charts.contentType = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors.slice(0, distribution.length),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: 'rgba(255, 255, 255, 0.7)',
                padding: 15,
                font: {
                  size: 12
                }
              }
            }
          },
          cutout: '65%'
        }
      });
    } catch (error) {
      console.error('[Analytics] Error rendering content type chart:', error);
    }
  },

  /**
   * Render revenue chart (creator only)
   */
  renderRevenueChart() {
    const ctx = document.getElementById('revenueChart')?.getContext('2d');
    if (!ctx) return;

    const timeline = this.data?.revenueOverTime || [];

    // Destroy existing chart
    if (this.charts.revenue) {
      this.charts.revenue.destroy();
    }

    const labels = timeline.map(t => this.formatDate(t.date));
    const netData = timeline.map(t => t.net / 100); // Convert cents to dollars

    this.charts.revenue = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data: netData,
          backgroundColor: 'rgba(251, 191, 36, 0.6)',
          borderColor: '#fbbf24',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        ...this.getChartOptions(),
        scales: {
          ...this.getChartOptions().scales,
          y: {
            ...this.getChartOptions().scales.y,
            ticks: {
              ...this.getChartOptions().scales.y.ticks,
              callback: (value) => '$' + value
            }
          }
        }
      }
    });
  },

  /**
   * Render subscriber growth chart (creator only)
   */
  renderSubscriberChart() {
    const ctx = document.getElementById('subscriberChart')?.getContext('2d');
    if (!ctx) return;

    const growth = this.data?.subscriberGrowth || [];

    // Destroy existing chart
    if (this.charts.subscriber) {
      this.charts.subscriber.destroy();
    }

    const labels = growth.map(g => this.formatDate(g.date));
    const newSubs = growth.map(g => g.newSubscribers || 0);
    const cancellations = growth.map(g => -(g.cancellations || 0));

    this.charts.subscriber = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.translations.newSubscribers || 'New Subscribers',
            data: newSubs,
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: this.translations.cancellations || 'Cancellations',
            data: cancellations,
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        ...this.getChartOptions(),
        scales: {
          ...this.getChartOptions().scales,
          x: {
            ...this.getChartOptions().scales.x,
            stacked: true
          },
          y: {
            ...this.getChartOptions().scales.y,
            stacked: true
          }
        }
      }
    });
  },

  /**
   * Render demographics charts (creator only)
   */
  renderDemographics() {
    const demographics = this.data?.demographics;
    if (!demographics) return;

    this.renderGenderChart(demographics.byGender);
    this.renderAgeChart(demographics.byAge);
    this.renderCountriesList(demographics.byCountry);
  },

  /**
   * Render gender distribution chart
   */
  renderGenderChart(data) {
    const ctx = document.getElementById('genderChart')?.getContext('2d');
    if (!ctx || !data || data.length === 0) return;

    if (this.charts.gender) {
      this.charts.gender.destroy();
    }

    const labels = data.map(d => this.formatGender(d.gender));
    const values = data.map(d => d.count);
    const colors = {
      'male': '#3b82f6',
      'female': '#ec4899',
      'other': '#8b5cf6',
      'unknown': '#6b7280'
    };

    this.charts.gender = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: data.map(d => colors[d.gender] || colors.unknown),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgba(255, 255, 255, 0.7)',
              padding: 10,
              font: { size: 11 }
            }
          }
        }
      }
    });
  },

  /**
   * Render age distribution chart
   */
  renderAgeChart(data) {
    const ctx = document.getElementById('ageChart')?.getContext('2d');
    if (!ctx || !data || data.length === 0) return;

    if (this.charts.age) {
      this.charts.age.destroy();
    }

    const labels = data.map(d => d.range);
    const values = data.map(d => d.count);

    this.charts.age = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Users',
          data: values,
          backgroundColor: 'rgba(139, 92, 246, 0.6)',
          borderColor: '#8b5cf6',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        ...this.getChartOptions(),
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        }
      }
    });
  },

  /**
   * Render countries list
   */
  renderCountriesList(data) {
    const container = document.getElementById('countriesList');
    if (!container || !data || data.length === 0) {
      if (container) {
        container.innerHTML = `<div class="analytics-empty">
          <i class="bi bi-globe"></i>
          <p>${this.translations.noData || 'No data available'}</p>
        </div>`;
      }
      return;
    }

    const maxCount = Math.max(...data.map(d => d.count));
    
    container.innerHTML = data.map(item => `
      <div class="country-item">
        <span class="country-flag">${this.getCountryFlag(item.country)}</span>
        <div class="country-info">
          <div class="country-name">${item.country}</div>
          <div class="country-bar">
            <div class="country-bar-fill" style="width: ${(item.count / maxCount * 100)}%"></div>
          </div>
        </div>
        <span class="country-count">${item.count}</span>
      </div>
    `).join('');
  },

  /**
   * Render top performing posts
   */
  async renderTopPosts() {
    await this.loadTopPosts('views');
  },

  /**
   * Load top posts with specific sort
   */
  async loadTopPosts(sortBy = 'views') {
    const grid = document.getElementById('topPostsGrid');
    const loading = document.getElementById('topPostsLoading');
    const empty = document.getElementById('noTopPosts');

    if (!grid) return;

    grid.style.display = 'none';
    loading.style.display = 'block';
    empty.style.display = 'none';

    try {
      const response = await fetch(
        `/api/analytics/posts/top?period=${this.currentPeriod}&sortBy=${sortBy}&limit=6`
      );
      const result = await response.json();

      loading.style.display = 'none';

      if (!result.success || !result.posts || result.posts.length === 0) {
        empty.style.display = 'block';
        return;
      }

      grid.style.display = 'grid';
      grid.innerHTML = result.posts.map((post, index) => this.renderPostCard(post, index + 1)).join('');

    } catch (error) {
      console.error('[Analytics] Error loading top posts:', error);
      loading.style.display = 'none';
      empty.style.display = 'block';
    }
  },

  /**
   * Render a single post card
   */
  renderPostCard(post, rank) {
    const thumbnail = post.content?.thumbnailUrl || post.content?.imageUrl || '/img/placeholder.png';
    const type = post.type || 'image';
    const views = post.views || 0;
    const likes = post.likes || 0;
    const comments = post.comments || 0;
    const date = this.formatDate(post.createdAt);

    return `
      <div class="top-post-card" onclick="window.location='/dashboard/posts?id=${post._id}'">
        <div class="top-post-thumbnail">
          <span class="top-post-rank">${rank}</span>
          <span class="top-post-type">${type}</span>
          <img src="${thumbnail}" alt="Post thumbnail" loading="lazy" onerror="this.src='/img/placeholder.png'">
        </div>
        <div class="top-post-info">
          <div class="top-post-stats">
            <span class="top-post-stat views">
              <i class="bi bi-eye"></i> ${this.formatNumber(views)}
            </span>
            <span class="top-post-stat likes">
              <i class="bi bi-heart"></i> ${this.formatNumber(likes)}
            </span>
            <span class="top-post-stat comments">
              <i class="bi bi-chat"></i> ${comments}
            </span>
          </div>
          <div class="top-post-date">${date}</div>
        </div>
      </div>
    `;
  },

  /**
   * Get common chart options
   */
  getChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 46, 0.95)',
          titleColor: '#fff',
          bodyColor: 'rgba(255, 255, 255, 0.8)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: { size: 11 }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: { size: 11 }
          },
          beginAtZero: true
        }
      }
    };
  },

  /**
   * Export analytics data
   */
  exportAnalytics() {
    if (!this.data) {
      alert('No data to export');
      return;
    }

    const exportData = {
      period: this.currentPeriod,
      generatedAt: new Date().toISOString(),
      posts: this.data.posts,
      subscribers: this.data.subscribers,
      revenue: this.data.revenue,
      followers: this.data.followers
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${this.currentPeriod}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Helper: Animate number value
   */
  animateValue(elementId, endValue, duration = 1000) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = parseInt(element.textContent.replace(/[^0-9]/g, '')) || 0;
    const increment = (endValue - startValue) / (duration / 16);
    let currentValue = startValue;

    const animate = () => {
      currentValue += increment;
      if ((increment > 0 && currentValue >= endValue) || (increment < 0 && currentValue <= endValue)) {
        element.textContent = this.formatNumber(endValue);
      } else {
        element.textContent = this.formatNumber(Math.round(currentValue));
        requestAnimationFrame(animate);
      }
    };

    if (startValue !== endValue) {
      animate();
    } else {
      element.textContent = this.formatNumber(endValue);
    }
  },

  /**
   * Helper: Format number with K/M suffix
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },

  /**
   * Helper: Format currency
   */
  formatCurrency(cents) {
    return '$' + (cents / 100).toFixed(2);
  },

  /**
   * Helper: Format date
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  },

  /**
   * Helper: Format gender label
   */
  formatGender(gender) {
    const labels = {
      'male': 'Male',
      'female': 'Female',
      'other': 'Other',
      'unknown': 'Unknown'
    };
    return labels[gender] || gender;
  },

  /**
   * Helper: Get country flag emoji
   */
  getCountryFlag(country) {
    const flags = {
      'US': '🇺🇸', 'USA': '🇺🇸', 'United States': '🇺🇸',
      'JP': '🇯🇵', 'Japan': '🇯🇵',
      'GB': '🇬🇧', 'UK': '🇬🇧', 'United Kingdom': '🇬🇧',
      'DE': '🇩🇪', 'Germany': '🇩🇪',
      'FR': '🇫🇷', 'France': '🇫🇷',
      'CA': '🇨🇦', 'Canada': '🇨🇦',
      'AU': '🇦🇺', 'Australia': '🇦🇺',
      'BR': '🇧🇷', 'Brazil': '🇧🇷',
      'IN': '🇮🇳', 'India': '🇮🇳',
      'CN': '🇨🇳', 'China': '🇨🇳',
      'KR': '🇰🇷', 'South Korea': '🇰🇷',
      'unknown': '🌍'
    };
    return flags[country] || '🌍';
  },

  /**
   * Show loading state
   */
  showLoading() {
    document.querySelectorAll('.stat-content h3').forEach(el => {
      el.classList.add('chart-loading');
    });
  },

  /**
   * Hide loading state
   */
  hideLoading() {
    document.querySelectorAll('.stat-content h3').forEach(el => {
      el.classList.remove('chart-loading');
    });
  },

  /**
   * Show error message
   */
  showError(message) {
    if (typeof showNotification === 'function') {
      showNotification(message, 'error');
    } else {
      console.error(message);
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  analyticsDashboard.init();
});

// Add spin animation style
const style = document.createElement('style');
style.textContent = `
  .spin {
    animation: spin 0.5s ease;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
