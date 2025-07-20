type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

/**
 * Logs a message to the console with a timestamp and log level.
 *
 * Supported log levels:
 * - INFO: General information
 * - WARN: Non-critical warning
 * - ERROR: Critical issue or failure
 * - DEBUG: Developer-focused information
 *
 * @function log
 * @param {"INFO" | "WARN" | "ERROR" | "DEBUG"} level - The severity level of the log.
 * @param {...any[]} messages - The message(s) or data to log.
 *
 * @example
 * log("INFO", "Swap started");
 * log("ERROR", "Swap failed:", error.message);
 * log("DEBUG", { requestBody });
 */
export const log = (level: LogLevel, ...messages: any[]) => {
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const label = `[${timestamp}] [${level}]`;
  switch (level) {
    case "INFO":
      console.log(label, ...messages);
      break;
    case "WARN":
      console.warn(label, ...messages);
      break;
    case "ERROR":
      console.error(label, ...messages);
      break;
    case "DEBUG":
      console.debug(label, ...messages);
      break;
  }
};
