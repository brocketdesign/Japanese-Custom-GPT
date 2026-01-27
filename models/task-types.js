/**
 * Task Type Constants
 * Shared constants for task type identification across the application
 */

/**
 * Image generation task types from Novita AI
 */
const IMAGE_TASK_TYPES = [
  'TXT_TO_IMG',
  'IMG_TO_IMG', 
  'HUNYUAN_IMAGE_3',
  'FLUX_2_FLEX',
  'FLUX_2_DEV',
  'FLUX_1_KONTEXT_DEV',
  'FLUX_1_KONTEXT_PRO',
  'FLUX_1_KONTEXT_MAX',
  'Z_IMAGE_TURBO'
];

/**
 * Video generation task types from Novita AI and custom tasks
 */
const VIDEO_TASK_TYPES = [
  'img2video',           // Custom internal task type
  'IMG_TO_VIDEO',        // Generic Novita video task
  'WAN_2_2_I2V',         // Wan 2.2 image-to-video
  'WAN_2_5_I2V_PREVIEW', // Wan 2.5 image-to-video preview
  'MINIMAX_VIDEO_01',    // MiniMax video model
  'WAN_2_2_T2V',         // Wan 2.2 text-to-video
  'WAN_2_5_T2V_PREVIEW', // Wan 2.5 text-to-video preview
  'HUNYUAN_VIDEO_FAST'   // Hunyuan fast video model
];

/**
 * Check if a task type is a video task
 * @param {string} taskType - The task type to check
 * @param {string} taskId - Optional task ID for additional checks (e.g., img2video- prefix)
 * @returns {boolean} True if the task is a video task
 */
function isVideoTask(taskType, taskId = '') {
  return VIDEO_TASK_TYPES.includes(taskType) || taskId.startsWith('img2video-');
}

/**
 * Check if a task type is an image task
 * @param {string} taskType - The task type to check
 * @returns {boolean} True if the task is an image task
 */
function isImageTask(taskType) {
  return IMAGE_TASK_TYPES.includes(taskType);
}

module.exports = {
  IMAGE_TASK_TYPES,
  VIDEO_TASK_TYPES,
  isVideoTask,
  isImageTask
};
