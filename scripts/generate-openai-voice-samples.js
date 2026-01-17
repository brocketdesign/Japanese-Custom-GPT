/**
 * OpenAI Voice Sample Generator Script
 * Generates voice samples in English, French, and Japanese for OpenAI voices
 * 
 * Usage: node scripts/generate-openai-voice-samples.js
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');

// OpenAI voice samples to generate
const OPENAI_VOICE_SAMPLES = {
    nova: {
        key: 'nova',
        gender: 'female',
        samples: {
            en: "Hello, I'm your AI companion. I'm here to chat, listen, and be by your side whenever you need me.",
            fr: "Bonjour, je suis votre compagne IA. Je suis là pour discuter, écouter et être à vos côtés.",
            ja: "こんにちは、私はあなたのAIコンパニオンです。いつでもそばにいますよ。"
        }
    },
    alloy: {
        key: 'alloy',
        gender: 'neutral',
        samples: {
            en: "Hello, I'm your AI companion. I'm here to chat, listen, and be by your side whenever you need me.",
            fr: "Bonjour, je suis votre compagne IA. Je suis là pour discuter, écouter et être à vos côtés.",
            ja: "こんにちは、私はあなたのAIコンパニオンです。いつでもそばにいますよ。"
        }
    },
    shimmer: {
        key: 'shimmer',
        gender: 'female',
        samples: {
            en: "Hello, I'm your AI companion. I'm here to chat, listen, and be by your side whenever you need me.",
            fr: "Bonjour, je suis votre compagne IA. Je suis là pour discuter, écouter et être à vos côtés.",
            ja: "こんにちは、私はあなたのAIコンパニオンです。いつでもそばにいますよ。"
        }
    },
    fable: {
        key: 'fable',
        gender: 'neutral',
        samples: {
            en: "Hello, I'm your AI companion. I'm here to chat, listen, and be by your side whenever you need me.",
            fr: "Bonjour, je suis votre compagne IA. Je suis là pour discuter, écouter et être à vos côtés.",
            ja: "こんにちは、私はあなたのAIコンパニオンです。いつでもそばにいますよ。"
        }
    }
};

/**
 * Generate a single OpenAI voice sample
 * @param {string} voiceKey - Voice identifier (nova, alloy, shimmer, fable)
 * @param {string} text - Text to synthesize
 * @param {string} language - Language code (en, fr, ja)
 * @returns {Promise<Buffer>} - Audio buffer
 */
async function generateOpenAIVoiceSample(voiceKey, text, language) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const openai = new OpenAI({
        apiKey: apiKey
    });

    console.log(`  Generating ${voiceKey} in ${language}...`);

    try {
        const response = await openai.audio.speech.create({
            model: 'gpt-4o-mini-tts',
            voice: voiceKey,
            input: text
        });

        // Convert response to buffer
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer;
    } catch (error) {
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDir(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

/**
 * Generate all OpenAI voice samples
 */
async function generateAllSamples() {
    const outputDir = path.join(__dirname, '..', 'public', 'audio', 'voice-samples', 'openai');
    
    console.log('🎙️  OpenAI Voice Sample Generator');
    console.log('==================================\n');
    
    // Ensure output directories exist
    await ensureDir(outputDir);
    await ensureDir(path.join(outputDir, 'en'));
    await ensureDir(path.join(outputDir, 'fr'));
    await ensureDir(path.join(outputDir, 'ja'));

    const results = {
        success: [],
        failed: []
    };

    // Generate samples for each voice and language
    for (const [voiceKey, voiceConfig] of Object.entries(OPENAI_VOICE_SAMPLES)) {
        console.log(`\n🔊 Processing voice: ${voiceKey} (${voiceConfig.gender})`);
        
        for (const [lang, text] of Object.entries(voiceConfig.samples)) {
            const filename = `${voiceKey}_${lang}.mp3`;
            const filePath = path.join(outputDir, lang, filename);
            
            try {
                const audioBuffer = await generateOpenAIVoiceSample(voiceKey, text, lang);
                await fs.writeFile(filePath, audioBuffer);
                console.log(`  ✓ Saved: ${lang}/${filename}`);
                results.success.push({ voice: voiceKey, lang, file: filename });
            } catch (error) {
                console.error(`  ✗ Failed: ${lang}/${filename} - ${error.message}`);
                results.failed.push({ voice: voiceKey, lang, error: error.message });
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Generate manifest file for the frontend
    const manifest = {
        generated: new Date().toISOString(),
        provider: 'openai',
        voices: Object.entries(OPENAI_VOICE_SAMPLES).map(([key, config]) => ({
            key,
            gender: config.gender,
            languages: Object.keys(config.samples)
        })),
        files: results.success.map(s => ({
            voice: s.voice,
            lang: s.lang,
            url: `/audio/voice-samples/openai/${s.lang}/${s.file}`
        }))
    };

    await fs.writeFile(
        path.join(outputDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    );

    // Summary
    console.log('\n==================================');
    console.log('📊 Generation Summary');
    console.log(`  ✓ Success: ${results.success.length}`);
    console.log(`  ✗ Failed: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
        console.log('\nFailed samples:');
        results.failed.forEach(f => {
            console.log(`  - ${f.voice} (${f.lang}): ${f.error}`);
        });
    }

    console.log('\n✅ OpenAI voice samples generation complete!');
    console.log(`📁 Output directory: ${outputDir}`);
}

// Run the generator
generateAllSamples().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
