$(document).ready(function() {
  // Initialize flatpickr for birthdate
  flatpickr("#birthdate", {
    locale: "ja",
    dateFormat: "Y年m月d日",
    maxDate: new Date(),
    defaultDate: new Date(new Date().setFullYear(new Date().getFullYear() - 18)),
    onChange: function(selectedDates, dateStr, instance) {
      const dateParts = dateStr.match(/(\d{4})年(\d{2})月(\d{2})日/);
      const birthYear = dateParts[1];
      const birthMonth = dateParts[2];
      const birthDay = dateParts[3];

      $('#birthYear').val(birthYear);
      $('#birthMonth').val(birthMonth);
      $('#birthDay').val(birthDay);
    }
  });

  // Set user info
  $('#profile #profileSection').attr('data-user-id', user._id);

  // Set user email
  $('#inputEmail4').val(user.email);

  // Set user nickname
  $('#nickname').val(user.nickname);

  // Set user birthdate field
  if(user.birthDate){
    $('#birthdate').val(`${user.birthDate.year}年${user.birthDate.month}月${user.birthDate.day}日`);
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
    formData.append('birthYear', $('#birthYear').val());
    formData.append('birthMonth', $('#birthMonth').val());
    formData.append('birthDay', $('#birthDay').val());
    formData.append('gender', $('#gender').val());
    formData.append('bio', $('#bio').val());

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
    console.log('[Settings] User plan data fetched:', data);
    let message = `${translations.no_subscription}<br> <button class="btn custom-gradient-bg" onclick="loadPlanPage()">${translations.select_plan_here}</button>`;

    if (dayPassCountdownInterval) {
      clearInterval(dayPassCountdownInterval); // Clear any existing interval
      dayPassCountdownInterval = null;
      console.log('[Settings] Cleared existing day pass countdown interval.');
    }

    if(data.plan && data.plan.subscriptionStatus === 'active'){
      if (data.plan.subscriptionType === 'day-pass') {
        console.log('[Settings] Active day pass detected for user:', user._id);
        $('#user-plan').hide();
        $('#cancel-plan').hide();
        $('#day-pass-countdown-section').show();
        $('#day-pass-expired-message').hide();

        const endDate = new Date(data.plan.subscriptionEndDate).getTime();
        console.log('[Settings] Day pass expiry date:', new Date(data.plan.subscriptionEndDate));

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
        console.log('[Settings] Day pass countdown started.');

      } else if (data.plan.subscriptionType === 'subscription') {
        console.log('[Settings] Active subscription detected for user:', user._id, 'Billing Cycle:', data.plan.billingCycle);
        $('#day-pass-countdown-section').hide(); // Ensure countdown is hidden
        const billingCycle = data.plan.billingCycle;
        const subscriptionEndDate = new Date(data.plan.subscriptionEndDate);
        const subscriptionStartDate = new Date(data.plan.subscriptionStartDate);
        
        // It's important that '/plan/list/:id' route in plan.js returns the correct plan details by its ID (billingCycle)
        // The original code used data.plan.billingCycle as the ID for /plan/list/
        // Assuming billingCycle (e.g., '12-months') is the ID for the plan details
        $.get('/plan/list/' + billingCycle, function(planData) {
          if (planData && planData.plan) {
            console.log('[Settings] Fetched plan details for subscription:', planData.plan.name);
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

  // Display user limits
  $.get('/user/limit/'+user._id,function(data){
    data = data.limits
    $('#user-limit').html(`
    <ul class="list-group">
      <li class="list-group-item">
        <i class="fa fa-comment me-2"></i>
        ${data.messageCountDoc ? data.messageCountDoc.count : 0}/${data.messageLimit}
      </li>
      <li class="list-group-item">
        <i class="fas fa-lightbulb me-2"></i>
        ${data.messageIdeasCountDoc? data.messageIdeasCountDoc.count : 0}/${data.messageIdeasLimit}
      </li>
      <li class="list-group-item">
        <i class="fa fa-image me-2"></i>
        ${data.imageCountDoc? data.imageCountDoc.count : 0}/${data.imageLimit}
      </li>
    </ul>
    `)
  })
});
