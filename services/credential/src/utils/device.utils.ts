import { createHash } from 'crypto';

export function parseDeviceInfo(userAgent: string): { deviceName: string; deviceType: 'web' | 'mobile' } {
  const ua = userAgent.toLowerCase();
  const isMobile = /android|mobile|iphone|ipad|ipod|blackberry|opera mini|windows phone/i.test(ua);
  const deviceType: 'web' | 'mobile' = isMobile ? 'mobile' : 'web';

  let browser = 'Unknown Browser';
  if (ua.includes('edg/') || ua.includes('edge/')) browser = 'Edge';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('opr/') || ua.includes('opera/')) browser = 'Opera';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('safari/')) browser = 'Safari';
  else if (!ua) browser = 'Mobile App';

  let os = 'Unknown OS';
  if (ua.includes('windows nt 10') || ua.includes('windows nt 11')) os = 'Windows 10/11';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os x') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('linux')) os = 'Linux';

  const deviceName = isMobile ? `${browser} on ${os} (mobile)` : `${browser} on ${os}`;
  return { deviceName, deviceType };
}

export function computeFingerprint(userAgent: string): string {
  const input = userAgent || 'unknown';
  return createHash('sha256').update(input).digest('hex').substring(0, 32);
}
