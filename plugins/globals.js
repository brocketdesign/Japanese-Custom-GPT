const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const fastifyPlugin = require('fastify-plugin');
const { ObjectId } = require('mongodb');
const  { checkUserAdmin } = require('../models/tool');

module.exports = fastifyPlugin(async function (fastify, opts) {
    // Decorate Fastify with a render function that includes GTM
    fastify.decorateReply('renderWithGtm', function (template, data) {
        data = data || {};
        data.gtmId = process.env.GTM_ID;
        return this.view(template, data);
    });

    // Cache translations to avoid redundant file reads
    const translationsCache = {};

    // Decorate Fastify with user, lang, and translations functions
    fastify.decorate('getUser', getUser);
    fastify.decorate('getLang', getLang);
    fastify.decorate('getTranslations', getTranslations);

    // Attach `lang` and `user` dynamically
    Object.defineProperty(fastify, 'lang', {
        get() {
            return fastify.request?.lang || 'en';
        }
    });

    Object.defineProperty(fastify, 'user', {
        get() {
            return fastify.request?.user || {};
        }
    });

    // Decorate request
    fastify.decorateRequest('translations', null);
    fastify.decorateRequest('lang', null);
    fastify.decorateRequest('user', null);
    fastify.decorateRequest('isAdmin', null);

    // Hooks to handle language and user settings
    fastify.addHook('onRequest', setRequestLangAndUser);
    fastify.addHook('preHandler', setReplyLocals);

    // Redirect to HTTPS in production
    fastify.addHook('onRequest', async (req, reply) => {
        if (process.env.MODE !== 'local' && req.headers['x-forwarded-proto'] !== 'https') {
          reply.redirect(`https://${req.headers['host']}${req.raw.url}`);
        }
    });

    /** Get authenticated user or create a temporary one */
    async function getUser(request, reply) {
        const userCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
        const user = await getAuthenticatedUser(request, userCollection);
        return user || await getOrCreateTempUser(request, reply, userCollection);
    }

    /** Get language from subdomain */
    async function getLang(request, reply) {
        const subdomain = request.hostname.split('.')[0];
        return ['en', 'fr', 'ja'].includes(subdomain) ? subdomain : 'en';
    }

    /** Load translations for a specific language (cached for performance) */
    function getTranslations(currentLang) {
        if (!currentLang) currentLang = 'en';

        if (!translationsCache[currentLang]) {
            const translationFile = path.join(__dirname, '..', 'locales', `${currentLang}.json`);
            if (fs.existsSync(translationFile)) {
                translationsCache[currentLang] = JSON.parse(fs.readFileSync(translationFile, 'utf-8'));
            } else {
                translationsCache[currentLang] = {}; // Fallback to empty object if translation file is missing
            }
        }
        return translationsCache[currentLang];
    }

    /** Middleware: Set request language and user */
    async function setRequestLangAndUser(request, reply) {
        request.user = await fastify.getUser(request, reply);
        request.lang = request.user.lang || await fastify.getLang(request, reply);
        request.translations = fastify.getTranslations(request.lang);
        request.isAdmin = await checkUserAdmin(fastify, request.user._id) || false;
    }

    /** Middleware: Set reply.locals */
    async function setReplyLocals(request, reply) {
        reply.locals = {
            mode: process.env.MODE,
            apiurl: process.env.API_URL,
            translations: request.translations,
            lang: request.lang,
            user: request.user,
            isAdmin: request.isAdmin
        };
    }

    /** Authenticate user via JWT */
    async function getAuthenticatedUser(request, userCollection) {
        const token = request?.cookies?.token;
        
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

    /** Create or retrieve a temporary user */
    async function getOrCreateTempUser(request, reply, userCollection) {
        const mode = process.env.MODE || 'local';
        let tempUser = request?.cookies?.tempUser;

        if (!tempUser) {
            const lang = await fastify.getLang(request, reply);
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

    /** Generate session identifier */
    function getSessionIdentifier(request) {
        const ip = request.ip;
        const userAgent = request.headers['user-agent'] || 'unknown';
        return `${ip}-${userAgent}`;
    }
});
