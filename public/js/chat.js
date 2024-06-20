$(document).ready(function() {

    // Fetch the user's IP address and generate a unique ID
    fetchUser(function(error, user){
        // Now you can use the userID variable or id parameter here
        const chatId = getIdFromUrl(window.location.href) || $(`#lamix-chat-widget`).data('id');
        const userId = user._id
        //console.log({userId,chatId})
        let messagesCount = 0 
        let currentStep = 0;
        let totalSteps = 0;
        let chatData = {};
        let feedback = false
        let thumbnail = false

        sendCustomData({action: 'viewpage'});
        fetchchatData(chatId); // Fetch the initial chat data when the page loads
        
        window.choosePath = function(choiceText) {
            currentStep++;
            //console.log({choiceText,currentStep})
            hideOtherChoice(choiceText,currentStep,function(){
                updatechatContent(choiceText);
            })

            $.ajax({
                url: 'https://lamix.hatoltd.com/api/chat-data',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ currentStep, message:choiceText, chatId:chatId }),
                success: function(response) {
                    
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
                    url: 'https://lamix.hatoltd.com/api/chat-data', // Backend endpoint to handle the message
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ currentStep:currentStep, message, chatId }),
                    success: function(response) {
                        const {userId, chatId } = response
                        generateCompletion(userId, chatId)
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
        function fetchchatData(chatId) {
            $.ajax({
                url: `https://lamix.hatoltd.com/api/chat/${chatId}`,
                type: 'GET',
                dataType: 'json',
                success: function(data) {
                    chatData = data.content.story;
                    totalSteps = Object.keys(chatData).length;
                    chatName = data.name
                    thumbnail = data.thumbnailUrl
                    $('h1').text(chatName)
                    displayStep(chatData, currentStep);
                },
                error: function(xhr, status, error) {
                    Swal.fire({
                        title: 'エラー!',
                        text: 'チャットの読み込みに失敗しました: ' + error,
                        icon: 'error',
                        confirmButtonText: 'Ok',
                        showCancelButton: true,
                        cancelButtonText: '一覧を見る'
                    }).then((result) => {
                        if (result.dismiss === Swal.DismissReason.cancel) {
                            window.location.href = '/chat-list';
                        }
                    });

                }
            });
        }

        function displayStep(chatData, currentStep) {
            const step = chatData[`step${currentStep + 1}`];
            //$(`.card-header .count`).text(`${currentStep + 1}/${totalSteps}`)
            $('#chatContainer').append(`
            <div id="container-${currentStep}">
                <div class="d-flex flex-row justify-content-start mb-4 message-container" style="opacity:0;">
                    <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;">
                    <div id="message-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;   background: linear-gradient(90.9deg, rgba(247, 243, 255, 0.5) 2.74%, #B894F9 102.92%);"></div>
                </div>
                <div id="response-${currentStep}" class="choice-container" ></div>
            </div>`)
            step.choices.forEach((choice, index) => {
                const button = $(`<button class="btn btn-flat-border my-2" onclick="choosePath('${choice.choiceText}')">${choice.choiceText}</button>`);
                button.css('opacity',0)
                $(`#response-${currentStep}`).append(button);
            });
            appendHeadlineCharacterByCharacter($(`#message-${currentStep}`), step.introduction,function(){
                $(`#response-${currentStep} button`).each(function(){
                    $(this).css('opacity',1)
                })
            })
        }

        function updatechatContent(choiceText) {
            const previousStep = chatData[`step${currentStep}`]; // Previous step where the choice was made

            $(`.card-header .count`).text(`${currentStep + 1}/${totalSteps}`)
            $('#chatContainer').append(`
            <div id="container-${currentStep}">

                <div class="d-flex flex-row justify-content-start mb-4 message-container" style="opacity:0;">
                    <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;">
                    <div id="result-${currentStep - 1}" class="p-3 ms-3 text-start" style="border-radius: 15px;   background: linear-gradient(90.9deg, rgba(247, 243, 255, 0.5) 2.74%, #B894F9 102.92%);"></div>
                </div>
                
                <div class="d-flex flex-row justify-content-start mb-4 message-container" style="opacity:0;">
                    <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;">
                    <div id="message-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;   background: linear-gradient(90.9deg, rgba(247, 243, 255, 0.5) 2.74%, #B894F9 102.92%);"></div>
                </div>

                <div id="response-${currentStep}" class="choice-container" ></div>
            </div>`)

            if (currentStep < totalSteps) {
                const nextStep = chatData[`step${currentStep + 1}`];

                nextStep.choices.forEach(choice => {
                    const button = $(`<button class="btn btn-flat-border my-2" onclick="choosePath('${choice.choiceText}')">${choice.choiceText}</button>`)
                    button.css('opacity',0)
                    $(`#response-${currentStep}`).append(button);
                });

                const choice = previousStep.choices.find(c => c.choiceText === choiceText);
                $(`#result-${currentStep - 1}`).closest('.message-container').animate({ opacity: 1 }, 1000, function() { 
                    appendHeadlineCharacterByCharacter($(`#result-${currentStep - 1}`),choice.result,function(){
                        appendHeadlineCharacterByCharacter($(`#message-${currentStep}`), nextStep.introduction,function(){
                            $(`#response-${currentStep} button`).each(function(){
                                $(this).css('opacity',1)
                            })
                        });
                    })
                })
            }else{
                console.log({currentStep})
                const choice = previousStep.choices.find(c => c.choiceText === choiceText);
                $(`#result-${currentStep - 1}`).closest('.message-container').animate({ opacity: 1 }, 1000, function() { 
                    appendHeadlineCharacterByCharacter($(`#result-${currentStep - 1}`),choice.result,function(){
                        $(`#message-${currentStep}`).closest('.message-container').removeClass('d-flex').hide()
                        generateChoice()
                    })
                })
            }
        }

        function hideOtherChoice(choiceText, currentStep, callback) {

            $(`#response-${currentStep - 1} button`).each(function() {
                const currentChoice = $(this).text()
                if(choiceText == currentChoice){
                    const response = $(this).text()
                    $(`#response-${currentStep - 1}`).remove()
                    $(`#container-${currentStep - 1}`).append(`
                        <div class="d-flex flex-row justify-content-end mb-4 message-container" style="opacity:0;">
                            <div id="response-${currentStep - 1}" class="p-3 me-3 border" style="border-radius: 15px; background-color: #fbfbfb;">${response}</div>
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
            const apiUrl = 'https://lamix.hatoltd.com/api/openai-chat-choice/'

            $.ajax({
                url: apiUrl,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ chatId: chatId }),
                success: function(response) {
                    const cleanResponse = cleanJsonArray(response)

                    cleanResponse.forEach(choice => {
                        const button = $(`<button class="btn btn-flat-border my-2" onclick="sendMessage('${choice}')">${choice}</button>`)
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
        
        function generateCompletion($element){
            
            const apiUrl = 'https://lamix.hatoltd.com/api/openai-chat-completion';
  
            $.ajax({
                url: apiUrl,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ chatId: chatId }),
                success: function(response) {
                    const sessionId = response.sessionId;
                    const streamUrl = `https://lamix.hatoltd.com/api/openai-chat-completion-stream/${sessionId}`;
                    const eventSource = new EventSource(streamUrl);
                    let markdownContent = "";

                    if(!$element){
                        hideOtherChoice(false, currentStep)
                        // Initialize the bot response container
                        const botResponseContainer = $(`
                            <div id="container-${currentStep}">
                                <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                    <img src="${ thumbnail ? thumbnail : '/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;">
                                    <div id="completion-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;   background: linear-gradient(90.9deg, rgba(247, 243, 255, 0.5) 2.74%, #B894F9 102.92%);"></div>
                                </div>
                                <div id="response-${currentStep}" class="choice-container" ></div>
                            </div>`);
                        $('#chatContainer').append(botResponseContainer);
                        $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);
                    }

                    eventSource.onmessage = function(event) {
                        const data = JSON.parse(event.data);
                        markdownContent += data.content;

                        if($element){
                            $element.removeClass('blur-text')
                            $element.html(marked.parse(markdownContent));
                        }else{
                            $(`#completion-${currentStep}`).html(marked.parse(markdownContent));
                        }

                    };

                    eventSource.onerror = function(error) {
                        console.log('EventSource failed.');
                        eventSource.close();
                        if(!$element){
                            generateChoice();
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
            if (event.which == 13) { // Enter key is pressed
                sendMessage();
            }
        });     

        // Function to display a message in the chat
        function displayMessage(sender, message) {
            const messageClass = sender === 'user' ? 'user-message' : 'bot-message';

            if(messageClass == 'user-message'){
                $('#chatContainer').append(`
                    <div class="d-flex flex-row justify-content-end mb-4 message-container ${messageClass}">
                        <div  class="p-3 me-3 border" style="border-radius: 15px; background-color: #fbfbfb;">
                            <span>${message}</span>
                        </div>
                    </div>
                `);
            }
            $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight); // Scroll to the bottom
        }
        
        function sendCustomData(customData){
            $.ajax({
                url: 'https://lamix.hatoltd.com/api/custom-data',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ userId: userId, customData: customData }),
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
            url: 'https://lamix.hatoltd.com/api/user',
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

    function appendHeadlineCharacterByCharacter($element, headline, callback) {
        let index = 0;

        const spinner = $(`<div class="spinner-grow spinner-grow-sm text-light" role="status"><span class="visually-hidden">Loading...</span></div>`)
        $element.append(spinner)
        $element.closest(`.message-container`).animate({ opacity: 1 }, 500, function() { 
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
