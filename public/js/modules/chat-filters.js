// chat-filters.js
// Updated for the new gender dropdown design (November 2025)

let premiumChatsHidden = Cookies.get('premiumChatsHidden') === 'true';
let currentGenderFilter = Cookies.get('currentGenderFilter') || null;  // 'female', 'male', 'nonbinary', or null
let nsfwChatsHidden = Cookies.get('nsfwChatsHidden') === 'true';
let currentStyleFilter = Cookies.get('currentStyleFilter') || null;

const logFilters = (context) => {
    return
    try {
        console.log('[ChatFilter]', context, {
            premiumChatsHidden,
            currentGenderFilter,
            nsfwChatsHidden,
            currentStyleFilter
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

// Helper: Update the dropdown button text + icon
const updateGenderDropdownDisplay = (gender) => {
    const selectedTextEl = document.getElementById('selected-gender-text');
    if (!selectedTextEl) return;

    const labels = {
        female: { icon: '<i class="bi bi-gender-female text-primary"></i>', text: window.translations?.sort?.female || 'Female' },
        male: { icon: '<i class="bi bi-gender-male text-info"></i>', text: window.translations?.sort?.male || 'Male' },
        nonbinary: { icon: '<i class="bi bi-gender-trans text-success"></i>', text: window.translations?.sort?.nonBinary || 'Non-binary' }
    };

    if (gender && labels[gender]) {
        selectedTextEl.innerHTML = `${labels[gender].icon} <span class="ms-1">${labels[gender].text}</span>`;
    } else {
        // Default "All genders" or fallback
        selectedTextEl.innerHTML = `<i class="bi bi-gender-ambiguous"></i> <span class="ms-1">${window.translations?.sort?.allGenders || 'All Genders'}</span>`;
    }
};

// On page load – restore state
$(function () {
    const t = window.translations?.sort || {};

    // Premium button text
    $('#popular-chats-premium').text(
        premiumChatsHidden ? (t.showPremium || 'Show Premium') : (t.hidePremium || 'Hide Premium')
    );

    // NSFW button text
    $('#popular-chats-nsfw').text(
        nsfwChatsHidden ? (t.showNSFW || 'Show NSFW') : (t.hideNSFW || 'Hide NSFW')
    );

    // Restore gender dropdown appearance
    updateGenderDropdownDisplay(currentGenderFilter);

    logFilters('on page load');
    updateChatFilters();
});

// Premium toggle
$(document).on('click', '#popular-chats-premium', function () {
    premiumChatsHidden = !premiumChatsHidden;
    Cookies.set('premiumChatsHidden', premiumChatsHidden, { expires: 7 });
    const t = window.translations?.sort || {};
    $(this).text(premiumChatsHidden ? (t.showPremium || 'Show Premium') : (t.hidePremium || 'Hide Premium'));
    logFilters('premium toggle');
    updateChatFilters();
});

// NSFW toggle
$(document).on('click', '#popular-chats-nsfw', function () {
    nsfwChatsHidden = !nsfwChatsHidden;
    Cookies.set('nsfwChatsHidden', nsfwChatsHidden, { expires: 7 });
    const t = window.translations?.sort || {};
    $(this).text(nsfwChatsHidden ? (t.showNSFW || 'Show NSFW') : (t.hideNSFW || 'Hide NSFW'));
    logFilters('nsfw toggle');
    updateChatFilters();
});

// ========== GENDER DROPDOWN HANDLER (NEW) ==========
$(document).on('click', '.dropdown-menu [data-gender]', function (e) {
    e.preventDefault();
    const gender = $(this).data('gender');  // 'female', 'male', 'nonbinary'

    if (currentGenderFilter === gender) {
        // Clicking the same → reset to "All"
        currentGenderFilter = null;
        Cookies.remove('currentGenderFilter');
    } else {
        // Select new gender
        currentGenderFilter = gender;
        Cookies.set('currentGenderFilter', currentGenderFilter, { expires: 7 });
    }

    // Update visual
    updateGenderDropdownDisplay(currentGenderFilter);

    // Close dropdown (Bootstrap handles it, but ensure)
    $(this).closest('.dropdown-menu').dropdown('hide');

    logFilters('gender filter changed');
    updateChatFilters();
});

// Reset gender when clicking other filters (optional – keeps UX clean)
$(document).on('click', '.sorting-tools .btn:not(.dropdown-toggle)', function () {
    if (currentGenderFilter !== null) {
        currentGenderFilter = null;
        Cookies.remove('currentGenderFilter');
        updateGenderDropdownDisplay(null);
        logFilters('gender filter reset by other button');
        updateChatFilters();
    }
});

// Helper: fetch & render characters by imageStyle using /api/chats via displayPeopleChat
window.loadStyleFilteredChats = function(style) {
    currentStyleFilter = style;
    Cookies.set('currentStyleFilter', currentStyleFilter, { expires: 7 });

    // Update active UI state
    $('.sorting-tools button').removeClass('active');
    $(`#popular-chats-style-${style}`).addClass('active');

    // Clear current galleries
    $('#all-chats-container').empty();
    $('#chat-gallery').empty().show();

    // Stop popular-chats infinite scroll to avoid mixing datasets
    $(window).off('scroll.popularChats');

    // Clear popular cache (optional, keeps UI clean if user switches back)
    sessionStorage.removeItem('popularChatsCache');
    sessionStorage.removeItem('popularChatsCacheTime');

    // Load server-filtered characters by style with infinite scroll
    // displayPeopleChat uses /api/chats under the hood
    displayPeopleChat(
      1,
      { imageStyle: style, imageModel: '', query: '', userId: '', modal: false },
      null,
      true // reload
    );
};

// Style filters (now fetch from server instead of only hiding/showing)
$(document).on('click', '#popular-chats-style-anime, #popular-chats-style-photorealistic', function () {
    const style = this.id.endsWith('anime') ? 'anime' : 'photorealistic';
    loadStyleFilteredChats(style);
});

// Reset style when clicking other filters
$(document).on('click', '.sorting-tools .btn:not([id^="popular-chats-style-"])', function () {
    if (currentStyleFilter !== null) {
        currentStyleFilter = null;
        Cookies.remove('currentStyleFilter');
        $('.sorting-tools button').removeClass('active');

        // Restore default: clear gallery, reload popular, re-bind its infinite scroll
        $('#all-chats-container').empty();
        $('#chat-gallery').empty().show();

        // Clear style-specific view and show the popular list again
        if (typeof window.loadPopularChats === 'function') {
            popularChatsPage = 1;
            window.loadPopularChats(1, true);
        }

        // Also ensure “All” query tag state visually
        if ($('.query-tag-all').length) {
            $('.query-tag-all').click();
        }

        // Optionally scroll to the grid
        $('html, body').animate({ scrollTop: $('#chat-gallery').offset().top }, 500);
    }

    logFilters('reset style filter');
    updateChatFilters();
});

// Re-apply filters after any new chats are displayed
const originalDisplayChats = window.displayChats;
window.displayChats = function (...args) {
    if (typeof originalDisplayChats === 'function') {
        originalDisplayChats.apply(this, args);
    }
    logFilters('after displayChats');
    updateChatFilters();
};