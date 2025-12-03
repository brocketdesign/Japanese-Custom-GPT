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
        const dayPassPlans = plans.filter(plan => plan.isOneTime);
        const subscriptionPlans = plans.filter(plan => !plan.isOneTime);
        
        // Render features and plans into the new layout
        renderFeatures(features || []);
        renderBottomPlanList(subscriptionPlans, dayPassPlans);
        // keep comparison rendering optional (removed from UI)
      },
      error: function(xhr, status, error) {
        console.error('Failed to fetch plans:', error);
      }
    });
  }

  // New: render top features area (concise, mobile-friendly)
  function renderFeatures(features) {
    console.log('Rendering features:', features);
    const $extra = $('#additionalFeatures');
    $extra.empty();
    // If server provides features array, use it; otherwise do nothing (we already have 3 core features in template)
    if (Array.isArray(features) && features.length) {
      features.forEach(f => {
        const el = $(`
          <div class="feature-item">
            <i class="${f.icon || 'bi bi-star'}"></i>
            <div>
              <div class="fw-bold">${f.title || f.name}</div>
              <div class="text-muted small">${f.description || ''}</div>
            </div>
          </div>
        `);
        $extra.append(el);
      });
    }
  }

  // New: render plans into sticky bottom horizontally scrollable list
  function renderBottomPlanList(subscriptionPlans, dayPassPlans) {
    const $container = $('#planListBottom');
    $container.empty();

    // combine day pass first (if any) then subscriptions
    const allPlans = [...dayPassPlans, ...subscriptionPlans];

    allPlans.forEach((plan) => {
      const isOneTime = !!plan.isOneTime;
      const badge = isOneTime ? `<span class="badge bg-info ms-2">${translations.one_time}</span>` : '';
      const priceLine = `<div class="price">${plan.price}${isOneTime ? '' : `<span class="meta"> / ${translations.monthly}</span>`}</div>`;
      const discount = plan.discount ? `<div class="meta small text-danger">${plan.discount}</div>` : '';
      const name = `<div class="name">${plan.name} ${badge}</div>`;
      const meta = `<div class="meta">${plan.shortDescription || ''}</div>`;

      const card = $(`
        <div class="plan-compact" data-plan-id="${plan.id}">
          <div>
            ${name}
            ${priceLine}
            ${discount}
            ${meta}
          </div>
          <button class="cta" data-plan-id="${plan.id}">${translations.plan_page.get_started}</button>
        </div>
      `);
      $container.append(card);
    });

    // Touch / click handlers: subscribe on CTA or card tap
    $container.find('.cta, .plan-compact').on('click', function(e) {
      e.stopPropagation();
      const pid = $(this).closest('.plan-compact').data('plan-id') || $(this).data('plan-id');
      if (!pid) return;
      // provide small visual feedback
      const $card = $(this).closest('.plan-compact');
      $card.css('transform','scale(0.98)');
      setTimeout(()=> $card.css('transform',''), 140);
      // Update text of the CTA and disable to prevent multiple clicks
      $card.find('.cta').text(translations.plan_page.processing || 'Processing...').attr('disabled', true);
      // Also disable other CTAs & prevent multiple clicks
      $container.find('.cta').not($card.find('.cta')).attr('disabled', true);
      // Proceed to create checkout session
      createCheckoutSession(pid);
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

  // Keep plan-switch behavior but simplified to re-fetch
  $('#plan-switch').on('change', function() {
    fetchPlans();
  });
});
