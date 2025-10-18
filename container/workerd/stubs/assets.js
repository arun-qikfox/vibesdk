export default {
	async fetch(_request) {
		return new Response('Static asset stub. Implement Cloud CDN / Cloud Storage proxy.', {
			status: 404,
		});
	},
};
