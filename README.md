# Blobi Leap

A casual runner game built on the Stellar blockchain. Help Blobi dodge spikes, chase high scores, and collect cosmic cards.

**Play now: [blobileap.com](https://blobileap.com)**

## About

Blobi Leap is a one-button runner game where you control Blobi — a cheerful teal blob bouncing through an endless obstacle course. Tap or press Space to leap over spikes while the game gradually speeds up.

The game integrates with the Stellar network for player identity, leaderboard rankings, token rewards, and a collectible card system featuring rare cosmic events.

## Features

### Core Game
- One-button gameplay — tap or Space to leap
- Progressive difficulty with increasing speed
- Near-miss scoring system with combo multipliers
- 7-tier ranking system: Newbie → Rookie → Runner → Pro → Master → Legend → Mythic
- Dynamic death messages (33 unique flavor texts)

### Stellar Integration
- **Multi-wallet support**: Freighter (browser extension), Albedo (web-based), WalletConnect/LOBSTR (mobile QR)
- **Wallet-based identity**: Connect wallet to secure your account, recover on any device
- **BLOBI Token**: In-game utility token on Stellar mainnet (10M fixed supply, issuer locked)
- **Weekly Rewards**: Top 10 leaderboard players earn BLOBI every Sunday (auto-distributed)
- **Add Trustline Prompt**: In-game prompt to add BLOBI token (auto-sign or manual instructions)
- **Leaderboard**: Daily, weekly, and all-time rankings with wallet verification badges

### BLOBI Token
- Asset code: `BLOBI`
- Issuer: `GDSM5FTQQQDCM5AU6B5FICSCO65IPY5V2KE4TBC6PSWCDGBP3V2BLOBI`
- Supply: 10,000,000 (fixed, issuer locked permanently)
- Home domain: blobileap.com
- Utility: Weekly leaderboard rewards, card minting, gameplay bonuses
- Not intended for trading — in-game utility only

### Cosmic Events
Rare visual effects that appear during gameplay:
- Shooting Star — cyan streak (~55s avg)
- Lightning Bolt — gold zigzag (~4.5 min avg)
- Stellar Rocket — spacecraft with teal exhaust (~3.5 min avg)
- Black Hole — void with accretion disk (~1% per game)
- Aurora Borealis — 8 random color palettes (~0.8% per game)

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

### Player Profile
- Public profile page: `blobileap.com/u/[Nickname]`
- Shows stats, tier, BLOBI balance, card collection
- Shareable link for social proof

### Share Cards
Pokemon-style share cards with mini game scene, score, tier badge, stats, cosmic sighting icons, BLOBI balance, flavor text, and player identity.

## Tech Stack

### Frontend
- Pure HTML5 Canvas — single file, no frameworks
- Responsive design (mobile + desktop)
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
- BLOBI token (Stellar native asset)
- Horizon API for balance queries and trustline management
- stellar.toml for token verification

## Project Structure
```
blobileap/
├── client/
│   └── public/
│       ├── index.html          # Game (single file)
│       ├── card/
│       │   └── index.html      # Card verify page
│       └── u/
│           └── index.html      # Player profile page
├── server/
│   ├── app.js                  # Express server
│   ├── db.js                   # PostgreSQL pool
│   ├── distribute.js           # BLOBI reward distribution
│   ├── notify.js               # Telegram notifications
│   ├── bot.js                  # Telegram admin bot
│   ├── routes/
│   │   ├── auth.js             # Nickname + wallet recovery + profile
│   │   ├── scores.js           # Score submission + weekly rank
│   │   ├── leaderboard.js      # Daily/weekly/all-time
│   │   ├── wallet.js           # Wallet challenge-response
│   │   ├── cards.js            # Cosmic card system
│   │   └── rewards.js          # BLOBI balance + trustline
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
| GET | `/api/auth/profile/:nickname` | Public player profile |
| POST | `/api/scores` | Submit score (includes weekly rank) |
| GET | `/api/leaderboard/:period` | Get leaderboard (daily/weekly/all) |
| POST | `/api/wallet/challenge` | Get wallet signing challenge |
| POST | `/api/wallet/verify` | Verify wallet signature |
| DELETE | `/api/wallet` | Disconnect wallet |
| GET | `/api/cards/:id` | Get card details |
| GET | `/api/cards` | List cards (filter by effect/owner) |
| POST | `/api/cards/claim` | Claim card (gameplay) |
| GET | `/api/cards/supply/info` | Card supply info |
| GET | `/api/rewards/balance/:wallet` | Get BLOBI balance |
| GET | `/api/rewards/info` | Weekly rewards info |
| POST | `/api/rewards/trustline-xdr` | Build trustline transaction |
| GET | `/api/health` | Health check |

## Weekly Reward Distribution

Top 10 eligible players (wallet connected + BLOBI trustline) receive weekly BLOBI rewards:

| Rank | BLOBI |
|------|-------|
| #1 | 300 |
| #2 | 200 |
| #3 | 150 |
| #4-5 | 100 |
| #6-10 | 50 |

Auto-distributed every Sunday 00:00 UTC. Players without wallet or trustline are skipped; rewards shift to next eligible player.

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
HOT_WALLET_PUBLIC=your-hot-wallet-public-key
HOT_WALLET_SECRET=your-hot-wallet-secret-key
```

### Install & Run
```bash
cd server
npm install
node migrations/run.js
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
- [x] BLOBI token on Stellar mainnet (10M, issuer locked)
- [x] Weekly reward distribution (auto + manual)
- [x] In-game trustline prompt
- [x] Player profile pages with card collection
- [x] Reward notifications for top players

### Planned
- [ ] Soroban smart contract for card NFT ownership
- [ ] Public mint page (XLM/BLOBI payment)
- [ ] Blobi character card collection (random traits)
- [ ] Season 2 cosmic cards
- [ ] Tournament system
- [ ] Mobile PWA

## Links

- **Play**: [blobileap.com](https://blobileap.com)
- **Profile**: [blobileap.com/u/Charlie](https://blobileap.com/u/Charlie)
- **Card Verify**: [blobileap.com/card/VOID-S1-0001](https://blobileap.com/card/VOID-S1-0001)
- **Token**: [stellar.expert/BLOBI](https://stellar.expert/explorer/public/asset/BLOBI-GDSM5FTQQQDCM5AU6B5FICSCO65IPY5V2KE4TBC6PSWCDGBP3V2BLOBI)
- **Twitter**: [@blobileap](https://x.com/blobileap)

## License

MIT
