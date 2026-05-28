#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, Symbol, symbol_short};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub name: Symbol,
    pub symbol: Symbol,
    pub decimals: u32,
}

#[contracttype]
pub enum StorageKey {
    Metadata,
    Admin,
    Balance(Address),
    Allowance(Address, Address), // (owner, spender)
}

#[contract]
pub struct VaultTokenContract;

#[contractimpl]
impl VaultTokenContract {
    /// Initialize the vault share token
    pub fn initialize(env: Env, admin: Address, name: Symbol, symbol: Symbol) {
        if env.storage().instance().has(&StorageKey::Admin) {
            panic!("Already initialized");
        }

        env.storage().instance().set(&StorageKey::Admin, &admin);
        
        let metadata = TokenMetadata {
            name,
            symbol,
            decimals: 7, // Stellar standard stable decimals
        };
        env.storage().instance().set(&StorageKey::Metadata, &metadata);
    }

    /// Mint new share tokens for LPs (Only callable by Vault pool)
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&StorageKey::Admin).unwrap();
        admin.require_auth();

        let mut balance = self::get_balance(&env, &to);
        balance += amount;
        
        env.storage().persistent().set(&StorageKey::Balance(to), &balance);
    }

    /// Burn share tokens on LP withdrawal (Only callable by Vault pool)
    pub fn burn(env: Env, from: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&StorageKey::Admin).unwrap();
        admin.require_auth();

        let mut balance = self::get_balance(&env, &from);
        if balance < amount {
            panic!("Burn amount exceeds balance");
        }
        balance -= amount;
        
        env.storage().persistent().set(&StorageKey::Balance(from), &balance);
    }

    /// Standard transfer of share tokens
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let mut from_balance = self::get_balance(&env, &from);
        if from_balance < amount {
            panic!("Transfer amount exceeds balance");
        }

        let mut to_balance = self::get_balance(&env, &to);

        from_balance -= amount;
        to_balance += amount;

        env.storage().persistent().set(&StorageKey::Balance(from), &from_balance);
        env.storage().persistent().set(&StorageKey::Balance(to), &to_balance);
    }

    /// Standard approve allowance
    pub fn approve(env: Env, from: Address, spender: Address, amount: i128) {
        from.require_auth();
        env.storage().persistent().set(&StorageKey::Allowance(from, spender), &amount);
    }

    /// Transfer from helper
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        let mut allowance = self::get_allowance(&env, &from, &spender);
        if allowance < amount {
            panic!("Transfer exceeds allowance");
        }

        let mut from_balance = self::get_balance(&env, &from);
        if from_balance < amount {
            panic!("Transfer amount exceeds balance");
        }

        let mut to_balance = self::get_balance(&env, &to);

        allowance -= amount;
        from_balance -= amount;
        to_balance += amount;

        env.storage().persistent().set(&StorageKey::Allowance(from.clone(), spender), &allowance);
        env.storage().persistent().set(&StorageKey::Balance(from), &from_balance);
        env.storage().persistent().set(&StorageKey::Balance(to), &to_balance);
    }

    // --- View Functions ---

    pub fn balance_of(env: Env, id: Address) -> i128 {
        self::get_balance(&env, &id)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        self::get_allowance(&env, &from, &spender)
    }

    pub fn metadata(env: Env) -> TokenMetadata {
        env.storage().instance().get(&StorageKey::Metadata).unwrap()
    }
}

// Helpers
fn get_balance(env: &Env, id: &Address) -> i128 {
    env.storage().persistent().get::<_, i128>(&StorageKey::Balance(id.clone())).unwrap_or(0)
}

fn get_allowance(env: &Env, from: &Address, spender: &Address) -> i128 {
    env.storage().persistent().get::<_, i128>(&StorageKey::Allowance(from.clone(), spender.clone())).unwrap_or(0)
}
