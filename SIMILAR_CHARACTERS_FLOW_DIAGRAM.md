# Similar Characters Infinite Scroll - Visual Flow

## User Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Character Page Load                                            │
│  ─────────────────────                                          │
│                                                                  │
│  1. User visits /character/{slug}                               │
│                                                                  │
│  2. Page calls loadCharacterData(chatId)                        │
│     │                                                            │
│     └──> loadSimilarCharacters(chatId)                          │
│          │                                                       │
│          ├─> Initialize pagination state:                       │
│          │   • currentPage = 1                                  │
│          │   • hasMore = true                                   │
│          │   • loading = false                                  │
│          │                                                       │
│          ├─> fetchSimilarChats(chatId, page=1, limit=10)        │
│          │   │                                                   │
│          │   └─> GET /api/similar-chats/{chatId}?page=1&limit=10│
│          │       │                                               │
│          │       └─> Response: {                                │
│          │              similarChats: [10 characters],           │
│          │              pagination: {                            │
│          │                currentPage: 1,                        │
│          │                totalPages: 5,                         │
│          │                hasMore: true                          │
│          │              }                                        │
│          │            }                                          │
│          │                                                       │
│          ├─> displaySimilarCharacters(chars, append=false)      │
│          │   └─> Renders 10 character cards in horizontal grid  │
│          │                                                       │
│          └─> initializeSimilarCharactersScroll(chatId)          │
│              └─> Attaches scroll event listener                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                            ↓

┌─────────────────────────────────────────────────────────────────┐
│  User Scrolls Horizontally                                      │
│  ───────────────────────                                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ [Char1] [Char2] [Char3] ... [Char8] [Char9] [Char10] │      │
│  │  ←────────────────────  User scrolls  ─────────────→  │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
│  Scroll Event Listener:                                         │
│  1. Calculates distance from right edge                         │
│  2. If distance < 200px AND hasMore AND !loading:              │
│     └─> Trigger loadMoreSimilarCharacters()                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                            ↓

┌─────────────────────────────────────────────────────────────────┐
│  Load More Characters                                           │
│  ──────────────────────                                         │
│                                                                  │
│  loadMoreSimilarCharacters(chatId)                              │
│  │                                                               │
│  ├─> Set loading = true (prevent duplicate calls)               │
│  │                                                               │
│  ├─> Calculate nextPage = currentPage + 1                       │
│  │                                                               │
│  ├─> fetchSimilarChats(chatId, page=2, limit=10)                │
│  │   │                                                           │
│  │   └─> GET /api/similar-chats/{chatId}?page=2&limit=10       │
│  │       │                                                       │
│  │       └─> Response: {                                        │
│  │              similarChats: [10 more characters],              │
│  │              pagination: {                                    │
│  │                currentPage: 2,                                │
│  │                totalPages: 5,                                 │
│  │                hasMore: true                                  │
│  │              }                                                │
│  │            }                                                  │
│  │                                                               │
│  ├─> Update state:                                              │
│  │   • currentPage = 2                                          │
│  │   • hasMore = true                                           │
│  │   • loading = false                                          │
│  │                                                               │
│  └─> displaySimilarCharacters(chars, append=true)               │
│      └─> Appends 10 new character cards to existing grid        │
│                                                                  │
│  Now showing: 20 characters total                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                            ↓

┌─────────────────────────────────────────────────────────────────┐
│  User Continues Scrolling                                       │
│  ──────────────────────────                                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [1][2][3]...[18][19][20] ◄─ User keeps scrolling ────→ │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Process repeats:                                               │
│  • Page 3 → 30 characters                                       │
│  • Page 4 → 40 characters                                       │
│  • Page 5 → 50 characters                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                            ↓

┌─────────────────────────────────────────────────────────────────┐
│  All Characters Loaded                                          │
│  ───────────────────────                                        │
│                                                                  │
│  After Page 5:                                                  │
│  • currentPage = 5                                              │
│  • totalPages = 5                                               │
│  • hasMore = false  ← No more loading                           │
│                                                                  │
│  User can still scroll, but no more API calls are made          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [1][2][3]...[48][49][50] ◄─ End of list ──────────────┤    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Backend Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  API Request: GET /api/similar-chats/{chatId}?page=2&limit=10  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Input Validation                                               │
│  ────────────────                                               │
│  • Parse page & limit                                           │
│  • Validate: page (1-100), limit (1-50)                         │
│  • Handle NaN cases                                             │
│  • Calculate skip = (page - 1) * limit                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Cache Check                                                    │
│  ───────────                                                    │
│  • Check similarChatsCache collection                           │
│  • Key: {chatId}_{language}                                    │
│  • Valid if created < 24 hours ago                              │
│                                                                  │
│  If cached:                                                     │
│  └─> Return paginated slice of cached results                   │
│                                                                  │
│  If not cached:                                                 │
│  └─> Continue to similarity calculation                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Similarity Calculation                                         │
│  ──────────────────────                                         │
│  1. Check similarity matrix (7-day cache)                       │
│  2. If matrix exists:                                           │
│     └─> Use pre-calculated scores                              │
│  3. If no matrix:                                               │
│     ├─> Calculate Jaccard similarity with other characters     │
│     ├─> Score based on prompt token overlap                     │
│     ├─> Sort by composite score (60% similarity + 40% images)   │
│     └─> Store top 50 in similarity matrix                      │
│                                                                  │
│  Result: Up to 50 similar characters                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Pagination & Response                                          │
│  ─────────────────────                                          │
│  • Total results: 50 characters                                 │
│  • Requested page: 2, limit: 10                                 │
│  • Skip: 10, Take: 10                                           │
│  • Results: Characters 11-20                                    │
│                                                                  │
│  Build response:                                                │
│  {                                                               │
│    similarChats: [chars 11-20],                                 │
│    pagination: {                                                │
│      currentPage: 2,                                            │
│      totalPages: 5,      // ceil(50 / 10)                      │
│      totalResults: 50,                                          │
│      limit: 10,                                                 │
│      hasMore: true       // 2 < 5                              │
│    }                                                             │
│  }                                                               │
│                                                                  │
│  Cache results for 24 hours                                     │
└─────────────────────────────────────────────────────────────────┘
```

## State Management

```
window.characterProfile.similarCharacters = {
  currentPage: 2,           // Current page loaded
  totalPages: 5,            // Total pages available
  hasMore: true,            // Whether more pages exist
  loading: false,           // Prevent duplicate requests
  chatId: "abc123",         // Current character ID
  scrollListener: fn        // Reference for cleanup
}
```

## Scroll Detection Logic

```
Grid Visualization:
┌─────────────────────────────────────────────────────────┐
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │[Visible Area - clientWidth]                      │   │
│ │                                                   │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│                    scrollLeft ──────►                   │
│ ├──────────────────────────────────────────────────────►│
│                                                          │
│                                     ◄── 200px ──┤       │
│                                     Trigger Zone│       │
│                                                  │       │
│                                        scrollWidth      │
└─────────────────────────────────────────────────────────┘

Calculation:
  distanceFromEnd = scrollWidth - (scrollLeft + clientWidth)
  
  if distanceFromEnd < 200 AND hasMore AND !loading:
    loadMoreSimilarCharacters()
```

## Key Constants

```javascript
// Frontend (character-profile-loader.js)
SIMILAR_CHARACTERS_INITIAL_PAGE = 1
SIMILAR_CHARACTERS_LIMIT = 10
SIMILAR_CHARACTERS_SCROLL_THRESHOLD = 200

// Backend (routes/api.js)
MAX_PAGE = 100
MAX_LIMIT = 50
DEFAULT_PAGE = 1
DEFAULT_LIMIT = 10
MATRIX_SIZE = 50
```

## Performance Metrics

```
Initial Load:
  ├─ API Request: ~100-500ms (first time)
  ├─ API Request: ~10-50ms (cached)
  └─ Render: ~10-20ms

Infinite Scroll:
  ├─ Scroll Detection: <1ms
  ├─ API Request: ~50-200ms
  └─ Append Render: ~10-20ms

Memory:
  ├─ Per Character Card: ~2KB
  ├─ 50 Characters: ~100KB
  └─ Event Listeners: 1 per page load
```
