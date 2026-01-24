# Testing Guide - Like Button & Favorites Implementation

## Overview
This guide provides step-by-step instructions for testing the new like and favorite button features.

## Prerequisites
- Server running
- User account (not temporary)
- Access to both desktop and mobile browsers

## Test Cases

### 1. Gallery Like Button - Desktop

#### Test 1.1: Button Visibility
**Steps:**
1. Navigate to the main character gallery page
2. Observe character cards

**Expected Results:**
- Each character card has a circular like button in the bottom-right corner
- Button has purple gradient background
- Heart icon is empty (bi-heart)
- Button opacity is 0.9

**Screenshot Location:** Desktop with multiple character cards showing like buttons

#### Test 1.2: Hover Effects
**Steps:**
1. Hover mouse over a like button
2. Observe visual changes

**Expected Results:**
- Button scales to 110%
- Opacity increases to 1.0
- Shadow becomes more pronounced
- Smooth transition (0.3s)

#### Test 1.3: Like Action
**Steps:**
1. Click on an empty heart button
2. Wait for API response

**Expected Results:**
- Button immediately changes to pink gradient
- Heart icon fills (bi-heart-fill)
- Heart beat animation plays
- Success notification appears
- State persists on page refresh

#### Test 1.4: Unlike Action
**Steps:**
1. Click on a filled heart button
2. Wait for API response

**Expected Results:**
- Button changes back to purple gradient
- Heart icon empties (bi-heart)
- Success notification appears
- State persists on page refresh

#### Test 1.5: Multiple Cards
**Steps:**
1. Like multiple characters (3-5)
2. Scroll through gallery

**Expected Results:**
- All liked cards show pink filled hearts
- Unliked cards show purple empty hearts
- States are independent
- No lag or performance issues

#### Test 1.6: Pagination
**Steps:**
1. Like a character
2. Navigate to next page
3. Return to first page

**Expected Results:**
- Liked state persists
- Button states load correctly on page change
- No flickering or state loss

### 2. Gallery Like Button - Mobile

#### Test 2.1: Button Visibility Mobile
**Steps:**
1. Open gallery on mobile browser (or DevTools mobile view)
2. Observe character cards

**Expected Results:**
- Like buttons are visible (40px size)
- Always visible (opacity: 1.0)
- Positioned at bottom-right with 10px offset
- Does not interfere with card tap to open

#### Test 2.2: Single Tap
**Steps:**
1. Tap on a character card (not on the like button)
2. Observe navigation

**Expected Results:**
- Opens character profile page
- Like button does not interfere

#### Test 2.3: Tap Like Button
**Steps:**
1. Tap directly on the like button
2. Wait for API response

**Expected Results:**
- Character does NOT navigate to profile
- Like state toggles
- Button changes color and icon
- No double navigation

#### Test 2.4: Double Tap Feature
**Steps:**
1. Double-tap quickly on a character card (< 300ms between taps)
2. Observe animations

**Expected Results:**
- Large heart icon appears in center (60px)
- Heart scales from 0 → 1.2 → 0.8
- Fades from 0 → 1 → 0 over 0.6s
- Like button fills with pink
- Character is added to favorites

#### Test 2.5: Double Tap Already Liked
**Steps:**
1. Double-tap on an already liked character
2. Observe behavior

**Expected Results:**
- Unlike action is triggered
- Heart animation still plays
- Button changes to empty purple heart

### 3. Character Profile Favorite Button

#### Test 3.1: Button Presence
**Steps:**
1. Navigate to any character profile
2. Look at action button row

**Expected Results:**
- Star button visible between "Start Chat" and Share buttons
- 44px square button
- Transparent background with gray border
- Empty star icon (bi-star)

#### Test 3.2: Add to Favorites
**Steps:**
1. Click the star button
2. Wait for API response

**Expected Results:**
- Button background changes to golden gradient
- Border changes to golden (#FFD700)
- Star fills (bi-star-fill)
- Star pulse animation plays (0.5s)
- Success notification appears
- Title changes to "Remove from favorites"

#### Test 3.3: Remove from Favorites
**Steps:**
1. Click the filled star button
2. Wait for API response

**Expected Results:**
- Button returns to transparent background
- Border returns to gray
- Star empties (bi-star)
- Success notification appears
- Title changes to "Add to favorites"

#### Test 3.4: State Persistence
**Steps:**
1. Favorite a character
2. Navigate away
3. Return to character profile

**Expected Results:**
- Favorite state is maintained
- Button shows filled golden star
- State loads immediately (from cache)

#### Test 3.5: Sync with Gallery
**Steps:**
1. Favorite a character from profile page
2. Navigate back to gallery
3. Find the same character card

**Expected Results:**
- Gallery like button shows pink filled heart
- Both buttons reflect same state
- No desync between views

### 4. Login State Handling

#### Test 4.1: Temporary User - Gallery
**Steps:**
1. Log out or use incognito mode
2. View gallery
3. Click a like button

**Expected Results:**
- Login modal/form appears
- Like action does not execute
- Redirect to login page

#### Test 4.2: Temporary User - Profile
**Steps:**
1. As temporary user, view character profile
2. Look for favorite button

**Expected Results:**
- Favorite button NOT visible (hidden by {{#unless user.isTemporary}})
- Only "Start Chat" button shown
- Clicking "Start Chat" prompts login

### 5. Error Handling

#### Test 5.1: API Failure - Like
**Steps:**
1. Simulate network error (disconnect or use DevTools)
2. Click like button
3. Wait for timeout

**Expected Results:**
- Optimistic UI update shown
- Error notification appears
- Button reverts to previous state
- User can retry

#### Test 5.2: API Failure - Favorite
**Steps:**
1. Simulate network error
2. Click favorite button
3. Wait for timeout

**Expected Results:**
- Optimistic UI update shown
- Error notification appears
- Button reverts to previous state
- User can retry

### 6. Performance Testing

#### Test 6.1: Large Gallery
**Steps:**
1. Load gallery with 50+ characters
2. Scroll through all
3. Like multiple characters

**Expected Results:**
- No lag or stuttering
- Smooth scrolling
- Buttons respond quickly
- Animations are smooth (60fps)

#### Test 6.2: Rapid Clicking
**Steps:**
1. Rapidly click like button 10+ times
2. Observe behavior

**Expected Results:**
- Button handles all clicks
- No race conditions
- Final state matches API response
- No duplicate requests

### 7. Accessibility Testing

#### Test 7.1: Keyboard Navigation
**Steps:**
1. Use Tab key to navigate
2. Tab to a like button
3. Press Enter/Space

**Expected Results:**
- Like button receives focus
- Visible focus outline (2px purple with offset)
- Enter/Space triggers like action
- Keyboard navigation works smoothly

#### Test 7.2: Screen Reader
**Steps:**
1. Enable screen reader (NVDA, JAWS, VoiceOver)
2. Navigate to like button
3. Listen to announcement

**Expected Results:**
- Button announced as "Add to favorites" or "Remove from favorites"
- Role announced as "button"
- State change announced when clicked

#### Test 7.3: Touch Targets
**Steps:**
1. On mobile, try to tap buttons
2. Measure tap target size

**Expected Results:**
- All buttons are at least 40px × 40px
- Easy to tap without mistakes
- Adequate spacing between buttons (8px)

#### Test 7.4: Reduced Motion
**Steps:**
1. Enable "Reduce Motion" in OS settings
2. Like/favorite characters

**Expected Results:**
- No animations play
- State changes are instant
- Functionality still works
- No jarring movements

### 8. Cross-Browser Testing

Test on:
- Chrome (Desktop & Mobile)
- Firefox (Desktop & Mobile)
- Safari (Desktop & iOS)
- Edge (Desktop)

Check:
- Button rendering
- Gradient backgrounds
- Animations
- Touch events (mobile)
- API integration

### 9. Responsive Testing

Test at these breakpoints:
- 320px (Small mobile)
- 375px (iPhone)
- 768px (Tablet)
- 1024px (Small desktop)
- 1920px (Large desktop)

Check:
- Button sizes
- Button positions
- Hover effects (desktop only)
- Touch targets (mobile only)

## Acceptance Criteria

✅ All buttons visible and functional
✅ Animations smooth and professional
✅ No console errors
✅ State persists across page loads
✅ Mobile double-tap works
✅ Desktop hover effects work
✅ Accessibility standards met
✅ Login prompt for guest users
✅ Error handling works correctly
✅ Performance is acceptable

## Known Issues / Limitations

None currently identified.

## Reporting Issues

When reporting issues, include:
1. Browser and version
2. Device type (desktop/mobile)
3. Screen size
4. Steps to reproduce
5. Expected vs actual behavior
6. Screenshots if applicable
7. Console errors if any
