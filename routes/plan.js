
const { ObjectId } = require('mongodb');
const qs = require('qs');
const stripe = process.env.MODE == 'local'? require('stripe')(process.env.STRIPE_SECRET_KEY_TEST) : require('stripe')(process.env.STRIPE_SECRET_KEY)

async function routes(fastify, options) {

  const plans = 
    {
      fr: {
        name: "Plan Premium",
        price: "11,00 €/mois",
        monthly: "50,00 €/mois",
        yearly: "9,99 €/mois",
        features: [
          "💬   Chat illimité tous les jours",
          "👥   Créer des amis illimités",
          "🎨   Créer de nouveaux personnages",
          "🚀   Accès anticipé aux nouvelles fonctionnalités",
          "🗂   Affichage de plusieurs options de chat",
          "🖼   Génération d'images illimitée",
          "💡   Suggestions de messages illimitées",
          "🔓   Débloquer toutes les images"
        ],
        messageLimit: 'Illimité',
        chatLimit: 'Illimité',
        imageLimit: 'Illimité',
        messageIdeasLimit: 'Illimité'
      },
      en: {
        name: "Premium Plan",
        price: "$11.00/month",
        monthly: "$50.00/month",
        yearly: "$9.99/month",
        features: [
          "💬   Unlimited chat every day",
          "👥   Create unlimited friends",
          "🎨   Create new characters",
          "🚀   Early access to new features",
          "🗂   Multiple chat options display",
          "🖼   Unlimited image generation",
          "💡   Unlimited message suggestions",
          "🔓   Unlock all images"
        ],
        messageLimit: 'Unlimited',
        chatLimit: 'Unlimited',
        imageLimit: 'Unlimited',
        messageIdeasLimit: 'Unlimited'
      },
      ja: {
        name: "プレミアムプラン",
        price: "￥1100円/月",
        monthly: "￥5,000円/月",
        yearly: "￥990円/月",
        features: [
          "💬   毎日無制限でチャットできる",
          "👥   フレンドを無制限で作成できる",
          "🎨   新しいキャラクターを作成する",
          "🚀   新機能の先行アクセス",
          "🗂   複数選択肢のチャット表示",
          "🖼   無制限の画像生成を受け取る",
          "💡   無制限のメッセージ提案機能",
          "🔓   画像をすべて解除する"
        ],
        messageLimit: '無制限',
        chatLimit: '無制限',
        imageLimit: '無制限',
        messageIdeasLimit: '無制限'
      }
    };  

  fastify.get('/plan/list', async (request, reply) => {
    const lang = request.query.lang;
    return reply.send(plans[lang]);
  });
  fastify.post('/plan/subscribe', async (request, reply) => {
    try {
      const frontEnd = process.env.MODE === 'local' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.host}`;

      // Retrieve user information
      let user = request.user;
      const userId = user._id;
  
      // Fetch the user from the database using their ObjectId
      user = await fastify.mongo.db.collection('users').findOne({
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
      let existingSubscription = await fastify.mongo.db.collection('subscriptions').findOne({
        _id: new fastify.mongo.ObjectId(userId),
        currentPlanId: planPriceId,
        subscriptionStatus: 'active',
      });
      if (existingSubscription) {
        return reply.status(400).send({ error: 'You already have an active subscription for this plan.' });
      }
      existingSubscription = await fastify.mongo.db.collection('subscriptions').findOne({
        _id: new fastify.mongo.ObjectId(userId),
        subscriptionStatus: 'active', 
      });
      if(existingSubscription && existingSubscription.currentPlanId != planPriceId ){
        console.log(`change plan to ${planId} ${billingCycle}`)
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
      const frontEnd = process.env.MODE === 'local' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.host}`;
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
      const user = await fastify.mongo.db.collection('users').findOne({
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
  
      // Define the premium plan IDs
      const premiumMonthlyId = process.env.MODE == 'local' ? process.env.STRIPE_PREMIUM_MONTLY_TEST : process.env.STRIPE_PREMIUM_MONTLY;
      const premiumYearlyId = process.env.MODE == 'local' ? process.env.STRIPE_PREMIUM_YEARLY_TEST : process.env.STRIPE_PREMIUM_YEARLY;

      // Update the user's subscription status and details in your database
      await fastify.mongo.db.collection('subscriptions').updateOne(
        { _id: new fastify.mongo.ObjectId(user._id) },
        {
          $set: {
            stripeCustomerId: session.customer, 
            stripeSubscriptionId: session.subscription, 
            subscriptionStatus: 'active',
            currentPlanId: subscription.items.data[0].price.id, 
            billingCycle: subscription.items.data[0].price.recurring.interval+'ly', 
            subscriptionStartDate: new Date(subscription.start_date * 1000), 
            subscriptionEndDate: new Date(subscription.current_period_end * 1000), 
          },
        },
        { upsert: true } 
      );
      await fastify.mongo.db.collection('users').updateOne(
        { _id: new fastify.mongo.ObjectId(user._id) },
        {
          $set: { 
            stripeCustomerId: session.customer, 
            subscriptionStatus: 'active',
            stripeSubscriptionId: session.subscription
          }
        }
      );
      if((subscription.items.data[0].price.id === premiumMonthlyId || subscription.items.data[0].price.id === premiumYearlyId)){
        // Add 1000 coins to the user's account
        await fastify.mongo.db.collection('users').updateOne(
          { _id: new fastify.mongo.ObjectId(user._id) },
          {
            $inc: { coins: 1000 }
          }
        );
      }


      // Redirect the user to a success page or dashboard
      return reply.redirect(`${frontEnd}/chat/?subscribe=true`);
    } catch (error) {
      console.error('Error handling successful payment:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
  

  fastify.get('/plan/cancel-payment', async (request, reply) => {
    try {
      const frontEnd = process.env.MODE === 'local' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.host}`;
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
      const db = fastify.mongo.db;
      // Retrieve user
      let user = request.user;
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
      const updateResult = await fastify.mongo.db.collection('subscriptions').updateOne(
        { 
          _id: new fastify.mongo.ObjectId(user._id),
        },
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

      await fastify.mongo.db.collection('users').updateOne(
        { 
          _id: new fastify.mongo.ObjectId(user._id),
        },
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
      return reply.send({ message: 'サブスクリプションがキャンセルされました' }); // Subscription canceled
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return reply.status(500).send({ error: 'サーバーエラーが発生しました' }); // Internal server error
    }
  });
  
  fastify.post('/plan/upgrade', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      let user = request.user;
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
      await fastify.mongo.db.collection('subscriptions').updateOne(
        { _id: new fastify.mongo.ObjectId(userId) },
        {
          $set: {
            currentPlanId: planPriceId, 
            billingCycle
          },
        },
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

  fastify.post('/plan/update-coins', async (request, reply) => {
    const { sessionId, priceId } = request.body;

    try {
        // Verify the session with Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const userId = session.metadata.userId;

            
            // Check if the session has already been processed
            const user = await fastify.mongo.db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

            if (user.processedSessions && user.processedSessions.includes(sessionId)) {
                return reply.code(400).send({ error: 'Session already processed' });
            }

            const coinsToAdd = getCoinsFromPriceId(priceId);

            if (coinsToAdd > 0) {
                // Update the user's coins
                await fastify.mongo.db.collection('users').updateOne(
                    { _id: new fastify.mongo.ObjectId(userId) },
                    {
                        $inc: { coins: coinsToAdd },
                        $push: { processedSessions: sessionId }
                    }
                );

                reply.send({ success: true });
            } else {
                reply.code(400).send({ error: 'Invalid priceId' });
            }
        } else {
            reply.code(400).send({ error: 'Payment not completed' });
        }
    } catch (error) {
        console.error('Error updating coins:', error);
        reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

    function getCoinsFromPriceId(priceId) {
      let priceMapping
      if(process.env.MODE == 'local'){
        priceMapping = {
            [process.env.STRIPE_SET1_TEST]: 100,
            [process.env.STRIPE_SET2_TEST]: 550,
            [process.env.STRIPE_SET3_TEST]: 1200,
            [process.env.STRIPE_SET4_TEST]: 2500
        };
      }else{
        priceMapping = {
          [process.env.STRIPE_SET1]: 100,
          [process.env.STRIPE_SET2]: 550,
          [process.env.STRIPE_SET3]: 1200,
          [process.env.STRIPE_SET4]: 2500
        };
      }
      return priceMapping[priceId] || 0;
  }
  fastify.post('/user/add-coins', async (request, reply) => {
    try {
        let user = request.user;
        const userId = user._id;
        const { coinsToAdd } = request.body;

        if (coinsToAdd > 0) {
            // Update the user's coins
            await fastify.mongo.db.collection('users').updateOne(
                { _id: new fastify.mongo.ObjectId(userId) },
                { $inc: { coins: coinsToAdd } }
            );

            reply.send({ success: true });
        } else {
            reply.code(400).send({ error: 'Invalid number of coins' });
        }
    } catch (error) {
        console.error('Error adding coins:', error);
        reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.post('/user/daily-bonus-coins', async (request, reply) => {
  try {
      let user = request.user;
      const userId = user._id;
      user = await fastify.mongo.db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset the time to midnight to compare dates

      // Check if the user has already claimed the daily bonus
      const lastClaimed = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;

      if (lastClaimed && lastClaimed.getTime() === today.getTime()) {
        console.log('Daily bonus already claimed')
        return reply.send({ success: false, error: 'Daily bonus already claimed' });
      }

      // Add 10 coins to the user and update the lastDailyBonus date
      await fastify.mongo.db.collection('users').updateOne(
          { _id: new fastify.mongo.ObjectId(userId) },
          {
              $inc: { coins: 100 },
              $set: { lastDailyBonus: today }
          }
      );

      reply.send({ success: true, message: '10 coins added as daily bonus' });
  } catch (error) {
      console.log('Error adding daily bonus coins:', error);
      reply.code(500).send({ error: 'Internal Server Error' });
  }
});


  fastify.post('/plan/create-checkout-session', async (request, reply) => {
      const { buttonId, userId } = request.body;
      console.log({ buttonId, userId })
      const frontEnd = process.env.MODE === 'local' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.host}`;

      const user = await fastify.mongo.db.collection('users').findOne({
        _id: new fastify.mongo.ObjectId(userId),
      });
  
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
  
      let envMapping = {}
      if(process.env.MODE == 'local'){
        envMapping = {
            'coins-set1': process.env.STRIPE_SET1_TEST,
            'coins-set2': process.env.STRIPE_SET2_TEST,
            'coins-set3': process.env.STRIPE_SET3_TEST,
            'coins-set4': process.env.STRIPE_SET4_TEST
        };
      }else{
        envMapping = {
          'coins-set1': process.env.STRIPE_SET1,
          'coins-set2': process.env.STRIPE_SET2,
          'coins-set3': process.env.STRIPE_SET3,
          'coins-set4': process.env.STRIPE_SET4
        };
      }
      const priceId = envMapping[buttonId];

      if (!priceId) {
          return reply.code(400).send({ error: 'Invalid button ID' });
      }

      try {
          const session = await stripe.checkout.sessions.create({
              payment_method_types: ['card'],
              customer_email: user.email,
              line_items: [{
                  price: priceId,
                  quantity: 1,
              }],
              mode: 'payment',
              success_url: `${frontEnd}/chat/?success=coins&priceId=${priceId}&session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${frontEnd}/chat/?payment=false`,
              metadata: {
                  userId: userId 
              },
              locale: 'ja',
          });

          reply.send({ id: session.id });
      } catch (error) {
          console.error('Error creating Stripe checkout session:', error);
          reply.code(500).send({ error: 'Internal Server Error' });
      }
  });
  fastify.post('/album/create-checkout-session', async (request, reply) => {
    const { priceId, userId, chatId } = request.body;

    const frontEnd = process.env.MODE === 'local' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.host}`;

    const user = await fastify.mongo.db.collection('users').findOne({
        _id: new fastify.mongo.ObjectId(userId),
    });

    if (!user) {
        return reply.status(404).send({ error: 'User not found' });
    }

    if (!priceId) {
        return reply.code(400).send({ error: 'Invalid price ID' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: user.email,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${frontEnd}/chat/?success=clients&priceId=${priceId}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontEnd}/chat/?payment=false`,
            metadata: {
                userId,
                chatId,
                priceId
            },
            locale: 'ja',
        });

        reply.send({ id: session.id });
    } catch (error) {
        console.error('Error creating Stripe checkout session:', error);
        reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.post('/plan/update-clients', async (request, reply) => {
  const { sessionId } = request.body;

  try {
      // Verify the session with Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid') {
          const userId = session.metadata.userId;
          const chatId = session.metadata.chatId;
          const priceId = session.metadata.priceId;

          // Check if the session has already been processed
          const existingClient = await fastify.mongo.db.collection('clients').findOne({
              chatId: chatId,
              priceId: priceId,
              clients: userId
          });

          if (existingClient) {
              return reply.code(400).send({ error: 'Session already processed' });
          }

          // Update the clients collection
          await fastify.mongo.db.collection('clients').updateOne(
              { chatId: chatId, priceId: priceId },
              {
                  $setOnInsert: {
                      chatId: chatId,
                      priceId: priceId,
                  },
                  $addToSet: { clients: userId }
              },
              { upsert: true }
          );

          reply.send({ success: true });
      } else {
          reply.code(400).send({ error: 'Payment not completed' });
      }
  } catch (error) {
      console.error('Error updating clients:', error);
      reply.code(500).send({ error: 'Internal Server Error' });
  }
});
fastify.post('/album/check-client', async (request, reply) => {
  const { userId, chatId, priceId } = request.body;

  if (!userId || !chatId || !priceId) {
    return reply.status(400).send({ error: 'Missing userId, chatId, or priceId' });
  }

  try {
    // Check if the user is a client
    const client = await fastify.mongo.db.collection('clients').findOne({
      chatId: chatId,
      priceId: priceId,
      clients: userId
    });

    // Check if the user is subscribed
    const user = await fastify.mongo.db.collection('users').findOne({
      _id: new fastify.mongo.ObjectId(userId)
    });

    const isSubscribed = user && user.subscriptionStatus === 'active';

    // Return true if the user is a client OR a subscriber
    const isAuthorized = !!client || isSubscribed;

    reply.send({ isAuthorized });
  } catch (error) {
    console.error('Error checking client or subscription:', error);
    reply.send({ isAuthorized: false });
  }
});




}

  module.exports = routes;
  