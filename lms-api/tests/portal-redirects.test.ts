import { describe, expect, it } from 'vitest';
import {
  portalLoginTarget,
  portalRedirectTarget,
  portalRedirectTargetForRole,
  safePortalFallback
} from '../src/lib/portal-redirects.js';

describe('portal redirect construction', () => {
  const productionEnv = {
    ADMIN_PORTAL_URL: 'https://admin.projectodysseus.live',
    TUTOR_PORTAL_URL: 'https://tutor.projectodysseus.live',
    STUDENT_PORTAL_URL: 'https://student.projectodysseus.live'
  };

  it('appends each role dashboard path exactly once for origin-only production config', () => {
    expect(portalRedirectTarget('ADMIN', productionEnv)).toBe('https://admin.projectodysseus.live/dashboard/admin/');
    expect(portalRedirectTarget('TUTOR', productionEnv)).toBe('https://tutor.projectodysseus.live/dashboard/tutor/');
    expect(portalRedirectTarget('STUDENT', productionEnv)).toBe('https://student.projectodysseus.live/dashboard/student/');
  });

  it('strips accidental path config before appending canonical dashboard paths', () => {
    // This guards the production regression where env values already included dashboard paths.
    const envWithPaths = {
      ADMIN_PORTAL_URL: 'https://admin.projectodysseus.live/dashboard/admin',
      TUTOR_PORTAL_URL: 'https://tutor.projectodysseus.live/dashboard/tutor',
      STUDENT_PORTAL_URL: 'https://student.projectodysseus.live/dashboard/student'
    };

    expect(portalRedirectTarget('ADMIN', envWithPaths)).toBe('https://admin.projectodysseus.live/dashboard/admin/');
    expect(portalRedirectTarget('TUTOR', envWithPaths)).toBe('https://tutor.projectodysseus.live/dashboard/tutor/');
    expect(portalRedirectTarget('STUDENT', envWithPaths)).toBe('https://student.projectodysseus.live/dashboard/student/');
  });

  it('keeps local development redirects relative when portal origins are unset', () => {
    expect(portalRedirectTarget('ADMIN', {})).toBe('/dashboard/admin/');
    expect(portalRedirectTarget('TUTOR', {})).toBe('/dashboard/tutor/');
    expect(portalRedirectTarget('STUDENT', {})).toBe('/dashboard/student/');
  });

  it('uses the unified React login route as the safe fallback', () => {
    expect(portalLoginTarget('STUDENT', productionEnv)).toBe('https://student.projectodysseus.live/dashboard/login/');
    expect(safePortalFallback(productionEnv)).toBe('https://student.projectodysseus.live/dashboard/login/');
    expect(portalRedirectTargetForRole('PARENT', productionEnv)).toBe('https://student.projectodysseus.live/dashboard/login/');
    expect(safePortalFallback({})).toBe('/dashboard/login/');
  });
});
