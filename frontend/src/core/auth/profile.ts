import { apiRequest } from '@/core/api/client';

/** Avatar of the profile: none (initials), an illustration drawn from a seed, or an uploaded photo. */
export type ProfileAvatar = { kind: 'preset'; seed: string } | { kind: 'image'; url: string } | null;

export interface Profile {
  user: string;
  /** Display name; null shows the login name. */
  name: string | null;
  avatar: ProfileAvatar;
  createdAt: string;
  /** The Calendário is released by this name in REFORMA_USERS (.env): renaming needs the .env updated. */
  calendarByName: boolean;
}

/** Avatar sent on save: keep the uploaded photo, send a new one, an illustration or none. */
export type AvatarChoice = { kind: 'preset'; seed: string } | { kind: 'image' } | { kind: 'upload'; dataUrl: string } | null;

export const profileApi = {
  get: () => apiRequest<Profile>('/api/profile'),
  update: (name: string, avatar: AvatarChoice) => apiRequest<Profile>('/api/profile', { method: 'PUT', body: { name, avatar } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ user: string }>('/api/profile/password', { method: 'POST', body: { currentPassword, newPassword } }),
  changeUsername: (currentPassword: string, newUsername: string) =>
    apiRequest<{ user: string }>('/api/profile/username', { method: 'POST', body: { currentPassword, newUsername } }),
};

/** Name shown for the user: the display name, or the login name when there is none. */
export function displayName(profile: Pick<Profile, 'user' | 'name'>): string {
  return profile.name?.trim() || profile.user;
}
