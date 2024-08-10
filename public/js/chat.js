$(document).ready(function() {
    let API_URL = ""
    let MODE = "" 
    fetchMode(function(error,mode){
        MODE = mode
        if(mode != 'local'){
            API_URL = "https://lamix.hatoltd.com"
        }
        localStorage.setItem('MODE',mode)
        localStorage.setItem('API_URL',API_URL)
        fetchUser(function(error, user){
            let chatId = getIdFromUrl(window.location.href) || $(`#lamix-chat-widget`).data('id');
            let userChatId
            const userId = user._id
            localStorage.setItem('userId', userId);
            let currentStep = 0;
            let totalSteps = 0;
            let chatData = {};
            let isNew = true;
            let feedback = false
            let thumbnail = false
            let isTemporary = user.isTemporary
            $('body').data('temporary-user',isTemporary)

            sendCustomData({action: 'viewpage'});
            if(chatId){
                getUserChatHistory(chatId, userId,function(lastChat){
                    if(lastChat){
                        userChatId = lastChat._id
                    }
                    fetchchatData(chatId, userId)
                });
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
                $('#userMessage').attr('placeholder', 'チャットしよう'); 
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

            $('.reset-chat').click(function(){
                fetchchatData(chatId, userId, true) ;
            })
            $(document).on('click','.user-chat-history', function(){
                //const selectUser = $(this).data('user')
                userChatId = $(this).data('chat')
                fetchchatData(chatId, userId)
            })
            $(document).on('click','.chat-list.item.user-chat .user-chat-content', function(e){
                const selectChatId = $(this).closest('.user-chat').data('id')
                getUserChatHistory(selectChatId, userId,function(lastChat){
                    if(lastChat){
                        userChatId = lastChat._id
                    }
                    fetchchatData(selectChatId, userId)
                });
                //updateParameters(selectChatId,userId)
            })

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
                    $('#stability-gen-button')
                    .attr('data-chat-id',chatId)
                    .attr('data-user-id',userId)
                    .attr('data-user-chat-id',userChatId)
                    .attr('data-thumbnail',thumbnail)

                    $('#novita-gen-button')
                    .attr('data-chat-id',chatId)
                    .attr('data-user-id',userId)
                    .attr('data-user-chat-id',userChatId)
                    .attr('data-thumbnail',thumbnail)
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
                            const messageCountDoc = response.messageCountDoc
                            if(messageCountDoc.limit){
                                $('#message-number')
                                .html(`使用回数：${parseInt(messageCountDoc.count)}/${messageCountDoc.limit}`)
                                .show()
                            }
                            userChatId = response.userChatId
                            chatId = response.chatId
                            if(currentStep < totalSteps){
                                displayStep(chatData, currentStep);
                                isNew = false
                            }else{
                                generateNarration(function(){
                                    generateCompletion(function(){
                                    })
                                })
                                isNew = false
                            }
                        },
                        error: function(error) {
                            if (error.status === 403) {
                                if($('#chat-widget-container').length == 0 && isTemporary){
                                    showRegistrationForm()
                                    return
                                }
                                if($('#chat-widget-container').length == 0 ){
                                    showUpgradePopup('chat-message')
                                    return
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
                sendCustomData({action:'unlock-result'})
                promptForEmail()
            })
            window.fetchchatData = function(fetch_chatId,fetch_userId,fetch_reset) {

                $('#chatContainer').empty()
                $('#startButtonContained').remove();
                if(fetch_reset){
                    currentStep = 0
                }
                $.ajax({
                    url: API_URL+`/api/chat/`,
                    type: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({ userId: fetch_userId, chatId: fetch_chatId, userChatId}),
                    success: function(data) {
                        chatId = data.chat._id
                        isNew = fetch_reset || data.isNew
                        if(!data.chat){
                            showDiscovery();
                            return
                        }
                        chatData = data.chat.content || [];
                        totalSteps = chatData ? chatData.length : 0;

                        chatName = data.chat.name
                        thumbnail = data.chat.thumbnailUrl || data.chat.chatImageUrl
                        $('#chat-container').css(`background-image`,`url(${thumbnail})`)
                        $('#chat-title').text(chatName)
                        $('#input-container').show().addClass('d-flex');

                        if(!isNew){
                            displayChat(data.userChat.messages)
                        }

                        if(isNew && chatData && chatData.length > 0){
                            displayStep(chatData, currentStep);
                        }

                        if(isNew && chatData && chatData.length == 0 ){
                            createIntro(data.chat)
                            createButton(data.chat)
                        }

                        updateParameters(data.chat._id,fetch_userId)
                        showChat();    

                        $('#chatContainer').animate({
                            scrollTop: $('#chatContainer').prop("scrollHeight")
                        }, 500); 
                    },
                    error: function(xhr, status, error) {
                        //console.log(error)
                        showDiscovery();
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
                    displayStarter();
                });

            }
            function createIntro(chatData){
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
                $('#novita-gen-button').hide();

                // Create the intro elements
                let introContainer = $('<div></div>')
                .addClass('intro-container my-3 pb-3')
                .css({'overflow-y':'scroll','height':'50vh'})
                .attr('id','introChat');
            
                let title = $('<h2></h2>').text(name);
                let desc = $('<p></p>').text(description);
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
                introContainer.append(title, desc);
            
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
                introContainer.append(toolbox);
                // Display intro container inside #chatContainer
                $('#chatContainer').append(introContainer);

                if($('#chat-widget-container').length == 0 && isTemporary){
                    //showRegistrationForm()
                    //return
                }
            }
            
            function displayStarter() {
                $('#startButtonContained').hide();
                $('#introChat').hide();

                let message = `[Starter] Invent a situation and explain what is going on. Respond as if you started the conversation. DO not start by aknowledge, start with the answer.` 
                if($('#chat-widget-container').length == 0 && isTemporary){
                    message = `[Starter] After greeting me like you character would do, beg me to login to contine chatting. Here are some feature for a free account:\n"1日50件までチャットできる",  "フレンドを無制限で作成できる", '新しいキャラクターを作成する', "チャット履歴を保存する"\nDO not start by aknowledge, start with the answer.`
                     
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
                            $('#message-number')
                            .html(`使用回数：${parseInt(messageCountDoc.count)}/${messageCountDoc.limit}`)
                            .show()
                        }
                        userChatId = response.userChatId
                        chatId = response.chatId
                        isNew = false;
                        renderChatList(userId);
                        generateCompletion(function(){
                            $('#stability-gen-button').show();
                            $('#novita-gen-button').show();
                            $('#input-container').show().addClass('d-flex');
                        })
                    },
                    error: function(xhr, status, error)  {
                        $('#startButtonContained').show();
                        $('#introChat').show();
                        if (xhr.responseJSON) {
                            var errorStatus = xhr.status
                            if (errorStatus === 403) {
                                var errorId = xhr.responseJSON.id;

                                if($('#chat-widget-container').length == 0 && isTemporary){
                                    showRegistrationForm(errorId)
                                    return
                                }
                                if (errorId === 1) {
                                  // Handle message limit reached error
                                    if($('#chat-widget-container').length == 0 ){
                                        showUpgradePopup('chat-message')
                                        return
                                    }
                                } else if (errorId === 2) {
                                    // Handle chat limit reached error
                                  showUpgradePopup('chat-character')
                                }
                            }
                          } else {
                            console.error('Error:', error);
                            displayMessage('bot', 'An error occurred while sending the message.');
                        }
                    }
                });
            }
            window.renderChatList = function(userId) {
                if($('#chat-list').length == 0 || $('#chat-widget-container').length > 0){
                    return
                }
                $.ajax({
                    type: 'GET',
                    url: '/api/chat-list/'+userId, // replace with your API endpoint
                    success: function(data) {
                        var chatListHtml = '';
                        $('#user-chat-count').html(data.length)
                        $.each(data, function(index, chat) {
                            chatListHtml += `
                            <div class="chat-list item user-chat d-flex align-items-center justify-content-between p-1 mx-2 rounded bg-transparent" style="cursor: pointer;" 
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
                        $('#chat-list').html(chatListHtml);
                        enableToggleDropdown();
                    }
                });
            }
            function displayChat(userChat) {
                $('#stability-gen-button').show();
                $('#novita-gen-button').show();
                let chatContainer = $('#chatContainer');
                chatContainer.empty();

                if(userChat[1].role === "user"){
                    let userMessage = userChat[2];
                    const isStarter = userMessage.content.startsWith("[Starter]") || userMessage.content.startsWith("Invent a situation");
                    if(!isStarter){
                        let messageHtml = `
                            <div class="d-flex flex-row justify-content-end mb-4 message-container">
                                <div id="response-1" class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfb;">
                                    ${marked.parse(userMessage.content)}
                                </div>
                            </div>
                        </div>
                        `;
                        chatContainer.append(messageHtml);
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
                        const isNarratorMessage = assistantMessage.content.startsWith("[Narrator]");
                        const isImage = assistantMessage.content.startsWith("[Image]");
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
                            messageHtml += `
                                <div id="container-${designStep}">
                                    <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                        <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                                        <div class="p-3 ms-3 text-start assistant-image-box">
                                            <img id="image-${imageId}">
                                        </div>
                                    </div>
                            `;
                            getImageUrlById(imageId)
                        } else {
                            // Regular assistant message
                            messageHtml += `
                                <div id="container-${designStep}">
                                    <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                        <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                                        <div id="message-${designStep}" class="p-3 ms-3 text-start assistant-chat-box">
                                            ${marked.parse(assistantMessage.content)}
                                        </div>
                                    </div>
                            `;
                        }
            
                        // Check if the next message is a user message and display it
                        if (i + 1 < userChat.length && userChat[i + 1].role === "user") {
                            let userMessage = userChat[i + 1];
                            messageHtml += `
                                <div class="d-flex flex-row justify-content-end mb-4 message-container">
                                    <div id="response-${designStep}" class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfb;">
                                        ${marked.parse(userMessage.content)}
                                    </div>
                                </div>
                            </div>
                            `;
                            i++; // Skip the next user message as it's been processed
                        } else {
                            messageHtml += `
                                <div id="response-${designStep}" class="choice-container d-none"></div>
                            </div>
                            `;
                        }
            
                        chatContainer.append(messageHtml);
                    }
                }
                function getImageUrlById(imageId) {
                    $.ajax({
                      url: `/image/${imageId}`,
                      method: 'GET',
                      success: function(response) {
                        if (response.imageUrl) {
                          $(`#image-${imageId}`)
                          .attr('src', response.imageUrl)
                          .attr('alt', response.imagePrompt);
                        } else {
                          console.error('No image URL returned');
                        }
                      },
                      error: function(xhr, status, error) {
                        console.error('Error fetching image URL:', error);
                      }
                    });
                  }
                  
                if (userChat[userChat.length - 1].role === "user" && userChat[userChat.length - 1].content) {
                    if (currentStep < totalSteps) {
                        displayStep(chatData, currentStep);
                    } else {
                        generateCompletion();
                    }
                } else {
                    //generateChoice();
                }
            }
            
            
            
            
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
                                <div id="response-${currentStep - 1}" class="p-3 me-3 border-0" style="border-radius: 15px; background-color: #fbfbfb;">${response}</div>
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
            
            function generateCompletion(callback){
                
                const apiUrl = API_URL+'/api/openai-chat-completion';

                hideOtherChoice(false, currentStep)
                // Initialize the bot response container
                const botResponseContainer = $(`
                    <div id="container-${currentStep}">
                        <div class="d-flex flex-row justify-content-start mb-4 message-container">
                            <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;cursor:pointer;">
                            <div id="completion-${currentStep}" class="p-3 ms-3 text-start assistant-chat-box">
                                <img src="https://lamix.hatoltd.com/img/load-dot.gif" width="50px">
                            </div>
                        </div>
                        <div id="response-${currentStep}" class="choice-container" ></div>
                    </div>`);
                $('#chatContainer').append(botResponseContainer);
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
                            $(`#completion-${currentStep}`).html(marked.parse(markdownContent));
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
            
            
            // Function to display a message in the chat
            window.displayMessage = function(sender, message) {
                const messageClass = sender === 'user' ? 'user-message' : sender;

                if(messageClass === 'user-message'){
                    $('#chatContainer').append(`
                        <div class="d-flex flex-row justify-content-end mb-4 message-container ${messageClass}">
                            <div class="p-3 me-3 border-0 text-start" style="border-radius: 15px; background-color: #fbfbfb;">
                                <span>${message}</span>
                            </div>
                        </div>
                    `);
                } else if(messageClass === 'bot-image'){
                    const imageId = message.getAttribute('data-id');
                    $('#chatContainer').append(`
                        <div class="d-flex flex-row justify-content-start mb-4 message-container ${messageClass}">
                            <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                            <div id="image-${imageId}" class="p-3 ms-3 text-start assistant-image-box">
                            </div>
                        </div>      
                    `);
                    
                    // Now append the image to the chat box after it's been appended
                    $(`#image-${imageId}`).append(message.outerHTML);
                }
                
                $('#chatContainer').animate({
                    scrollTop: $('#chatContainer').prop("scrollHeight")
                }, 500); 
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

            $(window).on('scroll', function() {
                maxScroll();
            });

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
                    
                    generateImagePromt(API_URL, userId, chatId, userChatId, thumbnail, function(prompt) {
                        generateImageFunction(API_URL, userId, chatId, userChatId, { prompt });
                    });
                });
            }
            
            handleImageGeneration('#stability-gen-button', generateImageStableDiffusion);
            handleImageGeneration('#novita-gen-button', generateImageNovita);
            

        });
    })

    // Fetch the user's IP address and generate a unique ID
   

    function getIdFromUrl(url) {
        // Use a regular expression to capture the ID part from the URL
        var regex = /\/chat\/([a-zA-Z0-9]+)/;
        var match = url.match(regex);
        
        // If a match is found, return the ID, otherwise return null
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

    function getUserChatHistory(chatId, userId, callback) {
        $.ajax({
          url: `/api/chat-history/${chatId}`,
          type: 'POST',
          data: JSON.stringify({ userId: userId }),
          contentType: 'application/json',
          dataType: 'json',
          success: function(data) {
            const lastChat = data.find(chat =>!chat.isWidget);
            if(lastChat){
                userChatId = lastChat._id
                localStorage.setItem('userChatId', userChatId);
            }
            displayUserChatHistory(data);
            if (callback) { callback(lastChat) }
          },
          error: function(jqXHR, textStatus, errorThrown) {
            console.error('Error fetching user chat history:', errorThrown);
          }
        });
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
    
                // Add hover event listeners to the parent element
                parent.hover(
                    function() {
                        // When the parent element is hovered
                        $(this).find('.dropdown-toggle').css({
                            'opacity': 1,
                            'pointer-events': ''
                        });
                    },
                    function() {
                        // When the parent element is no longer hovered
                        $(this).find('.dropdown-toggle').css({
                            'opacity': 1,
                            'pointer-events': 'none'
                        });
                        // Close the dropdown
                        dropdown.hide();
                    }
                );
            }
        });
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

function showRegistrationForm(messageId) {

    const redirectUrl = window.location.pathname
    $.cookie('redirect_url', redirectUrl);

    //window.location = "/authenticate?register=true"
    Swal.fire({
      title: '',
      text: '',
      imageUrl: '/img/login-bg-862c043f.png', // replace with your image URL
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
          $.removeCookie('redirect_url');
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
