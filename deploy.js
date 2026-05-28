import { 
  rpc, 
  Keypair, 
  Operation, 
  TransactionBuilder, 
  TimeoutInfinite, 
  Address 
} from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load local private environment variables from .env
dotenv.config();

const network = process.env.STELLAR_NETWORK || 'testnet';
const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

// Read secret key from secure .env
const secretKey = process.env.DEPLOYER_SECRET_KEY;
const publicKey = process.env.DEPLOYER_PUBLIC_KEY;

if (!secretKey || secretKey.startsWith('SAXX')) {
  console.error("❌ ERROR: DEPLOYER_SECRET_KEY is missing or invalid in your .env file!");
  console.error("Please edit your local .env file and paste your Freighter Testnet secret key first.");
  process.exit(1);
}

const deployerKeypair = Keypair.fromSecret(secretKey);
const server = new rpc.Server(rpcUrl);

console.log("=================================================");
console.log(`🚀 STARTING SECURE ANCHORVAULT TESTNET DEPLOYMENT`);
console.log(`Network: ${network}`);
console.log(`RPC Node: ${rpcUrl}`);
console.log(`Deployer Address: ${deployerKeypair.publicKey()}`);
console.log("=================================================\n");

async function deployWasm(wasmPath) {
  const absolutePath = path.resolve(wasmPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`WASM file not found at: ${absolutePath}. Did you compile your Rust contracts? Run 'cargo build --target wasm32-unknown-unknown --release'`);
  }

  console.log(`📤 Uploading contract WASM: ${path.basename(wasmPath)}...`);
  const wasmBytes = fs.readFileSync(absolutePath);
  
  // Create account details
  const account = await server.getAccount(deployerKeypair.publicKey());
  
  // Build upload transaction
  let tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: passphrase,
  })
    .addOperation(
      Operation.uploadContractWasm({
        wasm: wasmBytes,
      })
    )
    .setTimeout(TimeoutInfinite)
    .build();

  // Pre-flight simulation for Soroban resources
  console.log("⌛ Simulating transaction footprint on-chain...");
  let preparedTx = await server.prepareTransaction(tx);

  // Sign locally on your machine
  preparedTx.sign(deployerKeypair);

  // Send to Stellar RPC node
  console.log("⌛ Submitting transaction to Stellar network...");
  let response = await server.sendTransaction(preparedTx);
  
  if (response.status === 'ERROR') {
    throw new Error(`Upload failed: ${response.errorResultXdr || 'Unknown error'}`);
  }

  // Wait for ingestion
  let txResult = await pollTransactionResult(response.hash);
  
  // Parse Wasm ID hash
  const wasmId = txResult.wasmId;
  console.log(`✅ WASM Uploaded Successfully! WASM ID: ${wasmId}\n`);
  return wasmId;
}

async function instantiateContract(wasmId, saltHex = "0000000000000000000000000000000000000000000000000000000000000001") {
  console.log(`🏗️ Instantiating contract instance for WASM ID: ${wasmId}...`);
  const account = await server.getAccount(deployerKeypair.publicKey());

  let tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: passphrase,
  })
    .addOperation(
      Operation.createContract({
        wasmId: Buffer.from(wasmId, 'hex'),
        address: Address.fromString(deployerKeypair.publicKey()),
        salt: Buffer.from(saltHex, 'hex'),
      })
    )
    .setTimeout(TimeoutInfinite)
    .build();

  // Pre-flight simulation for Soroban resources
  console.log("⌛ Simulating instantiation footprint...");
  let preparedTx = await server.prepareTransaction(tx);

  preparedTx.sign(deployerKeypair);
  
  let response = await server.sendTransaction(preparedTx);
  if (response.status === 'ERROR') {
    throw new Error(`Instantiation failed: ${response.errorResultXdr || 'Unknown error'}`);
  }

  let txResult = await pollTransactionResult(response.hash);
  const contractAddress = txResult.contractId;
  console.log(`🎉 Contract Instantiated! Address: ${contractAddress}\n`);
  return contractAddress;
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
    console.log("🔍 Checking compiled Rust artifacts...");
    
    // Paths to compiled target WASM files from Cargo workspace
    const registryWasm = './target/wasm32v1-none/release/anchor_registry.wasm';
    const tokenWasm = './target/wasm32v1-none/release/vault_token.wasm';
    const vaultWasm = './target/wasm32v1-none/release/anchor_vault.wasm';

    console.log("NOTE: This local script securely signs and deploys your smart contracts.");
    console.log("Make sure you have Rust & cargo-contract configured to build WASM files first.\n");

    const registryWasmId = await deployWasm(registryWasm);
    const registryAddress = await instantiateContract(registryWasmId);

    const tokenWasmId = await deployWasm(tokenWasm);
    const tokenAddress = await instantiateContract(tokenWasmId);

    const vaultWasmId = await deployWasm(vaultWasm);
    const vaultAddress = await instantiateContract(vaultWasmId);

    console.log("=================================================");
    console.log("🎉 DEPLOYMENT COMPLETE! UPDATE YOUR .env FILE WITH:");
    console.log(`ANCHOR_REGISTRY_CONTRACT_ADDRESS="${registryAddress}"`);
    console.log(`VAULT_GOVERNANCE_TOKEN_ADDRESS="${tokenAddress}"`);
    console.log(`CORRIDOR_POOL_VAULT_ADDRESS="${vaultAddress}"`);
    console.log("=================================================");

  } catch (error) {
    console.error("❌ Deployment failed with error:", error.message);
  }
}

main();
