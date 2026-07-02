import { describe, it, expect } from 'vitest';
import { resolveRoleName, ROLE_LABELS } from '../role.js';

describe('resolveRoleName', () => {
  it('returns the name when role is an object', () => {
    expect(resolveRoleName({ role: { id: 1, name: 'admin_sistema' } })).toBe(
      'admin_sistema',
    );
  });

  it('returns the string when role is a plain string', () => {
    expect(resolveRoleName({ role: 'publicador' })).toBe('publicador');
  });

  it('returns null when user is missing', () => {
    expect(resolveRoleName(null)).toBeNull();
    expect(resolveRoleName(undefined)).toBeNull();
  });

  it('returns null when user has no role', () => {
    expect(resolveRoleName({})).toBeNull();
  });

  it('returns null when role is an object without a name', () => {
    expect(resolveRoleName({ role: { id: 1 } })).toBeNull();
    expect(resolveRoleName({ role: {} })).toBeNull();
  });

  it('returns null when role is an unrecognised shape', () => {
    expect(resolveRoleName({ role: 42 })).toBeNull();
    expect(resolveRoleName({ role: true })).toBeNull();
  });
});

describe('ROLE_LABELS (SCEN-8.1 consolidation)', () => {
  it('exposes every role name surfaced by the UserResource', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(
      [
        'admin_organizacion',
        'admin_sistema',
        'operador_organizacion',
        'operador_sistema',
        'publicador',
        'usuario',
      ].sort(),
    );
  });

  it('uses Spanish labels for each role', () => {
    expect(ROLE_LABELS.admin_sistema).toBe('Super Administrador');
    expect(ROLE_LABELS.admin_organizacion).toBe(
      'Administrador de Organización',
    );
    expect(ROLE_LABELS.operador_organizacion).toBe('Operador de Organización');
    expect(ROLE_LABELS.operador_sistema).toBe('Operador de Sistema');
    expect(ROLE_LABELS.publicador).toBe('Publicador');
    expect(ROLE_LABELS.usuario).toBe('Usuario');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ROLE_LABELS)).toBe(true);
  });
});

describe('role utils — guard integration (SCEN-8.2)', () => {
  it('resolves "admin_sistema" the same way the legacy guard did', () => {
    // Mirrors the SCEN-8.2 expectation: a user with role resolving to
    // "admin_sistema" still routes correctly after the migration.
    const admin = { role: { id: 1, name: 'admin_sistema' } };
    expect(resolveRoleName(admin)).toBe('admin_sistema');
    expect(ROLE_LABELS[resolveRoleName(admin)]).toBe('Super Administrador');
  });

  it('returns null when the user payload has no role (regression-safe)', () => {
    // Legacy role.guard.js falls back to "false" in this branch.
    const anon = {};
    expect(resolveRoleName(anon)).toBeNull();
  });
});
