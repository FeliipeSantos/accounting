/**
 * Maximum length of every text field of the system, in one place.
 * The project name follows the server rule (300); the others keep texts readable
 * on the screen and in the printed report.
 */
export const CHAR_LIMITS = {
  username: 64,
  password: 200,
  projectName: 300,
  projectDescription: 2000,
  projectTeam: 500,
  activityName: 200,
  subActivityName: 300,
  listItem: 500,
  kanbanCard: 300,
  projectSearch: 120,
  publicationSearch: 120,
} as const;

export type CharLimitField = keyof typeof CHAR_LIMITS;

interface CharLimitProps {
  maxLength: number;
  showCount: boolean;
}

/**
 * Props for an Ant Design Input/TextArea: the field limit and the visible counter.
 * Usage: <Input {...useCharLimit('projectName')} />
 */
export function useCharLimit(field: CharLimitField, { showCount = true }: { showCount?: boolean } = {}): CharLimitProps {
  return { maxLength: CHAR_LIMITS[field], showCount };
}
