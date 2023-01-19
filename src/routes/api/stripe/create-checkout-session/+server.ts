import { eurCountryCodes } from '$ts/constants/main';
import { defaultStripeTier, stripe, stripeTiers } from '$ts/constants/stripe';
import { supabaseAdmin } from '$ts/constants/supabaseAdmin';
import { getSupabase } from '@supabase/auth-helpers-sveltekit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	const { session } = await getSupabase(event);
	if (!session?.user.id) {
		return new Response(JSON.stringify({ error: 'No user ID' }));
	}
	const url = event.url;
	const baseUrl = `${url.protocol}//${url.host}`;
	const tierParam = event.url.searchParams.get('tier');
	const tier = stripeTiers.find((t) => t.name === tierParam) || defaultStripeTier;
	const { data: userData, error: userError } = await supabaseAdmin
		.from('user')
		.select('stripe_customer_id')
		.eq('id', session.user.id)
		.maybeSingle();
	if (userError || !userData) {
		return new Response(JSON.stringify({ error: userError || 'No Stripe user found' }));
	}
	const customer = await stripe.customers.retrieve(userData.stripe_customer_id);
	const countryCode = event.request.headers.get('x-vercel-ip-country');
	const priceId =
		countryCode && eurCountryCodes.includes(countryCode) ? tier.priceId.EUR : tier.priceId.USD;
	const checkoutSession = await stripe.checkout.sessions.create({
		customer: customer.id,
		line_items: [
			{
				price: priceId,
				quantity: 1
			}
		],
		mode: 'subscription',
		success_url: `${baseUrl}/pro/success`,
		cancel_url: `${baseUrl}/pro/cancel`
	});
	return new Response(
		JSON.stringify({
			data: {
				checkoutSession
			}
		})
	);
};
