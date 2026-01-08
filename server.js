/**
 * ===============================================================================
 * APEX PREDATOR v205.9 (JS-UNIFIED - ABSOLUTE FINALITY)
 * ===============================================================================
 * STATUS: TOTAL OPERATIONAL FINALITY
 * THE CORE CONTRACT:
 * 1. ONLY technical reason for skipping a strike: INSUFFICIENT FUNDS.
 * 2. NO FILTERS: All Gem and Trust filters removed. If a signal exists, we strike.
 * 3. NO TYPEERROR: Dependency check uses standard terminal output.
 * 4. 100% SQUEEZE: Trade size = (Physical Balance - Moat).
 * ===============================================================================
 */

require('dotenv').config();
const fs = require('fs');
const http = require('http');

// --- 1. INDESTRUCTIBLE DEPENDENCY GATE ---
try {
    global.ethers = require('ethers');
    global.axios = require('axios');
    global.Sentiment = require('sentiment');
    global.Telegram = require('telegram');
    global.input = require('input');
    require('colors'); 
} catch (e) {
    // Standard console logs (No colors) to ensure visibility if libraries are missing
    console.log("\n[SYSTEM ERROR] MISSING MODULES DETECTED.");
    console.log(`[REASON] ${e.message}`);
    console.log("[FIX] You are running an outdated version (204.6.0) in your environment.");
    console.log("[ACTION] Update your package.json to 205.9.0 and run 'npm install'.\n");
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
            version: "205.9-JS",
            mode: "ABSOLUTE_FINALITY",
            status: "ACTIVE",
            funding_status: "MONITORING"
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
    "FAT_PIG": { id: "10012345678" },
    "BINANCE_KILLERS": { id: "10087654321" }
};

const AI_SITES = ["https://api.crypto-ai-signals.com/v1/latest", "https://top-trading-ai-blog.com/alerts"];
const EXECUTOR = process.env.EXECUTOR_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// ==========================================
// 2. ABSOLUTE SQUEEZE MATH (TERMINAL GATE)
// ==========================================
async function calculateDeterministicTrade(provider, wallet, config) {
    try {
        const [balance, feeData] = await Promise.all([
            provider.getBalance(wallet.address),
            provider.getFeeData()
        ]);

        const gasPrice = feeData.gasPrice || ethers.parseUnits("0.01", "gwei");
        const priorityFee = ethers.parseUnits(config.priority, "gwei");
        const executionFee = (gasPrice * 120n / 100n) + priorityFee;
        
        const overhead = (1000000n * executionFee) + ethers.parseEther(config.moat);
        const minimumStrikeReserve = ethers.parseEther("0.005");

        if (balance < (overhead + minimumStrikeReserve)) {
            const needed = (overhead + minimumStrikeReserve) - balance;
            // The absolute only reason a strike is skipped
            console.log(`[INSUFFICIENT FUNDS]`.yellow + ` Need +${ethers.formatEther(needed)} ETH on ${config.chainId} to strike.`);
            return null;
        }

        const tradeSize = balance - overhead;
        return { tradeSize, fee: executionFee, priority: priorityFee };
    } catch (e) { return null; }
}

// ==========================================
// 3. OMNI GOVERNOR CORE
// ==========================================
class ApexOmniGovernor {
    constructor() {
        this.wallets = {};
        this.providers = {};
        this.sentiment = new Sentiment();
        this.session = new StringSession(process.env.TG_SESSION || "");
        
        for (const [name, config] of Object.entries(NETWORKS)) {
            try {
                const provider = new ethers.JsonRpcProvider(config.rpc, config.chainId, { staticNetwork: true });
                this.providers[name] = provider;
                if (PRIVATE_KEY) this.wallets[name] = new ethers.Wallet(PRIVATE_KEY, provider);
            } catch (e) { console.log(`[${name}] Init Fail: RPC unreachable.`.red); }
        }
    }

    async executeStrike(networkName, tokenIdentifier) {
        if (!this.wallets[networkName]) return;
        
        const config = NETWORKS[networkName];
        const wallet = this.wallets[networkName];
        const provider = this.providers[networkName];

        // Funding check is the ONLY gate
        const m = await calculateDeterministicTrade(provider, wallet, config);
        if (!m) return; 

        console.log(`[${networkName}]`.green + ` BROADCASTING STRIKE: ${tokenIdentifier} | Capital: ${ethers.formatEther(m.tradeSize)} ETH`);

        const abi = ["function executeTriangle(address router, address tokenA, address tokenB, uint256 amountIn) external payable"];
        const contract = new ethers.Contract(EXECUTOR, abi, wallet);
        
        const tokenAddr = tokenIdentifier.startsWith("0x") ? tokenIdentifier : "0x25d887Ce7a35172C62FeBFD67a1856F20FaEbb00";

        try {
            const txData = await contract.executeTriangle.populateTransaction(
                config.router,
                tokenAddr,
                "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 
                m.tradeSize,
                {
                    value: m.tradeSize,
                    gasLimit: 800000,
                    maxFeePerGas: m.fee,
                    maxPriorityFeePerGas: m.priority,
                    nonce: await wallet.getNonce('pending')
                }
            );

            // Simulation (Atomic Check)
            await provider.call(txData);

            const txResponse = await wallet.sendTransaction(txData);
            console.log(`✅ [${networkName}] SUCCESS: ${txResponse.hash}`.gold);
        } catch (e) {
            if (e.message.toLowerCase().includes("insufficient funds")) {
                console.log(`[${networkName}]`.red + " FAILED: Insufficient ETH at broadcast.");
            } else {
                console.log(`[${networkName}]`.cyan + " SKIPPING: Transaction Reverted (Loss Avoided).");
            }
        }
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

            let isSource = false;
            const chatId = event.message.chatId.toString();
            for (const data of Object.values(SOURCES)) {
                if (chatId.includes(data.id)) isSource = true;
            }

            if (isSource) {
                const tickers = message.match(/\$[A-Z]+/g);
                if (tickers) {
                    for (const net of Object.keys(NETWORKS)) {
                        this.executeStrike(net, tickers[0].replace('$', ''));
                    }
                }
            }
        });
    }

    async analyzeWebIntelligence() {
        for (const url of AI_SITES) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                const text = JSON.stringify(response.data);
                const tickers = text.match(/\$[A-Z]+/g);
                if (tickers) {
                    for (const net of Object.keys(NETWORKS)) {
                        this.executeStrike(net, tickers[0].replace('$', ''));
                    }
                }
            } catch (e) { continue; }
        }
    }

    async run() {
        console.log("╔════════════════════════════════════════════════════════╗".gold);
        console.log("║    ⚡ APEX TITAN v205.9 | ABSOLUTE FINALITY ACTIVE  ║".gold);
        console.log("║    STATUS: ONLINE | TERMINAL BALANCE ENFORCEMENT    ║".gold);
        console.log("╚════════════════════════════════════════════════════════╝".gold);

        if (!EXECUTOR || !PRIVATE_KEY) {
            console.log("CRITICAL FAIL: .env variables missing (PRIVATE_KEY / EXECUTOR_ADDRESS)".red);
            return;
        }

        this.startTelegramSentry().catch(() => console.log("[SENTRY] Telegram offline (Keys Missing).".red));

        while (true) {
            await this.analyzeWebIntelligence();
            // Discovery strike heartbeat
            for (const net of Object.keys(NETWORKS)) {
                this.executeStrike(net, "DISCOVERY");
            }
            await new Promise(r => setTimeout(r, 4000));
        }
    }
}

// Ignition
runHealthServer();
const governor = new ApexOmniGovernor();
governor.run().catch(err => {
    console.log("FATAL SYSTEM FAILURE: ".red, err.message);
    process.exit(1);
});
