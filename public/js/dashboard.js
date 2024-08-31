$(document).ready(function() {
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');
    const priceId = urlParams.get('priceId');
    const paymentFalse = urlParams.get('payment') == 'false';
    const user = JSON.parse(localStorage.getItem('user'))
    const isTemporary = !!user.isTemporary
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
            case 'unlock-nsfw':
                messageTitle = '⚠️ 成人向けンテンツの利用にはアップグレードが必要です';
                messageText = '成人向けコンテンツを生成するには、有料プランにアップグレードしてください。';
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
        
    $(document).on('click', '.persona', function(e) {
        e.stopPropagation();
        e.preventDefault();
        const isTemporary = !!user.isTemporary
        if(isTemporary){ showRegistrationForm(); return; }
        const $this = $(this)
        $this.toggleClass('on');
        const $icon = $(this).find('i');
        const isAdding = $icon.hasClass('far');
        $icon.toggleClass('fas far');
        const personaId = $(this).data('id');

        $.post('/api/user/personas', { personaId: personaId, action: isAdding ? 'add' : 'remove' }, function() {
            const message = isAdding ? 'ペルソナが追加されました' : 'ペルソナが削除されました';
            const status = 'success';
            showNotification(message, status);
        }).fail(function(jqXHR) {
            const message = jqXHR.responseJSON && jqXHR.responseJSON.error 
                ? jqXHR.responseJSON.error 
                : (isAdding ? 'ペルソナの追加に失敗しました' : 'ペルソナの削除に失敗しました');
            const status = 'error';
            showNotification(message, status);
            $icon.toggleClass('fas far');
            $this.toggleClass('on');
        });

    });
    if(!isTemporary){
        const personas = user?.personas || false
        initializePersonaStats(personas)
    }
    

    $(document).on('click','.open-chat',function(){
        const chatId = $(this).data('id');
        window.location = '/chat/'+chatId
    })
});



function initializePersonaStats(personas) {

    if(personas){
        $('.persona').each(function() {
            const personaId = $(this).data('id');
            if (personas.includes(personaId)) {
                $(this).addClass('on')
                $(this).find('i').addClass('fas').removeClass('far');
            } else {
                $(this).removeClass('on')
                $(this).find('i').addClass('far').removeClass('fas');
            }
        });
    }
}
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
                                <p class="text-muted small mb-2" style="font-size:12px;">手頃なパッケージ</p>
                                <button id="coins-set1" class="buycoin btn custom-gradient-bg w-100">¥200</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 my-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-2.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>550コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料150枚付き</p>
                                <button id="coins-set2"  class="buycoin btn custom-gradient-bg w-100">¥800</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 mb-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-3.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>1200コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料450枚付き</p>
                                <button id="coins-set3"  class="buycoin btn custom-gradient-bg w-100">¥1500</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 mb-3">
                        <div class="card bg-dark text-white">
                            <div class="card-body p-2 d-flex flex-column">
                                <img src="/img/coins-4.png" alt="Coin" class="mb-2 m-auto" style="width: 100px;">
                                <h6>2500コイン</h6>
                                <p class="text-muted small mb-2" style="font-size:12px;">無料1000枚付き</p>
                                <button id="coins-set4"  class="buycoin btn custom-gradient-bg w-100">¥3000</button>
                            </div>
                        </div>
                    </div>
                </div>
                <span style="font-size: 12px;">安心・安全な決済方法: <a href="https://stripe.com/jp/resources/more/secure-payment-systems-explained" target="_blank"><img src="/img/stripe-logo.png" style="height: 30px;width: auto;"></a>を使用しています</span>
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
window.showPremiumPopup = function() {
    const features = [
        "毎日無制限でチャットできる",
        "フレンドを無制限で作成できる",
        "新しいキャラクターを作成する",
        "新機能への早期アクセス",
        "優先的なサポート対応"
    ];
    const messageTitle = '🚀 プレミアムプランで<br>体験をアップグレードしよう！';
    const messageText = `
        <div class="premium-offer" style="background-color: #fff3cd; border-radius: 10px; padding: 10px; margin-bottom: 15px;">
            <h6 style="color: #856404; font-weight: bold; text-align: center;">今なら登録するだけで<br><strong>1,000コイン</strong>をプレゼント！</h6>
        </div>
        <p style="font-size: 12px; text-align: center;">無制限の機能とエクスクルーシブな特典をお楽しみいただけます。<br>今すぐプレミアムプランに登録して、すべての機能を最大限に活用しましょう。</p>
        <ul class="premium-features" style="list-style-type: none; padding-left: 0; margin-bottom: 15px;">
            ${features.map(feature => `<li style="font-size: 14px; margin-bottom: 5px;"><span style="color: #f39c12;">🔥</span> ${feature}</li>`).join('')}
        </ul>
        <p style="font-size: 12px; text-align: center;">いつでもキャンセル可能、質問なしで対応いたします。<br>また、お支払いは <strong>最も安全なStripe</strong> で行われます。</p>
    `;

    // Display the first premium promotion popup using Swal.fire
    Swal.fire({
        //imageUrl: '/img/premium-promo.png', // Replace with your image URL
        imageWidth: '80%',
        imageHeight: 'auto',
        position: 'center',
        html: `
            <div class="container-0">
                <div class="row justify-content-center">
                    <div class="text-start">
                        <h5 class="fw-bold text-center">${messageTitle}</h5>
                        <div class="premium-content" style="background-color: #f8f9fa; border-radius: 10px; padding: 20px; box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);">
                            ${messageText}
                            <a href="/my-plan" class="btn btn-dark border-0 shadow-0 w-100 custom-gradient-bg mt-3" style="font-size: 16px; padding: 10px;">プレミアムプランを確認する</a>
                        </div>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: false,
        showConfirmButton: false,
        showCloseButton: true,
        animation: false,
        showClass: {
            popup: 'animate__animated animate__fadeIn'
        },
        hideClass: {
            popup: 'animate__animated animate__slideOutRight'
        },
        customClass: {
            popup: 'swal2-custom-popup animate__animated animate__fadeIn',
            closeButton: 'swal2-custom-close-button' 
        },
        didOpen: () => {
            // Initially hide the close button
            document.querySelector('.swal2-custom-close-button').style.display = 'none';

            // Show the close button after 5 seconds
            setTimeout(() => {
                $('.swal2-custom-close-button').fadeIn('slow')
            }, 3000);
        }
    }).then((result) => {
        if (result.dismiss) {
            // Display a secondary popup after the first one is closed
            Swal.fire({
                position: 'top-end',
                title: '<strong>プレミアムプランでさらに楽しもう！</strong>',
                html: `
                    <p style="font-size: 14px; margin-bottom: 10px;">今なら1,000コインをプレゼント中！</p>
                    <a href="/my-plan" class="btn btn-dark border-0 shadow-0 w-100 custom-gradient-bg" style="font-size: 14px; padding: 8px;">今すぐプレゼントを受け取る</a>
                `,
                showConfirmButton: false,
                showCloseButton: true,
                backdrop: false,
                allowOutsideClick: false,
                customClass: {
                    title: 'swal2-custom-title',
                    popup: 'swal2-custom-popup bg-light border border-dark',
                    content: 'swal2-custom-content',
                    closeButton: 'swal2-top-left-close-button',
                    popup: 'swal2-custom-popup animate__animated animate__fadeIn',
                },
                showClass: {
                    popup: 'animate__animated animate__fadeIn'
                },
                hideClass: {
                    popup: 'animate__animated animate__slideOutRight'
                },
            });
            
        }
        
        
    });
}
