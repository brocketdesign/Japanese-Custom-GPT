#!/usr/bin/env node

/**
 * Generate thumbnails from first frame of videos
 * Usage: node scripts/generate-video-thumbnails.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VIDEO_DIR = path.join(__dirname, '..', 'public', 'img', 'cold-onboarding');
const THUMBNAIL_EXT = '.jpg';

/**
 * Check if ffmpeg is available
 */
function checkFFmpeg() {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Find all .mp4 files recursively
 */
function findVideoFiles(dir) {
    const videoFiles = [];
    
    function walkDir(currentDir) {
        const files = fs.readdirSync(currentDir);
        
        for (const file of files) {
            const fullPath = path.join(currentDir, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                walkDir(fullPath);
            } else if (file.endsWith('.mp4')) {
                videoFiles.push(fullPath);
            }
        }
    }
    
    walkDir(dir);
    return videoFiles;
}

/**
 * Generate thumbnail from video first frame
 */
function generateThumbnail(videoPath) {
    const thumbnailPath = videoPath.replace('.mp4', THUMBNAIL_EXT);
    
    // Skip if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
        console.log(`⏭️  Thumbnail already exists: ${path.basename(thumbnailPath)}`);
        return false;
    }
    
    try {
        // Extract first frame at 0.1 seconds (to avoid black frames)
        const command = `ffmpeg -i "${videoPath}" -ss 0.1 -vframes 1 -q:v 2 "${thumbnailPath}" -y`;
        execSync(command, { stdio: 'pipe' });
        console.log(`✅ Generated: ${path.basename(thumbnailPath)}`);
        return true;
    } catch (error) {
        console.error(`❌ Error generating thumbnail for ${path.basename(videoPath)}:`, error.message);
        return false;
    }
}

/**
 * Main function
 */
function main() {
    console.log('🎬 Video Thumbnail Generator\n');
    
    // Check if ffmpeg is available
    if (!checkFFmpeg()) {
        console.error('❌ Error: ffmpeg is not installed or not in PATH');
        console.error('Please install ffmpeg:');
        console.error('  macOS: brew install ffmpeg');
        console.error('  Linux: sudo apt-get install ffmpeg');
        console.error('  Windows: Download from https://ffmpeg.org/download.html');
        process.exit(1);
    }
    
    // Check if video directory exists
    if (!fs.existsSync(VIDEO_DIR)) {
        console.error(`❌ Error: Video directory not found: ${VIDEO_DIR}`);
        process.exit(1);
    }
    
    // Find all video files
    console.log(`📁 Scanning for videos in: ${VIDEO_DIR}\n`);
    const videoFiles = findVideoFiles(VIDEO_DIR);
    
    if (videoFiles.length === 0) {
        console.log('⚠️  No .mp4 files found');
        process.exit(0);
    }
    
    console.log(`Found ${videoFiles.length} video file(s)\n`);
    
    // Generate thumbnails
    let successCount = 0;
    let skipCount = 0;
    
    for (const videoFile of videoFiles) {
        const relativePath = path.relative(VIDEO_DIR, videoFile);
        console.log(`Processing: ${relativePath}`);
        
        const result = generateThumbnail(videoFile);
        if (result === null) {
            skipCount++;
        } else if (result) {
            successCount++;
        }
        console.log('');
    }
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   ✅ Generated: ${successCount}`);
    console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
    console.log(`   ❌ Failed: ${videoFiles.length - successCount - skipCount}`);
    console.log('\n✨ Done!');
}

// Run the script
main();
