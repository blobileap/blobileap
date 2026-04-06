#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, Map, String,
    Vec,
};

// ============================================================
//  Blobi Leap — Soroban Smart Contract
//  Features:
//    1. On-chain score registry (daily / all-time leaderboards)
//    2. Cosmic Card NFT minting (5 rarities)
//    3. XLM reward pool for top players
//    4. Admin controls for tournament seasons
// ============================================================

// ---------- Data Types ----------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CardRarity {
    Star,      // Shooting Star  — common
    Bolt,      // Lightning Bolt — uncommon
    Ship,      // Stellar Rocket — rare
    Void,      // Black Hole     — epic
    Aura,      // Aurora Borealis — legendary
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct ScoreEntry {
    pub player: Address,
    pub nickname: String,
    pub score: u32,
    pub speed: u32,       // x100 (e.g. 250 = 2.5x)
    pub near_miss: u32,
    pub best_combo: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CosmicCard {
    pub id: u64,
    pub owner: Address,
    pub rarity: CardRarity,
    pub minted_at: u64,
    pub score_at_mint: u32,
    pub game_number: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Season {
    pub id: u32,
    pub start: u64,
    pub end: u64,
    pub reward_pool: i128,
    pub active: bool,
}

// ---------- Storage Keys ----------

#[contracttype]
pub enum DataKey {
    Admin,
    // Scores
    BestScore(Address),       // player -> best ScoreEntry
    Leaderboard,              // Vec<ScoreEntry> top 100
    TotalGames,               // u64
    // Cards
    CardCounter,              // u64 auto-increment
    Card(u64),                // card_id -> CosmicCard
    PlayerCards(Address),     // player -> Vec<u64> card IDs
    CardSupply(CardRarity),   // rarity -> total minted
    // Seasons
    CurrentSeason,            // Season
    SeasonScores(u32),        // season_id -> Vec<ScoreEntry>
    // Reward token
    RewardToken,              // Address of XLM or custom token
}

// ---------- Max Supplies per Rarity ----------

fn max_supply(rarity: &CardRarity) -> u64 {
    match rarity {
        CardRarity::Star => 10_000,
        CardRarity::Bolt => 5_000,
        CardRarity::Ship => 2_000,
        CardRarity::Void => 500,
        CardRarity::Aura => 100,
    }
}

// ---------- Contract ----------

#[contract]
pub struct BlobiLeapContract;

#[contractimpl]
impl BlobiLeapContract {
    // ========== INITIALIZE ==========

    /// Initialize the contract with admin address and optional reward token
    pub fn initialize(env: Env, admin: Address, reward_token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RewardToken, &reward_token);
        env.storage().instance().set(&DataKey::CardCounter, &0u64);
        env.storage().instance().set(&DataKey::TotalGames, &0u64);
    }

    // ========== SCORE SUBMISSION ==========

    /// Submit a verified score (called by backend oracle with admin auth)
    pub fn submit_score(
        env: Env,
        admin: Address,
        player: Address,
        nickname: String,
        score: u32,
        speed: u32,
        near_miss: u32,
        best_combo: u32,
    ) {
        // Only admin (backend oracle) can submit verified scores
        Self::require_admin(&env, &admin);

        let timestamp = env.ledger().timestamp();

        let entry = ScoreEntry {
            player: player.clone(),
            nickname,
            score,
            speed,
            near_miss,
            best_combo,
            timestamp,
        };

        // Update personal best
        let key = DataKey::BestScore(player.clone());
        let should_update = if let Some(existing) = env
            .storage()
            .persistent()
            .get::<DataKey, ScoreEntry>(&key)
        {
            score > existing.score
        } else {
            true
        };

        if should_update {
            env.storage().persistent().set(&key, &entry);
        }

        // Update global leaderboard (top 100)
        Self::update_leaderboard(&env, &entry);

        // Update season leaderboard if active
        if let Some(season) = env
            .storage()
            .instance()
            .get::<DataKey, Season>(&DataKey::CurrentSeason)
        {
            if season.active && timestamp >= season.start && timestamp <= season.end {
                Self::update_season_leaderboard(&env, season.id, &entry);
            }
        }

        // Increment total games
        let total: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalGames)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalGames, &(total + 1));

        env.events().publish(
            (symbol_short!("score"), player),
            (score, speed),
        );
    }

    // ========== COSMIC CARD MINTING ==========

    /// Mint a cosmic card NFT for a player who witnessed a cosmic event
    pub fn mint_card(
        env: Env,
        admin: Address,
        player: Address,
        rarity: CardRarity,
        score_at_mint: u32,
        game_number: u32,
    ) -> u64 {
        Self::require_admin(&env, &admin);

        // Check supply cap
        let supply: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::CardSupply(rarity.clone()))
            .unwrap_or(0);
        if supply >= max_supply(&rarity) {
            panic!("Card supply exhausted for this rarity");
        }

        // Auto-increment card ID
        let card_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CardCounter)
            .unwrap_or(0)
            + 1;
        env.storage().instance().set(&DataKey::CardCounter, &card_id);

        let card = CosmicCard {
            id: card_id,
            owner: player.clone(),
            rarity: rarity.clone(),
            minted_at: env.ledger().timestamp(),
            score_at_mint,
            game_number,
        };

        // Store card
        env.storage().persistent().set(&DataKey::Card(card_id), &card);

        // Add to player's collection
        let player_key = DataKey::PlayerCards(player.clone());
        let mut player_cards: Vec<u64> = env
            .storage()
            .persistent()
            .get(&player_key)
            .unwrap_or(Vec::new(&env));
        player_cards.push_back(card_id);
        env.storage().persistent().set(&player_key, &player_cards);

        // Increment supply
        env.storage()
            .persistent()
            .set(&DataKey::CardSupply(rarity.clone()), &(supply + 1));

        env.events().publish(
            (symbol_short!("mint"), player),
            (card_id, rarity),
        );

        card_id
    }

    /// Transfer a cosmic card to another player
    pub fn transfer_card(env: Env, from: Address, to: Address, card_id: u64) {
        from.require_auth();

        let card_key = DataKey::Card(card_id);
        let mut card: CosmicCard = env
            .storage()
            .persistent()
            .get(&card_key)
            .expect("Card not found");

        if card.owner != from {
            panic!("Not card owner");
        }

        // Remove from sender
        let from_key = DataKey::PlayerCards(from.clone());
        let mut from_cards: Vec<u64> = env
            .storage()
            .persistent()
            .get(&from_key)
            .unwrap_or(Vec::new(&env));
        if let Some(idx) = from_cards.iter().position(|c| c == card_id) {
            from_cards.remove(idx as u32);
        }
        env.storage().persistent().set(&from_key, &from_cards);

        // Add to receiver
        let to_key = DataKey::PlayerCards(to.clone());
        let mut to_cards: Vec<u64> = env
            .storage()
            .persistent()
            .get(&to_key)
            .unwrap_or(Vec::new(&env));
        to_cards.push_back(card_id);
        env.storage().persistent().set(&to_key, &to_cards);

        // Update owner
        card.owner = to.clone();
        env.storage().persistent().set(&card_key, &card);

        env.events().publish(
            (symbol_short!("transfer"), from),
            (card_id, to),
        );
    }

    // ========== SEASON / TOURNAMENT ==========

    /// Start a new season with a reward pool
    pub fn start_season(
        env: Env,
        admin: Address,
        season_id: u32,
        duration_secs: u64,
        reward_pool: i128,
    ) {
        Self::require_admin(&env, &admin);

        let now = env.ledger().timestamp();
        let season = Season {
            id: season_id,
            start: now,
            end: now + duration_secs,
            reward_pool,
            active: true,
        };

        env.storage().instance().set(&DataKey::CurrentSeason, &season);
        env.storage()
            .persistent()
            .set(&DataKey::SeasonScores(season_id), &Vec::<ScoreEntry>::new(&env));
    }

    /// End season and distribute rewards to top 3
    pub fn end_season(env: Env, admin: Address) {
        Self::require_admin(&env, &admin);

        let mut season: Season = env
            .storage()
            .instance()
            .get(&DataKey::CurrentSeason)
            .expect("No active season");

        season.active = false;
        env.storage().instance().set(&DataKey::CurrentSeason, &season);

        // Get season leaderboard
        let scores: Vec<ScoreEntry> = env
            .storage()
            .persistent()
            .get(&DataKey::SeasonScores(season.id))
            .unwrap_or(Vec::new(&env));

        if scores.is_empty() || season.reward_pool <= 0 {
            return;
        }

        // Distribute: 50% to #1, 30% to #2, 20% to #3
        let reward_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::RewardToken)
            .expect("No reward token set");

        let client = token::Client::new(&env, &reward_token);
        let contract_addr = env.current_contract_address();
        let shares: [i128; 3] = [50, 30, 20];

        let top_count = scores.len().min(3);
        for i in 0..top_count {
            let entry = scores.get(i).unwrap();
            let reward = season.reward_pool * shares[i as usize] / 100;
            if reward > 0 {
                client.transfer(&contract_addr, &entry.player, &reward);
            }
        }

        env.events().publish(
            (symbol_short!("season"),),
            (season.id, symbol_short!("ended")),
        );
    }

    // ========== VIEW FUNCTIONS ==========

    /// Get a player's best score
    pub fn get_best(env: Env, player: Address) -> Option<ScoreEntry> {
        env.storage()
            .persistent()
            .get(&DataKey::BestScore(player))
    }

    /// Get global top 100 leaderboard
    pub fn get_leaderboard(env: Env) -> Vec<ScoreEntry> {
        env.storage()
            .persistent()
            .get(&DataKey::Leaderboard)
            .unwrap_or(Vec::new(&env))
    }

    /// Get a specific card
    pub fn get_card(env: Env, card_id: u64) -> Option<CosmicCard> {
        env.storage().persistent().get(&DataKey::Card(card_id))
    }

    /// Get all cards owned by a player
    pub fn get_player_cards(env: Env, player: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::PlayerCards(player))
            .unwrap_or(Vec::new(&env))
    }

    /// Get total minted supply for a rarity
    pub fn get_card_supply(env: Env, rarity: CardRarity) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::CardSupply(rarity))
            .unwrap_or(0)
    }

    /// Get total games played globally
    pub fn get_total_games(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TotalGames)
            .unwrap_or(0)
    }

    /// Get current season info
    pub fn get_season(env: Env) -> Option<Season> {
        env.storage().instance().get(&DataKey::CurrentSeason)
    }

    // ========== INTERNAL HELPERS ==========

    fn require_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        if *caller != admin {
            panic!("Unauthorized");
        }
    }

    fn update_leaderboard(env: &Env, entry: &ScoreEntry) {
        let key = DataKey::Leaderboard;
        let mut lb: Vec<ScoreEntry> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));

        // Remove existing entry for same player (keep only best)
        let mut remove_idx: Option<u32> = None;
        for i in 0..lb.len() {
            if let Some(existing) = lb.get(i) {
                if existing.player == entry.player {
                    if entry.score <= existing.score {
                        return; // existing score is higher, skip
                    }
                    remove_idx = Some(i);
                    break;
                }
            }
        }
        if let Some(idx) = remove_idx {
            lb.remove(idx);
        }

        // Insert in sorted position (descending by score)
        let mut inserted = false;
        for i in 0..lb.len() {
            if let Some(existing) = lb.get(i) {
                if entry.score > existing.score {
                    lb.insert(i, entry.clone());
                    inserted = true;
                    break;
                }
            }
        }
        if !inserted {
            lb.push_back(entry.clone());
        }

        // Keep only top 100
        while lb.len() > 100 {
            lb.pop_back();
        }

        env.storage().persistent().set(&key, &lb);
    }

    fn update_season_leaderboard(env: &Env, season_id: u32, entry: &ScoreEntry) {
        let key = DataKey::SeasonScores(season_id);
        let mut lb: Vec<ScoreEntry> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));

        // Same logic as global leaderboard
        let mut remove_idx: Option<u32> = None;
        for i in 0..lb.len() {
            if let Some(existing) = lb.get(i) {
                if existing.player == entry.player {
                    if entry.score <= existing.score {
                        return;
                    }
                    remove_idx = Some(i);
                    break;
                }
            }
        }
        if let Some(idx) = remove_idx {
            lb.remove(idx);
        }

        let mut inserted = false;
        for i in 0..lb.len() {
            if let Some(existing) = lb.get(i) {
                if entry.score > existing.score {
                    lb.insert(i, entry.clone());
                    inserted = true;
                    break;
                }
            }
        }
        if !inserted {
            lb.push_back(entry.clone());
        }

        while lb.len() > 50 {
            lb.pop_back();
        }

        env.storage().persistent().set(&key, &lb);
    }
}

// ---------- Tests ----------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_initialize_and_submit() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, BlobiLeapContract);
        let client = BlobiLeapContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        client.initialize(&admin, &token);

        let player = Address::generate(&env);
        let nick = String::from_str(&env, "blobi_fan");

        client.submit_score(&admin, &player, &nick, &42, &150, &5, &3);

        let best = client.get_best(&player).unwrap();
        assert_eq!(best.score, 42);
        assert_eq!(best.speed, 150);

        let lb = client.get_leaderboard();
        assert_eq!(lb.len(), 1);
        assert_eq!(lb.get(0).unwrap().score, 42);

        assert_eq!(client.get_total_games(), 1);
    }

    #[test]
    fn test_mint_and_transfer_card() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, BlobiLeapContract);
        let client = BlobiLeapContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        client.initialize(&admin, &token);

        let player1 = Address::generate(&env);
        let player2 = Address::generate(&env);

        // Mint a Star card
        let card_id = client.mint_card(&admin, &player1, &CardRarity::Star, &50, &10);
        assert_eq!(card_id, 1);

        let card = client.get_card(&1).unwrap();
        assert_eq!(card.owner, player1);
        assert_eq!(card.score_at_mint, 50);

        assert_eq!(client.get_card_supply(&CardRarity::Star), 1);
        assert_eq!(client.get_player_cards(&player1).len(), 1);

        // Transfer
        client.transfer_card(&player1, &player2, &1);
        let card = client.get_card(&1).unwrap();
        assert_eq!(card.owner, player2);
        assert_eq!(client.get_player_cards(&player1).len(), 0);
        assert_eq!(client.get_player_cards(&player2).len(), 1);
    }
}
