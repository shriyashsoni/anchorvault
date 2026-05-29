import React, { useState, useEffect, useCallback } from "react";
import { 
  X, 
  ArrowRight, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Coins, 
  Activity, 
  Globe, 
  RefreshCw, 
  ExternalLink,
  Menu,
  CheckCircle2,
  MessageSquare,
  Clock,
  Loader2
} from "lucide-react";
import { motion } from "motion/react";
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import BionovaHero from "./components/BionovaHero";
import FeaturesGrid from "./components/FeaturesGrid";
import {
  CONTRACT_ADDRESSES,
  fetchWalletBalances,
  fetchPoolState,
  fetchLPState,
  fetchPendingYield,
  fetchTransactionHistory,
  buildDepositTransaction,
  buildWithdrawTransaction,
  submitTransaction,
  getStellarExpertTxUrl,
  getStellarExpertAccountUrl,
  getStellarExpertContractUrl,
  formatAddress,
  timeAgo,
  fetchRegisteredAnchors,
  type WalletBalances,
  type PoolState,
  type TxRecord,
  type LPState,
  type RegisteredAnchor,
} from "./lib/soroban";


// 1. Custom Image Logo component
const LogoMark = ({ className = "h-10 w-10" }: { className?: string }) => (
  <img src="/logo.png" alt="AnchorVault Logo" className={`${className} object-contain`} />
);

const TwitterIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
  </svg>
);

const SUPPORTED_WALLETS = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Official Stellar Extension",
    icon: "https://stellar.creit.tech/wallet-icons/freighter.png",
  },
  {
    id: "lobstr",
    name: "LOBSTR",
    description: "Secure Stellar Portal",
    icon: "https://stellar.creit.tech/wallet-icons/lobstr.png",
  },
  {
    id: "xbull",
    name: "xBull",
    description: "Power-User Wallet",
    icon: "https://stellar.creit.tech/wallet-icons/xbull.png",
  },
  {
    id: "albedo",
    name: "Albedo",
    description: "Web SEP Handshakes",
    icon: "https://stellar.creit.tech/wallet-icons/albedo.png",
  },
  {
    id: "hana",
    name: "Hana Wallet",
    description: "Multi-Chain Portal",
    icon: "https://stellar.creit.tech/wallet-icons/hana.png",
  },
  {
    id: "rabet",
    name: "Rabet",
    description: "Instant Extension",
    icon: "https://stellar.creit.tech/wallet-icons/rabet.png",
  },
];

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"home" | "whitepaper" | "docs" | "privacy" | "terms">("home");
  const [docsTab, setDocsTab] = useState("getting-started");

  // Wallet Access Modal states
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [signUpStep, setSignUpStep] = useState(1);
  const [connectedWalletName, setConnectedWalletName] = useState("");
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");

  useEffect(() => {
    try {
      StellarWalletsKit.init({
        modules: defaultModules(),
        network: Networks.TESTNET
      });
    } catch (err) {
      console.warn("StellarWalletsKit initialization error/warning:", err);
    }
  }, []);

  const handleStellarWalletsKitConnect = async () => {
    try {
      setConnectingWallet(true);
      setConnectionMessage("Opening Stellar Wallets Kit gateway...");
      
      const modalResult = await StellarWalletsKit.authModal();
      if (modalResult && modalResult.address) {
        setConnectedWalletName("Stellar Wallet");
        setWalletAddress(modalResult.address);
        setWalletConnected(true);
        setSignUpStep(3);
      }
    } catch (err: any) {
      console.error("Wallet kit connection failed:", err);
    } finally {
      setConnectingWallet(false);
    }
  };

  const connectDirectly = async (walletId: string) => {
    try {
      setConnectingWallet(true);
      setConnectionMessage(`Connecting directly to ${walletId.toUpperCase()}...`);
      
      StellarWalletsKit.setWallet(walletId);
      const { address } = await StellarWalletsKit.fetchAddress();
      if (address) {
        setConnectedWalletName(walletId.toUpperCase());
        setWalletAddress(address);
        setWalletConnected(true);
        setSignUpStep(3);
      }
    } catch (err: any) {
      console.error("Direct wallet connection failed:", err);
      const friendlyName = walletId.charAt(0).toUpperCase() + walletId.slice(1);
      alert(`Could not connect to ${friendlyName}. Please ensure the extension is installed, unlocked, and that you have granted permission.`);
    } finally {
      setConnectingWallet(false);
    }
  };

  // Interactive dashboard states
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"overview" | "deposit" | "withdraw" | "registry" | "wallet" | "history">("overview");
  
  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  // ── REAL ON-CHAIN STATE ──
  const [balances, setBalances] = useState<WalletBalances>({ xlm: "0", usdc: "0", vaultToken: "0", lpShares: "0" });
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [_lpState, setLpState] = useState<LPState | null>(null);
  const [pendingYield, setPendingYield] = useState("0");
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [registeredAnchors, setRegisteredAnchors] = useState<RegisteredAnchor[]>([]);

  // Transaction form state
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [txStep, setTxStep] = useState<"idle" | "building" | "signing" | "submitting" | "confirming" | "success" | "error">("idle");
  const [txProgress, setTxProgress] = useState(0);
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [txLedger, setTxLedger] = useState(0);

  // ── FETCH ALL ON-CHAIN DATA ──
  const refreshOnChainData = useCallback(async () => {
    if (!walletAddress) return;
    setIsLoadingData(true);
    try {
      const [bal, pool, lp, yield_, history, anchors] = await Promise.allSettled([
        fetchWalletBalances(walletAddress),
        fetchPoolState(walletAddress),
        fetchLPState(walletAddress),
        fetchPendingYield(walletAddress),
        fetchTransactionHistory(walletAddress, 25),
        fetchRegisteredAnchors(walletAddress),
      ]);

      if (bal.status === "fulfilled") setBalances(bal.value);
      if (pool.status === "fulfilled") setPoolState(pool.value);
      if (lp.status === "fulfilled") setLpState(lp.value);
      if (yield_.status === "fulfilled") setPendingYield(yield_.value);
      if (history.status === "fulfilled") setTxHistory(history.value);
      if (anchors.status === "fulfilled") setRegisteredAnchors(anchors.value);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("[AnchorVault] Data refresh failed:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [walletAddress]);

  // Auto-refresh on-chain data when wallet connects or dashboard opens
  useEffect(() => {
    if (walletConnected && walletAddress) {
      refreshOnChainData();
    }
  }, [walletConnected, walletAddress, refreshOnChainData]);

  // Auto-refresh every 30s when dashboard is open
  useEffect(() => {
    if (!showDashboard || !walletConnected) return;
    const interval = setInterval(refreshOnChainData, 30000);
    return () => clearInterval(interval);
  }, [showDashboard, walletConnected, refreshOnChainData]);

  // ── REAL DEPOSIT TRANSACTION ──
  const executeDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(depositAmount);
    if (isNaN(val) || val <= 0) return;

    try {
      setTxStep("building");
      setTxProgress(10);
      setTxError("");

      // Step 1: Build the real Soroban transaction
      const txXDR = await buildDepositTransaction(walletAddress, depositAmount);
      setTxProgress(30);
      setTxStep("signing");

      // Step 2: Sign with connected wallet (Freighter/StellarWalletsKit)
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(txXDR, {
        networkPassphrase: "Test SDF Network ; September 2015",
        address: walletAddress,
      });
      setTxProgress(60);
      setTxStep("submitting");

      // Step 3: Submit to Soroban network
      const result = await submitTransaction(signedTxXdr);
      setTxProgress(90);
      setTxStep("confirming");

      setTxHash(result.hash);
      setTxLedger(result.ledger);
      setTxProgress(100);
      setTxStep("success");

      // Refresh balances after successful tx
      setTimeout(() => refreshOnChainData(), 3000);
    } catch (err: any) {
      console.error("[Deposit] Transaction failed:", err);
      setTxError(err.message || "Transaction failed");
      setTxStep("error");
    }
  };

  // ── REAL WITHDRAW TRANSACTION ──
  const executeWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(withdrawShares);
    if (isNaN(val) || val <= 0) return;

    try {
      setTxStep("building");
      setTxProgress(10);
      setTxError("");

      const txXDR = await buildWithdrawTransaction(walletAddress, withdrawShares);
      setTxProgress(30);
      setTxStep("signing");

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(txXDR, {
        networkPassphrase: "Test SDF Network ; September 2015",
        address: walletAddress,
      });
      setTxProgress(60);
      setTxStep("submitting");

      const result = await submitTransaction(signedTxXdr);
      setTxProgress(90);
      setTxStep("confirming");

      setTxHash(result.hash);
      setTxLedger(result.ledger);
      setTxProgress(100);
      setTxStep("success");

      setTimeout(() => refreshOnChainData(), 3000);
    } catch (err: any) {
      console.error("[Withdraw] Transaction failed:", err);
      setTxError(err.message || "Withdrawal failed");
      setTxStep("error");
    }
  };

  // Wallet connect handler
  const handleConnectWallet = () => {
    setSignUpStep(1);
    setShowSignUpModal(true);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center overflow-x-hidden w-full font-sans antialiased">
      
      {/* NAVBAR: Absolute, over hero */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 lg:px-[120px] py-[16px] transparent font-manrope">
        <nav className="flex items-center justify-between w-full max-w-[1320px] mx-auto">
          
          {/* Logo */}
          <div onClick={() => setCurrentView("home")} className="flex items-center gap-3 cursor-pointer select-none">
            <LogoMark className="h-10 w-10 text-white" />
            <span className="text-white text-xl font-bold tracking-tight">AnchorVault</span>
          </div>

          {/* Center Links (Desktop Only) */}
          <div className="hidden lg:flex items-center gap-8">
            <button onClick={() => setCurrentView("home")} className="text-sm text-white font-medium hover:opacity-80 transition-opacity cursor-pointer">Overview</button>
            <button onClick={() => setCurrentView("whitepaper")} className="text-sm text-white font-medium hover:opacity-80 transition-opacity cursor-pointer">Whitepaper</button>
            <button onClick={() => { setCurrentView("docs"); setDocsTab("getting-started"); }} className="text-sm text-white font-medium hover:opacity-80 transition-opacity cursor-pointer">Docs</button>
            <button onClick={() => { setCurrentView("home"); setTimeout(() => document.getElementById("protocol")?.scrollIntoView({ behavior: 'smooth' }), 150); }} className="text-sm text-white font-medium hover:opacity-80 transition-opacity cursor-pointer">Staking</button>
            <button onClick={() => { setCurrentView("docs"); setDocsTab("smart-contracts"); }} className="text-sm text-white font-medium hover:opacity-80 transition-opacity cursor-pointer">Contracts</button>
          </div>

          {/* Action Buttons (Right, Desktop Only) */}
          <div className="hidden lg:flex items-center gap-4">
            <button 
              onClick={walletConnected ? () => { setShowDashboard(true); setDashboardTab("wallet"); } : handleConnectWallet}
              className="bg-white border border-[#d4d4d4] rounded-[8px] text-[#171717] font-semibold text-sm px-5 py-2.5 hover:bg-white/90 transition-all font-manrope flex items-center gap-1"
            >
              <span>{walletConnected ? `${walletAddress.substring(0, 4)}...${walletAddress.substring(38)}` : "connect wallet"}</span>
              {walletConnected && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
            </button>
            <button 
              onClick={walletConnected ? () => { setShowDashboard(true); setDashboardTab("overview"); } : handleConnectWallet}
              className="bg-[#7b39fc] rounded-[8px] text-[#fafafa] font-semibold text-sm px-5 py-2.5 hover:bg-[#8b4eff] transition-all shadow-md shadow-[#7b39fc]/20 font-manrope"
            >
              Launch DeFi Portal
            </button>
          </div>

          {/* Mobile hamburger menu */}
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 text-white hover:opacity-80 transition-opacity"
          >
            <Menu className="h-6 w-6" />
          </button>

        </nav>
      </header>

      {/* MOBILE FULL-SCREEN OVERLAY MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col p-6 font-manrope">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10 text-white" />
              <span className="text-white text-xl font-bold">AnchorVault</span>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-white hover:opacity-80 transition-opacity"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center flex-1 gap-8 text-center mt-10">
            <button onClick={() => { setMobileMenuOpen(false); setCurrentView("home"); }} className="text-2xl text-white font-medium hover:opacity-80 cursor-pointer">Overview</button>
            <button onClick={() => { setMobileMenuOpen(false); setCurrentView("whitepaper"); }} className="text-2xl text-white font-medium hover:opacity-80 cursor-pointer">Whitepaper</button>
            <button onClick={() => { setMobileMenuOpen(false); setCurrentView("docs"); }} className="text-2xl text-white font-medium hover:opacity-80 cursor-pointer">Docs</button>
            <button onClick={() => { setMobileMenuOpen(false); setCurrentView("home"); setTimeout(() => document.getElementById("protocol")?.scrollIntoView({ behavior: 'smooth' }), 150); }} className="text-2xl text-white font-medium hover:opacity-80 cursor-pointer">Staking</button>
            <button onClick={() => { setMobileMenuOpen(false); setCurrentView("home"); setTimeout(() => document.getElementById("contracts")?.scrollIntoView({ behavior: 'smooth' }), 150); }} className="text-2xl text-white font-medium hover:opacity-80 cursor-pointer">Contracts</button>
            
            <div className="flex flex-col gap-4 w-full max-w-xs mt-8">
              <button 
                onClick={() => { setMobileMenuOpen(false); if (!walletConnected) handleConnectWallet(); else { setShowDashboard(true); setDashboardTab("wallet"); } }}
                className="bg-white border border-[#d4d4d4] rounded-[8px] text-[#171717] font-semibold text-base py-3 hover:bg-white/90 w-full"
              >
                {walletConnected ? `${walletAddress.substring(0, 4)}...${walletAddress.substring(38)}` : "connect wallet"}
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); if (walletConnected) { setShowDashboard(true); setDashboardTab("overview"); } else { handleConnectWallet(); } }}
                className="bg-[#7b39fc] rounded-[8px] text-[#fafafa] font-semibold text-base py-3 hover:bg-[#8b4eff] w-full shadow-lg shadow-[#7b39fc]/20"
              >
                Launch DeFi Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {currentView === "home" && (
        <>
          {/* HERO SECTION: Full-bleed background video */}
          <section className="relative min-h-screen h-screen w-full bg-black overflow-hidden flex items-center justify-center">
        
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-100"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260210_031346_d87182fb-b0af-4273-84d1-c6fd17d6bf0f.mp4"
        />

        {/* Hero Content Wrapper */}
        <div className="relative z-10 flex flex-col items-center text-center justify-center px-4 w-full max-w-[1320px] mx-auto mt-20">
          
          {/* Tagline Pill */}
          <div className="bg-[rgba(85,80,110,0.4)] backdrop-blur border border-[rgba(164,132,215,0.5)] rounded-[10px] h-[38px] flex items-center px-3 gap-2 shadow-lg">
            <span className="bg-[#7b39fc] text-[10px] font-cabin font-medium text-white px-2 py-0.5 rounded-[6px] uppercase tracking-wider">Live</span>
            <span className="font-cabin font-medium text-[14px] text-white">Say Hello to Soroban Core v2.0</span>
          </div>

          {/* Headline */}
          <h1 className="font-instrument text-white text-5xl md:text-[96px] leading-[1.1] max-w-[900px] mt-6 tracking-tight">
            Earn stablecoin yield instantly <span className="italic font-light mx-2 text-[#7b39fc]">and</span> trustlessly
          </h1>

          {/* Subtext */}
          <p className="font-inter font-normal text-[18px] text-white/70 max-w-[662px] mt-6 leading-relaxed">
            Discover handpicked remittance corridors, lock secure liquidity into Soroban smart contracts, and earn organic yield from global payment volume. Enjoy Freighter wallet security, automated settlements, and zero-fee dispute claims.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-row items-center gap-4 mt-8">
            <button 
              onClick={walletConnected ? () => { setShowDashboard(true); setDashboardTab("overview"); } : handleConnectWallet}
              className="bg-[#7b39fc] hover:bg-[#8b4eff] text-white font-cabin font-medium text-[16px] px-8 py-3.5 rounded-[10px] transition-all shadow-lg shadow-[#7b39fc]/20 transform hover:-translate-y-0.5 duration-200"
            >
              Launch DeFi Portal
            </button>
            <button 
              onClick={walletConnected ? () => { setShowDashboard(true); setDashboardTab("registry"); } : handleConnectWallet}
              className="bg-[#2b2344] hover:bg-[#3b325c] text-[#f6f7f9] font-cabin font-medium text-[16px] px-8 py-3.5 rounded-[10px] transition-all transform hover:-translate-y-0.5 duration-200"
            >
              View Anchor Registry
            </button>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-black z-[12]" />
      </section>

      {/* WRAPPER FOR REMAINING SECTIONS */}
      <div className="w-full max-w-[1400px] mx-auto flex flex-col items-center">
        
        {/* PROTOCOL FEATURES SECTION */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="w-full mt-24 mb-16"
        >
          <FeaturesGrid />
        </motion.div>

        {/* BIONOVA HERO SECTION */}
        <motion.div 
          initial={{ opacity: 0, y: 120, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-150px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full my-24"
        >
          <BionovaHero />
        </motion.div>

        {/* CONTRACTS / KEY ADVANTAGES SECTION */}
        <section id="contracts" className="relative w-full bg-black px-4 sm:px-6 md:px-10 py-12 sm:py-20 flex flex-col items-center">
          
          <h2 className="text-white text-3xl sm:text-4xl md:text-5xl font-light text-center mb-12 sm:mb-24 hero-title uppercase tracking-wide">
            Protocol Advantages
          </h2>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 w-full">
            
            {/* Card 1 */}
            <div className="relative h-[380px] sm:h-[460px] rounded-2xl bg-neutral-950/95 border border-white/5 overflow-hidden p-6 sm:p-8 flex flex-col justify-start group hover:border-white/10 transition-all duration-300">
              
              {/* Blurred blob */}
              <div className="absolute top-1/2 -translate-y-1/2 -left-[420px] h-[460px] w-[460px] rounded-full bg-[#00e5ff] blur-3xl opacity-20 transition-transform duration-700 group-hover:scale-110 pointer-events-none" />
              
              <h3 className="relative z-10 text-xl sm:text-2xl font-light leading-tight text-white/95">
                Real-World Yield / <br /> Corridor Off-ramps
              </h3>

              <p className="relative z-10 mt-12 sm:mt-20 text-[13px] sm:text-[14px] leading-relaxed text-white/70 font-light max-w-[280px]">
                AnchorVault LPs deposit USDC directly into Soroban smart contracts to facilitate active remittance pools. Yield is organic, generated from real transactions handled by authorized Stellar anchors.
              </p>

            </div>

            {/* Card 2 */}
            <div className="relative h-[380px] sm:h-[460px] rounded-2xl bg-neutral-950 border border-white/5 overflow-hidden flex flex-col group hover:border-white/10 transition-all duration-300">
              
              {/* Top video region */}
              <div className="relative w-full h-[75%] overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover block"
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260421_072701_f6a01abb-eb30-4559-9d6e-774362defbc3.mp4"
                />
                
                {/* Bottom fade inside video */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-neutral-950 z-[2]" />
              </div>

              {/* Under video */}
              <div className="flex-1 flex items-center justify-start p-6 sm:p-8 bg-neutral-950 relative z-10">
                <h3 className="text-xl sm:text-2xl font-light leading-tight text-white/95">
                  Soroban Powered / <br /> On-chain Safety
                </h3>
              </div>

            </div>

            {/* Card 3 */}
            <div className="relative h-[380px] sm:h-[460px] rounded-2xl bg-neutral-950/95 border border-white/5 overflow-hidden p-6 sm:p-8 flex flex-col justify-start group hover:border-white/10 transition-all duration-300">
              
              {/* Blurred blob */}
              <div className="absolute -top-28 -right-28 h-56 w-56 rounded-full bg-[#1e3a8a] blur-3xl opacity-40 transition-transform duration-700 group-hover:scale-110 pointer-events-none" />

              <h3 className="relative z-10 text-xl sm:text-2xl font-light leading-tight text-white/95">
                Automated Registry / <br /> Reputation & Stakes
              </h3>

              <p className="relative z-10 mt-auto text-[13px] sm:text-[14px] leading-relaxed text-white/70 font-light max-w-[320px]">
                Stellar anchors lock reputation stakes in our AnchorRegistry contract, ensuring high performance, zero-fee disputes, and instant liquidation protections for decentralized liquidity providers.
              </p>

            </div>

          </div>

        </section>

      </div>
        </>
      )}

      {currentView === "whitepaper" && <WhitepaperView />}
      {currentView === "docs" && <DocsView activeTab={docsTab} setActiveTab={setDocsTab} />}
      {currentView === "privacy" && <PrivacyView />}
      {currentView === "terms" && <TermsView />}

      {/* PREMIUM LIQUID GLASS FOOTER */}
      <footer className="w-full max-w-[1320px] mx-auto px-6 mb-16 relative z-10 mt-32">
        <div className="liquid-glass rounded-3xl p-8 lg:p-12 relative overflow-hidden">
          
          {/* Subtle glow effects in corners */}
          <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-purple-500/10 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 relative z-10">
            
            {/* Branding Column */}
            <div className="md:col-span-5 flex flex-col items-start gap-4">
              <div className="flex items-center gap-4">
                <LogoMark className="h-14 w-14 text-white" />
                <span className="text-white text-2xl font-bold tracking-tight">AnchorVault</span>
              </div>
              <p className="text-neutral-400 text-sm font-light leading-relaxed max-w-sm">
                The trustless Soroban routing engine bridging stablecoins with Stellar anchor corridors. Deployed securely on Mainnet.
              </p>
              
              {/* Network Status Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-green-400 select-none">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span>Soroban Mainnet Active</span>
              </div>
            </div>

            {/* Links Columns */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
              
              {/* Column 1: Protocol */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold tracking-wider text-white uppercase opacity-40">Protocol</span>
                <button onClick={() => { setCurrentView("home"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-sm text-left text-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer">Overview</button>
                <button onClick={() => setCurrentView("whitepaper")} className="text-sm text-left text-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer">Whitepaper</button>
                <button onClick={() => { setCurrentView("docs"); setDocsTab("getting-started"); }} className="text-sm text-left text-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer">Documentation</button>
              </div>

              {/* Column 2: Developers */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold tracking-wider text-white uppercase opacity-40">Developers</span>
                <a href="https://github.com/stellar" target="_blank" rel="noreferrer" className="text-sm text-neutral-400 hover:text-white transition-colors duration-200">Soroban SDK</a>
                <button onClick={() => { setCurrentView("docs"); setDocsTab("smart-contracts"); }} className="text-sm text-left text-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer">Smart Contracts</button>
                <a href="https://developers.stellar.org/" target="_blank" rel="noreferrer" className="text-sm text-neutral-400 hover:text-white transition-colors duration-200">Stellar Docs</a>
              </div>

              {/* Column 3: Security */}
              <div className="flex flex-col gap-3 col-span-2 sm:col-span-1">
                <span className="text-xs font-semibold tracking-wider text-white uppercase opacity-40">Security</span>
                <button onClick={() => { setCurrentView("docs"); setDocsTab("accuracy-math"); }} className="text-sm text-left text-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer">Audit Reports</button>
                <button onClick={() => setCurrentView("privacy")} className="text-sm text-left text-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer">Privacy Policy</button>
                <button onClick={() => setCurrentView("terms")} className="text-sm text-left text-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer">Terms of Use</button>
              </div>

            </div>

          </div>

          {/* Separation line inside liquid glass */}
          <div className="h-px bg-white/10 my-8 w-full relative z-10" />

          {/* Bottom Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
            <span className="text-xs text-neutral-500 font-light">
              &copy; {new Date().getFullYear()} AnchorVault Protocol. All rights reserved. Deployed securely on Soroban Mainnet.
            </span>

            {/* Stylized Social Buttons */}
            <div className="flex items-center gap-3">
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noreferrer"
                className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200"
              >
                <TwitterIcon className="w-4 h-4" />
              </a>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noreferrer"
                className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200"
              >
                <GithubIcon className="w-4 h-4" />
              </a>
              <a 
                href="https://discord.com" 
                target="_blank" 
                rel="noreferrer"
                className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200"
              >
                <MessageSquare className="w-4 h-4" />
              </a>
            </div>

          </div>

        </div>
      </footer>

      {/* =================================================================== */}
      {/*              ANCHORVAULT HIGH-FIDELITY DEFI APP MODAL             */}
      {/* =================================================================== */}
      {showDashboard && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/10 rounded-3xl max-w-4xl w-full h-[85vh] overflow-hidden shadow-2xl shadow-black relative flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-neutral-900/40">
              <div className="flex items-center gap-3">
                <LogoMark className="h-12 w-12" />
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <span>AnchorVault Portal</span>
                    <span className="bg-green-500/10 text-green-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-green-500/20">
                      Stellar Testnet
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400">Soroban Smart Contract Integrations</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowDashboard(false);
                  setTxStep("idle");
                  setTxProgress(0);
                }}
                className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Layout: Sidebar & Content */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* Sidebar Tabs */}
              <div className="w-1/4 border-r border-white/5 p-4 flex flex-col gap-2 bg-neutral-900/10">
                {[
                  { id: "overview", icon: <Activity className="h-4 w-4" />, label: "Overview" },
                  { id: "deposit", icon: <Coins className="h-4 w-4" />, label: "Deposit & Earn" },
                  { id: "withdraw", icon: <ArrowDownLeft className="h-4 w-4" />, label: "Withdraw" },
                  { id: "registry", icon: <Globe className="h-4 w-4" />, label: "Anchor Registry" },
                  { id: "wallet", icon: <Wallet className="h-4 w-4" />, label: "Wallet" },
                  { id: "history", icon: <Clock className="h-4 w-4" />, label: "Tx History" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDashboardTab(tab.id as any)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${
                      dashboardTab === tab.id 
                        ? "bg-white text-black font-semibold" 
                        : "text-neutral-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}

                {/* Refresh + Status */}
                <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
                  <button
                    onClick={refreshOnChainData}
                    disabled={isLoadingData}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
                    <span>{isLoadingData ? "Syncing..." : "Refresh Data"}</span>
                  </button>
                  {lastRefresh && (
                    <span className="text-[9px] text-neutral-600 px-4 font-mono">
                      Last sync: {lastRefresh.toLocaleTimeString()}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 px-4">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] text-green-400 font-mono">Soroban Testnet Live</span>
                  </div>
                </div>
              </div>

              {/* Tab Content Panel */}
              <div className="flex-1 p-6 overflow-y-auto bg-black">
                
                {/* 1. OVERVIEW TAB */}
                {dashboardTab === "overview" && (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4">
                        <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Pool TVL (On-Chain)</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 text-white">
                          {poolState ? `${Number(poolState.reserveBalance + poolState.activeDraws) / 1e7} USDC` : isLoadingData ? <Loader2 className="h-5 w-5 animate-spin" /> : "—"}
                        </div>
                        <div className="text-[10px] text-green-400 flex items-center gap-1 mt-1">
                          <span className="font-semibold">Live</span>
                          <span>Soroban RPC</span>
                        </div>
                      </div>
                      <div className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4">
                        <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Your LP Shares</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 text-[#00e5ff]">{balances.lpShares || "0"}</div>
                        <div className="text-[10px] text-cyan-400 flex items-center gap-1 mt-1">
                          <span className="font-semibold">Pending Yield:</span>
                          <span>{pendingYield} USDC</span>
                        </div>
                      </div>
                      <div className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4">
                        <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Pool Utilization</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 text-[#FA8453]">
                          {poolState ? `${((Number(poolState.activeDraws) / Math.max(1, Number(poolState.reserveBalance + poolState.activeDraws))) * 100).toFixed(1)}%` : "—"}
                        </div>
                        <div className="text-[10px] text-[#FA8453] flex items-center gap-1 mt-1">
                          <span className="font-semibold">Active Draws:</span>
                          <span>{poolState ? `${Number(poolState.activeDraws) / 1e7} USDC` : "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contract Addresses */}
                    <div className="bg-neutral-950 border border-white/5 rounded-2xl p-5">
                      <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-neutral-400">Deployed Contracts (Testnet)</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "CoreVault", addr: CONTRACT_ADDRESSES.CORE_VAULT, color: "text-purple-400" },
                          { label: "AnchorRegistry", addr: CONTRACT_ADDRESSES.ANCHOR_REGISTRY, color: "text-cyan-400" },
                          { label: "Governance Token", addr: CONTRACT_ADDRESSES.GOVERNANCE_TOKEN, color: "text-green-400" },
                          { label: "USDC Token", addr: CONTRACT_ADDRESSES.USDC, color: "text-yellow-400" },
                        ].map((c) => (
                          <a key={c.label} href={getStellarExpertContractUrl(c.addr)} target="_blank" rel="noreferrer"
                            className="bg-neutral-900/50 border border-white/5 rounded-xl p-3 hover:border-white/15 transition-all group">
                            <div className={`text-[10px] font-semibold ${c.color}`}>{c.label}</div>
                            <div className="text-[9px] font-mono text-neutral-400 mt-1 truncate group-hover:text-white transition-colors">{c.addr}</div>
                            <ExternalLink className="h-2.5 w-2.5 text-neutral-600 mt-1" />
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Real Transaction History */}
                    <div className="bg-neutral-950 border border-white/5 rounded-2xl p-5">
                      <h4 className="font-semibold text-sm mb-4 uppercase tracking-wider text-neutral-400">Recent On-Chain Activity</h4>
                      <div className="flex flex-col gap-3">
                        {txHistory.length === 0 && !isLoadingData && (
                          <div className="text-center py-6 text-neutral-500 text-xs">No transactions found for this wallet. Deposit USDC to get started.</div>
                        )}
                        {isLoadingData && txHistory.length === 0 && (
                          <div className="flex items-center justify-center py-6 gap-2 text-neutral-400 text-xs"><Loader2 className="h-4 w-4 animate-spin" /> Loading from Horizon...</div>
                        )}
                        {txHistory.slice(0, 8).map((tx) => (
                          <a key={tx.id} href={getStellarExpertTxUrl(tx.hash)} target="_blank" rel="noreferrer"
                            className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-xl border border-white/5 font-mono text-xs hover:border-white/15 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                                tx.type === "deposit" ? "bg-green-500/10 border border-green-500/30" :
                                tx.type === "withdrawal" ? "bg-red-500/10 border border-red-500/30" :
                                "bg-cyan-500/10 border border-cyan-500/30"
                              }`}>
                                {tx.type === "deposit" ? <ArrowDownLeft className="h-3 w-3 text-green-400" /> :
                                 tx.type === "withdrawal" ? <ArrowUpRight className="h-3 w-3 text-red-400" /> :
                                 <RefreshCw className="h-3 w-3 text-cyan-400" />}
                              </div>
                              <span className="capitalize font-semibold text-neutral-200">{tx.type}</span>
                            </div>
                            <div className="text-white font-semibold">{tx.amount ? `${tx.amount} ${tx.asset}` : tx.asset}</div>
                            <div className="text-neutral-400">{formatAddress(tx.from)}</div>
                            <div className="text-neutral-500">{timeAgo(tx.timestamp)}</div>
                            <ExternalLink className="h-3 w-3 text-neutral-600" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. DEPOSIT & EARN TAB */}
                {dashboardTab === "deposit" && (
                  <div className="flex flex-col gap-6">
                    <div className="bg-neutral-950 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                      <div>
                        <h4 className="font-semibold text-lg">Corridor Liquidity Pool</h4>
                        <p className="text-xs text-neutral-400 mt-1">
                          Deposit USDC to mint liquidity tokens ($VAULT-LP). Funds are allocated to cover real-time settlement windows for authorized anchors.
                        </p>
                      </div>

                      {!walletConnected ? (
                        <div className="flex flex-col items-center py-8 text-center bg-neutral-900/30 rounded-2xl border border-white/5 border-dashed">
                          <Wallet className="h-8 w-8 text-[#FA8453] mb-3" />
                          <h5 className="font-semibold text-sm">Freighter Wallet Required</h5>
                          <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                            Please connect your wallet to view custom balances and sign Soroban smart contract transactions.
                          </p>
                          <button
                            onClick={handleConnectWallet}
                            className="mt-4 bg-white text-black font-semibold text-xs px-5 py-2.5 rounded-full hover:bg-neutral-200 transition-colors"
                          >
                            connect freighter
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-6 mt-2">
                          {/* Deposit box */}
                          <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-400">Stablecoin balance</span>
                              <span className="font-mono text-white font-bold">{balances.usdc} USDC</span>
                            </div>

                            <form onSubmit={executeDeposit} className="flex flex-col gap-3">
                              <div className="relative">
                                <input
                                  type="number"
                                  required
                                  value={depositAmount}
                                  onChange={(e) => setDepositAmount(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00e5ff]"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-neutral-400">USDC</span>
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-[#FA8453] to-[#F8C9B2] text-black font-semibold py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all text-xs flex items-center justify-center gap-1 shadow-md shadow-[#FA8453]/25"
                              >
                                <span>Deposit USDC</span>
                                <ArrowUpRight className="h-4 w-4" />
                              </button>
                            </form>
                          </div>

                          {/* Pool Status info */}
                          <div className="flex flex-col justify-between bg-neutral-900/20 border border-white/5 rounded-2xl p-4 font-mono text-xs">
                            <div className="flex flex-col gap-3">
                              <div className="flex justify-between pb-2 border-b border-white/5">
                                <span className="text-neutral-500">POOL CONTRACT:</span>
                                <span className="text-neutral-400 select-all font-mono">{CONTRACT_ADDRESSES.CORE_VAULT.substring(0, 8)}...</span>
                              </div>
                              <div className="flex justify-between pb-2 border-b border-white/5">
                                <span className="text-neutral-500">YOUR LP BALANCE:</span>
                                <span className="text-white font-bold">{balances.lpShares} LP</span>
                              </div>
                              <div className="flex justify-between pb-2 border-b border-white/5">
                                <span className="text-neutral-500">FEE DISTRIBUTION:</span>
                                <span className="text-green-400 font-bold">0.15% per tx</span>
                              </div>
                              <div className="flex justify-between pb-2">
                                <span className="text-neutral-500">WITHDRAW NOTICE:</span>
                                <span className="text-yellow-500 font-semibold">48 hr window</span>
                              </div>
                            </div>

                            <p className="text-[10px] text-neutral-500 font-light mt-4 font-sans leading-relaxed">
                              * Deposits securely credit liquidity shares into Soroban. Transaction fees automatically compound within pool TVL.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Real Transaction Status */}
                    {txStep !== "idle" && (
                      <div className="bg-neutral-950 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-400">Soroban Transaction</span>
                          <span className="font-mono text-[#FA8453] uppercase font-semibold">
                            {txStep === "building" && "building transaction XDR..."}
                            {txStep === "signing" && "awaiting wallet signature..."}
                            {txStep === "submitting" && "submitting to network..."}
                            {txStep === "confirming" && "confirming on ledger..."}
                            {txStep === "success" && "✓ confirmed on-chain!"}
                            {txStep === "error" && "✗ transaction failed"}
                          </span>
                        </div>

                        <div className="bg-black/90 p-4 rounded-xl border border-white/5 font-mono text-[11px] text-neutral-300 flex flex-col gap-2 min-h-[100px]">
                          <div className="flex items-center gap-1.5 text-neutral-500">
                            <span>$</span>
                            <span>soroban contract invoke --id {CONTRACT_ADDRESSES.CORE_VAULT.substring(0, 12)}...</span>
                          </div>
                          
                          {(txStep === "building") && (
                            <><div className="text-cyan-400">[RPC] Connecting to soroban-testnet.stellar.org...</div>
                            <div className="text-white">[BUILD] Simulating transaction footprint...</div>
                            <div className="text-[#FA8453] font-semibold flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Assembling XDR...</div></>
                          )}
                          {txStep === "signing" && (
                            <><div className="text-green-400">[OK] Transaction XDR assembled successfully</div>
                            <div className="text-yellow-500 animate-pulse">[WALLET] Requesting Freighter signature...</div></>
                          )}
                          {txStep === "submitting" && (
                            <><div className="text-green-400">[OK] Wallet signature received</div>
                            <div className="text-white flex items-center gap-2">[SUBMIT] Broadcasting to Stellar network... <Loader2 className="h-3 w-3 animate-spin" /></div></>
                          )}
                          {txStep === "success" && (
                            <><div className="text-green-400">[OK] Transaction confirmed on ledger #{txLedger}</div>
                            <div className="text-green-400 font-semibold">[CONFIRMED] On-chain settlement finalized!</div>
                            <a href={getStellarExpertTxUrl(txHash)} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline break-all">
                              TX: {txHash} ↗
                            </a></>
                          )}
                          {txStep === "error" && (
                            <div className="text-red-400 font-semibold">[ERROR] {txError}</div>
                          )}
                        </div>

                        <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${txStep === "error" ? "bg-red-500" : "bg-gradient-to-r from-[#FA8453] to-[#F8C9B2]"}`}
                            style={{ width: `${txStep === "success" ? 100 : txProgress}%` }}
                          />
                        </div>

                        {(txStep === "success" || txStep === "error") && (
                          <div className="flex gap-3 justify-end">
                            {txStep === "success" && txHash && (
                              <a href={getStellarExpertTxUrl(txHash)} target="_blank" rel="noreferrer"
                                className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold text-xs py-2 rounded-lg px-4 hover:bg-cyan-500/20 transition-colors flex items-center gap-1">
                                View on Stellar Expert <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              onClick={() => { setTxStep("idle"); setDepositAmount(""); setWithdrawShares(""); setTxError(""); }}
                              className="bg-white text-black font-semibold text-xs py-2 rounded-lg hover:bg-neutral-200 px-6 transition-colors">
                              Close
                            </button>
                          </div>
                        )}

                      </div>
                    )}

                  </div>
                )}

                {/* 3. ANCHOR REGISTRY TAB */}
                {dashboardTab === "registry" && (
                  <div className="flex flex-col gap-6">
                    <div className="bg-neutral-950 border border-white/5 rounded-2xl p-5">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h4 className="font-semibold text-lg">Anchor Registry Stake List</h4>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Stellar Anchors lock reputation collateral into `CAWO6A52...` to qualify for settlement corridor routing.
                          </p>
                        </div>
                        <div className="text-neutral-400 hover:text-white cursor-pointer p-2 bg-neutral-900 rounded-lg flex items-center gap-1 text-xs">
                          <span className="font-mono">{CONTRACT_ADDRESSES.ANCHOR_REGISTRY.substring(0, 10)}...</span>
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      </div>

                      {/* Anchor registry cards */}
                      <div className="flex flex-col gap-4">
                        {registeredAnchors.length === 0 ? (
                          <div className="text-center py-8 text-neutral-500 font-mono text-xs flex items-center justify-center gap-2 bg-neutral-900/20 border border-white/5 rounded-xl">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                            <span>Fetching on-chain anchor registry states from Stellar Testnet...</span>
                          </div>
                        ) : (
                          registeredAnchors.map((anchor, idx) => (
                            <div key={idx} className="bg-neutral-900/60 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between font-mono text-xs gap-3 hover:border-cyan-500/20 transition-all">
                              <div className="flex items-center gap-3 w-full md:w-[30%]">
                                <div className="h-8 w-8 bg-white/5 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white font-sans text-sm flex items-center gap-1.5">
                                    <span>{anchor.name}</span>
                                    <span className="text-[10px] font-mono text-cyan-400 font-normal opacity-70" title={anchor.address}>
                                      ({formatAddress(anchor.address, 4)})
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 font-light mt-0.5">{anchor.corridor}</div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col w-full md:w-[20%]">
                                <span className="text-[9px] text-neutral-500 uppercase">LOCKED COLLATERAL</span>
                                <span className="text-white mt-0.5 font-bold font-sans">{parseFloat(anchor.lockedCollateral).toLocaleString()} $VAULT</span>
                              </div>

                              <div className="flex flex-col w-full md:w-[20%]">
                                <span className="text-[9px] text-neutral-500 uppercase">REPUTATION SCORE</span>
                                <span className="text-green-400 mt-0.5 font-bold font-sans">{anchor.reputationScore}</span>
                              </div>

                              <div className="flex flex-col w-full md:w-[20%]">
                                <span className="text-[9px] text-neutral-500 uppercase">CREDIT LIMIT</span>
                                <span className="text-white mt-0.5 font-bold font-sans">{parseFloat(anchor.creditLimit).toLocaleString()} USDC</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`h-2 w-2 rounded-full animate-pulse ${anchor.isWhitelisted ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className={`font-bold uppercase tracking-wider text-[10px] ${anchor.isWhitelisted ? 'text-green-400' : 'text-red-400'}`}>
                                  {anchor.status}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. WALLET TAB */}
                {dashboardTab === "wallet" && (
                  <div className="flex flex-col gap-6 font-mono text-xs">
                    <div className="bg-neutral-950 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between pb-3 border-b border-white/5">
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-neutral-400">On-Chain Wallet State</h4>
                        <a href={getStellarExpertAccountUrl(walletAddress)} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-cyan-400 hover:underline text-[10px]">
                          View on Stellar Expert <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex flex-col gap-2 bg-black p-4 rounded-xl border border-white/5">
                        <span className="text-neutral-500 text-[10px]">WALLET ADDRESS (PUBLIC KEY)</span>
                        <span className="text-white select-all break-all text-sm font-semibold">{walletAddress}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                          <span className="text-neutral-500 text-[9px] uppercase tracking-wider">USDC Balance</span>
                          <span className="text-lg font-bold text-white font-sans">{balances.usdc} USDC</span>
                          <a href={getStellarExpertContractUrl(CONTRACT_ADDRESSES.USDC)} target="_blank" rel="noreferrer" className="text-[9px] text-cyan-400 hover:underline mt-1 truncate">{CONTRACT_ADDRESSES.USDC}</a>
                        </div>
                        <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                          <span className="text-neutral-500 text-[9px] uppercase tracking-wider">XLM (Native)</span>
                          <span className="text-lg font-bold text-white font-sans">{balances.xlm} XLM</span>
                          <span className="text-[9px] text-neutral-400 mt-1">Network gas fees</span>
                        </div>
                        <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                          <span className="text-neutral-500 text-[9px] uppercase tracking-wider">$VAULT Token</span>
                          <span className="text-lg font-bold text-white font-sans">{balances.vaultToken} $VAULT</span>
                          <a href={getStellarExpertContractUrl(CONTRACT_ADDRESSES.GOVERNANCE_TOKEN)} target="_blank" rel="noreferrer" className="text-[9px] text-cyan-400 hover:underline mt-1 truncate">{CONTRACT_ADDRESSES.GOVERNANCE_TOKEN}</a>
                        </div>
                        <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                          <span className="text-neutral-500 text-[9px] uppercase tracking-wider">LP Shares</span>
                          <span className="text-lg font-bold text-white font-sans">{balances.lpShares} LP</span>
                          <a href={getStellarExpertContractUrl(CONTRACT_ADDRESSES.CORE_VAULT)} target="_blank" rel="noreferrer" className="text-[9px] text-cyan-400 hover:underline mt-1 truncate">{CONTRACT_ADDRESSES.CORE_VAULT}</a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] text-neutral-500">Pending Yield:</span>
                        <span className="text-[11px] text-green-400 font-bold">{pendingYield} USDC</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. WITHDRAW TAB */}
                {dashboardTab === "withdraw" && (
                  <div className="flex flex-col gap-6">
                    <div className="bg-neutral-950 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                      <div>
                        <h4 className="font-semibold text-lg">Withdraw Liquidity</h4>
                        <p className="text-xs text-neutral-400 mt-1">Redeem your LP shares to withdraw USDC + accrued corridor yield back to your wallet.</p>
                      </div>
                      <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-400">Your LP Shares</span>
                          <span className="font-mono text-white font-bold">{balances.lpShares} LP</span>
                        </div>
                        <form onSubmit={executeWithdraw} className="flex flex-col gap-3">
                          <div className="relative">
                            <input type="number" required value={withdrawShares} onChange={(e) => setWithdrawShares(e.target.value)}
                              placeholder="0.00" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00e5ff]" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-neutral-400">LP</span>
                          </div>
                          <button type="submit" disabled={txStep !== "idle"}
                            className="w-full bg-gradient-to-r from-[#00e5ff] to-[#7b39fc] text-white font-semibold py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all text-xs flex items-center justify-center gap-1 shadow-md disabled:opacity-50">
                            <span>Withdraw & Claim Yield</span>
                            <ArrowDownLeft className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </div>
                    {txStep !== "idle" && dashboardTab === "withdraw" && (
                      <div className="text-xs text-neutral-400 font-mono bg-neutral-900/30 p-3 rounded-xl border border-white/5">
                        Status: <span className="text-[#FA8453] font-semibold">{txStep}</span>
                        {txHash && <a href={getStellarExpertTxUrl(txHash)} target="_blank" rel="noreferrer" className="ml-2 text-cyan-400 hover:underline">View TX ↗</a>}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. TX HISTORY TAB */}
                {dashboardTab === "history" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-neutral-400">Full Transaction History</h4>
                      <button onClick={refreshOnChainData} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
                        <RefreshCw className={`h-3 w-3 ${isLoadingData ? "animate-spin" : ""}`} /> Refresh
                      </button>
                    </div>
                    {txHistory.length === 0 && !isLoadingData && (
                      <div className="text-center py-12 text-neutral-500 text-xs">No on-chain transactions found for this wallet address.</div>
                    )}
                    {txHistory.map((tx) => (
                      <a key={tx.id} href={getStellarExpertTxUrl(tx.hash)} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-4 bg-neutral-900/50 rounded-xl border border-white/5 font-mono text-xs hover:border-white/15 transition-all">
                        <div className="flex items-center gap-3 min-w-[120px]">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                            tx.type === "deposit" ? "bg-green-500/10 border border-green-500/30" :
                            tx.type === "withdrawal" ? "bg-red-500/10 border border-red-500/30" :
                            tx.type === "contract_call" ? "bg-purple-500/10 border border-purple-500/30" :
                            "bg-cyan-500/10 border border-cyan-500/30"
                          }`}>
                            {tx.type === "deposit" ? <ArrowDownLeft className="h-3.5 w-3.5 text-green-400" /> :
                             tx.type === "withdrawal" ? <ArrowUpRight className="h-3.5 w-3.5 text-red-400" /> :
                             tx.type === "contract_call" ? <Activity className="h-3.5 w-3.5 text-purple-400" /> :
                             <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="capitalize font-semibold text-neutral-200">{tx.type.replace("_", " ")}</span>
                            <span className="text-[9px] text-neutral-500">{tx.status}</span>
                          </div>
                        </div>
                        <div className="text-white font-semibold">{tx.amount ? `${tx.amount} ${tx.asset}` : tx.asset}</div>
                        <div className="text-neutral-400 text-[10px]">{formatAddress(tx.hash, 6)}</div>
                        <div className="text-neutral-500">{timeAgo(tx.timestamp)}</div>
                        <ExternalLink className="h-3 w-3 text-neutral-600" />
                      </a>
                    ))}
                  </div>
                )}

              </div>

            </div>

          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/*              AURORA SIGN UP & STELLAR WALLET SELECTOR MODAL         */}
      {/* =================================================================== */}
      {showSignUpModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-2 lg:p-4 overflow-y-auto">
          <main className="flex flex-col lg:flex-row min-h-screen lg:min-h-0 w-full bg-black selection:bg-white/30 p-2 transition-all duration-500 rounded-3xl border border-white/10 max-w-7xl lg:h-[85vh] lg:overflow-hidden lg:p-4 relative">
            
            {/* Close Modal Button */}
            <button 
              onClick={() => setShowSignUpModal(false)}
              className="absolute top-6 right-6 z-30 h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-colors text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Left Column (Hero & Background Video) */}
            <div className="hidden lg:flex lg:w-[52%] relative flex-col items-center justify-end pb-24 px-12 rounded-3xl overflow-hidden shadow-2xl h-full select-none">
              
              {/* Background Video */}
              <video 
                autoPlay 
                muted 
                loop 
                playsInline 
                className="absolute inset-0 w-full h-full object-cover z-0"
              >
                <source 
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4" 
                  type="video/mp4" 
                />
              </video>

              {/* Hero Content Container */}
              <motion.div 
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.15,
                      delayChildren: 0.2
                    }
                  }
                }}
                className="relative z-10 w-full max-w-xs space-y-8"
              >
                {/* Brand / Logo */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
                  }}
                  className="flex items-center gap-4"
                >
                  <LogoMark className="w-14 h-14 object-contain" />
                  <span className="text-2xl font-bold tracking-tight text-white">AnchorVault</span>
                </motion.div>

                {/* Heading Block */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
                  }}
                  className="space-y-2"
                >
                  <h2 className="text-3xl font-medium tracking-tight text-white">Non-Custodial Portal</h2>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Connect your own wallet directly to access trustless stablecoin corridors on-chain.
                  </p>
                </motion.div>

                {/* Steps List */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
                  }}
                  className="flex flex-col gap-3 w-full"
                >
                  <div className={`flex items-center gap-4 p-4 rounded-2xl w-full transition-all duration-300 ${
                    signUpStep === 1 
                      ? "bg-white text-black border border-white shadow-xl translate-x-1" 
                      : "bg-brand-gray text-white border-none"
                  }`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      signUpStep === 1 
                        ? "bg-black text-white" 
                        : "bg-white/10 text-white/40"
                    }`}>
                      1
                    </div>
                    <span className="text-sm font-medium tracking-tight">Link non-custodial address</span>
                  </div>

                  <div className={`flex items-center gap-4 p-4 rounded-2xl w-full transition-all duration-300 ${
                    signUpStep === 3 
                      ? "bg-white text-black border border-white shadow-xl translate-x-1" 
                      : "bg-brand-gray text-white border-none"
                  }`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      signUpStep === 3 
                        ? "bg-black text-white" 
                        : "bg-white/10 text-white/40"
                    }`}>
                      2
                    </div>
                    <span className="text-sm font-medium tracking-tight">Enter DeFi Dashboard</span>
                  </div>
                </motion.div>
              </motion.div>
            </div>

            {/* Right Column (Sign Up Form & Wallet Connect) */}
            <div className="flex-1 flex flex-col items-center justify-center py-12 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-y-auto relative">
              
              <motion.div 
                key={connectingWallet ? "connecting" : signUpStep}
                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
                className="w-full max-w-xl space-y-8 lg:space-y-6 sm:space-y-10"
              >
                {connectingWallet ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                    <div className="relative flex items-center justify-center animate-pulse">
                      <div className="h-24 w-24 rounded-full border-4 border-white/5 border-t-[#7b39fc] animate-spin" />
                      <div className="absolute h-14 w-14 rounded-full border border-white/10 flex items-center justify-center bg-black shadow-lg">
                        <Wallet className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-2xl font-semibold tracking-tight text-white">Syncing Secure Bridge</h4>
                      <p className="text-white/40 text-xs font-mono max-w-xs mx-auto leading-relaxed border border-white/5 bg-white/5 rounded-xl p-3">{connectionMessage}</p>
                    </div>
                  </div>
                ) : signUpStep === 3 ? (
                  /* Success/Connected welcome page */
                  <div className="space-y-6 lg:space-y-5">
                    <div className="text-center">
                      <div className="h-14 w-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-7 w-7 text-green-400 animate-bounce" />
                      </div>
                      <h3 className="text-3xl font-medium tracking-tight text-white">Wallet Connected!</h3>
                      <p className="text-white/40 text-sm mt-1">Your non-custodial Stellar credentials have been securely loaded.</p>
                    </div>

                    <div className="bg-brand-gray rounded-2xl border border-white/5 p-5 space-y-4 font-mono text-xs text-white/80">
                      
                      <div className="flex justify-between items-center pb-2.5 border-b border-white/5">
                        <span className="text-white/40 font-sans">WALLET PROVIDER:</span>
                        <span className="bg-white/5 border border-white/10 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">{connectedWalletName}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-white/40 font-sans">ON-CHAIN PUBLIC KEY (PK):</span>
                        <span className="text-[10px] break-all select-all text-white font-semibold">{walletAddress}</span>
                      </div>

                    </div>

                    {/* Funded accounts welcome info */}
                    <div className="rounded-xl border border-[#7b39fc]/20 bg-[#7b39fc]/5 p-4 flex gap-3">
                      <div className="h-5 w-5 rounded-full bg-[#7b39fc]/20 border border-[#7b39fc]/40 flex items-center justify-center shrink-0 text-[#a855f7] mt-0.5">
                        ✨
                      </div>
                      <p className="text-xs text-purple-300 leading-relaxed font-sans">
                        Welcome to AnchorVault! Your wallet is now connected to Stellar Testnet. All balances and transactions are fetched live from the Soroban network. Use the Friendbot to fund your account with test XLM if needed.
                      </p>
                    </div>

                    <button 
                      onClick={() => {
                        setShowSignUpModal(false);
                        setShowDashboard(true);
                        setDashboardTab("overview");
                      }}
                      className="w-full h-14 bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all duration-200 mt-4 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
                    >
                      <span>Enter DeFi Portal</span>
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  /* Step 1: Compact Direct Wallet selection grid (Removed upper/lower text blocks) */
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      {SUPPORTED_WALLETS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => connectDirectly(w.id)}
                          className="group relative overflow-hidden rounded-xl border border-white/5 bg-neutral-900/50 p-3 hover:border-purple-500/40 hover:bg-white/5 hover:shadow-md hover:shadow-purple-500/5 transition-all duration-300 text-left flex flex-col gap-2 cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-1 shrink-0 group-hover:scale-105 transition-transform duration-300">
                              <img src={w.icon} alt={w.name} className="h-full w-full object-contain" />
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-xs tracking-tight">{w.name}</h4>
                            <p className="text-neutral-500 text-[9px] mt-0.5 font-light leading-snug">{w.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* WalletConnect & Other Modules Option */}
                    <button
                      type="button"
                      onClick={handleStellarWalletsKitConnect}
                      className="w-full h-11 relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-wider text-neutral-300"
                    >
                      <Globe className="w-3.5 h-3.5 text-purple-400" />
                      <span>More Options / WalletConnect</span>
                    </button>
                  </div>
                )}
              </motion.div>
            </div>

          </main>
        </div>
      )}

    </div>
  );
}





// ===================================================================
//             TECHNICAL ACADEMIC WHITEPAPER COMPONENT
// ===================================================================

function WhitepaperView() {
  const [activeSection, setActiveSection] = useState("abstract");

  const sections = [
    { id: "abstract", label: "1. Abstract" },
    { id: "corridors", label: "2. Stablecoin Corridors" },
    { id: "math", label: "3. Mathematical Yield Engine" },
    { id: "contracts", label: "4. Smart Contract Topology" },
    { id: "governance", label: "5. Stake Guarantors & Governance" }
  ];

  const handleScrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[1320px] mx-auto px-6 pt-28 lg:pt-36 min-h-screen text-white font-sans"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sticky Sidebar */}
        <div className="lg:col-span-3 lg:sticky lg:top-28 h-fit flex flex-col gap-6 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Whitepaper Index</span>
          <div className="flex flex-col gap-2">
            {sections.map(sec => (
              <button
                key={sec.id}
                onClick={() => handleScrollTo(sec.id)}
                className={`text-sm text-left font-medium py-1.5 transition-colors cursor-pointer ${
                  activeSection === sec.id ? "text-purple-400 pl-2 border-l border-purple-500" : "text-neutral-400 hover:text-white"
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>
          <div className="h-px bg-white/10 w-full" />
          <div className="text-[11px] text-neutral-500 leading-relaxed font-light">
            AnchorVault Tech-Paper v2.4.0 <br />
            Published: May 2026 <br />
            Audited & Approved
          </div>
        </div>

        {/* Paper Body */}
        <div className="lg:col-span-9 flex flex-col gap-12 font-light leading-relaxed text-neutral-300">
          <div className="flex flex-col gap-3">
            <h1 className="font-instrument text-4xl lg:text-6xl text-white tracking-tight leading-none">
              AnchorVault Protocol
            </h1>
            <p className="text-lg text-purple-300 font-normal">
              Autonomous Stablecoin Yield Routing & On-chain Corridor Settlements
            </p>
          </div>

          <div className="h-px bg-white/10 w-full" />

          {/* Section 1: Abstract */}
          <section id="abstract" className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-white tracking-tight">1. Abstract</h2>
            <p>
              In traditional remittance infrastructures, cross-border settlements incur high intermediate routing fees, settlement delays, and custodial counterparty risks. <strong>AnchorVault</strong> resolves this by establishing an autonomous routing corridor system deployed on the <strong>Stellar Soroban smart contract network</strong>.
            </p>
            <p>
              By leveraging Stellar anchor corridors (regulated gateways bridging cash-in and cash-out rails via SEP-24/SEP-31), AnchorVault allows liquidity providers to pool idle stablecoins (e.g. USDC, EURC) into smart vault structures. These vault funds are routed algorithmically through active corridor gateways, generating non-inflationary organic yield backed exclusively by cross-border settlement fees and exchange rate arbitrages.
            </p>
          </section>

          {/* Section 2: Corridors */}
          <section id="corridors" className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-white tracking-tight">2. Stablecoin Corridors</h2>
            <p>
              Under the Stellar ecosystem, standard corridors provide low-friction cash flow conversion using standardized API specifications:
            </p>
            <ul className="list-disc pl-6 flex flex-col gap-2">
              <li><strong>SEP-24 (Interactive Deposit/Withdrawal):</strong> Enables unified merchant/agent interfaces within self-custodial wallets for anchor handshakes.</li>
              <li><strong>SEP-10 (Authentication Protocol):</strong> Defines standard challenge-response procedures using public cryptographic key verification.</li>
              <li><strong>SEP-31 (Direct Cross-Border Remittance):</strong> Standardizes payment instructions for bank-to-bank corridor settlements.</li>
            </ul>
            <p>
              AnchorVault operates directly at the junction of these standards. Idle stablecoins within the <code>CoreVault</code> contract are locked and routed to approved Stellar Anchors who guarantee local settlements. To hedge against anchor failure, every gateway must register and stake reputation collateral in our <code>AnchorRegistry</code>.
            </p>
          </section>

          {/* Section 3: Mathematical Yield Engine */}
          <section id="math" className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-white tracking-tight">3. Mathematical Yield Engine</h2>
            <p>
              The rate of yield distribution Y(t) is dynamically computed based on the ratio of utilized corridor capital C_u against total vault reserve capital C_r, offset by staking guarantees:
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 font-mono text-center flex flex-col items-center gap-2">
              <span className="text-purple-300 text-base sm:text-lg">Y(t) = (C_u / C_r) &times; R_base &times; (1 + ln(1 + S_lock / C_r))</span>
              <span className="text-xs text-neutral-500">Equation 1: Dynamic Yield Distribution Function</span>
            </div>
            <p>
              Where <code>R_base</code> represents the baseline fee rate from raw anchor routing volume, and <code>S_lock</code> represents the quantity of governance tokens staked in our lockup corridor. The logarithmic component ensures a diminishing marginal return on pure staked scaling, encouraging organic utility over static capital lockups.
            </p>
          </section>

          {/* Section 4: Smart Contract Topology */}
          <section id="contracts" className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-white tracking-tight">4. Smart Contract Topology</h2>
            <p>
              The protocol is structured as a series of strictly decoupled, trustless WASM contracts running on Stellar's native Soroban host:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-2">
                <span className="text-sm font-semibold text-white">CoreVault Contract</span>
                <span className="text-[11px] font-mono text-purple-300 break-all select-all">CCU3RFCKEG2OIQZMGY6C2UUQFCCN6TJDVMPNRR3D6FKRZAJGQ3EIPKJK</span>
                <p className="text-xs text-neutral-400 mt-2">Stores liquidity pools, issues LP receipt tokens, and executes yield deposits based on oracle feeds.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-2">
                <span className="text-sm font-semibold text-white">AnchorRegistry Contract</span>
                <span className="text-[11px] font-mono text-cyan-300 break-all select-all">CAWO6A52CISR4JITVFVN4NDDCSJA3MI5N6XCBN5XW2AE4JU3I4NHAUGJ</span>
                <p className="text-xs text-neutral-400 mt-2">Maintains the ledger of certified anchors, manages dispute resolution bonds, and triggers stake liquidations.</p>
              </div>
            </div>
          </section>

          {/* Section 5: Stake Guarantors & Governance */}
          <section id="governance" className="flex flex-col gap-4 mb-20">
            <h2 className="text-xl font-semibold text-white tracking-tight">5. Stake Guarantors & Governance</h2>
            <p>
              The vault utilizes a dual-tier protection mechanism. First, Stellar Anchors maintain a staked deposit in <code>AnchorRegistry</code>. In the event of a settlement corridor default, the disputing merchant can verify a transaction proof on-chain to instantly trigger gateway liquidations.
            </p>
            <p>
              Second, users holding the <code>Governance Token</code> can stake in the backup Guarantor pool, absorbing black-swan risks in exchange for a premium slice of protocol routing fees. This secures high-performance safety guarantees without custodial intermediaries.
            </p>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

// ===================================================================
//             DETAILED DEVELOPER & USER DOCUMENTATION
// ===================================================================

interface DocsViewProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

function DocsView({ activeTab, setActiveTab }: DocsViewProps) {
  const [codeTab, setCodeTab] = useState("rust");

  const docCategories = [
    { id: "getting-started", label: "Getting Started" },
    { id: "smart-contracts", label: "Smart Contracts Deep-Dive" },
    { id: "sdk-integration", label: "SDK & API Integration" },
    { id: "implementation-guide", label: "Implementation & CLI Deploy" },
    { id: "accuracy-math", label: "Accuracy & Math Proofs" },
    { id: "dispute-resolution", label: "Dispute & Claims Arbitrage" }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[1320px] mx-auto px-6 pt-28 lg:pt-36 min-h-screen text-white font-sans"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Docs Sidebar */}
        <div className="lg:col-span-3 h-fit flex flex-col gap-6 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md sticky top-28">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Documentation</span>
          <div className="flex flex-col gap-1.5">
            {docCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`text-sm text-left py-2 px-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === cat.id ? "bg-[#7b39fc]/20 text-[#c29eff] border border-[#7b39fc]/40 font-semibold" : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="h-px bg-white/10 w-full" />
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>Soroban Core v2.0 Docs</span>
          </div>
        </div>

        {/* Docs Main Panel */}
        <div className="lg:col-span-9 flex flex-col gap-8 min-h-[60vh]">
          {activeTab === "getting-started" && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col gap-6 font-light leading-relaxed text-neutral-300"
            >
              <h1 className="font-instrument text-4xl text-white tracking-tight">Introduction to Soroban Corridors</h1>
              <p>
                Welcome to the AnchorVault developer portal! Deployed securely on the <strong>Stellar Soroban network</strong>, AnchorVault is a decentralized yield routing engine that matches stablecoins with local Stellar cash-in/cash-out gateways.
              </p>
              <p>
                By building on Soroban, we utilize a deterministic, sandboxed WASM environment that ensures zero-slippage transactions, absolute gas constraints, and immediate on-chain settlement hooks.
              </p>
              
              <h3 className="text-lg font-semibold text-white mt-4 tracking-tight">Prerequisites</h3>
              <p>
                To interact with AnchorVault smart contracts locally, ensure you have the following installed:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-2">
                <li>Rust toolchain (v1.78.0+) with <code>wasm32-unknown-unknown</code> target.</li>
                <li>Stellar CLI tool (<code>cargo install --locked stellar-cli --version 21.0.0</code>).</li>
                <li>Freighter Wallet Chrome extension for frontend authorization.</li>
              </ul>
            </motion.div>
          )}

          {activeTab === "smart-contracts" && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col gap-6 font-light leading-relaxed text-neutral-300"
            >
              <h1 className="font-instrument text-4xl text-white tracking-tight">Deployed Smart Contracts</h1>
              <p>
                AnchorVault deploys isolated contract modules to optimize gas consumption, scale staking security pools, and manage automated gateways:
              </p>
              
              <div className="flex flex-col gap-6 mt-2">
                <div className="border border-white/10 rounded-xl bg-white/5 p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white text-base">CoreVault Engine</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono uppercase">Vault Module</span>
                  </div>
                  <span className="text-xs font-mono select-all text-neutral-400 break-all bg-black/40 p-2.5 rounded-lg border border-white/5">CCU3RFCKEG2OIQZMGY6C2UUQFCCN6TJDVMPNRR3D6FKRZAJGQ3EIPKJK</span>
                  
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-white">State Keys & Storage Structures</span>
                    <p className="text-xs text-neutral-400">
                      Uses <code>StorageType::Instance</code> to persist:
                    </p>
                    <ul className="list-disc pl-6 text-xs text-neutral-400 flex flex-col gap-1">
                      <li><code>Admin</code>: Address of the vault deployer authorized to configure oracles.</li>
                      <li><code>AssetToken</code>: Address of the primary USDC/EURC contract interface.</li>
                      <li><code>TotalShares</code>: Sum of all active LP shares minted to providers.</li>
                      <li><code>TotalDeposits</code>: Dynamic balance ledger reflecting physical vault reserves.</li>
                    </ul>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-white">Public Contract Functions</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-black/20 p-3 rounded-lg">
                        <code className="text-purple-300">initialize(admin: Address, asset: Address)</code>
                        <p className="text-neutral-400 mt-1 text-[11px]">Binds deployer permissions and sets up primary token registers.</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <code className="text-purple-300">{"deposit(user: Address, amount: i128) -> i128"}</code>
                        <p className="text-neutral-400 mt-1 text-[11px]">Transfers USDC into reserves and issues calculated LP shares.</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <code className="text-purple-300">{"withdraw(user: Address, shares: i128) -> i128"}</code>
                        <p className="text-neutral-400 mt-1 text-[11px]">Redeems LP shares and returns USDC with accrued corridor yield.</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <code className="text-purple-300">distribute_yield(amount: i128)</code>
                        <p className="text-neutral-400 mt-1 text-[11px]">Directly inflates share values via audited corridor commissions.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-white/10 rounded-xl bg-white/5 p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white text-base">AnchorRegistry</span>
                    <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono uppercase">Registry Module</span>
                  </div>
                  <span className="text-xs font-mono select-all text-neutral-400 break-all bg-black/40 p-2.5 rounded-lg border border-white/5">CAWO6A52CISR4JITVFVN4NDDCSJA3MI5N6XCBN5XW2AE4JU3I4NHAUGJ</span>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-white">Public Contract Functions</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-black/20 p-3 rounded-lg">
                        <code className="text-cyan-300">register_anchor(anchor: Address, bond: i128)</code>
                        <p className="text-neutral-400 mt-1 text-[11px]">Registers regulated Stellar gateways and locks reputation stakes.</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <code className="text-cyan-300">flag_dispute(merchant: Address, proof: BytesN&lt;32&gt;)</code>
                        <p className="text-neutral-400 mt-1 text-[11px]">Triggers a 72-hour interactive dispute window against an anchor.</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <code className="text-cyan-300">resolve_dispute(dispute_id: u64, proof: BytesN&lt;32&gt;)</code>
                        <p className="text-neutral-400 mt-1 text-[11px]">Allows anchor to clear dispute flags using cryptographic signature receipts.</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <code className="text-cyan-300">liquidate_anchor(dispute_id: u64)</code>
                        <p className="text-neutral-400 mt-1 text-[11px]">Automated trigger to slash staked bonds and refund the merchant.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "sdk-integration" && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col gap-6 font-light leading-relaxed text-neutral-300"
            >
              <h1 className="font-instrument text-4xl text-white tracking-tight">SDK & CLI Integration</h1>
              <p>
                Integrate with AnchorVault smart contracts using your choice of developer tools. Check the dynamic code playground below:
              </p>

              {/* Code Tabs */}
              <div className="flex gap-2 bg-white/5 border border-white/10 p-1.5 rounded-xl w-fit">
                <button
                  onClick={() => setCodeTab("rust")}
                  className={`text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                    codeTab === "rust" ? "bg-white/10 text-white font-semibold" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Rust SDK
                </button>
                <button
                  onClick={() => setCodeTab("js")}
                  className={`text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                    codeTab === "js" ? "bg-white/10 text-white font-semibold" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  JavaScript
                </button>
              </div>

              {/* Code Snippet Box */}
              {codeTab === "rust" ? (
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 font-mono text-xs leading-relaxed overflow-x-auto text-neutral-300">
                  <span className="text-neutral-500">// Rust SDK call to register deposit corridors</span><br />
                  <span className="text-purple-300">use</span> soroban_sdk::&#123;Env, Address, symbol_short&#125;;<br /><br />
                  <span className="text-purple-300">pub fn</span> <span className="text-cyan-300">deposit_to_vault</span>(env: Env, user: Address, amount: i128) &#123;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-neutral-500">// Fetch CoreVault Contract address</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-300">let</span> vault_client = CoreVaultClient::new(&amp;env, &amp;Address::from_str(&amp;env, <span className="text-green-300">"CCU3..."</span>));<br /><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-neutral-500">// Trigger secure automated corridor routing</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;vault_client.deposit(&amp;user, &amp;amount);<br />
                  &#125;
                </div>
              ) : (
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 font-mono text-xs leading-relaxed overflow-x-auto text-neutral-300">
                  <span className="text-neutral-500">// JS implementation using Freighter Wallet authorization</span><br />
                  <span className="text-purple-300">import</span> &#123; SorobanRpc, Contract &#125; <span className="text-purple-300">from</span> <span className="text-green-300">"@stellar/stellar-sdk"</span>;<br /><br />
                  <span className="text-purple-300">async function</span> <span className="text-cyan-300">handleVaultDeposit</span>(userAddress, amount) &#123;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-300">const</span> vault = <span className="text-purple-300">new</span> <span className="text-yellow-400">Contract</span>(<span className="text-green-300">"CCU3RFCKEG2OIQZMGY6C2UUQFCCN6TJDVMPNRR3D6FKRZAJGQ3EIPKJK"</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-300">const</span> tx = vault.call(<span className="text-green-300">"deposit"</span>, userAddress, amount);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-300">const</span> txResult = <span className="text-purple-300">await</span> submitToFreighter(tx);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;console.log(<span className="text-green-300">"Corridor Settlement Tx Resolved:"</span>, txResult.hash);<br />
                  &#125;
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "implementation-guide" && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col gap-6 font-light leading-relaxed text-neutral-300"
            >
              <h1 className="font-instrument text-4xl text-white tracking-tight">Implementation & CLI Deploy</h1>
              <p>
                Follow this comprehensive walkthrough to build, optimize, and deploy the AnchorVault Smart Contract suite to Stellar Mainnet or Testnet.
              </p>

              <h3 className="text-lg font-semibold text-white tracking-tight mt-4">Step 1: Compile Smart Contracts</h3>
              <p>
                Compile the Rust contract codebase into high-performance WASM binaries:
              </p>
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 font-mono text-xs text-neutral-300">
                # Build target WASM modules<br />
                cargo build --target wasm32-unknown-unknown --release<br /><br />
                # Optimize WASM size using cargo-contract or stellar-cli<br />
                stellar contract optimize --wasm target/wasm32-unknown-unknown/release/anchor_vault.wasm
              </div>

              <h3 className="text-lg font-semibold text-white tracking-tight mt-4">Step 2: Deploy Contracts to Network</h3>
              <p>
                Submit the optimized WASM files to the Soroban execution host:
              </p>
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 font-mono text-xs text-neutral-300">
                # Deploy CoreVault WASM<br />
                stellar contract deploy \<br />
                &nbsp;&nbsp;--wasm target/wasm32-unknown-unknown/release/anchor_vault.optimized.wasm \<br />
                &nbsp;&nbsp;--source deployer_key_identity \<br />
                &nbsp;&nbsp;--network testnet
              </div>

              <h3 className="text-lg font-semibold text-white tracking-tight mt-4">Step 3: Parameter Initialization</h3>
              <p>
                Link the dynamic contract variables (USDC token interface, admin multisig, and dynamic registers) to bind the system:
              </p>
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 font-mono text-xs text-neutral-300">
                stellar contract invoke \<br />
                &nbsp;&nbsp;--id CCU3RFCKEG2OIQZMGY6C2UUQFCCN6TJDVMPNRR3D6FKRZAJGQ3EIPKJK \<br />
                &nbsp;&nbsp;--source deployer_key_identity \<br />
                &nbsp;&nbsp;--network testnet \<br />
                &nbsp;&nbsp;-- \<br />
                &nbsp;&nbsp;initialize \<br />
                &nbsp;&nbsp;--admin GDSKOPENSOURCEKITCORRIDOR72DX3DQNJDJINT66 \<br />
                &nbsp;&nbsp;--asset CCW67CUUZD4BYLOXPUM6UJCY34UCCIC2CC3V2F
              </div>
            </motion.div>
          )}

          {activeTab === "accuracy-math" && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col gap-6 font-light leading-relaxed text-neutral-300"
            >
              <h1 className="font-instrument text-4xl text-white tracking-tight">Accuracy & Mathematics Proofs</h1>
              <p>
                To avoid floating-point non-determinism across Stellar distributed consensus nodes, the Soroban host executes only fixed-point integer mathematics. AnchorVault implements safe-math arithmetic scaled to <strong>7 decimal places (10<sup>7</sup> scaling)</strong> to preserve 100% precision accuracy.
              </p>

              <div className="h-px bg-white/10 w-full" />

              <h3 className="text-lg font-semibold text-white tracking-tight mt-2">1. LP Share Minting Formula</h3>
              <p>
                When a user deposits capital D, the dynamic allocation of LP shares S_minted is calculated mathematically based on existing total shares S_total and total pooled reserve assets R_total:
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 font-mono text-center flex flex-col gap-2">
                <span className="text-[#c29eff] text-base sm:text-lg">S_minted = D &times; (S_total / R_total)</span>
                <span className="text-[11px] text-neutral-500">Subject to condition: If S_total == 0, S_minted = D</span>
              </div>
              <p className="text-sm">
                <strong>Rounding Attack Mitigation:</strong> To prevent fractional share drain exploits (inflation attacks), the contract strictly <strong>rounds down</strong> on deposits using the <code>checked_div</code> operator. Any decimal fractional remainder is permanently committed to the vault reserve, boosting backing value for existing LPs.
              </p>

              <h3 className="text-lg font-semibold text-white tracking-tight mt-4">2. LP Share Withdrawal Formula</h3>
              <p>
                When a liquidity provider redeems shares S_redeem to reclaim their assets A_payout:
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 font-mono text-center flex flex-col gap-2">
                <span className="text-[#c29eff] text-base sm:text-lg">A_payout = S_redeem &times; (R_total / S_total)</span>
              </div>
              <p className="text-sm">
                <strong>Rounding Safeguards:</strong> During share burning operations, decimal calculations strictly <strong>round up</strong>, safeguarding vault assets and guaranteeing zero-slippage backing structures.
              </p>

              <h3 className="text-lg font-semibold text-white tracking-tight mt-4">3. High-Precision Integer SafeMath</h3>
              <p>
                All on-chain integrations execute via native Rust checked arithmetic wraps. This blocks all potential integer underflow/overflow vectors:
              </p>
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 font-mono text-xs text-neutral-300">
                // Strict checked arithmetic block in CoreVault<br />
                let next_shares = current_shares<br />
                &nbsp;&nbsp;&nbsp;&nbsp;.checked_add(minted_amount)<br />
                &nbsp;&nbsp;&nbsp;&nbsp;.ok_or(VaultError::ArithmeticOverflow)?;
              </div>
            </motion.div>
          )}

          {activeTab === "dispute-resolution" && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col gap-6 font-light leading-relaxed text-neutral-300 mb-20"
            >
              <h1 className="font-instrument text-4xl text-white tracking-tight">Protocol Dispute & Claims</h1>
              <p>
                To maintain a completely decentralized and zero-trust corridor ecosystem, AnchorVault provides automatic dispute claims mechanisms backed by staked anchor deposits.
              </p>
              <h3 className="text-lg font-semibold text-white mt-4 tracking-tight">On-Chain Disputes Lifecycle</h3>
              <ol className="list-decimal pl-6 flex flex-col gap-3">
                <li><strong>Gateway Locking:</strong> An anchor registers a corridor and stakes a minimum of 10,000 USDC reputation bond in our <code>AnchorRegistry</code>.</li>
                <li><strong>Challenge Initiation:</strong> In case of cross-border settlement delay or default, the merchant initiates a dispute ticket on-chain, proving transaction failure via standard cryptographic signatures.</li>
                <li><strong>Automated Dispute Arbitrage:</strong> If the gateway fails to respond with cryptographic proof of settlement within the designated dispute corridor epoch, the <code>AnchorRegistry</code> instantly liquidates the anchor's bond and refunds the merchant directly.</li>
              </ol>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ===================================================================
//             DECENTRALIZED PRIVACY POLICY COMPONENT
// ===================================================================

function PrivacyView() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[900px] mx-auto px-6 pt-28 lg:pt-36 pb-24 min-h-screen text-neutral-300 font-sans font-light leading-relaxed flex flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        <h1 className="font-instrument text-4xl lg:text-6xl text-white tracking-tight leading-none">
          Privacy Policy
        </h1>
        <p className="text-purple-300 text-sm tracking-wide uppercase font-semibold">
          AnchorVault Cryptographic Transparency Statement
        </p>
      </div>

      <div className="h-px bg-white/10 w-full" />

      <p>
        At AnchorVault, we prioritize the protection of your privacy. Because our platform is a decentralized, non-custodial decentralized application (dApp) built on the Stellar public blockchain, we do not collect, process, or store any personal data.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-2">
          <span className="font-semibold text-white">1. Cryptographic Handshakes</span>
          <p className="text-sm text-neutral-400 font-light">
            All user operations are authorized locally in your self-custodial browser extension (e.g. Freighter Wallet). No secret keys or credentials are ever transmitted to our systems.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-2">
          <span className="font-semibold text-white">2. Public Ledger Transparency</span>
          <p className="text-sm text-neutral-400 font-light">
            Transaction details (amounts, addresses, public keys, and timestamps) are written permanently to the Stellar blockchain. This data is fully transparent, auditable, and immutable by default.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-2">
          <span className="font-semibold text-white">3. Zero Tracker Cookie Policy</span>
          <p className="text-sm text-neutral-400 font-light">
            We do not use advertising cookies, third-party analytics pixels, or profiling scripts. Your session is maintained purely locally to support direct RPC interactions.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-2">
          <span className="font-semibold text-white">4. Decentralized Corridors</span>
          <p className="text-sm text-neutral-400 font-light">
            AnchorVault does not control third-party Stellar Anchors. Users interacting with cash-out anchors are bound by those specific anchors' respective local KYC and compliance policies.
          </p>
        </div>
      </div>

      <p className="mt-4">
        If you have any questions about this decentralized privacy design system, please review our open-source codebase on GitHub or consult directly with Stellar network developers.
      </p>
    </motion.div>
  );
}

// ===================================================================
//             TERMS OF USE & DISCLAIMER COMPONENT
// ===================================================================

function TermsView() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[900px] mx-auto px-6 pt-28 lg:pt-36 pb-24 min-h-screen text-neutral-300 font-sans font-light leading-relaxed flex flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        <h1 className="font-instrument text-4xl lg:text-6xl text-white tracking-tight leading-none">
          Terms of Use
        </h1>
        <p className="text-purple-300 text-sm tracking-wide uppercase font-semibold">
          Decentralized Protocol Disclaimers & Risk Declarations
        </p>
      </div>

      <div className="h-px bg-white/10 w-full" />

      {/* Caution Box */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 flex gap-3 text-yellow-200">
        <span className="text-lg">⚠️</span>
        <div className="flex flex-col gap-1 text-sm font-normal">
          <span className="font-semibold text-white">HIGH RISK TRANSACTION DISCLAIMER</span>
          <p className="text-xs text-yellow-300/80 leading-relaxed font-light">
            AnchorVault is an automated, non-custodial smart contract corridor routing system. Interacting with Soroban smart contracts carries inherent risks, including contract vulnerabilities, liquidation flags, and stablecoin peg failures. Proceed strictly at your own discretion.
          </p>
        </div>
      </div>

      <p>
        By using the AnchorVault protocol (including our smart contracts, website portal, and SDK integrations), you unconditionally agree to the following conditions:
      </p>

      <div className="flex flex-col gap-5">
        <div className="flex gap-4">
          <span className="font-semibold text-white text-base">1.</span>
          <div>
            <span className="font-semibold text-white">Self-Custodial Autonomy:</span>
            <p className="text-sm text-neutral-400 mt-1">
              You are solely responsible for securing your Freighter secret keys and wallet authorizations. AnchorVault has zero access to your funds and cannot recover locked or misrouted assets.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <span className="font-semibold text-white text-base">2.</span>
          <div>
            <span className="font-semibold text-white">No Investment or Financial Advice:</span>
            <p className="text-sm text-neutral-400 mt-1">
              All interest rates, APY projections, and yield signals simulated on the website are dynamic projections based on blockchain activity. They do not constitute fixed or guaranteed investment returns.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <span className="font-semibold text-white text-base">3.</span>
          <div>
            <span className="font-semibold text-white">Decentralized Service Availability:</span>
            <p className="text-sm text-neutral-400 mt-1">
              The AnchorVault interface runs as an open-source gateway. The protocol resides entirely on the Stellar mainnet public network. The authors and community guarantee zero service uptime and carry zero liabilities.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
