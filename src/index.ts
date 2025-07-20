import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import {log} from "./utils/logger";

dotenv.config();
import metamaskRoute from "./routes/wallets/metamask";

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.use("/wallets/metamask", metamaskRoute);

app.get("/", (req, res) => {
  res.send("Welcome to the Crypto Trading Webhook API");
});

app.listen(PORT, () => {
  log("INFO", `🚀 Server running on http://localhost:${PORT}`);
});
