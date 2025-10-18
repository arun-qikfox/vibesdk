const notImplemented = () => {
	throw new Error('KV stub: replace with GCP-backed implementation');
};

export default {
	async get() {
		return notImplemented();
	},
	async put() {
		return notImplemented();
	},
	async delete() {
		return notImplemented();
	},
	async list() {
		return notImplemented();
	},
};
