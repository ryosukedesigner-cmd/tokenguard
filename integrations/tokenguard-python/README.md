# tokenguard-client (Python)

Rug check for Solana, BNB Chain, Base and Ethereum tokens **before you buy**: SAFE / CAUTION / DANGER, risk score, honeypot sell test, pump.fun creator record. Standard library only.

```bash
pip install tokenguard-client
```

```python
from tokenguard_client import TokenGuard
tg = TokenGuard()                          # free key (50 checks a day) created on first use, or TokenGuard("tg_...")
print(tg.summary("https://pump.fun/coin/<MINT>"))
if tg.is_safe(mint):                       # pre-trade gate for bots
    ...
```

Telegram bot https://t.me/Token_guard_bot · browser extension https://tokenguard-bot.vercel.app/extension/. Risk signals, not financial advice.
