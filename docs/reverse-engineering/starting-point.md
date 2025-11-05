# Reverse Engineering Guide – Cloudflare Agent Runtime (Starting Point)

Welcome! This guide is the canonical reference for understanding – and regenerating – the full Cloudflare-based agentic runtime that powers VibeSDK. Use it when you want to reproduce the original architecture or translate it to another infrastructure (e.g., GCP). Treat every linked section as mandatory reading; each module is documented down to file/function granularity so an LLM (or human engineer) can rebuild the system from first principles.

## Contents

| Section | Why it matters |
| ------- | --------------- |
| [01-architecture.md](./01-architecture.md) | High-level topology: Workers entrypoint, Durable Objects, services, queues, the sandbox container fleet. |
| [02-code-structure.md](./02-code-structure.md) | Declarative AST-style breakdown of the agent codebase – files, classes, key methods, and call graphs. |
| [03-state-machine.md](./03-state-machine.md) | Detailed execution loop for the `SmartCodeGeneratorAgent` (blueprint ➝ phases ➝ review ➝ finalization). Includes every state, transition, and retry rule. |
| [04-prompts-and-llm.md](./04-prompts-and-llm.md) | Complete prompt catalog and model configuration used for template selection, blueprinting, phase planning, implementation, review, and fixing. |
| [05-api-and-streaming.md](./05-api-and-streaming.md) | REST + NDJSON + WebSocket surfaces. Explains request payloads, message schemas, and handler dispatch. |
| [06-storage-and-deployment.md](./06-storage-and-deployment.md) | Data persistence (D1, KV, R2), sandbox build pipeline, deployment to Cloudflare Workers/Containers. |
| [07-security-and-config.md](./07-security-and-config.md) | Secrets, rate limiting, auth flow integration, environment variables, wrangler bindings. |
| [08-frontend-client.md](./08-frontend-client.md) | Complete Vite/React SPA structure: routes, components, state, styling, WebSocket/stream integration. |
| [09-backend-services.md](./09-backend-services.md) | Hono backend beyond the agent: authentication, user apps, metrics, middleware. |
| [10-database-schema.md](./10-database-schema.md) | Exhaustive table/column reference with relationships and migration notes (agent + auth + apps). |
| [11-devops-and-infra.md](./11-devops-and-infra.md) | Build system, scripts, CI/CD hooks, Terraform layout, container packaging, local dev tooling. |

Each section references the exact source files and line numbers (when applicable). Follow all cross-links – no detail is repeated verbatim. When in doubt, start from 01 and proceed sequentially.

## How to use this guide

1. **Understand the topology** – read sections 01 & 06 to see how requests move through the infrastructure.  
2. **Map the code** – section 02 will tell you where each class/function lives.  
3. **Trace execution** – section 03 explains the runtime loop; combine with section 05 for data flow.  
4. **Rebuild prompts** – section 04 stores the authoritative prompt text (no redactions).  
5. **Replicate storage & deployment** – section 06 + 07 specify bindings, migrations, and container contracts.  
6. **Port to new runtime** – once the above is internalized, you can reimplement the components in your target stack (e.g., GCP) by swapping the bindings while preserving flow semantics.

> **Note:** This documentation mirrors the original Cloudflare implementation precisely. Do not change behavior when porting unless you explicitly document deviations elsewhere.

Proceed to [01-architecture.md](./01-architecture.md). Good luck! 
