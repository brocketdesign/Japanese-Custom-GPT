window.translations = JSON.parse(localStorage.getItem('translations')) || {};
let currentLang = localStorage.getItem('currentLang') || 'ja';

async function loadTranslations(lang) {
    const sessionLang = sessionStorage.getItem('currentLang');
    const sessionTranslations = sessionStorage.getItem('translations');

    if (lang === sessionLang && sessionTranslations) {
        window.translations = JSON.parse(sessionTranslations);
        return window.translations;
    }

    const response = await $.ajax({
        url: '/api/user/translations',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ lang })
    });

    if (response.success) {
        window.translations = response.translations;
        sessionStorage.setItem('currentLang', lang);
        sessionStorage.setItem('translations', JSON.stringify(window.translations));
    }

    return window.translations;
}


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
        location.reload();
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
    $('#languageDropdown').text(getLanguageDisplayName(currentLang));
    if (Object.keys(window.translations).length === 0) {
        loadTranslations(currentLang);
    }

    $('.language-select').on('click', function(e) {
        e.preventDefault();
        const selectedLang = $(this).data('lang');
        if (selectedLang !== currentLang) {
            onLanguageChange(selectedLang);
        }
    });
});
$(document).ready(async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');
    const priceId = urlParams.get('priceId');
    const paymentFalse = urlParams.get('payment') == 'false';
    const user = await fetchUser();
    const userId = user._id
    isTemporary = !!user?.isTemporary
    subscriptionStatus = user.subscriptionStatus == 'active'  
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
        
    $(document).on('click', '.logout', function(event) {
        event.preventDefault();
        $.ajax({
            url: '/user/logout',
            type: 'POST',
            success: function(response) {
                // Clear all cookies
                Object.keys($.cookie()).forEach(function(cookie) {
                    $.removeCookie(cookie, { path: '/' });
                });
    
                // **Clear all localStorage data**
                localStorage.clear();
    
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
    });
    
    
    
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
    //checkAndRedirect();

    window.showUpgradePopup = function(limitType) {
        const redirectUrl = window.location.pathname
        $.cookie('redirect_url', redirectUrl);
    
        // Define messages based on limit type
        let messageTitle = '';
        let messageText = '';
        let imageUrl = '/img/login-bg-862c043f.png'; // replace with your image URL
    
        // Use switch-case to handle different types of limits
        switch (limitType) {
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
            case 'image-generation':
                messageTitle = '⚠️ 画像生成機能にはアップグレードが必要です';
                messageText = '画像生成機能を利用するには、有料プランにアップグレードしてください。';
                break;
            case 'unlock-nsfw':
                messageTitle = '⚠️ 成人向けンテンツの利用にはアップグレードが必要です';
                messageText = '成人向けコンテンツを生成するには、有料プランにアップグレードしてください。';
                break;
            default:
                messageTitle = '制限に達しました';
                messageText = 'ご利用中のプランの制限に達しました。有料プランにアップグレードして、より多くの機能をお楽しみください。';
        }
        const features = [
            "毎日無制限でチャットできる",
            "フレンドを無制限で作成できる",
            "新しいキャラクターを作成する",
            "新機能への早期アクセス",
            "優先的なサポート対応"
          ]
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
                                ${features.map(feature => `<li class="list-group-item px-0"><span class="me-2">🔥</span>${feature}</li>`).join('')}
                            </ul>
                            <a href="/my-plan" class="btn btn-dark border-0 w-100 custom-gradient-bg mt-3">有料プランを確認する</a>
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
    }
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
                <i class="bi bi-clock"></i> ${formattedDate.slice(11)}
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
    $(document).on('click', '.post-fav', function () {

        const isTemporary = !!user.isTemporary;
        if (isTemporary) { showRegistrationForm(); return; }
    
        const $this = $(this);
        const postId = $(this).data('id');
        const isLiked = $(this).hasClass('liked'); // Check if already liked
    
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
    });
    $(document).on('click', '.image-fav', function () {

        const isTemporary = !!user.isTemporary;
        if (isTemporary) { showRegistrationForm(); return; }
    
        const $this = $(this);
        const description = $(this).data('description') == 'false' ? false : $(this).data('description')
        const imageId = $(this).data('id');
        const isLiked = $(this).hasClass('liked'); // Check if already liked
    
        const action = isLiked ? 'unlike' : 'like'; // Determine action
        $this.toggleClass('liked');
    
        $.ajax({
          url: `/gallery/${imageId}/like-toggle`, // Single endpoint
          method: 'POST',
          data: { action: action }, // Send action (like/unlike) in the request body
          success: function () {
    
            // Show success notification in Japanese
            if (action === 'like') {
                showNotification('いいねしました！', 'success');
                $this.find('.ct').text(parseInt($this.find('.ct').text()) + 1);
                window.postMessage({ event: 'imageFav' ,description}, '*');
            } else {
                showNotification('いいねを取り消しました！', 'success');
                $this.find('.ct').text(parseInt($this.find('.ct').text()) - 1);
            }
          },
          error: function () {
            $this.toggleClass('liked');
            showNotification('リクエストに失敗しました。', 'error');
          }
        });
    });

      $(document).on('click', '.post-visible', function () {

        const isTemporary = !!user.isTemporary;
        if (isTemporary) { showRegistrationForm(); return; }
    
        const $this = $(this);
        const postId = $(this).data('id');
        const isPrivate = $(this).hasClass('private'); // Check if already private
    
        const newPrivacyState = !isPrivate; // Toggle privacy state

        $.ajax({
          url: `/posts/${postId}/set-private`, // Single endpoint for both public and private
          method: 'POST',
          data: { isPrivate: newPrivacyState },
          success: function () {
            // Toggle private/public button state
            $this.toggleClass('private');
            const ico = newPrivacyState ? 'bi-eye-slash' : 'bi-eye'
            const text = newPrivacyState ? '非公開' : '公開'
            $this.find('i').removeClass('bi-eye bi-eye-slash').addClass(ico);
            $this.find('.text').text(text)

            // Show success notification in Japanese
            if (newPrivacyState) {
              showNotification('投稿を非公開にしました！', 'success');
            } else {
              showNotification('投稿を公開にしました！', 'success');
            }
          },
          error: function () {
            // Show error notification in Japanese
            showNotification('リクエストに失敗しました。', 'error');
          }
        });
    }); 
    $(document).on('click', '.image-nsfw-toggle', function () {

        const isTemporary = !!user.isTemporary;
        //if (isTemporary) { showRegistrationForm(); return; }
    
        const $this = $(this);
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
    });
    $(document).on('click', '.post-nsfw-toggle', function () {

        const isTemporary = !!user.isTemporary;
        // if (isTemporary) { showRegistrationForm(); return; }
    
        const $this = $(this);
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
    }); 
    $(document).on('click', '.follow-button', function () {

        const isTemporary = !!user.isTemporary;
        if (isTemporary) { showRegistrationForm(); return; }
    
        const $this = $(this);
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
    });

    $(document).on('click','.redirectToChatPage',function(){
        const chatId = $(this).data('id');
        const chatImage = $(this).data('image');
        window.location='/chat/'+chatId
    })
      
});

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
    let textElement = $('<div></div>').text('(20🪙)').addClass('fw-bold').css({'font-size': '12px', 'text-shadow': '0 0 5px black'});
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
        showCoinShop();
        //showNotification(window.translations.unlockError, 'error')
    });
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
        $('#users-pagination-controls').html('<button class="btn btn-outline-secondary" onclick="scrollToTop()"><i class="bi bi-arrow-up-circle-fill me-2"></i>'+window.translations.backToTop+'</button>');
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
                            <img src="${user.profileUrl || '/img/default-avatar.png'}" alt="${user.nickname}" class="rounded-circle mb-2" width="60" height="60">
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
        $('#chat-users-pagination-controls').html('<button class="btn btn-outline-secondary" onclick="scrollToTop()"><i class="bi bi-arrow-up-circle-fill me-2"></i>'+window.translations.backToTop+'</button>');
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
                            <span class="badge bg-dark"><i class="far fa-images me-1"></i>${image_count}</span>
                        </div>
                    `;
                }
            }

            // Render chat card
            htmlContent += `
            <div class="col-12 col-sm-4 col-lg-3 mb-2">
                <div class="card custom-card bg-transparent shadow-0 border-0 my-3 px-1 pb-3 redirectToChatPage" style="cursor:pointer;" data-id="${chat._id}" data-image="${chat.chatImageUrl}">
                    <div style="background-image:url('${chat.chatImageUrl || '/img/logo.webp'}')" class="card-img-top girls_avatar position-relative" alt="${chat.name}">
                        <div id="spinner-${chat._id}" class="position-absolute spinner-grow spinner-grow-sm text-light" role="status" style="top:5px;left: 5px;display:none;"></div>
                        <div class="position-absolute" style="color: rgb(165 164 164);opacity:0.8; bottom:10px;left:10px;right:10px;">
                            ${(chat.tags || []).length ? `<div class="tags d-flex justify-content-between align-items-center flex-wrap">${chat.tags.map(tag => `<span class="badge bg-dark">${tag}</span>`).join('')}</div>` : ''}
                        </div>
                        <div class="position-absolute text-end" style="top:10px;right:10px">
                            <a href="/character/${chat._id}">
                                <div class="gallery" style="color: rgb(165 164 164);opacity:0.8;" data-id="${chat._id}">
                                    <span class="badge bg-dark"><i class="far fa-image me-1"></i>${chat.imageCount || 0}</span>
                                </div>
                            </a>
                            ${galleryIco}
                            ${chat.messagesCount ? `<span class="badge bg-dark message-count"><i class="fas fa-comment-alt me-2"></i>${chat.messagesCount}</span>` : ''}
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
        $('#user-chat-pagination-controls').html('<button class="btn btn-outline-secondary" onclick="scrollToTop()"><i class="bi bi-arrow-up-circle-fill me-2"></i>'+window.translations.backToTop+'</button>');
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


window.displayPeopleChat = async function (page = 1,type,query = false) {
    const currentUser = await fetchUser();
    const currentUserId = currentUser._id;
    
    try {
        const response = await fetch(`/api/chats?page=${page}&type=${type}&q=${query}`);
        const data = await response.json();

        let recentChats = data.recent || [];
        let htmlContent = '';

        // If there are recent chats
        recentChats.forEach(chat => {
            if (chat.nickname) {
                let galleryIco = '';
                let image_count = 0;

                // Handle galleries
                if (chat.galleries && chat.galleries.length > 0) {
                    chat.galleries.forEach(gallery => {
                        if (gallery.images && gallery.images.length > 0) {
                            image_count += gallery.images.length;
                        }
                    });
                    if(image_count > 0){
                        galleryIco = `
                            <div class="gallery" style="color: rgb(165 164 164);opacity:0.8;" data-id="${chat._id}">
                                <span class="badge bg-dark"><i class="far fa-images me-1"></i>${image_count}</span>
                            </div>
                        `;
                    }
                }
                
                // Render chat
                htmlContent += `
                <div class="col-12 col-sm-4 col-lg-3 mb-2">
                    <div class="card custom-card bg-transparent shadow-0 border-0 my-3 px-1 pb-3 redirectToChat" style="cursor:pointer;" data-id="${chat._id}" data-image="${chat.chatImageUrl}">
                        <div style="background-image:url('${chat.chatImageUrl || '/img/logo.webp'}')" class="card-img-top girls_avatar position-relative" alt="${chat.name}">
                            <div id="spinner-${chat._id}" class="position-absolute spinner-grow spinner-grow-sm text-light" role="status" style="top:5px;left: 5px;display:none;"></div>
                            <div class="position-absolute" style="color: rgb(165 164 164);opacity:0.8; bottom:10px;left:10px;right:10px;">
                                ${(chat.tags || []).length ? `<div class="tags d-flex justify-content-between align-items-center flex-wrap">${chat.tags.map(tag => `<span class="badge bg-dark">${tag}</span>`).join('')}</div>` : ''}
                            </div>
                            <div class="position-absolute text-end" style="top:10px;right:10px">
                                <div class="persona" style="color:rgb(165 164 164);opacity:0.8;" data-id="${chat._id}">
                                    <span class="badge bg-dark" style="width: 30px;"><i class="far fa-user-circle"></i></span>
                                </div>
                                <a href="/character/${chat._id}">
                                    <div class="gallery" style="color: rgb(165 164 164);opacity:0.8;" data-id="${chat._id}">
                                        <span class="badge bg-dark"><i class="far fa-image me-1"></i>${chat.imageCount || 0}</span>
                                    </div>
                                </a>
                                ${galleryIco}
                                ${chat.messagesCount ? `<span class="badge bg-dark message-count"><i class="fas fa-comment-alt me-2"></i>${chat.messagesCount}</span>` : ''}
                            </div>
                        </div>
                        <div class="card-body bg-transparent border-0 pb-0 px-0 mx-0 text-start">
                            <div class="row mx-0 px-0">
                                <div class="d-none col-auto text-center">
                                    <a href="/character/${chat._id}" style="text-decoration: none;">
                                        <img src="${chat.chatImageUrl || '/img/avatar.png'}" alt="${chat.name}" class="rounded-circle" width="40" height="40">
                                    </a>
                                </div>
                                <div class="col-auto mx-0 px-0">
                                    <button class="btn btn-outline-secondary redirectToChat w-100 mb-2" data-id="${chat._id}"> <i class="bi bi-chat-dots me-2"></i> ${window.translations.startChatting}</button>
                                    <div class="d-flex align-items-center justify-content-between">
                                        <h5 class="card-title character-title mb-0">${chat.name}</h5>
                                        <a href="/user/${chat.userId}" class="text-muted" style="font-size:12px;">${chat.nickname}</a>
                                    </div>
                                    <a href="/character/${chat._id}" class="text-muted" style="text-decoration: none;">
                                        <span style="font-size:12px;">${chat.description}</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
        });

        // Update the gallery HTML
        $('#chat-gallery').append(htmlContent);
        if($('#chat-pagination-controls').length > 0){      
            generateChatsPagination(data.page, data.totalPages, type);
        }
    } catch (err) {
        console.error('Failed to load chats', err);
    }
};
function generateChatsPagination(currentPage, totalPages, type) {
    let paginationHtml = '';
    const sidePagesToShow = 2;
    let pagesShown = new Set();

    // Scroll event listener for infinite scroll
    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                displayPeopleChat(currentPage + 1, type);
                pagesShown.add(currentPage + 1);
            }
        }
    });

    if (currentPage >= totalPages) {
        // Hide pagination and show "Go to Top" button in Japanese
        $('#chat-pagination-controls').html('<button class="btn btn-outline-secondary" onclick="scrollToTop()"><i class="bi bi-arrow-up-circle-fill me-2"></i>'+window.translations.backToTop+'</button>');
        return;
    }

    if (totalPages > 1) {
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="displayPeopleChat(${currentPage - 1},${type})">${window.translations.prev}</button>`;

        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="displayPeopleChat(1,${type})">1</button>`;
            if (currentPage > sidePagesToShow + 2) paginationHtml += `<span class="mx-1">...</span>`;
        }

        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="displayPeopleChat(${i},${type})">${i}</button>`;
        }

        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) paginationHtml += `<span class="mx-1">...</span>`;
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="displayPeopleChat(${totalPages},${type})">${totalPages}</button>`;
        }

        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="displayPeopleChat(${currentPage + 1},${type})">${window.translations.next}</button>`;
    }

    $('#chat-pagination-controls').html(paginationHtml);
}

window.loadAllUserPosts = async function (page = 1) {
    const currentUser = await fetchUser();
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
                  <div type="button" onclick=${isTemporary?`showRegistrationForm()`:`unlockImage('${item.post.postId}','posts',this)`}>
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
                                <button class="btn btn-light post-nsfw-toggle ${!isAdmin?'d-none':''}" data-id="${item.post.postId}">
                                    <i class="bi ${item?.post?.nsfw ? 'bi-eye-slash-fill':'bi-eye-fill'}"></i> 
                                </button>
                                <button class="btn btn-light shadow-0 post-fav  ${isLiked ? 'liked' : ''}" data-id="${item.post.postId}"> 
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
function generateUserPostsPagination(currentPage, totalPages) {
    let paginationHtml = '';
    const sidePagesToShow = 2;
    let pagesShown = new Set();

    // Scroll event listener for infinite scroll
    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                loadAllUserPosts(currentPage + 1);
                pagesShown.add(currentPage + 1);
            }
        }
    });

    // Check if the current page is the last page
    if (currentPage >= totalPages) {
        $('#user-posts-pagination-controls').html('<button class="btn btn-outline-secondary" onclick="scrollToTop()"><i class="bi bi-arrow-up-circle-fill me-2"></i>'+window.translations.backToTop+'</button>');
        return;
    }

    // Generate pagination buttons if more than one page
    if (totalPages > 1) {
        // Previous button
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="loadAllUserPosts(${currentPage - 1})">${window.translations.prev}</button>`;

        // First page and ellipsis
        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadAllUserPosts(1)">1</button>`;
            if (currentPage > sidePagesToShow + 2) {
                paginationHtml += `<span class="mx-1">...</span>`;
            }
        }

        // Visible page numbers
        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="loadAllUserPosts(${i})">
                    ${i}
                </button>
            `;
        }

        // Last page and ellipsis
        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) {
                paginationHtml += `<span class="mx-1">...</span>`;
            }
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadAllUserPosts(${totalPages})">${totalPages}</button>`;
        }

        // Next button
        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="loadAllUserPosts(${currentPage + 1})">${window.translations.next}</button>`;
    }

    $('#user-posts-pagination-controls').html(paginationHtml);
}

window.loadAllChatImages = async function (page = 1) {
    const currentUser = await fetchUser();
    const currentUserId = currentUser._id;
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isAdmin = await checkIfAdmin(currentUserId);    
    $.ajax({
      url: `/chats/images?page=${page}`,
      method: 'GET',
      success: function (data) {
        let chatGalleryHtml = '';
        data.images.forEach(item => {
            const unlockedItem = isUnlocked(currentUser, item._id,item.userId)
            let isBlur = unlockedItem ? false : item?.nsfw && !subscriptionStatus 
            const isLiked = item?.likedBy?.some(id => id.toString() === currentUserId.toString());
            chatGalleryHtml += `
                <div class="col-12 col-md-3 col-lg-2 mb-2">
                    <div class="card shadow-0">
                        <div class="d-flex align-items-center p-2">
                            <a href="/character/${item.chatId}?imageId=${item._id}">
                                <img src="${item?.thumbnail}" alt="${item?.prompt}" class="rounded-circle me-2" width="40" height="40">
                            </a>
                            <a href="/character/${item.chatId}?imageId=${item._id}" class="text-decoration-none text-dark">
                                <strong>${item?.chatName}</strong>
                            </a>
                        </div>
                        ${isBlur ? `
                        <div type="button" onclick=${isTemporary?`showRegistrationForm()`:`unlockImage('${item._id}','gallery',this)`}>
                            <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;" >
                        </div>
                        ` : `
                        <a href="/character/${item.chatId}?imageId=${item._id}" class="text-muted text-decoration-none">
                            <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top">
                        </a>
                        <div class="d-none card-body p-2 d-flex align-items-center justify-content-between">
                            <a href="/chat/${item.chatId}" class="btn btn-outline-secondary"> <i class="bi bi-chat-dots me-2"></i> チャットする</a>
                            <button class="btn btn-light image-nsfw-toggle ${!isAdmin?'d-none':''}" data-id="${item._id}">
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

        $('#all-chats-images-gallery').append(chatGalleryHtml);
        if($('#all-chats-images-pagination-controls').length > 0){
            generateAllChatsImagePagination(data.page, data.totalPages);
        }

        $(document).find('.img-blur').each(function() {
            blurImage(this);
        });
      },
      error: function (err) {
        console.error('Failed to load images', err);
      }
    });
}
function generateAllChatsImagePagination(currentPage, totalPages) {
    let paginationHtml = '';
    const maxPagesToShow = 5;
    const sidePagesToShow = 2;
    let pagesShown = new Set(); // Track the pages already displayed

    // Scroll event listener for infinite scroll
    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                loadAllChatImages(currentPage + 1);
                pagesShown.add(currentPage + 1);
            }
        }
    });

    if (totalPages > 1) {
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="loadAllChatImages(${currentPage - 1})">${window.translations.prev}</button>`;

        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadAllChatImages(1)">1</button>`;
            if (currentPage > sidePagesToShow + 2) {
                paginationHtml += `<span class="mx-1">...</span>`;
            }
        }

        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
              <button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="loadAllChatImages(${i})">
                ${i}
              </button>
            `;
        }

        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) {
                paginationHtml += `<span class="mx-1">...</span>`;
            }
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadAllChatImages(${totalPages})">${totalPages}</button>`;
        }

        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="loadAllChatImages(${currentPage + 1})">${window.translations.next}</button>`;
    }

    $('#all-chats-images-pagination-controls').html(paginationHtml);
}

window.loadChatImages = async function (chatId, page = 1) {
    const currentUser = await fetchUser();
    const currentUserId = currentUser._id;
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser?.isTemporary

    $.ajax({
      url: `/chat/${chatId}/images?page=${page}`,
      method: 'GET',
      success: function (data) {
        let chatGalleryHtml = '';
        data.images.forEach(item => {
            const unlockedItem = isUnlocked(currentUser, item._id, item.userId)
            let isBlur = unlockedItem ? false : item?.nsfw && !subscriptionStatus 
            const isLiked = item?.likedBy?.some(id => id.toString() === currentUserId.toString());
            chatGalleryHtml += `
                <div class="col-12 col-md-6 col-lg-4 mb-2">
                    <div class="card shadow-0">
                        <div class="d-flex align-items-center p-2">
                            <a href="/character/${item.chatId}?imageId=${item._id}">
                                <img src="${item?.thumbnail}" alt="${item?.chatName}" class="rounded-circle me-2" width="40" height="40">
                            </a>
                            <a href="/character/${item.chatId}?imageId=${item._id}" class="text-decoration-none text-dark">
                                <strong>${item?.chatName}</strong>
                            </a>
                        </div>
                        ${isBlur ? `
                        <div type="button" onclick=${isTemporary?`showRegistrationForm()`:`unlockImage('${item._id}','gallery',this)`}>
                            <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;" >
                            <div class="d-none card-body p-2">
                                <a href="/chat/${item.chatId}" class="btn btn-outline-secondary"> <i class="bi bi-chat-dots me-2"></i> チャットする</a>
                            </div>
                        </div>
                        ` : `
                        <a href="/character/${item.chatId}?imageId=${item._id}" class="text-muted text-decoration-none">
                            <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top">
                        </a>
                        <div class="d-none card-body p-2 d-flex align-items-center justify-content-between">
                            <a href="/chat/${item.chatId}" class="btn btn-outline-secondary"> <i class="bi bi-chat-dots me-2"></i> チャットする</a>
                            <span class="btn btn-light float-end image-fav ${isLiked ? 'liked':''}" data-id="${item._id}">
                                <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                            </span>
                        </div>
                        `}
                    </div>
                </div>
            `;
        });

        $('#chat-images-gallery').append(chatGalleryHtml);
        if($('#chat-images-pagination-controls').length > 0){
            generateChatImagePagination(data.page, data.totalPages, chatId);
        }

        $(document).find('.img-blur').each(function() {
            blurImage(this);
        });
      },
      error: function (err) {
        console.error('Failed to load images', err);
      }
    });
}
function generateChatImagePagination(currentPage, totalPages, chatId) {
    let paginationHtml = '';
    const sidePagesToShow = 2;
    let pagesShown = new Set(); // Track displayed pages

    // Scroll event listener for infinite scrolling
    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                loadChatImages(chatId, currentPage + 1);
                pagesShown.add(currentPage + 1); // Mark the page as shown
            }
        }
    });

    // Hide pagination and show "Go to Top" button if no more pages
    if (currentPage >= totalPages) {
        $('#chat-images-pagination-controls').html('<button class="btn btn-outline-secondary" onclick="scrollToTop()"><i class="bi bi-arrow-up-circle-fill me-2"></i>'+window.translations.backToTop+'</button>');
        return;
    }

    // Generate pagination if there are multiple pages
    if (totalPages > 1) {
        // Previous button
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="loadChatImages('${chatId}', ${currentPage - 1})">${window.translations.prev}</button>`;

        // First page and ellipsis
        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadChatImages('${chatId}', 1)">1</button>`;
            if (currentPage > sidePagesToShow + 2) {
                paginationHtml += `<span class="mx-1">...</span>`;
            }
        }

        // Visible page numbers
        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="loadChatImages('${chatId}', ${i})">
                    ${i}
                </button>
            `;
        }

        // Last page and ellipsis
        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) {
                paginationHtml += `<span class="mx-1">...</span>`;
            }
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadChatImages('${chatId}', ${totalPages})">${totalPages}</button>`;
        }

        // Next button
        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="loadChatImages('${chatId}', ${currentPage + 1})">${window.translations.next}</button>`;
    }

    $('#chat-images-pagination-controls').html(paginationHtml);
}

window.loadUserImages = async function (userId, page = 1) {
    const currentUser = await fetchUser();
    const currentUserId = currentUser._id
    const subscriptionStatus = currentUser.subscriptionStatus == 'active'
    const isTemporary = !!currentUser?.isTemporary
    $.ajax({
      url: `/user/${userId}/liked-images?page=${page}`,
      method: 'GET',
      success: function (data) {
        let galleryHtml = '';
        data.images.forEach(item => {
            const unlockedItem = isUnlocked(currentUser, item._id, item.userId)
            let isBlur = unlockedItem ? false : item?.nsfw && !subscriptionStatus 
            const isLiked = item?.likedBy?.some(id => id.toString() === currentUserId.toString());
            galleryHtml += `
                <div class="col-12 col-md-6 col-lg-4 mb-2">
                <div class="card">
                    <div class="d-flex align-items-center p-2">
                        <a href="/character/${item.chatId}?imageId=${item._id}">
                            <img src="${item?.thumbnail}" alt="${item?.chatName}" class="rounded-circle me-2" width="40" height="40">
                        </a>
                        <a href="/character/${item.chatId}?imageId=${item._id}" class="text-decoration-none text-dark">
                            <strong>${item?.chatName}</strong>
                        </a>
                    </div>
                    ${isBlur ? `
                    <div type="button" onclick=${isTemporary?`showRegistrationForm()`:`unlockImage('${item._id}','gallery',this)`}>
                        <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;" >
                    </div>
                    ` : `
                    <a href="/character/${item.chatId}?imageId=${item._id}" class="text-muted text-decoration-none">
                        <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top">
                    </a>
                    <div class="d-none card-body p-2 d-flex align-items-center justify-content-between">
                        <a href="/chat/${item.chatId}?imageId=${item._id}" class="btn btn-outline-secondary"> <i class="bi bi-chat-dots me-2"></i> チャットする</a>
                        <span class="btn btn-light float-end image-fav ${isLiked ? 'liked':''}" data-id="${item._id}">
                            <i class="bi bi-heart-fill" style="cursor: pointer;"></i>
                        </span>
                    </div>
                    `}
                </div>
                </div>
            `;
        });

        $('#user-images-gallery').append(galleryHtml);
        if($('#images-pagination-controls').length > 0){
            generateImagePagination(data.page, data.totalPages, userId);
        }

        $(document).find('.img-blur').each(function() {
            blurImage(this);
        });
      },
      error: function (err) {
        console.error('Failed to load images', err);
      }
    });
}
function generateImagePagination(currentPage, totalPages, userId) {
    let paginationHtml = '';
    const sidePagesToShow = 2;
    let pagesShown = new Set();

    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                loadUserImages(userId, currentPage + 1);
                pagesShown.add(currentPage + 1);
            }
        }
    });

    if (currentPage >= totalPages) {
        $('#images-pagination-controls').html('<button class="btn btn-outline-secondary" onclick="scrollToTop()"><i class="bi bi-arrow-up-circle-fill me-2"></i>'+window.translations.backToTop+'</button>');
        return;
    }

    if (totalPages > 1) {
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="loadUserImages('${userId}', ${currentPage - 1})">${window.translations.prev}</button>`;

        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadUserImages('${userId}', 1)">1</button>`;
            if (currentPage > sidePagesToShow + 2) paginationHtml += `<span class="mx-1">...</span>`;
        }

        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="loadUserImages('${userId}', ${i})">${i}</button>`;
        }

        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) paginationHtml += `<span class="mx-1">...</span>`;
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadUserImages('${userId}', ${totalPages})">${totalPages}</button>`;
        }

        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="loadUserImages('${userId}', ${currentPage + 1})">${window.translations.next}</button>`;
    }

    $('#images-pagination-controls').html(paginationHtml);
}

window.loadUserPosts = async function (userId, page = 1, like = false) {
    const currentUser = await fetchUser();
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
                    <div type="button" onclick=${isTemporary?`showRegistrationForm()`:`unlockImage('${item._id}','posts',this)`}>
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
                                <button class="btn btn-light shadow-0 post-fav  ${isLiked ? 'liked' : ''}" data-id="${item._id}"> 
                                    <i class="bi bi-heart-fill me-2"></i>いいね 
                                    <span class="ct">${item.likes || 0}</span>
                                </button>
                                <span class="float-end post-visible d-none ${item.isPrivate ? 'private':''} ${item.userId.toString() != currentUser._id.toString() ? 'd-none':''}" data-id="${item._id}">
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
function generateUserPostPagination(currentPage, totalPages, userId, like = false) {
    let paginationHtml = '';
    const sidePagesToShow = 2;
    let pagesShown = new Set();

    $(window).off('scroll').on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            if (currentPage < totalPages && !pagesShown.has(currentPage + 1)) {
                loadUserPosts(userId, currentPage + 1);
                pagesShown.add(currentPage + 1);
            }
        }
    });

    if (currentPage >= totalPages) {
        const containerId = like ? 'posts-like-pagination-controls' : 'pagination-controls';
        $(`#${containerId}`).html('<button class="btn btn-outline-secondary" onclick="scrollToTop()"><i class="bi bi-arrow-up-circle-fill me-2"></i>'+window.translations.backToTop+'</button>');
        return;
    }

    if (totalPages > 1) {
        paginationHtml += `<button class="btn btn-outline-primary me-2" ${currentPage === 1 ? 'disabled' : ''} onclick="loadUserPosts('${userId}', ${currentPage - 1})">${window.translations.prev}</button>`;

        if (currentPage > sidePagesToShow + 1) {
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadUserPosts('${userId}', 1)">1</button>`;
            if (currentPage > sidePagesToShow + 2) paginationHtml += `<span class="mx-1">...</span>`;
        }

        let startPage = Math.max(1, currentPage - sidePagesToShow);
        let endPage = Math.min(totalPages, currentPage + sidePagesToShow);

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} mx-1" onclick="loadUserPosts('${userId}', ${i})">${i}</button>`;
        }

        if (currentPage < totalPages - sidePagesToShow - 1) {
            if (currentPage < totalPages - sidePagesToShow - 2) paginationHtml += `<span class="mx-1">...</span>`;
            paginationHtml += `<button class="btn btn-outline-primary mx-1" onclick="loadUserPosts('${userId}', ${totalPages})">${totalPages}</button>`;
        }

        paginationHtml += `<button class="btn btn-outline-primary ms-2" ${currentPage === totalPages ? 'disabled' : ''} onclick="loadUserPosts('${userId}', ${currentPage + 1})">${window.translations.next}</button>`;
    }

    const containerId = like ? 'posts-like-pagination-controls' : 'pagination-controls';
    $(`#${containerId}`).html(paginationHtml);
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
                <span class="u-color-grad">${window.translations.RegistrationForm.free}</span><br>
                ${window.translations.RegistrationForm.chatContinue}
            </h2>
            <p class="d-none text-muted mb-2 header" style="font-size: 16px;">
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

window.showCoinShop = function(el){
    if(el && $(el).hasClass('open')){
       return
    }
    if(el && !$(el).hasClass('open')){
        $(el).addClass('open')
    }
    Swal.fire({
        position: 'center',
        html: `
            <div class="container text-center">
                <div class="row justify-content-center">
                    <div class="col-12 mb-3">
                        <div class="p-3 rounded d-flex justify-content-between custom-gradient-bg">
                            <span class="fw-bold text-white">保有コイン</span>
                            <div>
                                <span>🪙</span>
                                <span class="fw-bold text-white float-end user-coins ms-2">0</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 my-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-1.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>100コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">手頃なパッケージ</p>
                                <button id="coins-set1" class="buycoin btn custom-gradient-bg w-100">¥200</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 my-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-2.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>550コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料150枚付き</p>
                                <button id="coins-set2"  class="buycoin btn custom-gradient-bg w-100">¥800</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 mb-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-3.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>1200コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料450枚付き</p>
                                <button id="coins-set3"  class="buycoin btn custom-gradient-bg w-100">¥1500</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 mb-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-4.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>2500コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料1000枚付き</p>
                                <button id="coins-set4"  class="buycoin btn custom-gradient-bg w-100">¥3000</button>
                            </div>
                        </div>
                    </div>
                </div>
                <span style="font-size: 12px;">安心・安全な決済方法: <a href="https://stripe.com/jp/resources/more/secure-payment-systems-explained" target="_blank"><img src="/img/stripe-logo.png" style="height: 30px;width: auto;"></a>を使用しています</span>
            </div>
        `,
        showCancelButton: false,
        showConfirmButton: false,
        showCloseButton: true,
        allowOutsideClick: false,
        backdrop:false,
        customClass: {
            popup: 'swal2-card',
            content: 'p-0'
        },
        showClass: {
            popup: 'bg-light animate__animated animate__fadeInDown'
        },
        hideClass: {
            popup: 'bg-light animate__animated animate__fadeOutUp'
        },
        didOpen: () => {
            window.postMessage({ event: 'updateCoins' }, '*');
            $(document).on('click','.buycoin', function() {
                const buttonId = this.id;
                initiateCheckout(buttonId);
            });
        },
        willClose: () => {

                if(el){
                    $(el).removeClass('open')
                }
        }
    });
    
}
window.showPremiumPopup = async function() {
    const user = await fetchUser();
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
