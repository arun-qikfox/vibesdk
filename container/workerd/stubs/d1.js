const error = () => {
	throw new Error('D1 stub: replace with Cloud SQL adapter');
};

const statement = {
	bind() {
		return this;
	},
	async first() {
		return error();
	},
	async run() {
		return error();
	},
	async all() {
		return error();
	},
	async raw() {
		return error();
	},
};

export default {
	prepare() {
		return statement;
	},
	async batch() {
		return error();
	},
	async dump() {
		return error();
	},
	async exec() {
		return error();
	},
};
