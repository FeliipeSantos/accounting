import styled from 'styled-components';

import type { ProfileAvatar } from '@/core/auth/profile';
import { initials, usePresetUri } from '@/core/ui/avatar';
import { palette } from '@/theme';

const Circle = styled.span<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: ${palette.blue600};
  color: #fff;
  font-size: ${({ $size }) => Math.round($size * 0.38)}px;
  font-weight: 500;
  text-transform: uppercase;
  line-height: 1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

interface UserAvatarProps {
  avatar: ProfileAvatar | undefined;
  /** Name used for the initials (and the image description). */
  name: string;
  size?: number;
  className?: string;
}

/** Avatar of a user: uploaded photo, illustration, or the initials of the name. */
export function UserAvatar({ avatar, name, size = 34, className }: UserAvatarProps) {
  const preset = usePresetUri(avatar?.kind === 'preset' ? avatar.seed : undefined);
  const src = avatar?.kind === 'image' ? avatar.url : preset;
  return (
    <Circle $size={size} className={className} aria-hidden>
      {src ? <img src={src} alt="" /> : initials(name)}
    </Circle>
  );
}
