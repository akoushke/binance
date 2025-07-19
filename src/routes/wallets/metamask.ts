import {Request, Response, Router} from "express";
import {ethers} from "ethers";
import {performTokenSwap} from "../../services/performTokenSwap";
import {
  provider,
  wallet,
  WALLET_ADDRESS,
  API_KEY,
  CHAIN_ID,
} from "../../configs/wallets/metamask";
import {TOKEN_ADDRESS_MAP} from "../../utils/tokens"; // 🧠 Centralized token registry

const router = Router();

/**
 * GET /balances
 * Returns balances of all supported tokens for the configured wallet
 */
router.get("/balances", async (_req: Request, res: Response) => {
  const balances: Record<string, string> = {};
  const nativeSymbol = "ETH";

  try {
    // 🔹 Native token balance
    const nativeBalance = await provider.getBalance(WALLET_ADDRESS);
    balances[nativeSymbol] = ethers.formatEther(nativeBalance);

    // 🔹 ERC-20 token balances
    const erc20Abi = [
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
    ];

    for (const [symbol, address] of Object.entries(TOKEN_ADDRESS_MAP)) {
      if (symbol === nativeSymbol) continue;

      try {
        const token = new ethers.Contract(address, erc20Abi, provider);
        const [rawBalance, decimals] = await Promise.all([
          token.balanceOf(WALLET_ADDRESS),
          token.decimals(),
        ]);

        balances[symbol] = ethers.formatUnits(rawBalance, decimals);
      } catch (err) {
        console.warn(
          `⚠️ Failed to get balance for ${symbol}:`,
          (err as Error).message
        );
        balances[symbol] = "Error";
      }
    }

    return res.status(200).json({
      success: true,
      wallet: WALLET_ADDRESS,
      chainId: CHAIN_ID,
      balances,
    });
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

  // ✅ Basic validation
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
    return res.status(400).json({
      success: false,
      message: `Unsupported token symbol(s): from='${fromSymbol}', to='${toSymbol}'`,
    });
  }

  try {
    const txHash = await performTokenSwap(
      fromToken,
      toToken,
      String(amount),
      provider,
      wallet,
      WALLET_ADDRESS,
      API_KEY,
      CHAIN_ID
    );

    return res.status(200).json({
      success: true,
      message: `Swap from ${fromSymbol} to ${toSymbol} submitted successfully.`,
      txHash,
    });
  } catch (error: any) {
    console.error("❌ Swap error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to perform token swap.",
      error: error?.message || "Internal Server Error",
    });
  }
});

export default router;
