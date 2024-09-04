const audioCache = new Map();
const audioPool = [];
$(document).ready(function() {
    let autoPlay = localStorage.getItem('audioAutoPlay') === 'true';
    $('#audio-icon').addClass(autoPlay ? 'fa-volume-up' : 'fa-volume-mute');
    $('#audio-play').click(function() {
        autoPlay = !autoPlay;
        localStorage.setItem('audioAutoPlay', autoPlay);
        $('#audio-icon').toggleClass('fa-volume-up fa-volume-mute');
    });
    
    let API_URL = ""
    let MODE = "" 
    fetchMode(function(error,mode){
        MODE = mode
        if (mode !== 'local') {
            API_URL = window.location.origin;
            if (!API_URL.includes('lamix')) {
                API_URL = 'https://www.lamix.jp';
            }
        }        
        localStorage.setItem('MODE',mode)
        localStorage.setItem('API_URL',API_URL)
        fetchUser(function(error, user){
            let chatId = getIdFromUrl(window.location.href) || getIdFromUrl($.cookie('redirect_url'))||$(`#lamix-chat-widget`).data('id');
            let userChatId
            const userId = user._id
            renderChatList(userId,chatId);
            localStorage.setItem('userId', userId);
            localStorage.setItem('user', JSON.stringify(user));
            let userCoins = user.coins
            updateCoins(userCoins)
            let persona
            let currentStep = 0;
            let totalSteps = 0;
            let chatData = {};
            let character = {}
            let isNew = true;
            let feedback = false
            let thumbnail = false
            let isTemporary = !!user.isTemporary
            let language = 'japanese'
            $('body').attr('data-temporary-user',isTemporary)

            let count_proposal = 0
            const subscriptionStatus = user.subscriptionStatus == 'active'

            $('.is-free-user').each(function(){if(!subscriptionStatus && !isTemporary)$(this).show()})

            if(false && isTemporary){
                setTimeout(() => {
                    showRegistrationForm(null,function(){
                        const  triggerCustomAlert = function() {
                            Swal.fire({
                                position: 'top-end',
                                title: '<strong class="u-color-grad" style="font-size:16px">ログインすると<br>プレゼントを200円相当ゲット！</strong>',
                                html: `
                                    <p style="font-size: 14px; margin-bottom: 10px;">今すぐログインしてプレゼントを受け取りましょう！</p>
                                    <a href="/authenticate" class="btn btn-dark border-0 shadow-0 w-100 custom-gradient-bg" style="font-size: 14px; padding: 8px;">ログイン</a>
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
                        setTimeout(() => {
                            //triggerCustomAlert();
                        }, 2000);
                        
                    })
                }, 5000);
            }

            window.fetchChatData = async function(fetch_chatId, fetch_userId, fetch_reset, callback) {
                $('#chatContainer').empty();
                $('#startButtonContained').remove();
                $('#chat-recommend').empty();
                
                const lastUserChat = await getUserChatHistory(fetch_chatId, fetch_userId);

                fetch_chatId = lastUserChat ?.chatId || fetch_chatId
                userChatId = lastUserChat ?._id || userChatId;

                if (fetch_reset) {
                    currentStep = 0;
                }
            
                count_proposal = 0;
                
                postChatData(fetch_chatId, fetch_userId, userChatId, fetch_reset, callback);
            }
            
            function postChatData(fetch_chatId, fetch_userId, userChatId, fetch_reset, callback) {
                $('#chatContainer').empty();
                $('#startButtonContained').remove();
                $('#chat-recommend').empty();
                $.ajax({
                    url: `${API_URL}/api/chat/`,
                    type: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({ userId: fetch_userId, chatId: fetch_chatId, userChatId }),
                    success: function(data) {
                        handleChatSuccess(data, fetch_reset, fetch_userId);
                    },
                    error: function(xhr, status, error) {
                        showDiscovery();
                    },
                    complete: function(xhr, status) {
                        if (typeof callback === 'function') {
                            callback();
                        }
                    }
                });
            }            

            if(chatId){
                fetchChatData(chatId, userId)
            }else{
                showDiscovery()
            }

            enableToggleDropdown()
            
            $('textarea').each(function() {
                //resizeTextarea(this);
                $(this).on('input change keypress', function(e) {
                    if (e.type === 'keypress' && e.which !== 13) {
                        return;
                    }
                    resizeTextarea(this);
                });
            });
            
            $('#sendMessage').on('click', function() {
                sendMessage();
                $('#userMessage').val('');  
                //$('#userMessage').attr('placeholder', 'チャットしよう'); 
                setTimeout(() => {
                    resizeTextarea($('#userMessage')[0]);
                }, 500);
            });


            // Event handler for the Enter key
            $('#userMessage').on('keypress', function(event) {
                if (event.which == 13 && !event.shiftKey) { 
                    sendMessage();
                    setTimeout(() => {
                        $('#userMessage').val('');  
                        $('#userMessage').attr('placeholder', 'チャットしよう'); 
                        resizeTextarea($('#userMessage')[0]);
                    }, 500);
                }
            });     

            function resizeTextarea(element){
                element.style.height = 'auto';
                element.style.height = (element.scrollHeight - 20 ) + 'px';  
            }

            $(document).on('click','.reset-chat', function(){
                chatId = $(this).data('id')
                fetchChatData(chatId, userId, true) ;
            })
            $(document).on('click','.user-chat-history', function(){
                //const selectUser = $(this).data('user')
                chatId = $(this).data('id')
                userChatId = $(this).data('chat')
                postChatData(chatId, userId, userChatId, null, null) 
            })
            $(document).on('click', '.chat-list.item.user-chat .user-chat-content', function(e) {
                const $this = $(this);
                if ($this.hasClass('loading')) return;
                $this.addClass('loading');
                const selectChatId = $this.closest('.user-chat').data('id');
                const chatImageUrl = $this.find('img').attr('src');
                $this.closest('.chat-list.item').addClass('active').siblings().removeClass('active');
                $('#chat-container').css('background-image', `url(${chatImageUrl})`);
                $('#chatContainer').empty();
                $('#chat-recommend').empty()
                
                fetchChatData(selectChatId, userId, null, function() {
                    $this.removeClass('loading');
                });
            });
             

            function updateParameters(newchatId, newuserId){
                chatId = newchatId
                localStorage.setItem('chatId', chatId);
                var currentUrl = window.location.href;
                var urlParts = currentUrl.split('/');
                urlParts[urlParts.length - 1] = newchatId;
                var newUrl = urlParts.join('/');
                if($('#chat-widget-container').length == 0){
                    window.history.pushState({ path: newUrl }, '', newUrl);
                }

                if($('#chat-widget-container').length == 0){
                    $('.auto-gen').each(function(){
                        $(this)
                        .attr('data-chat-id',chatId)
                        .attr('data-user-id',userId)
                        .attr('data-user-chat-id',userChatId)
                        .attr('data-thumbnail',thumbnail)
                        .attr('data-character',JSON.stringify(character))
                    })

                    $('#gen-ideas')
                    .attr('data-chat-id',chatId)
                    .attr('data-user-id',userId)
                    .attr('data-user-chat-id',userChatId)
                    .removeClass('done')
                }

                const elementsToUpdate = ['.content .chart-button', '.content .tag-button', '.content .delete-chat'];
                elementsToUpdate.forEach(selector => {
                    $(selector).each(function() {
                        $(this).attr('data-id', chatId);
                    });
                });
                $('.edit-chat').each(function(){
                    $(this).attr('href','/chat/edit/'+newchatId)
                })
            }
            window.choosePath = function(userResponse) {
                currentStep++;
                hideOtherChoice(userResponse,currentStep)
                $.ajax({
                    url: API_URL+'/api/chat-data',
                    type: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({ 
                        currentStep:currentStep-1, 
                        message:userResponse, 
                        userId, 
                        chatId, 
                        userChatId, 
                        isNew ,
                        isWidget : $('#chat-widget-container').length > 0
                    }),
                    success: function(response) {
                        userChatId = response.userChatId
                        isNew = false
                        updatechatContent(userResponse);
                    },
                    error: function(error) {
                        console.log(error.statusText);
                    }
                });
            };
            window.sendMessage = function(customMessage,displayStatus = true) {
                if($('#chat-widget-container').length == 0 && isTemporary){
                    showRegistrationForm()
                    return
                }

                $('#startButtonContained').hide();
                $('#introChat').hide();
                $('#gen-ideas').removeClass('done')
                Swal.close();

                currentStep ++
                const message = customMessage || $('#userMessage').val();
                if (message.trim() !== '') {
                    if(displayStatus){
                        displayMessage('user', message);
                    }
                    $('#userMessage').val(''); // Clear the input field
                    // Send the message to the backend (to be implemented)
                    console.log({userChatId})
                    $.ajax({
                        url: API_URL+'/api/chat-data', // Backend endpoint to handle the message
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({ 
                            currentStep:currentStep-1, 
                            message, 
                            userId, 
                            chatId, 
                            userChatId, 
                            isNew ,
                            isWidget : $('#chat-widget-container').length > 0
                        }),
                        success: function(response) {
                            /*
                            const messageCountDoc = response.messageCountDoc
                            if(messageCountDoc.limit){
                                let limitMess = messageCountDoc.limit == '無制限' ? messageCountDoc.limit : `${parseInt(messageCountDoc.count)}/${messageCountDoc.limit}`
                                $('#message-number')
                                .html(`
                                    <span class="badge bg-dark" style="color: rgb(165 164 164);opacity:0.8;font-size: 12px;">
                                        <i class="fa fa-comment me-1"></i>${limitMess}
                                    </span>
                                `)
                                .hide()
                            }*/
                           if(!isTemporary && $('#chat-widget-container').length == 0 ){
                                const nextLevel = response.nextLevel || 10
                                const messagesCount = response.messagesCount || 0
                                initializeOrUpdateProgress(messagesCount,nextLevel)
                           }

                                
                            userChatId = response.userChatId
                            chatId = response.chatId
                            if(currentStep < totalSteps){
                                displayStep(chatData, currentStep);
                                isNew = false
                            }else{
                                //generateNarration()
                                generateCompletion(function(){
                                    checkForPurchaseProposal()
                                })
                                isNew = false
                            }
                        },
                        error: function(error) {
                            if (error.status === 403) {
                                var limitIds = error.responseJSON?.limitIds || [];
                        
                                if ($('#chat-widget-container').length == 0 && isTemporary) {
                                    showRegistrationForm();
                                    return;
                                }
                                if (limitIds.includes(1) && $('#chat-widget-container').length == 0) {
                                    showUpgradePopup('chat-message');
                                    return;
                                }
                                if (limitIds.includes(2)) {
                                    showUpgradePopup('chat-character');
                                    return;
                                }
                            } else {
                                console.error('Error:', error);
                                displayMessage('bot', 'An error occurred while sending the message.');
                            }
                        }                        
                    });
                }
            }
            $(document).on('click','#unlock-result',function(){
                promptForEmail()
            })
            
            function handleChatSuccess(data, fetch_reset, fetch_userId) {
                const chatId = data.chat._id;
                $(document).find(`.chat-list.item[data-id="${chatId}"]`).addClass('active').siblings().removeClass('active');

                isNew = fetch_reset || data.isNew;

                if (!data.chat) {
                    showDiscovery();
                    return;
                }
            
                setupChatData(data.chat);
                setupChatInterface(data.chat, data.character);
                renderChatList(fetch_userId,chatId);

                if (!isNew) {
                    displayExistingChat(data.userChat, data.character);
                } else if (data.chat.content && data.chat.content.length > 0) {
                    displayStep(data.chat.content, currentStep);
                } else {
                    displayInitialChatInterface(data.chat);
                }
            
                if (data.chat.galleries && data.chat.galleries.length > 0) {
                    displayGalleries(thumbnail, data.chat.galleries, data.chat.blurred_galleries, chatId, fetch_userId);
                }
            
                if (!isTemporary) {
                    initializeOrUpdateProgress(data?.userChat?.messagesCount || 0, data?.userChat?.nextLevel || 10);
                }
            
                updateParameters(chatId, fetch_userId);
                showChat();
            }
            
            function setupChatData(chat) {
                chatData = chat.content || [];
                totalSteps = chatData.length;
                chatName = chat.name;
                thumbnail = chat.thumbnailUrl || chat.chatImageUrl;
                localStorage.setItem('thumbnail',thumbnail)
            }
            
            function setupChatInterface(chat, character) {
                const gender = determineChatGender(chat);
            
                $('#chat-container').attr('data-genre', gender);
                updateChatBackgroundImage(thumbnail);
                $('#chat-title').text(chatName);
                $('#input-container').show().addClass('d-flex');
                $('#userMessage').attr('placeholder', `${chatName}にメッセージを送る`);
            }
            
            function determineChatGender(chat) {
                let gender = chat.gender || 'female';
                if (chat.character && chat.character.prompt) {
                    gender = chat.character.prompt.toLowerCase();
                    gender = /\bmale\b/.test(gender) ? "male" : "female";
                }
                return gender;
            }
            
            function updateChatBackgroundImage(thumbnail) {
                const currentImageUrl = $('#chat-container').css('background-image').replace(/url\(["']?|["']?\)$/g, '');
                if (currentImageUrl !== thumbnail) {
                    $('#chat-container').css('background-image', `url(${thumbnail})`);
                }
            }
            
            function displayExistingChat(userChat,character) {
                persona = userChat.persona;
                thumbnail = character?.image || localStorage.getItem('thumbnail')
                displayChat(userChat.messages, persona);
                const today = new Date().toISOString().split('T')[0];
                if (userChat.log_success) {
                    displayThankMessage();
                    $.cookie('dailyBonusClaimed', today, { expires: 1 });
                }else if ($.cookie('dailyBonusClaimed') != today && !isTemporary) {
                    thankUserAndAddCoins(function(response){
                        if(!response){return}
                        updateCoins()
                        let message = `[Hidden] Tell me that you will send me a picture of you.Do not answer this message. Act as if it was oyour idea.`
                        addMessageToChat(chatId, userChatId, 'user', message,function(){
                            generateCompletion(function(){
                                checkImageDescription(thumbnail,function(response){
                                    if(!response){
                                        generateImageDescriptionBackend(thumbnail,function(){
                                            generateImagePromt(API_URL, userId, chatId, userChatId, thumbnail, character, function(prompt) {
                                                generateImageNovita(API_URL, userId, chatId, userChatId, character, { prompt });
                                            });
                                        })
                                    }else{
                                        generateImagePromt(API_URL, userId, chatId, userChatId, thumbnail, character, function(prompt) {
                                            generateImageNovita(API_URL, userId, chatId, userChatId, character, { prompt });
                                        });
                                    }
                                }) 
                            })
                        });
                    })
                }

                if($('#chat-widget-container').length == 0 && isTemporary){
                    displayMessage('assistant',`<a class="btn btn-secondary custom-gradient-bg shadow-0 m-2 px-4 py-2" style="border-radius: 50px;" href="/authenticate"><i class="fas fa-sign-in-alt me-2"></i> ログイン</a>`)
                }
                if(!isTemporary){checkForPurchaseProposal()}
            }
            
            function displayInitialChatInterface(chat) {

                if (isTemporary) {
                    displayStarter(chat);
                } else {
                    selectPersona(() => {
                        displayStarter(chat);
                    });
                }
            }
            
            function displayGalleries(thumbnail, galleries, blurred_galleries, chatId, fetch_userId) {
                galleries.forEach((gallery, index) => {
                    if(!gallery.images || gallery.images.length == 0){return}
                    const blurredImages = blurred_galleries[index].images;
                    const album = {
                        chatId,
                        userId: fetch_userId,
                        name: gallery.name,
                        price: gallery.price,
                        description: gallery.description,
                        blurredImages: [gallery.images[0], ...blurredImages],
                        images: gallery.images,
                        stripePriceId: gallery.stripePriceId,
                        stripeProductId: gallery.stripeProductId
                    };
            
                    displayAlbumThumb(thumbnail, album);
                });
            }
            
            function displayAlbumThumb(thumbnail, album){
                var card = $(`
                    <div class="card custom-card bg-transparent shadow-0 border-0 px-1 col-3 col-sm-4 col-lg-2" style="cursor:pointer;">
                        <div style="background-image:url(${album.images[0]});border:4px solid white;" class="card-img-top rounded-avatar position-relative m-auto shadow" alt="${album.name}">
                        </div>
                    </div>
                `);
                card.on('click', function() {
                    displayAlbum(album)
                });
                $('#chat-recommend').append(card);
            }

        async function displayAlbum(album) {
            try {
                const isAuthorized = await checkIfClient(album.userId, album.chatId, album.stripePriceId);
                const images = isAuthorized ? album.images : album.blurredImages;
                console.log({isAuthorized})
                let imagesHTML = images.map((url, index) => `<img src="${album.images[0]}" class="img-fluid rounded shadow m-1" style="width:auto;height: auto;object-fit:contain;" data-index="${index}">`).join('');
            
                Swal.fire({
                    html: `
                        <div ${!isAuthorized ? 'type="button" onclick="initiateAlbumCheckout(\'' + album.stripePriceId + '\', \'' + album.chatId + '\')"' : ''}>
                            <div style="top: 0;left: 0;right: 0;border-radius: 40px 40px 0 0;background: linear-gradient(to top, rgba(0, 0, 0, 0), rgba(46, 44, 72, 0.91) 45%);" class="sticky-top pt-3">
                                <h5 class="mb-0 text-white">${album.name}</h5>
                                <span class="text-muted" style="font-size:14px;">${album.price}¥</span>
                                <p style="color: white;font-size: 12px;" class="p-4">${album.description}</p>
                            </div>
                            <div class="sticky-top text-start">
                                <span type="button" id="destroy-swiper" class="btn btn-light mx-3"><i class="fas fa-th-large"></i></span>
                            </div>
                            <div id="album-container" class="position-relative text-white pt-2 px-3 w-100" style="min-height:200px;overflow: hidden;">
                                <div class="images swiper-container" data-id="${album.chatId}">
                                    <div class="swiper-wrapper wrapper">
                                        ${images.map((url, index) => `
                                            <div class="swiper-slide slide">
                                                <img src="${url}" class="img-fluid rounded shadow m-1" style="width:auto;max-height:400pxobject-fit:contain;" data-index="${index}">
                                            </div>`).join('')}
                                    </div>
                                    <div class="swiper-button-next text-white" style="opacity:0.8;"></div>
                                    <div class="swiper-button-prev text-white" style="opacity:0.8;"></div>
                                </div>
                            </div>
                            ${!isAuthorized && !isTemporary ? `
                                <div style="bottom: 20px;z-index: 100;" class="mx-auto mt-4 position-fixed w-100">
                                    <button class="btn btn-lg custom-gradient-bg" style="border-radius:50px;"><i class="far fa-images me-2"></i>アルバムを購入する</button>
                                    <a href="/my-plan" class="d-block mt-1 text-white">Lamixプレミアムなら無料で見放題</a>
                                </div>`:''
                            }
                        </div>
                    `,
                    showClass: { popup: 'animate__animated animate__slideInUp' },
                    hideClass: { popup: 'animate__animated animate__slideOutDown' },
                    position: 'bottom',
                    backdrop: 'rgba(43, 43, 43, 0.2)',
                    showCloseButton: true,
                    showConfirmButton: false,
                    customClass: { container: 'p-0', popup: 'album-popup shadow', htmlContainer:'position-relative', closeButton: 'position-absolute' }
                });

                let swiper = new Swiper('.swiper-container', {
                    loop: true,
                    spaceBetween: 5,
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                    breakpoints: {
                        320: { // screens up to 320px
                            slidesPerView: 2,
                        },
                        480: { // screens up to 480px
                            slidesPerView: 2,
                        },
                        768: { // screens up to 768px
                            slidesPerView: 3,
                        },
                        1024: { // screens up to 1024px
                            slidesPerView: 4,
                        },
                    }
                });
        
        $(document).on('click', '#destroy-swiper', function () {
            swiper = toggleSwiper()
        });
        $(document).on('click', '.slide:not(.swiper-slide)', function() {
            const slideIndex = $(this).index();
            console.log({slideIndex})
            swiper = toggleSwiper()
            swiper.slideTo(slideIndex);
        });
        
        function toggleSwiper(){
            const swiperContainer = $(document).find('.swiper-container')
            $(document).find('#destroy-swiper').toggleClass('mt-3')
            $(document).find('#destroy-swiper').find('i').toggleClass('fa-th-large fa-image')
            $(document).find('#album-container .wrapper').toggleClass('swiper-wrapper row m-auto');
            $(document).find('#album-container .slide').toggleClass('swiper-slide col-4 col-sm-3 col-lg-1 p-0');
            $(document).find('#album-container').find('.swiper-button-next').toggle()
            $(document).find('#album-container').find('.swiper-button-prev').toggle()
            if (swiper.initialized) {
                swiper.destroy(true, true); // true to reset styles
            } else {
                swiper = new Swiper(swiperContainer[0], {
                    loop: true,
                    spaceBetween: 5,
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                    breakpoints: {
                        320: { // screens up to 320px
                            slidesPerView: 2,
                        },
                        480: { // screens up to 480px
                            slidesPerView: 2,
                        },
                        768: { // screens up to 768px
                            slidesPerView: 3,
                        },
                        1024: { // screens up to 1024px
                            slidesPerView: 4,
                        },
                    }
                });
            }
            return swiper
        }
        //toggleSwiper(swiper)
    } catch (error) {
        console.error('Error displaying album:', error);
    }
}

            
            function checkIfClient(userId, chatId, priceId) {
                return $.ajax({
                    url: '/album/check-client',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        userId: userId,
                        chatId: chatId,
                        priceId: priceId
                    }),
                    dataType: 'json'
                }).then(response => response.isAuthorized)
                  .catch(error => {
                      console.error('Error checking client status:', error);
                      return false;
                  });
            }
            
            function thankUserAndAddCoins(callback) {
                const customPrompt = {
                    systemContent: "あなたの役割は、ユーザーに感謝の気持ちを伝えるキャラクターとして行動することです。今回は、ログインしてくれたユーザーに、再び戻ってきてくれたことへの感謝を伝え、10コインをプレゼントする旨を優しく伝えてください。",
                    userContent: "ユーザーが再度ログインしました。心からの感謝とともに、10コインをプレゼントする短いメッセージを伝えてください。",
                    temperature: 0.7,
                    top_p: 0.9,
                    frequency_penalty: 0,
                    presence_penalty: 0
                };

                claimDailyBonus(function(response){
                    if(response){
                        generateCustomCompletion(customPrompt, function() {
                            if(typeof callback == 'function'){callback(response)}
                        });
                    }else{
                        if(typeof callback == 'function'){callback(response)}
                    }
                });
            }

            function displayThankMessage(){
                const customPrompt = {
                    systemContent: "あなたの役割は、常にキャラクターとして行動し、ユーザーに対して優しく丁寧な対応をすることです。今回は、ログインしてくれたユーザーに感謝の気持ちを伝える必要があります。ユーザーが戻ってきたことを嬉しく思っていることを、短くて優しい言葉で伝えてください。",
                    userContent: "ユーザーがログインしました。あなたのキャラクターとして、心からの感謝と喜びを表現する短いメッセージを伝えてください。そして、100コインがユーザーに贈られたこともお伝えください。",
                    temperature: 0.7,
                    top_p: 0.9,
                    frequency_penalty: 0,
                    presence_penalty: 0
                };
                                    
                generateCustomCompletion(customPrompt,function(){
                    updateLogSuccess()
                })
            }
            function updateLogSuccess(callback) {
                const apiUrl = API_URL + '/api/update-log-success';
            
                $.ajax({
                    url: apiUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ userId, userChatId }),
                    success: function(response) {
                        if (response.success) {
                        } else {
                            console.warn(response.message);
                        }
                        if (typeof callback === "function") {
                            callback();
                        }
                    },
                    error: function(error) {
                        console.error('Error:', error);
                        if (typeof callback === "function") {
                            callback();
                        }
                    }
                });
            }
            
            function createButton(chatData) {
                
                // Extracting data from chatData
                let name = chatData.name;
                let description = chatData.description;
                let thumbnailUrl = chatData.thumbnailUrl;
                let chatImageUrl = chatData.chatImageUrl;

                // Remove existing container if it exists
                $('#startButtonContained').remove();

                // Create the container div
                let container = $('<div></div>')
                .addClass('container text-start my-3')
                .attr('id', 'startButtonContained');
            
                // Create the button
                let button = $('<button></button>')
                .addClass('btn btn-dark border-white shadow-0 custom-gradient-bg px-4')
                .attr('id','startButton')
                .html('<i class="fas fa-comment me-2"></i>会話を開始する');
                
                // Append the button to the container
                container.append(button);

                // Append the container to the chat input area
                $('#chatInput').prepend(container);
            
                //$('#input-container').hide().removeClass('d-flex');
                
                // Add click event listener to the button
                button.on('click', function() {
                    if(isTemporary){
                        displayStarter();
                    }else{
                        selectPersona(function(){
                            displayStarter();
                        })
                    }
                });

            }
            function createIntro(chatData){
                userChatId = false
                // Extracting data from chatData
                const thisChatId = chatData._id
                let name = chatData.name;
                let description = chatData.description;
                let thumbnailUrl = chatData.thumbnailUrl;
                let chatImageUrl = chatData.chatImageUrl;

                // Remove existing container if it exists
                $('#introChat').remove();
                $('#message-number').hide();
                $('#stability-gen-button').hide();
                $('.auto-gen').each(function(){$(this).hide()})
                $('#audio-play').hide();
                
                // Create the intro elements
                let introContainer = $('<div></div>')
                .addClass('intro-container assistant-chat-box my-3 p-3')
                .attr('id','introChat');
            
                let title = $('<h2></h2>').text(name);
                let desc = $('<span></span>').text(description);

                introContainer.append(desc);
                $('#chatContainer').append(introContainer);
                /*
                let image = $('<img>').addClass('intro-thumbnail');
            
                if(thumbnailUrl){
                    $.ajax({
                        url: thumbnailUrl,
                        type: 'GET',
                        mode: 'cors',
                        cache: 'no-store',
                        success: function() {
                            image.attr('src', thumbnailUrl);
                        },
                        error: function(xhr) {
                            console.error('Error fetching image: ' + xhr.status + ' ' + xhr.statusText);
                        }
                    });
                }
                if(chatImageUrl){
                    $.ajax({
                        url: chatImageUrl,
                        type: 'GET',
                        mode: 'cors',
                        cache: 'no-store',
                        success: function() {
                            image.attr('src', chatImageUrl)
                        },
                        error: function(xhr) {
                            console.error('Error fetching image: ' + xhr.status + ' ' + xhr.statusText);
                        }
                    });
                }
                if(!thumbnailUrl && !chatImageUrl){
                    image.attr('src', '/img/logo.webp')
                }
                introContainer.append(image);
            
                const toolbox = `
                            <ul class="intro-toolbox d-flex flex-row list-group justify-content-center">
                                <li class="d-none list-group-item p-0 border-0 mx-1">
                                    <button class="btn btn-outline-light text-secondary chart-button" data-id="${thisChatId}">
                                        <i class="fas fa-info-circle me-1"></i>
                                        <span class="text-muted" style="font-size:12px">情報</span>
                                    </button>
                                </li>
                                <li class="list-group-item p-0 border-0 mx-1">
                                    <button class="btn btn-outline-light text-secondary tag-button" data-id="${thisChatId}">
                                        <i class="fas fa-share me-1"></i> 
                                        <span class="text-muted" style="font-size:12px">共有</span>
                                    </button>
                                </li>
                                <li class="list-group-item p-0 border-0 mx-1">
                                    <a href="/chat/edit/${thisChatId}" class="btn btn-outline-light text-secondary">
                                        <i class="far fa-edit me-1"></i> 
                                        <span class="text-muted" style="font-size:12px">編集</span>
                                    </a>
                                </li>
                                <li class="list-group-item p-0 border-0 mx-1">
                                    <span data-id="${thisChatId}" class="btn btn-outline-light text-secondary delete-chat" style="cursor:pointer">
                                        <i class="fas fa-trash me-1"></i> 
                                        <span class="text-muted" style="font-size:12px">削除</span>
                                    </span>
                                </li>
                            </ul>
                            `
                //introContainer.append(toolbox);
                // Display intro container inside #chatContainer
                

                if($('#chat-widget-container').length == 0 && isTemporary){
                    //showRegistrationForm()
                    //return
                }
                */
            }
            function selectPersona(callback) {
                $.get('/api/user/persona-details', function(response) {
                    const user = response.userDetails;
                    const personas = response.personaDetails;
                    if(!personas || personas.length == 0 ){
                        if (callback) {
                            callback();
                        }
                        return
                    }
            
                    let personaHtml = '';
                    personas.forEach(persona => {
                        const isActive = user?.persona?.includes(persona._id);
                        personaHtml += `
                            <div class="persona-item" style="display: inline-block; margin: 10px;">
                                <img src="${persona.chatImageUrl}" class="rounded-circle ${isActive ? 'active' : ''}" style="width: 80px; height: 80px; cursor: pointer;object-fit: cover;object-position: top;" data-id="${persona._id}">
                            </div>
                        `;
                    });
            
                    const swalHtml = `
                        <div class="persona-item" style="display: inline-block; margin: 10px;">
                            <img src="${user.profile ? user.profile: '/img/avatar.png'}" class="rounded-circle" style="width: 80px; height: 80px; cursor: pointer;object-fit: cover;object-position: top;">
                        </div>
                        ${personaHtml}
                    `;
            
                    Swal.fire({
                        title: 'ペルソナを選択してください',
                        html: swalHtml,
                        showCloseButton: false,
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        customClass: {
                            title:'text-muted small',
                            popup: 'animate__animated animate__fadeIn',
                            hideClass: 'animate__animated animate__fadeOut',
                            htmlContainer:'p-0'
                        }
                    });
            
                    $(document).off('click', '.persona-item img').on('click', '.persona-item img', function() {
                        const $this = $(this);
                        const personaId = $this.data('id');
                        if(!personaId){
                            Swal.fire({
                                showConfirmButton: false,
                                timer: 10  // This timer can be adjusted to close the modal immediately
                            }).then(() => {
                                Swal.close(); // Ensures the modal is closed
                            });
                            if (callback) {
                                callback(personaId);
                            }
                            return
                        }
                        $.post('/api/user/persona', { personaId: personaId }, function(response) {
                            $this.toggleClass('active');
                            persona = response.persona
                            if (callback) {
                                callback(personaId);
                            }
                            Swal.fire({
                                showConfirmButton: false,
                                timer: 10  // This timer can be adjusted to close the modal immediately
                            }).then(() => {
                                Swal.close(); // Ensures the modal is closed
                            });
                        }).fail(function() {
                            Swal.fire({
                                icon: 'error',
                                title: 'エラー',
                                text: 'ペルソナの更新中に問題が発生しました。もう一度お試しください。'
                            });
                        });
                    });
                });
            }            
            
            function displayStarter(chat) {
                $('#startButtonContained').hide();
                $('#introChat').hide();
                const uniqueId = `${currentStep}-${Date.now()}`;
                let chatId = chat._id
                if($(document).find('.starter-on').length == 0){
                    const botResponseContainer = $(`
                        <div id="starter-${uniqueId}" class="starter-on">
                            <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                                <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;cursor:pointer;">
                                <div class="audio-controller" style="display:none">
                                    <button id="play-${uniqueId}" class="audio-content badge bg-dark">►</button>
                                </div>
                                <div id="completion-${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box">
                                    <img src="https://lamix.hatoltd.com/img/load-dot.gif" width="50px">
                                </div>
                            </div>
                            <div id="response-${uniqueId}" class="choice-container" ></div>
                        </div>`);
                    $('#chatContainer').append(botResponseContainer);
                    $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);
                }
                let currentDate = new Date();
                let currentTimeInJapanese = `${currentDate.getHours()}時${currentDate.getMinutes()}分`;
                
                let message = `[Starter]  これはウェブアプリケーションのためのプロンプトです。私たちがまったく見知らぬ者同士であるかのように、自然に会話のきっかけを作ってください。現在の時刻（${currentTimeInJapanese}）を活用して、タイムリーで親しみやすい挨拶をしてください。確認から始めず、答えから始めてください。`;
                
                if($('#chat-widget-container').length == 0 && isTemporary){
                    message = `[Starter] これはウェブアプリケーションの登録プロセスを促進するためのプロンプトです。キャラクターになりきって、現在の時刻（${currentTimeInJapanese}）を活用し、この瞬間にログインまたは登録することがどれほど重要かを強調してください。登録することで「1日50件までチャットできる」、「キャラクターがあなたに写真を送ることができる」、「新しいキャラクターを作成する」といった素晴らしい機能が今すぐ利用可能であることを、感情を込めて懇願してください。確認や前置きなしで、直接答えから始めてください。`
                }

                $.ajax({
                    url: API_URL+'/api/chat-data',
                    type: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({ 
                        currentStep: 0, 
                        message,
                        userId: userId,
                        chatId: chatId, 
                        isNew: true ,
                        isWidget : $('#chat-widget-container').length > 0
                    }),
                    success: function(response) {
                        const messageCountDoc = response.messageCountDoc
                        if(messageCountDoc.limit && !isTemporary){
                            let limitMess = messageCountDoc.limit == '無制限' ? messageCountDoc.limit : `${parseInt(messageCountDoc.count)}/${messageCountDoc.limit}`
                            $('#message-number')
                            .html(`
                                <span class="badge bg-dark" style="color: rgb(165 164 164);opacity:0.8;font-size: 12px;">
                                    <i class="fa fa-comment me-1"></i>${limitMess}
                                </span>
                            `)
                            .hide()
                        }
                        userChatId = response.userChatId
                        chatId = response.chatId
                        isNew = false;
                        renderChatList(userId,chatId);
                        $(`#starter-${uniqueId}`).remove()
                       
                        generateCompletion(function(){
                            $('.auto-gen').each(function(){$(this).show()})
                            $('#audio-play').show();
                            $('#progress-container').show();
                            $('#input-container').show().addClass('d-flex');
                            if($('#chat-widget-container').length == 0 && isTemporary){
                                displayMessage('assistant',`<a class="btn btn-secondary custom-gradient-bg shadow-0 m-2 px-4 py-2" style="border-radius: 50px;" href="/authenticate"><i class="fas fa-sign-in-alt me-2"></i> ログイン</a>`)
                            }
                            if(!isTemporary){checkForPurchaseProposal()}
                        
                        })

                        updateParameters(chatId,userId)

                        if(isTemporary){
                            const redirectUrl = window.location.pathname
                            $.cookie('redirect_url', redirectUrl);
                        }

                    },
                    error: function(xhr, status, error)  {
                        $('#startButtonContained').show();
                        $('#introChat').show();
                        $(`#starter-${uniqueId}`).remove()
                        if (xhr.responseJSON) {
                            var errorStatus = xhr.status;
                            if (errorStatus === 403) {
                                var limitIds = xhr.responseJSON.limitIds || [];
                    
                                if ($('#chat-widget-container').length == 0 && isTemporary) {
                                    showRegistrationForm(limitIds);
                                    return;
                                }
                                if (limitIds.includes(1) && $('#chat-widget-container').length == 0) {
                                    showUpgradePopup('chat-message');
                                    return;
                                } 
                                if (limitIds.includes(2)) {
                                    showUpgradePopup('chat-character');
                                    return;
                                }
                            }
                        } else {
                            console.error('Error:', error);
                            displayMessage('bot', 'An error occurred while sending the message.');
                        }
                    }                    
                });
            }
            
            async function displayChatWithStep(userChat,persona) {
                $('#progress-container').show();
                $('#stability-gen-button').show();
                $('.auto-gen').each(function(){$(this).show()});
                $('#audio-play').show();
            
                let chatContainer = $('#chatContainer');
                chatContainer.empty();
            
                if(userChat[1].role === "user"){
                    let userMessage = userChat[2];
                    const isStarter = userMessage.content.startsWith("[Starter]") || userMessage.content.startsWith("Invent a situation");
                    const isHidden = userMessage.content.startsWith("[Hidden]");
                    if(!isStarter && !isHidden){
                        let messageHtml = `
                            <div class="d-flex flex-row justify-content-end mb-4 message-container">
                                <div id="response-1" class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfbdb;">
                                    ${marked.parse(userMessage.content)}
                                </div>
                                ${persona ? `<img src="${persona.chatImageUrl || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">`:''}
                            </div>
                        </div>
                        `;
                        chatContainer.append($(messageHtml).hide().fadeIn());
                    }
                }
            
                for (let i = 1; i < userChat.length; i++) {
                    // Skip system messages
                    if (userChat[i].role === "system") {
                        continue;
                    }
            
                    currentStep = Math.floor(i / 2) + 1;
                    let messageHtml = '';
                    if (userChat[i].role === "assistant") {
                        let assistantMessage = userChat[i];
                        let designStep = currentStep - 1;
            
                        // Check if the message is a narrator message
                        const isNarratorMessage = assistantMessage?.content?.startsWith("[Narrator]") || false;
                        const isImage = assistantMessage?.content?.startsWith("[Image]") || false;
                        if (isNarratorMessage) {
                            // Remove the [Narrator] tag for display
                            const narrationContent = assistantMessage.content.replace("[Narrator]", "").trim();
            
                            // Create a narrator message box
                            messageHtml += `
                                <div id="narrator-container-${designStep}" class="d-flex flex-row justify-content-start message-container">
                                    <div id="narration-${designStep}" class="p-3 ms-3 text-start narration-container" style="border-radius: 15px;">
                                        ${marked.parse(narrationContent)}
                                    </div>
                                </div>
                            `;
                        } else if (isImage) {
                            const imageId = assistantMessage.content.replace("[Image]", "").trim();
                            
                            messageHtml += await getImageUrlById(imageId, designStep, thumbnail); // Wait for the image URL and HTML
            
                        } else {
                            if(assistantMessage.content){
                                let message = removeContentBetweenStars(assistantMessage.content);
                                messageHtml += `
                                    <div id="container-${designStep}">
                                        <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                                            <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                                            <div class="audio-controller">
                                                <button id="play-${designStep}" class="audio-content badge bg-dark" data-content="${message}">►</button>
                                            </div>
                                            <div id="message-${designStep}" class="p-3 ms-3 text-start assistant-chat-box">
                                                ${marked.parse(assistantMessage.content)}
                                            </div>
                                        </div>
                                `;
                            }
            
                        }
            
                        // Check if the next message is a user message and display it
                        if (i + 1 < userChat.length && userChat[i + 1].role === "user") {
                            let userMessage = userChat[i + 1];
                            const isHidden = userMessage.content.startsWith("[Hidden]");
                            const isStarter = userMessage.content.startsWith("[Starter]") || userMessage.content.startsWith("Invent a situation");
                            if(!isStarter && !isHidden){
                                messageHtml += `
                                    <div class="d-flex flex-row justify-content-end mb-4 message-container">
                                        <div id="response-${designStep}" class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfbdb;">
                                            ${marked.parse(userMessage.content)}
                                        </div>
                                        ${persona ? `<img src="${persona.chatImageUrl || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">`:''}
                                    </div>
                                </div>
                                `;
                            }
            
                            i++; 
                        } else {
                            messageHtml += `
                                <div id="response-${designStep}" class="choice-container d-none"></div>
                            </div>
                            `;
                        }
            
                        chatContainer.append($(messageHtml).hide().fadeIn());
                    }
                }
            }
            async function displayChat(userChat, persona) {
                $('#progress-container').show();
                $('#stability-gen-button').show();
                $('.auto-gen').each(function() { $(this).show(); });
                $('#audio-play').show();
            
                let chatContainer = $('#chatContainer');
                chatContainer.empty();
            
                for (let i = 0; i < userChat.length; i++) {
                    let messageHtml = '';
                    let chatMessage = userChat[i];
            
                    if (chatMessage.role === "user") {
                        const isStarter = chatMessage.content.startsWith("[Starter]") || chatMessage.content.startsWith("Invent a situation") || chatMessage.content.startsWith("Here is your character description");
                        const isHidden = chatMessage.content.startsWith("[Hidden]");
                        if (!isStarter && !isHidden) {
                            messageHtml = `
                                <div class="d-flex flex-row justify-content-end mb-4 message-container">
                                    <div class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfbdb;">
                                        ${marked.parse(chatMessage.content)}
                                    </div>
                                    ${persona ? `<img src="${persona.chatImageUrl || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">` : ''}
                                </div>
                            `;
                        }
                    } else if (chatMessage.role === "assistant") {
                        const isNarratorMessage = chatMessage.content.startsWith("[Narrator]");
                        const isImage = chatMessage.content.startsWith("[Image]");
                        const designStep = Math.floor(i / 2) + 1;
            
                        if (isNarratorMessage) {
                            const narrationContent = chatMessage.content.replace("[Narrator]", "").trim();
                            messageHtml = `
                                <div id="narrator-container-${designStep}" class="d-flex flex-row justify-content-start message-container">
                                    <div id="narration-${designStep}" class="p-3 ms-3 text-start narration-container" style="border-radius: 15px;">
                                        ${marked.parse(narrationContent)}
                                    </div>
                                </div>
                            `;
                        } else if (isImage) {
                            const imageId = chatMessage.content.replace("[Image]", "").trim();
                            messageHtml = await getImageUrlById(imageId, designStep, thumbnail); // Fetch and display image
                        } else {
                            const isHidden = chatMessage.content.startsWith("[Hidden]");
                            if (chatMessage.content && !isHidden) {
                                let message = removeContentBetweenStars(chatMessage.content);
                                messageHtml = `
                                    <div id="container-${designStep}">
                                        <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                                            <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                                            <div class="audio-controller">
                                                <button id="play-${designStep}" class="audio-content badge bg-dark" data-content="${message}">►</button>
                                            </div>
                                            <div id="message-${designStep}" class="p-3 ms-3 text-start assistant-chat-box">
                                                ${marked.parse(chatMessage.content)}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }
                        }
                    }
            
                    if (messageHtml) {
                        chatContainer.append($(messageHtml).hide().fadeIn());
                    }
                }
                $('#chatContainer').animate({
                    scrollTop: $('#chatContainer').prop("scrollHeight")
                }, 500);
            }
            
            
            function getImageUrlById(imageId, designStep, thumbnail) {
                return new Promise((resolve, reject) => {
                    $.ajax({
                        url: `/image/${imageId}`,
                        method: 'GET',
                        success: function(response) {
                            let isBlur = response.isBlur
                            if (response.imageUrl) {
                                const messageHtml = `
                                <div id="container-${designStep}">
                                    <div class="d-flex flex-row justify-content-start mb-4 message-container ${isBlur ? 'unlock-nsfw':''}">
                                        <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;">
                                        <div class="position-relative">
                                            <div class="p-3 ms-3 text-start assistant-image-box">
                                                <img id="image-${imageId}" src="${response.imageUrl}" alt="${response.imagePrompt}">
                                            </div>
                                            ${isBlur ? `
                                            <div class="badge-container position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
                                                <span type="button" class="badge bg-danger text-white" style="padding: 5px; border-radius: 5px;">
                                                    <i class="fas fa-lock"></i> 成人向け
                                                </span>
                                            </div>` : ''}
                                        </div>
                                    </div>
                                </div>`;
                                resolve(messageHtml);
                            } else {
                                console.error('No image URL returned');
                                reject('No image URL returned');
                            }
                        },
                        error: function(xhr, status, error) {
                            console.error('Error fetching image URL:', error);
                            reject(error);
                        }
                    });
                });
            }
            
            
            $(document).on('click','.unlock-nsfw',function(){
                showUpgradePopup('unlock-nsfw');
            })
            function displayStep(chatData, currentStep) {
                const step = chatData[currentStep];
                $('#chatContainer').append(`
                <div id="container-${currentStep}">
                    <div class="d-flex flex-row justify-content-start mb-4 message-container" style="opacity:0;">
                        <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                        <div id="message-${currentStep}" class="p-3 ms-3 text-start assistant-chat-box"></div>
                    </div>
                    <div id="response-${currentStep}" class="choice-container" ></div>
                </div>`)
                step.responses.forEach((response, index) => {
                    if(response.trim() != '' ){
                        const button = $(`<button class="btn btn-outline-secondary m-1" onclick="choosePath('${response}')">${response}</button>`);
                        button.css('opacity',0)
                        $(`#response-${currentStep}`).append(button);
                    }
                });
                appendHeadlineCharacterByCharacter($(`#message-${currentStep}`), step.question,function(){
                    $(`#response-${currentStep} button`).each(function(){
                        $(this).css('opacity',1)
                    })
                })
            }

            function updatechatContent(response) {
                const previousStep = chatData[currentStep-1]; // Previous step where the choice was made


                if (currentStep < totalSteps) {
                    $('#chatContainer').append(`
                    <div id="container-${currentStep}">
                        <div class="d-flex flex-row justify-content-start mb-4 message-container" style="opacity:0;">
                            <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                            <div id="message-${currentStep}" class="p-3 ms-3 text-start assistant-chat-box"></div>
                        </div>
                        <div id="response-${currentStep}" class="choice-container" ></div>
                    </div>`)
                    const nextStep = chatData[currentStep];
                    nextStep.responses.forEach(response => {
                        if(response.trim() != ''){
                            const button = $(`<button class="btn btn-outline-secondary m-1" onclick="choosePath('${response}')">${response}</button>`)
                            button.css('opacity',0)
                            $(`#response-${currentStep}`).append(button);
                        }
                    });

                    const choice = previousStep.responses.find(c => c === response);
                    $(`#message-${currentStep}`).closest('.message-container').animate({ opacity: 1 }, 500, function() { 
                        appendHeadlineCharacterByCharacter($(`#message-${currentStep}`), nextStep.question,function(){
                            $(`#response-${currentStep} button`).each(function(){
                                $(this).css('opacity',1)
                            })
                        });
                    })
                }else{
                    generateCompletion(function(){
                        checkForPurchaseProposal()
                    })
                }
            }

            function hideOtherChoice(response, currentStep, callback) {

                $(`#response-${currentStep - 1} button`).each(function() {
                    const currentChoice = $(this).text()
                    if(response == currentChoice){
                        const response = $(this).text()
                        $(`#response-${currentStep - 1}`).remove()
                        $(`#container-${currentStep - 1}`).append(`
                            <div class="d-flex flex-row justify-content-end mb-4 message-container" style="opacity:0;">
                                <div id="response-${currentStep - 1}" class="p-3 me-3 border-0" style="border-radius: 15px; background-color: #fbfbfbdb;">${response}</div>
                            </div>
                        `)
                    }
                    $(this).remove()
                });
                $(`#response-${currentStep - 1}`).closest('.message-container').animate({ opacity: 1 }, 1000,function(){
                    if (callback) {callback()}
                })
            }

            function generateChoice(){
                const apiUrl = API_URL+'/api/openai-chat-choice/'

                $.ajax({
                    url: apiUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ userId, chatId }),
                    success: function(response) {
                        const cleanResponse = cleanJsonArray(response)

                        cleanResponse.forEach(choice => {
                            const button = $(`<button class="btn btn-outline-secondary m-1" onclick="sendMessage('${choice}')">${choice}</button>`)
                            $(`#response-${currentStep}`).append(button);
                        });
                    },
                    error: function(error) {
                        console.error('Error:', error);
                    }
                });
            }
            function cleanJsonArray(jsonString) {
                // Remove all characters before the first '{'
                let start = jsonString.indexOf('[');
                if (start !== -1) {
                    jsonString = jsonString.substring(start);
                }

                // Remove all characters after the last '}'
                let end = jsonString.lastIndexOf(']');
                if (end !== -1) {
                    jsonString = jsonString.substring(0, end + 1);
                }

                return JSON.parse(jsonString);
            }
            let audioPermissionGranted = true;

            function requestAudioPermission() {
                if (audioPermissionGranted) {
                    return Promise.resolve(true);
                }
            
                return Swal.fire({
                    title: 'オーディオ再生の許可',
                    text: '次回から自動再生されます。',
                    icon: 'info',
                    toast: true,
                    position: 'top-end',
                    showCancelButton: true,
                    confirmButtonText: 'はい',
                    cancelButtonText: 'いいえ',
                    customClass: {
                        popup: 'animate__animated animate__fadeIn animate__faster',
                        backdrop: 'swal2-backdrop-show animate__animated animate__fadeIn animate__faster',
                        container: 'swal2-container swal2-top-end',
                        title: 'swal2-title',
                        content: 'swal2-content',
                        actions: 'swal2-actions',
                        confirmButton: 'swal2-confirm swal2-styled',
                        cancelButton: 'swal2-cancel swal2-styled',
                    },
                    didClose: () => {
                        Swal.getPopup().classList.add('animate__animated', 'animate__fadeOut', 'animate__faster');
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        audioPermissionGranted = true;
                    }
                    return result.isConfirmed;
                });
            }       
            function stopAllAudios() {
                audioPool.forEach(audio => {
                    audio.pause();
                    audio.currentTime = 0;
                });
            }
            
            function getAvailableAudio() {
                const idleAudio = audioPool.find(a => a.paused && a.currentTime === 0);
                if (idleAudio) {
                    return idleAudio;
                } else {
                    const newAudio = new Audio();
                    audioPool.push(newAudio);
                    return newAudio;
                }
            }
            
            $(document).on('click', function() {
                getAvailableAudio();
            });
            
            $(document).on('click', '.audio-controller .audio-content', function(event) {
                event.stopPropagation();
                const $el = $(this);
                const message = $el.attr('data-content');
                stopAllAudios();
            
                (function() {
                    const duration = $el.attr('data-audio-duration');
                    if (duration) $el.html('► ' + Math.round(duration) + '"');
                })();
            
                initAudio($el, message);
            });
            
            function initAudio($el, message) {
                requestAudioPermission().then(isAllowed => {
                    if (!isAllowed) {
                        return $el.html('再生がキャンセルされました');
                    }
            
                    $el.html('<div class="spinner-grow spinner-grow-sm" role="status"><span class="visually-hidden">Loading...</span></div>');
                    const voiceUrl = getVoiceUrl(message);
            
                    $.post(voiceUrl, response => {
                        if (response.errno !== 0) {
                            return $el.html('エラーが発生しました');
                        }
            
                        const audioUrl = response.data.audio_url;
                        audioCache.set(message, audioUrl);
                        const audio = getAvailableAudio();
                        playAudio($el, audio, audioUrl);
                    });
                });
            }
            
            function getVoiceUrl(message) {
                const baseUrl = 'https://api.synclubaichat.com/aichat/h5/tts/msg2Audio';
                const params = `?device=web_desktop&product=aichat&sys_lang=en-US&country=&referrer=&zone=9&languageV2=ja&uuid=&app_version=1.6.4&message=${encodeURIComponent(message)}&voice_actor=default_voice`;
                return $('#chat-container').attr('data-genre') == 'male' 
                    ? `${baseUrl}${params}&robot_id=1533008538&ts=1723632421&t_secret=661712&sign=9e2bfc4903b8c1176f7e2c973538908b` 
                    : `${baseUrl}${params}&robot_id=1533008511&ts=1724029265&t_secret=58573&sign=3beb590d1261bc75d6687176f50470eb`;
            }
            function playAudio($el, audio, audioUrl) {
                if (audio.src !== audioUrl) audio.src = audioUrl;
            
                audio.play();
            
                audio.onloadedmetadata = () => 
                    $el.attr('data-audio-duration', audio.duration).html(`❚❚ ${Math.round(audio.duration)}"`);
            
                audio.onended = () => 
                    $el.html(`► ${Math.round(audio.duration)}"`);
            
                $el.off('click').on('click', (event) => {
                    event.stopPropagation();
                
                    const message = $el.attr('data-content');
                    const audioDuration = $el.attr('data-audio-duration')
                    const cachedUrl = audioCache.get(message);
                    let audio = audioPool.find(a => a.src === cachedUrl) || getAvailableAudio();
                
                    if (audio.src !== cachedUrl) {
                        audio.src = cachedUrl;
                    }
                
                    if (audio.paused) {
                        audio.play();
                        $el.html(`❚❚ ${Math.round(audioDuration)}"`);
                    } else {
                        audio.pause();
                        audio.currentTime = 0;
                        $el.html(`► ${Math.round(audioDuration)}"`);
                    }
                });
                
            }
            
            
            
            function removeContentBetweenStars(str) {
                if (!str) { return str; }
                return str.replace(/\*.*?\*/g, '').replace(/"/g, '');
            }                    
            function generateCompletion(callback){
                
                const apiUrl = API_URL+'/api/openai-chat-completion';

                hideOtherChoice(false, currentStep)
                // Initialize the bot response container
                const animationClass = 'animate__animated animate__slideInUp';
                const uniqueId = `${currentStep}-${Date.now()}`;
                const botResponseContainer = $(`
                    <div id="container-${uniqueId}">
                        <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                            <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;cursor:pointer;">
                            <div class="audio-controller" style="display:none">
                                <button id="play-${uniqueId}" class="audio-content badge bg-dark">►</button>
                            </div>
                            <div id="completion-${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box">
                                <img src="https://lamix.hatoltd.com/img/load-dot.gif" width="50px">
                            </div>
                        </div>
                    </div>`).hide();
                $('#chatContainer').append(botResponseContainer);
                botResponseContainer.addClass(animationClass).fadeIn();
                $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);
                $.ajax({
                    url: apiUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ userId, chatId, userChatId }),
                    success: function(response) {
                        const sessionId = response.sessionId;
                        const streamUrl = API_URL+`/api/openai-chat-completion-stream/${sessionId}`;
                        const eventSource = new EventSource(streamUrl);
                        let markdownContent = "";

                        eventSource.onmessage = function(event) {
                            const data = JSON.parse(event.data);
                            markdownContent += data.content;
                            $(`#completion-${uniqueId}`).html(marked.parse(markdownContent));
                        };

                        eventSource.onerror = function(error) {
                            eventSource.close();
                            let message = removeContentBetweenStars(markdownContent)
                            if(language != 'english'){
                                $(`#play-${uniqueId}`).attr('data-content',message)
                                $(`#play-${uniqueId}`).closest('.audio-controller').show()
                                if(autoPlay){
                                    initAudio($(`#play-${uniqueId}`), message);
                                }
                            }
                            if (typeof callback === "function") {
                                callback();
                            }
                        };
                    },
                    error: function(error) {
                        console.error('Error:', error);
                    }
                });
            }
            function generateCustomCompletion(customPrompt, callback) {
                const apiUrl = API_URL + '/api/openai-custom-chat';
            
                hideOtherChoice(false, currentStep);
                currentStep ++
                // Initialize the bot response container
                const botResponseContainer = $(`
                    <div id="container-${currentStep}">
                        <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                            <img src="${thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;cursor:pointer;">
                            <div class="audio-controller" style="display:none">
                                <button id="play-${currentStep}" class="audio-content badge bg-dark">►</button>
                            </div>
                            <div id="completion-${currentStep}" class="p-3 ms-3 text-start assistant-chat-box">
                                <img src="https://lamix.hatoltd.com/img/load-dot.gif" width="50px">
                            </div>
                        </div>
                    </div>`);
                $('#chatContainer').append(botResponseContainer);
                $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);
            
                $.ajax({
                    url: apiUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ userId, chatId, userChatId, customPrompt }),
                    success: function(response) {
                        const sessionId = response.sessionId;
                        const streamUrl = API_URL + `/api/openai-custom-chat-stream/${sessionId}`;
                        const eventSource = new EventSource(streamUrl);
                        let markdownContent = "";
            
                        eventSource.onmessage = function(event) {
                            const data = JSON.parse(event.data);
                            markdownContent += data.content;
                            $(`#completion-${currentStep}`).html(marked.parse(markdownContent));
                        };
            
                        eventSource.onerror = function(error) {
                            eventSource.close();
                            let message = removeContentBetweenStars(markdownContent);
                            if(language != 'english'){
                                $(`#play-${currentStep}`).attr('data-content', message);
                                $(`#play-${currentStep}`).closest('.audio-controller').show();
                                if(autoPlay){
                                    initAudio($(`#play-${currentStep}`), message);
                                }
                            }

                            if (typeof callback === "function") {
                                callback();
                            }
                        };
                    },
                    error: function(error) {
                        console.error('Error:', error);
                    }
                });
            }            
            function generateNarration(callback) {
                const apiUrl = API_URL + '/api/openai-chat-narration';
                        
                // Initialize the narrator response container
                const narratorResponseContainer = $(`
                    <div id="narrator-container-${currentStep}" class="d-flex flex-row justify-content-start message-container">
                        <div id="narration-${currentStep}" class="p-3 ms-3 text-start narration-container" style="border-radius: 15px;">
                            <img src="https://lamix.hatoltd.com/img/load-dot.gif" width="50px">
                        </div>
                    </div>
                `);
            
                $('#chatContainer').append(narratorResponseContainer);
                $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);
            
                $.ajax({
                    url: apiUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ userId, chatId, userChatId }),
                    success: function(response) {
                        const sessionId = response.sessionId;
                        const streamUrl = API_URL + `/api/openai-chat-narration-stream/${sessionId}`;
                        const eventSource = new EventSource(streamUrl);
                        let narrationContent = "";
            
                        eventSource.onmessage = function(event) {
                            const data = JSON.parse(event.data);
                            narrationContent += data.content;
                            $(`#narration-${currentStep}`).html(marked.parse(narrationContent));
                        };
            
                        eventSource.onerror = function(error) {
                            eventSource.close();
                            if (typeof callback === "function") {
                                callback();
                            }
                        };
                    },
                    error: function(error) {
                        console.error('Error:', error);
                    }
                });
            }
                        
            window.displayMessage = function(sender, message, callback) {
                const messageClass = sender === 'user' ? 'user-message' : sender;
                const animationClass = 'animate__animated animate__slideInUp';
                let messageElement;
            
                if (messageClass === 'user-message') {
                    if (typeof message === 'string' && message.trim() !== '') {
                        messageElement = $(`
                            <div class="d-flex flex-row justify-content-end mb-4 message-container ${messageClass} ${animationClass}">
                                <div class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfbdb;">
                                    <span>${message}</span>
                                </div>
                                ${persona ? `<img src="${persona.chatImageUrl || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">` : ''}
                            </div>
                        `).hide();
                        $('#chatContainer').append(messageElement);
                        messageElement.addClass(animationClass).fadeIn();
                    }
                } 
            
                else if (messageClass === 'bot-image' && message instanceof HTMLElement) {
                    messageElement = $(`
                        <div class="d-flex flex-row justify-content-start mb-4 message-container ${messageClass} ${animationClass}">
                            <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">
                            <div class="p-3 ms-3 text-start assistant-image-box">
                                ${message.outerHTML}
                            </div>
                        </div>      
                    `).hide();
                    $('#chatContainer').append(messageElement);
                    messageElement.addClass(animationClass).fadeIn();
                } 
            
                else if (messageClass === 'bot-image-nsfw'&& message instanceof HTMLElement) {
                    messageElement = $(`
                        <div class="d-flex flex-row justify-content-start mb-4 message-container ${messageClass} ${animationClass} unlock-nsfw" style="position: relative;">
                            <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">
                            <div class="position-relative">
                                <div class="p-3 ms-3 text-start assistant-image-box">
                                    ${message.outerHTML}
                                </div>
                                <div class="badge-container position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
                                    <span type="button" class="badge bg-danger text-white" style="padding: 5px; border-radius: 5px;">
                                        <i class="fas fa-lock"></i> 成人向け
                                    </span>
                                </div>
                            </div>
                        </div>   
                    `).hide();
                    $('#chatContainer').append(messageElement);
                    messageElement.addClass(animationClass).fadeIn();
                } 
            
                else if (messageClass === 'assistant' && typeof message === 'string' && message.trim() !== '') {
                    const uniqueId = `completion-${currentStep}-${Date.now()}`;
                    messageElement = $(`
                        <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container ${animationClass}">
                            <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top; cursor:pointer;">
                            <div id="${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box">
                                ${message}
                            </div>
                        </div>
                    `).hide();
                    $('#chatContainer').append(messageElement);
                    messageElement.show().addClass(animationClass);
                }
            
                $('#chatContainer').animate({
                    scrollTop: $('#chatContainer').prop("scrollHeight")
                }, 500); 
            
                if (typeof callback === 'function') {
                    callback();
                }
            };            

            window.buyItem = function(itemId, itemName, itemPrice, status, userId, chatId, userChatId) {
            
                if (status) {
                    initiatePurchase(itemId, itemName, itemPrice, userId, function(response) {
                        let message;
                        if (response.success) {
                            const successMessages = [
                                `${itemName}を購入しました！`,
                                `${itemName}を手に入れました！`,
                                `${itemName}があなたのものになりました！`,
                                `${itemName}をゲットしました！`,
                                `${itemName}を${itemPrice}コインで購入しました。`,
                                `${itemName}を無事に${itemPrice}コインでゲットしました！`,
                                `${itemName}を${itemPrice}コインで手に入れました。`
                            ];
                            
                            let message = successMessages[Math.floor(Math.random() * successMessages.length)];                            
                            $(`#${itemId} button`).each(function() { $(this).hide() });
                            updateCoins(response.coins)
                            displayMessage('user', message, function() {
                                addMessageToChat(chatId, userChatId, 'user', message, function(error, res) {
                                    if (error) {
                                        console.error('Error adding message:', error);
                                    } else {
                                        thumbnail = thumbnail || localStorage.getItem('thumbnail')
                                        generateCompletion(function(){
                                            checkImageDescription(thumbnail,function(response){
                                                if(!response){
                                                    generateImageDescriptionBackend(thumbnail,function(){
                                                        generateImagePromt(API_URL, userId, chatId, userChatId, thumbnail, character, function(prompt) {
                                                            generateImageNovita(API_URL, userId, chatId, userChatId, character, { prompt });
                                                        });
                                                    })
                                                }else{
                                                    generateImagePromt(API_URL, userId, chatId, userChatId, thumbnail, character, function(prompt) {
                                                        generateImageNovita(API_URL, userId, chatId, userChatId, character, { prompt });
                                                    });
                                                }
                                            }) 
                                        });
                                    }
                                });
                            });
                        } else {
                            showCoinShop()
                        }
                    });
                } else {
                    const messages = [
                        `${itemName}は今のところ購入されていません。`,
                        `${itemName}をスキップしました。`,
                        `${itemName}を今は手に入れませんでした。`,
                        `${itemName}を今は選択しませんでした。`
                    ];
                    let message = messages[Math.floor(Math.random() * messages.length)];
                    displayMessage('user', message, function() {
                        addMessageToChat(chatId, userChatId, 'user', message, function(error, res) {
                            if (error) {
                                console.error('Error adding message:', error);
                            } else {
                                console.log('Message added successfully:', res);
                                generateCompletion();
                            }
                        });
                    });
                }
            }
            
            function initiatePurchase(itemId, itemName, itemPrice, userId, callback) {
                $.ajax({
                    url: '/api/purchaseItem',
                    method: 'POST',
                    data: { itemId, itemName, itemPrice, userId },
                    success: function(response) {
                        callback(response);
                    },
                    error: function(xhr, status, error) {
                        console.error('Error during purchase request:', error);
                        callback({ success: false, error: error });
                    }
                });
            }
            
            function addMessageToChat(chatId, userChatId, role, message, callback) {
                $.ajax({
                    url: '/api/chat/add-message',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        chatId: chatId,
                        userChatId: userChatId,
                        role: role,
                        message: message
                    }),
                    success: function(response) {
                        if(typeof callback == 'function'){
                            callback(null, response);
                        }
                    },
                    error: function(xhr, status, error) {
                        if(typeof callback == 'function'){
                            callback(error);
                        }
                    }
                });
            }
            
            
            function sendCustomData(customData){
                $.ajax({
                    url: API_URL+'/api/custom-data',
                    type: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({ userId, customData: customData }),
                    success: function(response) {
                        
                    },
                    error: function(error) {
                        console.log(error.statusText);
                    }
                });
            }
            
            let maxScrollHeight = 0;
            let lastTriggeredHeight = 0;
            const viewportHeight = $(window).height();
            const updateInterval = viewportHeight * 0.05; // 5% of the viewport height

            function maxScroll() {
                const currentScrollHeight = $(window).scrollTop();
                const documentHeight = $(document).height();
                const windowHeight = $(window).height();
                const scrollPercentage = (currentScrollHeight / (documentHeight - windowHeight)) * 100;

                if (currentScrollHeight > maxScrollHeight) {
                    maxScrollHeight = currentScrollHeight;
                    if (Math.abs(currentScrollHeight - lastTriggeredHeight) >= updateInterval) {
                        sendCustomData({
                            action: 'scroll',
                            value: maxScrollHeight,
                            scrollPercentage: scrollPercentage.toFixed(2)
                        });
                        lastTriggeredHeight = currentScrollHeight;
                    }
                }

    
            }

            function handleImageGeneration(buttonSelector, generateImageFunction) {
                $(document).on('click', buttonSelector, function() {
                    if($(buttonSelector).hasClass('isLoading')){
                        return;
                    }
                    
                    if ($('#chat-widget-container').length == 0 && isTemporary) {
                        showRegistrationForm();
                        return;
                    }

                    $(buttonSelector).addClass('isLoading');
                    const API_URL = localStorage.getItem('API_URL');
                    const userId = $(this).attr('data-user-id');
                    const chatId = $(this).attr('data-chat-id');
                    const userChatId = $(this).attr('data-user-chat-id');
                    const thumbnail = $(this).attr('data-thumbnail');
                    const character = JSON.parse($(this).attr('data-character'));
                    generateImagePromt(API_URL, userId, chatId, userChatId, thumbnail, character, function(prompt) {
                        generateImageFunction(API_URL, userId, chatId, userChatId, character, { prompt });
                    });
                });
            }
            
            handleImageGeneration('#stability-gen-button', generateImageStableDiffusion);
            handleImageGeneration('#novita-gen-button', generateImageNovita);
            handleImageGeneration('#huggingface-gen-button', generateImageHuggingFace);
            
            // User info popup
                
            function generateRandomNickname() {
                const adjectives = ["すばやい", "静かな", "強力な", "勇敢な", "明るい", "高貴な"];
                const nouns = ["ライオン", "トラ", "ファルコン", "フェニックス", "オオカミ", "イーグル"];
                return adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)];
            }
            function UserInfoForm(){
                return `
                        <div class="row mb-3">    
                            <div class="col-9">
                                <div class="form-group mb-3 text-start">
                                    <label for="nickname" class="form-label">
                                        <span class="small text-white" style="font-size:12px">ニックネーム</span>
                                        <span class="small text-muted" style="font-size:10px">キャラクターに呼んでほしい名前</span>
                                    </label>
                                    <div class="input-group">
                                        <input id="nickname" type="text" class="form-control form-control-sm" placeholder="ニックネームを入力">
                                    </div>
                                </div>                        
                            </div>        
                            <div class="col-3 text-start">
                                <label for="gender" class="form-label text-white" style="font-size:12px"><i class="fas fa-user"></i> 性別</label>
                                <select class="form-select w-auto" id="gender" name="gender">
                                    <option value="female" selected><i class="fas fa-female"></i> 女性</option>
                                    <option value="male"><i class="fas fa-male"></i> 男性</option>
                                </select>
                            </div>
                        </div>

                        <div class="row text-start">
                            <label for="birthdate" class="form-label text-white" style="font-size:12px">生年月日</label>
                            <div class="d-flex">
                                <select class="form-control me-2" id="birthYear" name="birthYear" style="cursor:pointer;">
                                    <option value="" selected>年</option>
                                </select>
                
                                <select class="form-control me-2" id="birthMonth" name="birthMonth" style="cursor:pointer;">
                                    <option value="" selected>月</option>
                                </select>
                
                                <select class="form-control" id="birthDay" name="birthDay" style="cursor:pointer;">
                                    <option value="" selected>日</option>
                                </select>
                            </div>
                        </div>
                    `
            }
            function handleUserInfo(value,callback){
                const { nickname, birthYear, birthMonth, birthDay, gender } = value;
                const formData = new FormData();
                formData.append('nickname', nickname);
                formData.append('birthYear', birthYear);
                formData.append('birthMonth', birthMonth);
                formData.append('birthDay', birthDay);
                formData.append('gender', gender);
            
                $.ajax({
                    url: '/user/update-info',
                    type: 'POST',
                    processData: false,
                    contentType: false,
                    data: formData,
                    success: function(response) {
                        //showNotification('情報が更新されました。','success')
                        if(typeof callback == 'function'){callback()}
                    },
                    error: function() {
                        showNotification('情報の更新中に問題が発生しました。','error')
                        if(typeof callback == 'function'){callback()}
                    }
                });
            }

            function showPopupUserInfo(callback) {
                Swal.fire({
                    html: UserInfoForm(),
                    focusConfirm: false,
                    confirmButtonText: '送信',
                    allowOutsideClick: false,
                    showCancelButton: false,
                    customClass: {
                      confirmButton: 'bg-secondary px-5'
                    },
                        showClass: {
                            popup: 'custom-gradient-bg-no-animation animate__animated animate__fadeIn'
                    },
                        hideClass: {
                            popup: 'animate__animated animate__fadeOut'
                    },
                        didOpen: () => {
                            if (callback) callback();
                    },
                    preConfirm: () => {
                        const nickname = $('#nickname').val();
                        const birthYear = $('#birthYear').val();
                        const birthMonth = $('#birthMonth').val();
                        const birthDay = $('#birthDay').val();
                        const gender = $('#gender').val()
        
                        if (!nickname || !birthYear || !birthMonth || !birthDay || !gender)  {
                            Swal.showValidationMessage('すべてのフィールドを入力してください');
                            return false;
                        }
        
                        return { nickname, birthYear, birthMonth, birthDay, gender };
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        handleUserInfo(result.value);

                        if(!isTemporary && !subscriptionStatus && !$.cookie('showPremiumPopup')){
                            showPopupWithSwiper(function(){
                                $.cookie('showPremiumPopup',true)
                            })
                            //showPremiumPopup()
                        }
                    }
                    
                });
            }
            
            function showPopupWithSwiper(callback) {
                Swal.fire({
                    html: `
                        <div class="swiper-container">
                            <div class="swiper-wrapper">
                                <div class="swiper-slide">
                                    <a href="/my-plan">
                                    <img src="/img/sales/1.jpg" alt="Image 1" style="width: 100%;">
                                    </a>
                                </div>
                                <div class="swiper-slide">
                                    <a href="/my-plan">
                                    <img src="/img/sales/2.jpg" alt="Image 2" style="width: 100%;">
                                    </a>
                                </div>
                                <div class="swiper-slide">
                                    <a href="/my-plan">
                                    <img src="/img/sales/3.jpg" alt="Image 3" style="width: 100%;">
                                    </a>
                                </div>
                                <div class="swiper-slide">
                                    <a href="/my-plan">
                                    <img src="/img/sales/4.jpg" alt="Image 3" style="width: 100%;">
                                    </a>
                                </div>
                                <div class="swiper-slide">
                                    <a href="/my-plan">
                                    <img src="/img/sales/5.jpg" alt="Image 3" style="width: 100%;">
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div style="bottom: -50px;left:0;right:0;z-index: 100;" class="mx-auto position-absolute w-100">
                            <a href="/my-plan" class="btn btn-lg custom-gradient-bg text-white fw-bold" style="border-radius:50px;"><i class="far fa-star me-2"></i>プレミアムプランを試す</a>
                            <span id="closeButton" style="opacity:0" class="text-muted mx-auto w-100 d-block mt-1">検討する</span>
                        </div>
                    `,
                    focusConfirm: false,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    showCancelButton: false,
                    customClass: {
                        confirmButton: 'bg-secondary px-5', htmlContainer:'position-relative overflow-visible'
                    },
                    showClass: {
                        popup: 'bg-transparent animate__animated animate__fadeIn'
                    },
                    hideClass: {
                        popup: 'animate__animated animate__fadeOut'
                    },
                    didOpen: () => {
                        new Swiper('.swiper-container', {
                            slidesPerView: 1,
                            loop: false,
                            spaceBetween: 20,
                        });
                        document.getElementById('closeButton').addEventListener('click', () => {
                            Swal.close();
                        });
                        setTimeout(() => {
                            $('#closeButton').animate({ opacity: 1 }, 'slow');
                        }, 3000);
                        if (callback) callback();
                    }
                });
            }
            function checkForPurchaseProposal() {
                $.ajax({
                    url: '/api/check-assistant-proposal',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ userId, chatId, userChatId }),
                    success: function(response) {
                        if (response.proposeToBuy && response.items.length > 0) {
                            const item = response.items[0]
                            const itemId = `item-${currentStep}-${Date.now()}`;
                            const message = `
                                <div id="${itemId}" class="card bg-transparent text-white border-0">
                                    <div class="card-body-none" style="height:auto !important;">
                                        <h5 class="card-title" style="font-size: 14px;">${item.name}</h5>
                                        
                                        <button class="btn custom-gradient-bg  shadow-0 w-100" 
                                            onclick="buyItem('${itemId}','${item.name}', ${item.price}, true, '${userId}', '${chatId}', '${userChatId}')">
                                            <span> ${item.price}<span class="mx-1">🪙</span></span>
                                        </button>
                                        <button class="d-none btn btn-outline-danger border-0 shadow-0 rounded-0 position-absolute px-2 py-1" style="font-size: 12px;position: absolute;top: 0;right: 0;" onclick="buyItem('${itemId}','${item.name}', ${item.price}, false, '${userId}', '${chatId}', '${userChatId}')">見送る</button>
                                    </div>
                                </div>
                            `;
                            displayMessage('assistant', message);
                            count_proposal = 0
                        }else{
                            if(count_proposal >= 4){
                                let message = `[Hidden] Prepare to propose an item`
                                addMessageToChat(chatId, userChatId, 'user', message);
                            }
                        }
                        count_proposal ++
                    },
                    error: function(xhr, status, error) {
                        console.error('Error checking purchase proposal:', error);
                    }
                });
            }
            
            if(!isTemporary && $('#chat-widget-container').length == 0){
                let user = JSON.parse(localStorage.getItem('user'))

                const userNickname = user?.nickname ?? '';
                const userGender = user?.gender ?? '';
                const userBirthYear = user?.birthDate?.year ?? '';
                const userBirthMonth = user?.birthDate?.month ?? '';
                const userBirthDay = user?.birthDate?.day ?? '';
               
                if (!userNickname || !userBirthYear || !userBirthMonth || !userBirthDay || !userGender) {
                    showPopupUserInfo(function(callback){
                        var currentYear = new Date().getFullYear() - 15;
                        var startYear = 1900; 
                        for (var year = currentYear; year >= startYear; year--) {
                            $('#birthYear').append($('<option>', {
                                value: year,
                                text: year + '年'
                            }));
                        }
                        for (var month = 1; month <= 12; month++) {
                            $('#birthMonth').append($('<option>', {
                                value: month,
                                text: month + '月'
                            }));
                        }
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
                        populateDays($('#birthMonth').val(), $('#birthYear').val());
                        $('#birthMonth, #birthYear').change(function() {
                            populateDays($('#birthMonth').val(), $('#birthYear').val());
                        });
                    });
                }else{
                    if(!isTemporary && !subscriptionStatus && !$.cookie('showPremiumPopup')){
                        showPopupWithSwiper(function(){
                            $.cookie('showPremiumPopup',true)
                        })
                        //showPremiumPopup()
                    }
                }
            }
        });
    })

    // Fetch the user's IP address and generate a unique ID
   

    function getIdFromUrl(url) {
        if(!url){return null}
        var regex = /\/chat\/([a-zA-Z0-9]+)/;
        var match = url.match(regex);
        if (match && match[1]) {
            return match[1];
        } else {
            return null;
        }
    }
    function fetchUser(callback) {
        $.ajax({
            url: API_URL+'/api/user',
            method: 'GET',
            success: function(response) {
                if (callback && typeof callback === 'function') {
                    callback(null, response.user);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error fetching user:', textStatus, errorThrown);
                if (callback && typeof callback === 'function') {
                    callback(new Error(textStatus + ': ' + errorThrown), null);
                }
            }
        });
    }

    function fetchMode(callback) {
        $.ajax({
            url: '/api/mode',
            method: 'GET',
            success: function(response) {
                if (callback && typeof callback === 'function') {
                    callback(null, response);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                if (callback && typeof callback === 'function') {
                    callback(null,'online');
                }
            }
        });
    }

    function appendHeadlineCharacterByCharacter($element, headline, callback) {
        let index = 0;

        const spinner = $(`<div class="spinner-grow spinner-grow-sm text-light" role="status"><span class="visually-hidden">Loading...</span></div>`)
        $element.append(spinner)
        $element.closest(`.message-container`).animate({ opacity: 1 }, 500, function() { 
            $element.addClass('d-flex')
            setTimeout(() => {
                spinner.css('visibility', 'hidden');
                setTimeout(() => {
                    let intervalID = setInterval(function() {
                        if (index < headline.length) {
                            $element.append(headline.charAt(index));
                            index++;
                        } else {
                            clearInterval(intervalID);
                            if (callback) callback();
                        }
                    }, 25);
                }, 100);
            }, 500);
        });


    }

    function clearContentFromEnd($element, callback) {
        $element.html('')
        if (typeof callback === 'function') {
            callback();
        }
        /*
        let currentContent = $element.text();

        let clearIntervalID = setInterval(function() {
            if (currentContent.length > 0) {
                currentContent = currentContent.substring(0, currentContent.length - 1);
                $element.text(currentContent);
            } else {
                clearInterval(clearIntervalID);
                if (typeof callback === 'function') {
                    callback();
                }
            }
        }, 25); // This duration can be adjusted as per your requirement
        */
    }

    // Parse the URL and get query parameters
    const urlParams = new URLSearchParams(window.location.search);

    // Check if 'subscribe' parameter is true
    if (urlParams.get('subscribe') === 'true') {
        // Display SweetAlert2 in Japanese
        Swal.fire({
            title: 'サブスクリプション成功',
            text: 'ご登録ありがとうございます！プレミアム機能をお楽しみください。',
            icon: 'success',
            confirmButtonText: '閉じる'
        });
    }
});

function initializeOrUpdateProgress(messagesCount, maxMessages) {
    return
    // Check if the heart SVG is already initialized
    if ($('#progress-container svg').length === 0) {
        // If not initialized, create the SVG and elements
        const svgContent = `
            <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
                <!-- Background Heart -->
                <path id="heart-background" fill="white" stroke="black" stroke-width="5" d="
                    M140 20C73 20 20 74 20 140c0 135 136 170 228 303 88-132 229-173 229-303 0-66-54-120-120-120-48 0-90 28-109 69-19-41-60-69-108-69z" />
                
                <!-- GIF Container -->
                <image id="heart-gif" x="0" y="500" width="500" height="500" xlink:href="/img/wave.png" clip-path="url(#fill-mask)" />
                
                <!-- Mask for GIF -->
                <clipPath id="fill-mask">
                    <path d="
                        M140 20C73 20 20 74 20 140c0 135 136 170 228 303 88-132 229-173 229-303 0-66-54-120-120-120-48 0-90 28-109 69-19-41-60-69-108-69z" />
                </clipPath>
            </svg>
            <span id="progress-label" style="position: absolute; width: 100%; text-align: center; top: 45%; left: 50%; transform: translate(-50%, -50%); color: #111; font-weight: bold; font-size: 12px;">
                0/100
            </span>
        `;
        
        // Append the SVG content to the container
        $('#progress-container').html(svgContent);
    }

    // Update the progress
    updateProgress(messagesCount, maxMessages);
}

function updateProgress(messagesCount, maxMessages) {
    if(messagesCount>maxMessages){return}
    // Calculate fill percentage out of 100
    const fillPercentage = Math.min((messagesCount / maxMessages) * 100, 100);
    const fillHeight = 500 - (500 * fillPercentage / 100);

    // Adjust the y-position of the GIF to create the moving fill effect
    $('#heart-gif').attr('y', fillHeight);

    // Update the progress label with the current count
    $('#progress-label').text(`${messagesCount}/${maxMessages}`);
}
function enableToggleDropdown() {
    $(document).find('.dropdown-toggle').each(function() {
        if (!$(this).hasClass('event-attached')) {
            $(this).addClass('event-attached');

            // Attach the event listener
            $(this).on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
            });

            // Initialize the dropdown
            const dropdown = new mdb.Dropdown($(this)[0]);

            // Find the parent element that has the hover effect
            const parent = $(this).closest('.chat-list');

            let hoverTimeout;

            // Add hover event listeners to the parent element
            parent.hover(
                function() {
                    if (hoverTimeout) {
                        clearTimeout(hoverTimeout);
                    }
                    // When the parent element is hovered
                    $(this).find('.dropdown-toggle').css({
                        'opacity': 1,
                        'pointer-events': ''
                    });
                },
                function() {
                    hoverTimeout = setTimeout(() => {
                        // When the parent element is no longer hovered
                        $(this).find('.dropdown-toggle').css({
                            'opacity': 1,
                            'pointer-events': 'none'
                        });
                        // Close the dropdown
                        dropdown.hide();
                    }, 500);
                }
            );
        }
    });
}
function showRegistrationForm(messageId,callback) {

    //window.location = "/authenticate?register=true"
    Swal.fire({
      title: '',
      text: '',
      //imageUrl: '/img/login-bg-862c043f.png', // replace with your image URL
      imageWidth: 'auto',
      imageHeight: 'auto',
      position: 'bottom',
      html: `
        <h2><span class="u-color-grad">無料で</span><br>チャットを続けましょう</h2>
        <p class="text-muted mb-2 header" style="font-size: 16px;">今すぐ体験を始めよう！</p>
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card shadow-0 border-0">
                        <div class="card-body">
                            <a href="/user/google-auth" class="btn btn-light ico-login-button mb-3">
                                <img src="/img/google_logo_neutral.png" alt="Google"/>
                                <span class="gsi-material-button-contents">で続ける</span>
                            </a>
                            <a href="/user/line-auth" class="btn btn-light ico-login-button mb-3">
                                <img src="/img/line_btn_base.png" alt="LINE"/>
                                <span class="gsi-material-button-contents">で続ける</span>
                            </a>
                            <p>または</p>
                            <a href="/authenticate/mail" class="btn btn-light ico-login-button mb-3 py-2">
                                <i class="fas fa-envelope me-3"></i>
                                <span>メールで続ける</span>
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

$(document).find('#register-form').on('submit', function(event) {
    event.preventDefault();
    const email = $('#register-email').val();
    const password = $('#register-password').val();

    $.ajax({
        url: '/user/register',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ email, password }),
        success: function(response) {
            localStorage.setItem('token', response.token);
            window.location.href = response.redirect;
        },
        error: function(xhr) {
            const res = xhr.responseJSON;
            Swal.fire({
            icon: 'error',
            title: 'エラー',
            text: res.error || '登録に失敗しました',
            });
        }
    });
});
function displayUserChatHistory(userChat) {

    const chatHistoryContainer = $('#chat-history');
    chatHistoryContainer.empty();

    if (userChat && userChat.length > 0) {
        // Create two separate cards for user and widget chat history
        const userChatCard = $('<div class="card rounded-0 shadow-0 bg-transparent"></div>');
        const widgetChatCard = $('<div class="card rounded-0 shadow-0 bg-transparent"></div>');

        // User chat history
        const userChatHeader = $('<div class="card-header"></div>');
        userChatHeader.text('チャット履歴');
        userChatCard.append(userChatHeader);

        const userChatListGroup = $('<ul class="list-group list-group-flush"></ul>');
        const userChats = userChat.filter(chat =>!chat.isWidget);
        userChats.forEach(chat => {
            const listItem = $(`<li class="list-group-item user-chat-history bg-transparent d-flex align-items-center justify-content-between" data-id="${chat.chatId}" data-chat="${chat._id}" data-user="${chat.userId}"></li>`);
            listItem.css('cursor', 'pointer');

            const small = $('<small class="text-secondary"></small>');
            small.append($('<i class="fas fa-clock me-1"></i>'));
            var chatUpdatedAt = new Date(chat.updatedAt);
            // Convert to Japanese localized date string
            var japaneseDateString = chatUpdatedAt.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
            });
            small.append(japaneseDateString);

            const dropdown = renderChatDropdown(chat)
            
            listItem.append(small);
            listItem.append(dropdown);
            userChatListGroup.append(listItem);
        });

        userChatCard.append(userChatListGroup);

        // Widget chat history
        const widgetChatHeader = $('<div class="card-header"></div>');
        widgetChatHeader.text('ウィジェットチャット履歴');
        widgetChatCard.append(widgetChatHeader);

        const widgetChatListGroup = $('<ul class="list-group list-group-flush"></ul>');
        const widgetChats = userChat.filter(chat => chat.isWidget);
        widgetChats.forEach(chat => {
            const listItem = $(`<li class="list-group-item user-chat-history bg-transparent d-flex align-items-center justify-content-between" data-id="${chat.chatId}" data-chat="${chat._id}" data-user="${chat.userId}"></li>`);
            listItem.css('cursor', 'pointer');

            const small = $('<small class="text-secondary"></small>');
            small.append($('<i class="fas fa-clock me-1"></i>'));
            small.append(chat.updatedAt);

            const dropdown = renderChatDropdown(chat)
            
            listItem.append(small);
            listItem.append(dropdown);
            widgetChatListGroup.append(listItem);
        });

        widgetChatCard.append(widgetChatListGroup);

        // Append both cards to the container
        chatHistoryContainer.append(userChatCard);
        chatHistoryContainer.append(widgetChatCard);

        enableToggleDropdown()
    }
}

function renderChatDropdown(chat) {
    const chatId = chat._id;
    const dropdownHtml = `
        <div class="d-inline-block align-items-center">
            <!-- Dropdown -->
            <div class="dropdown pe-2">
                <button class="btn border-0 shadow-0 dropdown-toggle ms-2" type="button" id="dropdownMenuButton_${chatId}" data-mdb-toggle="dropdown" aria-expanded="false">
                    <i class="fas fa-ellipsis-v text-secondary"></i>
                </button>
                <ul class="chat-option-menu dropdown-menu dropdown-menu-end" aria-labelledby="dropdownMenuButton_${chatId}">
                    <li>
                        <span data-id="${chatId}" class="dropdown-item text-danger delete-chat-history" style="cursor:pointer">
                            <i class="fas fa-trash me-2"></i>
                            <span class="text-muted" style="font-size:12px"></span>削除する</span>
                        </span>
                    </li>
                </ul>
            </div>
            <!-- End of Dropdown -->
        </div>
    `;

    return dropdownHtml 
}
window.claimDailyBonus = function(callback) {
    const today = new Date().toISOString().split('T')[0];

    if ($.cookie('dailyBonusClaimed') === today) {
        if (callback) callback(false);
        return;
    }

    $.ajax({
        url: '/user/daily-bonus-coins',
        type: 'POST',
        success: function(response) {
            if (response.success) {
                $.cookie('dailyBonusClaimed', today, { expires: 1 });
                showNotification('10 コインがデイリーボーナスとして追加されました！', 'success');
                if (callback) callback(true);
            } else {
                if (callback) callback(false);
            }
        },
        error: function(xhr, status, error) {
            if (callback) callback(false);
        }
    });
};


window.addCoinsToUser = function(coinsToAdd) {
    $.ajax({
        url: '/user/add-coins',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ coinsToAdd: coinsToAdd }),
        success: function(response) {
            if (response.success) {
                showNotification(`${coinsToAdd} コインが正常に追加されました！`, 'success');
            } else {
                showNotification(`${coinsToAdd} コインの追加に失敗しました: ${response.error}`, 'error');
            }
        },
        error: function(xhr, status, error) {
            showNotification(`エラーが発生しました: ${error}`, 'error');
        }
    });
};
window.updatePersona = function(personaId,isAdding,callback,callbackError){
    $.post('/api/user/personas', { personaId: personaId, action: isAdding ? 'add' : 'remove' }, function() {
        const message = isAdding ? 'ペルソナが追加されました' : 'ペルソナが削除されました';
        const status = 'success';
        showNotification(message, status);
        if(typeof callback =='function'){
            callback()
        }
    }).fail(function(jqXHR) {
        const message = jqXHR.responseJSON && jqXHR.responseJSON.error 
            ? jqXHR.responseJSON.error 
            : (isAdding ? 'ペルソナの追加に失敗しました' : 'ペルソナの削除に失敗しました');
        const status = 'error';
        showNotification(message, status);
        if(typeof callbackError =='function'){
            callbackError()
        }
    });
}
window.getUserChatHistory = async function(chatId, userId) {
    try {
        const response = await $.ajax({
            url: `/api/chat-history/${chatId}`,
            type: 'POST',
            data: JSON.stringify({ userId: userId }),
            contentType: 'application/json',
            dataType: 'json'
        });
        displayUserChatHistory(response);
        const lastChat = response.find(chat => !chat.isWidget);
        if (lastChat) {
            const userChatId = lastChat._id;
            localStorage.setItem('userChatId', userChatId);
            return lastChat;
        }
    } catch (error) {
        console.error('Error fetching user chat history:', error);
    }
    return null;
}
window.renderChatList = function(userId,chatId) {

    if($(document).find('#chat-list').length == 0 || $('#chat-widget-container').length > 0){
        return
    }

    $.ajax({
        type: 'GET',
        url: '/api/chat-list/'+userId, // replace with your API endpoint
        success: function(data) {
            data.sort(function(a, b) {
                if (!chatId) return 0; // No sorting if chatId is undefined
                return (b._id === chatId) - (a._id === chatId);
            });            
            var chatListHtml = '';
            $('#user-chat-count').html(`(${data.length})`)
            $.each(data, function(index, chat) {
                chatListHtml += `
                    <div class="${chatId && chat._id === chatId ? 'active' : ''} chat-list item user-chat d-flex align-items-center justify-content-between p-1 mx-2 rounded bg-transparent" 
                    data-id="${chat._id}" data-userid="${chat.userId}" >
                    <div class="d-flex align-items-center w-100">
                        <div class="user-chat-content" style="flex: 1;display: flex;align-items: center;">
                            <div class="thumb align-items-center text-center justify-content-center d-flex flex-column col-3 p-1" >
                                <img class="img-fluid" src="${chat.thumbnailUrl || chat.chatImageUrl || '/img/logo.webp'}" alt="">
                            </div>
                            <div class="chat-list-details ps-2">
                            <div class="chat-list-info">
                                <div class="chat-list-title">
                                <h6 class="mb-0 online-text" style="font-size: 14px;">${chat.name}</h6>
                                <span class="text-muted one-line ${chat.lastMessage ? '':'d-none' }" style="font-size:11px;">${chat.lastMessage ? chat.lastMessage.content :'d-none' }</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex align-items-center">
                        <!-- Dropdown -->
                        <div class="dropdown pe-2">
                            <button class="btn border-0 shadow-0 dropdown-toggle ms-2 " type="button" id="dropdownMenuButton_${chat._id}" data-mdb-toggle="dropdown" aria-expanded="false">
                                <i class="fas fa-ellipsis-v text-secondary"></i>
                            </button>
                        <ul class="dropdown-menu dropdown-menu-end chat-option-menu bg-light shadow rounded mx-3" aria-labelledby="dropdownMenuButton_${chat._id}">
                            <li>
                                <button class="dropdown-item text-secondary chart-button" data-id="${chat._id}">
                                    <i class="fas fa-info-circle me-2"></i>
                                    <span class="text-muted" style="font-size:12px"></span>情報</span>
                                </button>
                            </li>
                            <li>
                                <button class="dropdown-item text-secondary tag-button" data-id="${chat._id}">
                                    <i class="fas fa-share me-2"></i> 
                                    <span class="text-muted" style="font-size:12px"></span>共有する</span>
                                </button>
                            </li>
                            <li>
                                <a href="/chat/edit/${chat._id}" class="dropdown-item text-secondary">
                                    <i class="far fa-edit me-2"></i> 
                                    <span class="text-muted" style="font-size:12px"></span>編集する</span>
                                </a>
                            </li>
                            <li>
                                <button class="dropdown-item text-secondary history-chat" data-id="${chat._id}" data-user="${userId}">
                                    <i class="fas fa-history me-2"></i>
                                    <span class="text-muted" style="font-size:12px"></span>チャット履歴</span>
                                </button>
                            </li>
                            <li>
                                <button class="dropdown-item text-secondary reset-chat" data-id="${chat._id}">
                                <i class="fas fa-plus-square me-2"></i>
                                    <span class="text-muted" style="font-size:12px"></span>新しいチャット</span>
                                </button>
                            </li>
                            <li>
                                <span data-id="${chat._id}" class="dropdown-item text-danger delete-chat" style="cursor:pointer">
                                    <i class="fas fa-trash me-2"></i> 
                                    <span class="text-muted" style="font-size:12px"></span>削除する</span>
                                </span>
                            </li>
                        </ul>
                        </div>
                        <!-- End of Dropdown -->
                    </div>
                    </div>
                </div>
                `;
            });
            $('#chat-list').html($(chatListHtml).hide().fadeIn());
            enableToggleDropdown();
        }
    });
}
window.updateCoins = function(userCoins = null) {
        let API_URL = localStorage.getItem('API_URL')
        $.ajax({
            url: API_URL+'/api/user',
            method: 'GET',
            success: function(response) {
                const userCoins = response.user.coins;
                $('.user-coins').each(function(){$(this).html(userCoins)})
            }
        });
        return
    
    $('.user-coins').each(function(){$(this).html(userCoins)})
}
window.resetChatUrl = function() {
    var currentUrl = window.location.href;
    var urlParts = currentUrl.split('/');
    urlParts[urlParts.length - 1] = '';
    var newUrl = urlParts.join('/');
    if($('#chat-widget-container').length == 0){
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }
}
window.showDiscovery = function() {
    $('.onchat-on').hide()
    $('.onchat-on').addClass('d-none').css({
        'opacity': 0,
        'pointer-events': 'none',
        'visibility': 'hidden'
    });    
    $('.onchat-off').show()
    $('.onchat-off').removeClass('d-none').css({
        'opacity': '',
        'pointer-events': '',
        'visibility': ''
    }); 
    resetChatUrl();
    window.postMessage('resizeIframe', '*');
}
window.showChat = function() {
    $('.onchat-off').hide()
    $('.onchat-off').addClass('d-none').css({
        'opacity': 0,
        'pointer-events': 'none',
        'visibility': 'hidden'
    });    
    $('.onchat-on').show()
    $('.onchat-on').removeClass('d-none').css({
        'opacity': '',
        'pointer-events': '',
        'visibility': ''
    }); 
}
