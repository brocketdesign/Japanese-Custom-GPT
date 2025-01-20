$(document).ready(function() {

  // Populate years
  var currentYear = new Date().getFullYear();
  var startYear = 1900; // Adjust this to your preferred start year

  for (var year = currentYear; year >= startYear; year--) {
    $('#birthYear').append($('<option>', {
      value: year,
      text: year + '年'
    }));
  }

  // Populate months
  for (var month = 1; month <= 12; month++) {
    $('#birthMonth').append($('<option>', {
      value: month,
      text: month + '月'
    }));
  }

  // Populate days
  function populateDays(month, year) {
    $('#birthDay').empty().append($('<option>', {
      value: '',
      text: '日'
    }));

    var daysInMonth = new Date(year, month, 0).getDate();
    for (var day = 1; day <= daysInMonth; day++) {
      $('#birthDay').append($('<option>', {
        value: day,
        text: day + '日'
      }));
    }
  }

  // Populate days based on current month and year
  populateDays($('#birthMonth').val(), $('#birthYear').val());

  // Update days when month or year changes
  $('#birthMonth, #birthYear').change(function() {
    populateDays($('#birthMonth').val(), $('#birthYear').val());
  });

  // Set user email
  $('#inputEmail4').val(user.email);

  // Set user nickname
  $('#nickname').val(user.nickname);

  // Set user birthdate fields
  $('#birthYear').val(user.birthDate.year);
  $('#birthMonth').val(user.birthDate.month);
  $('#birthDay').val(user.birthDate.day);

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
      let message = `${translations.no_subscription}<a href="/my-plan">${translations.select_plan_here}</a>`
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
    let message = `${translations.no_subscription} <a href="/my-plan">${translations.select_plan_here}</a>`
    if(!data.plan){
      $('#user-plan').html(message).show()
      return
    }
    const billingCycle = data.plan.billingCycle
    const currentPlanId = data.plan.currentPlanId
    $.get('/plan/list',function(data){
      const plans = data.plans
      const plan = plans.find((plan) => plan[`${billingCycle}_id`] === currentPlanId);
      if(plan){
        message = `現在のプランは : <span class="fw-bold">${plan.name}</span>`
        $('#cancel-plan').show()
      }
      $('#user-plan').html(message).show()
    })
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
