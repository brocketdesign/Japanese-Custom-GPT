window.showNotification = (message, type = 'info') => {
    if (!message || typeof message !== 'string' || message.trim() === '' || message == 'undefined') {
        console.warn('Invalid message for notification:', message);
        return;
    }

    // Create toast container if it doesn't exist
    const createToastContainer = () => {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
        return container;
    };

    const toastContainer = document.getElementById('toastContainer') || createToastContainer();

    const toastId = 'toast-' + Date.now();
    const iconMap = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-triangle-fill',
        warning: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill'
    };

    const typeClass = `notification-${type}`;
    const icon = iconMap[type] || iconMap.info;

    const toastHTML = `
        <div id="${toastId}" class="toast notification-toast ${typeClass}" 
             role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-body">
                <i class="bi ${icon}"></i>
                <div class="notification-message">${message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);

    // Ensure notifications.css is loaded
    if (!document.querySelector('link[href*="notifications.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/notifications.css';
        document.head.appendChild(link);
    }

    const toastElement = document.getElementById(toastId);

    // Add showing animation
    setTimeout(() => {
        toastElement.classList.add('showing');
    }, 10);

    // Limit the number of visible notifications (keep max 2)
    const existingToasts = toastContainer.querySelectorAll('.notification-toast:not(.hiding)');
    if (existingToasts.length > 2) {
        const oldestToast = existingToasts[0];
        oldestToast.classList.add('hiding');
        setTimeout(() => {
            if (oldestToast.parentNode) {
                oldestToast.remove();
            }
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
                <i class="bi ${type === 'video' ? 'bi-camera-video-fill' : type === 'image' ? 'bi-image-fill' : 'bi-bell-fill'} me-2"></i>
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
            // Check if link is for modal view (contains #modal)
            if (link.includes('#modal:')) {
                const modalData = link.split('#modal:')[1];
                const [contentType, contentId] = modalData.split('/');
                
                // Open content modal if history-gallery.js is loaded
                if (window.historyGallery && window.historyGallery.openContentModal) {
                    // Navigate to history page if not already there
                    if (!window.location.pathname.includes('/history')) {
                        window.location.href = `/history?openModal=${contentType}/${contentId}`;
                    } else {
                        // Open modal directly
                        window.historyGallery.openContentModal({
                            _id: contentId,
                            contentType: contentType
                        });
                    }
                } else {
                    // Fallback: navigate to history with modal param
                    window.location.href = `/history?openModal=${contentType}/${contentId}`;
                }
            } else {
                // Regular link navigation
                window.location.href = link;
            }
        } else {
            console.log('Notification marked as viewed.');
        }
    }).fail((err) => {
        console.error('Error updating notification:', err);
    });
}