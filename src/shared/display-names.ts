const DEFAULT_DISPLAY_NAMES: Record<string, string> = {
  unclaimed: 'Unassigned',
  planning: 'Planning',
  speccing: 'Spec',
  implementing: 'Building',
  verifying: 'Review',
  done: 'Done',
};

/** Custom overrides from .wheatley/config.json, set at startup. */
let customNames: Record<string, string> = {};

/** Set custom phase display names (call at startup from config). */
export function setPhaseDisplayNames(names: Record<string, string>): void {
  customNames = names;
}

export function phaseDisplayName(phase: string): string {
  return customNames[phase] ?? DEFAULT_DISPLAY_NAMES[phase] ?? phase;
}

/** Merged view of default + custom names. */
export const PHASE_DISPLAY_NAMES: Record<string, string> = DEFAULT_DISPLAY_NAMES;
