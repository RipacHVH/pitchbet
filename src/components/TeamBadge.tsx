/* eslint-disable @next/next/no-img-element */

// Windows renders no emoji flags, so national teams get flagcdn images and
// clubs get a generated two-tone crest from their name.
const FLAG_CODES: Record<string, string> = {
  Argentina: "ar", Australia: "au", Austria: "at", Belgium: "be", Bolivia: "bo",
  Brazil: "br", Cameroon: "cm", Canada: "ca", Chile: "cl", Colombia: "co",
  "Costa Rica": "cr", Croatia: "hr", Denmark: "dk", Ecuador: "ec", Egypt: "eg",
  England: "gb-eng", France: "fr", Germany: "de", Ghana: "gh", Greece: "gr",
  Honduras: "hn", Iran: "ir", Italy: "it", "Ivory Coast": "ci", Jamaica: "jm",
  Japan: "jp", Jordan: "jo", "South Korea": "kr", "Korea Republic": "kr",
  Mexico: "mx", Morocco: "ma", Netherlands: "nl", "New Zealand": "nz",
  Nigeria: "ng", Norway: "no", Panama: "pa", Paraguay: "py", Peru: "pe",
  Poland: "pl", Portugal: "pt", Qatar: "qa", "Saudi Arabia": "sa",
  Scotland: "gb-sct", Senegal: "sn", Serbia: "rs", Spain: "es", Sweden: "se",
  Switzerland: "ch", Tunisia: "tn", Turkey: "tr", Ukraine: "ua", Uruguay: "uy",
  USA: "us", "United States": "us", Uzbekistan: "uz", Wales: "gb-wls",
};

function crestHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function TeamBadge({ name, size = 56 }: { name: string; size?: number }) {
  const code = FLAG_CODES[name];
  const ring = {
    width: size,
    height: size,
    boxShadow:
      "inset 0 2px 3px rgba(255,255,255,.35), inset 0 -3px 4px rgba(0,0,0,.45), 0 4px 10px rgba(0,0,0,.5)",
  };

  if (code) {
    return (
      <div
        className="relative shrink-0 overflow-hidden rounded-full border-2 border-white/25 bg-night-600"
        style={ring}
      >
        <img
          src={`https://flagcdn.com/w160/${code}.png`}
          alt={`${name} flag`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,.3),inset_0_-4px_6px_rgba(0,0,0,.4)]" />
      </div>
    );
  }

  const hue = crestHue(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-white/25 text-white"
      style={{
        ...ring,
        background: `linear-gradient(135deg, hsl(${hue} 62% 42%) 50%, hsl(${hue} 70% 26%) 50%)`,
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: size * 0.34,
        textShadow: "0 2px 3px rgba(0,0,0,.5)",
      }}
    >
      {initials(name)}
    </div>
  );
}
