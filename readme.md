# Rage Tracker

a web app i built at 2am because i needed quantitative proof that video games are ruining my life. it started as a destiny 2 thing. then i added more games. then i rewrote the whole backend. then i rewrote it AGAIN on cloudflare workers because docker was pissing me off. i have mass amounts of mass amounts of regret and caffeine in my system.

pick a game. start a session. log every death. watch your stats climb. earn achievements for suffering. compare your misery on the leaderboard. it's like therapy but worse and with charts.

**live at [d2.fts.gg](https://d2.fts.gg)**

---

## what it does

- tracks your rage across multiple games (BO3, BF6, World of Warships, Helldivers 2, Peak, and whatever else i add through the admin panel without touching a single line of code because i REFUSE to redeploy for that)
- logs every death with a rage slider from 1 to 10 and custom quick phrases so you don't have to type the same swear word 47 times
- sessions. create them, name them, end them, watch the numbers haunt you forever
- 15 achievements that are basically badges of suffering. "Speed Run" for dying within 60 seconds. "Night Owl" for gaming at 3am. "Marathon of Misery" for 20+ deaths in one session. seek help.
- leaderboard. hall of shame. per-game filtering because apparently people want to know who rages the hardest at Helldivers specifically
- analytics. rage progression line charts. swear word frequency bar charts. your anger issues deserve data visualization.
- admin panel for managing users, games, achievements, and the cache. the god complex section.

## stack

| what | how |
|---|---|
| runtime | [Cloudflare Workers](https://workers.cloudflare.com/) because i got tired of docker |
| framework | [Hono](https://hono.dev/) with TypeScript and JSX because express is dead to me now |
| database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge) because MySQL can kiss my ass |
| cache | [Workers KV](https://developers.cloudflare.com/kv/) for leaderboard caching |
| auth | Discord OAuth2 into JWT cookies. passwords are dead. long live oauth. |
| frontend | server-rendered Hono JSX, vanilla JS, Chart.js |
| css | hand-written. every line. at 2am. with strong opinions about border-radius. |

no react. no next.js. no 400MB node_modules folder. just hono, d1, and mass amounts of mass amounts of bad decisions.

## project structure

```
src/
  index.tsx              # app entry point. route order matters and i learned that the hard way
  types.ts               # every type in the app. touch these and everything explodes
  db/migrations/         # D1 schema + seed data. each comment is a cry for help
  middleware/
    auth.ts              # JWT verification, ban checks, live DB lookups. trust nobody.
    flash.ts             # cookie-based toast notifications. took way too long to get right
  routes/
    auth.tsx             # discord oauth. 3 endpoints to answer "who are you"
    dashboard.tsx        # session list + creation with the game picker
    session.tsx          # death logging, the core loop of suffering
    account.tsx          # stats, phrases, analytics, the danger zone
    admin.tsx            # user/game/achievement management. absolute power.
    leaderboard.tsx      # cached queries with game filtering
  services/
    auth.ts              # JWT sign/verify, discord token exchange
    achievement.ts       # 15 checks that run on session end. each one is an insult
    leaderboard.ts       # KV-cached leaderboard. 5 min TTL. any shorter and the DB cries
  components/
    Layout.tsx           # base layout with sticky nav, modals, toasts
    pages/*.tsx          # every page component. all server-rendered.
public/
  css/                   # 5 CSS files. heavily commented. the comments are angry.
  js/                    # UI interactions, charts, rage slider, game picker
  images/                # just the logo honestly
```

## running locally

```bash
npm install
npm run db:migrate:local
npm run dev
```

you need a discord app for auth. put `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in a `.dev.vars` file. add `http://localhost:8787/auth/discord/callback` as a redirect URI in the discord developer portal. yes it's annoying. yes it's necessary.

## deploying

```bash
# first time setup. create the stuff.
npx wrangler d1 create rage-tracker-db
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create SESSIONS

# put the IDs from above into wrangler.jsonc then:
npm run db:migrate:remote
npx wrangler secret put JWT_SECRET
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler deploy
```

that's it. no docker. no nginx. no certbot. no 47-step deployment process. just `wrangler deploy` and pray.

## adding a game

1. log in as admin
2. admin panel > game management
3. name, slug, snarky description, bootstrap icon class, hex color
4. click add
5. done. no redeploy. it shows up everywhere. i will die on this hill.

## the comments

every single comment in this codebase was written by someone who was exhausted, frustrated, and had mass amounts of mass amounts of strong opinions about CSS specificity, SQLite constraints, and the concept of sleep. they are accurate. they are helpful. they are also absolutely unhinged. you have been warned.

---

built by [dimitri](https://github.com/DarkerMatter). mass amounts of mass amounts of caffeine was mass amounts of mass amounts of harmed in the making of this project.
