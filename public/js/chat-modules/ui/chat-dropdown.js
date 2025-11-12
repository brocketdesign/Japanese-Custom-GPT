/**
 * Chat Dropdown Module
 * 
 * Handles dropdown menus for chat actions
 * - Message dropdown menu management
 * - Action selection
 * - Dropdown positioning
 * - Close on outside click
 * 
 * @module ChatDropdown
 */

window.ChatDropdown = (function() {
    'use strict';

    // Private state
    const dropdownState = {
        openDropdowns: new Map(),
        activeDropdown: null
    };

    /**
     * Create dropdown menu
     * @param {string} dropdownId - Unique dropdown identifier
     * @param {Array} actions - Action objects with { id, label, icon, handler }
     * @param {object} options - Additional options
     * @returns {HTMLElement} Dropdown element
     */
    function createDropdown(dropdownId, actions, options = {}) {
        const container = document.createElement('div');
        container.className = 'chat-dropdown-container';
        container.id = dropdownId;
        container.dataset.dropdownId = dropdownId;

        // Create dropdown menu
        const menu = document.createElement('div');
        menu.className = 'chat-dropdown-menu';
        menu.dataset.position = options.position || 'bottom-right';

        // Add actions
        actions.forEach(action => {
            const item = document.createElement('button');
            item.className = `chat-dropdown-item ${action.id || ''}`;
            item.dataset.action = action.id;
            item.innerHTML = `
                <span class="action-icon">${action.icon || ''}</span>
                <span class="action-label">${action.label || ''}</span>
            `;
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Call handler if provided
                if (typeof action.handler === 'function') {
                    action.handler(action, e);
                }
                
                // Emit event
                container.dispatchEvent(new CustomEvent('dropdownAction', {
                    detail: { action: action.id, data: action }
                }));
                
                // Close dropdown
                closeDropdown(dropdownId);
            });
            
            menu.appendChild(item);
        });

        container.appendChild(menu);

        // Store reference
        dropdownState.openDropdowns.set(dropdownId, {
            element: container,
            menu: menu,
            actions: actions
        });

        // Set up click outside to close
        setupClickOutside(dropdownId);

        return container;
    }

    /**
     * Open dropdown menu
     * @param {string} dropdownId - Dropdown identifier
     * @param {HTMLElement} trigger - Trigger element for positioning
     */
    function openDropdown(dropdownId, trigger) {
        // Close any open dropdowns
        closeAllDropdowns();

        const dropdown = dropdownState.openDropdowns.get(dropdownId);
        if (!dropdown) {
            console.warn(`[ChatDropdown] Dropdown not found: ${dropdownId}`);
            return;
        }

        const { element, menu } = dropdown;
        
        // Show menu
        element.classList.add('open');
        menu.style.display = 'block';

        // Position relative to trigger
        if (trigger) {
            positionDropdown(element, trigger, menu);
        }

        dropdownState.activeDropdown = dropdownId;
    }

    /**
     * Close dropdown menu
     * @param {string} dropdownId - Dropdown identifier
     */
    function closeDropdown(dropdownId) {
        const dropdown = dropdownState.openDropdowns.get(dropdownId);
        if (!dropdown) return;

        const { element, menu } = dropdown;
        element.classList.remove('open');
        menu.style.display = 'none';

        if (dropdownState.activeDropdown === dropdownId) {
            dropdownState.activeDropdown = null;
        }
    }

    /**
     * Close all open dropdowns
     */
    function closeAllDropdowns() {
        dropdownState.openDropdowns.forEach((dropdown, dropdownId) => {
            closeDropdown(dropdownId);
        });
    }

    /**
     * Position dropdown relative to trigger element
     * @param {HTMLElement} container - Dropdown container
     * @param {HTMLElement} trigger - Trigger element
     * @param {HTMLElement} menu - Dropdown menu
     */
    function positionDropdown(container, trigger, menu) {
        try {
            const triggerRect = trigger.getBoundingClientRect();
            const menuRect = menu.getBoundingClientRect();
            
            let top = triggerRect.bottom + 5;
            let left = triggerRect.right - menuRect.width;

            // Check if menu goes off right edge
            if (left + menuRect.width > window.innerWidth) {
                left = Math.max(5, triggerRect.left - menuRect.width + trigger.offsetWidth);
            }

            // Check if menu goes off bottom edge
            if (top + menuRect.height > window.innerHeight) {
                top = triggerRect.top - menuRect.height - 5;
            }

            menu.style.position = 'fixed';
            menu.style.top = `${top}px`;
            menu.style.left = `${left}px`;
            menu.style.zIndex = '10000';

        } catch (error) {
            console.error('[ChatDropdown] Error positioning dropdown:', error);
        }
    }

    /**
     * Set up click outside listener for dropdown
     * @param {string} dropdownId - Dropdown identifier
     */
    function setupClickOutside(dropdownId) {
        const handler = (event) => {
            const dropdown = dropdownState.openDropdowns.get(dropdownId);
            if (!dropdown) return;

            const { element } = dropdown;
            
            if (!element.contains(event.target)) {
                closeDropdown(dropdownId);
                document.removeEventListener('click', handler);
            }
        };

        // Add listener when dropdown opens
        const originalOpen = closeDropdown.bind(null, dropdownId);
        window.addEventListener('click', (event) => {
            if (dropdownState.activeDropdown === dropdownId) {
                handler(event);
            }
        });
    }

    /**
     * Create simple action menu for messages
     * @param {string} messageId - Message identifier
     * @param {object} actions - Available actions
     * @returns {HTMLElement} Action menu element
     */
    function createMessageActionMenu(messageId, actions = {}) {
        const defaultActions = {
            like: {
                id: 'like',
                label: 'Like',
                icon: '👍',
                handler: null
            },
            dislike: {
                id: 'dislike',
                label: 'Dislike',
                icon: '👎',
                handler: null
            },
            copy: {
                id: 'copy',
                label: 'Copy',
                icon: '📋',
                handler: null
            },
            regenerate: {
                id: 'regenerate',
                label: 'Regenerate',
                icon: '🔄',
                handler: null
            }
        };

        const mergedActions = { ...defaultActions, ...actions };
        const actionList = Object.values(mergedActions).filter(a => a !== null);

        return createDropdown(`message-menu-${messageId}`, actionList);
    }

    /**
     * Update dropdown actions
     * @param {string} dropdownId - Dropdown identifier
     * @param {Array} newActions - New action list
     */
    function updateDropdownActions(dropdownId, newActions) {
        const dropdown = dropdownState.openDropdowns.get(dropdownId);
        if (!dropdown) return;

        const { menu } = dropdown;
        menu.innerHTML = '';

        newActions.forEach(action => {
            const item = document.createElement('button');
            item.className = `chat-dropdown-item ${action.id || ''}`;
            item.dataset.action = action.id;
            item.innerHTML = `
                <span class="action-icon">${action.icon || ''}</span>
                <span class="action-label">${action.label || ''}</span>
            `;
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (typeof action.handler === 'function') {
                    action.handler(action, e);
                }
                
                menu.parentElement.dispatchEvent(new CustomEvent('dropdownAction', {
                    detail: { action: action.id, data: action }
                }));
                
                closeDropdown(dropdownId);
            });
            
            menu.appendChild(item);
        });

        dropdown.actions = newActions;
    }

    /**
     * Remove dropdown
     * @param {string} dropdownId - Dropdown identifier
     */
    function removeDropdown(dropdownId) {
        const dropdown = dropdownState.openDropdowns.get(dropdownId);
        if (!dropdown) return;

        const { element } = dropdown;
        element.remove();
        dropdownState.openDropdowns.delete(dropdownId);
    }

    /**
     * Check if dropdown is open
     * @param {string} dropdownId - Dropdown identifier
     * @returns {boolean}
     */
    function isDropdownOpen(dropdownId) {
        const dropdown = dropdownState.openDropdowns.get(dropdownId);
        return dropdown ? dropdown.element.classList.contains('open') : false;
    }

    /**
     * Get active dropdown ID
     * @returns {string} Active dropdown ID or null
     */
    function getActiveDropdown() {
        return dropdownState.activeDropdown;
    }

    /**
     * Clear all dropdowns
     */
    function clearAllDropdowns() {
        closeAllDropdowns();
        dropdownState.openDropdowns.clear();
    }

    // Public API
    return {
        createDropdown,
        createMessageActionMenu,
        openDropdown,
        closeDropdown,
        closeAllDropdowns,
        updateDropdownActions,
        removeDropdown,
        isDropdownOpen,
        getActiveDropdown,
        clearAllDropdowns,
        // Debugging
        logDropdownState: () => {
            console.log('[ChatDropdown] State:', {
                openCount: dropdownState.openDropdowns.size,
                activeDropdown: dropdownState.activeDropdown,
                dropdowns: Array.from(dropdownState.openDropdowns.keys())
            });
        }
    };
})();

// Module registration
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
    window.ChatCore.registerModule('ChatDropdown', window.ChatDropdown);
}
