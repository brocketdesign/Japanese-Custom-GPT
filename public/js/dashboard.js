$(document).ready(function() {
    
    $(document).on('click', '.logout', function(event) {
        event.preventDefault();
        $.ajax({
            url: '/user/logout',
            type: 'POST',
            success: function(response) {
                window.location.href = '/';
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
    
/*
    $(document).find('input, textarea').each(function() {
        new mdb.Input(this);
    });
*/
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