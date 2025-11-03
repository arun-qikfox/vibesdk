/**
 * GCP Template Selector
 * Reuses Cloudflare's proven AI template selection logic
 * Adapted for GCP Gemini AI service interface
 */

const {
    SYSTEM_PROMPT,
    TemplateSelectionSchema,
    formatTemplateDescriptions,
    buildUserPrompt,
    createSystemMessage,
    createUserMessage,
    createMultiModalUserMessage,
    createFallbackSelection
} = require('../worker/agents/planning/templateSelector.shared.cjs');

const logger = {
    info: (message, data) => console.log(`[GCP Template Selector] ${message}`, data || ''),
    error: (message, error) => console.error(`[GCP Template Selector] ${message}`, error || ''),
    warn: (message, data) => console.warn(`[GCP Template Selector] ${message}`, data || '')
};

/**
 * Selects the most suitable template using GCP Gemini AI
 * Reuses exact same logic as Cloudflare implementation
 */
async function selectTemplateGCP({ env, query, availableTemplates, inferenceContext, images }) {
    try {
        if (!availableTemplates || availableTemplates.length === 0) {
            logger.info("No templates available for selection");
            return createFallbackSelection(new Error("No templates available"));
        }

        logger.info("Starting GCP Gemini template selection", {
            query,
            queryLength: query.length,
            imagesCount: images?.length || 0,
            availableTemplates: availableTemplates.map(t => t.name),
            templateCount: availableTemplates.length
        });

        // Build prompts exactly like Cloudflare does
        const templateDescriptions = formatTemplateDescriptions(availableTemplates);
        const userPrompt = buildUserPrompt(query, templateDescriptions, images);

        // Construct messages exactly like Cloudflare
        const messages = [
            createSystemMessage(SYSTEM_PROMPT),
            images && images.length > 0
                ? createMultiModalUserMessage(
                    userPrompt,
                    images.map(img => `data:${img.mimeType};base64,${img.base64Data}`),
                    'high'
                  )
                : createUserMessage(userPrompt)
        ];

        // Use GCP Gemini service instead of Cloudflare executeInference
        const { createGeminiAIService } = require('./gemini-ai-service');

        if (!createGeminiAIService || !env.GEMINI_API_KEY) {
            logger.error('GCP: Gemini AI service not available');
            return createFallbackSelection(new Error('Gemini AI service not configured'));
        }

        logger.info('GCP: Calling Gemini AI for template selection');

        // Create Gemini service instance
        const geminiService = createGeminiAIService(env);

        // Use the built-in analyzeTemplates method which handles the AI call and parsing
        const analysis = await geminiService.analyzeTemplates(query, availableTemplates);

        // Convert the analysis result to match Cloudflare's expected format
        const selection = {
            selectedTemplateName: analysis.selectedTemplateName,
            matchConfidence: analysis.matchConfidence,
            reasoning: analysis.reasoning,
            useCase: null,
            complexity: null,
            styleSelection: null,
            projectName: '',
            alternativeTemplates: analysis.alternatives || [],
            customizationsNeeded: analysis.customizations || []
        };

        logger.info(`GCP: AI template selection result: ${selection.selectedTemplateName || 'None'}, Reasoning: ${selection.reasoning}`);

        // Validate that selected template exists
        if (selection.selectedTemplateName) {
            const selectedTemplate = availableTemplates.find(t => t.name === selection.selectedTemplateName);
            if (!selectedTemplate) {
                logger.warn(`GCP: Selected template '${selection.selectedTemplateName}' not found in available templates`);
                // Don't fail - let the caller handle fallback
            }
        }

        return selection;

    } catch (error) {
        logger.error("GCP: Error during AI template selection:", error);

        // Return fallback selection instead of throwing
        // This matches Cloudflare's error handling approach
        return createFallbackSelection(error);
    }
}

module.exports = {
    selectTemplateGCP
};
