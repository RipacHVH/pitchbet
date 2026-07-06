import { useId } from "react";
import { BASIC_KITS, HAIR_COLORS, SKIN_TONES, type AvatarConfig } from "@/lib/avatar";

const KIT_COLORS: Record<string, string> = {
  "kit-keeper": "#5ee43e",
  "kit-pinstripe": "#23233c",
  "kit-hoops": "#2e7d46",
  "kit-camo": "#4a5741",
  "kit-gold": "#ffc93c",
};

function kitColor(kit: string): string {
  if (kit.startsWith("basic-")) return BASIC_KITS[Number(kit.slice(6)) % BASIC_KITS.length];
  return KIT_COLORS[kit] ?? BASIC_KITS[0];
}

/** Mix a hex color toward white (amt > 0) or black (amt < 0). */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) =>
    Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))
      .toString(16)
      .padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const SHIRT = "M12 64 Q12 44 32 44 Q52 44 52 64 Z";

/**
 * The manager, as a bust in a circle. Pure SVG so it renders identically
 * everywhere: HUD, tables, shop previews. All gradient/clip ids are scoped
 * per instance (useId) because dozens of these render on one page.
 */
export function ManagerAvatar({ config, size = 40 }: { config: AvatarConfig; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `av${uid}${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  const skin = SKIN_TONES[config.skin % SKIN_TONES.length];
  const hairC = HAIR_COLORS[config.hairColor % HAIR_COLORS.length];
  const kit = kitColor(config.kit);
  // Jersey trim flips light/dark depending on the shirt colour
  const trim = luminance(kit) > 0.62 ? shade(kit, -0.55) : "#f4f4f8";
  const isBasicKit = config.kit.startsWith("basic-");

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
        <clipPath id={id("clip")}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
        {/* skin with soft top-left light */}
        <radialGradient id={id("skin")} cx="0.38" cy="0.28" r="1">
          <stop offset="0" stopColor={shade(skin, 0.22)} />
          <stop offset="0.55" stopColor={skin} />
          <stop offset="1" stopColor={shade(skin, -0.18)} />
        </radialGradient>
        {/* generic fabric rounding overlay for any shirt colour */}
        <linearGradient id={id("cloth")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
        {/* diagonal specular sweep (gold kit, metals) */}
        <linearGradient id={id("sheen")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0.32" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.48" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.56" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#fff3b8" />
          <stop offset="0.45" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#c8860a" />
        </linearGradient>
        <linearGradient id={id("metal")} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#f2f6fa" />
          <stop offset="0.5" stopColor="#a6b0bc" />
          <stop offset="1" stopColor="#646d78" />
        </linearGradient>
        <linearGradient id={id("bone")} x1="0" y1="1" x2="0.6" y2="0">
          <stop offset="0" stopColor="#c4b28c" />
          <stop offset="0.5" stopColor="#eee3cb" />
          <stop offset="1" stopColor="#fbf5e6" />
        </linearGradient>
        <linearGradient id={id("lens")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#9fd9ff" />
          <stop offset="0.45" stopColor="#2e5aa8" />
          <stop offset="1" stopColor="#131b3a" />
        </linearGradient>
        <linearGradient id={id("scarf")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e85d51" />
          <stop offset="1" stopColor="#9c221e" />
        </linearGradient>
        <radialGradient id={id("pearl")} cx="0.35" cy="0.3" r="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#e6e9f5" />
          <stop offset="1" stopColor="#aab1cf" />
        </radialGradient>
        <linearGradient id={id("cap")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#5a82e0" />
          <stop offset="1" stopColor="#22407e" />
        </linearGradient>
        <linearGradient id={id("canvas")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#e3d4ae" />
          <stop offset="1" stopColor="#a8926a" />
        </linearGradient>
        <linearGradient id={id("kitbase")} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor={shade(kit, 0.18)} />
          <stop offset="0.5" stopColor={kit} />
          <stop offset="1" stopColor={shade(kit, -0.28)} />
        </linearGradient>
        <linearGradient id={id("hairg")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={shade(hairC, 0.25)} />
          <stop offset="0.55" stopColor={hairC} />
          <stop offset="1" stopColor={shade(hairC, -0.25)} />
        </linearGradient>
      </defs>

      <g clipPath={url("clip")}>
        {/* ---------------- shirt ---------------- */}
        <path d={SHIRT} fill={url("kitbase")} />

        {config.kit === "kit-keeper" && (
          <g>
            <path d="M12 57 L32 50.5 L52 57 L52 60.4 L32 54 L12 60.4 Z" fill="#1d4d12" opacity="0.85" />
            <path d="M12 63 L32 56.5 L52 63 L52 64 L12 64 Z" fill="#1d4d12" opacity="0.6" />
            <path d="M12 55.9 L32 49.4 L52 55.9" stroke="#d9ffc8" strokeWidth="0.7" fill="none" opacity="0.7" />
          </g>
        )}
        {config.kit === "kit-pinstripe" && (
          <g stroke="#aeb6dd" strokeWidth="0.55" opacity="0.75">
            <line x1="18.5" y1="47.8" x2="16" y2="64" />
            <line x1="23" y1="45.9" x2="21.4" y2="64" />
            <line x1="27.5" y1="44.6" x2="26.8" y2="64" />
            <line x1="32" y1="44.2" x2="32" y2="64" />
            <line x1="36.5" y1="44.6" x2="37.2" y2="64" />
            <line x1="41" y1="45.9" x2="42.6" y2="64" />
            <line x1="45.5" y1="47.8" x2="48" y2="64" />
          </g>
        )}
        {config.kit === "kit-hoops" && (
          <g>
            <path d="M12.6 51.5 Q32 45.5 51.4 51.5 L51.4 56 Q32 50 12.6 56 Z" fill="#f2f2f6" />
            <path d="M12.6 56 Q32 50 51.4 56" stroke="#1d4d2e" strokeWidth="0.6" fill="none" opacity="0.5" />
            <path d="M12 60.5 Q32 54.5 52 60.5 L52 64 L12 64 Z" fill="#f2f2f6" />
            <path d="M12 64 Q32 58.6 52 64" stroke="#1d4d2e" strokeWidth="0.6" fill="none" opacity="0.35" />
          </g>
        )}
        {config.kit === "kit-camo" && (
          <g>
            <g fill="#2b3524" opacity="0.9">
              <path d="M17 51 Q21 47.5 25 50 Q26.5 53 22.5 54.5 Q17.5 55 17 51 Z" />
              <path d="M34 56.5 Q39.5 54 43.5 57 Q44.5 60.5 39.5 61.5 Q34 61 34 56.5 Z" />
              <path d="M42 46.5 Q46.5 45.5 48.5 48 Q48 51 44 51 Q41 49.5 42 46.5 Z" />
            </g>
            <g fill="#8c9469" opacity="0.85">
              <path d="M25 58 Q29.5 56 32.5 58.5 Q32 61.5 27.5 61.5 Q24.5 60.5 25 58 Z" />
              <path d="M15 59.5 Q18 58 20 60 Q19.5 62.5 16.5 62.5 Q14.5 61.5 15 59.5 Z" />
              <path d="M37 48 Q40 46.5 42 48.5 Q41.5 51 38.5 50.7 Q36.5 49.8 37 48 Z" />
            </g>
            <g fill="#1c2417" opacity="0.6">
              <circle cx="29" cy="52" r="1" />
              <circle cx="46" cy="60" r="1.2" />
              <circle cx="20" cy="56.5" r="0.9" />
            </g>
          </g>
        )}
        {config.kit === "kit-gold" && (
          <g>
            <path d={SHIRT} fill={url("gold")} />
            <path d={SHIRT} fill={url("sheen")} opacity="0.5" />
            <path
              d="M24.5 51.2 L25.6 53.4 L28 53.7 L26.2 55.4 L26.7 57.8 L24.5 56.6 L22.3 57.8 L22.8 55.4 L21 53.7 L23.4 53.4 Z"
              fill="#a06e08"
            />
            <path
              d="M24.2 50.8 L25.3 53 L27.7 53.3 L25.9 55 L26.4 57.4 L24.2 56.2 L22 57.4 L22.5 55 L20.7 53.3 L23.1 53 Z"
              fill="#ffe9a3"
              opacity="0.9"
            />
          </g>
        )}

        {/* fabric rounding + sleeve seams + shoulder seams on every kit */}
        <path d={SHIRT} fill={url("cloth")} />
        <path d="M18.5 47.5 Q17 54 17.3 64" stroke="#000" strokeWidth="0.8" opacity="0.18" fill="none" />
        <path d="M45.5 47.5 Q47 54 46.7 64" stroke="#000" strokeWidth="0.8" opacity="0.18" fill="none" />
        <path d="M25.4 44.9 Q21 46.5 19.1 49.7" stroke="#000" strokeWidth="0.7" opacity="0.15" fill="none" />
        <path d="M38.6 44.9 Q43 46.5 44.9 49.7" stroke="#000" strokeWidth="0.7" opacity="0.15" fill="none" />

        {/* club crest on plain kits */}
        {isBasicKit && (
          <g>
            <path d="M22.3 50.2 L27 50.2 L27 53.4 Q27 55.3 24.65 56.1 Q22.3 55.3 22.3 53.4 Z" fill={trim} />
            <path d="M22.9 50.8 L26.4 50.8 L26.4 53.3 Q26.4 54.7 24.65 55.35 Q22.9 54.7 22.9 53.3 Z" fill={shade(kit, -0.4)} />
            <circle cx="24.65" cy="52.7" r="0.95" fill={trim} />
          </g>
        )}

        {/* ---------------- neck ---------------- */}
        <path d="M28 35 L36 35 L36 46.2 Q32 48.4 28 46.2 Z" fill={url("skin")} />
        <ellipse cx="32" cy="42.4" rx="3.5" ry="1.5" fill="#000" opacity="0.2" />

        {/* V-neck collar with double trim */}
        <path d="M25.2 44.4 L32 50.8 L38.8 44.4 L38.8 47.6 L32 54 L25.2 47.6 Z" fill={shade(kit, -0.5)} />
        <path d="M25.9 45 L32 50.6 L38.1 45" stroke={trim} strokeWidth="1.15" fill="none" />
        <path d="M25.9 46.8 L32 52.4 L38.1 46.8" stroke={trim} strokeWidth="0.6" fill="none" opacity="0.75" />

        {/* ---------------- head ---------------- */}
        <circle cx="19.5" cy="28" r="2.5" fill={url("skin")} />
        <circle cx="44.5" cy="28" r="2.5" fill={url("skin")} />
        <circle cx="32" cy="28" r="13" fill={url("skin")} />
        {/* inner ears */}
        <path d="M18.6 26.9 Q17.9 28 18.6 29.1" stroke={shade(skin, -0.28)} strokeWidth="0.7" fill="none" strokeLinecap="round" />
        <path d="M45.4 26.9 Q46.1 28 45.4 29.1" stroke={shade(skin, -0.28)} strokeWidth="0.7" fill="none" strokeLinecap="round" />
        {/* bald head shine */}
        {config.hair === 0 && (
          <path d="M25 20 Q27.4 16.6 31.4 16.1" stroke="#fff" strokeWidth="2.2" fill="none" opacity="0.3" strokeLinecap="round" />
        )}

        {/* hair styles: 0 bald, 1 short, 2 spiky, 3 curly, 4 long */}
        {config.hair === 1 && (
          <g fill={url("hairg")}>
            <path d="M19 27 Q20 15.4 32 15 Q44 15.4 45 27 Q44 20.3 32 19.6 Q20 20.3 19 27 Z" />
            {/* scalloped fringe */}
            <path d="M21.4 20.9 Q23.2 23.6 25.9 21.2 Q23.6 19.8 21.4 20.9 Z" />
            <path d="M26.7 21.2 Q29 24.1 31.7 21.3 Q29.1 19.7 26.7 21.2 Z" />
            <path d="M32.3 21.3 Q35 24 37.3 21.2 Q34.9 19.7 32.3 21.3 Z" />
            <path d="M38.1 21.2 Q40.4 23.4 42.6 20.9 Q40.4 19.8 38.1 21.2 Z" />
            <path d="M23 18.4 Q27 16.2 31 16.2" stroke={shade(hairC, 0.4)} strokeWidth="0.9" fill="none" opacity="0.7" strokeLinecap="round" />
          </g>
        )}
        {config.hair === 2 && (
          <g fill={url("hairg")}>
            {/* base band */}
            <path d="M19 26.5 Q20 16.5 32 16 Q44 16.5 45 26.5 Q44 20.6 32 20 Q20 20.6 19 26.5 Z" />
            {/* chunky swept spikes with rounded tips */}
            <path d="M20.2 21.5 Q19.2 14.6 24.8 17.4 Q22.2 18.6 20.2 21.5 Z" />
            <path d="M24.8 18.4 Q25.8 10.8 30.6 16.2 Q27.4 16.4 24.8 18.4 Z" />
            <path d="M31.4 16 Q34 9.4 37.6 16.4 Q34.4 15.4 31.4 16 Z" />
            <path d="M38.2 17 Q42.6 11.6 43.8 18.8 Q41 17.2 38.2 17 Z" />
            <path d="M43 20.6 Q46.6 17.4 45.4 24 Q44.4 22 43 20.6 Z" />
            <path d="M27 14.4 Q28.4 12.4 30 13.4" stroke={shade(hairC, 0.4)} strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.75" />
            <path d="M33.6 12.8 Q34.8 11.6 35.9 12.9" stroke={shade(hairC, 0.4)} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.7" />
          </g>
        )}
        {config.hair === 3 && (
          <g fill={url("hairg")}>
            <circle cx="23" cy="20" r="4.5" />
            <circle cx="30" cy="16.5" r="4.5" />
            <circle cx="38" cy="17.5" r="4.5" />
            <circle cx="43" cy="23" r="4" />
            <circle cx="20" cy="25" r="3.5" />
            {/* forehead puffs */}
            <circle cx="26.5" cy="20.3" r="2.9" />
            <circle cx="33.8" cy="19.8" r="3.1" />
            <circle cx="40" cy="20.6" r="2.6" />
            <circle cx="28.6" cy="15.2" r="1.1" fill={shade(hairC, 0.4)} opacity="0.8" />
            <circle cx="25.4" cy="19.2" r="0.9" fill={shade(hairC, 0.4)} opacity="0.7" />
            <circle cx="36.7" cy="16.4" r="0.9" fill={shade(hairC, 0.4)} opacity="0.7" />
          </g>
        )}
        {config.hair === 4 && (
          <g fill={url("hairg")}>
            {/* long sides, wide enough to drape over the ears */}
            <path d="M17 42 Q14.5 16 32 15 Q49.5 16 47 42 L40.5 42 Q43.5 24 32 21 Q20.5 24 23.5 42 Z" />
            {/* centre-parted curtains */}
            <path d="M31.6 16.4 Q25 17.8 23.6 24.6 Q27.6 21 31.6 20.8 Z" />
            <path d="M32.4 16.4 Q39 17.8 40.4 24.6 Q36.4 21 32.4 20.8 Z" />
            <path d="M19.6 32 Q18.6 22 24.4 18.4" stroke={shade(hairC, 0.35)} strokeWidth="0.9" fill="none" opacity="0.7" strokeLinecap="round" />
            <path d="M44.6 31 Q45.2 23 39.8 18.8" stroke={shade(hairC, 0.35)} strokeWidth="0.8" fill="none" opacity="0.6" strokeLinecap="round" />
          </g>
        )}

        {/* ---------------- face ---------------- */}
        {/* brows */}
        <path d="M24.8 23.9 Q27 22.7 29.2 23.7" stroke={hairC} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M34.8 23.7 Q37 22.7 39.2 23.9" stroke={hairC} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* big friendly eyes: sclera, iris, double highlight */}
        <ellipse cx="27" cy="27.6" rx="2.5" ry="3" fill="#fff" stroke={shade(skin, -0.3)} strokeWidth="0.3" />
        <ellipse cx="37" cy="27.6" rx="2.5" ry="3" fill="#fff" stroke={shade(skin, -0.3)} strokeWidth="0.3" />
        <circle cx="27.4" cy="28.1" r="1.6" fill="#38264a" />
        <circle cx="37.4" cy="28.1" r="1.6" fill="#38264a" />
        <circle cx="26.85" cy="27.35" r="0.62" fill="#fff" />
        <circle cx="36.85" cy="27.35" r="0.62" fill="#fff" />
        <circle cx="28.1" cy="29" r="0.3" fill="#fff" opacity="0.8" />
        <circle cx="38.1" cy="29" r="0.3" fill="#fff" opacity="0.8" />
        {/* button nose */}
        <ellipse cx="32" cy="30.9" rx="1.15" ry="0.9" fill={shade(skin, -0.16)} />
        <circle cx="31.6" cy="30.6" r="0.35" fill="#fff" opacity="0.55" />
        {/* rosy cheeks */}
        <ellipse cx="23.2" cy="31.4" rx="2" ry="1.25" fill="#ff6f61" opacity="0.3" />
        <ellipse cx="40.8" cy="31.4" rx="2" ry="1.25" fill="#ff6f61" opacity="0.3" />
        {/* open smile: clean D-mouth with teeth and tongue */}
        <path d="M28 33.3 Q32 34.2 36 33.3 Q36.6 33.2 36.5 33.9 Q35.7 38.9 32 38.9 Q28.3 38.9 27.5 33.9 Q27.4 33.2 28 33.3 Z" fill="#7c3142" />
        <path d="M28.6 34 Q32 34.8 35.4 34 L35.2 35.3 Q32 36 28.8 35.3 Z" fill="#fff" />
        <path d="M30 37.2 Q32 36.2 34 37.2 Q33.7 38.6 32 38.6 Q30.3 38.6 30 37.2 Z" fill="#e8756b" />

        {/* ---------------- extras ---------------- */}
        {config.extra === "extra-shades" && (
          <g>
            <path d="M20.5 24.6 L43.5 24.6" stroke="#e0b23e" strokeWidth="1.1" strokeLinecap="round" />
            <path d="M30.4 27.2 Q32 26 33.6 27.2" stroke="#e0b23e" strokeWidth="1" fill="none" />
            <path d="M21 25.4 L19.4 26.6 M43 25.4 L44.6 26.6" stroke="#c89a2e" strokeWidth="0.9" strokeLinecap="round" />
            <rect x="21.6" y="24.4" width="9.2" height="6.2" rx="2.6" fill={url("lens")} stroke="#e0b23e" strokeWidth="0.9" />
            <rect x="33.2" y="24.4" width="9.2" height="6.2" rx="2.6" fill={url("lens")} stroke="#e0b23e" strokeWidth="0.9" />
            <path d="M23.4 29.4 L27.4 25.1 M25.4 29.9 L28.9 26.1" stroke="#fff" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
            <path d="M35 29.4 L39 25.1 M37 29.9 L40.5 26.1" stroke="#fff" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
          </g>
        )}
        {config.extra === "extra-scarf" && (
          <g>
            <path d="M36.5 47.5 L41.5 47 L44 59.5 L37.5 60 Z" fill={url("scarf")} />
            <path d="M37.8 51.8 L42.4 51.3 M38.6 55.3 L43.2 54.8" stroke="#f3e3d3" strokeWidth="1.7" opacity="0.95" />
            <path d="M38.5 60 L38.3 62.5 M40.4 59.9 L40.4 62.4 M42.3 59.7 L42.6 62.2" stroke="#9c221e" strokeWidth="1.1" strokeLinecap="round" />
            <path d="M18.5 44.5 Q32 51.5 45.5 44.5 L45.5 49.8 Q32 56.8 18.5 49.8 Z" fill={url("scarf")} />
            <path d="M18.5 44.7 Q32 51.7 45.5 44.7" stroke="#ffb1a6" strokeWidth="0.8" fill="none" opacity="0.6" />
            <path d="M22.5 46.6 L24.5 44.1 M28.5 48.7 L30.5 46.2 M34.5 48.7 L36.5 46.2 M40.5 46.6 L42.5 44.1" stroke="#f3e3d3" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M19 47.8 Q32 54.6 45 47.8" stroke="#6d1512" strokeWidth="0.7" fill="none" opacity="0.45" />
          </g>
        )}
        {config.extra === "extra-armband" && (
          <g>
            <path d="M13 54.5 L21.5 50.8 L21.5 58 L13 61.6 Z" fill={url("gold")} stroke="#8a5f06" strokeWidth="0.7" />
            <path d="M13.4 55 L21.1 51.6" stroke="#fff3b8" strokeWidth="0.8" opacity="0.8" />
            <path d="M19 54.2 Q16.2 53.6 16.2 56 Q16.2 58.4 19 57.8" stroke="#6b4a04" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        )}
        {config.extra === "extra-medal" && (
          <g>
            <path d="M28 45 L32 53.5 L36 45" stroke="#c93a3a" strokeWidth="3.6" fill="none" />
            <path d="M28 45 L32 53.5 L36 45" stroke="#f3e9e0" strokeWidth="1.2" fill="none" />
            <circle cx="32" cy="56.5" r="4.6" fill={url("gold")} stroke="#8a5f06" strokeWidth="0.9" />
            <circle cx="32" cy="56.5" r="3.3" fill="none" stroke="#a06e08" strokeWidth="0.5" opacity="0.8" />
            <path
              d="M32 54.3 L32.7 55.8 L34.3 56 L33.1 57.1 L33.4 58.7 L32 57.9 L30.6 58.7 L30.9 57.1 L29.7 56 L31.3 55.8 Z"
              fill="#8a5f06"
            />
            <circle cx="30.4" cy="54.9" r="0.8" fill="#fff" opacity="0.75" />
          </g>
        )}

        {/* ---------------- headwear ---------------- */}
        {config.head === "head-cap" && (
          <g>
            <path d="M19 22 Q20 11.5 32 11.5 Q44 11.5 45 22 Z" fill={url("cap")} />
            <path d="M32 11.5 L32 22 M25.7 13.4 Q26.6 17.6 26.2 22 M38.3 13.4 Q37.4 17.6 37.8 22" stroke="#1a3166" strokeWidth="0.6" fill="none" opacity="0.9" />
            <circle cx="32" cy="11.4" r="1.1" fill="#1a3166" />
            <ellipse cx="26.5" cy="15" rx="3.4" ry="1.9" fill="#fff" opacity="0.22" transform="rotate(-18 26.5 15)" />
            <path d="M16.6 21.5 L47.4 21.5 Q50.6 21.8 50.1 24.1 Q49.7 25.6 47 25.3 L17 24.7 Z" fill="#2b4fa3" />
            <path d="M17 24.7 L47 25.3 Q49.7 25.6 50.1 24.1 Q49 26.4 46.5 26.1 L17.5 25.5 Z" fill="#152751" />
            <path d="M17.6 22.3 L46.6 22.3" stroke="#7d9ce8" strokeWidth="0.6" opacity="0.7" />
          </g>
        )}
        {config.head === "head-bucket" && (
          <g>
            <path d="M22 19.5 Q22.5 10.8 32 10.8 Q41.5 10.8 42 19.5 Z" fill={url("canvas")} />
            <path d="M22.6 17.2 Q32 15.2 41.4 17.2" stroke="#8a774f" strokeWidth="0.7" fill="none" />
            <path d="M23.2 16.4 Q32 14.4 40.8 16.4" stroke="#f3ead1" strokeWidth="0.5" strokeDasharray="0.9 1.1" fill="none" opacity="0.9" />
            <circle cx="27.5" cy="14" r="0.55" fill="#8a774f" />
            <circle cx="36.5" cy="14" r="0.55" fill="#8a774f" />
            <path d="M15.5 19.5 L48.5 19.5 L46 25.4 Q32 27.2 18 25.4 Z" fill="#b39d72" />
            <path d="M15.5 19.5 L48.5 19.5 L48 20.7 L16 20.7 Z" fill="#c9b48a" />
            <path d="M17.2 24.1 Q32 25.9 46.8 24.1" stroke="#f3ead1" strokeWidth="0.55" strokeDasharray="1 1.2" fill="none" opacity="0.9" />
            <ellipse cx="27" cy="13.5" rx="3" ry="1.6" fill="#fff" opacity="0.25" transform="rotate(-16 27 13.5)" />
          </g>
        )}
        {config.head === "head-viking" && (
          <g>
            <path d="M19.5 21 Q11.8 16.5 13.6 7 Q20.4 10.6 21.8 18 Z" fill={url("bone")} stroke="#9c8a62" strokeWidth="0.6" />
            <path d="M44.5 21 Q52.2 16.5 50.4 7 Q43.6 10.6 42.2 18 Z" fill={url("bone")} stroke="#9c8a62" strokeWidth="0.6" />
            <path d="M15.5 13.5 Q18.5 13.9 20.6 15.8 M14.4 10 Q17.4 10.6 19.6 12.6" stroke="#9c8a62" strokeWidth="0.6" fill="none" opacity="0.8" />
            <path d="M48.5 13.5 Q45.5 13.9 43.4 15.8 M49.6 10 Q46.6 10.6 44.4 12.6" stroke="#9c8a62" strokeWidth="0.6" fill="none" opacity="0.8" />
            <path d="M20 22 Q21 11.5 32 11.5 Q43 11.5 44 22 Z" fill={url("metal")} />
            <path d="M32 11.5 L32 22" stroke="#dde4ec" strokeWidth="1.8" />
            <path d="M32 11.5 L32 22" stroke="#59626d" strokeWidth="0.5" opacity="0.6" />
            <ellipse cx="26" cy="15" rx="3.2" ry="1.7" fill="#fff" opacity="0.35" transform="rotate(-20 26 15)" />
            <path d="M19.5 20.7 L44.5 20.7 L44.5 24 L19.5 24 Z" fill="#59626d" />
            <path d="M19.5 20.7 L44.5 20.7" stroke="#8f99a5" strokeWidth="0.6" />
            <circle cx="23" cy="22.4" r="0.7" fill="#c8d1da" />
            <circle cx="29" cy="22.4" r="0.7" fill="#c8d1da" />
            <circle cx="35" cy="22.4" r="0.7" fill="#c8d1da" />
            <circle cx="41" cy="22.4" r="0.7" fill="#c8d1da" />
          </g>
        )}
        {config.head === "head-halo" && (
          <g>
            <ellipse cx="32" cy="9.5" rx="12.5" ry="4" fill="none" stroke="#ffe9a3" strokeWidth="5" opacity="0.14" />
            <ellipse cx="32" cy="9.5" rx="11.6" ry="3.6" fill="none" stroke="#ffdf7e" strokeWidth="3" opacity="0.35" />
            <ellipse cx="32" cy="9.5" rx="11" ry="3.2" fill="none" stroke="#ffd75e" strokeWidth="1.9" />
            <ellipse cx="32" cy="9.1" rx="10.4" ry="2.7" fill="none" stroke="#fffbe8" strokeWidth="0.8" opacity="0.9" />
            <path d="M45.5 7 L46.1 8.4 L47.5 9 L46.1 9.6 L45.5 11 L44.9 9.6 L43.5 9 L44.9 8.4 Z" fill="#fff6d8" />
            <path d="M19 12.5 L19.4 13.4 L20.3 13.8 L19.4 14.2 L19 15.1 L18.6 14.2 L17.7 13.8 L18.6 13.4 Z" fill="#ffe9a3" opacity="0.9" />
          </g>
        )}
        {config.head === "head-crown" && (
          <g>
            <path d="M21.5 17.5 L21.5 9.5 L26.5 13.8 L32 7 L37.5 13.8 L42.5 9.5 L42.5 17.5 Z" fill={url("gold")} stroke="#8a5f06" strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M22.6 15.5 L22.6 11.6 M32 9 L32 13.5" stroke="#fff3b8" strokeWidth="0.7" opacity="0.7" />
            <circle cx="21.5" cy="9" r="1.4" fill={url("pearl")} stroke="#8a8fae" strokeWidth="0.3" />
            <circle cx="32" cy="6.4" r="1.5" fill={url("pearl")} stroke="#8a8fae" strokeWidth="0.3" />
            <circle cx="42.5" cy="9" r="1.4" fill={url("pearl")} stroke="#8a8fae" strokeWidth="0.3" />
            <rect x="20.8" y="16.8" width="22.4" height="4.6" rx="1.2" fill={url("gold")} stroke="#8a5f06" strokeWidth="0.8" />
            <path d="M21.6 17.7 L42.4 17.7" stroke="#fff3b8" strokeWidth="0.7" opacity="0.8" />
            <path d="M26 17.6 L27.5 19.1 L26 20.6 L24.5 19.1 Z" fill="#e04545" stroke="#7e1414" strokeWidth="0.4" />
            <circle cx="32" cy="19.1" r="1.5" fill="#3e63d8" stroke="#16265e" strokeWidth="0.4" />
            <path d="M38 17.6 L39.5 19.1 L38 20.6 L36.5 19.1 Z" fill="#2eae62" stroke="#0d4f28" strokeWidth="0.4" />
            <circle cx="25.6" cy="18.6" r="0.4" fill="#fff" opacity="0.9" />
            <circle cx="31.6" cy="18.6" r="0.4" fill="#fff" opacity="0.9" />
            <circle cx="37.6" cy="18.6" r="0.4" fill="#fff" opacity="0.9" />
          </g>
        )}
      </g>
    </svg>
  );
}
