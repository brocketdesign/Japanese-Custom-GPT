const { ObjectId } = require('mongodb');
const {
    createAffiliateLink,
    getAffiliateLink,
    getReferrals,
    countSubscribedReferrals,
    trackClick,
    getReferralStats,
    generateSlug
} = require('../models/affiliation-utils');

async function routes(fastify, options) {
    // Create or update affiliate link
    fastify.post('/api/affiliate/create', async (request, reply) => {
        console.log('[Affiliate API] Create affiliate link request received');
        try {
            const userId = request.user._id;
            const { customSlug } = request.body;
            console.log('[Affiliate API] Creating affiliate link for user:', userId, 'with slug:', customSlug);
            
            const linkData = await createAffiliateLink(fastify.mongo.db, userId, customSlug);
            console.log('[Affiliate API] Affiliate link created successfully:', linkData);
            
            reply.send({ 
                success: true, 
                data: {
                    slug: linkData.slug,
                    link: linkData.link,
                    clicks: linkData.clicks,
                    conversions: linkData.conversions
                }
            });
        } catch (error) {
            console.error('[Affiliate API] Error creating affiliate link:', error);
            const statusCode = error.message === 'Slug already taken' ? 400 : 500;
            reply.status(statusCode).send({ 
                success: false, 
                error: error.message || 'Failed to create affiliate link' 
            });
        }
    });

    // Generate new slug
    fastify.post('/api/affiliate/generate-slug', async (request, reply) => {
        console.log('[Affiliate API] Generate slug request received');
        try {
            const { generateSlug } = require('../models/affiliation-utils');
            const newSlug = await generateSlug();
            console.log('[Affiliate API] New slug generated:', newSlug);
            reply.send({ success: true, slug: newSlug });
        } catch (error) {
            console.error('[Affiliate API] Error generating slug:', error);
            reply.status(500).send({ success: false, error: 'Failed to generate slug' });
        }
    });

    // Get affiliate link and stats
    fastify.get('/api/affiliate/dashboard', async (request, reply) => {
        console.log('[Affiliate API] Dashboard request received for user:', request.user._id);
        try {
            const userId = request.user._id;
            const linkData = await getAffiliateLink(fastify.mongo.db, userId);
            const stats = await getReferralStats(fastify.mongo.db, userId);
            
            console.log('[Affiliate API] Dashboard data retrieved - Link:', !!linkData, 'Stats:', stats);
            
            reply.send({ 
                success: true, 
                data: {
                    link: linkData ? {
                        slug: linkData.slug,
                        link: linkData.link,
                        createdAt: linkData.createdAt
                    } : null,
                    stats
                }
            });
        } catch (error) {
            console.error('[Affiliate API] Error getting affiliate dashboard:', error);
            reply.status(500).send({ success: false, error: 'Failed to get dashboard data' });
        }
    });

    // Get referrals with pagination
    fastify.get('/api/affiliate/referrals', async (request, reply) => {
        console.log('[Affiliate API] Referrals request received for user:', request.user._id);
        try {
            const userId = request.user._id;
            const page = parseInt(request.query.page) || 1;
            const limit = parseInt(request.query.limit) || 10;
            const skip = (page - 1) * limit;

            console.log('[Affiliate API] Fetching referrals - Page:', page, 'Limit:', limit, 'Skip:', skip);

            const usersCollection = fastify.mongo.db.collection('users');
            const referrals = await usersCollection
                .find({ referrer: new ObjectId(userId) })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .toArray();

            const total = await usersCollection.countDocuments({ referrer: new ObjectId(userId) });
            
            console.log('[Affiliate API] Referrals retrieved - Count:', referrals.length, 'Total:', total);

            reply.send({ 
                success: true, 
                data: {
                    referrals: referrals.map(ref => ({
                        id: ref._id,
                        nickname: ref.nickname || 'Anonymous',
                        email: ref.email?.substring(0, 3) + '***@' + ref.email?.split('@')[1] || 'Hidden',
                        subscriptionStatus: ref.subscriptionStatus,
                        createdAt: ref.createdAt
                    })),
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        hasNext: skip + limit < total,
                        hasPrev: page > 1
                    }
                }
            });
        } catch (error) {
            console.error('[Affiliate API] Error getting referrals:', error);
            reply.status(500).send({ success: false, error: 'Failed to get referrals' });
        }
    });

    // Track click (public endpoint)
    fastify.post('/api/affiliate/track-click/:slug', async (request, reply) => {
        try { 
            const { slug } = request.params;
            await trackClick(fastify.mongo.db, slug);
            reply.send({ success: true });
        } catch (error) {
            console.error('[Affiliate API] Error tracking click:', error);
            reply.status(500).send({ success: false, error: 'Failed to track click' });
        }
    });
}

module.exports = routes;