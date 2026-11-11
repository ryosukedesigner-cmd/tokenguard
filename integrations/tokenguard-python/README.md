# tokenguard-client (Python)

Rug check for Solana, BNB Chain, Base and Ethereum tokens **before you buy**: SAFE / CAUTION / DANGER, risk score, honeypot sell test, pump.fun creator record. Standard library only.

```bash
pip install tokenguard-client
```

```python
from tokenguard_client import TokenGuard
tg = TokenGuard()                          # free key (50 checks a day) created once and saved in ~/.tokenguard/key, or TokenGuard("tg_...")
print(tg.summary("https://pump.fun/coin/<MINT>"))
if tg.is_safe(mint):                       # pre-trade gate for bots
    ...
```

Telegram bot https://t.me/Token_guard_bot · browser extension https://tokenguard-bot.vercel.app/extension/. Risk signals, not financial advice.

## More checks

The free key gives 50 checks a day per machine. For more, pay in USDC from the SDK, no account needed:

```python
tg = TokenGuard()
print(tg.usage())                 # plan, daily_limit, used_today
bill = tg.upgrade("trader")       # 300 checks a day, 9 USDC a month ("starter": 2,000, "pro": 10,000)
print(bill["how"])                # send the exact amount shown; the plan turns on within 30 minutes
```

Or skip the key and pay per call over x402 (0.001 USDC a verdict). Risk signals, not financial advice.
