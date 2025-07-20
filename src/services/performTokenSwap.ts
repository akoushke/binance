import axios from "axios";
import {ethers, parseUnits} from "ethers";
import type {JsonRpcProvider} from "ethers";
import {log} from "../utils/logger";

/**
 * @typedef {Object} TxObject
 * @property {string} from - Sender address
 * @property {string} to - Receiver address
 * @property {string} data - Encoded function call
 * @property {string} value - Amount of ETH to send (in wei)
 * @property {number} gas - Estimated gas limit
 * @property {string} [gasPrice] - Optional gas price
 */
type TxObject = {
  from: string;
  to: string;
  data: string;
  value: string;
  gas: number;
  gasPrice?: string;
};

/**
 * Builds full request URL with query parameters.
 * @param {number} chainId - Blockchain chain ID.
 * @param {string} endpoint - 1inch API endpoint.
 * @param {Record<string, any>} params - Query parameters.
 * @returns {string} Full API URL.
 */
function buildApiRequestUrl(
  chainId: number,
  endpoint: string,
  params: Record<string, any>
): string {
  const baseUrl = `https://api.1inch.dev/swap/v6.0/${chainId}`;
  return `${baseUrl}${endpoint}?${new URLSearchParams(params).toString()}`;
}

/**
 * Builds the headers for 1inch API.
 * @param {string} apiKey - 1inch API key.
 * @returns {Record<string, string>} HTTP headers.
 */
function buildHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    accept: "application/json",
  };
}

/**
 * Checks current token allowance for a wallet.
 * @param {JsonRpcProvider} provider - Ethers provider instance.
 * @param {number} chainId - Blockchain chain ID.
 * @param {string} apiKey - 1inch API key.
 * @param {string} tokenAddress - ERC20 token address.
 * @param {string} walletAddress - Wallet address.
 * @returns {Promise<string>} Allowance in wei.
 */
async function checkAllowance(
  provider: JsonRpcProvider,
  chainId: number,
  apiKey: string,
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  const url = buildApiRequestUrl(chainId, "/approve/allowance", {
    tokenAddress,
    walletAddress,
  });
  log("INFO", `🔍 Checking allowance: ${url}`);
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});
  log("INFO", `📊 Allowance returned: ${res.data.allowance}`);
  return res.data.allowance;
}

/**
 * Builds an approval transaction object.
 * @param {JsonRpcProvider} provider - Ethers provider instance.
 * @param {number} chainId - Blockchain chain ID.
 * @param {string} apiKey - 1inch API key.
 * @param {string} walletAddress - Wallet address.
 * @param {string} tokenAddress - Token to approve.
 * @param {string} [amount] - Optional amount to approve.
 * @returns {Promise<TxObject>} Transaction object.
 */
async function buildApprovalTx(
  provider: JsonRpcProvider,
  chainId: number,
  apiKey: string,
  walletAddress: string,
  tokenAddress: string,
  amount?: string
): Promise<TxObject> {
  const url = buildApiRequestUrl(
    chainId,
    "/approve/transaction",
    amount ? {tokenAddress, amount} : {tokenAddress}
  );
  log("INFO", `📝 Fetching approval transaction: ${url}`);
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});

  const gas = await provider.estimateGas({
    to: res.data.to,
    data: res.data.data,
    from: walletAddress,
    value: ethers.toBigInt(res.data.value),
  });

  log("INFO", `⛽ Estimated gas for approval: ${gas.toString()}`);

  return {...res.data, gas: Number(gas)};
}

/**
 * Builds a swap transaction using the 1inch API.
 * @param {number} chainId - Blockchain chain ID.
 * @param {string} apiKey - 1inch API key.
 * @param {Record<string, any>} swapParams - Swap parameters.
 * @returns {Promise<TxObject>} Swap transaction object.
 */
async function buildSwapTx(
  chainId: number,
  apiKey: string,
  swapParams: Record<string, any>
): Promise<TxObject> {
  const url = buildApiRequestUrl(chainId, "/swap", swapParams);
  log("INFO", `🔁 Building swap TX: ${url}`);
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});
  log("INFO", `📦 Swap TX payload received.`);
  return res.data.tx;
}

/**
 * Signs and sends a transaction to the blockchain network.
 * @param {ethers.Wallet} wallet - Ethers Wallet instance.
 * @param {TxObject} tx - Transaction object.
 * @returns {Promise<string>} Transaction hash.
 */
async function signAndSendTransaction(
  wallet: ethers.Wallet,
  tx: TxObject
): Promise<string> {
  log("INFO", `🚀 Sending transaction to: ${tx.to}`);
  const txResponse = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: ethers.toBigInt(tx.value),
    gasLimit: tx.gas,
    gasPrice: tx.gasPrice ? ethers.toBigInt(tx.gasPrice) : undefined,
  });

  log("INFO", `📡 Waiting for transaction confirmation...`);
  await txResponse.wait();
  log("INFO", `✅ Transaction confirmed: ${txResponse.hash}`);
  return txResponse.hash;
}

/**
 * Performs a token swap using 1inch API.
 * @param {string} fromToken - Token contract address you're selling.
 * @param {string} toToken - Token contract address you're buying.
 * @param {string} amountWei - Amount to sell (in wei).
 * @param {JsonRpcProvider} provider - Ethers provider instance.
 * @param {ethers.Wallet} wallet - Ethers wallet instance.
 * @param {string} walletAddress - Wallet address.
 * @param {string} apiKey - 1inch API key.
 * @param {number} chainId - Blockchain chain ID.
 * @returns {Promise<string>} The transaction hash.
 */
export async function performTokenSwap(
  fromToken: string,
  toToken: string,
  amountWei: string,
  provider: JsonRpcProvider,
  wallet: ethers.Wallet,
  walletAddress: string,
  apiKey: string,
  chainId: number
): Promise<string> {
  log(
    "INFO",
    `💰 Starting token swap: ${fromToken} → ${toToken} | Amount (wei): ${amountWei}`
  );

  const swapParams = {
    src: fromToken,
    dst: toToken,
    amount: amountWei,
    from: walletAddress,
    slippage: 1,
    disableEstimate: false,
    allowPartialFill: false,
  };

  const allowance = await checkAllowance(
    provider,
    chainId,
    apiKey,
    fromToken,
    walletAddress
  );

  if (BigInt(allowance) < BigInt(amountWei)) {
    log("WARN", `⚠️ Insufficient allowance. Approval required.`);
    const approvalTx = await buildApprovalTx(
      provider,
      chainId,
      apiKey,
      walletAddress,
      fromToken,
      amountWei
    );
    const approvalHash = await signAndSendTransaction(wallet, approvalTx);
    log("INFO", `✅ Approval TX hash: ${approvalHash}`);
  } else {
    log("INFO", `👍 Sufficient allowance. No approval needed.`);
  }

  const swapTx = await buildSwapTx(chainId, apiKey, swapParams);
  const swapHash = await signAndSendTransaction(wallet, swapTx);
  log("INFO", `✅ Swap TX hash: ${swapHash}`);

  return swapHash;
}
