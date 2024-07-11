
$(document).ready(function() {

  const buttonsData = [
        {
            title: "お問い合わせフォーム",
            role: "このチャットボットは、ユーザーの問い合わせに対応し、必要な情報を収集する役割を果たします。",
            tone: "丁寧で親切な対応",
            thumbnailUrl: "https://mdbootstrap.com/img/new/avatars/1.jpg"
        },
        {
            title: "クイズ",
            role: "このチャットボットは、ユーザーにクイズを出題し、楽しませる役割を果たします。",
            tone: "明るく、楽しいトーン",
            thumbnailUrl: "https://mdbootstrap.com/img/new/avatars/2.jpg"
        },
        {
            title: "AIガールフレンド",
            role: "このチャットボットは、ユーザーと対話し、仮想のガールフレンドのような役割を果たします。",
            tone: "優しく、思いやりのあるトーン",
            thumbnailUrl: "https://mdbootstrap.com/img/new/avatars/3.jpg"
        },
        {
            title: "健康アドバイザー",
            role: "このチャットボットは、ユーザーに健康に関するアドバイスを提供し、健康管理をサポートします。",
            tone: "専門的で信頼できるトーン",
            thumbnailUrl: "https://mdbootstrap.com/img/new/avatars/4.jpg"
        },
        {
            title: "旅行ガイド",
            role: "このチャットボットは、ユーザーに旅行のおすすめスポットやプランを提案する役割を果たします。",
            tone: "親しみやすく、エキサイティングなトーン",
            thumbnailUrl: "https://mdbootstrap.com/img/new/avatars/5.jpg"
        },
        {
            title: "精神的なサポート",
            role: "このチャットボットは、ユーザーに心のケアや精神的なサポートを提供する役割を果たします。",
            tone: "落ち着いていて、慰めるようなトーン",
            thumbnailUrl: "https://mdbootstrap.com/img/new/avatars/6.jpg"
        }
    ];

    const buttonContainer = $('#button-container');

    buttonsData.forEach(button => {
        const card = $('<div>', {
            class: 'card chat-card flex-row bg-light border-0 me-3 py-2 shadow-0',
            css: {
                borderRadius: '20px',
                cursor: 'pointer'
            }
        });

        const thumbnailDiv = $('<div>', {
            css: {
                minWidth: '100px',
                width: '100px',
                height: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }
        });

        const thumbnailImg = $('<img>', {
            src: button.thumbnailUrl,
            class: 'img-fluid m-3',
            alt: 'Thumbnail',
            onerror: "this.src='/img/logo.webp';",
            css: {
                width: '50px',
                height: '50px',
                objectFit: 'cover',
                borderRadius: '50px'
            }
        });

        const cardBody = $(`<div style="width:300px;" class="pt-2" onclick="window.location.href='/chat/edit/?userMessage=${button.title}.${button.role}&chatImage=${button.thumbnailUrl}'">`, { class: 'card-body' });

        const cardTitle = $('<h6>', {
            class: 'card-title fw-bold',
            text: button.title
        });

        const cardText = $('<p>', {
            class: 'card-text template',
            text: button.role
        });

        const textMuted = $('<p>', {
            class: 'text-muted d-none',
            html: '<i class="fas fa-clock"></i> 更新:'
        });

        thumbnailDiv.append(thumbnailImg);
        cardBody.append(cardTitle, cardText, textMuted);
        card.append(thumbnailDiv, cardBody);
        buttonContainer.append(card);
    });

    const chatbotInfos = [
        {
            "title": "数学の達人",
            "name": "佐藤一郎",
            "category": "教育",
            "premium": false,
            "role": "数学の問題を解いたり、概念を説明することができます。",
            "tone": "フレンドリーで親切",
            "thumbnailUrl": "https://mdbootstrap.com/img/new/avatars/7.jpg"
        },
        {
            "title": "歴史探検家",
            "name": "田中花子",
            "category": "教育",
            "premium": true,
            "role": "歴史の出来事や人物について教えます。",
            "tone": "情熱的で詳しい",
            "thumbnailUrl": "https://mdbootstrap.com/img/new/avatars/6.jpg"
        },
        {
            "title": "英語のガイド",
            "name": "山本太郎",
            "category": "教育",
            "premium": false,
            "role": "英語の文法や会話を練習するのを手助けします。",
            "tone": "励ましとサポート",
            "thumbnailUrl": "https://mdbootstrap.com/img/new/avatars/5.jpg"
        },
        {
            "title": "科学の探求者",
            "name": "鈴木美咲",
            "category": "教育",
            "premium": true,
            "role": "科学の原理や最新の科学研究について解説します。",
            "tone": "知的で興味深い",
            "thumbnailUrl": "https://mdbootstrap.com/img/new/avatars/8.jpg"
        }

    ];

    chatbotInfos.forEach(chatbot => {
            const chatbotCard = `
                <div class="col-12 col-md-9 col-lg-7 col-xl-6 mb-4">
                    <div class="card shadow-0" style="border-radius: 15px;" >
                        <div class="card-body bg-light p-4">
                            <div class="row">
                                <div class="col-12 col-sm-6">
                                    <img src="${chatbot.thumbnailUrl}" alt="Generic placeholder image" class="img-fluid" style="width: 180px; border-radius: 10px;">
                                </div>
                                <div class="col-12 col-sm-6">
                                    <h5 class="my-1">${chatbot.title}</h5>
                                    <p class="mb-1 pb-1">${chatbot.role}</p>
                                    <div class="d-flex justify-content-start rounded-3 p-1 mb-2 bg-body-tertiary">
                                        <div>
                                            <p class="small text-muted mb-1">名前</p>
                                            <p class="mb-0">${chatbot.name}</p>
                                        </div>
                                        <div class="px-3">
                                            <p class="small text-muted mb-1">カテゴリー</p>
                                            <p class="mb-0">${chatbot.category}</p>
                                        </div>
                                    </div>
                                    <div class="d-flex pt-1">
                                        <button type="button" class="btn btn-outline-dark shadow-0 flex-grow-1" 
                                            onclick="window.location.href='/chat/edit/?userMessage=${encodeURIComponent(`${chatbot.name}は${chatbot.title}.${chatbot.role}`)}&chatCategory=${chatbot.category}&chatImage=${chatbot.thumbnailUrl}'">
                                            チャット
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            $('#chatbot-container').append(chatbotCard);
        });

    const categories = ["教育", "エンターテインメント", "テクノロジー", "健康", "ライフスタイル", "旅行", "ビジネス", "スポーツ", "音楽", "アート","VTuber", "ゲームキャラクター", "アニメキャラクター", "声優", "漫画キャラクター", "映画キャラクター", "ファンタジーキャラクター", "スーパーヒーロー", "ロボット", "妖精", "神話キャラクター", "忍者", "海賊", "冒険者", "ドラゴン"];

    $(document).ready(function() {
        categories.forEach(category => {
            const categoryButton = `<button type="button" class="btn btn-light category-button" onclick="window.location.href='/chat/edit/?userMessage=${category}'">${category}</button>`;
            $('#category-container').append(categoryButton);
        });
    });

    // Sample data array
    var cardData = [
        {
            image: "avatar_img1.jpeg",
            title: "さくら",
            description: "さくらは、勉強熱心な高校生で、いつも明るく前向きです。彼女は友達と一緒に過ごすことが大好きで、将来は教師になることを夢見ています。"
        },
        {
            image: "avatar_img2.jpeg",
            title: "木村樹夫",
            description: "木村樹夫は、環境保護に熱心な弁護士で、自然を愛する心を持っています。彼は木々と対話できる能力を持ち、その知識を使って環境保護のために戦っています。"
        },
        {
            image: "avatar_img3.jpeg",
            title: "ルシファー",
            description: "ルシファーは、人間界と魔界の両方で活躍する魔界のプリンセスです。彼女は知識と魔法の力を使って、どちらの世界にも平和をもたらそうと努力しています。"
        },
        {
            image: "avatar_img4.jpeg",
            title: "ミミ",
            description: "ミミは、冒険好きな発明家のネズミです。彼女は新しい発明を作り出すのが得意で、仲間と一緒に楽しい冒険に出かけるのが好きです。"
        },
        // Add more objects as needed
    ];

    // Function to create a card
    function createCard(data) {
        var card = `
            <div class="col-12 col-sm-3 mb-4">
                <div class="card shadow-0 bg-light">
                    <img src="/img/${data.image}" class="card-img-top" alt="${data.title}">
                    <div class="card-body">
                        <h5 class="card-title">${data.title}</h5>
                        <p class="card-text">${data.description}</p>
                        <button class="btn btn-outline-dark w-100" onclick='handleClick(${JSON.stringify(data)}, "${data.image}")'>
                            チャット
                        </button>
                    </div>
                </div>
            </div>
        `;
        return card;
    }

    // Function to render the grid of cards
    function renderCardGrid(dataArray) {
        var cardGrid = "";
        for (var i = 0; i < dataArray.length; i++) {
            cardGrid += createCard(dataArray[i]);
        }
        $("#cardGrid").html(cardGrid);
    }

    // Call the render function with the sample data
    renderCardGrid(cardData);
});
  // Function to save data to local storage
    function saveData(data) {
        localStorage.setItem('savedData', JSON.stringify(data));
    }
    // Function to handle the onclick event
    function handleClick(data, chatbotImage) {
        // Save data to local storage
        saveData(data);

        // Redirect with URL parameters
        var encodedMessage = encodeURIComponent(`${data.title}は${data.description}`);
        window.location.href = `/chat/edit/?userMessage=${encodedMessage}&chatImage=/img/${chatbotImage}`;
    }