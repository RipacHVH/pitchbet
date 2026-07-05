import { BASIC_KITS, HAIR_COLORS, SKIN_TONES, type AvatarConfig } from "@/lib/avatar";

const KIT_COLORS: Record<string, string> = {
  "kit-keeper": "#7CFC5A",
  "kit-pinstripe": "#23233c",
  "kit-hoops": "#2e7d46",
  "kit-camo": "#3a4a3a",
  "kit-gold": "#ffc93c",
};

function kitColor(kit: string): string {
  if (kit.startsWith("basic-")) return BASIC_KITS[Number(kit.slice(6)) % BASIC_KITS.length];
  return KIT_COLORS[kit] ?? BASIC_KITS[0];
}

/**
 * The manager, as a bust in a circle. Pure SVG so it renders identically
 * everywhere: HUD, tables, shop previews.
 */
export function ManagerAvatar({ config, size = 40 }: { config: AvatarConfig; size?: number }) {
  const skin = SKIN_TONES[config.skin % SKIN_TONES.length];
  const hairC = HAIR_COLORS[config.hairColor % HAIR_COLORS.length];
  const kit = kitColor(config.kit);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className="shrink-0 rounded-full"
      style={{ background: "radial-gradient(circle at 35% 25%, #41318c, #1d1347 75%)" }}
    >
      <defs>
        <clipPath id="pbAvatarClip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath="url(#pbAvatarClip)">
        {/* shirt */}
        <path d="M12 64 Q12 44 32 44 Q52 44 52 64 Z" fill={kit} />
        {config.kit === "kit-pinstripe" && (
          <g stroke="#8d80c4" strokeWidth="1">
            <line x1="24" y1="46" x2="22" y2="64" />
            <line x1="32" y1="45" x2="32" y2="64" />
            <line x1="40" y1="46" x2="42" y2="64" />
          </g>
        )}
        {config.kit === "kit-hoops" && (
          <g fill="#e8e8ee">
            <path d="M13 52 Q32 46 51 52 L51 56 Q32 50 13 56 Z" />
            <path d="M12 60 Q32 54 52 60 L52 64 Q32 58 12 64 Z" />
          </g>
        )}
        {config.kit === "kit-camo" && (
          <g fill="#22301f" opacity="0.8">
            <ellipse cx="22" cy="52" rx="5" ry="3" />
            <ellipse cx="38" cy="58" rx="6" ry="3.5" />
            <ellipse cx="44" cy="49" rx="4" ry="2.5" />
          </g>
        )}
        {config.kit === "kit-gold" && (
          <path d="M12 64 Q12 44 32 44 Q52 44 52 64 Z" fill="url(#pbGoldGrad)" />
        )}
        <defs>
          <linearGradient id="pbGoldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe9a3" />
            <stop offset="0.6" stopColor="#ffc93c" />
            <stop offset="1" stopColor="#d99a14" />
          </linearGradient>
        </defs>

        {/* collar */}
        <path d="M26 45 L32 50 L38 45 L38 48 L32 53 L26 48 Z" fill="rgba(0,0,0,.25)" />

        {/* head */}
        <circle cx="32" cy="28" r="13" fill={skin} />
        {/* ears */}
        <circle cx="19.5" cy="28" r="2.5" fill={skin} />
        <circle cx="44.5" cy="28" r="2.5" fill={skin} />

        {/* hair styles: 0 bald, 1 short, 2 spiky, 3 curly, 4 long */}
        {config.hair === 1 && (
          <path d="M19 27 Q20 15 32 15 Q44 15 45 27 Q44 20 32 19 Q20 20 19 27 Z" fill={hairC} />
        )}
        {config.hair === 2 && (
          <path d="M19 26 L22 17 L25 22 L28 14 L32 20 L36 14 L39 22 L42 17 L45 26 Q40 17 32 17 Q24 17 19 26 Z" fill={hairC} />
        )}
        {config.hair === 3 && (
          <g fill={hairC}>
            <circle cx="23" cy="20" r="4.5" />
            <circle cx="30" cy="16.5" r="4.5" />
            <circle cx="38" cy="17.5" r="4.5" />
            <circle cx="43" cy="23" r="4" />
            <circle cx="20" cy="25" r="3.5" />
          </g>
        )}
        {config.hair === 4 && (
          <path d="M18 40 Q16 16 32 15 Q48 16 46 40 L42 40 Q44 22 32 20 Q20 22 22 40 Z" fill={hairC} />
        )}

        {/* face */}
        <circle cx="27" cy="27.5" r="1.6" fill="#241a2e" />
        <circle cx="37" cy="27.5" r="1.6" fill="#241a2e" />
        <path d="M27.5 34 Q32 37.5 36.5 34" stroke="#241a2e" strokeWidth="1.6" fill="none" strokeLinecap="round" />

        {/* extras */}
        {config.extra === "extra-shades" && (
          <g>
            <rect x="22" y="24.5" width="8.5" height="5.5" rx="2" fill="#16121f" />
            <rect x="33.5" y="24.5" width="8.5" height="5.5" rx="2" fill="#16121f" />
            <line x1="30.5" y1="27" x2="33.5" y2="27" stroke="#16121f" strokeWidth="1.5" />
          </g>
        )}
        {config.extra === "extra-scarf" && (
          <g>
            <path d="M18 45 Q32 52 46 45 L46 50 Q32 57 18 50 Z" fill="#d94848" />
            <path d="M22 46.5 L24 44 M28 48.5 L30 46 M34 48.5 L36 46 M40 46.5 L42 44" stroke="#e8e8ee" strokeWidth="2" />
          </g>
        )}
        {config.extra === "extra-armband" && (
          <path d="M13.5 55 L21 51.5 L21 58 L13.5 61.5 Z" fill="#ffc93c" />
        )}
        {config.extra === "extra-medal" && (
          <g>
            <path d="M28 46 L32 54 L36 46" stroke="#d94848" strokeWidth="2.5" fill="none" />
            <circle cx="32" cy="56" r="4" fill="#ffc93c" stroke="#8a5f06" strokeWidth="1" />
          </g>
        )}

        {/* headwear */}
        {config.head === "head-cap" && (
          <g>
            <path d="M19 22 Q20 12 32 12 Q44 12 45 22 Z" fill="#2b4fa3" />
            <path d="M17 22 L47 22 Q49 22 49 24 L47 25 L17 25 Z" fill="#1e3a7d" />
          </g>
        )}
        {config.head === "head-bucket" && (
          <g>
            <path d="M21 20 Q22 11 32 11 Q42 11 43 20 Z" fill="#c9b48a" />
            <path d="M16 20 L48 20 L46 25 L18 25 Z" fill="#b39d72" />
          </g>
        )}
        {config.head === "head-viking" && (
          <g>
            <path d="M20 22 Q21 12 32 12 Q43 12 44 22 Z" fill="#8f979f" />
            <path d="M20 22 L44 22 L44 25 L20 25 Z" fill="#6f767e" />
            <path d="M18 20 Q13 14 15 8 Q20 12 21 17 Z" fill="#e8e0ce" />
            <path d="M46 20 Q51 14 49 8 Q44 12 43 17 Z" fill="#e8e0ce" />
          </g>
        )}
        {config.head === "head-halo" && (
          <ellipse cx="32" cy="10" rx="11" ry="3.2" fill="none" stroke="#ffe9a3" strokeWidth="2.5" />
        )}
        {config.head === "head-crown" && (
          <g>
            <path d="M21 20 L21 12 L26 16 L32 9 L38 16 L43 12 L43 20 Z" fill="#ffc93c" stroke="#8a5f06" strokeWidth="1" />
            <circle cx="26" cy="18" r="1.2" fill="#d94848" />
            <circle cx="32" cy="17" r="1.2" fill="#2b4fa3" />
            <circle cx="38" cy="18" r="1.2" fill="#2e9e5b" />
          </g>
        )}
      </g>
    </svg>
  );
}
