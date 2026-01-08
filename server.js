/**
 * ===============================================================================
 * APEX PREDATOR v204.8 (JS-UNIFIED - DIRECT SINGULARITY)
 * ===============================================================================
 * STATUS: DIRECT TRADING FINALITY (NO FLASH LOANS)
 * CAPABILITIES UNIFIED:
 * 1. TELEGRAM SENTRY: Uses 'gramjs' to replicate Telethon listener functionality.
 * 2. WEB-AI INTELLIGENCE: Scrapes trading sites via axios + sentiment NLP.
 * 3. QUAD-NETWORK: Simultaneous direct trading on ETH, BASE, ARB, and POLY.
 * 4. 100% CAPITAL SQUEEZE: (Balance - Moat) = Trade Size (Deterministic).
 * 5. REINFORCEMENT LEARNING: Persists source trust scores based on success/revert.
 * 6. CLOUD STABILITY: Integrated HTTP server for port-binding health checks.
 * ===============================================================================
 */

require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');
const Sentiment = require('sentiment');
const fs = require('fs');
const http = require('http');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input'); // For initial login if needed
require('colors');

// ==========================================
// 0. CLOUD BOOT GUARD (Port Binding)
// ==========================================
const runHealthServer = () => {
    const port = process.env.PORT || 8080;
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            engine: "APEX_TITAN",
            version: "204.8-JS",
            mode: "DIRECT_TRADING",
            keys_detected: !!(process.env.PRIVATE_KEY && process.env.EXECUTOR_ADDRESS),
            telegram_active: !!(process.env.TG_API_ID)
        }));
    }).listen(port, '0.0.0.0', () => {
        console.log(`[SYSTEM] Cloud Health Monitor active on Port ${port}`.cyan);
    });
};

// ==========================================
// 1. NETWORK & INFRASTRUCTURE CONFIG
// ==========================================
const NETWORKS = {
    ETHEREUM: { chainId: 1, rpc: process.env.ETH_RPC || "https://eth.llamarpc.com", moat: "0.01", priority: "500.0" },
    BASE: { chainId: 8453, rpc: process.env.BASE_RPC || "https://mainnet.base.org", moat: "0.005", priority: "1.6" },
    ARBITRUM: { chainId: 42161, rpc: process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc", moat: "0.003", priority: "1.0" },
    POLYGON: { chainId: 137, rpc: process.env.POLY_RPC || "https://polygon-rpc.com", moat: "0.002", priority: "200.0" }
};

const SOURCES = {
    "FAT_PIG": { id: "10012345678", trust: 0.95 },
    "BINANCE_KILLERS": { id: "10087654321", trust: 0.90 }
};

const AI_SITES = ["https://api.crypto-ai-signals.com/v1/latest", "https://top-trading-ai-blog.com/alerts"];
const EXECUTOR = process.env.EXECUTOR_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// ==========================================
// 2. AI & TRUST ENGINE (REINFORCEMENT)
// ==========================================
class AIEngine {
    constructor() {
        this.trustFile = "trust_scores.json";
        this.sentiment = new Sentiment();
        this.trustScores = this.loadTrust();
    }

    loadTrust() {
        if (fs.existsSync(this.trustFile)) {
            try {
                return JSON.parse(fs.readFileSync(this.trustFile, 'utf8'));
            } catch (e) { return this.getDefaultTrust(); }
        }
        return this.getDefaultTrust();
    }

    getDefaultTrust() {
        const scores = { WEB_AI: 0.85, DISCOVERY: 0.70 };
        Object.keys(SOURCES).forEach(k => scores[k] = SOURCES[k].trust);
        return scores;
    }

    updateTrust(sourceName, success) {
        let current = this.trustScores[sourceName] || 0.5;
        current = success ? Math.min(0.99, current * 1.05) : Math.max(0.1, current * 0.90);
        this.trustScores[sourceName] = current;
        fs.writeFileSync(this.trustFile, JSON.stringify(this.trustScores));
        return current;
    }

    async analyzeWebIntelligence() {
        const signals = [];
        for (const url of AI_SITES) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                const text = JSON.stringify(response.data);
                const analysis = this.sentiment.analyze(text);
                const tickers = text.match(/\$[A-Z]+/g);
                if (tickers && analysis.comparative > 0.1) {
                    signals.push({ ticker: tickers[0].replace('$', ''), sentiment: analysis.comparative });
                }
            } catch (e) { continue; }
        }
        return signals;
    }
}

// ==========================================
// 3. DETERMINISTIC EXECUTION CORE
// ==========================================
class ApexOmniGovernor {
    constructor() {
        this.ai = new AIEngine();
        this.wallets = {};
        this.providers = {};
        this.session = new StringSession(process.env.TG_SESSION || "");
        
        for (const [name, config] of Object.entries(NETWORKS)) {
            try {
                const provider = new ethers.JsonRpcProvider(config.rpc, config.chainId, { staticNetwork: true });
                this.providers[name] = provider;
                if (PRIVATE_KEY) this.wallets[name] = new ethers.Wallet(PRIVATE_KEY, provider);
            } catch (e) { console.error(`[${name}] Init Fail`.red); }
        }
    }

    async calculateMaxTrade(networkName) {
        const provider = this.providers[networkName];
        const wallet = this.wallets[networkName];
        if (!wallet) return null;

        const config = NETWORKS[networkName];
        try {
            const [balance, feeData] = await Promise.all([provider.getBalance(wallet.address), provider.getFeeData()]);
            const gasPrice = feeData.gasPrice || ethers.parseUnits("0.01", "gwei");
            const priorityFee = ethers.parseUnits(config.priority, "gwei");
            const executionFee = (gasPrice * 120n / 100n) + priorityFee;
            
            // Fixed overhead for direct triangular trade (3 hops)
            const overhead = (1000000n * executionFee) + ethers.parseEther(config.moat);

            if (balance < overhead + ethers.parseEther("0.005")) {
                console.log(`[${networkName}]`.yellow + ` SKIP: Low Balance.`);
                return null;
            }

            // 100% CAPITAL SQUEEZE: Trade size is everything remaining.
            const tradeSize = balance - overhead;
            return { tradeSize, fee: executionFee, priority: priorityFee };
        } catch (e) { return null; }
    }

    async executeDirectStrike(networkName, token, source = "WEB_AI") {
        if (!this.wallets[networkName]) return;
        const m = await this.calculateMaxTrade(networkName);
        if (!m) return;

        if ((this.ai.trustScores[source] || 0.5) < 0.4) return;

        const wallet = this.wallets[networkName];
        console.log(`[${networkName}]`.green + ` EXECUTING DIRECT ARB: ${token} | Size: ${ethers.formatEther(m.tradeSize)} ETH`);

        // ArbitrageExecutor.sol Interface for Direct Triangular
        const abi = ["function executeTriangle(address[] path, uint256 amount) external payable"];
        const contract = new ethers.Contract(EXECUTOR, abi, wallet);
        
        // Mocked loop paths; in prod, resolve real pair addresses.
        const path = [token, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"]; // Token -> USDC

        try {
            const tx = await contract.executeTriangle.populateTransaction(path, m.tradeSize, {
                gasLimit: 1000000,
                maxFeePerGas: m.fee,
                maxPriorityFeePerGas: m.priority,
                nonce: await wallet.getNonce('pending')
            });

            const txResponse = await wallet.sendTransaction(tx);
            console.log(`✅ [${networkName}]`.gold + ` SUCCESS: ${txResponse.hash}`);
            this.verifyAndLearn(networkName, txResponse, source);
        } catch (e) {
            if (!e.message.toLowerCase().includes("insufficient funds")) {
                console.log(`[${networkName}]`.red + " Strike Aborted: Logic Revert.");
            }
        }
    }

    async verifyAndLearn(net, txResponse, source) {
        try {
            const receipt = await txResponse.wait(1);
            this.ai.updateTrust(source, receipt.status === 1);
        } catch (e) { this.ai.updateTrust(source, false); }
    }

    async startTelegramSentry() {
        const apiId = parseInt(process.env.TG_API_ID);
        const apiHash = process.env.TG_API_HASH;
        if (!apiId || !apiHash) return;

        const client = new TelegramClient(this.session, apiId, apiHash, { connectionRetries: 5 });
        await client.start({
            phoneNumber: async () => await input.text("Phone: "),
            password: async () => await input.text("2FA: "),
            phoneCode: async () => await input.text("Code: "),
            onError: (err) => console.log(err),
        });
        console.log("[SENTRY] Telegram Listener Online.".cyan);

        client.addEventHandler(async (event) => {
            const message = event.message?.message;
            if (!message) return;

            let sourceName = "UNKNOWN";
            const chatId = event.message.chatId.toString();
            for (const [name, data] of Object.entries(SOURCES)) {
                if (chatId.includes(data.id)) sourceName = name;
            }

            if (sourceName !== "UNKNOWN" && message.includes("$")) {
                const tickers = message.match(/\$[A-Z]+/g);
                if (tickers) {
                    const sentiment = this.ai.sentiment.analyze(message).comparative;
                    if (sentiment > 0.2) {
                        for (const net of Object.keys(NETWORKS)) {
                            this.executeDirectStrike(net, tickers[0].replace('$', ''), sourceName);
                        }
                    }
                }
            }
        });
    }

    async run() {
        console.log("╔════════════════════════════════════════════════════════╗".gold);
        console.log("║    ⚡ APEX TITAN v204.8 | DIRECT SINGULARITY ACTIVE ║".gold);
        console.log("║    NETWORKS: ETH, BASE, ARB, POLY | OWN CAPITAL     ║".gold);
        console.log("╚════════════════════════════════════════════════════════╝".gold);

        if (!EXECUTOR || !PRIVATE_KEY) {
            console.log("CRITICAL FAIL: PRIVATE_KEY or EXECUTOR_ADDRESS missing.".red);
            return;
        }

        this.startTelegramSentry().catch(() => console.log("[SENTRY] Telegram failed to bind.".red));

        while (true) {
            const webSignals = await this.ai.analyzeWebIntelligence();
            const tasks = [];
            for (const net of Object.keys(NETWORKS)) {
                if (webSignals.length > 0) {
                    for (const s of webSignals) tasks.push(this.executeDirectStrike(net, s.ticker, "WEB_AI"));
                } else {
                    tasks.push(this.executeDirectStrike(net, "0x25d887Ce7a35172C62FeBFD67a1856F20FaEbb00", "DISCOVERY"));
                }
            }
            if (tasks.length > 0) await Promise.allSettled(tasks);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// Start
runHealthServer();
new ApexOmniGovernor().run().catch(console.error);
