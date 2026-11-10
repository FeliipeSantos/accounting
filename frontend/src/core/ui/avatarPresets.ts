import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';

/**
 * Illustrated avatars of Meu perfil: drawn in the browser by DiceBear (style Avataaars, by
 * Pablo Stanley, free for personal and commercial use). Only the seed is saved on the server.
 * Loaded on demand (import()), so the drawings stay out of the first load.
 */
export const AVATAR_SEEDS = Array.from({ length: 20 }, (_, i) => `avatar-${String(i + 1).padStart(2, '0')}`);

// fundos suaves, um por avatar, na ordem das sementes
const BACKGROUNDS = ['f8c58f', 'a9c8f5', 'f5aaa6', 'c8b6f2', 'a3dcc3', 'f6d68b', 'f2b6d3', 'b4d6f0', 'f9c9a7', 'bfe3b4'];

const cache = new Map<string, string>();

/** Data URI (SVG) of the illustration of a seed. */
export function presetAvatarUri(seed: string): string {
  const cached = cache.get(seed);
  if (cached) return cached;
  const index = AVATAR_SEEDS.indexOf(seed);
  const uri = createAvatar(avataaars, {
    seed,
    backgroundColor: [BACKGROUNDS[(index >= 0 ? index : seed.length) % BACKGROUNDS.length]],
    mouth: ['smile', 'default', 'twinkle'],
    eyes: ['default', 'happy', 'wink', 'squint'],
    eyebrows: ['defaultNatural', 'raisedExcitedNatural', 'flatNatural', 'default'],
    accessoriesProbability: 15,
    facialHairProbability: 25,
  }).toDataUri();
  cache.set(seed, uri);
  return uri;
}
