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
      const isPopular = index === 1;
      const pointsPerUnit = (parseFloat(pkg.points) / parseFloat(pkg.price)).toFixed(1);
      const popularBadge = isPopular 
        ? `<span class="badge bg-success position-absolute top-0 end-0 m-2">${window.buyPointsTranslations.buy_points.most_popular}</span>`
        : '';

      const cardHTML = `
        <div class="col-12 col-md-6 col-lg-6 mb-3">
          <div class="card buy-points-card h-100 cursor-pointer position-relative" data-package-id="${pkg.id}" style="border: 2px solid #e9ecef; transition: all 0.3s ease;">
            ${popularBadge}
            <div class="card-body d-flex flex-column">
              <h5 class="card-title text-center fw-bold">${pkg.points} <i class="bi bi-coin"></i></h5>
              <p class="text-center text-muted small mb-2">${pkg.description}</p>
              
              <div class="my-3">
                <h3 class="text-center mb-1">
                  ${pkg.currency === 'JPY' ? '¥' : (pkg.currency === 'EUR' ? '€' : '$')}${pkg.price}
                </h3>
                <p class="text-center small text-decoration-line-through text-muted mb-2">
                  ${pkg.currency === 'JPY' ? '¥' : (pkg.currency === 'EUR' ? '€' : '$')}${pkg.originalPrice}
                </p>
                ${pkg.discount !== '0%' ? `<span class="badge bg-danger d-block text-center">${pkg.discount}</span>` : ''}
              </div>

              <button class="btn btn-primary mt-auto purchase-points-btn" data-package-id="${pkg.id}">
                ${window.buyPointsTranslations.buy_points.purchase_button || 'Get Started'}
              </button>
            </div>
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
