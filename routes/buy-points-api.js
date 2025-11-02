const { ObjectId } = require('mongodb');
const stripe = process.env.MODE == 'local'
  ? require('stripe')(process.env.STRIPE_SECRET_KEY_TEST)
  : require('stripe')(process.env.STRIPE_SECRET_KEY);

const {
  getPointPackages,
  getPointPackage,
  getOrCreateStripeProduct,
  addPurchasedPoints,
  recordPointsPurchase,
  convertPriceToSmallestUnit,
} = require('../models/buy-points-utils');

const { getApiUrl } = require('../models/tool');

async function routes(fastify, options) {
  /**
   * Get available point packages for a language
   * GET /buy-points/packages?lang=en
   */
  fastify.get('/buy-points/packages', async (request, reply) => {
    try {
      const lang = request.query.lang || request.lang || 'en';
      const packages = getPointPackages(lang);

      return reply.send({
        success: true,
        packages: packages,
        language: lang,
      });
    } catch (error) {
      console.error('Error fetching point packages:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch packages',
      });
    }
  });

  /**
   * Get a specific point package
   * GET /buy-points/package/:packageId?lang=en
   */
  fastify.get('/buy-points/package/:packageId', async (request, reply) => {
    try {
      const { packageId } = request.params;
      const lang = request.query.lang || request.lang || 'en';
      const pointPackage = getPointPackage(packageId, lang);

      if (!pointPackage) {
        return reply.status(404).send({
          success: false,
          error: 'Package not found',
        });
      }

      return reply.send({
        success: true,
        package: pointPackage,
      });
    } catch (error) {
      console.error('Error fetching point package:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch package',
      });
    }
  });

  /**
   * Create checkout session for point purchase
   * POST /buy-points/checkout
   * Body: { packageId: 'points-500' }
   */
  fastify.post('/buy-points/checkout', async (request, reply) => {
    try {
      const user = request.user;
      const { packageId } = request.body;
      const lang = request.lang || 'en';

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!packageId) {
        return reply.status(400).send({
          success: false,
          error: 'Package ID is required',
        });
      }

      // Get package details
      const pointPackage = getPointPackage(packageId, lang);
      if (!pointPackage) {
        return reply.status(404).send({
          success: false,
          error: 'Package not found',
        });
      }

      // Get or create Stripe product
      const { product, price } = await getOrCreateStripeProduct(stripe, pointPackage, lang);

      const frontEnd = getApiUrl(request);
      const successUrl = `${frontEnd}/buy-points/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontEnd}/buy-points/cancel`;

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: user.email,
        metadata: {
          userId: user._id.toString(),
          packageId: packageId,
          points: pointPackage.points,
          language: lang,
        },
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return reply.send({
        success: true,
        sessionId: session.id,
        url: session.url,
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create checkout session',
        message: error.message,
      });
    }
  });

  /**
   * Handle successful point purchase
   * GET /buy-points/success?session_id=xyz
   * Redirects to /chat with points_purchase_success parameter
   */
  fastify.get('/buy-points/success', async (request, reply) => {
    try {
      const { session_id } = request.query;
      const user = request.user;
      const frontEnd = getApiUrl(request);

      if (!session_id) {
        return reply.redirect(`${frontEnd}/chat?points_purchase=failed&reason=no_session`);
      }

      if (!user) {
        return reply.redirect(`${frontEnd}/chat?points_purchase=failed&reason=not_authenticated`);
      }

      // Retrieve session from Stripe
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (!session) {
        return reply.redirect(`${frontEnd}/chat?points_purchase=failed&reason=session_not_found`);
      }

      // Verify payment was successful
      if (session.payment_status !== 'paid') {
        return reply.redirect(`${frontEnd}/chat?points_purchase=failed&reason=payment_not_completed`);
      }

      const userId = session.metadata?.userId;
      const points = parseInt(session.metadata?.points || 0);
      const packageId = session.metadata?.packageId;

      if (!userId || !points || !packageId) {
        return reply.redirect(`${frontEnd}/chat?points_purchase=failed&reason=invalid_metadata`);
      }

      // Check if points were already added (idempotency check)
      const purchasesCollection = fastify.mongo.db.collection('point_purchases');
      const existingPurchase = await purchasesCollection.findOne({
        stripeSessionId: session_id,
      });

      if (existingPurchase) {
        // Points already added, redirect with success
        return reply.redirect(
          `${frontEnd}/chat?points_purchase=success&points=${points}&packageId=${packageId}`
        );
      }

      // Add points to user
      const pointsResult = await addPurchasedPoints(
        fastify.mongo.db,
        userId,
        points,
        packageId,
        session_id,
        fastify
      );

      if (!pointsResult.success) {
        return reply.redirect(`${frontEnd}/chat?points_purchase=failed&reason=add_points_failed`);
      }

      // Record purchase
      await recordPointsPurchase(fastify.mongo.db, session, userId);

      // Successful purchase - redirect to chat with success notification
      return reply.redirect(
        `${frontEnd}/chat?points_purchase=success&points=${points}&packageId=${packageId}`
      );
    } catch (error) {
      console.error('Error processing purchase success:', error);
      const frontEnd = getApiUrl(request);
      return reply.redirect(`${frontEnd}/chat?points_purchase=failed&reason=server_error`);
    }
  });

  /**
   * Handle cancelled purchase
   * GET /buy-points/cancel
   * Redirects to /chat with points_purchase_cancelled parameter
   */
  fastify.get('/buy-points/cancel', async (request, reply) => {
    const frontEnd = getApiUrl(request);
    return reply.redirect(`${frontEnd}/chat?points_purchase=cancelled&reason=user_cancelled`);
  });

  /**
   * Stripe webhook for purchase events
   * POST /buy-points/webhook
   */
  fastify.post('/buy-points/webhook', async (request, reply) => {
    try {
      const sig = request.headers['stripe-signature'];
      const rawBody = request.rawBody;

      if (!sig || !rawBody) {
        return reply.status(400).send({ error: 'Missing signature or body' });
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      // Handle checkout.session.completed event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Verify payment was successful
        if (session.payment_status === 'paid') {
          const userId = session.metadata?.userId;
          const points = parseInt(session.metadata?.points || 0);
          const packageId = session.metadata?.packageId;

          if (userId && points && packageId) {
            // Check if already processed
            const purchasesCollection = fastify.mongo.db.collection('point_purchases');
            const existingPurchase = await purchasesCollection.findOne({
              stripeSessionId: session.id,
            });

            if (!existingPurchase) {
              // Add points if not already processed
              await addPurchasedPoints(
                fastify.mongo.db,
                userId,
                points,
                packageId,
                session.id,
                fastify
              );

              // Record purchase
              await recordPointsPurchase(fastify.mongo.db, session, userId);

              console.log(`[buy-points/webhook] Points added: ${points} to user ${userId}`);
            }
          }
        }
      }

      return reply.send({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Get user's purchase history
   * GET /buy-points/history
   */
  fastify.get('/buy-points/history', async (request, reply) => {
    try {
      const user = request.user;

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated',
        });
      }

      const purchasesCollection = fastify.mongo.db.collection('point_purchases');
      const purchases = await purchasesCollection
        .find({ userId: new ObjectId(user._id) })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      return reply.send({
        success: true,
        purchases: purchases,
      });
    } catch (error) {
      console.error('Error fetching purchase history:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch purchase history',
      });
    }
  });
}

module.exports = routes;
