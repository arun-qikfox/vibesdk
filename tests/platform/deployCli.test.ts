import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CloudflareDeploymentManager from '../../scripts/deploy';

const uploadTemplatesDirectory = vi.fn();
const cloudflareCtor = vi.fn(() => ({
  workersForPlatforms: {
    dispatch: {
      namespaces: {
        get: vi.fn(),
        create: vi.fn(),
      },
    },
  },
}));

vi.mock('cloudflare', () => ({
  default: cloudflareCtor,
}));

vi.mock('../../scripts/utils/objectStore', () => ({
  uploadTemplatesDirectory,
}));

const originalEnv = {
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  TEMPLATES_REPOSITORY: process.env.TEMPLATES_REPOSITORY,
  CLOUDFLARE_AI_GATEWAY: process.env.CLOUDFLARE_AI_GATEWAY,
};

describe('CloudflareDeploymentManager CLI flow', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    process.env.TEMPLATES_REPOSITORY = 'https://example.com/repo.git';
    process.env.CLOUDFLARE_AI_GATEWAY = 'orange-build-gateway';

    uploadTemplatesDirectory.mockClear();
    cloudflareCtor.mockClear();
  });

  afterEach(() => {
    if (originalEnv.CLOUDFLARE_API_TOKEN == null) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = originalEnv.CLOUDFLARE_API_TOKEN;
    }

    if (originalEnv.CLOUDFLARE_ACCOUNT_ID == null) {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    } else {
      process.env.CLOUDFLARE_ACCOUNT_ID = originalEnv.CLOUDFLARE_ACCOUNT_ID;
    }

    if (originalEnv.TEMPLATES_REPOSITORY == null) {
      delete process.env.TEMPLATES_REPOSITORY;
    } else {
      process.env.TEMPLATES_REPOSITORY = originalEnv.TEMPLATES_REPOSITORY;
    }

    if (originalEnv.CLOUDFLARE_AI_GATEWAY == null) {
      delete process.env.CLOUDFLARE_AI_GATEWAY;
    } else {
      process.env.CLOUDFLARE_AI_GATEWAY = originalEnv.CLOUDFLARE_AI_GATEWAY;
    }
  });

  it('runs the deployment steps with mocked side effects', async () => {
    const manager = new CloudflareDeploymentManager();

    const cleanWranglerCache = vi.fn();
    const cleanDockerfileForDeployment = vi.fn().mockReturnValue('original');
    const updatePackageJsonDatabaseCommands = vi.fn();
    const updateCustomDomainRoutes = vi.fn().mockResolvedValue('example.dev');
    const updateContainerInstanceTypes = vi.fn();
    const checkDispatchNamespaceAvailability = vi.fn().mockResolvedValue(true);
    const commentOutDispatchNamespaces = vi.fn();
    const updateContainerConfiguration = vi.fn();
    const updateDispatchNamespace = vi.fn();
    const removeConflictingVars = vi.fn().mockResolvedValue({});
    const deployTemplates = vi.fn().mockResolvedValue(undefined);
    const buildProject = vi.fn().mockResolvedValue(undefined);
    const ensureDispatchNamespace = vi.fn().mockResolvedValue(undefined);
    const ensureAIGateway = vi.fn().mockResolvedValue(undefined);
    const wranglerDeploy = vi.fn().mockResolvedValue(undefined);
    const updateSecrets = vi.fn().mockResolvedValue(undefined);
    const restoreOriginalVars = vi.fn().mockResolvedValue(undefined);
    const runDatabaseMigrations = vi.fn().mockResolvedValue(undefined);
    const restoreDockerfileARM64Flags = vi.fn();

    Object.assign(manager as any, {
      cleanWranglerCache,
      cleanDockerfileForDeployment,
      updatePackageJsonDatabaseCommands,
      updateCustomDomainRoutes,
      updateContainerInstanceTypes,
      checkDispatchNamespaceAvailability,
      commentOutDispatchNamespaces,
      updateContainerConfiguration,
      updateDispatchNamespace,
      removeConflictingVars,
      deployTemplates,
      buildProject,
      ensureDispatchNamespace,
      ensureAIGateway,
      wranglerDeploy,
      updateSecrets,
      restoreOriginalVars,
      runDatabaseMigrations,
      restoreDockerfileARM64Flags,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await manager.deploy();
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }

    expect(cleanWranglerCache).toHaveBeenCalled();
    expect(cleanDockerfileForDeployment).toHaveBeenCalled();
    expect(updatePackageJsonDatabaseCommands).toHaveBeenCalled();
    expect(updateCustomDomainRoutes).toHaveBeenCalled();
    expect(updateContainerInstanceTypes).toHaveBeenCalled();
    expect(checkDispatchNamespaceAvailability).toHaveBeenCalled();
    expect(updateContainerConfiguration).toHaveBeenCalledWith();
    expect(updateDispatchNamespace).toHaveBeenCalledWith(true);
    expect(removeConflictingVars).toHaveBeenCalled();
    expect(deployTemplates).toHaveBeenCalled();
    expect(buildProject).toHaveBeenCalled();
    expect(ensureDispatchNamespace).toHaveBeenCalled();
    expect(ensureAIGateway).toHaveBeenCalled();
    expect(wranglerDeploy).toHaveBeenCalled();
    expect(updateSecrets).toHaveBeenCalled();
    expect(restoreOriginalVars).toHaveBeenCalled();
    expect(runDatabaseMigrations).toHaveBeenCalled();
    expect(restoreDockerfileARM64Flags).toHaveBeenCalledWith('original');
  });
});
