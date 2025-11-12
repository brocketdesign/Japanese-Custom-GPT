/**
 * Chat Video Handler Module
 * 
 * Handles all video rendering and playback functionality
 * - Video URL retrieval by ID
 * - Video player creation and management
 * - Video placeholder handling
 * - Video tools integration
 * - Async video loading
 * 
 * @module ChatVideoHandler
 * @requires ChatState
 */

window.ChatVideoHandler = (function() {
    'use strict';

    // Private storage for video state
    const videoState = {
        loadedVideos: new Set(),
        playingVideos: new Set(),
        failedVideos: new Set()
    };

    /**
     * Get video URL by ID from current chat state
     * @param {string} videoId - Video identifier
     * @param {number} designStep - Design step number
     * @param {string} thumbnail - Thumbnail URL
     * @returns {string} Video URL or placeholder
     */
    function getVideoUrlById(videoId, designStep, thumbnail) {
        try {
            if (!videoId) return '';

            const state = window.ChatState ? window.ChatState.getState() : {};
            const chatData = state.chatData || {};
            
            // Handle different video sources
            if (chatData.videos && chatData.videos[videoId]) {
                const video = chatData.videos[videoId];
                return video.url || video.src || '';
            }

            // Fallback for inline video URLs
            if (typeof videoId === 'string' && 
                (videoId.includes('.mp4') || videoId.includes('.webm') || videoId.includes('.mov'))) {
                return videoId;
            }

            return '';
        } catch (error) {
            console.error('[ChatVideoHandler] Error getting video URL:', error);
            return '';
        }
    }

    /**
     * Display video asynchronously with loading state
     * @param {string} videoId - Video identifier
     * @param {HTMLElement} targetElement - Target container
     * @returns {Promise<void>}
     */
    function displayVideoAsync(videoId, targetElement) {
        return new Promise((resolve, reject) => {
            if (!targetElement) {
                reject(new Error('Target element is required'));
                return;
            }

            try {
                const videoUrl = getVideoUrlById(videoId);
                
                if (!videoUrl) {
                    reject(new Error('No video URL found'));
                    return;
                }

                // Create video player
                const player = createVideoPlayer(videoUrl, videoId);
                
                targetElement.innerHTML = '';
                targetElement.appendChild(player);
                
                videoState.loadedVideos.add(videoId);
                resolve();

            } catch (error) {
                videoState.failedVideos.add(videoId);
                reject(error);
            }
        });
    }

    /**
     * Create video player element
     * @param {string} videoUrl - Video URL
     * @param {string} videoId - Video identifier
     * @returns {HTMLElement} Video player container
     */
    function createVideoPlayer(videoUrl, videoId) {
        const playerContainer = document.createElement('div');
        playerContainer.className = 'video-player-container';
        playerContainer.dataset.videoId = videoId;

        // Create video element
        const video = document.createElement('video');
        video.className = 'chat-message-video';
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.dataset.videoid = videoId;

        // Set up event listeners
        video.addEventListener('play', () => {
            videoState.playingVideos.add(videoId);
            // Pause other videos
            pauseOtherVideos(videoId);
        });

        video.addEventListener('pause', () => {
            videoState.playingVideos.delete(videoId);
        });

        video.addEventListener('ended', () => {
            videoState.playingVideos.delete(videoId);
        });

        video.addEventListener('error', () => {
            videoState.failedVideos.add(videoId);
            console.error(`[ChatVideoHandler] Video error for ${videoId}`);
        });

        // Add source
        const source = document.createElement('source');
        source.src = videoUrl;
        
        // Detect video type from URL
        if (videoUrl.includes('.mp4')) {
            source.type = 'video/mp4';
        } else if (videoUrl.includes('.webm')) {
            source.type = 'video/webm';
        } else if (videoUrl.includes('.mov')) {
            source.type = 'video/quicktime';
        }

        video.appendChild(source);

        // Add fallback message
        const fallback = document.createElement('p');
        fallback.textContent = 'Your browser does not support the video tag.';
        video.appendChild(fallback);

        playerContainer.appendChild(video);

        // Add video tools
        const tools = generateVideoTools({
            id: videoId,
            url: videoUrl,
            player: video
        });
        playerContainer.appendChild(tools);

        return playerContainer;
    }

    /**
     * Pause all other videos except specified
     * @param {string} videoIdToKeepPlaying - Video ID to keep playing
     */
    function pauseOtherVideos(videoIdToKeepPlaying) {
        const videos = document.querySelectorAll('video[data-videoid]');
        videos.forEach(video => {
            if (video.dataset.videoid !== videoIdToKeepPlaying && !video.paused) {
                video.pause();
            }
        });
    }

    /**
     * Generate video tools (download, fullscreen, share, etc.)
     * @param {object} videoData - Video metadata and player reference
     * @returns {HTMLElement} Tools container
     */
    function generateVideoTools(videoData) {
        const toolsContainer = document.createElement('div');
        toolsContainer.className = 'video-tools';
        toolsContainer.dataset.videoId = videoData.id || '';

        const tools = [
            {
                id: 'download',
                icon: '⬇️',
                title: 'Download',
                handler: 'downloadVideo'
            },
            {
                id: 'fullscreen',
                icon: '⛶',
                title: 'Fullscreen',
                handler: 'fullscreenVideo'
            },
            {
                id: 'share',
                icon: '📤',
                title: 'Share',
                handler: 'shareVideo'
            }
        ];

        tools.forEach(tool => {
            const button = document.createElement('button');
            button.className = `video-tool-btn ${tool.id}-btn`;
            button.innerHTML = tool.icon;
            button.title = tool.title;
            button.dataset.action = tool.handler;
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (tool.handler === 'fullscreenVideo' && videoData.player) {
                    if (videoData.player.requestFullscreen) {
                        videoData.player.requestFullscreen();
                    } else if (videoData.player.webkitRequestFullscreen) {
                        videoData.player.webkitRequestFullscreen();
                    }
                } else {
                    // Trigger custom event for parent to handle
                    toolsContainer.dispatchEvent(new CustomEvent('videoTool', {
                        detail: { action: tool.handler, videoData: videoData }
                    }));
                }
            });
            toolsContainer.appendChild(button);
        });

        return toolsContainer;
    }

    /**
     * Update video display with new URL
     * @param {string} videoId - Video identifier
     * @param {string} videoUrl - New video URL
     */
    function updateVideoDisplay(videoId, videoUrl) {
        try {
            const state = window.ChatState ? window.ChatState.getState() : {};
            if (state.chatData && state.chatData.videos) {
                state.chatData.videos[videoId] = {
                    ...state.chatData.videos[videoId],
                    url: videoUrl
                };
            }

            // Update all instances of this video in DOM
            const elements = document.querySelectorAll(`[data-video-id="${videoId}"]`);
            elements.forEach(el => {
                const source = el.querySelector('source');
                if (source) {
                    source.src = videoUrl;
                    const video = el.querySelector('video');
                    if (video) {
                        video.load();
                    }
                }
            });

        } catch (error) {
            console.error('[ChatVideoHandler] Error updating video display:', error);
        }
    }

    /**
     * Check if video is loaded
     * @param {string} videoId - Video identifier
     * @returns {boolean}
     */
    function isVideoLoaded(videoId) {
        return videoState.loadedVideos.has(videoId);
    }

    /**
     * Check if video is currently playing
     * @param {string} videoId - Video identifier
     * @returns {boolean}
     */
    function isVideoPlaying(videoId) {
        return videoState.playingVideos.has(videoId);
    }

    /**
     * Stop all playing videos
     */
    function stopAllVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (!video.paused) {
                video.pause();
            }
        });
        videoState.playingVideos.clear();
    }

    /**
     * Clear all video state
     */
    function clearVideoState() {
        stopAllVideos();
        videoState.loadedVideos.clear();
        videoState.failedVideos.clear();
    }

    /**
     * Get video statistics
     * @returns {object} Video state statistics
     */
    function getVideoStats() {
        return {
            loaded: videoState.loadedVideos.size,
            playing: videoState.playingVideos.size,
            failed: videoState.failedVideos.size,
            total: videoState.loadedVideos.size + videoState.failedVideos.size
        };
    }

    // Public API
    return {
        getVideoUrlById,
        displayVideoAsync,
        createVideoPlayer,
        generateVideoTools,
        updateVideoDisplay,
        isVideoLoaded,
        isVideoPlaying,
        stopAllVideos,
        clearVideoState,
        getVideoStats,
        // Debugging
        logVideoState: () => {
            console.log('[ChatVideoHandler] State:', {
                loaded: Array.from(videoState.loadedVideos),
                playing: Array.from(videoState.playingVideos),
                failed: Array.from(videoState.failedVideos)
            });
        }
    };
})();

// Module registration
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
    window.ChatCore.registerModule('ChatVideoHandler', window.ChatVideoHandler);
}
