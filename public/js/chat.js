const audioCache = new Map();
const audioPool = [];

let language = localStorage.getItem('currentLang') || 'ja';
$('#language').val(language == 'en' ? 'english' : 'japanese')

$(document).ready(async function() {
    let autoPlay = localStorage.getItem('audioAutoPlay') === 'true';
    $('#audio-icon').addClass(autoPlay ? 'fa-volume-up' : 'fa-volume-mute');
    $('#audio-play').click(function() {
        autoPlay = !autoPlay;
        localStorage.setItem('audioAutoPlay', autoPlay);
        $('#audio-icon').toggleClass('fa-volume-up fa-volume-mute');
    });
    const { API_URL, MODE } = await window.setApiUrlAndMode();
    const user = await fetchUser();

    let chatId = getIdFromUrl(window.location.href) || getIdFromUrl($.cookie('redirect_url'))||$(`#lamix-chat-widget`).data('id');
    let userChatId
    const userId = user._id
    let persona
    let currentStep = 0;
    let totalSteps = 0;
    let chatData = {};
    let character = {}
    let isNew = true;
    let feedback = false
    let thumbnail = false
    let isTemporary = !!user.isTemporary

    $('body').attr('data-temporary-user',isTemporary)

    displayChatList(null,userId);
    window.addEventListener('message', function(event) {
        if (event.data.event === 'displayMessage') {
            const { role, message, completion, image, messageId } = event.data
            displayMessage(role, message, function() {
                addMessageToChat(chatId, userChatId, role, message, function(error, res) {
                    if (error) {
                        console.error('Error adding message:', error);
                    } else {
                        if(completion){
                            generateCompletion();
                        }
                        if(image && messageId){
                            const loaderElement = $(`
                                <div id="${messageId}" class="d-flex flex-row justify-content-start mb-4 message-container assistant animate__animated animate__fadeIn">
                                    <img src="${thumbnail || '/img/default-avatar.png'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="width: 45px; height: 45px; object-fit: cover; object-position: top;">
                                    <div class="load d-flex justify-content-center align-items-center px-3">
                                        <img src="/img/image-placeholder.gif" width="50px" alt="loading">
                                    </div>
                                </div>
                            `);
                            $('#chatContainer').append(loaderElement);
                        }
                    }
                });
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'addMessageToChat') {
            const message = event.data.message
            const role = event.data.role || 'user'
            const completion = event.data.completion
            if(!message)return
            addMessageToChat(chatId, userChatId, role, message,function(){
                if(completion){
                    generateCompletion()
                }
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageFav') {
            const description = event.data.description
            if(!description)return
            let message = `I liked one of your picture. Provide a short answer to thank me. Respond in ${language}.`
            addMessageToChat(chatId, userChatId, 'user', message, function(){
                generateCompletion()
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageStart') {
            const message = event.data.message
            addMessageToChat(chatId, userChatId, 'user', message,function(){
                generateCompletion(null,true)
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageDone') {
            const prompt = event.data.prompt
            let message = `I received an image from you. Ask me what I think of it. \n Respond in ${language} with the shortest answer possible.`
            addMessageToChat(chatId, userChatId, 'user', message,function(){
                generateCompletion()
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageError') {
            const error = event?.data?.error || ''
            let message = `There way an error. The image could not be generated ${error}.`
            addMessageToChat(chatId, userChatId, 'user', message,function(){
                generateCompletion()
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageNsfw') {
            let message = `Tell me that I can unlock more personal and attractive images if I subscribe to the premium plan which is 300 JPY per month if I pay yearly. is not that cheap ?! It is to celebrate the lauching of this app, ラミックス ! Plus I get 1000 coins to enjoy plenty of pictures of you. \n Provide a new message every time.`
            addMessageToChat(chatId, userChatId, 'user', message,function(){
                generateCompletion(function(){
                    const message = `
                    <div class="card bg-transparent text-white border-0">
                        <div class="card-body-none" style="height:auto !important;">
                            <button class="btn custom-gradient-bg shadow-0 w-100" 
                                onclick="window.location.href='/my-plan'">
                                <span>プレミアムプランを確認</span>
                            </button>
                        </div>
                    </div>`
                ;
                displayMessage('assistant', message);

                })
            });
        }
    });
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
        const lastUserChat = await getUserChatHistory(fetch_chatId);

        fetch_chatId = lastUserChat ?.chatId || fetch_chatId
        const newUserChatId = lastUserChat ?._id || userChatId;
        userChatId = newUserChatId

        if (fetch_reset) {
            currentStep = 0;
        }
    
        count_proposal = 0;
        
        $('#chatContainer').empty();
        $('#startButtonContained').remove();
        $('#chat-recommend').empty();
        
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
        if(userChatId == $(this).data('chat')){
            return
        }
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
                    userChatId = response.userChatId
                    chatId = response.chatId
                    if(currentStep < totalSteps){
                        displayStep(chatData, currentStep);
                        isNew = false
                    }else{
                        generateCompletion()
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
    
    async function handleChatSuccess(data, fetch_reset, fetch_userId) {
        const chatId = data.chat._id;
        $(document).find(`.chat-list.item[data-id="${chatId}"]`).addClass('active').siblings().removeClass('active');

        isNew = fetch_reset || data.isNew;

        if (!data.chat) {
            showDiscovery();
            return;
        }
    
        setupChatData(data.chat);
        setupChatInterface(data.chat, data.character);
        updateCurrentChat(chatId);

        if (!isNew) {
            displayExistingChat(data.userChat, data.character);
        } else if (data.chat.content && data.chat.content.length > 0) {
            displayStep(data.chat.content, currentStep);
        } else {
            displayInitialChatInterface(data.chat);
        }
    
        if (data.chat.galleries && data.chat.galleries.length > 0) {
            displayGalleries(thumbnail, data.chat.galleries, data.chat.blurred_galleries, chatId, fetch_userId);
        }else{
            $('#galleries-open').hide();
        }
    
        const {imageDescription} = await checkImageDescription(chatId);

        if (!imageDescription) {
            //console.log('Image description was not founded. Generating a new one ...')
            //generateImageDescriptionBackend(thumbnail, chatId);
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
        if(user.lang == 'ja'){
            $('#userMessage').attr('placeholder', `${chatName}${window.translations.sendMessageTo}`);
        }else{
            $('#userMessage').attr('placeholder', `${window.translations.sendMessageTo}${chatName}`);
        }
        const albumLink = $(`<a href="/character/${chat._id}"></a>`)
        albumLink.attr('data-bs-toggle', 'tooltip');
        albumLink.attr('title', `${window.translations.album || 'アルバム'}`);
        albumLink.addClass('btn btn-light shadow-0 border')
        albumLink.append('<i class="bi bi-images"></i>')
        new bootstrap.Tooltip(albumLink[0]);
        $('#chat-recommend').append(albumLink)
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
        }

        if($('#chat-widget-container').length == 0 && isTemporary){
            displayMessage('assistant',`<a class="btn btn-secondary custom-gradient-bg shadow-0 m-2 px-4 py-2" style="border-radius: 50px;" href="/authenticate"><i class="fas fa-sign-in-alt me-2"></i> ログイン</a>`)
        }
    }
    
    function displayInitialChatInterface(chat) {
        displayStarter(chat);
    }
    
    function displayGalleries(thumbnail, galleries, blurred_galleries, chatId, fetch_userId) {
        const isLocalMode = MODE === 'local';
    
        $('#galleries-open').show();
    
        const createAlbum = (gallery, index) => ({
            chatId,
            userId: fetch_userId,
            name: gallery.name,
            price: gallery.price,
            description: gallery.description,
            blurredImages: [gallery.images[0], ...blurred_galleries[index].images],
            images: gallery.images,
        });
    
        galleries.forEach((gallery, index) => {
            if (gallery.images && gallery.images.length > 0) {
                const album = createAlbum(gallery, index);
                displayAlbumThumb(thumbnail, album);
            }
        });
    
        $('#galleries-open').on('click', function () {
            let galleryThumbnails = '';
    
            galleries.forEach((gallery, index) => {
                const album = createAlbum(gallery, index);
    
                galleryThumbnails += `
                    <div class="col-3 col-sm-4 col-lg-2">
                        <div data-index="${index}" style="background-image:url(${album.images[0]}); border-radius: 5px !important;border:1px solid white; cursor:pointer;" 
                                id="open-album-${album.chatId}-${index}" class="card-img-top rounded-avatar position-relative m-auto shadow" alt="${album.name}">
                        </div>
                        <span style="font-size: 12px;color: #fff;">${album.name}</span>
                        <span class="text-muted" style="font-size: 12px;">(${album.images.length}枚)</span>
                    </div>`;
                
            });
    
            Swal.fire({
                html: `
                    <div style="top: 0;left: 0;right: 0;border-radius: 40px 40px 0 0;background: linear-gradient(to top, rgba(0, 0, 0, 0), rgba(46, 44, 72, 0.91) 45%);" class="sticky-top pt-3">
                        <h5 class="mb-0 text-white">${chatName}のアルバム</h5>
                    </div>
                    <div class="row no-gutters pt-3 ps-3 mx-0">
                        ${galleryThumbnails}
                    </div>`,
                showClass: { popup: 'animate__animated animate__slideInUp' },
                hideClass: { popup: 'animate__animated animate__slideOutDown' },
                position: 'bottom',
                backdrop: 'rgba(43, 43, 43, 0.2)',
                showCloseButton: true,
                showConfirmButton: false,
                customClass: { 
                    container: 'p-0', 
                    popup: 'album-popup shadow', 
                    htmlContainer:'position-relative', 
                    closeButton: 'position-absolute me-3' 
                },
                didOpen: () => {
                    galleries.forEach((gallery, index) => {
                        const album = createAlbum(gallery, index);
                        $(`#open-album-${album.chatId}-${index}`).on('click', function () {
                            displayAlbum(album);
                        });
                    });
                }
            });
        });
    }
    
    
    function displayAlbumThumb(thumbnail, album){
        var card = $(`
            <div class="card custom-card bg-transparent shadow-0 border-0 px-1 mx-1" style="cursor:pointer;">
                <div style="background-image:url(${album.images[0]});border:4px solid white;" class="card-img-top rounded-avatar position-relative m-auto shadow" alt="${album.name}">
                </div>
            </div>
        `);
        card.on('click', function() {
            displayAlbum(album)
        });
        $('#chat-recommend').append(card);
    }    
    function displayImagesThumb(){
        const images = $('.assistant-image-box img').map(function() {
            return $(this).attr('src');
        }).get();

        images.forEach(imageUrl => {
            displayImageThumb(imageUrl)
        });
    }
    function displayImageThumb(imageUrl){
        var card = $(`
            <div class="assistant-image-box card custom-card bg-transparent shadow-0 border-0 px-1 mx-1 col-auto" style="cursor:pointer;" data-src="${imageUrl}">
                <div style="background-image:url(${imageUrl});border:4px solid white;" class="card-img-top rounded-avatar position-relative m-auto">
                </div>
            </div>
        `);
        $('#chat-recommend').append(card);
    }

        async function displayAlbum(album) {
            try {
        
                const images = subscriptionStatus ? album.images : album.blurredImages;

                let imagesHTML = images.map((url, index) => `<img src="${album.images[0]}" class="img-fluid rounded shadow m-1" style="width:auto;height: auto;object-fit:contain;" data-index="${index}">`).join('');
            
                Swal.fire({
                    html: `
                        <div>
                            <div style="top: 0;left: 0;right: 0;border-radius: 40px 40px 0 0;background: linear-gradient(to top, rgba(0, 0, 0, 0), rgba(46, 44, 72, 0.91) 45%);" class="sticky-top pt-3">
                                <h5 class="mb-0 text-white">${album.name} (${album.images.length}枚)</h5>
                            </div>
                            <p style="color: white;font-size: 12px;" class="p-4">${album.description}</p>
                            <div class="text-start">
                                <span type="button" id="toggle-grid-${album.chatId}" class="btn btn-light mx-3"><i class="fas fa-th-large"></i></span>
                            </div>
                            <div id="album-container" class="position-relative text-white pt-2 px-3 w-100" style="min-height:200px;overflow: hidden;">
                                <div class="images" data-id="${album.chatId}">
                                    <div class="row wrapper">
                                        ${images.map((url, index) => `
                                            <div class="slide col-3">
                                                <img src="${url}" class="img-fluid rounded shadow m-1" style="width:auto;max-height:400pxobject-fit:contain;" data-index="${index}">
                                            </div>`).join('')}
                                    </div>
                                </div>
                            </div>
                            ${!subscriptionStatus && !isTemporary ? `
                                <div style="bottom: 20px;z-index: 100;" class="mx-auto mt-4 position-fixed w-100">
                                    <a href="/my-plan" class="btn btn-lg custom-gradient-bg" style="border-radius:50px;"><i class="far fa-images me-2"></i>プレミアムに登録する</a>
                                    <a href="/my-plan" class="d-block mt-1 text-white">Lamixプレミアムなら見放題</a>
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
                    customClass: { container: 'p-0', popup: 'album-popup h-90vh shadow', htmlContainer:'position-relative', closeButton: 'position-absolute  me-3' }
                });

                const colSizes = [ 2, 3, 6, 12]; // Allowed col sizes

                // Toggle and save to localStorage
                $(document).on('click', `#toggle-grid-${album.chatId}`, function(){
                    const container = $(document).find(`.images[data-id="${album.chatId}"]`);
                    const currentClass = container.find('.slide').first().attr('class').match(/col-\d+/)[0];
                    const currentCol = parseInt(currentClass.split('-')[1]);
                    let nextIndex = colSizes.indexOf(currentCol) + 1;
                    if (nextIndex >= colSizes.length) nextIndex = 0; // Loop back to the first column size
                
                    const nextCol = colSizes[nextIndex];
                
                    container.find('.slide').each(function(){
                        $(this).removeClass(currentClass).addClass(`col-${nextCol}`);
                    });
                
                    // Save user preference in localStorage
                    localStorage.setItem(`gridPreference`, nextCol);
                });

                // Initialize on page load based on saved preference
                const savedCol = localStorage.getItem(`gridPreference`) || 3; // Default to col-3
                const container = $(document).find(`.images[data-id="${album.chatId}"]`);
                container.find('.slide').each(function(){
                    $(this).removeClass().addClass(`col-${savedCol} slide`); // Initialize with saved col class
                });

            } catch (error) {
                console.error('Error displaying album:', error);
            }
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

        if(isTemporary){return callback()}

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
                    <img src="${user.profileUrl ? user.profileUrl: '/img/avatar.png'}" class="rounded-circle" style="width: 80px; height: 80px; cursor: pointer;object-fit: cover;object-position: top;">
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
                        <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;cursor:pointer;">
                        <div class="audio-controller" style="display:none">
                            <button id="play-${uniqueId}" class="audio-content badge bg-dark">►</button>
                        </div>
                        <div id="completion-${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box">
                            <img src="/img/load-dot.gif" width="50px">
                        </div>
                    </div>
                    <div id="response-${uniqueId}" class="choice-container" ></div>
                </div>`);
        }
        let currentDate = new Date();
        let currentTimeInJapanese = `${currentDate.getHours()}時${currentDate.getMinutes()}分`;
        
        let message = null
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
                updateCurrentChat(chatId,userId);
                //$(`#starter-${uniqueId}`).remove()
                
                generateCompletion(function(){
                    $('.auto-gen').each(function(){$(this).show()})
                    $('#audio-play').show();
                    $('#progress-container').show();
                    $('#input-container').show().addClass('d-flex');
                    if($('#chat-widget-container').length == 0 && isTemporary){
                        displayMessage('assistant',`<a class="btn btn-secondary custom-gradient-bg shadow-0 m-2 px-4 py-2" style="border-radius: 50px;" href="/authenticate"><i class="fas fa-sign-in-alt me-2"></i> ${window.translations.login}</a>`)
                    }                
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
                const isStarter = chatMessage?.content?.startsWith("[Starter]") || chatMessage?.content?.startsWith("Invent a situation") || chatMessage?.content?.startsWith("Here is your character description");
                const isHidden = chatMessage?.content?.startsWith("[Hidden]") || chatMessage?.name === 'master';
                if (!isStarter && !isHidden) {
                    messageHtml = `
                        <div class="d-flex flex-row justify-content-end mb-4 message-container">
                            <div class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfbdb;">
                                ${marked.parse(chatMessage.content)}
                            </div>
                            ${persona ? `<img src="${persona.chatImageUrl || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">` : ''}
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
                    const isHidden = chatMessage.content.startsWith("[Hidden]") || chatMessage.name === 'master';
                    if (chatMessage.content && !isHidden) {
                        let message = removeContentBetweenStars(chatMessage.content);
                        messageHtml = `
                            <div id="container-${designStep}">
                                <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
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
        displayImagesThumb();
        $('#chatContainer').animate({
            scrollTop: $('#chatContainer').prop("scrollHeight")
        }, 500);
    }
  
    function sanitizeString(inputString) {
        var wordsToRemove = ["latex","topless","abortion","adultery","assault","bestiality","bisexuality","incest","pedophilia","rape","sadism","suicide","transphobia", "violence",'sexy', 'masturbation','nsfw', 'nude', 'sexy', 'erotic', 'naughty', 'body', 'breast','breasts','nipple','nipples', 'boobs', 'curvy', 'uncensored']; // Add words to remove
        wordsToRemove.forEach(function(word) {
            var regex = new RegExp('\\b' + word + '\\b', 'g');
            inputString = inputString.replace(regex, '');
        });
        inputString.replace(/\s+/g, ' ').trim();  
        if (inputString.includes(",,,")){
            return inputString.split(",,,")[1].trim();
        }
        
        return inputString;
    }
    
    function getImageTools(imageId, isLiked = false, description = false){
        description = sanitizeString(description);
        return `
            <div class="bg-white py-2 rounded mt-1 d-flex justify-content-between">
                <span class="badge bg-white text-secondary image-fav ${isLiked ? 'liked':''}" data-description="${description}" data-id="${imageId}" 
                style="cursor: pointer;bottom:5px;right:5px;opacity:0.8;">
                <i class="bi bi-heart-fill"></i>
                </span>
                <span class="badge bg-white text-secondary comment-badge" data-id="${imageId}" 
                style="cursor: pointer;bottom:5px;right:5px;opacity:0.8;">
                <i class="bi bi-share"></i>
                </span>
            </div>
        `
    }
    
    function getImageUrlById(imageId, designStep, thumbnail) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/image/${imageId}`,
                method: 'GET',
                success: function(response) {
                    let isBlur = response.isBlur
                    if (response.imageUrl) {
                        const isLiked = response?.likedBy?.some(id => id.toString() === userId.toString());
                        const messageHtml = `
                        <div id="container-${designStep}">
                            <div class="d-flex flex-row justify-content-start mb-4 message-container ${isBlur ? 'unlock-nsfw':''}">
                                <img src="${thumbnail || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;">
                                <div class="ms-3 position-relative">
                                    <div class="ps-3 text-start assistant-image-box">
                                        <img id="image-${imageId}" data-id="${imageId}" src="${response.imageUrl}" alt="${response.imagePrompt}">
                                    </div>
                                    ${!isBlur ? getImageTools(imageId,isLiked,response.imagePrompt) :''}
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
    
    $(document).on('click','.comment-badge', function (e) {
        e.stopPropagation()
        e.preventDefault()
        const imageId = $(this).attr('data-id')
        Swal.fire({
          html: `
          <div class="container mt-4">
            <form id="commentForm" class="form-group">
                <div class="mb-3">
                <label for="comment" class="form-label text-white">投稿を作成する</label>
                <textarea id="comment" class="form-control" rows="4" placeholder="ここにコメントを追加してください..." required></textarea>
                </div>
            </form>
          </div>
        `,        
          confirmButtonText: '投稿',
          showCancelButton: false,
          showCloseButton: true,
          width:"100%",
          position: 'bottom',
          backdrop: 'rgba(43, 43, 43, 0.2)',
          showClass: {
            popup: 'album-popup animate__animated animate__slideInUp'
          },
          hideClass: {
            popup: 'album-popup animate__animated animate__slideOutDown'
          },
          customClass: { 
              container: 'p-0', 
              popup: 'album-popup shadow', 
              htmlContainer:'position-relative', 
              closeButton: 'position-absolute me-3' 
          },
          preConfirm: () => {
            const comment = document.getElementById('comment').value;
            if (!comment) {
              Swal.showValidationMessage('コメントを入力してください');
              return false;
            }
            return comment;
          }
        }).then((result) => {
          if (result.isConfirmed) {

            $.ajax({
              url: `/posts`, 
              method: 'POST',
              data: JSON.stringify({ imageId, comment: result.value }),
              contentType: 'application/json',
              success: function (response) {
                showNotification('コメントが投稿されました', 'success');
              },
              error: function () {
                showNotification('コメントの投稿に失敗しました', 'error');
              }
            });

          }
        });
      });
    
    
    $(document).on('click','.unlock-nsfw',function(){
        showUpgradePopup('unlock-nsfw');
    })
    function displayStep(chatData, currentStep) {
        const step = chatData[currentStep];
        $('#chatContainer').append(`
        <div id="container-${currentStep}">
            <div class="d-flex flex-row justify-content-start mb-4 message-container" style="opacity:0;">
                <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
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
                    <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
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
            generateCompletion()
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

    /*
    $(document).on('click', '.message-container', function(event) {
        event.stopPropagation();
        
        const $el = $(this).find('.audio-content');
        const message = $el.attr('data-content');
        
        if (!message) {
            return;
        }
        
        stopAllAudios();
        
        (function() {
            const duration = $el.attr('data-audio-duration');
            if (duration) {
                $el.html('► ' + Math.round(duration) + '"');
            }
        })();
        
        initAudio($el, message);
    });
    */
    
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
        // Mute all other audios
        audioPool.forEach(a => {
            if (a !== audio) {
                a.muted = true;
            }
        });
    
        if (audio.src !== audioUrl) audio.src = audioUrl;
    
        audio.muted = false;
        audio.play();
    
        audio.onloadedmetadata = () => 
            $el.attr('data-audio-duration', audio.duration).html(`❚❚ ${Math.round(audio.duration)}"`);
    
        audio.onended = () => 
            $el.html(`► ${Math.round(audio.duration)}"`);
    
        $el.off('click').on('click', (event) => {
            event.stopPropagation();
        
            const message = $el.attr('data-content');
            const audioDuration = $el.attr('data-audio-duration');
            const cachedUrl = audioCache.get(message);
            let currentAudio = audioPool.find(a => a.src === cachedUrl) || getAvailableAudio();
        
            // Mute all other audios
            audioPool.forEach(a => {
                if (a !== currentAudio) {
                    a.muted = true;
                }
            });
        
            if (currentAudio.src !== cachedUrl) {
                currentAudio.src = cachedUrl;
            }
        
            if (currentAudio.paused) {
                currentAudio.muted = false;
                currentAudio.play();
                $el.html(`❚❚ ${Math.round(audioDuration)}"`);
            } else {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio.muted = true;
                $el.html(`► ${Math.round(audioDuration)}"`);
            }
        });
    }
    
    
    
    function removeContentBetweenStars(str) {
        if (!str) { return str; }
        return str.replace(/\*.*?\*/g, '').replace(/"/g, '');
    }                    
    function generateCompletion(callback,isHidden=false){
        
        const apiUrl = API_URL+'/api/openai-chat-completion';

        hideOtherChoice(false, currentStep)
        // Initialize the bot response container
        const animationClass = 'animate__animated animate__slideInUp';
        const uniqueId = `${currentStep}-${Date.now()}`;
        const botResponseContainer = $(`
            <div id="container-${uniqueId}">
                <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                    <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;cursor:pointer;">
                    <div class="audio-controller" style="display:none">
                        <button id="play-${uniqueId}" class="audio-content badge bg-dark">►</button>
                    </div>
                    <div id="completion-${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box">
                        <img src="/img/load-dot.gif" width="50px">
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
            data: JSON.stringify({ userId, chatId, userChatId, isHidden }),
            success: function(response) {
                const sessionId = response.sessionId;
                const streamUrl = API_URL+`/api/openai-chat-completion-stream/${sessionId}`;
                const eventSource = new EventSource(streamUrl);
                let markdownContent = "";

                eventSource.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    if (data.type === 'text') {
                        markdownContent += data.content;
                        $(`#completion-${uniqueId}`).html(marked.parse(markdownContent));
                    } else if (data.type === 'trigger') {
                        handleTrigger(data);
                    }
                };

                eventSource.onerror = function(error) {
                    eventSource.close();
                    let message = removeContentBetweenStars(markdownContent)
                    if(language != 'english'){
                        $(`#play-${uniqueId}`).attr('data-content',message)
                        $(`#play-${uniqueId}`).closest('.audio-controller').show()
                        if(autoPlay){
                            //initAudio($(`#play-${uniqueId}`), message);
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
                    <img src="/img/load-dot.gif" width="50px">
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
    const handleTrigger = (data) => {
        switch (data.name) {
            case 'image_request':
                imageRequest(data.command);
                break;
            default:
                console.warn(`Unhandled trigger command: ${data.name}`);
        }
    };
  
    window.displayMessage = function(sender, message, callback) {
        const messageClass = sender === 'user' ? 'user-message' : sender;
        const animationClass = 'animate__animated animate__slideInUp';
        let messageElement;
    
        if (messageClass === 'user-message') {
            if (typeof message === 'string' && message.trim() !== '') {
                message = message.replace('[Hidden]','').replace('[user] ','')
                messageElement = $(`
                    <div class="d-flex flex-row justify-content-end mb-4 message-container ${messageClass} ${animationClass}">
                        <div class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfbdb;">
                            <span>${message}</span>
                        </div>
                        ${persona ? `<img src="${persona.chatImageUrl || '/img/logo.webp'}" alt="avatar" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">` : ''}
                    </div>
                `).hide();
                $('#chatContainer').append(messageElement);
                messageElement.addClass(animationClass).fadeIn();
            }
        } 
    
        else if (messageClass === 'bot-image' && message instanceof HTMLElement) {
            const imageId = message.getAttribute('data-id');
            const description = message.getAttribute('alt');
            const imageUrl = message.getAttribute('src');
            messageElement = $(`
                <div class="d-flex flex-row justify-content-start mb-4 message-container ${messageClass} ${animationClass}">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">
                    <div class="ms-3 position-relative">
                        <div class="text-start assistant-image-box">
                            ${message.outerHTML}
                        </div>
                        ${getImageTools(imageId,false,description)}
                    </div>
                </div>      
            `).hide();
            $('#chatContainer').append(messageElement);
            messageElement.addClass(animationClass).fadeIn();
            displayImageThumb(imageUrl)
        } 

        else if (messageClass.startsWith('new-image-') && message instanceof HTMLElement) {
            const imageId = message.getAttribute('data-id');
            const description = message.getAttribute('alt');
            const imageUrl = message.getAttribute('src');
            const messageId = messageClass.split('new-image-')[1]
            messageElement = $(`
                    <div class="ms-3 position-relative">
                        <div class="text-start assistant-image-box">
                            ${message.outerHTML}
                        </div>
                        ${getImageTools(imageId,false,description)}
                    </div>  
            `).hide();
            $(`#${messageId}`).find('.load').remove()
            $(`#${messageId}`).append(messageElement);
            messageElement.addClass(animationClass).fadeIn();
            displayImageThumb(imageUrl)
        } 
    
        else if (messageClass === 'bot-image-nsfw'&& message instanceof HTMLElement) {
            messageElement = $(`
                <div class="d-flex flex-row justify-content-start mb-4 message-container ${messageClass} ${animationClass} unlock-nsfw" style="position: relative;">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">
                    <div class="ms-3 position-relative">
                        <div class="text-start assistant-image-box">
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
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top; cursor:pointer;">
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
    
    function initiatePurchase(itemId, itemName, itemPrice, userId, chatId, callback) {
        $.ajax({
            url: '/api/purchaseItem',
            method: 'POST',
            data: { itemId, itemName, itemPrice, userId, chatId },
            success: function(response) {
                callback(response);
            },
            error: function(xhr, status, error) {
                console.error('Error during purchase request:', error);
                callback({ success: false, error: error });
            }
        });
    }
    async function saveImageRequest(command, userId, chatId) {

        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/purchaseImage',
                method: 'POST',
                data: { command: JSON.stringify(command), userId, chatId },
                success: function(response) {
                    resolve(response);
                },
                error: function(response) {
                    console.error('Error during purchase request:', response);
                    reject({ success: false, error: response });
                }
            });
        });
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
    
    //handleImageGeneration('#novita-gen-button', generateImageNovita);
    $('#novita-gen-button').on('click',function(){
        //displayAdvancedImageGenerationForm(API_URL, userId, chatId, userChatId, thumbnail)
        displayCustomPromptInput(API_URL, userId, chatId, userChatId, thumbnail)
    })

    function showPopupWithSwiper(callback) {
        Swal.fire({
            html: `
                <div class="swiper-container">
                    <div class="swiper-wrapper">
                        <div class="swiper-slide">
                            <img src="/img/coins-slide-1.png" alt="Image 1" style="width: 100%;">
                        </div>
                        <div class="swiper-slide">
                            <img src="/img/coins-slide-2.png" alt="Image 2" style="width: 100%;">
                        </div>
                        <div class="swiper-slide">
                            <img src="/img/coins-slide-3.png" alt="Image 3" style="width: 100%;">
                        </div>
                    </div>
                </div>
                <div style="bottom: -50px;left:0;right:0;z-index: 100;" class="mx-auto position-absolute w-100">
                    <button id="closeButton" class="btn btn-lg custom-gradient-bg text-white fw-bold" style="border-radius:50px;">チャットしましょう</button>
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
                if (callback) callback();
            }
        });
    }  

   // Function to get prompts data
   function getPromptsData(callback) {
        var promptsData = sessionStorage.getItem('promptsData');
        if (promptsData) {
            // Data is in session storage
            var prompts = JSON.parse(promptsData);
            if (typeof callback === 'function') {
                callback(prompts);
            }
        } else {
            // Fetch data from server and save to session storage
            $.ajax({
                url: '/api/prompts',
                type: 'GET',
                success: function(prompts) {
                    sessionStorage.setItem('promptsData', JSON.stringify(prompts));
                    if (typeof callback === 'function') {
                        callback(prompts);
                    }
                },
                error: function(xhr) {
                    console.error('Error fetching prompts data on page load.');
                }
            });
        }
    }

    // On page load, ensure prompts data is loaded
    getPromptsData()
    // Check if the tooltip has already been shown in the session
    if (!sessionStorage.getItem('tooltipShown')) {
        $('#userMessage').one('input', function() {
            // Show tooltip
            $('#showPrompts').tooltip('show');
            
            // Set sessionStorage flag to ensure it's only shown once
            sessionStorage.setItem('tooltipShown', 'true');
            
            // Hide tooltip after 3 seconds
            setTimeout(function() {
                $('#showPrompts').tooltip('hide');
            }, 3000); // Hide after 3 seconds
        });
    }

    // Click handler for #showPrompts
    $(document).on('click','#showPrompts', function() {
        getPromptsData(function(prompts) {
            const header = `<p style="font-size:16px;" class="px-3 text-start my-3  pb-0">${window.translations.select_pose_for_image_generation}</p>`;
            renderPopup(prompts, header);
        });
    });

    function renderPopup(prompts, header) {
        const nsfwEnabled = sessionStorage.getItem('nsfwEnabled') === 'true';
        renderSwalPopup(header, prompts, nsfwEnabled);
    }

    function renderSwalPopup(header, prompts, nsfwEnabled) {
        const switchType = `<div class="form-check text-start my-3 ps-3">
            <input type="checkbox" class="btn-check" id="nsfwCheckbox" autocomplete="off" ${nsfwEnabled ? 'checked' : ''}>
            <label class="btn btn-outline-danger btn-sm rounded" for="nsfwCheckbox">
                ${window.translations.imageForm.nsfwImage}
            </label>
        </div>`;
        const promptHtml = generatePromptHtml(prompts, nsfwEnabled);

        Swal.fire({
            html: header + switchType + promptHtml,
            showClass: { popup: 'animate__animated animate__slideInUp animate__faster' },
            hideClass: { popup: 'animate__animated animate__slideOutDown animate__faster' },
            position: 'bottom',
            backdrop: 'rgba(43, 43, 43, 0.2)',
            showCloseButton: true,
            showConfirmButton: false,
            customClass: {
                container: 'p-0',
                htmlContainer: 'p-0',
                popup: 'custom-prompt-container shadow',
                closeButton: 'position-absolute'
            },
            didOpen: () => {
                if (isTemporary) {
                    showRegistrationForm();
                    return;
                }

                $('#nsfwCheckbox').on('change', function() {
                    sessionStorage.setItem('nsfwEnabled', $(this).is(':checked'));
                    updatePromptContent(prompts, header);
                });

                attachPromptCardEvents();
            }
        });
    }
    function generatePromptHtml(prompts, nsfwEnabled) {
        let promptHtml = `
            <div class="row px-2 mx-0" style="
                max-height: 60vh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                touch-action: pan-y;
            ">
        `;
        
        prompts.forEach(function(prompt) {
            if (nsfwEnabled || prompt.nsfw !== 'on') {
                promptHtml += `
                    <div class="col-4 col-sm-3 col-lg-2 my-2">
                        <div class="card prompt-card shadow-0" data-id="${prompt._id}" data-nsfw="${prompt.nsfw === 'on'}" style="cursor: pointer;">
                            <img src="${prompt.image}" class="card-img-top" alt="${prompt.title}" style="height:80px; object-fit:contain; width:100%;">
                            <div class="card-body p-1">
                                <p class="card-text text-center" style="font-size:12px; margin-bottom:0;">
                                    ${prompt.title}
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }
        });
        
        return promptHtml + '</div>';
    }


    function updatePromptContent(prompts, header) {
        const nsfwEnabled = $('#nsfwCheckbox').is(':checked');
        const switchType = `<div class="form-check text-start my-3 ps-3">
            <input type="checkbox" class="btn-check" id="nsfwCheckbox" autocomplete="off" ${nsfwEnabled ? 'checked' : ''}>
            <label class="btn btn-outline-danger btn-sm rounded" for="nsfwCheckbox">
                ${window.translations.imageForm.nsfwImage}
            </label>
        </div>`;
        const updatedPromptHtml = generatePromptHtml(prompts, nsfwEnabled);

        $('.swal2-html-container').html(header + switchType + updatedPromptHtml);
        
        $('#nsfwCheckbox').on('change', function() {
            sessionStorage.setItem('nsfwEnabled', $(this).is(':checked'));
            updatePromptContent(prompts, header);
        });

        attachPromptCardEvents();
    }

    function attachPromptCardEvents() {
        $('.prompt-card').off('click').on('click', function() {
            $('.prompt-card').removeClass('selected'); 
            $(this).addClass('selected');

            displayImageLoader();

            var id = $(this).data('id');
            var isNSFWChecked = $('#nsfwCheckbox').is(':checked');

            // Display the choice and cost in the user message
            const typeText = isNSFWChecked ? 'NSFW' : 'SFW';
            const prompt_title = $(this).find('.card-text').text()

            const userMessage = '[user] '+ window.translations['imageForm']['imagePurchaseMessage']
                .replace('{type}', typeText)
                .replace('{prompt_title}', prompt_title) || `[user] ${prompt_title}で${type}画像をリクエストしました。`;
            window.postMessage({ event: 'displayMessage', role:'user', message: userMessage, completion : false , image : false, messageId: false }, '*');


            controlImageGen(API_URL, userId, chatId, userChatId, thumbnail, id, isNSFWChecked);

            Swal.close();
        });
    }
    window.imageRequest = function(command){
        const imageLoaderElement = displayImageLoader();
        saveImageRequest(command, userId, chatId);
        generateItemData(command)
            .then((item) => {
                if (item && item.length > 0) {
                    const itemId = item[0]._id;
                    updateLoaderWithId(itemId);
                    let type = command.nsfw ? 'nsfw' : 'sfw'
                    generateImageNovita(API_URL, userId, chatId, userChatId, itemId, thumbnail, type);
                } else {
                    imageLoaderElement.remove();
                }
            })
            .catch((error) => {
                imageLoaderElement.remove();
            });

    };
    
    function generateItemData(command) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/gen-item-data',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ userId, chatId, userChatId, command }),
                success: function(response) {
                    if (response.length > 0) {
                        resolve(response);
                    } else {
                        reject('Empty response');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error checking purchase proposal:', error);
                    reject(error);
                }
            });
        });
    }    
    
    window.displayImageLoader = function(){
        const imageUrl = "/img/image-placeholder.gif";
        const card = $(`
            <div id="load-image-container" class="assistant-image-box card custom-card bg-transparent shadow-0 border-0 px-1 mx-1 col-auto" style="cursor:pointer;" data-src="${imageUrl}">
                <div style="background-image:url(${imageUrl});border:4px solid white;background-size:cover;" class="card-img-top rounded-avatar position-relative m-auto">
                </div>
            </div>
        `);
        
        $('#chat-recommend').append(card);
        return card;
    }
    
    window.updateLoaderWithId = function(itemId) {
        $("#load-image-container").attr("id", `load-image-container-${itemId}`);
    }    
    window.buyItem = function(itemId, itemName, itemPrice, item_id, status, userId, chatId, userChatId, imageType) {
        if (status) {
            initiatePurchase(itemId, itemName, itemPrice, userId, chatId, function(response) {
                if (response.success) {
                    const successMessages = [
                        `${itemName}を購入しました！`,
                        `${itemName}を${itemPrice}コインで購入しました。`,
                        `${itemName}を無事に${itemPrice}コインでゲットしました！`,
                    ];
                    let message = successMessages[Math.floor(Math.random() * successMessages.length)];
                    displayMessage('user', message, function() {
                        addMessageToChat(chatId, userChatId, 'user', message, function(error, res) {
                            if (!error) {
                                generateImageNovita(API_URL, userId, chatId, userChatId, item_id, thumbnail, imageType);
                            }
                        });
                    });
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
                    if (!error) {
                        generateCompletion();
                    }
                });
            });
        }
    }
    
    


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
        //userChatCard.append(userChatHeader);

        const userChatListGroup = $('<ul class="list-group list-group-flush"></ul>');
        const userChats = userChat.filter(chat =>!chat.isWidget);
        userChats.forEach(chat => {
            const listItem = $(`<li class="list-group-item user-chat-history bg-transparent d-flex align-items-center justify-content-between" data-id="${chat.chatId}" data-chat="${chat._id}" ></li>`);
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

        chatHistoryContainer.append(userChatCard);
        
        // Widget chat history
        const widgetChatHeader = $('<div class="card-header"></div>');
        widgetChatHeader.text('ウィジェットチャット履歴');
        widgetChatCard.append(widgetChatHeader);

        const widgetChatListGroup = $('<ul class="list-group list-group-flush"></ul>');
        const widgetChats = userChat.filter(chat => chat.isWidget);
        widgetChats.forEach(chat => {
            const listItem = $(`<li class="list-group-item user-chat-history bg-transparent d-flex align-items-center justify-content-between" data-id="${chat.chatId}" data-chat="${chat._id}" ></li>`);
            listItem.css('cursor', 'pointer');

            const small = $('<small class="text-secondary"></small>');
            small.append($('<i class="fas fa-clock me-1"></i>'));
            small.append(chat.updatedAt);

            const dropdown = renderChatDropdown(chat)
            
            listItem.append(small);
            listItem.append(dropdown);
            widgetChatListGroup.append(listItem);
        });

        //widgetChatCard.append(widgetChatListGroup);
        //chatHistoryContainer.append(widgetChatCard);

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
  
window.addMessageToChat = function(chatId, userChatId, role, message, callback) {
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
                showNotification('100 コインがデイリーボーナスとして追加されました！', 'success');
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

        $('#user-profile-page').attr('src', function(i, val) { return val; });
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
window.getUserChatHistory = async function(chatId) {
    try {
        const response = await fetch(`/api/chat-history/${chatId}`);
        const data = await response.json();
        displayUserChatHistory(data);
        const lastChat = data.find(chat => !chat.isWidget);
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

function displayChatList(reset,userId) {
    if ($('#chat-list').length === 0 || $('#chat-widget-container').length > 0) {
        return;
    }

    var chatsPerPage = 10;
    var chatListData = JSON.parse(localStorage.getItem('chatList')) || [];
    var currentChatIndex = parseInt(localStorage.getItem('currentChatIndex')) || 0;
    var currentUserId = localStorage.getItem('chatListUserId') || null

    function fetchChatListData() {
        $.ajax({
            type: 'GET',
            url: '/api/chat-list/',
            success: function(data) {
                const {chats,userId} = data
                localStorage.setItem('chatListUserId',userId)
                localStorage.setItem('chatList', JSON.stringify(chats));
                localStorage.setItem('currentChatIndex', 0);
                chatListData = chats;
                currentChatIndex = 0;
                displayChats();
            },
            error: function(xhr, status, error) {}
        });
    }

    function displayChats() {
        var chatsToRender = chatListData.slice(currentChatIndex, currentChatIndex + chatsPerPage);

        chatsToRender.forEach(function(chat) {
            var chatHtml = constructChatItemHtml(chat, false);
            $('#chat-list').append(chatHtml);
        });

        enableToggleDropdown();
        updateChatCount(chatListData.length);
        checkShowMoreButton();
    }

    function updateChatCount(count) {
        $('#user-chat-count').html('(' + count + ')');
    }

    function checkShowMoreButton() {
        $('#show-more-chats').remove();
        if (chatListData.length > currentChatIndex) {
            $('#chat-list').append('<button id="show-more-chats" class="btn shadow-0 w-100"><i class="bi bi-three-dots"></i></button>');
            $('#show-more-chats').on('click', function() {
                $(this).remove();
                currentChatIndex += chatsPerPage;
                displayChats();

            });
        }
    }
    
    if (currentUserId != userId || reset || chatListData.length === 0) {
        fetchChatListData();
    } else {
        displayChats();
    }
}
function updateCurrentChat(chatId, userId) {
    let chatListData = JSON.parse(localStorage.getItem('chatList')) || [];
    let currentChat = chatListData.find(chat => chat._id === chatId);

    if (currentChat) {
        updateChatListDisplay(currentChat);
    } else {
        fetchChatDataInfo(chatId);
    }
}

function fetchChatDataInfo(chatId) {
    $.ajax({
        type: 'GET',
        url: `/api/chat-data/${chatId}`,
        success: function(data) {
            updateChatListDisplay(data);
        },
        error: function(xhr, status, error) {}
    });
}

function updateChatListDisplay(currentChat) {
    let chatListData = JSON.parse(localStorage.getItem('chatList')) || [];
    chatListData = chatListData.filter(chat => chat._id !== currentChat._id);
    chatListData.unshift(currentChat);
    chatListData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    localStorage.setItem('chatList', JSON.stringify(chatListData));

    $('#chat-list').find('.chat-list.item').removeClass('active');
    $('#chat-list').find(`.chat-list.item[data-id="${currentChat._id}"]`).remove();

    let chatHtml = constructChatItemHtml(currentChat, true);
    $('#chat-list').prepend(chatHtml);
    enableToggleDropdown();
}

function constructChatItemHtml(chat, isActive) {
    return `
        <div class="${isActive ? 'active' : ''} chat-list item user-chat d-flex align-items-center justify-content-between p-1 mx-2 rounded bg-transparent" 
            data-id="${chat._id}">
            <div class="d-flex align-items-center w-100">
                <div class="user-chat-content d-flex align-items-center flex-1">
                    <div class="thumb d-flex align-items-center justify-content-center col-3 p-1">
                        <img class="img-fluid" src="${chat.thumbnailUrl || chat.chatImageUrl || '/img/logo.webp'}" alt="">
                    </div>
                    <div class="chat-list-details ps-2">
                        <div class="chat-list-info">
                            <div class="chat-list-title">
                                <h6 class="mb-0 online-text" style="font-size: 14px;">${chat.name}</h6>
                                <span class="text-muted one-line ${chat.lastMessage ? '' : 'd-none'}" style="font-size:11px;">
                                    ${chat.lastMessage ? chat.lastMessage.content : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <div class="dropdown pe-2">
                        <button class="btn border-0 shadow-0 dropdown-toggle ms-2" type="button" id="dropdownMenuButton_${chat._id}" data-mdb-toggle="dropdown" aria-expanded="false">
                            <i class="fas fa-ellipsis-v text-secondary"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end chat-option-menu bg-light shadow rounded mx-3" aria-labelledby="dropdownMenuButton_${chat._id}">
                            <li>
                                <button class="dropdown-item text-secondary chart-button" data-id="${chat._id}">
                                    <i class="fas fa-info-circle me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.info}</span>
                                </button>
                            </li>
                            <li>
                                <button class="dropdown-item text-secondary tag-button" data-id="${chat._id}">
                                    <i class="fas fa-share me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.share}</span>
                                </button>
                            </li>
                            <li>
                                <a href="/chat/edit/${chat._id}" class="dropdown-item text-secondary">
                                    <i class="far fa-edit me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.edit}</span>
                                </a>
                            </li>
                            <li>
                                <button class="dropdown-item text-secondary history-chat" data-id="${chat._id}" >
                                    <i class="fas fa-history me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.chatHistory}</span>
                                </button>
                            </li>
                            <li>
                                <button class="dropdown-item text-secondary reset-chat" data-id="${chat._id}">
                                    <i class="fas fa-plus-square me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.newChat}</span>
                                </button>
                            </li>
                            <li class="d-none">
                                <span data-id="${chat._id}" class="dropdown-item text-danger delete-chat" style="cursor:pointer">
                                    <i class="fas fa-trash me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.delete}</span>
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
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