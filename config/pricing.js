/**
 * Centralized Pricing Configuration
 * All costs for various features in the application
 * Values are in points
 */

const PRICING_CONFIG = {
  // Image Generation
  IMAGE_GENERATION: {
    BASE_COST_PER_IMAGE: 50,
    DESCRIPTION: 'Cost per image generated'
  },

  // Image Upscaling
  IMAGE_UPSCALE: {
    COST: 20,
    DESCRIPTION: 'Cost to upscale an image'
  },

  // Face Merging
  FACE_MERGE: {
    COST: 30,
    DESCRIPTION: 'Cost to merge faces in an image'
  },

  // Video Generation
  VIDEO_GENERATION: {
    COST: 100,
    DESCRIPTION: 'Cost to generate video from image'
  },

  // Text-to-Speech
  TEXT_TO_SPEECH: {
    COST: 15,
    DESCRIPTION: 'Cost for text-to-speech generation'
  },

  // Custom Prompts (dynamic based on prompt data)
  CUSTOM_PROMPT: {
    DEFAULT_COST: 0,
    DESCRIPTION: 'Cost for using custom prompts (varies by prompt)'
  },

  // Gifts (dynamic based on gift data)
  GIFT: {
    DEFAULT_COST: 0,
    DESCRIPTION: 'Cost for using gifts (varies by gift)'
  }
};

/**
 * Get cost for image generation based on number of images
 * @param {number} imageCount - Number of images to generate
 * @returns {number} Total cost in points
 */
function getImageGenerationCost(imageCount = 1) {
  return PRICING_CONFIG.IMAGE_GENERATION.BASE_COST_PER_IMAGE * imageCount;
}

/**
 * Get cost for image upscaling
 * @returns {number} Cost in points
 */
function getImageUpscaleCost() {
  return PRICING_CONFIG.IMAGE_UPSCALE.COST;
}

/**
 * Get cost for face merging
 * @returns {number} Cost in points
 */
function getFaceMergeCost() {
  return PRICING_CONFIG.FACE_MERGE.COST;
}

/**
 * Get cost for video generation
 * @returns {number} Cost in points
 */
function getVideoGenerationCost() {
  return PRICING_CONFIG.VIDEO_GENERATION.COST;
}

/**
 * Get cost for text-to-speech
 * @returns {number} Cost in points
 */
function getTextToSpeechCost() {
  return PRICING_CONFIG.TEXT_TO_SPEECH.COST;
}

/**
 * Get cost for custom prompt (from prompt data or default)
 * @param {Object} promptData - Prompt data object
 * @returns {number} Cost in points
 */
function getCustomPromptCost(promptData = null) {
  return promptData?.cost || PRICING_CONFIG.CUSTOM_PROMPT.DEFAULT_COST;
}

/**
 * Get cost for gift (from gift data or default)
 * @param {Object} giftData - Gift data object
 * @returns {number} Cost in points
 */
function getGiftCost(giftData = null) {
  return giftData?.cost || PRICING_CONFIG.GIFT.DEFAULT_COST;
}

/**
 * Get all pricing information for admin/display purposes
 * @returns {Object} Complete pricing configuration
 */
function getAllPricing() {
  return {
    ...PRICING_CONFIG,
    helpers: {
      getImageGenerationCost,
      getImageUpscaleCost,
      getFaceMergeCost,
      getVideoGenerationCost,
      getTextToSpeechCost,
      getCustomPromptCost,
      getGiftCost
    }
  };
}

module.exports = {
  PRICING_CONFIG,
  getImageGenerationCost,
  getImageUpscaleCost,
  getFaceMergeCost,
  getVideoGenerationCost,
  getTextToSpeechCost,
  getCustomPromptCost,
  getGiftCost,
  getAllPricing
};