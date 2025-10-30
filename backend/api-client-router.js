// ApiClient-Driven Response Format
// Makes sure our Hono endpoints return responses that match what ApiClient expects

function formatApiResponse(data, success = true) {
    return {
        success,
        data: success ? data : null,
        error: success ? null : data
    };
}

// Helper to extract path parameters from Hono context
function extractPathParams(pathname, c) {
    const params = {};

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
function extractQueryParams(c) {
    const params = {};

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

module.exports = {
    formatApiResponse,
    extractPathParams,
    extractQueryParams
};
