/**
 * Cold Onboarding System
 * For non-logged-in users coming from ads/SNS
 * Guides them through character creation before registration
 */

class ColdOnboarding {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 7;
        this.translations = window.coldOnboardingTranslations || {};
        this.lang = window.lang || 'en';
        
        // Character data stored throughout the flow
        this.characterData = {
            // Step 1: Style
            style: 'realistic',
            gender: 'female',
            
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
            
            // Step 6: Voice
            voice: 'Wise_Woman'
        };
        
        // Voice samples manifest
        this.voiceSamples = null;
        this.audioPlayer = null;
        this.currentPlayingVoice = null;
        
        // Clerk instance
        this.clerk = null;
        
        // Option picker data
        this.optionData = this.getOptionData();
        
        this.init();
    }
    
    /**
     * Initialize the onboarding flow
     */
    async init() {
        // Load saved character data from sessionStorage if exists
        this.loadSavedData();
        
        // Initialize audio player
        this.audioPlayer = document.getElementById('voiceSamplePlayer');
        
        // Load voice samples manifest
        await this.loadVoiceSamples();
        
        // Initialize Clerk for authentication
        await this.initClerk();
        
        // Bind events
        this.bindEvents();
        
        // Render initial state
        this.renderVoiceGrid();
        this.updateUI();
        
        console.log('[ColdOnboarding] Initialized');
    }
    
    /**
     * Get option data for the option picker modal
     */
    getOptionData() {
        return {
            personality: {
                title: this.t('step5.personality_title'),
                options: [
                    { value: 'submissive', label: this.t('step5.personalities.submissive') },
                    { value: 'dominant', label: this.t('step5.personalities.dominant') },
                    { value: 'shy', label: this.t('step5.personalities.shy') },
                    { value: 'confident', label: this.t('step5.personalities.confident') },
                    { value: 'playful', label: this.t('step5.personalities.playful') },
                    { value: 'serious', label: this.t('step5.personalities.serious') },
                    { value: 'romantic', label: this.t('step5.personalities.romantic') },
                    { value: 'adventurous', label: this.t('step5.personalities.adventurous') },
                    { value: 'caring', label: this.t('step5.personalities.caring') },
                    { value: 'mysterious', label: this.t('step5.personalities.mysterious') }
                ]
            },
            relationship: {
                title: this.t('step5.relationship_title'),
                options: [
                    { value: 'stranger', label: this.t('step5.relationships.stranger') },
                    { value: 'friend', label: this.t('step5.relationships.friend') },
                    { value: 'girlfriend', label: this.t('step5.relationships.girlfriend') },
                    { value: 'wife', label: this.t('step5.relationships.wife') },
                    { value: 'crush', label: this.t('step5.relationships.crush') },
                    { value: 'colleague', label: this.t('step5.relationships.colleague') },
                    { value: 'neighbor', label: this.t('step5.relationships.neighbor') },
                    { value: 'ex', label: this.t('step5.relationships.ex') },
                    { value: 'first_date', label: this.t('step5.relationships.first_date') },
                    { value: 'roommate', label: this.t('step5.relationships.roommate') }
                ]
            },
            occupation: {
                title: this.t('step5.occupation_title'),
                options: [
                    { value: 'student', label: '🎓 ' + this.t('step5.occupations.student') },
                    { value: 'teacher', label: '👩‍🏫 ' + this.t('step5.occupations.teacher') },
                    { value: 'nurse', label: '👩‍⚕️ ' + this.t('step5.occupations.nurse') },
                    { value: 'model', label: '💃 ' + this.t('step5.occupations.model') },
                    { value: 'artist', label: '🎨 ' + this.t('step5.occupations.artist') },
                    { value: 'athlete', label: '⚽ ' + this.t('step5.occupations.athlete') },
                    { value: 'businesswoman', label: '💼 ' + this.t('step5.occupations.businesswoman') },
                    { value: 'influencer', label: '📱 ' + this.t('step5.occupations.influencer') },
                    { value: 'scientist', label: '🔬 ' + this.t('step5.occupations.scientist') },
                    { value: 'musician', label: '🎵 ' + this.t('step5.occupations.musician') }
                ]
            },
            kinks: {
                title: this.t('step5.kinks_title'),
                options: [
                    { value: 'vanilla', label: this.t('step5.kinks.vanilla') },
                    { value: 'daddy_dom', label: this.t('step5.kinks.daddy_dom') },
                    { value: 'roleplay', label: this.t('step5.kinks.roleplay') },
                    { value: 'bdsm', label: this.t('step5.kinks.bdsm') },
                    { value: 'exhibitionism', label: this.t('step5.kinks.exhibitionism') },
                    { value: 'feet', label: this.t('step5.kinks.feet') },
                    { value: 'lingerie', label: this.t('step5.kinks.lingerie') },
                    { value: 'outdoor', label: this.t('step5.kinks.outdoor') },
                    { value: 'toys', label: this.t('step5.kinks.toys') }
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
     * Load voice samples manifest
     */
    async loadVoiceSamples() {
        try {
            const response = await fetch('/audio/voice-samples/manifest.json');
            if (response.ok) {
                this.voiceSamples = await response.json();
                console.log('[ColdOnboarding] Voice samples loaded:', this.voiceSamples.voices.length);
            }
        } catch (error) {
            console.error('[ColdOnboarding] Failed to load voice samples:', error);
            // Use fallback voice data
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
                { key: 'Friendly_Person', gender: 'female', languages: ['en', 'fr', 'ja'] },
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
     * Initialize Clerk authentication
     * Uses the global Clerk instance initialized in the template
     */
    async initClerk() {
        try {
            // Wait for Clerk to be loaded from template
            await this.waitForClerk();
            
            if (window.Clerk) {
                this.clerk = window.Clerk;
                
                // Check if user is already signed in
                if (this.clerk.user) {
                    console.log('[ColdOnboarding] User already signed in');
                }
                
                console.log('[ColdOnboarding] Clerk initialized');
            } else {
                console.warn('[ColdOnboarding] Clerk not available');
                this.showFallbackAuth();
            }
        } catch (error) {
            console.error('[ColdOnboarding] Clerk initialization failed:', error);
            this.showFallbackAuth();
        }
    }
    
    /**
     * Wait for Clerk to be available
     */
    async waitForClerk() {
        return new Promise((resolve) => {
            if (window.Clerk) {
                resolve();
                return;
            }
            
            const maxWait = 10000; // 10 seconds
            const startTime = Date.now();
            
            const checkClerk = setInterval(() => {
                if (window.Clerk) {
                    clearInterval(checkClerk);
                    resolve();
                } else if (Date.now() - startTime > maxWait) {
                    clearInterval(checkClerk);
                    resolve(); // Resolve anyway, we'll handle missing Clerk
                }
            }, 100);
        });
    }
    
    /**
     * Show fallback authentication form
     */
    showFallbackAuth() {
        // Use global function if available, otherwise do it ourselves
        if (window.showFallbackAuth) {
            window.showFallbackAuth();
        } else {
            const clerkContainer = document.getElementById('clerk-auth-container');
            const fallbackAuth = document.getElementById('fallbackAuth');
            
            if (clerkContainer) clerkContainer.style.display = 'none';
            if (fallbackAuth) fallbackAuth.style.display = 'block';
        }
    }
    
    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Navigation buttons
        document.getElementById('nextBtn')?.addEventListener('click', () => this.nextStep());
        document.getElementById('backBtn')?.addEventListener('click', () => this.prevStep());
        
        // Step 1: Style selection
        document.querySelectorAll('.style-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectStyle(e.currentTarget));
        });
        
        document.querySelectorAll('.gender-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectGender(e.currentTarget));
        });
        
        // Step 2: Ethnicity selection
        document.querySelectorAll('.ethnicity-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectEthnicity(e.currentTarget));
        });
        
        // Age slider
        document.getElementById('ageSlider')?.addEventListener('input', (e) => this.updateAge(e.target.value));
        
        // Step 3: Hair selection
        document.querySelectorAll('.hair-style-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectHairStyle(e.currentTarget));
        });
        
        document.querySelectorAll('.hair-color-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectHairColor(e.currentTarget));
        });
        
        // Step 4: Body selection
        document.querySelectorAll('.body-type-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectBodyType(e.currentTarget));
        });
        
        document.querySelectorAll('.breast-size-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectBreastSize(e.currentTarget));
        });
        
        document.querySelectorAll('.butt-size-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectButtSize(e.currentTarget));
        });
        
        // Step 5: Personality options
        document.querySelectorAll('.personality-option-card').forEach(card => {
            card.addEventListener('click', (e) => this.openOptionPicker(e.currentTarget));
        });
        
        document.getElementById('characterName')?.addEventListener('input', (e) => {
            this.characterData.name = e.target.value;
            this.saveData();
        });
        
        document.getElementById('generateNameBtn')?.addEventListener('click', () => this.generateRandomName());
        
        // Step 7: Registration
        document.getElementById('emailSignupForm')?.addEventListener('submit', (e) => this.handleEmailSignup(e));
        document.getElementById('googleSignInBtn')?.addEventListener('click', () => this.handleGoogleSignIn());
        
        // Audio player events
        this.audioPlayer?.addEventListener('ended', () => this.onAudioEnded());
        this.audioPlayer?.addEventListener('error', (e) => this.onAudioError(e));
        
        // Initialize video hover handlers
        this.initVideoHoverHandlers();
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.currentStep < 7) {
                this.nextStep();
            } else if (e.key === 'Escape' && this.currentStep > 1) {
                this.prevStep();
            }
        });
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
    
    /**
     * Render the voice selection grid
     */
    renderVoiceGrid() {
        const grid = document.getElementById('voiceGrid');
        if (!grid || !this.voiceSamples) return;
        
        // Filter to female voices only
        const femaleVoices = this.voiceSamples.voices.filter(v => v.gender === 'female');
        
        grid.innerHTML = femaleVoices.map(voice => {
            const isSelected = this.characterData.voice === voice.key;
            const voiceTranslation = this.translations.step6?.voices?.[voice.key] || {};
            
            return `
                <div class="voice-card ${isSelected ? 'selected' : ''}" data-voice="${voice.key}">
                    <div class="voice-card-content">
                        <div class="voice-icon">
                            <i class="bi bi-soundwave"></i>
                        </div>
                        <div class="voice-info">
                            <span class="voice-name">${voiceTranslation.name || voice.key.replace(/_/g, ' ')}</span>
                            <span class="voice-description">${voiceTranslation.description || ''}</span>
                        </div>
                    </div>
                    <button type="button" class="play-sample-btn" data-voice="${voice.key}">
                        <i class="bi bi-play-fill"></i>
                        <span>${this.t('step6.play_sample')}</span>
                    </button>
                    <div class="check-badge"><i class="bi bi-check"></i></div>
                </div>
            `;
        }).join('');
        
        // Bind voice card events
        grid.querySelectorAll('.voice-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't select if clicking play button
                if (!e.target.closest('.play-sample-btn')) {
                    this.selectVoice(card);
                }
            });
        });
        
        grid.querySelectorAll('.play-sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playVoiceSample(btn.dataset.voice);
            });
        });
    }
    
    /**
     * Play a voice sample
     */
    async playVoiceSample(voiceKey) {
        if (!this.audioPlayer) return;
        
        // If clicking the same voice that's currently playing, pause it
        if (this.currentPlayingVoice === voiceKey && !this.audioPlayer.paused) {
            this.pauseVoiceSample();
            return;
        }
        
        // If clicking the same voice that's currently paused, resume it
        if (this.currentPlayingVoice === voiceKey && this.audioPlayer.paused) {
            this.resumeVoiceSample();
            return;
        }
        
        // Stop current playback if different voice
        if (this.currentPlayingVoice && this.currentPlayingVoice !== voiceKey) {
            this.stopVoiceSample();
        }
        
        // Find the sample URL
        const sampleUrl = `/audio/voice-samples/${this.lang}/${voiceKey}_${this.lang}.mp3`;
        
        // Update UI to show playing state
        const btn = document.querySelector(`.play-sample-btn[data-voice="${voiceKey}"]`);
        if (btn) {
            btn.innerHTML = `<i class="bi bi-pause-fill"></i><span>${this.t('step6.playing')}</span>`;
            btn.classList.add('playing');
        }
        
        this.currentPlayingVoice = voiceKey;
        
        try {
            this.audioPlayer.src = sampleUrl;
            await this.audioPlayer.play();
        } catch (error) {
            console.error('[ColdOnboarding] Failed to play voice sample:', error);
            this.onAudioEnded();
        }
    }
    
    /**
     * Pause voice sample playback
     */
    pauseVoiceSample() {
        if (this.audioPlayer && !this.audioPlayer.paused) {
            this.audioPlayer.pause();
            
            const btn = document.querySelector(`.play-sample-btn[data-voice="${this.currentPlayingVoice}"]`);
            if (btn) {
                btn.innerHTML = `<i class="bi bi-play-fill"></i><span>${this.t('step6.play_sample')}</span>`;
                btn.classList.remove('playing');
            }
        }
    }
    
    /**
     * Resume voice sample playback
     */
    resumeVoiceSample() {
        if (this.audioPlayer && this.audioPlayer.paused) {
            this.audioPlayer.play().catch(error => {
                console.error('[ColdOnboarding] Failed to resume voice sample:', error);
                this.onAudioEnded();
            });
            
            const btn = document.querySelector(`.play-sample-btn[data-voice="${this.currentPlayingVoice}"]`);
            if (btn) {
                btn.innerHTML = `<i class="bi bi-pause-fill"></i><span>${this.t('step6.playing')}</span>`;
                btn.classList.add('playing');
            }
        }
    }
    
    /**
     * Stop voice sample playback
     */
    stopVoiceSample() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
        }
        this.onAudioEnded();
    }
    
    /**
     * Handle audio ended event
     */
    onAudioEnded() {
        if (this.currentPlayingVoice) {
            const btn = document.querySelector(`.play-sample-btn[data-voice="${this.currentPlayingVoice}"]`);
            if (btn) {
                btn.innerHTML = `<i class="bi bi-play-fill"></i><span>${this.t('step6.play_sample')}</span>`;
                btn.classList.remove('playing');
            }
        }
        this.currentPlayingVoice = null;
    }
    
    /**
     * Handle audio error
     */
    onAudioError(error) {
        console.error('[ColdOnboarding] Audio error:', error);
        this.onAudioEnded();
    }
    
    /**
     * Selection handlers
     */
    selectStyle(card) {
        document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.characterData.style = card.dataset.style;
        
        // Update style card thumbnails and videos
        const basePath = `/img/cold-onboarding`;
        document.querySelectorAll('.style-card').forEach(styleCard => {
            const styleType = styleCard.dataset.style;
            const thumbnail = styleCard.querySelector('.video-thumbnail');
            const video = styleCard.querySelector('.video-hover');
            if (thumbnail) thumbnail.src = `${basePath}/style-${styleType}.jpg`;
            if (video) video.src = `${basePath}/style-${styleType}.mp4`;
        });
        
        this.updateStyleDependentVideos();
        this.saveData();
    }
    
    /**
     * Update all video sources that depend on the selected style (realistic/anime)
     */
    updateStyleDependentVideos() {
        const style = this.characterData.style;
        const basePath = `/img/cold-onboarding/${style}`;
        
        // Update ethnicity videos and thumbnails
        document.querySelectorAll('.ethnicity-card').forEach(card => {
            const ethnicity = card.dataset.ethnicity;
            const thumbnail = card.querySelector('.video-thumbnail');
            const video = card.querySelector('.video-hover');
            if (thumbnail) thumbnail.src = `${basePath}/ethnicity-${ethnicity}.jpg`;
            if (video) video.src = `${basePath}/ethnicity-${ethnicity}.mp4`;
        });
        
        // Update hair style videos and thumbnails
        document.querySelectorAll('.hair-style-card').forEach(card => {
            const hairstyle = card.dataset.hairstyle;
            const thumbnail = card.querySelector('.video-thumbnail');
            const video = card.querySelector('.video-hover');
            if (thumbnail) thumbnail.src = `${basePath}/hair-${hairstyle}.jpg`;
            if (video) video.src = `${basePath}/hair-${hairstyle}.mp4`;
        });
        
        // Update hair color videos (if any)
        document.querySelectorAll('.hair-color-card video').forEach(video => {
            const haircolor = video.closest('.hair-color-card').dataset.haircolor;
            video.src = `${basePath}/haircolor-${haircolor}.mp4`;
        });
        
        // Update body type videos (if any)
        document.querySelectorAll('.body-type-card video').forEach(video => {
            const bodytype = video.closest('.body-type-card').dataset.bodytype;
            video.src = `${basePath}/body-${bodytype}.mp4`;
        });
        
        // Update breast size videos (if any)
        document.querySelectorAll('.breast-size-card video').forEach(video => {
            const breastsize = video.closest('.breast-size-card').dataset.breastsize;
            video.src = `${basePath}/breast-${breastsize}.mp4`;
        });
        
        // Update butt size videos (if any)
        document.querySelectorAll('.butt-size-card video').forEach(video => {
            const buttsize = video.closest('.butt-size-card').dataset.buttsize;
            video.src = `${basePath}/butt-${buttsize}.mp4`;
        });
    }
    
    selectGender(btn) {
        document.querySelectorAll('.gender-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.characterData.gender = btn.dataset.gender;
        this.saveData();
    }
    
    selectEthnicity(card) {
        document.querySelectorAll('.ethnicity-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.characterData.ethnicity = card.dataset.ethnicity;
        this.saveData();
    }
    
    updateAge(value) {
        this.characterData.age = parseInt(value);
        document.getElementById('ageValue').textContent = value;
        this.saveData();
    }
    
    selectHairStyle(card) {
        document.querySelectorAll('.hair-style-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.characterData.hairStyle = card.dataset.hairstyle;
        this.saveData();
    }
    
    selectHairColor(card) {
        document.querySelectorAll('.hair-color-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.characterData.hairColor = card.dataset.haircolor;
        this.saveData();
    }
    
    selectBodyType(card) {
        document.querySelectorAll('.body-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.characterData.bodyType = card.dataset.bodytype;
        this.saveData();
    }
    
    selectBreastSize(card) {
        document.querySelectorAll('.breast-size-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.characterData.breastSize = card.dataset.breastsize;
        this.saveData();
    }
    
    selectButtSize(card) {
        document.querySelectorAll('.butt-size-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.characterData.buttSize = card.dataset.buttsize;
        this.saveData();
    }
    
    selectVoice(card) {
        document.querySelectorAll('.voice-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.characterData.voice = card.dataset.voice;
        this.saveData();
    }
    
    /**
     * Open option picker modal
     */
    openOptionPicker(card) {
        const optionType = card.dataset.option;
        const optionConfig = this.optionData[optionType];
        
        if (!optionConfig) return;
        
        const modal = document.getElementById('optionPickerModal');
        const title = document.getElementById('optionPickerTitle');
        const list = document.getElementById('optionList');
        
        title.textContent = optionConfig.title;
        
        list.innerHTML = optionConfig.options.map(opt => `
            <div class="option-item ${this.characterData[optionType] === opt.value ? 'selected' : ''}" 
                 data-option="${optionType}" data-value="${opt.value}">
                <span>${opt.label}</span>
                <i class="bi bi-check-circle-fill"></i>
            </div>
        `).join('');
        
        // Bind click events
        list.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectOption(item.dataset.option, item.dataset.value);
                bootstrap.Modal.getInstance(modal).hide();
            });
        });
        
        new bootstrap.Modal(modal).show();
    }
    
    /**
     * Select an option from the picker
     */
    selectOption(optionType, value) {
        this.characterData[optionType] = value;
        
        // Update the card display
        const card = document.querySelector(`.personality-option-card[data-option="${optionType}"]`);
        if (card) {
            card.dataset.value = value;
            
            const optionConfig = this.optionData[optionType];
            const option = optionConfig.options.find(o => o.value === value);
            
            if (option) {
                card.querySelector('.option-value').textContent = option.label;
            }
        }
        
        this.saveData();
    }
    
    /**
     * Generate a random name based on ethnicity
     */
    async generateRandomName() {
        const btn = document.getElementById('generateNameBtn');
        const input = document.getElementById('characterName');
        
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
        
        try {
            const response = await fetch('/api/cold-onboarding/generate-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ethnicity: this.characterData.ethnicity,
                    gender: this.characterData.gender,
                    language: this.lang
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                input.value = data.name;
                this.characterData.name = data.name;
                this.saveData();
            }
        } catch (error) {
            console.error('[ColdOnboarding] Failed to generate name:', error);
            // Use fallback names
            input.value = this.getFallbackName();
            this.characterData.name = input.value;
            this.saveData();
        }
        
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-repeat"></i>';
    }
    
    /**
     * Get a fallback name based on ethnicity
     */
    getFallbackName() {
        const names = {
            caucasian: ['Emma', 'Sophie', 'Olivia', 'Isabella', 'Mia'],
            asian: ['Mei', 'Yuki', 'Hana', 'Lin', 'Sakura'],
            black: ['Aisha', 'Imani', 'Zara', 'Amara', 'Nia'],
            latina: ['Maria', 'Sofia', 'Isabella', 'Camila', 'Valentina'],
            arab: ['Fatima', 'Leila', 'Yasmin', 'Amira', 'Nadia'],
            indian: ['Priya', 'Ananya', 'Aisha', 'Maya', 'Sana'],
            japanese: ['Yuki', 'Sakura', 'Hana', 'Mika', 'Rin'],
            korean: ['Ji-yeon', 'Min-ji', 'Soo-yeon', 'Hae-won', 'Yuna']
        };
        
        const ethnicityNames = names[this.characterData.ethnicity] || names.caucasian;
        return ethnicityNames[Math.floor(Math.random() * ethnicityNames.length)];
    }
    
    /**
     * Navigation methods
     */
    nextStep() {
        if (!this.validateCurrentStep()) return;
        
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.updateUI();
            this.saveData();
            
            // Initialize Clerk auth on step 7
            if (this.currentStep === 7) {
                this.initAuthStep();
            }
        }
    }
    
    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateUI();
        }
    }
    
    /**
     * Validate current step before proceeding
     */
    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                return !!this.characterData.style;
            case 2:
                return !!this.characterData.ethnicity;
            case 3:
                return !!this.characterData.hairStyle && !!this.characterData.hairColor;
            case 4:
                return !!this.characterData.bodyType;
            case 5:
                if (!this.characterData.name?.trim()) {
                    this.showError(this.t('errors.enter_name'));
                    return false;
                }
                return true;
            case 6:
                return !!this.characterData.voice;
            default:
                return true;
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        // Create toast or alert
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.innerHTML = `
            <i class="bi bi-exclamation-circle"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * Update UI based on current step
     */
    updateUI() {
        // Update progress bar
        const progress = (this.currentStep / this.totalSteps) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
        
        // Update step indicator
        document.querySelector('.current-step').textContent = this.currentStep;
        
        // Show/hide steps
        document.querySelectorAll('.step-slide').forEach(slide => {
            const stepNum = parseInt(slide.dataset.step);
            slide.classList.remove('active', 'prev', 'next');
            
            if (stepNum === this.currentStep) {
                slide.classList.add('active');
            } else if (stepNum < this.currentStep) {
                slide.classList.add('prev');
            } else {
                slide.classList.add('next');
            }
        });
        
        // Update navigation buttons
        const backBtn = document.getElementById('backBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        backBtn.style.visibility = this.currentStep > 1 ? 'visible' : 'hidden';
        
        if (this.currentStep === this.totalSteps) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'flex';
            nextBtn.innerHTML = `${this.t('buttons.next')} <i class="bi bi-chevron-right"></i>`;
        }
        
        // Scroll to top of step content
        document.querySelector('.step-slide.active .step-content')?.scrollTo(0, 0);
    }
    
    /**
     * Initialize authentication step (Step 7)
     */
    async initAuthStep() {
        // Wait for Clerk if not ready yet
        await this.waitForClerk();
        
        if (this.clerk || window.Clerk) {
            const clerk = this.clerk || window.Clerk;
            const container = document.getElementById('clerk-auth-container');
            
            try {
                // Mount Clerk sign-up component with theme matching our design
                await clerk.mountSignUp(container, {
                    afterSignUpUrl: '/chat/?source=cold-onboarding&status=success',
                    signInUrl: '/login',
                    appearance: {
                        variables: {
                            colorPrimary: '#8240FF',
                            colorBackground: 'rgba(26, 26, 26, 0.9)',
                            colorText: '#ffffff',
                            colorTextSecondary: '#aeb0b4',
                            colorInputBackground: 'rgba(255, 255, 255, 0.05)',
                            colorInputText: '#ffffff',
                            borderRadius: '12px'
                        },
                        elements: {
                            card: {
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '15px',
                                boxShadow: '0 8px 32px rgba(110, 32, 244, 0.15)'
                            },
                            formButtonPrimary: {
                                background: 'linear-gradient(90.9deg, #D2B8FF 2.74%, #8240FF 102.92%)',
                                border: 'none',
                                fontWeight: '600'
                            },
                            formFieldInput: {
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px'
                            },
                            socialButtonsBlockButton: {
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }
                        }
                    }
                });
                
                // Listen for successful sign-up
                clerk.addListener(({ user }) => {
                    if (user) {
                        this.onAuthComplete(user);
                    }
                });
            } catch (error) {
                console.error('[ColdOnboarding] Failed to mount Clerk:', error);
                this.showFallbackAuth();
            }
        } else {
            this.showFallbackAuth();
        }
    }
    
    /**
     * Handle email signup (fallback)
     */
    async handleEmailSignup(e) {
        e.preventDefault();
        
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const termsAgree = document.getElementById('termsAgree').checked;
        
        if (!termsAgree) {
            this.showError(this.t('errors.agree_terms'));
            return;
        }
        
        if (password.length < 8) {
            this.showError(this.t('errors.password_short'));
            return;
        }
        
        this.showLoading();
        
        const clerk = this.clerk || window.Clerk;
        
        try {
            // Create user via Clerk
            if (clerk) {
                const result = await clerk.client.signUp.create({
                    emailAddress: email,
                    password: password
                });
                
                if (result.status === 'complete') {
                    await clerk.setActive({ session: result.createdSessionId });
                    this.onAuthComplete(clerk.user);
                } else {
                    // Handle verification if needed
                    console.log('[ColdOnboarding] Additional verification needed');
                    this.hideLoading();
                }
            } else {
                // Fallback API registration
                const response = await fetch('/api/cold-onboarding/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.onAuthComplete(data.user);
                } else {
                    throw new Error('Registration failed');
                }
            }
        } catch (error) {
            console.error('[ColdOnboarding] Registration error:', error);
            this.hideLoading();
            this.showError(error.message || 'Registration failed');
        }
    }
    
    /**
     * Handle Google sign-in
     */
    async handleGoogleSignIn() {
        const clerk = this.clerk || window.Clerk;
        
        if (clerk) {
            try {
                // Use Clerk.openSignIn with Google strategy instead of authenticateWithRedirect
                // This ensures proper OAuth flow through Clerk's managed UI
                const urlParams = new URLSearchParams(window.location.search);
                const langFromUrl = urlParams.get('lang');
                const langFromCookie = document.cookie.split('; ').find(row => row.startsWith('lang='))?.split('=')[1];
                const langUrl = langFromUrl || langFromCookie || window.lang || 'ja';
                clerk.openSignIn({
                    redirectUrl: window.location.origin + '/chat/?source=cold-onboarding&status=success',
                    language: langUrl,
                });
            } catch (error) {
                console.error('[ColdOnboarding] Google sign-in error:', error);
                this.showError('Google sign-in failed');
            }
        } else {
            this.showError('Authentication not available');
        }
    }
    
    /**
     * Called after successful authentication
     */
    async onAuthComplete(user) {
        console.log('[ColdOnboarding] Auth complete, creating character...');
        this.showLoading();
        
        try {
            // Create the character with all saved data
            const response = await fetch('/api/cold-onboarding/create-character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterData: this.characterData,
                    language: this.lang
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Clear saved data
                this.clearSavedData();
                
                // Redirect to the new chat
                window.location.href = `/chat/${data.chatId}`;
            } else {
                throw new Error('Character creation failed');
            }
        } catch (error) {
            console.error('[ColdOnboarding] Character creation error:', error);
            this.hideLoading();
            this.showError(this.t('errors.generation_failed'));
        }
    }
    
    /**
     * Show loading overlay
     */
    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }
    
    /**
     * Hide loading overlay
     */
    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
    
    /**
     * Save character data to sessionStorage
     */
    saveData() {
        sessionStorage.setItem('coldOnboarding', JSON.stringify({
            characterData: this.characterData,
            currentStep: this.currentStep
        }));
    }
    
    /**
     * Load saved data from sessionStorage
     */
    loadSavedData() {
        try {
            const saved = sessionStorage.getItem('coldOnboarding');
            if (saved) {
                const data = JSON.parse(saved);
                this.characterData = { ...this.characterData, ...data.characterData };
                this.currentStep = data.currentStep || 1;
                
                // Restore UI state
                this.restoreUIState();
            }
        } catch (error) {
            console.error('[ColdOnboarding] Failed to load saved data:', error);
        }
    }
    
    /**
     * Restore UI state from saved data
     */
    restoreUIState() {
        // Step 1: Style - must update videos first
        const styleCard = document.querySelector(`.style-card[data-style="${this.characterData.style}"]`);
        if (styleCard) {
            document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
            styleCard.classList.add('selected');
        }
        
        // Update all style-dependent videos (ethnicity, hair, body, etc.)
        // This is critical for showing anime vs realistic media on page refresh
        this.updateStyleDependentVideos();
        
        const genderToggle = document.querySelector(`.gender-toggle[data-gender="${this.characterData.gender}"]`);
        if (genderToggle) {
            document.querySelectorAll('.gender-toggle').forEach(b => b.classList.remove('active'));
            genderToggle.classList.add('active');
        }
        
        // Step 2
        const ethnicityCard = document.querySelector(`.ethnicity-card[data-ethnicity="${this.characterData.ethnicity}"]`);
        if (ethnicityCard) {
            document.querySelectorAll('.ethnicity-card').forEach(c => c.classList.remove('selected'));
            ethnicityCard.classList.add('selected');
        }
        
        const ageSlider = document.getElementById('ageSlider');
        const ageValue = document.getElementById('ageValue');
        if (ageSlider && ageValue) {
            ageSlider.value = this.characterData.age;
            ageValue.textContent = this.characterData.age;
        }
        
        // Step 3
        const hairStyleCard = document.querySelector(`.hair-style-card[data-hairstyle="${this.characterData.hairStyle}"]`);
        if (hairStyleCard) {
            document.querySelectorAll('.hair-style-card').forEach(c => c.classList.remove('selected'));
            hairStyleCard.classList.add('selected');
        }
        
        const hairColorCard = document.querySelector(`.hair-color-card[data-haircolor="${this.characterData.hairColor}"]`);
        if (hairColorCard) {
            document.querySelectorAll('.hair-color-card').forEach(c => c.classList.remove('selected'));
            hairColorCard.classList.add('selected');
        }
        
        // Step 4
        const bodyTypeCard = document.querySelector(`.body-type-card[data-bodytype="${this.characterData.bodyType}"]`);
        if (bodyTypeCard) {
            document.querySelectorAll('.body-type-card').forEach(c => c.classList.remove('selected'));
            bodyTypeCard.classList.add('selected');
        }
        
        const breastSizeCard = document.querySelector(`.breast-size-card[data-breastsize="${this.characterData.breastSize}"]`);
        if (breastSizeCard) {
            document.querySelectorAll('.breast-size-card').forEach(c => c.classList.remove('selected'));
            breastSizeCard.classList.add('selected');
        }
        
        const buttSizeCard = document.querySelector(`.butt-size-card[data-buttsize="${this.characterData.buttSize}"]`);
        if (buttSizeCard) {
            document.querySelectorAll('.butt-size-card').forEach(c => c.classList.remove('selected'));
            buttSizeCard.classList.add('selected');
        }
        
        // Step 5
        const nameInput = document.getElementById('characterName');
        if (nameInput && this.characterData.name) {
            nameInput.value = this.characterData.name;
        }
        
        // Step 6: Voice selection
        const voiceCard = document.querySelector(`.voice-card[data-voice="${this.characterData.voice}"]`);
        if (voiceCard) {
            document.querySelectorAll('.voice-card').forEach(c => c.classList.remove('selected'));
            voiceCard.classList.add('selected');
        }
        
        console.log('[ColdOnboarding] UI state restored, style:', this.characterData.style);
    }
    
    /**
     * Clear saved data
     */
    clearSavedData() {
        sessionStorage.removeItem('coldOnboarding');
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.coldOnboarding = new ColdOnboarding();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColdOnboarding;
}
