export const PHASE_DISPLAY_NAMES: Record<string, string> = {
  unclaimed: 'Unassigned',
  planning: 'Planning',
  speccing: 'Spec',
  implementing: 'Building',
  verifying: 'Review',
  done: 'Done',
};

export function phaseDisplayName(phase: string): string {
  return PHASE_DISPLAY_NAMES[phase] ?? phase;
}
