const subscriptionStatus = user.subscriptionStatus == 'active';

// Function to get the referrer parameter from the URL and save it to local storage
function getReferrerAndSave() {
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = urlParams.get('referrer');

    if (referrer) {
        // Save to localStorage
        localStorage.setItem('referrer', referrer);
        
        // Set a cookie for server-side access
        document.cookie = `referrer=${referrer}; path=/; max-age=${30*24*60*60}`; // Expires in 30 days
        
        // Track the click
        trackReferralClick(referrer);
        
        // Clean up URL
        const url = new URL(window.location);
        url.searchParams.delete('referrer');
        window.history.replaceState({}, document.title, url.toString());
    }
}

// Track referral click
async function trackReferralClick(slug) {
    try {
        const response = await fetch(`/api/affiliate/track-click/${slug}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ slug })
        });
        
        if (!response.ok) {
            console.error('Error tracking referral click: HTTP', response.status);
            return;
        }
        
        await response.json();
    } catch (error) {
        console.error('Error tracking referral click:', error);
    }
}

// Enhanced function to check for stored referrer on registration
function getStoredReferrer() {
    const cookieReferrer = getCookie('referrer');
    const localStorageReferrer = localStorage.getItem('referrer');
    
    return cookieReferrer || localStorageReferrer;
}

// Utility function to get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

window.showNSFW;

// Always prioritize user.showNSFW if defined
if (typeof user.showNSFW !== 'undefined') {
    window.showNSFW = user.showNSFW;
    sessionStorage.setItem('showNSFW', window.showNSFW.toString());
} else {
    // Fall back to sessionStorage value if user.showNSFW is not defined
    const sessionNSFW = sessionStorage.getItem('showNSFW');
    if (sessionNSFW !== null) {
        window.showNSFW = sessionNSFW === 'true';
    } else {
        window.showNSFW = false;
        sessionStorage.setItem('showNSFW', 'false');
    }
}

window.toggleNSFWContent = function() {
    window.showNSFW = !window.showNSFW;
    sessionStorage.setItem('showNSFW', window.showNSFW.toString());
    updateNSFWContentUI();
};

window.updateNSFWContentUI = function() {
    if (window.showNSFW) {
        document.querySelectorAll('.nsfw-content').forEach(el => {
            el.style.display = 'block';
        });
        document.querySelectorAll('.sfw-content').forEach(el => {
            el.style.display = 'none';
        });
    } else {
        document.querySelectorAll('.nsfw-content').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('.sfw-content').forEach(el => {
            el.style.display = 'block';
        });
    }

    if (window.showNSFW) {
        document.body.classList.add('nsfw-mode');
        document.body.classList.remove('sfw-mode');

    }
    else {
        document.body.classList.remove('nsfw-mode');
        document.body.classList.add('sfw-mode');
    }
}

if(MODE === 'local'){
    document.querySelectorAll('.local-mode').forEach(el => {
        el.style.display = 'inline-block';
    });
}
if(subscriptionStatus){
    document.querySelectorAll('.is-free-user').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('.is-subscriber').forEach(el => {
        el.style.display = 'block';
    });
    document.querySelectorAll('.is-premium').forEach(el => {
        el.style.display = 'block';
    });
}

$(document).ready(function() {
    // Initialize the referrer tracking
    getReferrerAndSave();

    // Update NSFW content visibility on page load
    updateNSFWContentUI();

    // Handle click events for NSFW toggle
    $('.toggle-nsfw').on('click', function() {
        window.toggleNSFWContent();
    });
});