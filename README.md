# Blobi Leap

A casual runner game built on the Stellar blockchain. Help Blobi dodge spikes, chase high scores, and collect cosmic cards.

**Play now: [blobileap.com](https://blobileap.com)**

## About

Blobi Leap is a one-button runner game where you control Blobi — a cheerful teal blob bouncing through an endless obstacle course. Tap or press Space to leap over spikes while the game gradually speeds up.

The game integrates with the Stellar network for player identity, leaderboard rankings, and a collectible card system featuring rare cosmic events.

## Features

### Core Game
- One-button gameplay — tap or Space to leap
- Progressive difficulty with increasing speed
- Near-miss scoring system with combo multipliers
- Dynamic death messages and flavor text
- 7-tier ranking system: Newbie → Rookie → Runner → Pro → Master → Legend → Mythic

### Stellar Integration
- **Multi-wallet support**: Freighter (browser extension), Albedo (web-based), WalletConnect/LOBSTR (mobile QR)
- **Wallet-based identity**: Connect wallet to secure your account, recover on any device
- **Leaderboard**: Daily, weekly, and all-time rankings with wallet verification badges

### Cosmic Events
Rare visual effects that appear during gameplay:
- ☄️ **Shooting Star** — Cyan streak across the sky (~55s avg)
- ⚡ **Lightning Bolt** — Gold zigzag with branching (~4.5 min avg)
- 🚀 **Stellar Rocket** — Spacecraft with teal exhaust (~3.5 min avg)
- 🕳️ **Black Hole** — Interstellar void with accretion disk (~1% per game)
- 🌌 **Aurora Borealis** — 8 random color palettes (~0.8% per game)

### Cosmic Cards (Season 1 — Genesis)
Collectible cards with unique generative art based on cosmic events:
- 3,400 total cards across 5 types and 3 rarity levels
- Each card has a unique seed producing one-of-a-kind artwork
- Earn cards by discovering cosmic events during gameplay
- Verify ownership at `blobileap.com/card/[CARD-ID]`

| Card | Supply | Rarity |
|------|--------|--------|
| Shooting Star | 1,500 | Common |
| Lightning Bolt | 800 | Uncommon |
| Stellar Rocket | 800 | Uncommon |
| Black Hole | 200 | Legendary |
| Aurora Borealis | 100 | Legendary |

### Share Cards
Pokemon-style share cards with:
- Mini game scene with Blobi
- Score, tier badge, and stats
- Cosmic sighting icons
- Dynamic flavor text (33 unique quotes)
- Player identity (nickname + wallet address)

## Tech Stack

### Frontend
- Pure HTML5 Canvas — single file, no frameworks
- Responsive design (mobile + desktop)
- Web Audio API for sound effects
- Canvas2D for all rendering (game, share cards, cosmic cards)

### Backend
- Node.js + Express
- PostgreSQL database
- JWT authentication
- Anti-cheat validation
- PM2 process management

### Infrastructure
- Vultr VPS (Ubuntu)
- Nginx reverse proxy
- Cloudflare SSL + CDN
- Telegram bot for admin/notifications

### Stellar
- `@stellar/freighter-api` for Freighter wallet
- `@albedo-link/intent` for Albedo wallet
- `@walletconnect/sign-client` for WalletConnect/LOBSTR
- Challenge-response wallet verification
- Wallet-based account recovery

## Project Structure

```
blobileap/
├── client/
│   └── public/
│       ├── index.html          # Game (single file)
│       └── card/
│           └── index.html      # Card verify page
├── server/
│   ├── app.js                  # Express server
│   ├── db.js                   # PostgreSQL pool
│   ├── notify.js               # Telegram notifications
│   ├── bot.js                  # Telegram admin bot
│   ├── routes/
│   │   ├── auth.js             # Nickname + wallet recovery
│   │   ├── scores.js           # Score submission + anti-cheat
│   │   ├── leaderboard.js      # Daily/weekly/all-time
│   │   ├── wallet.js           # Wallet challenge-response
│   │   └── cards.js            # Cosmic card system
│   └── middleware/
│       ├── auth.js             # JWT middleware
│       └── rateLimit.js        # Rate limiting
├── ecosystem.config.js         # PM2 config
├── .env.example                # Environment template
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/nickname` | Register new player |
| POST | `/api/auth/recover` | Recover account via wallet |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/scores` | Submit score |
| GET | `/api/leaderboard/:period` | Get leaderboard (daily/weekly/all) |
| POST | `/api/wallet/challenge` | Get wallet signing challenge |
| POST | `/api/wallet/verify` | Verify wallet signature |
| DELETE | `/api/wallet` | Disconnect wallet |
| GET | `/api/cards/:id` | Get card details |
| GET | `/api/cards` | List cards |
| POST | `/api/cards/claim` | Claim card (gameplay) |
| GET | `/api/cards/supply/info` | Card supply info |
| GET | `/api/health` | Health check |

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | User ID |
| nickname | VARCHAR UNIQUE | Display name |
| wallet_address | VARCHAR | Stellar public key |
| best_score | INTEGER | All-time best |
| total_games | INTEGER | Games played |
| created_at | TIMESTAMPTZ | Registration date |

### scores
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Score ID |
| user_id | INTEGER FK | Player |
| score | INTEGER | Points scored |
| speed | REAL | Max game speed |
| near_miss | INTEGER | Near misses |
| best_combo | INTEGER | Best near-miss combo |
| survival_time | INTEGER | Seconds survived |
| total_leaps | INTEGER | Jumps made |
| saw_star/lightning/rocket/blackhole/aurora | BOOLEAN | Cosmic events seen |
| created_at | TIMESTAMPTZ | Timestamp |

### cosmic_cards
| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR PK | e.g. VOID-S1-0001 |
| effect | VARCHAR | star/bolt/ship/void/aura |
| season | INTEGER | Season number |
| number | INTEGER | Card number |
| seed | VARCHAR | Random seed for art |
| rarity | VARCHAR | COMMON/UNCOMMON/LEGENDARY |
| owner_id | INTEGER FK | Card owner |
| mint_type | VARCHAR | admin/gameplay/public |

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Nginx

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/blobileap
JWT_SECRET=your-secret-here
PORT=3000
CORS_ORIGIN=*
```

### Install & Run
```bash
cd server
npm install
node migrations/run.js    # Create tables
pm2 start ecosystem.config.js
```

## Roadmap

### Completed
- [x] Core game with progressive difficulty
- [x] Multi-wallet Stellar integration (Freighter, Albedo, WalletConnect)
- [x] Wallet-based account recovery
- [x] Global leaderboard system
- [x] Cosmic card collectible system (Season 1 Genesis)
- [x] Share card generation
- [x] Admin tools (Telegram bot)
- [x] Card verification pages

### In Progress
- [ ] Soroban smart contract for card ownership
- [ ] Public mint page with XLM payment
- [ ] Blobi character card collection (random traits)

### Planned
- [ ] BLOBI token on Stellar
- [ ] Token rewards for top players
- [ ] Season 2 cosmic cards
- [ ] Tournament system
- [ ] Mobile PWA
- [ ] Multiplayer leaderboard challenges

## Links

- **Play**: [blobileap.com](https://blobileap.com)
- **Card Verify**: [blobileap.com/card/VOID-S1-0001](https://blobileap.com/card/VOID-S1-0001)

## License

MIT
