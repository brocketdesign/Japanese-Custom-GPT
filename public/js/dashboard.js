$(document).ready(function() {
    $('#logout.nav-link').on('click', function(event) {
        event.preventDefault();
        $.ajax({
            url: '/user/logout',
            type: 'POST',
            success: function(response) {
                window.location.href = '/authenticate';
            },
            error: function() {
                Swal.fire({
                    title: 'エラー',
                    text: 'ログアウトに失敗しました',
                    icon: 'error'
                });
            }
        });
    });

    function checkAndRedirect() {
        var selectedChatId = localStorage.getItem('selectedChatId');
        
        if (selectedChatId) {
            localStorage.removeItem('selectedChatId');
            var currentUrl = window.location.href;
            var redirectUrl = '/chat/' + selectedChatId;
            
            if (currentUrl !== redirectUrl) {
                window.location.href = redirectUrl;
            }
        }
    }

    checkAndRedirect();
});