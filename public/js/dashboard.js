
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
        contentType: 'application/json',
        data: JSON.stringify({ lang })
    });

    if (updateResponse.success) {
        await loadTranslations(lang);
        $('#languageDropdown').text(getLanguageDisplayName(lang));
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
            //showRegistrationForm();
          }
        });
    }

    if (success && sessionId) {
        $.ajax({
            url: `/plan/update-${success}`,
            method: 'POST',
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
        // if user is not temporary
        if (!isTemporary) {
            // Check if the user has already dismissed the popup
            if (!localStorage.getItem('dismissedAddToHomeScreenPopup')) {
                // Show the popup after a delay
                setTimeout(showAddToHomeScreenPopup, 5000);
            }
        }
        
    }
    //checkAndRedirect();
    window.showUpgradePopup = function(limitType) {
    
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
    if(isTemporary){ showRegistrationForm(); return; }
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
  if (isTemporary) { showRegistrationForm(); return; }

  const $this = $(el);
  const postId = $this.data('id');
  const isLiked = $this.hasClass('liked'); // Check if already liked

  const action = isLiked ? 'unlike' : 'like'; // Determine action

  $this.toggleClass('liked');

  $.ajax({
    url: `/posts/${postId}/like-toggle`, // Single endpoint
    method: 'POST',
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

window.logoutUser = function() {
  $.ajax({
    url: '/user/logout',
    type: 'POST',
    success: function(response) {
      // Clear all cookies
      Object.keys($.cookie()).forEach(function(cookie) {
        $.removeCookie(cookie, { path: '/' });
      });

      // Clear all localStorage data
      localStorage.clear();
      sessionStorage.clear();

      // Redirect to the homepage
      window.location.href = '/';
    },
    error: function() {
      Swal.fire({
        title: 'エラー',
        text: 'ログアウトに失敗しました',
        icon: 'error'
      });
    }
  });
};

window.toggleImageFavorite = function(el) {
  const isTemporary = !!user.isTemporary;
  if (isTemporary) { showRegistrationForm(); return; }

  const $this = $(el);
  const imageId = $this.data('id');
  const isLiked = $this.hasClass('liked'); // Check if already liked

  const action = isLiked ? 'unlike' : 'like'; // Determine action
  $this.toggleClass('liked');

  $.ajax({
    url: `/gallery/${imageId}/like-toggle`, // Single endpoint
    method: 'POST',
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
    },
    error: function() {
      $this.toggleClass('liked');
      showNotification('リクエストに失敗しました。', 'error');
    }
  });
};
window.togglePostVisibility = function(el) {
  const isTemporary = !!user.isTemporary;
  if (isTemporary) { showRegistrationForm(); return; }

  const $this = $(el);
  const postId = $this.data('id');
  const isPrivate = $this.hasClass('private'); // Check if already private

  const newPrivacyState = !isPrivate; // Toggle privacy state

  $.ajax({
    url: `/posts/${postId}/set-private`, // Single endpoint for both public and private
    method: 'POST',
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
  //if (isTemporary) { showRegistrationForm(); return; }

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
  // if (isTemporary) { showRegistrationForm(); return; }

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
  if (isTemporary) { showRegistrationForm(); return; }

  const $this = $(el);
  const userId = $this.data('user-id');
  const isFollowing = $this.hasClass('following'); // Check if already following

  const action = isFollowing ? false : true;
  $this.toggleClass('following');

  $.ajax({
    url: `/user/${userId}/follow-toggle`, // Single endpoint for both follow/unfollow
    method: 'POST',
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
    data: { imageUrl },
    success: function(response) {
      updateChatBackgroundImage(imageUrl)
      console.log(response);
    }
  });
}

    
window.updateChatBackgroundImage = function(thumbnail) {
  const currentImageUrl = $('#chat-container').css('background-image').replace(/url\(["']?|["']?\)$/g, '');
  if (currentImageUrl !== thumbnail) {
      $('#chat-container').css('background-image', `url(${thumbnail})`);
  }
}

function handleImageSuccess(img, blob, imageUrl) {
    let objectUrl = URL.createObjectURL(blob);
    $(img).attr('src', objectUrl).data('processed', "true").removeAttr('data-original-src').removeAttr('data-src').removeAttr('srcset');
    createOverlay(img, imageUrl);
}

function createOverlay(img, imageUrl) {
    let overlay = $('<div></div>').addClass('d-flex flex-column align-items-center justify-content-center animate__animated animate__fadeIn').css({
        position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', 'background-color': 'rgba(19, 19, 19, 0.19)', color: 'white'
    });
    let buttonElement = $('<button></button>').text(window.translations['blurButton'] || '画像を見る').addClass('btn btn-sm btn-outline-light mt-3 animate__animated animate__pulse').css({'font-size': '14px', 'border-radius':'50px', cursor: 'pointer'}).on('click', function() {
        //$(img).attr('src', imageUrl);
        //overlay.remove();
    });
    let textElement = $('<div></div>').addClass('fw-bold').css({'font-size': '12px', 'text-shadow': '0 0 5px black'});
    overlay.append(buttonElement, textElement);
    $(img).wrap('<div style="position: relative; display: inline-block;"></div>').after(overlay);
}

  $(document).on('contextmenu', '.img-blur', function(e) {
    e.preventDefault();
  });
  
  
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
    return currentUser?.unlockedItems?.includes(id) || currentUser._id == ownerId
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
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadUsers(1)">1</button>`;
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
        success: function (data) {
            let chatUsersHtml = '';
            data.users.forEach(user => {
                chatUsersHtml += `
                    <div class="me-3 text-center" style="min-width: 100px;">
                        <a href="/user/${user.userId}" class="text-decoration-none text-dark">
                            <img src="${user.profileUrl || '/img/default-avatar.png'}" alt="${user.nickname}" class="rounded-circle mb-2" width="60px" height="60px">
                            <div>${user.nickname}</div>
                        </a>
                    </div>
                `;
            });

            $('#chat-users-gallery').append(chatUsersHtml);
            // Optionally, handle pagination if needed
            // generateChatUserPagination(data.page, data.totalPages, chatId);
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
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <a href="/user/${user.userId}" class="d-flex align-items-center text-decoration-none">
                        <img src="${user.profilePicture}" alt="${user.userName}" class="rounded-circle me-3" width="50" height="50">
                        <div class="ms-3">
                            <h5 class="mb-0 text-dark">${user.userName}</h5>
                            <small class="text-muted d-none">@${user.userId}</small>
                        </div>
                    </a>
                </div>
                <a href="/user/${user.userId}" class="btn btn-outline-primary btn-sm">プロフィールを見る</a>
            </li>`;            
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

window.displayUserChats = async function(userId, page = 1) {
    try {
        const response = await fetch(`/api/chats?userId=${userId}&page=${page}`);
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
                          <a href="/character/${chat._id}">
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
                            <a href="/character/${chat._id}" style="text-decoration: none;">
                              <img src="${chat.chatImageUrl || '/img/avatar.png'}" alt="${chat.name}" class="rounded-circle" width="40" height="40">
                            </a>
                          </div>
                          <div class="col-auto">
                            <a href="/character/${chat._id}" class="text-muted" style="text-decoration: none;">
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
      console.log('All Chats: No more pages to load.')
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
  console.log(`Fetching page ${page} from server...`)
  try {
    const response = await fetch(
      `/api/chats?page=${page}&style=${imageStyle}&model=${imageModel}&modelId=${modelId}&q=${query}&userId=${userId}`
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
    console.log('All Chats: No more pages to load.')
  } else {
    $('#chat-pagination-controls').html(
      '<div class="text-center"><div class="spinner-border" role="status"></div></div>'
    )
  }
}


window.displayChats = function (chatData, searchId = null, modal = false) {
  let htmlContent = '';

  chatData.forEach(chat => {
      if (chat.name || chat.chatName) {
          let galleryIco = '';
          let image_count = 0;

          if (chat.galleries && chat.galleries.length > 0) {
              chat.galleries.forEach(gallery => {
                  if (gallery.images && gallery.images.length > 0) {
                      image_count += gallery.images.length;
                  }
              });
              if (image_count > 0) {
                  galleryIco = `
                      <div class="gallery" data-id="${chat.chatId || chat._id}">
                          <span class="btn btn-dark" style="background-color: rgba(66, 70, 59, 0.84);">
                              <i class="bi bi-images me-1"></i><span style="font-size:12px;">${image_count}</span>
                          </span>
                      </div>
                  `;
              }
          }

          htmlContent += `
          <div class="chat-card-container col-6 col-sm-3 col-lg-3 mb-2" ${searchId?`data-id="${searchId}"`:''}>
              <div class="card custom-card bg-transparent shadow-0 border-0 my-3 px-1 pb-3 redirectToChat" style="cursor:pointer;"  onclick="redirectToChat('${chat.chatId || chat._id}','${chat.chatImageUrl || '/img/logo.webp'}')" data-id="${chat.chatId || chat._id}" data-image="${chat.chatImageUrl}">
                  <div data-bg="${chat.chatImageUrl || '/img/logo.webp'}" class="card-img-top girls_avatar position-relative lazy-bg" alt="${chat.name || chat.chatName}">
                      <div id="spinner-${chat.chatId || chat._id}" 
                      class="position-absolute spinner-grow spinner-grow-sm text-light" 
                      role="status" 
                      style="inset:0;margin: auto;display:none;"></div>
                      <div class="position-absolute" style="color: rgb(165 164 164);opacity:0.8; bottom:10px;left:10px;right:10px;">
                          ${(chat.tags || chat.chatTags || []).length ? `<div class="tags d-flex justify-content-between align-items-center flex-wrap">${ (chat.tags ? chat.tags : chat.chatTags ).map(tag => `<span class="badge bg-dark mt-1">${tag}</span>`).join('')}</div>` : ''}
                      </div>
                      <div class="position-absolute text-start" style="top:10px;left:10px">
                        ${chat.premium ? `<div style="opacity:0.8;">
                          <span class="badge custom-gradient-bg mt-1">
                          <i class="bi bi-gem"></i></span>
                          </div>` : ''}
                      </div>
                      <div class="position-absolute text-end" style="top:10px;right:10px">
                          <div class="persona" style="color:rgb(165 164 164);opacity:0.8;" data-id="${chat.chatId || chat._id}">
                              <span class="badge bg-dark" style="width: 30px;"><i class="far fa-user-circle"></i></span>
                          </div>
                          <a ${modal ? `onclick="openCharacterModal('${chat.chatId || chat._id}',event)"` : `href="/character/${chat.chatId || chat._id}"`}>
                              <div class="gallery" style="opacity:0.8;" data-id="${chat.chatId || chat._id}">
                                  <span 
                                  class="btn btn-light text-dark shadow-0 border-0 position-relative"
                                  style="min-width: 30px; font-size: 12px;">
                                    <i class="bi bi-images me-2"></i>
                                    <span class="position-absolute" style="font-size:12px;top:0;right:3px;">${chat.imageCount || 0}</span>
                                  </span>
                              </div>
                          </a>
                          ${galleryIco}
                          ${chat.messagesCount ? `<div style="opacity:0.8;">
                            <span 
                            class="btn btn-light text-dark shadow-0 message-count mt-1 border-0 position-relative" 
                            style="min-width: 30px; font-size: 12px;">
                              <i class="bi bi-chat me-2"></i>
                              <span class="position-absolute" style="font-size:12px;top:0;right:3px;">${chat.messagesCount}</span>
                            </span>
                            </div>` : ''}
                      </div>
                  </div>
                  <div class="card-body bg-transparent border-0 pb-0 px-0 mx-0 text-start">
                      <div class="row mx-0 px-0">
                          <div class="col-12 mx-0 px-0">
                              <span class="btn btn-outline-secondary redirectToChat w-100 mb-2" onclick="redirectToChat('${chat.chatId || chat._id}','${chat.chatImageUrl || '/img/logo.webp'}')"> <i class="bi bi-chat-dots me-2"></i> ${window.translations.startChatting}</span>
                              <div class="d-flex align-items-center justify-content-between">
                                  <h5 class="card-title character-title mb-0">${chat.name || chat.chatName}</h5>
                                  <a href="/user/${chat.userId}" class="text-muted" style="font-size:12px;">${chat.nickname}</a>
                              </div>
                              <a href="/character/${chat.chatId || chat._id}" class="text-muted" style="text-decoration: none;">
                                  <span style="font-size:12px;">${chat?.first_message || chat.description}</span>
                              </a>
                          </div>
                      </div>
                  </div>
              </div>
          </div>`;
      }
  });

  $(document).find('#chat-gallery').append(htmlContent);
};


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
      success: function (data) {
        let galleryHtml = '';
        data.posts.forEach(item => {
            const unlockedItem = isUnlocked(currentUser, item.post.postId, item.userId)
            let isBlur = unlockedItem ? false : item?.post?.nsfw && !subscriptionStatus 
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
        resultImageSearch(1,query,style)
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
      success: function (data) {
        let chatGalleryHtml = '';
        data.images.forEach(item => {
            const unlockedItem = isUnlocked(currentUser, item._id,item.userId)
            let isBlur = unlockedItem ? false : item?.nsfw && !subscriptionStatus 
            const isLiked = item?.likedBy?.some(id => id.toString() === currentUserId.toString());
            chatGalleryHtml += `
                <div class="col-6 col-md-3 col-lg-2 mb-2">
                    <div class="card shadow-0">
                        ${isBlur ? `
                        <div type="button" onclick="handleClickRegisterOrPay(event,${isTemporary})">
                            <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;" >
                        </div>
                        ` : `
                        <a href="/character/${item.chatId}?imageId=${item._id}" class="text-muted text-decoration-none">
                            <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top">
                        </a>
                        <div class="d-none card-body p-2 d-flex align-items-center justify-content-between">
                            <a href="/chat/${item.chatId}" class="btn btn-outline-secondary"> <i class="bi bi-chat-dots me-2"></i> ${translations.startChat}</a>
                            <button class="btn btn-light image-nsfw-toggle ${!isAdmin?'d-none':''} ${item?.nsfw ? 'nsfw':'sfw'}" data-id="${item._id}">
                                <i class="bi ${item?.nsfw ? 'bi-eye-slash-fill':'bi-eye-fill'}"></i> 
                            </button>
                            <span class="btn btn-light float-end image-fav ${isLiked ? 'liked':''}" data-id="${item._id}">
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
      console.log(`Fetching page ${page} from server...`)
      $.ajax({
        url: `/chats/images?page=${page}`,
        method: 'GET',
        success: (data) => {
          appendAllChatsImages(data.images, subscriptionStatus, isAdmin)
  
          // Cache the new page
          allChatsImagesCache[data.page] = data.images
          cacheData.pages = allChatsImagesCache
          localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  
          // Update current page, then set up infinite scroll
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
      const unlockedItem = isUnlocked(user, item._id, item.userId)
      const isBlur = !unlockedItem && item?.nsfw && !subscriptionStatus
      const isLiked = item?.likedBy?.some((id) => id.toString() === currentUserId.toString())
  
      chatGalleryHtml += `
        <div class="col-6 col-md-3 col-lg-2 mb-2">
          <div class="card shadow-0">
            ${
              isBlur
                ? `<div type="button" onclick="handleClickRegisterOrPay(event,${isTemporary})">
                      <a href="/character/${item.chatId}?imageId=${item._id}" class="text-muted text-decoration-none">
                        <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;">
                      </a>
                   </div>`
                : `<a href="/character/${item.chatId}?imageId=${item._id}" class="text-muted text-decoration-none">
                     <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top">
                   </a>
                   <div class="${!isAdmin ? 'd-none' : ''} card-body p-2 d-flex align-items-center justify-content-between">
                     <a href="/chat/${item.chatId}" class="btn btn-outline-secondary col-12">
                       <i class="bi bi-chat-dots me-2"></i> ${translations.startChat}
                     </a>
                     <button class="btn btn-light image-nsfw-toggle ${!isAdmin ? 'd-none' : ''} ${item?.nsfw ? 'nsfw' : 'sfw'}" data-id="${item._id}">
                       <i class="bi ${item?.nsfw ? 'bi-eye-slash-fill' : 'bi-eye-fill'}"></i>
                     </button>
                     <span class="btn btn-light float-end image-fav ${isLiked ? 'liked' : ''}" data-id="${item._id}">
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
      console.log('All Chats: No more pages to load.')
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
      const unlocked = isUnlocked(user, item._id, item.userId)
      const blurred = !unlocked && item.nsfw && !subscriptionActive
      const liked = item.likedBy?.some((id) => id.toString() === currentUserId.toString())
      html += `
        <div class="col-6 col-md-3 col-lg-2 mb-2">
          <div class="card">
            <div class="d-flex align-items-center p-2">
              <a href="/character/${item.chatId}?imageId=${item._id}">
                <img src="${item.thumbnail}" alt="" class="rounded-circle me-2" width="40" height="40">
              </a>
              <a href="/character/${item.chatId}?imageId=${item._id}" class="text-decoration-none text-dark">
                <strong>${item.chatName}</strong>
              </a>
            </div>
            ${
              blurred
                ? `<div type="button" onclick=handleClickRegisterOrPay(event,${isTemp})>
                     <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;">
                   </div>`
                : `<a href="/character/${item.chatId}?imageId=${item._id}" class="text-muted text-decoration-none">
                     <img data-src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top lazy-image" loading="lazy">
                   </a>
                   <div class="d-none card-body p-2 d-flex align-items-center justify-content-between">
                     <a href="/chat/${item.chatId}?imageId=${item._id}" class="btn btn-outline-secondary">
                       <i class="bi bi-chat-dots me-2"></i> ${translations.startChat}
                     </a>
                     <span class="btn btn-light float-end image-fav ${liked ? 'liked' : ''}" data-id="${item._id}">
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
      success: function (data) {
        let galleryHtml = '';
        data.posts.forEach(item => {
            const unlockedItem = isUnlocked(currentUser, item._id, item.userId)
            let isBlur = unlockedItem ? false : item?.image?.nsfw && !subscriptionStatus 
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

window.showRegistrationForm = function(messageId,callback) {
    //window.location = "/authenticate?register=true"
    Swal.fire({
      title: '',
      text: '',
      //imageUrl: '/img/login-bg-862c043f.png', // replace with your image URL
      imageWidth: 'auto',
      imageHeight: 'auto',
      position: 'bottom',
      html: `
            <h2>
                <span class="u-color-grad">LAMIX ${window.translations.RegistrationForm.free}</span><br>
                ${window.translations.RegistrationForm.loginToGenerateImages}
            </h2>
            <p class="text-muted mb-2 header" style="font-size: 16px;">
                ${window.translations.RegistrationForm.startNow}
            </p>
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-8">
                        <div class="card shadow-0 border-0">
                            <div class="card-body">
                                <a href="/user/google-auth" class="btn btn-light ico-login-button mb-3">
                                    <img src="/img/google_logo_neutral.png" alt="Google"/>
                                    <span class="gsi-material-button-contents">${window.translations.RegistrationForm.continueWithGoogle}</span>
                                </a>
                                <a href="/user/line-auth" class="btn btn-light ico-login-button mb-3">
                                    <img src="/img/line_btn_base.png" alt="LINE"/>
                                    <span class="gsi-material-button-contents">${window.translations.RegistrationForm.continueWithLINE}</span>
                                </a>
                                <p>${window.translations.RegistrationForm.or}</p>
                                <a href="/authenticate/mail" class="btn btn-light ico-login-button mb-3 py-2">
                                    <i class="fas fa-envelope me-3"></i>
                                    <span>${window.translations.RegistrationForm.continueWithEmail}</span>
                                </a>
                            </div>
                        </div>
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
          if(typeof callback === 'function'){
            callback()
          }
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
        showRegistrationForm()
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

    images.forEach((item) => {
      const unlockedItem = isUnlocked(user, item._id, item.userId)
      const isBlur = !unlockedItem && item?.nsfw && !subscriptionStatus
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
                      <a href="/character/${item.chatId}?imageId=${item._id}" data-index="${index}">
                        <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;">
                      </a>
                   </div>`
                : `<a href="/character/${item.chatId}?imageId=${item._id}" data-index="${index}">
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
                     <span class="btn btn-light float-end col-6 image-fav ${isLiked ? 'liked' : ''}" data-id="${item._id}">
                       <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                     </span>
                   </div>`
            }
          </div>
        </div>
      `
    })
  
    $('#chat-images-gallery').append(chatGalleryHtml)
    $(document).find('.img-blur').each(function () {
      blurImage(this)
    })
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
        success: function (data) {
          let chatsHtml = '';
  
          data.chats.forEach(chat => {
            let chatImagesHtml = '';
  
            // Loop through images in each chat
            chat.images.forEach((item, index) => {
                // Display a maximum of 12 images per chat
                if (index >= 12) return;
              // Check unlock logic (adapt to your own logic)
              const unlockedItem = isUnlocked(currentUser, item._id, item.userId);
              const isBlur = unlockedItem ? false : item.nsfw && !subscriptionStatus;
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
                            href="/character/${chat._id}?imageId=${item._id}" 
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
                            href="/character/${chat._id}?imageId=${item._id}" 
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
                    <a href="/character/${chat._id}"><span style="font-size: 18px; font-weight: 700;">${chat.name}</span></a>
                    <a href="/character/${chat._id}"><span class="badge custom-gradient-bg ms-2">${chat.imageCount}</span></a>
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
            success: function (data) {
              let additionalImagesHtml = '';
  
              data.images.forEach((item, index) => {
                const unlockedItem = isUnlocked(currentUser, item._id, item.userId);
                const isBlur = unlockedItem ? false : item.nsfw && !subscriptionStatus;
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
                              href="/character/${item.chatId}?imageId=${item._id}" 
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
    const countdownElement = $('#countdown-timer');
    const storedEndTime = localStorage.getItem('countdownEndTime');
    const now = Date.now();
    let endTime = storedEndTime ? parseInt(storedEndTime) : now + 30 * 60 * 1000;

    if (!storedEndTime) localStorage.setItem('countdownEndTime', endTime);

    const interval = setInterval(() => updateCountdown(endTime, interval), 10); // Update every 10ms
    updateCountdown(endTime, interval);
}

window.updateCountdown = function(endTime, interval) {
    const countdownElement = $('#countdown-timer');
    const remaining = endTime - Date.now();

    if (remaining <= 0) {
        countdownElement.text('00:00.00');
        localStorage.removeItem('countdownEndTime');
        clearInterval(interval);
        return;
    }

    const minutes = Math.floor(remaining / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    const milliseconds = Math.floor((remaining % 1000) / 10); // Convert to two-digit milliseconds
    countdownElement.text(
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`
    );
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
    if (modalStatus.isPlanLoading) return;
    modalStatus.isPlanLoading = true;

    closeAllModals();

    const planModal = new bootstrap.Modal(document.getElementById('planUpgradeModal'));
    $('#plan-container').html('<div class="position-absolute d-flex justify-content-center align-items-center" style="inset:0;"><div class="spinner-border" role="status"></div></div>');
    planModal.show();

    $.ajax({
        url: '/my-plan',
        method: 'GET',
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

// Open authenticate page in a modal
function openLoginForm(withMail = false) {
    if (modalStatus.isLoginLoading) return;
    modalStatus.isLoginLoading = true;

    closeAllModals();

    const loginModalElement = document.getElementById('loginModal');
    $('#login-container').html('<div class="position-absolute d-flex justify-content-center align-items-center" style="inset:0;"><div class="spinner-border" role="status"></div></div>');
    const loginModal = new bootstrap.Modal(loginModalElement);
    loginModal.show();

    const url = withMail == 'true' ? '/authenticate?withMail=true' : '/authenticate';
    $.ajax({
        url: url,
        method: 'GET',
        success: function(data) {
            $('#login-container').html(data);
            modalStatus.isLoginLoading = false;
        },
        error: function(err) {
            console.error('Failed to open login modal', err);
            modalStatus.isLoginLoading = false;
        }
    });
}

window.handleClickRegisterOrPay = function(event, isTemporary) {
  event.preventDefault();
  if (isTemporary) {
      openLoginForm();
  } else {
      loadPlanPage();
  }
}