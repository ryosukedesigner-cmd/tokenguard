"""Gate every buy with TokenGuard."""
import os, sys, requests

API = "https://gdzlcxskuhupymyxywzm.supabase.co/functions/v1/tokenguard"
KEY = os.environ["TOKENGUARD_KEY"]

def size_for(mint: str, base: float) -> float:
    r = requests.get(f"{API}/v1/check", params={"address": mint}, headers={"x-api-key": KEY}, timeout=15).json()
    if r.get("verdict") == "DANGER":
        return 0.0
    return base / 2 if r.get("verdict") == "CAUTION" else base

if __name__ == "__main__" and len(sys.argv) > 1:
    print(size_for(sys.argv[1], 1.0))
