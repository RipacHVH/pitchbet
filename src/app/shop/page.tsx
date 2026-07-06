"use client";

import { useState } from "react";
import { Coin, Hud } from "@/components/Hud";
import { JoinGate } from "@/components/JoinGate";
import { ManagerAvatar } from "@/components/ManagerAvatar";
import {
  BASIC_KITS,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  SKIN_TONES,
  type AvatarConfig,
} from "@/lib/avatar";
import { SHOP_ITEMS, type ShopItem, type Slot } from "@/lib/shop";
import { useMe } from "@/lib/MeContext";
import type { Me } from "@/lib/types";

const HAIR_STYLES = ["Clean shave", "Short", "Spiky", "Curly", "Flow"];
const SECTIONS: { slot: Slot; title: string }[] = [
  { slot: "kit", title: "Kits" },
  { slot: "head", title: "Headwear" },
  { slot: "extra", title: "Extras" },
  { slot: "flex", title: "Flex" },
];

export default function ShopPage() {
  const { me, loaded: meLoaded, refresh: refreshMe, update: updateMe } = useMe();
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const avatar = me?.avatar ?? DEFAULT_AVATAR;
  const owned = new Set(me?.ownedItems ?? []);

  const saveAvatar = async (next: AvatarConfig) => {
    updateMe((m) => (m ? { ...m, avatar: next } : m)); // optimistic
    const res = await fetch("/api/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      setNotice({ kind: "err", text: (await res.json()).message ?? "Couldn't save your look." });
      await refreshMe();
    }
  };

  const buy = async (item: ShopItem) => {
    setBusyItem(item.id);
    setNotice(null);
    const res = await fetch("/api/shop/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    setBusyItem(null);
    const body = await res.json();
    if (!res.ok) {
      setNotice({ kind: "err", text: body.message ?? "Purchase failed." });
      return;
    }
    updateMe((m) =>
      m
        ? { ...m, balance: body.newBalance, ownedItems: [...(m.ownedItems ?? []), item.id] }
        : m,
    );
    setNotice({ kind: "ok", text: `${item.name} is yours. Wear it with pride.` });
    // Auto-equip wearables on purchase — instant gratification
    if (item.slot === "kit") saveAvatar({ ...avatar, kit: item.id });
    if (item.slot === "head") saveAvatar({ ...avatar, head: item.id });
    if (item.slot === "extra") saveAvatar({ ...avatar, extra: item.id });
  };

  const equip = (item: ShopItem) => {
    if (item.slot === "kit") saveAvatar({ ...avatar, kit: item.id });
    if (item.slot === "head")
      saveAvatar({ ...avatar, head: avatar.head === item.id ? null : item.id });
    if (item.slot === "extra")
      saveAvatar({ ...avatar, extra: avatar.extra === item.id ? null : item.id });
  };

  const isEquipped = (item: ShopItem) =>
    avatar.kit === item.id || avatar.head === item.id || avatar.extra === item.id;

  return (
    <div className="min-h-dvh pb-16">
      <Hud />

      <main className="mx-auto max-w-2xl px-4">
        <section className="pb-5 pt-8 text-center">
          <h1 className="display text-5xl leading-none text-white drop-shadow-[0_4px_0_rgba(0,0,0,.5)]">
            The <span className="text-gold-400">Locker Room</span>
          </h1>
          <p className="mt-2 font-semibold text-lilac-300">
            Everything here is bought with coins you win. No real money, ever.
          </p>
        </section>

        {notice && (
          <div
            className={`pop-in mb-5 rounded-2xl border-2 px-4 py-3 text-sm font-bold ${
              notice.kind === "ok"
                ? "border-gold-600/60 bg-night-700 text-lilac-100"
                : "border-danger-400/60 bg-danger-900 text-danger-300"
            }`}
          >
            {notice.text}
          </div>
        )}

        {!meLoaded ? (
          <p className="py-16 text-center font-bold text-lilac-400">Unlocking the door…</p>
        ) : !me?.joined ? (
          <JoinGate onJoined={refreshMe} />
        ) : (
          <>
            {/* Your manager */}
            <section className="mb-8 rounded-3xl border-2 border-gold-600/40 bg-night-700 p-4 shadow-[0_8px_0_rgba(0,0,0,.35)]">
              <div className="flex items-center gap-4">
                <ManagerAvatar config={avatar} size={96} />
                <div>
                  <p className="display text-xl text-white">{me.username}</p>
                  <p className="text-xs font-bold text-lilac-300">
                    This is you. Everyone on the table sees this face.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Picker label="Skin tone">
                  {SKIN_TONES.map((c, i) => (
                    <Swatch
                      key={c}
                      color={c}
                      active={avatar.skin === i}
                      onClick={() => saveAvatar({ ...avatar, skin: i })}
                    />
                  ))}
                </Picker>
                <Picker label="Hair colour">
                  {HAIR_COLORS.map((c, i) => (
                    <Swatch
                      key={c}
                      color={c}
                      active={avatar.hairColor === i}
                      onClick={() => saveAvatar({ ...avatar, hairColor: i })}
                    />
                  ))}
                </Picker>
                <Picker label="Hair style">
                  {HAIR_STYLES.map((label, i) => (
                    <button
                      key={label}
                      onClick={() => saveAvatar({ ...avatar, hair: i })}
                      className={`rounded-lg px-2 py-1 text-xs font-extrabold ${
                        avatar.hair === i
                          ? "bg-gold-400 text-night-950"
                          : "bg-night-800 text-lilac-300 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </Picker>
                <Picker label="Free kits">
                  {BASIC_KITS.map((c, i) => (
                    <Swatch
                      key={c}
                      color={c}
                      active={avatar.kit === `basic-${i}`}
                      onClick={() => saveAvatar({ ...avatar, kit: `basic-${i}` })}
                    />
                  ))}
                </Picker>
              </div>
            </section>

            {/* Catalog */}
            {SECTIONS.map(({ slot, title }) => (
              <section key={slot} className="mb-8">
                <h2 className="display mb-3 text-lg text-white">{title}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {SHOP_ITEMS.filter((i) => i.slot === slot).map((item) => {
                    const has = owned.has(item.id);
                    const preview: AvatarConfig =
                      item.slot === "kit"
                        ? { ...avatar, kit: item.id }
                        : item.slot === "head"
                          ? { ...avatar, head: item.id }
                          : item.slot === "extra"
                            ? { ...avatar, extra: item.id }
                            : avatar;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col rounded-2xl border-2 p-3 ${
                          isEquipped(item)
                            ? "border-gold-600/70 bg-night-600"
                            : "border-white/10 bg-night-800/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {item.slot !== "flex" ? (
                            <ManagerAvatar config={preview} size={72} />
                          ) : (
                            <span className="text-4xl">⭐</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-white">{item.name}</p>
                            <p className="text-[10px] font-bold leading-tight text-lilac-400">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 font-mono text-sm font-bold text-gold-300">
                            <Coin size={13} /> {item.cost.toLocaleString()}
                          </span>
                          {item.slot === "flex" ? (
                            has ? (
                              <span className="stamp text-[10px] text-gold-300">Owned</span>
                            ) : (
                              <BuyButton item={item} me={me} busy={busyItem === item.id} onBuy={buy} />
                            )
                          ) : has ? (
                            <button
                              onClick={() => equip(item)}
                              className={`btn-press rounded-lg px-3 py-1 text-xs font-extrabold ${
                                isEquipped(item)
                                  ? "border-b-night-950 bg-night-800 text-lilac-300"
                                  : "border-b-gold-800 bg-gold-400 text-night-950 hover:bg-gold-300"
                              }`}
                            >
                              {isEquipped(item) ? "Unequip" : "Equip"}
                            </button>
                          ) : (
                            <BuyButton item={item} me={me} busy={busyItem === item.id} onBuy={buy} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function BuyButton({
  item,
  me,
  busy,
  onBuy,
}: {
  item: ShopItem;
  me: Me;
  busy: boolean;
  onBuy: (item: ShopItem) => void;
}) {
  const affordable = (me.balance ?? 0) >= item.cost;
  return (
    <button
      onClick={() => onBuy(item)}
      disabled={busy || !affordable}
      className="btn-press rounded-lg border-b-gold-800 bg-gold-400 px-3 py-1 text-xs font-extrabold text-night-950 hover:bg-gold-300 disabled:opacity-40"
    >
      {busy ? "…" : affordable ? "Buy" : "Save up"}
    </button>
  );
}

function Picker({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-lilac-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Swatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Colour ${color}`}
      className={`h-7 w-7 rounded-full border-2 transition ${
        active ? "scale-110 border-gold-400" : "border-white/20 hover:border-white/50"
      }`}
      style={{ background: color }}
    />
  );
}
