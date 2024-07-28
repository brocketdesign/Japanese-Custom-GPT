
$(document).ready(function() {

  const buttonsData = [
    {
        "title": "お問い合わせフォーム",
        "role": "ユーザーの質問や要望を受け付け、適切な部署に転送する機能を持つチャットボットです。迅速な対応を促進し、顧客満足度を向上させます。",
        "tone": "丁寧で迅速な対応を行い、ユーザーの質問に対して正確な情報を提供します。",
        "thumbnailUrl": "/img/logo.webp"
    },
    {
        "title": "カスタマーサポート",
        "role": "製品やサービスに関するサポートを提供するチャットボットです。よくある質問に自動で回答し、複雑な問題についてはサポート担当者に引き継ぎます。",
        "tone": "親切かつプロフェッショナルなトーンで対応し、ユーザーの問題を解決します。",
        "thumbnailUrl": "/img/logo.webp"
    },
    {
        "title": "予約システム",
        "role": "ホテルやレストラン、イベントの予約を自動で管理するチャットボットです。空き状況の確認や予約の変更・キャンセルも簡単に行えます。",
        "tone": "スムーズで分かりやすい対応を行い、ユーザーがストレスなく予約を完了できるようサポートします。",
        "thumbnailUrl": "/img/logo.webp"
    },
    {
        "title": "フィードバック収集",
        "role": "顧客からのフィードバックや意見を収集し、企業の改善に役立てるチャットボットです。アンケート形式で回答を求め、結果を分析します。",
        "tone": "感謝の意を込めたトーンで対応し、ユーザーが率直な意見を述べやすい環境を提供します。",
        "thumbnailUrl": "/img/logo.webp"
    },
    {
        "title": "商品レコメンド",
        "role": "ユーザーの嗜好や過去の購入履歴に基づいて、最適な商品を推薦するチャットボットです。パーソナライズされた提案で購入を促進します。",
        "tone": "フレンドリーかつ親しみやすいトーンで対応し、ユーザーにとって魅力的な商品を紹介します。",
        "thumbnailUrl": "/img/logo.webp"
    }
];

    const buttonContainer = $('#button-container');
/*
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
    */
    const chatbotInfos = [
        {
            "name": "数学の達人",
            "title": "佐藤一郎",
            "category": "教育",
            "premium": false,
            "description": "数学の問題を解いたり、概念を説明することができます。",
            "tone": "フレンドリーで親切",
            "image": "avatar_math.webp",
            "chat_url": "/chat/669e2378660fa71cde114a14"
        },
        {
            "name": "歴史探検家",
            "title": "田中花子",
            "category": "教育",
            "premium": true,
            "description": "歴史の出来事や人物について教えます。",
            "tone": "情熱的で詳しい",
            "image": "avatar_history.webp",
            "chat_url": "/chat/669e23be3844c44f64de2d60"
        },
        {
            "name": "英語のガイド",
            "title": "山本太郎",
            "category": "教育",
            "premium": false,
            "description": "英語の文法や会話を練習するのを手助けします。",
            "tone": "励ましとサポート",
            "image": "avatar_english.webp",
            "chat_url": "/chat/669e23d8e4bb01d26191c1fe"
        },
        {
            "name": "科学の探求者",
            "title": "鈴木美咲",
            "category": "教育",
            "premium": true,
            "description": "科学の原理や最新の科学研究について解説します。",
            "tone": "知的で興味深い",
            "image": "avatar_science.webp",
            "chat_url": "/chat/669e2572e4bb01d26191c200"
        }

    ];
    /*
    chatbotInfos.forEach(chatbot => {
            const chatbotCard = `
                <div class="col-12 col-md-9 col-lg-7 col-xl-6 mb-4">
                    <div class="card shadow-0" style="border-radius: 15px;" >
                        <div class="card-body bg-light p-4">
                            <div class="row">
                                <div class="col-12 col-sm-6 text-center">
                                    <img src="${chatbot.thumbnailUrl}" alt="Generic placeholder image" class="img-fluid" style="width: 180px; border-radius: 10px;">
                                </div>
                                <div class="col-12 col-sm-6">
                                    <h5 class="my-1">${chatbot.title}</h5>
                                    <p class="mb-1 pb-1">${chatbot.role}</p>
                                    <div class="d-flex justify-content-around rounded-3 p-1 mb-2 bg-body-tertiary">
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
                                            onclick="window.location.href='${chatbot.chat_url}'">
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
    */
    const categories = ["教育", "エンターテインメント", "テクノロジー", "健康", "ライフスタイル", "旅行", "ビジネス", "スポーツ", "音楽", "アート","VTuber", "ゲームキャラクター", "アニメキャラクター", "声優", "漫画キャラクター", "映画キャラクター", "ファンタジーキャラクター", "スーパーヒーロー", "ロボット", "妖精", "神話キャラクター", "忍者", "海賊", "冒険者", "ドラゴン"];

    $(document).ready(function() {
        return
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
            description: "さくらは、勉強熱心な高校生で、いつも明るく前向きです。彼女は友達と一緒に過ごすことが大好きで、将来は教師になることを夢見ています。",
            chat_url:"/chat/669e230c4432593effe8195f"
        },
        {
            image: "avatar_img2.jpeg",
            title: "木村樹夫",
            description: "木村樹夫は、環境保護に熱心な弁護士で、自然を愛する心を持っています。彼は木々と対話できる能力を持ち、その知識を使って環境保護のために戦っています。",
            chat_url:"/chat/669e1f9be3d7cd2f0b46d5fb"
        },
        {
            image: "avatar_img3.jpeg",
            title: "ルシファー",
            description: "ルシファーは、人間界と魔界の両方で活躍する魔界のプリンセスです。彼女は知識と魔法の力を使って、どちらの世界にも平和をもたらそうと努力しています。",
            chat_url:"/chat/669e1fb6e3d7cd2f0b46d5fd"
        },
        {
            image: "avatar_img4.jpeg",
            title: "ミミ",
            description: "ミミは、冒険好きな発明家のネズミです。彼女は新しい発明を作り出すのが得意で、仲間と一緒に楽しい冒険に出かけるのが好きです。",
            chat_url:"/chat/669e1fd4e3d7cd2f0b46d5ff"
        },
        // Add more objects as needed
    ];
    var cardData2 = [
        {
            "image": "avatar2_img1.jpeg",
            "title": "さくら",
            "description": "さくらは、勉強熱心な高校生で、いつも明るく前向きです。彼女は友達と一緒に過ごすことが大好きで、将来は教師になることを夢見ています。",
            "chat_url":"/chat/66a5e952c13b1b2021a8558f"
        },
        {
            "image": "avatar2_img2.jpeg",
            "title": "ナナ",
            "description": "ナナは勇敢な女戦士で、正義を守るために戦います。彼女は強い意志と優れた戦闘能力を持ち、仲間を守るために全力を尽くします。",
            "chat_url":"/chat/66a5e983c13b1b2021a85591"
        },
        {
            "image": "avatar2_img3.jpeg",
            "title": "アリス",
            "description": "アリスは美しい赤毛の少女で、自然と動物を愛しています。彼女は優しい心を持ち、困っている人を助けることに喜びを感じます。",
            "chat_url":"/chat/66a5e9cdc13b1b2021a85593"
        },
        {
            "image": "avatar2_img4.jpeg",
            "title": "ミカ",
            "description": "ミカはエネルギッシュな若者で、冒険心が旺盛です。彼女は新しいことに挑戦するのが大好きで、常にポジティブなエネルギーに満ちています。",
            "chat_url":"/chat/66a5e9e2c13b1b2021a85595"
        },
        {
            "image": "avatar2_img5.jpeg",
            "title": "ウィズ",
            "description": "ウィズは魔法使いで、様々な魔法を使って人々を助けます。彼は親切で知識豊富な人物で、誰にでも助けの手を差し伸べます。",
            "chat_url":"/chat/66a5e9f6c13b1b2021a85597"
        },
        {
            "image": "ai_avatar_1.jpeg",
            "title": "桜井 花",
            "description": "桜井 花は優れた学力とスポーツセンスを兼ね備えた高校生です。彼女はクラスのリーダーであり、みんなに尊敬されています。",
            "chat_url":"/chat/66a5ea1549364af453743534"
        },
        {
            "image": "ai_avatar_4.jpeg",
            "title": "樹の精霊",
            "description": "樹の精霊は森の守護者であり、自然と調和した生活を送っています。彼は森の中で困っている生き物たちを助けます。",
            "chat_url":"/chat/66a5ea2a9563771b1fef582b"
        },
        {
            "image": "ai_avatar_5.jpeg",
            "title": "フェザー",
            "description": "フェザーは勇敢な戦士で、仲間を守るために戦います。彼は強い正義感を持ち、どんな困難にも立ち向かいます。",
            "chat_url":"/chat/66a5ea3f9563771b1fef582d"
        },
        {
            "image": "ai_avatar_6.jpeg",
            "title": "紅蓮",
            "description": "紅蓮は強力な炎の魔法を操る魔法使いです。彼女は自分の力をコントロールするために日々修行を重ねています。",
            "chat_url":"/chat/66a5ea5c9563771b1fef582f"
        },
        {
            "image": "ai_avatar_7.jpeg",
            "title": "宮本 さくら",
            "description": "宮本 さくらは空手の達人で、常に冷静沈着です。彼女は自分の信念を貫き、強く生きることを目指しています。",
            "chat_url":"/chat/66a5ea749563771b1fef5831"
        },
        {
            "image": "ai_avatar_9.jpeg",
            "title": "エルダーウィス",
            "description": "エルダーウィスは古代の知恵を持つ賢者です。彼は人々に知識と知恵を分け与え、導いています。",
            "chat_url":"/chat/66a5ea8d9563771b1fef5833"
        }
    ]
    
    // Function to create a card
    function createCard(data) {
        var card = $(`
            <div class="col-10 col-sm-3 mb-4">
                <div class="card shadow-0 bg-light" style="cursor: pointer;">
                    <img src="/img/${data.image}" class="card-img-top" alt="${data.title}">
                    <div class="card-body">
                        <h5 class="card-title">${data.title}</h5>
                        <p class="card-text">${data.description}</p>
                        <button class="btn btn-outline-dark w-100">
                            チャット
                        </button>
                    </div>
                </div>
            </div>
        `);
    
        card.find('button').on('click', function(event) {
            event.stopPropagation(); // Prevent the card click event from triggering
            window.location = data.chat_url;
        });
    
        return card;
    }

    // Function to render the grid of cards
    function renderCardGrid(dataArray, container) {
        for (var i = 0; i < dataArray.length; i++) {
            var card = createCard(dataArray[i]);
            container.append(card);
        }
    }
    const girls_avatar = [
        {
            "image": "ai_avatar_3.webp",
            "title": "青山 絵里",
            "description": "青山 絵里は明るく元気なメイドカフェで働く女の子です。彼女の笑顔はお客さんに元気を与えます。",
            "chat_url": '/chat/66a5be2d712375ae2fad2523'
        },
        {
            "image": "ai_avatar_2.webp",
            "title": "高橋 美咲",
            "description": "高橋 美咲は穏やかで自然を愛する大学生です。彼女はいつも笑顔で、周りの人々を癒しています。",
            "chat_url": '/chat/66a5befd72ad9f1f12b4266f'
        },
        {
            "image": "ai_avatar_8.webp",
            "title": "笑顔の天使",
            "description": "笑顔の天使はいつも周りの人々を笑顔にする力を持っています。彼女の存在はみんなに幸せをもたらします。",
            "chat_url": '/chat/66a5bf2740aacb265253a35d'
        },
        {
            "image": "avatar_girl_1.png",
            "title": "さくら",
            "description": "さくらは自然とアートについて話すのが好きです。趣味は絵を描くこととハイキングで、明るくて元気な性格です。",
            "chat_url": '/chat/669e1caea67062d868b41c4b'
        },
        {
            "image": "avatar_girl_2.webp",
            "title": "りん",
            "description": "りんは歴史と文学に興味があります。読書が趣味で、静かで落ち着いた性格です。",
            "chat_url": '/chat/669e1d16a67062d868b41c4d'
        },
        {
            "image": "avatar_girl_3.png",
            "title": "みどり",
            "description": "みどりはビジネスとファッションについて話すのが得意です。趣味はショッピングとヨガで、自信に満ちた性格です。",
            "chat_url": '/chat/669e1d2ea67062d868b41c4f'
        },
        {
            "image": "avatar_girl_4.jpeg",
            "title": "ゆき",
            "description": "ゆきは音楽と料理が好きです。趣味はピアノ演奏と新しいレシピの試作で、優しくて思いやりのある性格です。",
            "chat_url": '/chat/669e1d7aa67062d868b41c51'
        },
        {
            "image": "avatar_girl_5.webp",
            "title": "あかり",
            "description": "あかりは映画と旅行について話すのが好きです。趣味は映画鑑賞と冒険旅行で、好奇心旺盛な性格です。",
            "chat_url": '/chat/669e1d9ea67062d868b41c53'
        },
        {
            "image": "avatar_girl_6.jpg",
            "title": "まな",
            "description": "まなは科学とテクノロジーに興味があります。趣味はガジェットのレビューとプログラミングで、知的で探求心の強い性格です。",
            "chat_url": '/chat/669e1db3a67062d868b41c55'
        },
        {
            "image": "avatar_girl_7.jpg",
            "title": "ほのか",
            "description": "ほのかはスポーツとダンスが好きです。趣味はランニングとダンスレッスンで、エネルギッシュで活発な性格です。",
            "chat_url": '/chat/669e1dcca67062d868b41c57'
        }
    ]
    
    function renderCircleGrid(cardInfos,container){
        cardInfos.forEach(function(item) {
            var card = $(`
                <div class="card custom-card bg-transparent shadow-0 border-0 my-3 px-1 col-7 col-sm-4 col-lg-2" style="cursor:pointer;">
                    <div style="background-image:url(/img/${item.image})" class="card-img-top girls_avatar" alt="${item.title}"></div>
                    <div class="card-body bg-transparent border-0 pb-0 text-start">
                        <h5 class="card-title">${item.title}</h5>
                        <p class="card-text">${item.description}</p>
                    </div>
                </div>
            `);
        
            card.on('click', function() {
                window.location = item.chat_url;
            });
        
            container.append(card);
        });   
    }

    renderCircleGrid(girls_avatar,$('#custom-card-container'))
    renderCircleGrid(cardData,$("#cardGrid-2"))
    renderCircleGrid(cardData2,$('#cardGrid'))
    renderCircleGrid(chatbotInfos,$("#chatbot-container"));
    
});
  // Function to save data to local storage
    function saveData(data) {
        localStorage.setItem('savedData', JSON.stringify(data));
    }
    // Function to handle the onclick event
    function handleClick(data, chatbotImage) {
        // Save data to local storage
        saveData(data);
        const name = data.title || data.name
        // Redirect with URL parameters
        var encodedMessage = encodeURIComponent(`${name}は${data.description}`);
        window.location.href = `/chat/edit/?userMessage=${encodedMessage}&chatImage=/img/${chatbotImage}`;
    }