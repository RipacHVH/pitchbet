import { itemById } from "./shop";

export interface AvatarConfig {
  skin: number; // 0-3 skin tone
  hair: number; // 0-4 style (0 = bald)
  hairColor: number; // 0-4
  kit: string; // "basic-0".."basic-3" or an owned kit item id
  head: string | null; // owned headwear item id
  extra: string | null; // owned extra item id
}

export const SKIN_TONES = ["#f2c9a0", "#d9a066", "#a5673f", "#6f4a2f"];
export const HAIR_COLORS = ["#241a12", "#5b3a1e", "#b57327", "#e8c15c", "#d8d8de"];
export const BASIC_KITS = ["#d94848", "#3a6fd8", "#2e9e5b", "#e8e8ee"];

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 0,
  hair: 1,
  hairColor: 0,
  kit: "basic-0",
  head: null,
  extra: null,
};

export function parseAvatar(raw: string | null): AvatarConfig {
  if (!raw) return DEFAULT_AVATAR;
  try {
    const a = JSON.parse(raw);
    return { ...DEFAULT_AVATAR, ...a };
  } catch {
    return DEFAULT_AVATAR;
  }
}

/** Validate a config against what the player actually owns. */
export function validateAvatar(
  config: AvatarConfig,
  ownedItemIds: Set<string>,
): { ok: boolean; error?: string } {
  if (
    !Number.isInteger(config.skin) || config.skin < 0 || config.skin >= SKIN_TONES.length ||
    !Number.isInteger(config.hair) || config.hair < 0 || config.hair > 4 ||
    !Number.isInteger(config.hairColor) || config.hairColor < 0 || config.hairColor >= HAIR_COLORS.length
  ) {
    return { ok: false, error: "Invalid appearance options" };
  }

  if (/^basic-[0-3]$/.test(config.kit)) {
    // free kit, fine
  } else {
    const item = itemById(config.kit);
    if (!item || item.slot !== "kit" || !ownedItemIds.has(config.kit)) {
      return { ok: false, error: "You don't own that kit" };
    }
  }

  for (const [slot, value] of [["head", config.head], ["extra", config.extra]] as const) {
    if (value === null) continue;
    const item = itemById(value);
    if (!item || item.slot !== slot || !ownedItemIds.has(value)) {
      return { ok: false, error: `You don't own that ${slot} item` };
    }
  }
  return { ok: true };
}
