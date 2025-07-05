// Cache configuration
const CACHE_KEY = 'category_cards_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

window.loadCategoryCards = async function() {
  try {
    // Check cache first
    const cachedData = getCachedCategories();
    if (cachedData) {
      displayCategoryCards(cachedData);
      return;
    }

    const response = await fetch('/categories/images', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to load categories');
    }
    
    const data = await response.json();
    
    // Cache the data
    setCachedCategories(data.categories);
    
    displayCategoryCards(data.categories);
    
  } catch (error) {
    console.error('Error loading category cards:', error);
    // Show fallback content
    $('#category-cards-container').html(`
      <div class="col-12 text-center">
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i>
          Failed to load categories. Please try again later.
        </div>
      </div>
    `);
  }
};

// Cache helper functions
function getCachedCategories() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_DURATION;
    
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error reading cache:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function setCachedCategories(categories) {
  try {
    const cacheData = {
      data: categories,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

function displayCategoryCards(categories) {
  let htmlContent = '';
  
  categories.forEach(categoryData => {
    const { category, icon, image } = categoryData;
    
    htmlContent += `
      <div class="col-6 col-md-4 col-lg-2 mb-4">
        <div class="card category-card h-100 shadow border-0 overflow-hidden position-relative" 
             style="cursor: pointer; transition: all 0.3s ease; min-height: 280px;"
             onclick="handleCategoryClick('${category}')">
          
          <!-- Background Image -->
          <div class="position-absolute top-0 start-0 w-100 h-100" 
               style="background-image: url('${image.imageUrl}'); 
                      background-size: cover; 
                      background-position: center;">
          </div>
          
          <!-- Light Overlay -->
          <div class="position-absolute top-0 start-0 w-100 h-100" 
               style="background: linear-gradient(to bottom, rgba(110, 32, 244, 0.2) 0%, rgba(130, 64, 255, 0.4) 100%);">
          </div>
          
          <!-- Content -->
          <div class="card-body d-flex flex-column justify-content-end align-items-center text-center position-relative" 
               style="min-height: 280px; z-index: 2; padding: 1.5rem;">
            <div class="mb-3">
              <i class="${icon} fs-1 text-white mb-2" style="text-shadow: 0 3px 6px rgba(0,0,0,0.6);"></i>
            </div>
            <h6 class="card-title text-white fw-bold mb-0" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8); font-size: 1rem;">
              ${category}
            </h6>
          </div>
        </div>
      </div>
    `;
  });
  
  $('#category-cards-container').html(htmlContent);
  
  // Add hover effects
  $('.category-card').hover(
    function() {
      $(this).css('transform', 'translateY(-8px) scale(1.03)');
      $(this).find('.position-absolute:nth-child(2)').css('background', 'linear-gradient(to bottom, rgba(110, 32, 244, 0.1) 0%, rgba(130, 64, 255, 0.2) 100%)');
    },
    function() {
      $(this).css('transform', 'translateY(0) scale(1)');
      $(this).find('.position-absolute:nth-child(2)').css('background', 'linear-gradient(to bottom, rgba(110, 32, 244, 0.2) 0%, rgba(130, 64, 255, 0.4) 100%)');
    }
  );
}

window.handleCategoryClick = function(category) {
  // Redirect to search with category
  window.location.href = `/search?q=${encodeURIComponent(category.toLowerCase())}`;
};

// Load categories when document is ready
$(document).ready(function() {
  // Load category cards if the container exists
  if ($('#category-cards-container').length > 0) {
    loadCategoryCards();
  }
});