$(document).ready(function() {
  let plan = {};
  let stripe;
  if(window.location.href.indexOf('https://') >= 0){
    stripe = Stripe('pk_live_51PjtRbE5sP7DA1XvCkdmezori9qPGoO21y7yKSVvgkQVyrhWZfHAUkNsjPMnbwpPlp4zzoYsRjn79Ad7XN7HTHcc00UjBA9adF');
  }else{
    stripe = Stripe('pk_test_51PjtRbE5sP7DA1XvD68v7X7Qj7pG6ZJpQmvuNodJjxc7MbH1ss2Te2gahFAS9nms4pbmEdMYdfCPxFDWHBbu9CxR003ikTnRES');
  }

  // Function to fetch plans from the server
  function fetchPlans() {
    $.ajax({
      type: 'GET',
      url: `/plan/list?lang=${lang}`,
      dataType: 'json',
      success: function({plans, features}) {
        const dayPassPlans = plans.filter(plan => plan.isOneTime);
        const subscriptionPlans = plans.filter(plan => !plan.isOneTime);
        
        // Render plan cards with the new professional design
        renderPlanCards(subscriptionPlans, dayPassPlans);
      },
      error: function(xhr, status, error) {
        console.error('Failed to fetch plans:', error);
        $('#planCardsContainer').html(`
          <div class="text-center py-5 text-danger">
            <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block"></i>
            <p>Failed to load plans. Please refresh the page.</p>
          </div>
        `);
      }
    });
  }

  // Render plan cards with professional dark design
  function renderPlanCards(subscriptionPlans, dayPassPlans) {
    const $container = $('#planCardsContainer');
    $container.empty();

    // Combine subscription plans first, then day passes
    const allPlans = [...subscriptionPlans, ...dayPassPlans];

    if (allPlans.length === 0) {
      $container.html(`
        <div class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
          <p>No plans available at the moment.</p>
        </div>
      `);
      return;
    }

    allPlans.forEach((plan, index) => {
      const isOneTime = !!plan.isOneTime;
      const isPopular = plan.popular || plan.isPopular || false;
      const isBestValue = plan.bestValue || false;
      
      // Determine card class
      let cardClass = 'plan-card';
      if (isPopular) cardClass += ' popular';
      else if (isOneTime) cardClass += ' one-time';
      
      // Build badge HTML
      let badgeHtml = '';
      if (isPopular) {
        badgeHtml = `<span class="plan-badge popular"><i class="bi bi-star-fill me-1"></i>${translations.plan_page.popular || 'Popular'}</span>`;
      } else if (isBestValue) {
        badgeHtml = `<span class="plan-badge best-value"><i class="bi bi-award-fill me-1"></i>${translations.plan_page.best_value || 'Best Value'}</span>`;
      } else if (isOneTime) {
        badgeHtml = `<span class="plan-badge one-time"><i class="bi bi-clock me-1"></i>${translations.one_time || 'One-time'}</span>`;
      }
      
      // Parse price - handle various formats
      let priceDisplay = plan.price || '$0';
      let currency = '$';
      let amount = '0';
      let period = isOneTime ? '' : `/ ${translations.monthly || 'month'}`;
      
      // Extract numeric value from price string
      const priceMatch = String(priceDisplay).match(/([¥$€£]?)(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      if (priceMatch) {
        currency = priceMatch[1] || '$';
        amount = priceMatch[2];
      }
      
      // Build discount HTML
      let discountHtml = '';
      if (plan.discount) {
        discountHtml = `<span class="plan-discount"><i class="bi bi-tag-fill me-1"></i>${plan.discount}</span>`;
      }
      
      // Build features list
      let featuresHtml = '';
      if (plan.features && Array.isArray(plan.features)) {
        featuresHtml = `
          <ul class="plan-features-list">
            ${plan.features.slice(0, 4).map(feature => `
              <li>
                <i class="bi bi-check-circle-fill"></i>
                <span>${escapeHtml(feature)}</span>
              </li>
            `).join('')}
          </ul>
        `;
      }
      
      // Build card HTML
      const cardHtml = `
        <div class="${cardClass}" data-plan-id="${plan.id}">
          <div class="plan-card-header">
            <h3 class="plan-name">${escapeHtml(plan.name)}</h3>
            ${badgeHtml}
          </div>
          
          <div class="plan-price-container">
            <div class="plan-price">
              <span class="currency">${currency}</span>
              <span class="amount">${amount}</span>
              <span class="period">${period}</span>
            </div>
            ${discountHtml}
          </div>
          
          ${plan.shortDescription ? `<p class="plan-description">${escapeHtml(plan.shortDescription)}</p>` : ''}
          
          ${featuresHtml}
          
          <button class="plan-cta-btn" data-plan-id="${plan.id}">
            <i class="bi bi-lightning-charge-fill"></i>
            ${translations.plan_page.get_started || 'Get Started'}
          </button>
        </div>
      `;
      
      $container.append(cardHtml);
    });

    // Click handlers for plan cards
    $container.find('.plan-cta-btn').on('click', function(e) {
      e.stopPropagation();
      const planId = $(this).data('plan-id');
      handlePlanSelection(planId, $(this).closest('.plan-card'));
    });
    
    $container.find('.plan-card').on('click', function(e) {
      if ($(e.target).closest('.plan-cta-btn').length === 0) {
        const planId = $(this).data('plan-id');
        handlePlanSelection(planId, $(this));
      }
    });
  }

  // Handle plan selection
  function handlePlanSelection(planId, $card) {
    if (!planId) return;
    
    // Visual feedback
    $card.css('transform', 'scale(0.98)');
    setTimeout(() => $card.css('transform', ''), 150);
    
    // Update button state
    const $btn = $card.find('.plan-cta-btn');
    const originalText = $btn.html();
    $btn.html(`<i class="bi bi-hourglass-split"></i> ${translations.plan_page.processing || 'Processing...'}`);
    $btn.prop('disabled', true);
    
    // Disable all other buttons
    $('#planCardsContainer .plan-cta-btn').not($btn).prop('disabled', true);
    
    // Create checkout session
    createCheckoutSession(planId).catch(() => {
      // Restore button states on error
      $btn.html(originalText);
      $btn.prop('disabled', false);
      $('#planCardsContainer .plan-cta-btn').prop('disabled', false);
    });
  }

  // Function to create a checkout session
  function createCheckoutSession(billingCycle) {
    return $.ajax({
      type: 'POST',
      url: '/plan/subscribe',
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({ billingCycle }),
      success: function(response) {
        if (response.action == 'upgrade') {
          $.post('/plan/upgrade', { 
            newPlanId: response.newPlanId,
            billingCycle: response.billingCycle
          })
          .done(function(data) {
            const newPlan = data.newPlan;
            const planName = newPlan.name;
            console.log('Upgrade successful:', planName);
            
            Swal.fire({
              icon: 'success',
              title: translations.upgrade_successful,
              text: `${translations.new_plan}: ${planName}`,
              showCloseButton: true,
              background: '#1a1a2e',
              color: '#fff'
            });
          })
          .fail(function(xhr, status, error) {
            console.error('Error upgrading plan:', error);
            const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : translations.plan_page.upgrade_error;
            Swal.fire({
              icon: 'error',
              title: translations.error,
              text: errorMessage,
              confirmButtonText: 'OK',
              background: '#1a1a2e',
              color: '#fff'
            });
          });
          return;
        }
        window.location.href = response.url;
      },
      error: function(xhr, status, error) {
        console.error('Failed to create subscription:', error);
        if (xhr.responseJSON && xhr.responseJSON.error === 'You already have an active subscription for this plan.') {
          Swal.fire({
            title: translations.already_subscribed,
            text: translations.already_subscribed_message,
            icon: 'warning',
            showCloseButton: true,
            background: '#1a1a2e',
            color: '#fff'
          });
        } else {
          Swal.fire({
            title: translations.error_occurred,
            text: translations.subscription_creation_failed,
            icon: 'error',
            showCloseButton: true,
            background: '#1a1a2e',
            color: '#fff'
          });
        }
      }
    });
  }

  // Utility function to escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize
  fetchPlans();

  // Keep plan-switch behavior
  $('#plan-switch').on('change', function() {
    fetchPlans();
  });
});
