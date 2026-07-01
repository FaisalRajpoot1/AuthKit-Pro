import { describe, expect, it } from 'vitest';
import { productionSafetyIssues } from './productionSafety';

const strong = {
  jwtAccessSecret: 'pdTUeUshZ06UFL2jPJ_E4iXcKzWyoRnqHX4qyUVDuxqBPx6bnlqFs9U4hy7HH_3m',
  jwtRefreshSecret: 'i893mK5TnDztCu_prB6F0lftNBYnc6XpZeaN-deeMmnKWa1uaJP-7tHRazqSD-SL',
  encryptionKey: 'I+bmIl5BYjeuHSgtgt7WzS3wft6ttaaVOXhIofToNlQ=',
  cookieSecure: true,
};

describe('productionSafetyIssues', () => {
  it('passes a strong, distinct, secure configuration', () => {
    expect(productionSafetyIssues(strong)).toEqual([]);
  });

  it('flags placeholder secrets', () => {
    const issues = productionSafetyIssues({
      ...strong,
      jwtAccessSecret: 'change_me_access_secret',
    });
    expect(issues.some((i) => i.includes('JWT_ACCESS_SECRET'))).toBe(true);
  });

  it('flags the committed test encryption key', () => {
    const issues = productionSafetyIssues({
      ...strong,
      encryptionKey: 'JB6IodCakx3kzIvrFGpV5mhh0CHabl4MPeJI7PVvV1U=',
    });
    expect(issues.some((i) => i.includes('ENCRYPTION_KEY'))).toBe(true);
  });

  it('flags identical access and refresh secrets', () => {
    const issues = productionSafetyIssues({
      ...strong,
      jwtRefreshSecret: strong.jwtAccessSecret,
    });
    expect(issues.some((i) => i.includes('must be different'))).toBe(true);
  });

  it('requires COOKIE_SECURE in production', () => {
    const issues = productionSafetyIssues({ ...strong, cookieSecure: false });
    expect(issues.some((i) => i.includes('COOKIE_SECURE'))).toBe(true);
  });
});
