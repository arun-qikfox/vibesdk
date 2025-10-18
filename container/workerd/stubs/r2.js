const error = (operation) => {
	throw new Error(`R2 stub (${operation}): replace with Cloud Storage implementation`);
};

export default {
	async head() {
		return error('head');
	},
	async get() {
		return error('get');
	},
	async put() {
		return error('put');
	},
	async delete() {
		return error('delete');
	},
	async list() {
		return error('list');
	},
};
