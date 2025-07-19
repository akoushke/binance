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
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});
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
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});

  const gas = await provider.estimateGas({
    to: res.data.to,
    data: res.data.data,
    from: walletAddress,
    value: ethers.toBigInt(res.data.value),
  });

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
  const res = await axios.get(url, {headers: buildHeaders(apiKey)});
  return res.data.tx;
}

/**
 * Signs and sends transaction to the network
 */
async function signAndSendTransaction(
  wallet: ethers.Wallet,
  tx: TxObject
): Promise<string> {
  const txResponse = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: ethers.toBigInt(tx.value),
    gasLimit: tx.gas,
    gasPrice: tx.gasPrice ? ethers.toBigInt(tx.gasPrice) : undefined,
  });

  await txResponse.wait(); // wait for 1 confirmation
  return txResponse.hash;
}

/**
 * Performs a token swap using 1inch API
 * @param fromSymbol - Token you're selling
 * @param toSymbol - Token you're buying
 * @param amount - Human-readable amount (e.g. "0.1")
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
  amount: string,
  provider: JsonRpcProvider,
  wallet: ethers.Wallet,
  walletAddress: string,
  apiKey: string,
  chainId: number
): Promise<string> {
  const amountWei = parseUnits(amount, 18).toString();

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
    const approvalTx = await buildApprovalTx(
      provider,
      chainId,
      apiKey,
      walletAddress,
      fromToken
    );
    const approvalHash = await signAndSendTransaction(wallet, approvalTx);
    console.log(`✅ Approval TX hash: ${approvalHash}`);
  }

  const swapTx = await buildSwapTx(chainId, apiKey, swapParams);
  const swapHash = await signAndSendTransaction(wallet, swapTx);
  console.log(`✅ Swap TX hash: ${swapHash}`);

  return swapHash;
}
