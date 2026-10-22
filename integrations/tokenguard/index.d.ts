export declare const DEFAULT_BASE_URL: string;
export interface TokenGuardOptions { apiKey?: string; baseUrl?: string; fetch?: typeof fetch; timeoutMs?: number }
export interface TokenGuardReport {
  chain: string; address: string; verdict: "SAFE" | "CAUTION" | "DANGER"; risk_score: number; flags: string[];
  token?: { name?: string; symbol?: string; decimals?: number; supply?: number; program?: string };
  sell_test?: { status: string; round_trip_pct?: number }; creator_record?: { seen: number; rugged: number };
  market?: { fdv?: number; liquidity?: number; volume24h?: number; lp_locked_pct?: number; links?: Record<string, string> };
  [k: string]: unknown;
}
export declare class TokenGuardError extends Error { status?: number; body?: unknown }
export declare function extractAddress(text: string): string | null;
export declare function summarize(report: TokenGuardReport): string;
export declare class TokenGuard {
  constructor(opts?: TokenGuardOptions);
  apiKey: string; baseUrl: string;
  key(): Promise<string>;
  check(address: string): Promise<TokenGuardReport>;
  verdict(address: string): Promise<Pick<TokenGuardReport, "verdict" | "risk_score" | "flags" | "address" | "chain">>;
  isSafe(address: string, opts?: { maxScore?: number }): Promise<{ ok: boolean; verdict: string; risk_score: number; flags: string[] }>;
}
export declare function checkToken(address: string, opts?: TokenGuardOptions): Promise<TokenGuardReport>;
export default TokenGuard;
