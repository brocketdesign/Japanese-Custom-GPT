/**
 * Subscriptions & Tiers JavaScript
 * Handles tier management and subscription functionality
 */

// ===== Tiers Dashboard =====
const TiersDashboard = {
    tiers: [],
    templates: [],
    
    async init() {
        await this.loadStats();
        await this.loadTiers();
        await this.loadTemplates();
        this.setupEventListeners();
    },
    
    async loadStats() {
        try {
            const response = await fetch('/api/subscriptions/stats');
            const data = await response.json();
            
            if (data.success && data.stats) {
                document.getElementById('totalSubscribers').textContent = data.stats.totalSubscribers || 0;
                document.getElementById('paidSubscribers').textContent = data.stats.paidSubscribers || 0;
                document.getElementById('freeSubscribers').textContent = data.stats.freeSubscribers || 0;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    },
    
    async loadTiers() {
        try {
            const response = await fetch('/api/tiers/my?includeInactive=true');
            const data = await response.json();
            
            if (data.success) {
                this.tiers = data.tiers || [];
                this.renderTiers();
                document.getElementById('totalTiers').textContent = this.tiers.filter(t => t.isActive).length;
            }
        } catch (error) {
            console.error('Error loading tiers:', error);
            this.showError('Failed to load tiers');
        }
    },
    
    async loadTemplates() {
        try {
            const response = await fetch('/api/tiers/templates');
            const data = await response.json();
            
            if (data.success) {
                this.templates = data.templates || [];
                this.renderTemplates();
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    },
    
    renderTiers() {
        const container = document.getElementById('tiersContainer');
        const emptyState = document.getElementById('emptyState');
        
        if (!this.tiers || this.tiers.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        container.innerHTML = this.tiers.map((tier, index) => `
            <div class="col-md-6 col-lg-4 mb-4" data-tier-id="${tier._id}">
                <div class="tier-card ${tier.isFree ? 'free-tier' : ''} ${!tier.isActive ? 'opacity-50' : ''}" 
                     draggable="true">
                    <div class="tier-header">
                        <h3 class="tier-name">${this.escapeHtml(tier.name)}</h3>
                        <span class="tier-badge ${tier.isFree ? 'free' : 'paid'} ${!tier.isActive ? 'inactive' : ''}">
                            ${!tier.isActive ? 'Inactive' : (tier.isFree ? 'Free' : 'Paid')}
                        </span>
                    </div>
                    <div class="tier-price">
                        ${tier.isFree ? `
                            <span class="amount">Free</span>
                        ` : `
                            <span class="currency">${this.getCurrencySymbol(tier.currency)}</span>
                            <span class="amount">${this.formatPrice(tier.price, tier.currency)}</span>
                            <span class="period">/month</span>
                        `}
                    </div>
                    <p class="tier-description">${this.escapeHtml(tier.description || 'No description')}</p>
                    <ul class="tier-benefits">
                        ${(tier.benefits || []).map(benefit => `
                            <li class="${tier.isFree ? 'free-benefit' : ''}">
                                <i class="bi bi-check-circle-fill"></i>
                                ${this.escapeHtml(benefit)}
                            </li>
                        `).join('')}
                    </ul>
                    <div class="tier-stats">
                        <div class="tier-stat">
                            <div class="stat-value">${tier.subscriberCount || 0}</div>
                            <div class="stat-label">Subscribers</div>
                        </div>
                        <div class="tier-stat">
                            <div class="stat-value">#${index + 1}</div>
                            <div class="stat-label">Order</div>
                        </div>
                    </div>
                    <div class="tier-actions">
                        <button class="btn btn-outline-primary btn-sm" onclick="TiersDashboard.editTier('${tier._id}')">
                            <i class="bi bi-pencil me-1"></i>Edit
                        </button>
                        <button class="btn btn-outline-secondary btn-sm drag-handle">
                            <i class="bi bi-grip-vertical"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        this.setupDragAndDrop();
    },
    
    renderTemplates() {
        const container = document.getElementById('tierTemplates');
        if (!container || !this.templates) return;
        
        container.innerHTML = this.templates.map((template, index) => `
            <div class="col-md-4">
                <div class="template-card" data-template-index="${index}" onclick="TiersDashboard.selectTemplate(${index})">
                    <div class="template-name">${this.escapeHtml(template.name)}</div>
                    <div class="template-price">${this.getCurrencySymbol(template.currency)}${this.formatPrice(template.price, template.currency)}/mo</div>
                </div>
            </div>
        `).join('');
    },
    
    selectTemplate(index) {
        const template = this.templates[index];
        if (!template) return;
        
        // Update form fields
        document.getElementById('tierName').value = template.name;
        document.getElementById('tierPrice').value = this.formatPrice(template.price, template.currency);
        document.getElementById('tierCurrency').value = template.currency;
        document.getElementById('tierDescription').value = template.description || '';
        
        // Update benefits
        const benefitsContainer = document.getElementById('benefitsContainer');
        benefitsContainer.innerHTML = '';
        
        (template.benefits || []).forEach(benefit => {
            this.addBenefitRow(benefitsContainer, benefit);
        });
        
        // Add empty row for new benefit
        this.addBenefitRow(benefitsContainer);
        
        // Highlight selected template
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-template-index="${index}"]`).classList.add('selected');
    },
    
    addBenefitRow(container, value = '') {
        const row = document.createElement('div');
        row.className = 'input-group mb-2 benefit-row';
        row.innerHTML = `
            <input type="text" class="form-control bg-secondary text-white border-secondary benefit-input" 
                   value="${this.escapeHtml(value)}" placeholder="Enter a benefit...">
            <button type="button" class="btn btn-outline-danger remove-benefit">
                <i class="bi bi-trash"></i>
            </button>
        `;
        container.appendChild(row);
        this.updateRemoveButtons(container);
    },
    
    updateRemoveButtons(container) {
        const rows = container.querySelectorAll('.benefit-row');
        rows.forEach((row, index) => {
            const removeBtn = row.querySelector('.remove-benefit');
            removeBtn.style.display = rows.length > 1 ? 'block' : 'none';
        });
    },
    
    setupEventListeners() {
        // Add benefit button
        document.getElementById('addBenefitBtn')?.addEventListener('click', () => {
            this.addBenefitRow(document.getElementById('benefitsContainer'));
        });
        
        document.getElementById('editAddBenefitBtn')?.addEventListener('click', () => {
            this.addBenefitRow(document.getElementById('editBenefitsContainer'));
        });
        
        // Remove benefit buttons (using event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.remove-benefit')) {
                const row = e.target.closest('.benefit-row');
                const container = row.parentElement;
                row.remove();
                this.updateRemoveButtons(container);
            }
        });
        
        // Save tier button
        document.getElementById('saveTierBtn')?.addEventListener('click', () => this.saveTier());
        
        // Update tier button
        document.getElementById('updateTierBtn')?.addEventListener('click', () => this.updateTier());
        
        // Delete tier button
        document.getElementById('deleteTierBtn')?.addEventListener('click', () => this.deleteTier());
        
        // Reset form when modal closes
        document.getElementById('createTierModal')?.addEventListener('hidden.bs.modal', () => {
            document.getElementById('createTierForm').reset();
            const benefitsContainer = document.getElementById('benefitsContainer');
            benefitsContainer.innerHTML = '';
            this.addBenefitRow(benefitsContainer);
            document.querySelectorAll('.template-card').forEach(card => {
                card.classList.remove('selected');
            });
        });
    },
    
    async saveTier() {
        const form = document.getElementById('createTierForm');
        const name = document.getElementById('tierName').value.trim();
        const priceStr = document.getElementById('tierPrice').value;
        const currency = document.getElementById('tierCurrency').value;
        const description = document.getElementById('tierDescription').value.trim();
        
        if (!name) {
            this.showError('Tier name is required');
            return;
        }
        
        // Parse price - convert to cents/smallest unit
        const priceFloat = parseFloat(priceStr) || 0;
        const price = currency === 'JPY' ? Math.round(priceFloat) : Math.round(priceFloat * 100);
        
        // Collect benefits
        const benefits = [];
        document.querySelectorAll('#benefitsContainer .benefit-input').forEach(input => {
            const value = input.value.trim();
            if (value) benefits.push(value);
        });
        
        const tierData = {
            name,
            price,
            currency,
            description,
            benefits
        };
        
        try {
            document.getElementById('saveTierBtn').disabled = true;
            document.getElementById('saveTierBtn').innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Creating...';
            
            const response = await fetch('/api/tiers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tierData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                bootstrap.Modal.getInstance(document.getElementById('createTierModal')).hide();
                this.showSuccess('Tier created successfully');
                await this.loadTiers();
            } else {
                this.showError(data.error || 'Failed to create tier');
            }
        } catch (error) {
            console.error('Error creating tier:', error);
            this.showError('Failed to create tier');
        } finally {
            document.getElementById('saveTierBtn').disabled = false;
            document.getElementById('saveTierBtn').innerHTML = '<i class="bi bi-check me-1"></i>Create';
        }
    },
    
    editTier(tierId) {
        const tier = this.tiers.find(t => t._id === tierId);
        if (!tier) return;
        
        // Populate edit form
        document.getElementById('editTierId').value = tier._id;
        document.getElementById('editTierName').value = tier.name;
        document.getElementById('editTierPrice').value = this.formatPrice(tier.price, tier.currency);
        document.getElementById('editTierCurrency').value = tier.currency;
        document.getElementById('editPriceCurrencySymbol').textContent = this.getCurrencySymbol(tier.currency);
        document.getElementById('editTierDescription').value = tier.description || '';
        document.getElementById('editTierActive').checked = tier.isActive;
        
        // Populate benefits
        const container = document.getElementById('editBenefitsContainer');
        container.innerHTML = '';
        (tier.benefits || []).forEach(benefit => {
            this.addBenefitRow(container, benefit);
        });
        this.addBenefitRow(container);
        
        // Show modal
        new bootstrap.Modal(document.getElementById('editTierModal')).show();
    },
    
    async updateTier() {
        const tierId = document.getElementById('editTierId').value;
        const name = document.getElementById('editTierName').value.trim();
        const description = document.getElementById('editTierDescription').value.trim();
        const isActive = document.getElementById('editTierActive').checked;
        
        if (!name) {
            this.showError('Tier name is required');
            return;
        }
        
        // Collect benefits
        const benefits = [];
        document.querySelectorAll('#editBenefitsContainer .benefit-input').forEach(input => {
            const value = input.value.trim();
            if (value) benefits.push(value);
        });
        
        const updateData = {
            name,
            description,
            benefits,
            isActive
        };
        
        try {
            document.getElementById('updateTierBtn').disabled = true;
            document.getElementById('updateTierBtn').innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
            
            const response = await fetch(`/api/tiers/${tierId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                bootstrap.Modal.getInstance(document.getElementById('editTierModal')).hide();
                this.showSuccess('Tier updated successfully');
                await this.loadTiers();
            } else {
                this.showError(data.error || 'Failed to update tier');
            }
        } catch (error) {
            console.error('Error updating tier:', error);
            this.showError('Failed to update tier');
        } finally {
            document.getElementById('updateTierBtn').disabled = false;
            document.getElementById('updateTierBtn').innerHTML = '<i class="bi bi-check me-1"></i>Save';
        }
    },
    
    async deleteTier() {
        const tierId = document.getElementById('editTierId').value;
        
        if (!confirm('Are you sure you want to delete this tier? This cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/tiers/${tierId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                bootstrap.Modal.getInstance(document.getElementById('editTierModal')).hide();
                this.showSuccess('Tier deleted successfully');
                await this.loadTiers();
            } else {
                this.showError(data.error || 'Failed to delete tier');
            }
        } catch (error) {
            console.error('Error deleting tier:', error);
            this.showError('Failed to delete tier');
        }
    },
    
    setupDragAndDrop() {
        const container = document.getElementById('tiersContainer');
        const cards = container.querySelectorAll('[data-tier-id]');
        
        cards.forEach(card => {
            const tierCard = card.querySelector('.tier-card');
            
            tierCard.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.dataset.tierId);
            });
            
            tierCard.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            });
            
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = container.querySelector('.dragging');
                if (dragging !== card) {
                    card.querySelector('.tier-card').classList.add('drag-over');
                }
            });
            
            card.addEventListener('dragleave', () => {
                card.querySelector('.tier-card').classList.remove('drag-over');
            });
            
            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                card.querySelector('.tier-card').classList.remove('drag-over');
                
                const draggedId = e.dataTransfer.getData('text/plain');
                const targetId = card.dataset.tierId;
                
                if (draggedId !== targetId) {
                    await this.reorderTiers(draggedId, targetId);
                }
            });
        });
    },
    
    async reorderTiers(draggedId, targetId) {
        const draggedIndex = this.tiers.findIndex(t => t._id === draggedId);
        const targetIndex = this.tiers.findIndex(t => t._id === targetId);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        // Reorder in array
        const [draggedTier] = this.tiers.splice(draggedIndex, 1);
        this.tiers.splice(targetIndex, 0, draggedTier);
        
        // Update UI immediately
        this.renderTiers();
        
        // Save to server
        const tierOrder = this.tiers.map(t => t._id);
        
        try {
            const response = await fetch('/api/tiers/reorder', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tierOrder })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                this.showError('Failed to save tier order');
                await this.loadTiers(); // Reload to get correct order
            }
        } catch (error) {
            console.error('Error reordering tiers:', error);
            await this.loadTiers();
        }
    },
    
    // Utility methods
    getCurrencySymbol(currency) {
        const symbols = { USD: '$', EUR: '€', JPY: '¥', GBP: '£' };
        return symbols[currency] || currency;
    },
    
    formatPrice(priceInCents, currency) {
        if (currency === 'JPY') {
            return priceInCents.toString();
        }
        return (priceInCents / 100).toFixed(2);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    showSuccess(message) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: message,
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            alert(message);
        }
    },
    
    showError(message) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: message
            });
        } else {
            alert('Error: ' + message);
        }
    }
};

// ===== Subscribers Dashboard =====
const SubscribersDashboard = {
    subscribers: [],
    tiers: [],
    currentPage: 1,
    totalPages: 1,
    filters: {
        tierId: '',
        status: 'active',
        search: ''
    },
    
    async init() {
        await this.loadStats();
        await this.loadTiers();
        await this.loadSubscribers();
        this.setupEventListeners();
    },
    
    async loadStats() {
        try {
            const response = await fetch('/api/subscriptions/stats');
            const data = await response.json();
            
            if (data.success && data.stats) {
                document.getElementById('activeSubscribers').textContent = data.stats.totalSubscribers || 0;
                document.getElementById('paidSubscribersCount').textContent = data.stats.paidSubscribers || 0;
                document.getElementById('freeSubscribersCount').textContent = data.stats.freeSubscribers || 0;
                document.getElementById('pastDueSubscribers').textContent = data.stats.pastDueSubscribers || 0;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    },
    
    async loadTiers() {
        try {
            const response = await fetch('/api/tiers/my');
            const data = await response.json();
            
            if (data.success) {
                this.tiers = data.tiers || [];
                this.renderTierFilter();
            }
        } catch (error) {
            console.error('Error loading tiers:', error);
        }
    },
    
    renderTierFilter() {
        const select = document.getElementById('filterTier');
        if (!select) return;
        
        // Keep the "All" option
        const allOption = select.querySelector('option[value=""]');
        select.innerHTML = '';
        select.appendChild(allOption);
        
        this.tiers.forEach(tier => {
            const option = document.createElement('option');
            option.value = tier._id;
            option.textContent = tier.name;
            select.appendChild(option);
        });
    },
    
    async loadSubscribers() {
        const tableBody = document.getElementById('subscribersTableBody');
        const emptyState = document.getElementById('emptySubscribers');
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>
        `;
        
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 20,
                status: this.filters.status
            });
            
            if (this.filters.tierId) {
                params.append('tierId', this.filters.tierId);
            }
            
            const response = await fetch(`/api/subscriptions/subscribers?${params}`);
            const data = await response.json();
            
            if (data.success) {
                this.subscribers = data.subscribers || [];
                this.totalPages = data.pagination?.pages || 1;
                this.renderSubscribers();
                this.renderPagination(data.pagination);
                
                emptyState.style.display = this.subscribers.length === 0 ? 'block' : 'none';
                tableBody.parentElement.parentElement.style.display = this.subscribers.length === 0 ? 'none' : 'block';
            }
        } catch (error) {
            console.error('Error loading subscribers:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>Failed to load subscribers
                    </td>
                </tr>
            `;
        }
    },
    
    renderSubscribers() {
        const tableBody = document.getElementById('subscribersTableBody');
        
        if (this.subscribers.length === 0) {
            tableBody.innerHTML = '';
            return;
        }
        
        tableBody.innerHTML = this.subscribers.map(sub => `
            <tr>
                <td>
                    <div class="subscriber-info">
                        <img src="${sub.subscriber?.profileUrl || '/img/avatar.png'}" 
                             alt="${this.escapeHtml(sub.subscriber?.nickname || 'User')}" 
                             class="subscriber-avatar">
                        <div>
                            <div class="subscriber-name">
                                <a href="/user/${sub.subscriberId}" class="text-white text-decoration-none">
                                    ${this.escapeHtml(sub.subscriber?.nickname || 'Anonymous')}
                                </a>
                            </div>
                            <div class="subscriber-email">${this.maskEmail(sub.subscriber?.email)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge ${sub.tier?.isFree ? 'bg-secondary' : 'bg-primary'}">
                        ${this.escapeHtml(sub.tier?.name || 'Unknown')}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${sub.status}">
                        <i class="bi bi-${this.getStatusIcon(sub.status)}"></i>
                        ${this.formatStatus(sub.status)}
                    </span>
                </td>
                <td>${this.formatDate(sub.startDate || sub.createdAt)}</td>
                <td>${sub.currentPeriodEnd ? this.formatDate(sub.currentPeriodEnd) : '—'}</td>
            </tr>
        `).join('');
    },
    
    renderPagination(pagination) {
        const container = document.getElementById('subscribersPagination');
        const info = document.getElementById('subscribersPaginationInfo');
        
        if (!pagination || pagination.pages <= 1) {
            container.innerHTML = '';
            info.textContent = `Showing ${pagination?.total || 0} subscribers`;
            return;
        }
        
        const { page, total, pages } = pagination;
        info.textContent = `Showing page ${page} of ${pages} (${total} total)`;
        
        let html = '<ul class="pagination mb-0">';
        
        // Previous button
        html += `
            <li class="page-item ${page <= 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${page - 1}">&laquo;</a>
            </li>
        `;
        
        // Page numbers
        for (let i = 1; i <= pages; i++) {
            if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
                html += `
                    <li class="page-item ${i === page ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `;
            } else if (i === page - 3 || i === page + 3) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }
        
        // Next button
        html += `
            <li class="page-item ${page >= pages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${page + 1}">&raquo;</a>
            </li>
        `;
        
        html += '</ul>';
        container.innerHTML = html;
    },
    
    setupEventListeners() {
        // Filter changes
        document.getElementById('filterTier')?.addEventListener('change', (e) => {
            this.filters.tierId = e.target.value;
            this.currentPage = 1;
            this.loadSubscribers();
        });
        
        document.getElementById('filterStatus')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.currentPage = 1;
            this.loadSubscribers();
        });
        
        // Search
        document.getElementById('searchBtn')?.addEventListener('click', () => {
            this.filters.search = document.getElementById('searchSubscribers').value;
            this.currentPage = 1;
            this.loadSubscribers();
        });
        
        document.getElementById('searchSubscribers')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.filters.search = e.target.value;
                this.currentPage = 1;
                this.loadSubscribers();
            }
        });
        
        // Pagination
        document.getElementById('subscribersPagination')?.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.closest('[data-page]')?.dataset.page;
            if (page && !e.target.closest('.disabled')) {
                this.currentPage = parseInt(page);
                this.loadSubscribers();
            }
        });
    },
    
    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },
    
    maskEmail(email) {
        if (!email) return 'Hidden';
        const [local, domain] = email.split('@');
        return `${local.substring(0, 3)}***@${domain}`;
    },
    
    formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString();
    },
    
    formatStatus(status) {
        const statuses = {
            active: 'Active',
            past_due: 'Past Due',
            cancelled: 'Cancelled',
            pending: 'Pending',
            paused: 'Paused'
        };
        return statuses[status] || status;
    },
    
    getStatusIcon(status) {
        const icons = {
            active: 'check-circle',
            past_due: 'exclamation-triangle',
            cancelled: 'x-circle',
            pending: 'hourglass-split',
            paused: 'pause-circle'
        };
        return icons[status] || 'question-circle';
    }
};

// ===== Subscribe Modal (for user profiles) =====
const SubscribeModal = {
    creatorId: null,
    tiers: [],
    selectedTierId: null,
    
    async show(creatorId) {
        this.creatorId = creatorId;
        await this.loadTiers();
        
        // Show modal
        const modal = document.getElementById('subscribeModal');
        if (modal) {
            new bootstrap.Modal(modal).show();
        }
    },
    
    async loadTiers() {
        try {
            const response = await fetch(`/api/tiers/creator/${this.creatorId}`);
            const data = await response.json();
            
            if (data.success) {
                this.tiers = data.tiers || [];
                this.renderTierOptions();
            }
        } catch (error) {
            console.error('Error loading tiers:', error);
        }
    },
    
    renderTierOptions() {
        const container = document.getElementById('subscribeTierOptions');
        if (!container) return;
        
        container.innerHTML = this.tiers.map(tier => `
            <div class="tier-option ${tier.isFree ? 'free' : ''}" data-tier-id="${tier._id}" 
                 onclick="SubscribeModal.selectTier('${tier._id}')">
                <div class="d-flex align-items-center gap-3">
                    <div class="tier-radio"></div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-bold text-white">${tier.name}</span>
                            <span class="fw-bold ${tier.isFree ? 'text-muted' : 'text-primary'}">
                                ${tier.isFree ? 'Free' : `$${(tier.price / 100).toFixed(2)}/mo`}
                            </span>
                        </div>
                        <p class="mb-0 small text-muted">${tier.description || ''}</p>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    selectTier(tierId) {
        this.selectedTierId = tierId;
        
        document.querySelectorAll('.tier-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.tierId === tierId);
        });
    },
    
    async subscribe() {
        if (!this.selectedTierId) {
            alert('Please select a tier');
            return;
        }
        
        const tier = this.tiers.find(t => t._id === this.selectedTierId);
        
        try {
            if (tier.isFree || tier.price === 0) {
                // Free subscription
                const response = await fetch('/api/subscriptions/free', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        creatorId: this.creatorId,
                        tierId: this.selectedTierId
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    window.location.reload();
                } else {
                    alert(data.error || 'Failed to subscribe');
                }
            } else {
                // Paid subscription - redirect to checkout
                const response = await fetch('/api/subscriptions/checkout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        creatorId: this.creatorId,
                        tierId: this.selectedTierId
                    })
                });
                
                const data = await response.json();
                
                if (data.success && data.url) {
                    window.location.href = data.url;
                } else {
                    alert(data.error || 'Failed to create checkout session');
                }
            }
        } catch (error) {
            console.error('Error subscribing:', error);
            alert('Failed to subscribe');
        }
    }
};

// Export for global access
window.TiersDashboard = TiersDashboard;
window.SubscribersDashboard = SubscribersDashboard;
window.SubscribeModal = SubscribeModal;
