import { 
  rpc, 
  Keypair, 
  Operation, 
  TransactionBuilder, 
  TimeoutInfinite, 
  Address,
  Contract,
  nativeToScVal,
  xdr
} from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';

// Load local private environment variables from .env
dotenv.config();

const network = process.env.STELLAR_NETWORK || 'testnet';
const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

// Read secret key and addresses from secure .env
const secretKey = process.env.DEPLOYER_SECRET_KEY;
const publicKey = process.env.DEPLOYER_PUBLIC_KEY;

const usdcAddress = process.env.STELLAR_USDC_ADDRESS;
const govTokenAddress = process.env.VAULT_GOVERNANCE_TOKEN_ADDRESS;
const registryAddress = process.env.ANCHOR_REGISTRY_CONTRACT_ADDRESS;
const vaultAddress = process.env.CORRIDOR_POOL_VAULT_ADDRESS;

if (!secretKey || secretKey.startsWith('SAXX')) {
  console.error("❌ ERROR: DEPLOYER_SECRET_KEY is missing or invalid in your .env file!");
  console.error("Please run 'node setup_keys.js' or set secure keys in your .env file.");
  process.exit(1);
}

if (!usdcAddress || !govTokenAddress || !registryAddress || !vaultAddress) {
  console.error("❌ ERROR: One or more deployed contract addresses are missing in your .env file!");
  console.error("Please ensure STELLAR_USDC_ADDRESS, VAULT_GOVERNANCE_TOKEN_ADDRESS, ANCHOR_REGISTRY_CONTRACT_ADDRESS, and CORRIDOR_POOL_VAULT_ADDRESS are set.");
  process.exit(1);
}

const deployerKeypair = Keypair.fromSecret(secretKey);
const server = new rpc.Server(rpcUrl);

console.log("=================================================");
21: console.log(`🚀 INITIALIZING ANCHORVAULT SMART CONTRACTS`);
console.log(`Network: ${network}`);
console.log(`RPC Node: ${rpcUrl}`);
console.log(`Deployer Address: ${deployerKeypair.publicKey()}`);
console.log("=================================================\n");

async function sendTransaction(operation) {
  const account = await server.getAccount(deployerKeypair.publicKey());
  
  let tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: passphrase,
  })
    .addOperation(operation)
    .setTimeout(TimeoutInfinite)
    .build();

  console.log("⌛ Simulating transaction footprint on-chain...");
  let preparedTx = await server.prepareTransaction(tx);
  
  preparedTx.sign(deployerKeypair);
  
  console.log("⌛ Submitting transaction to network...");
  let response = await server.sendTransaction(preparedTx);
  
  if (response.status === 'ERROR') {
    throw new Error(`Submission failed: ${response.errorResultXdr || 'Unknown error'}`);
  }

  // Poll for result
  let txResult = await pollTransactionResult(response.hash);
  console.log(`✅ Success! Hash: ${response.hash}\n`);
  return txResult;
}

async function pollTransactionResult(hash) {
  let status = 'PENDING';
  let attempts = 0;
  
  while (status === 'PENDING' && attempts < 20) {
    const txInfo = await server.getTransaction(hash);
    if (txInfo.status === 'SUCCESS') {
      return txInfo;
    } else if (txInfo.status === 'FAILED') {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(txInfo.resultXdr)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;
  }
  throw new Error("Transaction confirmation timed out.");
}

async function main() {
  try {
    // 1. Initialize Vault Share Token
    console.log("=== [1/3] INITIALIZING VAULT SHARE TOKEN ===");
    console.log(`Contract: ${govTokenAddress}`);
    const tokenContract = new Contract(govTokenAddress);
    
    // Arguments: env: Env, admin: Address, name: Symbol, symbol: Symbol
    // Note: The admin is the Corridor Pool Vault address so the Vault can mint/burn shares.
    const tokenInitOp = tokenContract.call(
      "initialize",
      new Address(vaultAddress).toScVal(),
      xdr.ScVal.scvSymbol("AVShare"),
      xdr.ScVal.scvSymbol("AVLT")
    );
    
    try {
      await sendTransaction(tokenInitOp);
    } catch (err) {
      if (err.message.includes("Already initialized") || err.message.includes("HostError: Error")) {
        console.log("⚠️ Token already initialized or skipped.\n");
      } else {
        throw err;
      }
    }

    // 2. Initialize Anchor Registry
    console.log("=== [2/3] INITIALIZING ANCHOR REGISTRY ===");
    console.log(`Contract: ${registryAddress}`);
    const registryContract = new Contract(registryAddress);
    
    // Arguments: env: Env, admin: Address, vault_token: Address, min_collateral_ratio_bps: u32
    // Admin is the Deployer.
    const registryInitOp = registryContract.call(
      "initialize",
      new Address(deployerKeypair.publicKey()).toScVal(),
      new Address(govTokenAddress).toScVal(),
      nativeToScVal(1000, { type: "u32" }) // 10.00% collateral requirement
    );
    
    try {
      await sendTransaction(registryInitOp);
    } catch (err) {
      if (err.message.includes("Already initialized") || err.message.includes("HostError: Error")) {
        console.log("⚠️ Registry already initialized or skipped.\n");
      } else {
        throw err;
      }
    }

    // 3. Initialize Corridor Pool Vault
    console.log("=== [3/3] INITIALIZING CORRIDOR POOL VAULT ===");
    console.log(`Contract: ${vaultAddress}`);
    const vaultContract = new Contract(vaultAddress);
    
    // Arguments:
    // env: Env, admin: Address, token: Address, gov_token: Address, 
    // optimal_utilization: u32, base_fee_bps: u32, slope_1_bps: u32, slope_2_bps: u32
    const vaultInitOp = vaultContract.call(
      "initialize",
      new Address(deployerKeypair.publicKey()).toScVal(),
      new Address(usdcAddress).toScVal(),
      new Address(govTokenAddress).toScVal(),
      nativeToScVal(8000, { type: "u32" }), // 80.00% optimal utilization
      nativeToScVal(100, { type: "u32" }),   // 1.00% base corridor borrow fee (100 bps)
      nativeToScVal(400, { type: "u32" }),   // 4.00% slope_1 interest rate (400 bps)
      nativeToScVal(5000, { type: "u32" })   // 50.00% slope_2 penalty rate (5000 bps)
    );
    
    try {
      await sendTransaction(vaultInitOp);
    } catch (err) {
      if (err.message.includes("Already initialized") || err.message.includes("HostError: Error")) {
        console.log("⚠️ Vault already initialized or skipped.\n");
      } else {
        throw err;
      }
    }

    console.log("=================================================");
    console.log("🎉 ALL ANCHORVAULT CONTRACTS SUCCESSFULLY INITIALIZED!");
    console.log("=================================================");

  } catch (error) {
    console.error("❌ Initialization failed with error:", error.message);
  }
}

main();
