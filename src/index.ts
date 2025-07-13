import express, {Request, Response} from "express";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";

dotenv.config();

const app = express();
const port = 3000;

const API_KEY = process.env.BINANCE_API_KEY!;
const API_SECRET = process.env.BINANCE_API_SECRET!;

app.use(express.json());

interface WebhookPayload {
  action: "buy" | "sell";
  pair: string;
  quantity?: number;
}

app.post("/webhook", async (req: Request, res: Response) => {
  const data: WebhookPayload = req.body;
  console.log("📩 Webhook received:", data);

  if (!data.action || !data.pair) {
    return res.status(400).send("Missing required fields.");
  }

  const action = data.action.toLowerCase();
  const symbol = data.pair;
  const quantity = data.quantity || 0.001;

  if (!["buy", "sell"].includes(action)) {
    return res.status(400).send("Invalid action.");
  }

  try {
    const timestamp = Date.now();
    const query = `symbol=${symbol}&side=${action.toUpperCase()}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", API_SECRET)
      .update(query)
      .digest("hex");
    const url = `https://api.binance.us/api/v3/order?${query}&signature=${signature}`;

    const response = await axios.post(url, null, {
      headers: {"X-MBX-APIKEY": API_KEY},
    });

    console.log("✅ Trade executed:", response.data);
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error(
      "❌ Error placing order:",
      error.response?.data || error.message
    );
    res.status(500).send("Error placing order");
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}/webhook`);
});
