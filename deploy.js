import { 
  rpc, 
  Keypair, 
  Operation, 
  TransactionBuilder, 
  TimeoutInfinite, 
  Address,
  scValToNative,
  StrKey
} from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load local private environment variables from .env
dotenv.config();

const network = process.env.STELLAR_NETWORK || 'testnet';
const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

const secretKey = process.env.DEPLOYER_SECRET_KEY;

if (!secretKey || secretKey.startsWith('SAXX')) {
  console.error("❌ ERROR: DEPLOYER_SECRET_KEY is missing or invalid in your .env file!");
  console.error("Run: node setup_keys.js — to generate and fund a fresh testnet deployer account.");
  process.exit(1);
}

const deployerKeypair = Keypair.fromSecret(secretKey);
const server = new rpc.Server(rpcUrl);

console.log("=================================================");
console.log(`🚀 ANCHORVAULT TESTNET DEPLOYMENT`);
console.log(`Network: ${network}`);
console.log(`RPC Node: ${rpcUrl}`);
console.log(`Deployer: ${deployerKeypair.publicKey()}`);
console.log("=================================================\n");

// ─────────────────────────────────────────────────────────
//  UPLOAD WASM — idempotent, returns the wasm hash hex
// ─────────────────────────────────────────────────────────
async function uploadWasm(wasmPath) {
  const absolutePath = path.resolve(wasmPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`WASM not found: ${absolutePath}. Build contracts with cargo first.`);
  }

  console.log(`📤 Uploading WASM: ${path.basename(wasmPath)}...`);
  const wasmBytes = fs.readFileSync(absolutePath);
  const account = await server.getAccount(deployerKeypair.publicKey());

  let tx = new TransactionBuilder(account, { fee: '100000', networkPassphrase: passphrase })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(TimeoutInfinite)
    .build();

  console.log("  ⌛ Simulating...");
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(deployerKeypair);

  console.log("  ⌛ Submitting to Stellar network...");
  const sendResp = await server.sendTransaction(prepared);
  if (sendResp.status === 'ERROR') {
    throw new Error(`Upload tx error: ${sendResp.errorResultXdr || 'Unknown'}`);
  }

  const txInfo = await pollForResult(sendResp.hash);
  if (!txInfo.returnValue) throw new Error("Upload succeeded but no returnValue found.");

  const rawBytes = scValToNative(txInfo.returnValue);
  const wasmHashHex = Buffer.from(rawBytes).toString('hex');
  console.log(`  ✅ WASM uploaded! Hash: ${wasmHashHex}\n`);
  return wasmHashHex;
}

// ─────────────────────────────────────────────────────────
//  INSTANTIATE CONTRACT — returns the C... contract address
// ─────────────────────────────────────────────────────────
async function instantiateContract(wasmHashHex, saltHex) {
  console.log(`🏗  Instantiating contract (salt: ${saltHex.slice(0, 8)}...)...`);
  const account = await server.getAccount(deployerKeypair.publicKey());

  let tx = new TransactionBuilder(account, { fee: '100000', networkPassphrase: passphrase })
    .addOperation(
      Operation.createCustomContract({
        wasmHash: Buffer.from(wasmHashHex, 'hex'),
        address: Address.fromString(deployerKeypair.publicKey()),
        salt: Buffer.from(saltHex, 'hex'),
      })
    )
    .setTimeout(TimeoutInfinite)
    .build();

  console.log("  ⌛ Simulating...");
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(deployerKeypair);

  console.log("  ⌛ Submitting...");
  const sendResp = await server.sendTransaction(prepared);
  if (sendResp.status === 'ERROR') {
    throw new Error(`Instantiate tx error: ${sendResp.errorResultXdr || 'Unknown'}`);
  }

  const txInfo = await pollForResult(sendResp.hash);
  if (!txInfo.returnValue) throw new Error("Instantiate succeeded but no returnValue found.");

  // The returnValue is a ScAddress — decode it to a C... StrKey
  const rawAddress = scValToNative(txInfo.returnValue);
  // rawAddress may be a Uint8Array (contract bytes) or an Address string
  let contractId;
  if (typeof rawAddress === 'string') {
    contractId = rawAddress;
  } else {
    // It's raw bytes — encode as contract StrKey
    contractId = StrKey.encodeContract(Buffer.from(rawAddress));
  }
  console.log(`  🎉 Deployed at: ${contractId}\n`);
  return contractId;
}

// ─────────────────────────────────────────────────────────
//  POLL for transaction confirmation
// ─────────────────────────────────────────────────────────
async function pollForResult(hash) {
  for (let i = 0; i < 30; i++) {
    const info = await server.getTransaction(hash);
    if (info.status === 'SUCCESS') return info;
    if (info.status === 'FAILED') {
      throw new Error(`Transaction FAILED on-chain. Hash: ${hash}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Transaction confirmation timed out. Hash: ${hash}`);
}

// ─────────────────────────────────────────────────────────
//  UPDATE .env file with new addresses
// ─────────────────────────────────────────────────────────
function updateEnvFile(registryAddress, tokenAddress, vaultAddress) {
  const envPath = path.resolve('.env');
  let content = fs.readFileSync(envPath, 'utf8');

  content = content.replace(
    /VAULT_GOVERNANCE_TOKEN_ADDRESS=.*/,
    `VAULT_GOVERNANCE_TOKEN_ADDRESS="${tokenAddress}"`
  );
  content = content.replace(
    /ANCHOR_REGISTRY_CONTRACT_ADDRESS=.*/,
    `ANCHOR_REGISTRY_CONTRACT_ADDRESS="${registryAddress}"`
  );
  content = content.replace(
    /CORRIDOR_POOL_VAULT_ADDRESS=.*/,
    `CORRIDOR_POOL_VAULT_ADDRESS="${vaultAddress}"`
  );

  fs.writeFileSync(envPath, content, 'utf8');
  console.log("📝 .env updated with new contract addresses.");
}

// ─────────────────────────────────────────────────────────
//  UPDATE src/lib/soroban.ts with new addresses
// ─────────────────────────────────────────────────────────
function updateSorobanTs(registryAddress, tokenAddress, vaultAddress) {
  const tsPath = path.resolve('src/lib/soroban.ts');
  if (!fs.existsSync(tsPath)) return;

  let content = fs.readFileSync(tsPath, 'utf8');

  content = content.replace(
    /GOVERNANCE_TOKEN:\s*"[^"]*"/,
    `GOVERNANCE_TOKEN: "${tokenAddress}"`
  );
  content = content.replace(
    /ANCHOR_REGISTRY:\s*"[^"]*"/,
    `ANCHOR_REGISTRY: "${registryAddress}"`
  );
  content = content.replace(
    /CORE_VAULT:\s*"[^"]*"/,
    `CORE_VAULT: "${vaultAddress}"`
  );

  fs.writeFileSync(tsPath, content, 'utf8');
  console.log("📝 src/lib/soroban.ts updated with new contract addresses.");
}

// ─────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────
async function main() {
  // Unique salts per contract to avoid address collisions
  const SALTS = {
    registry: 'aa00000000000000000000000000000000000000000000000000000000000001',
    token:    'bb00000000000000000000000000000000000000000000000000000000000002',
    vault:    'cc00000000000000000000000000000000000000000000000000000000000003',
  };

  const wasmPaths = {
    registry: './target/wasm32v1-none/release/anchor_registry.wasm',
    token:    './target/wasm32v1-none/release/vault_token.wasm',
    vault:    './target/wasm32v1-none/release/anchor_vault.wasm',
  };

  console.log("=== [1/3] ANCHOR REGISTRY ===");
  const registryWasmHash = await uploadWasm(wasmPaths.registry);
  const registryAddress  = await instantiateContract(registryWasmHash, SALTS.registry);

  console.log("=== [2/3] VAULT SHARE TOKEN ===");
  const tokenWasmHash = await uploadWasm(wasmPaths.token);
  const tokenAddress  = await instantiateContract(tokenWasmHash, SALTS.token);

  console.log("=== [3/3] CORRIDOR POOL VAULT ===");
  const vaultWasmHash = await uploadWasm(wasmPaths.vault);
  const vaultAddress  = await instantiateContract(vaultWasmHash, SALTS.vault);

  console.log("=================================================");
  console.log("🎉 ALL CONTRACTS DEPLOYED ON STELLAR TESTNET!");
  console.log(`   Anchor Registry:  ${registryAddress}`);
  console.log(`   Vault Share Token: ${tokenAddress}`);
  console.log(`   Corridor Vault:    ${vaultAddress}`);
  console.log("=================================================\n");

  updateEnvFile(registryAddress, tokenAddress, vaultAddress);
  updateSorobanTs(registryAddress, tokenAddress, vaultAddress);

  console.log("\n✅ All done! Run 'npm run initialize' next to set up protocol parameters.");
}

main().catch(err => {
  console.error("❌ Fatal deployment error:", err.message);
  process.exit(1);
});
