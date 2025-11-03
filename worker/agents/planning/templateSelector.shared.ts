/**
 * Shared Template Selection Intelligence
 * Extracted from Cloudflare implementation for reuse across platforms
 * This file contains all the proven AI prompts, schemas, and logic
 */

import { generateSecureToken } from '../../utils/cryptoUtils';
import type { ImageAttachment } from '../../types/image-attachment';

// Template Selection Schema - matches Cloudflare implementation
export const TemplateSelectionSchema = {
    type: 'object',
    properties: {
        selectedTemplateName: { type: 'string' },
        matchConfidence: { type: 'number' },
        reasoning: { type: 'string' },
        useCase: { type: 'string' },
        complexity: { type: 'string' },
        styleSelection: { type: 'string' },
        projectName: { type: 'string' },
        alternativeTemplates: {
            type: 'array',
            items: { type: 'string' }
        },
        customizationsNeeded: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['selectedTemplateName', 'matchConfidence', 'reasoning']
};

// System prompt - exact copy from Cloudflare implementation
export const SYSTEM_PROMPT = `You are an Expert Software Architect at Cloudflare specializing in template selection for rapid development. Your task is to select the most suitable starting template based on user requirements.

## SELECTION EXAMPLES:

**Example 1 - Game Request:**
User: "Build a 2D puzzle game with scoring"
Templates: ["react-dashboard", "react-game-starter", "vue-blog"]
Selection: "react-game-starter"
complexity: "simple"
Reasoning: "Game starter template provides canvas setup, state management, and scoring systems"

**Example 2 - Business Dashboard:**
User: "Create an analytics dashboard with charts"
Templates: ["react-dashboard", "nextjs-blog", "vanilla-js"]
Selection: "react-dashboard"
complexity: "simple" // Because single page application
Reasoning: "Dashboard template includes chart components, grid layouts, and data visualization setup"

**Example 3 - No Perfect Match:**
User: "Build a recipe sharing app"
Templates: ["react-social", "vue-blog", "angular-todo"]
Selection: "react-social"
complexity: "simple" // Because single page application
Reasoning: "Social template provides user interactions, content sharing, and community features closest to recipe sharing needs"

## SELECTION CRITERIA:
1. **Feature Alignment** - Templates with similar core functionality
2. **Tech Stack Match** - Compatible frameworks and dependencies
3. **Architecture Fit** - Similar application structure and patterns
4. **Minimal Modification** - Template requiring least changes

## STYLE GUIDE:
- **Minimalist Design**: Clean, simple interfaces
- **Brutalism**: Bold, raw, industrial aesthetics
- **Retro**: Vintage, nostalgic design elements
- **Illustrative**: Rich graphics and visual storytelling
- **Kid_Playful**: Colorful, fun, child-friendly interfaces
- **Custom**: Design that doesn't fit any of the above categories

## RULES:
- ALWAYS select a template (never return null)
- Ignore misleading template names - analyze actual features
- Focus on functionality over naming conventions
- Provide clear, specific reasoning for selection`;

// Template description formatting - exact copy from Cloudflare
export function formatTemplateDescriptions(templates: any[]): string {
    return templates.map((t, index) =>
        `- Template #${index + 1} \n Name - ${t.name} \n Language: ${t.language}, Frameworks: ${t.frameworks?.join(', ') || 'None'}\n ${t.description?.selection || t.description || 'No description available'}`
    ).join('\n\n');
}

// User prompt building - exact copy from Cloudflare
export function buildUserPrompt(query: string, templateDescriptions: string, images?: ImageAttachment[]): string {
    const basePrompt = `**User Request:** "${query}"

**Available Templates:**
${templateDescriptions}

**Task:** Select the most suitable template and provide:
1. Template name (exact match from list)
2. Clear reasoning for why it fits the user's needs
3. Appropriate style for the project type. Try to come up with unique styles that might look nice and unique. Be creative about your choices. But don't pick brutalist all the time.
4. Descriptive project name

Analyze each template's features, frameworks, and architecture to make the best match.
${images && images.length > 0 ? `\n**Note:** User provided ${images.length} image(s) - consider visual requirements and UI style from the images.` : ''}

ENTROPY SEED: ${generateSecureToken(64)} - for unique results`;

    return basePrompt;
}

// Message construction helpers - adapted for cross-platform use
export function createSystemMessage(content: string) {
    return {
        role: 'system',
        content: content
    };
}

export function createUserMessage(content: string) {
    return {
        role: 'user',
        content: content
    };
}

export function createMultiModalUserMessage(textContent: string, imageUrls: string[], detail: string = 'high') {
    return {
        role: 'user',
        content: [
            { type: 'text', text: textContent },
            ...imageUrls.map(url => ({
                type: 'image_url',
                image_url: { url, detail }
            }))
        ]
    };
}

// Error handling - matches Cloudflare implementation
export function createFallbackSelection(error?: any) {
    return {
        selectedTemplateName: null,
        matchConfidence: 0,
        reasoning: error ? `An error occurred during the template selection process: ${error.message || String(error)}` : "An error occurred during the template selection process.",
        useCase: null,
        complexity: null,
        styleSelection: null,
        projectName: '',
        alternativeTemplates: [],
        customizationsNeeded: ['Manual template selection required']
    };
}
