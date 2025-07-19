// src/utils/web3Context.ts
import {JsonRpcProvider} from "ethers";
import {ethers} from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ALCHEMY_RPC_URL!;
const WALLET_ADDRESS = process.env.METAMASK_WALLET_ADDRESS!;
const PRIVATE_KEY = process.env.METAMASK_PRIVATE_KEY!;
const API_KEY = process.env.ONE_INCH_API_KEY!;
const CHAIN_ID = Number(process.env.CHAIN_ID || 1);

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

export {
  RPC_URL,
  WALLET_ADDRESS,
  PRIVATE_KEY,
  API_KEY,
  CHAIN_ID,
  provider,
  wallet,
};
