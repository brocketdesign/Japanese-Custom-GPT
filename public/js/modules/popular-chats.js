// popular-chats.js
// Handles loading, caching, and infinite scrolling of popular chats

const POPULAR_CHATS_CACHE_KEY = 'popularChatsCache';
const POPULAR_CHATS_CACHE_TIME_KEY = 'popularChatsCacheTime';
const POPULAR_CHATS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

let popularChatsPage = 1;
let popularChatsLoading = false;
let popularChatsTotalPages = 1;

const getPopularChatsCache = () => {
    const cache = sessionStorage.getItem(POPULAR_CHATS_CACHE_KEY);
    const timestamp = sessionStorage.getItem(POPULAR_CHATS_CACHE_TIME_KEY);
    if (!cache || !timestamp) return null;
    if (Date.now() - parseInt(timestamp, 10) > POPULAR_CHATS_CACHE_TTL) {
        sessionStorage.removeItem(POPULAR_CHATS_CACHE_KEY);
        sessionStorage.removeItem(POPULAR_CHATS_CACHE_TIME_KEY);
        return null;
    }
    try {
        return JSON.parse(cache);
    } catch {
        return null;
    }
};

const setPopularChatsCache = (page, data) => {
    let cache = getPopularChatsCache() || {};
    cache[page] = data;
    sessionStorage.setItem(POPULAR_CHATS_CACHE_KEY, JSON.stringify(cache));
    sessionStorage.setItem(POPULAR_CHATS_CACHE_TIME_KEY, Date.now().toString());
};

window.resetPopularChatCache = function () {
    sessionStorage.removeItem(POPULAR_CHATS_CACHE_KEY);
    sessionStorage.removeItem(POPULAR_CHATS_CACHE_TIME_KEY);
    popularChatsPage = 1;
    return fetch('/api/popular-chats/reset-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reloadCache: true })
    })
        .then((response) => {
            if (!response.ok) throw new Error('Failed to reset popular chats cache');
            return response.json();
        })
        .catch((err) => {
            console.error('Error resetting popular chats cache:', err);
        });
};

window.loadPopularChats = async (page = 1, reload = false) => {
    if (popularChatsLoading && !reload) return;
    popularChatsLoading = true;

    $('#chat-pagination-controls').css('opacity', '1').show();
    $('#chat-pagination-controls').html(
            `
            <div id="popular-chats-loading-spinner" class="text-center my-4">
                <div class="spinner-border text-purple" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="mt-2 text-muted">${translations.loadingMoreCharacters ? translations.loadingMoreCharacters : 'Loading more characters...'}</div>
            </div>  
            `
    );

    if (reload) {
        popularChatsPage = 1;
        $('#chat-gallery').empty();
        sessionStorage.removeItem(POPULAR_CHATS_CACHE_KEY);
        sessionStorage.removeItem(POPULAR_CHATS_CACHE_TIME_KEY);
    }

    const cache = getPopularChatsCache();
    const cachedData = cache && cache[page];

    // Validate cached data before using it
    if (cachedData && !reload && Array.isArray(cachedData.chats) && cachedData.chats.length > 0) {
        renderPopularChatsFromCache(cachedData);
        popularChatsLoading = false;
        return;
    }

    try {
        const res = await fetch(`/api/popular-chats?page=${page}&reloadCache=${reload}`);
        if (!res.ok) throw new Error('Failed to load popular chats');

        const data = await res.json();
        setPopularChatsCache(page, data);

        if (Array.isArray(data.chats)) {
            data.chats = data.chats
                .map((value) => ({ value, sort: Math.random() }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
        }

        if (typeof window.displayChats === 'function') {
            window.displayChats(data.chats, 'chat-gallery', false);
        }
        if (typeof window.emptyAllGalleriesExcept === 'function') {
            window.emptyAllGalleriesExcept('chat-gallery');
        }
        // Apply style/gender/premium filters after displaying chats
        if (typeof window.updateChatFilters === 'function') {
            window.updateChatFilters();
        }

        popularChatsTotalPages = data.totalPages || 1;
        updatePopularChatsPagination(page);
    } catch (e) {
        console.error('[PopularChats] Error:', e);
        $('#chat-pagination-controls').html(
            '<div class="text-center text-danger my-3">Error loading popular chats.</div>'
        );
    }

    popularChatsLoading = false;
};

const renderPopularChatsFromCache = (data) => {
    // Validate data structure before using it
    if (!data || !Array.isArray(data.chats)) {
        console.warn('[renderPopularChatsFromCache] Invalid cache data, skipping render');
        return;
    }

    if (typeof window.displayChats === 'function') {
        window.displayChats(data.chats, 'chat-gallery', false);
    }
    if (typeof window.emptyAllGalleriesExcept === 'function') {
        window.emptyAllGalleriesExcept('chat-gallery');
    }
    // Apply style/gender/premium filters after displaying chats
    if (typeof window.updateChatFilters === 'function') {
        window.updateChatFilters();
    }
    popularChatsTotalPages = data.totalPages || 1;
    updatePopularChatsPagination(popularChatsPage);
};

const updatePopularChatsPagination = (page) => {
    if (page >= popularChatsTotalPages) {
        $('#chat-pagination-controls').html('');
    } else {
        $('#chat-pagination-controls').html(
            `
            <div id="popular-chats-loading-spinner" class="text-center my-4">
            <div class="spinner-border text-purple" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2 text-muted">${translations.loadingMoreCharacters ? translations.loadingMoreCharacters : 'Loading more characters...'}</div>
            </div>  
            `
        );
    }
};

// Infinite scroll
$(window).off('scroll.popularChats').on('scroll.popularChats', () => {
    // Only trigger if the gallery and controls are both visible (not display:none and not opacity:0)
    const $gallery = $('#chat-gallery');
    const $controls = $('#chat-pagination-controls');
    if (!$gallery.is(':visible') || $gallery.css('opacity') === '0') return;
    if (!$controls.is(':visible') || $controls.css('opacity') === '0') return;
    if($('#chat-pagination-controls').length === 0) return;
    const scrollTresold = $('#chat-pagination-controls').offset().top  - 1000;
    
    if (
        !popularChatsLoading &&
        popularChatsPage < popularChatsTotalPages &&
        scrollTresold < $(window).scrollTop()
    ) {
        popularChatsPage++;
        window.loadPopularChats(popularChatsPage);
    }
});

// Reset cache button
$(document).on('click', '#reset-popular-chat-cache', () => {
    window.resetPopularChatCache()?.finally(() => {
        $('#chat-gallery').empty();
        window.loadPopularChats(1, true);
    });
});
