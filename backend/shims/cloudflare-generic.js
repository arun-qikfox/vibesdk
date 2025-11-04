function createStub(name = 'cloudflare') {
	const stub = function (...args) {
		console.warn(`[cloudflare shim] ${name} invoked`, args);
		return undefined;
	};

	return new Proxy(stub, {
		get(_target, prop) {
			if (prop === '__esModule') {
				return true;
			}
			if (prop === 'toString') {
				return () => `[cloudflare shim: ${name}]`;
			}
			if (prop === 'default') {
				return createStub(`${name}.default`);
			}
			return createStub(`${name}.${String(prop)}`);
		},
		apply(_target, _thisArg, args) {
			console.warn(`[cloudflare shim] ${name} called`, args);
			return undefined;
		},
		construct(_target, args) {
			console.warn(`[cloudflare shim] ${name} constructed`, args);
			return createStub(`${name}#instance`);
		},
	});
}

module.exports = createStub();
