// Global states
var swiperInstance;
var currentSwiperIndex = 0;

// Loading Functions Names in this file
// loadAllChatImages
if (typeof allChatsLoadingState === 'undefined') allChatsLoadingState = false
if (typeof allChatsCurrentPage === 'undefined') allChatsCurrentPage = 0
if (typeof allChatsImagesCache === 'undefined') allChatsImagesCache = {}

//loadChatImages
if (typeof chatLoadingStates === 'undefined') chatLoadingStates = {}
if (typeof chatCurrentPageMap === 'undefined') chatCurrentPageMap = {}
if (typeof chatImagesCache === 'undefined') chatImagesCache = {}
if (typeof loadedImages === 'undefined') loadedImages = []

// loadUserImages
if (typeof loadingStates === 'undefined') loadingStates = {};
if (typeof currentPageMap === 'undefined') currentPageMap = {};
if (typeof userImagesCache === 'undefined') userImagesCache = {}; // To store fetched images per page


// displayPeopleChat
if (typeof peopleChatCache === 'undefined') peopleChatCache = {}
if (typeof peopleChatLoadingState === 'undefined') peopleChatLoadingState = {}
if (typeof peopleChatCurrentPage === 'undefined') peopleChatCurrentPage = {}

// loadUserPosts 
// loadChatUsers
// loadUsers

async function onLanguageChange(lang) {
    const updateResponse = await $.ajax({
        url: '/api/user/update-language',
        method: 'POST',
        xhrFields: {
            withCredentials: true
        },
        contentType: 'application/json',
        data: JSON.stringify({ lang })
    });

    if (updateResponse.success) {
        await loadTranslations(lang);
        $('#languageDropdown').text(getLanguageDisplayName(lang));
        resetPeopleChatCache();
        if(MODE !== 'local'){
            window.location.href = `https://${lang}.chatlamix.com/`
        }else{
            location.reload();
        }
    }
}

function getLanguageDisplayName(lang) {
    const names = {
        'ja': '日本語',
        'en': 'English',
        'fr': 'Français'
    };
    return names[lang] || '日本語';
}

$(document).ready(function() {
    $(document).on('click','.language-select', function(e) {
        e.preventDefault();
        const selectedLang = $(this).data('lang');
        if (selectedLang !== lang) {
            onLanguageChange(selectedLang);
        }
    });
});



const userId = user._id
isTemporary = !!user?.isTemporary
subscriptionStatus = user.subscriptionStatus == 'active'  

const userLang = user.lang
$(document).ready(async function() {

    $.ajaxSetup({
        xhrFields: {
            withCredentials: true
        }
    });
        
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');
    const priceId = urlParams.get('priceId');
    const paymentFalse = urlParams.get('payment') == 'false';

    if(isTemporary){
        let formShown = false;
        $(document).scroll(function() {
          var scrollPercent = ($(window).scrollTop() / ($(document).height() - $(window).height())) * 100;
          if (scrollPercent >= 60 && !formShown) {
            formShown = true;
            //openLoginForm();
          }
        });
    }

    if (success && sessionId) {
        $.ajax({
            url: `/plan/update-${success}`,
            method: 'POST',
        xhrFields: {
            withCredentials: true
        },
            data: { sessionId, priceId },
            success: function(response) {
                if (response.success) {
                    Swal.fire({
                        position: 'top-end',
                        icon: 'success',
                        title: 'ご購入ありがとうございます!',
                        showConfirmButton: false,
                        timer: 3000,
                        toast: true,
                        animation: false,
                        customClass: {
                            container: 'animate__animated animate__fadeOutUp animate__delay-3s',
                            title: 'swal2-custom-title',
                            popup: 'swal2-custom-popup'
                        },
                        showClass: {
                            popup: 'animate__animated animate__slideInRight'
                        },
                        hideClass: {
                            popup: 'animate__animated animate__slideOutRight'
                        }
                    });
                    window.postMessage({ event: 'updateCoins' }, '*');
                } else {
                    console.error('Failed to update coins:', response.error);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error updating coins:', error);
            }
        });
    }
    if(paymentFalse){
        Swal.fire({
            position: 'top-end',
            icon: 'error',
            title: 'お支払いは行われませんでした。',
            showConfirmButton: false,
            timer: 3000,
            toast: true,
            animation: false,
            customClass: {
                container: 'animate__animated animate__fadeOutUp animate__delay-3s',
                title: 'swal2-custom-title',
                popup: 'swal2-custom-popup'
            },
            showClass: {
                popup: 'animate__animated animate__slideInRight'
            },
            hideClass: {
                popup: 'animate__animated animate__slideOutRight'
            }
        });
    }
    
    
    
    /*
        $(document).find('input, textarea').each(function() {
            new mdb.Input(this);
        });
    */
    function checkAndRedirect() {
        var selectedChatId = localStorage.getItem('selectedChatId');
        
        if (selectedChatId) {
            localStorage.removeItem('selectedChatId');
            var currentUrl = window.location.href;
            var redirectUrl = '/chat/' + selectedChatId;
            
            if (currentUrl !== redirectUrl) {
                window.location.href = redirectUrl;
            }
        }
    }
    // Display a popup to ask the user to save the links as a PWA on mobile
    if (window.matchMedia('(display-mode: browser)').matches && window.matchMedia('(max-width: 768px)').matches) {
         function showAddToHomeScreenPopup() {
            // Display the popup using Swal.fire
            Swal.fire({
                title: translations.popup_save.instructions,
                imageWidth: '100%',
                imageHeight: 'auto',
                position: 'bottom',
                html: `
                    <div class="d-flex align-items-center py-3">
                        <div>
                            <ul class="list-group mb-0">
                                <li class="bg-light d-flex align-items-center list-group-item">
                                    <i class="bi bi-box-arrow-up me-2 text-primary"></i>
                                    <span>1) ${translations.popup_save.step1}</span>
                                </li>
                                <li class="bg-light d-flex align-items-center list-group-item">
                                    <i class="bi bi-plus-square me-2 text-success"></i>
                                    <span>2) ${translations.popup_save.step2}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                `,
                showCancelButton: false,
                showConfirmButton: false,
                showCloseButton: true,
                allowOutsideClick: false,
                showClass: {
                    popup: 'swal2-bottom-slide-in'
                },
                hideClass: {
                    popup: 'swal2-bottom-slide-out'
                },
                customClass: {
                    popup: 'animated fadeInDown smaller-title'
                }
            }).then((result) => {   
                if (result.dismiss) {
                    localStorage.setItem('dismissedAddToHomeScreenPopup', 'true');
                }
            });
         };
        if (!isTemporary) {
          if (!localStorage.getItem('dismissedAddToHomeScreenPopup')) {
              setTimeout(showAddToHomeScreenPopup, 5000);
          }
        }
        
    }

    //checkAndRedirect();
    window.showUpgradePopup = function(limitType) {
    
        $.ajax({
            type: 'GET',
        xhrFields: {
            withCredentials: true
        },
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
            let messageTitle = '';
            let messageText = '';
            let imageUrl = '/img/login-bg-862c043f.png'; // replace with your image URL
        
            // Use switch-case to handle different types of limits
            switch (limitType) {
                case 'image-generation':
                    messageTitle = `🎨${translations.imageGeneration.messageTitle}`;
                    messageText = translations.imageGeneration.messageText;
                    break;
                case 'nsfw-prompt':
                    messageTitle = `${translations.nsfwPrompt.messageTitle}`;
                    messageText = translations.nsfwPrompt.messageText;
                    break;
                case 'chat-message':
                    messageTitle = '💬メッセージ制限に達しました';
                    messageText = '無制限のメッセージをお楽しみいただくには、有料プランにご登録ください。';
                    break;
                case 'chat-character':
                    messageTitle = '🤗キャラクター制限に達しました';
                    messageText = 'より多くのキャラクターと会話を楽しむには、有料プランにご登録ください。';
                    break;
                case 'chat-private':
                    messageTitle = '🔒 非公開設定にはアップグレードが必要です';
                    messageText = 'プライベートチャット機能を利用するには、有料プランにアップグレードしてください。';
                    break;
                case 'unlock-nsfw':
                    messageTitle = '⚠️ 成人向けンテンツの利用にはアップグレードが必要です';
                    messageText = '成人向けコンテンツを生成するには、有料プランにアップグレードしてください。';
                    break;
                default:
                    messageTitle = '制限に達しました';
                    messageText = 'ご利用中のプランの制限に達しました。有料プランにアップグレードして、より多くの機能をお楽しみください。';
            }
            // Display the popup using Swal.fire
            Swal.fire({
                //imageUrl: imageUrl,
                imageWidth: '100%',
                imageHeight: 'auto',
                position: 'bottom',
                html: `
                    <div class="container">
                        <div class="row justify-content-center">
                            <div class="text-start">
                                <h5 class="fw-bold">${messageTitle}</h5>
                                <p class="text-muted mb-2 header" style="font-size: 16px;">${messageText}</p>
                                <ul class="list-group list-group-flush">
                                    ${plan.features.map(feature => `<li class="list-group-item px-0"><span class="me-2">🔥</span>${feature}</li>`).join('')}
                                </ul>
                                <a href="#" onclick="loadPlanPage()" class="btn btn-dark close-alert border-0 w-100 custom-gradient-bg mt-3">${translations.check_premium_plan}</a>
                            </div>
                        </div>
                    </div>
                `,
                showCancelButton: false,
                showConfirmButton: false,
                showCloseButton: true,
                allowOutsideClick: false,
                showClass: {
                    popup: 'swal2-bottom-slide-in'
                },
                hideClass: {
                    popup: 'swal2-bottom-slide-out'
                },
                customClass: {
                    popup: 'animated fadeInDown'
                }
            }).then((result) => {
                if (result.dismiss) {
                $.removeCookie('redirect_url');
                }
            });
        },
        error: function(xhr, status, error) {
            console.error('Failed to fetch plans:', error);
        }
        });
    }

    startCountdown();
    displayTags();
});

$(document).on('click', '.close-alert', function (e) {
  e.preventDefault();
  Swal.close();
});

$(document).find('.jp-date').each(function () {
    const originalDate = new Date($(this).text());
    if (isNaN(originalDate.getTime())) {
        $(this).parent().hide(); 
        return;
    }
    
    const formattedDate = originalDate.toISOString().slice(0, 16).replace('T', ' ');

    $(this).replaceWith(`
        <div>
            <i class="bi bi-calendar"></i> ${formattedDate.slice(0, 10)} 
        </div>
    `);
});


$(document).on('click', '.persona', function(e) {
    e.stopPropagation();
    e.preventDefault();
    const isTemporary = !!user.isTemporary
    if(isTemporary){ openLoginForm(); return; }
    const $this = $(this)
    $this.toggleClass('on');
    const $icon = $(this).find('i');
    const isAdding = $icon.hasClass('far');
    $icon.toggleClass('fas far');
    const personaId = $(this).attr('data-id');
    const isEvent = $(this).attr('data-event') == 'true'
    if(isEvent){
        window.parent.postMessage({ event: 'updatePersona', personaId,isAdding }, '*');
    }else{
        updatePersona(personaId,isAdding,null,function(){
            $icon.toggleClass('fas far');
            $this.toggleClass('on');
        })
    }
});

if(!isTemporary){
    const personas = user?.personas || false
    initializePersonaStats(personas)
}

window.togglePostFavorite = function(el) {
  const isTemporary = !!user.isTemporary;
  if (isTemporary) { openLoginForm(); return; }

  const $this = $(el);
  const postId = $this.data('id');
  const isLiked = $this.hasClass('liked'); // Check if already liked

  const action = isLiked ? 'unlike' : 'like'; // Determine action

  $this.toggleClass('liked');

  $.ajax({
    url: `/posts/${postId}/like-toggle`, // Single endpoint
    method: 'POST',
        xhrFields: {
            withCredentials: true
        },
    data: { action: action }, // Send action (like/unlike) in the request body
    success: function () {
      // Show success notification in Japanese
      if (action === 'like') {
        showNotification('いいねしました！', 'success');
        $this.find('.ct').text(parseInt($this.find('.ct').text()) + 1);
      } else {
        showNotification('いいねを取り消しました！', 'success');
        $this.find('.ct').text(parseInt($this.find('.ct').text()) - 1);
      }
    },
    error: function () {
      // Show error notification in Japanese
      $this.toggleClass('liked');
      showNotification('リクエストに失敗しました。', 'error');
    }
  });
};

window.toggleImageFavorite = function(el) {
  const isTemporary = !!user.isTemporary;
  if (isTemporary) { openLoginForm(); return; }

  const $this = $(el);
  const imageId = $this.data('id');
  const isLiked = $this.hasClass('liked'); // Check if already liked

  const action = isLiked ? 'unlike' : 'like'; // Determine action
  $this.toggleClass('liked');

  $.ajax({
    url: `/gallery/${imageId}/like-toggle`, // Single endpoint
    method: 'POST',
        xhrFields: {
            withCredentials: true
        },
    data: { action: action }, // Send action (like/unlike) in the request body
    success: function() {
      // Show success notification in Japanese
      if (action === 'like') {
        $this.find('.ct').text(parseInt($this.find('.ct').text()) + 1);
        window.postMessage({ event: 'imageFav', imageId }, '*');
      } else {
        showNotification('いいねを取り消しました！', 'success');
        $this.find('.ct').text(parseInt($this.find('.ct').text()) - 1);
      }
      // delete the local storage item userImages_${userId}
      const userId = user._id;
      const cacheKey = `userImages_${userId}`;
      localStorage.removeItem(cacheKey);
    },
    error: function() {
      $this.toggleClass('liked');
      showNotification('リクエストに失敗しました。', 'error');
    }
  });
};
window.togglePostVisibility = function(el) {
  const isTemporary = !!user.isTemporary;
  if (isTemporary) { openLoginForm(); return; }

  const $this = $(el);
  const postId = $this.data('id');
  const isPrivate = $this.hasClass('private'); // Check if already private

  const newPrivacyState = !isPrivate; // Toggle privacy state

  $.ajax({
    url: `/posts/${postId}/set-private`, // Single endpoint for both public and private
    method: 'POST',
        xhrFields: {
            withCredentials: true
        },
    data: { isPrivate: newPrivacyState },
    success: function() {
      // Toggle private/public button state
      $this.toggleClass('private');
      const ico = newPrivacyState ? 'bi-eye-slash' : 'bi-eye';
      const text = newPrivacyState ? '非公開' : '公開';
      $this.find('i').removeClass('bi-eye bi-eye-slash').addClass(ico);
      $this.find('.text').text(text);

      // Show success notification in Japanese
      if (newPrivacyState) {
        showNotification('投稿を非公開にしました！', 'success');
      } else {
        showNotification('投稿を公開にしました！', 'success');
      }
    },
    error: function() {
      // Show error notification in Japanese
      showNotification('リクエストに失敗しました。', 'error');
    }
  });
};
window.toggleImageNSFW = function(el) {
  const isTemporary = !!user.isTemporary;
  //if (isTemporary) { openLoginForm(); return; }

  const $this = $(el);
  const imageId = $this.data('id');
  const isNSFW = $this.hasClass('nsfw'); // Check if already marked as NSFW

  const nsfwStatus = !isNSFW; // Toggle NSFW status

  $this.toggleClass('nsfw'); // Toggle NSFW class for UI change

  // Update the button icon based on the NSFW status
  const icon = nsfwStatus 
    ? '<i class="bi bi-eye-slash-fill"></i>'   // NSFW icon (eye-slash for hidden content)
    : '<i class="bi bi-eye-fill"></i>';        // Non-NSFW icon (eye for visible content)

  $this.html(icon); // Update the button's icon

  $.ajax({
    url: `/images/${imageId}/nsfw`, // Endpoint for updating NSFW status
    method: 'PUT',
        xhrFields: {
            withCredentials: true
        },
    contentType: 'application/json',
    data: JSON.stringify({ nsfw: nsfwStatus }), // Send NSFW status in request body
    success: function () {

    // Show success notification in Japanese
    if (nsfwStatus) {
      showNotification('NSFWに設定されました！', 'success');
    } else {
      showNotification('NSFW設定が解除されました！', 'success');
    }
    },
    error: function () {
    $this.toggleClass('nsfw'); // Revert the class change if request fails
    $this.html(isNSFW 
      ? '<i class="bi bi-eye-fill"></i>' 
      : '<i class="bi bi-eye-slash-fill"></i>'); // Revert the icon as well
    showNotification('リクエストに失敗しました。', 'error');
    }
  });
}

window.togglePostNSFW = function(el) {
  const isTemporary = !!user.isTemporary;
  // if (isTemporary) { openLoginForm(); return; }

  const $this = $(el);
  const postId = $this.data('id'); // Post ID is stored in data attribute
  const isNSFW = $this.hasClass('nsfw'); // Check if already marked as NSFW

  const nsfwStatus = !isNSFW; // Toggle NSFW status

  $this.toggleClass('nsfw'); // Toggle NSFW class for UI change

  // Update the button icon based on the NSFW status
  const icon = nsfwStatus 
    ? '<i class="bi bi-eye-slash-fill"></i>'   // NSFW icon (eye-slash for hidden content)
    : '<i class="bi bi-eye-fill"></i>';        // Non-NSFW icon (eye for visible content)

  $this.html(icon); // Update the button's icon

  $.ajax({
      url: `/user/posts/${postId}/nsfw`, // Endpoint for updating NSFW status
      method: 'PUT',
        xhrFields: {
            withCredentials: true
        },
      contentType: 'application/json',
      data: JSON.stringify({ nsfw: nsfwStatus }), // Send NSFW status in request body
      success: function () {
          // Show success notification
          if (nsfwStatus) {
              showNotification('NSFWに設定されました！', 'success');
          } else {
              showNotification('NSFW設定が解除されました！', 'success');
          }
      },
      error: function () {
          $this.toggleClass('nsfw'); // Revert the class change if request fails
          $this.html(isNSFW 
            ? '<i class="bi bi-eye-fill"></i>' 
            : '<i class="bi bi-eye-slash-fill"></i>'); // Revert the icon as well
          showNotification('リクエストに失敗しました。', 'error');
      }
  });
};

window.toggleFollow = function(el) {
  const isTemporary = !!user.isTemporary;
  if (isTemporary) { openLoginForm(); return; }

  const $this = $(el);
  const userId = $this.data('user-id');
  const isFollowing = $this.hasClass('following'); // Check if already following

  const action = isFollowing ? false : true;
  $this.toggleClass('following');

  $.ajax({
    url: `/user/${userId}/follow-toggle`, // Single endpoint for both follow/unfollow
    method: 'POST',
        xhrFields: {
            withCredentials: true
        },
    data: { action: action }, // Send action (follow/unfollow) in the request body
    success: function () {
      // Update the button text
      if (action) {
        $this.find('.user-follow').text('フォロー中');
        showNotification('フォローしました！', 'success');
      } else {
        $this.find('.user-follow').text('フォロー');
        showNotification('フォローを解除しました！', 'success');
      }
    },
    error: function () {
      $this.toggleClass('following'); // Revert the state on error
      showNotification('リクエストに失敗しました。', 'error');
    }
  });
}

window.redirectToChatPage = function(el) {
    const chatId = $(el).data('id');
    if(chatId){
      window.location = '/chat/' + chatId;
      return
    }
    if (window.location.pathname !== '/chat/') {
      window.location.href = '/chat/';
    }
};

window.blurImage = function(img) {
    if ($(img).data('processed') === "true") return;
    let imageUrl = $(img).data('src');
    fetchBlurredImage(img, imageUrl);
}

function fetchBlurredImage(img, imageUrl) {
    $.ajax({
        url: '/blur-image?url=' + encodeURIComponent(imageUrl),
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        xhrFields: { responseType: 'blob' },
        success: function(blob) { handleImageSuccess(img, blob, imageUrl); },
        error: function() { console.error("Failed to load blurred image."); }
    });
}

window.updateChatImage = function(el) {
  const chatId = $(el).data('id');
  const imageUrl = $(el).data('img');
  $.ajax({
    url: `/chat/${chatId}/image`,
    type: 'PUT',
        xhrFields: {
            withCredentials: true
        },
    data: { imageUrl },
    success: function(response) {
      updateChatBackgroundImage(imageUrl);
    }
  });
}

    
window.updateChatBackgroundImage = function(thumbnail) {
  const currentImageUrl = $('#chat-container').css('background-image').replace(/url\(["']?|["']?\)$/g, '');
  if (currentImageUrl !== thumbnail) {
      $('#chat-container').css('background-image', `url(${thumbnail})`);
  }
  resetPeopleChatCache(chatId);
}

window.resetPeopleChatCache = function(chatId,model_name) {
  for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('peopleChatCache_')) {
          const dataToString = localStorage.getItem(key);
          if (!chatId || (dataToString && dataToString.includes(chatId))) {
              localStorage.removeItem(key);
          }
          if(dataToString && dataToString.includes(model_name)){
            localStorage.removeItem(key);
          }
      }
  }
};

function handleImageSuccess(img, blob, imageUrl) {
    let objectUrl = URL.createObjectURL(blob);
    $(img).attr('src', objectUrl).data('processed', "true").removeAttr('data-original-src').removeAttr('data-src').removeAttr('srcset');
    createOverlay(img, imageUrl);
}

function createOverlay(img, imageUrl) {
  let overlay;
  const isTemporary = !!window.user?.isTemporary; // Access global user object

  if (isTemporary) {
    overlay = $('<div></div>')
      .addClass('gallery-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center animate__animated animate__fadeIn')
      .css({
        background: 'rgba(0,0,0,0.55)',
        zIndex: 2,
        cursor: 'pointer' // Add cursor pointer to indicate it's clickable
      })
      .on('click', function() {
        openLoginForm(); // Assuming openLoginForm is a globally available function
      });

    const lockIcon = $('<i></i>').addClass('bi bi-lock-fill fs-3 text-light');
    const loginText = $('<p></p>').addClass('mt-2 small text-light badge bg-secondary shadow ').text(window.translations?.login_to_view || 'Login to view'); // Use translations if available

    overlay.append(lockIcon, loginText);

  } else {
    // Existing overlay logic for non-temporary users
    overlay = $('<div></div>')
      .addClass('gallery-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center animate__animated animate__fadeIn')
      .css({
        background: 'rgba(0,0,0,0.55)',
        zIndex: 2
      });

    let badge = $('<span></span>')
      .addClass('badge bg-danger mb-2')
      .css('font-size', '1rem')
      .html('<i class="bi bi-exclamation-triangle"></i> NSFW');

    let buttonElement = $('<button></button>')
      .text(window.translations?.blurButton || '画像を見る')
      .addClass('btn btn-sm btn-outline-light mt-3 animate__animated animate__pulse')
      .css({ 'font-size': '14px', 'border-radius': '50px', cursor: 'pointer' })
      .on('click', function (e) {
          e.stopPropagation(); // Prevent click from bubbling to parent if wrapped
          // Reveal the original image by replacing the blurred one
          // This assumes the original image URL is stored in `imageUrl`
          // and the blurred image is the `src` of `img`
          const parentDiv = $(img).parent();
          $(img).attr('src', imageUrl); // Set src to original image
          overlay.remove(); // Remove the overlay
          // If you had other attributes on the original img tag that were removed for blurring, restore them here.
      });

    let textElement = $('<div></div>')
      .addClass('fw-bold')
      .css({ 'font-size': '12px', 'text-shadow': '0 0 5px black' });

    overlay.append(badge, buttonElement, textElement);
  }

  $(img)
    .wrap('<div style="position: relative; display: inline-block;"></div>')
    .after(overlay);
}
async function checkIfAdmin(userId) {
    try {
      const response = await $.get(`/user/is-admin/${userId}`);
      return response.isAdmin;
    } catch (error) {
      console.log('Error checking admin status');
      return false;
    }
}

  function unlockImage(id, type, el) {
    loadPlanPage();
    return
    /*
    $.post(`/api/unlock/${type}/${id}`)
      .done((response) => {
        const imageUrl = response.item.image ? response.item.image.imageUrl : response.item.imageUrl
        const prompt = response.item.image ? response.item.image.prompt : response.item.prompt
        $(el).before(`
            <a href="${response.redirect}" class="text-muted text-decoration-none">
                <img src="${imageUrl}" alt="${prompt}" class="card-img-top">
            </a>`)
            $(el).remove()
        showNotification(window.translations.unlockSuccess, 'success');
      })
      .fail(() => {
    });
    */
  }
  
  function isUnlocked(currentUser, id, ownerId) {
    if (!currentUser) {
        console.warn('isUnlocked: currentUser is undefined', { id, ownerId });
        return false;
    }
    if(currentUser.isTemporary){
        console.warn('isUnlocked: currentUser is temporary', { id, ownerId });
        return false;
    }
    const unlocked = Array.isArray(currentUser.unlockedItems) && currentUser.unlockedItems.includes(id);
    const isOwner = currentUser._id == ownerId;
    console.log({ unlocked, isOwner, id, ownerId });
    return unlocked || isOwner;
  }
  
// Helper function to scroll to the top
function scrollToTop() {
    $('html, body').animate({ scrollTop: 0 }, 'slow');
}

let imgPlaceholder = '/img/nsfw-blurred-2.png'
window.imagePlaceholder = function(){
    if(!isTemporary){
        return `/img/nsfw-blurred-2.png`
    }
    return imgPlaceholder
}
window.loadUsers = async function (page = 1) {
    $.ajax({
        url: `/users/?page=${page}`,
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: function (data) {
            let usersHtml = '';
            data.users.forEach(user => {
                usersHtml += `
                    <div class="me-3 text-center" style="min-width: 100px;">
                        <a href="/user/${user.userId}" class="text-decoration-none text-dark">
                            <img src="${user.profilePicture || '/img/default-avatar.png'}" alt="${user.userName}" class="rounded-circle mb-2" width="60" height="60">
                            <div>${user.userName}</div>
                        </a>
                    </div>
                `;
            });

            $('#users-gallery').append(usersHtml);
            if( $('#users-pagination-controls').length > 0){
                generateUserPagination(data.page, data.totalPages);
            }
        },
        error: function (err) {
            console.error('Failed to load users', err);
        }
    });
}

function generateUserPagination(currentPage, totalPages) {
    let paginationHtml = '';
    const sidePagesToShow = 2;
    let pagesShown = new Set();

    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                loadUsers(currentPage + 1);
                pagesShown.add(currentPage + 1);
            }
        }
    });

    if (currentPage >= totalPages) {
      console.log('All Chats: No more pages to load.')
      return;
    }

    if (totalPages > 1) {
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="loadUsers(${currentPage - 1})">${window.translations.prev}</button>`;

        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadUsers(${currentPage - sidePagesToShow})">1</button>`;
            if (currentPage > sidePagesToShow + 2) paginationHtml += `<span class="mx-1">...</span>`;
        }

        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="loadUsers(${i})">${i}</button>`;
        }

        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) paginationHtml += `<span class="mx-1">...</span>`;
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadUsers(${totalPages})">${totalPages}</button>`;
        }

        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="loadUsers(${currentPage + 1})">${window.translations.next}</button>`;
    }

    $('#users-pagination-controls').html(paginationHtml);
}

window.loadChatUsers = async function (chatId, page = 1) {
  $.ajax({
    url: `/chat/${chatId}/users?page=${page}`,
    method: 'GET',
        xhrFields: {
            withCredentials: true
        },
    success: function (data) {
      // Add style once if not already present
      if (!$('#chat-users-style').length) {
        $('head').append(`
          <style id="chat-users-style">
            .user-avatar-card {
              transition: all 0.3s ease;
            }
            .user-avatar-card:hover {
              transform: translateY(-5px);
              box-shadow: 0 8px 20px rgba(0,0,0,0.15) !important;
            }
            .user-avatar {
              transition: all 0.3s ease;
              box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            }
          </style>
        `);
      }

      let chatUsersHtml = '';
      data.users.forEach(user => {
        chatUsersHtml += `
          <div class="col-auto mb-4 user-avatar-card mx-2 shadow border border-2 border-light rounded p-2">
            <a href="/user/${user.userId}" class="text-decoration-none text-center d-block">
              <div class="avatar-wrapper mb-2 d-flex justify-content-center">
                <img src="${user.profileUrl || '/img/default-avatar.png'}" 
                   alt="${user.nickname}" 
                   class="rounded-circle border-light user-avatar"
                   width="64" height="64">
              </div>
              <div class="user-name text-secondary fw-medium" style="max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${user.nickname}
              </div>
            </a>
          </div>
        `;
      });

      $('#chat-users-gallery').append(chatUsersHtml);
      
      // Generate pagination if needed
      if ($('#chat-users-pagination-controls').length > 0) {
        generateChatUserPagination(data.page, data.totalPages, chatId);
      }
    },
    error: function (err) {
      console.error('Failed to load users', err);
    }
  });
}
function generateChatUserPagination(currentPage, totalPages, chatId) {
    let paginationHtml = '';
    const sidePagesToShow = 2;
    let pagesShown = new Set();

    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                loadChatUsers(chatId, currentPage + 1);
                pagesShown.add(currentPage + 1);
            }
        }
    });

    if (currentPage >= totalPages) {
      console.log('All Chats: No more pages to load.')
      return;
    }

    if (totalPages > 1) {
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="loadChatUsers('${chatId}', ${currentPage - 1})">${window.translations.prev}</button>`;

        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadChatUsers('${chatId}', 1)">1</button>`;
            if (currentPage > sidePagesToShow + 2) paginationHtml += `<span class="mx-1">...</span>`;
        }

        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="loadChatUsers('${chatId}', ${i})">${i}</button>`;
        }

        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) paginationHtml += `<span class="mx-1">...</span>`;
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadChatUsers('${chatId}', ${totalPages})">${totalPages}</button>`;
        }

        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="loadChatUsers('${chatId}', ${currentPage + 1})">${window.translations.next}</button>`;
    }

    $('#chat-users-pagination-controls').html(paginationHtml);
}

window.displayPeopleList = async function (userId, type = 'followers', page = 1) {
    try {
        const response = await fetch(`/user/${userId}/followers-or-followings?type=${type}&page=${page}`);
        const data = await response.json();

        let people = data.users || [];
        let htmlContent = '';

        // If there are followers or following users
        people.forEach(user => {
            htmlContent += `
            <li class="list-group-item border-0 py-3 px-2 mb-2 rounded shadow-sm people-list-item d-flex justify-content-between align-items-center transition"
          style="background: #fff; transition: box-shadow 0.2s, transform 0.2s;">
          <div class="d-flex align-items-center">
              <a href="/user/${user.userId}" class="d-flex align-items-center text-decoration-none">
            <img src="${user.profilePicture || '/img/default-avatar.png'}" alt="${user.userName}" 
                class="rounded-circle me-3 border border-2 border-light user-avatar transition"
                width="56" height="56"
                style="box-shadow: 0 2px 8px rgba(0,0,0,0.07); transition: box-shadow 0.2s;">
            <div>
                <h6 class="mb-1 fw-semibold text-dark user-name" style="font-size: 1.1rem;">${user.userName}</h6>
                <div class="text-muted small d-none">@${user.userId}</div>
            </div>
              </a>
          </div>
          <a href="/user/${user.userId}" class="btn btn-outline-primary btn-sm px-3 py-1 rounded-pill profile-btn transition"
              style="font-weight: 500; letter-spacing: 0.02em;">
              <i class="bi bi-person-lines-fill me-1"></i> プロフィールを見る
          </a>
            </li>`;
        });

        // Add hover effect via jQuery (or move to your CSS file)
        $(document).off('mouseenter mouseleave', '.people-list-item').on('mouseenter', '.people-list-item', function() {
            $(this).css({
          'box-shadow': '0 4px 16px rgba(0,0,0,0.12)',
          'transform': 'translateY(-2px) scale(1.015)'
            });
            $(this).find('.user-avatar').css('box-shadow', '0 4px 16px rgba(0,0,0,0.18)');
            $(this).find('.profile-btn').addClass('btn-primary').removeClass('btn-outline-primary');
        }).on('mouseleave', '.people-list-item', function() {
            $(this).css({
          'box-shadow': '0 2px 8px rgba(0,0,0,0.07)',
          'transform': 'none'
            });
            $(this).find('.user-avatar').css('box-shadow', '0 2px 8px rgba(0,0,0,0.07)');
            $(this).find('.profile-btn').removeClass('btn-primary').addClass('btn-outline-primary');
        });

        // Update the HTML content for the list
        $('#people-list').append(htmlContent);

        // Generate pagination controls
        if ($('#pagination-controls').length > 0) {
            generatePagination(data.page, data.totalPages, userId, type);
            
        }
    } catch (err) {
        console.error('Failed to load list', err);
    }
};
function generatePagination(currentPage, totalPages, userId, type) {
    let paginationHtml = '';
    const maxPagesToShow = 5;
    const sidePagesToShow = 2;
    let pagesShown = new Set();  // Track the pages already displayed

    // Scroll event listener to trigger infinite scroll
    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                displayPeopleList(userId, type, currentPage + 1);
                pagesShown.add(currentPage + 1);  // Mark page as shown
            }
        }
    });

    // If more than one page, generate pagination buttons
    if (totalPages > 1) {
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="displayPeopleList('${userId}', '${type}', ${currentPage - 1})">${window.translations.prev}</button>`;

        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="displayPeopleList('${userId}', '${type}', 1)">1</button>`;
            if (currentPage > sidePagesToShow + 2) {
                paginationHtml += `<span class="mx-1">...</span>`;
            }
        }

        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
            <button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="displayPeopleList('${userId}', '${type}', ${i})">
                ${i}
            </button>`;
        }

        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) {
                paginationHtml += `<span class="mx-1">...</span>`;
            }
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="displayPeopleList('${userId}', '${type}', ${totalPages})">${totalPages}</button>`;
        }

        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="displayPeopleList('${userId}', '${type}', ${currentPage + 1})">${window.translations.next}</button>`;
    }

    $('#pagination-controls').html(paginationHtml);
}

window.displayUserChats = async function(userId, page = 1, skipDeduplication) {
    try {
        const response = await fetch(`/api/chats?userId=${userId}&page=${page}&skipDeduplication=${skipDeduplication}`);
        const data = await response.json();

        let userChats = data.recent || [];
        let htmlContent = '';

        userChats.forEach(chat => {
            let galleryIco = '';
            let image_count = 0;

            // Handle galleries
            if (chat.galleries && chat.galleries.length > 0) {
                chat.galleries.forEach(gallery => {
                    if (gallery.images && gallery.images.length > 0) {
                        image_count += gallery.images.length;
                    }
                });
                if (image_count > 0) {
                    galleryIco = `
                        <div class="gallery" style="color: rgb(165 164 164);opacity:0.8;" data-id="${chat._id}">
                            <span class="badge bg-dark"><i class="bi bi-images me-1"></i>${image_count}</span>
                        </div>
                    `;
                }
            }

            // Render chat card
            htmlContent += `
                  <div class="col-12 col-sm-4 col-lg-3 mb-2">
                    <div 
                    class="card custom-card bg-transparent shadow-0 border-0 my-3 px-1 pb-3 redirectToChatPage" 
                    style="cursor:pointer;" data-id="${chat._id}" 
                    data-image="${chat.chatImageUrl}"
                    onclick="redirectToChatPage(this)"
                    >
                      <div style="background-image:url('${chat.chatImageUrl || '/img/logo.webp'}')" class="card-img-top girls_avatar position-relative" alt="${chat.name}">
                        <div id="spinner-${chat._id}" class="position-absolute spinner-grow spinner-grow-sm text-light" role="status" style="top:5px;left: 5px;display:none;"></div>
                        <div class="position-absolute" style="color: rgb(165 164 164);opacity:0.8; bottom:10px;left:10px;right:10px;">
                          ${(chat.tags || []).length ? `<div class="tags d-flex justify-content-between align-items-center flex-wrap">${chat.tags.map(tag => `<span class="badge bg-dark">${tag}</span>`).join('')}</div>` : ''}
                        </div>
                        <div class="position-absolute text-end" style="top:10px;right:10px">
                          <a href="/character/slug/${chat.slug}">
                            <div class="gallery" style="color: rgb(165 164 164);opacity:0.8;" data-id="${chat._id}">
                              <span class="btn btn-dark"><i class="bi bi-image me-1"></i><span style="font-size:12px;">${chat.imageCount || 0}</span></span>
                            </div>
                          </a>
                          ${galleryIco}
                          ${chat.messagesCount ? `<span class="badge bg-dark message-count"><i class="bi bi-chat-dots me-2"></i>${chat.messagesCount}</span>` : ''}
                        </div>
                      </div>
                      <div class="card-body bg-transparent border-0 pb-0 text-start">
                        <div class="row align-items-center">
                          <div class="col-auto text-center">
                            <a href="/character/slug/${chat.slug}" style="text-decoration: none;">
                              <img src="${chat.chatImageUrl || '/img/avatar.png'}" alt="${chat.name}" class="rounded-circle" width="40" height="40">
                            </a>
                          </div>
                          <div class="col-auto">
                            <a href="/character/slug/${chat.slug}" class="text-muted" style="text-decoration: none;">
                              <h5 class="card-title character-title mb-0">${chat.name}</h5>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>`;
        });

        // Update the gallery HTML
        $('#user-chat-gallery').append(htmlContent);
        if($('#user-chat-pagination-controls').length > 0){
            generateUserChatsPagination(userId, data.page, data.totalPages);   
        }
    } catch (err) {
        console.error('Failed to load user chats', err);
    }
};

function generateUserChatsPagination(userId, currentPage, totalPages) {
  let paginationHtml = '';
  const sidePagesToShow = 2;
  let pagesShown = new Set();

  // Infinite scroll
  $(window).off('scroll').on('scroll', function() {
    if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
      if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
        displayUserChats(userId, currentPage + 1);
        pagesShown.add(currentPage + 1);
      }
    }
  });

  if (currentPage >= totalPages) {
    $('#user-chat-pagination-controls').empty(); // Hide spinner when all is shown
    return;
  }

  if (totalPages > 1) {
    paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="displayUserChats(${userId}, ${currentPage - 1})">${window.translations.prev}</button>`;

    if (currentPage > sidePagesToShow + 1) {
      paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="displayUserChats(${userId}, 1)">1</button>`;
      if (currentPage > sidePagesToShow + 2) paginationHtml += `<span class="mx-1">...</span>`;
    }

    let startPage = Math.max(1, currentPage - sidePagesToShow);
    let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

    for (let i = startPage; i <= endPage; i++) {
      paginationHtml += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="displayUserChats(${userId}, ${i})">${i}</button>`;
    }

    if (currentPage < totalPages - sidePagesToShow - 1) {
      if (currentPage < totalPages - sidePagesToShow - 2) paginationHtml += `<span class="mx-1">...</span>`;
      paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="displayUserChats(${userId}, ${totalPages})">${totalPages}</button>`;
    }

    paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="displayUserChats(${userId}, ${currentPage + 1})">${window.translations.next}</button>`;
  }

  $('#user-chat-pagination-controls').html(paginationHtml);
}

// Enhanced displayPeopleChat with caching + infinite scroll
window.displayPeopleChat = async function (page = 1, option = {}, callback, reload = false) {
  const { imageStyle, imageModel, modelId = false, premium = false, query = '', userId = false, modal = false } = option

  const searchId = `${imageStyle}-${imageModel}-${query}-${userId}`

  let nsfw = $.cookie('nsfw') === 'true' || false
  if (option.nsfw) {
    nsfw = true
  }

  // LocalStorage key
  const cacheKey = `peopleChatCache_${searchId}`
  // Init or retrieve cache for this searchId
  let cacheData = JSON.parse(localStorage.getItem(cacheKey) || '{}')
  if (!cacheData.pages) cacheData.pages = {}
  peopleChatCache[searchId] = cacheData.pages

  // List cached pages
  const cachedPages = Object.keys(peopleChatCache[searchId]).map(Number).sort((a, b) => a - b)
  const maxCachedPage = cachedPages.length ? Math.max(...cachedPages) : 0

  // If reload => append all cached pages, update current page
  if (reload) {
    for (let p of cachedPages) {
      if (peopleChatCache[searchId][p]?.recent) {
        window.displayChats(peopleChatCache[searchId][p].recent, searchId, modal)
        if (typeof callback === 'function') {
          const uniqueIds = [...new Set(peopleChatCache[searchId][p].recent.map((chat) => chat._id))]
          callback(uniqueIds)
        }
      }
    }
    peopleChatCurrentPage[searchId] = maxCachedPage
    if (maxCachedPage > 0) page = maxCachedPage + 1 // optionally refresh from server
  }

  // If page already cached & not reloading => skip server call
  if (peopleChatCache[searchId][page] && !reload) {
    const cachedResult = peopleChatCache[searchId][page]
    window.displayChats(cachedResult.recent || [], searchId, modal)
    if (typeof callback === 'function') {
      const uniqueIds = [...new Set((cachedResult.recent || []).map((c) => c._id))]
      callback(uniqueIds)
    }
    peopleChatCurrentPage[searchId] = page
    generateChatsPaginationFromCache(option) // update pagination controls if needed
    return
  }

  // Otherwise fetch from server
  try {
    const response = await fetch(
      `/api/chats?page=${page}&style=${imageStyle}&model=${imageModel}&modelId=${modelId}&q=${query}&userId=${userId}&nsfw=${nsfw}`
    )
    const data = await response.json()
    data.premium = premium
    //Set premium status to all recent chats
    data.recent.forEach(chat => chat.premium = premium)
    // Display and callback
    if (data.recent) {
      window.displayChats(data.recent, searchId, modal)
      if (typeof callback === 'function') {
        const uniqueChatIds = [...new Set(data.recent.map((chat) => chat._id))]
        callback(uniqueChatIds)
      }
    }

    // Store in cache
    peopleChatCache[searchId][page] = data
    cacheData.pages = peopleChatCache[searchId]
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))

    // Update current page & pagination
    peopleChatCurrentPage[searchId] = page
    if ($('#chat-pagination-controls').length > 0 && data.totalPages) {
      generateChatsPagination(data.totalPages, option)
    }
  } catch (err) {
    console.error('Failed to load chats:', err)
    if (typeof callback === 'function') callback([])
  }
}

// Infinite scroll + pagination
window.generateChatsPagination = function (totalPages, option = {}) {
  const { imageStyle, imageModel, query = '', userId = '' } = option
  const searchId = `${imageStyle}-${imageModel}-${query}-${userId}`

  if (!peopleChatLoadingState[searchId]) peopleChatLoadingState[searchId] = false
  if (!peopleChatCurrentPage[searchId]) peopleChatCurrentPage[searchId] = 0

  $(window).off('scroll').on('scroll', () => {
    if (
      !peopleChatLoadingState[searchId] &&
      peopleChatCurrentPage[searchId] < totalPages &&
      $(window).scrollTop() + $(window).height() >= $(document).height() - 100
    ) {
      console.log(`Infinite scroll => next page: ${peopleChatCurrentPage[searchId] + 1}`)
      peopleChatLoadingState[searchId] = true

      displayPeopleChat(peopleChatCurrentPage[searchId] + 1, option, null, false)
        .then(() => {
          peopleChatLoadingState[searchId] = false
          console.log(`Finished loading page ${peopleChatCurrentPage[searchId]}`)
        })
        .catch(() => {
          peopleChatLoadingState[searchId] = false
          console.error('Failed to load the next page.')
        })
    }
  })

  updateChatPaginationControls(totalPages, searchId)
}

// If we skip the server call due to cache
function generateChatsPaginationFromCache(option = {}) {
  const { imageStyle, imageModel, query = '', userId = '' } = option
  const searchId = `${imageStyle}-${imageModel}-${query}-${userId}`
  console.log(`generateChatsPaginationFromCache => searchId:${searchId}`)
  // If you don't store real totalPages in cache, pick a large number or track it separately
  updateChatPaginationControls(9999, searchId)
}

// Spinner or back-to-top
function updateChatPaginationControls(totalPages, searchId) {
  if (peopleChatCurrentPage[searchId] >= totalPages) {
  } else {
    $('#chat-pagination-controls').html(
      '<div class="text-center"><div class="spinner-border" role="status"></div></div>'
    )
  }
}
window.displaySimilarChats = function (chatData, targetGalleryId) {
  let htmlContent = '';
  const currentUser = user; // Assuming 'user' is globally available from the template
  const currentUserId = currentUser._id;
  const subscriptionStatus = currentUser.subscriptionStatus === 'active';
  const isTemporaryUser = !!currentUser?.isTemporary;

  chatData.forEach(chat => {
    const isOwner = chat.userId === currentUserId;
    const isPremiumChat = chat.isPremium || false;
    const isNSFW = chat.nsfw || false;
    const genderClass = chat.gender ? `chat-gender-${chat.gender.toLowerCase()}` : '';
    const styleClass = chat.imageStyle ? `chat-style-${chat.imageStyle.toLowerCase()}` : '';
    let nsfwVisible = $.cookie('nsfw') === 'true';

    // Using col-md-4 col-lg-3 for potentially 3-4 cards per row
    let cardClass = `gallery-card col-6 col-sm-4 col-md-3 col-lg-3 col-xl-2 p-1 animate__animated animate__fadeIn ${genderClass} ${styleClass}`;
    if (isPremiumChat) cardClass += ' premium-chat';
    if (isNSFW) cardClass += ' nsfw-true';

    let imageSrc = chat.chatImageUrl || chat.thumbnailUrl || '/img/logo.webp';
    let nsfwOverlay = '';

    // NSFW Overlay Logic
    if (isNSFW && !nsfwVisible) {
        if (!isOwner && ((isTemporaryUser || !subscriptionStatus))) {
             nsfwOverlay = `<div class="gallery-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center" style="background: rgba(0,0,0,0.55); z-index: 2; backdrop-filter: blur(5px);">
                                <span class="badge bg-danger mb-2" style="font-size: 0.9rem;"><i class="bi bi-exclamation-triangle"></i> NSFW</span>
                                <button class="btn btn-sm btn-outline-light mt-2" onclick="handleClickRegisterOrPay(event,${isTemporaryUser})" style="font-size: 12px; border-radius: 50px;">
                                    ${isTemporaryUser ? (window.translations?.register || 'Register to View') : (window.translations?.subscribe || 'Subscribe to View')}
                                </button>
                            </div>`;
        }
    }

    htmlContent += `
        <div class="${cardClass}" data-id="${chat._id}" style="cursor:pointer;">
            <div class="card gallery-hover shadow-sm border-0 h-100 position-relative overflow-hidden">
                <a href="/character/slug/${chat.slug}" class="text-decoration-none">
                    <div class="gallery-image-wrapper" style="aspect-ratio: 4/5; background: #f8f9fa; position: relative;">
                        <img src="${imageSrc}" class="card-img-top gallery-img" alt="${chat.name}" style="height: 100%; width: 100%; object-fit: cover;">
                        ${nsfwOverlay}
                    </div>
                    <div class="card-body p-2 d-flex flex-column">
                        <h6 class="card-title small fw-bold mb-1 text-truncate text-dark" style="font-size: 0.85rem;">${chat.name}</h6>
                        ${isPremiumChat ? '<span class="badge bg-warning text-dark position-absolute top-0 end-0 m-1 small" style="font-size: 0.6rem !important; padding: 0.2em 0.4em !important;">Premium</span>' : ''}
                    </div>
                </a>
                ${ (isAdmin) ? `
                <div class="position-absolute top-0 start-0 m-1" style="z-index:3;">
                    <button class="btn btn-sm btn-outline-secondary border-0 ${chat.nsfw ? 'nsfw' : ''}" onclick="toggleChatNSFW(this); event.stopPropagation();" data-id="${chat._id}" style="background: #00000050;color: white;padding: 1px 5px;font-size: 12px; border-radius: 0.2rem;">
                        ${chat.nsfw ? '<i class="bi bi-eye-slash-fill"></i>' : '<i class="bi bi-eye-fill"></i>'}
                    </button>
                </div>` : ''}
            </div>
        </div>
    `;
  });

  const galleryElement = $(document).find(`#${targetGalleryId}`);
  if (galleryElement.length) {
    galleryElement.append(htmlContent);
  } else {
    console.warn(`Target gallery with ID #${targetGalleryId} not found.`);
  }
};
window.displayLatestChats = function (chatData, targetGalleryId, modal = false) {
  let htmlContent = '';
  const currentUser = user; 
  const currentUserId = currentUser._id;
  const subscriptionStatus = currentUser.subscriptionStatus === 'active';
  const isTemporaryUser = !!currentUser?.isTemporary;

  chatData.forEach(chat => {
    const isOwner = chat.userId === currentUserId;
    const isPremiumChat = chat.isPremium || false;
    const isNSFW = chat.nsfw || false;
    const genderClass = chat.gender ? `chat-gender-${chat.gender.toLowerCase()}` : '';
    const styleClass = chat.imageStyle ? `chat-style-${chat.imageStyle.toLowerCase()}` : '';
    let nsfwVisible = $.cookie('nsfw') === 'true';

    // Using col-lg-3 col-xl-2 for potentially 5-6 cards per row on larger screens
    let cardClass = `gallery-card col-6 col-sm-4 col-md-3 col-lg-3 col-xl-2 p-1 animate__animated animate__fadeIn ${genderClass} ${styleClass}`;
    if (isPremiumChat) cardClass += ' premium-chat';
    if (isNSFW) cardClass += ' nsfw-true';

    let imageSrc = chat.chatImageUrl || chat.thumbnailUrl || '/img/logo.webp';
    let nsfwOverlay = '';

    // Simplified NSFW Overlay Logic - adapt to your full existing logic if more complex
    if (isNSFW && !nsfwVisible) {
        if (!isOwner && ((isTemporaryUser || !subscriptionStatus))) {
             nsfwOverlay = `<div class="gallery-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center" style="background: rgba(0,0,0,0.55); z-index: 2; backdrop-filter: blur(5px);">
                                <span class="badge bg-danger mb-2" style="font-size: 0.9rem;"><i class="bi bi-exclamation-triangle"></i> NSFW</span>
                                <button class="btn btn-sm btn-outline-light mt-2" onclick="loadPlanPage(event, ${isTemporaryUser})" style="font-size: 12px; border-radius: 50px;">
                                    ${isTemporaryUser ? (window.translations?.register || 'Register to View') : (window.translations?.subscribe || 'Subscribe to View')}
                                </button>
                            </div>`;
        } else if (!isOwner && subscriptionStatus && isPremiumChat && !nsfwVisible) {
             nsfwOverlay = `<div class="gallery-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center" style="background: rgba(0,0,0,0.55); z-index: 2; backdrop-filter: blur(5px);">
                                <span class="badge bg-danger mb-2" style="font-size: 0.9rem;"><i class="bi bi-exclamation-triangle"></i> NSFW</span>
                                <small class="text-white-50 px-2 text-center" style="font-size:0.75rem;">${window.translations?.nsfwHiddenPref || 'NSFW content hidden by preference.'}</small>
                            </div>`;
        }
    }
    htmlContent += `
      <div class="${cardClass}" data-id="${chat._id}" style="cursor:pointer;" onclick="redirectToChat('${chat._id}','${imageSrc}')">
        <div class="card gallery-hover shadow-sm border-0 h-100 position-relative overflow-hidden">
          <div class="gallery-image-wrapper" style="aspect-ratio: 4/5; background: #f8f9fa; position: relative;">
            <img src="${imageSrc}" class="card-img-top gallery-img" alt="${chat.name}" style="height: 100%; width: 100%; object-fit: cover;">
            ${nsfwOverlay}
          </div>
          <div class="card-body p-2 d-flex flex-column">
            <h6 class="card-title small fw-bold mb-1 text-truncate" style="font-size: 0.85rem;">${chat.name}</h6>
            ${isPremiumChat ? '<span class="badge bg-warning text-dark position-absolute top-0 end-0 m-1 small" style="font-size: 0.6rem !important; padding: 0.2em 0.4em !important;">Premium</span>' : ''}
          </div>
          ${ isOwner ? `
          <div class="position-absolute top-0 end-0 m-1" style="z-index:3;">
            <span class="badge bg-light text-secondary shadow" style="font-size: 0.6rem !important; padding: 0.2em 0.4em !important;opacity:0.8;">
              <i class="bi bi-person-fill"></i>
            </span>
          </div>` : ''}
          ${ (isAdmin) ? `
          <div class="position-absolute top-0 start-0 m-1" style="z-index:3;">
            <button class="btn btn-sm btn-outline-secondary border-0 ${chat.nsfw ? 'nsfw' : ''}" onclick="toggleChatNSFW(this); event.stopPropagation();" data-id="${chat._id}" style="background: #00000050;color: white;padding: 1px 5px;font-size: 12px; border-radius: 0.2rem;">
              ${chat.nsfw ? '<i class="bi bi-eye-slash-fill"></i>' : '<i class="bi bi-eye-fill"></i>'}
            </button>
          </div>` : ''}
        </div>
      </div>
    `;
    
  });

  const galleryElement = $(document).find(`#${targetGalleryId}`);
  if (galleryElement.length) {
    galleryElement.append(htmlContent);
  } else {
    console.warn(`Target gallery with ID #${targetGalleryId} not found.`);
  }

  // Apply filters if it's the popular chats gallery
  if (targetGalleryId === 'chat-gallery') { // 'chat-gallery' is the ID for popular chats
    if (typeof updateChatFilters === "function") {
        updateChatFilters();
    }
  }
  // You can add similar filter logic for latest chats if needed
};

window.displayChats = function (chatData, searchId = null, modal = false) {

  let htmlContent = '';
  chatData.forEach(chat => {
      if (chat.name || chat.chatName) {
            // Normalize nsfw to boolean (handles string "true"/"false" and boolean)
            const nsfw = chat?.nsfw === true || chat?.nsfw === 'true';
            const moderationFlagged = Array.isArray(chat?.moderation?.results) && chat.moderation.results.length > 0
            ? !!chat.moderation.results[0].flagged
            : false;
            const finalNsfwResult = nsfw || moderationFlagged;
            chat.premium = (chat.premium || finalNsfwResult)
          // --- Begin: Random sample image selection logic ---
          let sampleImages = [];
          // Prefer chat.sampleImages if present (from backend cache), fallback to empty array
          if (Array.isArray(chat.sampleImages) && chat.sampleImages.length > 0) {
            sampleImages = chat.sampleImages
              .filter(img => img && img.imageUrl) // filter valid images
              .map(img => img.imageUrl);
          }
          // Always include chatImageUrl if present
          if (chat.chatImageUrl) {
            sampleImages.push(chat.chatImageUrl);
          }
          // Remove duplicates and falsy values
          sampleImages = [...new Set(sampleImages.filter(Boolean))];
          // If nothing, fallback to default
          if (sampleImages.length === 0) {
            sampleImages = ['/img/logo.webp'];
          }

          // Pick a random sample image
          const randomSampleImage = sampleImages[Math.floor(Math.random() * sampleImages.length)];
          // --- End: Random sample image selection logic ---
            htmlContent += `
            <div class="gallery-card ${searchId == 'top-free' ? 'col-6' : 'col-12'} col-sm-3 col-lg-3 mb-4 ${chat.premium ? "premium-chat":''} ${chat.gender ? 'chat-gender-'+chat.gender:''} ${chat.imageStyle ? 'chat-style-'+chat.imageStyle : ''} nsfw-${finalNsfwResult} " style="cursor: pointer;">
            <div class="card shadow border-0 h-100 position-relative gallery-hover" style="overflow: hidden;" 
              onclick="${chat.premium ? `(window.user && window.user.subscriptionStatus === 'active' ? redirectToChat('${chat.chatId || chat._id}','${chat.chatImageUrl || '/img/logo.webp'}') : loadPlanPage())` : `redirectToChat('${chat.chatId || chat._id}','${chat.chatImageUrl || '/img/logo.webp'}')`}">
              <div class="gallery-image-wrapper position-relative" style="aspect-ratio: 4/5; background: #f8f9fa;">
              <img 
              src="${randomSampleImage}" 
              alt="${chat.name || chat.chatName}" 
              class="card-img-top gallery-img transition rounded-top"
              style="object-fit: cover; width: 100%; height: 100%; min-height: 220px;"
              loading="lazy"
              >
              ${finalNsfwResult && (window.user && window.user.subscriptionStatus !== 'active') ? `
              <div data-finalNsfwResult=${finalNsfwResult} class="gallery-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center" style="background: rgba(0,0,0,0.55); z-index:2;">
              <span class="badge bg-danger mb-2" style="font-size: 1rem;"><i class="bi bi-exclamation-triangle"></i> NSFW</span>
              </div>
              ` : ''}
              <div class="gallery-badges position-absolute top-0 end-0 m-2 d-flex flex-column align-items-end" style="z-index:3;">
              ${chat.premium ? `<span class="custom-gradient-bg badge bg-gradient-primary mb-1"> ${translations.premium}</span>` : ''}
              ${chat.imageCount ? `<span class="badge bg-dark mb-1"><i class="bi bi-images"></i> ${chat.imageCount}</span>` : ''}
              ${chat.messagesCount ? `<span class="badge bg-secondary"><i class="bi bi-chat-dots"></i> ${chat.messagesCount}</span>` : ''}
              </div>
              ${(chat.tags || chat.chatTags || []).length ? `
              <div class="gallery-tags position-absolute bottom-0 start-0 w-100 px-2 pb-2 d-flex flex-wrap gap-1" style="z-index:3;">
              ${(chat.tags ? chat.tags : chat.chatTags).map(tag => `<a href="/search?q=${encodeURIComponent(tag)}" class="badge bg-light text-dark border text-decoration-none">#${tag}</a>`).join('')}
              </div>
              ` : ''}
              </div>
              <div class="${searchId == 'top-free' ? 'd-none' : ''} card-body py-3 px-3 d-flex flex-column justify-content-between">
              <div class="d-flex align-items-center mb-2">
              <img src="${chat.chatImageUrl || '/img/avatar.png'}" alt="${chat.name || chat.chatName}" class="rounded-circle me-2 border" width="40" height="40">
              <div>
              <h5 class="card-title mb-0 fw-semibold text-truncate" title="${chat.name || chat.chatName}">${chat.name || chat.chatName}</h5>
              ${chat.nickname ? `<a href="/user/${chat.userId}" class="text-muted small">@${chat.nickname}</a>` : ''}
              </div>
              </div>
              <div class="d-flex justify-content-between align-items-center mt-auto">
              <button class="btn btn-outline-primary btn-sm persona ${chat.premium ? 'border-warning' : ''}" data-id="${chat.chatId || chat._id}" title="Add to Persona">
              <i class="far fa-user-circle"></i>
              </button>
              ${
              window.isAdmin
                ? `<button 
                  class="btn btn-light ms-2 chat-nsfw-toggle ${finalNsfwResult ? 'nsfw' : 'sfw'}" 
                  data-id="${chat.chatId || chat._id}" 
                  onclick="toggleChatNSFW(this)">
                  <i class="bi ${finalNsfwResult ? 'bi-eye-slash-fill' : 'bi-eye-fill'}"></i>
                </button>`
                : ''
              }
              </div>
              </div>
            </div>
            </div>
            `;
      }
  });
  if(searchId == 'top-free'){
    $('#top-free-chats-gallery').append(htmlContent);
    return
  }
  // Append the generated HTML to the gallery
  $(document).find('#chat-gallery').append(htmlContent);
};

window.toggleChatNSFW = function(el) {
  //Avoid propagation
  event.stopPropagation();
  const isTemporary = !!user.isTemporary;
  // if (isTemporary) { openLoginForm(); return; }

  const $this = $(el);
  const chatId = $this.data('id');
  const isNSFW = $this.hasClass('nsfw'); // Check if already marked as NSFW

  const nsfwStatus = !isNSFW; // Toggle NSFW status

  $this.toggleClass('nsfw'); // Toggle NSFW class for UI change

  // Update the button icon based on the NSFW status
  const icon = nsfwStatus 
    ? '<i class="bi bi-eye-slash-fill"></i>'   // NSFW icon (eye-slash for hidden content)
    : '<i class="bi bi-eye-fill"></i>';        // Non-NSFW icon (eye for visible content)

  $this.html(icon); // Update the button's icon

  $.ajax({
    url: `/api/chat/${chatId}/nsfw`, // Endpoint for updating NSFW status
    method: 'PUT',
        xhrFields: {
            withCredentials: true
        },
    contentType: 'application/json',
    data: JSON.stringify({ nsfw: nsfwStatus }), // Send NSFW status in request body
    success: function () {
      // Show success notification in Japanese
      if (nsfwStatus) {
        showNotification('NSFWに設定されました！', 'success');
      } else {
        showNotification('NSFW設定が解除されました！', 'success');
      }
    },
    error: function () {
      $this.toggleClass('nsfw'); // Revert the class change if request fails
      $this.html(isNSFW 
        ? '<i class="bi bi-eye-fill"></i>' 
        : '<i class="bi bi-eye-slash-fill"></i>'); // Revert the icon as well
      showNotification('リクエストに失敗しました。', 'error');
    }
  });
}
window.loadAllUserPosts = async function (page = 1) {
    const currentUser = user
    console.log(currentUser)
    const currentUserId = currentUser._id;
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isAdmin = await checkIfAdmin(currentUserId);    
    const isTemporary = !!currentUser?.isTemporary
    $.ajax({
      url: `/user/posts?page=${page}`,
      method: 'GET',
        xhrFields: {
            withCredentials: true
        },
      success: function (data) {
        let galleryHtml = '';
        data.posts.forEach(item => {
            let isBlur = item?.post?.nsfw && !subscriptionStatus 
            const isLiked = item?.post?.likedBy?.some(id => id.toString() === currentUserId.toString());

            galleryHtml += `
              <div class="col-12 col-md-3 col-lg-2 mb-2">
                <div class="card shadow-0">
                  <div class="d-flex align-items-center p-2">
                    <a href="/user/${item.userId}">
                      <img src="${item.profilePicture}" alt="${item.userName}" class="rounded-circle me-2" width="40" height="40">
                    </a>
                    <a href="/user/${item.userId}" class="text-decoration-none text-dark">
                      <strong>${item.userName}</strong>
                    </a>
                  </div>
                  ${isBlur ? `
                  <div type="button" onclick=${isTemporary?`openLoginForm()`:`loadPlanPage()`}>
                    <img data-src="${item.post.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;">
                  </div>
                  ` : `
                  <a href="/post/${item.post.postId}" class="text-muted text-decoration-none">
                    <img src="${item.post.imageUrl}" alt="${item.post.prompt}" class="card-img-top">
                  </a>
                  <div class="d-none card-body p-2 d-flex align-items-center justify-content-between">
                    <div class="row">
                            <div class="col-12" style="overflow:hidden; text-wrap:nowrap;">
                                <a href="/post/${item.post.postId}" class="text-muted text-decoration-none text-short">${item.post.comment}</a>
                            </div>
                            <div class="col-12 text-end">
                                <button 
                                class="btn btn-light post-nsfw-toggle ${!isAdmin?'d-none':''}" 
                                data-id="${item.post.postId}"
                                onclick="togglePostNSFW(this)">
                                    <i class="bi ${item?.post?.nsfw ? 'bi-eye-slash-fill':'bi-eye-fill'}"></i> 
                                </button>
                                <button 
                                class="btn btn-light shadow-0 post-fav  ${isLiked ? 'liked' : ''}" 
                                data-id="${item.post.postId}"
                                onclick="togglePostFavorite(this)"
                                > 
                                    <i class="bi bi-heart-fill me-2"></i>いいね 
                                    <span class="ct">${item.post.likes || 0}</span>
                                </button>
                            </div>
                        </div>
                  </div>
                  `}
                </div>
              </div>
            `;
        });

        $('#post-gallery').append(galleryHtml);
        if($('#user-posts-pagination-controls').length > 0){
            generateUserPostsPagination(data.page, data.totalPages);
        }

        $(document).find('.img-blur').each(function() {
            blurImage(this);
        });
      },
      error: function (err) {
        console.error('Failed to load posts', err);
      }
    });
}
function scrollToPlan() {
    $('html, body').animate({
        scrollTop: $('#pricing-container').offset().top
    }, 800); // Adjust the duration (800ms) as needed
}

window.searchImages = async function () {
    $(`.all-chats-images-gallery`).each(function(){
        const container = $(this)
        const query = container.attr('data-query')
        const style = container.attr('data-style')
        resultImageSearch(1,query,style); 
    })
}
window.resultImageSearch = async function (page = 1,query,style = 'anime', callback) {
    const currentUser = user
    const currentUserId = currentUser._id;
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isAdmin = await checkIfAdmin(currentUserId);    
    $.ajax({
      url: `/chats/images/search?page=${page}&query=${query}&style=${style}`,
      method: 'GET',
        xhrFields: {
            withCredentials: true
        },
      success: function (data) {
        let chatGalleryHtml = '';
        data.images.forEach(item => {
            let isBlur = item?.nsfw && !subscriptionStatus 
            const isLiked = item?.likedBy?.some(id => id.toString() === currentUserId.toString());
            chatGalleryHtml += `
                <div class="col-6 col-md-3 col-lg-2 mb-2">
                    <div class="card shadow-0">
                        ${isBlur ? `
                        <div type="button" onclick="handleClickRegisterOrPay(event,${isTemporary})">
                            <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;" >
                        </div>
                        ` : `
                        <a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" class="text-muted text-decoration-none">
                            <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top">
                        </a>
                        <div class="d-none card-body p-2 d-flex align-items-center justify-content-between">
                            <a href="/chat/${item.chatId}" class="btn btn-outline-secondary"> <i class="bi bi-chat-dots me-2"></i> ${translations.startChat}</a>
                            <button class="btn btn-light image-nsfw-toggle ${!isAdmin?'d-none':''} ${item?.nsfw ? 'nsfw':'sfw'}" data-id="${item._id}">
                                <i class="bi ${item?.nsfw ? 'bi-eye-slash-fill':'bi-eye-fill'}"></i> 
                            </button>
                            <span 
                            class="btn btn-light float-end image-fav ${isLiked ? 'liked':''}" 
                            data-id="${item._id}" 
                            onclick="toggleImageFavorite(this)"
                            >
                                <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                            </span>
                        </div>
                        `}
                    </div>
                </div>
            `;
        });

        $(`.all-chats-images-gallery[data-query="${query}"]`).append(chatGalleryHtml);

        $(document).find('.img-blur').each(function() {
            blurImage(this);
        });

        if (typeof callback === 'function') {
            callback(data.images);
        }
      },
      error: function (err) {
        console.error('Failed to load images', err);
      }
    });
}
// Load All Chat Images with cache + infinite scroll
window.loadAllChatImages = function (page = 1, reload = false) {
    const cacheKey = 'allChatsImagesCache'
    const currentUserId = user._id
    const subscriptionStatus = user.subscriptionStatus === 'active'
  
    // Return a Promise for sync with infinite scroll
    return new Promise(async (resolve, reject) => {
      // Check admin once here
      const isAdmin = await checkIfAdmin(currentUserId)
  
      // Retrieve or init cache
      let cacheData = JSON.parse(localStorage.getItem(cacheKey) || '{}')
      if (!cacheData.pages) cacheData.pages = {}
      allChatsImagesCache = cacheData.pages
  
      // List cached pages
      const cachedPages = Object.keys(allChatsImagesCache).map(Number).sort((a, b) => a - b)
      const maxCachedPage = cachedPages.length ? Math.max(...cachedPages) : 0
  
      // If reload => append all cached pages, set current page
      if (reload) {
        cachedPages.forEach((p) => {
          appendAllChatsImages(allChatsImagesCache[p], subscriptionStatus, isAdmin)
        })
        allChatsCurrentPage = maxCachedPage
        if (maxCachedPage > 0) page = maxCachedPage + 1 // optional: refresh the last cached page
      }
  
      // If page is in cache and not reloading => skip server call
      if (allChatsImagesCache[page] && !reload) {
        appendAllChatsImages(allChatsImagesCache[page], subscriptionStatus, isAdmin)
        allChatsCurrentPage = page
        generateAllChatsImagePaginationFromCache() // updates spinner/back-to-top
        return resolve()
      }
  
      // Otherwise, fetch from server
      $.ajax({
        url: `/chats/images?page=${page}`,
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: (data) => {
          appendAllChatsImages(data.images, subscriptionStatus, isAdmin)
  
          // Cache the new page
          allChatsImagesCache[data.page] = data.images
          cacheData.pages = allChatsImagesCache
          localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  
          // Update currentPage, then set up infinite scroll
          allChatsCurrentPage = data.page
          generateAllChatsImagePagination(data.totalPages)
          resolve()
        },
        error: (err) => {
          console.error(`Failed to load page ${page} from server`, err)
          reject(err)
        },
      })
    })
  }
  
  // Infinite scroll + pagination for All Chats images
  window.generateAllChatsImagePagination = function (totalPages) {
    $(window).off('scroll').on('scroll', () => {
      if (
        !allChatsLoadingState &&
        allChatsCurrentPage < totalPages &&
        $(window).scrollTop() + $(window).height() >= $(document).height() - 100
      ) {
        allChatsLoadingState = true
        loadAllChatImages(allChatsCurrentPage + 1, false)
          .then(() => {
            allChatsLoadingState = false
          })
          .catch(() => {
            allChatsLoadingState = false
          })
      }
    })
    updateAllChatsPaginationControls(totalPages)
  }
  
  // If we skip a server call (using only cache), refresh controls
  function generateAllChatsImagePaginationFromCache() {
    // If you don't store totalPages, set a high number or store it separately
    updateAllChatsPaginationControls(9999)
  }
  
  // Spinner vs. Back-to-Top
  function updateAllChatsPaginationControls(totalPages) {
    if (allChatsCurrentPage >= totalPages) {
      console.log('All Chats: No more pages to load.')
    } else {
      $('#all-chats-images-pagination-controls').html(
        '<div class="text-center"><div class="spinner-border" role="status"></div></div>'
      )
    }
  }
  
  // Append images to #all-chats-images-gallery
  function appendAllChatsImages(images, subscriptionStatus, isAdmin) {
    const currentUserId = user._id
    const isTemporary = !!user.isTemporary
    let chatGalleryHtml = ''
  
    images.forEach((item) => {
      const isBlur = item?.nsfw && !subscriptionStatus
      const isLiked = item?.likedBy?.some((id) => id.toString() === currentUserId.toString())

      chatGalleryHtml += `
        <div class="col-6 col-md-3 col-lg-2 mb-2">
          <div class="card shadow-0">
            ${
              isBlur
                ? `<div type="button" onclick="handleClickRegisterOrPay(event,${isTemporary})">
                      <a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" class="text-muted text-decoration-none">
                        <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;">
                      </a>
                   </div>`
                : `<a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" class="text-muted text-decoration-none">
                     <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top">
                   </a>
                   <div class="${!isAdmin ? 'd-none' : ''} card-body p-2 d-flex align-items-center justify-content-between">
                     <a href="/chat/${item.chatId}" class="btn btn-outline-secondary col-12">
                       <i class="bi bi-chat-dots me-2"></i> ${translations.startChat}
                     </a>
                     <button class="btn btn-light image-nsfw-toggle ${!isAdmin ? 'd-none' : ''} ${item?.nsfw ? 'nsfw' : 'sfw'}" data-id="${item._id}">
                       <i class="bi ${item?.nsfw ? 'bi-eye-slash-fill' : 'bi-eye-fill'}"></i>
                     </button>
                     <span 
                     class="btn btn-light float-end image-fav ${isLiked ? 'liked' : ''}" 
                     data-id="${item._id}" 
                     onclick="toggleImageFavorite(this)" 
                     >
                       <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                     </span>
                   </div>`
            }
          </div>
        </div>
      `
    })
  
    $('#all-chats-images-gallery').append(chatGalleryHtml)
    $(document).find('.img-blur').each(function () {
      blurImage(this)
    })
  }
// Load user images with cache + infinite scroll
window.loadUserImages = function (userId, page = 1, reload = false) {
    return new Promise((resolve, reject) => {
      const cacheKey = `userImages_${userId}`
      let cacheData = JSON.parse(localStorage.getItem(cacheKey) || '{}')
      if (!cacheData.pages) cacheData.pages = {}
      userImagesCache[userId] = cacheData.pages
  
      let cachedPages = Object.keys(userImagesCache[userId]).map(Number)
      let maxCachedPage = cachedPages.length ? Math.max(...cachedPages) : 0
  
      // If reload => render all cached pages in ascending order, update currentPageMap
      if (reload) {
        cachedPages.sort((a, b) => a - b).forEach((p) => {
          appendImages(userImagesCache[userId][p])
        })
        currentPageMap[userId] = maxCachedPage
        // Optionally refresh the last cached page from the server:
        if (maxCachedPage > 0) page = maxCachedPage + 1
      }
  
      // If the page is already in cache and we're NOT reloading => skip server call
      if (userImagesCache[userId][page] && !reload) {
        appendImages(userImagesCache[userId][page])
        currentPageMap[userId] = page
        generateImagePaginationFromCache(userId) // update spinner/back-to-top if needed
        return resolve()
      }
  
      // Otherwise, fetch from server
      $.ajax({
        url: `/user/${userId}/liked-images?page=${page}`,
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: (data) => {
          appendImages(data.images)
  
          // Store in cache
          userImagesCache[userId][data.page] = data.images
          cacheData.pages = userImagesCache[userId]
          localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  
          // Update currentPageMap, then pagination
          currentPageMap[userId] = data.page
          generateImagePagination(data.totalPages, userId)
          resolve()
        },
        error: (err) => {
          reject(err)
        },
      })
    })
  }
  
  window.generateImagePagination = function (totalPages, userId) {
    if (!loadingStates[userId]) loadingStates[userId] = false
    if (!currentPageMap[userId]) currentPageMap[userId] = 0
  
    $(window).off('scroll').on('scroll', () => {
      // If near bottom & still have pages left
      if (
        !loadingStates[userId] &&
        currentPageMap[userId] < totalPages &&
        $(window).scrollTop() + $(window).height() >= $(document).height() - 100
      ) {
        loadingStates[userId] = true
        loadUserImages(userId, currentPageMap[userId] + 1, false)
          .then(() => {
            loadingStates[userId] = false
          })
          .catch((e) => {
            loadingStates[userId] = false
          })
      }
    })
  
    updatePaginationControls(totalPages, userId)
  }
  
  // If we skip a server call by using cache only, just refresh the pagination controls
  function generateImagePaginationFromCache(userId) {
    let totalPages = 9999 // or figure out from somewhere else if needed
    updatePaginationControls(totalPages, userId)
  }
  
  // Common function to update spinner/back-to-top
  function updatePaginationControls(totalPages, userId) {
    if (currentPageMap[userId] >= totalPages) {
    } else {
      $('#images-pagination-controls').html(
        '<div class="text-center"><div class="spinner-border" role="status"></div></div>'
      )
    }
  }
  
  // Append images to gallery
  function appendImages(images) {
    const currentUserId = user._id
    const subscriptionActive = user.subscriptionStatus === 'active'
    const isTemp = !!user.isTemporary
  
    let html = ''
    images.forEach((item) => {
      const blurred =  item.nsfw && !subscriptionActive
      const liked = item.likedBy?.some((id) => id.toString() === currentUserId.toString())
      html += `
        <div class="col-6 col-md-3 col-lg-2 mb-2">
          <div class="card">
            <div class="d-flex align-items-center p-2">
              <a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}">
                <img src="${item.thumbnail}" alt="" class="rounded-circle me-2" width="40" height="40">
              </a>
              <a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" class="text-decoration-none text-dark">
                <strong>${item.chatName}</strong>
              </a>
            </div>
            ${
              blurred
                ? `<div type="button" onclick=handleClickRegisterOrPay(event,${isTemp})>
                     <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;">
                   </div>`
                : `<a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" class="text-muted text-decoration-none">
                     <img data-src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top lazy-image" loading="lazy">
                   </a>
                   <div class="d-none card-body p-2 d-flex align-items-center justify-content-between">
                     <a href="/chat/${item.chatId}?imageId=${item._id}" class="btn btn-outline-secondary">
                       <i class="bi bi-chat-dots me-2"></i> ${translations.startChat}
                     </a>
                     <span 
                     class="btn btn-light float-end image-fav ${liked ? 'liked' : ''}" 
                     data-id="${item._id}" 
                     onclick="toggleImageFavorite(this)"
                     >
                       <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                     </span>
                   </div>`
            }
          </div>
        </div>
      `
    })
    $('#user-images-gallery').append(html)
    $('.img-blur').each((_, el) => blurImage(el))
  }
window.loadUserPosts = async function (userId, page = 1, like = false) {
    const currentUser = user
    const currentUserId = currentUser._id
    const subscriptionStatus = currentUser.subscriptionStatus == 'active'
    const isTemporary = !!currentUser?.isTemporary
    $.ajax({
      url: `/user/${userId}/posts?page=${page}&like=${like}`,
      method: 'GET',
        xhrFields: {
            withCredentials: true
        },
      success: function (data) {
        let galleryHtml = '';
        data.posts.forEach(item => {
            let isBlur = item?.image?.nsfw && !subscriptionStatus 
            const isLiked = item?.likedBy?.some(id => id.toString() === currentUserId.toString());
            galleryHtml += `
                <div class="col-12 col-md-6 col-lg-4 mb-2">
                <div class="card">
                    <div class="d-flex align-items-center p-2">
                        <a href="/user/${item.userId}">
                            <img src="${item?.profilePicture}" alt="${item?.userName}" class="rounded-circle me-2" width="40" height="40">
                        </a>
                        <a href="/user/${item.userId}" class="text-decoration-none text-dark">
                            <strong>${item?.userName}</strong>
                        </a>
                    </div>
                    ${isBlur ? `
                    <div type="button" handleClickRegisterOrPay(event,${isTemporary})>
                        <img data-src="${item.image.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;" >
                    </div>
                    ` : `
                    <a href="/post/${item._id}" class="text-muted text-decoration-none">
                        <img src="${item.image.imageUrl}" alt="${item.image.prompt}" class="card-img-top">
                    </a>
                    <div class="d-none card-body p-2">
                        <div class="row mx-0">
                            <div class="col-12" style="overflow:hidden; text-wrap:nowrap;">
                                <a href="/post/${item._id}" class="text-muted text-decoration-none text-short ">${item.comment || 'No Comment'}</a>
                            </div>
                            <div class="col-12 text-end">
                                <button 
                                class="btn btn-light shadow-0 post-fav  ${isLiked ? 'liked' : ''}" 
                                data-id="${item._id}
                                onclick="togglePostFavorite(this)"> 
                                    <i class="bi bi-heart-fill me-2"></i>いいね 
                                    <span class="ct">${item.likes || 0}</span>
                                </button>
                                <span 
                                class="float-end post-visible d-none ${item.isPrivate ? 'private':''} ${item.userId.toString() != currentUser._id.toString() ? 'd-none':''}" 
                                data-id="${item._id}"
                                onclick="togglePostVisibility(this)"
                                >
                                    <i class="bi ${item.isPrivate ? 'bi-eye-slash':'bi-eye'} me-2" style="cursor: pointer;"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                    `}
                </div>
                </div>
            `;
        });
        const containerId = like ? 'user-posts-like' : 'user-posts-gallery'
        $(`#${containerId}`).append(galleryHtml);
        const pageContainerId = like ? 'posts-like-pagination-controls' : 'pagination-controls';
        if($(`#${pageContainerId}`).length > 0){
            generateUserPostPagination(data.page, data.totalPages, userId);
        }

        $(document).find('.img-blur').each(function() {
            blurImage(this);
        });
      },
      error: function (err) {
        console.log('Failed to load posts', err);
      }
    });
}

function initializePersonaStats(personas) {

    if(personas){
        $('.persona').each(function() {
            const personaId = $(this).data('id');
            if (personas.includes(personaId)) {
                $(this).addClass('on')
                $(this).find('i').addClass('fas').removeClass('far');
            } else {
                $(this).removeClass('on')
                $(this).find('i').addClass('far').removeClass('fas');
            }
        });
    }
}


window.showPremiumPopup = async function() {
    const user = user
    const isTemporary = !!user?.isTemporary
    if(isTemporary){
        openLoginForm()
        return
    }
    const features = [
        "毎日無制限でチャットできる",
        "フレンドを無制限で作成できる",
        "新しいキャラクターを作成する",
        "新機能への早期アクセス",
        "優先的なサポート対応"
    ];
    const messageTitle = '🚀 プレミアムプランで<br>体験をアップグレードしよう！';
    const messageText = `
        <div class="premium-offer" style="background-color: #fff3cd; border-radius: 10px; padding: 10px; margin-bottom: 15px;">
            <h6 style="color: #856404; font-weight: bold; text-align: center;">今なら登録するだけで<br><strong>1,000コイン</strong>をプレゼント！</h6>
        </div>
        <p style="font-size: 12px; text-align: center;">無制限の機能とエクスクルーシブな特典をお楽しみいただけます。<br>今すぐプレミアムプランに登録して、すべての機能を最大限に活用しましょう。</p>
        <ul class="premium-features" style="list-style-type: none; padding-left: 0; margin-bottom: 15px;">
            ${features.map(feature => `<li style="font-size: 14px; margin-bottom: 5px;"><span style="color: #f39c12;">🔥</span> ${feature}</li>`).join('')}
        </ul>
        <p style="font-size: 12px; text-align: center;">いつでもキャンセル可能、質問なしで対応いたします。<br>また、お支払いは <strong>最も安全なStripe</strong> で行われます。</p>
    `;

    // Display the first premium promotion popup using Swal.fire
    Swal.fire({
        //imageUrl: '/img/premium-promo.png', // Replace with your image URL
        imageWidth: '80%',
        imageHeight: 'auto',
        position: 'center',
        html: `
            <div class="container-0">
                <div class="row justify-content-center">
                    <div class="text-start">
                        <h5 class="fw-bold text-center">${messageTitle}</h5>
                        <div class="premium-content" style="background-color: #f8f9fa; border-radius: 10px; padding: 20px; box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);">
                            ${messageText}
                            <a href="/my-plan" class="btn btn-dark border-0 shadow-0 w-100 custom-gradient-bg mt-3" style="font-size: 16px; padding: 10px;">プレミアムプランを確認する</a>
                        </div>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: false,
        showConfirmButton: false,
        showCloseButton: true,
        animation: false,
        showClass: {
            popup: 'animate__animated animate__fadeIn'
        },
        hideClass: {
            popup: 'animate__animated animate__slideOutRight'
        },
        customClass: {
            popup: 'swal2-custom-popup animate__animated animate__fadeIn',
            closeButton: 'swal2-custom-close-button' 
        },
        didOpen: () => {
            // Initially hide the close button
            document.querySelector('.swal2-custom-close-button').style.display = 'none';

            // Show the close button after 5 seconds
            setTimeout(() => {
                $('.swal2-custom-close-button').fadeIn('slow')
            }, 3000);
        }
    }).then((result) => {
        $.cookie('showPremiumPopup', true, { expires: 1/24 });
        if (result.dismiss) {
            // Display a secondary popup after the first one is closed
            Swal.fire({
                position: 'top-end',
                title: '<strong>プレミアムプランでさらに楽しもう！</strong>',
                html: `
                    <p style="font-size: 14px; margin-bottom: 10px;">今なら1,000コインをプレゼント中！</p>
                    <a href="/my-plan" class="btn btn-dark border-0 shadow-0 w-100 custom-gradient-bg" style="font-size: 14px; padding: 8px;">今すぐプレゼントを受け取る</a>
                `,
                showConfirmButton: false,
                showCloseButton: true,
                backdrop: false,
                allowOutsideClick: false,
                customClass: {
                    title: 'swal2-custom-title',
                    popup: 'swal2-custom-popup bg-light border border-dark',
                    content: 'swal2-custom-content',
                    closeButton: 'swal2-top-left-close-button',
                    popup: 'swal2-custom-popup animate__animated animate__fadeIn',
                },
                showClass: {
                    popup: 'animate__animated animate__fadeIn'
                },
                hideClass: {
                    popup: 'animate__animated animate__slideOutRight'
                },
            });
            
        }
        
        
    });
}

window.generateCompletion = async function(systemPrompt, userMessage) {
    try {
        const response = await $.ajax({
            url: '/api/generate-completion',
            type: 'POST',
            contentType: 'application/json',
            xhrFields: {
                withCredentials: true
            },
            data: JSON.stringify({ systemPrompt: systemPrompt, userMessage: userMessage })
        });
        return response.completion;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}




function updateSwiperSlides(images) {
    // Ensure Swiper container exists
    const swiperContainer = document.querySelector('.swiper-container');
    const swiperWrapper = swiperContainer.querySelector('.swiper-wrapper');
    
    if (!swiperContainer || !swiperWrapper) {
        console.error('Swiper container or wrapper is missing.');
        return;
    }

    // Append new slides
    images.forEach((image, index) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.setAttribute('data-index', index);
        slide.innerHTML = `<img src="${image.imageUrl}" alt="${image.prompt}" class="card-img-top rounded shadow m-auto" style="object-fit: contain;height: 100%;width: 100%;">`;
        swiperWrapper.appendChild(slide);
    });

    // Initialize or update Swiper
    if (!swiperInstance) {
        swiperInstance = new Swiper('.swiper-container', {
            loop: false,
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
        });
    } else {
        swiperInstance.update(); // Update existing instance with new slides
    }

    // Navigate to the current index
    swiperInstance.slideTo(currentSwiperIndex, 0);
}

// Load chat images (with cache + infinite scroll)
window.loadChatImages = function (chatId, page = 1, reload = false, isModal = false) {  
    return new Promise(async (resolve, reject) => {
      const cacheKey = `chatImages_${chatId}`
      const currentUserId = user._id
      const subscriptionStatus = user.subscriptionStatus === 'active'
      const isAdmin = await checkIfAdmin(currentUserId)
      const isTemporary = !!user.isTemporary
  
      // Retrieve or init cache
      let cacheData = JSON.parse(localStorage.getItem(cacheKey) || '{}')
      if (!cacheData.pages) cacheData.pages = {}
      chatImagesCache[chatId] = cacheData.pages
  
      // Show which pages are cached
      let cachedPages = Object.keys(chatImagesCache[chatId]).map(Number).sort((a, b) => a - b)
      let maxCachedPage = cachedPages.length ? Math.max(...cachedPages) : 0
  
      // If reload => render all cached pages in ascending order, update currentPage
      if (reload) {
        cachedPages.forEach((p) => {
          appendChatImages(chatImagesCache[chatId][p], subscriptionStatus, isAdmin, isTemporary)
        })
        chatCurrentPageMap[chatId] = maxCachedPage
        if (maxCachedPage > 0) page = maxCachedPage + 1 // optionally refresh the last cached page
      }
  
      // If already cached and NOT reload => skip server call
      if (chatImagesCache[chatId][page] && !reload) {
        appendChatImages(chatImagesCache[chatId][page], subscriptionStatus, isAdmin, isTemporary)
        chatCurrentPageMap[chatId] = page
        generateChatImagePaginationFromCache(chatId) // update spinner/back-to-top if needed
        return resolve()
      }
  
      // Otherwise fetch from server
      $.ajax({
        url: `/chat/${chatId}/images?page=${page}`,
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: (data) => {
          chatCurrentPageMap[chatId] = data.page
  
          // Append
          appendChatImages(data.images, subscriptionStatus, isAdmin, isTemporary)
  
          // Cache
          chatImagesCache[chatId][data.page] = data.images
          cacheData.pages = chatImagesCache[chatId]
          localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  
          // Set up infinite scroll
          generateChatImagePagination(data.totalPages, chatId, isModal)
          resolve()
        },
        error: (err) => {
          reject(err)
        },
      })
    })
  }
  
  // Minimal helper to append chat images
  function appendChatImages(images, subscriptionStatus, isAdmin, isTemporary) {
    const currentUserId = user._id
    let chatGalleryHtml = ''

    images.forEach(async(item) => {
      const isBlur = item?.nsfw && !subscriptionStatus
      const isLiked = item?.likedBy?.some((id) => id.toString() === currentUserId.toString())

      // If not blurred & not in loadedImages => push into loadedImages
      if (!isBlur && !loadedImages.some((img) => img._id === item._id)) {
        loadedImages.push(item)
      }
      let index = loadedImages.length - 1
  
      chatGalleryHtml += `
        <div class="col-6 col-md-3 col-lg-2 mb-2">
          <div class="card shadow-0">
            ${
              isBlur
                ? `<div type="button" onclick="handleClickRegisterOrPay(event,${isTemporary})">
                      <a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" data-index="${index}">
                        <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;">
                      </a>
                   </div>`
                : `<a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" data-index="${index}">
                     <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top">
                   </a>
                   <div class="${!isAdmin ? 'd-none' : ''} card-body p-2 row mx-0 px-0 align-items-center justify-content-between">
                     <button 
                     class="btn btn-light col-6 image-nsfw-toggle ${!isAdmin ? 'd-none' : ''} ${item?.nsfw ? 'nsfw' : 'sfw'}" 
                     data-id="${item._id}"
                      onclick="toggleImageNSFW(this)"
                      >
                       <i class="bi ${item?.nsfw ? 'bi-eye-slash-fill' : 'bi-eye-fill'}"></i>
                     </button>
                     <span 
                      class="btn btn-light float-end col-6 image-fav ${isLiked ? 'liked' : ''}" 
                      data-id="${item._id}"
                      onclick="toggleImageFavorite(this)"
                      >
                       <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                     </span>
                   </div>`
            }
          </div>
        </div>
      `
    })
  
    $('#chat-images-gallery').append(chatGalleryHtml);
    // Add a grid handler to the gallery to allow the user to use a slider to change the columns
    gridLayout('#chat-images-gallery')
    $(document).find('.img-blur').each(function () {
      blurImage(this)
    });

  }
  
function gridLayout(selector) {
  // Check if the selector exists
  const $container = $(selector);
  if ($container.length === 0) {
    return;
  }

  // Find the image items (typically in a column div)
  const $items = $container.children('div');
  if ($items.length === 0) return; // No items to adjust
  
  // If a grid controller already exists, don't create another one
  if ($container.prev('.grid-control').length > 0) {
    return;
  }
  
  // Determine current grid size by examining the first item's classes
  let currentValue = 3; // Default to 3 per row
  const $firstItem = $items.first();
  if ($firstItem.attr('class')) {
    const classList = $firstItem.attr('class').split(/\s+/);
    
    // Check for various Bootstrap column classes
    for (const className of classList) {
      // Check for col-N classes (regular, md, lg, etc.)
      const matches = className.match(/col-(?:xs-|sm-|md-|lg-|xl-|xxl-)?(\d+)/);
      if (matches && matches[1]) {
        currentValue = Math.min(6, Math.max(1, 12 / parseInt(matches[1])));
        break;
      }
    }
  }
  
  // Create a unique ID for the slider
  const sliderId = `grid-slider-${Math.random().toString(36).substring(2, 11)}`;
  
  // Create the slider control HTML with an icon
  const sliderHtml = `
    <div class="grid-control mb-3">
      <label for="${sliderId}" class="form-label d-flex justify-content-between align-items-center">
        <span><i class="bi bi-grid"></i> ${translations?.gridSize || 'Grid Size'}</span>
        <span class="grid-size-display badge bg-light text-dark">${currentValue} ${translations?.perRow || 'per row'}</span>
      </label>
      <input type="range" class="form-range" min="1" max="6" value="${currentValue}" id="${sliderId}">
    </div>
  `;
  
  // Insert the slider before the container
  $container.before(sliderHtml);
  
  // Get the slider element
  const $slider = $(`#${sliderId}`);
  const $sizeDisplay = $slider.closest('.grid-control').find('.grid-size-display');
  
function updateGrid(value) {
  $sizeDisplay.text(`${value} ${translations?.perRow || 'per row'}`);

  let effectiveValue = parseInt(value);
  const screenWidth = window.innerWidth;

  // On small screens (<768px), cap at 3 columns max
  if (screenWidth < 768 && effectiveValue > 3) {
    effectiveValue = 3;
    $sizeDisplay.text(`3 ${translations?.perRow || 'per row'} (max on small screens)`);
  }

  // Remove ALL Bootstrap grid classes and custom col-20p class
  // The improved regex captures all possible col-* classes including col-20p
  $container.children('div').each(function() {
    const $div = $(this);
    const classes = $div.attr('class') ? $div.attr('class').split(/\s+/) : [];
    const filtered = classes.filter(c =>
      !/^col(-[a-z]{2,3})?-\d+$/.test(c) && c !== 'col-20p'
    );
    $div.attr('class', filtered.join(' '));
  });

  // Handle 5 columns (custom 20% width)
  if (effectiveValue === 5) {
    // Add the custom CSS if it doesn't exist yet
    if (!$('#grid-custom-css').length) {
      $('head').append(`
        <style id="grid-custom-css">
          .col-20p { 
            width: 20%; 
            flex: 0 0 20%;
            max-width: 20%;
            position: relative;
            padding-right: 15px;
            padding-left: 15px;
          }
        </style>
      `);
    }
    $container.children('div').each(function() {
      if (screenWidth < 768) {
        $(this).addClass('col-6');
      } else {
        $(this).addClass('col-20p');
      }
    });
  } else {
    // Standard Bootstrap grid
    if (screenWidth < 768) {
      // 1: col-12, 2: col-6, 3: col-4
      const colClass = `col-${12 / effectiveValue}`;
      $container.children('div').each(function() {
        $(this).addClass(colClass);
      });
    } else {
      const colSize = Math.floor(12 / effectiveValue);
      $container.children('div').each(function() {
        $(this).addClass(`col-${colSize} col-sm-${colSize} col-md-${colSize} col-lg-${colSize} col-xl-${colSize}`);
      });
    }
  }

  localStorage.setItem('gridPreference', value);
}
  
  // Check for saved preference
  const savedPreference = localStorage.getItem('gridPreference');
  if (savedPreference) {
    $slider.val(savedPreference);
    updateGrid(savedPreference);
  }
  
  // Add event listener for slider changes
  $slider.on('input', function() {
    updateGrid($(this).val());
  });
}

// Infinite scroll / pagination
window.generateChatImagePagination = function (totalPages, chatId, isModal = false) {
  if (!chatLoadingStates[chatId]) chatLoadingStates[chatId] = false;
  if (!chatCurrentPageMap[chatId]) chatCurrentPageMap[chatId] = 0;

  const scrollContainer = isModal ? $('#characterModal .modal-body') : $(window);

  scrollContainer.off('scroll').on('scroll', function () {
      const currentScrollPosition = isModal ? scrollContainer.scrollTop() : $(window).scrollTop();
      const containerHeight = isModal ? scrollContainer.innerHeight() : $(window).height();
      const contentHeight = isModal ? scrollContainer[0].scrollHeight : $(document).height();

      if (
          !chatLoadingStates[chatId] &&
          chatCurrentPageMap[chatId] < totalPages &&
          currentScrollPosition + containerHeight >= contentHeight - 100
      ) {
          console.log(`Infinite scroll => next page: ${chatCurrentPageMap[chatId] + 1}`);
          chatLoadingStates[chatId] = true;
          loadChatImages(chatId, chatCurrentPageMap[chatId] + 1, false)
              .then(() => {
                  chatLoadingStates[chatId] = false;
                  console.log(`Finished loading page ${chatCurrentPageMap[chatId]}`);
              })
              .catch((err) => {
                  chatLoadingStates[chatId] = false;
                  console.error('Failed to load the next page:', err);
              });
      }
  });

  updateChatPaginationControls(totalPages, chatId);
};

  // If we skip the server call due to cache only
  function generateChatImagePaginationFromCache(chatId) {
    console.log(`generateChatImagePaginationFromCache => chatId:${chatId}`)
    // If you don't store totalPages, set a large number or store it somewhere else
    updateChatPaginationControls(9999, chatId)
  }
  
  // Spinner or back-to-top
  function updateChatPaginationControls(totalPages, chatId) {
    if (chatCurrentPageMap[chatId] >= totalPages) {
      console.log('All Chats: No more pages to load.')
    } else {
      $('#chat-images-pagination-controls').html(
        '<div class="text-center"><div class="spinner-border" role="status"></div></div>'
      )
    }
  }

$(document).ready(function () {
    let currentPage = 1;
    let isFetchingChats = false;
  
    // Adjust these as needed
    const currentUser = window.user || {};
    const currentUserId = currentUser._id;
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
  
    // Check admin rights (optional async call)
    let isAdmin = false;
    if (currentUserId) {
      checkIfAdmin(currentUserId)
        .then(result => {
          isAdmin = result;
        })
        .catch(err => console.error('Failed to check admin status:', err));
    }
  
    /**
     * Fetch Chats with Images (Vertical Infinite Scroll)
     */
    function fetchChatsWithImages(page) {
      if (isFetchingChats) return;
      isFetchingChats = true;
  
      $.ajax({
        url: `/chats/horizontal-gallery?page=${page}`,
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: function (data) {
          let chatsHtml = '';
  
          data.chats.forEach(chat => {
            let chatImagesHtml = '';
  
            // Loop through images in each chat
            chat.images.forEach((item, index) => {
                // Display a maximum of 12 images per chat
                if (index >= 12) return;
              // Check unlock logic (adapt to your own logic)
              const isBlur = item.nsfw && !subscriptionStatus;
              // Check if user has “liked” this image
              const isLiked = Array.isArray(item.likedBy)
                ? item.likedBy.some(id => id.toString() === currentUserId.toString())
                : false;
              
              chatImagesHtml += `
                <div class="horizontal-image-wrapper col-12 col-md-4 col-lg-2 mb-2">
                  <div class="card shadow-0">
                    ${
                      isBlur
                        ? `
                          <!-- Blurred Image -->
                          <div 
                            type="button" 
                            onclick="handleClickRegisterOrPay(event,${isTemporary})"
                          >
                          <a 
                            href="/character/slug/${chat.slug}?imageSlug=${item.slug}" 
                            class="text-muted text-decoration-none"
                            data-index="${index}"
                          >
                            <img 
                              data-src="${item.imageUrl}" 
                              class="card-img-top img-blur" 
                              style="object-fit: cover;"
                            >
                          </div>
                          </a>
                        `
                        : `
                          <!-- Unblurred Image -->
                          <a 
                            href="/character/slug/${chat.slug}?imageSlug=${item.slug}" 
                            class="text-muted text-decoration-none"
                            data-index="${index}"
                          >
                            <img 
                              src="${item.imageUrl}" 
                              alt="${item.prompt}" 
                              class="card-img-top"
                            >
                          </a>
                          <!-- Admin/Like Controls -->
                          <div class="${
                            !isAdmin ? 'd-none' : ''
                          } card-body p-2 d-flex align-items-center justify-content-between">
                            <button 
                              class="btn btn-light image-nsfw-toggle ${
                                !isAdmin ? 'd-none' : ''
                              } ${item.nsfw ? 'nsfw' : 'sfw'}" 
                              data-id="${item._id}"
                                onclick="toggleImageNSFW(this)"
                            >
                              <i class="bi ${
                                item.nsfw ? 'bi-eye-slash-fill' : 'bi-eye-fill'
                              }"></i> 
                            </button>
                            <span 
                              class="btn btn-light float-end image-fav ${
                                isLiked ? 'liked' : ''
                              }" 
                              data-id="${item._id}"
                              onclick="toggleImageFavorite(this)"
                            >
                              <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                            </span>
                          </div>
                        `
                    }
                  </div>
                </div>
              `;
            });
  
            // Wrap each chat with its title/description and horizontal scroll container
            chatsHtml += `
              <div class="chat-item mb-4">
                <div class="d-flex justify-content-start align-items-center">
                    <a href="/character/slug/${chat.slug}"><span style="font-size: 18px; font-weight: 700;">${chat.name}</span></a>
                    <a href="/character/slug/${chat.slug}"><span class="badge custom-gradient-bg ms-2">${chat.imageCount}</span></a>
                </div>
                <p>${chat?.first_message || chat.description}</p>
                <!-- Horizontal scrolling container -->
                <div class="chat-images-horizontal row flex-nowrap" data-chat-id="${chat._id}" style="overflow-x:auto;">
                  ${chatImagesHtml}
                </div>
              </div>
            `;
          });
  
          // Append the generated HTML for all chats

          
          $('#all-chats-container').append(chatsHtml);
  
          // Attach horizontal scrolling listeners
          attachHorizontalScrollListeners();
  
          // Apply blur if needed
          $(document)
            .find('.img-blur')
            .each(function () {
              blurImage(this);
            });
  
          // Reset fetching flag and increment page
          isFetchingChats = false;
          currentPage++;
        },
        error: function (err) {
          console.error('Failed to load chats', err);
          isFetchingChats = false;
        }
      });
    }
  
    /**
     * Horizontal Infinite Scrolling for Each Chat’s Images
     */
    function attachHorizontalScrollListeners() {
      $('.chat-images-horizontal').off('scroll').on('scroll', function () {
        const $container = $(this);
        // If near the right edge, load more images
        if ($container[0].scrollWidth - $container.scrollLeft() <= $container.outerWidth() + 50) {
          const chatId = $container.data('chat-id');
          const currentImages = $container.find('.horizontal-image-wrapper').length;
  
          // Fetch more images for the chat (only if your backend supports offset/pagination)
          $.ajax({
            url: `/chats/${chatId}/images?skip=${currentImages}`,
            method: 'GET',
            xhrFields: {
                withCredentials: true
            },
            success: function (data) {
              let additionalImagesHtml = '';
  
              data.images.forEach((item, index) => {
                const isBlur = item.nsfw && !subscriptionStatus;
                const isLiked = Array.isArray(item.likedBy)
                  ? item.likedBy.some(id => id.toString() === currentUserId.toString())
                  : false;
  
                additionalImagesHtml += `
                  <div class="horizontal-image-wrapper col-12 col-md-4 col-lg-2 mb-2">
                    <div class="card shadow-0">
                      ${
                        isBlur
                          ? `
                            <div 
                              type="button" 
                              onclick="handleClickRegisterOrPay(event,${isTemporary})"
                            >
                              <img 
                                data-src="${item.imageUrl}" 
                                class="card-img-top img-blur" 
                                style="object-fit: cover;"
                              >
                            </div>
                          `
                          : `
                            <a 
                              href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" 
                              class="text-muted text-decoration-none"
                            >
                              <img 
                                src="${item.imageUrl}" 
                                alt="${item.prompt}" 
                                class="card-img-top"
                              >
                            </a>
                            <div class="${
                              !isAdmin ? 'd-none' : ''
                            } card-body p-2 d-flex align-items-center justify-content-between">
                              <button 
                                class="btn btn-light image-nsfw-toggle ${
                                  !isAdmin ? 'd-none' : ''
                                } ${item.nsfw ? 'nsfw' : 'sfw'}" 
                                data-id="${item._id}"
                                onclick="toggleImageNSFW(this)"
                              >
                                <i class="bi ${
                                  item.nsfw ? 'bi-eye-slash-fill' : 'bi-eye-fill'
                                }"></i> 
                              </button>
                              <span 
                                class="btn btn-light float-end image-fav ${
                                  isLiked ? 'liked' : ''
                                }" 
                                data-id="${item._id}"
                                onclick="toggleImageFavorite(this)"
                              >
                                <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                              </span>
                            </div>
                          `
                      }
                    </div>
                  </div>
                `;
              });
  
              $container.append(additionalImagesHtml);
  
              // Re-apply blur to newly added images
              $(document)
                .find('.img-blur')
                .each(function () {
                  blurImage(this);
                });
            },
            error: function (err) {
              console.error('Failed to load more images', err);
            }
          });
        }
      });
    }
  
    /**
     * Vertical Infinite Scroll for Chats
     */
    $(window).on('scroll', function () {
      if ($(window).scrollTop() + $(window).height() >= $(document).height() - 50) {
        fetchChatsWithImages(currentPage);
      }
    });
  
    /**
     * Initial Load
     */
    fetchChatsWithImages(currentPage);
});
  
window.getLanguageName = function(langCode) {
    const langMap = {
        en: "english",
        fr: "french",
        ja: "japanese"
    };
    return langMap[langCode] || "japanese";
}


// Pagination logic simplified with loadingStates
function generateUserPostsPagination(totalPages) {
    if (typeof loadingStates === 'undefined') loadingStates = {};
    if (typeof currentPageMap === 'undefined') currentPageMap = {};

    if (typeof loadingStates['userPosts'] === 'undefined') loadingStates['userPosts'] = false;
    if (typeof currentPageMap['userPosts'] === 'undefined') currentPageMap['userPosts'] = 1;

    $(window).off('scroll').on('scroll', function() {
        if (!loadingStates['userPosts'] && currentPageMap['userPosts'] < totalPages && $(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            loadingStates['userPosts'] = true;
            loadAllUserPosts(currentPageMap['userPosts'] + 1).then(() => {
                currentPageMap['userPosts']++;
                loadingStates['userPosts'] = false;
            }).catch(() => {
                loadingStates['userPosts'] = false;
            });
        }
    });

    if (currentPageMap['userPosts'] >= totalPages) {
      console.log('All Chats: No more pages to load.')
    } else {
        $('#user-posts-pagination-controls').html(
            '<div class="text-center"><div class="spinner-border" role="status"></div></div>'
        );
    }
}

function generateUserPostsPagination(userId, totalPages) {
    if (typeof loadingStates === 'undefined') loadingStates = {}; // Ensure the loadingStates object exists
    if (typeof currentPageMap === 'undefined') currentPageMap = {}; // Ensure the currentPageMap object exists

    if (typeof loadingStates[userId] === 'undefined') loadingStates[userId] = false;
    if (typeof currentPageMap[userId] === 'undefined') currentPageMap[userId] = 1; // Initialize the current page for the user

    // Scroll event listener for infinite scroll
    $(window).off('scroll').on('scroll', function() {
        if (!loadingStates[userId] && currentPageMap[userId] < totalPages && $(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            loadingStates[userId] = true;
            loadAllUserPosts(currentPageMap[userId] + 1).then(() => {
                currentPageMap[userId]++; // Increment the page after successful loading
                loadingStates[userId] = false; // Reset the loading state
            }).catch(() => {
                // Handle errors if needed
                loadingStates[userId] = false;
            });
        }
    });

    // Display spinner if more pages are available, otherwise show a back-to-top button
    if (currentPageMap[userId] >= totalPages) {
      console.log('All Chats: No more pages to load.')
    } else {
        $('#user-posts-pagination-controls').html(
            '<div class="text-center"><div class="spinner-border" role="status"></div></div>'
        );
    }
}
window.startCountdown = function() {
  const countdownElements = $('.countdown-timer');
  let storedEndTime = localStorage.getItem('countdownEndTime');
  const now = Date.now();

  if (!storedEndTime) {
    storedEndTime = now + 30 * 60 * 1000;
    localStorage.setItem('countdownEndTime', storedEndTime);
  } else {
    storedEndTime = parseInt(storedEndTime);
  }

  countdownElements.each(function() {
    const element = $(this);
    const id = element.attr('id') || `countdown-${Math.random().toString(36).substr(2, 9)}`;
    element.attr('id', id);

    const interval = setInterval(() => updateCountdown(element, storedEndTime, interval), 10); // Update every 10ms
    updateCountdown(element, storedEndTime, interval);
  });
}

window.updateCountdown = function(element, endTime, interval) {
  const remaining = endTime - Date.now();

  if (remaining <= 0) {
    element.text('00:00.00');
    localStorage.removeItem('countdownEndTime');
    clearInterval(interval);
    loadPlanPage();
    return;
  }

  const minutes = Math.floor(remaining / (60 * 1000));
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
  const milliseconds = Math.floor((remaining % 1000) / 10); // Convert to two-digit milliseconds
  element.text(
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`
  );
}


    // jQuery function to display tags
    function displayTags(imageStyle) {
      let tags;
      if (!tags || !tags.length) {
          $.get(`/api/tags`, function(response) {
          const totalPages = response.totalPages;
          const randomPage = Math.floor(Math.random() * totalPages) + 1; // Random page number between 1 and totalPages
          $.get(`/api/tags?page=${randomPage}`, function(response) {
              tags = response.tags;
              tags = tags.slice(0,30)
              renderTags(tags,imageStyle);
          });
          });
      } else {
          renderTags(tags,imageStyle);
      }
  }


  window.renderTags = function(tags, imageStyle) {
    $('#tags-container').empty();
    
    if (!tags.length) {
      $('#tags-container').html('');
      $('.tag-list-container').hide();
      return;
    }
    $('.tag-list-container').show();
    tags = tags.filter(tag => tag !== '');
    const html = `
      <div class="tags-wrapper py-2">
        <div class="tags-cloud d-flex flex-wrap gap-2 justify-content-center">
          ${tags.map(tag => 
            `<a href="/search?q=${encodeURIComponent(tag)}" 
                class="tag-item px-3 py-2 rounded-pill text-decoration-none"
                data-tag="${tag}">
                #${tag}
             </a>`
          ).join('')}
        </div>
      </div>`;
    $('#tags-container').html(html);
    
  }

// Object to manage modal loading status
const modalStatus = {
    isSettingsLoading: false,
    isCharacterCreationLoading: false,
    isPlanLoading: false,
    isCharacterModalLoading: false,
    isLoginLoading: false
};

// Function to close any opened modal
window.closeAllModals = function() {
    const modals = ['settingsModal', 'characterCreationModal', 'planUpgradeModal', 'characterModal', 'loginModal'];
    modals.forEach(modalId => {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
    });

}

// Function to load settings page & execute script settings.js & open #settingsModal
function loadSettingsPage() {
    if (modalStatus.isSettingsLoading) return;
    modalStatus.isSettingsLoading = true;

    closeAllModals();

    const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    $('#settings-container').html('<div class="position-absolute d-flex justify-content-center align-items-center" style="inset:0;"><div class="spinner-border" role="status"></div></div>');
    settingsModal.show();

    $.ajax({
        url: '/settings',
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: function(data) {
            $('#settings-container').html(data);
            const script = document.createElement('script');
            script.src = '/js/settings.js';
            script.onload = function() {
                modalStatus.isSettingsLoading = false;
            };
            script.onerror = function() {
                console.error('Failed to load settings.js script.');
                modalStatus.isSettingsLoading = false;
            };
            document.body.appendChild(script);
        },
        error: function(err) {
            console.error('Failed to load settings page', err);
            modalStatus.isSettingsLoading = false;
        }
    });
}


// Function to load character creation page & execute scripts & open #characterCreationModal
function loadCharacterCreationPage(chatId) {
    if (modalStatus.isCharacterCreationLoading) return;
    modalStatus.isCharacterCreationLoading = true;

    closeAllModals();

    const characterCreationModal = new bootstrap.Modal(document.getElementById('characterCreationModal'));
    $('#character-creation-container').html('<div class="position-absolute d-flex justify-content-center align-items-center" style="inset:0;"><div class="spinner-border" role="status"></div></div>');
    characterCreationModal.show();

    let redirectUrl = '/chat/edit/';
    if (chatId) {
        redirectUrl += chatId;
    }

    $.ajax({
        url: redirectUrl,
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: function(data) {
            if(!data){
                $('#characterCreationModal').one('shown.bs.modal', () => {
                    characterCreationModal.hide();
                    modalStatus.isCharacterCreationLoading = false;
                    loadPlanPage();
                    return
                });
            }
            $('#character-creation-container').html(data);

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/image-uploader.css';
            document.head.appendChild(link);

            const imageUploaderScript = document.createElement('script');
            imageUploaderScript.src = '/js/image-uploader.js';
            document.body.appendChild(imageUploaderScript);

            const script = document.createElement('script');
            script.src = '/js/character-creation.js';
            script.onload = function() {
                modalStatus.isCharacterCreationLoading = false;
            };
            script.onerror = function() {
                console.error('Failed to load character-creation.js script.');
                modalStatus.isCharacterCreationLoading = false;
            };
            document.body.appendChild(script);
        },
        error: function(err) {
            console.error('Failed to load character creation page', err);
            modalStatus.isCharacterCreationLoading = false;
        }
    });
}

// Load the plan page and open the modal
function loadPlanPage() {
    console.log('loadPlanPage called');
    if(!user) {
      console.log(user)
      console.log('User is not logged in or is temporary, aborting loadPlanPage.');
      return;
    }
    if (modalStatus.isPlanLoading) {
      console.log('Plan modal is already loading, aborting duplicate loadPlanPage.');
      return;
    }
    modalStatus.isPlanLoading = true;

    closeAllModals();

    const planModal = new bootstrap.Modal(document.getElementById('planUpgradeModal'));
    $('#plan-container').html('<div class="position-absolute d-flex justify-content-center align-items-center" style="inset:0;"><div class="spinner-border" role="status"></div></div>');
    planModal.show();

    $.ajax({
        url: '/my-plan',
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: function(data) {
            $('#plan-container').html(data);
            const script = document.createElement('script');
            script.src = '/js/plan.js';
            script.onload = function() {
                modalStatus.isPlanLoading = false;
            };
            script.onerror = function() {
                console.error('Failed to load plan.js script.');
                modalStatus.isPlanLoading = false;
            };
            document.body.appendChild(script);
        },
        error: function(err) {
            console.error('Failed to load plan page', err);
            modalStatus.isPlanLoading = false;
        }
    });
}


// Open /character/:id?modal=true to show the character modal
function openCharacterModal(modalChatId, event) {
    event.stopPropagation();
    event.preventDefault(); 
    if (modalStatus.isCharacterModalLoading) return;
    modalStatus.isCharacterModalLoading = true;

    closeAllModals();

    const characterModal = new bootstrap.Modal(document.getElementById('characterModal'));
    $('#character-modal-container').html('<div class="position-absolute d-flex justify-content-center align-items-center" style="inset:0;"><div class="spinner-border" role="status"></div></div>');
    characterModal.show();

    const url = `/character/${modalChatId}?modal=true`;
    $.ajax({
        url: url,
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        success: function(data) {
            $('#character-modal-container').html(data);
            $(document).ready(function () {
                if (modalChatId) {
                    loadChatImages(modalChatId, 1, true, true);
                }
            });
            modalStatus.isCharacterModalLoading = false;
        },
        error: function(err) {
            console.error('Failed to open character modal', err);
            modalStatus.isCharacterModalLoading = false;
        }
    });
}

// Function to open the Clerk user profile page
window.openUserProfile = function() {
  if (window.Clerk) {
    window.Clerk.openUserProfile();
  } else {
    console.error('Clerk is not initialized');
  }
};

window.handleClickRegisterOrPay = function(event, isTemporary) {
  event.preventDefault();
  if (isTemporary) {
      openLoginForm();
  } else {
      loadPlanPage();
  }
}

window.updatePromptActivatedCounter = function() {
  
  const $prompts = $('.prompt-card');
  
  const total = $prompts.length;
  const activated = $prompts.filter('.active').length;
  
  $('#prompt-activated-counter').html(`<span class="badge custom-gradient-bg">${activated}/${total}</>`);
}

    // Function to update the UI when a specific custom prompt is activated
    // This is typically called via a WebSocket notification
    window.updateCustomPrompt = function(promptId) { 
      const $promptCard = $(`.prompt-card[data-id="${promptId}"]`);
      if ($promptCard.length) {
          // Find the next prompt-card after the current one
          const $nextPrompt = $promptCard.next('.prompt-card');
          if ($nextPrompt.length) {
              $nextPrompt.addClass('active').removeClass('inactive');
              showNotification(translations['promptCardActivated'], 'success');
          } else {
              console.warn(`No next prompt-card found after promptId ${promptId}.`);
          }
      } else {
          console.warn(`Prompt card with ID ${promptId} not found to update active state.`);
      }

      updatePromptActivatedCounter();
  };