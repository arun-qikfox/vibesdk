const manager = require('./gcp-agent-manager');

async function testAgentLoading() {
    console.log('Testing agent loading...');
    try {
        const module = await manager.loadAgentModule();
        console.log('Agent module loaded:', Object.keys(module));
        console.log('PostgresCodeGeneratorAgent available:', !!module.PostgresCodeGeneratorAgent);

        if (module.PostgresCodeGeneratorAgent) {
            console.log('✅ SUCCESS: Real PostgresCodeGeneratorAgent loaded');
        } else {
            console.log('❌ FAILURE: Agent not found in module');
        }
    } catch (err) {
        console.error('❌ ERROR loading agent:', err.message);
        console.error('Stack:', err.stack);
    }
}

testAgentLoading();
