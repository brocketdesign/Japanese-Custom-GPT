class AffiliationBanking {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.bankElement = null;
        this.translations = window.affiliationTranslations || {};
        
        this.init();
    }

    async init() {
        // Initialize Stripe
        if (window.stripePublishableKey) {
            this.stripe = Stripe(window.stripePublishableKey);
            this.elements = this.stripe.elements();
            this.setupStripeElements();
        }

        this.loadPaymentMethods();
        this.loadEarnings();
        this.loadPayoutSettings();
        this.loadPayoutHistory();
        this.setupEventListeners();
    }

    setupStripeElements() {
        // Create bank account element
        this.bankElement = this.elements.create('usBankAccount', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                        color: '#aab7c4',
                    },
                },
            },
        });

        this.bankElement.mount('#bank-element');

        // Handle real-time validation errors
        this.bankElement.on('change', ({error}) => {
            const displayError = document.getElementById('bank-errors');
            if (error) {
                displayError.textContent = error.message;
            } else {
                displayError.textContent = '';
            }
        });
    }

    setupEventListeners() {
        // Bank account form submission
        document.getElementById('bankAccountForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBankAccount();
        });

        // Add payment method button
        document.getElementById('addPaymentMethodBtn')?.addEventListener('click', () => {
            this.showAddPaymentMethodForm();
        });

        // Save payout settings
        document.getElementById('savePayoutSettings')?.addEventListener('click', () => {
            this.savePayoutSettings();
        });

        // Refresh buttons
        document.getElementById('refreshPayoutsBtn')?.addEventListener('click', () => {
            this.loadPayoutHistory();
        });
    }

    async loadPaymentMethods() {
        try {
            const response = await fetch('/api/affiliate/banking/payment-methods');
            const data = await response.json();

            if (data.success) {
                this.renderPaymentMethods(data.data.paymentMethods);
            } else {
                this.showError(data.error || this.translations.failedToLoadPaymentMethods);
            }
        } catch (error) {
            console.error('Error loading payment methods:', error);
            this.showError(this.translations.failedToLoadPaymentMethods);
        }
    }

    renderPaymentMethods(paymentMethods) {
        const container = document.getElementById('paymentMethodsList');
        
        if (!paymentMethods || paymentMethods.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-credit-card-2-front text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-2">${this.translations.noPaymentMethods}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = paymentMethods.map(method => `
            <div class="payment-method ${method.id === 'default' ? 'default' : ''}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">
                            <i class="bi bi-bank"></i>
                            ${method.us_bank_account?.bank_name || 'Bank Account'}
                        </h6>
                        <small class="text-muted">
                            ****${method.us_bank_account?.last4} • ${method.us_bank_account?.account_type}
                        </small>
                        ${method.id === 'default' ? '<span class="badge bg-success ms-2">Default</span>' : ''}
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-danger" onclick="affiliationBanking.removePaymentMethod('${method.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async addBankAccount() {
        const submitBtn = document.getElementById('submitBankAccount');
        const spinner = document.getElementById('bankSubmitSpinner');
        
        try {
            submitBtn.disabled = true;
            spinner.classList.remove('d-none');

            const accountHolderName = document.getElementById('accountHolderName').value;
            const country = document.getElementById('country').value;
            const currency = document.getElementById('currency').value;

            if (!accountHolderName || !country || !currency) {
                throw new Error(this.translations.fillAllFields);
            }

            // Create setup intent
            const setupResponse = await fetch('/api/affiliate/banking/create-setup-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const setupData = await setupResponse.json();

            if (!setupData.success) {
                throw new Error(setupData.error);
            }

            // Confirm setup intent
            const {error, setupIntent} = await this.stripe.confirmUsBankAccountSetup(
                setupData.clientSecret,
                {
                    payment_method: {
                        us_bank_account: this.bankElement,
                        billing_details: {
                            name: accountHolderName,
                        },
                    },
                }
            );

            if (error) {
                throw new Error(error.message);
            }

            // Save to backend
            const saveResponse = await fetch('/api/affiliate/banking/add-bank-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentMethodId: setupIntent.payment_method,
                    accountHolderName,
                    country,
                    currency
                })
            });

            const saveData = await saveResponse.json();
            if (!saveData.success) {
                throw new Error(saveData.error);
            }

            this.showSuccess(this.translations.bankAccountAdded);
            this.resetForm();
            this.loadPaymentMethods();

        } catch (error) {
            console.error('Error adding bank account:', error);
            this.showError(error.message || this.translations.failedToAddBankAccount);
        } finally {
            submitBtn.disabled = false;
            spinner.classList.add('d-none');
        }
    }

    async removePaymentMethod(methodId) {
        if (!confirm(this.translations.confirmRemovePaymentMethod)) {
            return;
        }

        try {
            const response = await fetch(`/api/affiliate/banking/payment-method/${methodId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            if (data.success) {
                this.showSuccess(this.translations.paymentMethodRemoved);
                this.loadPaymentMethods();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error removing payment method:', error);
            this.showError(error.message || this.translations.failedToRemovePaymentMethod);
        }
    }

    async loadEarnings() {
        try {
            const response = await fetch('/api/affiliate/banking/earnings');
            const data = await response.json();

            if (data.success) {
                document.getElementById('totalEarnings').textContent = `$${data.data.totalEarnings.toFixed(2)}`;
                document.getElementById('pendingPayment').textContent = `$${data.data.pendingPayment.toFixed(2)}`;
                
                // Calculate next payout date (example: monthly on 1st)
                const nextPayout = new Date();
                nextPayout.setMonth(nextPayout.getMonth() + 1);
                nextPayout.setDate(1);
                document.getElementById('nextPayoutDate').textContent = nextPayout.toLocaleDateString();
            }
        } catch (error) {
            console.error('Error loading earnings:', error);
        }
    }

    async loadPayoutSettings() {
        try {
            const response = await fetch('/api/affiliate/banking/payout-settings');
            const data = await response.json();

            if (data.success) {
                document.getElementById('minimumPayout').value = data.data.minimumPayout;
                document.getElementById('payoutFrequency').value = data.data.payoutFrequency;
            }
        } catch (error) {
            console.error('Error loading payout settings:', error);
        }
    }

    async savePayoutSettings() {
        try {
            const minimumPayout = document.getElementById('minimumPayout').value;
            const payoutFrequency = document.getElementById('payoutFrequency').value;

            const response = await fetch('/api/affiliate/banking/payout-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minimumPayout, payoutFrequency })
            });

            const data = await response.json();
            if (data.success) {
                this.showSuccess(this.translations.payoutSettingsSaved);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error saving payout settings:', error);
            this.showError(error.message || this.translations.failedToSaveSettings);
        }
    }

    async loadPayoutHistory() {
        try {
            const response = await fetch('/api/affiliate/banking/payout-history');
            const data = await response.json();

            if (data.success) {
                this.renderPayoutHistory(data.data.payouts);
            }
        } catch (error) {
            console.error('Error loading payout history:', error);
        }
    }

    renderPayoutHistory(payouts) {
        const tbody = document.getElementById('payoutHistoryTable');
        
        if (!payouts || payouts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        ${this.translations.noPayoutHistory}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = payouts.map(payout => `
            <tr>
                <td>${new Date(payout.createdAt).toLocaleDateString()}</td>
                <td>$${payout.amount.toFixed(2)}</td>
                <td>
                    <span class="badge bg-${this.getStatusColor(payout.status)}">
                        ${payout.status}
                    </span>
                </td>
                <td>${payout.method || 'Bank Transfer'}</td>
                <td><small class="text-muted">${payout.transactionId || '--'}</small></td>
            </tr>
        `).join('');
    }

    getStatusColor(status) {
        const colors = {
            'completed': 'success',
            'pending': 'warning',
            'failed': 'danger',
            'processing': 'info'
        };
        return colors[status] || 'secondary';
    }

    resetForm() {
        document.getElementById('bankAccountForm').reset();
        this.bankElement.clear();
    }

    showSuccess(message) {
        // Implement your success notification system
        alert(message);
    }

    showError(message) {
        // Implement your error notification system
        alert(message);
    }

    showAddPaymentMethodForm() {
        // Scroll to form or show modal
        document.getElementById('bankAccountForm').scrollIntoView({ behavior: 'smooth' });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.affiliationBanking = new AffiliationBanking();
});
