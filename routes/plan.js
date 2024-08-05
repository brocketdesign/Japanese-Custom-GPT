
const { ObjectId } = require('mongodb');
const qs = require('qs');
const frontEnd = process.env.MODE == 'local'? 'http://localhost:3000' : 'https://lamix.hatoltd.com'
const stripe = process.env.MODE == 'local'? require('stripe')(process.env.STRIPE_SECRET_KEY_TEST) : require('stripe')(process.env.STRIPE_SECRET_KEY)

async function routes(fastify, options) {
  const plans = [
    {
      id: 'free',
      name: "お試しプラン",
      price: "無料",
      monthly: "無料",
      yearly: "無料",
      features: [
        "1日10件までチャットできる",
        "フレンドを1人まで作成できる",
        "無料プロンプトを使用できる",
        "簡単なサポート対応"
      ],
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
        "フレンドを10人まで作成できる",
        "無料プロンプトを使用できる",
        "新規機能のアクセス"
      ],
      messageLimit:200,
      chatLimit:10,
    },
    {
      id:'special',
      name: "特別プラン",
      price: "￥3,000円/月",
      monthly: "￥3,000円/月",
      yearly: "￥30,000円/年",
      monthly_id :'price_1PkCB5E5sP7DA1Xvy7K3aHHd',
      yearly_id :'price_1PkCBXE5sP7DA1Xvxxbhmw4y',
      features: [
        "毎日無制限でチャットできる",
        "フレンドを無制限で作成できる",
        "無料プロンプトを使用できる",
        "新機能への早期アクセス",
        "優先的なサポート対応"
      ],
      messageLimit:false,
      chatLimit:false,
    }
  ];

  fastify.get('/plan/list', async (request, reply) => {
    const user = await fastify.getUser(request, reply);
  
    if (request.query.update === 'true') {
      await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('plans').deleteMany({});
      await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('plans').insertOne({ plans });
    }
  
    const plansFromDb = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('plans').findOne();
    return reply.send(plansFromDb);
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
  
      // Check if the user already has an active subscription for this plan
      let existingSubscription = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('subscriptions').findOne({
        _id: new fastify.mongo.ObjectId(userId),
        currentPlanId: planPriceId,
        subscriptionStatus: 'active', // Consider what 'active' means in your context
      });
      if (existingSubscription) {
        return reply.status(400).send({ error: 'You already have an active subscription for this plan.' });
      }
      existingSubscription = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('subscriptions').findOne({
        _id: new fastify.mongo.ObjectId(userId),
        subscriptionStatus: 'active', // Consider what 'active' means in your context
      });
      if(existingSubscription && existingSubscription.currentPlanId != planPriceId ){
        console.log(`change plan to ${planId}`)
        return reply.send({
          action: 'upgrade',
          newPlanId: planId,
          billingCycle,
          method: 'POST',
          url: '/plan/upgrade',
        });
      }
  
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
        cancel_url: `${frontEnd}/plan/cancel-payment`, // Redirect here on cancellation
        metadata: {
          userId: user._id.toString(), // Optionally store user ID in metadata for future reference
        },
        locale: 'ja',
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
      const query = request.query; // Fastify automatically parses query strings
      const sessionId = query.session_id;
  
      if (!sessionId) {
        return reply.status(400).send({ error: 'Invalid session ID' });
      }
  
      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
  
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }
  
      // Find the user in your database
      const user = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users').findOne({
        email: session.customer_email,
      });
  
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
  
      // Retrieve subscription details
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
  
      if (!subscription) {
        return reply.status(404).send({ error: 'Subscription not found' });
      }
  
      // Update the user's subscription status and details in your database
      await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('subscriptions').updateOne(
        { _id: new fastify.mongo.ObjectId(user._id) },
        {
          $set: {
            stripeCustomerId: session.customer, // Store Stripe customer ID
            stripeSubscriptionId: session.subscription, // Store Stripe subscription ID
            subscriptionStatus: 'active', // Update subscription status
            currentPlanId: subscription.items.data[0].price.id, // Store current plan ID
            billingCycle: subscription.items.data[0].price.recurring.interval, // Store billing cycle
            subscriptionStartDate: new Date(subscription.start_date * 1000), // Convert Unix timestamp to Date
            subscriptionEndDate: new Date(subscription.current_period_end * 1000), // Convert Unix timestamp to Date
          },
        },
        { upsert: true } // Add this option to insert a new document if no match is found
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
      return reply.redirect(`${frontEnd}/my-plan?cancel-payment=true`);
    } catch (error) {
      console.error('Error handling cancellation:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/plan/cancel', async (request, reply) => {
    try {
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME)
      // Retrieve user
      let user = await fastify.getUser(request, reply);
      if (!user) {
        return reply.status(404).send({ error: 'ユーザーが見つかりません' }); // User not found
      }
      
      const userId = user._id;
      userSubscription = await db.collection('subscriptions').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      
      if (!userSubscription) {
        return reply.status(404).send({ error: 'ユーザーが見つかりません' }); // User not found
      }
      if(!userSubscription.stripeSubscriptionId){
        return reply.status(404).send({ error: 'サブスクリプションが見つかりません' }); // Subscription not found
      }
      // Retrieve Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(userSubscription.stripeSubscriptionId);
      
      if (!stripeSubscription) {
        return reply.status(404).send({ error: 'サブスクリプションが見つかりません' }); // Subscription not found
      }
  
      // Cancel Stripe subscription
      await stripe.subscriptions.cancel(stripeSubscription.id);
  
      // Update MongoDB subscription status
      const updateResult = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('subscriptions').updateOne(
        { _id: new fastify.mongo.ObjectId(user._id) },
        {
          $set: {
            subscriptionStatus: 'canceled',
            subscriptionEndDate: new Date(),
          },
          $unset: {
            stripeSubscriptionId: '',
          },
        }
      );
  
      if (updateResult.modifiedCount === 0) {
        return reply.status(500).send({ error: 'サブスクリプションの更新に失敗しました' }); // Failed to update subscription
      }
  
      return reply.send({ message: 'サブスクリプションがキャンセルされました' }); // Subscription canceled
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return reply.status(500).send({ error: 'サーバーエラーが発生しました' }); // Internal server error
    }
  });
  
  fastify.post('/plan/upgrade', async (request, reply) => {
    try {
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME)
      let user = await fastify.getUser(request, reply);
      const userId = user._id;
      userSubscription = await db.collection('subscriptions').findOne({ _id: new fastify.mongo.ObjectId(userId) });
  
      if (!userSubscription) {
        return reply.status(404).send({ error: 'User not found' });
      }
  
      const {newPlanId,billingCycle} = request.body;
      if (!newPlanId) {
        return reply.status(400).send({ error: 'Missing new plan ID' });
      }
  
      const newPlan = plans.find((plan) => plan.id === newPlanId);
      if (!newPlan) {
        return reply.status(400).send({ error: 'Invalid plan' });
      }
    // Determine the correct price ID based on the billing cycle
    const planPriceId = newPlan[`${billingCycle}_id`];

      const stripeSubscription = await stripe.subscriptions.retrieve(userSubscription.stripeSubscriptionId);
      if (!stripeSubscription) {
        return reply.status(404).send({ error: 'Subscription not found' });
      }
  
      try {
        await stripe.subscriptions.update(stripeSubscription.id, {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price: planPriceId,
            },
          ],
        });
              // Update the user's subscription status and details in your database
      await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('subscriptions').updateOne(
        { _id: new fastify.mongo.ObjectId(userId) },
        {
          $set: {
            currentPlanId: planPriceId, 
          },
        },
        { upsert: true } // Add this option to insert a new document if no match is found
      );
      } catch (stripeError) {
        return reply.status(500).send({ error: 'Error updating subscription', details: stripeError.message });
      }
  
      return reply.send({ message: 'Plan upgraded successfully', newPlan });
    } catch (error) {
      console.error('Error upgrading plan:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

  module.exports = routes;
  