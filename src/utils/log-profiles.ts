import type { LogProfile, LogProfileInfo } from '../types';

/**
 * Log Profile Catalog
 * 
 * Documents the implementation status of each log profile.
 * 
 * IMPORTANT: Log profiles are NOT currently implemented.
 * - Shaders are defined in LogVideoEncoder.kt but never applied
 * - Output is standard Rec.709 regardless of selected profile
 * - Formulas need verification against official specifications
 * - Do not claim these produce authentic log footage
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
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  slog2: {
    id: 'slog2',
    name: 'S-Log2',
    vendor: 'Sony',
    variant: 'S-Log2',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  clog3: {
    id: 'clog3',
    name: 'C-Log3',
    vendor: 'Canon',
    variant: 'C-Log3 (Cinema EOS)',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  vlog: {
    id: 'vlog',
    name: 'V-Log',
    vendor: 'Panasonic',
    variant: 'V-Log (Varicam)',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  logc: {
    id: 'logc',
    name: 'LogC3',
    vendor: 'ARRI',
    variant: 'LogC3 (EI 800)',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  flog: {
    id: 'flog',
    name: 'F-Log',
    vendor: 'Fujifilm',
    variant: 'F-Log',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  nlog: {
    id: 'nlog',
    name: 'N-Log',
    vendor: 'Nikon',
    variant: 'N-Log',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  dlog: {
    id: 'dlog',
    name: 'D-Log',
    vendor: 'DJI',
    variant: 'D-Log',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  redlogfilm: {
    id: 'redlogfilm',
    name: 'REDlogFilm',
    vendor: 'RED',
    variant: 'REDlogFilm',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
  },
  bmfilm: {
    id: 'bmfilm',
    name: 'Film',
    vendor: 'Blackmagic',
    variant: 'Blackmagic Film (Gen 5)',
    implemented: false,
    approximate: false,
    notes: 'NOT IMPLEMENTED. Shader defined but never applied. Output is Rec.709.',
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
