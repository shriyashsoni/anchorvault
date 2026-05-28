#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, token};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegistryConfig {
    pub admin: Address,
    pub vault_token: Address, // Governance token ($VAULT) used as collateral
    pub min_collateral_ratio_bps: u32, // e.g. 1000 = 10% collateral of credit line
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnchorRecord {
    pub is_whitelisted: bool,
    pub credit_limit: i128,
    pub reputation_score: u32,  // 0 to 1000 representing credit quality
    pub locked_collateral: i128, // Amount of $VAULT locked
    pub first_registered: u64,
}

#[contracttype]
pub enum StorageKey {
    Config,
    Anchor(Address),
}

#[contract]
pub struct AnchorRegistryContract;

#[contractimpl]
impl AnchorRegistryContract {
    /// Initialize the anchor registry with governance details
    pub fn initialize(
        env: Env,
        admin: Address,
        vault_token: Address,
        min_collateral_ratio_bps: u32,
    ) {
        if env.storage().instance().has(&StorageKey::Config) {
            panic!("Already initialized");
        }
        
        let config = RegistryConfig {
            admin,
            vault_token,
            min_collateral_ratio_bps,
        };
        
        env.storage().instance().set(&StorageKey::Config, &config);
    }

    /// Whitelist a new anchor and set their initial credit limit
    pub fn register_anchor(
        env: Env,
        admin: Address,
        anchor: Address,
        credit_limit: i128,
    ) {
        let config: RegistryConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        config.admin.require_auth();
        admin.require_auth();

        if env.storage().persistent().has(&StorageKey::Anchor(anchor.clone())) {
            panic!("Anchor already registered");
        }

        let record = AnchorRecord {
            is_whitelisted: true,
            credit_limit,
            reputation_score: 800, // Starts at 80% healthy rating
            locked_collateral: 0,
            first_registered: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&StorageKey::Anchor(anchor), &record);
    }

    /// Lock collateral ($VAULT token) to activate or increase credit capability
    pub fn lock_collateral(env: Env, anchor: Address, amount: i128) {
        anchor.require_auth();

        let config: RegistryConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        let mut record: AnchorRecord = env
            .storage()
            .persistent()
            .get(&StorageKey::Anchor(anchor.clone()))
            .expect("Anchor not whitelisted");

        // Transfer $VAULT from anchor to registry
        let token_client = token::Client::new(&env, &config.vault_token);
        token_client.transfer(&anchor, &env.current_contract_address(), &amount);

        record.locked_collateral += amount;

        // Check if collateral ratio is met (Collateral Value must be >= Credit * min_ratio)
        let min_required = (record.credit_limit * config.min_collateral_ratio_bps as i128) / 10000;
        if record.locked_collateral < min_required {
            // Keep it allowed, but might mark reputation or trigger warning
        }

        env.storage().persistent().set(&StorageKey::Anchor(anchor), &record);
    }

    /// Release staked collateral back to anchor if they have paid active borrows in full
    pub fn release_collateral(env: Env, anchor: Address, amount: i128) {
        anchor.require_auth();

        let config: RegistryConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        let mut record: AnchorRecord = env
            .storage()
            .persistent()
            .get(&StorageKey::Anchor(anchor.clone()))
            .expect("Anchor not whitelisted");

        if record.locked_collateral < amount {
            panic!("Insufficient locked collateral");
        }

        // Check if remaining collateral satisfies minimum requirements
        let remaining_collateral = record.locked_collateral - amount;
        let min_required = (record.credit_limit * config.min_collateral_ratio_bps as i128) / 10000;
        if remaining_collateral < min_required {
            panic!("Cannot release: Collateral ratio falls below minimum requirement");
        }

        // Transfer $VAULT back to anchor
        let token_client = token::Client::new(&env, &config.vault_token);
        token_client.transfer(&env.current_contract_address(), &anchor, &amount);

        record.locked_collateral = remaining_collateral;
        env.storage().persistent().set(&StorageKey::Anchor(anchor), &record);
    }

    /// Slashes anchor collateral in case of major default (Governance action)
    pub fn slash_collateral(env: Env, admin: Address, anchor: Address, slash_amount: i128, treasury: Address) {
        let config: RegistryConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        config.admin.require_auth();
        admin.require_auth();

        let mut record: AnchorRecord = env
            .storage()
            .persistent()
            .get(&StorageKey::Anchor(anchor.clone()))
            .expect("Anchor not registered");

        let actual_slash = record.locked_collateral.min(slash_amount);
        record.locked_collateral -= actual_slash;
        record.reputation_score = (record.reputation_score as i32 - 300).max(0) as u32; // Major hit

        // Send slashed $VAULT to protocol insurance treasury or burn it
        let token_client = token::Client::new(&env, &config.vault_token);
        token_client.transfer(&env.current_contract_address(), &treasury, &actual_slash);

        env.storage().persistent().set(&StorageKey::Anchor(anchor), &record);
    }

    /// Reward or penalize anchor reputation based on payment history
    pub fn update_reputation(env: Env, updater: Address, anchor: Address, delta: i32) {
        // Updater would be whitelisted corridor pool address or admin
        updater.require_auth();

        let mut record: AnchorRecord = env
            .storage()
            .persistent()
            .get(&StorageKey::Anchor(anchor.clone()))
            .expect("Anchor not registered");

        let mut new_score = record.reputation_score as i32 + delta;
        if new_score > 1000 { new_score = 1000; }
        if new_score < 0 { new_score = 0; }

        record.reputation_score = new_score as u32;

        // Auto-scale credit limit up or down depending on reputation drops
        if record.reputation_score < 500 {
            record.credit_limit = (record.credit_limit * 80) / 100; // 20% limit cut for bad score
        }

        env.storage().persistent().set(&StorageKey::Anchor(anchor), &record);
    }

    // --- Viewers ---

    pub fn get_anchor(env: Env, anchor: Address) -> AnchorRecord {
        env.storage().persistent().get(&StorageKey::Anchor(anchor)).unwrap()
    }

    pub fn is_whitelisted(env: Env, anchor: Address) -> bool {
        if let Some(record) = env.storage().persistent().get::<_, AnchorRecord>(&StorageKey::Anchor(anchor)) {
            record.is_whitelisted
        } else {
            false
        }
    }
}
