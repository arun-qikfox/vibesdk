Name: c-code-react-runner
short description: Simple react based frontend only non-SEO friendly app
Framework: Nextjs/react
selection criterial prompt: # Template Selection\n\nModern React SPA starter\n\nUse when:\n- Client-side only apps with no backend persistence\n- Static apps, dashboards\n- Simple, fast Vite projects\n\nAvoid when:\n- SEO/SSR landing pages\n- Heavy backend/server needs\n- Data persistence of any kind is required on server side\n\nBuilt with:\n- React Router, ShadCN UI, Tailwind, Lucide Icons, ESLint, Vite.
-----------------

Name: vite-cf-DO-KV-runner
short description: It is a deprecated template. It supports full stack implementation only for backward compatibility
Framework: Frontend with React & Backend with hono
selection criterial prompt: # Template Selection\n\nDeprecated. Use only for backward compatibility with older apps.\n\nPrefer: `vite-cf-DO-v2-runner` (multi-entity DO storage) or `vite-cf-DO-runner` (single DO).
-----------------

Name: vite-cf-DO-v2-runner
Short description: A full stack with backend heavy application with dashboard, charts and so on.
Framework: Frontend with React & Backend with hono
Selection criteria prompt: # Template Selection\n\nGeneral-purpose multi-entity storage on Cloudflare Workers using one Durable Object (DO) as the storage backend. The DO is wrapped so multiple entities (users, chats, orgs, etc.) can persist data via simple APIs.\n\nUse when:\n- Backend-heavy apps with multiple entities and server-side persistence\n- Chats, ecommerce, dashboards\n- Cost-effective persistence without KV\n- General purpose storage for any multi-entity data\n\nAvoid when:\n- Static/SPAs with no backend\n- SEO/SSR landing pages\n- You need SSR or DO features like alarms/direct DO access\n\nNote: No direct DO access. DO is storage-only; no alarms or extra DO features.\n\nBuilt with:\n- React Router, ShadCN UI, Tailwind, Lucide Icons, ESLint, Vite\n- Cloudflare Workers + a single DO for persistence,
# Usage\n\n## Overview\nCloudflare Workers + React. Storage via a single Durable Object (DO) wrapped to support multiple entities.\n- Frontend: React Router 6 + TypeScript + ShadCN UI\n- Backend: Hono Worker; persistence through one DO (no direct DO access)
-----------------

Name: vite-cf-DO-runner
Short description: SEO friendly application that needs only database storage for simple states to manage with no backend business logic required.
Framework: Frontend with React, cloudflare worker with durable object
Selection criteria prompt: # Template Selection\n\nSingle Durable Object (DO) app on Cloudflare Workers. Minimal setup that uses one global DO for persistence and DO features.\n\nUse when:\n- You need server-side state with one global DO\n- Real-time/stateful services, dashboards, counters\n\nAvoid when:\n- Static/SPAs with no backend\n- SEO/SSR landing pages\n- You only need database-like storage across many entities (see DO v2 runner)\n\nBuilt with:\n- React Router, ShadCN UI, Tailwind, Lucide Icons, ESLint, Vite\n- Cloudflare Workers + single DO for persistence
-----------------

Name: c-code-next-runner
Short description: A high performance full stack application with an appealing frontend with smooth animations, support SEO.
Framework: Nextjs/react.
Selection Criteria prompt: # Template Selection Guidelines\n\nThis template offers a streamlined and performant foundation for building beautiful, responsive landing pages with modern animations and iconography.\n\n* Use this template when you need:\n  * High-performance server-side heavy projects and dashboards\n  * Pages optimized for SEO with server-rendered content\n  * Responsive design with smooth scrolling and page transitions\n  * Easily customizable layouts for product launches, waitlists, or portfolios\n  * Design-first experiences with animation and interactivity\n\n* Do not use it for:\n  * Lightweight, mostly client side heavy projects\n  * Static pages\n\n* Built with:\n  * **Next.js (Page Router)** for hybrid static & server rendering, built-in SEO, and routing\n  * **Tailwind CSS** for rapid UI development with utility-first styling\n  * **Lucide Icons** for sleek, consistent iconography\n  * **Framer Motion** for intuitive, production-ready animations\n  * **TypeScript** and **ESLint** for type safety and code quality
-----------------

Name: vite-cfagents-runner
Short description: AI agent chat application using cloudflare agents and services with token streaming support. It also support MCP implementation.
Framework: React + Cloudflare agents SDK & services
Selection criteria prompt: # Template Selection Guidelines\n\nThis template provides a production-ready AI agent chatbot built with Cloudflare Agents SDK, featuring intelligent tool usage and multi-model support as well as control plane durable objects for session management.\n\n* Use this template when you need:\n  * AI chat applications with intelligent tool/function calling capabilities\n  * Agent-based chatbots using production Cloudflare MCP servers\n  * Multi-model AI support (GPT-4o, Gemini 2.0/2.5, Claude Opus 4)\n  * Production-ready MCP integration with official TypeScript SDK\n  * Real-time conversation management\n  * Real-time streaming chat with AI Agents\n  * Advanced AI Agents capabilities and AI based applications like image generation, chat bots etc\n\n* Do not use it for:\n  * Simple static websites without AI functionality\n  * Applications that don't need AI capabilities\n  * Projects requiring complex multi-user chat rooms or real-time streaming\n  * Simple question-answer bots without tool requirements\n\n**IMPORTANT NOTE: Only use this template if you NEED AI/LLM capabilities as core of your application. If the requirement is for durable objects, there are much better templates like 'vite-cf-DO-runner' or 'vite-cf-DO-v2-runner'**\n\n* Built with:\n  * **Cloudflare Agents SDK** for stateful agent management with Durable Objects\n  * **Official MCP TypeScript SDK** for proper protocol implementation\n  * **React + Vite** for fast, modern frontend development\n  * **OpenAI SDK** for AI model integration via Cloudflare AI Gateway\n  * **Production Cloudflare MCP Servers** (Documentation and Browser)\n  * **Tailwind CSS** with glass morphism effects and responsive design\n  * **Framer Motion** for smooth chat animations and loading states\n  * **Shadcn/UI** components for polished interface elements\n  * **TypeScript** for type safety and extensible architecture\n  * **Validated MCP Integration** using official schemas and transports",
-------------