class DurableObject {
	constructor(initialState = {}, initialEnv = {}) {
		let stateRef = initialState || {};
		let envRef = initialEnv || {};

		Object.defineProperties(this, {
			state: {
				configurable: false,
				enumerable: true,
				get: () => stateRef,
				set: (value) => {
					stateRef = value ?? {};
				},
			},
			ctx: {
				configurable: false,
				enumerable: true,
				get: () => stateRef,
				set: (value) => {
					stateRef = value ?? {};
				},
			},
			storage: {
				configurable: false,
				enumerable: true,
				get: () => stateRef?.storage,
				set: (value) => {
					if (stateRef && typeof stateRef === 'object') {
						stateRef.storage = value;
					}
				},
			},
			env: {
				configurable: false,
				enumerable: true,
				get: () => envRef,
				set: (value) => {
					envRef = value ?? {};
				},
			},
		});
	}
}

module.exports = {
	DurableObject,
	env: {},
};
