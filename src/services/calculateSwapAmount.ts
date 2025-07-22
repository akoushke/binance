import axios from "axios";
import {log} from "../utils/logger";

type TradeDirection = "ETH_TO_USDT" | "USDT_TO_ETH";
const COINGECKO_API_URL = process.env.COINGECKO_API_URL;

/**
 * Fetches the most recent ETH price in USD from Coingecko using /market_chart endpoint.
 * Extracts the latest daily closing price from the 'prices' array.
 */
async function fetchEthPrice(): Promise<number> {
  const url = `${COINGECKO_API_URL}/coins/ethereum/market_chart`;
  const response = await axios.get(url, {
    params: {
      vs_currency: "usd",
      days: 1,
      interval: "daily",
    },
  });

  const prices: [number, number][] = response.data.prices;
  if (!prices || prices.length === 0) {
    throw new Error("No price data returned from Coingecko.");
  }

  return prices[prices.length - 1][1]; // last price
}

/**
 * Fetches daily ETH prices over the past year from Coingecko for volatility analysis.
 */
async function fetchDailyEthPrices(): Promise<number[]> {
  const url = `${COINGECKO_API_URL}/coins/ethereum/market_chart`;
  const response = await axios.get(url, {
    params: {
      vs_currency: "usd",
      days: 365,
      interval: "daily",
    },
  });

  return response.data.prices.map((p: [number, number]) => p[1]);
}

/**
 * Converts a list of prices into log returns.
 */
function calculateLogReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const r = Math.log(prices[i] / prices[i - 1]);
    if (!isNaN(r)) returns.push(r);
  }
  return returns;
}

/**
 * Computes the standard deviation of a numeric array.
 */
function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculates how much ETH or USDT to swap based on:
 * - The user's token balances
 * - A specified max risk percentage of token balance
 * - ETH volatility
 *
 * Volatility reduces position size (more volatility = smaller trade).
 */
export async function calculateSwapAmount({
  ethBalance,
  usdtBalance,
  riskPct = 0.02,
  tradeDirection,
}: {
  ethBalance: number;
  usdtBalance: number;
  riskPct?: number;
  tradeDirection: TradeDirection;
}): Promise<number> {
  log("INFO", `📊 Calculating swap amount`, {tradeDirection, riskPct});

  const ethPrice = await fetchEthPrice();
  log("DEBUG", `Current ETH price: $${ethPrice.toFixed(2)}`);

  const dailyPrices = await fetchDailyEthPrices();
  log("DEBUG", `Fetched ${dailyPrices.length} daily ETH prices`);

  const logReturns = calculateLogReturns(dailyPrices);
  const rawVolatility = stdDev(logReturns);
  const volatility = Math.max(rawVolatility, 0.001); // prevent divide-by-zero

  log(
    "DEBUG",
    `Raw volatility: ${rawVolatility.toFixed(
      5
    )} | Adjusted: ${volatility.toFixed(5)}`
  );

  // Adjust trade exposure: more volatility → smaller position
  const targetVol = 0.02; // 2% baseline daily volatility
  const volAdjustment = Math.min(1, targetVol / volatility); // dampens if too volatile
  const adjustedPct = riskPct * volAdjustment;

  let amount: number;

  if (tradeDirection === "USDT_TO_ETH") {
    amount = usdtBalance * adjustedPct;
    log(
      "INFO",
      `USDT → ETH | Swap ${adjustedPct * 100}% of USDT (${amount.toFixed(
        2
      )} USDT)`
    );
  } else {
    amount = ethBalance * adjustedPct;
    log(
      "INFO",
      `ETH → USDT | Swap ${adjustedPct * 100}% of ETH (${amount.toFixed(
        6
      )} ETH)`
    );
  }

  return Number(amount.toFixed(6));
}
