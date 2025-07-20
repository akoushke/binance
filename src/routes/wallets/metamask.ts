import axios from "axios";
import {Request, Response, Router} from "express";
import {
  CHAIN_ID,
  provider,
  WALLET_ADDRESS,
  API_KEY,
  wallet,
} from "../../configs/wallets/metamask";
import {TOKEN_ADDRESS_MAP} from "../../utils/tokens";
import {toWei} from "../../utils/toWei";
import {sendTelegramNotification} from "../../notifications/telegram";
import {getBalances} from "../../services/getBalance";
import {performTokenSwap} from "../../services/performTokenSwap";

const router = Router();
/**
 * GET /balances
 * Returns balances of all supported tokens for the configured wallet
 */
router.get("/balances", async (_req: Request, res: Response) => {
  try {
    const result = await getBalances(provider, WALLET_ADDRESS, CHAIN_ID);
    return res.status(200).json({success: true, ...result});
  } catch (error: any) {
    console.error("❌ Error retrieving balances:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve wallet balances.",
      error: error?.message || "Internal Server Error",
    });
  }
});

/**
 * POST /webhook
 * Trigger a token swap via 1inch Aggregation Protocol
 */
router.post("/webhook", async (req: Request, res: Response) => {
  const {from, to, amount} = req.body;

  console.log("📨 Swap request received:", {from, to, amount});

  if (!from || !to || !amount) {
    return res.status(400).json({
      success: false,
      message: "Missing 'from', 'to', or 'amount' in the request body.",
    });
  }

  const fromSymbol = from.toUpperCase();
  const toSymbol = to.toUpperCase();

  const fromToken = TOKEN_ADDRESS_MAP[fromSymbol];
  const toToken = TOKEN_ADDRESS_MAP[toSymbol];

  if (!fromToken || !toToken) {
    console.warn(
      `❌ Unsupported token(s): from='${fromSymbol}', to='${toSymbol}'`
    );
    return res.status(400).json({
      success: false,
      message: `Unsupported token symbol(s): from='${fromSymbol}', to='${toSymbol}'`,
    });
  }

  try {
    const amountWei = await toWei(String(amount), fromToken, provider);
    console.log(`🔢 Converted ${amount} ${fromSymbol} → ${amountWei} wei`);
    const txHash = await performTokenSwap(
      fromToken,
      toToken,
      amountWei,
      provider,
      wallet,
      WALLET_ADDRESS,
      API_KEY,
      CHAIN_ID
    );
    const {balances} = await getBalances(provider, WALLET_ADDRESS, CHAIN_ID);
    const balanceLines = Object.entries(balances)
      .map(([symbol, value]) => `• *${symbol}*: ${value}`)
      .join("\n");

    const message = `*Token Swap Alert:* ${amount} ${fromSymbol} → ${toSymbol}\n\n*Balances:*\n${balanceLines}`;

    await sendTelegramNotification(message, {
      inline_keyboard: [
        [
          {
            text: "View Transaction",
            url: `https://etherscan.io/tx/${txHash}`,
          },
        ],
      ],
    });

    return res.status(200).json({
      success: true,
      message: `Swap from ${fromSymbol} to ${toSymbol} submitted successfully.`,
      txHash,
    });
  } catch (error: any) {
    console.error("❌ Swap error:", error?.message || error);
    await sendTelegramNotification(
      `*Swap Failed:* ${amount} ${fromSymbol} → ${toSymbol}\n*Reason:* ${
        error?.message || "Unknown error"
      }`
    );

    return res.status(500).json({
      success: false,
      message: "Failed to perform token swap.",
      error: error?.message || "Internal Server Error",
    });
  }
});

export default router;
