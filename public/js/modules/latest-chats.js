// latest-chats.js
// Loads and caches latest chats; provides reload handler

let latestChatsPage = 1;
let latestChatsLoading = false;
let latestChatsTotalPages = 1;

const LATEST_CHATS_CACHE_KEY = 'latestChatsCache';
const LATEST_CHATS_CACHE_TIME_KEY = 'latestChatsCacheTime';
const LATEST_CHATS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const getLatestChatsCache = () => {
    const cache = sessionStorage.getItem(LATEST_CHATS_CACHE_KEY);
    const ts = sessionStorage.getItem(LATEST_CHATS_CACHE_TIME_KEY);
    if (!cache || !ts) return null;
    if (Date.now() - parseInt(ts, 10) > LATEST_CHATS_CACHE_TTL) {
        sessionStorage.removeItem(LATEST_CHATS_CACHE_KEY);
        sessionStorage.removeItem(LATEST_CHATS_CACHE_TIME_KEY);
        return null;
    }
    try {
        return JSON.parse(cache);
    } catch {
        return null;
    }
};

const setLatestChatsCache = (page, data) => {
    const cache = getLatestChatsCache() || {};
    cache[page] = data;
    sessionStorage.setItem(LATEST_CHATS_CACHE_KEY, JSON.stringify(cache));
    sessionStorage.setItem(LATEST_CHATS_CACHE_TIME_KEY, Date.now().toString());
};

window.loadLatestChats = async (page = 1, reload = false) => {
    if (latestChatsLoading && !reload) return;
    latestChatsLoading = true;

    if (reload) {
        latestChatsPage = 1;
        $('#latest-chats-gallery').empty();
        sessionStorage.removeItem(LATEST_CHATS_CACHE_KEY);
        sessionStorage.removeItem(LATEST_CHATS_CACHE_TIME_KEY);
    }

    const cache = getLatestChatsCache();
    let data = cache && cache[page];

    if (data && !reload) {
        if (typeof window.displayChats === 'function') {
            window.displayChats(data.chats, 'latest-chats-gallery', false);
        }
        latestChatsTotalPages = data.totalPages || 1;
        if (page >= latestChatsTotalPages) {
            $('#latest-chats-pagination-controls').html('');
        }
        latestChatsLoading = false;
        return;
    }

    try {
        const res = await fetch(`/api/latest-chats?page=${page}`);
        if (!res.ok) {
            $('#latest-chats-pagination-controls').html('<div class="text-center text-danger my-3">Failed to load chats.</div>');
            latestChatsLoading = false;
            return;
        }
        data = await res.json();
        setLatestChatsCache(page, data);

        if (typeof window.displayChats === 'function') {
            window.displayChats(data.chats, 'latest-chats-gallery', false);
        }
        if (typeof window.emptyAllGalleriesExcept === 'function') {
            window.emptyAllGalleriesExcept('latest-chats-gallery');
        }
        latestChatsTotalPages = data.totalPages || 1;

        if (page >= latestChatsTotalPages) {
            $('#latest-chats-pagination-controls').html('');
        }
    } catch (e) {
        console.error('[LatestChats] Error loading chats:', e);
        $('#latest-chats-pagination-controls').html('<div class="text-center text-danger my-3">Error loading chats.</div>');
    }
    latestChatsLoading = false;
};

// Reload triggers
$(document).on('click', '#reload-latest-chats', () => window.loadLatestChats(1, true));
$('#reload-latest-video-chats').on('click', () => {
    if (typeof window.loadLatestVideoChats === 'function') {
        window.loadLatestVideoChats(1, true);
    }
    if (typeof window.emptyAllGalleriesExcept === 'function') {
        window.emptyAllGalleriesExcept('latest-video-chats-gallery');
    }
});
