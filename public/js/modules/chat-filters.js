// chat-filters.js
// Updated for the new gender dropdown design (November 2025)

let premiumChatsHidden = Cookies.get('premiumChatsHidden') === 'true';
let currentGenderFilter = Cookies.get('currentGenderFilter') || null;  // 'female', 'male', 'nonbinary', or null
let nsfwChatsHidden = Cookies.get('nsfwChatsHidden') === 'true';
let currentStyleFilter = Cookies.get('currentStyleFilter') || null;

const logFilters = (context) => {
    return; // Disable logging for now
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

// Helper: Update NSFW blur state on gallery
const updateNsfwBlurState = () => {
    // If nsfwChatsHidden is true, add blur-nsfw class to blur images
    // If nsfwChatsHidden is false (user wants to see NSFW), remove blur
    $('.explore-gallery, .popular-chats-gallery, #chat-gallery, #latest-chats-gallery, #all-chats-images-gallery').toggleClass('blur-nsfw', nsfwChatsHidden);
    $('body').toggleClass('blur-nsfw', nsfwChatsHidden);
};

// On page load – restore state
$(function () {
    const t = window.translations?.sort || {};

    // Update premium button active state (icon only)
    $('#popular-chats-premium').toggleClass('active', !premiumChatsHidden);

    // Update NSFW button active state (icon only)
    $('#popular-chats-nsfw').toggleClass('active', !nsfwChatsHidden);
    
    // Apply initial NSFW blur state based on user preference
    updateNsfwBlurState();

    // Restore gender dropdown appearance
    updateGenderDropdownDisplay(currentGenderFilter);

    logFilters('on page load');
    updateChatFilters();
});

// Premium toggle
$(document).on('click', '#popular-chats-premium', function () {
    premiumChatsHidden = !premiumChatsHidden;
    Cookies.set('premiumChatsHidden', premiumChatsHidden, { expires: 7 });
    $(this).toggleClass('active', !premiumChatsHidden);
    logFilters('premium toggle');
    updateChatFilters();
});

// NSFW toggle
$(document).on('click', '#popular-chats-nsfw', function () {
    nsfwChatsHidden = !nsfwChatsHidden;
    Cookies.set('nsfwChatsHidden', nsfwChatsHidden, { expires: 7 });
    $(this).toggleClass('active', !nsfwChatsHidden);
    // Update blur state based on new setting
    updateNsfwBlurState();
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

    logFilters('style filter applied');
    updateChatFilters(); // Hide opposite style
};

// Style filters (now fetch from server instead of only hiding/showing)
$(document).on('click', '#popular-chats-style-anime, #popular-chats-style-photorealistic', function () {
    const style = this.id.endsWith('anime') ? 'anime' : 'photorealistic';
    loadStyleFilteredChats(style);
    setActiveQuery(style);
    // Trigger loadPopularChats to refresh the display
    if (typeof window.loadPopularChats === 'function') {
        popularChatsPage = 1;
        window.loadPopularChats(1, true);
    }
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