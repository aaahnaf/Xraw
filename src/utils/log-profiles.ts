import type { LogProfile, LogProfileInfo } from '../types';

/**
 * Log Profile Catalog
 * 
 * Documents the implementation status of each log profile.
 * Each profile must transform actual captured video pixels before encoding.
 * 
 * Implementation notes:
 * - All curves are applied in native code (Kotlin/OpenGL ES)
 * - Input color space: Camera native (typically BT.709 or device-specific)
 * - Output color space: Scene-referred log
 * - Precision: 32-bit float processing, 8-bit or 10-bit output
 */

export const LOG_PROFILES: Record<LogProfile, LogProfileInfo> = {
  none: {
    id: 'none',
    name: 'Standard',
    vendor: '—',
    variant: 'No log transform',
    implemented: true,
    approximate: false,
    notes: 'Standard Rec.709 gamma. No log curve applied.',
  },
  slog3: {
    id: 'slog3',
    name: 'S-Log3',
    vendor: 'Sony',
    variant: 'S-Log3 (IEC 61966-2-1)',
    implemented: true,
    approximate: false,
    notes: 'Sony S-Log3 per official specification. 18% middle gray at 420/1023. Validated against Sony reference values.',
  },
  slog2: {
    id: 'slog2',
    name: 'S-Log2',
    vendor: 'Sony',
    variant: 'S-Log2',
    implemented: true,
    approximate: false,
    notes: 'Sony S-Log2 per official specification. Older curve with less dynamic range than S-Log3. 18% middle gray at ~0.36.',
  },
  clog3: {
    id: 'clog3',
    name: 'C-Log3',
    vendor: 'Canon',
    variant: 'C-Log3 (Cinema EOS)',
    implemented: true,
    approximate: false,
    notes: 'Canon C-Log3 per Canon official specification. 18% middle gray at 0.398.',
  },
  vlog: {
    id: 'vlog',
    name: 'V-Log',
    vendor: 'Panasonic',
    variant: 'V-Log (Varicam)',
    implemented: true,
    approximate: false,
    notes: 'Panasonic V-Log per official specification. 18% middle gray at 0.427.',
  },
  logc: {
    id: 'logc',
    name: 'LogC3',
    vendor: 'ARRI',
    variant: 'LogC3 (EI 800)',
    implemented: true,
    approximate: false,
    notes: 'ARRI LogC3 at EI 800 per ARRI official specification. 18% middle gray at 0.391.',
  },
  flog: {
    id: 'flog',
    name: 'F-Log',
    vendor: 'Fujifilm',
    variant: 'F-Log',
    implemented: true,
    approximate: false,
    notes: 'Fujifilm F-Log per official specification. 18% middle gray at 0.429.',
  },
  nlog: {
    id: 'nlog',
    name: 'N-Log',
    vendor: 'Nikon',
    variant: 'N-Log',
    implemented: true,
    approximate: false,
    notes: 'Nikon N-Log per official specification. 18% middle gray at 0.5.',
  },
  dlog: {
    id: 'dlog',
    name: 'D-Log',
    vendor: 'DJI',
    variant: 'D-Log',
    implemented: true,
    approximate: true,
    notes: 'DJI D-Log approximation. Exact curve not publicly documented. Based on observed behavior and community analysis.',
  },
  redlogfilm: {
    id: 'redlogfilm',
    name: 'REDlogFilm',
    vendor: 'RED',
    variant: 'REDlogFilm',
    implemented: true,
    approximate: false,
    notes: 'RED REDlogFilm per RED official specification. Film-like density curve.',
  },
  bmfilm: {
    id: 'bmfilm',
    name: 'Film',
    vendor: 'Blackmagic',
    variant: 'Blackmagic Film (Gen 5)',
    implemented: true,
    approximate: true,
    notes: 'Blackmagic Film curve approximation. Exact Gen 5 curve not publicly documented. Based on observed behavior.',
  },
};

/**
 * Get all available log profiles
 */
export function getAvailableProfiles(): LogProfileInfo[] {
  return Object.values(LOG_PROFILES);
}

/**
 * Get profile info by ID
 */
export function getProfileInfo(id: LogProfile): LogProfileInfo {
  return LOG_PROFILES[id];
}

/**
 * Check if a profile is fully implemented
 */
export function isProfileImplemented(id: LogProfile): boolean {
  return LOG_PROFILES[id]?.implemented ?? false;
}

/**
 * Check if a profile is approximate
 */
export function isProfileApproximate(id: LogProfile): boolean {
  return LOG_PROFILES[id]?.approximate ?? false;
}
