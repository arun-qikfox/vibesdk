import { describe, it, expect } from 'vitest';
import { createKVProvider } from '../../shared/platform/kv';
import { createObjectStore } from '../../shared/platform/storage';
import { createDatabaseClient } from '../../worker/database/clients';
import { getDeploymentAdapter } from '../../shared/platform/deployment';
import { assertSandboxProvider } from '../../shared/platform/sandbox';

describe('GCP runtime stubs', () => {
  const gcpEnv = { RUNTIME_PROVIDER: 'gcp', DATABASE_URL: 'postgres://example' } as unknown as Env;

  it('throws for KV operations until Firestore implementation exists', async () => {
    const kv = createKVProvider(gcpEnv);
    await expect(kv.get('key')).rejects.toThrow(/GCP KV provider is not yet implemented/);
    await expect(kv.list()).rejects.toThrow(/GCP KV provider is not yet implemented/);
  });

  it('throws for object store operations until GCS integration exists', async () => {
    const store = createObjectStore(gcpEnv);
    await expect(store.get('key')).rejects.toThrow(/GCP object store is not implemented yet/);
    await expect(store.delete('key')).rejects.toThrow(/GCP object store is not implemented yet/);
  });

  it('provides descriptive error for postgres adapter', () => {
    const client = createDatabaseClient(gcpEnv);
    expect(() => client.getPrimary()).toThrow(/adapter implementation pending/);
  });

  it('reminds callers that deployment adapter is not ready', () => {
    expect(() => getDeploymentAdapter(gcpEnv)).toThrow(/Deployment adapter is not implemented/);
  });

  it('guards sandbox usage behind Cloudflare runtime', () => {
    expect(() => assertSandboxProvider(gcpEnv)).toThrow(/Sandbox runtime is not implemented/);
  });
});
