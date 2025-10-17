import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDatabaseClient } from '../../worker/database/clients';
import { D1DatabaseClient } from '../../worker/database/clients/d1Client';

const drizzleMock = vi.fn<(db: unknown, options: unknown) => unknown>((db, options) => ({
  connection: db,
  options,
}));

const instrumentMock = vi.fn((db: any) => db);

vi.mock('drizzle-orm/d1', () => ({
  drizzle: drizzleMock,
}));

vi.mock('@sentry/cloudflare', () => ({
  instrumentD1WithSentry: instrumentMock,
}));

describe('createDatabaseClient', () => {
  beforeEach(() => {
    drizzleMock.mockClear();
    instrumentMock.mockClear();
  });

  it('constructs a D1 client when runtime is cloudflare', () => {
    const withSession = vi.fn().mockImplementation(() => ({
      withSession,
    }));
    const env = {
      RUNTIME_PROVIDER: 'cloudflare',
      DB: { withSession },
      ENABLE_READ_REPLICAS: 'false',
    } as unknown as Env;

    const client = createDatabaseClient(env);

    expect(client).toBeInstanceOf(D1DatabaseClient);
    expect(drizzleMock).toHaveBeenCalledTimes(1);

    const primary = (client as D1DatabaseClient).getPrimary();
    expect(primary).toEqual(drizzleMock.mock.results[0]?.value);
  });

  it('uses replica sessions when replicas are enabled', () => {
    const replicaSession = { replica: true };
    const withSession = vi.fn().mockReturnValue(replicaSession);
    const env = {
      RUNTIME_PROVIDER: 'cloudflare',
      DB: { withSession },
      ENABLE_READ_REPLICAS: 'true',
    } as unknown as Env;

    const client = createDatabaseClient(env) as D1DatabaseClient;
    expect(drizzleMock).toHaveBeenCalledTimes(1);

    const replica = client.getReadReplica('fresh');
    expect(withSession).toHaveBeenCalledWith('first-primary');
    expect(drizzleMock).toHaveBeenLastCalledWith(replicaSession, expect.anything());
    expect(replica).toEqual(drizzleMock.mock.results.at(-1)?.value);
  });

  it('returns primary connection when replicas disabled', () => {
    const withSession = vi.fn();
    const env = {
      RUNTIME_PROVIDER: 'cloudflare',
      DB: { withSession },
      ENABLE_READ_REPLICAS: 'false',
    } as unknown as Env;

    const client = createDatabaseClient(env) as D1DatabaseClient;
    const primary = client.getPrimary();
    const replica = client.getReadReplica();

    expect(withSession).not.toHaveBeenCalled();
    expect(replica).toBe(primary);
  });

  it('throws descriptive error when postgres adapter not configured', () => {
    const env = { RUNTIME_PROVIDER: 'gcp' } as unknown as Env;
    const client = createDatabaseClient(env);
    expect(client.kind).toBe('postgres');
    expect(() => client.getPrimary()).toThrow(/DATABASE_URL is missing/);
  });

  it('reminds about pending adapter when DATABASE_URL provided', () => {
    const env = {
      RUNTIME_PROVIDER: 'gcp',
      DATABASE_URL: 'postgres://example',
    } as unknown as Env;
    const client = createDatabaseClient(env);
    expect(() => client.getPrimary()).toThrow(/adapter implementation pending/);
  });
});
