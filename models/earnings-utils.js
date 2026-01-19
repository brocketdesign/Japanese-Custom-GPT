const { ObjectId } = require('mongodb');

// Platform configuration
const PLATFORM_COMMISSION_RATE = 0.15; // 15% platform fee
const MINIMUM_PAYOUT_USD = 50; // Minimum $50 for payout
const PAYOUT_SCHEDULES = ['weekly', 'biweekly', 'monthly'];
const CURRENCIES = ['usd', 'eur', 'jpy'];

/**
 * Get creator earnings summary
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 * @returns {Object} Earnings summary
 */
async function getCreatorEarnings(db, creatorId) {
    const earningsCollection = db.collection('creatorEarnings');
    const payoutsCollection = db.collection('creatorPayouts');
    const tipsCollection = db.collection('creatorTips');
    
    const creatorObjId = new ObjectId(creatorId);
    
    // Get all time earnings
    const allTimeEarnings = await earningsCollection.aggregate([
        { $match: { creatorId: creatorObjId } },
        { 
            $group: { 
                _id: null,
                subscriptionRevenue: { $sum: '$subscriptionRevenue' },
                tipsRevenue: { $sum: '$tipsRevenue' },
                grossRevenue: { $sum: '$grossRevenue' },
                platformFee: { $sum: '$platformFee' },
                netRevenue: { $sum: '$netRevenue' }
            } 
        }
    ]).toArray();
    
    // Get total paid out
    const totalPaidOut = await payoutsCollection.aggregate([
        { $match: { creatorId: creatorObjId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    // Get pending payouts
    const pendingPayouts = await payoutsCollection.aggregate([
        { $match: { creatorId: creatorObjId, status: { $in: ['pending', 'processing'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    // Calculate current month earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const currentMonthEarnings = await earningsCollection.aggregate([
        { 
            $match: { 
                creatorId: creatorObjId,
                periodStart: { $gte: startOfMonth }
            } 
        },
        { 
            $group: { 
                _id: null,
                subscriptionRevenue: { $sum: '$subscriptionRevenue' },
                tipsRevenue: { $sum: '$tipsRevenue' },
                netRevenue: { $sum: '$netRevenue' }
            } 
        }
    ]).toArray();
    
    const earnings = allTimeEarnings[0] || {
        subscriptionRevenue: 0,
        tipsRevenue: 0,
        grossRevenue: 0,
        platformFee: 0,
        netRevenue: 0
    };
    
    const paidOut = totalPaidOut[0]?.total || 0;
    const pendingPayout = pendingPayouts[0]?.total || 0;
    const availableBalance = Math.max(0, earnings.netRevenue - paidOut - pendingPayout);
    
    return {
        allTime: {
            subscriptionRevenue: earnings.subscriptionRevenue,
            tipsRevenue: earnings.tipsRevenue,
            grossRevenue: earnings.grossRevenue,
            platformFee: earnings.platformFee,
            netRevenue: earnings.netRevenue
        },
        currentMonth: currentMonthEarnings[0] || {
            subscriptionRevenue: 0,
            tipsRevenue: 0,
            netRevenue: 0
        },
        payouts: {
            totalPaidOut: paidOut,
            pendingPayout: pendingPayout,
            availableBalance: availableBalance
        },
        canRequestPayout: availableBalance >= MINIMUM_PAYOUT_USD,
        minimumPayout: MINIMUM_PAYOUT_USD,
        platformCommissionRate: PLATFORM_COMMISSION_RATE
    };
}

/**
 * Record subscription payment and calculate earnings
 * @param {Object} db - MongoDB database instance
 * @param {Object} data - Subscription payment data
 */
async function recordSubscriptionPayment(db, data) {
    const { creatorId, subscriberId, amount, currency = 'usd', tierId, stripePaymentId } = data;
    
    const earningsCollection = db.collection('creatorEarnings');
    const transactionsCollection = db.collection('creatorTransactions');
    
    const creatorObjId = new ObjectId(creatorId);
    const subscriberObjId = new ObjectId(subscriberId);
    
    // Calculate earnings
    const grossAmount = amount;
    const platformFee = Math.round(grossAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
    const netAmount = grossAmount - platformFee;
    
    // Get or create current period earnings record
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Update or create earnings record for this period
    await earningsCollection.updateOne(
        { 
            creatorId: creatorObjId,
            periodStart: periodStart,
            periodEnd: periodEnd
        },
        {
            $inc: {
                subscriptionRevenue: grossAmount,
                grossRevenue: grossAmount,
                platformFee: platformFee,
                netRevenue: netAmount
            },
            $setOnInsert: {
                creatorId: creatorObjId,
                periodStart: periodStart,
                periodEnd: periodEnd,
                tipsRevenue: 0,
                status: 'pending',
                currency: currency,
                createdAt: now
            },
            $set: {
                updatedAt: now
            }
        },
        { upsert: true }
    );
    
    // Record transaction for audit trail
    await transactionsCollection.insertOne({
        creatorId: creatorObjId,
        subscriberId: subscriberObjId,
        type: 'subscription',
        grossAmount: grossAmount,
        platformFee: platformFee,
        netAmount: netAmount,
        currency: currency,
        tierId: tierId ? new ObjectId(tierId) : null,
        stripePaymentId: stripePaymentId,
        status: 'completed',
        createdAt: now
    });
    
    return {
        grossAmount,
        platformFee,
        netAmount
    };
}

/**
 * Record a tip payment
 * @param {Object} db - MongoDB database instance
 * @param {Object} data - Tip data
 */
async function recordTip(db, data) {
    const { creatorId, tipperId, amount, currency = 'usd', postId, message, stripePaymentId } = data;
    
    const earningsCollection = db.collection('creatorEarnings');
    const tipsCollection = db.collection('creatorTips');
    const transactionsCollection = db.collection('creatorTransactions');
    
    const creatorObjId = new ObjectId(creatorId);
    const tipperObjId = new ObjectId(tipperId);
    
    // Calculate earnings
    const grossAmount = amount;
    const platformFee = Math.round(grossAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
    const netAmount = grossAmount - platformFee;
    
    // Get or create current period earnings record
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Update earnings record
    await earningsCollection.updateOne(
        { 
            creatorId: creatorObjId,
            periodStart: periodStart,
            periodEnd: periodEnd
        },
        {
            $inc: {
                tipsRevenue: grossAmount,
                grossRevenue: grossAmount,
                platformFee: platformFee,
                netRevenue: netAmount
            },
            $setOnInsert: {
                creatorId: creatorObjId,
                periodStart: periodStart,
                periodEnd: periodEnd,
                subscriptionRevenue: 0,
                status: 'pending',
                currency: currency,
                createdAt: now
            },
            $set: {
                updatedAt: now
            }
        },
        { upsert: true }
    );
    
    // Record the tip
    const tip = {
        creatorId: creatorObjId,
        tipperId: tipperObjId,
        grossAmount: grossAmount,
        platformFee: platformFee,
        netAmount: netAmount,
        currency: currency,
        postId: postId ? new ObjectId(postId) : null,
        message: message || null,
        stripePaymentId: stripePaymentId,
        status: 'completed',
        createdAt: now
    };
    
    await tipsCollection.insertOne(tip);
    
    // Record transaction
    await transactionsCollection.insertOne({
        creatorId: creatorObjId,
        tipperId: tipperObjId,
        type: 'tip',
        grossAmount: grossAmount,
        platformFee: platformFee,
        netAmount: netAmount,
        currency: currency,
        postId: postId ? new ObjectId(postId) : null,
        stripePaymentId: stripePaymentId,
        status: 'completed',
        createdAt: now
    });
    
    return {
        tipId: tip._id,
        grossAmount,
        platformFee,
        netAmount
    };
}

/**
 * Request a payout
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 * @param {number} amount - Amount to request (in creator's currency)
 * @param {string} currency - Currency code
 */
async function requestPayout(db, creatorId, amount, currency = 'usd') {
    const payoutsCollection = db.collection('creatorPayouts');
    const usersCollection = db.collection('users');
    const bankingCollection = db.collection('userBanking');
    
    const creatorObjId = new ObjectId(creatorId);
    
    // Get creator's available balance
    const earnings = await getCreatorEarnings(db, creatorId);
    
    if (amount > earnings.payouts.availableBalance) {
        throw new Error('Insufficient balance');
    }
    
    if (amount < MINIMUM_PAYOUT_USD) {
        throw new Error(`Minimum payout is $${MINIMUM_PAYOUT_USD}`);
    }
    
    // Check if creator has banking info
    const bankingInfo = await bankingCollection.findOne({ 
        userId: creatorObjId, 
        isActive: true 
    });
    
    if (!bankingInfo) {
        throw new Error('No banking information configured. Please add a payout method.');
    }
    
    // Check for pending payouts
    const pendingPayout = await payoutsCollection.findOne({
        creatorId: creatorObjId,
        status: { $in: ['pending', 'processing'] }
    });
    
    if (pendingPayout) {
        throw new Error('You already have a pending payout request');
    }
    
    // Create payout request
    const payout = {
        creatorId: creatorObjId,
        amount: amount,
        currency: currency,
        status: 'pending',
        paymentMethodId: bankingInfo.paymentMethodId,
        requestedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
    };
    
    const result = await payoutsCollection.insertOne(payout);
    
    return {
        payoutId: result.insertedId,
        amount: amount,
        currency: currency,
        status: 'pending'
    };
}

/**
 * Get payout history for a creator
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 * @param {Object} options - Query options
 */
async function getPayoutHistory(db, creatorId, options = {}) {
    const { page = 1, limit = 10, status = null } = options;
    const payoutsCollection = db.collection('creatorPayouts');
    
    const creatorObjId = new ObjectId(creatorId);
    const skip = (page - 1) * limit;
    
    const query = { creatorId: creatorObjId };
    if (status) {
        query.status = status;
    }
    
    const payouts = await payoutsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    
    const total = await payoutsCollection.countDocuments(query);
    
    return {
        payouts,
        pagination: {
            current: page,
            total: Math.ceil(total / limit),
            totalItems: total,
            hasNext: skip + limit < total,
            hasPrev: page > 1
        }
    };
}

/**
 * Get transaction history for a creator
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 * @param {Object} options - Query options
 */
async function getTransactionHistory(db, creatorId, options = {}) {
    const { page = 1, limit = 20, type = null, startDate = null, endDate = null } = options;
    const transactionsCollection = db.collection('creatorTransactions');
    
    const creatorObjId = new ObjectId(creatorId);
    const skip = (page - 1) * limit;
    
    const query = { creatorId: creatorObjId };
    
    if (type) {
        query.type = type;
    }
    
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const transactions = await transactionsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    
    const total = await transactionsCollection.countDocuments(query);
    
    return {
        transactions,
        pagination: {
            current: page,
            total: Math.ceil(total / limit),
            totalItems: total,
            hasNext: skip + limit < total,
            hasPrev: page > 1
        }
    };
}

/**
 * Get monthly earnings breakdown
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 * @param {number} months - Number of months to fetch
 */
async function getMonthlyEarningsBreakdown(db, creatorId, months = 12) {
    const earningsCollection = db.collection('creatorEarnings');
    const creatorObjId = new ObjectId(creatorId);
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    
    const earnings = await earningsCollection
        .find({
            creatorId: creatorObjId,
            periodStart: { $gte: startDate }
        })
        .sort({ periodStart: 1 })
        .toArray();
    
    // Fill in missing months with zero values
    const result = [];
    const now = new Date();
    
    for (let i = 0; i < months; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        
        const monthEarnings = earnings.find(e => {
            const eMonth = `${e.periodStart.getFullYear()}-${String(e.periodStart.getMonth() + 1).padStart(2, '0')}`;
            return eMonth === monthKey;
        });
        
        result.push({
            month: monthKey,
            monthLabel: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            subscriptionRevenue: monthEarnings?.subscriptionRevenue || 0,
            tipsRevenue: monthEarnings?.tipsRevenue || 0,
            grossRevenue: monthEarnings?.grossRevenue || 0,
            platformFee: monthEarnings?.platformFee || 0,
            netRevenue: monthEarnings?.netRevenue || 0
        });
    }
    
    return result;
}

/**
 * Get recent tips for a creator
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 * @param {number} limit - Number of tips to fetch
 */
async function getRecentTips(db, creatorId, limit = 10) {
    const tipsCollection = db.collection('creatorTips');
    const usersCollection = db.collection('users');
    
    const creatorObjId = new ObjectId(creatorId);
    
    const tips = await tipsCollection
        .find({ creatorId: creatorObjId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
    
    // Get tipper info
    const tipperIds = [...new Set(tips.map(t => t.tipperId))];
    const tippers = await usersCollection
        .find({ _id: { $in: tipperIds } })
        .project({ nickname: 1, profileImage: 1 })
        .toArray();
    
    const tipperMap = {};
    tippers.forEach(t => {
        tipperMap[t._id.toString()] = t;
    });
    
    return tips.map(tip => ({
        ...tip,
        tipper: tipperMap[tip.tipperId.toString()] || { nickname: 'Anonymous' }
    }));
}

/**
 * Get subscriber count and revenue stats
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 */
async function getSubscriberStats(db, creatorId) {
    const subscriptionsCollection = db.collection('subscriptions');
    const creatorObjId = new ObjectId(creatorId);
    
    // Active subscribers
    const activeSubscribers = await subscriptionsCollection.countDocuments({
        creatorId: creatorObjId,
        status: 'active'
    });
    
    // Total subscribers (including churned)
    const totalSubscribers = await subscriptionsCollection.countDocuments({
        creatorId: creatorObjId
    });
    
    // New subscribers this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonth = await subscriptionsCollection.countDocuments({
        creatorId: creatorObjId,
        createdAt: { $gte: startOfMonth }
    });
    
    // Churned this month
    const churnedThisMonth = await subscriptionsCollection.countDocuments({
        creatorId: creatorObjId,
        cancelledAt: { $gte: startOfMonth },
        status: 'cancelled'
    });
    
    // Calculate MRR (Monthly Recurring Revenue) - simplified
    const activeWithTiers = await subscriptionsCollection.aggregate([
        { $match: { creatorId: creatorObjId, status: 'active' } },
        { $lookup: {
            from: 'creatorTiers',
            localField: 'tierId',
            foreignField: '_id',
            as: 'tier'
        }},
        { $unwind: { path: '$tier', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, mrr: { $sum: '$tier.price' } } }
    ]).toArray();
    
    const mrr = activeWithTiers[0]?.mrr || 0;
    const netMrr = mrr * (1 - PLATFORM_COMMISSION_RATE);
    
    return {
        activeSubscribers,
        totalSubscribers,
        newThisMonth,
        churnedThisMonth,
        churnRate: totalSubscribers > 0 ? ((churnedThisMonth / totalSubscribers) * 100).toFixed(2) : 0,
        mrr: mrr / 100, // Convert cents to dollars
        netMrr: netMrr / 100
    };
}

/**
 * Get creator's payout settings
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 */
async function getPayoutSettings(db, creatorId) {
    const settingsCollection = db.collection('creatorPayoutSettings');
    const creatorObjId = new ObjectId(creatorId);
    
    const settings = await settingsCollection.findOne({ creatorId: creatorObjId });
    
    return settings || {
        creatorId: creatorObjId,
        minimumPayout: MINIMUM_PAYOUT_USD,
        payoutSchedule: 'monthly',
        autoPayoutEnabled: false,
        currency: 'usd'
    };
}

/**
 * Update creator's payout settings
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} creatorId - Creator user ID
 * @param {Object} settings - Settings to update
 */
async function updatePayoutSettings(db, creatorId, settings) {
    const settingsCollection = db.collection('creatorPayoutSettings');
    const creatorObjId = new ObjectId(creatorId);
    
    const { minimumPayout, payoutSchedule, autoPayoutEnabled, currency } = settings;
    
    // Validate settings
    if (minimumPayout && minimumPayout < MINIMUM_PAYOUT_USD) {
        throw new Error(`Minimum payout cannot be less than $${MINIMUM_PAYOUT_USD}`);
    }
    
    if (payoutSchedule && !PAYOUT_SCHEDULES.includes(payoutSchedule)) {
        throw new Error('Invalid payout schedule');
    }
    
    if (currency && !CURRENCIES.includes(currency)) {
        throw new Error('Invalid currency');
    }
    
    const updateData = {
        updatedAt: new Date()
    };
    
    if (minimumPayout !== undefined) updateData.minimumPayout = minimumPayout;
    if (payoutSchedule !== undefined) updateData.payoutSchedule = payoutSchedule;
    if (autoPayoutEnabled !== undefined) updateData.autoPayoutEnabled = autoPayoutEnabled;
    if (currency !== undefined) updateData.currency = currency;
    
    await settingsCollection.updateOne(
        { creatorId: creatorObjId },
        {
            $set: updateData,
            $setOnInsert: {
                creatorId: creatorObjId,
                createdAt: new Date()
            }
        },
        { upsert: true }
    );
    
    return getPayoutSettings(db, creatorId);
}

/**
 * Process payout (admin/cron function)
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} payoutId - Payout ID
 * @param {Object} result - Processing result
 */
async function processPayout(db, payoutId, result) {
    const payoutsCollection = db.collection('creatorPayouts');
    const payoutObjId = new ObjectId(payoutId);
    
    const { success, stripeTransferId, error } = result;
    
    await payoutsCollection.updateOne(
        { _id: payoutObjId },
        {
            $set: {
                status: success ? 'completed' : 'failed',
                stripeTransferId: stripeTransferId || null,
                processedAt: new Date(),
                error: error || null,
                updatedAt: new Date()
            }
        }
    );
}

/**
 * Check if user is a creator
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 */
async function isCreator(db, userId) {
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne(
        { _id: new ObjectId(userId) },
        { projection: { isCreator: 1 } }
    );
    return user?.isCreator === true;
}

module.exports = {
    // Constants
    PLATFORM_COMMISSION_RATE,
    MINIMUM_PAYOUT_USD,
    PAYOUT_SCHEDULES,
    CURRENCIES,
    
    // Earnings functions
    getCreatorEarnings,
    recordSubscriptionPayment,
    recordTip,
    getMonthlyEarningsBreakdown,
    
    // Payout functions
    requestPayout,
    getPayoutHistory,
    getPayoutSettings,
    updatePayoutSettings,
    processPayout,
    
    // Transaction functions
    getTransactionHistory,
    
    // Stats functions
    getRecentTips,
    getSubscriberStats,
    
    // Utility functions
    isCreator
};
