/**
 * Gallery Like Button Functionality
 * Handles liking/favoriting characters from gallery cards
 * Supports double-tap on mobile devices
 */

// Double tap tracking
let lastTapTime = 0;
let lastTapTarget = null;

/**
 * Toggle character favorite status
 * @param {string} chatId - The character ID to favorite/unfavorite
 * @param {HTMLElement} button - The like button element
 */
window.toggleCharacterFavorite = function(chatId, button) {
    // Check if user is logged in
    const currentUser = window.user || {};
    const isTemporaryUser = !!currentUser.isTemporary;
    
    if (isTemporaryUser) {
        // Redirect to login for temporary users
        if (typeof openLoginForm === 'function') {
            openLoginForm();
        } else {
            window.location.href = '/login';
        }
        return;
    }
    
    // Check if Favorites module is available
    if (typeof Favorites === 'undefined') {
        console.error('[toggleCharacterFavorite] Favorites module not loaded');
        return;
    }
    
    // Get current state
    const isLiked = button.classList.contains('liked');
    const icon = button.querySelector('i');
    
    // Optimistic UI update
    if (isLiked) {
        button.classList.remove('liked');
        if (icon) {
            icon.classList.remove('bi-heart-fill');
            icon.classList.add('bi-heart');
        }
    } else {
        button.classList.add('liked');
        if (icon) {
            icon.classList.remove('bi-heart');
            icon.classList.add('bi-heart-fill');
        }
    }
    
    // Call the favorites API
    Favorites.toggleFavorite(chatId, function(response) {
        // Update UI based on actual response
        if (response && response.success) {
            const actualState = response.isFavorited;
            
            // Ensure UI matches actual state
            if (actualState) {
                button.classList.add('liked');
                if (icon) {
                    icon.classList.remove('bi-heart');
                    icon.classList.add('bi-heart-fill');
                }
            } else {
                button.classList.remove('liked');
                if (icon) {
                    icon.classList.remove('bi-heart-fill');
                    icon.classList.add('bi-heart');
                }
            }
        } else {
            // Revert optimistic update on error
            if (isLiked) {
                button.classList.add('liked');
                if (icon) {
                    icon.classList.remove('bi-heart');
                    icon.classList.add('bi-heart-fill');
                }
            } else {
                button.classList.remove('liked');
                if (icon) {
                    icon.classList.remove('bi-heart-fill');
                    icon.classList.add('bi-heart');
                }
            }
        }
    });
};

/**
 * Initialize like button states based on user favorites
 * Called after gallery cards are rendered
 */
window.initializeGalleryLikeStates = function() {
    // Check if user is logged in
    const currentUser = window.user || {};
    const isTemporaryUser = !!currentUser.isTemporary;
    
    if (isTemporaryUser || typeof Favorites === 'undefined') {
        return;
    }
    
    // Get all like buttons
    const likeButtons = document.querySelectorAll('.gallery-like-btn');
    const chatIds = Array.from(likeButtons).map(btn => btn.dataset.chatId).filter(Boolean);
    
    if (chatIds.length === 0) {
        return;
    }
    
    // Check favorite status for all visible characters
    Favorites.checkMultipleFavorites(chatIds, function(statusMap) {
        likeButtons.forEach(button => {
            const chatId = button.dataset.chatId;
            if (statusMap[chatId]) {
                button.classList.add('liked');
                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.remove('bi-heart');
                    icon.classList.add('bi-heart-fill');
                }
            }
        });
    });
};

/**
 * Handle double-tap on gallery cards (mobile)
 * Double-tap on the card itself to like
 */
function handleDoubleTap(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    const galleryCard = event.target.closest('.gallery-card');
    
    // Check if it's a double tap (within 300ms)
    if (tapLength < 300 && tapLength > 0 && lastTapTarget === galleryCard) {
        event.preventDefault();
        
        // Find the like button in this card
        if (galleryCard) {
            const likeButton = galleryCard.querySelector('.gallery-like-btn');
            if (likeButton) {
                const chatId = likeButton.dataset.chatId;
                toggleCharacterFavorite(chatId, likeButton);
                
                // Show visual feedback for double-tap
                showDoubleTapFeedback(galleryCard);
            }
        }
    }
    
    lastTapTime = currentTime;
    lastTapTarget = galleryCard;
}

/**
 * Show visual feedback when double-tap is detected
 * @param {HTMLElement} card - The gallery card element
 */
function showDoubleTapFeedback(card) {
    // Create a heart animation overlay
    const heart = document.createElement('div');
    heart.innerHTML = '<i class="bi bi-heart-fill"></i>';
    heart.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0);
        font-size: 60px;
        color: rgba(255, 255, 255, 0.9);
        z-index: 100;
        pointer-events: none;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        animation: doubleTapHeart 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    `;
    
    card.style.position = 'relative';
    card.appendChild(heart);
    
    // Remove the heart after animation
    setTimeout(() => {
        heart.remove();
    }, 600);
}

// Add CSS animation for double-tap feedback
if (!document.getElementById('double-tap-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'double-tap-animation-styles';
    style.textContent = `
        @keyframes doubleTapHeart {
            0% {
                transform: translate(-50%, -50%) scale(0);
                opacity: 0;
            }
            50% {
                transform: translate(-50%, -50%) scale(1.2);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(0.8);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Initialize event listeners when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize like states after gallery loads
    // Delay allows time for gallery cards to be rendered
    const GALLERY_INIT_DELAY = 500; // Wait for initial gallery render
    setTimeout(initializeGalleryLikeStates, GALLERY_INIT_DELAY);
    
    // Add double-tap listener for mobile devices
    if ('ontouchstart' in window) {
        document.addEventListener('touchend', handleDoubleTap, { passive: false });
    }
});

// Re-initialize when new cards are added (e.g., pagination)
// Use event-driven approach if possible, fallback to function wrapping
const PAGINATION_INIT_DELAY = 300; // Wait for new cards to be added to DOM

// Check if displayChats exists before wrapping
if (typeof window.displayChats === 'function') {
    const originalDisplayChats = window.displayChats;
    
    window.displayChats = function(...args) {
        // Call original function
        const result = originalDisplayChats.apply(this, args);
        
        // Initialize like states for new cards after DOM updates
        setTimeout(initializeGalleryLikeStates, PAGINATION_INIT_DELAY);
        
        return result;
    };
} else {
    console.warn('[gallery-like] displayChats function not found - like buttons may not initialize on pagination');
}
