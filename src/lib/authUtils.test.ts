import { describe, it, expect } from 'vitest';
import {
  normalizeUsername,
  validatePassword,
  validateUsername,
  validateEmail,
  mapAuthError,
  getPasswordStrength,
} from './authUtils';

describe('authUtils', () => {
  it('normalizes username to lowercase', () => {
    expect(normalizeUsername('  MyShop_1  ')).toBe('myshop_1');
  });

  it('validates username pattern', () => {
    expect(validateUsername('ab')).toContain('3-30');
    expect(validateUsername('valid-name_1')).toBeNull();
  });

  it('validates password length', () => {
    expect(validatePassword('short')).toContain('8');
    expect(validatePassword('longenough')).toBeNull();
  });

  it('validates email', () => {
    expect(validateEmail('bad')).not.toBeNull();
    expect(validateEmail('a@b.com')).toBeNull();
  });

  it('maps auth errors safely', () => {
    expect(mapAuthError('Invalid login credentials')).toContain('غير صحيحة');
    expect(mapAuthError('Email not confirmed')).toBe('__EMAIL_NOT_CONFIRMED__');
    expect(mapAuthError('User already registered')).toContain('تعذر');
  });

  it('scores password strength', () => {
    expect(getPasswordStrength('')).toBe(0);
    expect(getPasswordStrength('Password1!')).toBeGreaterThan(2);
  });
});
