import { describe, it, expect } from 'vitest';
import { getInitials, getUserDisplayName, resolveAvatar } from '../avatar.js';

describe('getInitials (SCEN-1.2 regression)', () => {
  it('builds uppercase initials from first and last name', () => {
    expect(getInitials({ first_name: 'Ada', last_name: 'Lovelace' })).toBe(
      'AL',
    );
  });

  it('uppercases lowercase input', () => {
    expect(getInitials({ first_name: 'maria', last_name: 'gonzalez' })).toBe(
      'MG',
    );
  });

  it('falls back to a single initial when only the first name is set', () => {
    expect(getInitials({ first_name: 'Ada' })).toBe('A');
  });

  it('falls back to a single initial when only the last name is set', () => {
    expect(getInitials({ last_name: 'Lovelace' })).toBe('L');
  });

  it('returns "?" when the user is missing', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });

  it('returns "?" when the user has no name parts at all', () => {
    expect(getInitials({})).toBe('?');
    expect(getInitials({ first_name: '', last_name: '' })).toBe('?');
  });

  it('matches the legacy single-object fixture (regression-safe)', () => {
    // Locks the output for the exact fixture used by feed.component.js
    // and feed-detail.component.js prior to the migration.
    expect(getInitials({ first_name: 'Maria', last_name: 'Gonzalez' })).toBe(
      'MG',
    );
  });
});

describe('getUserDisplayName', () => {
  it('joins first and last name with a single space', () => {
    expect(
      getUserDisplayName({ first_name: 'Ada', last_name: 'Lovelace' }),
    ).toBe('Ada Lovelace');
  });

  it('returns "Anónimo" when the user is missing', () => {
    expect(getUserDisplayName(null)).toBe('Anónimo');
    expect(getUserDisplayName(undefined)).toBe('Anónimo');
  });

  it('returns "Usuario" when both name parts are empty', () => {
    expect(getUserDisplayName({})).toBe('Usuario');
    expect(getUserDisplayName({ first_name: '', last_name: '' })).toBe(
      'Usuario',
    );
  });

  it('returns the only set part when the other is missing', () => {
    expect(getUserDisplayName({ first_name: 'Ada' })).toBe('Ada');
    expect(getUserDisplayName({ last_name: 'Lovelace' })).toBe('Lovelace');
  });
});

describe('resolveAvatar', () => {
  it('returns null for null / undefined', () => {
    expect(resolveAvatar(null)).toBeNull();
    expect(resolveAvatar(undefined)).toBeNull();
  });

  it('returns the string as-is', () => {
    expect(resolveAvatar('https://cdn.example/a.png')).toBe(
      'https://cdn.example/a.png',
    );
  });

  it('returns the url property of an object', () => {
    expect(resolveAvatar({ url: 'https://cdn.example/a.png' })).toBe(
      'https://cdn.example/a.png',
    );
  });

  it('returns the first entry of urls[]', () => {
    expect(
      resolveAvatar({
        urls: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
      }),
    ).toBe('https://cdn.example/a.png');
  });

  it('returns null for an empty urls[]', () => {
    expect(resolveAvatar({ urls: [] })).toBeNull();
  });

  it('returns the first entry of an array of strings', () => {
    expect(
      resolveAvatar(['https://cdn.example/a.png', 'https://cdn.example/b.png']),
    ).toBe('https://cdn.example/a.png');
  });

  it('returns the url property of the first entry of an object array', () => {
    expect(
      resolveAvatar([
        { url: 'https://cdn.example/a.png' },
        { url: 'https://cdn.example/b.png' },
      ]),
    ).toBe('https://cdn.example/a.png');
  });

  it('returns null when an object has no recognisable url shape', () => {
    expect(resolveAvatar({ foo: 'bar' })).toBeNull();
  });
});
