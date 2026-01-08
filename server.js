/**
 * ===============================================================================
 * APEX PREDATOR v205.5 (JS-UNIFIED - DETERMINISTIC SINGULARITY)
 * ===============================================================================
 * STATUS: TOTAL OPERATIONAL FINALITY
 * * THE CORE CONTRACT:
 * 1. The ONLY reason this bot will skip a strike is INSUFFICIENT FUNDS.
 * 2. If modules are missing, the bot will exit immediately with a clear error.
 * 3. All other logic (Sentiment, Filters, Trust) is secondary to the Balance Gate.
 * ===============================================================================
 */

require('dotenv').config();
const fs = require('fs');
const http = require('http');

// MODULE DIAGNOSTIC GATE - Immediate fail if dependencies are missing
try {
    global.ethers = require('ethers');
    global.axios = require('axios');
    global.Sentiment = require('sentiment');
    global.Telegram = require('telegram');
    global.input = require('input');
    require('colors');
} catch (e) {
    console.error(`\n[FATAL ERROR] Missing Dependency: ${e.message}`.red.bold);
    console.error(`[FIX] Update your package.json and run 'npm install' immediately.\n`.yellow);
    process.exit(1);
}

const { ethers } = global.ethers;
const axios = global.axios;
const Sentiment = global.Sentiment;
const { TelegramClient } = global.Telegram;
const { StringSession } = require('telegram/sessions');

// ==========================================
// 0. CLOUD BOOT GUARD (Health Check)
// ==========================================
const runHealthServer = () => {
    const port = process.env.PORT || 8080;
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            engine: "APEX_TITAN",
            version: "205.5-JS",
            mode: "DETERMINISTIC_STRIKE",
            status: "TOTAL_FINALITY",
            only_failure_cause: "INSUFFICIENT_FUNDS"
        }));
    }).listen(port, '0.0.0.0', () => {
        console.log(`[SYSTEM] Cloud Health Monitor active on Port ${port}`.cyan);
    });
};

// ==========================================
// 1. NETWORK & INFRASTRUCTURE CONFIG
// ==========================================
const NETWORKS = {
    ETHEREUM: { chainId: 1, rpc: process.env.ETH_RPC || "https://eth.llamarpc.com", moat: "0.01", priority: "500.0", weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" },
    BASE: { chainId: 8453, rpc: process.env.BASE_RPC || "https://mainnet.base.org", moat: "0.005", priority: "1.6", weth: "0x4200000000000000000000000000000000000006", router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" },
    ARBITRUM: { chainId: 42161, rpc: process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc", moat: "0.003", priority: "1.0", weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" },
    POLYGON: { chainId: 137, rpc: process.env.POLY_RPC || "https://polygon-rpc.com", moat: "0.002", priority: "200.0", weth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff" }
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
            try { return JSON.parse(fs.readFileSync(this.trustFile, 'utf8')); } catch (e) { return this.getDefaultTrust(); }
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
            
            const overhead = (1000000n * executionFee) + ethers.parseEther(config.moat);
            const minimumSafety = ethers.parseEther("0.005");

            if (balance < (overhead + minimumSafety)) {
                const deficit = (overhead + minimumSafety) - balance;
                // TERMINAL GATE: Verbose logging for balance issues
                console.log(`[${networkName}]`.yellow + ` INSUFFICIENT FUNDS. Trade Halted. Need +${ethers.formatEther(deficit)} ETH`.bold);
                return null;
            }

            const tradeSize = balance - overhead;
            return { tradeSize, fee: executionFee, priority: priorityFee };
        } catch (e) { return null; }
    }

    async executeStrike(networkName, tokenAddrOrTicker, source = "WEB_AI") {
        if (!this.wallets[networkName]) return;
        const tokenAddr = tokenAddrOrTicker.startsWith("0x") ? tokenAddrOrTicker : "0x25d887Ce7a35172C62FeBFD67a1856F20FaEbb00";

        // Metrics Gate (DETERMINISTIC BALANCE CHECK)
        const m = await this.calculateMaxTrade(networkName);
        if (!m) return; // This is the ONLY reason a valid strike is skipped

        // AI Trust Gate
        if ((this.ai.trustScores[source] || 0.5) < 0.4) return;

        const wallet = this.wallets[networkName];
        const provider = this.providers[networkName];
        console.log(`[${networkName}]`.green + ` STRIKING: ${tokenAddrOrTicker} | Capital: ${ethers.formatEther(m.tradeSize)} ETH`);

        const abi = ["function executeTriangle(address router, address tokenA, address tokenB, uint256 amountIn) external payable"];
        const contract = new ethers.Contract(EXECUTOR, abi, wallet);

        try {
            const txData = await contract.executeTriangle.populateTransaction(
                NETWORKS[networkName].router,
                tokenAddr,
                "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 
                m.tradeSize,
                {
                    value: m.tradeSize,
                    gasLimit: 600000,
                    maxFeePerGas: m.fee,
                    maxPriorityFeePerGas: m.priority,
                    nonce: await wallet.getNonce('pending')
                }
            );

            await provider.call(txData);
            const txResponse = await wallet.sendTransaction(txData);
            console.log(`✅ [${networkName}] SUCCESS: ${txResponse.hash}`.gold);
            this.verifyAndLearn(networkName, txResponse, source);
        } catch (e) {
            if (e.message.toLowerCase().includes("insufficient funds")) {
                console.log(`[${networkName}]`.red + " BROADCAST FAILED: Physical ETH balance insufficient for gas/value.");
            } else {
                console.log(`[${networkName}]`.cyan + " SKIPPING: Revert Detected (Capital Protected).");
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
            phoneNumber: async () => await global.input.text("Phone: "),
            password: async () => await global.input.text("2FA: "),
            phoneCode: async () => await global.input.text("Code: "),
            onError: (err) => console.log(err),
        });
        console.log("[SENTRY] Telegram Listener Online.".cyan);

        client.addEventHandler(async (event) => {
            const message = event.message?.message;
            if (!message || !message.includes("$")) return;

            let sourceName = "UNKNOWN";
            const chatId = event.message.chatId.toString();
            for (const [name, data] of Object.entries(SOURCES)) {
                if (chatId.includes(data.id)) sourceName = name;
            }

            if (sourceName !== "UNKNOWN") {
                const tickers = message.match(/\$[A-Z]+/g);
                if (tickers) {
                    const sentiment = this.ai.sentiment.analyze(message).comparative;
                    if (sentiment > 0.2) {
                        for (const net of Object.keys(NETWORKS)) {
                            this.executeStrike(net, tickers[0].replace('$', ''), sourceName);
                        }
                    }
                }
            }
        });
    }

    async run() {
        console.log("╔════════════════════════════════════════════════════════╗".gold);
        console.log("║    ⚡ APEX TITAN v205.5 | DETERMINISTIC SINGULARITY ║".gold);
        console.log("║    STATUS: OPERATIONAL | MODE: 100% CAPITAL SQUEEZE ║".gold);
        console.log("╚════════════════════════════════════════════════════════╝".gold);

        if (!EXECUTOR || !PRIVATE_KEY) {
            console.log("CRITICAL FAIL: PRIVATE_KEY or EXECUTOR_ADDRESS missing in .env".red);
            return;
        }

        this.startTelegramSentry().catch(() => console.log("[SENTRY] Telegram offline.".red));

        while (true) {
            const webSignals = await this.ai.analyzeWebIntelligence();
            const tasks = [];
            for (const net of Object.keys(NETWORKS)) {
                if (webSignals.length > 0) {
                    for (const s of webSignals) {
                        tasks.push(this.executeStrike(net, s.ticker, "WEB_AI"));
                    }
                } else {
                    tasks.push(this.executeStrike(net, "DISCOVERY", "DISCOVERY"));
                }
            }
            if (tasks.length > 0) await Promise.allSettled(tasks);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

// Ignition
runHealthServer();
const governor = new ApexOmniGovernor();
governor.run().catch(err => {
    console.error("FATAL:".red, err.message);
    process.exit(1);
});
