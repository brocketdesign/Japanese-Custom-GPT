/**
 * Chat Scenario Module
 * Handles scenario display, selection, and UI interactions
 */

window.ChatScenarioModule = (function() {
    let scenarios = [];
    let currentScenario = null;
    let userChatId = null;
    let isLoadingScenarios = false;
    let currentSlideIndex = 0;
    let swiper = null;
    const containerSelector = '.scenario-container';
    const chatContainerId = 'chatContainer';
    
    /**
     * Initialize the scenario module with a chat
     */
    async function init(chatId, uChatId) {
        // If switching to a different chat, clear previous scenarios
        if (userChatId && userChatId !== uChatId) {
            clearScenarios();
        }
        
        userChatId = uChatId;
        if (!userChatId) {
            // Clear scenarios when no chat ID
            clearScenarios();
            return;
        }

        // Check if scenarios are enabled
        if (!isScenariosEnabled()) {
            clearScenarios();
            return;
        }
        
        try {
            // Fetch existing scenario data
            const response = await fetch(`/api/chat-scenarios/${userChatId}`);
            
            const data = await response.json();
            
            if (data.availableScenarios && data.availableScenarios.length > 0) {
                scenarios = data.availableScenarios;
            }
            
            if (data.currentScenario) {
                currentScenario = data.currentScenario;
            }
        } catch (error) {
            console.error('[ChatScenarioModule] Error initializing:', error);
            // Don't throw - just log and continue
        }
    }

    /**
     * Check if scenarios are enabled in settings
     */
    function isScenariosEnabled() {
        if (typeof window.chatToolSettings !== 'undefined' && window.chatToolSettings.getScenariosEnabled) {
            return window.chatToolSettings.getScenariosEnabled();
        }
        // Default to enabled if settings not available
        return true;
    }

    /**
     * Display loading state
     */
    function displayLoadingState() {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        
        // Hide chatInput during loading
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.style.display = 'none';
        }
        
        // Hide chat-thumbnail-gallery during loading
        const chatRecommend = document.getElementById('chat-thumbnail-gallery');
        if (chatRecommend) {
            chatRecommend.classList.add('d-none');
            chatRecommend.classList.remove('d-flex');
        }
        
        // Hide live-goals-widget during loading
        const liveGoalsWidget = document.getElementById('live-goals-widget');
        if (liveGoalsWidget) {
            liveGoalsWidget.style.display = 'none';
        }
        
        container.style.display = 'flex';
        container.innerHTML = `
            <div class="scenario-loading-container w-100">
                <div class="scenario-spinner"></div>
                <div class="scenario-loading-text">
                    ${window.chatScenariosTranslations?.scenarios_loading || 'Generating scenarios'}
                    <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
                </div>
            </div>
        `;
    }

    /**
     * Generate new scenarios for the current chat
     */
    async function generateScenarios() {
        if (!userChatId || isLoadingScenarios) {
            return false;
        }

        // Check if scenarios are enabled
        if (!isScenariosEnabled()) {
            return false;
        }
        
        try {
            isLoadingScenarios = true;
            displayLoadingState();
            
            const response = await fetch(`/api/chat-scenarios/${userChatId}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (data.success && data.scenarios) {
                scenarios = data.scenarios;
                currentScenario = null;
                displayScenarios();
                // Show the scenario container after displaying
                show();
                return true;
            }
        } catch (error) {
            console.error('[ChatScenarioModule] Error generating scenarios:', error);
        } finally {
            isLoadingScenarios = false;
        }
        
        return false;
    }

    /**
     * Display scenarios in the UI as a carousel
     */
    function displayScenarios() {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        
        // Ensure container is visible
        container.style.display = 'flex';
        
        // Clear existing scenarios
        container.innerHTML = '';
        
        if (!scenarios || scenarios.length === 0) {
            container.innerHTML = '<p class="no-scenarios">' + 
                (window.chatScenariosTranslations?.no_scenarios_available || 'No scenarios available') + 
                '</p>';
            return;
        }
        
        // Create Swiper container
        const swiperContainer = document.createElement('div');
        swiperContainer.className = 'swiper scenario-swiper';
        
        // Create swiper wrapper
        const swiperWrapper = document.createElement('div');
        swiperWrapper.className = 'swiper-wrapper';
        
        // Create scenario slides
        scenarios.forEach((scenario, index) => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            const card = createScenarioCard(scenario, index);
            slide.appendChild(card);
            swiperWrapper.appendChild(slide);
        });
        
        swiperContainer.appendChild(swiperWrapper);
        
        // Add pagination
        const pagination = document.createElement('div');
        pagination.className = 'swiper-pagination';
        swiperContainer.appendChild(pagination);
        
        // Add navigation
        const prevButton = document.createElement('div');
        prevButton.className = 'swiper-button-prev';
        // Prevent nav clicks from bubbling to slides (which would trigger selection)
        prevButton.addEventListener('click', function(e) { e.stopPropagation(); });
        prevButton.addEventListener('pointerdown', function(e) { e.stopPropagation(); });
        swiperContainer.appendChild(prevButton);
        
        const nextButton = document.createElement('div');
        nextButton.className = 'swiper-button-next';
        // Prevent nav clicks from bubbling to slides (which would trigger selection)
        nextButton.addEventListener('click', function(e) { e.stopPropagation(); });
        nextButton.addEventListener('pointerdown', function(e) { e.stopPropagation(); });
        swiperContainer.appendChild(nextButton);
        
        // Prevent pagination clicks from bubbling to slides
        pagination.addEventListener('click', function(e) { e.stopPropagation(); });

        container.appendChild(swiperContainer);
        
        // Initialize Swiper
        swiper = new Swiper('.scenario-swiper', {
            slidesPerView: 1,
            spaceBetween: 10,
            loop: false,
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            on: {
                slideChange: function () {
                    currentSlideIndex = this.activeIndex;
                },
            },
        });
        
        // Reset slide index
        currentSlideIndex = 0;
    }



    /**
     * Create a scenario card element
     */
    function createScenarioCard(scenario, index) {
        const card = document.createElement('div');
        card.className = 'scenario-card w-100';
        card.dataset.scenarioId = scenario.id;
        
        const isSelected = currentScenario && currentScenario.id === scenario.id;
        if (isSelected) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <div class="scenario-card-header">
                <h3 class="scenario-title">${escapeHtml(scenario.title)}</h3>
                ${isSelected ? '<span class="scenario-badge-selected">✓ ' + 
                    (window.chatScenariosTranslations?.selected || 'Selected') + '</span>' : ''}
            </div>
            <p class="scenario-description">${escapeHtml(scenario.description)}</p>
        `;
        
        // Add click event listener to entire card
        card.addEventListener('click', () => {
            selectScenario(scenario.id);
        });
        
        return card;
    }

    /**
     * Helper function to convert a scenario object from API format to the expected currentScenario structure.
     * @param {Object} apiScenario - The scenario object from the API (e.g., with keys like scenario_title, emotional_tone).
     * @returns {Object} - The converted scenario object with standardized keys.
     */
    function convertScenarioToExpectedFormat(apiScenario) {
        return {
            id: apiScenario.id || apiScenario._id, // Prefer 'id', fallback to '_id'
            title: apiScenario.scenario_title,
            description: apiScenario.scenario_description,
            emotionalTone: apiScenario.emotional_tone,
            conversationDirection: apiScenario.conversation_direction,
            system_prompt_addition: apiScenario.system_prompt_addition
        };
    }

    /**
     * Display selected scenario in chat container
     */
    function displaySelectedScenario(providedScenario = null) {
        if (!currentScenario && !providedScenario) {
            removeSelectedScenarioDisplay();
            return;
        }

        if (providedScenario) {
            currentScenario = convertScenarioToExpectedFormat(providedScenario);
        }
        
        const chatContainer = document.getElementById(chatContainerId);
        
        if (!chatContainer) {
            console.error('[ChatScenarioModule.displaySelectedScenario] Chat container not found with ID:', chatContainerId);
            return;
        }
        
        // Remove existing selected scenario display if any
        removeSelectedScenarioDisplay();
        
        // Create selected scenario display element with all details
        const displayDiv = document.createElement('div');
        displayDiv.className = 'selected-scenario-display';
        displayDiv.id = 'selected-scenario-badge';
        displayDiv.innerHTML = `
            <div class="scenario-info">
                <div class="scenario-header">
                    <div class="scenario-name">${escapeHtml(currentScenario.title)}</div>
                    <div class="scenario-meta">
                        <span class="scenario-meta-item">
                            <strong>Tone:</strong> ${escapeHtml(currentScenario.emotionalTone)}
                        </span>
                        <span class="scenario-meta-item">
                            <strong>Direction:</strong> ${escapeHtml(currentScenario.conversationDirection)}
                        </span>
                    </div>
                </div>
                <div class="scenario-description">
                    <p>${escapeHtml(currentScenario.description)}</p>
                </div>
                ${currentScenario.system_prompt_addition ? `
                <div class="scenario-prompt">
                    <strong>Scenario Instructions:</strong>
                    <p>${escapeHtml(currentScenario.system_prompt_addition)}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        // Insert at the beginning of chat container
        chatContainer.insertBefore(displayDiv, chatContainer.firstChild);
    }

    /**
     * Remove selected scenario display from chat
     */
    function removeSelectedScenarioDisplay() {
        const display = document.getElementById('selected-scenario-badge');
        if (display) {
            display.remove();
        }
    }

    /**
     * Select a scenario
     */
    async function selectScenario(scenarioId) {
        if (!userChatId) {
            return;
        }
        
        try {
            const response = await fetch(`/api/chat-scenarios/${userChatId}/select`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ scenarioId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Find the selected scenario
                const selected = scenarios.find(s => s.id === scenarioId);
                if (selected) {
                    currentScenario = selected;
                    
                    // Display selected scenario in chat
                    displaySelectedScenario();
                    
                    // Hide the scenario container
                    hide();
                    
                    // Show chatInput
                    const chatInput = document.getElementById('chatInput');
                    if (chatInput) {
                        chatInput.style.display = 'block';
                    }
                    
                    // Show chat-thumbnail-gallery
                    const chatRecommend = document.getElementById('chat-thumbnail-gallery');
                    if (chatRecommend) {
                        chatRecommend.classList.remove('d-none');
                        chatRecommend.classList.add('d-flex');
                    }
                    
                    // Show live-goals-widget
                    const liveGoalsWidget = document.getElementById('live-goals-widget');
                    if (liveGoalsWidget) {
                        liveGoalsWidget.style.display = 'block';
                    }
                    
                    // Immediately generate assistant response with scenario context
                    // The server has created a hidden user message with scenario context
                    // Now we generate the completion so the assistant responds within this context
                    if (data.autoGenerateResponse && typeof window.generateChatCompletion === 'function') {
                        window.generateChatCompletion();
                    }
                    
                    // Trigger callback if available
                    if (window.onScenarioSelected) {
                        window.onScenarioSelected(selected);
                    }
                }
            }
        } catch (error) {
            console.error('[ChatScenarioModule] Error selecting scenario:', error);
        }
    }

    /**
     * Show or hide the scenario container and hide/show chatInput
     */
    function toggle(show = null) {
        // Check if scenarios are enabled before allowing toggle
        if (show === true && !isScenariosEnabled()) {
            console.log('[ChatScenarioModule] Cannot show scenarios - feature is disabled in settings');
            return;
        }

        const container = document.querySelector(containerSelector);
        if (!container) {
            return;
        }
        
        if (show === null) {
            show = container.style.display === 'none';
        }
        
        // Use flex display when showing, none when hiding
        container.style.display = show ? 'flex' : 'none';
        
        // Hide/show chatInput based on scenario display
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.style.display = show ? 'none' : 'block';
        }

        // Hide chat-thumbnail-gallery when showing scenarios, restore when hiding
        const chatRecommend = document.getElementById('chat-thumbnail-gallery');
        if (chatRecommend) {
            if (show) {
                chatRecommend.classList.add('d-none');
                chatRecommend.classList.remove('d-flex');
            } else {
                chatRecommend.classList.remove('d-none');
                chatRecommend.classList.add('d-flex');
            }
        }

        // Hide live-goals-widget when showing scenarios, restore when hiding
        const liveGoalsWidget = document.getElementById('live-goals-widget');
        if (liveGoalsWidget) {
            liveGoalsWidget.style.display = show ? 'none' : 'block';
        }

        // Hide chat overlay when showing scenarios, restore when hiding
        const chatOverlay = document.getElementById('chatOverlay');
        if (chatOverlay) {
            chatOverlay.style.display = show ? 'none' : 'block';
        }
    }

    /**
     * Show scenarios
     */
    function show() {
        // Check if scenarios are enabled
        if (!isScenariosEnabled()) {
            return;
        }
        toggle(true);
    }

    /**
     * Hide scenarios
     */
    function hide() {
        toggle(false);
    }

    /**
     * Get current scenario
     */
    function getCurrentScenario() {
        return currentScenario;
    }

    /**
     * Get all available scenarios
     */
    function getScenarios() {
        return scenarios;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Clear all scenarios and reset state
     */
    function clearScenarios() {
        scenarios = [];
        currentScenario = null;
        isLoadingScenarios = false;
        
        if (swiper) {
            swiper.destroy();
            swiper = null;
        }
        
        const container = document.querySelector(containerSelector);
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
        
        removeSelectedScenarioDisplay();
    }

    // Public API
    return {
        init,
        generateScenarios,
        displayScenarios,
        displayLoadingState,
        displaySelectedScenario,
        removeSelectedScenarioDisplay,
        selectScenario,
        toggle,
        show,
        hide,
        getCurrentScenario,
        getScenarios,
        clearScenarios
    };
})();

// Initialize on chat load if in chat page
$(document).ready(function() {
    // Check if we're on the chat page
    if (typeof chatId !== 'undefined' && typeof userChatId !== 'undefined') {
        window.ChatScenarioModule.init(chatId, userChatId);
    }
});

/**
 * DEBUG MODE - Console functions for testing spinner and scenario designs
 * Available functions in browser console:
 * - showSpinner()
 * - hideSpinner()
 * - showScenarioPlaceholder()
 */
window.ScenarioDebug = {
    /**
     * Show the loading spinner for testing
     * Usage: ScenarioDebug.showSpinner()
     */
    showSpinner: function() {
        const container = document.querySelector('.scenario-container');
        if (!container) {
            console.error('[ScenarioDebug] ERROR: .scenario-container not found');
            return;
        }
        
        container.style.display = 'flex';
        container.innerHTML = `
            <div class="scenario-loading-container w-100">
                <div class="scenario-spinner"></div>
                <div class="scenario-loading-text">
                    ${window.chatScenariosTranslations?.scenarios_loading || 'Generating scenarios'}
                    <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
                </div>
            </div>
        `;
        console.log('[ScenarioDebug] ✅ Spinner displayed');
        console.log('[ScenarioDebug] Spinner should show rotating blue circle');
        console.log('[ScenarioDebug] Call ScenarioDebug.hideSpinner() to hide it');
    },

    /**
     * Hide the loading spinner
     * Usage: ScenarioDebug.hideSpinner()
     */
    hideSpinner: function() {
        const container = document.querySelector('.scenario-container');
        if (!container) {
            console.error('[ScenarioDebug] ERROR: .scenario-container not found');
            return;
        }
        
        container.style.display = 'none';
        container.innerHTML = '';
        console.log('[ScenarioDebug] ✅ Spinner hidden');
    },

    /**
     * Show placeholder scenarios for testing enhanced carousel design
     * Displays mock scenario cards with Swiper carousel navigation
     * Usage: ScenarioDebug.showScenarioPlaceholder()
     */
    showScenarioPlaceholder: function() {
        const container = document.querySelector('.scenario-container');
        if (!container) {
            console.error('[ScenarioDebug] ERROR: .scenario-container not found');
            return;
        }

        // Sample scenario data for testing
        const placeholderScenarios = [
            {
                id: 'debug-1',
                title: 'Romantic Scenario',
                description: 'Engage in heartfelt conversation with gentle humor and genuine interest in their life story. Share meaningful moments together.',
                emotionalTone: 'Flirty',
                conversationDirection: 'Love-focused'
            },
            {
                id: 'debug-2',
                title: 'Adventure Seeker',
                description: 'Be enthusiastic about exploring new ideas, experiences, and pushing boundaries together. Embrace the unknown with curiosity and excitement.',
                emotionalTone: 'Adventurous',
                conversationDirection: 'Action-oriented'
            },
            {
                id: 'debug-3',
                title: 'Deep Intellectual',
                description: 'Engage in thoughtful philosophical discussions with nuanced perspectives and curiosity. Delve into complex ideas and abstract concepts.',
                emotionalTone: 'Intellectual',
                conversationDirection: 'Knowledge-seeking'
            },
            {
                id: 'debug-4',
                title: 'Supportive Confidant',
                description: 'Provide empathetic listening and genuine support. Create a safe space for vulnerability and emotional expression.',
                emotionalTone: 'Caring',
                conversationDirection: 'Emotionally-focused'
            }
        ];

        container.style.display = 'flex';
        container.innerHTML = '';

        // Create Swiper container
        const swiperContainer = document.createElement('div');
        swiperContainer.className = 'swiper scenario-debug-swiper';
        
        // Create swiper wrapper
        const swiperWrapper = document.createElement('div');
        swiperWrapper.className = 'swiper-wrapper';
        
        // Create scenario slides
        placeholderScenarios.forEach((scenario, index) => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            
            const card = document.createElement('div');
            card.className = 'scenario-card w-100';
            card.dataset.scenarioId = scenario.id;
            
            // Add hover effect on mouse events
            card.addEventListener('mouseenter', function() {
                console.log(`[ScenarioDebug] 🎯 Hovering over: ${scenario.title}`);
            });
            
            card.addEventListener('click', function() {
                console.log(`[ScenarioDebug] ✅ Selected: ${scenario.title}`);
                document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
            });

            card.innerHTML = `
                <div class="scenario-card-header">
                    <h3 class="scenario-title">${scenario.title}</h3>
                </div>
                <p class="scenario-description">${scenario.description}</p>
            `;
            
            slide.appendChild(card);
            swiperWrapper.appendChild(slide);
        });
        
        swiperContainer.appendChild(swiperWrapper);
        
        // Add pagination
        const pagination = document.createElement('div');
        pagination.className = 'swiper-pagination';
        swiperContainer.appendChild(pagination);
        
        // Add navigation
        const prevButton = document.createElement('div');
        prevButton.className = 'swiper-button-prev';
        // Prevent nav clicks from bubbling to slides (which would trigger selection)
        prevButton.addEventListener('click', function(e) { e.stopPropagation(); });
        prevButton.addEventListener('pointerdown', function(e) { e.stopPropagation(); });
        swiperContainer.appendChild(prevButton);
        
        const nextButton = document.createElement('div');
        nextButton.className = 'swiper-button-next';
        // Prevent nav clicks from bubbling to slides (which would trigger selection)
        nextButton.addEventListener('click', function(e) { e.stopPropagation(); });
        nextButton.addEventListener('pointerdown', function(e) { e.stopPropagation(); });
        swiperContainer.appendChild(nextButton);
        
        // Prevent pagination clicks from bubbling to slides
        pagination.addEventListener('click', function(e) { e.stopPropagation(); });

        container.appendChild(swiperContainer);

        // Initialize Swiper for debug
        const debugSwiper = new Swiper('.scenario-debug-swiper', {
            slidesPerView: 1,
            spaceBetween: 10,
            loop: false,
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            on: {
                slideChange: function () {
                    console.log(`[ScenarioDebug] 🔄 Swiped to slide ${this.activeIndex + 1}/${placeholderScenarios.length}`);
                },
            },
        });

        console.log('%c[ScenarioDebug] ✅ Swiper Carousel Displayed', 'color: #28a745; font-weight: bold; font-size: 14px;');
        console.log('%c📋 Swiper Features Enabled:', 'color: #dc3545; font-weight: bold;');
        console.log(`
  ✅ Touch/swipe navigation on mobile devices
  ✅ Clickable pagination dots
  ✅ Arrow button navigation
  ✅ Smooth slide transitions
  
  Total scenarios: ${placeholderScenarios.length}
        `);
        console.log('%c📋 What to verify:', 'color: #007bff; font-weight: bold;');
        console.log(`
  ✓ Swiper carousel is CENTERED on screen
  ✓ Cards display with proper spacing
  ✓ All card content is visible (no overflow)
  ✓ Cards have max-height with scrollable overflow-y
  ✓ Navigation arrows positioned outside card with spacing
  ✓ Dot indicators at bottom
  ✓ Smooth transitions between slides
  ✓ Hover effects on cards (lift + shadow)
  ✓ Click to select (turns card purple)
  ✓ Swipe gestures work on touch devices
  
  ➡️ Swipe right to go to next scenario
  ⬅️ Swipe left to go to previous scenario
  🔴 Dots always match current slide
        `);
        console.log('%c💡 Interactive Tests:', 'color: #6E20F4; font-weight: bold;');
        console.log(`
  1. Swipe left/right on mobile or drag on desktop → navigate between scenarios smoothly
  2. Hover over cards → should lift with enhanced shadow
  3. Click cards → should turn green/purple and be marked as selected
  4. Use arrow buttons → navigate between scenarios smoothly
  5. Click dots → jump to specific scenario and sync with arrows
  6. Resize browser → test responsive breakpoints
  7. Scroll card content → if description is long
        `);
    },

    /**
     * Show responsive design test at different breakpoints
     * Usage: ScenarioDebug.testResponsive()
     */
    testResponsive: function() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        let breakpoint = 'Desktop (1024px+)';
        let columns = '3 columns';
        
        if (width < 768) {
            breakpoint = 'Mobile (< 768px)';
            columns = '1 column';
        } else if (width < 1024) {
            breakpoint = 'Tablet (768px - 1023px)';
            columns = '2 columns';
        }

        console.log('[ScenarioDebug] 📱 Responsive Breakpoint Test');
        console.log(`Screen Size: ${width}px × ${height}px`);
        console.log(`Current Breakpoint: ${breakpoint}`);
        console.log(`Expected Layout: ${columns}`);
        console.log(`---`);
        console.log(`To test other breakpoints:`);
        console.log(`1. Right-click on page → Inspect`);
        console.log(`2. Press Ctrl+Shift+M (or Cmd+Shift+M on Mac) to toggle device mode`);
        console.log(`3. Resize to test different breakpoints`);
    },

    /**
     * Show all debug information and available commands
     * Usage: ScenarioDebug.help()
     */
    help: function() {
        console.log('%c=== SCENARIO DEBUG MODE ===', 'color: #007bff; font-size: 16px; font-weight: bold;');
        console.log('%c📋 Available Commands:', 'color: #28a745; font-weight: bold;');
        console.log(`
  1. ScenarioDebug.showSpinner()
     → Display loading spinner with animation
     → Shows: rotating circle + "Generating scenarios..." text

  2. ScenarioDebug.hideSpinner()
     → Hide the spinner and clear container
     
  3. ScenarioDebug.showScenarioPlaceholder()
     → Display 4 placeholder scenario cards with Swiper carousel
     → Test: swipe navigation, hover effects, click to select, responsive layout
     → Click any card to see selection feedback

  4. ScenarioDebug.testResponsive()
     → Show current viewport and expected breakpoint
     → Resize browser to test responsive layout

  5. ScenarioDebug.help()
     → Show this help message
        `);
        
        console.log('%c🎨 What to test:', 'color: #007bff; font-weight: bold;');
        console.log(`
  SPINNER:
    ✓ Rotates smoothly (1s per rotation)
    ✓ Blue color (#007bff)
    ✓ Animated dots beneath text
    
  SWIPER CAROUSEL:
    ✓ Touch/swipe navigation on mobile devices
    ✓ Clickable pagination dots
    ✓ Arrow button navigation
    ✓ Smooth slide transitions
    ✓ Hover: card lifts 4px, shadow enhances, border turns blue
    ✓ Click: card turns green, shows checkmark
    ✓ Consistent spacing and typography
    
  RESPONSIVE:
    ✓ Mobile (< 768px): 1 column, full width
    ✓ Tablet (768-1023px): 2 columns, balanced
    ✓ Desktop (1024px+): 3 columns, optimal
        `);

        console.log('%c💡 Quick Test:', 'color: #28a745; font-weight: bold;');
        console.log(`
  1. Run: ScenarioDebug.showSpinner()
  2. Wait 3 seconds, then run: ScenarioDebug.hideSpinner()
  3. Run: ScenarioDebug.showScenarioPlaceholder()
  4. Swipe left/right or drag on desktop → navigate between scenarios
  5. Hover over cards to test hover effect
  6. Click a card to test selection
  7. Run: ScenarioDebug.testResponsive()
  8. Resize browser window and repeat step 4-6
        `);
    }
};
