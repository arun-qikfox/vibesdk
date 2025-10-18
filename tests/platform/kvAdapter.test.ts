import { describe, it, expect } from 'vitest';
import { createCloudflareKVProvider } from '../../shared/platform/kv/cloudflareKVProvider';
import { createKVProvider } from '../../shared/platform/kv';

defineSuite();

function defineSuite() {
  class MockKVNamespace {
    private store = new Map<string, string>();

    async get(key: string, type?: any): Promise<any> {
      const value = this.store.get(key);
      if (value == null) {
        return null;
      }
      const typeHint = typeof type === 'string' ? type : type?.type;
      if (typeHint === 'json') {
        return JSON.parse(value);
      }
      if (typeHint === 'arrayBuffer') {
        return Buffer.from(value);
      }
      return value;
    }

    async put(key: string, value: string): Promise<void> {
      this.store.set(key, value);
    }

    async delete(key: string): Promise<void> {
      this.store.delete(key);
    }

    async list(options?: any): Promise<any> {
      const prefix = options?.prefix ?? '';
      const keys = [...this.store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));

      return { keys, list_complete: true, cursor: undefined };
    }
  }

  describe('Cloudflare KV Provider', () => {
    it('supports basic put/get/delete operations', async () => {
      const kv = new MockKVNamespace();
      const provider = createCloudflareKVProvider({ VibecoderStore: kv as unknown as KVNamespace });

      await provider.put('foo', JSON.stringify({ hello: 'world' }));
      const fetched = await provider.get<{ hello: string }>('foo', { type: 'json' });
      expect(fetched).toEqual({ hello: 'world' });

      await provider.delete('foo');
      const afterDelete = await provider.get('foo', { type: 'text' });
      expect(afterDelete).toBeNull();
    });

    it('lists keys with a prefix', async () => {
      const kv = new MockKVNamespace();
      const provider = createCloudflareKVProvider({ VibecoderStore: kv as unknown as KVNamespace });

      await provider.put('cache:test:1', 'value');
      await provider.put('cache:test:2', 'value');
      await provider.put('other:key', 'value');

      const result = await provider.list({ prefix: 'cache:test:' });
      expect(result.keys.map((k: any) => k.name).sort()).toEqual(['cache:test:1', 'cache:test:2']);
    });
  });

  describe('GCP KV Provider stub', () => {
    it('throws when invoked', async () => {
      const provider = createKVProvider({ RUNTIME_PROVIDER: 'gcp' });
      await expect(provider.get('missing')).rejects.toThrow();
    });
  });
}
