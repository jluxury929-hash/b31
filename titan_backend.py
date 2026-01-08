import os
import asyncio
import re
import json
import pickle
import math
import random
from web3 import Web3
from decimal import Decimal
from dotenv import load_dotenv
from telethon import TelegramClient, events
from textblob import TextBlob
from colorama import Fore, Style, init

init(autoreset=True)
load_dotenv()

# ==========================================
# 1. GLOBAL CONFIGURATION
# ==========================================
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
RPC_URL = "https://arb1.arbitrum.io/rpc"
# Replaced Titan Contract with your standard Arbitrage Contract
ARBITRAGE_CONTRACT = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS"

# RELIABLE SIGNAL SOURCES
SOURCES = {
"FAT_PIG": {"id": 10012345678, "default_trust": 0.95},
"BINANCE_KILLERS": {"id": 10087654321, "default_trust": 0.90}
}

# ARBITRUM INFRASTRUCTURE
WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
SUSHI_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"

# CONNECT
w3 = Web3(Web3.HTTPProvider(RPC_URL))
account = w3.eth.account.from_key(PRIVATE_KEY)
MY_ADDR = account.address

# ==========================================
# 2. AI & TRUST ENGINE
# ==========================================
class AIEngine:
def __init__(self):
self.trust_file = "trust_scores.pkl"
self.trust_scores = self.load_trust()

def load_trust(self):
if os.path.exists(self.trust_file):
with open(self.trust_file, 'rb') as f: return pickle.load(f)
return {k: v['default_trust'] for k, v in SOURCES.items()}

def update_trust(self, source_name, success):
# Reinforcement Learning Logic
current = self.trust_scores.get(source_name, 0.5)
if success:
new_score = min(0.99, current * 1.05) # Boost 5%
else:
new_score = max(0.1, current * 0.90) # Punish 10%

self.trust_scores[source_name] = new_score
with open(self.trust_file, 'wb') as f: pickle.dump(self.trust_scores, f)
return new_score

def analyze_sentiment(self, text):
"""Returns 0.0 (Bearish) to 1.0 (Bullish)"""
clean = text.upper()
if any(x in clean for x in ["SCAM", "RUG", "SELL", "DUMP"]): return 0.0

blob = TextBlob(text)
# Normalize -1.0 to 1.0 range into 0.0 to 1.0
score = (blob.sentiment.polarity + 1) / 2
return score

ai = AIEngine()

# ==========================================
# 3. ON-CHAIN SIMULATION (Own Capital)
# ==========================================
async def get_amount_out(router, t_in, t_out, amt):
abi = '[{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"}]'
contract = w3.eth.contract(address=router, abi=abi)
try:
loop = asyncio.get_event_loop()
res = await loop.run_in_executor(None, lambda: contract.functions.getAmountsOut(int(amt), [t_in, t_out]).call())
return res[1]
except: return 0

async def find_triangular_arbitrage(token_addr):
"""
Checks loop: ETH -> Token -> USDC -> ETH using OWN CAPITAL.
"""
# 1. DEFINE CAPITAL SIZE (e.g., 0.1 ETH)
# In production, check wallet balance and use %
trade_size = w3.to_wei(0.1, 'ether')

print(f"{Fore.CYAN} 🔬 Scanning {token_addr} with {w3.from_wei(trade_size, 'ether')} ETH...")

# Path: WETH -> Token -> USDC -> WETH
s1 = await get_amount_out(SUSHI_ROUTER, WETH, token_addr, trade_size)
if s1 == 0: return None

s2 = await get_amount_out(SUSHI_ROUTER, token_addr, USDC, s1)
if s2 == 0: return None

s3 = await get_amount_out(SUSHI_ROUTER, USDC, WETH, s2)

# PROFIT CALCULATION
profit_wei = s3 - trade_size

# Must profit enough to cover GAS (~0.002 ETH for simple swap)
min_profit = w3.to_wei(0.002, 'ether')

if profit_wei > min_profit:
return {
"profit": w3.from_wei(profit_wei, 'ether'),
"size": trade_size,
"roi": profit_wei / trade_size
}

return None

# ==========================================
# 4. EXECUTION (No Flash Loan)
# ==========================================
async def execute_trade(strat, token_addr, source_name):
print(f"{Fore.GREEN} ⚡ PROFITABLE LOOP FOUND! Est Profit: {strat['profit']} ETH")
print(f"{Fore.MAGENTA} 🚀 EXECUTING TRIANGULAR ARBITRAGE...")

# Using the Standard Arbitrage Contract Logic
contract = w3.eth.contract(address=ARBITRAGE_CONTRACT, abi='[{"inputs":[{"internalType":"address","name":"router","type":"address"},{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint256","name":"amountIn","type":"uint256"}],"name":"executeTriangular","outputs":[],"stateMutability":"nonpayable","type":"function"}]')

# Aggressive Miner Bribe
bribe = int(w3.eth.gas_price * 1.5)

tx = contract.functions.executeTriangular(
SUSHI_ROUTER,
token_addr,
USDC,
strat['size']
).build_transaction({
'from': MY_ADDR,
'gas': 500000, # Lower gas than flash loan
'maxFeePerGas': bribe,
'maxPriorityFeePerGas': w3.to_wei(2, 'gwei'),
'nonce': w3.eth.get_transaction_count(MY_ADDR),
'chainId': 42161
})

signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)

try:
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
print(f"{Fore.GREEN} ✅ TX SENT: {w3.to_hex(tx_hash)}")

# Feedback Learning
await asyncio.sleep(2)
receipt = w3.eth.get_transaction_receipt(tx_hash)

if receipt.status == 1:
print(f"{Fore.GREEN} 💰 EXECUTION SUCCESSFUL.")
ai.update_trust(source_name, True)
else:
print(f"{Fore.RED} ❌ EXECUTION REVERTED (Atomic Guard Saved Capital).")
ai.update_trust(source_name, False)

except Exception as e:
print(f"{Fore.RED} ❌ Execution Error: {e}")
ai.update_trust(source_name, False)

# ==========================================
# 5. SIGNAL LISTENER
# ==========================================
async def main():
print(f"{Fore.WHITE}🏛️ APEX ENGINE ONLINE | Direct Trading Mode")

TG_ID = os.getenv("TG_API_ID")
TG_HASH = os.getenv("TG_API_HASH")

if TG_ID:
client = TelegramClient('apex_session', TG_ID, TG_HASH)
@client.on(events.NewMessage)
async def handler(event):
# 1. IDENTIFY SOURCE
source = "UNKNOWN"
for name, data in SOURCES.items():
if event.chat_id == data['id']: source = name

if source != "UNKNOWN" and "$" in event.raw_text:
# 2. AI SENTIMENT CHECK
sentiment = ai.analyze_sentiment(event.raw_text)
trust = ai.trust_scores.get(source, 0.5)

# Combine Confidence
if (sentiment * trust) > 0.6:
try:
ticker = event.raw_text.split("$")[1].split(" ")[0].upper()
# Resolve Mock Address (In prod use a Token List)
if ticker == "PEPE":
addr = "0x25d887Ce7a35172C62FeBFD67a1856F20FaEbb00"

# 3. SCAN FOR ARBITRAGE (Own Capital)
strat = await find_triangular_arbitrage(addr)

if strat:
await execute_trade(strat, addr, source)
else:
print(f"{Fore.YELLOW} 📉 No Arbitrage detected for {ticker}")
except: pass

await client.start()
await client.run_until_disconnected()
else:
print(" ⚠️ No Telegram Keys. Running Local Simulation.")
while True:
await asyncio.sleep(5)
# Simulated Loop
addr = "0x25d887Ce7a35172C62FeBFD67a1856F20FaEbb00" # PEPE
strat = await find_triangular_arbitrage(addr)
if strat: await execute_trade(strat, addr, "SIMULATION")

if __name__ == "__main__":
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
try:
loop.run_until_complete(main())
except KeyboardInterrupt:
print("Stopped.")
