const audioCache = new Map();
const audioPool = [];

let language

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

let chatId = getIdFromUrl(window.location.href) 
    || sessionStorage.getItem('lastChatId') 
    || getIdFromUrl($.cookie('redirect_url')) 
    || $(`#lamix-chat-widget`).data('id');

// Ensure chatId is not a falsy string (e.g., '', null, undefined, 'null', 'undefined')
if (!chatId || chatId === 'null' || chatId === 'undefined') {
    chatId = null;
}

let userChatId = sessionStorage.getItem('userChatId');

$(document).ready(async function() {
    let persona
    let currentStep = 0;
    let totalSteps = 0;
    let chatData = {};
    let character = {}
    let isNew = true;
    let feedback = false
    let thumbnail = false
    let isTemporary = !!user.isTemporary

    language = getLanguageName(user.lang) || getLanguageName(lang) || getLanguageName('ja');
    $('#language').val(language)

    $('body').attr('data-temporary-user',isTemporary)

    window.addEventListener('message', function(event) {
        if (event.data.event === 'displayMessage') {
            const { role, message, completion, image, messageId } = event.data
            displayMessage(role, message, userChatId, function() {
                addMessageToChat(chatId, userChatId, {role, message}, function(error, res) {
                    const messageContainer = $(`#chatContainer[data-id=${userChatId}]`)
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
                            messageContainer.append(loaderElement);
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
            addMessageToChat(chatId, userChatId, {role, message},function(){
                if(completion){
                    generateCompletion()
                }
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageFav') {
            const imageId = event.data.imageId
            if(!imageId)return
            let message = `[imageFav] ${imageId}`
            addMessageToChat(chatId, userChatId, {role:'user', message});
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageStart') {
            const prompt = event.data.prompt
            const message = '[imageStart]'+ prompt
            addMessageToChat(chatId, userChatId, {role:'user', message}, function(){
                generateCompletion(null,true)
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageDone') {
            const prompt = event.data.prompt
            const message = '[imageDone]'+ prompt
            addMessageToChat(chatId, userChatId, {role:'user', message}, function(){
                generateCompletion()
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'imageError') {
            const error = event?.data?.error || ''
            let message = `[master] There way an error. The image could not be generated ${error}.`
            addMessageToChat(chatId, userChatId, {role:'user', message},function(){
                generateCompletion()
            });
        }
    });

    let count_proposal = 0
    const subscriptionStatus = user.subscriptionStatus == 'active'

    $('.is-free-user').each(function(){if(!subscriptionStatus && !isTemporary)$(this).show()})

    window.fetchChatData = async function(fetch_chatId, fetch_userId, fetch_reset, callback) {
        const lastUserChat = await getUserChatHistory(fetch_chatId);
        fetch_chatId = lastUserChat ?.chatId || fetch_chatId
        chatId = fetch_chatId
        userChatId = lastUserChat ?._id || userChatId;

        $('.new-chat').data('id',fetch_chatId).fadeIn()
        sessionStorage.setItem('lastChatId', fetch_chatId);


        count_proposal = 0;
        
        $('#chatContainer').empty();
        $('#suggestions').empty();
        $('#startButtonContained').remove();
        $('#chat-recommend').empty();

        postChatData(fetch_chatId, fetch_userId, userChatId, fetch_reset, callback);
    }
    
    window.postChatData = function(fetch_chatId, fetch_userId, userChatId, fetch_reset, callback) {
        
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
                handleChatSuccess(data, fetch_reset, fetch_userId, userChatId);
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
    });


    // Event handler for the Enter key
    $('#userMessage').on('keypress', function(event) {
        if (event.which == 13 && !event.shiftKey) { 
            sendMessage();
        }
    });     

    $('#userMessage').on('click', function() {
        resizeTextarea(this);
    });

    function resizeTextarea(element){
        element.style.height = 'auto';
        element.style.height = (element.scrollHeight - 20 ) + 'px';  
    }

    function updateParameters(newchatId, newuserId, userChatId){

        if(chatId){ localStorage.setItem('chatId', chatId);}
        if(userChatId){
            sessionStorage.setItem('userChatId', userChatId);
            $('#chatContainer').attr('data-id',userChatId)
            $('#relationshipStatus').attr('data-id',userChatId).hide();
        }

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

    window.sendMessage = function(customMessage, displayStatus = true) {
        if ($('#chat-widget-container').length === 0 && isTemporary) {
            showRegistrationForm();
            return;
        }

        hidePrompts();
        $('#startButtonContained, #introChat').hide();
        $('#gen-ideas').removeClass('done');
        
    
        const cleanup = () => {
            removePromptFromMessage();
            setTimeout(() => {
                $('#userMessage').val('')
                    .attr('placeholder', window.translations.sendMessage);
                resizeTextarea($('#userMessage')[0]);
            }, 500);
        };
    
        const isPromptImage = $('#userMessage').hasClass('prompt-image');
        const message = customMessage || $('#userMessage').val();
        let finalMessage = message;
    
        if (isPromptImage) {
            const promptId = $('#userMessage').attr('data-prompt-id');
            const imageNsfw = $('#userMessage').attr('data-nsfw');
            if (!promptId) {
                console.error('Prompt ID not found.');
                cleanup();
                return;
            }
            if (finalMessage.trim() === '') {
                const placeholderId = new Date().getTime() + "_" + promptId;
                displayOrRemoveImageLoader(placeholderId, 'show');
                novitaImageGeneration(userId, chatId, userChatId, { placeholderId, imageNsfw, promptId, customPrompt: true })
                    .then(data => {
                        if (data.error) displayOrRemoveImageLoader(placeholderId, 'remove');
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        displayOrRemoveImageLoader(placeholderId, 'remove');
                    });
                cleanup();
                return;
            }
            finalMessage = `[promptImage]${promptId};;;${message};;;${imageNsfw}`;
        }
    
        if (finalMessage.trim() !== '') {
            if (displayStatus) displayMessage('user', message, userChatId);
            $('#userMessage').val('');
            addMessageToChat(chatId, userChatId, { role: 'user', message: finalMessage }, () => {
                generateCompletion(null, true);
            });
        }
        cleanup();
    };    

    $(document).on('click','#unlock-result',function(){
        promptForEmail()
    })
    
    async function handleChatSuccess(data, fetch_reset, fetch_userId, userChatId) {
        $(document).find(`.chat-list.item[data-id="${chatId}"]`).addClass('active').siblings().removeClass('active');

        isNew = fetch_reset || data.isNew;

        if (!data.chat) {
            showDiscovery();
            return;
        }
        if(data.premium && !subscriptionStatus && !isTemporary){
            loadPlanPage()
            return
        }

        setupChatData(data.chat);
        setupChatInterface(data.chat, data.character);
        updateCurrentChat(chatId);

        if (!isNew) {
            displayExistingChat(data.userChat, data.character);
        } else {
            displayInitialChatInterface(data.chat);
        }
    
        if (data.chat.galleries && data.chat.galleries.length > 0) {
            displayGalleries(thumbnail, data.chat.galleries, data.chat.blurred_galleries, chatId, fetch_userId);
        }else{
            $('#galleries-open').hide();
        }

        updateParameters(chatId, fetch_userId, userChatId);
        showChat();
        showPrompts();
    }
    
    function setupChatData(chat) {
        chatData = chat.content || [];
        totalSteps = chatData.length;
        chatName = chat.name;
        thumbnail = chat.chatImageUrl;
        localStorage.setItem('thumbnail',thumbnail)
    }
    
    function setupChatInterface(chat, character) {
        const gender = determineChatGender(chat);
        $('#chat-container').attr('data-genre', gender);
        if(gender === 'female'){
            $('#showPrompts').show();
            $('#userMessage').removeClass('male').addClass('female');
        }else{
            $('#showPrompts').hide();
            $('#userMessage').removeClass('female').addClass('male');
        }
        updateChatBackgroundImage(thumbnail);
        $('#chat-title').text(chatName);
        $('#input-container').show().addClass('d-flex');
        if(user.lang == 'ja'){
            $('#userMessage').attr('placeholder', `${chatName}${window.translations.sendMessageTo}`);
        }else{
            $('#userMessage').attr('placeholder', `${window.translations.sendMessageTo}${chatName}`);
        }
        const albumLink = $(`<a href="#" onclick="openCharacterModal('${chat._id}',event)"></a>`)
        albumLink.attr('data-bs-toggle', 'tooltip');
        albumLink.attr('title', `${window.translations.album || 'アルバム'}`);
        albumLink.addClass('btn btn-light shadow-0 border')
        albumLink.append(`<i class="bi bi-images me-1"></i><span style="font-size:12px;">${chat.imageCount ? chat.imageCount : 0}</span>`)
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
    
    function displayExistingChat(userChat,character) {
        persona = userChat.persona;
        thumbnail = character?.image || localStorage.getItem('thumbnail')

        displayChat(userChat.messages, persona, function(){
            setTimeout(() => {
                $('#chatContainer').animate({
                    scrollTop: $('#chatContainer').prop("scrollHeight") + 500
                }, 500);

                const lastAssistantRelationship = userChat.messages[userChat.messages.length - 1]?.custom_relation;
                if (lastAssistantRelationship) {
                    $(`#relationshipStatus[data-id="${userChatId}"]`).show();
                    $(`#relationshipStatus[data-id="${userChatId}"]`).text(lastAssistantRelationship);
                }
            }, 1000);
        });

        const today = new Date().toISOString().split('T')[0];
        if (userChat.log_success) {
            displayThankMessage();
        }

        if($('#chat-widget-container').length == 0 && isTemporary){
            displayMessage('assistant',`<a class="btn btn-secondary custom-gradient-bg shadow-0 m-2 px-4 py-2" style="border-radius: 50px;" href="/authenticate"><i class="fas fa-sign-in-alt me-2"></i> ログイン</a>`,userChatId)
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
    function displayImageThumb(imageUrl,origineUserChatId = null){
        const messageContainer = $(`#chatContainer[data-id=${origineUserChatId}]`)
        if(origineUserChatId && messageContainer.length == 0){
            return
        }
        var card = $(`
            <div 
            onclick="showImagePreview(this)"
            class="assistant-image-box card custom-card bg-transparent shadow-0 border-0 px-1 mx-1 col-auto" style="cursor:pointer;" data-src="${imageUrl}">
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
                                <span type="button" id="toggle-grid-${album.chatId}" class="btn btn-light mx-3"><i class="bi bi-grid"></i></span>
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
                                    <a href="/my-plan" class="btn btn-lg custom-gradient-bg" style="border-radius:50px;"><i class="bi bi-images me-2"></i>プレミアムに登録する</a>
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
                        <div class="audio-controller">
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
            url: API_URL+'/api/init-chat',
            type: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ 
                message,
                userId,
                chatId, 
                isNew: true
            }),
            success: function(response) {

                userChatId = response.userChatId
                chatId = response.chatId
                isNew = false;
                
                generateCompletion();

                updateCurrentChat(chatId,userId);

                updateParameters(chatId,userId,userChatId)

            },
            error: function(xhr, status, error)  {
                console.error('Error:', error);
                displayMessage('bot', 'An error occurred while sending the message.',userChatId);
                
            }                    
        });
    }
    
    async function displayChat(userChat, persona, callback) {

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
                const image_request = chatMessage.image_request
                if (!isStarter && !isHidden) {
                    messageHtml = `
                        <div class="d-flex flex-row justify-content-end mb-4 message-container" style="position: relative;">
                            <div class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfbdb;">
                                ${marked.parse(chatMessage.content)}
                            </div>
                            ${persona ? `<img src="${persona.chatImageUrl || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">` : ''}
                            ${image_request ? `<i class="bi bi-image message-icon" style="position: absolute; top: 0; right: 25px;opacity: 0.7;"></i>` : ''}
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
                    const imageData = await getImageUrlById(imageId, designStep, thumbnail);
                    messageHtml = imageData.messageHtml
                } else {
                    const isHidden = chatMessage.content.startsWith("[Hidden]");
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
        if( typeof callback == 'function'){
            callback()
        }
    }
  
    function sanitizeString(inputString) {
        if(!inputString)return ''
        inputString.replace(/\s+/g, ' ').trim();  
        if (inputString.includes(",,,")){
            return inputString.split(",,,")[1].trim();
        }
        return inputString;
    }
    function getImageTools({chatId, imageId, isLiked = false, title, prompt = false, nsfw = false, imageUrl = false}) {
        const subscriptionStatus = user.subscriptionStatus == 'active';
        prompt = sanitizeString(prompt);
        return `
            <div class="bg-white py-2 rounded mt-1 d-flex justify-content-between">
                <div class="d-flex justify-content-around w-100">
                    <span class="badge bg-white text-secondary image-fav ${isLiked ? 'liked' : ''}" data-id="${imageId}"
                    onclick="${subscriptionStatus ? 'toggleImageFavorite(this)' : 'loadPlanPage()'}" 
                    style="cursor: pointer;bottom:5px;right:5px;opacity:0.8;">
                        <i class="bi bi-heart-fill"></i>
                    </span>
                    <span class="badge bg-white text-secondary txt2img regen-img" 
                    onclick="${subscriptionStatus ? 'regenImage(this)' : 'loadPlanPage()'}" 
                    data-prompt="${prompt}" 
                    data-nsfw="${nsfw}" 
                    data-id="${imageId}" 
                    style="cursor: pointer;bottom:5px;right:5px;opacity:0.8;">
                        <i class="bi bi-arrow-clockwise"></i>
                    </span>
                    ${window.isAdmin ? `
                    <span type="button" class="badge bg-white text-secondary" data-bs-toggle="modal" data-bs-target="#modal-${imageId}">
                        <i class="bi bi-info-circle"></i>
                    </span>
                    <div style="height: 70vh;" class="modal fade" id="modal-${imageId}" tabindex="-1" aria-labelledby="modal-${imageId}-label" aria-hidden="true" data-bs-backdrop="false">
                        <div class="modal-dialog" style="bottom: 80px;position: fixed;">
                            <div class="modal-content border-0 shadow mx-auto" style="height: auto;">
                                <div class="modal-header">
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body">
                                    <p>${prompt}</p>
                                </div>
                            </div>
                        </div>
                    </div>` : ''}
                    <span class="badge bg-white text-secondary share d-none"
                            data-title="${title}"
                            data-url="${imageUrl}"
                            style="cursor: pointer; bottom:5px; right:5px; opacity:0.8;"
                            onclick="openShareModal(this)">
                        <i class="bi bi-box-arrow-up"></i>
                    </span>

                    <span class="badge bg-white text-secondary download-image" style="cursor: pointer; bottom:5px; right:5px; opacity:0.8;">
                        <a href="${imageUrl}" download="${title}.png" style="color:inherit;"><i class="bi bi-download"></i></a>
                    </span>
                    ${window.isAdmin ? `
                    <span class="badge bg-white text-secondary update-chat-image" onclick="${subscriptionStatus ? 'updateChatImage(this)' : 'loadPlanPage()'}" data-id="${chatId}" data-img="${imageUrl}" style="cursor: pointer; bottom:5px; right:5px; opacity:0.8;">
                        <i class="bi bi-image"></i>
                    </span>` : ''}
                </div>
            </div>
            <div class="title assistant-chat-box py-1 px-3 ${title && title !== 'undefined' ? '': 'd-none'}" style="border-radius: 0px 0px 15px 15px;max-width: 200px;">
                <p class="text-white" style="font-size: 12px;">${title}</p>
            </div>
        `;
    }
    window.openShareModal = function(el) {
        const title = $(el).data('title');
        const url = $(el).data('url');
        $('#twitterShareButton').off('click').on('click', () => shareOnTwitter(title, url));
        $('#facebookShareButton').off('click').on('click', () => shareOnFacebook(title, url));
        $('#shareModal').modal('show');
      }
      function shareOnTwitter(title, url) {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
      }
      function shareOnFacebook(title, url) {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
      }
    function getImageUrlById(imageId, designStep, thumbnail) {
        const placeholderImageUrl = '/img/placeholder-image-2.gif'; // Placeholder image URL

        // Return immediately with placeholder and update asynchronously
        return new Promise((resolve) => {
            const placeholderHtml = `
            <div id="container-${designStep}">
                <div class="d-flex flex-row justify-content-start mb-4 message-container">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;">
                    <div class="ms-3 position-relative">
                        <div 
                        onclick="showImagePreview(this)"
                        class="ps-0 text-start assistant-image-box">
                            <img id="image-${imageId}" src="${placeholderImageUrl}" alt="Loading image...">
                            <div class="nsfw-badge-container badge" style="display:none;">NSFW<div>
                        </div>
                    </div>
                </div>
            </div>`;
            resolve({ messageHtml: placeholderHtml, imageUrl: placeholderImageUrl });
    
            // Fetch image asynchronously and update the DOM
            $.ajax({
                url: `/image/${imageId}`,
                method: 'GET',
                success: function(response) {
                    if (response.imageUrl) {
                        
                        // Update the placeholder image
                        if(!subscriptionStatus && response.nsfw){
                            $(`#image-${imageId}`).attr('data-src', response.imageUrl).addClass('img-blur').fadeIn();
                            blurImage($(`#image-${imageId}`));
                        }else{
                            displayImageThumb(response.imageUrl)
                            $(`#image-${imageId}`).attr('src', response.imageUrl).fadeIn();
                        }
                        // Update the alt text
                        const title = response?.title?.[lang]?.trim() || '';
                        $(`#image-${imageId}`).attr('alt', title).fadeIn();
                        //update the image prompt
                        $(`#image-${imageId}`).attr('data-prompt', response.imagePrompt);
                        // Add tools or badges if applicable
                        if (!response.isBlur) {
                            const toolsHtml = getImageTools({chatId, imageId, isLiked:response?.likedBy?.some(id => id.toString() === userId.toString()),title:response?.title?.[lang], prompt:response.imagePrompt, nsfw:response.nsfw, imageUrl:response.imageUrl});
                            $(`#image-${imageId}`).closest('.assistant-image-box').after(toolsHtml);
                            if(response.nsfw){
                                $(`#image-${imageId}`).closest('.assistant-image-box').find('.nsfw-badge-container').show();
                            }
                        } else {
                            const blurBadgeHtml = `
                            <div class="badge-container position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
                                <span type="button" class="badge bg-danger text-white" style="padding: 5px; border-radius: 5px;">
                                    <i class="bi bi-lock"></i> 成人向け
                                </span>
                            </div>`;
                            $(`#image-${imageId}`).closest('.assistant-image-box').append(blurBadgeHtml);
                        }
                        // Add blur effect if not subscribed
                        if(!subscriptionStatus){
                            $(`#image-${imageId}`).closest('.assistant-image-box').addClass('isBlurred');
                        }
                    } else {
                        console.error('No image URL returned');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching image URL:', error);
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
        
        //initAudio($el, message);
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
        if(language != 'japanese'){
            return `/api/txt2speech?message=${message}&language=${language}&chatId=${chatId}`
        }
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

    const activeStreams = {};      
    let attemptCount = 2;

    function createBotResponseContainer(uniqueId) {
    const container = $(`
        <div id="container-${uniqueId}">
        <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
            <img src="${thumbnail ? thumbnail : '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width:45px;width:45px;height:45px;border-radius:15%;object-fit:cover;object-position:top;cursor:pointer;">
            <div class="audio-controller"><button id="play-${uniqueId}" class="audio-content badge bg-dark">►</button></div>
            <div id="completion-${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box"><img src="/img/load-dot.gif" width="50px"></div>
        </div>
        </div>`).hide();
    $('#chatContainer').append(container);
    container.addClass('animate__animated animate__slideInUp').fadeIn();
    return container;
    }

    function afterStreamEnd(uniqueId, markdownContent) {
      let msg = removeContentBetweenStars(markdownContent);
      $(`#play-${uniqueId}`).attr('data-content', msg);
      $(`#play-${uniqueId}`).closest('.audio-controller').show();
    }
    // Hide the completion message container
    window.hideCompletion = function(uniqueId) {
        $(`#completion-${uniqueId}`).fadeOut();
    };
    // Display completion message character by character
    window.displayCompletionMessage = function(message, uniqueId) {
        $(`#completion-${uniqueId}`).find('img').fadeOut().remove();
        const graphemes = [...message];
        const CHUNK_SIZE = 1;
      
        function renderChunk() {
          for (let i = 0; i < CHUNK_SIZE && graphemes.length; i++) {
            const textNode = document.createTextNode(graphemes.shift());
            $(`#completion-${uniqueId}`).append(textNode);
          }
          if (graphemes.length > 0) {
            requestAnimationFrame(renderChunk);
          } else {
            afterStreamEnd(uniqueId, $(`#completion-${uniqueId}`).text());
          }
        }
      
        requestAnimationFrame(renderChunk);
      };
      
    
    function generateCompletion(callback, isHidden = false) {
        const uniqueId = `${currentStep}-${Date.now()}`;
        const container = createBotResponseContainer(uniqueId);

        $.ajax({
            url: API_URL + '/api/openai-chat-completion',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ userId, chatId, userChatId, isHidden, uniqueId }),
            success: function() {
            },
            error: function() {
            console.error('Error: AJAX call failed');
            }
        });
    }
  
    window.displayMessage = function(sender, message, origineUserChatId, callback) {
        const messageContainer = $(`#chatContainer[data-id=${origineUserChatId}]`)
        const messageClass = sender === 'user' ? 'user-message' : sender;
        const animationClass = 'animate__animated animate__slideInUp';
        let messageElement;

        if (messageClass === 'user-message') {
            if (typeof message === 'string' && message.trim() !== '') {
                message = message.replace('[Hidden]','').replace('[user] ','').replace('[context] ','')
                messageElement = $(`
                    <div class="d-flex flex-row justify-content-end mb-4 message-container ${messageClass} ${animationClass}">
                        <div class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfbdb;">
                            <span>${message}</span>
                        </div>
                        ${persona ? `<img src="${persona.chatImageUrl || '/img/logo.webp'}" alt="avatar" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">` : ''}
                    </div>
                `).hide();
                messageContainer.append(messageElement);
                messageElement.addClass(animationClass).fadeIn();

                $('#chatContainer').animate({ scrollTop: $('#chatContainer')[0].scrollHeight }, 500);
            }
        } 
    
        else if (messageClass === 'bot-image' && message instanceof HTMLElement) {
            const imageId = message.getAttribute('data-id');
            const imageNsfw = message.getAttribute('data-nsfw') == 'true';
            const title = message.getAttribute('alt');
            const prompt = message.getAttribute('data-prompt');
            const imageUrl = message.getAttribute('src');

            if(!subscriptionStatus && imageNsfw){
                // Remove src attribute to prevent loading the image
                message.removeAttribute('src');
                // Set data-src attribute to generate the blurry image
                message.setAttribute('data-src', imageUrl);
                // add class img-blur
                message.classList.add('img-blur');
            }
            
            messageElement = $(`
                <div class="d-flex flex-row justify-content-start mb-4 message-container ${messageClass} ${animationClass}">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">
                    <div class="ms-3 position-relative">
                        <div 
                        onclick="showImagePreview(this)" 
                        class="ps-0 text-start assistant-image-box ${!subscriptionStatus && imageNsfw ? 'isBlurred' : '' }" data-id="${imageId}">
                            ${message.outerHTML}
                            ${imageNsfw ? `<div class="nsfw-badge-container badge">NSFW</div>` : ''}
                        </div>
                        ${getImageTools({chatId:origineUserChatId, imageId,isLiked:false,title,prompt,imageNsfw,imageUrl})}
                    </div>
                </div>      
            `).hide();
            messageContainer.append(messageElement);
            messageElement.addClass(animationClass).fadeIn();
            if(!subscriptionStatus){
                const image = messageElement.find('img[data-id="'+imageId+'"]');
                blurImage(image)
            }else{
                displayImageThumb(imageUrl,origineUserChatId)
            }
        } 

        else if (messageClass.startsWith('new-image-') && message instanceof HTMLElement) {
            const imageId = message.getAttribute('data-id');
            const imageNsfw = message.getAttribute('data-nsfw');
            const title = message.getAttribute('alt');
            const prompt = message.getAttribute('data-prompt');
            const imageUrl = message.getAttribute('src');
            const messageId = messageClass.split('new-image-')[1]
            messageElement = $(`
                    <div class="ms-3 position-relative">
                        <div 
                            onclick="showImagePreview(this)"
                            class="text-start assistant-image-box" data-id="${imageId}">
                            ${message.outerHTML}
                            ${imageNsfw ? `<div class="nsfw-badge-container badge">NSFW</div>` : ''}
                        </div>
                        ${getImageTools({chatId:origineUserChatId, imageId,isLiked:false,title,prompt,imageNsfw,imageUrl})}
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
                        <div 
                        onclick="showImagePreview(this)"
                        class="text-start assistant-image-box">
                            ${message.outerHTML}
                        </div>
                        <div class="badge-container position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
                            <span type="button" class="badge bg-danger text-white" style="padding: 5px; border-radius: 5px;">
                                <i class="bi bi-lock"></i> 成人向け
                            </span>
                        </div>
                    </div>
                </div>   
            `).hide();
            messageContainer.append(messageElement);
            messageElement.addClass(animationClass).fadeIn();
        } 
    
        else if (messageClass === 'assistant' && typeof message === 'string' && message.trim() !== '') {
            const uniqueId = `completion-${currentStep}-${Date.now()}`;
            messageElement = $(`
                <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container ${animationClass}">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top; cursor:pointer;">
                    <div class="audio-controller">
                        <button id="play-${uniqueId}" class="audio-content badge bg-dark" data-content="${message}">►</button>
                    </div>
                    <div id="${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box">
                        ${message}
                    </div>
                </div>
            `).hide();
            messageContainer.append(messageElement);
            messageElement.show().addClass(animationClass);
        }
    
        if (typeof callback === 'function') {
            callback();
        }
    };       

    // Helper function to hide and show #promptContainer using the 'visible' class
    function showPrompts() {
        $('#promptContainer').hide().addClass('visible').slideDown('fast');
        $('#suggestions').removeClass('d-flex').hide();
    }
    function hidePrompts() {
        $('#promptContainer').removeClass('visible').slideUp('fast');
        $('#suggestions').addClass('d-flex').show();
        removePromptFromMessage();
    }

    // Click handler for #showPrompts
    $(document).off('click', '#showPrompts').on('click', '#showPrompts', function() {
        const $promptContainer = $('#promptContainer');
        if ($promptContainer.hasClass('visible')) {
            hidePrompts();
        } else {
            showPrompts();
        }
    });
      
    $('#close-promptContainer').on('click', function() {
        hidePrompts();
    });
    
    $('.prompt-card').off('click').on('click', function() {
        $('.prompt-card').removeClass('selected'); 
        $(this).addClass('selected');

        var promptId = $(this).data('id');
        var imageNsfw = $(this).data('nsfw') ? 'nsfw' : 'sfw';

        const imagePreview = new URL($(this).find('img').attr('data-src') || $(this).find('img').attr('src'), window.location.origin).href;
       

        const subscriptionStatus = user.subscriptionStatus == 'active'

        sendPromptImageDirectly(promptId, imageNsfw, imagePreview);
        hidePrompts();
    });

    function sendPromptImageDirectly(promptId, imageNsfw, imagePreview) {
        const placeholderId = new Date().getTime() + "_" + promptId;
        displayOrRemoveImageLoader(placeholderId, 'show', imagePreview);
        novitaImageGeneration(userId, chatId, userChatId, { placeholderId, imageNsfw, promptId, customPrompt: true })
            .then(data => {
                if (data.error) displayOrRemoveImageLoader(placeholderId, 'remove');
            })
            .catch(error => {
                console.error('Error:', error);
                displayOrRemoveImageLoader(placeholderId, 'remove');
            });
        // Optionally clear prompt selection or UI here if needed
    }
    // Add the prompt image to the #userMessage textarea and update the value
    function addPromptToMessage(id, imageNsfw, imagePreview) {
        const userMessage = $('#userMessage');
        userMessage.css('background-image', `url(${imagePreview})`);
        userMessage.addClass('prompt-image');
        userMessage.attr('data-prompt-id', id);
        userMessage.attr('data-nsfw', imageNsfw);
        userMessage.attr('placeholder', translations.customPromptPlaceholder);
    }

    function removePromptFromMessage() {
        const userMessage = $('#userMessage');
        userMessage.css('background-image', 'none');
        userMessage.removeClass('prompt-image');
        userMessage.removeAttr('data-prompt-id');
        userMessage.removeAttr('data-nsfw');
        userMessage.attr('placeholder', translations.sendMessage); 
    }
    
  // Fetch the user's IP address and generate a unique ID
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

    // Check if 'newSubscription' is true
    if (newSubscription) {
        // Display SweetAlert2 in Japanese
        Swal.fire({
            title: 'サブスクリプション成功',
            text: 'ご登録ありがとうございます！プレミアム機能をお楽しみください。',
            icon: 'success',
            confirmButtonText: '閉じる'
        });
    }
});


//.reset-chat,.new-chat
window.handleChatReset = function(el) {
    chatId = $(el).data('id');
    fetchChatData(chatId, userId, true);
};
//.user-chat-history
window.handleUserChatHistoryClick = function(el) {
    if (userChatId == $(el).data('chat')) {
        return;
    }
    chatId = $(el).data('id');
    userChatId = $(el).data('chat');
    postChatData(chatId, userId, userChatId, null, null);
};
//.chat-list.item.user-chat .user-chat-content
window.handleChatListItemClick = function(el) {
    const $el = $(el);
    if ($el.hasClass('loading')) return;
    $el.addClass('loading');
    const selectChatId = $el.closest('.user-chat').data('id');
    const chatImageUrl = $el.find('img').attr('src');
    $el.closest('.chat-list.item').addClass('active').siblings().removeClass('active');
    $('#chat-container').css('background-image', `url(${chatImageUrl})`);
    
    fetchChatData(selectChatId, userId, null, function() {
        $el.removeClass('loading');
    });
};

window.regenImage = function(el){
    if($(el).hasClass('spin')){
        showNotification(window.translations.image_generation_processing,'warning')
        return
    }
    const button = $(el)
    button.addClass('spin')

    const imageNsfw = $(el).attr('data-nsfw') == 'true' ? 'nsfw' : 'sfw'
    const imagePrompt = $(el).data('prompt')
    const placeholderId = $(el).data('id')
    displayOrRemoveImageLoader(placeholderId, 'show');

    if($(el).hasClass('txt2img')){
        novitaImageGeneration(userId, chatId, userChatId, {prompt:imagePrompt, imageNsfw, placeholderId})
        .then(data => {
            if(data.error){
                displayOrRemoveImageLoader(placeholderId, 'remove');
                button.removeClass('spin');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            displayOrRemoveImageLoader(placeholderId, 'remove');
            button.removeClass('spin');
        });
    }
};

function displaySuggestions(suggestions, uniqueId) {
    const suggestionContainer = $(`#suggestions`);

    // Add new suggestions smoothly one by one
    suggestions.forEach((suggestion, index) => {
        const button = $(`<button class="btn shadow m-1 rounded-pill text-capitalize text-white" style="background: color(srgb 0.2567 0.2909 0.325 / 0.81);">${suggestion}</button>`);
        button.on('click', function() {
            sendMessage(suggestion);
            $(this).fadeOut();
        });
        suggestionContainer.prepend(button.hide().fadeIn());
    });
}

// call fetchchatdata function accross other scripts
function callFetchChatData(fetch_chatId, fetch_userId, fetch_reset, callback){
    fetchChatData(fetch_chatId, fetch_userId, fetch_reset, callback);
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

window.enableToggleDropdown = function(el) {
    const dropdownToggle = $(el);
    if (!dropdownToggle.hasClass('event-attached')) {
        dropdownToggle.addClass('event-attached');

        // Initialize the dropdown
        const dropdown = new mdb.Dropdown(dropdownToggle[0]);

        // Find the parent element that has the hover effect
        const parent = dropdownToggle.closest('.chat-list');

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

        // Open the dropdown on the first click
        dropdownToggle.click();
    }
}


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
            const listItem = $(`<li 
                class="list-group-item user-chat-history bg-transparent d-flex align-items-center justify-content-between" 
                data-id="${chat.chatId}" 
                data-chat="${chat._id}" 
                onclick="handleUserChatHistoryClick(this)"></li>`);
            listItem.css('cursor', 'pointer');

            const small = $('<small class="text-secondary"></small>');
            small.append($('<i class="bi bi-clock me-1"></i>'));
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
            const listItem = $(`<li 
                class="list-group-item user-chat-history bg-transparent d-flex align-items-center justify-content-between" 
                data-id="${chat.chatId}" 
                data-chat="${chat._id}" 
                onclick="handleUserChatHistoryClick(this)"></li>`);
            listItem.css('cursor', 'pointer');

            const small = $('<small class="text-secondary"></small>');
            small.append($('<i class="bi bi-clock me-1"></i>'));
            small.append(chat.updatedAt);

            const dropdown = renderChatDropdown(chat)
            
            listItem.append(small);
            listItem.append(dropdown);
            widgetChatListGroup.append(listItem);
        });

        //widgetChatCard.append(widgetChatListGroup);
        //chatHistoryContainer.append(widgetChatCard);

    }
}

function renderChatDropdown(chat) {
    const chatId = chat._id;
    const dropdownHtml = `
        <div class="d-inline-block align-items-center">
            <!-- Dropdown -->
            <div 
                onclick="enableToggleDropdown(this)"
                class="dropdown pe-2">
                <button
                class="btn border-0 shadow-0 dropdown-toggle ms-2" type="button" id="dropdownMenuButton_${chatId}" data-mdb-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-three-dots text-secondary"></i>
                </button>
                <ul class="chat-option-menu dropdown-menu dropdown-menu-end" aria-labelledby="dropdownMenuButton_${chatId}">
                    <li>
                        <span data-id="${chatId}" class="dropdown-item text-danger delete-chat-history" style="cursor:pointer">
                            <i class="bi bi-trash me-2"></i>
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
  
window.addMessageToChat = function(chatId, userChatId, option, callback) {
    const { message, role, image_request } = option;
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

var chatsPerPage = 10;
let initChatList = false
let currentPage = 1;
let pagination = { total: 0, totalPages: 0 };
let chatListData = [];

$(document).on('click','#menu-chat, .menu-chat-sm',function(){
    if(!initChatList){
        initChatList = true
        displayChatList(null, userId);
    }
});

function displayChatList(reset, userId) {
    if ($('#chat-list').length === 0 || $('#chat-widget-container').length > 0) return;
    if (reset) {
      currentPage = 1;
      chatListData = [];
      sessionStorage.removeItem('chatListData');
      sessionStorage.removeItem('currentPage');
      sessionStorage.removeItem('pagination');
      $('#chat-list').empty();
      $('#chat-list').append(`
          <div id="chat-list-spinner" class="spinner-border text-secondary" role="status" style="position: absolute; top: 45%; left: 45%; display: none;">
              <span class="visually-hidden">Loading...</span>
          </div>`)
    }
  
    fetchChatListData(currentPage);
  
    function fetchChatListData(page) {
      // Get cached data
      chatListData = JSON.parse(sessionStorage.getItem('chatListData')) || [];
      currentPage = parseInt(sessionStorage.getItem('currentPage')) || 1;
      pagination = JSON.parse(sessionStorage.getItem('pagination')) || { total: 0, totalPages: 0 };
      
      // Only use cached data if we have enough data and we're not resetting
      if (initChatList && chatListData.length > 0 && page === 1) {
        displayChats(chatListData, pagination);
        return;
      }
      
      $('#chat-list-spinner').show();
      
      $.ajax({
        type: 'GET',
        url: '/api/chat-list/' + userId,
        data: { page: page, limit: chatsPerPage },
        success: function(data) {
          const { chats, pagination } = data;
          
          // For page 1, replace the entire list
          // For subsequent pages, append new chats
          if (page === 1) {
            chatListData = chats;
            $('#chat-list').empty().append(`
              <div id="chat-list-spinner" class="spinner-border text-secondary" role="status" style="position: absolute; top: 45%; left: 45%; display: none;">
                  <span class="visually-hidden">Loading...</span>
              </div>`);
          } else {
            // Filter out any duplicates before adding new chats
            const newChats = chats.filter(newChat => 
              !chatListData.some(existingChat => existingChat._id === newChat._id)
            );
            chatListData = chatListData.concat(newChats);
          }
          
          sessionStorage.setItem('chatListData', JSON.stringify(chatListData));
          sessionStorage.setItem('currentPage', page);
          sessionStorage.setItem('pagination', JSON.stringify(pagination));
          
          // Only display the newly fetched chats
          displayChats(chats, pagination);
        },
        error: function(xhr, status, error) {
          console.error('Error fetching chat list:', error);
          $('#chat-list-spinner').hide();
        },
        complete: function() {
          $('#chat-list-spinner').hide();
        }
      });
    }
  
    function displayChats(chats, pagination) {
      // Don't append if these are duplicate chats
      chats.forEach(function(chat){
        // Check if this chat is already displayed
        if ($(`#chat-list .chat-list.item[data-id="${chat._id}"]`).length === 0) {
          var chatHtml = constructChatItemHtml(chat, chat._id === chatId);
          $('#chat-list').append(chatHtml);
        }
      });
      
      updateCurrentChat(chatId, userId);
      updateChatCount(pagination.total);
      checkShowMoreButton(pagination);
    }
  
  function updateChatCount(count) {
    $('#user-chat-count').html('(' + count + ')');
  }

  function checkShowMoreButton(pagination) {
    $('#show-more-chats').remove(); 
    if (pagination.page < pagination.totalPages) {
      $('#chat-list').append(
        '<button id="show-more-chats" class="btn shadow-0 w-100"><i class="bi bi-three-dots"></i></button>'
      );
      $('#show-more-chats').off().on('click', function() {
        $(this).hide();
        $('#chat-list-spinner').show();
        currentPage++;
        sessionStorage.setItem('currentPage', currentPage);
        fetchChatListData(currentPage);
      });
    }
  }
}


function updateCurrentChat(chatId, userId) {
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
        error: function(xhr, status, error) {
            console.log(error)
        }
    });
}

function updateChatListDisplay(currentChat) {

    chatListData = chatListData.filter(chat => chat._id !== currentChat._id);
    chatListData.unshift(currentChat);
    chatListData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // remoce all active class 
    $('#chat-list').find('.chat-list.item').removeClass('active');
    // remove all occurrence of chat from list
    const currentChatObjs = $(document).find('#chat-list').find(`.chat-list.item[data-id="${currentChat._id}"]`);
    if(currentChatObjs.length >= 1){
        currentChatObjs.each(function(){
            const chatName = $(this).find('.chat-list-title h6').text();
            $(this).remove();
        });
    }

    let chatHtml = constructChatItemHtml(currentChat, true);
    $('#chat-list').prepend(chatHtml);
}
function constructChatItemHtml(chat, isActive) {
    return `
        <div class="${isActive ? 'active' : ''} chat-list item user-chat d-flex align-items-center justify-content-between p-1 mx-2 rounded bg-transparent" 
            data-id="${chat._id}">
            <div class="d-flex align-items-center w-100">
                <div class="user-chat-content d-flex align-items-center flex-1"
                onclick="handleChatListItemClick(this)">
                    <div class="thumb d-flex align-items-center justify-content-center col-3 p-1">
                        <img class="img-fluid" src="${chat.chatImageUrl || '/img/logo.webp'}" alt="">
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
                    <div 
                        onclick="enableToggleDropdown(this)"
                        class="dropdown pe-2">
                        <button 
                        class="btn border-0 shadow-0 dropdown-toggle ms-2" 
                        type="button" 
                        id="dropdownMenuButton_${chat._id}" 
                        data-mdb-toggle="dropdown" 
                        aria-expanded="false">
                            <i class="bi bi-three-dots text-secondary"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-start chat-option-menu bg-light shadow rounded mx-3" aria-labelledby="dropdownMenuButton_${chat._id}">
                            <li>
                                <a href="#" class="dropdown-item text-secondary" onclick="loadCharacterCreationPage('${chat._id}')">
                                    <i class="bi bi-pencil me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.edit}</span>
                                </a>
                            </li>
                            <li>
                                <button class="dropdown-item text-secondary history-chat" data-id="${chat._id}" >
                                    <i class="bi bi-clock-history me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.chatHistory}</span>
                                </button>
                            </li>
                            <li>
                                <button 
                                class="dropdown-item text-secondary reset-chat" 
                                data-id="${chat._id}"
                                onclick="handleChatReset(this)">
                                    <i class="bi bi-plus-square me-2"></i>
                                    <span class="text-muted" style="font-size:12px;">${window.translations.newChat}</span>
                                </button>
                            </li>
                            <li class="d-none">
                                <span data-id="${chat._id}" class="dropdown-item text-danger delete-chat" style="cursor:pointer">
                                    <i class="bi bi-trash me-2"></i>
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
    sessionStorage.setItem('lastChatId', null);
    if($('#chat-widget-container').length == 0){
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }
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

function initializeAudio(){
    let autoPlay = localStorage.getItem('audioAutoPlay') === 'true';
    $('#audio-icon').addClass(autoPlay ? 'fa-volume-up' : 'fa-volume-mute');
    $('#audio-play').click(function() {
        autoPlay = !autoPlay;
        localStorage.setItem('audioAutoPlay', autoPlay);
        $('#audio-icon').toggleClass('fa-volume-up fa-volume-mute');
    });
}