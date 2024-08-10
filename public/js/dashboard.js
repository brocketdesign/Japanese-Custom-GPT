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

    //checkAndRedirect();

    window.showUpgradePopup = function(limitType) {
        const redirectUrl = window.location.pathname
        $.cookie('redirect_url', redirectUrl);
    
        // Define messages based on limit type
        let messageTitle = '';
        let messageText = '';
        let imageUrl = '/img/login-bg-862c043f.png'; // replace with your image URL
    
        // Use switch-case to handle different types of limits
        switch (limitType) {
            case 'chat-message':
                messageTitle = '💬メッセージ制限に達しました';
                messageText = '無制限のメッセージをお楽しみいただくには、有料プランにご登録ください。';
                break;
            case 'chat-character':
                messageTitle = '🤗キャラクター制限に達しました';
                messageText = 'より多くのキャラクターと会話を楽しむには、有料プランにご登録ください。';
                break;
            case 'chat-private':
                messageTitle = '🔒 非公開設定にはアップグレードが必要です';
                messageText = 'プライベートチャット機能を利用するには、有料プランにアップグレードしてください。';
                break;
            case 'image-generation':
                messageTitle = '⚠️ 画像生成機能にはアップグレードが必要です';
                messageText = '画像生成機能を利用するには、有料プランにアップグレードしてください。';
                break;
            
            default:
                messageTitle = '制限に達しました';
                messageText = 'ご利用中のプランの制限に達しました。有料プランにアップグレードして、より多くの機能をお楽しみください。';
        }
        const features = [
            "毎日無制限でチャットできる",
            "フレンドを無制限で作成できる",
            "新しいキャラクターを作成する",
            "新機能への早期アクセス",
            "優先的なサポート対応"
          ]
        // Display the popup using Swal.fire
        Swal.fire({
            imageUrl: imageUrl,
            imageWidth: '100%',
            imageHeight: 'auto',
            position: 'bottom',
            html: `
                <div class="container">
                    <div class="row justify-content-center">
                        <div class="text-start">
                            <h5 class="fw-bold">${messageTitle}</h5>
                            <p class="text-muted mb-2 header" style="font-size: 16px;">${messageText}</p>
                            <ul class="list-group list-group-flush">
                                ${features.map(feature => `<li class="list-group-item px-0"><span class="me-2">🔥</span>${feature}</li>`).join('')}
                            </ul>
                            <a href="/my-plan" class="btn btn-dark border-0 w-100 custom-gradient-bg mt-3">有料プランを確認する</a>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: false,
            showConfirmButton: false,
            showCloseButton: true,
            allowOutsideClick: false,
            showClass: {
                popup: 'swal2-bottom-slide-in'
            },
            hideClass: {
                popup: 'swal2-bottom-slide-out'
            },
            customClass: {
                popup: 'animated fadeInDown'
            }
        }).then((result) => {
            if (result.dismiss) {
              $.removeCookie('redirect_url');
            }
          });
    }
});