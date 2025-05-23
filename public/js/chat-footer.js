
    $(document).ready(function() {
        // Toggle emoji tone view
        $('#emoji-tone-btn').on('click', function() {
            showToolContentView('toolbar-emoji-tone');
        });
        
        // Toggle suggestions view
        $('#suggestions-toggle').on('click', function() {
            const suggestionsContainer = $('#suggestions');
            if (suggestionsContainer.is(':empty')) {
                const userChatId = $('#chatContainer').data('id');
                if (userChatId) {
                    // Show a loading indicator
                    suggestionsContainer.html('<div class="text-center w-100 my-2"><i class="bi bi-hourglass-split"></i>'+translations.loading_suggestions+'</div>');
                    
                    // Make API request to trigger suggestion generation via websocket
                    $.ajax({
                        url: '/api/display-suggestions',
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({ 
                            userChatId: userChatId,
                            uniqueId: new Date().getTime() // Generate a unique ID for the websocket response
                        })
                    });
                } else {
                    suggestionsContainer.html('<div class="text-center w-100 my-2">No chat selected</div>');
                }
            }
            showToolContentView('toolbar-suggestions');
        });
        
        // Toggle translation view
        $('#translation-toggle').on('click', function() {
            const subscriptionStatus = user.subscriptionStatus == 'active'
            if(!subscriptionStatus) {
                loadPlanPage();
                return;
            }
            showToolContentView('toolbar-translation');
        });
        
        // Toggle text input view
        $('#text-input-toggle').on('click', function() {
            showToolContentView('toolbar-text-input');
            resizeTextarea($('#userMessage')[0]);
        });
        
        // Handle back buttons for all tool content views
        $('.toolbar-back-btn').on('click', function() {
            hideToolContentView($(this).closest('.toolbar-content-view').attr('id'));
        });
        
        // Handle emoji selection
        $('.emoji-btn').on('click', function() {
            const tone = $(this).data('tone');
            const emoji = $(this).text();
            sendMessage(emoji);
        });
        
        // Handle translation button click
        $('.translation-btn').on('click', function() {
            $(this).addClass('active').siblings().removeClass('active');
            const translation_lang = $(this).data('lang');
            // Use translations.doTranslate for dynamic translation text
            switch (translation_lang) {
                case 'en':
                    sendMessage(translations.translateTo + ' ' + translations.english);
                    break;
                case 'ja':
                    sendMessage(translations.translateTo + ' ' + translations.japanese);
                    break;
                case 'ko':
                    sendMessage(translations.translateTo + ' ' + translations.korean);
                    break;
                case 'zh':
                    sendMessage(translations.translateTo + ' ' + translations.chinese);
                    break;
                case 'fr':
                    sendMessage(translations.translateTo + ' ' + translations.french);
                    break;
                case 'de':
                    sendMessage(translations.translateTo + ' ' + translations.german);
                    break;
                default:
                    console.log('Language not supported');
            }
        });
        
        // Function to show a specific tool content view
        function showToolContentView(viewId) {
            // Hide the main toolbar with animation
            $('#toolbar-main').addClass('animate__fadeOutLeft');
            setTimeout(() => {
                $('#toolbar-main').hide().removeClass('animate__fadeOutLeft');
                
                // Show the selected tool content view with animation
                $('#' + viewId).addClass('animate__fadeInRight').show();
            }, 200);
        }
        
        // Function to hide a tool content view and show the main toolbar
        function hideToolContentView(viewId) {
            // Hide the tool content view with animation
            $('#' + viewId).addClass('animate__fadeOutLeft');
            setTimeout(() => {
                $('#' + viewId).hide().removeClass('animate__fadeInRight animate__fadeOutLeft');
                
                // Show the main toolbar with animation
                $('#toolbar-main').addClass('animate__fadeInRight').show();
                setTimeout(() => {
                    $('#toolbar-main').removeClass('animate__fadeInRight');
                }, 500);
            }, 200);
        }
        
        // Show prompts (keeping original functionality)
        $('#showPrompts').on('click', function() {
            $('#promptContainer').slideToggle();
        });


        // iOS Safari keyboard fix
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            // Focus event - when keyboard appears
            $('#userMessage').on('focus', function() {
                // Save the current scroll position
                window.scrollPosition = window.pageYOffset;
                // Add a class to fix the body height
                $('body').addClass('keyboard-open');
            });

            // Blur event - when keyboard disappears
            $('#userMessage').on('blur', function() {
                // Remove the fixed height class
                $('body').removeClass('keyboard-open');
                // Restore scroll position
                setTimeout(function() {
                    window.scrollTo(0, window.scrollPosition || 0);
                }, 100);
            });

            // Add CSS to handle keyboard visibility
            $('head').append(`
                <style>
                    body.keyboard-open {
                        height: 100%;
                        position: fixed;
                        overflow: hidden;
                        width: 100%;
                    }
                    
                    /* Make sure chat container doesn't get hidden behind keyboard */
                    body.keyboard-open #chat-container {
                        height: calc(100% - 60px) !important;
                    }
                    
                    /* Ensure the chat input stays visible above the keyboard */
                    body.keyboard-open #chatInput {
                        position: fixed;
                        bottom: auto;
                        top: 50%; /* Position in the middle of the screen */
                        z-index: 1050;
                        background-color: rgba(252, 250, 255, 0.95);
                        border-radius: 20px;
                        padding: 10px;
                        box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.1);
                        margin: 0 auto;
                    }
                </style>
            `);
            
            
            // Add keyboard detection and repositioning
            let viewportHeight = window.innerHeight;
            window.addEventListener('resize', function() {
                // If height is smaller, keyboard is likely visible
                if (window.innerHeight < viewportHeight && $('.keyboard-open').length) {
                    // Calculate approximate keyboard height
                    const keyboardHeight = viewportHeight - window.innerHeight;
                    // Position the input above the keyboard with some padding
                    $('#chatInput').css({
                        'top': `calc(100% - ${keyboardHeight + 120}px)`
                    });
                } else {
                    viewportHeight = window.innerHeight;
                    // Reset when keyboard is hidden
                    if (!$('.keyboard-open').length) {
                        $('#chatInput').css({
                            'top': 'auto'
                        });
                    }
                }
            });
        }
    });