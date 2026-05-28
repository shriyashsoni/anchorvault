import { 
  rpc, 
  Keypair, 
  TransactionBuilder, 
  TimeoutInfinite, 
  Address,
  Contract,
  nativeToScVal,
  xdr,
  StrKey
} from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const secretKey = process.env.DEPLOYER_SECRET_KEY;

const govTokenAddress = process.env.VAULT_GOVERNANCE_TOKEN_ADDRESS;
const registryAddress = process.env.ANCHOR_REGISTRY_CONTRACT_ADDRESS;
const vaultAddress    = process.env.CORRIDOR_POOL_VAULT_ADDRESS;
const usdcAddress     = process.env.STELLAR_USDC_ADDRESS;

if (!secretKey || secretKey.startsWith('SAXX')) {
  console.error("❌ DEPLOYER_SECRET_KEY missing or invalid in .env");
  process.exit(1);
}
if (!usdcAddress || !govTokenAddress || !registryAddress || !vaultAddress) {
  console.error("❌ Contract addresses missing in .env — run 'npm run deploy' first!");
  process.exit(1);
}

const deployerKeypair = Keypair.fromSecret(secretKey);
const server = new rpc.Server(rpcUrl);

// Helper: convert any Stellar address (G... or C...) to a ScVal
function toAddressScVal(str) {
  if (str.startsWith('G')) {
    return new Address(str).toScVal();
  }
  // C... Soroban contract address — must decode via StrKey
  return Address.contract(StrKey.decodeContract(str)).toScVal();
}

console.log("=================================================");
console.log("🚀 INITIALIZING ANCHORVAULT SMART CONTRACTS");
console.log(`Deployer: ${deployerKeypair.publicKey()}`);
console.log("=================================================\n");

// ─────────────────────────────────────────────────────────
//  Send a contract call transaction
// ─────────────────────────────────────────────────────────
async function callContract(label, contractId, method, args) {
  console.log(`⌛ Calling ${label} → ${method}()...`);
  const contract = new Contract(contractId);
  const account  = await server.getAccount(deployerKeypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TimeoutInfinite)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    const errMsg = rpc.Api.isSimulationError(simResult) ? simResult.error : JSON.stringify(simResult);
    if (errMsg.includes("Already initialized") || errMsg.includes("ExistingValue") || errMsg.includes("already")) {
      console.log(`  ⚠️  Already initialized — skipping.\n`);
      return;
    }
    throw new Error(`Simulation failed: ${errMsg}`);
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(deployerKeypair);

  const sendResp = await server.sendTransaction(preparedTx);
  if (sendResp.status === 'ERROR') {
    throw new Error(`Tx error: ${sendResp.errorResultXdr}`);
  }

  for (let i = 0; i < 30; i++) {
    const info = await server.getTransaction(sendResp.hash);
    if (info.status === 'SUCCESS') {
      console.log(`  ✅ ${label} → ${method}() confirmed! Hash: ${sendResp.hash}\n`);
      return;
    }
    if (info.status === 'FAILED') throw new Error(`Tx FAILED: ${sendResp.hash}`);
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Timeout waiting for confirmation.");
}

// ─────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────
async function main() {
  // 1. Vault Share Token — admin = Vault so it can mint/burn LP shares
  console.log("=== [1/3] VAULT SHARE TOKEN ===");
  console.log(`    Contract: ${govTokenAddress}`);
  await callContract("VaultToken", govTokenAddress, "initialize", [
    toAddressScVal(vaultAddress),        // admin = vault contract
    xdr.ScVal.scvSymbol("AVShare"),      // name
    xdr.ScVal.scvSymbol("AVLT"),         // symbol
  ]);

  // 2. Anchor Registry — admin = deployer, 10% min collateral
  console.log("=== [2/3] ANCHOR REGISTRY ===");
  console.log(`    Contract: ${registryAddress}`);
  await callContract("AnchorRegistry", registryAddress, "initialize", [
    toAddressScVal(deployerKeypair.publicKey()),   // admin
    toAddressScVal(govTokenAddress),               // vault_token (collateral)
    nativeToScVal(1000, { type: "u32" }),          // 10% min collateral ratio
  ]);

  // 3. Corridor Pool Vault — connect USDC, share token, set fee curve
  console.log("=== [3/3] CORRIDOR POOL VAULT ===");
  console.log(`    Contract: ${vaultAddress}`);
  await callContract("CorridorVault", vaultAddress, "initialize", [
    toAddressScVal(deployerKeypair.publicKey()),   // admin
    toAddressScVal(usdcAddress),                   // USDC stablecoin (SAC)
    toAddressScVal(govTokenAddress),               // governance/share token
    nativeToScVal(8000, { type: "u32" }),          // 80% optimal utilization
    nativeToScVal(100,  { type: "u32" }),          // 1% base fee
    nativeToScVal(400,  { type: "u32" }),          // 4% slope_1 rate
    nativeToScVal(5000, { type: "u32" }),          // 50% slope_2 penalty rate
  ]);

  console.log("=================================================");
  console.log("🎉 ALL ANCHORVAULT CONTRACTS FULLY INITIALIZED!");
  console.log(`   Vault Share Token: ${govTokenAddress}`);
  console.log(`   Anchor Registry:   ${registryAddress}`);
  console.log(`   Corridor Vault:    ${vaultAddress}`);
  console.log("   Protocol is LIVE on Stellar Testnet! 🚀");
  console.log("=================================================");
}

main().catch(err => {
  console.error("❌ Initialization failed:", err.message);
  process.exit(1);
});
