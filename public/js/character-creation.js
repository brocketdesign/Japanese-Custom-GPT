/**
 * Character Creation System
 * For logged-in users to create their AI companion (Female only)
 * Guides them through character customization with image generation
 */

(function() {
    'use strict';
    
    // Cleanup previous instance if exists
    if (window.characterCreation) {
        window.characterCreation.destroy();
    }
    
    // Reset initialization flag
    window.characterCreationInitialized = false;

    class CharacterCreation {
        constructor() {
            this.currentStep = 1;
            this.totalSteps = 8;
            this.translations = window.characterCreationTranslations || window.translations?.newCharacter || {};
            this.lang = window.lang || 'en';
            this.user = window.user || {};
            this.chatId = window.chatCreationId || null;
            
            // Character data stored throughout the flow (Female only)
            this.characterData = {
                // Step 1: Style
                style: 'realistic',
                gender: 'female', // Fixed to female
                
                // Step 2: Ethnicity & Age
                ethnicity: 'caucasian',
                age: 21,
                
                // Step 3: Hair
                hairStyle: 'straight',
                hairColor: 'brunette',
                
                // Step 4: Body
                bodyType: 'slim',
                breastSize: 'medium',
                buttSize: 'medium',
                
                // Step 5: Personality
                name: '',
                personality: 'submissive',
                relationship: 'stranger',
                occupation: 'student',
                kinks: 'vanilla',
                customPrompt: '',
                
                // Step 6: Voice
                voice: 'Wise_Woman',
                
                // Step 7: Model selection
                modelId: null,
                imageStyle: null,
                imageModel: null,
                imageVersion: null,
                isUserModel: false,
                
                // Step 7: Generated Images
                generatedImages: [],
                selectedImageUrl: null
            };
            
            // Voice samples manifest
            this.voiceSamples = null;
            this.audioPlayer = null;
            this.currentPlayingVoice = null;
            
            // Image generation state
            this.isGeneratingImage = false;
            
            // Option picker data
            this.optionData = this.getOptionData();
            
            // Asset paths based on style
            this.assetPaths = {
                realistic: '/img/cold-onboarding/realistic',
                anime: '/img/cold-onboarding/anime'
            };
            
            // Track bound event handlers for cleanup
            this.boundHandlers = [];
            
            // Active popup
            this.activePopup = null;
            
            this.init();
            
            // Listen for modal close to cleanup
            const modal = document.getElementById('characterCreationModal');
            if (modal) {
                modal.addEventListener('hidden.bs.modal', () => this.destroy());
            }
        }
        
        /**
         * Destroy instance and cleanup
         */
        destroy() {
            console.log('[CharacterCreation] Destroying instance');
            this.stopAudio();
            this.closeOptionPopup();
            this.stopPolling(); // Clean up any active polling
            window.characterCreationInitialized = false;
            window.characterCreation = null;
        }
        
        /**
         * Initialize the character creation flow
         */
        async init() {
            console.log('[CharacterCreation] Initializing...');
            
            // Load saved character data from sessionStorage if exists
            this.loadSavedData();
            
            // Initialize audio player
            this.audioPlayer = document.getElementById('voiceSamplePlayer');
            
            // Load voice samples manifest
            await this.loadVoiceSamples();
            
            // Render dynamic grids
            this.renderEthnicityGrid();
            this.renderHairStyleGrid();
            this.renderHairColorStrip();
            this.renderBodyTypeGrid();
            this.renderBreastSizeGrid();
            this.renderButtSizeGrid();
            this.renderVoiceGrid();
            
            // Bind events
            this.bindEvents();
            
            // Update UI state
            this.updateUI();
            
            // Fetch and populate models (uses global function from dashboard-footer.hbs)
            if (typeof window.fetchAndAppendModels === 'function') {
                window.fetchAndAppendModels();
            }
            
            // Initialize model selection from localStorage
            this.initializeModelSelection();
            
            // Check premium status for custom models
            this.checkCustomModelAccess();
            
            console.log('[CharacterCreation] Initialized successfully');
        }
        
        /**
         * Initialize model selection from localStorage or set defaults based on style
         */
        initializeModelSelection() {
            const savedModelId = localStorage.getItem('imageModelId');
            const savedIsUserModel = localStorage.getItem('isUserModel') === 'true';
            
            if (savedModelId && savedIsUserModel) {
                // Wait for models to be populated then select
                setTimeout(() => {
                    const modelOption = document.querySelector(`#userCustomModels .style-option[data-id="${savedModelId}"]`);
                    if (modelOption) {
                        this.selectModel(modelOption);
                    } else {
                        // Set default model based on style
                        this.setDefaultModelByStyle();
                    }
                }, 500);
            } else {
                // Set default model based on style
                this.setDefaultModelByStyle();
            }
        }
        
        /**
         * Set default model based on selected style (anime or photorealistic)
         */
        setDefaultModelByStyle() {
            const style = this.characterData.style; // 'anime' or 'realistic'
            const isAnime = style === 'anime';
            
            console.log('[CharacterCreation] Setting default model. Current style:', style, 'isAnime:', isAnime);
            
            // Set default model names based on style
            const defaultModelName = isAnime 
                ? 'prefectPonyXL_v50_1128833.safetensors'
                : 'juggernautXL_v9Rdphoto2Lightning_285361.safetensors';
            
            const defaultImageStyle = isAnime ? 'anime' : 'photorealistic';
            const defaultImageVersion = 'sdxl';
            
            // Set default model data (will be used if no custom model is selected)
            this.characterData.imageModel = defaultModelName;
            this.characterData.imageStyle = defaultImageStyle;
            this.characterData.imageVersion = defaultImageVersion;
            this.characterData.isUserModel = false;
            
            // Update hidden inputs if they exist
            const imageModelInput = document.getElementById('imageModel');
            const imageStyleInput = document.getElementById('imageStyle');
            const imageVersionInput = document.getElementById('imageVersion');
            const isUserModelInput = document.getElementById('isUserModel');
            
            if (imageModelInput) imageModelInput.value = defaultModelName;
            if (imageStyleInput) imageStyleInput.value = defaultImageStyle;
            if (imageVersionInput) imageVersionInput.value = defaultImageVersion;
            if (isUserModelInput) isUserModelInput.value = 'false';
            
            this.saveData();
            console.log('[CharacterCreation] Default model set:', { 
                style, 
                imageModel: defaultModelName, 
                imageStyle: defaultImageStyle,
                imageVersion: defaultImageVersion
            });
        }
        
        /**
         * Check and show/hide premium notice for custom models
         */
        checkCustomModelAccess() {
            const user = window.user || {};
            const isAdmin = user.isAdmin === true;
            const hasPremium = user.subscriptionStatus === 'active' || isAdmin;
            
            const notice = document.getElementById('customModelsPremiumNotice');
            if (notice) {
                notice.style.display = hasPremium ? 'none' : 'flex';
            }
        }
        
        /**
         * Get option data for the option picker modal
         */
        getOptionData() {
            return {
                personality: {
                    title: this.t('personality_title', 'Personality'),
                    options: [
                        { value: 'submissive', label: this.t('personalities.submissive', 'Submissive') },
                        { value: 'dominant', label: this.t('personalities.dominant', 'Dominant') },
                        { value: 'shy', label: this.t('personalities.shy', 'Shy') },
                        { value: 'confident', label: this.t('personalities.confident', 'Confident') },
                        { value: 'playful', label: this.t('personalities.playful', 'Playful') },
                        { value: 'serious', label: this.t('personalities.serious', 'Serious') },
                        { value: 'romantic', label: this.t('personalities.romantic', 'Romantic') },
                        { value: 'adventurous', label: this.t('personalities.adventurous', 'Adventurous') },
                        { value: 'caring', label: this.t('personalities.caring', 'Caring') },
                        { value: 'mysterious', label: this.t('personalities.mysterious', 'Mysterious') }
                    ]
                },
                relationship: {
                    title: this.t('relationship_title', 'Relationship'),
                    options: [
                        { value: 'stranger', label: this.t('relationships.stranger', 'Stranger') },
                        { value: 'friend', label: this.t('relationships.friend', 'Friend') },
                        { value: 'girlfriend', label: this.t('relationships.girlfriend', 'Girlfriend') },
                        { value: 'wife', label: this.t('relationships.wife', 'Wife') },
                        { value: 'crush', label: this.t('relationships.crush', 'Crush') },
                        { value: 'colleague', label: this.t('relationships.colleague', 'Colleague') },
                        { value: 'neighbor', label: this.t('relationships.neighbor', 'Neighbor') },
                        { value: 'ex', label: this.t('relationships.ex', 'Ex') },
                        { value: 'first_date', label: this.t('relationships.first_date', 'First Date') },
                        { value: 'roommate', label: this.t('relationships.roommate', 'Roommate') }
                    ]
                },
                occupation: {
                    title: this.t('occupation_title', 'Occupation'),
                    options: [
                        { value: 'student', label: '🎓 ' + this.t('occupations.student', 'Student') },
                        { value: 'teacher', label: '👩‍🏫 ' + this.t('occupations.teacher', 'Teacher') },
                        { value: 'nurse', label: '👩‍⚕️ ' + this.t('occupations.nurse', 'Nurse') },
                        { value: 'model', label: '💃 ' + this.t('occupations.model', 'Model') },
                        { value: 'artist', label: '🎨 ' + this.t('occupations.artist', 'Artist') },
                        { value: 'athlete', label: '⚽ ' + this.t('occupations.athlete', 'Athlete') },
                        { value: 'businesswoman', label: '💼 ' + this.t('occupations.businesswoman', 'Businesswoman') },
                        { value: 'influencer', label: '📱 ' + this.t('occupations.influencer', 'Influencer') },
                        { value: 'scientist', label: '🔬 ' + this.t('occupations.scientist', 'Scientist') },
                        { value: 'musician', label: '🎵 ' + this.t('occupations.musician', 'Musician') }
                    ]
                },
                kinks: {
                    title: this.t('kinks_title', 'Preferences'),
                    options: [
                        { value: 'vanilla', label: this.t('kinks.vanilla', 'Vanilla') },
                        { value: 'daddy_dom', label: this.t('kinks.daddy_dom', 'Daddy Dom') },
                        { value: 'roleplay', label: this.t('kinks.roleplay', 'Roleplay') },
                        { value: 'bdsm', label: this.t('kinks.bdsm', 'BDSM') },
                        { value: 'exhibitionism', label: this.t('kinks.exhibitionism', 'Exhibitionism') },
                        { value: 'feet', label: this.t('kinks.feet', 'Feet') },
                        { value: 'lingerie', label: this.t('kinks.lingerie', 'Lingerie') },
                        { value: 'outdoor', label: this.t('kinks.outdoor', 'Outdoor') },
                        { value: 'toys', label: this.t('kinks.toys', 'Toys') }
                    ]
                }
            };
        }
        
        /**
         * Translation helper
         */
        t(key, fallback = key) {
            const keys = key.split('.');
            let value = this.translations;
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    return fallback;
                }
            }
            
            return value || fallback;
        }
        
        /**
         * Get asset path based on current style
         */
        getAssetPath() {
            return this.assetPaths[this.characterData.style] || this.assetPaths.realistic;
        }
        
        /**
         * Load voice samples manifest
         */
        async loadVoiceSamples() {
            try {
                const response = await fetch('/audio/voice-samples/manifest.json');
                if (response.ok) {
                    this.voiceSamples = await response.json();
                    console.log('[CharacterCreation] Voice samples loaded:', this.voiceSamples.voices?.length || 0);
                }
            } catch (error) {
                console.error('[CharacterCreation] Failed to load voice samples:', error);
                this.voiceSamples = this.getFallbackVoiceData();
            }
        }
        
        /**
         * Fallback voice data if manifest fails to load
         */
        getFallbackVoiceData() {
            return {
                voices: [
                    { key: 'Wise_Woman', gender: 'female', languages: ['en', 'fr', 'ja'] },
                    { key: 'Inspirational_girl', gender: 'female', languages: ['en', 'fr', 'ja'] },
                    { key: 'Calm_Woman', gender: 'female', languages: ['en', 'fr', 'ja'] },
                    { key: 'Lively_Girl', gender: 'female', languages: ['en', 'fr', 'ja'] },
                    { key: 'Lovely_Girl', gender: 'female', languages: ['en', 'fr', 'ja'] },
                    { key: 'Sweet_Girl_2', gender: 'female', languages: ['en', 'fr', 'ja'] },
                    { key: 'Exuberant_Girl', gender: 'female', languages: ['en', 'fr', 'ja'] }
                ],
                files: []
            };
        }
        
        /**
         * Bind all event listeners
         */
        bindEvents() {
            const self = this;
            
            // Navigation buttons
            const nextBtn = document.getElementById('nextBtn');
            const backBtn = document.getElementById('backBtn');
            
            if (nextBtn) {
                nextBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.nextStep();
                });
            }
            
            if (backBtn) {
                backBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.prevStep();
                });
            }
            
            // Step 1: Style selection (using event delegation)
            document.querySelectorAll('.style-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectStyle(e.currentTarget);
                });
            });
            
            // Age slider
            const ageSlider = document.getElementById('ageSlider');
            if (ageSlider) {
                ageSlider.addEventListener('input', (e) => this.updateAge(e.target.value));
            }
            
            // Step 5: Personality options (using event delegation)
            document.querySelectorAll('.personality-option-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openOptionPicker(e.currentTarget);
                });
            });
            
            // Name input
            const characterName = document.getElementById('characterName');
            if (characterName) {
                characterName.addEventListener('input', (e) => {
                    this.characterData.name = e.target.value;
                    this.saveData();
                });
            }
            
            // Generate name button
            const generateNameBtn = document.getElementById('generateNameBtn');
            if (generateNameBtn) {
                generateNameBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.generateRandomName();
                });
            }
            
            // Custom prompt with character counter
            const customPrompt = document.getElementById('customPrompt');
            const customPromptCounter = document.getElementById('customPromptCounter');
            if (customPrompt) {
                customPrompt.addEventListener('input', (e) => {
                    this.characterData.customPrompt = e.target.value;
                    this.saveData();
                    // Update character counter
                    if (customPromptCounter) {
                        customPromptCounter.textContent = e.target.value.length;
                    }
                });
                // Initialize counter if there's saved data
                if (this.characterData.customPrompt) {
                    customPrompt.value = this.characterData.customPrompt;
                    if (customPromptCounter) {
                        customPromptCounter.textContent = this.characterData.customPrompt.length;
                    }
                }
            }
            
            
            // Custom models container - use event delegation
            document.getElementById('userCustomModels')?.addEventListener('click', (e) => {
                const styleOption = e.target.closest('.style-option');
                if (styleOption) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectModel(styleOption);
                }
            });
            
            // Step 7: Image generation
            const generateImageBtn = document.getElementById('generateImageBtn');
            if (generateImageBtn) {
                generateImageBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.generateImage();
                });
            }
            
            const regenerateImageBtn = document.getElementById('regenerateImageBtn');
            if (regenerateImageBtn) {
                regenerateImageBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.regenerateImages(); // Use dedicated regenerate method
                });
            }
            
            // Step 8: Start chat
            const startChatBtn = document.getElementById('startChatBtn');
            if (startChatBtn) {
                startChatBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.startChat();
                });
            }
            
            // Audio player events
            if (this.audioPlayer) {
                this.audioPlayer.addEventListener('ended', () => this.onAudioEnded());
                this.audioPlayer.addEventListener('error', (e) => this.onAudioError(e));
            }
            
            // Initialize video hover handlers
            this.initVideoHoverHandlers();
            
            console.log('[CharacterCreation] Events bound');
        }
        
        /**
         * Initialize video hover handlers for thumbnail/video switching
         */
        initVideoHoverHandlers() {
            // Use event delegation for dynamically created elements
            document.addEventListener('mouseenter', (e) => {
                const container = e.target.closest('.video-hover-container');
                if (container) {
                    const thumbnail = container.querySelector('.video-thumbnail');
                    const video = container.querySelector('.video-hover');
                    if (thumbnail && video) {
                        thumbnail.style.opacity = '0';
                        video.style.opacity = '1';
                        video.play().catch(() => {
                            // Ignore play errors (e.g., if video not loaded)
                        });
                    }
                }
            }, true);
            
            document.addEventListener('mouseleave', (e) => {
                const container = e.target.closest('.video-hover-container');
                if (container) {
                    const thumbnail = container.querySelector('.video-thumbnail');
                    const video = container.querySelector('.video-hover');
                    if (thumbnail && video) {
                        thumbnail.style.opacity = '1';
                        video.style.opacity = '0';
                        video.pause();
                        video.currentTime = 0;
                    }
                }
            }, true);
        }
        
        // ===================
        // RENDER METHODS
        // ===================
        
        /**
         * Render ethnicity grid based on style
         */
        renderEthnicityGrid() {
            const grid = document.getElementById('ethnicityGrid');
            if (!grid) return;
            
            const basePath = this.getAssetPath();
            const ethnicities = [
                { key: 'caucasian', label: this.t('ethnicities.caucasian', 'Caucasian') },
                { key: 'asian', label: this.t('ethnicities.asian', 'Asian') },
                { key: 'black', label: this.t('ethnicities.black', 'Black') },
                { key: 'latina', label: this.t('ethnicities.latina', 'Latina') },
                { key: 'arab', label: this.t('ethnicities.arab', 'Arab') },
                { key: 'indian', label: this.t('ethnicities.indian', 'Indian') },
                { key: 'japanese', label: this.t('ethnicities.japanese', 'Japanese') },
                { key: 'korean', label: this.t('ethnicities.korean', 'Korean') }
            ];
            
            grid.innerHTML = ethnicities.map(eth => `
                <div class="ethnicity-card${this.characterData.ethnicity === eth.key ? ' selected' : ''}" data-ethnicity="${eth.key}">
                    <div class="video-hover-container">
                        <img src="${basePath}/ethnicity-${eth.key}.jpg" alt="${eth.label}" class="video-thumbnail">
                        <video src="${basePath}/ethnicity-${eth.key}.mp4" alt="${eth.label}" loop muted playsinline class="video-hover"></video>
                    </div>
                    <span>${eth.label}</span>
                    <div class="check-badge"><i class="bi bi-check"></i></div>
                </div>
            `).join('');
            
            // Bind click events
            grid.querySelectorAll('.ethnicity-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectEthnicity(e.currentTarget);
                });
            });
        }
        
        /**
         * Render hair style grid based on style
         */
        renderHairStyleGrid() {
            const grid = document.getElementById('hairStyleGrid');
            if (!grid) return;
            
            const basePath = this.getAssetPath();
            const hairStyles = [
                { key: 'straight', label: this.t('hair_styles.straight', 'Straight') },
                { key: 'bangs', label: this.t('hair_styles.bangs', 'Bangs') },
                { key: 'curly', label: this.t('hair_styles.curly', 'Curly') },
                { key: 'bun', label: this.t('hair_styles.bun', 'Bun') },
                { key: 'short', label: this.t('hair_styles.short', 'Short') },
                { key: 'ponytail', label: this.t('hair_styles.ponytail', 'Ponytail') }
            ];
            
            grid.innerHTML = hairStyles.map(style => `
                <div class="hair-style-card${this.characterData.hairStyle === style.key ? ' selected' : ''}" data-hairstyle="${style.key}">
                    <div class="video-hover-container">
                        <img src="${basePath}/hair-${style.key}.jpg" alt="${style.label}" class="video-thumbnail">
                        <video src="${basePath}/hair-${style.key}.mp4" alt="${style.label}" loop muted playsinline class="video-hover"></video>
                    </div>
                    <span>${style.label}</span>
                    <div class="check-badge"><i class="bi bi-check"></i></div>
                </div>
            `).join('');
            
            // Bind click events
            grid.querySelectorAll('.hair-style-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectHairStyle(e.currentTarget);
                });
            });
        }
        
        /**
         * Render hair color strip based on style
         */
        renderHairColorStrip() {
            const strip = document.getElementById('hairColorStrip');
            if (!strip) return;
            
            const basePath = this.getAssetPath();
            const hairColors = [
                { key: 'brunette', label: this.t('hair_colors.brunette', 'Brunette') },
                { key: 'blonde', label: this.t('hair_colors.blonde', 'Blonde') },
                { key: 'black', label: this.t('hair_colors.black', 'Black') },
                { key: 'redhead', label: this.t('hair_colors.redhead', 'Redhead') },
                { key: 'pink', label: this.t('hair_colors.pink', 'Pink') }
            ];
            
            strip.innerHTML = hairColors.map(color => `
                <div class="hair-color-card${this.characterData.hairColor === color.key ? ' selected' : ''}" data-haircolor="${color.key}">
                    <img src="${basePath}/haircolor-${color.key}.png" alt="${color.label}">
                    <span>${color.label}</span>
                    <div class="check-badge"><i class="bi bi-check"></i></div>
                </div>
            `).join('');
            
            // Bind click events
            strip.querySelectorAll('.hair-color-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectHairColor(e.currentTarget);
                });
            });
        }
        
        /**
         * Render body type grid based on style
         */
        renderBodyTypeGrid() {
            const grid = document.getElementById('bodyTypeGrid');
            if (!grid) return;
            
            const basePath = this.getAssetPath();
            const bodyTypes = [
                { key: 'slim', label: this.t('body_types.slim', 'Slim') },
                { key: 'athletic', label: this.t('body_types.athletic', 'Athletic') },
                { key: 'voluptuous', label: this.t('body_types.voluptuous', 'Voluptuous') },
                { key: 'curvy', label: this.t('body_types.curvy', 'Curvy') },
                { key: 'muscular', label: this.t('body_types.muscular', 'Muscular') }
            ];
            
            grid.innerHTML = bodyTypes.map(type => `
                <div class="body-type-card${this.characterData.bodyType === type.key ? ' selected' : ''}" data-bodytype="${type.key}">
                    <img src="${basePath}/body-${type.key}.png" alt="${type.label}">
                    <span>${type.label}</span>
                    <div class="check-badge"><i class="bi bi-check"></i></div>
                </div>
            `).join('');
            
            // Bind click events
            grid.querySelectorAll('.body-type-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectBodyType(e.currentTarget);
                });
            });
        }
        
        /**
         * Render breast size grid based on style
         */
        renderBreastSizeGrid() {
            const grid = document.getElementById('breastSizeGrid');
            if (!grid) return;
            
            const basePath = this.getAssetPath();
            const sizes = [
                { key: 'flat', label: this.t('breast_sizes.flat', 'Flat') },
                { key: 'small', label: this.t('breast_sizes.small', 'Small') },
                { key: 'medium', label: this.t('breast_sizes.medium', 'Medium') },
                { key: 'large', label: this.t('breast_sizes.large', 'Large') },
                { key: 'xl', label: this.t('breast_sizes.xl', 'XL') }
            ];
            
            grid.innerHTML = sizes.map(size => `
                <div class="breast-size-card${this.characterData.breastSize === size.key ? ' selected' : ''}" data-breastsize="${size.key}">
                    <img src="${basePath}/breast-${size.key}.png" alt="${size.label}">
                    <span>${size.label}</span>
                    <div class="check-badge"><i class="bi bi-check"></i></div>
                </div>
            `).join('');
            
            // Bind click events
            grid.querySelectorAll('.breast-size-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectBreastSize(e.currentTarget);
                });
            });
        }
        
        /**
         * Render butt size grid based on style
         */
        renderButtSizeGrid() {
            const grid = document.getElementById('buttSizeGrid');
            if (!grid) return;
            
            const basePath = this.getAssetPath();
            const sizes = [
                { key: 'small', label: this.t('butt_sizes.small', 'Small') },
                { key: 'medium', label: this.t('butt_sizes.medium', 'Medium') },
                { key: 'athletic', label: this.t('butt_sizes.athletic', 'Athletic') },
                { key: 'large', label: this.t('butt_sizes.large', 'Large') }
            ];
            
            grid.innerHTML = sizes.map(size => `
                <div class="butt-size-card${this.characterData.buttSize === size.key ? ' selected' : ''}" data-buttsize="${size.key}">
                    <img src="${basePath}/butt-${size.key}.jpg" alt="${size.label}">
                    <span>${size.label}</span>
                    <div class="check-badge"><i class="bi bi-check"></i></div>
                </div>
            `).join('');
            
            // Bind click events
            grid.querySelectorAll('.butt-size-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectButtSize(e.currentTarget);
                });
            });
        }
        
        /**
         * Render the voice selection grid
         */
        renderVoiceGrid() {
            const voiceGrid = document.getElementById('voiceGrid');
            if (!voiceGrid || !this.voiceSamples) return;
            
            // Filter for female voices only
            const femaleVoices = this.voiceSamples.voices?.filter(v => v.gender === 'female') || [];
            
            voiceGrid.innerHTML = femaleVoices.map(voice => {
                const voiceName = this.t(`voices.${voice.key}.name`, voice.key.replace(/_/g, ' '));
                const voiceDesc = this.t(`voices.${voice.key}.description`, 'Select this voice');
                const isSelected = this.characterData.voice === voice.key;
                
                return `
                    <div class="voice-card${isSelected ? ' selected' : ''}" data-voice="${voice.key}">
                        <div class="voice-card-content">
                            <div class="voice-icon">
                                <i class="bi bi-mic-fill"></i>
                            </div>
                            <div class="voice-info">
                                <span class="voice-name">${voiceName}</span>
                                <span class="voice-description">${voiceDesc}</span>
                            </div>
                        </div>
                        <button type="button" class="play-sample-btn" data-voice="${voice.key}">
                            <i class="bi bi-play-fill"></i>
                            <span>${this.t('play_sample', 'Play Sample')}</span>
                        </button>
                        <div class="check-badge"><i class="bi bi-check"></i></div>
                    </div>
                `;
            }).join('');
            
            // Bind events for voice card selection (excluding play button area)
            voiceGrid.querySelectorAll('.voice-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    // Don't select voice if clicking on play button
                    if (e.target.closest('.play-sample-btn')) {
                        return; // Let the button handler deal with it
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectVoice(card);
                });
            });
            
            // Bind events for play buttons directly
            voiceGrid.querySelectorAll('.play-sample-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const voiceKey = btn.dataset.voice;
                    console.log('[CharacterCreation] Play button clicked for voice:', voiceKey);
                    this.playVoiceSample(voiceKey);
                });
            });
        }
        
        // ===================
        // SELECTION METHODS
        // ===================
        
        selectStyle(card) {
            const style = card.dataset.style;
            if (!style) return;
            
            document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.style = style;
            this.saveData();
            
            // Update style card thumbnails and videos
            const basePath = `/img/cold-onboarding`;
            document.querySelectorAll('.style-card').forEach(styleCard => {
                const styleType = styleCard.dataset.style;
                const thumbnail = styleCard.querySelector('.video-thumbnail');
                const video = styleCard.querySelector('.video-hover');
                if (thumbnail) thumbnail.src = `${basePath}/style-${styleType}.jpg`;
                if (video) video.src = `${basePath}/style-${styleType}.mp4`;
            });
            
            // Re-render grids with new style assets
            this.renderEthnicityGrid();
            this.renderHairStyleGrid();
            this.renderHairColorStrip();
            this.renderBodyTypeGrid();
            this.renderBreastSizeGrid();
            this.renderButtSizeGrid();
        }
        
        selectEthnicity(card) {
            const ethnicity = card.dataset.ethnicity;
            if (!ethnicity) return;
            
            document.querySelectorAll('.ethnicity-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.ethnicity = ethnicity;
            this.saveData();
        }
        
        updateAge(value) {
            this.characterData.age = parseInt(value);
            const ageValue = document.getElementById('ageValue');
            if (ageValue) ageValue.textContent = value;
            this.saveData();
        }
        
        selectHairStyle(card) {
            const hairStyle = card.dataset.hairstyle;
            if (!hairStyle) return;
            
            document.querySelectorAll('.hair-style-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.hairStyle = hairStyle;
            this.saveData();
        }
        
        selectHairColor(card) {
            const hairColor = card.dataset.haircolor;
            if (!hairColor) return;
            
            document.querySelectorAll('.hair-color-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.hairColor = hairColor;
            this.saveData();
        }
        
        selectBodyType(card) {
            const bodyType = card.dataset.bodytype;
            if (!bodyType) return;
            
            document.querySelectorAll('.body-type-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.bodyType = bodyType;
            this.saveData();
        }
        
        selectBreastSize(card) {
            const breastSize = card.dataset.breastsize;
            if (!breastSize) return;
            
            document.querySelectorAll('.breast-size-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.breastSize = breastSize;
            this.saveData();
        }
        
        selectButtSize(card) {
            const buttSize = card.dataset.buttsize;
            if (!buttSize) return;
            
            document.querySelectorAll('.butt-size-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.buttSize = buttSize;
            this.saveData();
        }
        
        selectVoice(card) {
            const voice = card.dataset.voice;
            if (!voice) return;
            
            document.querySelectorAll('.voice-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.voice = voice;
            this.saveData();
        }
        
        selectImage(card) {
            const imageUrl = card.dataset.imageUrl;
            if (!imageUrl) return;
            
            document.querySelectorAll('.generated-image-item').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            this.characterData.selectedImageUrl = imageUrl;
            this.saveData();
            
            // Update summary image
            const summaryImage = document.getElementById('summaryImage');
            if (summaryImage) {
                summaryImage.src = imageUrl;
            }
            
            // Save selected image to database
            this.saveSelectedImage(imageUrl);
            
            // Also save the model (user might have generated images with different models)
            this.saveSelectedImageModel();
        }
        
        /**
         * Save selected image to database
         */
        saveSelectedImage(imageUrl) {
            const chatId = this.chatId || window.chatCreationId;
            
            if (!chatId || !imageUrl) {
                console.log('[CharacterCreation] Cannot save image - missing chatId or imageUrl');
                return;
            }
            
            console.log('[CharacterCreation] Saving selected image:', { chatId, imageUrl });
            
            fetch('/novita/save-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    chatId: chatId,
                    imageUrl: imageUrl
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('[CharacterCreation] Image saved successfully:', data);
            })
            .catch(error => {
                console.error('[CharacterCreation] Failed to save image:', error);
            });
        }
        
        // ===================
        // MODEL SELECTION
        // ===================
        
        selectModel(styleOption) {
            // Remove previous selection from all model containers
            document.querySelectorAll('#userCustomModels .style-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Mark as selected
            styleOption.classList.add('selected');
            
            // Get model data from attributes
            const modelId = styleOption.dataset.id;
            const imageStyle = styleOption.dataset.style;
            const imageModel = styleOption.dataset.model;
            const imageVersion = styleOption.dataset.version;
            const isUserModel = styleOption.dataset.isUserModel === 'true';
            
            // Update character data
            this.characterData.modelId = modelId;
            this.characterData.imageStyle = imageStyle;
            this.characterData.imageModel = imageModel;
            this.characterData.imageVersion = imageVersion;
            this.characterData.isUserModel = isUserModel;
            
            // Update hidden inputs
            document.getElementById('modelId').value = modelId || '';
            document.getElementById('imageStyle').value = imageStyle || '';
            document.getElementById('imageModel').value = imageModel || '';
            document.getElementById('imageVersion').value = imageVersion || '';
            document.getElementById('isUserModel').value = isUserModel;
            
            // Save to localStorage for persistence
            localStorage.setItem('imageModelId', modelId);
            localStorage.setItem('isUserModel', isUserModel.toString());
            
            this.saveData();
            
            console.log('[CharacterCreation] Model selected:', { modelId, imageStyle, imageModel, imageVersion, isUserModel });
            
            // Save model to database if we have a chatId
            this.saveSelectedImageModel();
        }
        
        /**
         * Save selected image model to database
         */
        saveSelectedImageModel() {
            const chatId = this.chatId || window.chatCreationId;
            
            // If no chat ID yet, skip - will be saved when chat is created
            if (!chatId) {
                console.log('[CharacterCreation] No chatId yet, skipping model save');
                return;
            }
            
            const { modelId, imageStyle, imageModel, imageVersion } = this.characterData;
            
            // Validate required fields
            if (!modelId || !imageModel || !imageVersion) {
                console.warn('[CharacterCreation] Missing required model fields:', { modelId, imageModel, imageVersion });
                return;
            }
            
            console.log('[CharacterCreation] Saving model to DB:', { chatId, modelId, imageStyle, imageModel, imageVersion });
            
            fetch('/novita/save-image-model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    chatId: chatId,
                    modelId: modelId,
                    imageStyle: imageStyle || 'general',
                    imageModel: imageModel,
                    imageVersion: imageVersion
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('[CharacterCreation] Model saved successfully:', data);
            })
            .catch(error => {
                console.error('[CharacterCreation] Failed to save model:', error);
            });
        }
        
        // ===================
        // VOICE PLAYBACK
        // ===================
        
        playVoiceSample(voiceKey) {
            console.log('[CharacterCreation] playVoiceSample called with:', voiceKey);
            console.log('[CharacterCreation] audioPlayer:', this.audioPlayer);
            console.log('[CharacterCreation] voiceSamples:', this.voiceSamples);
            
            if (!this.audioPlayer) {
                console.error('[CharacterCreation] No audio player element found');
                return;
            }
            
            // If clicking the same voice that's currently playing, pause it
            if (this.currentPlayingVoice === voiceKey && !this.audioPlayer.paused) {
                this.pauseAudio();
                return;
            }
            
            // If clicking the same voice that's currently paused, resume it
            if (this.currentPlayingVoice === voiceKey && this.audioPlayer.paused) {
                this.resumeAudio();
                return;
            }
            
            // Stop any currently playing audio if different voice
            if (this.currentPlayingVoice && this.currentPlayingVoice !== voiceKey) {
                this.stopAudio();
            }
            
            // Find the sample file
            const langMap = { 'en': 'en', 'ja': 'ja', 'fr': 'fr' };
            const sampleLang = langMap[this.lang] || 'en';
            console.log('[CharacterCreation] Looking for sample with lang:', sampleLang, 'voice:', voiceKey);
            
            const sampleFile = this.voiceSamples?.files?.find(f => 
                f.voice === voiceKey && f.lang === sampleLang
            );
            
            console.log('[CharacterCreation] Found sample file:', sampleFile);
            
            if (sampleFile) {
                this.currentPlayingVoice = voiceKey;
                this.audioPlayer.src = sampleFile.url;
                console.log('[CharacterCreation] Playing audio from:', sampleFile.url);
                this.audioPlayer.play().catch(err => {
                    console.error('[CharacterCreation] Failed to play voice sample:', err);
                    this.stopAudio();
                });
                
                // Update button state
                this.updatePlayButton(voiceKey, true);
            }
        }
        
        pauseAudio() {
            if (this.audioPlayer && !this.audioPlayer.paused) {
                this.audioPlayer.pause();
                this.updatePlayButton(this.currentPlayingVoice, false);
            }
        }
        
        resumeAudio() {
            if (this.audioPlayer && this.audioPlayer.paused && this.currentPlayingVoice) {
                this.audioPlayer.play().catch(err => {
                    console.error('[CharacterCreation] Failed to resume voice sample:', err);
                    this.stopAudio();
                });
                this.updatePlayButton(this.currentPlayingVoice, true);
            }
        }
        
        stopAudio() {
            if (this.audioPlayer) {
                this.audioPlayer.pause();
                this.audioPlayer.currentTime = 0;
            }
            
            if (this.currentPlayingVoice) {
                this.updatePlayButton(this.currentPlayingVoice, false);
                this.currentPlayingVoice = null;
            }
        }
        
        updatePlayButton(voiceKey, isPlaying) {
            const btn = document.querySelector(`.play-sample-btn[data-voice="${voiceKey}"]`);
            if (btn) {
                const icon = btn.querySelector('i');
                const text = btn.querySelector('span');
                
                if (isPlaying) {
                    btn.classList.add('playing');
                    if (icon) icon.className = 'bi bi-stop-fill';
                    if (text) text.textContent = this.t('playing', 'Playing...');
                } else {
                    btn.classList.remove('playing');
                    if (icon) icon.className = 'bi bi-play-fill';
                    if (text) text.textContent = this.t('play_sample', 'Play Sample');
                }
            }
        }
        
        onAudioEnded() {
            if (this.currentPlayingVoice) {
                this.updatePlayButton(this.currentPlayingVoice, false);
                this.currentPlayingVoice = null;
            }
        }
        
        onAudioError(error) {
            console.error('[CharacterCreation] Audio error:', error);
            this.stopAudio();
        }
        
        // ===================
        // OPTION PICKER
        // ===================
        
        openOptionPicker(card) {
            const optionType = card.dataset.option;
            const data = this.optionData[optionType];
            if (!data) return;
            
            // Close any existing popup
            this.closeOptionPopup();
            
            // Create popup element
            const popup = document.createElement('div');
            popup.className = 'option-picker-popup';
            popup.innerHTML = `
                <div class="option-picker-popup-header">
                    <span>${data.title}</span>
                    <button type="button" class="popup-close-btn"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="option-picker-popup-body">
                    ${data.options.map(opt => `
                        <div class="popup-option-item${this.characterData[optionType] === opt.value ? ' selected' : ''}" 
                             data-option-type="${optionType}" 
                             data-value="${opt.value}">
                            <span>${opt.label}</span>
                            <i class="bi bi-check-circle-fill"></i>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Position popup below the card
            const cardRect = card.getBoundingClientRect();
            const containerRect = card.closest('.step-content').getBoundingClientRect();
            
            popup.style.position = 'absolute';
            popup.style.top = (card.offsetTop + card.offsetHeight + 8) + 'px';
            popup.style.left = '0';
            popup.style.right = '0';
            
            // Append to card's parent
            card.parentElement.style.position = 'relative';
            card.parentElement.appendChild(popup);
            this.activePopup = popup;
            
            // Bind close button
            popup.querySelector('.popup-close-btn').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeOptionPopup();
            });
            
            // Bind option click events
            popup.querySelectorAll('.popup-option-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectOptionFromPopup(item, card);
                });
            });
            
            // Close popup when clicking outside
            setTimeout(() => {
                const closeHandler = (e) => {
                    if (!popup.contains(e.target) && !card.contains(e.target)) {
                        this.closeOptionPopup();
                        document.removeEventListener('click', closeHandler);
                    }
                };
                document.addEventListener('click', closeHandler);
            }, 100);
        }
        
        closeOptionPopup() {
            if (this.activePopup) {
                this.activePopup.remove();
                this.activePopup = null;
            }
        }
        
        selectOptionFromPopup(item, card) {
            const optionType = item.dataset.optionType;
            const value = item.dataset.value;
            
            // Update selection in popup
            if (this.activePopup) {
                this.activePopup.querySelectorAll('.popup-option-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            }
            
            // Update character data
            this.characterData[optionType] = value;
            this.saveData();
            
            // Update the card display
            const data = this.optionData[optionType];
            const selectedOption = data.options.find(o => o.value === value);
            if (card && selectedOption) {
                card.dataset.value = value;
                const valueDisplay = card.querySelector('.option-value');
                if (valueDisplay) valueDisplay.textContent = selectedOption.label;
            }
            
            // Close popup
            this.closeOptionPopup();
        }
        
        // ===================
        // NAME GENERATION
        // ===================
        
        async generateRandomName() {
            const btn = document.getElementById('generateNameBtn');
            const input = document.getElementById('characterName');
            if (!btn || !input) return;
            
            btn.disabled = true;
            const icon = btn.querySelector('i');
            if (icon) icon.classList.add('spin');
            
            try {
                // Generate name based on ethnicity
                const names = this.getNamesByEthnicity(this.characterData.ethnicity);
                const randomName = names[Math.floor(Math.random() * names.length)];
                
                input.value = randomName;
                this.characterData.name = randomName;
                this.saveData();
            } catch (error) {
                console.error('[CharacterCreation] Failed to generate name:', error);
            } finally {
                btn.disabled = false;
                if (icon) icon.classList.remove('spin');
            }
        }
        
        getNamesByEthnicity(ethnicity) {
            const namesByEthnicity = {
                caucasian: ['Emma', 'Sophia', 'Olivia', 'Ava', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn'],
                asian: ['Mei', 'Lily', 'Yuki', 'Sakura', 'Hana', 'Lin', 'Jade', 'Luna', 'Chloe', 'Aria'],
                black: ['Aaliyah', 'Zara', 'Jasmine', 'Destiny', 'Imani', 'Nia', 'Aisha', 'Keisha', 'Ebony', 'Destiny'],
                latina: ['Sofia', 'Isabella', 'Valentina', 'Camila', 'Lucia', 'Elena', 'Rosa', 'Carmen', 'Maria', 'Ana'],
                arab: ['Fatima', 'Aisha', 'Layla', 'Noor', 'Yasmin', 'Zara', 'Amira', 'Salma', 'Dana', 'Hana'],
                indian: ['Priya', 'Ananya', 'Aisha', 'Neha', 'Riya', 'Kavya', 'Simran', 'Pooja', 'Diya', 'Sara'],
                japanese: ['Yuki', 'Sakura', 'Hana', 'Mei', 'Aoi', 'Rin', 'Miku', 'Yuna', 'Kaori', 'Nana'],
                korean: ['Jiyeon', 'Soyeon', 'Minji', 'Yuna', 'Hana', 'Seo-yeon', 'Ji-woo', 'Min-ji', 'Eun-bi', 'Ha-na']
            };
            
            return namesByEthnicity[ethnicity] || namesByEthnicity.caucasian;
        }
        
        // ===================
        // IMAGE GENERATION
        // ===================
        
        async generateImage() {
            if (this.isGeneratingImage) return;
            
            const generateBtn = document.getElementById('generateImageBtn');
            const regenerateBtn = document.getElementById('regenerateImageBtn');
            const placeholder = document.getElementById('imagePlaceholder');
            const grid = document.getElementById('generatedImagesGrid');
            
            this.isGeneratingImage = true;
            
            // Update buttons
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div><span>' + this.t('generating', 'Generating...') + '</span>';
            }
            if (regenerateBtn) {
                regenerateBtn.disabled = true;
            }
            
            // Show loading state on placeholder grid
            if (placeholder) {
                placeholder.classList.add('loading');
            }
            
            try {
                // Build the character prompt
                const prompt = this.buildCharacterPrompt();
                
                // Build request body with model data if selected
                const requestBody = {
                    prompt: prompt,
                    name: this.characterData.name,
                    gender: 'female',
                    chatPurpose: this.characterData.customPrompt || '',
                    language: this.lang,
                    imageType: 'sfw',
                    chatId: this.chatId,
                    enableEnhancedPrompt: true,
                    // Send personality data for system prompt
                    relationship: this.characterData.relationship || 'stranger',
                    personality: this.characterData.personality || 'submissive',
                    occupation: this.characterData.occupation || 'student',
                    kinks: this.characterData.kinks || 'vanilla'
                };
                
                // Add model data if selected or if default model is set
                if (this.characterData.modelId || this.characterData.imageModel) {
                    if (this.characterData.modelId) {
                        requestBody.modelId = this.characterData.modelId;
                        requestBody.isUserModel = this.characterData.isUserModel;
                    }
                    requestBody.imageStyle = this.characterData.imageStyle;
                    requestBody.imageModel = this.characterData.imageModel;
                    requestBody.imageVersion = this.characterData.imageVersion;
                    console.log('[CharacterCreation] Including model data in request:', {
                        modelId: this.characterData.modelId || 'default',
                        imageStyle: this.characterData.imageStyle,
                        imageModel: this.characterData.imageModel,
                        imageVersion: this.characterData.imageVersion,
                        isUserModel: this.characterData.isUserModel
                    });
                } else {
                    console.warn('[CharacterCreation] No model selected - will use default');
                }
                
                console.log('[CharacterCreation] Full request body:', JSON.stringify(requestBody, null, 2));
                
                // Call API
                const response = await fetch('/api/generate-character-comprehensive', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(requestBody)
                });
                
                const result = await response.json();
                
                if (result.success && result.chatId) {
                    this.chatId = result.chatId;
                    window.chatCreationId = result.chatId; // Sync with global
                    
                    // Save model to the new chat immediately
                    if (this.characterData.modelId) {
                        this.saveSelectedImageModel();
                    }
                    
                    // Images will arrive via WebSocket (triggered by Novita webhook)
                    // Set up polling as fallback only if WebSocket fails
                    this.pollForImage(result.chatId);
                } else {
                    throw new Error(result.error || 'Failed to generate');
                }
                
            } catch (error) {
                console.error('[CharacterCreation] Image generation error:', error);
                this.showError(this.t('generation_failed', 'Failed to generate image. Please try again.'));
                
                // Reset placeholder loading state
                if (placeholder) {
                    placeholder.classList.remove('loading');
                }
            } finally {
                // Reset buttons (but keep generating state if polling)
                if (!this.isGeneratingImage) {
                    if (generateBtn) {
                        generateBtn.disabled = false;
                        generateBtn.innerHTML = '<i class="bi bi-magic"></i><span>' + this.t('generate_image', 'Generate Images') + '</span>';
                    }
                    if (regenerateBtn) {
                        regenerateBtn.disabled = false;
                    }
                }
            }
        }
        
        /**
         * Poll for image generation completion (fallback if WebSocket doesn't deliver)
         * Note: With webhook implementation, WebSocket should receive images much faster.
         * Polling is now a fallback safety net with reduced frequency.
         */
        async pollForImage(chatId) {
            const maxAttempts = 30; // Reduced since webhooks should deliver faster
            const pollInterval = 3000; // 3 seconds between polls
            const initialDelay = 8000; // Wait 8 seconds before first poll (give webhook time)
            let attempts = 0;
            let pollTimerId = null;
            
            // Store chatId for WebSocket handling
            window.chatCreationId = chatId;
            this.chatId = chatId;
            this.saveData();
            
            // Store poll timer ID for cleanup
            this._currentPollTimerId = null;
            
            console.log('[CharacterCreation] Starting fallback poll for chatId:', chatId);
            console.log('[CharacterCreation] Webhook should deliver images via WebSocket. Polling is fallback only.');
            
            const checkImage = async () => {
                // Stop polling if images already arrived via WebSocket
                if (this.characterData.generatedImages.length > 0) {
                    console.log('[CharacterCreation] Images already received via WebSocket, stopping poll');
                    this._currentPollTimerId = null;
                    return;
                }
                
                // Also check if pendingCharacterCreationImages has items (WebSocket queuing)
                if (window.pendingCharacterCreationImages && window.pendingCharacterCreationImages.length > 0) {
                    console.log('[CharacterCreation] Images queued via WebSocket, stopping poll');
                    this._currentPollTimerId = null;
                    return;
                }
                
                attempts++;
                console.log(`[CharacterCreation] Fallback poll attempt ${attempts}/${maxAttempts}`);
                
                try {
                    const response = await fetch(`/api/chat-data/${chatId}`, {
                        credentials: 'include'
                    });
                    
                    if (!response.ok) {
                        console.log(`[CharacterCreation] Poll attempt ${attempts}: Chat not ready yet (${response.status})`);
                        if (attempts < maxAttempts) {
                            this._currentPollTimerId = setTimeout(checkImage, pollInterval);
                        }
                        return;
                    }
                    
                    const chat = await response.json();
                    
                    // Check for multiple images (chatImageUrl array or image_url)
                    let images = [];
                    
                    if (chat && chat.chatImageUrl && Array.isArray(chat.chatImageUrl)) {
                        images = chat.chatImageUrl.filter(url => url);
                    } else if (chat && chat.image_url) {
                        images = Array.isArray(chat.image_url) ? chat.image_url : [chat.image_url];
                    }
                    
                    if (images.length > 0) {
                        // Double-check WebSocket didn't already deliver these
                        if (this.characterData.generatedImages.length > 0) {
                            console.log('[CharacterCreation] Images already displayed via WebSocket during poll');
                            this._currentPollTimerId = null;
                            return;
                        }
                        
                        console.log('[CharacterCreation] Images found via fallback polling:', images.length);
                        this.onImagesGenerated(images);
                        this._currentPollTimerId = null;
                        return;
                    }
                    
                    if (attempts < maxAttempts) {
                        this._currentPollTimerId = setTimeout(checkImage, pollInterval);
                    } else {
                        console.warn('[CharacterCreation] Polling timeout - webhook may have failed');
                        this.showError(this.t('generation_timeout', 'Image generation timed out. Please try again.'));
                        this.resetImagePlaceholder();
                        this._currentPollTimerId = null;
                    }
                } catch (error) {
                    console.log(`[CharacterCreation] Poll attempt ${attempts}: Error (will retry)`, error.message);
                    if (attempts < maxAttempts) {
                        this._currentPollTimerId = setTimeout(checkImage, pollInterval);
                    } else {
                        this._currentPollTimerId = null;
                    }
                }
            };
            
            // Start polling after initial delay to give webhook/WebSocket a chance
            console.log(`[CharacterCreation] Waiting ${initialDelay/1000}s before starting fallback poll...`);
            this._currentPollTimerId = setTimeout(checkImage, initialDelay);
        }
        
        /**
         * Stop any active polling (called when images arrive via WebSocket)
         */
        stopPolling() {
            if (this._currentPollTimerId) {
                clearTimeout(this._currentPollTimerId);
                this._currentPollTimerId = null;
                console.log('[CharacterCreation] Polling stopped (images received via WebSocket)');
            }
        }
        
        /**
         * Called when images are generated (handles multiple images)
         * This is triggered by WebSocket (via webhook) or fallback polling
         */
        onImagesGenerated(imageUrls) {
            // Stop any active polling since images have arrived
            this.stopPolling();
            
            const placeholder = document.getElementById('imagePlaceholder');
            const grid = document.getElementById('generatedImagesGrid');
            const generateBtn = document.getElementById('generateImageBtn');
            const regenerateBtn = document.getElementById('regenerateImageBtn');
            const infoText = document.getElementById('imageSelectionInfo');
            
            console.log('[CharacterCreation] Images generated (via webhook/WebSocket):', imageUrls);
            console.log('[CharacterCreation] Unique URLs:', [...new Set(imageUrls)].length, 'of', imageUrls.length);
            
            // Log each URL for debugging
            imageUrls.forEach((url, idx) => {
                console.log(`[CharacterCreation] Image ${idx + 1}: ${url.substring(url.lastIndexOf('/') + 1)}`);
            });
            
            // Store all images
            this.characterData.generatedImages = imageUrls;
            
            // Clear the grid and render images (replaces placeholder)
            if (grid) {
                grid.innerHTML = imageUrls.map((url, index) => `
                    <div class="generated-image-item${index === 0 ? ' selected' : ''}" data-image-url="${url}">
                        <img src="${url}" alt="Generated Character ${index + 1}" onerror="this.parentElement.classList.add('error')">
                        <div class="image-overlay">
                            <i class="bi bi-check-circle-fill"></i>
                        </div>
                    </div>
                `).join('');
                
                // Bind click events to all images
                grid.querySelectorAll('.generated-image-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.selectImage(e.currentTarget);
                    });
                });
                
                // Auto-select first image
                this.characterData.selectedImageUrl = imageUrls[0];
                this.saveData();
                
                // Save the auto-selected image as the character's thumbnail
                this.saveSelectedImage(imageUrls[0]);
                
                // Update summary image
                const summaryImage = document.getElementById('summaryImage');
                if (summaryImage) summaryImage.src = imageUrls[0];
            }
            
            // Update buttons
            if (generateBtn) {
                generateBtn.style.display = 'none';
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="bi bi-magic"></i><span>' + this.t('generate_image', 'Generate Images') + '</span>';
            }
            if (regenerateBtn) {
                regenerateBtn.style.display = 'flex';
                regenerateBtn.disabled = false;
                regenerateBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i><span>' + this.t('regenerate', 'Regenerate') + '</span>';
            }
            if (infoText) infoText.style.display = 'block';
            
            // Reset loading state
            this.isGeneratingImage = false;
        }
        
        /**
         * Called when single image is generated (legacy support)
         */
        onImageGenerated(imageUrl) {
            this.onImagesGenerated([imageUrl]);
        }
        
        resetImagePlaceholder() {
            const grid = document.getElementById('generatedImagesGrid');
            const generateBtn = document.getElementById('generateImageBtn');
            const regenerateBtn = document.getElementById('regenerateImageBtn');
            
            if (grid) {
                grid.innerHTML = `
                    <div class="image-placeholder-grid row" id="imagePlaceholder">
                        <div class="placeholder-item col-6 ms-auto">
                            <div class="placeholder-content">
                                <i class="bi bi-image"></i>
                            </div>
                        </div>
                        <div class="placeholder-item col-6 me-auto">
                            <div class="placeholder-content">
                                <i class="bi bi-image"></i>
                            </div>
                        </div>
                        <div class="placeholder-item col-6 ms-auto">
                            <div class="placeholder-content">
                                <i class="bi bi-image"></i>
                            </div>
                        </div>
                        <div class="placeholder-item col-6 me-auto">
                            <div class="placeholder-content">
                                <i class="bi bi-image"></i>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Reset buttons
            if (generateBtn) {
                generateBtn.style.display = 'flex';
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="bi bi-magic"></i><span>' + this.t('generate_image', 'Generate Images') + '</span>';
            }
            if (regenerateBtn) {
                regenerateBtn.style.display = 'none';
            }
            
            this.isGeneratingImage = false;
        }
        
        buildCharacterPrompt() {
            const d = this.characterData;
            
            const styleDesc = d.style === 'anime' ? 'anime style' : 'realistic photorealistic';
            
            const parts = [
                `${styleDesc}`,
                `beautiful ${d.ethnicity} woman`,
                `${d.age} years old`,
                `${d.hairStyle} ${d.hairColor} hair`,
                `${d.bodyType} body`,
                `${d.breastSize} breasts`,
                `${d.buttSize} butt`,
                `${d.personality} personality`,
                `${d.occupation}`
            ];
            
            if (d.customPrompt) {
                parts.push(d.customPrompt);
            }
            
            return parts.join(', ');
        }
        
        /**
         * Regenerate images only (without recreating character)
         * Uses novitaImageGeneration directly
         */
        async regenerateImages() {
            if (this.isGeneratingImage) return;
            
            // Need a chatId to regenerate for
            if (!this.chatId) {
                console.error('[CharacterCreation] No chatId available for regeneration');
                this.showError(this.t('no_chat_error', 'Please generate images first'));
                return;
            }
            
            const generateBtn = document.getElementById('generateImageBtn');
            const regenerateBtn = document.getElementById('regenerateImageBtn');
            const grid = document.getElementById('generatedImagesGrid');
            
            this.isGeneratingImage = true;
            
            // Update buttons
            if (regenerateBtn) {
                regenerateBtn.disabled = true;
                regenerateBtn.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div><span>' + this.t('regenerating', 'Regenerating...') + '</span>';
            }
            if (generateBtn) {
                generateBtn.disabled = true;
            }
            
            // Show loading state on grid - replace images with loading spinners
            if (grid) {
                grid.querySelectorAll('.generated-image-item').forEach(item => {
                    item.classList.add('loading');
                    item.innerHTML = `
                        <div class="loading-spinner">
                            <div class="spinner-border spinner-border-sm"></div>
                        </div>
                    `;
                });
            }
            
            try {
                // Clear previous images
                this.characterData.generatedImages = [];
                this.characterData.selectedImageUrl = '';
                window.pendingCharacterCreationImages = [];
                
                // Build the prompt
                const prompt = this.buildCharacterPrompt();
                console.log('[CharacterCreation] Regenerating images with prompt:', prompt);
                
                // Prepare model data
                const modelId = this.characterData.modelId || null;
                
                // Call novitaImageGeneration directly (it's a global function from stability.js)
                if (typeof novitaImageGeneration !== 'function') {
                    throw new Error('novitaImageGeneration function not available');
                }
                
                // Get user ID from global context
                const userId = window.clerkUserId || window.userId || null;
                
                console.log('[CharacterCreation] Calling novitaImageGeneration for regeneration:', {
                    userId,
                    chatCreationId: this.chatId,
                    modelId,
                    prompt: prompt.substring(0, 100) + '...'
                });
                
                // Save the selected model before regenerating (like old version)
                await this.saveSelectedImageModel();
                
                // Call the regeneration function
                await novitaImageGeneration(userId, this.chatId, null, {
                    prompt: prompt,
                    imageType: 'sfw',
                    chatCreation: true,
                    enableMergeFace: false,
                    regenerate: true,
                    modelId: modelId
                });
                
                // Images will arrive via WebSocket (triggered by Novita webhook)
                // Set up polling as fallback only if WebSocket fails
                this.pollForImage(this.chatId);
                
            } catch (error) {
                console.error('[CharacterCreation] Regeneration error:', error);
                this.showError(this.t('regeneration_failed', 'Failed to regenerate images. Please try again.'));
                
                // Reset state
                this.isGeneratingImage = false;
                
                // Reset button
                if (regenerateBtn) {
                    regenerateBtn.disabled = false;
                    regenerateBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i><span>' + this.t('regenerate', 'Regenerate') + '</span>';
                }
            }
        }
        
        // ===================
        // NAVIGATION
        // ===================
        
        nextStep() {
            if (this.currentStep >= this.totalSteps) return;
            
            // Validate current step
            if (!this.validateStep(this.currentStep)) return;
            
            // Update step
            const prevStep = document.querySelector(`.step-slide[data-step="${this.currentStep}"]`);
            this.currentStep++;
            const nextStepEl = document.querySelector(`.step-slide[data-step="${this.currentStep}"]`);
            
            if (prevStep) prevStep.classList.remove('active');
            if (prevStep) prevStep.classList.add('prev');
            if (nextStepEl) nextStepEl.classList.add('active');
            
            // Set default model when entering step 7 (image generation)
            if (this.currentStep === 7) {
                // Only set default if no custom model is selected
                if (!this.characterData.modelId) {
                    this.setDefaultModelByStyle();
                }
            }
            
            // Update UI
            this.updateUI();
            this.saveData();
            
            // Update summary on last step
            if (this.currentStep === this.totalSteps) {
                this.updateSummary();
            }
        }
        
        prevStep() {
            if (this.currentStep <= 1) return;
            
            const currentStepEl = document.querySelector(`.step-slide[data-step="${this.currentStep}"]`);
            this.currentStep--;
            const prevStepEl = document.querySelector(`.step-slide[data-step="${this.currentStep}"]`);
            
            if (currentStepEl) currentStepEl.classList.remove('active');
            if (prevStepEl) prevStepEl.classList.remove('prev');
            if (prevStepEl) prevStepEl.classList.add('active');
            
            this.updateUI();
        }
        
        validateStep(step) {
            switch (step) {
                case 1:
                    return !!this.characterData.style;
                case 2:
                    return !!this.characterData.ethnicity;
                case 3:
                    return !!this.characterData.hairStyle && !!this.characterData.hairColor;
                case 4:
                    return !!this.characterData.bodyType;
            case 5:
                if (!this.characterData.name || !this.characterData.name.trim()) {
                    this.showError(this.t('errors.enter_name', 'Please enter a name for your character'));
                    return false;
                }
                return true;
                case 6:
                    return !!this.characterData.voice;
                case 7:
                    if (!this.characterData.selectedImageUrl) {
                        this.showError(this.t('errors.select_image', 'Please select an image'));
                        return false;
                    }
                    return true;
                default:
                    return true;
            }
        }
        
        updateUI() {
            // Update progress bar
            const progress = (this.currentStep / this.totalSteps) * 100;
            const progressBar = document.getElementById('progressBar');
            if (progressBar) progressBar.style.width = `${progress}%`;
            
            // Update step indicator
            const currentStepEl = document.querySelector('.step-indicator .current-step');
            if (currentStepEl) currentStepEl.textContent = this.currentStep;
            
            // Update back button visibility
            const backBtn = document.getElementById('backBtn');
            if (backBtn) {
                backBtn.style.visibility = this.currentStep > 1 ? 'visible' : 'hidden';
            }
            
            // Update next button text
            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn) {
                if (this.currentStep === this.totalSteps) {
                    nextBtn.style.display = 'none';
                } else {
                    nextBtn.style.display = 'flex';
                    nextBtn.innerHTML = this.t('next', 'Next') + ' <i class="bi bi-chevron-right"></i>';
                }
            }
        }
        
        updateSummary() {
            const d = this.characterData;
            
            // Update summary image
            const summaryImage = document.getElementById('summaryImage');
            if (summaryImage && d.selectedImageUrl) {
                summaryImage.src = d.selectedImageUrl;
            }
            
            // Update name
            const summaryName = document.getElementById('summaryName');
            if (summaryName) {
                summaryName.textContent = d.name || this.t('unnamed', 'Unnamed');
            }
            
            // Update traits
            const summaryAge = document.getElementById('summaryAge');
            if (summaryAge) summaryAge.textContent = `${d.age} ${this.t('years', 'years')}`;
            
            const summaryEthnicity = document.getElementById('summaryEthnicity');
            if (summaryEthnicity) {
                summaryEthnicity.textContent = this.t(`ethnicities.${d.ethnicity}`, d.ethnicity);
            }
            
            const summaryPersonality = document.getElementById('summaryPersonality');
            if (summaryPersonality) {
                summaryPersonality.textContent = this.t(`personalities.${d.personality}`, d.personality);
            }
            
            // Update description
            const summaryDescription = document.getElementById('summaryDescription');
            if (summaryDescription) {
                const occupation = this.t(`occupations.${d.occupation}`, d.occupation);
                const relationship = this.t(`relationships.${d.relationship}`, d.relationship);
                summaryDescription.textContent = `${occupation} • ${relationship}`;
            }
        }
        
        // ===================
        // START CHAT
        // ===================
        
        async startChat() {
            if (!this.chatId) {
                this.showError(this.t('no_character', 'Please generate a character first'));
                return;
            }
            
            this.showLoading(this.t('creating_character', 'Creating your character...'));
            
            try {
                // Save character image if not already saved
                if (this.characterData.selectedImageUrl) {
                    try {
                        await fetch(`/api/chat/${this.chatId}/set-image`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                imageUrl: this.characterData.selectedImageUrl
                            })
                        });
                    } catch (imgErr) {
                        console.warn('[CharacterCreation] Failed to save character image, continuing anyway');
                    }
                }
                
                // Clear session storage
                this.clearSavedData();
                
                // Redirect to chat
                window.location.href = `/chat/${this.chatId}`;
                
            } catch (error) {
                console.error('[CharacterCreation] Start chat error:', error);
                this.hideLoading();
                this.showError(this.t('start_chat_error', 'Failed to start chat. Please try again.'));
            }
        }
        
        // ===================
        // UTILITY METHODS
        // ===================
        
        showLoading(message) {
            const overlay = document.getElementById('loadingOverlay');
            const msg = document.getElementById('loadingMessage');
            if (overlay) overlay.style.display = 'flex';
            if (msg) msg.textContent = message;
        }
        
        hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.style.display = 'none';
        }
        
        showError(message) {
            // Use existing toast or create one
            let toast = document.querySelector('.error-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'error-toast';
                document.body.appendChild(toast);
            }
            
            toast.innerHTML = `<i class="bi bi-exclamation-circle"></i> ${message}`;
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 4000);
        }
        
        saveData() {
            try {
                sessionStorage.setItem('characterCreation', JSON.stringify({
                    step: this.currentStep,
                    data: this.characterData,
                    chatId: this.chatId
                }));
            } catch (e) {
                // Ignore storage errors
            }
        }
        
        loadSavedData() {
            try {
                const saved = sessionStorage.getItem('characterCreation');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.data) {
                        // Keep gender as female always
                        parsed.data.gender = 'female';
                        this.characterData = { ...this.characterData, ...parsed.data };
                    }
                    if (parsed.chatId) {
                        this.chatId = parsed.chatId;
                    }
                    // Don't restore step - always start fresh
                }
            } catch (error) {
                console.error('[CharacterCreation] Failed to load saved data:', error);
            }
        }
        
        clearSavedData() {
            sessionStorage.removeItem('characterCreation');
            window.characterCreationInitialized = false;
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.characterCreation = new CharacterCreation();
        });
    } else {
        window.characterCreation = new CharacterCreation();
    }
    
})();
