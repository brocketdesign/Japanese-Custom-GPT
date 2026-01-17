/**
 * Mobile Viewport Height Fix
 * 
 * Fixes the issue where 100vh includes browser UI on mobile devices,
 * causing modals and other elements to be cut off.
 * 
 * Sets a CSS variable --vh with the actual viewport height.
 */

(function() {
    'use strict';
    
    /**
     * Set the viewport height CSS variable
     */
    function setViewportHeight() {
        // Get the actual viewport height
        const vh = window.innerHeight * 0.01;
        
        // Set the CSS variable
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    // Set on load
    setViewportHeight();
    
    // Set on resize (debounced for performance)
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(setViewportHeight, 100);
    });
    
    // Set on orientation change
    window.addEventListener('orientationchange', function() {
        // Delay to ensure the viewport has updated
        setTimeout(setViewportHeight, 200);
    });
    
    // Set when modals are shown (Bootstrap 5)
    document.addEventListener('shown.bs.modal', function() {
        setViewportHeight();
    });
    
    // Also listen for modal show events (for compatibility)
    document.addEventListener('DOMContentLoaded', function() {
        // Recalculate when modals are opened
        const modals = document.querySelectorAll('.modal');
        modals.forEach(function(modal) {
            modal.addEventListener('shown.bs.modal', setViewportHeight);
        });
    });
    
    // Recalculate on focus (handles mobile browser UI changes)
    window.addEventListener('focus', setViewportHeight);
    
    // Recalculate on scroll (handles mobile browser UI changes)
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(setViewportHeight, 150);
    }, { passive: true });
})();
