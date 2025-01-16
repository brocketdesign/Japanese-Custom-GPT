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