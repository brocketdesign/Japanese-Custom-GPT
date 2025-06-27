$(document).ready(function() {
    // Initialize audio settings
    window.initializeAudio = function() {
        let autoPlay = localStorage.getItem('audioAutoPlay') === 'true';
        $('#audio-icon').addClass(autoPlay ? 'bi-volume-up' : 'bi-volume-mute');
        $('#audio-play').click(function() {
            if(!subscriptionStatus){
                loadPlanPage();
                return;
            }
            autoPlay = !autoPlay;
            localStorage.setItem('audioAutoPlay', autoPlay);
        });
    };

        // Track used suggestions to prevent showing them again
        let usedSuggestions = new Set();

        // Function to reset suggestions and hide modal - Move this outside the inner scope
        window.resetSuggestionsAndHide = function() {
            // Clear used suggestions tracking
            usedSuggestions.clear();
            
            // Clear the suggestions container content
            $('#suggestionsList').empty();
            
            // Hide the suggestions container with animation
            $('#suggestionsContainer').slideUp();
            
            // Optional: Remove any active states or loading indicators
            $('.suggestion-card').removeClass('active');
        };

        // Toggle emoji tone view
        $('#emoji-tone-btn').on('click', function() {
            showToolContentView('toolbar-emoji-tone');
        });
        

        // Toggle suggestions view - Updated
        $('#suggestions-toggle').on('click', function() {
            // Show the suggestions container (like promptContainer)
            $('#suggestionsContainer').slideToggle();
            
            const suggestionsContainer = $('#suggestionsList');
            if (suggestionsContainer.find('.suggestion-card').length === 0) {
                const userChatId = sessionStorage.getItem('userChatId');
                if (userChatId) {
                    fetchNewSuggestions(userChatId, suggestionsContainer);
                } else {
                    showEmptySuggestions();
                }
            }
        });

        // Close suggestions container
        $('#close-suggestionsContainer').on('click', function() {
            $('#suggestionsContainer').slideUp();
        });

        // New function to fetch suggestions with exclusions
        function fetchNewSuggestions(userChatId, suggestionsContainer) {
            // Show loading state
            suggestionsContainer.html(`
                <div class="loading-spinner text-center mt-4 d-flex flex-column align-items-center justify-content-center">
                    <div class="spinner-border mb-3" role="status">
                        <span class="visually-hidden">${translations.loading}</span>
                    </div>
                    <p class="text-muted">${translations.loading_suggestions}</p>
                </div>
            `);     
            
            // Make API request with excluded suggestions
            $.ajax({
                url: '/api/display-suggestions',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ 
                    userChatId: userChatId,
                    uniqueId: new Date().getTime(),
                    excludeSuggestions: Array.from(usedSuggestions)
                }),
                success: function(response) {
                    if (response.success && response.suggestions) {
                        displaySuggestionsInContainer(response.suggestions, userChatId);
                    } else {
                        showEmptySuggestions();
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching suggestions:', error);
                    showSuggestionsError();
                }
            });
        }

        // New function to display suggestions in the professional container
        window.displaySuggestionsInContainer = function(suggestions, uniqueId) {
            if (!suggestions || Object.keys(suggestions).length === 0) {
                showEmptySuggestions();
                return;
            }
            
            const suggestionContainer = $('#suggestionsList');
            
            // Create header
            let html = `
                <h4 class="text-center w-100 mt-2">${translations.toolbar.ideas}</h4>
            `;
            
            // Define category configuration with emojis and translations
            const categoryConfig = {
                chat: {
                    emoji: '💬',
                    title: translations.suggestions?.chat || 'Chat'
                },
                feelings: {
                    emoji: '💭',
                    title: translations.suggestions?.feelings || 'Feelings'
                }
            };
            
            // Add suggestion cards by category
            Object.keys(categoryConfig).forEach(categoryKey => {
                if (suggestions[categoryKey] && Array.isArray(suggestions[categoryKey]) && suggestions[categoryKey].length > 0) {
                    const config = categoryConfig[categoryKey];
                    
                    // Add category header
                    html += `
                        <div class="suggestion-category-header mt-3 mb-2">
                            <h6 class="text-muted text-center">
                                ${config.emoji} ${config.title}
                            </h6>
                        </div>
                    `;
                    
                    // Add suggestions for this category
                    suggestions[categoryKey].forEach((suggestion, index) => {
                        html += `
                            <div class="suggestion-card w-100" data-suggestion="${suggestion}" data-category="${categoryKey}">
                                <div class="d-flex align-items-center">
                                    <i class="bi bi-lightbulb suggestion-icon"></i>
                                    <p class="suggestion-text flex-grow-1">${suggestion}</p>
                                </div>
                            </div>
                        `;
                    });
                }
            });
            
            suggestionContainer.html(html);
            
            // Add click handlers with removal and tracking
            $('.suggestion-card').on('click', function() {
                const suggestion = $(this).find('.suggestion-text').text().trim();
                const $card = $(this);
                
                // Add to used suggestions
                usedSuggestions.add(suggestion);
                
                // Send the message
                sendMessage(suggestion);
                
                // Hide the suggestions container
                $('#suggestionsContainer').slideUp();
                
                // Remove the card with animation
                $card.fadeOut(300, function() {
                    $card.remove();
                    
                    // Check if this was the last suggestion
                    const remainingCards = $('#suggestionsList .suggestion-card');
                    if (remainingCards.length === 0) {
                        // Fetch new suggestions
                        const userChatId = sessionStorage.getItem('userChatId');
                        if (userChatId) {
                            fetchNewSuggestions(userChatId, $('#suggestionsList'));
                        } else {
                            showEmptySuggestions();
                        }
                    }
                });
            });
        }

        // Function to show empty suggestions state
        function showEmptySuggestions() {
            const suggestionContainer = $('#suggestionsList');
            suggestionContainer.html(`
                <div class="empty-suggestions">
                    <i class="bi bi-lightbulb"></i>
                    <h5>${translations.toolbar.ideas}</h5>
                    <p class="text-muted">${translations.suggestionsNotFound}</p>
                </div>
            `);
        }

        // Function to show error state
        function showSuggestionsError() {
            const suggestionContainer = $('#suggestionsList');
            suggestionContainer.html(`
                <div class="empty-suggestions">
                    <i class="bi bi-exclamation-triangle"></i>
                    <h5>${translations.error}</h5>
                    <p class="text-muted">${translations.errorOccurred}</p>
                </div>
            `);
        }
        
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