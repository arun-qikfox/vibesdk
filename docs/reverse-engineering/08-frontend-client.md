# 08 – Frontend Client (Vite + React) Architecture

This document captures the full client-side implementation so the UI can be regenerated from scratch. The application is a Vite-based SPA written in React 19 with TypeScript and Tailwind.

## 8.1 Project Layout

```
src/
├── main.tsx                 # Vite entry; mounts <App />
├── App.tsx                  # Top-level router + layout
├── routes/
│   ├── home/
│   │   └── index.tsx        # Landing page with query form
│   ├── chat/
│   │   ├── index.tsx        # Chat shell
│   │   ├── use-chat.ts      # Core hook managing stream & websockets
│   │   └── components/
│   │       ├── timeline/    # Phase timeline UI
│   │       ├── deployment/  # Preview/deploy controls
│   │       ├── sidebar/     # File tree, sessions list
│   │       └── console/     # NDJSON log output
├── components/
│   ├── auth/                # Login modal, buttons, context
│   ├── layout/              # Global header, footer, theme toggles
│   ├── forms/               # Query form, settings sheets
│   └── ui/                  # Tailwind-powered reusable primitives
├── contexts/
│   ├── auth-context.tsx     # Auth provider (JWT cookies)
│   └── theme-context.tsx    # Light/dark mode
├── lib/
│   ├── api-client.ts        # REST wrappers (fetch + error handling)
│   ├── requests.js          # Low-level fetch with retry/cancellation
│   └── traffic.js           # Request deduplication & caching
├── styles/
│   └── index.css            # Tailwind base + custom utilities
└── utils/
    ├── logger.ts            # Console logging abstraction
    ├── websocket.ts         # Browser WebSocket helper
    └── formatters.ts        # Date/number formatting utilities
```

## 8.2 Entry & Routing

- `main.tsx` sets up React StrictMode, wraps the app with `AuthProvider`, `ThemeProvider`, and `QueryClientProvider` (TanStack Query optional).  
- `App.tsx` uses React Router to define routes:
  - `/` → Home page (`routes/home/index.tsx`) with large hero + query form.
  - `/chat/new` → Immediately starts agent session using query string parameters (`agentMode`, `query`).
  - `/chat/:agentId` → Resumes existing session (fetches conversation state, reconnects WebSocket).
  - `/settings`, `/profile`, etc. for user account management.

## 8.3 Authentication Flow

- `AuthModalProvider` exposes modals for login/register/OTP verification.  
- `AuthContext` tracks `user`, `isAuthenticated`, provides `login`, `logout`, `refresh`.  
- On mount, `AuthContext` calls `/api/auth/profile`; failure opens login modal.  
- All protected views require `AuthGuard` wrapper.  
- JWT cookies (`session`, `accessToken`) automatically included via `credentials: 'include'`.  
- Additional components: `LoginModal`, `AuthButton`, `ProfileDropdown`.

## 8.4 Chat Experience (`routes/chat`)

### 8.4.1 `use-chat.ts`

This hook orchestrates the entire agent conversation:

1. **Initialization** – On mount, parse `agentMode` & `query`. If `query` exists, call `ApiClient.createAgentSession`.  
2. **NDJSON stream** – Uses `ReadableStreamDefaultReader` to process `POST /api/agent` response. Each line is appended to `streamEvents` state; blueprint chunks aggregated separately.  
3. **WebSocket connection** – Opens WebSocket using URL from initial stream message.  
   - Listens for events defined in `WebSocketMessageResponses`.  
   - Updates `timeline`, `fileTree`, `previewUrl`, `issues`, `conversationState`.  
   - Sends commands via `sendMessage` (e.g., `{ type: 'generate_all' }`).  
4. **Error handling** – If stream or WS fails, set `status` to `error` and expose retry controls.  
5. **Cleanup** – On unmount or navigation, closes stream reader and websocket gracefully.

### 8.4.2 UI Components

- **Timeline (`phase-timeline.tsx`)** – Vertical stepper showing phases with status badges, logs, timestamps.  
- **Deployment controls (`deployment-controls.tsx`)** – Buttons for regenerate, preview, deploy; shows preview URL and links.  
- **File viewer** – Syntax-highlighted diff viewer (Monaco or Prism). Displays `generatedFiles`.  
- **Console/logs** – Scrollable list of NDJSON events with level tagging.  
- **Command palette** – Users can send `user_suggestion`, `resume_generation`, etc.

## 8.5 Styling & Design System

- Tailwind CSS 4 + CSS modules.  
- Color palette: slate/neutral base; uses design tokens aligned with blueprint prompts (spacing in 4px increments).  
- Dark mode default, toggle via `ThemeContext`.  
- Animations via `framer-motion` for phase transitions, hover effects.

## 8.6 API Client

- `lib/api-client.ts` exposes methods: `createAgentSession`, `getAgent`, `listApps`, `deleteAgent`, `deployPreview`, etc.  
- Uses `requests.js` (wraps `fetch`) for default headers, error normalization, exponential backoff.  
- Hook usage: `useMutation` for create calls, `useQuery` for listing sessions.

## 8.7 Local Storage & Settings

- `useLocalStorage` hook for persisting UI preferences (theme, sidebar width).  
- `ChatSettingsDrawer` allows toggling `agentMode`, `autoFix`, `streaming` preferences; stored per user in KV via `/api/user/settings`.

## 8.8 Notifications & Toasts

- Uses `sonner` for toast notifications (success/error).  
- WebSocket events like `deployment_completed` trigger toast with “Open Preview” action.

## 8.9 Additional Views

- **Home (`routes/home/index.tsx`)** – Marketing copy + input form. Submitting redirects to `/chat/new?query=...`.  
- **Sessions list (`routes/chat/components/sidebar/session-list.tsx`)** – Fetches `/api/user/sessions` to show past agents.  
- **Apps gallery (`routes/apps/index.tsx`)** – Shows generated apps, favorites, statuses.  
- **Profile/settings** – Update display name, API tokens, theme.  
- **Admin dashboard** (optional) – Visible to admin users for monitoring.

## 8.10 Build & Tooling

- Vite config (`vite.config.ts`):
  - React plugin (SWC or @vitejs/plugin-react).  
  - Tailwind plugin (`@tailwindcss/vite`).  
  - Proxy: `/api` → `http://localhost:3001`.  
  - Monaco editor plugin (for code viewer).  
- Scripts:
  - `npm run dev` – SPA only.  
  - `npm run dev:full` – SPA + backend concurrently.  
  - `npm run build` – `tsc -b` + `vite build`.  
  - `npm run preview` – `vite preview`.

## 8.11 Testing

- Vitest for unit tests (`src/**/*.test.tsx`), focusing on hooks and reducers.  
- Playwright (optional) for E2E flows (login → generate → preview).  
- Storybook not included by default but easily added.

---

Armed with this document, you can reproduce the complete frontend experience: from layout, authentication, and query submission to real-time timeline updates, file inspection, and preview management. Combine with sections 01–07 to ensure client and server expectations remain aligned.
