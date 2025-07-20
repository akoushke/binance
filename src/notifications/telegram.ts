import axios from "axios";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramNotification(
  message: string,
  markup: any = null
) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("❌ Telegram bot token or chat ID is not set.");
    return;
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const params = {
    chat_id: CHAT_ID,
    text: message,
    parse_mode: "Markdown",
    reply_markup: markup ? JSON.stringify(markup) : undefined,
  };

  try {
    const response = await axios.post(url, params);
    if (response.data.ok) {
      console.log("✅ Telegram notification sent successfully.");
    } else {
      console.error(
        "❌ Failed to send Telegram notification:",
        response.data.description
      );
    }
  } catch (error) {
    console.error("❌ Error sending Telegram notification:", error);
  }
}
