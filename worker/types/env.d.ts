// Re-export the global Env type that is declared in worker-configuration.d.ts
// This allows explicit imports for files that need it
export type Env = globalThis.Env;

