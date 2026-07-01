import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveGeneratedAccessCode,
  getStoredAccessCodeForLead,
  clearStoredAccessCodesForLead,
} from './accessCodeSessionStore';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
});

describe('accessCodeSessionStore', () => {
  it('stores and retrieves plaintext by lead and code id', () => {
    saveGeneratedAccessCode({
      leadId: 'lead-1',
      codeId: 'code-a',
      accessCode: 'BDY-ABCD-1234',
      createdAt: '2026-06-30T00:00:00.000Z',
    });
    expect(getStoredAccessCodeForLead('lead-1', 'code-a')).toBe('BDY-ABCD-1234');
    expect(getStoredAccessCodeForLead('lead-1')).toBe('BDY-ABCD-1234');
  });

  it('clears entries for a lead', () => {
    saveGeneratedAccessCode({
      leadId: 'lead-1',
      codeId: 'code-a',
      accessCode: 'BDY-ABCD-1234',
      createdAt: '2026-06-30T00:00:00.000Z',
    });
    clearStoredAccessCodesForLead('lead-1');
    expect(getStoredAccessCodeForLead('lead-1')).toBeNull();
  });
});
