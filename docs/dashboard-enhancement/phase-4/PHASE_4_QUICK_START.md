# Phase 4 - Quick Start Guide

**Quick Reference for Developers**  
**Time to Learn:** 5 minutes  
**Time to Implement:** 1-2 minutes

---

## 🚀 In 30 Seconds

Phase 4 provides three modules for image handling:

| Module | Purpose | Global Function |
|--------|---------|-----------------|
| `image-blur-handler.js` | Blur NSFW images | `window.blurImage()` |
| `image-loader.js` | Lazy load images | `window.lazyLoadImages()` |
| `nsfw-content-manager.js` | Toggle NSFW flags | `window.toggleImageNSFW()` |

---

## 📖 Module Reference

### Image Blur Handler

**Apply blur to an image element:**
```javascript
// In HTML
<img id="image" data-src="url.jpg" class="img-blur">

// In JavaScript
window.blurImage(document.getElementById('image'));

// Or with module API
window.DashboardImageBlurHandler.blurImage(imgElement);
```

**Check if image should be blurred:**
```javascript
const isNSFW = item.nsfw || false;
const isTemporary = window.user?.isTemporary || false;
const subscribed = window.user?.subscriptionStatus === 'active';

const shouldBlur = window.shouldBlurNSFW(item, subscribed);
// Returns: isNSFW && (isTemporary || !subscribed)
```

**Create NSFW overlay:**
```javascript
window.createOverlay(imgElement, imageUrl);
// Adds overlay with unlock button and blur effect
```

**Clear blur cache:**
```javascript
// Clear specific URL
window.DashboardImageBlurHandler.clearCache();

// Or check stats
const stats = window.DashboardImageBlurHandler.getCacheStats();
console.log(`Cached images: ${stats.size}`);
```

---

### Image Loader

**Setup lazy loading for images:**
```javascript
// In HTML, add data-src to images
<img data-src="/img/gallery/1.jpg" alt="Gallery 1">
<img data-src="/img/gallery/2.jpg" alt="Gallery 2">

// In JavaScript, initialize loader
window.DashboardImageLoader.lazyLoadImages('img[data-src]');
```

**Preload specific images:**
```javascript
const urls = [
    '/img/gallery/1.jpg',
    '/img/gallery/2.jpg',
    '/img/gallery/3.jpg'
];

// Method 1: Direct module call
window.DashboardImageLoader.preloadImages(urls);

// Method 2: Legacy wrapper
window.preloadImages(urls);
```

**Load single image:**
```javascript
window.DashboardImageLoader.loadImage('/img/photo.jpg')
    .then((blob) => {
        // Image is loaded in memory
        const url = URL.createObjectURL(blob);
        imgElement.src = url;
    })
    .catch((error) => {
        console.error('Failed to load image:', error);
    });
```

**Clear image cache:**
```javascript
// Clear specific URL
window.DashboardImageLoader.clearImageCache('/img/photo.jpg');

// Clear all
window.DashboardImageLoader.clearImageCache();

// Check stats
const stats = window.DashboardImageLoader.getCacheStats();
console.log('Cached images:', stats.cachedImages);
console.log('Loading promises:', stats.loadingPromises);
```

---

### NSFW Content Manager

**Toggle NSFW on image:**
```html
<button onclick="window.toggleImageNSFW(this)" data-id="image123">
    <i class="bi bi-eye-fill"></i>
</button>

<!-- Or with modern API -->
<button class="toggle-nsfw-btn" data-id="image123">
    <i class="bi bi-eye-fill"></i>
</button>

<script>
    $('.toggle-nsfw-btn').on('click', function() {
        window.DashboardNSFWManager.toggleImageNSFW(this);
    });
</script>
```

**Toggle NSFW on other content types:**
```javascript
// Chat
window.toggleChatNSFW(buttonElement);

// Post
window.togglePostNSFW(buttonElement);

// Video
window.toggleVideoNSFW(buttonElement);
```

**Toggle global NSFW visibility:**
```javascript
// Show/hide all NSFW content
window.toggleNSFWContent();

// Or check state
if (window.DashboardNSFWManager.isNSFWVisible()) {
    console.log('NSFW content is visible');
}

// Or set directly
window.DashboardNSFWManager.setNSFWVisible(true);
```

**Update UI after changes:**
```javascript
// Automatically called after toggle, but can call manually
window.updateNSFWContentUI();
```

---

## 💡 Common Use Cases

### Use Case 1: Lazy Load Gallery Images

```javascript
// HTML structure
<div class="gallery">
    <img data-src="/img/gallery/1.jpg" class="gallery-img">
    <img data-src="/img/gallery/2.jpg" class="gallery-img">
    <img data-src="/img/gallery/3.jpg" class="gallery-img">
</div>

// JavaScript
$(document).ready(function() {
    window.DashboardImageLoader.lazyLoadImages('.gallery-img');
});
```

### Use Case 2: Apply Blur to NSFW Images

```javascript
// When rendering images
images.forEach((item) => {
    const $img = $(`<img data-src="${item.url}">`);
    gallery.append($img);
    
    if (window.shouldBlurNSFW(item, subscriptionStatus)) {
        window.blurImage($img[0]);
    }
});
```

### Use Case 3: Allow Users to Toggle NSFW

```html
<button class="nsfw-toggle" data-id="image-123" onclick="window.toggleImageNSFW(this)">
    <i class="bi bi-eye-fill"></i>
    Mark as NSFW
</button>

<!-- Or create filter UI -->
<label>
    <input type="checkbox" id="show-nsfw" onchange="window.toggleNSFWContent()">
    Show NSFW content
</label>
```

### Use Case 4: Preload Important Images

```javascript
// In gallery initialization
const importantUrls = [
    '/img/cover/hero.jpg',
    '/img/cover/featured.jpg'
];

window.preloadImages(importantUrls).then(() => {
    console.log('Hero images are loaded and cached');
});
```

---

## 🔧 Configuration

### Change Blur Amount

```javascript
// Modify configuration before using
window.DashboardImageBlurHandler.config.blurAmount = '10px';
window.DashboardImageBlurHandler.config.blurFilter = 'filter: blur(10px);';
```

### Change Lazy Load Threshold

```javascript
// Must be done before calling lazyLoadImages()
window.DashboardImageLoader.config.observerThreshold = 0.25;
window.DashboardImageLoader.config.observerRootMargin = '100px';

// Then reinitialize
window.DashboardImageLoader.init();
window.DashboardImageLoader.lazyLoadImages('img[data-src]');
```

### Change NSFW Endpoints

```javascript
// If your API uses different paths
window.DashboardNSFWManager.config.endpoints = {
    image: '/api/images/{id}/nsfw',
    chat: '/api/chats/{id}/nsfw',
    post: '/api/posts/{id}/nsfw',
    video: '/api/videos/{id}/nsfw'
};
```

---

## ⚠️ Common Pitfalls

### Pitfall 1: Calling Before Initialization

```javascript
// ❌ WRONG - Script hasn't loaded yet
window.blurImage(img);

// ✅ CORRECT - Wait for DOM ready
$(document).ready(function() {
    window.blurImage(img);
});
```

### Pitfall 2: Using Wrong Selector

```javascript
// ❌ WRONG - No images have data-src
window.DashboardImageLoader.lazyLoadImages('img');

// ✅ CORRECT - Target images with data-src
window.DashboardImageLoader.lazyLoadImages('img[data-src]');
```

### Pitfall 3: Not Checking Permissions

```javascript
// ❌ WRONG - Temporary users can't toggle
window.toggleImageNSFW(btn);  // May fail silently

// ✅ CORRECT - Check first
if (!window.user?.isTemporary) {
    window.toggleImageNSFW(btn);
}
```

### Pitfall 4: Clearing Cache Too Often

```javascript
// ❌ WRONG - Defeats the purpose of caching
window.DashboardImageLoader.clearImageCache();
// (called every second)

// ✅ CORRECT - Clear only when needed
// Manual cleanup on logout or major page change
$(window).on('logout', function() {
    window.DashboardImageLoader.clearImageCache();
});
```

---

## 🆘 Troubleshooting

### Images Not Loading

**Symptom:** Images stay blank despite being in viewport

**Solution:**
```javascript
// 1. Check if images have data-src attribute
console.log($('img[data-src]').length);

// 2. Verify lazy loading is initialized
console.log(window.DashboardImageLoader.observer);

// 3. Check cache stats
console.log(window.DashboardImageLoader.getCacheStats());

// 4. Manually load an image
window.DashboardImageLoader.loadImage('/test.jpg').then(() => {
    console.log('Manual load works');
});
```

### Blur Not Appearing

**Symptom:** NSFW images not showing blur effect

**Solution:**
```javascript
// 1. Check if shouldBlur is true
console.log(window.shouldBlurNSFW(item, subscriptionStatus));

// 2. Check if blur request succeeds
const stats = window.DashboardImageBlurHandler.getCacheStats();
console.log('Cached blurs:', stats.size);

// 3. Check if overlay HTML is created
console.log($('.gallery-nsfw-overlay').length);

// 4. Check CSS is applied
$('img.img-blur').each(function() {
    console.log($(this).css('filter'));
});
```

### NSFW Toggle Not Working

**Symptom:** Toggle button doesn't change NSFW status

**Solution:**
```javascript
// 1. Check if user is authenticated
console.log(window.user?._id);

// 2. Check if endpoint is correct
console.log(window.DashboardNSFWManager.config.endpoints);

// 3. Monitor AJAX request
$('#nsfw-btn').on('click', function() {
    console.log('Toggle clicked, sending request...');
});

// 4. Check for permission errors
window.DashboardNSFWManager.toggleImageNSFW(button);
// Check browser console for errors
```

---

## 📚 API Reference

### Image Blur Handler

```javascript
window.DashboardImageBlurHandler = {
    shouldBlurNSFW(item, subscriptionStatus) → boolean
    blurImage(imgElement) → void
    fetchBlurredImage(imgElement, imageUrl) → void
    createImageOverlay(imgElement, imageUrl) → void
    clearCache() → void
    getCacheStats() → {size, items}
    config: {...}
}

// Legacy
window.blurImage(imgElement) → void
window.shouldBlurNSFW(item, subscriptionStatus) → boolean
window.createOverlay(imgElement, imageUrl) → void
```

### Image Loader

```javascript
window.DashboardImageLoader = {
    init() → void
    lazyLoadImages(selector) → void
    loadImage(url, attempt?) → Promise<Blob>
    preloadImages(urls) → Promise<void>
    clearImageCache(url?) → void
    getCacheStats() → {cachedImages, loadingPromises, ...}
    destroy() → void
    config: {...}
}

// Legacy
window.lazyLoadImages(selector) → void
window.preloadImages(urls) → Promise<void>
```

### NSFW Manager

```javascript
window.DashboardNSFWManager = {
    toggleImageNSFW(el) → void
    toggleChatNSFW(el) → void
    togglePostNSFW(el) → void
    toggleVideoNSFW(el) → void
    toggleNSFWContent() → void
    updateContentUI() → void
    isNSFWVisible() → boolean
    setNSFWVisible(visible) → void
    config: {...}
}

// Legacy
window.toggleImageNSFW(el) → void
window.toggleChatNSFW(el) → void
window.togglePostNSFW(el) → void
window.toggleVideoNSFW(el) → void
window.toggleNSFWContent() → void
window.updateNSFWContentUI() → void
```

---

## ✅ Validation

**Phase 4 is working correctly if:**

- [ ] Blur appears on NSFW images when appropriate
- [ ] Images load when scrolled into view
- [ ] Toggle button changes NSFW status
- [ ] No JavaScript errors in console
- [ ] Performance is good (no lag)

**Test it:**
```javascript
// Test blur
window.DashboardImageBlurHandler.getCacheStats()

// Test loader
window.DashboardImageLoader.getCacheStats()

// Test NSFW manager
window.DashboardNSFWManager.isNSFWVisible()
```

---

## 📖 Full Documentation

For more details, see:
- `PHASE_4_README.md` - Overview and architecture
- `PHASE_4_IMPLEMENTATION.md` - Technical deep-dive
- `/docs/dashboard-enhancement/` - Full dashboard refactoring roadmap

---

**Ready to use Phase 4!** 🚀

Need help? Check the troubleshooting section above or refer to full documentation.
