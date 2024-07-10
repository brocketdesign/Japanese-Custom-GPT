$(document).ready(function() {
    let API_URL = ""
    fetchMode(function(error,mode){
        if(mode != 'local'){
            API_URL = "https://lamix.hatoltd.com"
        }
        fetchUser(function(error, user){
        // Now you can use the userID variable or id parameter here
        let chatId = getIdFromUrl(window.location.href) || $(`#lamix-chat-widget`).data('id');
        let userChatId
        const userId = user._id
        let messagesCount = 0 
        let currentStep = 0;
        let totalSteps = 0;
        let chatData = {};
        let isNew = true;
        let feedback = false
        let thumbnail = false

        sendCustomData({action: 'viewpage'});
        fetchchatData(chatId, userId); // Fetch the initial chat data when the page loads

        enableToggleDropdown()
        
        $('textarea').each(function() {
            resizeTextarea(this);
            $(this).on('input change', function() {
                resizeTextarea(this);
            });
        });

        function resizeTextarea(element){
            element.style.height = 'auto';
            element.style.height = (element.scrollHeight - 20 ) + 'px';  
        }

        $('.reset-chat').click(function(){
            fetchchatData(chatId, userId, true) ;
        })

        $(document).on('click','.user-chat-history', function(){
            const selectUser = $(this).data('user')
            userChatId = $(this).data('chat')
            fetchchatData(chatId, selectUser)
        })
        $('.chat-list.item.user-chat .user-chat-content').click(function(e){
            const selectChatId = $(this).closest('.user-chat').data('id')
            fetchchatData(selectChatId, userId)
            updateParameters(selectChatId,userId)
        })

        function updateParameters(newchatId, newuserId){
            chatId = newchatId
            var currentUrl = window.location.href;
            var urlParts = currentUrl.split('/');
            urlParts[urlParts.length - 1] = newchatId;
            var newUrl = urlParts.join('/');
            window.history.pushState({ path: newUrl }, '', newUrl);

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
        
        window.choosePath = function(response) {
            currentStep++;
            hideOtherChoice(response,currentStep,function(){
                updatechatContent(response);
            })

            $.ajax({
                url: API_URL+'/api/chat-data',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ currentStep:currentStep-1, message:response, userId, chatId, userChatId, isNew }),
                success: function(response) {
                    userChatId = response.userChatId
                    isNew = false
                },
                error: function(error) {
                    console.log(error.statusText);
                }
            });
        };
        window.sendMessage = function(customMessage,displayStatus = true) {
            currentStep ++
            messagesCount ++
            if(messagesCount >= 10){
                Swal.fire({
                    title: '注意',
                    text: '無料ユーザーのメッセージの最大数は1日10件です。',
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
                return
            }
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
                    data: JSON.stringify({ currentStep:currentStep-1, message, userId, chatId, userChatId, isNew }),
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
                        console.error('Error:', error);
                        displayMessage('bot', 'An error occurred while sending the message.');
                    }
                });
            }
        }
        $(document).on('click','#unlock-result',function(){
            sendCustomData({action:'unlock-result'})
            promptForEmail()
        })
        function fetchchatData(chatId,userId,reset) {
            $('#chatContainer').empty()
            $('#startButtonContained').remove();
            if(reset){
                currentStep = 0
            }
            $.ajax({
                url: API_URL+`/api/chat/`,
                type: 'POST',
                dataType: 'json',
                contentType: 'application/json',
                data: JSON.stringify({ userId, chatId, userChatId }),
                success: function(data) {

                    isNew = reset || data.isNew
                    chatData = data.chat.content;
                    totalSteps = chatData.length;
                    chatName = data.chat.name
                    thumbnail = data.chat.thumbnailUrl || data.chat.chatImageUrl

                    $('#chat-title').text(chatName)

                    if(!isNew){
                        displayChat(data.userChat.messages)
                    }

                    if(isNew && chatData.length > 0){
                        displayStep(chatData, currentStep);
                    }

                    if(isNew && chatData.length == 0 ){
                        createButtonAndIntro(data.chat)
                    }
                    getUserChatHistory(chatId, userId);
                    $('#chatContainer').animate({
                        scrollTop: $('#chatContainer').prop("scrollHeight")
                    }, 500); 
                },
                error: function(xhr, status, error) {
                    console.log(error)

                }
            });
        }
        function createButtonAndIntro(chatData) {
            
            // Extracting data from chatData
            let name = chatData.name;
            let description = chatData.description;
            let thumbnailUrl = chatData.thumbnailUrl;
            let chatImageUrl = chatData.chatImageUrl;
        
            // Remove existing container if it exists
            $('#startButtonContained').remove();
            $('#introChat').remove();

            // Create the container div
            let container = $('<div></div>').addClass('container my-3').attr('id', 'startButtonContained');
        
            // Create the button
            let button = $('<button></button>')
                .addClass('btn btn-outline-secondary')
                .attr('id', 'startButton')
                .text('会話を開始する');
            
            // Append the button to the container
            container.append(button);
        
            // Append the container to the chat input area
            $('#chatInput').prepend(container);
        
            // Add click event listener to the button
            button.on('click', function() {
                displayStarter();
            });
        
            // Create the intro elements
            let introContainer = $('<div></div>').addClass('intro-container my-3').attr('id','introChat');
        
            let title = $('<h2></h2>').text(name);
            let desc = $('<p></p>').text(description);
            let thumbnail = $('<img>').attr('src', thumbnailUrl).addClass('intro-thumbnail');
            let chatImage = $('<img>').attr('src', chatImageUrl).addClass('intro-thumbnail');
        
            // Append intro elements to the intro container
            if(thumbnailUrl){
                introContainer.append(thumbnail);
            }
            if(chatImageUrl){
                introContainer.append(chatImage);
            }
            introContainer.append(title, desc);
        
            // Display intro container inside #chatContainer
            $('#chatContainer').append(introContainer);
        }
        
        
        function displayStarter() {
            $('#startButton').remove();
            $('#introChat').remove();
            $.ajax({
                url: API_URL+'/api/chat-data',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ 
                    currentStep: 0, 
                    message: '会話を開始する', 
                    userId: userId, 
                    chatId: chatId, 
                    isNew: true 
                }),
                success: function(response) {
                    userChatId = response.userChatId
                    chatId = response.chatId
                    isNew = false;
                    generateCompletion(function() {
                    });
                },
                error: function(error) {
                    console.log(error.statusText);
                }
            });
        }
        function displayChat(userChat) {
            let chatContainer = $('#chatContainer');
            chatContainer.empty();
        
            for (let i = 0; i < userChat.length; i++) {
                if (userChat[i].role === "system") {
                    continue;
                }
                
                currentStep = Math.floor(i / 2) + 1;
                let messageHtml = '';
        
                if (userChat[i].role === "assistant") {
                    let assistantMessage = userChat[i];
                    let userMessage = userChat[i + 1];
                    let designStep = currentStep - 1 
                    messageHtml += `
                        <div id="container-${designStep}">
                            <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                                <div id="message-${designStep}" class="p-3 ms-3 text-start" style="border-radius: 15px; ">
                                    ${marked.parse(assistantMessage.content)}
                                </div>
                            </div>
                    `;
        
                    if (userMessage && userMessage.role === "user") {
                        messageHtml += `
                            <div class="d-flex flex-row justify-content-end mb-4 message-container">
                                <div id="response-${designStep}" class="p-3 me-3 border-0" style="border-radius: 15px; background-color: #fbfbfb;">
                                    ${marked.parse(userMessage.content)}
                                </div>
                            </div>
                        </div>
                        `;
                    } else {
                        messageHtml += `
                            <div id="response-${designStep}" class="choice-container"></div>
                        </div>
                        `;
                    }
        
                    chatContainer.append(messageHtml);
                    i++; // Skip the next iteration as we've already handled the user message
                }
            }
        
            if (userChat[userChat.length - 1].role === "user" && userChat[userChat.length - 1].content) {
                if(currentStep < totalSteps){
                    displayStep(chatData, currentStep);
                }else{
                    generateCompletion()
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
                    <div id="message-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;   "></div>
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
                        <div id="message-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;   "></div>
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

                    hideOtherChoice(false, currentStep)
                    // Initialize the bot response container
                    const botResponseContainer = $(`
                        <div id="container-${currentStep}">
                            <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
                                <div id="completion-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;"></div>
                            </div>
                            <div id="response-${currentStep}" class="choice-container" ></div>
                        </div>`);
                    $('#chatContainer').append(botResponseContainer);
                    $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);
                    

                    eventSource.onmessage = function(event) {
                        const data = JSON.parse(event.data);
                        markdownContent += data.content;
                        $(`#completion-${currentStep}`).html(marked.parse(markdownContent));
                    };

                    eventSource.onerror = function(error) {
                        console.log('EventSource failed.');
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

        // Event handler for the send button
        $('#sendMessage').on('click', function() {
            sendMessage();
        });

        // Event handler for the Enter key
        $('#userMessage').on('keypress', function(event) {
            if (event.which == 13 && !event.shiftKey) { // Enter key is pressed without Shift
                sendMessage();
            }
        });     

        // Function to display a message in the chat
        function displayMessage(sender, message) {
            const messageClass = sender === 'user' ? 'user-message' : 'bot-message';

            if(messageClass == 'user-message'){
                $('#chatContainer').append(`
                    <div class="d-flex flex-row justify-content-end mb-4 message-container ${messageClass}">
                        <div  class="p-3 me-3 border-0" style="border-radius: 15px; background-color: #fbfbfb;">
                            <span>${message}</span>
                        </div>
                    </div>
                `);
            }
            $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight); // Scroll to the bottom
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

    function getUserChatHistory(chatId, userId) {
        $.ajax({
          url: `/api/chat-history/${chatId}`,
          type: 'POST',
          data: JSON.stringify({ userId: userId }),
          contentType: 'application/json',
          dataType: 'json',
          success: function(data) {
            displayUserChatHistory(data);
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

            const card = $('<div class="card rounded-0 shadow-0 bg-transparent"></div>');
            const cardHeader = $('<div class="card-header"></div>');
            cardHeader.text(`総要素数: ${userChat.length}`);
            card.append(cardHeader);

            const listGroup = $('<ul class="list-group list-group-flush"></ul>');
            userChat.forEach(chat => {
            const listItem = $(`<li class="list-group-item user-chat-history bg-transparent" data-id="${chat.chatId}" data-chat="${chat._id}" data-user="${chat.userId}"></li>`);
            listItem.css('cursor', 'pointer');

            const small = $('<small class="text-muted"></small>');
            small.append($('<i class="fas fa-clock me-1"></i>'));
            small.append(chat.updatedAt);
            //small.append(chat._id);

            const dropdown = renderChatDropdown(chat)
            
            listItem.append(small);
            listItem.append(dropdown);
            listGroup.append(listItem);
            });

            card.append(listGroup);
            chatHistoryContainer.append(card);
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
                new mdb.Dropdown($(this)[0]);
            }
        });
    }
    
    function renderChatDropdown(chat) {
        const chatId = chat._id;
        const dropdownHtml = `
            <div class="d-inline-block align-items-center">
                <!-- Dropdown -->
                <div class="dropdown">
                    <button class="btn border-0 shadow-0 dropdown-toggle ms-2" type="button" id="dropdownMenuButton_${chatId}" data-mdb-toggle="dropdown" aria-expanded="false">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="dropdownMenuButton_${chatId}">
                        <li>
                            <span data-id="${chatId}" class="dropdown-item delete-chat-history" style="cursor:pointer">
                                <i class="fas fa-trash"></i> 削除
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
        return
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
    }
});
