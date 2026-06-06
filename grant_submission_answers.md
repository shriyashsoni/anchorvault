# AnchorVault Grant Submission Answers

Here are the answers to your grant submission form based on the current status of the AnchorVault project:

**Project Name:***
AnchorVault

**Company Name:***
AnchorVault (or your legal name, e.g., Shriyash Soni, if not yet incorporated)

**Have you formed a legal entity? If yes, in which country is it incorporated?:***
No, not yet incorporated.

**Which of the following regions are you currently operating in or actively targeting?:***
Global (Targeting cross-border remittance corridors worldwide)

**Team Description:***
The team currently consists of a solo founder and developer, Shriyash Soni. I have deep expertise in smart contract development using Rust and Soroban on the Stellar network, as well as full-stack web development (React, TypeScript) to build seamless DeFi user experiences.
* GitHub: https://github.com/shriyashsoni
* LinkedIn: [Insert your LinkedIn URL here]

**Where are most founders located?:***
India

**When and how did the founders meet? Have you worked together in the past?:***
Solo founder.

**What is the equity breakdown between each founder? If equity is not equally divided, clarify why.:***
100% Shriyash Soni (Solo founder).

**Project Type:***
Financial Protocols

**Products & Services:***


**What is your unfair advantage in solving this problem?:***


**Who are your current and adjacent competitors?:***


**What stage is your product at?:***
Post-launch and Pre-revenue

**Project URL:***


**Company Twitter URL:***
 (or https://x.com/shriyashsoni_)

**Technical Architecture Document:***
*(Note for SCF Judges: Our architecture document explicitly details our integration with **Stellar Wallets Kit** and **Freighter Connect** from the SCF Integration List. You can find this directly on the Architecture page linked below).*

**Main Architecture & Getting Started**
* Introduction: https://www.anchorvault.xyz/docs/introduction
* Quickstart: https://www.anchorvault.xyz/docs/quickstart
* Architecture: https://www.anchorvault.xyz/docs/architecture

**Core Concepts**
* Corridor Pools: https://www.anchorvault.xyz/docs/concepts/corridor-pools
* Liquidity Providers: https://www.anchorvault.xyz/docs/concepts/liquidity-providers
* Payment Anchors: https://www.anchorvault.xyz/docs/concepts/payment-anchors
* Yield Model: https://www.anchorvault.xyz/docs/concepts/yield-model
* Reputation System: https://www.anchorvault.xyz/docs/concepts/reputation-system
* Insurance Fund: https://www.anchorvault.xyz/docs/concepts/insurance-fund

**Smart Contracts**
* Contracts Overview: https://www.anchorvault.xyz/docs/contracts/overview
* Corridor Vault: https://www.anchorvault.xyz/docs/contracts/corridor-vault
* Anchor Registry: https://www.anchorvault.xyz/docs/contracts/anchor-registry
* Vault Token: https://www.anchorvault.xyz/docs/contracts/vault-token

**SDK & Integration**
* TypeScript SDK: https://www.anchorvault.xyz/docs/sdk/typescript-sdk
* Transaction Building: https://www.anchorvault.xyz/docs/sdk/transaction-building
* Querying State: https://www.anchorvault.xyz/docs/sdk/querying-state
* Wallet Integration: https://www.anchorvault.xyz/docs/sdk/wallet-integration

**Deployment**
* Prerequisites: https://www.anchorvault.xyz/docs/deployment/prerequisites
* Compile Contracts: https://www.anchorvault.xyz/docs/deployment/compile-contracts
* Deploy to Mainnet: https://www.anchorvault.xyz/docs/deployment/deploy-testnet
* Initialize Protocol: https://www.anchorvault.xyz/docs/deployment/initialize-protocol
* Register Anchors: https://www.anchorvault.xyz/docs/deployment/register-anchors

**API Reference**
* API Intro: https://www.anchorvault.xyz/docs/api-reference/introduction
* Vault Functions: https://www.anchorvault.xyz/docs/api-reference/vault-functions
* Registry Functions: https://www.anchorvault.xyz/docs/api-reference/registry-functions
* Token Functions: https://www.anchorvault.xyz/docs/api-reference/token-functions
* View Functions: https://www.anchorvault.xyz/docs/api-reference/view-functions

**GitHub URL:**
https://github.com/shriyashsoni/anchorvault

**Video URL:**
[Please insert the URL of your uploaded demo video (e.g., YouTube or Vimeo)] *Note: I see a few MP4 files in your project directory (like 14380225_1920_1080_24fps.mp4). Please upload your final pitch video to YouTube/Vimeo and paste the link here.*

**Pitch deck:***
[Please attach/upload your pitch deck file here]

**Current Traction Evidence:***
AnchorVault is fully deployed and active on the Stellar Mainnet. We have successfully deployed all core Soroban smart contracts:
* Stellar USDC: `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`
* Vault Share Token ($AVLT): `CDXELK3CF4GHCK6U3NETR2NNONDV3VDNKM7MT4QD5M23AHRN5X47O4IF`
* Anchor Registry: `CA6NMU2ADEKVTS4XBZRLAARH7VSF7JEKWKAHNVT7WE5ZIEEKKOCOM6QO`
* Corridor Pool Vault: `CDO3GSX27G6TAHLBROCC6WV4TNM6BWLFZDT2OW6RSUVBSGZJKTIISJFG`
The user-facing DeFi portal is fully live at anchorvault.xyz, enabling USDC deposits and $VAULT token minting.

**How do you capture value? Describe your business model and relevant revenue streams.:***
AnchorVault captures value through a dynamic interest and fee model applied to the capital drawn by anchors. When anchors repay their utilized liquidity plus the dynamic fee, 90% of that settlement fee is distributed directly back to our LPs (increasing the value of their $AVLT share tokens). 5% of the fee is routed to a protocol Insurance Fund to serve as a backstop against potential defaults, and the remaining 5% goes to the AnchorVault protocol treasury as revenue.

**Please indicate your revenue to date (if applicable):**
$0 (We just launched on Mainnet).

**What was the last round of funding you closed?:***
Bootstrapped.

**How much have you raised to date & who are some notable investors?:***
$0 raised to date. Fully self-funded.

**When are you looking to raise your next funding round?:***
We are open to raising a Seed round in the next 3-6 months to scale marketing, bootstrap initial pool liquidity, and expand our anchor partnerships.

**How much runway do you have?:***
Currently operating on personal founder runway (bootstrapped). 

**Describe your current relationship with Stellar Network.:***
AnchorVault is natively and exclusively built on the Stellar network. We utilize Stellar's layer-1 speed and low costs to settle remittances, and we leverage the new Soroban smart contract environment to execute our complex vault and registry logic trustlessly. We also heavily utilize the official Stellar USDC asset. We are active participants in the Stellar ecosystem and developer community.

**Thumbnail:***
[Please upload the AnchorVault logo/thumbnail from your `logo` directory]

---

### Integration Track Specifics & Budget

**Budget:***
$30,000

**Integration Track Specifics:***
We are integrating with three recommended building blocks from the Integration List:
1. **Anchor Platform**: To build a standardized SEP-24/SEP-31 interface that allows traditional payment anchors and fintechs to directly plug into our liquidity vault for on/off-ramp settlement.
2. **Stellar Wallets Kit**: To standardize user onboarding, wallet management, and provide seamless multi-wallet connection options (LOBSTR, xBull, etc.) for our Liquidity Providers.
3. **Freighter Connect**: As our primary wallet integration for native Soroban smart contract interactions, ensuring secure, non-custodial XDR signing for complex transactions like deposits, draws, and repayments.

**Tranche #1 Deliverables:***
Core integration of the Stellar Wallets Kit and Freighter Connect into the AnchorVault DeFi portal. This includes building the wallet connection UI, handling user state across the application, and successfully simulating and signing Soroban XDR transactions natively within the browser using the Freighter API. We will also begin initial environment setup for the Anchor Platform.

**Tranche #1 Completion Date:***
30/06/2026

**Tranche #2 Deliverables:***
Deployment and configuration of the Stellar Anchor Platform. We will map our on-chain Vault logic to SEP-24 and SEP-31 standard endpoints, allowing testnet anchors to simulate drawing settlement liquidity using standardized API calls rather than direct smart contract interactions.

**Tranche #2 Completion Date:***
30/07/2026

**Tranche #3 Deliverables:***
Mainnet optimization, rigorous edge-case testing of the Anchor Platform integration, and final production release. We will publish comprehensive developer guides detailing how Anchors can use the Anchor Platform to connect to AnchorVault, formally launch the application, and execute a marketing campaign highlighting our seamless user and anchor onboarding experience.

**Tranche #3 Completion Date:***
30/08/2026

**How did you hear about the Stellar x CV Labs Accelerator?:***
Stellar Developer Discord / Community Forums

**If you have been referred by one of the Stellar or CV VC mentors/advisors/team, please fill in the name here.:**
N/A
