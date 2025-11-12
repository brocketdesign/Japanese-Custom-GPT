/**
 * Chat Message Formatter Module
 * Handles text formatting, sanitization, and markdown processing
 * 
 * @module chat-message-formatter
 * @requires marked (global)
 */

const ChatMessageFormatter = (function() {
    'use strict';

    // ============================================================================
    // Private Variables
    // ============================================================================

    const TAG_PATTERN_REGEX = /\[(.*?)\]/g;
    const MARKDOWN_BOLD_REGEX = /\*\*(.*?)\*\*/g;
    const UNSAFE_TAGS = ['script', 'iframe', 'object', 'embed'];

    // ============================================================================
    // Text Formatting Functions
    // ============================================================================

    /**
     * Format a message with markdown and bold text
     * @param {string} text - The text to format
     * @param {Object} options - Formatting options
     * @param {string} options.format - 'markdown' or 'plain'
     * @param {boolean} options.highlightMentions - Whether to highlight mentions
     * @returns {string} Formatted text
     */
    function formatMessage(text, options = {}) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        const { format = 'plain', highlightMentions = false } = options;

        let result = text;

        // Apply formatting based on format type
        if (format === 'markdown') {
            result = formatMarkdown(result);
        } else {
            result = formatPlainText(result);
        }

        // Apply additional formatting
        if (highlightMentions) {
            result = highlightMentions(result);
        }

        return result.trim();
    }

    /**
     * Format markdown text to HTML
     * @param {string} markdownText - The markdown text
     * @returns {string} Formatted HTML string
     */
    function formatMarkdown(markdownText) {
        if (!markdownText || typeof markdownText !== 'string') {
            return markdownText;
        }

        // First, sanitize the input
        const sanitized = sanitizeInput(markdownText);

        // Use the global marked library if available
        if (typeof marked !== 'undefined') {
            try {
                return marked.parse(sanitized);
            } catch (error) {
                console.warn('[ChatMessageFormatter] Error parsing markdown:', error);
                return sanitized;
            }
        }

        // Fallback to basic formatting
        return formatPlainText(sanitized);
    }

    /**
     * Format plain text with basic styling
     * @param {string} plainText - The plain text
     * @returns {string} Formatted HTML
     */
    function formatPlainText(plainText) {
        if (!plainText || typeof plainText !== 'string') {
            return plainText;
        }

        // Remove dangerous tags
        let result = plainText;

        // Format bold text (**text** → <strong>text</strong>)
        result = result.replace(MARKDOWN_BOLD_REGEX, '<strong>$1</strong>');

        // Only return modified version if it's substantial (> 10 chars)
        return result.trim().length > 10 ? result : plainText;
    }

    /**
     * Format code blocks with optional language highlighting
     * @param {string} code - The code to format
     * @param {string} language - Programming language for syntax highlighting
     * @returns {string} Formatted code block HTML
     */
    function formatCodeBlock(code, language = 'text') {
        if (!code || typeof code !== 'string') {
            return code;
        }

        const escapedCode = escapeHtml(code);
        const langClass = language ? ` language-${escapeHtml(language)}` : '';

        return `<pre><code class="code-block${langClass}">${escapedCode}</code></pre>`;
    }

    /**
     * Format message text for display (legacy compatibility)
     * @param {string} str - The text to format
     * @returns {string} Formatted text
     */
    function formatMessageTextLegacy(str) {
        if (!str) {
            return str;
        }

        // Text between ** in bold
        const updatedStr = str.replace(MARKDOWN_BOLD_REGEX, '<strong>$1</strong>');
        return updatedStr.trim().length > 10 ? updatedStr : str;
    }

    // ============================================================================
    // Sanitization Functions
    // ============================================================================

    /**
     * Sanitize user input to prevent XSS attacks
     * @param {string} userText - The user input text
     * @returns {string} Sanitized text
     */
    function sanitizeInput(userText) {
        if (!userText || typeof userText !== 'string') {
            return userText;
        }

        // Remove dangerous HTML tags and scripts
        let sanitized = userText;

        // Remove script tags and content
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // Remove event handlers
        sanitized = sanitized.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=\s*'[^']*'/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

        // Remove iframe, object, embed tags
        UNSAFE_TAGS.forEach(tag => {
            const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!</${tag}>)<[^<]*)*</${tag}>`, 'gi');
            sanitized = sanitized.replace(regex, '');
        });

        return sanitized;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - The text to escape
     * @returns {string} Escaped HTML text
     */
    function escapeHtml(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return text.replace(/[&<>"']/g, char => map[char]);
    }

    /**
     * Extract code blocks from text
     * @param {string} text - The text containing code blocks
     * @returns {Array} Array of code block objects {code, language}
     */
    function extractCodeBlocks(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        const codeBlocks = [];
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            codeBlocks.push({
                language: match[1] || 'text',
                code: match[2].trim()
            });
        }

        return codeBlocks;
    }

    /**
     * Highlight mentions (@username) in text
     * @param {string} text - The text containing mentions
     * @returns {string} Text with highlighted mentions
     */
    function highlightMentions(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        // Replace @mentions with highlighted spans
        return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    }

    // ============================================================================
    // Utility Functions
    // ============================================================================

    /**
     * Get formatted message length (accounts for HTML tags)
     * @param {string} text - The text to measure
     * @returns {number} Character count without HTML tags
     */
    function getFormattedLength(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }

        // Remove HTML tags and entities for accurate count
        const plainText = text
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&[^;]+;/g, 'x'); // Replace entities with single char

        return plainText.length;
    }

    /**
     * Truncate text to a maximum length
     * @param {string} text - The text to truncate
     * @param {number} maxLength - Maximum character length
     * @param {string} suffix - Suffix to add when truncated (default: '...')
     * @returns {string} Truncated text
     */
    function truncateText(text, maxLength, suffix = '...') {
        if (!text || typeof text !== 'string' || text.length <= maxLength) {
            return text;
        }

        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Remove special formatting tags from text
     * @param {string} text - The text to clean
     * @returns {string} Cleaned text
     */
    function removeFormattingTags(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        return text
            .replace(/\[Hidden\]/g, '')
            .replace(/\[Starter\]/g, '')
            .replace(/\[Narrator\]/g, '')
            .replace(/\[Image\]/gi, '')
            .replace(/\[Video\]/gi, '')
            .replace(/\[MergeFace\]/gi, '')
            .replace(/\[user\]\s*/g, '')
            .replace(/\[context\]\s*/g, '')
            .trim();
    }

    // ============================================================================
    // Public API
    // ============================================================================

    return {
        // Formatting
        formatMessage,
        formatMarkdown,
        formatPlainText,
        formatCodeBlock,
        formatMessageText: formatMessageTextLegacy,
        
        // Sanitization
        sanitizeInput,
        escapeHtml,
        removeFormattingTags,
        
        // Extraction & Analysis
        extractCodeBlocks,
        highlightMentions,
        getFormattedLength,
        truncateText
    };
})();

// Make it available globally
window.ChatMessageFormatter = ChatMessageFormatter;
