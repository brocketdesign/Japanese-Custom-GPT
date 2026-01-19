class AffiliateManager {
    constructor() {
        this.currentLinkData = null;
        this.translations = window.affiliationTranslations || {};
        this.loadingStates = new Set(); // Track active loading states
        this.init();
    }

    init() {
        this.loadDashboard();
        this.loadReferrals(); // Add this line to automatically load referrals
        this.bindEvents();
    }

    bindEvents() {
        // Generate new slug button
        document.getElementById('generateSlugBtn')?.addEventListener('click', () => {
            this.generateNewSlug();
        });

        // Save affiliate link button
        document.getElementById('saveAffiliateBtn')?.addEventListener('click', () => {
            this.saveAffiliateLink();
        });

        // Copy link button
        document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
            this.copyAffiliateLink();
        });

        // Load referrals button
        document.getElementById('loadReferralsBtn')?.addEventListener('click', () => {
            this.loadReferrals();
        });
    }

    async loadDashboard() {
        console.log('[AffiliateManager] Starting dashboard load...');
        try {
            // Don't show loading for dashboardContent initially, let the page load first
            console.log('[AffiliateManager] Fetching dashboard data...');
            
            const response = await fetch('/api/affiliate/dashboard');
            console.log('[AffiliateManager] Dashboard API response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('[AffiliateManager] Dashboard API result:', result);
            
            if (result.success) {
                this.currentLinkData = result.data.link;
                this.updateDashboard(result.data);
                console.log('[AffiliateManager] Dashboard updated successfully');
            } else {
                console.error('[AffiliateManager] Dashboard API returned error:', result);
                this.showError(this.translations.failedToLoadDashboard || 'Failed to load dashboard data');
            }
        } catch (error) {
            console.error('[AffiliateManager] Error loading dashboard:', error);
            if (error.message.includes('401') || error.message.includes('403')) {
                this.showError('Please log in to access the affiliate dashboard');
                // Redirect to login after a short delay
                setTimeout(() => {
                    window.location.href = '/auth/signin';
                }, 2000);
            } else {
                this.showError(this.translations.failedToLoadDashboard || 'Failed to load dashboard data');
            }
        }
    }

    updateDashboard(data) {
        // Update affiliate link section
        const slugInput = document.getElementById('affiliateSlug');
        const linkInput = document.getElementById('affiliateLink');
        const linkStatus = document.getElementById('linkStatus');
        
        if (slugInput && linkInput && linkStatus) {
            if (data.link) {
                slugInput.value = data.link.slug;
                linkInput.value = data.link.link;
                linkStatus.innerHTML = `
                    <span class="badge bg-success">
                        <i class="bi bi-check-circle"></i> Active
                    </span>
                    <small class="text-muted ms-2">Created: ${new Date(data.link.createdAt).toLocaleDateString()}</small>
                `;
            } else {
                slugInput.value = '';
                linkInput.value = 'No affiliate link generated yet';
                linkStatus.innerHTML = `
                    <span class="badge bg-warning">
                        <i class="bi bi-exclamation-circle"></i> Not Created
                    </span>
                `;
            }
        }

        // Update stats with null checks
        const stats = data.stats;
        const statElements = {
            totalClicks: document.getElementById('totalClicks'),
            totalConversions: document.getElementById('totalConversions'),
            totalReferrals: document.getElementById('totalReferrals'),
            activeReferrals: document.getElementById('activeReferrals'),
            estimatedEarnings: document.getElementById('estimatedEarnings'),
            conversionRate: document.getElementById('conversionRate')
        };

        if (statElements.totalClicks) statElements.totalClicks.textContent = stats.clicks;
        if (statElements.totalConversions) statElements.totalConversions.textContent = stats.conversions;
        if (statElements.totalReferrals) statElements.totalReferrals.textContent = stats.totalReferrals;
        if (statElements.activeReferrals) statElements.activeReferrals.textContent = stats.activeReferrals;
        if (statElements.estimatedEarnings) statElements.estimatedEarnings.textContent = `$${stats.earnings}`;
        if (statElements.conversionRate) statElements.conversionRate.textContent = `${stats.conversionRate}%`;

        // Update progress bars
        this.updateProgressBar('clicksProgress', stats.clicks, 100);
        this.updateProgressBar('conversionProgress', stats.conversionRate, 100);
    }

    updateProgressBar(elementId, value, max) {
        const progressBar = document.getElementById(elementId);
        if (progressBar) {
            const percentage = Math.min((value / max) * 100, 100);
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', value);
        }
    }

    async generateNewSlug() {
        console.log('[AffiliateManager] Starting slug generation...');
        try {
            this.showLoading('generateSlugBtn');
            console.log('[AffiliateManager] Loading state set for generateSlugBtn');
            
            const response = await fetch('/api/affiliate/generate-slug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('[AffiliateManager] Generate slug API response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[AffiliateManager] Generate slug API result:', result);
            
            if (result.success) {
                const slugInput = document.getElementById('affiliateSlug');
                if (slugInput) {
                    slugInput.value = result.slug;
                    console.log('[AffiliateManager] Slug input updated with:', result.slug);
                }
                this.showSuccess(this.translations.slugGeneratedSuccess || 'New slug generated successfully!');
            } else {
                console.error('[AffiliateManager] Generate slug API returned error:', result);
                this.showError(this.translations.failedToGenerateSlug || 'Failed to generate new slug');
            }
        } catch (error) {
            console.error('[AffiliateManager] Error generating slug:', error);
            this.showError(this.translations.failedToGenerateSlug || 'Failed to generate new slug');
        } finally {
            console.log('[AffiliateManager] Hiding loading state for generateSlugBtn');
            this.hideLoading('generateSlugBtn');
        }
    }

    async saveAffiliateLink() {
        const subscriptionStatus = user.subscriptionStatus == 'active'
        console.log(`subscriptionStatus: ${subscriptionStatus}`);
        if (!subscriptionStatus) {
            // Use the same Premium modal as navigation dashboard
            if (typeof loadPlanPage === 'function') {
                loadPlanPage();
            } else {
                this.showError(this.translations.premiumRequired || 'Premium subscription required');
            }
            return;
        }
        console.log('[AffiliateManager] Starting affiliate link save...');
        const slugInput = document.getElementById('affiliateSlug');
        if (!slugInput) {
            console.error('[AffiliateManager] Slug input element not found');
            this.showError(this.translations.enterSlug || 'Please enter a slug');
            return;
        }
        
        const slug = slugInput.value.trim();
        console.log('[AffiliateManager] Attempting to save slug:', slug);
        
        if (!slug) {
            console.error('[AffiliateManager] Empty slug provided');
            this.showError(this.translations.enterSlug || 'Please enter a slug');
            return;
        }

        // Validate slug format
        if (!/^[A-Za-z0-9]{4,12}$/.test(slug)) {
            console.error('[AffiliateManager] Invalid slug format:', slug);
            this.showError(this.translations.slugFormatError || 'Slug must be 4-12 characters and contain only letters and numbers');
            return;
        }

        try {
            this.showLoading('saveAffiliateBtn');
            console.log('[AffiliateManager] Loading state set for saveAffiliateBtn');
            
            const response = await fetch('/api/affiliate/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customSlug: slug })
            });
            
            console.log('[AffiliateManager] Save affiliate API response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[AffiliateManager] Save affiliate API result:', result);
            
            if (result.success) {
                this.currentLinkData = result.data;
                const linkInput = document.getElementById('affiliateLink');
                const linkStatus = document.getElementById('linkStatus');
                
                if (linkInput) {
                    linkInput.value = result.data.link;
                    console.log('[AffiliateManager] Link input updated with:', result.data.link);
                }
                if (linkStatus) {
                    linkStatus.innerHTML = `
                        <span class="badge bg-success">
                            <i class="bi bi-check-circle"></i> ${this.translations.linkStatusActive || 'Active'}
                        </span>
                        <small class="text-muted ms-2">${this.translations.justCreated || 'Just created'}</small>
                    `;
                    console.log('[AffiliateManager] Link status updated');
                }
                this.showSuccess(this.translations.affiliateLinkSavedSuccess || 'Affiliate link saved successfully!');
                
                // Refresh stats without showing loading spinner on dashboard
                setTimeout(() => {
                    console.log('[AffiliateManager] Refreshing dashboard stats after save...');
                    this.refreshDashboardStats();
                }, 1000);
            } else {
                console.error('[AffiliateManager] Save affiliate API returned error:', result);
                this.showError(result.error || this.translations.failedToSaveLink || 'Failed to save affiliate link');
            }
        } catch (error) {
            console.error('[AffiliateManager] Error saving affiliate link:', error);
            this.showError(this.translations.failedToSaveLink || 'Failed to save affiliate link');
        } finally {
            console.log('[AffiliateManager] Hiding loading state for saveAffiliateBtn');
            this.hideLoading('saveAffiliateBtn');
        }
    }

    async copyAffiliateLink() {
        const linkInput = document.getElementById('affiliateLink');
        
        if (!linkInput || !linkInput.value || linkInput.value === (this.translations.noLinkGenerated || 'No affiliate link generated yet')) {
            this.showError(this.translations.noLinkToCopy || 'No affiliate link to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(linkInput.value);
            
            // Update button temporarily
            const btn = document.getElementById('copyLinkBtn');
            if (btn) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check-circle text-success"></i> ' + (this.translations.copied || 'Copied!');
                btn.disabled = true;
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                }, 2000);
            }
            
            this.showSuccess(this.translations.linkCopiedSuccess || 'Link copied to clipboard!');
        } catch (error) {
            console.error('Error copying link:', error);
            this.showError(this.translations.failedToCopyLink || 'Failed to copy link');
        }
    }

    async loadReferrals(page = 1) {
        console.log('[AffiliateManager] Starting referrals load, page:', page);
        try {
            this.showLoading('referralsList');
            console.log('[AffiliateManager] Loading state set for referralsList');
            
            const response = await fetch(`/api/affiliate/referrals?page=${page}&limit=10`);
            console.log('[AffiliateManager] Referrals API response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[AffiliateManager] Referrals API result:', result);
            
            if (result.success) {
                this.updateReferralsList(result.data);
                console.log('[AffiliateManager] Referrals list updated successfully');
            } else {
                console.error('[AffiliateManager] Referrals API returned error:', result);
                this.showError(this.translations.failedToLoadReferrals || 'Failed to load referrals');
            }
        } catch (error) {
            console.error('[AffiliateManager] Error loading referrals:', error);
            this.showError(this.translations.failedToLoadReferrals || 'Failed to load referrals');
        } finally {
            console.log('[AffiliateManager] Hiding loading state for referralsList');
            this.hideLoading('referralsList');
        }
    }

    updateReferralsList(data) {
        const container = document.getElementById('referralsList');
        if (!container) return;
        
        if (data.referrals.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-person-plus display-4 text-muted"></i>
                    <p class="text-muted mt-2">${this.translations.noReferralsTitle || 'No referrals yet. Share your link to get started!'}</p>
                </div>
            `;
            return;
        }

        const referralsHTML = data.referrals.map(referral => `
            <div class="referral-item border rounded p-3 mb-2">
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle me-2">
                                ${referral.nickname.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="fw-bold">${referral.nickname}</div>
                                <small class="text-muted">${referral.email}</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <span class="badge ${referral.subscriptionStatus === 'active' ? 'bg-success' : 'bg-secondary'}">
                            <i class="bi bi-${referral.subscriptionStatus === 'active' ? 'star-fill' : 'person'}"></i>
                            ${referral.subscriptionStatus === 'active' ? (this.translations.premium || 'Premium') : (this.translations.free || 'Free')}
                        </span>
                    </div>
                    <div class="col-md-3">
                        <small class="text-muted">
                            <i class="bi bi-calendar3"></i>
                            ${new Date(referral.createdAt).toLocaleDateString()}
                        </small>
                    </div>
                    <div class="col-md-2">
                        ${referral.subscriptionStatus === 'active' ? 
                            '<span class="text-success fw-bold">$5.00</span>' : 
                            '<span class="text-muted">$0.00</span>'
                        }
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = referralsHTML;

        // Add pagination if needed
        if (data.pagination.total > 1) {
            this.addPagination(data.pagination);
        }
    }

    addPagination(pagination) {
        const paginationHTML = `
            <nav aria-label="Referrals pagination" class="mt-3">
                <ul class="pagination justify-content-center">
                    ${pagination.hasPrev ? 
                        `<li class="page-item">
                            <a class="page-link" href="#" onclick="affiliateManager.loadReferrals(${pagination.current - 1})">Previous</a>
                        </li>` : ''
                    }
                    <li class="page-item active">
                        <span class="page-link">${pagination.current} of ${pagination.total}</span>
                    </li>
                    ${pagination.hasNext ? 
                        `<li class="page-item">
                            <a class="page-link" href="#" onclick="affiliateManager.loadReferrals(${pagination.current + 1})">Next</a>
                        </li>` : ''
                    }
                </ul>
            </nav>
        `;
        
        const referralsList = document.getElementById('referralsList');
        if (referralsList) {
            referralsList.insertAdjacentHTML('afterend', paginationHTML);
        }
    }

    showLoading(elementId) {
        console.log('[AffiliateManager] showLoading called for:', elementId);
        this.loadingStates.add(elementId);
        const element = document.getElementById(elementId);
        if (!element) {
            console.error('[AffiliateManager] Element not found for loading:', elementId);
            return;
        }
        
        if (elementId.includes('Btn')) {
            console.log('[AffiliateManager] Setting button loading state for:', elementId);
            element.disabled = true;
            element.dataset.originalHtml = element.innerHTML; // Store original HTML
            element.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + (this.translations.loading || 'Loading...');
        } else if (elementId === 'referralsList') {
            console.log('[AffiliateManager] Setting referrals list loading state');
            element.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">${this.translations.loading || 'Loading...'}</span>
                    </div>
                </div>
            `;
        } else {
            console.log('[AffiliateManager] Setting container loading state for:', elementId);
            // For dashboardContent, don't replace the entire content, just show a loading overlay
            if (elementId === 'dashboardContent') {
                // Don't replace dashboard content, it should remain visible
                console.log('[AffiliateManager] Skipping loading state for dashboardContent to prevent content replacement');
                return;
            }
            element.dataset.originalHtml = element.innerHTML; // Store original HTML
            element.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">${this.translations.loading || 'Loading...'}</span>
                    </div>
                </div>
            `;
        }
    }

    hideLoading(elementId) {
        console.log('[AffiliateManager] hideLoading called for:', elementId);
        this.loadingStates.delete(elementId);
        const element = document.getElementById(elementId);
        if (!element) {
            console.error('[AffiliateManager] Element not found for hiding loading:', elementId);
            return;
        }

        if (elementId.includes('Btn')) {
            console.log('[AffiliateManager] Restoring button state for:', elementId);
            element.disabled = false;
            
            // Restore specific button content
            if (elementId === 'saveAffiliateBtn') {
                element.innerHTML = '<i class="bi bi-save"></i> ' + (this.translations.saveLink || 'Save Link');
            } else if (elementId === 'generateSlugBtn') {
                element.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
            } else if (elementId === 'loadReferralsBtn') {
                element.innerHTML = '<i class="bi bi-arrow-clockwise"></i> ' + (this.translations.refresh || 'Refresh');
            } else if (elementId === 'copyLinkBtn') {
                element.innerHTML = '<i class="bi bi-clipboard"></i> ' + (this.translations.copyLink || 'Copy Link');
            } else if (element.dataset.originalHtml) {
                // Fallback to stored original HTML
                element.innerHTML = element.dataset.originalHtml;
                delete element.dataset.originalHtml;
            }
        } else if (elementId === 'dashboardContent') {
            console.log('[AffiliateManager] Dashboard content loading cleared - content managed by updateDashboard');
            // Don't modify dashboardContent - it's managed by updateDashboard
        } else if (elementId === 'referralsList') {
            console.log('[AffiliateManager] Referrals list loading cleared - content should be updated by updateReferralsList');
            // Don't restore original content for referrals list - let updateReferralsList handle it
        } else {
            console.log('[AffiliateManager] Restoring container original content for:', elementId);
            // For other containers, restore original content if available
            if (element.dataset.originalHtml) {
                element.innerHTML = element.dataset.originalHtml;
                delete element.dataset.originalHtml;
            } else {
                // Remove loading spinner if no original content stored
                const spinner = element.querySelector('.spinner-border');
                if (spinner && spinner.parentElement) {
                    spinner.parentElement.remove();
                }
            }
        }
        
        console.log('[AffiliateManager] Loading state cleared for:', elementId, 'Active loading states:', Array.from(this.loadingStates));
    }

    async refreshDashboardStats() {
        console.log('[AffiliateManager] Refreshing dashboard stats only...');
        try {
            const response = await fetch('/api/affiliate/dashboard');
            console.log('[AffiliateManager] Stats refresh API response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('[AffiliateManager] Stats refresh API result:', result);
            
            if (result.success) {
                // Only update stats, don't touch the link section
                this.updateDashboardStats(result.data.stats);
                console.log('[AffiliateManager] Dashboard stats refreshed successfully');
            }
        } catch (error) {
            console.error('[AffiliateManager] Error refreshing stats:', error);
            // Don't show error for background refresh
        }
    }

    updateDashboardStats(stats) {
        console.log('[AffiliateManager] Updating dashboard stats only:', stats);
        
        const statElements = {
            totalClicks: document.getElementById('totalClicks'),
            totalConversions: document.getElementById('totalConversions'),
            totalReferrals: document.getElementById('totalReferrals'),
            activeReferrals: document.getElementById('activeReferrals'),
            estimatedEarnings: document.getElementById('estimatedEarnings'),
            conversionRate: document.getElementById('conversionRate')
        };

        if (statElements.totalClicks) statElements.totalClicks.textContent = stats.clicks;
        if (statElements.totalConversions) statElements.totalConversions.textContent = stats.conversions;
        if (statElements.totalReferrals) statElements.totalReferrals.textContent = stats.totalReferrals;
        if (statElements.activeReferrals) statElements.activeReferrals.textContent = stats.activeReferrals;
        if (statElements.estimatedEarnings) statElements.estimatedEarnings.textContent = `$${stats.earnings}`;
        if (statElements.conversionRate) statElements.conversionRate.textContent = `${stats.conversionRate}%`;

        // Update progress bars
        this.updateProgressBar('clicksProgress', stats.clicks, 100);
        this.updateProgressBar('conversionProgress', stats.conversionRate, 100);
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'danger');
    }

    showToast(message, type) {
        const toastContainer = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toastId = 'toast-' + Date.now();
        const toastHTML = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="bi bi-${type === 'success' ? 'check-circle-fill text-success' : 'exclamation-triangle-fill text-danger'} me-2"></i>
                    <strong class="me-auto">${type === 'success' ? 'Success' : 'Error'}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        
        // Remove toast element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.affiliateManager = new AffiliateManager();
});
