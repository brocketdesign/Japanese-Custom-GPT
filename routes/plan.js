
const { ObjectId } = require('mongodb');
const qs = require('qs');
const stripe = process.env.MODE == 'local' ? require('stripe')(process.env.STRIPE_SECRET_KEY_TEST) : require('stripe')(process.env.STRIPE_SECRET_KEY)

async function routes(fastify, options) {

  const plans = {
    en: [
        {
            id: '12-months',
            name: '12 Months',
            price: '5.99',
            currency: 'USD',
            discount: '70% OFF',
            originalPrice: '19.99',
            billingCycle: 'monthly',
        },
        {
            id: '3-months',
            name: '3 Months',
            price: '9.99',
            currency: 'USD',
            discount: '50% OFF',
            originalPrice: '19.99',
            billingCycle: 'monthly',
        },
        {
            id: '1-month',
            name: '1 Month',
            price: '12.99',
            currency: 'USD',
            discount: '35% OFF',
            originalPrice: '19.99',
            billingCycle: 'monthly',
        }
    ],
    fr: [
        {
            id: '12-months',
            name: '12 Mois',
            price: '5.99',
            currency: 'EUR',
            discount: '70% DE RÉDUCTION',
            originalPrice: '19.99',
            billingCycle: 'monthly',
        },
        {
            id: '3-months',
            name: '3 Mois',
            price: '9.99',
            currency: 'EUR',
            discount: '50% DE RÉDUCTION',
            originalPrice: '19.99',
            billingCycle: 'monthly',
        },
        {
            id: '1-month',
            name: '1 Mois',
            price: '12.99',
            currency: 'EUR',
            discount: '35% DE RÉDUCTION',
            originalPrice: '19.99',
            billingCycle: 'monthly',
        }
    ],
    ja: [
      {
          id: '12-months',
          name: '12ヶ月',
          price: '599',
          currency: 'JPY',
          discount: '70% 割引',
          originalPrice: '1999',
          billingCycle: 'monthly',
      },
      {
          id: '3-months',
          name: '3ヶ月',
          price: '999',
          currency: 'JPY',
          discount: '50% 割引',
          originalPrice: '1999',
          billingCycle: 'monthly',
      },
      {
          id: '1-month',
          name: '1ヶ月',
          price: '1299',
          currency: 'JPY',
          discount: '35% 割引',
          originalPrice: '1999',
          billingCycle: 'monthly',
      },
    ],
    features: {
      en : ["Unlimited Daily Chats", "Create & Personalize Characters", "Early Access to New Features", "Generate Unlimited Images", "Access All Visuals", "Explore Endless Message Suggestions", "Generate NSFW Images", "Unlcock more than 10,000 images"],
      fr : ["Chats quotidiens illimités", "Créez et personnalisez des personnages", "Accès anticipé aux nouvelles fonctionnalités", "Générez des images illimitées", "Accédez à tous les visuels", "Explorez des suggestions de messages infinies", "Générez des images NSFW", "Débloquez plus de 10 000 images"],
      ja : ["毎日無制限のチャット", "キャラクターの作成とパーソナライズ", "新機能への早期アクセス", "無制限の画像生成", "すべてのビジュアルにアクセス", "無限のメッセージ提案を探索", "NSFW 画像生成", "10,000 枚以上の画像をアンロック"]
    }
  
};

  fastify.get('/plan/list', async (request, reply) => {
    const lang = request.query.lang || request.lang;
    return reply.send({plans: plans[lang], features: plans.features[lang]});
  });
  fastify.get('/plan/list/:id', async (request, reply) => {
    const lang = request.query.lang || request.lang;
    const id = request.params.id;
    const plan = plans[lang].find(plan => plan.id === id);
    return reply.send({plan, features: plans.features[lang]});
  });
  async function getLocalizedDescription(lang) {
    // Define a fallback mechanism
    switch (lang) {
      case 'fr':
        return  `Libérez tout le potentiel de votre créativité avec le forfait Premium. Profitez de conversations quotidiennes illimitées, créez et personnalisez de nouveaux personnages et bénéficiez d'un accès anticipé à de nouvelles fonctionnalités passionnantes. Générez un nombre illimité d'images, accédez à tous les visuels disponibles et explorez des suggestions de messages infinies pour laisser libre cours à vos idées. Avec des options avancées telles que plusieurs affichages de chat et la génération d'images NSFW, le forfait Premium garantit une expérience d'IA inégalée adaptée à votre imagination.`;
      case 'ja':
        return 'プレミアム プランであなたの創造性を最大限に引き出しましょう。無制限の毎日のチャットを楽しんだり、新しいキャラクターを作成してパーソナライズしたり、エキサイティングな新機能に早期アクセスしたりできます。無制限の画像を生成し、利用可能なすべてのビジュアルにアクセスし、無限のメッセージ提案を探索して、アイデアを生み出し続けます。複数のチャット表示や NSFW 画像生成などの高度なオプションを備えたプレミアム プランは、あなたの想像力に合わせた比類のない AI エクスペリエンスを保証します。';
      default:
        return 'Unlock the full potential of your creativity with the Premium Plan. Enjoy unlimited daily chats, create and personalize new characters, and gain early access to exciting new features. Generate unlimited images, access all available visuals, and explore endless message suggestions to keep your ideas flowing. With advanced options like multiple chat displays and NSFW image generation, the Premium Plan ensures an unparalleled AI experience tailored to your imagination.';
    }
  }
  function getCurrency(lang) {
    switch (lang) {
      case 'fr': // French
        return 'eur'; // Euros
      case 'ja': // Japanese
        return 'jpy'; // Japanese Yen
      case 'en': // English (default to USD)
      default:
        return 'usd'; // US Dollars
    }
  }
  function getLocalizedName(lang) {
    switch (lang) {
      case 'fr': // French
        return 'Lamix Premium'; // Product name in French
      case 'ja': // Japanese
        return 'ラミックスプレミアム'; // Product name in Japanese
      case 'en': // English (default)
      default:
        return 'Lamix Premium'; // Product name in English
    }
  }

// Function to get the billing cycle for Stripe based on preference
function getBillingCycle(preference) {
  switch (preference) {
      case '12-months':
          return { interval: 'year', interval_count: 1 }; // Yearly billing
      case '3-months':
          return { interval: 'month', interval_count: 3 }; // Quarterly billing (3 months)
      case '1-month':
      default:
          return { interval: 'month', interval_count: 1 }; // Monthly billing as default
  }
}

// Function to get the amount based on currency and billing cycle
function getAmount(currency, billingCycle,month_count, lang) {
  const plan = plans[lang].find(plan => plan.id === billingCycle);
  if (!plan) {
      throw new Error(`Plan with ID ${billingCycle} not found.`);
  }

  // Convert price to the smallest currency unit
  const price = parseFloat(plan.price.replace(',', '.'));

  // Multiply by 100 for currencies like USD/EUR or leave as-is for JPY
  if (currency === 'jpy') {
      return Math.round(price * month_count); // JPY does not use smaller units
  }
  return Math.round(price * 100 * month_count); // Other currencies (e.g., USD, EUR)
}

  
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
      const { billingCycle } = request.body;

      // Create a Stripe Checkout session
      const billing = getBillingCycle(billingCycle);
      const month_count = billingCycle.split('-')[0];
      const currency = getCurrency(request.lang)
      const amount = getAmount(currency, billingCycle, month_count, request.lang);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'], // Accept card payments
        mode: 'subscription', // Subscription mode
        customer_email: user.email, // Automatically pre-fills the email field
        line_items: [
          {
            price_data: {
              currency, // Replace with your desired currency
              product_data: {
                name: getLocalizedName(request.lang), // Localized product name
                description: await getLocalizedDescription(request.lang), // Localized description
              },
              unit_amount: amount, // Replace with your product price in cents
              recurring: billing,
            },
            quantity: 1,
          },
        ],
        success_url: `${frontEnd}/plan/success?session_id={CHECKOUT_SESSION_ID}`, // Redirect here on success
        cancel_url: `${frontEnd}/plan/cancel-payment`, // Redirect here on cancellation
        metadata: {
          userId: user._id.toString(), // Optionally store user ID in metadata for future reference
          planId: billingCycle, // Optionally store plan ID in metadata for future reference
        },
        locale: request.lang,
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
            billingCycle: session.metadata.planId,
            subscriptionStartDate: new Date(subscription.start_date * 1000), 
            subscriptionEndDate: new Date(subscription.current_period_end * 1000), 
          },
        },
        { upsert: true } 
      );
      const result = await fastify.mongo.db.collection('users').updateOne(
        { _id: new fastify.mongo.ObjectId(user._id) },
        {
          $set: { 
            stripeCustomerId: session.customer, 
            subscriptionStatus: 'active',
            stripeSubscriptionId: session.subscription
          }
        }
      );
      
      if (result.modifiedCount === 0) {
        console.log('Failed to update user subscription status');
        return reply.redirect(`${frontEnd}/chat/?newSubscription=false&error=true`);
      }

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
      return reply.redirect(`${frontEnd}/chat/?newSubscription=true`);
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
      return reply.redirect(`${frontEnd}/?cancel-payment=true`);
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
  