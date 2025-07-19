import {ethers, Contract, Provider} from "ethers";

// Standard ERC-20 ABI snippet for decimals()
const ERC20_ABI = ["function decimals() view returns (uint8)"];

/**
 * Converts a human-readable token amount (e.g. "1.5") into its base unit (wei)
 * @param amount - Human-readable amount like "2.5"
 * @param tokenAddress - Token address or 0xEeee... for native ETH
 * @param provider - ethers.js Provider instance
 * @returns Promise resolving to the amount in wei (as string)
 */
export async function toWei(
  amount: string,
  tokenAddress: string,
  provider: Provider
): Promise<string> {
  const isNativeETH =
    tokenAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  const decimals = isNativeETH
    ? 18
    : await new Contract(tokenAddress, ERC20_ABI, provider).decimals();

  return ethers.parseUnits(amount, decimals).toString();
}
