
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("plan-switch").checked = true; 
});
$(document).ready(function () {

  const messages = {
    ja: [
      "新しい画像が作成されました！",
      "新しいキャラクターが作成されました！",
      "ギャラリーに画像が追加されました！",
      "人気のポーズで画像が生成されました！",
      "リアル風のキャラクターが生成されました！"
    ],
    en: [
      "A new image has been created!",
      "A new character has been created!",
      "An image has been added to the gallery!",
      "An image has been generated with a popular pose!",
      "A realistic character has been generated!"
    ],
    fr: [
      "Une nouvelle image a été créée !",
      "Un nouveau personnage a été créé !",
      "Une image a été ajoutée à la galerie !",
      "Une image a été générée avec une pose populaire !",
      "Un personnage réaliste a été généré !"
    ]
  };

  const selectedMessages = messages[lang[0]] || messages.en;


    let messageIndex = 0;

    function showNextNotification() {
        const message = selectedMessages[messageIndex];
        showNotification(message, "success");

        // Increment index and loop back to start if needed
        messageIndex = (messageIndex + 1) % messages.length;

        // Schedule the next notification with a random interval between 5 and 10 seconds
        setTimeout(showNextNotification, Math.random() * (20000 - 10000) + 10000);
    }

    // Start the notification loop
    //setTimeout(showNextNotification, Math.random() * (20000 - 10000) + 10000);
});


$(document).ready(function() {
  searchImages();
  let plan = {};
  let stripe
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
      success: function(response) {
        const isYearly = $('#plan-switch').is(':checked');
        plan = response
        if (isYearly) {
            plan.price = plan.yearly;
        } else {
            plan.price = plan.monthly;
        }
        renderPlans(plan);
      },
      error: function(xhr, status, error) {
        console.error('Failed to fetch plans:', error);
      }
    });
  }

  // Function to render plans
  function renderPlans(plan) {
    
    const planCardsContainer = $('#planCards');
        
        let plan_icon
            switch (plan.id) {
            case 'free':
                plan_icon = `<span class="m-1">&#x1F381;</span>`;
                break;
            case 'premium':
                plan_icon = `<span class="m-1"> &#x1F48E;</span>`;
                break;
            case 'special':
                plan_icon = ` <span class="m-1">&#x1F525;</span>`;
                break;
            default:
                plan_icon = ``;
            }
        
        const isYearly =  $('#plan-switch').is(':checked') ? `yearly` : 'monthly';
        const planCard = `
            <div class="plan-card card mb-3 px-1 ${plan.name == '無制限プラン'? 'col-12 col-lg-4':'col-10 col-lg-auto'} ${plan.name == '無制限プラン'? 'best':''}  m-2">
            <div class="card-header plan-header bg-white">
                <h2>${plan_icon}${plan.name}${plan_icon}</h2>
            </div>
            <div class="card-body px-1">
                <div class="plan-price">
                <h3>${plan.price}</h3>
                </div>
                <div class="plan-details px-0 pb-0">
                <ul class="list-group list-group-flush">
                    ${plan.features.map(feature => `<li class="list-group-item" style="font-size: 16px;">${feature}</li>`).join('')}
                </ul>
                </div>
            </div>
            <div class="card-footer bg-transparent ${plan.price == '無料'? 'd-none':''}">
              <div class="py-3">
                  ${user.isTemporary 
                      ? `<a href="/authenticate" class="btn btn-lamix custom-gradient-bg border-0">${translations.try_for_free}</a>` 
                      : `<button class="plan-button btn btn-lamix border-0 subscribe-button" data-billing-cycle="${isYearly}">${translations.start_with_this_plan}</button>`
                  }
              </div>
            </div>
            </div>
        `;
        planCardsContainer.append(planCard);

    // Add event listener to subscribe buttons
    $('.subscribe-button').on('click', function() {
      const billingCycle = $(this).data('billing-cycle');
      createCheckoutSession(billingCycle);
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
                
                // SweetAlert2 for successful upgrade
                Swal.fire({
                  icon: 'success',
                  title: translations.upgrade_successful,
                  text: `${translations.new_plan}: ${planName}`,
                  showCloseButton: true
                });
            })
            .fail(function(xhr, status, error) {
                console.error('Error upgrading plan:', error);
                
                // Extract error message from response or use a default one
                const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : 'プランのアップグレード中にエラーが発生しました';

                // SweetAlert2 for upgrade error
                Swal.fire({
                    icon: 'error',
                    title: 'エラー',
                    text: errorMessage,
                    confirmButtonText: 'OK'
                });
            });

            return
        }
      // Redirect the user to the Stripe Checkout page
      window.location.href = response.url;
    },
    error: function(xhr, status, error) {
      console.error('Failed to create subscription:', error);
      
      // Check if the error indicates the user is already subscribed
      if (xhr.responseJSON && xhr.responseJSON.error === 'You already have an active subscription for this plan.') {
        // Display SweetAlert2 message in Japanese
        Swal.fire({
          title: translations.already_subscribed,
          text: translations.already_subscribed_message,
          icon: 'warning',
          showCloseButton: true
        });
      } else {
        // Handle other errors, e.g., display a generic error message
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


  // Fetch and render the plans
  fetchPlans();

  $('#plan-switch').on('change', function() {
    const planCardsContainer = $('#planCards');
    planCardsContainer.empty();
    const isYearly = $(this).is(':checked');
    
      if (isYearly) {
        plan.price = plan.yearly;
      } else {
        plan.price = plan.monthly;
      }
    renderPlans(plan);
  });

   // Parse the URL and get query parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if 'cancel-payment' parameter is true
    if (urlParams.get('cancel-payment') === 'true') {
        // Display SweetAlert2 in Japanese
        Swal.fire({
          title: translations.payment_cancelled,
          text: translations.payment_not_completed,
          icon: 'info',
          showCloseButton: true
        });
        var currentUrl = window.location.href;
        var urlParts = currentUrl.split('?');
        urlParts[urlParts.length - 1] = '';
        var newUrl = urlParts.join('');
        if($('#chat-widget-container').length == 0){
            window.history.replaceState({ path: newUrl }, '', newUrl);
        }
    }
});
