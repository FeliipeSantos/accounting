import { useEffect, useState } from 'react';

/** Initials of a name: first letters of the first and last words ("Felipe Santos" -> "FS"), or the first two. */
export function initials(name: string): string {
  const words = name.trim().split(/[\s._@-]+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`;
  return name.trim().slice(0, 2);
}

/** Image of an illustrated avatar, drawn after the drawings load (they are not in the first load). */
export function usePresetUri(seed: string | undefined): string | undefined {
  const [uri, setUri] = useState<{ seed: string; uri: string }>();
  useEffect(() => {
    if (!seed) return undefined;
    let active = true;
    void import('@/core/ui/avatarPresets').then(({ presetAvatarUri }) => active && setUri({ seed, uri: presetAvatarUri(seed) }));
    return () => {
      active = false;
    };
  }, [seed]);
  return seed && uri?.seed === seed ? uri.uri : undefined;
}
