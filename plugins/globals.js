const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const fastifyPlugin = require('fastify-plugin');
const { ObjectId } = require('mongodb');
const  { checkUserAdmin } = require('../models/tool');
const ip = require('ip');

function getApiUrl(){
    // Use process.env.API_URL to get the port and the get the current iP to reconstruct the URL
    const port = process.env.API_URL.split(':')[2];
    const host = ip.address();
    const protocol = process.env.MODE === 'local' ? 'http' : 'https';
    return `${protocol}://${host}:${port}`;
}
const apiUrl = getApiUrl();

module.exports = fastifyPlugin(async function (fastify, opts) {
    // Decorate Fastify with a render function that includes GTM
    fastify.decorateReply('renderWithGtm', function (template, data) {
        data = data || {};
        data.gtmId = process.env.GTM_ID;
        return this.view(template, data);
    });

    // Cache translations to avoid redundant file reads
    const translationsCache = {};
    const clerkTranslationsCache = {}; // Add cache for clerk translations

    // Decorate Fastify with user, lang, and translations functions
    fastify.decorate('getUser', getUser);
    fastify.decorate('getLang', getLang);
    fastify.decorate('getTranslations', getTranslations);
    fastify.decorate('getClerkTranslations', getClerkTranslations); // Add clerk translations decorator
    fastify.decorate('getPaymentTranslations', getPaymentTranslations); // Add payment translations decorator

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
    fastify.decorateRequest('lang', 'en'); // Default language
    fastify.decorateRequest('translations', null);
    fastify.decorateRequest('clerkTranslations', null); // Add clerk translations to request
    fastify.decorateRequest('paymentTranslations', null); // Add payment translations to request

    // Pre-handler to set user, lang, and translations
    fastify.addHook('preHandler', async (request, reply) => {
        // Load translations based on the determined language
        request.translations = getTranslations(request.lang);
        request.clerkTranslations = getClerkTranslations(request.lang); // Load clerk translations
        request.paymentTranslations = getPaymentTranslations(request.lang); // Load payment translations
        
        // Make translations available in Handlebars templates
        reply.locals = {
            lang: request.lang,
            translations: request.translations,
            clerkTranslations: request.clerkTranslations, // Make clerk translations available
            paymentTranslations: request.paymentTranslations, // Make payment translations available
            user: request.user, // Make user available
            isUserAdmin: request.isUserAdmin, // Make admin status available
            mode: process.env.MODE,
            apiurl: apiUrl
        };
    });

    // Hooks to handle language and user settings
    fastify.addHook('onRequest', setRequestLangAndUser);
    fastify.addHook('preHandler', setReplyLocals);

    // PreHandler to refresh user data for critical subscription-dependent routes
    fastify.addHook('preHandler', async (request, reply) => {
    // Get the current URL path without query parameters
    const currentPath = request.raw.url.split('?')[0];
    
    // Only refresh data for specific endpoints that need fresh subscription info
    const refreshRoutes = [
        '/novita/generate-img',
        '/api/generate-img',
        '/chat',
        '/chat/',
        '/api/chat/',
        '/api/openai-chat-completion'
    ];
        
    // Check if the current path starts with any of the refresh routes
    const needsRefresh = refreshRoutes.some(route => currentPath === route || currentPath.startsWith(`${route}/`));

    if (needsRefresh && request.user && !request.user.isTemporary) {
        try {      
        // Get fresh user data
        const refreshedUser = await fastify.mongo.db.collection('users').findOne(
            { _id: new fastify.mongo.ObjectId(request.user._id) }
        );
        
        if (refreshedUser) {
            // Update the request.user with fresh data
            request.user = refreshedUser;
            
            // Also update reply.locals to ensure templates get fresh data
            if (reply.locals) {
            reply.locals.user = refreshedUser;
            }
        }
        } catch (error) {
        console.error('[PreHandler] Error refreshing user data:', error);
        }
    }
    });
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
        // Ensure currentLang is a valid language code (e.g., 'en', 'ja', 'fr')
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
    
    /** Load PaymentTranslations for a specific language (cached for performance) */
    function getPaymentTranslations(currentLang) {
        const paymentTranslationsCache = {};
        if (!paymentTranslationsCache[currentLang]) {
            const translationFile = path.join(__dirname, `../locales/payment_${currentLang}.json`);
            try {
                if (fs.existsSync(translationFile)) {
                    paymentTranslationsCache[currentLang] = JSON.parse(fs.readFileSync(translationFile, 'utf-8'));
                } else {
                    // Fallback to English if the language file doesn't exist
                    const fallbackFile = path.join(__dirname, `../locales/payment_en.json`);
                    paymentTranslationsCache[currentLang] = JSON.parse(fs.readFileSync(fallbackFile, 'utf-8'));
                }
            } catch (error) {
                console.error(`Error loading payment translations for ${currentLang}:`, error);
                paymentTranslationsCache[currentLang] = {}; // Fallback to empty object on error
            }
        }
        return paymentTranslationsCache[currentLang];
    }
    /** Load Clerk translations for a specific language (cached for performance) */
    function getClerkTranslations(currentLang) {
        if (!currentLang) currentLang = 'en';
        
        if (!clerkTranslationsCache[currentLang]) {
            const clerkTranslationFile = path.join(__dirname, '..', 'locales', `clerk_${currentLang}.ts`);
            if (fs.existsSync(clerkTranslationFile)) {
                try {
                    // Use require to import the TypeScript file
                    const translationModule = require(clerkTranslationFile);
                    // Assuming the translation is the default export
                    clerkTranslationsCache[currentLang] = translationModule.default || translationModule;
                } catch (e) {
                    fastify.log.error(`Error reading Clerk translations for ${currentLang}:`, e);
                    clerkTranslationsCache[currentLang] = {};
                }
            } else {
                clerkTranslationsCache[currentLang] = {}; // Fallback to empty object if translation file is missing
            }
        }
        return clerkTranslationsCache[currentLang];
    }

    /** Load Payment translations for a specific language (cached for performance) */
    function getPaymentTranslations(currentLang) {
        const paymentTranslationsCache = {};
        if (!paymentTranslationsCache[currentLang]) {
            const translationFile = path.join(__dirname, `../locales/payment_${currentLang}.json`);
            try {
                if (fs.existsSync(translationFile)) {
                    paymentTranslationsCache[currentLang] = JSON.parse(fs.readFileSync(translationFile, 'utf-8'));
                } else {
                    // Fallback to English if the language file doesn't exist
                    const fallbackFile = path.join(__dirname, `../locales/payment_en.json`);
                    paymentTranslationsCache[currentLang] = JSON.parse(fs.readFileSync(fallbackFile, 'utf-8'));
                }
            } catch (error) {
                console.error(`Error loading payment translations for ${currentLang}:`, error);
                paymentTranslationsCache[currentLang] = {}; // Fallback to empty object on error
            }
        }
        return paymentTranslationsCache[currentLang];
    }

    /** Middleware: Set request language and user */
    async function setRequestLangAndUser(request, reply) {
        request.user = await fastify.getUser(request, reply);
        request.lang = request.user.lang || await fastify.getLang(request, reply);
        request.translations = fastify.getTranslations(request.lang);
        request.clerkTranslations = fastify.getClerkTranslations(request.lang);
        request.paymentTranslations = fastify.getPaymentTranslations(request.lang);
        request.isAdmin = await checkUserAdmin(fastify, request.user._id) || false;
    }

    /** Middleware: Set reply.locals */
    async function setReplyLocals(request, reply) {
        reply.locals = {
            mode: process.env.MODE,
            apiurl: apiUrl,
            translations: request.translations,
            clerkTranslations: request.clerkTranslations, // Add clerk translations to locals
            paymentTranslations: request.paymentTranslations, // Add payment translations to locals
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
