const { ObjectId } = require('mongodb');
const qs = require('qs');
const stripe = process.env.MODE == 'local' ? require('stripe')(process.env.STRIPE_SECRET_KEY_TEST) : require('stripe')(process.env.STRIPE_SECRET_KEY)

async function routes(fastify, options) {

  const plans = {
    en: [
        {
            id: '1-day',
            name: '1 Day Pass',
            price: '4.99',
            currency: 'USD',
            discount: '75% OFF',
            originalPrice: '19.99',
            billingCycle: 'one-time',
            isOneTime: true,
        },
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
            id: '1-day',
            name: 'Passe 1 Jour',
            price: '4.99',
            currency: 'EUR',
            discount: '75% DE RÉDUCTION',
            originalPrice: '19.99',
            billingCycle: 'one-time',
            isOneTime: true,
        },
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
          id: '1-day',
          name: '1日パス',
          price: '499',
          currency: 'JPY',
          discount: '75% 割引',
          originalPrice: '1999',
          billingCycle: 'one-time',
          isOneTime: true,
      },
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
      en : ["Unlimited Daily Chats", "Create & Personalize Characters", "Early Access to New Features", "Generate Unlimited Images", "Access All Visuals", "Explore Endless Message Suggestions", "Generate NSFW Images", "Unlock more than 10,000 images"],
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
        return  `Libérez tout le potentiel de votre créativité avec le forfait Premium. Profitez de conversations quotidiennes illimités, créez et personnalisez de nouveaux personnages et bénéficiez d'un accès anticipé à de nouvelles fonctionnalités passionnantes. Générez un nombre illimité d'images, accédez à tous les visuels disponibles et explorez des suggestions de messages infinies pour laisser libre cours à vos idées. Avec des options avancées telles que plusieurs affichages de chat et la génération d'images NSFW, le forfait Premium garantit une expérience d'IA inégalée adaptée à votre imagination.`;
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
      case '1-day':
          return { interval: 'day', interval_count: 1 }; // One day pass
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
      
      // Get the plan details
      const lang = request.lang;
      const currentPlan = plans[lang].find(p => p.id === billingCycle);
      const isOneTimePass = currentPlan?.isOneTime || false;

      // Handle one-time payment for day pass
      if (isOneTimePass) {
        // Create a one-time payment session
        const currency = getCurrency(request.lang);
        const amount = parseInt(currentPlan.price) * (currency === 'jpy' ? 1 : 100);
        console.log(`[plan/subscribe] Creating one-time payment for: ${currentPlan.name}, Amount: ${amount} ${currency}, User: ${user.email}`);

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment', // One-time payment
          customer_email: user.email,
          line_items: [
            {
              price_data: {
                currency,
                product_data: {
                  name: getLocalizedName(request.lang) + ' - ' + currentPlan.name,
                  description: await getLocalizedDescription(request.lang),
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
        success_url: `${frontEnd}/plan/day-pass-success?session_id={CHECKOUT_SESSION_ID}`, // Corrected
        cancel_url: `${frontEnd}/plan/cancel-payment`, // Corrected
          metadata: {
            userId: user._id.toString(),
            planId: billingCycle,
            isOneTimePass: 'true',
          },
          locale: request.lang,
        });
        console.log(`[plan/subscribe] Stripe session created for one-time payment. ID: ${session.id}`);
        // Return the session URL to redirect the user
        return reply.send({ url: session.url });
      }

      // Handle regular subscription (existing code)
      console.log(`[plan/subscribe] Creating subscription for: ${billingCycle}, User: ${user.email}`);
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
        success_url: `${frontEnd}/plan/subscription-success?session_id={CHECKOUT_SESSION_ID}`, // Corrected
        cancel_url: `${frontEnd}/plan/cancel-payment`, // Corrected
        metadata: {
          userId: user._id.toString(), // Optionally store user ID in metadata for future reference
          planId: billingCycle, // Optionally store plan ID in metadata for future reference
        },
        locale: request.lang,
      });

      // Return the session URL to redirect the user
      console.log(`[plan/subscribe] Stripe session created for subscription. ID: ${session.id}`);
      return reply.send({ url: session.url });
    } catch (error) {
      console.error('[plan/subscribe] Error creating Stripe Checkout session:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
  
  // Renamed from /plan/success to /plan/subscription-success
  fastify.get('/plan/subscription-success', async (request, reply) => {
    try {
      const frontEnd = process.env.MODE === 'local' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.host}`;
      console.log('[plan/subscription-success] Initiated. Query:', request.query);
      // Extract the session ID from the query parameters
      const query = request.query; // Fastify automatically parses query strings
      const sessionId = query.session_id;
  
      if (!sessionId) {
        console.log('[plan/subscription-success] Invalid session ID.');
        return reply.status(400).send({ error: 'Invalid session ID' });
      }
  
      // Retrieve the session from Stripe
      console.log(`[plan/subscription-success] Retrieving session from Stripe. ID: ${sessionId}`);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
  
      if (!session) {
        console.log('[plan/subscription-success] Session not found in Stripe.');
        return reply.status(404).send({ error: 'Session not found' });
      }
      console.log('[plan/subscription-success] Stripe session retrieved:', session.id, 'Payment Status:', session.payment_status);
      // Find the user in your database
      const userFromDb = await fastify.mongo.db.collection('users').findOne({
        email: session.customer_email,
      });
  
      if (!userFromDb) {
        console.log(`[plan/subscription-success] User not found in DB. Email: ${session.customer_email}`);
        return reply.status(404).send({ error: 'User not found' });
      }
      console.log(`[plan/subscription-success] User found in DB. ID: ${userFromDb._id}`);
      // Retrieve subscription details
      console.log(`[plan/subscription-success] Retrieving subscription from Stripe. ID: ${session.subscription}`);
      const subscription = await stripe.subscriptions.retrieve(session.subscription);

      if (!subscription) {
        console.log('[plan/subscription-success] Subscription not found in Stripe.');
        return reply.status(404).send({ error: 'Subscription not found' });
      }
      console.log(`[plan/subscription-success] Stripe subscription retrieved. ID: ${subscription.id}, Status: ${subscription.status}`);
  
      // Define the premium plan IDs
      const premiumMonthlyId = process.env.MODE == 'local' ? process.env.STRIPE_PREMIUM_MONTLY_TEST : process.env.STRIPE_PREMIUM_MONTLY;
      const premiumYearlyId = process.env.MODE == 'local' ? process.env.STRIPE_PREMIUM_YEARLY_TEST : process.env.STRIPE_PREMIUM_YEARLY;

      // Update the user's subscription status and details in your database
      await fastify.mongo.db.collection('subscriptions').updateOne(
        { userId: new fastify.mongo.ObjectId(userFromDb._id) }, // Query by userId
        {
          $set: {
            stripeCustomerId: session.customer, 
            stripeSubscriptionId: session.subscription, 
            subscriptionStatus: 'active',
            subscriptionType: 'subscription', // Explicitly set type
            currentPlanId: subscription.items.data[0].price.id, 
            billingCycle: session.metadata.planId,
            subscriptionStartDate: new Date(subscription.start_date * 1000), 
            subscriptionEndDate: new Date(subscription.current_period_end * 1000),
            // lastChecked: new Date() // Optional: for tracking checks
          },
        },
        { upsert: true } 
      );
      console.log(`[plan/subscription-success] User subscriptions collection updated for user ID: ${userFromDb._id}`);
      const result = await fastify.mongo.db.collection('users').updateOne(
        { _id: new fastify.mongo.ObjectId(userFromDb._id) },
        {
          $set: { 
            stripeCustomerId: session.customer, 
            subscriptionStatus: 'active',
            subscriptionType: 'subscription', // Explicitly set type
            stripeSubscriptionId: session.subscription,
            subscriptionEndDate: new Date(subscription.current_period_end * 1000) // Also store current period end here
          },
          $unset: { // Remove old fields if they exist from day-pass
            // subscriptionEndDate: "" // This was for day-pass, ensure it's cleared or handled
          }
        }
      );
       
      if (result.modifiedCount === 0 && result.upsertedCount === 0) {
        console.log(`[plan/subscription-success] Failed to update user document for user ID: ${userFromDb._id}`);
        // Not necessarily an error if data was already up-to-date, but good to log.
        // Consider if redirecting to error is appropriate or if it's a non-critical log.
      } else {
        console.log(`[plan/subscription-success] User document updated for user ID: ${userFromDb._id}`);
      }

      let bonusCoins = 0;
      if((subscription.items.data[0].price.id === premiumMonthlyId || subscription.items.data[0].price.id === premiumYearlyId)){
        // Add 1000 coins to the user's account
        await fastify.mongo.db.collection('users').updateOne(
          { _id: new fastify.mongo.ObjectId(userFromDb._id) },
          {
            $inc: { coins: 1000 }
          }
        );
        bonusCoins = 1000;
        console.log(`[plan/subscription-success] Added 1000 bonus coins for user ID: ${userFromDb._id}`);
      }

      console.log('[plan/subscription-success] Rendering payment-success.hbs for subscription.');
      // Render the success page
      return reply.view('payment-success.hbs', {
        isDayPass: false, // Corrected: this is for subscription
        bonusCoins: bonusCoins,
        title: 'Subscription Activated',
        translations: {
          ...request.translations, // Spread existing translations
          payment_success: request.paymentTranslations.payment_success // Add payment specific translations
        }
        // No subscriptionEndDate needed here as it's a recurring subscription
      });
    } catch (error) {
      console.error('[plan/subscription-success] Error handling successful payment:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
  
  fastify.get('/plan/day-pass-success', async (request, reply) => {
    try {
      const frontEnd = process.env.MODE === 'local' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.host}`;
      console.log('[plan/day-pass-success] Initiated. Query:', request.query);
      const query = request.query;
      const sessionId = query.session_id;

      if (!sessionId) {
        console.log('[plan/day-pass-success] Invalid session ID.');
        return reply.status(400).send({ error: 'Invalid session ID' });
      }

      console.log(`[plan/day-pass-success] Retrieving session from Stripe. ID: ${sessionId}`);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session || session.payment_status !== 'paid') {
        console.log('[plan/day-pass-success] Session not found or payment not completed.');
        return reply.status(404).send({ error: 'Payment not confirmed or session not found' });
      }
      console.log('[plan/day-pass-success] Stripe session retrieved:', session.id, 'Payment Status:', session.payment_status);

      if (session.metadata.isOneTimePass !== 'true') {
        console.log('[plan/day-pass-success] Session metadata does not indicate a one-time pass.');
        return reply.status(400).send({ error: 'Invalid session type for day pass.' });
      }
      
      const userId = session.metadata.userId ? new fastify.mongo.ObjectId(session.metadata.userId) : null;
      let userFromDb;

      if (userId) {
        userFromDb = await fastify.mongo.db.collection('users').findOne({ _id: userId });
      } else if (session.customer_email) { // Fallback to email if userId not in metadata (though it should be)
        userFromDb = await fastify.mongo.db.collection('users').findOne({ email: session.customer_email });
      }

      if (!userFromDb) {
        console.log(`[plan/day-pass-success] User not found. Email: ${session.customer_email}, Metadata UserID: ${session.metadata.userId}`);
        return reply.status(404).send({ error: 'User not found' });
      }
      console.log(`[plan/day-pass-success] User found in DB. ID: ${userFromDb._id}`);

      const now = new Date();
      const subscriptionEndDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      const bonusCoinsDayPass = 200;

      // Update user's record
      await fastify.mongo.db.collection('users').updateOne(
        { _id: userFromDb._id },
        {
          $set: {
            subscriptionStatus: 'active',
            subscriptionType: 'day-pass',
            subscriptionEndDate: subscriptionEndDate,
          },
          $inc: { coins: bonusCoinsDayPass }
        }
      );
      console.log(`[plan/day-pass-success] User document updated for day pass. User ID: ${userFromDb._id}`);

      // Create/Update subscription record for day pass
      await fastify.mongo.db.collection('subscriptions').updateOne(
        { userId: userFromDb._id, subscriptionType: 'day-pass' }, // Query to find an existing day-pass record to update if any, or create new
        {
          $set: {
            userId: userFromDb._id,
            stripePaymentIntentId: session.payment_intent, // For one-time payments
            subscriptionStatus: 'active',
            subscriptionType: 'day-pass',
            planId: session.metadata.planId,
            subscriptionStartDate: now,
            subscriptionEndDate: subscriptionEndDate,
            dayPassProcessed: false, // For cron job to handle expiration
            // stripeCustomerId: session.customer, // Optional: if you want to store it
          },
        },
        { upsert: true }
      );
      console.log(`[plan/day-pass-success] Subscriptions collection updated for day pass. User ID: ${userFromDb._id}`);
      
      console.log('[plan/day-pass-success] Rendering payment-success.hbs for day pass.');
      return reply.view('payment-success.hbs', {
        isDayPass: true,
        subscriptionEndDate: subscriptionEndDate.toISOString(), // Pass as ISO string for JS
        bonusCoins: bonusCoinsDayPass,
        title: 'Day Pass Activated!',
        translations: {
          ...request.translations,
          payment_success: request.paymentTranslations.payment_success
        }
      });

    } catch (error) {
      console.error('[plan/day-pass-success] Error handling successful day pass payment:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/plan/cancel-payment', async (request, reply) => {
    try {
      const frontEnd = process.env.MODE === 'local' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.host}`;
      // You can log this event or notify the user if needed
      console.log('[plan/cancel-payment] User canceled the payment process.');

      // Redirect the user to a cancellation page or inform them about the cancellation
      return reply.redirect(`${frontEnd}/chat/?payment_status=cancelled`); // Redirect to plan page with a status
    } catch (error) {
      console.error('[plan/cancel-payment] Error handling cancellation:', error);
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

// Function to check and process expired day passes
async function checkExpiredDayPasses(fastifyInstance) {
  console.log('[CronJob] checkExpiredDayPasses: Running job to check for expired day passes...');
  const now = new Date();
  const subscriptionsCollection = fastifyInstance.mongo.db.collection('subscriptions');
  const usersCollection = fastifyInstance.mongo.db.collection('users');

  try {
    const expiredPasses = await subscriptionsCollection.find({
      subscriptionType: 'day-pass',
      subscriptionStatus: 'active',
      dayPassProcessed: false,
      subscriptionEndDate: { $lt: now }
    }).toArray();

    if (expiredPasses.length === 0) {
      console.log('[CronJob] checkExpiredDayPasses: No expired day passes found.');
      return;
    }

    console.log(`[CronJob] checkExpiredDayPasses: Found ${expiredPasses.length} expired day pass(es) to process.`);

    for (const pass of expiredPasses) {
      console.log(`[CronJob] checkExpiredDayPasses: Processing expired day pass for user ID: ${pass.userId}, Subscription ID: ${pass._id}`);

      // Fetch the user to check their current subscription type
      const userToUpdate = await usersCollection.findOne({ _id: new ObjectId(pass.userId) });

      if (!userToUpdate) {
        console.log(`[CronJob] checkExpiredDayPasses: User ${pass.userId} not found. Skipping.`);
        // Mark the pass as processed even if user not found to avoid reprocessing
        await subscriptionsCollection.updateOne(
          { _id: pass._id },
          { $set: { subscriptionStatus: 'expired', dayPassProcessed: true } }
        );
        continue;
      }

      // Update the specific day-pass subscription record to expired
      const subscriptionUpdateResult = await subscriptionsCollection.updateOne(
        { _id: pass._id },
        {
          $set: {
            subscriptionStatus: 'expired',
            dayPassProcessed: true
          }
        }
      );

      if (subscriptionUpdateResult.modifiedCount > 0) {
        console.log(`[CronJob] checkExpiredDayPasses: Day pass record ${pass._id} updated to expired.`);

        // Only deactivate user if their current subscription is still the day-pass
        // or if they are somehow active without a 'subscription' type.
        if (userToUpdate.subscriptionType === 'day-pass' || (userToUpdate.subscriptionStatus === 'active' && userToUpdate.subscriptionType !== 'subscription')) {
          const userUpdateResult = await usersCollection.updateOne(
            { _id: new ObjectId(pass.userId) },
            {
              $set: { subscriptionStatus: 'inactive' },
              $unset: {
                subscriptionType: "", // Unset type if it was 'day-pass'
                subscriptionEndDate: "" // Unset end date if it was from day-pass
              }
            }
          );
          if (userUpdateResult.modifiedCount > 0) {
            console.log(`[CronJob] checkExpiredDayPasses: User record ${pass.userId} updated to inactive as their day pass expired.`);
          } else {
            console.log(`[CronJob] checkExpiredDayPasses: Failed to update user record ${pass.userId} to inactive, or user was already inactive/status unchanged.`);
          }
        } else if (userToUpdate.subscriptionType === 'subscription') {
          console.log(`[CronJob] checkExpiredDayPasses: User ${pass.userId} has an active subscription. Their status will not be changed to inactive due to day pass expiration.`);
        } else {
          console.log(`[CronJob] checkExpiredDayPasses: User ${pass.userId} status is '${userToUpdate.subscriptionStatus}' with type '${userToUpdate.subscriptionType}'. No deactivation action taken for this expired day pass.`);
        }
      } else {
        console.log(`[CronJob] checkExpiredDayPasses: Failed to update day pass subscription record ${pass._id} or already processed.`);
      }
    }
  } catch (error) {
    console.error('[CronJob] checkExpiredDayPasses: Error processing expired day passes:', error);
  }
}

// Schedule the job and run once on startup
fastify.ready(async () => {
  console.log('[Startup] Initial call to checkExpiredDayPasses.');
  await checkExpiredDayPasses(fastify); // Pass fastify instance
  setInterval(() => checkExpiredDayPasses(fastify), 60 * 60 * 1000); // Run every hour
  console.log('[Startup] checkExpiredDayPasses job scheduled to run every hour.');
});


}

  module.exports = routes;
