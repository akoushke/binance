import axios from "axios";
import {ethers, parseUnits} from "ethers";
import type {JsonRpcProvider} from "ethers";

type TxObject = {
  from: string;
  to: string;
  data: string;
  value: string;
  gas: number;
  gasPrice?: string;
};

/**
 * Builds full request URL with query params
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
 * Builds the headers for 1inch API
 */
function buildHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    accept: "application/json",
  };
}

/**
 * Checks current token allowance
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
  console.log(`🔍 Checking allowance: ${url}`);
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});
  console.log(`📊 Allowance returned: ${res.data.allowance}`);
  return res.data.allowance;
}

/**
 * Builds the approval transaction
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
  console.log(`📝 Fetching approval transaction: ${url}`);
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});

  const gas = await provider.estimateGas({
    to: res.data.to,
    data: res.data.data,
    from: walletAddress,
    value: ethers.toBigInt(res.data.value),
  });

  console.log(`⛽ Estimated gas for approval: ${gas.toString()}`);

  return {...res.data, gas: Number(gas)};
}

/**
 * Builds the swap transaction via 1inch
 */
async function buildSwapTx(
  chainId: number,
  apiKey: string,
  swapParams: Record<string, any>
): Promise<TxObject> {
  const url = buildApiRequestUrl(chainId, "/swap", swapParams);
  console.log(`🔁 Building swap TX: ${url}`);
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});
  console.log(`📦 Swap TX payload received.`);
  return res.data.tx;
}

/**
 * Signs and sends transaction to the network
 */
async function signAndSendTransaction(
  wallet: ethers.Wallet,
  tx: TxObject
): Promise<string> {
  console.log(`🚀 Sending transaction to: ${tx.to}`);
  const txResponse = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: ethers.toBigInt(tx.value),
    gasLimit: tx.gas,
    gasPrice: tx.gasPrice ? ethers.toBigInt(tx.gasPrice) : undefined,
  });

  console.log(`📡 Waiting for transaction confirmation...`);
  await txResponse.wait(); // wait for 1 confirmation
  console.log(`✅ Transaction confirmed: ${txResponse.hash}`);
  return txResponse.hash;
}

/**
 * Performs a token swap using 1inch API
 * @param fromToken - Token contract address you're selling
 * @param toToken - Token contract address you're buying
 * @param amountWei - Amount in base units (wei)
 * @param provider - Ethers provider instance
 * @param wallet - Ethers wallet instance
 * @param walletAddress - Your wallet address
 * @param apiKey - 1inch API key
 * @param chainId - Chain ID (e.g. 1 for Ethereum)
 * @returns The swap transaction hash
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
  console.log(
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
    console.log(`⚠️ Insufficient allowance. Approval required.`);
    const approvalTx = await buildApprovalTx(
      provider,
      chainId,
      apiKey,
      walletAddress,
      fromToken,
      amountWei
    );
    const approvalHash = await signAndSendTransaction(wallet, approvalTx);
    console.log(`✅ Approval TX hash: ${approvalHash}`);
  } else {
    console.log(`👍 Sufficient allowance. No approval needed.`);
  }

  const swapTx = await buildSwapTx(chainId, apiKey, swapParams);
  const swapHash = await signAndSendTransaction(wallet, swapTx);
  console.log(`✅ Swap TX hash: ${swapHash}`);

  return swapHash;
}
