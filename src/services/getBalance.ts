import {ethers} from "ethers";
import type {JsonRpcProvider} from "ethers";
import {TOKEN_ADDRESS_MAP} from "../utils/tokens";

/**
 * Fetches the current ETH and ERC-20 token balances for the configured wallet.
 *
 * @async
 * @function getBalances
 * @returns {Promise<{
 *   wallet: string,
 *   chainId: number,
 *   balances: Record<string, string>
 * }>} An object containing the wallet address, chain ID, and a map of token symbols to their balances.
 *
 * @example
 * const data = await getBalances();
 * console.log(data.balances.USDT); // e.g., "200.00"
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

  console.log(`📡 Fetching balances for wallet: ${walletAddress}`);

  // Native ETH
  const nativeBalance = await provider.getBalance(walletAddress);
  balances[nativeSymbol] = ethers.formatEther(nativeBalance);
  console.log(`💰 ${nativeSymbol}: ${balances[nativeSymbol]}`);

  // ERC-20 balances
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
      console.log(`💰 ${symbol}: ${formatted}`);
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.warn(`⚠️ Failed to fetch balance for ${symbol}: ${errorMsg}`);
      balances[symbol] = "Error";
    }
  }

  return {
    wallet: walletAddress,
    chainId,
    balances,
  };
};
