# 04 – Prompts & LLM Configuration

This file catalogs every prompt, model, and inference pattern used by the Cloudflare agent runtime. Accurately reproducing these prompts is essential for behavioral parity.

## 4.1 Model Configuration (`worker/agents/inferutils/config.ts`)

| Action Key | Default Model | Temperature | Max Tokens | Reasoning Effort | Notes |
| ---------- | ------------- | ----------- | ----------- | ---------------- | ----- |
| `templateSelection` | `google-ai-studio/gemini-2.5-flash` | 0.3 | 4096 | `medium` | Selects template based on query + template catalog. |
| `blueprintGeneration` | `google-ai-studio/gemini-1.5-pro` | 0.2 | 8192 | `high` | Produces PRD blueprint. |
| `phaseGeneration` | `google-ai-studio/gemini-1.5-pro` | 0.25 | 6000 | `medium` | Plans next development phase. |
| `phaseImplementation` | `google-ai-studio/gemini-1.5-pro` | 0.4 | 12000 | `high` | Generates SCOF code diff stream. |
| `codeReview` | `google-ai-studio/gemini-1.5-pro` | 0.15 | 4000 | `medium` | Performs static analysis & suggests fixes. |
| `fastFixer` | `google-ai-studio/gemini-2.5-flash-lite` | 0.5 | 2000 | `low` | Quick auto-fixes during implementation. |
| `conversation` | `google-ai-studio/gemini-2.5-flash` | 0.35 | 3000 | `medium` | Handles user follow-up questions. |

Model overrides can be provided via user config (`userModelConfigs` stored in D1). If absent, the defaults above are used.

## 4.2 Template Selection Prompt

Located in `worker/agents/planning/templateSelector.ts`.

- **System Prompt Highlights**  
  - Role: “Expert Software Architect at Cloudflare specializing in template selection.”  
  - Includes selection examples (game, dashboard, fallback).  
  - Lists style guide categories (Minimalist, Brutalism, Retro, Illustrative, Kid_Playful, Custom).  
  - Selection criteria prioritize feature alignment, tech stack, architecture fit, minimal modification.

- **User Prompt Structure**  
  - Embeds user query verbatim.  
  - Enumerates available templates with name, language, frameworks, description.  
  - Requests outputs: chosen template, reasoning, style, project name.  
  - Generates entropy seed for variability.  
  - Optionally attaches base64 images via `createMultiModalUserMessage`.

## 4.3 Blueprint Prompt

Defined in `worker/agents/planning/blueprint.ts`.

- **System Prompt**  
  - Declares role as senior architect producing PRDs with visual excellence.  
  - Lists a comprehensive checklist: design system (color, typography), spacing, components, layout, responsive rules, performance, iteration, template enhancement.  
  - Specifies Tailwind styling conventions.

- **User Prompt**  
  - Injects user query, template details, frameworks, existing code context, use-case-specific instructions.  
  - Requests blueprint sections: product name, description, goals, target users, personas, features, phases, tech stack, design system, accessibility, performance, testing, deployment plan.  
  - Supports streaming via `onChunk`.

## 4.4 Phase Generation Prompt

File: `worker/agents/operations/PhaseGeneration.ts`.

- Focuses on analyzing existing progress + issues.  
- Requires detailed milestone planning with deliverables, acceptance criteria, visual updates.  
- Emphasizes deployment readiness and error remediation.

## 4.5 Phase Implementation Prompt (SCOF)

File: `worker/agents/operations/PhaseImplementation.ts`.

- Roles: senior full-stack engineer.  
- Guidelines: clean code, security best practices, testability, UI polish.  
- Generates SCOF (Streaming Code Output Format) blocks:
  - `FILE` entries with metadata.  
  - `CHUNK` entries for diff/complete file contents.  
  - Optional `COMMAND` sections with CLI instructions.  
- Includes instructions for animations, accessibility, responsive behavior, and dependencies.

## 4.6 Code Review Prompt

File: `worker/agents/operations/CodeReview.ts`.

- Priorities: React render loops, runtime errors, accessibility, performance, styling consistency, testing coverage.  
- Output schema includes `issuesFound`, `filesToFix`, `insights`, `recommendations`.  
- Drives re-entry into implementation loop if blockers remain.

## 4.7 Fast Fixer / Regeneration Prompts

Files: `worker/agents/operations/FastCodeFixer.ts`, `worker/agents/operations/FileRegeneration.ts`.

- Handle targeted fixes via SCOF output.  
- Provide context set (problem summary, offending code, desired behavior).  
- Limit scope to specific files/sections to avoid regressions.

## 4.8 Conversation & User Suggestions

File: `worker/agents/core/websocket.ts` (handled via `USER_SUGGESTION` message):

- Delegates to `agent.handleUserInput`, which uses LLM prompts to interpret user instructions, update pending tasks, and replan phases.  
- Uses lighter models (Gemini Flash variants) for responsiveness.

## 4.9 Implementation Notes

| Aspect | Details |
| ------ | ------- |
| **Streaming** | All LLM calls support streaming chunk callbacks. Blueprint uses text streaming; SCOF implementation streams file chunks. |
| **Retry Logic** | `executeInference()` in `infer.ts` retries up to `retryLimit` with exponential backoff and fallback model switch (`useCheaperModel`). |
| **Schema Validation** | Zod schemas (e.g., `TemplateSelectionSchema`, `BlueprintSchema`, `PhaseConceptGenerationSchema`) ensure outputs conform to expected shape. |
| **Tool Support** | `executeInference` accepts `tools` definitions for structured function calls (future use). |

Reproduce these prompts verbatim when porting the runtime; they define the agent’s behavior more than the surrounding glue code.
