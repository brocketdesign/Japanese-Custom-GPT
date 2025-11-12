/**
 * ChatToolbarTranslator Module
 * Handles translation toolbar functionality
 * 
 * @module ChatToolbarTranslator
 * @requires jQuery
 */

window.ChatToolbarTranslator = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        translationToggleSelector: '#translation-toggle',
        translationBtnSelector: '.translation-btn',
        toolbarTranslationViewSelector: '#toolbar-translation'
    };

    // ==================== PRIVATE STATE ====================
    const supportedLanguages = {
        en: 'english',
        ja: 'japanese',
        ko: 'korean',
        zh: 'chinese',
        fr: 'french',
        de: 'german'
    };

    /**
     * Build translation command message
     * @private
     * @param {string} languageCode - The language code (en, ja, etc.)
     * @returns {string} The translation command
     */
    function buildTranslationCommand(languageCode) {
        if (typeof translations === 'undefined') {
            return `Translate to ${supportedLanguages[languageCode]}`;
        }

        const translateToText = translations.translateTo || 'Translate to';
        let languageText = '';

        switch (languageCode) {
            case 'en':
                languageText = translations.english || 'English';
                break;
            case 'ja':
                languageText = translations.japanese || 'Japanese';
                break;
            case 'ko':
                languageText = translations.korean || 'Korean';
                break;
            case 'zh':
                languageText = translations.chinese || 'Chinese';
                break;
            case 'fr':
                languageText = translations.french || 'French';
                break;
            case 'de':
                languageText = translations.german || 'German';
                break;
            default:
                languageText = supportedLanguages[languageCode] || 'Unknown';
        }

        return `${translateToText} ${languageText}`;
    }

    /**
     * Handle translation button click
     * @private
     */
    function handleTranslationButtonClick() {
        $(config.translationBtnSelector).on('click', function() {
            $(this).addClass('active').siblings().removeClass('active');
            const languageCode = $(this).data('lang');
            const command = buildTranslationCommand(languageCode);

            if (typeof sendMessage === 'function') {
                sendMessage(command);
            }
        });
    }

    /**
     * Handle translation toggle click
     * @private
     */
    function handleTranslationToggleClick() {
        $(config.translationToggleSelector).on('click', function() {
            // Check subscription status
            if (typeof subscriptionStatus !== 'undefined' && !subscriptionStatus) {
                if (typeof loadPlanPage === 'function') {
                    loadPlanPage();
                }
                return;
            }

            // Show toolbar translation view
            if (typeof ChatToolbarUI !== 'undefined' && ChatToolbarUI.showToolContentView) {
                ChatToolbarUI.showToolContentView('toolbar-translation');
            }
        });
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Initialize the toolbar translator module
         * @function init
         */
        init: function() {
            handleTranslationToggleClick();
            handleTranslationButtonClick();
        },

        /**
         * Get supported languages
         * @function getSupportedLanguages
         * @returns {Object} Object with language codes as keys and language names as values
         */
        getSupportedLanguages: function() {
            return supportedLanguages;
        },

        /**
         * Build translation command
         * @function buildCommand
         * @param {string} languageCode - The language code
         * @returns {string} The translation command
         */
        buildCommand: function(languageCode) {
            return buildTranslationCommand(languageCode);
        }
    };
})();
