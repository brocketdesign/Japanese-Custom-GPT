$(document).ready(function() {
  // NSFW toggle logic with premium check
  const nsfwToggle = $('#nsfw-toggle');
    
  nsfwToggle.prop('checked', window.showNSFW);

  // Check subscription status and setup premium restrictions
  const user = window.user || {};
  const subscriptionStatus = user.subscriptionStatus === 'active';
  
  if (!subscriptionStatus) {
    // Non-premium users: disable toggle and show premium indicator
    nsfwToggle.prop('disabled', true);
    nsfwToggle.closest('.settings-switch').addClass('disabled');
    $('#nsfw-premium-icon').show();
    $('#nsfw-premium-indicator').show();
    
    // Force NSFW to false for non-premium users
    if (window.showNSFW) {
      nsfwToggle.prop('checked', false);
      updateNSFWPreference(false);
    }
    
    // Show upgrade popup when clicked
    nsfwToggle.closest('.settings-switch').on('click', function(e) {
      e.preventDefault();
      if (typeof loadPlanPage === 'function') {
        loadPlanPage();
      } else {
        window.location.href = '/plan';
      }
    });
  } else {
    // Premium users: enable toggle normally
    $('#nsfw-premium-icon').hide();
    $('#nsfw-premium-indicator').hide();
  }

  // API section premium restriction
  if (subscriptionStatus) {
    // Premium users: show API content
    $('#api-premium-content').show();
    $('#api-premium-required').hide();
  } else {
    // Non-premium users: show premium required card
    $('#api-premium-content').hide();
    $('#api-premium-required').show();
  }

  // Save toggle state to session storage on change (only for premium users)
  nsfwToggle.on('change', function() {
    if (!subscriptionStatus && this.checked) {
      // Prevent non-premium users from enabling NSFW
      this.checked = false;
      if (typeof loadPlanPage === 'function') {
        loadPlanPage();
      } else {
        window.location.href = '/plan';
      }
      return;
    }
    
    toggleNSFWContent();
    updateNSFWPreference(this.checked); // Call the new function here
  });

  // Function to update NSFW preference
  function updateNSFWPreference(showNSFW) {
    // Use user._id from window.user, fallback to data attribute
    const currentUserId = (window.user && window.user._id) || $('#profile #profileSection').data('user-id');
    
    if (!currentUserId) {
      console.error('Error updating NSFW preference: User ID not available');
      nsfwToggle.prop('checked', !showNSFW);
      showNotification(translations.errorOccurred || 'Error occurred', 'error');
      return;
    }
    
    $.ajax({
      url: '/user/update-nsfw-preference/' + currentUserId,
      method: 'POST',
      data: { showNSFW: showNSFW },
      success: function(response) {
        // Optionally, update the global user object
        user.showNSFW = showNSFW;
      },
      error: function(jqXHR) {
        console.error('Error updating NSFW preference:', jqXHR.responseJSON?.error || 'Unknown error');
        // Optionally, revert the toggle state in case of an error
        nsfwToggle.prop('checked', !showNSFW);
        showNotification(translations.errorOccurred || 'Error occurred', 'error');
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

  // Handle section navigation
  $(document).on('click', '.settings-nav-item', function() {
    const section = $(this).data('section');
    
    // Update active nav item
    $('.settings-nav-item').removeClass('active');
    $(this).addClass('active');
    
    // Update active section
    $('.settings-section').removeClass('active');
    $('#section-' + section).addClass('active');
    
    // Load connections when switching to connections section
    if (section === 'connections') {
      console.log('[Settings] Switched to connections section');
      if (window.SocialConnections && typeof window.SocialConnections.loadConnections === 'function') {
        window.SocialConnections.loadConnections();
      }
    }
    
    // Load API keys when switching to API section
    if (section === 'api') {
      console.log('[Settings] Switched to API section');
      loadApiKeys();
    }
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
      
      // Show the premium features promo section after cancellation
      $('#no-subscription-section').show();
      $('#active-subscription-section').hide();
      $('#cancel-plan').hide();
      $('#user-plan').hide();
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
      // Hide the no-subscription promo section for active subscribers
      $('#no-subscription-section').hide();
      $('#active-subscription-section').show();
      
      if (data.plan.subscriptionType === 'day-pass') {
        $('#user-plan').hide();
        $('#cancel-plan').hide();
        $('#day-pass-countdown-section').show();
        $('#day-pass-expired-message').hide();
        $('#active-subscription-section').hide(); // Hide active section for day pass (show countdown instead)

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
            $('#no-subscription-section').show(); // Show promo when day pass expires
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
        
        // Update active subscription section with dates
        $('#subscription-start-date').text(moment(subscriptionStartDate).locale(lang).format('LL'));
        $('#subscription-renewal-date').text(moment(subscriptionEndDate).locale(lang).format('LL'));
        
        // It's important that '/plan/list/:id' route in plan.js returns the correct plan details by its ID (billingCycle)
        // The original code used data.plan.billingCycle as the ID for /plan/list/
        // Assuming billingCycle (e.g., '12-months') is the ID of the plan details
        $.get('/plan/list/' + billingCycle, function(planData) {
          if (planData && planData.plan) {
            // Update the plan name in the active subscription section
            $('#active-plan-name').text(planData.plan.name);
            
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
            $('#user-plan').html(message).hide(); // Hide the old message, using new section instead
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
        $('#no-subscription-section').show();
        $('#active-subscription-section').hide();
        $('#user-plan').hide();
        $('#cancel-plan').hide();
        $('#day-pass-countdown-section').hide();
      }
    } else { // No plan record found or plan is not active (e.g. expired, cancelled)
      console.log('[Settings] No active plan found for user:', user._id);
      $('#no-subscription-section').show();
      $('#active-subscription-section').hide();
      $('#user-plan').hide();
      $('#cancel-plan').hide();
      $('#day-pass-countdown-section').hide();
    }
  }).fail(function(xhr, status, error) {
    console.error('[Settings] Error fetching user plan data:', error, xhr.responseText);
    $('#no-subscription-section').show();
    $('#active-subscription-section').hide();
    $('#user-plan').hide();
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

  // ==========================================
  // API Keys Management
  // ==========================================
  
  // Load API keys initially if API section is active
  if ($('#section-api').hasClass('active')) {
    loadApiKeys();
  }
});

/**
 * Load user's API keys
 */
async function loadApiKeys() {
  const container = $('#apiKeysList');
  
  try {
    const response = await fetch('/api/user/api-keys');
    const data = await response.json();
    
    if (data.success && data.keys) {
      if (data.keys.length === 0) {
        container.html(`
          <div class="text-center p-4 text-muted">
            <i class="bi bi-key display-4 mb-3"></i>
            <p>No API keys yet. Create one to get started.</p>
          </div>
        `);
      } else {
        const keysHtml = data.keys.map(key => `
          <div class="api-key-item d-flex align-items-center justify-content-between p-3 mb-2 rounded" 
               style="background: rgba(255,255,255,0.05); border: 1px solid rgba(130, 64, 255, 0.2);">
            <div class="key-info">
              <div class="fw-semibold text-white">${escapeHtml(key.name)}</div>
              <code class="text-muted small">${key.keyPreview}</code>
              <div class="small text-muted mt-1">
                Created: ${new Date(key.createdAt).toLocaleDateString()}
                ${key.lastUsedAt ? ` • Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}` : ''}
                ${key.usageCount ? ` • Used ${key.usageCount} times` : ''}
              </div>
            </div>
            <div class="key-actions d-flex gap-2">
              <span class="badge ${key.active ? 'bg-success' : 'bg-secondary'}">${key.active ? 'Active' : 'Inactive'}</span>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteApiKey('${key._id}')" title="Delete key">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        `).join('');
        
        container.html(keysHtml);
      }
    } else {
      container.html(`
        <div class="text-center p-4 text-danger">
          <i class="bi bi-exclamation-triangle display-4 mb-3"></i>
          <p>Failed to load API keys</p>
        </div>
      `);
    }
  } catch (error) {
    console.error('[Settings] Error loading API keys:', error);
    container.html(`
      <div class="text-center p-4 text-danger">
        <i class="bi bi-exclamation-triangle display-4 mb-3"></i>
        <p>Failed to load API keys</p>
      </div>
    `);
  }
}

/**
 * Create a new API key
 */
async function createNewApiKey() {
  const result = await Swal.fire({
    title: 'Create New API Key',
    input: 'text',
    inputLabel: 'Key Name (optional)',
    inputPlaceholder: 'e.g., My App Integration',
    showCancelButton: true,
    confirmButtonText: 'Create Key',
    confirmButtonColor: '#6E20F4'
  });

  if (result.isConfirmed) {
    const btn = document.getElementById('createApiKeyBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.value || undefined })
      });

      const data = await response.json();

      if (data.success) {
        // Show the API key in a modal (only shown once!)
        await Swal.fire({
          title: 'API Key Created!',
          html: `
            <div class="text-start">
              <p class="text-warning mb-3">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Important:</strong> Copy this key now. It will not be shown again!
              </p>
              <div class="p-3 rounded mb-3" style="background: rgba(0,0,0,0.3);">
                <code id="newApiKey" style="word-break: break-all; font-size: 14px;">${data.key.apiKey}</code>
              </div>
              <button class="btn btn-sm btn-outline-primary" onclick="copyApiKey()">
                <i class="bi bi-clipboard me-1"></i>Copy to Clipboard
              </button>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'I\'ve copied the key',
          confirmButtonColor: '#6E20F4'
        });

        // Reload the keys list
        loadApiKeys();
      } else {
        throw new Error(data.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('[Settings] Error creating API key:', error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>Create New API Key';
    }
  }
}

/**
 * Copy API key to clipboard
 */
function copyApiKey() {
  const keyElement = document.getElementById('newApiKey');
  if (keyElement) {
    navigator.clipboard.writeText(keyElement.textContent).then(() => {
      showNotification('API key copied to clipboard!', 'success');
    });
  }
}

/**
 * Delete an API key
 */
async function deleteApiKey(keyId) {
  const result = await Swal.fire({
    title: 'Delete API Key?',
    text: 'This action cannot be undone. Any applications using this key will stop working.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it',
    confirmButtonColor: '#dc3545',
    cancelButtonText: 'Cancel'
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(`/api/user/api-keys/${keyId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        showNotification('API key deleted successfully', 'success');
        loadApiKeys();
      } else {
        throw new Error(data.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('[Settings] Error deleting API key:', error);
      Swal.fire('Error', error.message, 'error');
    }
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}