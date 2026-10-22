// TokenGuard plugin for GOAT (Great Onchain Agent Toolkit): a pre-trade rug / honeypot check tool for any agent framework GOAT supports.
import { PluginBase, createTool } from "@goat-sdk/core";
import { z } from "zod";
import { TokenGuard, summarize } from "tokenguard";

export class TokenGuardPlugin extends PluginBase {
  constructor(opts = {}) {
    super("tokenguard", []);
    this.tg = new TokenGuard(opts);
  }
  supportsChain(chain) {
    return chain.type === "solana" || (chain.type === "evm" && [1, 56, 8453].includes(chain.id));
  }
  getTools() {
    const address = z.string().describe("Token address (Solana mint or 0x contract) or a pump.fun / DexScreener link");
    return [
      createTool({
        name: "tokenguard_check_token",
        description: "Check a token for rug-pull and honeypot risk BEFORE buying it. Returns verdict (SAFE, CAUTION, DANGER), risk_score out of 100, risk flags, sell test, creator record and market data. Call it before any swap.",
        parameters: z.object({ address }),
      }, async ({ address }) => { const r = await this.tg.check(address); return { summary: summarize(r), ...r }; }),
      createTool({
        name: "tokenguard_is_safe_to_buy",
        description: "Pre-trade gate: returns ok=true only if the token is SAFE with a risk score at or under max_score (default 30).",
        parameters: z.object({ address, max_score: z.number().min(0).max(100).optional() }),
      }, ({ address, max_score }) => this.tg.isSafe(address, { maxScore: max_score ?? 30 })),
    ];
  }
}

export const tokenguard = (opts) => new TokenGuardPlugin(opts);
export default tokenguard;
