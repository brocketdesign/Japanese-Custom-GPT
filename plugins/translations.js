// plugins/translations.js

const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const fastifyPlugin = require('fastify-plugin');
const { ObjectId } = require('mongodb');
const requestIp = require('request-ip');
const geoip = require('geoip-lite');

module.exports = fastifyPlugin(async function (fastify, opts) {
    // 1. Load all translation files at startup
    const translationsDir = path.join(__dirname, '..', 'locales'); // Adjusted path
    const translationFiles = fs.readdirSync(translationsDir).filter(file => file.endsWith('.json'));
    const translations = {};

    translationFiles.forEach(file => {
        const lang = path.basename(file, '.json');
        const data = JSON.parse(fs.readFileSync(path.join(translationsDir, file), 'utf-8'));
        translations[lang] = data;
    });

    // 2. Decorate Fastify instance with translations
    fastify.decorate('translations', translations);

    // 3. Decorate with getUser function
    fastify.decorate('getUser', async function (request, reply) {
        const userCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');

        // Try to get authenticated user by token
        const user = await getAuthenticatedUser(request, userCollection);
        if (user) {
            return { 
                _id: user._id, 
                lang: user.lang,
                profileUrl: user.profileUrl,
                subscriptionStatus: user.subscriptionStatus,
                isTemporary: user.isTemporary
            }
        }
        // Handle temporary user
        const tempUser = await getOrCreateTempUser(request, reply, userCollection);
        return tempUser;
    });

    // Ajoutez ceci avant vos décorateurs
    fastify.decorateRequest('lang', null)
    fastify.decorateRequest('user', null)

    // Déclarez vos décorateurs comme avant
    fastify.decorate('lang', async function (request, reply) {
        const subdomain = request.hostname.split('.')[0]
        return ['en','fr','ja'].includes(subdomain) ? subdomain : 'en'
    })

    fastify.decorate('user', async function (request, reply) {
        const user = await fastify.getUser(request, reply)
        return { 
            _id:user._id, 
            lang:user.lang,
            profileUrl: user.profileUrl,
            subscriptionStatus:user.subscriptionStatus, 
            isTemporary:user.isTemporary 
        }
    })

    // Hook pour setter lang et user
    fastify.addHook('onRequest', async (request, reply) => {
        request.lang = await fastify.lang(request, reply)
        request.user = await fastify.user(request, reply)
    })

    // Hook pour gérer la traduction
    fastify.addHook('preHandler', async (request, reply) => {
        setTranslations(request, request.lang)
        if (process.env.MODE==='local' && request.user.lang!==request.lang) {
            setTranslations(request, request.user.lang)
            request.lang = request.user.lang
        }
    })


    // Helper to get authenticated user
    async function getAuthenticatedUser(request, userCollection) {
        const token = request.cookies.token;
        if (!token) return null;

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded._id) {
                return await userCollection.findOne({ _id: new fastify.mongo.ObjectId(decoded._id) });
            }
        } catch (err) {
            fastify.log.error('JWT verification failed:', err);
            return null;
        }
        return null;
    }

    async function getOrCreateTempUser(request, reply) {
        const mode = process.env.MODE || 'local';
        let tempUser = request.cookies.tempUser;
    
        if (!tempUser) {
            const host = request.hostname; 
            const subdomain = host.split('.')[0];
            const lang = (['en','fr','ja'].includes(subdomain)) ? subdomain : 'en';
            const tempUserId = new ObjectId().toString();
            tempUser = {
                _id: tempUserId,
                isTemporary: true,
                role: 'guest',
                lang,
                createdAt: new Date(),
                session: getSessionIdentifier(request)
            };
    
            reply.setCookie('tempUser', JSON.stringify(tempUser), {
                path: '/',
                httpOnly: true,
                maxAge: 60 * 60 * 24,
                sameSite: mode === 'heroku' ? 'None' : 'Lax',
                secure: mode === 'heroku'
            });
        } else {
            tempUser = JSON.parse(tempUser);
        }
    
        return tempUser;
    }
    

    // Helper to generate a session identifier (e.g., based on IP and User-Agent)
    function getSessionIdentifier(request) {
        const ip = request.ip;
        const userAgent = request.headers['user-agent'] || 'unknown';
        return `${ip}-${userAgent}`;
    }

    // Helper to set translations
    function setTranslations(request, lang) {
        lang = lang || 'en';
        request.translations = fastify.translations[lang] || fastify.translations['en'];
    }


    function getUserLanguage(req) {
        const clientIp = requestIp.getClientIp(req) || '0.0.0.0';
        const geo = geoip.lookup(clientIp);
        const countryToLanguage = {
            US: 'en',
            JP: 'ja',
            FR: 'fr',
        };

        return geo && countryToLanguage[geo.country] ? countryToLanguage[geo.country] : 'en';
    }
});
