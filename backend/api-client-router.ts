// ApiClient-Driven Response Format
// Makes sure our Hono endpoints return responses that match what ApiClient expects

export function formatApiResponse(data: any, success: boolean = true) {
    return {
        success,
        data: success ? data : null,
        error: success ? null : data
    };
}

// Helper to extract path parameters from Hono context
export function extractPathParams(pathname: string, c: any) {
    const params: Record<string, string> = {};

    // Extract agentId from /api/agent/{id}/...
    if (pathname.startsWith('/api/agent/') && pathname !== '/api/agent') {
        const parts = pathname.split('/');
        if (parts.length >= 4) {
            params.agentId = parts[3]; // /api/agent/{id}
        }
    }

    // Extract appId from /api/apps/{id}/...
    if (pathname.startsWith('/api/apps/') && pathname !== '/api/apps') {
        const parts = pathname.split('/');
        if (parts.length >= 4) {
            params.appId = parts[3]; // /api/apps/{id}
        }
    }

    // Extract userId from /api/user/{id}/...
    if (pathname.startsWith('/api/user/') && pathname !== '/api/user') {
        const parts = pathname.split('/');
        if (parts.length >= 4) {
            params.userId = parts[3]; // /api/user/{id}
        }
    }

    // Extract actionKey from /api/model-configs/{actionKey}
    if (pathname.startsWith('/api/model-configs/') &&
        !pathname.includes('/defaults') &&
        !pathname.includes('/byok-providers') &&
        pathname !== '/api/model-configs') {
        const parts = pathname.split('/');
        if (parts.length >= 4) {
            params.actionKey = parts[3];
        }
    }

    return params;
}

// Helper to extract query parameters
export function extractQueryParams(c: any) {
    const params: Record<string, any> = {};

    // Extract pagination params
    const page = c.req.query('page');
    if (page) params.page = parseInt(page);

    const limit = c.req.query('limit');
    if (limit) params.limit = parseInt(limit);

    const sort = c.req.query('sort');
    if (sort) params.sort = sort;

    const order = c.req.query('order');
    if (order) params.order = order;

    // Extract other common params
    const days = c.req.query('days');
    if (days) params.days = parseInt(days);

    const period = c.req.query('period');
    if (period) params.period = period;

    const status = c.req.query('status');
    if (status) params.status = status;

    return params;
}

// Hono middleware that ensures responses match ApiClient expectations
export function createApiClientCompatibleMiddleware() {
    return async (c: any, next: any) => {
        // Call the route handler
        await next();

        // If the response is already set, don't modify it
        if (c.res.headers.get('content-type')?.includes('application/json')) {
            return;
        }

        // For raw responses, wrap them in ApiClient format if they're not already
        const response = c.res.json || c.json;
        if (response) {
            const originalData = await response();
            if (!originalData.success && !originalData.error) {
                // This looks like it needs ApiClient formatting
                const formattedResponse = formatApiResponse(originalData);
                return c.json(formattedResponse);
            }
        }
    };
}
