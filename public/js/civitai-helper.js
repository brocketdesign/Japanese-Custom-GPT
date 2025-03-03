/**
 * Search for models on Civitai by name
 * @param {string} modelName - The model name to search for
 * @param {boolean} includeNsfw - Whether to include NSFW content
 * @returns {Promise<Array>} - Array of model results
 */
async function searchCivitaiModels(modelName, includeNsfw = false) {
  try {
    const nsfwParam = includeNsfw ? '' : '&nsfw=false';
    const url = `https://civitai.com/api/v1/models?limit=10&query=${encodeURIComponent(modelName)}${nsfwParam}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.items || [];
  } catch (error) {
    console.error('Error searching Civitai models:', error);
    return [];
  }
}

/**
 * Fetch model versions for a specific model
 * @param {number} modelId - The model ID
 * @returns {Promise<Array>} - Array of model versions
 */
async function fetchModelVersions(modelId) {
  try {
    const url = `https://civitai.com/api/v1/model-versions?modelId=${modelId}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.items || [];
  } catch (error) {
    console.error('Error fetching model versions:', error);
    return [];
  }
}

/**
 * Fetch example images for a specific model version
 * @param {number} modelVersionId - The model version ID
 * @param {boolean} includeNsfw - Whether to include NSFW content
 * @returns {Promise<Array>} - Array of images
 */
async function fetchModelImages(modelVersionId, includeNsfw = false) {
  try {
    const nsfwParam = includeNsfw ? '' : '&nsfw=false';
    const url = `https://civitai.com/api/v1/images?limit=5&modelVersionId=${modelVersionId}${nsfwParam}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.items || [];
  } catch (error) {
    console.error('Error fetching model images:', error);
    return [];
  }
}
