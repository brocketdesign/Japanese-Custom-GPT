$(document).ready(function() {
  let stripe;
  let selectedPackage = null;

  // Initialize Stripe
  if (window.location.href.indexOf('https://') >= 0) {
    stripe = Stripe('pk_live_51PjtRbE5sP7DA1XvCkdmezori9qPGoO21y7yKSVvgkQVyrhWZfHAUkNsjPMnbwpPlp4zzoYsRjn79Ad7XN7HTHcc00UjBA9adF');
  } else {
    stripe = Stripe('pk_test_51PjtRbE5sP7DA1XvD68v7X7Qj7pG6ZJpQmvuNodJjxc7MbH1ss2Te2gahFAS9nms4pbmEdMYdfCPxFDWHBbu9CxR003ikTnRES');
  }

  /**
   * Fetch available point packages
   */
  function fetchPointPackages() {
    $.ajax({
      type: 'GET',
      url: `/buy-points/packages?lang=${lang}`,
      dataType: 'json',
      success: function(response) {
        if (response.success && response.packages) {
          renderPointPackages(response.packages);
        }
      },
      error: function(xhr, status, error) {
        console.error('Failed to fetch point packages:', error);
        showError(window.buyPointsTranslations.buy_points.error_loading);
      }
    });
  }

  /**
   * Render point packages as cards
   */
  function renderPointPackages(packages) {
    const container = $('#buyPointsPackagesContainer');
    if (!container.length) return;

    container.empty();

    packages.forEach((pkg, index) => {
      //console.log('Rendering package:', pkg);
      const isPopular = index === 1;
      const pointsPerUnit = (parseFloat(pkg.points) / parseFloat(pkg.price)).toFixed(1);
      const popularBadge = isPopular 
        ? `<span class="badge bg-success position-absolute top-0 end-0 m-2">${window.buyPointsTranslations.buy_points.most_popular}</span>`
        : '';

      const cardHTML = `
  <div class="col-6 col-md-4 col-lg-3 mb-3">
    <div class="card h-100 border-0 position-relative buy-points-card p-3 rounded-4" 
         data-package-id="${pkg.id}"
         style="background: linear-gradient(145deg, #1e1e2e 0%, #2a2a3e 100%); border: 1px solid rgba(255,255,255,0.08) !important;">

      ${pkg.discount !== '0%' ? `
        <div class="badge position-absolute rounded-pill"
             style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); font-size: 0.65rem; top: -8px; left: 50%; transform: translateX(-50%); padding: 4px 10px; box-shadow: 0 2px 8px rgba(249,115,22,0.4);">
          ${pkg.discount} OFF
        </div>
      ` : ''}

      ${isPopular ? `
        <div class="badge position-absolute rounded-pill" 
              style="background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); font-size: 0.6rem; top: -8px; left: 50%; transform: translateX(-50%); padding: 4px 10px; box-shadow: 0 2px 8px rgba(168,85,247,0.4);">
          ${window.buyPointsTranslations.buy_points.most_popular}
        </div>` : ''}

      <div class="text-center mt-2 mb-3">
        <div class="d-inline-flex align-items-center justify-content-center rounded-circle" 
             style="width: 56px; height: 56px; background: linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.1) 100%); border: 1px solid rgba(251,191,36,0.3);">
          <img src="/img/coins/coins-${index + 1}.png" style="width:32px;height:32px;">
        </div>
      </div>

      <div class="text-center mb-2">
        <div class="fw-bold mb-1" style="font-size: 1.5rem; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          ${pkg.points}
        </div>
        <div class="text-white-50 small text-uppercase" style="letter-spacing: 1px; font-size: 0.65rem;">
          ${window.buyPointsTranslations.buy_points.points}
        </div>
      </div>

      <div class="text-center mb-3">
        <span class="fw-bold text-white" style="font-size: 1.25rem;">
          ${pkg.currency === 'JPY' ? '¥' : (pkg.currency === 'EUR' ? '€' : '$')}${pkg.price}
        </span>
        ${pkg.discount !== '0%' ? `
          <span class="text-decoration-line-through text-white-50 ms-1" style="font-size: 0.8rem;">
            ${pkg.currency === 'JPY' ? '¥' : (pkg.currency === 'EUR' ? '€' : '$')}${pkg.originalPrice}
          </span>
        ` : ''}
      </div>

      <button class="btn w-100 fw-semibold purchase-points-btn rounded-3 py-2"
              data-package-id="${pkg.id}"
              style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; transition: all 0.2s ease;">
        ${window.buyPointsTranslations.buy_points.purchase_button || 'Buy Now'}
      </button>

    </div>
  </div>
`;


      container.append(cardHTML);
    });

    // Add click handlers
    $('.buy-points-card').on('click', function() {
      const packageId = $(this).data('package-id');
      selectPackage(packageId, this);
    });

    $('.purchase-points-btn').on('click', function(e) {
      e.stopPropagation();
      const packageId = $(this).data('package-id');
      initiatePurchase(packageId);
    });
  }

  /**
   * Select a point package
   */
  function selectPackage(packageId, element) {
    $('.buy-points-card').removeClass('border-primary');
    $(element).addClass('border-primary');
    selectedPackage = packageId;
  }

  /**
   * Initiate purchase for selected package
   */
  function initiatePurchase(packageId) {
    const button = $(`button[data-package-id="${packageId}"]`);
    const originalText = button.text();
    
    button.prop('disabled', true).text(window.buyPointsTranslations.buy_points.purchasing || 'Processing...');

    $.ajax({
      type: 'POST',
      url: '/buy-points/checkout',
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({ packageId: packageId }),
      success: function(response) {
        if (response.success && response.sessionId) {
          // Redirect to Stripe Checkout
          stripe.redirectToCheckout({ sessionId: response.sessionId }).then(function(result) {
            if (result.error) {
              console.error('Stripe redirect error:', result.error);
              showError(result.error.message);
              button.prop('disabled', false).text(originalText);
            }
          });
        } else {
          showError(response.error || 'Failed to create checkout session');
          button.prop('disabled', false).text(originalText);
        }
      },
      error: function(xhr, status, error) {
        console.error('Failed to create checkout session:', error);
        showError(window.buyPointsTranslations.buy_points.error_loading || 'Error processing purchase');
        button.prop('disabled', false).text(originalText);
      }
    });
  }

  /**
   * Load and display purchase history
   */
  function loadPurchaseHistory() {
    const historyContainer = $('#purchaseHistoryContainer');
    if (!historyContainer.length) return;

    historyContainer.html(`<p>${window.buyPointsTranslations.buy_points.loading || 'Loading...'}</p>`);

    $.ajax({
      type: 'GET',
      url: '/buy-points/history',
      dataType: 'json',
      success: function(response) {
        if (response.success && response.purchases) {
          if (response.purchases.length === 0) {
            historyContainer.html(`<p class="text-muted text-center">${window.buyPointsTranslations.buy_points.no_purchases || 'No purchases yet'}</p>`);
          } else {
            renderPurchaseHistory(response.purchases);
          }
        }
      },
      error: function(xhr, status, error) {
        console.error('Failed to load purchase history:', error);
        historyContainer.html(`<p class="text-danger">${window.buyPointsTranslations.buy_points.error_loading || 'Error loading history'}</p>`);
      }
    });
  }

  /**
   * Render purchase history table
   */
  function renderPurchaseHistory(purchases) {
    const historyContainer = $('#purchaseHistoryContainer');
    
    let html = `
      <div class="table-responsive">
        <table class="table table-sm table-hover">
          <thead>
            <tr>
              <th>${window.buyPointsTranslations.buy_points.purchase_date || 'Date'}</th>
              <th>${window.buyPointsTranslations.buy_points.purchase_points || 'Points'}</th>
              <th>${window.buyPointsTranslations.buy_points.purchase_amount || 'Amount'}</th>
              <th>${window.buyPointsTranslations.buy_points.purchase_status || 'Status'}</th>
            </tr>
          </thead>
          <tbody>
    `;

    purchases.forEach(purchase => {
      const date = new Date(purchase.createdAt).toLocaleDateString();
      const currency = purchase.currency;
      const amount = (purchase.amount / 100).toFixed(2);
      const statusBadge = `<span class="badge bg-success">${purchase.status}</span>`;

      html += `
        <tr>
          <td>${date}</td>
          <td><strong>${purchase.points}</strong></td>
          <td>${currency === 'JPY' ? '¥' : (currency === 'EUR' ? '€' : '$')}${amount}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    historyContainer.html(html);
  }

  /**
   * Show error message
   */
  function showError(message) {
    // Create alert if it doesn't exist
    const alertId = 'buyPointsAlert';
    let alert = $(`#${alertId}`);
    
    if (alert.length === 0) {
      const container = $('#buyPointsPackagesContainer').parent();
      alert = $(`
        <div id="${alertId}" class="alert alert-danger alert-dismissible fade show" role="alert" style="display:none;">
          <strong>Error:</strong> <span class="error-message"></span>
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      `);
      container.prepend(alert);
    }

    alert.find('.error-message').text(message);
    alert.show();
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      alert.fadeOut();
    }, 5000);
  }

  /**
   * Show success message
   */
  function showSuccess(message) {
    const alertId = 'buyPointsSuccessAlert';
    let alert = $(`#${alertId}`);
    
    if (alert.length === 0) {
      const container = $('#buyPointsPackagesContainer').parent();
      alert = $(`
        <div id="${alertId}" class="alert alert-success alert-dismissible fade show" role="alert" style="display:none;">
          <strong>Success!</strong> <span class="success-message"></span>
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      `);
      container.prepend(alert);
    }

    alert.find('.success-message').text(message);
    alert.show();
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      alert.fadeOut();
    }, 3000);
  }

  /**
   * Initialize buy points interface in modal
   */
  window.initBuyPointsModal = function() {
    fetchPointPackages();
    loadPurchaseHistory();
  };

  /**
   * Handle purchase success redirect
   */
  function handlePurchaseSuccess() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (sessionId && window.location.pathname === '/buy-points/success') {
      // Show success message
      showSuccess(window.buyPointsTranslations.buy_points.points_added || 'Points added successfully!');
      
      // Refresh user points if available
      if (typeof refreshUserPoints === 'function') {
        setTimeout(() => {
          refreshUserPoints();
        }, 1000);
      }

      // Redirect to home after 3 seconds
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);
    }
  }

  // Handle purchase success if we're on the success page
  if (window.location.pathname === '/buy-points/success') {
    handlePurchaseSuccess();
  }

  // Initialize on modal show
  $(document).on('shown.bs.modal', '#userPointsModal', function() {
    if (typeof initBuyPointsModal === 'function') {
      initBuyPointsModal();
    }
  });
});

window.openBuyPointsModal = function() {
  const userPointsModal = new bootstrap.Modal(document.getElementById('userPointsModal'));
  userPointsModal.show();
};
