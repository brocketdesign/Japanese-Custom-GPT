$(document).ready(function() {
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');
    const priceId = urlParams.get('priceId');
    const paymentFalse = urlParams.get('payment') == 'false';

    if (success === 'true' && sessionId) {
        $.ajax({
            url: '/plan/update-coins',
            method: 'POST',
            data: { sessionId, priceId },
            success: function(response) {
                if (response.success) {
                    Swal.fire({
                        position: 'top-end',
                        icon: 'success',
                        title: 'コインが無事に追加されました！',
                        showConfirmButton: false,
                        timer: 3000,
                        toast: true,
                        animation: false,
                        customClass: {
                            container: 'animate__animated animate__fadeOutUp animate__delay-3s',
                            title: 'swal2-custom-title',
                            popup: 'swal2-custom-popup'
                        },
                        showClass: {
                            popup: 'animate__animated animate__slideInRight'
                        },
                        hideClass: {
                            popup: 'animate__animated animate__slideOutRight'
                        }
                    });
                    updateCoins()
                } else {
                    console.error('Failed to update coins:', response.error);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error updating coins:', error);
            }
        });
    }
    if(paymentFalse){
        Swal.fire({
            position: 'top-end',
            icon: 'error',
            title: 'お支払いは行われませんでした。',
            showConfirmButton: false,
            timer: 3000,
            toast: true,
            animation: false,
            customClass: {
                container: 'animate__animated animate__fadeOutUp animate__delay-3s',
                title: 'swal2-custom-title',
                popup: 'swal2-custom-popup'
            },
            showClass: {
                popup: 'animate__animated animate__slideInRight'
            },
            hideClass: {
                popup: 'animate__animated animate__slideOutRight'
            }
        });
    }
        
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
            //imageUrl: imageUrl,
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

window.showCoinShop = function(el){
    if(el && $(el).hasClass('open')){
       return
    }
    if(el && !$(el).hasClass('open')){
        $(el).addClass('open')
    }
    Swal.fire({
        position: 'center',
        html: `
            <div class="container text-center">
                <div class="row justify-content-center">
                    <div class="col-12 mb-3">
                        <div class="p-3 rounded d-flex justify-content-between custom-gradient-bg">
                            <span class="fw-bold text-white">保有コイン</span>
                            <div>
                                <span>🪙</span>
                                <span class="fw-bold text-white float-end user-coins ms-2">0</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 my-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-1.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>100コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">手頃なコインパッケージ</p>
                                <button id="coins-set1" class="buycoin btn custom-gradient-bg w-100">¥200.0</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 my-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-2.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>550コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料コイン150枚付き</p>
                                <button id="coins-set2"  class="buycoin btn custom-gradient-bg w-100">¥800.0</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 mb-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-3.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>1200コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料コイン450枚付き</p>
                                <button id="coins-set3"  class="buycoin btn custom-gradient-bg w-100">¥1500.0</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 mb-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-4.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>2500コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料コイン1000枚付き</p>
                                <button id="coins-set4"  class="buycoin btn custom-gradient-bg w-100">¥3000.0</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: false,
        showConfirmButton: false,
        showCloseButton: true,
        allowOutsideClick: false,
        backdrop:false,
        customClass: {
            popup: 'swal2-card',
            content: 'p-0'
        },
        showClass: {
            popup: 'bg-light animate__animated animate__fadeInDown'
        },
        hideClass: {
            popup: 'bg-light animate__animated animate__fadeOutUp'
        },
        didOpen: () => {
            updateCoins();
            $(document).on('click','.buycoin', function() {
                const buttonId = this.id;
                initiateCheckout(buttonId);
            });
        },
        willClose: () => {

                if(el){
                    $(el).removeClass('open')
                }
        }
    });
    
}