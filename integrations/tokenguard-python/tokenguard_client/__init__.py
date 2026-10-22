"""TokenGuard: rug check for Solana, BNB Chain, Base and Ethereum tokens before you buy.

>>> from tokenguard_client import TokenGuard
>>> tg = TokenGuard()                     # free key (50 checks a day) created on first use
>>> print(tg.summary("https://pump.fun/coin/<MINT>"))
Standard library only (urllib). Risk signals, not financial advice.
"""
from __future__ import annotations
import json, os, re, urllib.error, urllib.request

__all__ = ["TokenGuard", "TokenGuardError", "extract_address", "summarize", "check_token"]
__version__ = "1.0.0"
DEFAULT_BASE_URL = "https://gdzlcxskuhupymyxywzm.supabase.co/functions/v1/tokenguard"
_ADDR = re.compile(r"0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}")


class TokenGuardError(Exception):
    def __init__(self, message: str, status: int | None = None, body: dict | None = None):
        super().__init__(message)
        self.status, self.body = status, body or {}


def extract_address(text: str) -> str | None:
    """First token address found in a text, a pump.fun / DexScreener link or a raw address."""
    m = _ADDR.search(text or "")
    if not m:
        return None
    a = m.group(0)
    return a.lower() if a.startswith("0x") else a


def summarize(r: dict) -> str:
    """One readable line: 'DANGER · 85/100 · $XYZ · risks: freeze_authority · NO SELL ROUTE (honeypot)'."""
    if not r or not r.get("verdict"):
        return "No verdict."
    flags = [f for f in r.get("flags") or [] if f != "trusted_token"]
    st = r.get("sell_test") or {}
    sell = (f"sellable ({st.get('round_trip_pct')}% round trip)" if st.get("status") == "ok"
            else "NO SELL ROUTE (honeypot)" if st.get("status") == "no_sell_route" else "")
    sym = (r.get("token") or {}).get("symbol")
    parts = [f"{r['verdict']} · {r.get('risk_score')}/100", f"${sym}" if sym else "",
             f"risks: {', '.join(flags)}" if flags else "no risk signal", sell]
    return " · ".join(p for p in parts if p)


class TokenGuard:
    def __init__(self, api_key: str | None = None, base_url: str = DEFAULT_BASE_URL, timeout: float = 30):
        self.api_key = api_key or os.environ.get("TOKENGUARD_API_KEY", "")
        self.base_url, self.timeout = base_url.rstrip("/"), timeout

    def _req(self, path: str, data: dict | None = None, headers: dict | None = None) -> tuple[int, dict]:
        req = urllib.request.Request(self.base_url + path, data=json.dumps(data).encode() if data is not None else None,
                                     headers={"content-type": "application/json", "user-agent": "tokenguard-python/1", **(headers or {})},
                                     method="POST" if data is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b"{}")
            except ValueError:
                return e.code, {}

    def key(self) -> str:
        if not self.api_key:
            status, j = self._req("/keys", {"contact": "sdk-python"})
            if not j.get("api_key"):
                raise TokenGuardError(j.get("error", "could not create a free key"), status, j)
            self.api_key = j["api_key"]
        return self.api_key

    def _get(self, path: str, address: str) -> dict:
        addr = extract_address(address)
        if not addr:
            raise TokenGuardError("no token address found", 400)
        status, j = self._req(f"{path}?address={addr}", headers={"x-api-key": self.key()})
        if status == 429:
            raise TokenGuardError("daily limit reached: upgrade at https://t.me/Token_guard_bot?start=upgrade", 429, j)
        if status != 200 or not j.get("verdict"):
            raise TokenGuardError(j.get("error", f"HTTP {status}"), status, j)
        return j

    def check(self, address: str) -> dict:
        """Full report: verdict, risk_score, flags, authorities, holders, sell_test, creator_record, market."""
        return self._get("/v1/check", address)

    def verdict(self, address: str) -> dict:
        """Lighter and faster: verdict, risk_score, flags."""
        return self._get("/v1/verdict", address)

    def is_safe(self, address: str, max_score: int = 30) -> bool:
        """Pre-trade gate: True only for SAFE with a score at or under max_score."""
        r = self.verdict(address)
        return r["verdict"] == "SAFE" and r["risk_score"] <= max_score

    def summary(self, address: str) -> str:
        return summarize(self.check(address))


def check_token(address: str, api_key: str | None = None) -> dict:
    return TokenGuard(api_key).check(address)
