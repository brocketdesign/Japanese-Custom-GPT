const { ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const {
    getCreatorEarnings,
    recordTip,
    requestPayout,
    getPayoutHistory,
    getPayoutSettings,
    updatePayoutSettings,
    getTransactionHistory,
    getMonthlyEarningsBreakdown,
    getRecentTips,
    getSubscriberStats,
    isCreator,
    MINIMUM_PAYOUT_USD,
    PLATFORM_COMMISSION_RATE
} = require('../models/earnings-utils');

async function routes(fastify, options) {
    
    // Middleware to check if user is a creator
    const requireCreator = async (request, reply) => {
        const userId = request.user?._id;
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }
        
        const isUserCreator = await isCreator(fastify.mongo.db, userId);
        if (!isUserCreator) {
            return reply.status(403).send({ success: false, error: 'Creator access required' });
        }
    };

    // ============================================
    // EARNINGS DASHBOARD
    // ============================================

    /**
     * Get earnings summary for creator dashboard
     */
    fastify.get('/api/creator/earnings', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const earnings = await getCreatorEarnings(fastify.mongo.db, userId);
            
            reply.send({
                success: true,
                data: earnings
            });
        } catch (error) {
            console.error('[Creator Earnings] Error fetching earnings:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch earnings data' 
            });
        }
    });

    /**
     * Get monthly earnings breakdown for charts
     */
    fastify.get('/api/creator/earnings/monthly', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const months = parseInt(request.query.months) || 12;
            
            const breakdown = await getMonthlyEarningsBreakdown(fastify.mongo.db, userId, months);
            
            reply.send({
                success: true,
                data: breakdown
            });
        } catch (error) {
            console.error('[Creator Earnings] Error fetching monthly breakdown:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch monthly earnings' 
            });
        }
    });

    /**
     * Get subscriber statistics
     */
    fastify.get('/api/creator/earnings/subscribers', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const stats = await getSubscriberStats(fastify.mongo.db, userId);
            
            reply.send({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('[Creator Earnings] Error fetching subscriber stats:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch subscriber statistics' 
            });
        }
    });

    // ============================================
    // TRANSACTIONS
    // ============================================

    /**
     * Get transaction history
     */
    fastify.get('/api/creator/transactions', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const { page, limit, type, startDate, endDate } = request.query;
            
            const history = await getTransactionHistory(fastify.mongo.db, userId, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                type: type || null,
                startDate: startDate || null,
                endDate: endDate || null
            });
            
            reply.send({
                success: true,
                data: history
            });
        } catch (error) {
            console.error('[Creator Earnings] Error fetching transactions:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch transaction history' 
            });
        }
    });

    /**
     * Get recent tips
     */
    fastify.get('/api/creator/tips', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const limit = parseInt(request.query.limit) || 10;
            
            const tips = await getRecentTips(fastify.mongo.db, userId, limit);
            
            reply.send({
                success: true,
                data: tips
            });
        } catch (error) {
            console.error('[Creator Earnings] Error fetching tips:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch tips' 
            });
        }
    });

    // ============================================
    // PAYOUTS
    // ============================================

    /**
     * Get payout settings
     */
    fastify.get('/api/creator/payouts/settings', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const settings = await getPayoutSettings(fastify.mongo.db, userId);
            
            reply.send({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('[Creator Earnings] Error fetching payout settings:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch payout settings' 
            });
        }
    });

    /**
     * Update payout settings
     */
    fastify.put('/api/creator/payouts/settings', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const { minimumPayout, payoutSchedule, autoPayoutEnabled, currency } = request.body;
            
            const settings = await updatePayoutSettings(fastify.mongo.db, userId, {
                minimumPayout,
                payoutSchedule,
                autoPayoutEnabled,
                currency
            });
            
            reply.send({
                success: true,
                data: settings,
                message: 'Payout settings updated successfully'
            });
        } catch (error) {
            console.error('[Creator Earnings] Error updating payout settings:', error);
            reply.status(400).send({ 
                success: false, 
                error: error.message || 'Failed to update payout settings' 
            });
        }
    });

    /**
     * Get payout history
     */
    fastify.get('/api/creator/payouts/history', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const { page, limit, status } = request.query;
            
            const history = await getPayoutHistory(fastify.mongo.db, userId, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                status: status || null
            });
            
            reply.send({
                success: true,
                data: history
            });
        } catch (error) {
            console.error('[Creator Earnings] Error fetching payout history:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch payout history' 
            });
        }
    });

    /**
     * Request a payout
     */
    fastify.post('/api/creator/payouts/request', { preHandler: requireCreator }, async (request, reply) => {
        try {
            const userId = request.user._id;
            const { amount, currency } = request.body;
            
            if (!amount || amount <= 0) {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Invalid payout amount' 
                });
            }
            
            const payout = await requestPayout(
                fastify.mongo.db, 
                userId, 
                parseFloat(amount),
                currency || 'usd'
            );
            
            reply.send({
                success: true,
                data: payout,
                message: 'Payout request submitted successfully'
            });
        } catch (error) {
            console.error('[Creator Earnings] Error requesting payout:', error);
            reply.status(400).send({ 
                success: false, 
                error: error.message || 'Failed to request payout' 
            });
        }
    });

    // ============================================
    // TIPS (User-facing endpoints)
    // ============================================

    /**
     * Send a tip to a creator
     * This endpoint is for users (not creators) to send tips
     */
    fastify.post('/api/tips/send', async (request, reply) => {
        try {
            const tipperId = request.user?._id;
            if (!tipperId) {
                return reply.status(401).send({ success: false, error: 'Unauthorized' });
            }
            
            const { creatorId, amount, postId, message } = request.body;
            
            if (!creatorId || !amount || amount <= 0) {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Creator ID and valid amount are required' 
                });
            }
            
            // Verify creator exists
            const usersCollection = fastify.mongo.db.collection('users');
            const creator = await usersCollection.findOne({ 
                _id: new ObjectId(creatorId),
                isCreator: true
            });
            
            if (!creator) {
                return reply.status(404).send({ 
                    success: false, 
                    error: 'Creator not found' 
                });
            }
            
            // Create Stripe payment intent for the tip
            const amountInCents = Math.round(parseFloat(amount) * 100);
            
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountInCents,
                currency: 'usd',
                metadata: {
                    type: 'creator_tip',
                    creatorId: creatorId,
                    tipperId: tipperId.toString(),
                    postId: postId || '',
                    message: message || ''
                }
            });
            
            reply.send({
                success: true,
                data: {
                    clientSecret: paymentIntent.client_secret,
                    paymentIntentId: paymentIntent.id
                }
            });
        } catch (error) {
            console.error('[Creator Tips] Error creating tip payment:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to process tip' 
            });
        }
    });

    /**
     * Confirm a tip payment (called after Stripe payment succeeds)
     */
    fastify.post('/api/tips/confirm', async (request, reply) => {
        try {
            const tipperId = request.user?._id;
            if (!tipperId) {
                return reply.status(401).send({ success: false, error: 'Unauthorized' });
            }
            
            const { paymentIntentId } = request.body;
            
            if (!paymentIntentId) {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Payment intent ID is required' 
                });
            }
            
            // Verify payment with Stripe
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            
            if (paymentIntent.status !== 'succeeded') {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Payment not completed' 
                });
            }
            
            // Verify this is a tip payment
            if (paymentIntent.metadata.type !== 'creator_tip') {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Invalid payment type' 
                });
            }
            
            // Record the tip
            const tipResult = await recordTip(fastify.mongo.db, {
                creatorId: paymentIntent.metadata.creatorId,
                tipperId: paymentIntent.metadata.tipperId,
                amount: paymentIntent.amount / 100, // Convert cents to dollars
                currency: paymentIntent.currency,
                postId: paymentIntent.metadata.postId || null,
                message: paymentIntent.metadata.message || null,
                stripePaymentId: paymentIntentId
            });
            
            // Send notification to creator (optional - implement later)
            // await sendTipNotification(fastify.mongo.db, creatorId, tipResult);
            
            reply.send({
                success: true,
                data: tipResult,
                message: 'Tip sent successfully!'
            });
        } catch (error) {
            console.error('[Creator Tips] Error confirming tip:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to confirm tip' 
            });
        }
    });

    // ============================================
    // DASHBOARD VIEW ROUTE
    // ============================================

    /**
     * Render earnings dashboard page
     */
    fastify.get('/dashboard/earnings', async (request, reply) => {
        try {
            const userId = request.user?._id;
            if (!userId) {
                return reply.redirect('/login');
            }
            
            const isUserCreator = await isCreator(fastify.mongo.db, userId);
            if (!isUserCreator) {
                return reply.redirect('/creators/apply');
            }
            
            // Load translations
            const lang = request.translations?.lang || 'en';
            let earningsTranslations = {};
            try {
                earningsTranslations = require(`../locales/earnings-${lang}.json`);
            } catch (e) {
                try {
                    earningsTranslations = require('../locales/earnings-en.json');
                } catch (e2) {
                    earningsTranslations = {};
                }
            }
            
            return reply.view('dashboard/earnings.hbs', {
                title: earningsTranslations.pageTitle || 'Creator Earnings',
                user: request.user,
                lang: lang,
                earningsTranslations,
                minimumPayout: MINIMUM_PAYOUT_USD,
                platformCommission: PLATFORM_COMMISSION_RATE * 100
            });
        } catch (error) {
            console.error('[Creator Earnings] Error rendering dashboard:', error);
            return reply.status(500).send('Internal Server Error');
        }
    });

    // ============================================
    // WEBHOOK FOR STRIPE (Tip payments)
    // ============================================

    /**
     * Handle Stripe webhook for tip payments
     * Note: This should be integrated with existing webhook handler
     */
    fastify.post('/api/webhooks/stripe/tips', {
        config: { rawBody: true }
    }, async (request, reply) => {
        const sig = request.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_TIPS_WEBHOOK_SECRET;
        
        let event;
        
        try {
            event = stripe.webhooks.constructEvent(
                request.rawBody,
                sig,
                endpointSecret
            );
        } catch (err) {
            console.error('[Stripe Webhook] Signature verification failed:', err.message);
            return reply.status(400).send(`Webhook Error: ${err.message}`);
        }
        
        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                
                if (paymentIntent.metadata.type === 'creator_tip') {
                    // Tip payment succeeded - record it
                    try {
                        await recordTip(fastify.mongo.db, {
                            creatorId: paymentIntent.metadata.creatorId,
                            tipperId: paymentIntent.metadata.tipperId,
                            amount: paymentIntent.amount / 100,
                            currency: paymentIntent.currency,
                            postId: paymentIntent.metadata.postId || null,
                            message: paymentIntent.metadata.message || null,
                            stripePaymentId: paymentIntent.id
                        });
                        console.log('[Stripe Webhook] Tip recorded successfully');
                    } catch (error) {
                        console.error('[Stripe Webhook] Error recording tip:', error);
                    }
                }
                break;
                
            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }
        
        reply.send({ received: true });
    });
}

module.exports = routes;
