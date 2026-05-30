#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Map, Symbol, Vec, token};

// Define standard types for our AnchorVault contract

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolState {
    pub token: Address,              // Native asset representing this corridor (e.g. Stellar USDC)
    pub total_deposits: i128,         // Total USDC deposited by LPs
    pub active_draws: i128,           // Total USDC drawn by anchors
    pub reserve_balance: i128,        // Current idle USDC in the pool
    pub acc_fees_per_share: i128,    // Accumulated fees per share (scaled by 1e12 for precision)
    pub optimal_utilization: u32,     // Optimal utilization rate (in bps, e.g. 8000 = 80%)
    pub base_fee_bps: u32,            // Fee at 0% utilization (in bps, e.g. 10 = 0.10%)
    pub slope_1_bps: u32,             // Slope before optimal utilization (e.g. 40 = 0.40%)
    pub slope_2_bps: u32,             // Slope after optimal utilization (e.g. 500 = 5.00%)
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnchorState {
    pub is_registered: bool,
    pub credit_limit: i128,
    pub active_draw: i128,
    pub reputation_score: u32,       // 0 to 1000 representing credit history
    pub last_draw_timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LPState {
    pub shares: i128,
    pub fee_debt: i128,              // Track distributed fees to LPs
}

// Data keys used for contract storage
#[contracttype]
pub enum DataKey {
    Config,
    Pool,
    Anchor(Address),
    LP(Address),
    GovernanceToken,
    InsuranceFund,
}

#[contract]
pub struct AnchorVaultContract;

#[contractimpl]
impl AnchorVaultContract {
    /// Initialize the corridor pool with asset and interest rate parameters
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        gov_token: Address,
        optimal_utilization: u32, // bps (e.g. 8000)
        base_fee_bps: u32,        // bps (e.g. 10)
        slope_1_bps: u32,         // bps (e.g. 40)
        slope_2_bps: u32,         // bps (e.g. 500)
    ) {
        if env.storage().instance().has(&DataKey::Pool) {
            panic!("Already initialized");
        }
        
        let pool = PoolState {
            token,
            total_deposits: 0,
            active_draws: 0,
            reserve_balance: 0,
            acc_fees_per_share: 0,
            optimal_utilization,
            base_fee_bps,
            slope_1_bps,
            slope_2_bps,
        };
        
        env.storage().instance().set(&DataKey::Pool, &pool);
        env.storage().instance().set(&DataKey::GovernanceToken, &gov_token);
        env.storage().instance().set(&DataKey::InsuranceFund, &0i128);
    }

    /// Deposit stablecoin (e.g. USDC) into the corridor pool
    pub fn deposit(env: Env, lp: Address, amount: i128) -> i128 {
        lp.require_auth();
        
        let mut pool: PoolState = env.storage().instance().get(&DataKey::Pool).unwrap();
        let token_client = token::Client::new(&env, &pool.token);
        
        // Transfer funds from LP to contract
        token_client.transfer(&lp, &env.current_contract_address(), &amount);
        
        // Calculate shares to mint
        let shares = if pool.total_deposits == 0 {
            amount
        } else {
            (amount * pool.total_deposits) / (pool.reserve_balance + pool.active_draws)
        };
        
        // Update LP state
        let mut lp_state: LPState = env
            .storage()
            .persistent()
            .get(&DataKey::LP(lp.clone()))
            .unwrap_or(LPState { shares: 0, fee_debt: 0 });
            
        // Distribute pending yield before modifying shares
        if lp_state.shares > 0 {
            let pending_fee = ((lp_state.shares * pool.acc_fees_per_share) / 1_000_000_000_000i128) - lp_state.fee_debt;
            if pending_fee > 0 {
                token_client.transfer(&env.current_contract_address(), &lp, &pending_fee);
            }
        }
        
        lp_state.shares += shares;
        lp_state.fee_debt = (lp_state.shares * pool.acc_fees_per_share) / 1_000_000_000_000i128;
        
        // Update Pool state
        pool.total_deposits += amount;
        pool.reserve_balance += amount;
        
        env.storage().persistent().set(&DataKey::LP(lp), &lp_state);
        env.storage().instance().set(&DataKey::Pool, &pool);
        
        shares
    }

    /// Withdraw deposited stablecoin and earned yield from the pool
    pub fn withdraw(env: Env, lp: Address, shares: i128) -> i128 {
        lp.require_auth();
        
        let mut pool: PoolState = env.storage().instance().get(&DataKey::Pool).unwrap();
        let mut lp_state: LPState = env
            .storage()
            .persistent()
            .get(&DataKey::LP(lp.clone()))
            .unwrap_or(LPState { shares: 0, fee_debt: 0 });
            
        if lp_state.shares < shares {
            panic!("Insufficient share balance");
        }
        
        // Calculate corresponding stablecoin amount
        let total_pool_value = pool.reserve_balance + pool.active_draws;
        let amount = (shares * total_pool_value) / pool.total_deposits;
        
        if amount > pool.reserve_balance {
            panic!("High pool utilization: cannot withdraw fully until anchors repay");
        }
        
        let token_client = token::Client::new(&env, &pool.token);
        
        // Distribute pending yield
        let pending_fee = ((lp_state.shares * pool.acc_fees_per_share) / 1_000_000_000_000i128) - lp_state.fee_debt;
        if pending_fee > 0 {
            token_client.transfer(&env.current_contract_address(), &lp, &pending_fee);
        }
        
        lp_state.shares -= shares;
        lp_state.fee_debt = (lp_state.shares * pool.acc_fees_per_share) / 1_000_000_000_000i128;
        
        pool.total_deposits -= amount;
        pool.reserve_balance -= amount;
        
        // Transfer assets back to LP
        token_client.transfer(&env.current_contract_address(), &lp, &amount);
        
        env.storage().persistent().set(&DataKey::LP(lp), &lp_state);
        env.storage().instance().set(&DataKey::Pool, &pool);
        
        amount
    }

    /// Anchors draw liquidity from the pool to fulfill instant settlement
    pub fn draw_liquidity(env: Env, anchor: Address, amount: i128) {
        anchor.require_auth();
        
        let mut anchor_state: AnchorState = env
            .storage()
            .persistent()
            .get(&DataKey::Anchor(anchor.clone()))
            .expect("Anchor not registered");
            
        if !anchor_state.is_registered {
            panic!("Anchor is not whitelisted");
        }
        
        if anchor_state.active_draw + amount > anchor_state.credit_limit {
            panic!("Draw exceeds anchor credit limit");
        }
        
        let mut pool: PoolState = env.storage().instance().get(&DataKey::Pool).unwrap();
        if amount > pool.reserve_balance {
            panic!("Insufficient reserve liquidity in this corridor pool");
        }
        
        // Transfer assets to anchor for payout settlement
        let token_client = token::Client::new(&env, &pool.token);
        token_client.transfer(&env.current_contract_address(), &anchor, &amount);
        
        // Update anchor and pool states
        anchor_state.active_draw += amount;
        anchor_state.last_draw_timestamp = env.ledger().timestamp();
        
        pool.active_draws += amount;
        pool.reserve_balance -= amount;
        
        env.storage().persistent().set(&DataKey::Anchor(anchor), &anchor_state);
        env.storage().instance().set(&DataKey::Pool, &pool);
    }

    /// Repay liquidity drawn + pay the utilization-based settlement fee
    pub fn repay_liquidity(env: Env, anchor: Address, principal: i128) {
        anchor.require_auth();
        
        let mut anchor_state: AnchorState = env
            .storage()
            .persistent()
            .get(&DataKey::Anchor(anchor.clone()))
            .expect("Anchor not registered");
            
        if anchor_state.active_draw < principal {
            panic!("Repaying more than active draw amount");
        }
        
        let mut pool: PoolState = env.storage().instance().get(&DataKey::Pool).unwrap();
        
        // Calculate settlement fee based on pool utilization at repayment
        let utilization = self::calculate_utilization(&pool);
        let mut fee_rate_bps = self::calculate_fee_rate(&pool, utilization);
        
        // Apply Reputation-based Interest Discount/Premium
        // Standard score is 800. Perfect score is 1000.
        // High reputation (>900) gets up to a 25% discount.
        // Low reputation (<600) gets up to a 50% penalty to cover credit risk premium.
        if anchor_state.reputation_score > 900 {
            let discount_pct = (anchor_state.reputation_score - 900) / 4; // Max 25% discount
            fee_rate_bps = (fee_rate_bps * (100 - discount_pct)) / 100;
        } else if anchor_state.reputation_score < 600 {
            let penalty_pct = (600 - anchor_state.reputation_score) / 8; // Max 50% penalty
            fee_rate_bps = (fee_rate_bps * (100 + penalty_pct)) / 100;
        }
        
        // Fee = principal * fee_rate_bps / 10000
        let fee = (principal * fee_rate_bps as i128) / 10000i128;
        let total_repay = principal + fee;
        
        let token_client = token::Client::new(&env, &pool.token);
        // Transfer principal + fees back from anchor
        token_client.transfer(&anchor, &env.current_contract_address(), &total_repay);
        
        // Fee distribution: 90% to LPs, 5% to Insurance Fund, 5% to Treasury (simulated here)
        let lp_fee_share = (fee * 90) / 100;
        let insurance_share = (fee * 5) / 100;
        
        let mut insurance_fund: i128 = env.storage().instance().get(&DataKey::InsuranceFund).unwrap_or(0);
        insurance_fund += insurance_share;
        env.storage().instance().set(&DataKey::InsuranceFund, &insurance_fund);
        
        // Increase accumulated fees per share (scaled by 1e12 for fractional precision)
        if pool.total_deposits > 0 {
            pool.acc_fees_per_share += (lp_fee_share * 1_000_000_000_000i128) / pool.total_deposits;
        }
        
        // Update anchor record
        anchor_state.active_draw -= principal;
        
        // Reward faster/timely repayments by boosting reputation score dynamically based on duration
        let elapsed = env.ledger().timestamp().saturating_sub(anchor_state.last_draw_timestamp);
        let reputation_boost = if elapsed <= 86400 {
            25 // Speed boost for under 24 hours turnaround
        } else if elapsed <= 259200 {
            15 // fast payment boost under 3 days
        } else {
            5 // Standard boost
        };
        
        if anchor_state.reputation_score < 1000 {
            anchor_state.reputation_score = (anchor_state.reputation_score + reputation_boost).min(1000);
        }
        
        pool.active_draws -= principal;
        pool.reserve_balance += principal + fee; // fee remains in reserves to be claimed by LPs
        
        env.storage().persistent().set(&DataKey::Anchor(anchor), &anchor_state);
        env.storage().instance().set(&DataKey::Pool, &pool);
    }
 
    /// Register/whitelist an anchor with standard credit limit (Governance task)
    pub fn register_anchor(env: Env, admin: Address, anchor: Address, credit_limit: i128) {
        // In full impl, check admin signature
        admin.require_auth();
        
        let anchor_state = AnchorState {
            is_registered: true,
            credit_limit,
            active_draw: 0,
            reputation_score: 800, // Starts at a healthy 80% default score
            last_draw_timestamp: 0,
        };
        
        env.storage().persistent().set(&DataKey::Anchor(anchor), &anchor_state);
    }
 
    /// Update anchor credit limit based on score (Governance/Risk Management)
    pub fn adjust_credit_limit(env: Env, admin: Address, anchor: Address, new_limit: i128) {
        admin.require_auth();
        let mut state: AnchorState = env.storage().persistent().get(&DataKey::Anchor(anchor.clone())).expect("Anchor not registered");
        state.credit_limit = new_limit;
        env.storage().persistent().set(&DataKey::Anchor(anchor), &state);
    }

    /// Offset toxic/bad debt of a defaulted anchor using the accumulated Insurance Fund reserves.
    /// This keeps LP pools safe and protects liquidity from catastrophic failures.
    pub fn offset_defaulted_debt(env: Env, admin: Address, anchor: Address) {
        admin.require_auth();
        
        let mut anchor_state: AnchorState = env
            .storage()
            .persistent()
            .get(&DataKey::Anchor(anchor.clone()))
            .expect("Anchor not registered");
            
        if anchor_state.active_draw == 0 {
            panic!("No active draw to offset");
        }
        
        // Debt can only be offset if the anchor has defaulted (extreme low reputation < 450)
        if anchor_state.reputation_score >= 450 {
            panic!("Anchor reputation is still healthy; cannot offset active debt yet");
        }
        
        let mut pool: PoolState = env.storage().instance().get(&DataKey::Pool).unwrap();
        let mut insurance_fund: i128 = env.storage().instance().get(&DataKey::InsuranceFund).unwrap_or(0);
        
        // Amount to offset is the active draw or up to the insurance fund size
        let offset_amount = anchor_state.active_draw.min(insurance_fund);
        if offset_amount == 0 {
            panic!("Insurance fund is empty");
        }
        
        insurance_fund -= offset_amount;
        anchor_state.active_draw -= offset_amount;
        pool.active_draws -= offset_amount;
        
        // The offset amount remains in the reserve pool to restore LPs' withdrawable USDC liquidity
        pool.reserve_balance += offset_amount;
        
        env.storage().instance().set(&DataKey::InsuranceFund, &insurance_fund);
        env.storage().persistent().set(&DataKey::Anchor(anchor), &anchor_state);
        env.storage().instance().set(&DataKey::Pool, &pool);
    }

    // --- View Functions ---

    pub fn get_pool_state(env: Env) -> PoolState {
        env.storage().instance().get(&DataKey::Pool).unwrap()
    }

    pub fn get_anchor_state(env: Env, anchor: Address) -> AnchorState {
        env.storage().persistent().get(&DataKey::Anchor(anchor)).unwrap_or(AnchorState {
            is_registered: false,
            credit_limit: 0,
            active_draw: 0,
            reputation_score: 0,
            last_draw_timestamp: 0,
        })
    }

    pub fn get_lp_state(env: Env, lp: Address) -> LPState {
        env.storage().persistent().get(&DataKey::LP(lp)).unwrap_or(LPState { shares: 0, fee_debt: 0 })
    }

    pub fn get_pending_yield(env: Env, lp: Address) -> i128 {
        let pool: PoolState = env.storage().instance().get(&DataKey::Pool).unwrap();
        let lp_state: LPState = env.storage().persistent().get(&DataKey::LP(lp)).unwrap_or(LPState { shares: 0, fee_debt: 0 });
        if lp_state.shares == 0 {
            0
        } else {
            ((lp_state.shares * pool.acc_fees_per_share) / 1_000_000_000_000i128) - lp_state.fee_debt
        }
    }
}

// Internal utility helper methods (not exposed as contract functions)
fn calculate_utilization(pool: &PoolState) -> u32 {
    let total_capital = pool.reserve_balance + pool.active_draws;
    if total_capital == 0 {
        return 0;
    }
    // Return bps (e.g. active / total * 10000)
    ((pool.active_draws * 10000) / total_capital) as u32
}

fn calculate_fee_rate(pool: &PoolState, utilization: u32) -> u32 {
    if utilization <= pool.optimal_utilization {
        // R = R_base + (U / U_optimal) * R_slope1
        let ratio = (utilization * 10000) / pool.optimal_utilization;
        pool.base_fee_bps + (((ratio as u64 * pool.slope_1_bps as u64) / 10000) as u32)
    } else {
        // R = R_base + R_slope1 + ((U - U_optimal) / (10000 - U_optimal)) * R_slope2
        let excess_ratio = ((utilization - pool.optimal_utilization) * 10000) / (10000 - pool.optimal_utilization);
        pool.base_fee_bps + pool.slope_1_bps + (((excess_ratio as u64 * pool.slope_2_bps as u64) / 10000) as u32)
    }
}
