// latest-chats.js
// Loads and caches latest chats; provides reload handler

let latestChatsPage = 1;
let latestChatsLoading = false;
let latestChatsTotalPages = 1;

const LATEST_CHATS_CACHE_KEY = 'latestChatsCache';
const LATEST_CHATS_CACHE_TIME_KEY = 'latestChatsCacheTime';
const LATEST_CHATS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Helper function to generate loading spinner HTML
const getLoadingSpinnerHTML = () => {
    return `
        <div id="latest-chats-loading-spinner" class="text-center my-4">
            <div class="spinner-border text-purple" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2 text-muted">${window.translations.loadingMoreCharacters || 'Loading more characters...'}</div>
        </div>  
    `;
};

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

    // Show loading spinner
    $('#latest-chats-pagination-controls').css('opacity', '1').show();
    $('#latest-chats-pagination-controls').html(getLoadingSpinnerHTML());

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
        updateLatestChatsPagination(page);
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

        updateLatestChatsPagination(page);
    } catch (e) {
        console.error('[LatestChats] Error loading chats:', e);
        $('#latest-chats-pagination-controls').html('<div class="text-center text-danger my-3">Error loading chats.</div>');
    }
    latestChatsLoading = false;
};

$(document).on('click', '#reload-latest-chats', () => {
    window.loadLatestChats(1, true);
    // Update active state for query tags
    $('.query-tag').removeClass('active btn-primary').addClass('btn-outline-primary');
    $('#reload-latest-chats').addClass('active btn-primary').removeClass('btn-outline-primary');
});

$(document).on('click', '#reload-latest-video-chats', () => {
    if (typeof window.loadLatestVideoChats === 'function') {
        window.loadLatestVideoChats(1, true);
    }
    if (typeof window.emptyAllGalleriesExcept === 'function') {
        window.emptyAllGalleriesExcept('latest-video-chats-gallery');
    }
    // Update active state for query tags
    $('.query-tag').removeClass('active btn-primary').addClass('btn-outline-primary');
    $('#reload-latest-video-chats').addClass('active btn-primary').removeClass('btn-outline-primary');
});

// Helper function to update pagination controls
const updateLatestChatsPagination = (page) => {
    if (page >= latestChatsTotalPages) {
        $('#latest-chats-pagination-controls').html('');
    } else {
        $('#latest-chats-pagination-controls').html(getLoadingSpinnerHTML());
    }
};

// Infinite scroll for latest chats
$(window).off('scroll.latestChats').on('scroll.latestChats', () => {
    // Only trigger if the latest chats gallery and controls are both visible
    const $gallery = $('#latest-chats-gallery');
    const $controls = $('#latest-chats-pagination-controls');
    if (!$gallery.is(':visible') || $gallery.css('opacity') === '0') return;
    if (!$controls.is(':visible') || $controls.css('opacity') === '0') return;
    if ($controls.length === 0) return;
    
    const scrollThreshold = $controls.offset().top - 1000;
    
    if (
        !latestChatsLoading &&
        latestChatsPage < latestChatsTotalPages &&
        scrollThreshold < $(window).scrollTop()
    ) {
        latestChatsPage++;
        window.loadLatestChats(latestChatsPage);
    }
});
