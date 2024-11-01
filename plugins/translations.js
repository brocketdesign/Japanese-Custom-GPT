// plugins/translations.js

const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const fastifyPlugin = require('fastify-plugin');
const { ObjectId } = require('mongodb');

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
            console.log(user)
            return user;
        }
        // Handle temporary user
        const tempUser = await getOrCreateTempUser(request, reply, userCollection);
        return tempUser;
    });

    // 4. Add a preHandler hook to set translations and user for every request
    fastify.addHook('preHandler', async (request, reply) => {
        const user = await fastify.getUser(request, reply);
        setTranslations(request, user.lang);
        // Decorate the request with the user object
        request.user = user;
    });

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
            const tempUserId = new ObjectId().toString();
            tempUser = {
                _id: tempUserId,
                isTemporary: true,
                role: 'guest',
                lang: 'ja',
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
        lang = lang || 'ja';
        request.translations = fastify.translations[lang] || fastify.translations['ja'];
    }
});
