import { describe, it, expect } from 'vitest';
import { createCloudflareObjectStore } from '../../shared/platform/storage/cloudflareObjectStore';
import { createGcpObjectStore } from '../../shared/platform/storage/gcpObjectStore';

class MockR2Bucket {
  private store = new Map<string, { data: Uint8Array; metadata?: any }>();

  async put(key: string, value: any, options?: any) {
    let buffer: Uint8Array;
    if (typeof value === 'string') {
      buffer = Buffer.from(value, 'utf8');
    } else if (value instanceof Uint8Array) {
      buffer = value;
    } else if (value instanceof ArrayBuffer) {
      buffer = new Uint8Array(value);
    } else {
      buffer = Buffer.from(String(value));
    }
    this.store.set(key, { data: buffer, metadata: options });
  }

  async get(key: string): Promise<any> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    const { data, metadata } = entry;
    return {
      arrayBuffer: async () => data.slice().buffer,
      text: async () => Buffer.from(data).toString('utf8'),
      json: async <T>() => JSON.parse(Buffer.from(data).toString('utf8')) as T,
      stream: () => null,
      body: null,
      httpMetadata: metadata?.httpMetadata,
      customMetadata: metadata?.customMetadata,
    };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('Cloudflare object store adapter', () => {
  it('stores and retrieves objects with metadata', async () => {
    const bucket = new MockR2Bucket();
    const store = createCloudflareObjectStore({ TEMPLATES_BUCKET: bucket as unknown as R2Bucket });

    await store.put('example.txt', 'hello world', {
      httpMetadata: { contentType: 'text/plain' },
      customMetadata: { foo: 'bar' },
    });

    const result = await store.get('example.txt');
    expect(result).not.toBeNull();
    expect(await result?.text()).toBe('hello world');
    expect(result?.httpMetadata?.contentType).toBe('text/plain');
    expect(result?.customMetadata?.foo).toBe('bar');

    await store.delete('example.txt');
    expect(await store.get('example.txt')).toBeNull();
  });
});

describe('GCP object store stub', () => {
  it('throws when operations are invoked', async () => {
    const store = createGcpObjectStore({});
    await expect(store.get('key')).rejects.toThrow();
  });
});
