$(document).ready(function() {
  let plan = {};
  let stripe;
  if(window.location.href.indexOf('https://') >= 0){
    stripe = Stripe('pk_live_51PjtRbE5sP7DA1XvCkdmezori9qPGoO21y7yKSVvgkQVyrhWZfHAUkNsjPMnbwpPlp4zzoYsRjn79Ad7XN7HTHcc00UjBA9adF'); // Use your publishable key here
  }else{
    stripe = Stripe('pk_test_51PjtRbE5sP7DA1XvD68v7X7Qj7pG6ZJpQmvuNodJjxc7MbH1ss2Te2gahFAS9nms4pbmEdMYdfCPxFDWHBbu9CxR003ikTnRES'); // Use your publishable key here
  }

  // Function to fetch plans from the server
  function fetchPlans() {
    $.ajax({
      type: 'GET',
      url: `/plan/list?lang=${lang}`,
      dataType: 'json',
      success: function({plans,features}) {
        // Separate day pass from subscription plans
        const dayPassPlans = plans.filter(plan => plan.isOneTime);
        const subscriptionPlans = plans.filter(plan => !plan.isOneTime);
        
        renderPlans(subscriptionPlans, dayPassPlans);
        renderComparisonTable(features, plans); // Call to render comparison table
      },
      error: function(xhr, status, error) {
        console.error('Failed to fetch plans:', error);
      }
    });
  }

// Function to render plans with improved styling and separation
function renderPlans(subscriptionPlans, dayPassPlans) {
  const planCardsContainer = $('#planCards');
  const dayPassContainer = $('#dayPassCards');
  planCardsContainer.empty();
  dayPassContainer.empty();
  
  // Render subscription plans
  subscriptionPlans.forEach((plan, index) => {
    const planHTML = renderPlanCard(plan, index, false);
    planCardsContainer.append(planHTML);
  });
  
  // Render day pass plans separately
  dayPassPlans.forEach((plan, index) => {
    const planHTML = renderPlanCard(plan, index, true);
    dayPassContainer.append(planHTML);
  });
  
  // Add click handler with visual feedback
  $('.plan-card').on('click', function() {
    const $card = $(this);
    $card.css('transform', 'scale(0.98)');
    setTimeout(() => {
      $card.css('transform', '');
    }, 150);
    
    const billingCycle = $(this).data('billing-cycle');
    createCheckoutSession(billingCycle);
  });
}

// Helper function to render individual plan card
function renderPlanCard(plan, index, isDayPass) {
  let gradientClass = 'standard-gradient';
  let ctaButtonClass = 'standard';
  let isPremium = false;
  let isOneDay = false;
  let popularBadge = '';
  let oneDayBadgeHTML = '';

  // Determine plan type and apply specific classes/badges
  if (plan.name.toLowerCase().includes('premium')) {
    gradientClass = 'premium-gradient';
    ctaButtonClass = 'premium';
    isPremium = true;
    popularBadge = `<span class="popular-badge">${translations.plan_page.most_popular}</span>`;
  } else if (plan.isOneTime) {
    gradientClass = 'oneday-gradient';
    ctaButtonClass = 'oneday';
    isOneDay = true;
    oneDayBadgeHTML = `<div class="safe-test-badge">
                         <i class="bi bi-shield-check-fill"></i> ${translations.plan_page.safe_test}
                       </div>`;
  } else if (index === 0) {
    gradientClass = 'basic-gradient';
    ctaButtonClass = 'basic';
  }

  const isOneTimeBadge = plan.isOneTime ? `<span class="badge bg-info ms-2">${translations.one_time}</span>` : '';
  const priceSuffix = plan.isOneTime ? '' : `<span class="text-muted" style="font-size:11px;">${translations.currency}${translations.monthly}</span>`;
  
  // Features list specific to plan type
  let featuresHTML = '';
  if (isPremium) {
    featuresHTML = `
      <ul class="plan-features">
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.premium_feature_1}</li>
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.premium_feature_2}</li>
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.premium_feature_3}</li>
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.premium_feature_4_new}</li>
      </ul>`;
  } else if (isOneDay) {
    featuresHTML = `
      <ul class="plan-features">
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.oneday_feature_1}</li>
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.oneday_feature_2}</li>
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.oneday_feature_3}</li>
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.oneday_feature_4_new}</li>
      </ul>`;
  } else {
    featuresHTML = `
      <ul class="plan-features">
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.standard_feature_1}</li>
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.standard_feature_2}</li>
        <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.standard_feature_3}</li>
      </ul>`;
  }
  
  // Use full width for day pass, keep col-lg-4 for subscriptions
  const colClass = isDayPass ? 'col-12' : 'col-lg-4 col-md-6';
  
  return `
    <div class="${colClass}">
      <div class="plan-card p-4 text-white cursor-pointer ${gradientClass}" data-plan-id="${plan.id}" data-billing-cycle="${plan.id}">
        ${popularBadge}
        <div>
          <div class="d-flex justify-content-start align-items-center mb-2">
            <h5 class="mb-0 me-2 fw-bold">${plan.name}</h5>
            <span class="badge" style="background-color: #FF5E7E;">${plan.discount}</span>
            ${isOneTimeBadge}
          </div>
          <div class="mb-3">
            <h2 class="fw-bold mb-0">${plan.price}${priceSuffix}</h2>
            <small class="text-decoration-line-through" style="opacity: 0.8;">${plan.originalPrice}${translations.currency}${plan.isOneTime ? '' : translations.monthly}</small>
            ${oneDayBadgeHTML}
          </div>
          ${featuresHTML}
        </div>
        <button class="cta-button ${ctaButtonClass}">
          ${translations.plan_page.get_started} <i class="bi bi-arrow-right-short ms-1"></i>
        </button>
      </div>
    </div>
  `;
}

// Function to render comparison table
function renderComparisonTable(featuresData, plans) { // featuresData might not be directly used if static
  const tableBody = $('#planComparisonTable tbody');
  tableBody.empty();
  
  const comparisonData = [
    { feature: translations.plan_page.comparison_feature_1, free: '✓', oneDay: '✓', premium: '✓', highlight: false },
    { feature: translations.plan_page.comparison_feature_2, free: '✓', oneDay: '✓', premium: '✓', highlight: false },
    { feature: translations.plan_page.comparison_feature_3, free: '✗', oneDay: '✓', premium: '✓', highlight: true },
    { feature: translations.plan_page.comparison_feature_4, free: '✗', oneDay: '✓', premium: '✓', highlight: true },
    { feature: translations.plan_page.comparison_feature_5, free: '✗', oneDay: '✓', premium: '✓', highlight: true },
    { feature: translations.plan_page.comparison_feature_6, free: '✗', oneDay: '✓', premium: '✓', highlight: false },
    { feature: translations.plan_page.comparison_feature_7, free: '✗', oneDay: '✓', premium: '✓', highlight: false },
    { feature: translations.plan_page.comparison_feature_8, free: '✗', oneDay: '✗', premium: '✓', highlight: true }
  ];
  
  comparisonData.forEach(item => {
    const rowClass = item.highlight ? 'highlight-row' : '';
    const checkIcon = '<i class="bi bi-check-circle-fill text-success"></i>';
    const timesIcon = '<i class="bi bi-x-circle-fill text-danger"></i>';
    const row = `
      <tr class="${rowClass}">
        <td>${item.feature}</td>
        <td>${item.free === '✓' ? checkIcon : timesIcon}</td>
        <td>${item.oneDay === '✓' ? checkIcon : timesIcon}</td>
        <td>${item.premium === '✓' ? checkIcon : timesIcon}</td>
      </tr>
    `;
    tableBody.append(row);
  });
}


// Function to create a checkout session
function createCheckoutSession(billingCycle) {
  $.ajax({
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
                billingCycle :response.billingCycle
            })
            .done(function(data) {
                const newPlan = data.newPlan;
                const planName = newPlan.name;
                console.log('Upgrade successful:', planName);
                
                Swal.fire({
                  icon: 'success',
                  title: translations.upgrade_successful,
                  text: `${translations.new_plan}: ${planName}`,
                  showCloseButton: true
                });
            })
            .fail(function(xhr, status, error) {
                console.error('Error upgrading plan:', error);
                const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : translations.plan_page.upgrade_error; // Use new translation key
                Swal.fire({
                    icon: 'error',
                    title: translations.error, // Use new translation key
                    text: errorMessage,
                    confirmButtonText: 'OK'
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
          showCloseButton: true
        });
      } else {
        Swal.fire({
          title: translations.error_occurred,
          text: translations.subscription_creation_failed,
          icon: 'error',
          showCloseButton: true
        });
      }
    }
  });
}

  fetchPlans();

  $('#plan-switch').on('change', function() {
    // This switch functionality might need re-evaluation if plans are fetched with yearly/monthly prices directly.
    // For now, assuming it's for a client-side toggle that's not fully implemented with fetched plans.
    const planCardsContainer = $('#planCards');
    planCardsContainer.empty();
    const isYearly = $(this).is(':checked');
    
      if (isYearly) {
        // plan.price = plan.yearly; // This 'plan' variable is not defined in this scope correctly for this logic
      } else {
        // plan.price = plan.monthly;
      }
    // renderPlans(plan); // This would require 'plan' to be an array of plans
    fetchPlans(); // Re-fetch plans might be simpler if backend handles yearly/monthly pricing
  });
});
