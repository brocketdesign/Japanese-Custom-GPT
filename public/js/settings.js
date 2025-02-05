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

  // Set user email
  $('#inputEmail4').val(user.email);

  // Set user nickname
  $('#nickname').val(user.nickname);

  // Set user birthdate field
  $('#birthdate').val(`${user.birthDate.year}年${user.birthDate.month}月${user.birthDate.day}日`);

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
    $('#profileImage').attr('src', user.profileUrl).show();
  }

  $('#profileImage').parent().click(function() {
    $('#profileImageInput').click();
  });

  $('#profileImageInput').change(function(event) {
    const reader = new FileReader();
    reader.onload = function(e) {
      $('#profileImage').attr('src', e.target.result).show();
    }
    reader.readAsDataURL(event.target.files[0]);
  });

  // User Info Form Submission
  $('#user-info-form').submit(function(event) {
    event.preventDefault();

    const formData = new FormData();
    formData.append('email', $('#inputEmail4').val());
    formData.append('nickname', $('#nickname').val());
    formData.append('birthYear', $('#birthYear').val());
    formData.append('birthMonth', $('#birthMonth').val());
    formData.append('birthDay', $('#birthDay').val());
    formData.append('gender', $('#gender').val());
    formData.append('bio', $('#bio').val());

    const profileImage = $('#profileImageInput')[0].files[0];
    if (profileImage) {
      formData.append('profile', profileImage);
    }

    $.ajax({
      url: '/user/update-info',
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
    const userId = $(this).data('user-id');    
    $.post('/plan/cancel', { userId }, function(response) {
      Swal.fire({
        icon: 'success',
        title: 'キャンセル完了',
        text: response.message,
        confirmButtonText: 'OK'
      });
      let message = `${translations.no_subscription}<br> <button class="btn custom-gradient-bg" onclick="loadPlanPage()">${translations.select_plan_here}</button>`
      $('#cancel-plan').hide()
      $('#user-plan').html(message).show()
      updatePlanStatus(user)
    }).fail(function(xhr) {
      let errorMessage = xhr.responseJSON.error || 'サーバーエラーが発生しました';
      Swal.fire({
        icon: 'error',
        title: 'エラー',
        text: errorMessage,
        confirmButtonText: 'OK'
      });
    });
  });

  // Display user plan
  $.get('/user/plan/'+user._id,function(data){
    let message = `${translations.no_subscription}<br> <button class="btn custom-gradient-bg" onclick="loadPlanPage()">${translations.select_plan_here}</button>`

    if(data.plan){
      const billingCycle = data.plan.billingCycle
      const subscriptionEndDate = new Date(data.plan.subscriptionEndDate)
      const subscriptionStartDate = new Date(data.plan.subscriptionStartDate)
      $.get('/plan/list/'+billingCycle, function(planData){
        message = `<span class="fw-bold">${planData.plan.name}</span><br>
             <span style="font-size:12px;">${translations.plan_page.subscription_start_date}: ${moment(subscriptionStartDate).locale(lang).format('LL')}</span><br>
             <span style="font-size:12px;">${translations.plan_page.subscription_renewal_date}: ${moment(subscriptionEndDate).locale(lang).format('LL')}</span>`
        $('#user-plan').html(message).show()
        $('#cancel-plan').show()
      })

      return
    }
    if(!data.plan){
      console.log('no plan')
      $('#user-plan').html(message).show()
      return
    }
  })

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
