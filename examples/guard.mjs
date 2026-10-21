// Gate every buy with TokenGuard. Node 18+.
const API = "https://gdzlcxskuhupymyxywzm.supabase.co/functions/v1/tokenguard";
const KEY = process.env.TOKENGUARD_KEY;

export async function sizeFor(mint, baseSize) {
  const r = await fetch(`${API}/v1/check?address=${mint}`, { headers: { "x-api-key": KEY } }).then((r) => r.json());
  if (r.verdict === "DANGER") return 0;
  if (r.verdict === "CAUTION") return baseSize / 2;
  return baseSize;
}

if (process.argv[2]) console.log(await sizeFor(process.argv[2], 1));
