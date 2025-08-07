$(document).ready(function() {
  // NSFW toggle logic
  const nsfwToggle = $('#nsfw-toggle');
    
  nsfwToggle.prop('checked', window.showNSFW);

  // Save toggle state to session storage on change
  nsfwToggle.on('change', function() {
    toggleNSFWContent();
    updateNSFWPreference(this.checked); // Call the new function here
  });

  // Function to update NSFW preference
  function updateNSFWPreference(showNSFW) {
    const currentUserId = $('#profile #profileSection').data('user-id');
    $.ajax({
      url: '/user/update-nsfw-preference/' + currentUserId,
      method: 'POST',
      data: { showNSFW: showNSFW },
      success: function(response) {
        // Optionally, update the global user object
        user.showNSFW = showNSFW;
      },
      error: function(jqXHR) {
        console.error('Error updating NSFW preference:', jqXHR.responseJSON.error);
        // Optionally, revert the toggle state in case of an error
        nsfwToggle.prop('checked', !showNSFW);
        showNotification(translations.errorOccurred, 'error');
      }
    });
  }
  // Set user info
  $('#profile #profileSection').attr('data-user-id', user._id);

  // Set user email
  $('#inputEmail4').val(user.email);

  // Set user nickname
  $('#nickname').val(user.nickname);

  // Display user age range if available
  if(user.ageRange){
    const ageRangeLabels = {
      'below18': translations.setting?.below_18 || 'Below 18',
      '18-20': translations.setting?.age_18_20 || '18-20',
      '21-23': translations.setting?.age_21_23 || '21-23', 
      '24-26': translations.setting?.age_24_26 || '24-26',
      'above26': translations.setting?.above_26 || 'Above 26'
    };
    
    const ageRangeDisplay = ageRangeLabels[user.ageRange] || user.ageRange;
    $('#userAgeRange').text(ageRangeDisplay);
    $('#ageRangeSection').show();
  }

  // Set user gender
  if (user.gender) {
    $('#gender').val(user.gender);
  } 

  // Set user bio
  $('#bio').val(user.bio);
  function resizeTextarea(element){
      element.style.height = 'auto';
      element.style.height = (element.scrollHeight - 20 ) + 'px';  
  }
  resizeTextarea($('#bio')[0])
  if(user.profileUrl){
    $('#profile #profileImage').attr('src', user.profileUrl).show();
  }

  $('#profile #profileImage').parent().click(function() {
    $('#profile #profileImageInput').click();
  });

  $('#profile #profileImageInput').change(function(event) {
    const reader = new FileReader();
    reader.onload = function(e) {
      $('#profile #profileImage').attr('src', e.target.result).show();
    }
    reader.readAsDataURL(event.target.files[0]);
  });

  // User Info Form Submission
  $('#profile #user-info-form').submit(function(event) {
    event.preventDefault();
    const currentUserId = $('#profile #profileSection').data('user-id');

    const formData = new FormData();
    formData.append('email', $('#inputEmail4').val());
    formData.append('nickname', $('#nickname').val());
    // Remove birth date fields
    formData.append('gender', $('#gender').val());
    formData.append('bio', $('#bio').val());
    formData.append('showNSFW', $('#nsfw-toggle').is(':checked'));

    const profileImage = $('#profile #profileImageInput')[0].files[0];
    if (profileImage) {
      formData.append('profile', profileImage);
    }

    $.ajax({
      url: '/user/update-info/' + currentUserId,
      method: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: async function(response) {
        showNotification(translations.info_updated_successfully, 'success');
        user = await fetchUser();
        // Update user object with new showNSFW preference
        user.showNSFW = $('#nsfw-toggle').is(':checked');
      },
      error: function(jqXHR) {
        console.log(jqXHR.responseJSON.error)
        showNotification(translations.errorOccurred, 'error');
      }
    });

  });

  // User Password Form Submission
  $('#user-password-form').submit(function(event) {
    event.preventDefault();

    const passwordInfo = {
      oldPassword: $('#inputPassword4').val(),
      newPassword: $('#inputPassword5').val()
    };

    $.ajax({
      url: '/user/update-password',
      method: 'POST',
      data: passwordInfo,
      success: function(response) {
        Swal.fire({
          icon: 'success',
          title: '成功',
          text: response.status,
        });
      },
      error: function(jqXHR) {
        Swal.fire({
          icon: 'error',
          title: 'エラー',
          text: jqXHR.responseJSON.error,
        });
      }
    });
  });

  $('#cancel-plan').click(function(){
    closeAllModals();
    // Open the cancellation feedback modal
    const cancelSubscriptionModal = new bootstrap.Modal(document.getElementById('cancelSubscriptionModal'));
    cancelSubscriptionModal.show();
  });

  // Handle the actual cancellation after feedback
  $('#confirmCancelSubscriptionButton').click(function() {
    const feedbackText = $('#cancellationReason').val();
    const userId = $('#cancel-plan').data('user-id'); // Assuming cancel-plan button still holds user-id

    showNotification(translations.cancellation_initiated || 'Cancellation process started...', 'info');
    $('#confirmCancelSubscriptionButton').prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' + (translations.continue_cancellation_button || 'Processing...'));


    $.post('/plan/cancel-with-feedback', { userId: userId, feedbackText: feedbackText }, function(response) {
      const cancelSubscriptionModal = bootstrap.Modal.getInstance(document.getElementById('cancelSubscriptionModal'));
      cancelSubscriptionModal.hide();
      showNotification(response.message || translations.subscription_cancelled_successfully || 'Subscription cancelled successfully.', 'success');
      
      let message = `${translations.no_subscription}<br> <button class="btn custom-gradient-bg" onclick="loadPlanPage()">${translations.select_plan_here}</button>`;
      $('#cancel-plan').hide();
      $('#user-plan').html(message).show();
      updatePlanStatus(user); // Assuming user object is globally available and updated
      if (response.feedbackThanks) {
        showNotification(response.feedbackThanks, 'info');
      }
    }).fail(function(xhr) {
      const cancelSubscriptionModal = bootstrap.Modal.getInstance(document.getElementById('cancelSubscriptionModal'));
      cancelSubscriptionModal.hide();
      let errorMessage = (xhr.responseJSON && xhr.responseJSON.error) || translations.feedback_submission_error || 'An error occurred.';
      showNotification(errorMessage, 'error');
    }).always(function() {
        $('#confirmCancelSubscriptionButton').prop('disabled', false).text(translations.continue_cancellation_button || 'Continue Cancellation');
    });
  });


  let dayPassCountdownInterval = null; // Variable to store the interval ID

  // Display user plan
  $.get('/user/plan/'+user._id,function(data){
    let message = `${translations.no_subscription}<br> <button class="btn custom-gradient-bg" onclick="loadPlanPage()">${translations.select_plan_here}</button>`;

    if (dayPassCountdownInterval) {
      clearInterval(dayPassCountdownInterval); // Clear any existing interval
      dayPassCountdownInterval = null;
    }

    if(data.plan && data.plan.subscriptionStatus === 'active'){
      if (data.plan.subscriptionType === 'day-pass') {
        $('#user-plan').hide();
        $('#cancel-plan').hide();
        $('#day-pass-countdown-section').show();
        $('#day-pass-expired-message').hide();

        const endDate = new Date(data.plan.subscriptionEndDate).getTime();

        dayPassCountdownInterval = setInterval(function() {
          const now = new Date().getTime();
          const distance = endDate - now;

          if (distance < 0) {
            clearInterval(dayPassCountdownInterval);
            dayPassCountdownInterval = null;
            $('#hours').text('00');
            $('#minutes').text('00');
            $('#seconds').text('00');
            $('#day-pass-expired-message').show();
            $('#countdown-timer').addClass('text-muted').removeClass('text-primary'); // Optional: style expired timer
            console.log('[Settings] Day pass expired for user:', user._id);
            // Optionally, re-fetch plan status or guide user
            // updatePlanStatus(user); // If you have a function to refresh general plan status
            return;
          }

          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);

          $('#hours').text(hours < 10 ? '0' + hours : hours);
          $('#minutes').text(minutes < 10 ? '0' + minutes : minutes);
          $('#seconds').text(seconds < 10 ? '0' + seconds : seconds);
        }, 1000);

      } else if (data.plan.subscriptionType === 'subscription') {
        $('#day-pass-countdown-section').hide(); // Ensure countdown is hidden
        const billingCycle = data.plan.billingCycle;
        const subscriptionEndDate = new Date(data.plan.subscriptionEndDate);
        const subscriptionStartDate = new Date(data.plan.subscriptionStartDate);
        
        // It's important that '/plan/list/:id' route in plan.js returns the correct plan details by its ID (billingCycle)
        // The original code used data.plan.billingCycle as the ID for /plan/list/
        // Assuming billingCycle (e.g., '12-months') is the ID of the plan details
        $.get('/plan/list/' + billingCycle, function(planData) {
          if (planData && planData.plan) {
            message = `
              <div class="card mx-auto my-3 shadow-sm" style="max-width: 400px;">
              <div class="card-body text-center">
                <h5 class="card-title fw-bold mb-2">${planData.plan.name}</h5>
                <p class="card-text mb-1" style="font-size:13px;">
                <i class="fa fa-calendar me-1"></i>
                ${translations.plan_page.subscription_start_date}:<br>
                <span class="fw-semibold">${moment(subscriptionStartDate).locale(lang).format('LL')}</span>
                </p>
                <p class="card-text mb-2" style="font-size:13px;">
                <i class="fa fa-redo me-1"></i>
                ${translations.plan_page.subscription_renewal_date}:<br>
                <span class="fw-semibold">${moment(subscriptionEndDate).locale(lang).format('LL')}</span>
                </p>
              </div>
              </div>
            `;
            $('#user-plan').html(message).show();
            $('#cancel-plan').show();
          } else {
            console.error('[Settings] Could not fetch plan details for billing cycle:', billingCycle);
            $('#user-plan').html(translations.error_fetching_plan_details || 'Error loading plan details.').show(); // Provide a fallback translation
            $('#cancel-plan').show(); // Still show cancel if subscription is active
          }
        }).fail(function(xhr, status, error) {
            console.error('[Settings] Error fetching plan details for subscription:', billingCycle, error, xhr.responseText);
            $('#user-plan').html(translations.error_fetching_plan_details || 'Error loading plan details.').show();
            $('#cancel-plan').show();
        });
      } else {
        // Handles cases where plan exists but is not 'active' or unknown type
        console.log('[Settings] User has a plan record, but it is not an active day-pass or subscription. Plan:', data.plan);
        $('#user-plan').html(message).show(); // Show no subscription message
        $('#cancel-plan').hide();
        $('#day-pass-countdown-section').hide();
      }
    } else { // No plan record found or plan is not active (e.g. expired, cancelled)
      console.log('[Settings] No active plan found for user:', user._id);
      $('#user-plan').html(message).show();
      $('#cancel-plan').hide();
      $('#day-pass-countdown-section').hide();
    }
  }).fail(function(xhr, status, error) {
    console.error('[Settings] Error fetching user plan data:', error, xhr.responseText);
    let errorMessage = `${translations.no_subscription}<br> <button class="btn custom-gradient-bg" onclick="loadPlanPage()">${translations.select_plan_here}</button>`;
    $('#user-plan').html(errorMessage).show();
    $('#cancel-plan').hide();
    $('#day-pass-countdown-section').hide();
  });

  // Add onboarding restart button handler
  $('#restart-onboarding').on('click', function() {
    const userId = user._id;
    
    Swal.fire({
      title: window.onboardingTranslations?.skip_confirmation || 'Restart Onboarding?',
      text: 'This will guide you through the setup process again to personalize your experience.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: window.onboardingTranslations?.continue || 'Yes, restart',
      cancelButtonText: window.onboardingTranslations?.skip || 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Clear onboarding data
        localStorage.removeItem(`onboarding_${userId}`);
        
        // Reset user onboarding status
        $.ajax({
          url: `/user/${userId}/reset-onboarding`,
          method: 'POST',
          xhrFields: {
            withCredentials: true
          },
          success: function() {
            // Start onboarding
            if (window.OnboardingFunnel) {
              const onboarding = new OnboardingFunnel();
              onboarding.start();
            }
            showNotification(window.onboardingTranslations?.onboarding_complete || 'Onboarding restarted successfully!', 'success');
          },
          error: function() {
            showNotification('Failed to restart onboarding', 'error');
          }
        });
      }
    });
  });
});
  $('#restart-onboarding').on('click', function() {
    const userId = user._id;
    
    Swal.fire({
      title: window.onboardingTranslations?.skip_confirmation || 'Restart Onboarding?',
      text: 'This will guide you through the setup process again to personalize your experience.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: window.onboardingTranslations?.continue || 'Yes, restart',
      cancelButtonText: window.onboardingTranslations?.skip || 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Clear onboarding data
        localStorage.removeItem(`onboarding_${userId}`);
        
        // Reset user onboarding status
        $.ajax({
          url: `/user/${userId}/reset-onboarding`,
          method: 'POST',
          xhrFields: {
            withCredentials: true
          },
          success: function() {
            // Start onboarding
            if (window.OnboardingFunnel) {
              const onboarding = new OnboardingFunnel();
              onboarding.start();
            }
            showNotification(window.onboardingTranslations?.onboarding_complete || 'Onboarding restarted successfully!', 'success');
          },
          error: function() {
            showNotification('Failed to restart onboarding', 'error');
          }
        });
      }
    });
  });