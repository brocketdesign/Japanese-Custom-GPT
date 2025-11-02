const { ObjectId } = require('mongodb');

/**
 * Buy Points Utility Functions
 * Handles creating point packages, Stripe products, and managing point purchases
 */

/**
 * Define point packages with pricing for different currencies and languages
 * Structure allows easy management of point tiers
 */
const pointPackages = {
  en: [
    {
      id: 'points-500',
      points: 500,
      price: '4.99',
      currency: 'USD',
      discount: '0%',
      originalPrice: '4.99',
      description: 'Perfect for occasional use',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-1200',
      points: 1200,
      price: '9.99',
      currency: 'USD',
      discount: '17% OFF',
      originalPrice: '12.00',
      description: 'Best value for regular users',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-3000',
      points: 3000,
      price: '19.99',
      currency: 'USD',
      discount: '33% OFF',
      originalPrice: '29.99',
      description: 'Perfect for power users',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-6000',
      points: 6000,
      price: '34.99',
      currency: 'USD',
      discount: '42% OFF',
      originalPrice: '59.99',
      description: 'Maximum value bundle',
      billingCycle: 'one-time',
      isOneTime: true,
    },
  ],
  fr: [
    {
      id: 'points-500',
      points: 500,
      price: '4.99',
      currency: 'EUR',
      discount: '0%',
      originalPrice: '4.99',
      description: 'Parfait pour une utilisation occasionnelle',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-1200',
      points: 1200,
      price: '9.99',
      currency: 'EUR',
      discount: '17% DE RÉDUCTION',
      originalPrice: '12.00',
      description: 'Meilleure valeur pour les utilisateurs réguliers',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-3000',
      points: 3000,
      price: '19.99',
      currency: 'EUR',
      discount: '33% DE RÉDUCTION',
      originalPrice: '29.99',
      description: 'Parfait pour les utilisateurs avancés',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-6000',
      points: 6000,
      price: '34.99',
      currency: 'EUR',
      discount: '42% DE RÉDUCTION',
      originalPrice: '59.99',
      description: 'Forfait valeur maximale',
      billingCycle: 'one-time',
      isOneTime: true,
    },
  ],
  ja: [
    {
      id: 'points-500',
      points: 500,
      price: '499',
      currency: 'JPY',
      discount: '0%',
      originalPrice: '499',
      description: '時々使用する方に最適',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-1200',
      points: 1200,
      price: '999',
      currency: 'JPY',
      discount: '17% 割引',
      originalPrice: '1200',
      description: '定期的に使用する方に最高の価値',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-3000',
      points: 3000,
      price: '1999',
      currency: 'JPY',
      discount: '33% 割引',
      originalPrice: '2999',
      description: 'パワーユーザーに最適',
      billingCycle: 'one-time',
      isOneTime: true,
    },
    {
      id: 'points-6000',
      points: 6000,
      price: '3499',
      currency: 'JPY',
      discount: '42% 割引',
      originalPrice: '5999',
      description: '最大値バンドル',
      billingCycle: 'one-time',
      isOneTime: true,
    },
  ],
};

/**
 * Get point packages for a specific language
 * @param {string} lang - Language code (en, fr, ja)
 * @returns {Array} Point packages for the language
 */
function getPointPackages(lang = 'en') {
  return pointPackages[lang] || pointPackages['en'];
}

/**
 * Get a specific point package by ID and language
 * @param {string} packageId - Package ID
 * @param {string} lang - Language code
 * @returns {Object} Point package details
 */
function getPointPackage(packageId, lang = 'en') {
  const packages = getPointPackages(lang);
  return packages.find(pkg => pkg.id === packageId);
}

/**
 * Convert amount to the smallest currency unit for Stripe
 * @param {string} currency - Currency code (USD, EUR, JPY)
 * @param {string} price - Price as string
 * @returns {number} Amount in smallest currency unit
 */
function convertPriceToSmallestUnit(currency, price) {
  const numPrice = parseFloat(price.replace(',', '.'));
  
  // JPY doesn't use decimal places
  if (currency.toLowerCase() === 'jpy') {
    return Math.round(numPrice);
  }
  
  // USD, EUR, and most other currencies use 2 decimal places
  return Math.round(numPrice * 100);
}

/**
 * Create a Stripe product dynamically for a point package
 * @param {Object} stripe - Stripe instance
 * @param {Object} packageData - Point package data
 * @param {string} lang - Language code
 * @returns {Object} Stripe product and price data
 */
async function createStripeProductForPackage(stripe, packageData, lang = 'en') {
  try {
    // Create product with metadata for tracking
    const product = await stripe.products.create({
      name: `${packageData.points} Points`,
      description: packageData.description,
      metadata: {
        packageId: packageData.id,
        points: packageData.points,
        language: lang,
        pointsPackage: 'true',
      },
      type: 'service',
    });

    // Create price for the product
    const currency = packageData.currency.toLowerCase();
    const amount = convertPriceToSmallestUnit(packageData.currency, packageData.price);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: currency,
      metadata: {
        packageId: packageData.id,
        points: packageData.points,
        language: lang,
      },
    });

    return {
      product: product,
      price: price,
      packageData: packageData,
    };
  } catch (error) {
    console.error('Error creating Stripe product:', error);
    throw error;
  }
}

/**
 * Get or create Stripe product for a point package
 * Uses product metadata to find existing products
 * @param {Object} stripe - Stripe instance
 * @param {Object} packageData - Point package data
 * @param {string} lang - Language code
 * @returns {Object} Stripe product and price data
 */
async function getOrCreateStripeProduct(stripe, packageData, lang = 'en') {
  try {
    // Search for existing product with matching metadata
    const products = await stripe.products.list({
      limit: 100,
    });

    const existingProduct = products.data.find(
      (p) =>
        p.metadata?.packageId === packageData.id &&
        p.metadata?.language === lang &&
        p.metadata?.pointsPackage === 'true'
    );

    if (existingProduct) {
      // Get the price for this product
      const prices = await stripe.prices.list({
        product: existingProduct.id,
        limit: 1,
      });

      return {
        product: existingProduct,
        price: prices.data[0],
        packageData: packageData,
      };
    }

    // Create new product if it doesn't exist
    return await createStripeProductForPackage(stripe, packageData, lang);
  } catch (error) {
    console.error('Error getting or creating Stripe product:', error);
    throw error;
  }
}

/**
 * Add purchased points to user after successful payment
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {number} points - Points to add
 * @param {string} packageId - Point package ID
 * @param {string} stripeSessionId - Stripe session ID for tracking
 * @param {Object} fastify - Fastify instance for notifications
 * @returns {Object} Result with updated user and transaction data
 */
async function addPurchasedPoints(db, userId, points, packageId, stripeSessionId, fastify = null) {
  try {
    const usersCollection = db.collection('users');
    const pointsHistoryCollection = db.collection('points_history');

    // Create transaction record
    const transaction = {
      userId: new ObjectId(userId),
      type: 'credit',
      points: points,
      reason: 'Points purchased',
      source: 'purchase',
      packageId: packageId,
      stripeSessionId: stripeSessionId,
      createdAt: new Date(),
    };

    // Add points to user and create history record
    const [userResult, historyResult] = await Promise.all([
      usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $inc: { points: points },
          $set: { lastPointsUpdate: new Date() },
        }
      ),
      pointsHistoryCollection.insertOne(transaction),
    ]);

    // Get updated user data
    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    // Send refresh notification
    if (fastify && fastify.sendNotificationToUser) {
      try {
        await fastify.sendNotificationToUser(userId.toString(), 'refreshUserPoints', {
          userId: userId.toString(),
          points: points,
          packageId: packageId,
        });
      } catch (notificationError) {
        console.error('Error sending refresh points notification:', notificationError);
      }
    }

    return {
      success: userResult.modifiedCount > 0,
      user: updatedUser,
      transaction: { ...transaction, _id: historyResult.insertedId },
    };
  } catch (error) {
    console.error('Error adding purchased points:', error);
    throw error;
  }
}

/**
 * Process purchase transaction and store metadata
 * @param {Object} db - MongoDB database instance
 * @param {Object} sessionData - Stripe session data
 * @param {string} userId - User ID
 * @returns {Object} Purchase record
 */
async function recordPointsPurchase(db, sessionData, userId) {
  try {
    const purchasesCollection = db.collection('point_purchases');

    const purchase = {
      userId: new ObjectId(userId),
      stripeSessionId: sessionData.id,
      stripePaymentIntentId: sessionData.payment_intent,
      packageId: sessionData.metadata?.packageId,
      points: parseInt(sessionData.metadata?.points || 0),
      amount: sessionData.amount_total,
      currency: sessionData.currency.toUpperCase(),
      status: 'completed',
      email: sessionData.customer_email,
      createdAt: new Date(),
    };

    const result = await purchasesCollection.insertOne(purchase);

    return {
      success: true,
      purchase: { ...purchase, _id: result.insertedId },
    };
  } catch (error) {
    console.error('Error recording points purchase:', error);
    throw error;
  }
}

module.exports = {
  pointPackages,
  getPointPackages,
  getPointPackage,
  convertPriceToSmallestUnit,
  createStripeProductForPackage,
  getOrCreateStripeProduct,
  addPurchasedPoints,
  recordPointsPurchase,
};
