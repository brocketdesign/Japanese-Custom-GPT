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

// Call this function on page load
window.addEventListener('DOMContentLoaded', () => {
    getReferrerAndSave();
});

// Legacy support
window.onload = () => {
    getReferrerAndSave();
};
// Call this function on page load
window.addEventListener('DOMContentLoaded', () => {
    getReferrerAndSave();
});

// Legacy support
window.onload = () => {
    getReferrerAndSave();
};

  // Check sessionStorage first, then fall back to user preference, default to false
  let showNSFW;
  const sessionNSFW = sessionStorage.getItem('showNSFW');
  
  if (sessionNSFW !== null) {
    // Use sessionStorage value if it exists
    showNSFW = sessionNSFW === 'true';
  } else if (user.showNSFW !== undefined) {
    // Fall back to user's saved preference
    showNSFW = user.showNSFW;
    // Save to sessionStorage for consistency
    sessionStorage.setItem('showNSFW', showNSFW.toString());
  } else {
    // Default to false if neither exists
    showNSFW = false;
    sessionStorage.setItem('showNSFW', 'false');
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
}