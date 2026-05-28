/**
 * ============================================================
 *  AnchorVault — Real Soroban On-Chain Integration Service
 * ============================================================
 *  This module handles ALL blockchain interactions:
 *    • Querying contract state (pool, LP, anchors)
 *    • Querying native + token balances from Horizon
 *    • Building & submitting real Soroban transactions
 *    • Fetching real transaction history from Horizon
 * ============================================================
 */

import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  Address,
  xdr,
  nativeToScVal,
  scValToNative,
  Horizon,
  BASE_FEE,
} from "@stellar/stellar-sdk";

// ── Contract Addresses (from .env / deployed testnet) ──
export const CONTRACT_ADDRESSES = {
  USDC: "CCW67CUUZD4BYLOXPUM6UJCY34UCCIC2CC3V2F",
  GOVERNANCE_TOKEN: "CD2QZEZGUKJ3HTSJTSUMN6JKGRX5ESMEQ3KPKRIMUNJZJM5KPAYE56AN",
  ANCHOR_REGISTRY: "CBO4OV4B62OQZBYOGWCGJCHPNA3G3S5WMNAC5IUATBJ3VVWGWMF2UQ4P",
  CORE_VAULT: "CBSGI73ICTTFSGURP2QZMRXD6KBOZP5GFDNKZYZM5UXC7DK4DEU6YPT6",
};

// ── Network Config ──
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

// ── RPC + Horizon Clients ──
const sorobanServer = new rpc.Server(SOROBAN_RPC_URL);
const horizonServer = new Horizon.Server(HORIZON_URL);

// ── Types matching on-chain contract structs ──

export interface PoolState {
  totalDeposits: bigint;
  activeDraws: bigint;
  reserveBalance: bigint;
  accFeesPerShare: bigint;
  optimalUtilization: number;
  baseFeeBps: number;
  slope1Bps: number;
  slope2Bps: number;
}

export interface LPState {
  shares: bigint;
  feeDebt: bigint;
}

export interface AnchorRecord {
  isWhitelisted: boolean;
  creditLimit: bigint;
  reputationScore: number;
  lockedCollateral: bigint;
  firstRegistered: number;
}

export interface AnchorVaultState {
  isRegistered: boolean;
  creditLimit: bigint;
  activeDraw: bigint;
  reputationScore: number;
  lastDrawTimestamp: number;
}

export interface WalletBalances {
  xlm: string;
  usdc: string;
  vaultToken: string;
  lpShares: string;
}

export interface TxRecord {
  id: string;
  type: "deposit" | "withdrawal" | "settlement" | "transfer" | "contract_call";
  hash: string;
  amount: string;
  asset: string;
  from: string;
  to: string;
  timestamp: string;
  status: "success" | "failed";
  ledger: number;
  memo?: string;
}

// ──────────────────────────────────────────────────
//  BALANCE QUERIES (Real Horizon / Soroban RPC)
// ──────────────────────────────────────────────────

/**
 * Fetch real XLM + token balances for a wallet address from Horizon
 */
export async function fetchWalletBalances(publicKey: string): Promise<WalletBalances> {
  const result: WalletBalances = {
    xlm: "0",
    usdc: "0",
    vaultToken: "0",
    lpShares: "0",
  };

  try {
    const account = await horizonServer.loadAccount(publicKey);
    
    for (const balance of account.balances) {
      if (balance.asset_type === "native") {
        result.xlm = balance.balance;
      }
    }
  } catch (err: any) {
    console.warn("[Soroban] Horizon account load failed (account may not be funded):", err.message);
  }

  // Fetch SAC token balances via Soroban RPC
  try {
    result.usdc = await fetchTokenBalance(CONTRACT_ADDRESSES.USDC, publicKey);
  } catch { /* no balance */ }

  try {
    result.vaultToken = await fetchTokenBalance(CONTRACT_ADDRESSES.GOVERNANCE_TOKEN, publicKey);
  } catch { /* no balance */ }

  try {
    result.lpShares = await fetchLPShares(publicKey);
  } catch { /* no balance */ }

  return result;
}

/**
 * Fetch a SAC/Soroban token balance for an address
 */
async function fetchTokenBalance(tokenContractId: string, publicKey: string): Promise<string> {
  try {
    const contract = new Contract(tokenContractId);
    const address = new Address(publicKey);
    const call = contract.call("balance", address.toScVal());
    
    const builtTx = new TransactionBuilder(await sorobanServer.getAccount(publicKey), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(call)
      .setTimeout(30)
      .build();

    const simResult = await sorobanServer.simulateTransaction(builtTx);
    
    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result) {
      const val = scValToNative(simResult.result.retval);
      // Convert from stroops (7 decimal places) to human readable
      const bigVal = BigInt(val.toString());
      return formatTokenAmount(bigVal, 7);
    }
  } catch (err) {
    // Silent — token might not exist for this account
  }
  return "0";
}

/**
 * Fetch LP shares from CoreVault contract for an LP address
 */
async function fetchLPShares(publicKey: string): Promise<string> {
  try {
    const result = await queryContract(
      CONTRACT_ADDRESSES.CORE_VAULT,
      "get_lp_state",
      publicKey,
      [new Address(publicKey).toScVal()]
    );
    if (result && typeof result === 'object' && 'shares' in result) {
      return formatTokenAmount(BigInt((result as any).shares.toString()), 7);
    }
  } catch { /* no LP state */ }
  return "0";
}

// ──────────────────────────────────────────────────
//  CONTRACT STATE QUERIES (Real Soroban RPC)
// ──────────────────────────────────────────────────

/**
 * Query the CoreVault pool state on-chain
 */
export async function fetchPoolState(callerPubKey: string): Promise<PoolState | null> {
  try {
    const contract = new Contract(CONTRACT_ADDRESSES.CORE_VAULT);
    const call = contract.call("get_pool_state");
    
    const account = await sorobanServer.getAccount(callerPubKey);
    const builtTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(call)
      .setTimeout(30)
      .build();

    const simResult = await sorobanServer.simulateTransaction(builtTx);
    
    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result) {
      const raw = scValToNative(simResult.result.retval);
      return parsePoolState(raw);
    }
  } catch (err: any) {
    console.warn("[Soroban] Pool state query failed:", err.message);
  }
  return null;
}

/**
 * Query the LP state for a specific address
 */
export async function fetchLPState(callerPubKey: string): Promise<LPState | null> {
  try {
    const contract = new Contract(CONTRACT_ADDRESSES.CORE_VAULT);
    const call = contract.call("get_lp_state", new Address(callerPubKey).toScVal());

    const account = await sorobanServer.getAccount(callerPubKey);
    const builtTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(call)
      .setTimeout(30)
      .build();

    const simResult = await sorobanServer.simulateTransaction(builtTx);
    
    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result) {
      const raw = scValToNative(simResult.result.retval);
      return {
        shares: BigInt(raw.shares?.toString() || "0"),
        feeDebt: BigInt(raw.fee_debt?.toString() || "0"),
      };
    }
  } catch (err: any) {
    console.warn("[Soroban] LP state query failed:", err.message);
  }
  return null;
}

/**
 * Query pending yield for an LP
 */
export async function fetchPendingYield(callerPubKey: string): Promise<string> {
  try {
    const contract = new Contract(CONTRACT_ADDRESSES.CORE_VAULT);
    const call = contract.call("get_pending_yield", new Address(callerPubKey).toScVal());

    const account = await sorobanServer.getAccount(callerPubKey);
    const builtTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(call)
      .setTimeout(30)
      .build();

    const simResult = await sorobanServer.simulateTransaction(builtTx);
    
    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result) {
      const val = scValToNative(simResult.result.retval);
      return formatTokenAmount(BigInt(val.toString()), 7);
    }
  } catch { /* no yield */ }
  return "0";
}

/**
 * Query an anchor's state from the CoreVault contract
 */
export async function fetchAnchorVaultState(callerPubKey: string, anchorAddress: string): Promise<AnchorVaultState | null> {
  try {
    const contract = new Contract(CONTRACT_ADDRESSES.CORE_VAULT);
    const call = contract.call("get_anchor_state", new Address(anchorAddress).toScVal());

    const account = await sorobanServer.getAccount(callerPubKey);
    const builtTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(call)
      .setTimeout(30)
      .build();

    const simResult = await sorobanServer.simulateTransaction(builtTx);
    
    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result) {
      const raw = scValToNative(simResult.result.retval);
      return {
        isRegistered: raw.is_registered ?? false,
        creditLimit: BigInt(raw.credit_limit?.toString() || "0"),
        activeDraw: BigInt(raw.active_draw?.toString() || "0"),
        reputationScore: Number(raw.reputation_score || 0),
        lastDrawTimestamp: Number(raw.last_draw_timestamp || 0),
      };
    }
  } catch { /* anchor not found */ }
  return null;
}

/**
 * Query an anchor's record from the AnchorRegistry contract
 */
export async function fetchAnchorRegistryRecord(callerPubKey: string, anchorAddress: string): Promise<AnchorRecord | null> {
  try {
    const contract = new Contract(CONTRACT_ADDRESSES.ANCHOR_REGISTRY);
    const call = contract.call("get_anchor", new Address(anchorAddress).toScVal());

    const account = await sorobanServer.getAccount(callerPubKey);
    const builtTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(call)
      .setTimeout(30)
      .build();

    const simResult = await sorobanServer.simulateTransaction(builtTx);
    
    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result) {
      const raw = scValToNative(simResult.result.retval);
      return {
        isWhitelisted: raw.is_whitelisted ?? false,
        creditLimit: BigInt(raw.credit_limit?.toString() || "0"),
        reputationScore: Number(raw.reputation_score || 0),
        lockedCollateral: BigInt(raw.locked_collateral?.toString() || "0"),
        firstRegistered: Number(raw.first_registered || 0),
      };
    }
  } catch { /* anchor not registered */ }
  return null;
}

// ──────────────────────────────────────────────────
//  TRANSACTION BUILDING & SIGNING (Real Soroban)
// ──────────────────────────────────────────────────

/**
 * Build a real deposit transaction for the CoreVault contract.
 * Returns the XDR string ready for wallet signing.
 */
export async function buildDepositTransaction(
  userPubKey: string,
  amount: string, // Human readable e.g. "100"
): Promise<string> {
  const contract = new Contract(CONTRACT_ADDRESSES.CORE_VAULT);
  const amountScaled = BigInt(Math.round(parseFloat(amount) * 1e7));
  
  const call = contract.call(
    "deposit",
    new Address(userPubKey).toScVal(),
    nativeToScVal(amountScaled, { type: "i128" })
  );

  const account = await sorobanServer.getAccount(userPubKey);
  const tx = new TransactionBuilder(account, {
    fee: "100000", // 0.01 XLM max fee
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(call)
    .setTimeout(300)
    .build();

  // Simulate to get proper resource footprint
  const simResult = await sorobanServer.simulateTransaction(tx);
  
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    const errMsg = rpc.Api.isSimulationError(simResult)
      ? simResult.error
      : "Transaction simulation failed";
    throw new Error(errMsg);
  }

  // Assemble with simulation results (adds resource info)
  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  return preparedTx.toXDR();
}

/**
 * Build a real withdraw transaction for the CoreVault contract.
 */
export async function buildWithdrawTransaction(
  userPubKey: string,
  sharesAmount: string,
): Promise<string> {
  const contract = new Contract(CONTRACT_ADDRESSES.CORE_VAULT);
  const sharesScaled = BigInt(Math.round(parseFloat(sharesAmount) * 1e7));

  const call = contract.call(
    "withdraw",
    new Address(userPubKey).toScVal(),
    nativeToScVal(sharesScaled, { type: "i128" })
  );

  const account = await sorobanServer.getAccount(userPubKey);
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(call)
    .setTimeout(300)
    .build();

  const simResult = await sorobanServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error(
      rpc.Api.isSimulationError(simResult) ? simResult.error : "Withdraw simulation failed"
    );
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  return preparedTx.toXDR();
}

/**
 * Submit a signed transaction XDR to the Soroban network and poll for result.
 */
export async function submitTransaction(signedXDR: string): Promise<{
  hash: string;
  status: string;
  ledger: number;
  resultXdr?: string;
}> {
  const tx = TransactionBuilder.fromXDR(signedXDR, NETWORK_PASSPHRASE);
  const sendResponse = await sorobanServer.sendTransaction(tx);

  if (sendResponse.status === "ERROR") {
    throw new Error(`Transaction submission error: ${sendResponse.errorResult?.toXDR("base64") || "Unknown"}`);
  }

  // Poll for result
  let getResponse: rpc.Api.GetTransactionResponse;
  let attempts = 0;

  do {
    await sleep(2000);
    getResponse = await sorobanServer.getTransaction(sendResponse.hash);
    attempts++;
  } while (getResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 30);

  if (getResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return {
      hash: sendResponse.hash,
      status: "SUCCESS",
      ledger: (getResponse as any).ledger || 0,
      resultXdr: (getResponse as any).resultXdr?.toXDR?.("base64"),
    };
  } else {
    throw new Error(
      `Transaction failed on-chain. Status: ${getResponse.status}`
    );
  }
}

// ──────────────────────────────────────────────────
//  TRANSACTION HISTORY (Real Horizon)
// ──────────────────────────────────────────────────

/**
 * Fetch real transaction history for a wallet address from Horizon
 */
export async function fetchTransactionHistory(publicKey: string, limit = 20): Promise<TxRecord[]> {
  const records: TxRecord[] = [];
  
  try {
    // Fetch operations for this account
    const ops = await horizonServer
      .operations()
      .forAccount(publicKey)
      .order("desc")
      .limit(limit)
      .call();

    for (const op of ops.records) {
      const record = parseOperationToTxRecord(op, publicKey);
      if (record) {
        records.push(record);
      }
    }
  } catch (err: any) {
    console.warn("[Horizon] Transaction history fetch failed:", err.message);
  }

  return records;
}

/**
 * Fetch recent Soroban contract events (for live settlement log)
 */
export async function fetchContractEvents(contractId: string, _limit = 15): Promise<any[]> {
  try {
    const latestLedger = await sorobanServer.getLatestLedger();
    const startLedger = Math.max(1, latestLedger.sequence - 17280); // ~24 hours of ledgers

    const events = await sorobanServer.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
        },
      ],
    });

    return events.events || [];
  } catch (err: any) {
    console.warn("[Soroban] Event fetch failed:", err.message);
    return [];
  }
}

// ──────────────────────────────────────────────────
//  STELLAR EXPERT + HORIZON LINKS
// ──────────────────────────────────────────────────

export function getStellarExpertTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function getStellarExpertAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/testnet/account/${address}`;
}

export function getStellarExpertContractUrl(contractId: string): string {
  return `https://stellar.expert/explorer/testnet/contract/${contractId}`;
}

export function getHorizonTxUrl(hash: string): string {
  return `${HORIZON_URL}/transactions/${hash}`;
}

// ──────────────────────────────────────────────────
//  FRIENDBOT (Fund testnet accounts)
// ──────────────────────────────────────────────────

export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    return response.ok;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────
//  INTERNAL HELPERS
// ──────────────────────────────────────────────────

async function queryContract(contractId: string, method: string, callerPubKey: string, args: xdr.ScVal[] = []) {
  const contract = new Contract(contractId);
  const call = contract.call(method, ...args);

  const account = await sorobanServer.getAccount(callerPubKey);
  const builtTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(call)
    .setTimeout(30)
    .build();

  const simResult = await sorobanServer.simulateTransaction(builtTx);

  if (rpc.Api.isSimulationSuccess(simResult) && simResult.result) {
    return scValToNative(simResult.result.retval);
  }
  return null;
}

function parsePoolState(raw: any): PoolState {
  return {
    totalDeposits: BigInt(raw.total_deposits?.toString() || "0"),
    activeDraws: BigInt(raw.active_draws?.toString() || "0"),
    reserveBalance: BigInt(raw.reserve_balance?.toString() || "0"),
    accFeesPerShare: BigInt(raw.acc_fees_per_share?.toString() || "0"),
    optimalUtilization: Number(raw.optimal_utilization || 0),
    baseFeeBps: Number(raw.base_fee_bps || 0),
    slope1Bps: Number(raw.slope_1_bps || 0),
    slope2Bps: Number(raw.slope_2_bps || 0),
  };
}

function parseOperationToTxRecord(op: any, userPubKey: string): TxRecord | null {
  try {
    const base: Partial<TxRecord> = {
      id: op.id,
      hash: op.transaction_hash,
      timestamp: op.created_at,
      status: op.transaction_successful ? "success" : "failed",
      ledger: op.ledger || 0,
    };

    switch (op.type) {
      case "payment":
        return {
          ...base,
          type: op.to === userPubKey ? "deposit" : "withdrawal",
          amount: op.amount,
          asset: op.asset_type === "native" ? "XLM" : (op.asset_code || "Unknown"),
          from: op.from,
          to: op.to,
        } as TxRecord;

      case "create_account":
        return {
          ...base,
          type: "deposit",
          amount: op.starting_balance,
          asset: "XLM",
          from: op.funder,
          to: op.account,
        } as TxRecord;

      case "invoke_host_function":
        return {
          ...base,
          type: "contract_call",
          amount: "",
          asset: "Soroban",
          from: op.source_account,
          to: op.function || "contract",
        } as TxRecord;

      default:
        return {
          ...base,
          type: "transfer",
          amount: "",
          asset: "",
          from: op.source_account || "",
          to: "",
        } as TxRecord;
    }
  } catch {
    return null;
  }
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}

export function formatAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < chars * 2 + 3) return addr;
  return `${addr.substring(0, chars)}...${addr.substring(addr.length - chars)}`;
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
