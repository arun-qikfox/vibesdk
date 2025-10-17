import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  getRuntimeProvider,
  isCloudflareRuntime,
  isGcpRuntime,
} from '../../shared/platform/runtimeProvider';

describe('runtimeProvider helpers', () => {
  const originalRuntime = process.env.RUNTIME_PROVIDER;

  beforeEach(() => {
    delete process.env.RUNTIME_PROVIDER;
  });

  afterEach(() => {
    if (originalRuntime === undefined) {
      delete process.env.RUNTIME_PROVIDER;
    } else {
      process.env.RUNTIME_PROVIDER = originalRuntime;
    }
  });

  it('defaults to cloudflare when no hints are provided', () => {
    expect(getRuntimeProvider()).toBe('cloudflare');
    expect(isCloudflareRuntime()).toBe(true);
    expect(isGcpRuntime()).toBe(false);
  });

  it('detects runtime provider from env bag ignoring case', () => {
    const env = { RUNTIME_PROVIDER: 'GCP' };
    expect(getRuntimeProvider(env)).toBe('gcp');
    expect(isGcpRuntime(env)).toBe(true);
    expect(isCloudflareRuntime(env)).toBe(false);
  });

  it('normalizes common aliases to gcp', () => {
    const env = { RUNTIME_PROVIDER: 'Google-Cloud' };
    expect(getRuntimeProvider(env)).toBe('gcp');
  });

  it('falls back to process.env when env bag is missing', () => {
    process.env.RUNTIME_PROVIDER = 'gcp';
    expect(getRuntimeProvider()).toBe('gcp');
  });

  it('prefers explicit env bag over process.env', () => {
    process.env.RUNTIME_PROVIDER = 'cloudflare';
    const env = { RUNTIME_PROVIDER: 'gcp' };
    expect(getRuntimeProvider(env)).toBe('gcp');
  });
});
