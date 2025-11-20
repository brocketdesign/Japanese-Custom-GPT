// chat-filters.js
// Manages premium, gender, NSFW, style filters with cookies and applies them after display

let premiumChatsHidden = Cookies.get('premiumChatsHidden') === 'true';
let currentGenderFilter = Cookies.get('currentGenderFilter') || null;
let nsfwChatsHidden = Cookies.get('nsfwChatsHidden') === 'true';
let currentStyleFilter = Cookies.get('currentStyleFilter') || null;

const logFilters = (context) => {
    try {
        console.log('[ChatFilter]', context, {
            premiumChatsHidden,
            currentGenderFilter,
            nsfwChatsHidden,
            currentStyleFilter,
        });
    } catch {}
};

const updateChatFilters = () => {
    $('.popular-chats-gallery .gallery-card').each(function () {
        const $card = $(this);
        const isPremium = $card.hasClass('premium-chat');
        const genderMatch = $card.attr('class').match(/chat-gender-([a-z]+)/);
        const gender = genderMatch ? genderMatch[1] : null;
        const isNSFW = $card.hasClass('nsfw-true');
        const styleMatch = $card.attr('class').match(/chat-style-([a-z]+)/);
        const style = styleMatch ? styleMatch[1] : null;

        let show = true;
        if (premiumChatsHidden && isPremium) show = false;
        if (currentGenderFilter && gender !== currentGenderFilter) show = false;
        if (nsfwChatsHidden && isNSFW) show = false;
        if (currentStyleFilter && style !== currentStyleFilter) show = false;

        $card.toggle(show);
    });
};

// Restore UI state
$(function () {
    const t = window.translations?.sort || {};
    $('#popular-chats-premium').text(
        premiumChatsHidden ? (t.showPremium || 'Show Premium') : (t.hidePremium || 'Hide Premium')
    );
    if (currentGenderFilter) {
        $('.sorting-tools button').removeClass('active');
        $(`#popular-chats-gender-${currentGenderFilter}`).addClass('active');
    }
    $('#popular-chats-nsfw').text(
        nsfwChatsHidden ? (t.showNSFW || 'Show NSFW') : (t.hideNSFW || 'Hide NSFW')
    );
    if (currentStyleFilter) {
        $('.sorting-tools button').removeClass('active');
        $(`#popular-chats-style-${currentStyleFilter}`).addClass('active');
    }
    logFilters('on page load');
    updateChatFilters();
});

// Premium toggle
$(document).on('click', '#popular-chats-premium', function () {
    premiumChatsHidden = !premiumChatsHidden;
    Cookies.set('premiumChatsHidden', premiumChatsHidden, { expires: 7 });
    logFilters('premium toggle');
    updateChatFilters();
    const t = window.translations?.sort || {};
    $(this).text(premiumChatsHidden ? (t.showPremium || 'Show Premium') : (t.hidePremium || 'Hide Premium'));
});

// Gender filters
$(document).on('click', '#popular-chats-gender-female, #popular-chats-gender-male, #popular-chats-gender-nonbinary', function () {
    currentGenderFilter = this.id.replace('popular-chats-gender-', '');
    Cookies.set('currentGenderFilter', currentGenderFilter, { expires: 7 });
    $('.sorting-tools button').removeClass('active');
    $(this).addClass('active');
    logFilters('gender filter');
    updateChatFilters();
});

// Reset gender (clicking any non-gender button within .sorting-tools)
$(document).on('click', '.sorting-tools .btn:not([id^="popular-chats-gender-"])', function () {
    currentGenderFilter = null;
    Cookies.remove('currentGenderFilter');
    $('.sorting-tools button').removeClass('active');
    logFilters('reset gender filter');
    updateChatFilters();
});

// NSFW toggle
$(document).on('click', '#popular-chats-nsfw', function () {
    nsfwChatsHidden = !nsfwChatsHidden;
    Cookies.set('nsfwChatsHidden', nsfwChatsHidden, { expires: 7 });
    logFilters('nsfw toggle');
    updateChatFilters();
    const t = window.translations?.sort || {};
    $(this).text(nsfwChatsHidden ? (t.showNSFW || 'Show NSFW') : (t.hideNSFW || 'Hide NSFW'));
});

// Style filters
$(document).on('click', '#popular-chats-style-anime, #popular-chats-style-photorealistic', function () {
    currentStyleFilter = this.id.replace('popular-chats-style-', '');
    Cookies.set('currentStyleFilter', currentStyleFilter, { expires: 7 });
    $('.sorting-tools button').removeClass('active');
    $(this).addClass('active');
    logFilters('style filter');
    updateChatFilters();
    $('#all-chats-container').empty();
    $('#chat-gallery').show();
    if (typeof window.emptyAllGalleriesExcept === 'function') {
        window.emptyAllGalleriesExcept('chat-gallery');
    }
    $('.query-tag-all').click();
});

// Reset style (clicking any non-style button within .sorting-tools)
$(document).on('click', '.sorting-tools .btn:not([id^="popular-chats-style-"])', function () {
    currentStyleFilter = null;
    Cookies.remove('currentStyleFilter');
    $('.sorting-tools button').removeClass('active');
    logFilters('reset style filter');
    updateChatFilters();
    $('#all-chats-container').empty();
    $('#chat-gallery').show();
    if (typeof window.emptyAllGalleriesExcept === 'function') {
        window.emptyAllGalleriesExcept('chat-gallery');
    }
    $('.query-tag-all').click();
    $('html, body').animate({ scrollTop: $('#chat-gallery').offset().top }, 500);
});

// Ensure filters apply after any displayChats call
const originalDisplayChats = window.displayChats;
window.displayChats = function (...args) {
    if (typeof originalDisplayChats === 'function') originalDisplayChats.apply(this, args);
    logFilters('after displayChats');
    updateChatFilters();
};
