import { createHmac, timingSafeEqual } from 'node:crypto';

export class SignInConfigurationError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

export function profilePasscodeMatches(email: string, passcode: string): boolean {
  const profile = email === 'sun@sunset.local' ? { name: 'Sun', setting: 'SUN_PASSCODE' }
    : email === 'moon@sunset.local' ? { name: 'Moon', setting: 'MOON_PASSCODE' } : null;
  if (!profile) return false;
  const expected = process.env[profile.setting]?.trim();
  if (!expected) {
    throw new SignInConfigurationError(`${profile.name}’s password is not configured on this website. This installation’s settings need to be updated.`, `${profile.setting}_MISSING`);
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new SignInConfigurationError('Sign-in is not configured on this website. This installation’s settings need to be updated.', 'SESSION_SECRET_MISSING');
  }
  const digest = (value: string) => createHmac('sha256', secret).update(value).digest();
  // Ignore surrounding whitespace introduced by mobile keyboards or pasted settings.
  return timingSafeEqual(digest(passcode.trim()), digest(expected));
}
