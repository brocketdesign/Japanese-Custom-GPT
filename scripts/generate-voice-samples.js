/**
 * Voice Sample Generator Script
 * Generates voice samples in English, French, and Japanese for the cold onboarding flow
 * 
 * Usage: node scripts/generate-voice-samples.js
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

// Minimax TTS API endpoint
const MINIMAX_ENDPOINT = 'https://api.novita.ai/v3/minimax-speech-2.6-turbo';

// Voice samples to generate - focused on female voices for character creation
const VOICE_SAMPLES = {
    // Female voices (main focus)
    Wise_Woman: {
        key: 'Wise_Woman',
        gender: 'female',
        samples: {
            en: "Hello, I'm your AI companion. I'm here to chat, listen, and be by your side whenever you need me.",
            fr: "Bonjour, je suis votre compagne IA. Je suis là pour discuter, écouter et être à vos côtés.",
            ja: "こんにちは、私はあなたのAIコンパニオンです。いつでもそばにいますよ。"
        }
    },
    Friendly_Person: {
        key: 'Friendly_Person',
        gender: 'male',
        samples: {
            en: "Hey there! I'm so excited to meet you! Let's have some fun conversations together!",
            fr: "Salut! Je suis tellement content de te rencontrer! Amusons-nous ensemble!",
            ja: "やあ！会えて嬉しいです！一緒に楽しくおしゃべりしましょう！"
        }
    },
    Inspirational_girl: {
        key: 'Inspirational_girl',
        gender: 'female',
        samples: {
            en: "You're amazing just the way you are! I believe in you, and I'm here to support you!",
            fr: "Tu es incroyable comme tu es! Je crois en toi, et je suis là pour te soutenir!",
            ja: "あなたはそのままで素晴らしいです！あなたを信じています、応援していますよ！"
        }
    },
    Calm_Woman: {
        key: 'Calm_Woman',
        gender: 'female',
        samples: {
            en: "Take a deep breath and relax. I'm here with you, and everything will be alright.",
            fr: "Respire profondément et détends-toi. Je suis là avec toi, tout ira bien.",
            ja: "深呼吸してリラックスしてください。私がそばにいます、大丈夫ですよ。"
        }
    },
    Lively_Girl: {
        key: 'Lively_Girl',
        gender: 'female',
        samples: {
            en: "Oh wow, this is going to be so much fun! I can't wait to hear all about you!",
            fr: "Oh wow, ça va être tellement amusant! J'ai hâte d'en savoir plus sur toi!",
            ja: "わぁ、楽しくなりそう！あなたのこと、もっと知りたいな！"
        }
    },
    Lovely_Girl: {
        key: 'Lovely_Girl',
        gender: 'female',
        samples: {
            en: "It's so nice to meet you. I hope we can become really close friends.",
            fr: "C'est si agréable de te rencontrer. J'espère qu'on deviendra de vrais amis.",
            ja: "お会いできて嬉しいです。仲良くなれたらいいですね。"
        }
    },
    Abbess: {
        key: 'Abbess',
        gender: 'female',
        samples: {
            en: "Welcome, dear one. I sense there is much wisdom to share between us.",
            fr: "Bienvenue, cher ami. Je sens qu'il y a beaucoup de sagesse à partager.",
            ja: "ようこそ、親愛なる方。私たちの間には分かち合う知恵があるようです。"
        }
    },
    Sweet_Girl_2: {
        key: 'Sweet_Girl_2',
        gender: 'female',
        samples: {
            en: "Hi sweetie! You look like someone who needs a friend. Lucky for you, I'm here!",
            fr: "Coucou! Tu as l'air d'avoir besoin d'un ami. Tu as de la chance, je suis là!",
            ja: "こんにちは！友達が欲しそうですね。私がいますよ！"
        }
    },
    Exuberant_Girl: {
        key: 'Exuberant_Girl',
        gender: 'female',
        samples: {
            en: "YES! This is amazing! I'm so happy right now! Let's make today incredible!",
            fr: "OUI! C'est incroyable! Je suis tellement heureuse! Rendons cette journée incroyable!",
            ja: "わーい！すごい！とても幸せ！今日を最高の日にしましょう！"
        }
    },
    // Male voices (for completeness)
    Deep_Voice_Man: {
        key: 'Deep_Voice_Man',
        gender: 'male',
        samples: {
            en: "Hello there. I'm here to keep you company and share meaningful conversations.",
            fr: "Bonjour. Je suis là pour te tenir compagnie et partager des conversations.",
            ja: "こんにちは。あなたと意味のある会話を共有するためにここにいます。"
        }
    },
    Casual_Guy: {
        key: 'Casual_Guy',
        gender: 'male',
        samples: {
            en: "Hey, what's up? Just hanging out here, ready to chat whenever you want.",
            fr: "Salut, ça va? Je traîne ici, prêt à discuter quand tu veux.",
            ja: "やあ、調子どう？いつでも話そうぜ。"
        }
    },
    Patient_Man: {
        key: 'Patient_Man',
        gender: 'male',
        samples: {
            en: "Take your time. I'm in no rush. I'm here to listen whenever you're ready.",
            fr: "Prends ton temps. Je ne suis pas pressé. Je suis là pour écouter.",
            ja: "ゆっくりどうぞ。急いでいません。準備ができたら聞きますよ。"
        }
    }
};

// Audio settings for high quality output
const AUDIO_SETTINGS = {
    format: 'mp3',
    sample_rate: 24000,
    bitrate: 128000,
    channel: 1
};

/**
 * Generate a single voice sample
 * @param {string} voiceKey - Voice identifier
 * @param {string} text - Text to synthesize
 * @param {string} language - Language code (en, fr, ja)
 * @returns {Promise<Buffer>} - Audio buffer
 */
async function generateVoiceSample(voiceKey, text, language) {
    const apiKey = process.env.NOVITA_API_KEY;
    
    if (!apiKey) {
        throw new Error('NOVITA_API_KEY environment variable is not set');
    }

    // Map language code to Minimax language boost
    const languageBoostMap = {
        en: 'English',
        fr: 'French',
        ja: 'Japanese'
    };

    const requestBody = {
        text: text,
        stream: false,
        output_format: 'hex',
        voice_setting: {
            voice_id: voiceKey
        },
        audio_setting: AUDIO_SETTINGS,
        language_boost: languageBoostMap[language] || 'auto'
    };

    console.log(`  Generating ${voiceKey} in ${language}...`);

    const response = await fetch(MINIMAX_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    // Check for API error in response
    if (data.error) {
        const errMessage = data.error.message || data.error || 'Unknown API error';
        throw new Error(errMessage);
    }

    // API returns audio in 'audio' or 'data.audio' field, not 'audio_file'
    const audioField = data.audio || data.data?.audio;
    
    if (!audioField) {
        throw new Error('No audio data in response');
    }

    // Convert hex string to buffer
    const audioBuffer = Buffer.from(audioField, 'hex');
    return audioBuffer;
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
 * Generate all voice samples
 */
async function generateAllSamples() {
    const outputDir = path.join(__dirname, '..', 'public', 'audio', 'voice-samples');
    
    console.log('🎙️  Voice Sample Generator');
    console.log('==========================\n');
    
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
    for (const [voiceKey, voiceConfig] of Object.entries(VOICE_SAMPLES)) {
        console.log(`\n🔊 Processing voice: ${voiceKey} (${voiceConfig.gender})`);
        
        for (const [lang, text] of Object.entries(voiceConfig.samples)) {
            const filename = `${voiceKey}_${lang}.mp3`;
            const filePath = path.join(outputDir, lang, filename);
            
            try {
                const audioBuffer = await generateVoiceSample(voiceKey, text, lang);
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
        voices: Object.entries(VOICE_SAMPLES).map(([key, config]) => ({
            key,
            gender: config.gender,
            languages: Object.keys(config.samples)
        })),
        files: results.success.map(s => ({
            voice: s.voice,
            lang: s.lang,
            url: `/audio/voice-samples/${s.lang}/${s.file}`
        }))
    };

    await fs.writeFile(
        path.join(outputDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    );

    // Summary
    console.log('\n==========================');
    console.log('📊 Generation Summary');
    console.log(`  ✓ Success: ${results.success.length}`);
    console.log(`  ✗ Failed: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
        console.log('\nFailed samples:');
        results.failed.forEach(f => {
            console.log(`  - ${f.voice} (${f.lang}): ${f.error}`);
        });
    }

    console.log('\n✅ Voice samples generation complete!');
    console.log(`📁 Output directory: ${outputDir}`);
}

// Run the generator
generateAllSamples().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
