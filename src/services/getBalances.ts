import {ethers} from "ethers";
import type {JsonRpcProvider} from "ethers";
import {TOKEN_ADDRESS_MAP} from "../utils/tokens";
import {log} from "../utils/logger";

/**
 * Fetches the current ETH and ERC-20 token balances for a given wallet.
 *
 * @async
 * @function getBalances
 * @param {JsonRpcProvider} provider - The ethers.js provider instance.
 * @param {string} walletAddress - The wallet address to query balances for.
 * @param {number} chainId - The blockchain network's chain ID.
 * @returns {Promise<{
 *   wallet: string,
 *   chainId: number,
 *   balances: Record<string, string>
 * }>} An object containing the wallet address, chain ID, and token balances.
 *
 * @example
 * const data = await getBalances(provider, wallet, 1);
 * console.log(data.balances.USDT); // "1782.92"
 */
export const getBalances = async (
  provider: JsonRpcProvider,
  walletAddress: string,
  chainId: number
): Promise<{
  wallet: string;
  chainId: number;
  balances: Record<string, string>;
}> => {
  const balances: Record<string, string> = {};
  const nativeSymbol = "ETH";

  log("INFO", `📡 Fetching balances for wallet: ${walletAddress}`);

  try {
    const nativeBalance = await provider.getBalance(walletAddress);
    balances[nativeSymbol] = ethers.formatEther(nativeBalance);
    log("INFO", `💰 ${nativeSymbol}: ${balances[nativeSymbol]}`);
  } catch (err) {
    log(
      "WARN",
      `⚠️ Failed to fetch native ETH balance: ${(err as Error).message}`
    );
    balances[nativeSymbol] = "Error";
  }

  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  for (const [symbol, address] of Object.entries(TOKEN_ADDRESS_MAP)) {
    if (symbol === nativeSymbol) continue;

    try {
      const token = new ethers.Contract(address, erc20Abi, provider);
      const [rawBalance, decimals] = await Promise.all([
        token.balanceOf(walletAddress),
        token.decimals(),
      ]);

      const formatted = ethers.formatUnits(rawBalance, decimals);
      balances[symbol] = formatted;
      log("INFO", `💰 ${symbol}: ${formatted}`);
    } catch (err) {
      const errorMsg = (err as Error).message;
      log("WARN", `⚠️ Failed to fetch balance for ${symbol}: ${errorMsg}`);
      balances[symbol] = "Error";
    }
  }

  return {
    wallet: walletAddress,
    chainId,
    balances,
  };
};
