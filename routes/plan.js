
const { ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const qs = require('qs');

async function routes(fastify, options) {
  const plans = [
    {
      id: 'free-trial',
      name: "お試しプラン",
      price: "無料",
      monthly: "無料",
      yearly: "無料",
      features: [
        "7日間無料",
        "1日10件までチャットできる",
        "フレンドを1人まで作成できる",
        "無料プロンプトを使用できる",
        "簡単なサポート対応"
      ]
    },
    {
      id: 'premium',
      name: "プレミアムプラン",
      price: "￥1,200円/月",
      monthly: "￥1,200円/月",
      yearly: "￥10,000円/年",
      monthly_id :'price_1Pju2iE5sP7DA1XvuCzNOMD9',
      yearly_id :'price_1PjuEvE5sP7DA1XvNPrP7Jgi',
      features: [
        "1日200件までチャットできる",
        "フレンドを3人まで作成できる",
        "無料プロンプトを使用できる",
        "新規機能のアクセス"
      ]
    },
    {
      id:'special',
      name: "特別プラン",
      price: "￥3,000円/月",
      monthly: "￥3,000円/月",
      yearly: "￥30,000円/年",
      features: [
        "毎日無制限でチャットできる",
        "フレンドを無制限で作成できる",
        "無料プロンプトを使用できる",
        "新機能への早期アクセス",
        "優先的なサポート対応"
      ]
    }
  ];

  const frontEnd = process.env.MODE == 'local'? 'http://localhost:3000' : 'https://lamix.hatoltd.com'

  fastify.get('/plan/list', async (request, reply) => {
    const user = await fastify.getUser(request, reply);
    return reply.send( {plans} );
  });

  fastify.post('/plan/subscribe', async (request, reply) => {
    try {
      // Retrieve user information
      let user = await fastify.getUser(request, reply);
      const userId = user._id;
  
      // Fetch the user from the database using their ObjectId
      user = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users').findOne({
        _id: new fastify.mongo.ObjectId(userId),
      });
  
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
  
      // Extract planId and billingCycle from the request body
      const { planId, billingCycle } = request.body;
  
      // Find the plan from your available plans
      const plan = plans.find((plan) => plan.id === planId);
  
      if (!plan) {
        return reply.status(400).send({ error: 'Invalid plan' });
      }
  
      // Determine the correct price ID based on the billing cycle
      const planPriceId = plan[`${billingCycle}_id`];
  
      // Create a Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'], // Accept card payments
        mode: 'subscription', // Subscription mode
        customer_email: user.email, // Automatically pre-fills the email field
        line_items: [
          {
            price: planPriceId, // Use the correct price ID from your Stripe dashboard
            quantity: 1,
          },
        ],
        success_url: `${frontEnd}/plan/success?session_id={CHECKOUT_SESSION_ID}`, // Redirect here on success
        cancel_url: `${frontEnd}/plam/cancel-payment`, // Redirect here on cancellation
        metadata: {
          userId: user._id.toString(), // Optionally store user ID in metadata for future reference
        },
      });
  
      // Return the session URL to redirect the user
      return reply.send({ url: session.url });
    } catch (error) {
      console.error('Error creating Stripe Checkout session:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/plan/success', async (request, reply) => {
    try {
      // Extract the session ID from the query parameters
      const query = qs.parse(request.url.split('?')[1]);
      const sessionId = query.session_id;
  
      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
  
      // Find the user in your database
      const user = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users').findOne({
        email: session.customer_email,
      });
  
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
  
      // Update the user's subscription status in your database
      await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users').updateOne(
        { _id: new fastify.mongo.ObjectId(user._id) },
        {
          $set: {
            stripeCustomerId: session.customer, // Store Stripe customer ID
            stripeSubscriptionId: session.subscription, // Store Stripe subscription ID
            subscriptionStatus: 'active', // Update subscription status
          },
        }
      );
  
      // Redirect the user to a success page or dashboard
      return reply.redirect(`${frontEnd}/chat/?subscribe=true`);
    } catch (error) {
      console.error('Error handling successful payment:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/plan/cancel-payment', async (request, reply) => {
    try {
      // You can log this event or notify the user if needed
      console.log('User canceled the payment process.');

      // Redirect the user to a cancellation page or inform them about the cancellation
      return reply.redirect(`${frontEnd}/cancel-payment?message=Subscription process canceled`);
    } catch (error) {
      console.error('Error handling cancellation:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/plan/cancel', async (request, reply) => {
    let user = await fastify.getUser(request, reply);
    const userId = user._id;
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

    const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    if (!stripeSubscription) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }

    await stripe.subscriptions.cancel(stripeSubscription.id);

    await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users').updateOne(
      { _id: new fastify.mongo.ObjectId(user._id) },
      { $unset: { stripeSubscriptionId: '' } }
    );

    return reply.send({ message: 'Subscription canceled' });
  });

  fastify.post('/plan/upgrade', async (request, reply) => {
    let user = await fastify.getUser(request, reply);
    const userId = user._id;
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    const newPlanId = request.body.newPlanId;
    const newPlan = plans.find((plan) => plan.id === newPlanId);

    if (!newPlan) {
      return reply.status(400).send({ error: 'Invalid plan' });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    if (!stripeSubscription) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }

    await stripe.subscriptions.update(stripeSubscription.id, {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          price: newPlanId,
        },
      ],
    });

    return reply.send({ message: 'Plan upgraded successfully' });
  });
}

  module.exports = routes;
  