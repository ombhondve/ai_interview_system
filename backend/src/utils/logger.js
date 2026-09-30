/**
 * Simple logger utility
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LEVEL = process.env.LOG_LEVEL || "INFO";

function getLevelValue(level) {
  return LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
}

function shouldLog(level) {
  return getLevelValue(level) <= getLevelValue(CURRENT_LEVEL);
}

function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  
  return `[${timestamp}] [${level}] ${message} ${formattedArgs}`.trim();
}

const logger = {
  error: (message, ...args) => {
    if (shouldLog("ERROR")) {
      console.error(formatMessage("ERROR", message, ...args));
    }
  },
  
  warn: (message, ...args) => {
    if (shouldLog("WARN")) {
      console.warn(formatMessage("WARN", message, ...args));
    }
  },
  
  info: (message, ...args) => {
    if (shouldLog("INFO")) {
      console.info(formatMessage("INFO", message, ...args));
    }
  },
  
  debug: (message, ...args) => {
    if (shouldLog("DEBUG")) {
      console.debug(formatMessage("DEBUG", message, ...args));
    }
  }
};

export default logger;