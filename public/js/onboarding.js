/**
 * Interactive Onboarding Funnel System
 * Guides new users through 7 key steps to maximize conversion
 */
class OnboardingFunnel {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 3; // Reduced from 4 to 3 (removed completion step)
        this.userData = {};
        this.translations = window.onboardingTranslations || {};
        this.userId = window.user?._id || window.userId;
        
        // Debug translations availability
        console.debug('[debug] Constructor - translations available:', Object.keys(this.translations).length > 0);
        console.debug('[debug] Constructor - window.onboardingTranslations:', window.onboardingTranslations);

        // If no translations loaded, try to load them
        if (Object.keys(this.translations).length === 0) {
            this.loadTranslations();
        }
    }

    // Load translations if not already available
    async loadTranslations() {
        try {
            // Get user's language preference or default to English
            const lang = window.user?.language || document.documentElement.lang || 'en';
            console.debug('[debug] Loading translations for language:', lang);
            
            const response = await fetch(`/locales/onboarding-${lang}.json`);
            if (response.ok) {
                this.translations = await response.json();
                window.onboardingTranslations = this.translations;
                console.debug('[debug] Translations loaded successfully:', Object.keys(this.translations).length, 'keys');
            } else {
                console.warn('[debug] Failed to load translations, using fallbacks');
                this.translations = this.getFallbackTranslations();
            }
        } catch (error) {
            console.error('[debug] Error loading translations:', error);
            this.translations = this.getFallbackTranslations();
        }
    }

    // Fallback translations in case loading fails
    getFallbackTranslations() {
        return {
            welcome: "Welcome to Your AI Companion!",
            step1_intro: "Let's personalize your experience in just a few steps",
            create_persona: "Tell Us About Yourself",
            step2_intro: "Help us create your personal profile",
            character_preferences: "Your Character Preferences",
            step3_intro: "What kind of companions do you prefer?",
            select_character: "Choose Your First Companion",
            step4_intro: "Pick a character to start your adventure",
            onboarding_complete_notification: "Welcome! Your setup is complete and you're ready to start chatting!",
            continue: "Continue",
            back: "Back",
            start_chatting: "Start Chatting",
            nickname: "Nickname",
            nickname_placeholder: "How would you like to be called?",
            gender: "Gender",
            male: "Male",
            female: "Female",
            other: "Other",
            birthdate: "Birth Date"
        };
    }

    // Translation helper - simplified like chat-tool-settings.js
    t(key, fallback = key) {
        return this.translations[key] || fallback;
    }

    async start() {
        console.debug('[debug] start() called for userId:', this.userId);
        if (!this.userId) {
            console.error('No user ID available for onboarding');
            return;
        }

        // Ensure translations are loaded before starting
        if (Object.keys(this.translations).length === 0) {
            console.debug('[debug] Translations not loaded, loading now...');
            await this.loadTranslations();
        }

        // Check if user has already completed onboarding
        const hasCompleted = localStorage.getItem(`onboarding_${this.userId}`);
        if (hasCompleted) {
            console.debug('[debug] Onboarding already completed for userId:', this.userId);
            console.log('Onboarding already completed for this user');
            return;
        }

        this.showStep(0);
    }

    showStep(stepIndex) {
        console.debug('[debug] showStep() called with stepIndex:', stepIndex);
        this.currentStep = stepIndex;

        // Get the Bootstrap modal
        const modal = document.getElementById('onboardingModal');
        console.debug('[debug] Found modal element:', modal);
        
        // Update progress bar
        this.updateProgressBar(stepIndex);
        
        // Generate step content
        const stepContent = this.getStepContent(stepIndex);
        console.debug('[debug] Generated step content length:', stepContent.length);
        
        // Update modal content
        this.updateModalContent(stepIndex, stepContent);
        
        // Add event listeners for this step
        this.bindStepEvents(stepIndex);
        
        // Show modal using Bootstrap
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        console.debug('[debug] Showed Bootstrap modal');
    }

    // Add new method to update progress bar
    updateProgressBar(stepIndex) {
        const progressBar = document.getElementById('onboardingProgressBar');
        if (!progressBar) {
            console.debug('[debug] Progress bar element not found');
            return;
        }

        // Calculate progress percentage (step 0 = 25%, step 1 = 50%, step 2 = 75%, step 3 = 100%)
        const progressPercentage = ((stepIndex + 1) / this.totalSteps) * 100;
        
        console.debug('[debug] Updating progress bar to', progressPercentage + '%', 'for step', stepIndex);
        progressBar.style.width = progressPercentage + '%';
    }

    getStepContent(stepIndex) {
        // Get template from DOM
        const template = document.getElementById(`onboarding-step-${stepIndex}`);
        console.debug('[debug] getStepContent - template element:', template);
        
        if (template) {
            console.debug('[debug] Template innerHTML:', template.innerHTML.substring(0, 300));
            
            // Use innerHTML directly since Handlebars placeholders get processed differently
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = template.innerHTML;
            
            console.debug('[debug] Before replacement - tempDiv innerHTML:', tempDiv.innerHTML.substring(0, 300));
            
            // Replace translation placeholders with actual translations
            this.replaceTranslationsInHTML(tempDiv);
            
            const result = tempDiv.innerHTML;
            console.debug('[debug] Final result after replacement:', result.substring(0, 300));
            return result;
        }
        
        // If template not found, show error
        console.error(`Template not found for step ${stepIndex}`);
        return `
            <div class="onboarding-content">
                <div class="text-center">
                    <p class="text-danger">Template not found for step ${stepIndex}</p>
                    <p>Make sure the onboarding-modals.hbs partial is included.</p>
                    <button class="btn btn-info" onclick="window.onboardingDebug.showDebugModal()">Debug Info</button>
                </div>
            </div>
        `;
    }

    // New method specifically for handling HTML with Handlebars-style placeholders
    replaceTranslationsInHTML(element) {
        console.debug('[debug] replaceTranslationsInHTML called');
        
        // Get the HTML as string and replace placeholders
        let html = element.innerHTML;
        console.debug('[debug] Original HTML:', html.substring(0, 200));
        
        // Replace {{window.onboardingTranslations.key}} patterns in the HTML string
        html = html.replace(/\{\{window\.onboardingTranslations\.(\w+)\}\}/g, (match, key) => {
            const translation = this.t(key, `[MISSING: ${key}]`);
            console.debug(`[debug] HTML replacement: "${match}" -> "${translation}"`);
            return translation;
        });
        
        console.debug('[debug] HTML after replacement:', html.substring(0, 200));
        element.innerHTML = html;
        
        // Also handle any remaining text nodes that might have been missed
        this.replaceTranslations(element);
    }

    // Helper method to replace translation placeholders in DOM elements
    replaceTranslations(element) {
        console.debug('[debug] replaceTranslations called, available keys:', Object.keys(this.translations).length);
        console.debug('[debug] Element to process:', element);
        
        // First, let's see what we're working with
        if (element.innerHTML) {
            console.debug('[debug] Element innerHTML:', element.innerHTML.substring(0, 300));
        }
        
        // Handle text content in all elements including the root
        const allElements = [element, ...element.querySelectorAll('*')];
        console.debug('[debug] Processing', allElements.length, 'elements');
        
        allElements.forEach((el, index) => {
            console.debug(`[debug] Processing element ${index}:`, el.tagName, el.textContent?.substring(0, 100));
            
            // Process text content
            if (el.childNodes) {
                el.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        let text = node.textContent;
                        const originalText = text;
                        
                        // Replace {{window.onboardingTranslations.key}} patterns
                        text = text.replace(/\{\{window\.onboardingTranslations\.(\w+)\}\}/g, (match, key) => {
                            const translation = this.t(key, `[MISSING: ${key}]`);
                            console.debug(`[debug] Translating "${match}" -> "${translation}"`);
                            return translation;
                        });
                        
                        if (originalText !== text) {
                            console.debug(`[debug] Text node changed from "${originalText}" to "${text}"`);
                            node.textContent = text;
                        }
                    }
                });
            }
            
            // Process attributes that might contain translations
            ['placeholder', 'title', 'alt'].forEach(attr => {
                if (el.hasAttribute && el.hasAttribute(attr)) {
                    let attrValue = el.getAttribute(attr);
                    const originalValue = attrValue;
                    
                    attrValue = attrValue.replace(/\{\{window\.onboardingTranslations\.(\w+)\}\}/g, (match, key) => {
                        const translation = this.t(key, `[MISSING: ${key}]`);
                        console.debug(`[debug] Translating attribute ${attr} "${match}" -> "${translation}"`);
                        return translation;
                    });
                    
                    if (originalValue !== attrValue) {
                        console.debug(`[debug] Attribute ${attr} changed from "${originalValue}" to "${attrValue}"`);
                        el.setAttribute(attr, attrValue);
                    }
                }
            });
        });
        
        // Log final result
        if (element.innerHTML) {
            console.debug('[debug] Final element innerHTML:', element.innerHTML.substring(0, 300));
        }
    }

    updateModalContent(stepIndex, stepContent) {
        console.debug('[debug] Updating modal with content:', stepContent.substring(0, 100) + '...');
        
        const contentContainer = document.getElementById('onboardingModalContent');
        const footerContainer = document.getElementById('onboardingModalFooter');
        
        if (!contentContainer || !footerContainer) {
            console.error('[debug] Modal containers not found');
            return;
        }

        // Clear previous content
        contentContainer.innerHTML = '';
        footerContainer.innerHTML = '';

        // Parse the step content to extract different sections
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = stepContent;
        
        // Extract footer buttons first
        const footerButtons = tempDiv.querySelector('.onboarding-footer-buttons');
        if (footerButtons) {
            // Move footer buttons to actual modal footer
            footerButtons.classList.remove('d-none');
            footerContainer.appendChild(footerButtons.cloneNode(true));
            console.debug('[debug] Added footer buttons to modal footer');
        }
        
        // For step 0 (welcome + personal info), handle it like other steps but with different structure
        if (stepIndex === 0) {
            // Step 0 has everything in .onboarding-welcome, treat it as the main content
            const welcomeContent = tempDiv.querySelector('.onboarding-welcome');
            if (welcomeContent) {
                // Remove footer buttons from content since they're now in modal footer
                const contentFooter = welcomeContent.querySelector('.onboarding-footer-buttons');
                if (contentFooter) {
                    contentFooter.remove();
                }
                contentContainer.innerHTML = welcomeContent.outerHTML;
                console.debug('[debug] Set step 0 welcome content, length:', welcomeContent.outerHTML.length);
            } else {
                contentContainer.innerHTML = stepContent;
                console.debug('[debug] Set step 0 content directly, length:', stepContent.length);
            }
            return;
        }

        // For other steps (1, 2, 3), handle header/content structure
        const header = tempDiv.querySelector('.onboarding-header');
        const content = tempDiv.querySelector('.onboarding-content');

        // Add header if present
        if (header) {
            contentContainer.appendChild(header.cloneNode(true));
            console.debug('[debug] Added header section');
        }

        // Add content if present
        if (content) {
            contentContainer.appendChild(content.cloneNode(true));
            console.debug('[debug] Added content section');
        }

        console.debug('[debug] Modal content updated successfully');
    }

    hideCurrentStep(callback) {
        const modal = document.getElementById('onboardingModal');
        if (modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) {
                bootstrapModal.hide();
            }
            // Wait for modal to hide before callback
            modal.addEventListener('hidden.bs.modal', function handler() {
                modal.removeEventListener('hidden.bs.modal', handler);
                if (callback) callback();
            });
        }
    }

    close() {
        const modal = document.getElementById('onboardingModal');
        if (modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) {
                bootstrapModal.hide();
            }
        }
    }

    bindStepEvents(stepIndex) {
        // Bind events specific to each step
        switch (stepIndex) {
            case 0:
                this.bindWelcomePersonalInfoEvents();
                break;
            case 1:
                this.bindPreferencesEvents();
                break;
            case 2:
                this.loadCharacterRecommendations();
                break;
        }
    }

    bindWelcomePersonalInfoEvents() {
        // Add small delay to ensure DOM is ready
        setTimeout(() => {
            // Nickname input
            const nicknameInput = document.getElementById('userNickname');
            if (nicknameInput) {
                nicknameInput.addEventListener('input', async (e) => {
                    this.userData.nickname = e.target.value.trim();
                    console.debug('[debug] Updated nickname:', this.userData.nickname);
                    
                    // Update user in database if nickname is not empty
                    if (this.userData.nickname) {
                        await this.updateUserData({ nickname: this.userData.nickname });
                    }
                    this.validateStep0();
                });
            }

            // Gender selection (simplified to male/female only)
            document.querySelectorAll('.option-btn[data-gender]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    document.querySelectorAll('.option-btn[data-gender]').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.userData.gender = e.currentTarget.dataset.gender;
                    console.debug('[debug] Selected gender:', this.userData.gender);
                    
                    // Update user in database
                    await this.updateUserData({ gender: this.userData.gender });
                    this.validateStep0();
                });
            });

            // Age selection
            document.querySelectorAll('.age-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.userData.age = e.currentTarget.dataset.age;
                    console.debug('[debug] Selected age:', this.userData.age);
                    
                    // Update user in database
                    await this.updateUserData({ ageRange: this.userData.age });
                    this.validateStep0();
                });
            });

            console.debug('[debug] Welcome/Personal info events bound successfully');
        }, 100);
    }

    bindPreferencesEvents() {
        // Add small delay to ensure DOM is ready
        setTimeout(() => {
            // Style selection
            document.querySelectorAll('.style-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.userData.preferredStyle = e.target.dataset.style;
                    console.debug('[debug] Selected style:', this.userData.preferredStyle);
                    
                    // Update user in database
                    await this.updateUserData({ preferredImageStyle: this.userData.preferredStyle });
                    this.validateStep1();
                });
            });

            // Character gender selection
            document.querySelectorAll('.char-gender-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    document.querySelectorAll('.char-gender-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.userData.preferredCharacterGender = e.target.dataset.charGender;
                    console.debug('[debug] Selected character gender:', this.userData.preferredCharacterGender);
                    
                    // Update user in database
                    await this.updateUserData({ preferredCharacterGender: this.userData.preferredCharacterGender });
                    this.validateStep1();
                });
            });

            console.debug('[debug] Preferences events bound successfully');
        }, 100);
    }

    // Add validation methods
    validateStep0() {
        const hasRequiredFields = this.userData.nickname && 
                                  this.userData.nickname.trim().length > 0 && 
                                  this.userData.gender && 
                                  this.userData.age;
        const continueBtn = document.querySelector('.btn-continue');
        if (continueBtn) {
            continueBtn.disabled = !hasRequiredFields;
            console.debug('[debug] Step 0 validation:', hasRequiredFields, {
                nickname: this.userData.nickname,
                gender: this.userData.gender,
                age: this.userData.age
            });
        }
    }

    validateStep1() {
        const hasRequiredFields = this.userData.preferredStyle && this.userData.preferredCharacterGender;
        const continueBtn = document.querySelector('.btn-continue');
        if (continueBtn) {
            continueBtn.disabled = !hasRequiredFields;
            console.debug('[debug] Step 1 validation:', hasRequiredFields);
        }
    }

    validateStep2() {
        const hasSelection = this.userData.selectedCharacter;
        const continueBtn = document.querySelector('.btn-continue');
        if (continueBtn) {
            continueBtn.disabled = !hasSelection;
            console.debug('[debug] Step 2 validation:', hasSelection);
        }

        // Complete onboarding if all steps are valid
        this.complete();
    }

    // Add real-time user update method
    async updateUserData(data) {
        if (!this.userId) {
            console.debug('[debug] No user ID available for update');
            return;
        }

        try {
            console.debug('[debug] Updating user data:', data);
            const response = await fetch(`/user/onboarding-update/${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                console.debug('[debug] User data updated successfully:', data);
            } else {
                console.debug('[debug] Failed to update user data:', result.error);
            }
        } catch (error) {
            console.debug('[debug] Error updating user data:', error);
        }
    }

    async loadCharacterRecommendations() {
        try {
            const params = new URLSearchParams({
                style: this.userData.preferredStyle || 'anime',
                gender: this.userData.preferredCharacterGender || 'female',
                limit: 10
            });

            const response = await fetch(`/api/character-recommendations?${params}`);
            const data = await response.json();

            if (data.success && data.characters) {
                this.renderCharacterRecommendations(data.characters);
            }
        } catch (error) {
            console.error('Error loading character recommendations:', error);
        }
    }

    renderCharacterRecommendations(characters) {
        const container = document.getElementById('character-recommendations');
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';
        
        // Use the existing displayChats function which already handles all the formatting
        window.displayChats(characters, 'character-recommendations');
        
        // Add click event listeners to the generated character cards for selection
        container.querySelectorAll('.gallery-card').forEach(card => {
            const chatId = card.dataset.id;
            if (chatId) {
                // Remove the existing onclick from displayChats and add our selection logic
                const clickableArea = card.querySelector('.chat-card-clickable-area');
                if (clickableArea) {
                    
                    // Add our selection click handler
                    clickableArea.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.selectCharacter(chatId);
                    });
                    
                    // Update cursor to indicate it's selectable
                    clickableArea.style.cursor = 'pointer';
                }
            }
        });
    }

    selectCharacter(characterId) {
        this.userData.selectedCharacter = characterId;
        
        // Remove selected class from all cards
        const container = document.getElementById('character-recommendations');
        if (container) {
            container.querySelectorAll('.gallery-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // Add selected class to the chosen card
            const selectedCard = container.querySelector(`[data-id="${characterId}"]`);
            if (selectedCard) {
                selectedCard.classList.add('selected');
                console.debug('[debug] Selected character:', characterId);
                
                // Add some visual feedback for selection
                if (!document.getElementById('onboarding-selection-styles')) {
                    const style = document.createElement('style');
                    style.id = 'onboarding-selection-styles';
                    document.head.appendChild(style);
                }
                
                // Update user in database
                this.updateUserData({ selectedCharacter: characterId });
 
                // Validate step 2
                this.validateStep2();
                
            }
        }
    }

    nextStep() {
        console.debug('[debug] nextStep() called on currentStep:', this.currentStep);
        // Collect data from current step
        this.collectStepData();
        
        if (this.currentStep < this.totalSteps - 1) {
            console.debug('[debug] Proceeding to next step:', this.currentStep + 1);
            this.hideCurrentStep(() => {
                this.showStep(this.currentStep + 1);
            });
        } else {
            console.debug('[debug] Final step reached, completing onboarding.');
            this.complete();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.hideCurrentStep(() => {
                this.showStep(this.currentStep - 1);
            });
        }
    }

    collectStepData() {
        switch (this.currentStep) {
            case 0:
                // Data is already collected via event handlers
                break;
        }
    }

    async complete() {
        console.debug('[debug] complete() called for userId:', this.userId);
        try {
            // Save onboarding data
            const response = await fetch('/user/onboarding-complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.userId,
                    onboardingData: this.userData,
                    completedAt: new Date().toISOString()
                })
            });

            if (response.ok) {
                console.debug('[debug] Onboarding complete response OK, marking as completed.');
                // Mark as completed in localStorage
                localStorage.setItem(`onboarding_${this.userId}`, 'completed');
                
                // Close onboarding
                this.close();
                
                // Show completion notification
                showNotification(this.t('onboarding_complete_notification', 'Welcome! Your setup is complete and you\'re ready to start chatting!'), 'success');
                
            }
        } catch (error) {
            console.debug('[debug] Error during complete():', error);
            console.error('Error completing onboarding:', error);
        }
    }

    // Debug methods for testing from console
    debug = {
        // Test specific step
        showStep: (stepIndex) => {
            console.debug('[debug] Manual step test:', stepIndex);
            this.showStep(stepIndex);
        },
        
        // Show debug modal with translation info
        showDebugModal: () => {
            const debugContent = `
                <div class="debug-info">
                    <h5>Debug Information</h5>
                    <div class="mb-3">
                        <strong>Translations Available:</strong> ${Object.keys(this.translations).length > 0 ? 'Yes' : 'No'}<br>
                        <strong>Translation Keys:</strong> ${Object.keys(this.translations).length}<br>
                        <strong>User ID:</strong> ${this.userId}<br>
                        <strong>Current Step:</strong> ${this.currentStep}
                    </div>
                    
                    <div class="mb-3">
                        <strong>Sample Translations:</strong><br>
                        <code>welcome: "${this.t('welcome', 'NOT_FOUND')}"</code><br>
                        <code>continue: "${this.t('continue', 'NOT_FOUND')}"</code><br>
                        <code>skip: "${this.t('skip', 'NOT_FOUND')}"</code>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Templates Found:</strong><br>
                        ${Array.from({length: 5}, (_, i) => {
                            const template = document.getElementById(`onboarding-step-${i}`);
                            return `<code>Step ${i}: ${template ? 'Found' : 'Missing'}</code><br>`;
                        }).join('')}
                    </div>
                    
                    <div class="mb-3">
                        <strong>Window Objects:</strong><br>
                        <code>window.onboardingTranslations: ${window.onboardingTranslations ? 'Available' : 'Missing'}</code><br>
                        <code>window.user: ${window.user ? 'Available' : 'Missing'}</code>
                    </div>
                    
                    <button class="btn btn-primary" onclick="window.onboardingDebug.testTranslations()">Test Translations</button>
                    <button class="btn btn-secondary" onclick="window.onboardingDebug.testTemplate(0)">Test Template 0</button>
                </div>
            `;
            
            // Update modal with debug content
            document.getElementById('onboardingModalLabel').textContent = 'Debug Information';
            document.getElementById('onboardingModalSubtitle').textContent = 'Onboarding System Debug';
            document.getElementById('onboardingModalContent').innerHTML = debugContent;
            document.getElementById('onboardingModalFooter').innerHTML = `
                <button type="button" class="btn btn-secondary" onclick="window.onboardingDebug.reset()">Reset</button>
                <button type="button" class="btn btn-primary" onclick="window.onboardingFunnel.close()">Close</button>
            `;
            
            // Show modal
            const modal = document.getElementById('onboardingModal');
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
        },
        
        // Test template extraction with more details
        testTemplate: (stepIndex) => {
            console.debug(`[debug] Testing template extraction for step ${stepIndex}`);
            const template = document.getElementById(`onboarding-step-${stepIndex}`);
            console.log('Template element:', template);
            console.log('Template innerHTML:', template?.innerHTML);
            console.log('Template content:', template?.content);
            
            if (template) {
                // Test raw HTML replacement
                const testDiv = document.createElement('div');
                testDiv.innerHTML = template.innerHTML;
                console.log('Raw template HTML:', testDiv.innerHTML);
                
                // Test our replacement function
                const testHtml = testDiv.innerHTML.replace(/\{\{window\.onboardingTranslations\.(\w+)\}\}/g, (match, key) => {
                    const translation = this.t(key, `[MISSING: ${key}]`);
                    console.log(`Replacing "${match}" with "${translation}"`);
                    return translation;
                });
                
                console.log('After replacement:', testHtml);
            }
            
            const content = this.getStepContent(stepIndex);
            console.log('Final processed content:', content);
            return content;
        },
        
        // Test all steps sequentially
        testAllSteps: () => {
            console.debug('[debug] Testing all steps');
            for (let i = 0; i < this.totalSteps; i++) {
                setTimeout(() => {
                    console.debug(`[debug] Auto-showing step ${i}`);
                    this.close();
                    setTimeout(() => this.showStep(i), 100);
                }, i * 2000);
            }
        },
        
        // Force start onboarding
        forceStart: async () => {
            console.debug('[debug] Force starting onboarding');
            localStorage.removeItem(`onboarding_${this.userId}`);
            await this.start();
        },
        
        // Check current state
        getState: () => {
            return {
                currentStep: this.currentStep,
                totalSteps: this.totalSteps,
                userData: this.userData,
                userId: this.userId,
                translations: Object.keys(this.translations).length > 0 ? 'loaded' : 'empty',
                translationKeys: Object.keys(this.translations),
                windowTranslations: window.onboardingTranslations ? 'available' : 'missing',
                templatesFound: Array.from({length: 5}, (_, i) => {
                    return document.getElementById(`onboarding-step-${i}`) ? `step-${i}` : null;
                }).filter(Boolean)
            };
        },
        
        // Test translation function
        testTranslations: () => {
            const testKeys = ['welcome', 'continue', 'back', 'onboarding_complete', 'create_persona'];
            console.debug('[debug] Testing translations:');
            testKeys.forEach(key => {
                console.log(`${key}: "${this.t(key)}"`);
            });
            console.log('Available translation keys:', Object.keys(this.translations));
            console.log('window.onboardingTranslations:', window.onboardingTranslations);
            
            // Log template content for debugging
            const template0 = document.getElementById('onboarding-step-0');
            if (template0) {
                console.log('Template 0 innerHTML:', template0.innerHTML);
            }
        },
        
        // Force reload translations
        reloadTranslations: async () => {
            console.debug('[debug] Force reloading translations');
            await this.loadTranslations();
            console.log('Translations reloaded:', Object.keys(this.translations).length, 'keys');
        },
        
        // Reset onboarding state
        reset: () => {
            console.debug('[debug] Resetting onboarding state');
            localStorage.removeItem(`onboarding_${this.userId}`);
            this.close();
            this.currentStep = 0;
            this.userData = {};
        }
    };
}

// Initialization and style injection
document.addEventListener('DOMContentLoaded', () => {
    // Check if user should see onboarding
    const user = window.user;
    if (user && !user.isTemporary && user.firstTime !== false) {
        window.onboardingFunnel = new OnboardingFunnel();
        // Auto-start onboarding for first-time users
        setTimeout(() => {
            window.onboardingFunnel.start();
        }, 1000);
    } else {
        // Initialize for manual restart
        window.onboardingFunnel = new OnboardingFunnel();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OnboardingFunnel;
}

// Make debug methods available globally
window.onboardingDebug = {
    showStep: (stepIndex) => window.onboardingFunnel?.debug.showStep(stepIndex),
    showDebugModal: () => window.onboardingFunnel?.debug.showDebugModal(),
    testTemplate: (stepIndex) => window.onboardingFunnel?.debug.testTemplate(stepIndex),
    testAllSteps: () => window.onboardingFunnel?.debug.testAllSteps(),
    forceStart: () => window.onboardingFunnel?.debug.forceStart(),
    getState: () => window.onboardingFunnel?.debug.getState(),
    testTranslations: () => window.onboardingFunnel?.debug.testTranslations(),
    reloadTranslations: () => window.onboardingFunnel?.debug.reloadTranslations(),
    reset: () => window.onboardingFunnel?.debug.reset(),
    help: () => {
        console.log(`
🛠️ ONBOARDING DEBUG COMMANDS

Test individual steps:
  onboardingDebug.showStep(0)      // Show welcome step
  onboardingDebug.testTemplate(0)  // Test template extraction for step 0
  onboardingDebug.showDebugModal() // Show debug information modal

Test all steps automatically:
  onboardingDebug.testAllSteps()   // Cycles through all steps with 2s delays

Force start onboarding (ignores completion status):
  onboardingDebug.forceStart()     // Removes localStorage flag and starts

Check current state:
  onboardingDebug.getState()       // Returns current step, userData, etc.

Test translations:
  onboardingDebug.testTranslations() // Shows translated text for key elements

Reset everything:
  onboardingDebug.reset()          // Clears localStorage, closes modal, resets state

💡 TIP: Try "onboardingDebug.showDebugModal()" to see all debug info in a modal
        `);
    }
};

// Log debug availability with usage instructions
console.log(`
🛠️ [DEBUG] Onboarding debug methods loaded!

Quick start:
- Type "onboardingDebug.help()" for full command list
- Try "onboardingDebug.showStep(0)" to test welcome step
- Use "onboardingDebug.forceStart()" to bypass completion check

Open DevTools Console (F12) to use these commands.
`);

/**
 * Bootstrap Modal HTML Structure
 * Ensure this is included in your HTML file
 */
/*
<div class="modal fade" id="onboardingModal" tabindex="-1" aria-labelledby="onboardingModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="onboardingModalLabel">Onboarding</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div id="onboardingModalSubtitle" class="text-muted mb-3"></div>
        <div id="onboardingModalContent"></div>
      </div>
      <div class="modal-footer" id="onboardingModalFooter">
        <!-- Dynamic footer buttons will be injected here -->
      </div>
    </div>
  </div>
</div>
*/