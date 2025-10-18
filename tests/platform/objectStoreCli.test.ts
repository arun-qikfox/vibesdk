import { describe, it, expect, afterEach } from 'vitest';
import { uploadTemplatesDirectory, setExecSyncImplementation, resetExecSyncImplementation } from '../../scripts/utils/objectStore';

afterEach(() => {
  resetExecSyncImplementation();
});

describe('uploadTemplatesDirectory', () => {
  it('invokes deploy script with expected environment', () => {
    const calls: Array<{ command: string; options: any }> = [];
    const mockExec = (command: string, options: any) => {
      calls.push({ command, options });
      return Buffer.from('');
    };

    setExecSyncImplementation(mockExec as unknown as typeof import('child_process').execSync);

    uploadTemplatesDirectory({
      templatesDir: '/tmp/templates',
      bucketName: 'bucket-name',
      accountId: 'account',
      apiToken: 'token',
      localMode: true,
    });

    expect(calls).toHaveLength(1);
    const [{ command, options }] = calls;
    expect(command).toBe('./deploy_templates.sh');
    expect(options.cwd).toBe('/tmp/templates');
    expect(options.env).toMatchObject({
      CLOUDFLARE_API_TOKEN: 'token',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      BUCKET_NAME: 'bucket-name',
      R2_BUCKET_NAME: 'bucket-name',
      LOCAL_R2: 'true',
    });
  });
});
