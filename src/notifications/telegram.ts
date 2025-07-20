import axios from "axios";
import {log} from "../utils/logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Sends a formatted message to a Telegram chat using the Bot API.
 *
 * @async
 * @function sendTelegramNotification
 * @param {string} message - The message text to send.
 * @param {object} [markup=null] - Optional Telegram inline keyboard markup.
 * @returns {Promise<void>}
 *
 * @example
 * await sendTelegramNotification("*Swap Alert:* USDT → ETH");
 */
export async function sendTelegramNotification(
  message: string,
  markup: any = null
): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    log("ERROR", "❌ Telegram bot token or chat ID is not set.");
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const params = {
    chat_id: CHAT_ID,
    text: message,
    parse_mode: "Markdown",
    reply_markup: markup || undefined,
  };

  try {
    const response = await axios.post(url, params);

    if (response.data.ok) {
      log("INFO", "✅ Telegram notification sent successfully.");
    } else {
      log(
        "WARN",
        "❌ Failed to send Telegram notification:",
        response.data.description
      );
    }
  } catch (error: any) {
    log(
      "ERROR",
      "❌ Error sending Telegram notification:",
      error?.message || error
    );
  }
}
