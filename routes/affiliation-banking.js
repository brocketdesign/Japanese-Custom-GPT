const { ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function routes(fastify, options) {
    // Get user's Stripe customer and payment methods
    fastify.get('/api/affiliate/banking/payment-methods', async (request, reply) => {
        try {
            const userId = request.user._id;
            const usersCollection = fastify.mongo.db.collection('users');
            const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

            if (!user) {
                return reply.status(404).send({ success: false, error: 'User not found' });
            }

            let stripeCustomerId = user.stripeCustomerId;

            // Create Stripe customer if doesn't exist
            if (!stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: user.fullName || user.nickname,
                    metadata: {
                        userId: userId.toString()
                    }
                });

                stripeCustomerId = customer.id;
                await usersCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { stripeCustomerId } }
                );
            }

            // Get payment methods
            const paymentMethods = await stripe.paymentMethods.list({
                customer: stripeCustomerId,
                type: 'us_bank_account'
            });

            // Get external accounts (for payouts)
            const accounts = await stripe.accounts.list({
                limit: 10
            });

            reply.send({
                success: true,
                data: {
                    customerId: stripeCustomerId,
                    paymentMethods: paymentMethods.data,
                    accounts: accounts.data
                }
            });
        } catch (error) {
            console.error('Error fetching payment methods:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch payment methods' 
            });
        }
    });

    // Create setup intent for adding bank account
    fastify.post('/api/affiliate/banking/create-setup-intent', async (request, reply) => {
        try {
            const userId = request.user._id;
            const usersCollection = fastify.mongo.db.collection('users');
            const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

            if (!user || !user.stripeCustomerId) {
                return reply.status(404).send({ success: false, error: 'User or Stripe customer not found' });
            }

            const setupIntent = await stripe.setupIntents.create({
                customer: user.stripeCustomerId,
                payment_method_types: ['us_bank_account'],
                usage: 'off_session'
            });

            reply.send({
                success: true,
                clientSecret: setupIntent.client_secret
            });
        } catch (error) {
            console.error('Error creating setup intent:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to create setup intent' 
            });
        }
    });

    // Add bank account
    fastify.post('/api/affiliate/banking/add-bank-account', async (request, reply) => {
        try {
            const userId = request.user._id;
            const { paymentMethodId, accountHolderName, country, currency } = request.body;

            if (!paymentMethodId) {
                return reply.status(400).send({ success: false, error: 'Payment method ID is required' });
            }

            const usersCollection = fastify.mongo.db.collection('users');
            const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

            if (!user || !user.stripeCustomerId) {
                return reply.status(404).send({ success: false, error: 'User or Stripe customer not found' });
            }

            // Attach payment method to customer
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: user.stripeCustomerId
            });

            // Store banking info in database
            const bankingCollection = fastify.mongo.db.collection('userBanking');
            await bankingCollection.updateOne(
                { userId: new ObjectId(userId) },
                {
                    $set: {
                        userId: new ObjectId(userId),
                        stripeCustomerId: user.stripeCustomerId,
                        paymentMethodId,
                        accountHolderName,
                        country,
                        currency,
                        isActive: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );

            reply.send({
                success: true,
                message: 'Bank account added successfully'
            });
        } catch (error) {
            console.error('Error adding bank account:', error);
            reply.status(500).send({ 
                success: false, 
                error: error.message || 'Failed to add bank account' 
            });
        }
    });

    // Remove payment method
    fastify.delete('/api/affiliate/banking/payment-method/:methodId', async (request, reply) => {
        try {
            const { methodId } = request.params;
            const userId = request.user._id;

            // Detach payment method
            await stripe.paymentMethods.detach(methodId);

            // Update database
            const bankingCollection = fastify.mongo.db.collection('userBanking');
            await bankingCollection.updateOne(
                { userId: new ObjectId(userId), paymentMethodId: methodId },
                { $set: { isActive: false, updatedAt: new Date() } }
            );

            reply.send({
                success: true,
                message: 'Payment method removed successfully'
            });
        } catch (error) {
            console.error('Error removing payment method:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to remove payment method' 
            });
        }
    });

    // Get payout settings
    fastify.get('/api/affiliate/banking/payout-settings', async (request, reply) => {
        try {
            const userId = request.user._id;
            const settingsCollection = fastify.mongo.db.collection('payoutSettings');
            
            const settings = await settingsCollection.findOne({ userId: new ObjectId(userId) });
            
            reply.send({
                success: true,
                data: settings || {
                    minimumPayout: 50,
                    payoutFrequency: 'monthly'
                }
            });
        } catch (error) {
            console.error('Error fetching payout settings:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch payout settings' 
            });
        }
    });

    // Update payout settings
    fastify.post('/api/affiliate/banking/payout-settings', async (request, reply) => {
        try {
            const userId = request.user._id;
            const { minimumPayout, payoutFrequency } = request.body;

            const settingsCollection = fastify.mongo.db.collection('payoutSettings');
            await settingsCollection.updateOne(
                { userId: new ObjectId(userId) },
                {
                    $set: {
                        userId: new ObjectId(userId),
                        minimumPayout: parseInt(minimumPayout),
                        payoutFrequency,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );

            reply.send({
                success: true,
                message: 'Payout settings updated successfully'
            });
        } catch (error) {
            console.error('Error updating payout settings:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to update payout settings' 
            });
        }
    });

    // Get payout history
    fastify.get('/api/affiliate/banking/payout-history', async (request, reply) => {
        try {
            const userId = request.user._id;
            const page = parseInt(request.query.page) || 1;
            const limit = parseInt(request.query.limit) || 10;
            const skip = (page - 1) * limit;

            const payoutsCollection = fastify.mongo.db.collection('payouts');
            const payouts = await payoutsCollection
                .find({ userId: new ObjectId(userId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();

            const total = await payoutsCollection.countDocuments({ userId: new ObjectId(userId) });

            reply.send({
                success: true,
                data: {
                    payouts,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        hasNext: skip + limit < total,
                        hasPrev: page > 1
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching payout history:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch payout history' 
            });
        }
    });

    // Get earnings summary
    fastify.get('/api/affiliate/banking/earnings', async (request, reply) => {
        try {
            const userId = request.user._id;
            const { getReferralStats } = require('../models/affiliation-utils');
            
            const stats = await getReferralStats(fastify.mongo.db, userId);
            const payoutsCollection = fastify.mongo.db.collection('payouts');
            
            const totalPaidOut = await payoutsCollection.aggregate([
                { $match: { userId: new ObjectId(userId), status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).toArray();

            const pendingAmount = stats.earnings - (totalPaidOut[0]?.total || 0);

            reply.send({
                success: true,
                data: {
                    totalEarnings: stats.earnings,
                    pendingPayment: Math.max(0, pendingAmount),
                    totalPaidOut: totalPaidOut[0]?.total || 0,
                    activeReferrals: stats.activeReferrals
                }
            });
        } catch (error) {
            console.error('Error fetching earnings:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch earnings data' 
            });
        }
    });
}

module.exports = routes;
