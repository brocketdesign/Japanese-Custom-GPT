$(document).ready(function () {

const messages = {
  ja: [
    "新規ユーザー：「プレミアムプランで毎日のチャットが無制限になりました！」",
    "東京から：「高品質画像作成がこんなに簡単だったなんて！」",
    "3分前：新しいユーザーがプレミアムに登録しました",
    "大阪から：「キャラクターの作成機能が最高です！」",
    "1分前：5人のユーザーがサブスクリプションを開始しました"
  ],
  en: [
    "New user: \"Unlimited daily chats with Premium plan!\"",
    "From Tokyo: \"Creating high-quality images is so easy now!\"",
    "3 minutes ago: New user subscribed to Premium",
    "From New York: \"The character creation feature is amazing!\"",
    "1 minute ago: 5 users started their subscription"
  ],
  fr: [
    "Nouvel utilisateur : \"Conversations quotidiennes illimitées avec le plan Premium !\"",
    "De Paris : \"Créer des images de haute qualité est maintenant si facile !\"",
    "Il y a 3 minutes : Un nouvel utilisateur s'est abonné au Premium",
    "De Lyon : \"La fonction de création de personnages est incroyable !\"",
    "Il y a 1 minute : 5 utilisateurs ont commencé leur abonnement"
  ]
};

  const selectedMessages = messages[lang[0]] || messages.en;


    let messageIndex = 0;

    function showNextNotification() {
        const message = selectedMessages[messageIndex];
        showNotification(message, "success");

        // Increment index and loop back to start if needed
        messageIndex = (messageIndex + 1) % selectedMessages.length; // Corrected: use selectedMessages.length

        // Schedule the next notification with a random interval between 5 and 10 seconds
        setTimeout(showNextNotification, Math.random() * (20000 - 10000) + 10000);
    }

    // Start the notification loop
    setTimeout(showNextNotification, 5000); // Start after 5 seconds
});


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
      url: `/plan/list?lang=${lang}`,//?update=true
      dataType: 'json',
      success: function({plans,features}) {
        renderPlans(plans);
        // renderFeaturesList(features); // This function seems to be unused in the new layout, plan cards will have features
        renderComparisonTable(features, plans); // Call to render comparison table
      },
      error: function(xhr, status, error) {
        console.error('Failed to fetch plans:', error);
      }
    });
  }

// Function to render plans with improved styling and info
function renderPlans(plans) {
  const planCardsContainer = $('#planCards');
  planCardsContainer.empty();
  
  plans.forEach((plan, index) => {
    let gradientClass = 'standard-gradient'; // Default
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
    } else if (index === 0 && plans.length > 2) { // Assuming the first of multiple non-premium, non-onetime is 'basic'
        gradientClass = 'basic-gradient';
        ctaButtonClass = 'basic';
    }
    // If only one non-premium, non-onetime plan, it might be 'standard' or 'basic' depending on your naming.
    // The logic above tries to assign basic, standard, premium, oneday gradients.

    const isOneTimeBadge = plan.isOneTime ? `<span class="badge bg-info ms-2">${translations.one_time}</span>` : '';
    const priceSuffix = plan.isOneTime ? '' : `<span class="text-muted" style="font-size:11px;">${translations.currency}${translations.monthly}</span>`;
    
    // Features list specific to plan type - using Bootstrap icons
    let featuresHTML = '';
    if (isPremium) {
      featuresHTML = `
        <ul class="plan-features">
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.premium_feature_1}</li>
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.premium_feature_2}</li>
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.premium_feature_3}</li>
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.premium_feature_4_new || 'Early Access to New Features'}</li>
        </ul>`;
    } else if (isOneDay) {
      featuresHTML = `
        <ul class="plan-features">
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.oneday_feature_1}</li>
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.oneday_feature_2}</li>
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.oneday_feature_3}</li>
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.oneday_feature_4_new || 'Full Access for 24 Hours'}</li>
        </ul>`;
    } else { // For Basic or Standard plans
      featuresHTML = `
        <ul class="plan-features">
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.standard_feature_1}</li>
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.standard_feature_2}</li>
          <li><i class="bi bi-check-circle-fill"></i> ${translations.plan_page.standard_feature_3}</li>
        </ul>`;
    }
    
    const planCardHTML = `
      <div class="col-lg-4 col-md-6">
        <div class="plan-card p-4 text-white cursor-pointer ${gradientClass}" style="border-radius: 15px; height: 100%;" data-plan-id="${plan.id}" data-billing-cycle="${plan.id}">
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
    
    planCardsContainer.append(planCardHTML);
  });  
  
  $('.plan-card').on('click', function() {
    const billingCycle = $(this).data('billing-cycle');
    createCheckoutSession(billingCycle);
  });
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
