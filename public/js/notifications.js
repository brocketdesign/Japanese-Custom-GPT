function getUnviewedNotifications(userId) {
    return $.ajax({
        url: `/users/${userId}/notifications?viewed=false`,
        method: 'GET',
        dataType: 'json'
    });
}

window.displayNotifications = function(userId) {
    getUnviewedNotifications(userId)
        .done(function(notifications) {
            const dropdown = $('.notifications-menu');
            dropdown.empty();
            if (notifications.length === 0) {
                dropdown.append(`<li class="dropdown-item">${window.translations.notifications.nothing}</li>`);
            } else {
                notifications.forEach(n => {
                    dropdown.append(`<li type="button" class="dropdown-item clickable" data-id="${n._id}" data-type="${n.type}" data-title="${n.title}" data-message="${n.message}">${n.title.slice(0.20) || n.message.slice(0.20)}</li>`);
                });
            }

            $('.clickable').on('click', function() {
                const notificationId = $(this).data('id');
                const title = $(this).data('title');
                const type = $(this).data('type');
                const message = $(this).data('message');

                Swal.fire({
                    title: title || 'Notification',
                    text: message,
                    icon: type,
                    showCancelButton: false,
                    showConfirmButton: false,
                    showCloseButton: true,
                    showClass: {
                        popup: 'animate__animated animate__fadeIn'
                    },
                    hideClass: {
                        popup: 'animate__animated animate__fadeOut'
                    }
                }).then(() => {
                    $.ajax({
                        url: `/notifications/${notificationId}/viewed`,
                        method: 'PUT',
                        success: function() {
                            $(`.dropdown-item[data-id="${notificationId}"]`).remove();
                            if ($('.notifications-menu').children().length === 0) {
                                $('.notifications-menu').append('<li class="dropdown-item">No new notifications</li>');
                            }
                            updateNotificationCount(userId);
                        },
                        error: function() {
                            showNotification('Failed to mark as viewed', 'error');
                        }
                    });
                });
            });
        })
        .fail(function() {
            showNotification('Failed to load notifications', 'error');
        });
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
