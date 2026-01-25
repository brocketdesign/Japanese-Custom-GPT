# Schedule & CronJob Modal - Character Selection & Custom Prompts Update

## Overview
Updated the Schedule and CronJob creation dashboard modals to provide a better user experience with:
1. **Compact character selection list** - Similar to the history page template design, with character thumbnails and names
2. **Proper custom prompt image display** - Shows actual prompt images instead of placeholders

## Changes Made

### 1. HTML Structure Update
**File**: [views/dashboard/schedules.hbs](views/dashboard/schedules.hbs)

**Change**: Replaced the simple dropdown select for character selection with a scrollable list container.

**Before**:
```html
<select id="actionCharacter" class="form-select bg-secondary text-white border-secondary">
    <option value="">{{translations.dashboard.noCharacter}}</option>
    <!-- Characters loaded dynamically -->
</select>
```

**After**:
```html
<div id="characterSelectionContainer" class="character-selection-list">
    <!-- Characters loaded dynamically -->
    <div class="text-center py-3">
        <div class="spinner-border text-primary spinner-border-sm" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted mt-2 mb-0 small">Loading characters...</p>
    </div>
</div>
```

### 2. JavaScript Updates
**File**: [public/js/dashboard-schedules.js](public/js/dashboard-schedules.js)

#### Added Properties:
- `selectedCharacterId` - Stores the currently selected character ID

#### New Methods:
- `escapeHtml(text)` - Safely escapes HTML special characters to prevent XSS
- `selectCharacter(characterId, itemElement)` - Handles character selection with active state management

#### Updated Methods:

**populateCharacterDropdown()**:
- Now renders a compact list of character items instead of dropdown options
- Each item includes:
  - Character thumbnail (circular image or icon placeholder)
  - Character name
  - Hover and active states
- Creates a "None" option for no character selection

```javascript
populateCharacterDropdown() {
  const container = document.getElementById('characterSelectionContainer');
  // Creates "None" item first
  // Then adds character items with thumbnails and names
  // Items are clickable and can be selected/deselected
}
```

**renderCustomPrompts()**:
- Updated to properly use `imagePreview` field from custom prompts API
- Falls back to `/img/placeholder.png` if image is not available
- Added error handling with `onerror` attribute to load fallback image

```javascript
renderCustomPrompts() {
  // ...
  const imageUrl = prompt.imagePreview || '/img/placeholder.png';
  img.src = imageUrl;
  img.onerror = () => { img.src = '/img/placeholder.png'; };
  // ...
}
```

**openCreateModal(type)**:
- Updated to work with new character selection list instead of dropdown
- Properly resets selected character ID
- Activates the "None" item on modal open
- Removes all active classes before resetting

```javascript
// Reset character selection
this.selectedCharacterId = '';
document.querySelectorAll('.character-selection-item').forEach(item => {
  item.classList.remove('active');
});
// Activate "None" item
const noneItem = document.querySelector('.character-selection-item[data-character-id=""]');
if (noneItem) {
  noneItem.classList.add('active');
}
```

**saveSchedule()**:
- Changed to use `this.selectedCharacterId` instead of `document.getElementById('actionCharacter').value`
- Now properly integrates with the new character selection system

```javascript
const characterId = this.selectedCharacterId || null;
```

### 3. CSS Styling
**File**: [public/css/dashboard-schedules.css](public/css/dashboard-schedules.css)

#### New Styles Added:

**Character Selection List** - Compact scrollable container:
```css
.character-selection-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(110, 32, 244, 0.2);
}
```

**Character Selection Item** - Individual character option:
```css
.character-selection-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
}

.character-selection-item:hover {
  background: rgba(181, 138, 254, 0.1);
  border-color: rgba(181, 138, 254, 0.3);
}

.character-selection-item.active {
  background: rgba(181, 138, 254, 0.2);
  border-color: rgba(181, 138, 254, 0.6);
  box-shadow: 0 0 12px rgba(181, 138, 254, 0.3);
}
```

**Character Avatar** - Thumbnail container:
```css
.character-item-avatar {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}
```

**Custom Scrollbar** - For better UX:
```css
.character-selection-list::-webkit-scrollbar { ... }
.character-selection-list::-webkit-scrollbar-track { ... }
.character-selection-list::-webkit-scrollbar-thumb { ... }
```

## Design Benefits

### 1. **Compact Character Display**:
- Shows character thumbnails and names inline
- Similar to the history page template design
- Fits nicely within modal constraints (max-height: 300px)
- Responsive with proper scrolling

### 2. **Better Custom Prompt Display**:
- Now shows actual custom prompt images via `imagePreview`
- Proper fallback to placeholder image if needed
- Maintains existing grid layout and styling

### 3. **Improved UX**:
- Visual feedback with hover and active states
- Smooth transitions and animations
- Clear indication of selected items
- Mobile-friendly compact layout

## Testing Recommendations

1. **Character Selection**:
   - Open schedule/cron job modal
   - Verify characters load with thumbnails
   - Test selection and deselection
   - Verify "None" option is available
   - Check that selected character ID is saved

2. **Custom Prompts**:
   - Open custom prompts section
   - Verify prompt images load correctly
   - Test selection of multiple prompts
   - Verify fallback to placeholder works

3. **Form Submission**:
   - Create schedule with character selected
   - Create schedule without character
   - Verify data is saved correctly
   - Edit schedule and check character selection persists

## API Integration

The implementation uses:
- **Character data**: `/api/schedules/user-characters` - Returns list of user's characters
- **Custom prompts data**: `/api/schedules/custom-prompts` - Returns prompts with `imagePreview` field

## Backward Compatibility

All changes are backward compatible:
- Existing schedule data structures are not affected
- Character selection is optional (defaults to null/empty)
- Custom prompts API already returns `imagePreview` field

## Files Modified

1. [views/dashboard/schedules.hbs](views/dashboard/schedules.hbs)
2. [public/js/dashboard-schedules.js](public/js/dashboard-schedules.js)
3. [public/css/dashboard-schedules.css](public/css/dashboard-schedules.css)
