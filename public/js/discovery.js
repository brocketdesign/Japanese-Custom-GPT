
$(document).ready(function() {


    const chatbotInfos = [
        {
            "name": "数学の達人",
            "title": "佐藤一郎",
            "category": "教育",
            "premium": false,
            "description": "数学の問題を解いたり、概念を説明することができます。",
            "tone": "フレンドリーで親切",
            "image": "avatar_math.webp",
            "chat_url": "/chat/669e2378660fa71cde114a14",
            num_message: "4.7万"
        },
        {
            "name": "歴史探検家",
            "title": "田中花子",
            "category": "教育",
            "premium": true,
            "description": "歴史の出来事や人物について教えます。",
            "tone": "情熱的で詳しい",
            "image": "avatar_history.webp",
            "chat_url": "/chat/669e23be3844c44f64de2d60",
            num_message: "8856"
        },
        {
            "name": "英語のガイド",
            "title": "山本太郎",
            "category": "教育",
            "premium": false,
            "description": "英語の文法や会話を練習するのを手助けします。",
            "tone": "励ましとサポート",
            "image": "avatar_english.webp",
            "chat_url": "/chat/669e23d8e4bb01d26191c1fe",
            num_message: "34.8万"
        },
        {
            "name": "科学の探求者",
            "title": "鈴木美咲",
            "category": "教育",
            "premium": true,
            "description": "科学の原理や最新の科学研究について解説します。",
            "tone": "知的で興味深い",
            "image": "avatar_science.webp",
            "chat_url": "/chat/669e2572e4bb01d26191c200",
            num_message: "3402"
        }

    ];

    var cardData = [
        {
            image: "avatar_img1.jpeg",
            title: "さくら",
            description: "さくらは、勉強熱心な高校生で、いつも明るく前向きです。彼女は友達と一緒に過ごすことが大好きで、将来は教師になることを夢見ています。",
            chat_url:"/chat/669e230c4432593effe8195f",
            num_message: "5.4万"
        },
        {
            image: "avatar_img2.jpeg",
            title: "木村樹夫",
            description: "木村樹夫は、環境保護に熱心な弁護士で、自然を愛する心を持っています。彼は木々と対話できる能力を持ち、その知識を使って環境保護のために戦っています。",
            chat_url:"/chat/669e1f9be3d7cd2f0b46d5fb",
            num_message: "2.2万"
        },
        {
            image: "avatar_img3.jpeg",
            title: "ルシファー",
            description: "ルシファーは、人間界と魔界の両方で活躍する魔界のプリンセスです。彼女は知識と魔法の力を使って、どちらの世界にも平和をもたらそうと努力しています。",
            chat_url:"/chat/669e1fb6e3d7cd2f0b46d5fd",
            num_message: "1.8万"
        },
        {
            image: "avatar_img4.jpeg",
            title: "ミミ",
            description: "ミミは、冒険好きな発明家のネズミです。彼女は新しい発明を作り出すのが得意で、仲間と一緒に楽しい冒険に出かけるのが好きです。",
            chat_url:"/chat/669e1fd4e3d7cd2f0b46d5ff",
            num_message: "2.7万"
        },
    ];
    var cardData2 = [
        {
            "image": "avatar2_img1.jpeg",
            "title": "さくら",
            "description": "さくらは、勉強熱心な高校生で、いつも明るく前向きです。彼女は友達と一緒に過ごすことが大好きで、将来は教師になることを夢見ています。",
            "chat_url":"/chat/66a5e952c13b1b2021a8558f",
            num_message: "12.2万"
        },
        {
            "image": "avatar2_img2.jpeg",
            "title": "ナナ",
            "description": "ナナは勇敢な女戦士で、正義を守るために戦います。彼女は強い意志と優れた戦闘能力を持ち、仲間を守るために全力を尽くします。",
            "chat_url":"/chat/66a5e983c13b1b2021a85591",
            num_message: "26.7万"
        },
        {
            "image": "avatar2_img3.jpeg",
            "title": "アリス",
            "description": "アリスは美しい赤毛の少女で、自然と動物を愛しています。彼女は優しい心を持ち、困っている人を助けることに喜びを感じます。",
            "chat_url":"/chat/66a5e9cdc13b1b2021a85593",
            num_message: "14.4万"
        },
        {
            "image": "avatar2_img4.jpeg",
            "title": "ミカ",
            "description": "ミカはエネルギッシュな若者で、冒険心が旺盛です。彼女は新しいことに挑戦するのが大好きで、常にポジティブなエネルギーに満ちています。",
            "chat_url":"/chat/66a5e9e2c13b1b2021a85595",
            num_message: "2.5万"
        },
        {
            "image": "avatar2_img5.jpeg",
            "title": "ウィズ",
            "description": "ウィズは魔法使いで、様々な魔法を使って人々を助けます。彼は親切で知識豊富な人物で、誰にでも助けの手を差し伸べます。",
            "chat_url":"/chat/66a5e9f6c13b1b2021a85597",
            num_message: "2.5万"
        },
        {
            "image": "ai_avatar_1.jpeg",
            "title": "桜井 花",
            "description": "桜井 花は優れた学力とスポーツセンスを兼ね備えた高校生です。彼女はクラスのリーダーであり、みんなに尊敬されています。",
            "chat_url":"/chat/66a5ea1549364af453743534",
            num_message: "1.4万"
        },
        {
            "image": "ai_avatar_4.jpeg",
            "title": "樹の精霊",
            "description": "樹の精霊は森の守護者であり、自然と調和した生活を送っています。彼は森の中で困っている生き物たちを助けます。",
            "chat_url":"/chat/66a5ea2a9563771b1fef582b",
            num_message: "84.5万"
        },
        {
            "image": "ai_avatar_5.jpeg",
            "title": "フェザー",
            "description": "フェザーは勇敢な戦士で、仲間を守るために戦います。彼は強い正義感を持ち、どんな困難にも立ち向かいます。",
            "chat_url":"/chat/66a5ea3f9563771b1fef582d",
            num_message: "31.5万"
        },
        {
            "image": "ai_avatar_6.jpeg",
            "title": "紅蓮",
            "description": "紅蓮は強力な炎の魔法を操る魔法使いです。彼女は自分の力をコントロールするために日々修行を重ねています。",
            "chat_url":"/chat/66a5ea5c9563771b1fef582f",
            num_message: "2.2万"
        },
        {
            "image": "ai_avatar_7.jpeg",
            "title": "宮本 さくら",
            "description": "宮本 さくらは空手の達人で、常に冷静沈着です。彼女は自分の信念を貫き、強く生きることを目指しています。",
            "chat_url":"/chat/66a5ea749563771b1fef5831",
            num_message: "62.1万"
        },
        {
            "image": "ai_avatar_9.jpeg",
            "title": "エルダーウィス",
            "description": "エルダーウィスは古代の知恵を持つ賢者です。彼は人々に知識と知恵を分け与え、導いています。",
            "chat_url":"/chat/66a5ea8d9563771b1fef5833",
            num_message: "2.1万"
        }
    ]
    
    const girls_avatar = [
        {
            "image": "ai_avatar_3.webp",
            "title": "青山 絵里",
            "description": "青山 絵里は明るく元気なメイドカフェで働く女の子です。彼女の笑顔はお客さんに元気を与えます。",
            "chat_url": '/chat/66a5be2d712375ae2fad2523',
            num_message: "76.3万"
        },
        {
            "image": "ai_avatar_2.webp",
            "title": "高橋 美咲",
            "description": "高橋 美咲は穏やかで自然を愛する大学生です。彼女はいつも笑顔で、周りの人々を癒しています。",
            "chat_url": '/chat/66a5befd72ad9f1f12b4266f',
            num_message: "42.5万"
        },
        {
            "image": "ai_avatar_8.webp",
            "title": "笑顔の天使",
            "description": "笑顔の天使はいつも周りの人々を笑顔にする力を持っています。彼女の存在はみんなに幸せをもたらします。",
            "chat_url": '/chat/66a5bf2740aacb265253a35d',
            num_message: "86.6万"
        },
        {
            "image": "avatar_girl_1.png",
            "title": "さくら",
            "description": "さくらは自然とアートについて話すのが好きです。趣味は絵を描くこととハイキングで、明るくて元気な性格です。",
            "chat_url": '/chat/669e1caea67062d868b41c4b',
            num_message: "23.3万"
        },
        {
            "image": "avatar_girl_2.webp",
            "title": "りん",
            "description": "りんは歴史と文学に興味があります。読書が趣味で、静かで落ち着いた性格です。",
            "chat_url": '/chat/669e1d16a67062d868b41c4d',
            num_message: "89.0万"
        },
        {
            "image": "avatar_girl_3.png",
            "title": "みどり",
            "description": "みどりはビジネスとファッションについて話すのが得意です。趣味はショッピングとヨガで、自信に満ちた性格です。",
            "chat_url": '/chat/669e1d2ea67062d868b41c4f',
            num_message: "16.1万"
        },
        {
            "image": "avatar_girl_4.jpeg",
            "title": "ゆき",
            "description": "ゆきは音楽と料理が好きです。趣味はピアノ演奏と新しいレシピの試作で、優しくて思いやりのある性格です。",
            "chat_url": '/chat/669e1d7aa67062d868b41c51',
            num_message: "46.4万"
        },
        {
            "image": "avatar_girl_5.webp",
            "title": "あかり",
            "description": "あかりは映画と旅行について話すのが好きです。趣味は映画鑑賞と冒険旅行で、好奇心旺盛な性格です。",
            "chat_url": '/chat/669e1d9ea67062d868b41c53',
            num_message: "55.5万"
        },
        {
            "image": "avatar_girl_6.jpg",
            "title": "まな",
            "description": "まなは科学とテクノロジーに興味があります。趣味はガジェットのレビューとプログラミングで、知的で探求心の強い性格です。",
            "chat_url": '/chat/669e1db3a67062d868b41c55',
            num_message: "74.5万"
        },
        {
            "image": "avatar_girl_7.jpg",
            "title": "ほのか",
            "description": "ほのかはスポーツとダンスが好きです。趣味はランニングとダンスレッスンで、エネルギッシュで活発な性格です。",
            "chat_url": '/chat/669e1dcca67062d868b41c57',
            num_message: "11.3万"
        }
    ]
    
    function renderCircleGrid(cardInfos,container){
        cardInfos.forEach(function(item) {
            var card = $(`
                <div class="card custom-card bg-transparent shadow-0 border-0 my-3 px-1 col-7 col-sm-4 col-lg-2 pb-3" style="cursor:pointer;">
                    <div style="background-image:url(${item.image.indexOf('http')>=0 ? item.image : `/img/${item.image}`})" class="card-img-top girls_avatar position-relative" alt="${item.title}">
                        <span class="badge bg-dark position-absolute" style="color: rgb(165 164 164);opacity:0.8; bottom:10px;left:10px"><i class="fas fa-comment me-2"></i>${item.num_message}</span>
                    </div>
                    <div class="card-body bg-transparent border-0 pb-0 text-start">
                        <h5 class="card-title character-title">${item.title}</h5>
                        <p class="card-text character-short-description">${item.description}</p>
                    </div>
                </div>
            `);
            card.on('click', function() {
                const chatId = item.chat_url.replace('/chat/','')
                //localStorage.setItem('selectedChatId', chatId);
                const userId = localStorage.getItem('userId');
                fetchchatData(chatId,userId)
                showChat()
               // window.location = item.chat_url;
            });
            container.append(card);
        });   
    }

    renderCircleGrid(girls_avatar,$('#custom-card-container'))
    renderCircleGrid(cardData,$("#cardGrid-2"))
    renderCircleGrid(cardData2,$('#cardGrid'))
    renderCircleGrid(chatbotInfos,$("#chatbot-container"));


    //Infinite scroll
    function renderInfiniteGrid(cardInfos,container){
        cardInfos.forEach(function(item) {
            var card = $(`
                <div class="card custom-card bg-transparent shadow-0 border-0 my-3 px-1 col-6 col-sm-4 col-lg-2 pb-3" style="cursor:pointer;">
                    <div style="background-image:url(${item.image.indexOf('http')>=0 ? item.image : `/img/${item.image}`})" class="card-img-top girls_avatar position-relative" alt="${item.title}">
                    </div>
                </div>
            `);
            card.on('click', function() {
                const redirectUrl = `/chat/edit/?chatImage=${encodeURIComponent(item.image)}`
                if($('body').data('temporary-user')){
                    $.cookie('redirect_url', redirectUrl);
                    window.open('/authenticate')
                    return
                }
                window.location = redirectUrl 
            });
            container.append(card);
        });   
    }
    var  currentPage  = 1;
    var isLoading = false;
    function loadNextPage() {
        if (isLoading) return;
        isLoading = true;
        const libraryInfo = JSON.parse(localStorage.getItem('chatbot-library'))
        if(!libraryInfo){
            return
        }
        const { category, modelId, name } = libraryInfo
        $('#chatbot-category-name').text(name)
        $('#chatbot-loading').show()
        $.ajax({
            type: 'GET',
            url: `/scraper/civitai?page=${currentPage}&category=${category}&modelId=${modelId}`,
            success: function(data) {
                $('#chatbot-loading').hide()
                renderInfiniteGrid(data.characters, $('#chatbot-library'));
                currentPage++;
                setTimeout(() => {
                    isLoading = false;
                }, 3000);
            },
            error: function(error) {
                console.log(error);
            }
        });
    }
    $(document).on('scroll',function(){
        $('#chatbot-library').waypoint(function() {
            loadNextPage();
          }, {
            offset: 'bottom-in-view'
          });    
    })
    // Dynamic Content Category
    
    function fetchAndRenderCategories() {
        // Make an API request to the '/scraper/civitai/categories' endpoint
        $.ajax({
            url: '/scraper/civitai/categories', // The endpoint URL
            method: 'GET', // HTTP method
            success: function(response) {
                // Clear the existing categories (if any)
                $('#chatbot-category').empty();

                // Check if the response contains categories
                if (response.status === 'Success' && response.categories) {
                    // Iterate over the categories and render each one
                    response.categories.forEach(category => {
                        // Construct the HTML for each category button
                        const categoryButton = `
                            <div type="button" class="chatbot-category-button col" data-name="${category.name}" data-id="${category.id}" data-category="${category.name}" onclick="libraryInfoUpdate(this)">
                                <img src="${category.image}" alt="${category.name}" class="border border-light">
                            </div>`;
                        // Append the category button to the container
                        $('#chatbot-category').append(categoryButton);
                    });
                } else {
                    // Handle the case when no categories are found
                    $('#chatbot-category').append('<p>No categories found.</p>');
                }
            },
            error: function(error) {
                // Handle errors
                console.error('An error occurred:', error);
                $('#chatbot-category').append('<p>Error fetching categories. Please try again later.</p>');
            }
        });
    }

    // Call the function to fetch and render categories
    fetchAndRenderCategories();
    
    window.libraryInfoUpdate = function(el) {
        const name = $(el).data('name')
        const category = $(el).data('category')
        const modelId = $(el).data('id')
        $('#chatbot-category-name').text(name)
        $('#chatbot-library').empty()
        currentPage = 1
        localStorage.setItem('chatbot-library',JSON.stringify({ category, modelId, name }))
        isLoading = false
        loadNextPage();
    };
    //Category Handle
    const categories = ["彼氏","彼女","ドミナント","服従的","ヤンデレ","ツンデレ","マフィア","ルームメイト","CEO","敵","いじめる"];

    categories.forEach(category => {
        const categoryButton = `<button type="button" class="btn btn-light category-button" data-category="${category}">${category}</button>`;
        $('#category-container').append(categoryButton);
      });
      
      $('.category-button').on('click', function() {
        if($(this).hasClass('btn-dark')){
            return
        }
        $('.category-button').each(function(){
            $(this).removeClass('btn-dark').addClass('btn-light')
        })
        $(this).removeClass('btn-light').addClass('btn-dark')
        const category = $(this).data('category');
        $.ajax({
          type: 'POST',
          url: '/api/chat-category/' + category,
          dataType: 'json',
          success: function(data) {
            $('#custom-category-chat').empty()
            const transformedData = data.map(transformChatObject);
            renderCircleGrid(transformedData, $('#custom-category-chat'));
          },
          error: function(xhr, status, error) {
            console.error('Error getting category chat:', error);
          }
        });
      });
      function transformChatObject(obj) {
        return {
          image: obj.chatImageUrl,
          title: obj.name,
          description: obj.description,
          chat_url: '/chat/'+obj._id,
          num_message: obj.num_message
        };
      }
});