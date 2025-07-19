window.showNotification = (message, type = 'info') => {
    if (!message || typeof message !== 'string' || message.trim() === '' || message == 'undefined') {
        console.warn('Invalid message for notification:', message);
        return;
    }

    // Create toast container if it doesn't exist
    const createToastContainer = () => {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'position-fixed start-50 translate-middle-x d-flex flex-column align-items-center';
        container.style.zIndex = '1060';
        container.style.top = '20px';
        container.style.right = '20px'; // Changed from top to right for better stacking
        container.style.maxWidth = '380px';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
        return container;
    };

    const toastContainer = document.getElementById('toastContainer') || createToastContainer();

    const toastId = 'toast-' + Date.now();
    const iconMap = {
        success: 'bi-check-circle-fill text-success',
        error: 'bi-exclamation-triangle-fill text-danger',
        warning: 'bi-exclamation-circle-fill text-warning',
        info: 'bi-info-circle-fill text-info'
    };

    const borderMap = {
        success: 'border-success',
        error: 'border-danger',
        warning: 'border-warning',
        info: 'border-info'
    };

    const icon = iconMap[type] || iconMap.info;
    const borderClass = borderMap[type] || borderMap.info;

    const toastHTML = `
        <div id="${toastId}" class="toast bg-white text-dark rounded-pill shadow-lg border ${borderClass} notification-toast" 
             role="alert" aria-live="assertive" aria-atomic="true" 
             style="width: 100%; opacity: 0; transform: translateY(20px); border-left-width: 4px !important; pointer-events: all; margin-bottom: 8px;">
            <div class="toast-body d-flex align-items-center py-3 px-3">
                <i class="bi ${icon} me-2 fs-5"></i>
                <div class="flex-grow-1">${message}</div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);

    // Add CSS for notification styling and stacking animation
    if (!document.getElementById('notification-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'notification-styles';
        styleEl.innerHTML = `
            #toastContainer {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                padding: 10px;
                gap: 4px;
                max-width: 380px;
            }
            
            .notification-toast {
                transition: all 0.4s ease-in-out;
                opacity: 0;
                transform: translateY(20px);
                will-change: transform, opacity;
            }
            
            /* Slide in animation */
            .notification-toast.showing {
                animation: slideIn 0.3s ease forwards;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Fade out animation */
            .notification-toast.hiding {
                animation: fadeOut 0.3s ease forwards;
            }
            
            @keyframes fadeOut {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(20px);
                }
            }
            
            /* Hover effect for better interaction */
            .notification-toast:hover {
                transform: translateY(0) scale(1.02) !important;
                opacity: 1 !important;
                z-index: 1070 !important;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
            }

            /*Min width 80vw on mobile */
            @media (max-width: 767.98px) {
                .notification-toast {
                    min-width: 80vw;
                }
            }
        `;
        document.head.appendChild(styleEl);
    }

    const toastElement = document.getElementById(toastId);

    // Calculate the stacking offset
    const existingToasts = toastContainer.querySelectorAll('.notification-toast');
    const stackOffset = existingToasts.length * 5; // Reduced from 10 to 5 for closer spacing

    // Apply initial animation and stacking offset
    toastElement.style.transform = `translateY(${stackOffset + 20}px)`;
    setTimeout(() => {
        toastElement.classList.add('showing');
        toastElement.style.transform = `translateY(${stackOffset}px)`;
        toastElement.style.opacity = 1;
    }, 50);

    // Limit the number of visible notifications (keep max 2)
    if (existingToasts.length >= 2) {
        const oldestToast = existingToasts[0];
        oldestToast.classList.add('hiding');
        setTimeout(() => {
            if (oldestToast.parentNode) {
                oldestToast.remove();
            }
            // Adjust the stacking of remaining notifications
            adjustStacking(toastContainer);
        }, 300);
    }

    // Initialize Bootstrap Toast
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000
    });

    toast.show();

    // Custom hide function with fade out animation
    const hideToast = () => {
        toastElement.classList.add('hiding');
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.remove();
            }
            // Adjust the stacking of remaining notifications
            adjustStacking(toastContainer);
        }, 300);
    };

    // Handle close button click
    toastElement.querySelector('.btn-close').addEventListener('click', (e) => {
        e.preventDefault();
        hideToast();
    });

    // Auto-hide after delay
    setTimeout(() => {
        if (toastElement.parentNode && !toastElement.classList.contains('hiding')) {
            hideToast();
        }
    }, 5000);

    // Function to adjust the stacking of notifications
    function adjustStacking(container) {
        const toasts = container.querySelectorAll('.notification-toast:not(.hiding)');
        toasts.forEach((toast, index) => {
            const newOffset = index * 5; // Reduced from 10 to 5 for closer spacing
            toast.style.transform = `translateY(${newOffset}px)`;
        });
    }
};

window.debugNotifications = function() {
    const types = ['success', 'error', 'warning', 'info', 'success'];
    const messages = [
        'Success notification (debug)',
        'Error notification (debug)',
        'Warning notification (debug)',
        'Info notification (debug)',
        'Another success notification (debug)'
    ];
    types.forEach((type, i) => {
        setTimeout(() => {
            window.showNotification(messages[i], type);
        }, i * 1000);
    });
    return 'Debug notifications started!';
};

function getUnviewedNotifications(userId) {
    return $.ajax({
        url: `/users/${userId}/notifications?viewed=false`,
        method: 'GET',
        dataType: 'json'
    }).fail((err) => {
        console.error('Error fetching unviewed notifications:', err);
    });
}

// Display unread notifications
function displayNotifications(userId) {
    getUnviewedNotifications(userId)
        .done((notifications) => {
            $('.notifications-menu').empty();
            notifications.forEach((notification) => {
                addNotification(notification);
            });
        })
        .fail((err) => {
            console.error(err);
        });
}
//　Display notifications
window.addNotification = function(notification) {
    const { _id, title, message, type, createdAt } = notification;
    const link = notification.data.link || '#';
    const dropdown = $('.notifications-menu');
    // time as a string like "2 hours ago" in the user's local timezone and language
    const time = moment(createdAt).locale(lang).fromNow();
    const notificationItem = `
        <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true" data-title="${title}" data-type="${type}" data-message="${message}" data-link="${link}">
            <div class="toast-header">
                <strong class="me-auto">${title}</strong>
                <small class="text-muted">${time}</small>
            </div>
            <div class="toast-body custom-gradient-bg" style="border-radius: 0 0 3px 3px;" onclick="updateNotificationViewedAndRedirect('${_id}','${link}')">
                ${message}
            </div>
        </div>`;
    dropdown.prepend(notificationItem);

    updateNotificationCount(dropdown.children().length);
}


$('#notificationIcon').on('click', function() {
    const userId = $(this).data('userid');
    displayNotifications(userId);
});

window.updateNotificationCount = function(count) {
    let badge = $('#notificationCount');
    if (count == 0) {
        $('#notificationIcon').remove();
        return;
    }
    if (badge.length === 0) {
        $('#notificationIcon .btn').append(`<span style="top:5px;left:10px;" class="position-absolute translate-middle badge rounded-pill bg-danger" id="notificationCount">${count}</span>`);
    } else {
        if (count > 0) {
            badge.text(count).show();
        } else {
            badge.hide();
        }
    }
}

// Update count on page load
$(document).ready(function() {
    const userId = user._id;
    window.updateNotificationCountOnLoad(userId);
});

window.updateNotificationCountOnLoad = function(userId) {
    getUnviewedNotifications(userId)
        .done((notifications) => {
            updateNotificationCount(notifications.length);
        })
        .fail((err) => {
            console.error(err);
        });
}

window.updateNotificationViewedAndRedirect = function(notificationId, link) {
    $.ajax({
        url: `/notifications/viewed/${notificationId}`,
        method: 'PUT',
        dataType: 'json'
    }).done(() => {
        if (link && link !== '#') {
            window.location.href = link;
        } else {
            console.log('Notification marked as viewed.');
        }
    }).fail((err) => {
        console.error('Error updating notification:', err);
    });
}