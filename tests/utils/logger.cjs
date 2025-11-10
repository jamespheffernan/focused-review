const ICONS = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  step: '➡️',
};

function timestamp() {
  return new Date().toISOString();
}

function formatMessage(type, message) {
  const icon = ICONS[type] ?? ICONS.info;
  return `${timestamp()} ${icon} ${message}`;
}

function log(message, type = 'info') {
  const formatted = formatMessage(type, message);
  if (type === 'error') {
    console.error(formatted);
  } else if (type === 'warning') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

function createLogger(prefix = '') {
  const withPrefix = (msg) => (prefix ? `[${prefix}] ${msg}` : msg);
  return {
    info: (msg) => log(withPrefix(msg), 'info'),
    success: (msg) => log(withPrefix(msg), 'success'),
    warning: (msg) => log(withPrefix(msg), 'warning'),
    error: (msg) => log(withPrefix(msg), 'error'),
    step: (msg) => log(withPrefix(msg), 'step'),
  };
}

module.exports = {
  log,
  createLogger,
  ICONS,
};


