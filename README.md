# PitchBet

A football prediction game on **real upcoming matches** with **real bookmaker odds** (median consensus across EU books via The Odds API). Solo career betting plus a competitive multiplayer Arena with ranks.

## Multiplayer: The Arena

- Every open **arena** is a slate of the next 5 real matches, free to enter — no coins involved.
- One pick per match, final once locked, closed at kickoff. **The odds are the wager**: a pick is worth odds × 10 Rank Points — call it right and you gain them, call it wrong and you lose the same amount. Longshots pay more and cost more.
- Global RP never drops below 0. The matchday table ranks managers by RP earned on the slate; topping it earns an arena win (🏆).
- RP climbs a football-career ladder: Sunday League 0 → Pub Team 75 → Semi-Pro 200 → First Team 400 → Club Legend 750 → Ballon d'Or 1200.
- Players register with a manager name + password. Since game state lives in a shared Postgres database (not a local file), deploying this app anywhere puts every visitor in the same arenas — genuine online multiplayer.
- A new arena auto-creates from upcoming fixtures as soon as the previous one settles.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. You start with 1,000 coins.

## Database: Supabase Postgres

Game state (players, fixtures, bets, arenas, shop inventory) lives in Postgres, not a local file — set `DATABASE_URL` in `.env.local` to a Supabase (or any Postgres) connection string. Use the **Transaction pooler** URI from Supabase's Connect panel (IPv4-compatible, matches this app's short-lived request-scoped queries — the Direct connection is IPv6-only and needs a paid add-on to reach from most free hosts).

Schema is created automatically on first request (`ensureSchema()` in `src/lib/db.ts`) — no manual migration step.

## Freeplay coins, the daily wheel & the Locker Room

- **Daily spin**: one wheel spin per UTC day — 25 up to a 1,000-coin jackpot (~76 average, weighted so rarity strictly decreases as the prize grows: 25 lands 40% of spins, 1000 lands 0.7%). The prize is rolled server-side; the wheel animation just lands on it.
- **The Locker Room** (`/shop`): everything costs coins, nothing costs money. Customize your manager (skin tone, hair, free kits) and grind for cosmetics — kits (500–2,500), headwear up to The Crown (5,000), extras like the Captain's Armband, plus **1 free month of Pro for 10,000 coins** (redeemable when subscriptions launch). Your avatar shows on every arena table and the world rankings.
- **Accounts**: register with a manager name + password (scrypt-hashed). Log in from any device; pre-accounts players claim their name by setting a password on first login.

## Deploy status

Auto-deploy is enabled on Render (`On Commit`) and confirmed working — pushes to `main` deploy automatically.

## Deploying multiplayer on Render

`render.yaml` is a ready Blueprint: one **free-tier** web service (no persistent disk needed — Postgres is external on Supabase). Steps: push this folder to a GitHub repo → Render Dashboard → New → Blueprint → pick the repo → paste `DATABASE_URL` (Supabase pooler URI) and `ODDS_API_KEY` when prompted. Everyone who opens the URL shares the same arenas, shop and rankings.

## How it works

- **Fixtures + odds** come from The Odds API (`ODDS_API_KEY` in `.env.local`). Leagues are configured via `ODDS_SPORT_KEYS` (currently World Cup, MLS, Brazil Série A).
- **Betting**: pick 1/X/2 on any match before kickoff, set a stake with the slider. Odds are locked server-side from the cached value — the client can't tamper with them. Betting closes at kickoff.
- **Settlement**: on My Bets → "Settle results". Finished matches are scored against real final results; wins are paid at the locked odds. Bets that can never be resolved (no score within 4 days) are voided and refunded.

## API credit budget (shared 500/month key)

The key in `.env.local` is shared with EdgeFinder. Usage is kept minimal:

| Call | Cost | When |
|---|---|---|
| Odds per league | 1 credit | Only when cache is older than `ODDS_REFRESH_TTL_MINUTES` (6h default); manual refresh rate-limited to 1/10min |
| Scores per league | 2 credits | Only when settling, and only for leagues that actually have open bets past full time |
| Everything else | 0 | Served from Postgres cache |

Auto-refresh stops entirely when remaining quota drops below `ODDS_CREDIT_FLOOR` (50). Remaining credits are shown in the page footer.

## Structure

```
src/lib/db.ts         Postgres pool, schema setup, query helpers (db(), withTx())
src/lib/identity.ts   Accounts: register/login (scrypt), session cookie
src/lib/oddsApi.ts    The Odds API client + median-consensus odds
src/lib/fixtures.ts   TTL-gated refresh, upcoming fixtures query
src/lib/arena.ts      Arena lifecycle: create/join/pick/settle, RP scoring
src/lib/settle.ts     Career bet settlement engine (DB-first, API only when needed)
src/lib/shop.ts       Coin-shop catalog
src/lib/avatar.ts     Avatar config + ownership validation
src/app/api/*         Route handlers: fixtures, me, bets, arena, shop, spin, join/login
src/app/page.tsx      Fixture board + bet slip (Play/career mode)
src/app/arena/page.tsx  The Arena UI
src/app/shop/page.tsx   The Locker Room UI
src/app/bets/page.tsx Bet history + settle
```
