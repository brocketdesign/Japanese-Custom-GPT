$(document).ready(function() {
    $('#logout.nav-link').on('click', function(event) {
        event.preventDefault();
        $.ajax({
            url: '/user/logout',
            type: 'POST',
            success: function(response) {
                Swal.fire({
                    title: '成功',
                    text: response.status,
                    icon: 'success'
                }).then(() => {
                    window.location.href = '/authenticate';
                });
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
});