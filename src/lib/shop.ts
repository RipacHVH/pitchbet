export type Slot = "kit" | "head" | "extra" | "flex";

export interface ShopItem {
  id: string;
  slot: Slot;
  name: string;
  cost: number;
  desc: string;
}

// Everything is earnable with coins — no real money anywhere. Prices are
// grind targets: the daily wheel averages ~90/day, career bets add more.
export const SHOP_ITEMS: ShopItem[] = [
  // Kits
  { id: "kit-keeper", slot: "kit", name: "Keeper Kit", cost: 500, desc: "Neon green, gloves sold separately" },
  { id: "kit-pinstripe", slot: "kit", name: "Pinstripe Kit", cost: 800, desc: "Boardroom-to-touchline energy" },
  { id: "kit-hoops", slot: "kit", name: "Retro Hoops", cost: 800, desc: "Like your grandad used to wear" },
  { id: "kit-camo", slot: "kit", name: "Night Camo", cost: 1200, desc: "The bookies never see you coming" },
  { id: "kit-gold", slot: "kit", name: "Golden Kit", cost: 2500, desc: "For managers who never miss" },
  // Headwear
  { id: "head-cap", slot: "head", name: "Manager's Cap", cost: 300, desc: "Classic touchline look" },
  { id: "head-bucket", slot: "head", name: "Bucket Hat", cost: 600, desc: "Terrace certified" },
  { id: "head-viking", slot: "head", name: "Viking Helm", cost: 1500, desc: "For berserker bets" },
  { id: "head-halo", slot: "head", name: "Halo", cost: 3000, desc: "Your picks are blessed" },
  { id: "head-crown", slot: "head", name: "The Crown", cost: 5000, desc: "Table-toppers only" },
  // Extras
  { id: "extra-scarf", slot: "extra", name: "Club Scarf", cost: 400, desc: "Never miss a matchday" },
  { id: "extra-shades", slot: "extra", name: "Big-Game Shades", cost: 700, desc: "Ice in the veins" },
  { id: "extra-armband", slot: "extra", name: "Captain's Armband", cost: 1000, desc: "You wear the responsibility" },
  { id: "extra-medal", slot: "extra", name: "Gold Medal", cost: 2000, desc: "Proof it wasn't luck" },
  // Flex
  {
    id: "flex-pro-month",
    slot: "flex",
    name: "1 Month of Pro, Free",
    cost: 100_000,
    desc: "Redeemable when subscriptions launch — buy now, flex forever",
  },
];

export function itemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}
