const displayedMessageIds = new Set();
const displayedImageIds = new Set();
const displayedVideoIds = new Set();

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

// Ensure chatId is not a falsy string (e.g., '', null, undefined, 'null', 'undefined')
if (!chatId || chatId === 'null' || chatId === 'undefined') {
    chatId = null;
}

let userChatId = sessionStorage.getItem('userChatId');
let persona;
let isNew = true;

// Listen for persona added event from PersonaModule
window.onPersonaAdded = function(personaObj) {
    persona = {
        name: personaObj.name,
        id: personaObj.id,
        chatImageUrl: personaObj.chatImageUrl
    };
    isNew = !isNew;
    
    // Add a new message to the chat container
    addMessageToChat(chatId, userChatId, {
        role: 'user',
        message: `I updated my Persona to "${persona.name}".`,
        name: 'persona',
        hidden: true
    }, function(error, res) {

        generateChatCompletion();

        if (error) {
            console.error('Error adding persona message:', error);
        }
    });
};
// On close of the persona module check if the chat is new
window.onPersonaModuleClose = function() {
    if (isNew) {
        generateChatCompletion();
        isNew = false;
    }
};
window.thumbnail = false
$(document).ready(async function() {
    let currentStep = 0;
    let totalSteps = 0;
    let chatData = {};
    let character = {}
    let feedback = false
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
                            generateChatCompletion();
                        }
                        if(image && messageId){
                            const loaderElement = $(`
                                <div id="${messageId}" class="d-flex flex-row justify-content-start mb-4 message-container assistant animate__animated animate__fadeIn">
                                    <img src="${thumbnail || '/img/default-avatar.png'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="width: 45px; height: 45px; object-fit: cover; object-position: top;" onclick="openCharacterInfoModal('${chatId}', event)">
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
                    generateChatCompletion()
                }
            });
        }
    });
    window.addEventListener('message', function(event) {
        if (event.data.event === 'fetchChatData') {
            const fetch_chatId = event.data.chatId
            const fetch_userId = event.data.userId
            const fetch_reset = event.data.reset
            fetchChatData(fetch_chatId, fetch_userId, fetch_reset,function(){ 
                $(`#spinner-${fetch_chatId}`).removeClass('on').hide()
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
        fetchChatData(chatId, userId);
    }else{
        showDiscovery();
    }
    
    $('textarea').each(function() {
        $(this).on('input change keypress', function(e) {
            if (e.type === 'keypress' && e.which !== 13) {
                return;
            }
        });
    });
    
    $('#sendMessage').on('click', function() {
        sendMessage();
    });

    $('#sendImageMessage').on('click', function() {
        sendImageMessage();
    });

    // Event handler for the Enter key
    $('#userMessage').on('keypress', function(event) {
        if (event.which == 13 && !event.shiftKey) { 
            sendMessage();
        }
    });     

    function updateParameters(newchatId, newuserId, userChatId){

        if(chatId){ 
            localStorage.setItem('chatId', chatId);
            sessionStorage.setItem('chatId', chatId);}
        if(userChatId){
            localStorage.setItem('userChatId', userChatId);
            sessionStorage.setItem('userChatId', userChatId);
            $('#chatContainer').attr('data-id',userChatId)
        }

        var currentUrl = window.location.href;
        var urlParts = currentUrl.split('/');
        urlParts[urlParts.length - 1] = newchatId;
        var newUrl = urlParts.join('/');

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
    window.sendImageMessage = function(customMessage, displayStatus = true) {
        sendMessage(customMessage, displayStatus, true);
    }
    window.sendMessage = function(customMessage, displayStatus = true, image_request = false) {
        
        if (window.promptManager) {
            window.promptManager.hide();
        }
         // Hide suggestions when user sends manual message
        if (window.chatSuggestionsManager) {
            window.chatSuggestionsManager.hide();
        }
        
        // Trigger custom event
        $(document).trigger('chat:messageSent');
        
        $('#startButtonContained, #introChat').hide();
        $('#gen-ideas').removeClass('done');
        
    
        const cleanup = () => {
            setTimeout(() => {
                $('#userMessage').val('')
                    .attr('placeholder', window.translations.sendMessage);
            }, 500);
        };
    
        const message = customMessage || $('#userMessage').val();
        let finalMessage = message;
    
        if (finalMessage.trim() !== '') {
            if (displayStatus) displayMessage('user', message, userChatId);
            $('#userMessage').val('');
            addMessageToChat(chatId, userChatId, { role: 'user', message: finalMessage, image_request }, () => {
                generateChatCompletion(null, true);
            });
        }
        cleanup();
    };    

    $(document).on('click','#unlock-result',function(){
        promptForEmail()
    })

    async function checkBackgroundTasks(chatId, userChatId) {
        try {
            // Check image generation tasks
            const response = await fetch(`/api/background-tasks/${userChatId}`);
            const data = await response.json();
            
            if (data.tasks && data.tasks.length > 0) {
                data.tasks.forEach(task => {
                    if (task.status === 'pending' || task.status === 'processing' || task.status === 'background') {
                        // Display placeholder for background task
                        displayBackgroundTaskPlaceholder(task);
                        
                        // Start polling for this specific task
                        pollBackgroundTask(task.taskId, task.placeholderId);
                    }
                });
            }

            // Check video generation tasks
            const videoResponse = await fetch(`/api/background-video-tasks/${userChatId}`);
            const videoData = await videoResponse.json();
            
            if (videoData.tasks && videoData.tasks.length > 0) {
                videoData.tasks.forEach(task => {
                    if (task.status === 'pending' || task.status === 'processing' || task.status === 'background') {
                        // Display placeholder for background video task
                        displayVideoLoader(task.placeholderId, task.imageId);
                        
                        // Note: No polling needed here since backend handles it via WebSocket
                        console.log(`Background video task found: ${task.taskId}, loader displayed`);
                    }
                });
            }
        } catch (error) {
            console.error('Error checking background tasks:', error);
        }
    }

    function displayBackgroundTaskPlaceholder(task) {
        const placeholderId = task.placeholderId;
        
        // Check if custom prompt was used
        if (task.customPromptId) {
            // Get the custom prompt image preview
            const promptCard = $(`.prompt-card[data-id="${task.customPromptId}"]`);
            if (promptCard.length > 0) {
                const imagePreview = promptCard.find('img').attr('data-src') || promptCard.find('img').attr('src');
                displayOrRemoveImageLoader(placeholderId, 'show', imagePreview);
            } else {
                displayOrRemoveImageLoader(placeholderId, 'show');
            }
        } else {
            displayOrRemoveImageLoader(placeholderId, 'show');
        }
    }

    async function pollBackgroundTask(taskId, placeholderId) {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/task-status/${taskId}`);
                const taskStatus = await response.json();
                
                if (taskStatus.status === 'completed') {
                    clearInterval(pollInterval);
                    displayOrRemoveImageLoader(placeholderId, 'remove');
                    
                    // Display the completed images
                    if (taskStatus.images && taskStatus.images.length > 0) {
                        taskStatus.images.forEach(image => {
                            window.parent.postMessage({
                                event: 'imageGenerated',
                                imageUrl: image.imageUrl,
                                imageId: image.imageId,
                                userChatId: taskStatus.userChatId,
                                title: image.title,
                                prompt: image.prompt,
                                nsfw: image.nsfw
                            }, '*');
                        });
                    }
                } else if (taskStatus.status === 'failed') {
                    clearInterval(pollInterval);
                    displayOrRemoveImageLoader(placeholderId, 'remove');
                    showNotification(window.translations.image_generation_failed || 'Image generation failed', 'error');
                }
            } catch (error) {
                console.error('Error polling background task:', error);
                clearInterval(pollInterval);
                displayOrRemoveImageLoader(placeholderId, 'remove');
            }
        }, 5000); // Poll every 5 seconds for background tasks
    }

    async function handleChatSuccess(data, fetch_reset, fetch_userId, userChatId) {
        $(document).find(`.chat-list.item[data-id="${chatId}"]`).addClass('active').siblings().removeClass('active');
       
        // Handle fetch_reset and isNew logic robustly

        isNew = (typeof fetch_reset === 'string' ? fetch_reset.toLowerCase() : fetch_reset) === true || 
            (typeof fetch_reset === 'string' ? fetch_reset.toLowerCase() : fetch_reset) === 'true'
            ? true
            : (typeof fetch_reset === 'string' ? fetch_reset.toLowerCase() : fetch_reset) === false || 
              (typeof fetch_reset === 'string' ? fetch_reset.toLowerCase() : fetch_reset) === 'false'
            ? false
            : typeof data.isNew !== 'undefined'
            ? data.isNew
            : true;

        if (!data.chat) {
            showDiscovery();
            return;
        }

        setupChatData(data.chat);
        setupChatInterface(data.chat, data.character);
        updateCurrentChat(chatId);

        if (!isNew) {
            displayExistingChat(data.userChat, data.character);
            await checkBackgroundTasks(chatId, userChatId);
        } else {
            displayInitialChatInterface(data.chat);
        }

        updateParameters(chatId, fetch_userId, userChatId);
        showChat();

        // Update custom prompts using the new PromptManager
        if (window.promptManager && fetch_userId) {
            window.promptManager.update(fetch_userId);
        }

        // Update gift permissions using the new GiftManager
        if (window.giftManager && fetch_userId) {
            window.giftManager.update(fetch_userId);
        }

        $('.fullscreen-overlay').fadeOut(); 
        $('#chat-list').fadeOut();
        $('#footer-toolbar').fadeOut();

        resetSuggestionsAndHide();
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
    const chatNsfw = chat.nsfw || false;
    $('#chat-container').attr('data-genre', gender);
    $('#promptContainer').attr('data-nsfw', chatNsfw).removeClass('nsfw').addClass(chatNsfw ? 'nsfw' : 'sfw');
    $('#giftsList').attr('data-nsfw', chatNsfw).removeClass('nsfw').addClass(chatNsfw ? 'nsfw' : 'sfw');
    if(gender === 'female'){
        $('#showPrompts').show();
        $('#userMessage').removeClass('male').addClass('female');
    }else{
        $('#showPrompts').hide();
        $('#userMessage').removeClass('female').addClass('male');
    }
    updateChatBackgroundImage(thumbnail);
    $('#chat-title').text(chatName);
    $('#userMessage').attr('placeholder', `${window.translations.sendMessage}`);

    const albumLink = $(`<a href="#" onclick="openCharacterModal('${chat._id}',event)"></a>`);
    albumLink.attr('data-bs-toggle', 'tooltip');
    albumLink.attr('title', `${window.translations.album || 'アルバム'}`);
    
    // Remove old classes and add the new styling class
    albumLink.removeClass('btn btn-light shadow-0 border border-3 border-dark rounded-circle shadow');
    albumLink.addClass('album-link-styled');

    // Clear any inline styles that might conflict or are now handled by the class
    albumLink.removeAttr('style'); 

    const imageCount = chat.imageCount ? chat.imageCount : 0;
    // Set the inner HTML with the icon and the new badge structure
    albumLink.empty().append(`<i class="bi bi-images"></i><span class="image-count image-count-badge" data-chat-id="${chat._id}">${imageCount}</span>`);

    new bootstrap.Tooltip(albumLink[0]);
    $('#chat-recommend').prepend(albumLink);
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
                const $chatContainer = $('#chatContainer');
                if ($chatContainer.length) {
                    // Wait for content to be rendered by checking if scrollHeight > 0
                    const checkAndScroll = () => {
                        const scrollHeight = $chatContainer.prop("scrollHeight");
                        const containerHeight = $chatContainer.height();
                        
                        if (scrollHeight > 0 && scrollHeight > containerHeight) {
                            $chatContainer.animate({
                                scrollTop: scrollHeight
                            }, 500);
                        } else if (scrollHeight === 0) {
                            // Retry after a short delay if content isn't ready
                            setTimeout(checkAndScroll, 100);
                        }
                    };
                    
                    checkAndScroll();
                }
            }, 1000);


            // Add suggestions after assistant message
            window.chatId = sessionStorage.getItem('chatId') || window.chatId;
            window.userChatId = sessionStorage.getItem('userChatId') || window.userChatId;


            if (window.chatSuggestionsManager && window.userId && window.chatId && window.userChatId) {
                setTimeout(() => {
                    window.chatSuggestionsManager.showSuggestions(
                        window.userId, 
                        window.chatId, 
                        window.userChatId
                    );
                }, 500);
            }
        });

        const today = new Date().toISOString().split('T')[0];
        if (userChat.log_success) {
            displayThankMessage();
        }
    }
    
    function displayInitialChatInterface(chat) {
        displayStarter(chat);
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
                        <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;cursor:pointer;" onclick="openCharacterInfoModal('${chatId}', event)">
                        <div class="audio-controller">
                            <button id="play-${uniqueId}" 
                            class="audio-content badge bg-dark rounded-pill shadow-sm border-light">►</button>
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
            success: async function(response) {

                userChatId = response.userChatId
                chatId = response.chatId
                if (window.PersonaModule) {
                    PersonaModule.currentUserChatId = userChatId;
                }
                sessionStorage.setItem('userChatId', userChatId);
                sessionStorage.setItem('lastChatId', chatId);
                sessionStorage.setItem('chatId', chatId);
            
                updateCurrentChat(chatId,userId);
                updateParameters(chatId,userId,userChatId);

                // Check if user should see settings before starting chat completion
                if (window.chatToolSettings) {
                    window.chatToolSettings.checkFirstTimeSettings(() => {
                        // This callback runs after settings modal is closed (or immediately if not first-time)
                        generateChatCompletion();
                    });
                } else {
                    // Fallback if settings not available
                    generateChatCompletion();
                }

            },
            error: function(xhr, status, error)  {
                console.error('Error:', error);
                displayMessage('bot', 'An error occurred while sending the message.',userChatId);
                
            }                    
        });
    }

    function updateSwiperTools(swiperId, activeIndex, images) {
        console.log(`[updateSwiperTools] Updating tools for swiper ${swiperId}, slide ${activeIndex}`);
        
        const toolsContainer = $(`.swiper-tools-container[data-swiper-id="${swiperId}"]`);
        if (!toolsContainer.length) {
            console.warn('[updateSwiperTools] Tools container not found');
            return;
        }
        
        const currentImage = images[activeIndex];
        if (!currentImage) {
            console.warn('[updateSwiperTools] No image data for index', activeIndex);
            return;
        }
        
        const chatId = sessionStorage.getItem('chatId') || window.chatId;
        const imgId = currentImage.imageId || currentImage.id;
        const imgUrl = currentImage.imageUrl || currentImage.url;
        
        const toolsHtml = getImageTools({
            chatId: chatId,
            imageId: imgId,
            isLiked: false,
            title: currentImage.title || '',
            prompt: currentImage.prompt || '',
            nsfw: currentImage.nsfw || false,
            imageUrl: imgUrl,
            isMergeFace: currentImage.isMerged || false
        });
        
        toolsContainer.html(toolsHtml);
        console.log(`[updateSwiperTools] ✅ Tools updated for image ${imgId}`);
    }

    // Handle double-tap on swiper images
    $(document).on('dblclick', '.swiper-slide img', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const imageId = $(this).data('id');
        console.log('[Double-tap] Image:', imageId);
        
        // Find the like button for this image in the tools container
        const $likeBtn = $(`.image-tools[data-id="${imageId}"] .like-image-btn`);
        if ($likeBtn.length) {
            $likeBtn.click();
        }
    });

    // Show image preview on single tap/click
    $(document).on('click', '.swiper-slide img', function(e) {
        // Only trigger if not a double-click
        if (e.detail === 1) {
            setTimeout(() => {
                if (e.detail === 1) {
                    showImagePreview(this);
                }
            }, 200);
        }
    });
    async function displayChat(userChat, persona, callback) {
        $('body').css('overflow', 'hidden');
        $('#stability-gen-button').show();
        $('.auto-gen').each(function() { $(this).show(); });
        $('#audio-play').show();
 
        let chatContainer = $('#chatContainer');
        chatContainer.empty();

        // Clear the tracking sets when displaying a new chat
        displayedMessageIds.clear();
        displayedImageIds.clear();
        displayedVideoIds.clear();

        for (let i = 0; i < userChat.length; i++) {
            let messageHtml = '';
            let chatMessage = userChat[i];
            
            // Create a unique identifier for each message
            const messageId = chatMessage._id || `${chatMessage.role}_${i}_${chatMessage.content ? chatMessage.content.substring(0, 50) : ''}`;
            
            // Skip if this message has already been displayed
            if (displayedMessageIds.has(messageId)) {
                continue;
            }

            if (chatMessage.role === "user") {
                const isStarter = chatMessage?.content?.startsWith("[Starter]") || chatMessage?.content?.startsWith("Invent a situation") || chatMessage?.content?.startsWith("Here is your character description");
                const isHidden = chatMessage?.hidden === true || chatMessage?.content?.startsWith("[Hidden]") || chatMessage?.name === 'master';
                const image_request = chatMessage.image_request
                if (!isStarter && !isHidden) {
                    messageHtml = `
                        <div class="d-flex flex-row justify-content-end mb-4 message-container" style="position: relative;">
                            <div class="p-3 me-3 border-0 text-start user-message" style="border-radius: 15px; background-color: #fbfbfbdb;">
                                ${marked.parse(chatMessage.content)}
                            </div>
                            ${persona ? `<img src="${persona.chatImageUrl || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle user-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">` : ''}
                            ${image_request ? `<i class="bi bi-image message-icon" style="position: absolute; top: 0; right: 25px;opacity: 0.7;"></i>` : ''}
                        </div>
                    `;
                    displayedMessageIds.add(messageId);
                }
            } else if (chatMessage.role === "assistant") {

                const isNarratorMessage = chatMessage.content.startsWith("[Narrator]");
                const isImage = !!chatMessage?.imageId || chatMessage.content.startsWith("[Image]") || chatMessage.content.startsWith("[image]");
                const isVideo = !!chatMessage?.videoId || chatMessage.content.startsWith("[Video]") || chatMessage.content.startsWith("[video]");
                const isMergeFace = !!chatMessage?.mergeId || chatMessage.content.startsWith("[MergeFace]");
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
                    displayedMessageIds.add(messageId);
                } else if (isMergeFace) {
                    const mergeId = chatMessage?.mergeId || chatMessage.content.replace("[MergeFace]", "").replace("[mergeface]", "").trim();
                    console.log(`Processing merge face with ID: ${mergeId}`);
                                        
                    // Skip if this specific merge face instance has already been displayed
                    const uniqueMergeIdentifier = `${mergeId}_${i}_${messageId}`;
                    if (displayedImageIds.has(uniqueMergeIdentifier)) {
                        continue;
                    }
                    
                    // If this is a stored merged image (from database), display it directly
                    if (chatMessage.imageUrl && chatMessage.isMerged) {
                        messageHtml = `
                            <div id="container-${designStep}">
                                <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                    <img 
                                    src="${thumbnail || '/img/logo.webp'}" 
                                    alt="avatar 1" 
                                    class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;"
                                    onclick="openCharacterInfoModal('${chatId}', event)">
                                    <div class="ms-3 position-relative">
                                        <div 
                                        onclick="showImagePreview(this)"
                                        class="ps-0 text-start assistant-image-box vertical-transition">
                                            <img id="merge-${mergeId}" data-id="${mergeId}" src="${chatMessage.imageUrl}" alt="Merged Face Result" data-prompt="Face merge completed">
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                            
                        // Add tools for the merged image
                        setTimeout(() => {
                            const toolsHtml = getImageTools({
                                chatId, 
                                imageId: mergeId, 
                                isLiked: false,
                                title: chatMessage.title || '[displayChat 822] Auto Merged Image', 
                                prompt: chatMessage.prompt || '[displayChat 823] Auto merged image', 
                                nsfw: false, 
                                imageUrl: chatMessage.imageUrl,
                                isMergeFace: true
                            });
                            $(`#merge-${mergeId}`).closest('.assistant-image-box').after(toolsHtml);
                        }, 100);
                        
                        displayImageThumb(chatMessage.imageUrl);
                        displayedImageIds.add(uniqueMergeIdentifier);
                        displayedMessageIds.add(messageId);
                    } else {
                        // Legacy handling for old merge face references
                        const mergeData = await getMergeFaceUrlById(mergeId, designStep, thumbnail);
                        messageHtml = mergeData ? mergeData.messageHtml : '';
                    }
                    
                    if (messageHtml) {
                        displayedImageIds.add(uniqueMergeIdentifier);
                        displayedMessageIds.add(messageId);
                    }
                } else if (isImage) {
                    const imageId = chatMessage?.imageId || chatMessage.content.replace("[Image]", "").replace("[image]", "").trim();
                    
                    if (displayedImageIds.has(imageId)) {
                        continue;
                    }
                    
                    // NEW: Handle multiple images in chat history
                    if (Array.isArray(chatMessage.images) && chatMessage.images.length > 1) {
                        console.log(`[displayChat] 🎨 Multi-image message found: ${chatMessage.images.length} images`);
                        
                        const uniqueSwiperId = `chat-history-swiper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        
                        const slidesHtml = chatMessage.images.map((img, idx) => {
                            const imgUrl = img.imageUrl || img.url;
                            const imgId = img.imageId || img.id || `${imageId || 'hist'}-${idx}`;
                            const alt = (chatMessage.title && typeof chatMessage.title === 'object') 
                                ? (chatMessage.title[lang] || chatMessage.title.en || '') 
                                : (chatMessage.title || 'Generated Image');
                            
                            displayedImageIds.add(imgId);
                            
                            return `
                                <div class="swiper-slide">
                                    <img id="image-${imgId}" 
                                         data-id="${imgId}" 
                                         src="${imgUrl}" 
                                         alt="${alt}" 
                                         data-prompt="${img.prompt || ''}"
                                         data-nsfw="${img.nsfw || false}"
                                         data-isMergeFace="${img.isMerged || false}"
                                         style="max-width: 100%; height: auto; margin: 0 auto; display: block;">
                                </div>
                            `;
                        }).join('');

                        messageHtml = `
                            <div id="container-${designStep}">
                                <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                    <img src="${thumbnail || '/img/logo.webp'}" 
                                         alt="avatar" 
                                         class="rounded-circle chatbot-image-chat" 
                                         data-id="${chatId}" 
                                         style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;"
                                         onclick="openCharacterInfoModal('${chatId}', event)">
                                    <div class="ms-3 position-relative">
                                        <div id="${uniqueSwiperId}" class="swiper" style="max-width:420px;">
                                            <div class="swiper-wrapper">
                                                ${slidesHtml}
                                            </div>
                                            <div class="swiper-button-prev"></div>
                                            <div class="swiper-button-next"></div>
                                            <div class="swiper-pagination"></div>
                                        </div>
                                        <div class="swiper-tools-container" data-swiper-id="${uniqueSwiperId}"></div>
                                    </div>
                                </div>
                            </div>`;

                        // Initialize swiper and tools after append
                        setTimeout(() => {
                            try {
                                const swiperEl = document.getElementById(uniqueSwiperId);
                                if (swiperEl && typeof Swiper === 'function' && !swiperEl.dataset.initialized) {
                                    const swiperInstance = new Swiper(`#${uniqueSwiperId}`, {
                                        loop: false,
                                        slidesPerView: 1,
                                        spaceBetween: 10,
                                        navigation: {
                                            nextEl: `#${uniqueSwiperId} .swiper-button-next`,
                                            prevEl: `#${uniqueSwiperId} .swiper-button-prev`,
                                        },
                                        pagination: { 
                                            el: `#${uniqueSwiperId} .swiper-pagination`, 
                                            clickable: true,
                                            dynamicBullets: true
                                        },
                                        on: {
                                            slideChange: function() {
                                                updateSwiperTools(uniqueSwiperId, this.activeIndex, chatMessage.images);
                                            }
                                        }
                                    });
                                    swiperEl.dataset.initialized = 'true';
                                    console.log('[displayChat] ✅ History swiper initialized:', uniqueSwiperId);
                                    
                                    // Initialize tools for first slide
                                    updateSwiperTools(uniqueSwiperId, 0, chatMessage.images);
                                }
                            } catch (e) {
                                console.error('[displayChat] ❌ Error initializing history swiper:', e);
                            }
                        }, 150);

                        displayImageThumb(chatMessage.images[0].imageUrl || chatMessage.images[0].url);
                    }
                    // Check if this is actually a merged image stored as regular image
                    if (chatMessage.isMerged && chatMessage.imageUrl) {
                        // This is a merged image stored in the database, display it directly
                        messageHtml = `
                            <div id="container-${designStep}">
                                <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                    <img src="${thumbnail || '/img/logo.webp'}" 
                                    alt="avatar 1" 
                                    class="rounded-circle chatbot-image-chat" 
                                    data-id="${chatId}" 
                                    style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;"
                                    onclick="openCharacterInfoModal('${chatId}', event)">
                                    <div class="ms-3 position-relative">
                                        <div 
                                        onclick="showImagePreview(this)"
                                        class="ps-0 text-start assistant-image-box vertical-transition">
                                            <img id="image-${imageId}" data-id="${imageId}" src="${chatMessage.imageUrl}" alt="${chatMessage.title || 'Merged Image'}" data-prompt="${chatMessage.prompt || 'Auto merged image'}">
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                        
                        // Add tools for the merged image
                        setTimeout(() => {
                            const toolsHtml = getImageTools({
                                chatId, 
                                imageId, 
                                isLiked: false,
                                title: chatMessage.title || '[displayhat 874] Auto Merged Image', 
                                prompt: chatMessage.prompt || '[displayhat 875] Auto merged image', 
                                nsfw: chatMessage.nsfw || false, 
                                imageUrl: chatMessage.imageUrl,
                                isMergeFace: true
                            });
                            $(`#image-${imageId}`).closest('.assistant-image-box').after(toolsHtml);
                            
                            if (chatMessage.nsfw) {
                                $(`#image-${imageId}`).closest('.assistant-image-box').find('.nsfw-badge-container').show();
                            }
                        }, 100);
                        
                        displayImageThumb(chatMessage.imageUrl);
                    } else {
                        // Regular image handling - fetch from API
                        let actions = chatMessage.actions || null;
                        const imageData = await getImageUrlById(imageId, designStep, thumbnail, actions);
                        messageHtml = imageData ? imageData.messageHtml : '';
                    }
                    
                    if (messageHtml) {
                        displayedImageIds.add(imageId);
                        displayedMessageIds.add(messageId);
                    }
                } else if (isVideo) {
                    const videoId = chatMessage?.videoId || chatMessage.content.replace("[Video]", "").replace("[video]", "").trim();
                    // Skip if this video has already been displayed
                    if (displayedVideoIds.has(videoId)) {
                        continue;
                    }
                    
                    const videoData = await getVideoUrlById(videoId, designStep, thumbnail);
                    messageHtml = videoData.messageHtml;
                    
                    if (messageHtml) {
                        displayedVideoIds.add(videoId);
                        displayedMessageIds.add(messageId);
                    }
                } else {
                    const isHidden = chatMessage?.hidden === true || chatMessage.content.startsWith("[Hidden]") ;
                    if (chatMessage.content && !isHidden) {
                        let message = formatMessageText(chatMessage.content);
                        
                        // Check if this is the last assistant message
                        const isLastMessage = i === userChat.length - 1 && chatMessage.role === "assistant";
                        const messageActions = chatMessage.actions || [];
                        
                        messageHtml = `
                            <div id="container-${designStep}">
                                <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;" onclick="openCharacterInfoModal('${chatId}', event)">
                                    <div class="audio-controller">
                                        <button id="play-${designStep}" 
                                        class="audio-content badge bg-dark rounded-pill shadow-sm border-light" data-content="${message}">►</button>
                                    </div>
                                    <div id="message-${designStep}" class="p-3 ms-3 text-start assistant-chat-box position-relative">
                                        ${marked.parse(chatMessage.content)}
                                        ${getMessageTools(i, messageActions, isLastMessage, true, chatMessage)}
                                    </div>
                                </div>
                            </div>
                        `;
                        displayedMessageIds.add(messageId);
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

    window.downloadImage = function(element) {
        const $element = $(element);
        const imageUrl = $element.attr('data-src') || $element.attr('src');
        const imageTitle = $element.attr('data-title') || 'image';
        const imageId = $element.attr('data-id');
        
        if (!imageUrl) {
            showNotification(window.translations?.download_error || 'Image URL not found', 'error');
            return;
        }
        
        // Show loading state
        const originalIcon = $element.find('i').attr('class');
        $element.find('i').attr('class', 'bi bi-download spinner-border spinner-border-sm');
        
        // Create download link and trigger download
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${imageTitle || 'image'}_${imageId || Date.now()}.jpg`;
        link.target = '_blank'; // Fallback for browsers that don't support download attribute
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Restore original icon
        $element.find('i').attr('class', originalIcon);
        
        // Show success notification
        showNotification(window.translations?.download_success || 'Download started', 'success');
    };


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

    function getMergeFaceUrlById(mergeId, designStep, thumbnail) {
        console.log(`[getMergeFaceUrlById] Fetching merge face for ID: ${mergeId}, design step: ${designStep}`);
        const placeholderImageUrl = '/img/placeholder-image-2.gif';

        return new Promise((resolve) => {
            const placeholderHtml = `
            <div id="container-${designStep}">
                <div class="d-flex flex-row justify-content-start mb-4 message-container">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;" onclick="openCharacterInfoModal('${chatId}', event)">
                    <div class="ms-3 position-relative">
                        <div 
                        onclick="showImagePreview(this)"
                        class="ps-0 text-start assistant-image-box vertical-transition">
                            <img id="merge-${mergeId}" data-id="${mergeId}" src="${placeholderImageUrl}" alt="Loading merged image...">
                        </div>
                    </div>
                </div>
            </div>`;
            resolve({ messageHtml: placeholderHtml, imageUrl: placeholderImageUrl });

            // Fetch merged image asynchronously using the new route
            $.ajax({
                url: `/api/merge-face/result/${mergeId}`, // Use the new route
                method: 'GET',
                success: function(response) {
                    if (response.success && response.result) {
                        const mergeResult = response.result;
                        const mergedImageUrl = mergeResult.mergedImageUrl;
                        console.log(response)
                        // Update the placeholder image
                        displayImageThumb(mergedImageUrl);
                        $(`#merge-${mergeId}`).attr('src', mergedImageUrl).fadeIn();
                        $(`#merge-${mergeId}`).attr('alt', 'Merged Face Result').fadeIn();
                        $(`#merge-${mergeId}`).attr('data-prompt', 'Face merge completed');
                        
                        // Add tools for merged face image
                        const toolsHtml = getImageTools({
                            chatId, 
                            imageId: mergeId, 
                            isLiked: false,
                            title: 'Merged Face Result', 
                            prompt: 'Face merge completed', 
                            nsfw: false, 
                            imageUrl: mergedImageUrl,
                            isMergeFace: true
                        });
                        $(`#merge-${mergeId}`).closest('.assistant-image-box').after(toolsHtml);
        
                    } else {
                        console.error('No merged image URL returned');
                        $(`#merge-${mergeId}`).attr('src', '/img/error-placeholder.png');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching merged image URL:', error);
                    $(`#merge-${mergeId}`).attr('src', '/img/error-placeholder.png');
                }
            });
        });
    }


    function getImageUrlById(imageId, designStep, thumbnail, actions = null) {
        const placeholderImageUrl = '/img/placeholder-image-2.gif'; // Placeholder image URL

        // Return immediately with placeholder and update asynchronously
        return new Promise((resolve) => {
            const placeholderHtml = `
            <div id="container-${designStep}">
                <div class="d-flex flex-row justify-content-start mb-4 message-container">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;" onclick="openCharacterInfoModal('${chatId}', event)">
                    <div class="ms-3 position-relative">
                        <div 
                        onclick="showImagePreview(this)"
                        class="ps-0 text-start assistant-image-box vertical-transition" style="position: relative;">
                            <img id="image-${imageId}" data-id="${imageId}" src="${placeholderImageUrl}" alt="Loading image...">
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

                        // Apply NSFW logic
                        const item = { nsfw: response.nsfw };
                        const subscriptionStatus = user.subscriptionStatus === 'active';
                        const isTemporary = !!user.isTemporary;
                        
                        const shouldBlur = shouldBlurNSFW(item, subscriptionStatus);
                        const displayMode = getNSFWDisplayMode(item, subscriptionStatus);
                        
                        // Update the placeholder image
                        displayImageThumb(response.imageUrl, null, shouldBlur);
                        
                        if (shouldBlur || displayMode !== 'show') {
                            // Apply blur effect - set data-src and add blur class
                            $(`#image-${imageId}`).attr('data-src', response.imageUrl);
                            $(`#image-${imageId}`).addClass('img-blur');
                            $(`#image-${imageId}`).closest('.assistant-image-box').addClass('isBlurred');
                            
                            // Apply blur image processing
                            blurImage($(`#image-${imageId}`)[0]);
                            
                        } else {
                            // Image is safe to show - set src normally
                            $(`#image-${imageId}`).attr('src', response.imageUrl).fadeIn();
                            // Update the alt text
                            const title = response?.title?.[lang]?.trim() || '';
                            $(`#image-${imageId}`).attr('alt', title);
                            //update the image prompt
                            $(`#image-${imageId}`).attr('data-prompt', response.imagePrompt);
                        }

                        if (!response.isUpscaled) {
                            const toolsHtml = getImageTools({
                                chatId, 
                                imageId, 
                                isLiked: response?.likedBy?.some(id => id.toString() === userId.toString()),
                                title: response?.title?.[lang], 
                                prompt: response.imagePrompt, 
                                nsfw: response.nsfw, 
                                imageUrl: response.imageUrl,
                                isMergeFace: response.isMergeFace,
                                actions
                            });
                            $(`#image-${imageId}`).closest('.assistant-image-box').after(toolsHtml);

                            if (shouldBlur || displayMode !== 'show') {
                                $(`.image-tools[data-id="${imageId}"]`).hide();
                            }
                            
                            if (response.nsfw) {
                                $(`#image-${imageId}`).closest('.assistant-image-box').find('.nsfw-badge-container').show();
                            }
                        }
                    } else {
                        console.error('No image URL returned');
                        return false;
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching image URL:', error);
                }
            });
        });
    }

    function getVideoUrlById(videoId, designStep, thumbnail) {
        const placeholderVideoUrl = '/img/video-placeholder.gif'; // Placeholder video URL

        // Return immediately with placeholder and update asynchronously
        return new Promise((resolve) => {
            const placeholderHtml = `
            <div id="container-${designStep}">
                <div class="d-flex flex-row justify-content-start mb-4 message-container">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;" onclick="openCharacterInfoModal('${chatId}', event)">
                    <div class="ms-3 position-relative" style="max-width: 200px;">
                        <div class="ps-0 text-start assistant-video-box">
                            <div id="video-${videoId}" class="video-loading-placeholder">
                                <img src="${placeholderVideoUrl}" alt="Loading video...">
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            resolve({ messageHtml: placeholderHtml, videoUrl: placeholderVideoUrl });

            // Fetch video asynchronously and update the DOM
            $.ajax({
                url: `/api/video/${videoId}`,
                method: 'GET',
                success: function(response) {
                    if (response.videoUrl) {
                        // Replace placeholder with actual video
                        const videoHtml = `
                            <video 
                                controls 
                                class="generated-video" 
                                style="max-width: 100%; border-radius: 15px;"
                                data-video-id="${videoId}"
                            >
                                <source src="${response.videoUrl}" type="video/mp4">
                                ${window.translations?.video_not_supported || 'Your browser does not support the video tag.'}
                            </video>
                        `;
                        
                        $(`#video-${videoId}`).replaceWith(videoHtml);
                        
                        // Add video tools
                        const toolsHtml = getVideoTools(response.videoUrl, response.duration, videoId);
                        $(`[data-video-id="${videoId}"]`).closest('.assistant-video-box').after(toolsHtml);
                    } else {
                        console.error('No video URL returned');
                        $(`#video-${videoId}`).html('<div class="text-muted">Video unavailable</div>');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching video URL:', error);
                    $(`#video-${videoId}`).html('<div class="text-muted">Error loading video</div>');
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
            generateChatCompletion()
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

    
    function formatMessageText(str) {
        if (!str) { return str; }
        // Text between * in bold
        return str.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    }

    // Add a global variable to track active rendering processes
    const activeRenderProcesses = new Set();

    // Display completion message character by character
    window.displayCompletionMessage = function(message, uniqueId) {
        // Check if this message is already being rendered
        if (activeRenderProcesses.has(uniqueId)) {
            console.warn(`Message ${uniqueId} is already being rendered, skipping duplicate`);
            return;
        }
        
        // Add this process to active renders
        activeRenderProcesses.add(uniqueId);
        
        const completionElement = $(`#completion-${uniqueId}`);
        
        // Check if the message has already been fully rendered
        const currentText = completionElement.text().trim();
        if (currentText === message.trim()) {
            console.log(`Message ${uniqueId} already fully rendered, skipping`);
            activeRenderProcesses.delete(uniqueId);
            afterStreamEnd(uniqueId, message);
            return;
        }
        
        // Clear any existing content except loading gif
        completionElement.find('img').fadeOut().remove();
        
        // Get already rendered text length to continue from where we left off
        const alreadyRendered = currentText.length;
        const graphemes = [...message.slice(alreadyRendered)];
        const CHUNK_SIZE = 1;
    
        function renderChunk() {
            // Double-check if process is still active (in case of cleanup)
            if (!activeRenderProcesses.has(uniqueId)) {
                return;
            }
            
            // Check if element still exists
            if (!$(`#completion-${uniqueId}`).length) {
                activeRenderProcesses.delete(uniqueId);
                return;
            }
            
            for (let i = 0; i < CHUNK_SIZE && graphemes.length; i++) {
                const textNode = document.createTextNode(graphemes.shift());
                $(`#completion-${uniqueId}`).append(textNode);
            }
            
            if (graphemes.length > 0) {
                requestAnimationFrame(renderChunk);
            } else {
                // Rendering complete, clean up
                activeRenderProcesses.delete(uniqueId);
                afterStreamEnd(uniqueId, $(`#completion-${uniqueId}`).text());
            }
        }
        
        autoPlayMessageAudio(uniqueId, message);
        requestAnimationFrame(renderChunk);
    };

    // Add cleanup function for when containers are removed
    window.hideCompletionMessage = function(uniqueId) {
        // Clean up active render process
        activeRenderProcesses.delete(uniqueId);
        $(`#completion-${uniqueId}`).closest('message-container').closest('div').fadeOut().remove();
    }


    // Update the createBotResponseContainer function to use the new structure
    function createBotResponseContainer(uniqueId) {
        // Clean up any existing process with same ID
        activeRenderProcesses.delete(uniqueId);
        
        const container = $(`
            <div id="container-${uniqueId}">
                <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                    <img src="${thumbnail ? thumbnail : '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width:45px;width:45px;height:45px;border-radius:15%;object-fit:cover;object-position:top;cursor:pointer;" onclick="openCharacterInfoModal('${chatId}', event)">
                    <div class="audio-controller">
                        <button id="play-${uniqueId}" 
                        class="audio-content badge bg-dark rounded-pill shadow-sm border-light">►</button>
                    </div>
                    <div class="ms-3 p-3 text-start assistant-chat-box flex-grow-1 position-relative">
                        <div id="completion-${uniqueId}""><img src="/img/load-dot.gif" width="50px"></div>
                        <!-- Message tools will be added here after streaming completes -->
                    </div>
                </div>
            </div>`).hide();
        $('#chatContainer').append(container);
        container.addClass('animate__animated animate__slideInUp').fadeIn();
        return container;
    }

    function afterStreamEnd(uniqueId, markdownContent) {
        let msg = formatMessageText(markdownContent);
        $(`#play-${uniqueId}`).attr('data-content', msg);
        $(`#play-${uniqueId}`).closest('.audio-controller').show();
        
        // Add message tools after streaming is complete
        const messageContainer = $(`#container-${uniqueId}`);
        if (messageContainer.length) {
            // Get the current message index (count of all messages in the chat)
            const currentMessageIndex = $('#chatContainer .assistant-chat-box').length - 1;
            
            // Check if this is the last message (should be true for new messages)
            const isLastMessage = true;
        
            // Create message data object for tools
            const messageData = {
                _id: null, // Will be set when message is saved to DB
                content: markdownContent,
                timestamp: Date.now(),
                role: 'assistant'
            };
            
            // Add message tools
            const toolsHtml = getMessageTools(currentMessageIndex, [], isLastMessage, true, messageData);

            // Find the position-relative container and add tools to it
            const relativeContainer = messageContainer.find('.position-relative').last();
            if (relativeContainer.length && !relativeContainer.find('.message-tools-controller').length) {
                relativeContainer.append(toolsHtml);
            }

        }

        // Add suggestions after assistant message
        window.chatId = sessionStorage.getItem('chatId') || window.chatId;
        window.userChatId = sessionStorage.getItem('userChatId') || window.userChatId;


        if (window.chatSuggestionsManager && window.userId && window.chatId && window.userChatId) {
            setTimeout(() => {
                window.chatSuggestionsManager.showSuggestions(
                    window.userId, 
                    window.chatId, 
                    window.userChatId
                );
            }, 500);
        }
    }

    // Hide the completion message container
    window.hideCompletion = function(uniqueId) {
        $(`#completion-${uniqueId}`).fadeOut();
    };

    window.generateChatCompletion = function(callback, isHidden = false) {
        const uniqueId = `${currentStep}-${Date.now()}`;
        const container = createBotResponseContainer(uniqueId); 
        // Hide chat suggestions when completion starts
        if (window.chatSuggestionsManager) {
            window.chatSuggestionsManager.hide();
        }
        $.ajax({
            url: API_URL + '/api/openai-chat-completion',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ userId, chatId, userChatId, isHidden, uniqueId }),
            success: function() {
                // Remove all regenerate buttons from previous messages
                $('#chatContainer .message-regenerate-btn').fadeOut(300, function() {
                    $(this).remove();
                });
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
                        <div class="p-3 me-3 border-0 text-start user-message" style="border-radius: 15px; background-color: #fbfbfbdb;">
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
            
            // Check if this is a multi-image swiper wrapper
            if (message.classList.contains('chat-image-swiper-wrapper')) {
                const swiperId = message.getAttribute('data-swiper-id');
                
                console.log('[displayMessage] 🎨 Multi-image swiper detected:', swiperId);
                
                messageElement = $(`
                    <div class="d-flex flex-row justify-content-start mb-4 message-container ${messageClass} ${animationClass}">
                        <img src="${thumbnail || '/img/logo.webp'}" 
                             alt="avatar" 
                             class="rounded-circle chatbot-image-chat" 
                             data-id="${chatId}" 
                             style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;" 
                             onclick="openCharacterInfoModal('${chatId}', event)">
                        <div class="ms-3 position-relative">
                            <div class="chat-swiper-container"></div>
                            <div class="swiper-tools-container" data-swiper-id="${swiperId}"></div>
                        </div>
                    </div>
                `).hide();
    
                const $container = messageElement.find('.chat-swiper-container');
                $container.append(message);
    
                $('#chatContainer').append(messageElement);
                messageElement.addClass(animationClass).fadeIn();
    
                // Initialize swiper after DOM insertion
                setTimeout(() => {
                    try {
                        const swiperEl = document.getElementById(swiperId);
                        if (swiperEl && typeof Swiper === 'function' && !swiperEl.dataset.initialized) {
                            
                            // Get images data from the wrapper
                            const imagesData = [];
                            swiperEl.querySelectorAll('.swiper-slide img').forEach(img => {
                                imagesData.push({
                                    imageId: img.getAttribute('data-id'),
                                    id: img.getAttribute('data-id'),
                                    imageUrl: img.src,
                                    url: img.src,
                                    prompt: img.getAttribute('data-prompt'),
                                    title: img.alt,
                                    nsfw: img.getAttribute('data-nsfw') === 'true',
                                    isMerged: img.getAttribute('data-isMergeFace') === 'true'
                                });
                            });
                            
                            const swiperInstance = new Swiper(`#${swiperId}`, {
                                loop: false,
                                slidesPerView: 1,
                                spaceBetween: 10,
                                pagination: { 
                                    el: `#${swiperId} .swiper-pagination`, 
                                    clickable: true,
                                    dynamicBullets: true
                                },
                                navigation: {
                                    nextEl: `#${swiperId} .swiper-button-next`,
                                    prevEl: `#${swiperId} .swiper-button-prev`,
                                },
                                centeredSlides: true,
                                on: {
                                    slideChange: function() {
                                        updateSwiperTools(swiperId, this.activeIndex, imagesData);
                                    }
                                }
                            });
                            swiperEl.dataset.initialized = 'true';
                            console.log('[displayMessage] ✅ Swiper initialized:', swiperId);
                            
                            // Initialize tools for first slide
                            updateSwiperTools(swiperId, 0, imagesData);
                        }
                    } catch (e) {
                        console.error('[displayMessage] ❌ Swiper init error:', e);
                    }
                }, 100);
                
                console.log('[displayMessage] ⏭️ Skipping thumbnail (already handled by generateImage)');
                
                return;
            }
            
            // Single image handling (existing code)
            const imageId = message.getAttribute('data-id') || null;
            const imageNsfw = (message.getAttribute('data-nsfw') == 'true') || false;
            const title = message.getAttribute('alt') || '';
            const prompt = message.getAttribute('data-prompt') || '';
            const imageUrl = message.getAttribute('src') || null;
            const isUpscaled = message.getAttribute('data-isUpscaled') == 'true'
            const isMergeFace = message.getAttribute('data-isMergeFace') == 'true'
    
            const item = { nsfw: imageNsfw };
            const subscriptionStatus = user.subscriptionStatus === 'active';
            
            const shouldBlur = shouldBlurNSFW(item, subscriptionStatus);
            const displayMode = getNSFWDisplayMode(item, subscriptionStatus);

            if (shouldBlur) {
                message.removeAttribute('src');
                message.setAttribute('data-src', imageUrl);
                message.classList.add('img-blur');
            }

            let nsfwOverlay = '';
            const isTemporary = !!user.isTemporary;
            
            messageElement = $(`
                <div class="d-flex flex-row justify-content-start mb-4 message-container ${messageClass} ${animationClass}">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;" onclick="openCharacterInfoModal('${chatId}', event)">
                    <div class="ms-3 position-relative">
                        <div 
                        onclick="showImagePreview(this)" 
                        class="ps-0 text-start assistant-image-box vertical-transition ${shouldBlur ? 'isBlurred' : '' }" data-id="${imageId}" style="position: relative;">
                            ${message.outerHTML}
                            ${nsfwOverlay}
                        </div>
                        ${!isUpscaled ? getImageTools({chatId, imageId, isLiked:false, title, prompt, nsfw: imageNsfw, imageUrl, isMergeFace}) : ''}
                    </div>
                </div>      
            `).hide();

            $('#chatContainer').append(messageElement);
            messageElement.addClass(animationClass).fadeIn();
            
            if (shouldBlur || displayMode !== 'show') {
                $(`.image-tools[data-id="${imageId}"]`).hide();
                messageElement.find('.img-blur').each(function() {
                    blurImage(this);
                });
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
                            class="text-start assistant-image-box vertical-transition" data-id="${imageId}">
                            ${message.outerHTML}
                        </div>
                        ${getImageTools({chatId, imageId, isLiked:false, title, prompt, nsfw: imageNsfw, imageUrl})}
                    </div>  
            `).hide();
            $(`#${messageId}`).find('.load').remove()
            $(`#${messageId}`).append(messageElement);
            messageElement.addClass(animationClass).fadeIn();
        } 
    
        else if (messageClass === 'assistant' && typeof message === 'string' && message.trim() !== '') {
            const uniqueId = `completion-${currentStep}-${Date.now()}`;
            messageElement = $(`
                <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container ${animationClass}">
                    <img src="${thumbnail || '/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top; cursor:pointer;" onclick="openCharacterInfoModal('${chatId}', event)">
                    <div class="audio-controller">
                        <button id="play-${uniqueId}" 
                        class="audio-content badge bg-dark rounded-pill shadow-sm border-light" 
                        data-content="${message}">►</button>
                    </div>
                    <div id="${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box position-relative">
                        ${marked.parse(message)}
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

    initializeAudio();

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



window.displayImageThumb = function(imageUrl, origineUserChatId = null, shouldBlur = false) {
    if (shouldBlur) {
        return;
    }
    const messageContainer = $(`#chatContainer[data-id=${origineUserChatId}]`);
    if (origineUserChatId && messageContainer.length == 0) {
        return;
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
};

//.reset-chat,.new-chat
window.handleChatReset = function(el) {
    chatId = $(el).data('id') || localStorage.getItem('chatId');
    if (chatId == null) {
        console.error('[handleChatReset] No chatId found in localStorage');
        return;
    }
    fetchChatData(chatId, userId, true);
};

window.regenImage = function(el){
    const button_ico = $(el).find('i');
    if(button_ico.hasClass('spin')){
        showNotification(window.translations.image_generation_processing,'warning')
        return
    }
    button_ico.addClass('spin')
    
    const imageNsfw = $(el).attr('data-nsfw') == 'true' ? 'nsfw' : 'sfw'
    const imagePrompt = $(el).data('prompt')
    const placeholderId = $(el).data('id')
    displayOrRemoveImageLoader(placeholderId, 'show');

    if($(el).hasClass('txt2img')){
        novitaImageGeneration(userId, chatId, userChatId, {prompt:imagePrompt, imageNsfw, placeholderId, regenerate:true})
        .then(data => {
            if(data.error){
                displayOrRemoveImageLoader(placeholderId, 'remove');
                button_ico.removeClass('spin');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            displayOrRemoveImageLoader(placeholderId, 'remove');
            button_ico.removeClass('spin');
        });
    }
};


// call fetchchatdata function accross other scripts
function callFetchChatData(fetch_chatId, fetch_userId, fetch_reset, callback){
    fetchChatData(fetch_chatId, fetch_userId, fetch_reset, callback);
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
  
window.addMessageToChat = function(chatId, userChatId, option, callback) {
    const { message, role, name, hidden, image_request } = option;
    $.ajax({
        url: '/api/chat/add-message',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            chatId: chatId,
            userChatId: userChatId,
            role: role,
            name: name || null,
            hidden: hidden || false,
            message: message,
            image_request: image_request || null
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

window.resetChatUrl = function() {
    var currentUrl = window.location.href;
    var urlParts = currentUrl.split('/');
    urlParts[urlParts.length - 1] = '';
    var newUrl = urlParts.join('/');
    window.history.pushState({ path: newUrl }, '', newUrl);
    sessionStorage.setItem('lastChatId', null);
}
window.showChat = function() {
    $('.onchat-off').hide()
    $('.onchat-off').addClass('d-none').css({
        'opacity': 0,
        'pointer-events': 'none',
        'visibility': 'hidden'
    });    

    $('.onchat-on').each(function() {
        if ($(this).attr('data-display-flex')) {
            $(this).css('display', 'flex');
        }
    });
    $('.onchat-on').show()
    $('.onchat-on').removeClass('d-none').css({
        'opacity': '',
        'pointer-events': '',
        'visibility': ''
    }); 
}

// Add this at the top of the file with other global variables
const upscaledImages = new Set();

window.upscaleImage = async function(imageId, imageUrl, chatId, userChatId) {
    try {
        const upscaleButton = $(`.upscale-img[data-id="${imageId}"]`);
        if (!imageId || !imageUrl) {
            showNotification('Invalid image data', 'error');
            return;
        }
        
        // Check if image has already been upscaled
        if (upscaledImages.has(imageId)) {
            showNotification(window.translations?.already_upscaled || 'This image has already been upscaled', 'warning');
            return;
        }
        
        if( upscaleButton.hasClass('disabled')) {
            showNotification(window.translations?.upscaling_in_progress || 'Upscaling in progress...', 'warning');
            return;
        }
        
        // Add to upscaled set to prevent duplicate upscaling
        upscaledImages.add(imageId);

        // Show loading notification
        showNotification(window.translations?.upscaling_image || 'Upscaling image...', 'info');

        // Disable the button
        upscaleButton.addClass('disabled').attr('disabled', true);
        upscaleButton.find('i').removeClass('bi-badge-hd').addClass('bi-badge-hd-fill text-success');
        
        // Convert image URL to base64
        const base64Response = await fetch('/api/convert-url-to-base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: imageUrl })
        });

        if (!base64Response.ok) {
            throw new Error('Failed to convert image to base64');
        }

        const { base64Image } = await base64Response.json();

        // Create placeholder for upscaled image
        const placeholderId = `upscale_${Date.now()}_${imageId}`;
        displayOrRemoveImageLoader(placeholderId, 'show');

        // Call upscale API
        const upscaleResponse = await fetch('/novita/upscale-img', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                chatId,
                userChatId,
                originalImageId: imageId,
                image_base64: base64Image,
                originalImageUrl: imageUrl,
                placeholderId,
                scale_factor: 2,
                model_name: 'RealESRGAN_x4plus_anime_6B'
            })
        });

        if (!upscaleResponse.ok) {
            throw new Error('Failed to start upscale process');
        }

        const result = await upscaleResponse.json();
        
    } catch (error) {
        console.error('Error upscaling image:', error);
        // Remove from upscaled set if there was an error
        upscaledImages.delete(imageId);
        showNotification(window.translations?.upscale_error || 'Failed to upscale image', 'error');
    }
};