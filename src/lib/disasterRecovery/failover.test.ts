import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkEndpointHealth, resolveSupabaseConfig, isFailoverActive } from '@/lib/disasterRecovery/failover';

describe('disasterRecovery failover', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('resolves primary config by default', () => {
    const cfg = resolveSupabaseConfig();
    expect(cfg.label).toBe('primary');
    expect(cfg.url).toContain('supabase');
  });

  it('resolves failover when flag set', () => {
    sessionStorage.setItem('dr:failover-active', '1');
    const cfg = resolveSupabaseConfig();
    expect(isFailoverActive()).toBe(true);
    expect(cfg.label).toBe('failover');
    expect(cfg.url).toContain('failover');
  });

  it('checks endpoint health', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await expect(checkEndpointHealth('https://example.supabase.co')).resolves.toBe(true);
  });

  it('treats 401 as healthy API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(checkEndpointHealth('https://example.supabase.co')).resolves.toBe(true);
  });
});
