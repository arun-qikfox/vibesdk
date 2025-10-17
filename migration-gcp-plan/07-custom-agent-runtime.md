# 07 - Custom Agent Runtime on GCP

This task begins only after the Google Cloud migration (steps 01–06) is complete. It replaces dependence on Cloudflare’s Agents SDK and Durable Objects with a first-party agent runtime running entirely on Google Cloud while maintaining feature parity.

## Goals
- Deliver an in-house agent orchestration service that runs on Google Cloud Run / Cloud Functions.
- Maintain the same interfaces used by `SmartCodeGeneratorAgent` and related tooling so higher-level workflows stay untouched.
- Provide observability, scaling, and failover comparable to or better than Cloudflare’s Agents offering.

## Prerequisites
- Migration steps 01–06 completed and validated.
- GCP landing zone, Cloud Run runtime, data stores, and sandbox infrastructure operational.
- Clear understanding of current Durable Object behaviour documented in `migration/04-durable-objects-and-sandbox.md`.

## High-Level Architecture
- **Agent Gateway (Cloud Run service):** Receives agent requests via REST/WebSocket and routes to worker instances.
- **Agent Workers (Cloud Run Jobs or Services):** Execute agent phases with access to Cloud SQL, Firestore, Cloud Storage, and AI providers.
- **State Store (Cloud SQL + Firestore):** Persist agent sessions, checkpoints, and task queues.
- **Task Queue (Pub/Sub):** Schedule long-running actions and retries.
- **Observability (Cloud Logging + Cloud Trace + Cloud Monitoring dashboards).**

## Implementation Phases

### Phase 1: Design
- [ ] Document API surface area currently expected from `SmartCodeGeneratorAgent` (methods, events, concurrency guarantees).
- [ ] Draft sequence diagrams showing request flow through the proposed GCP services.
- [ ] Decide on runtime split: single Cloud Run service with concurrency or multiple services per agent responsibility.
- [ ] Identify security model (IAM roles, token exchange).

### Phase 2: Infrastructure
- [ ] Terraform modules for new services (`infra/gcp/modules/agents`).
- [ ] Pub/Sub topics/subscriptions for agent tasks.
- [ ] Cloud SQL tables / Firestore collections needed for state.
- [ ] Service accounts and IAM bindings.

### Phase 3: Runtime Implementation
- [ ] Implement `shared/platform/agents/agentRuntime.ts` exposing the same interface as the current Cloudflare agent stub.
- [ ] Build Cloud Run service(s) handling agent requests and WebSockets.
- [ ] Implement Pub/Sub consumers for async operations (e.g., sandbox builds).
- [ ] Ensure message idempotency and retries.

### Phase 4: Integration
- [ ] Update `worker/index.ts` to select `customAgentRuntime` when `RUNTIME_PROVIDER=gcp`.
- [ ] Validate compatibility with adapters introduced in earlier steps (KV, storage, sandbox).
- [ ] Run end-to-end agent conversations and compare outputs/logs to Cloudflare baseline.

### Phase 5: Observability & Scaling
- [ ] Configure Cloud Logging sinks, Cloud Trace instrumentation, and Cloud Monitoring dashboards.
- [ ] Load test agent concurrency and adjust Cloud Run min/max instances.
- [ ] Implement alerting on error rates / latency.

### Phase 6: Cutover Plan
- [ ] Create runbook for switching between Cloudflare and custom runtime (feature flag).
- [ ] Stage gradual rollout (internal, staging, production).
- [ ] Document rollback steps and verification checklist.

## Verification Checklist
- [ ] CI pipeline builds and deploys agent runtime.
- [ ] Automated tests cover key agent flows (blueprints, phase execution, code review).
- [ ] Manual testing validates parity with existing behaviour.
- [ ] Monitoring dashboards show healthy metrics during pilot rollout.

## Deliverables
- Terraform configuration for agents stack.
- Runtime source code and tests.
- Updated documentation (`docs/setup.md` and new `docs/operations/custom-agent-runtime.md`).
- Support plan and escalation contacts.

## Notes
- This phase should avoid regressions in agent behaviour; use feature flags and sandboxed rollout to verify.
- Keep Cloudflare path available as fallback until custom runtime is proven stable in production.
