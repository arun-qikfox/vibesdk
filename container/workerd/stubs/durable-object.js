const notImplemented = (method) => {
	throw new Error(`Durable Object stub (${method}): implement Cloud Run Job/Firestore equivalent`);
};

const stubStub = {
	async fetch() {
		return notImplemented('fetch');
	},
};

export default {
	idFromString() {
		return { toString: () => 'stub-do-id' };
	},
	idFromName() {
		return { toString: () => 'stub-do-id' };
	},
	idFromHex() {
		return { toString: () => 'stub-do-id' };
	},
	newUniqueId() {
		return { toString: () => 'stub-do-id' };
	},
	get() {
		return stubStub;
	},
};
