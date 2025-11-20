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

    $('#popular-chats-pagination-controls').html(
        '<div class="text-center my-3"><div class="spinner-border text-secondary spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></div>'
    );

    if (reload) {
        popularChatsPage = 1;
        $('#chat-gallery').empty();
        sessionStorage.removeItem(POPULAR_CHATS_CACHE_KEY);
        sessionStorage.removeItem(POPULAR_CHATS_CACHE_TIME_KEY);
    }

    const cache = getPopularChatsCache();
    const cachedData = cache && cache[page];

    if (cachedData && !reload) {
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

        popularChatsTotalPages = data.totalPages || 1;
        updatePopularChatsPagination(page);
    } catch (e) {
        console.error('[PopularChats] Error:', e);
        $('#popular-chats-pagination-controls').html(
            '<div class="text-center text-danger my-3">Error loading popular chats.</div>'
        );
    }

    popularChatsLoading = false;
};

const renderPopularChatsFromCache = (data) => {
    if (typeof window.displayChats === 'function') {
        window.displayChats(data.chats, 'chat-gallery', false);
    }
    if (typeof window.emptyAllGalleriesExcept === 'function') {
        window.emptyAllGalleriesExcept('chat-gallery');
    }
    popularChatsTotalPages = data.totalPages || 1;
    updatePopularChatsPagination(popularChatsPage);
};

const updatePopularChatsPagination = (page) => {
    if (page >= popularChatsTotalPages) {
        $('#popular-chats-pagination-controls').html('');
    } else {
        $('#popular-chats-pagination-controls').html(
            '<div class="text-center my-3"><div class="spinner-border text-secondary spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></div>'
        );
    }
};

// Infinite scroll
$(window).on('scroll.popularChats', () => {
    if (
        !popularChatsLoading &&
        popularChatsPage < popularChatsTotalPages &&
        $(window).scrollTop() + $(window).height() >= $(document).height() - 200
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

// Initial load
$(document).ready(() => window.loadPopularChats());
