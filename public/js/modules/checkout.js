// checkout.js
// Initializes Stripe checkout using server-provided USER

function initiateCheckout(buttonId) {
    const user = window.USER;
    if (!user || !user._id) {
        console.error('[checkout] Missing USER data');
        return;
    }
    const userId = user._id;

    const isProd = window.location.protocol === 'https:';
    const pk = isProd
        ? 'pk_live_51PjtRbE5sP7DA1XvCkdmezori9qPGoO21y7yKSVvgkQVyrhWZfHAUkNsjPMnbwpPlp4zzoYsRjn79Ad7XN7HTHcc00UjBA9adF'
        : 'pk_test_51PjtRbE5sP7DA1XvD68v7X7Qj7pG6ZJpQmvuNodJjxc7MbH1ss2Te2gahFAS9nms4pbmEdMYdfCPxFDWHBbu9CxR003ikTnRES';

    const stripe = Stripe(pk);

    $.post('/plan/create-checkout-session', { buttonId, userId })
        .then((session) => stripe.redirectToCheckout({ sessionId: session.id }))
        .catch((err) => console.error('Stripe checkout failed:', err));
}
