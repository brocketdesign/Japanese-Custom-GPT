// =========================
// Enhanced Image Generation with Novita
// =========================

window.checkImageDescription = async function(chatId = null) {
    if (!chatId) {
        console.error('checkImageDescription Error: chatId is required.');
        return { error: 'Abort' };
    }

    try {
        const response = await fetch(`/api/check-image-description?chatId=${chatId}`, {
            method: 'GET',
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('checkImageDescription Error:', error);
        return { error: 'Failed to check image description.' };
    }
};

// Generate Image using Novita
async function controlImageGen(userId, chatId, userChatId, imageId, isNSFWChecked) {
    const t = window.translations.imageForm;

    $.ajax({
        url: '/api/prompts/' + imageId,
        type: 'GET',
        success: async function(promptData) {
            const prompt_title = promptData.title;
            let prompt = promptData.prompt;
            const imageNsfw = isNSFWChecked ? 'nsfw' : 'sfw';

            let imageDescriptionResponse = await checkImageDescription(chatId)
            const imageDescription = imageDescriptionResponse.imageDescription

            prompt = imageDescription +', '+ prompt
            txt2ImageNovita(userId, chatId, userChatId, imageId, imageNsfw, {prompt})
        },
        error: function(xhr) {
            showNotification('プロンプトの取得中にエラーが発生しました。', 'error');
        }
    });
}

// Re-generate Image using Novita
window.txt2ImageNovita = async function(userId, chatId, userChatId, imageId, imageType, option = {}) {

    if (!imageId) {
        $(`#load-image-container-${imageId}`).remove();
        $(`.txt2img[data-id=${imageId}]`).removeClass('spin')
        showNotification('無効なアイテムIDです。', 'error');
        return;
    }

    try {
        const {
            negativePrompt = $('#negativePrompt-input').val(),
            title = option.title || $('#title-input').val(),
            prompt = option.prompt.replace(/^\s+/gm, '').trim() || $('#prompt-input').val(),
            aspectRatio = '9:16',
            baseFace = null,
        } = option;

        if (!prompt) {
            console.error('generateImageNovita Error: Prompt is required.');
            showNotification('画像生成に必要なプロンプトがありません。', 'error');
            $(`#load-image-container-${imageId}`).remove();
            $(`.txt2img[data-id=${imageId}]`).removeClass('spin')
            return;
        }

        const API_ENDPOINT = `${API_URL}/novita/txt2img`;

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title,
                prompt, 
                aspectRatio, 
                userId, 
                chatId, 
                userChatId,
                imageType
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ネットワークエラー (${response.status} ${response.statusText}): ${errorText}`);
        }

        const data = await response.json();
        const { taskId } = data;

        if (!taskId) {
            throw new Error('サーバーからタスクが返されませんでした。');
        }

        pollTaskStatus(taskId, imageType, imageId, userChatId, function(){
            $(`.txt2img[data-id=${imageId}]`).removeClass('spin');
        });

    } catch (error) {
        console.error('generateImageNovita Error:', error);
        console.log(`画像生成エラー: ${error.message}`);
        $(`#load-image-container-${imageId}`).remove();
        $(`.txt2img[data-id=${imageId}]`).removeClass('spin')
        showNotification('画像の生成中にエラーが発生しました。', 'error');
    }
}
window.img2ImageNovita = async function(userId, chatId, userChatId, imageId, imageType, option = {}) {

    if (!imageId) {
        $(`#load-image-container-${imageId}`).remove();
        $(`.img2img[data-id=${imageId}]`).removeClass('spin')
        showNotification('無効なアイテムIDです。', 'error');
        return;
    }

    try {
        const {
            negativePrompt = $('#negativePrompt-input').val(),
            aspectRatio = '9:16',
            baseFace = null,
            prompt = option.prompt.replace(/^\s+/gm, '').trim() || $('#prompt-input').val()
        } = option;

        if (!prompt) {
            console.error('generateImageNovita Error: Prompt is required.');
            showNotification('画像生成に必要なプロンプトがありません。', 'error');
            $(`#load-image-container-${imageId}`).remove();
            $(`.img2img[data-id=${imageId}]`).removeClass('spin')
            return;
        }

        const API_ENDPOINT = `${API_URL}/novita/img2img`;

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                imageId,
                aspectRatio: aspectRatio, 
                userId: userId, 
                chatId: chatId, 
                userChatId: userChatId,
                imageType: imageType
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ネットワークエラー (${response.status} ${response.statusText}): ${errorText}`);
        }

        const data = await response.json();
        const { taskId } = data;

        if (!taskId) {
            throw new Error('サーバーからタスクが返されませんでした。');
        }

        pollTaskStatus(taskId, imageType, imageId, userChatId, function(){
            $(`.img2img[data-id=${imageId}]`).removeClass('spin')
        });

    } catch (error) {
        console.error('generateImageNovita Error:', error);
        console.log(`画像生成エラー: ${error.message}`);
        $(`#load-image-container-${imageId}`).remove();
        $(`.img2img[data-id=${imageId}]`).removeClass('spin')
        showNotification('画像の生成中にエラーが発生しました。', 'error');
    }
}

const displayedImageIds = new Set();
function pollTaskStatus(taskId, type, item_id, userChatId, callback) {
    const POLLING_INTERVAL = 30000; // 30 seconds
    const MAX_ATTEMPTS = 60;
    let attempts = 0;

    const intervalId = setInterval(async () => {
        attempts++;
        try {
            const statusResponse = await fetch(`${API_URL}/novita/task-status/${taskId}`);
            
            if (!statusResponse.ok) {
                const errorText = await statusResponse.text();
                throw new Error(`ステータスチェックに失敗しました: ${errorText}`);
            }

            const statusData = await statusResponse.json();

            if (statusData.status === 'completed') {
                clearInterval(intervalId);
                const { imageId, imageUrl, title, prompt } = statusData.images[0];

                if (!displayedImageIds.has(imageId)) {
                    generateImage({
                        url: imageUrl,
                        id: imageId,
                        userChatId,
                        title,
                        prompt,
                        nsfw: type === 'nsfw'
                    }, prompt);

                    displayedImageIds.add(imageId);

                    showNotification(`${type.toUpperCase()} 画像が正常に生成されました。`, 'success');
                    
                    $(`#load-image-container-${item_id}`).remove();

                    if (typeof callback === 'function') {
                        callback(null, statusData.images);
                    }
                    
                } else {
                    console.log(`Image ${imageId} has already been displayed.`);
                }
            } else if (statusData.status === 'failed') {
                clearInterval(intervalId);

                if (typeof callback === 'function') {
                    callback(new Error('Image generation failed'));
                }
            }

            if (attempts >= MAX_ATTEMPTS) {
                clearInterval(intervalId);
                showNotification('画像の生成がタイムアウトしました。再試行してください。', 'error');

                if (typeof callback === 'function') {
                    callback(new Error('Image generation timed out'));
                }
            }

        } catch (error) {
            console.error(`Error polling task status for ${type}:`, error);
            clearInterval(intervalId);

            if (typeof callback === 'function') {
                callback(error);
            }
        }
    }, POLLING_INTERVAL);
}

const sentImageIds = new Set();

window.generateImage = async function(data, prompt) {
  if (!data || !data.userChatId || !data.url || !data.id || !data.prompt || sentImageIds.has(data.id)) return;

  const { url: imageUrl, id: imageId, nsfw: imageNsfw } = data;
  sentImageIds.add(imageId);

  const img = document.createElement('img');
  img.setAttribute('src', imageUrl);
  img.setAttribute('alt', data.title[lang]);
  img.setAttribute('class', 'm-auto');
  img.setAttribute('data-id', imageId);
  img.setAttribute('data-nsfw', imageNsfw);

  try {
    const user = await fetchUser();
    const subscriptionStatus = user.subscriptionStatus === 'active';
    displayMessage('bot-image', img, data.userChatId);
  } catch (error) {
    showNotification('ユーザー情報の取得に失敗しました。', 'error');
  }
};
