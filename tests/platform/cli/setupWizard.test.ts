import { describe, it, expect, vi, afterEach } from 'vitest';
import { SetupManager } from '../../../scripts/setup';

vi.mock('child_process', () => ({
  default: {
    execSync: vi.fn(),
  }
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Setup wizard prompts', () => {
  it('defaults runtime provider to gcp', () => {
    
  });
});
