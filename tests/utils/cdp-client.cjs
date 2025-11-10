const http = require('http');
const WebSocket = require('ws');
const { sleep } = require('./time.cjs');
const { createLogger } = require('./logger.cjs');

const DEFAULT_PORT = 9222;

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

class CDPClient {
  constructor(options = {}) {
    const {
      port = DEFAULT_PORT,
      targetPredicate,
      logger = createLogger('CDP'),
      commandTimeout = 15000,
    } = options;

    this.port = port;
    this.baseUrl = `http://localhost:${port}`;
    this.targetPredicate = targetPredicate;
    this.logger = logger;
    this.commandTimeout = commandTimeout;

    this.ws = null;
    this.pending = new Map();
    this.commandId = 1;
  }

  async connect() {
    this.logger.step(`Connecting to CDP on port ${this.port}`);
    const targets = await fetchJSON(`${this.baseUrl}/json/list`);
    if (!targets || targets.length === 0) {
      throw new Error(
        'No debugging targets found. Ensure the Electron app is running with remote debugging enabled.'
      );
    }

    let target = targets.find((t) => t.type === 'page' && t.url.includes('index.html'));
    if (!target && typeof this.targetPredicate === 'function') {
      target = targets.find(this.targetPredicate);
    }
    if (!target) {
      target = targets[0];
    }

    this.target = target;
    this.logger.success(`Found target "${target.title}" (${target.id})`);
    this.ws = new WebSocket(target.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });

    this.logger.success('WebSocket connected');
    this.ws.on('message', (data) => this.#handleMessage(data));
    this.ws.on('error', (error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
    });

    await this.send('Runtime.enable').catch((error) => {
      this.logger.warning(`Unable to enable Runtime domain: ${error.message}`);
    });

    return this;
  }

  async close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = this.commandId++;
    const payload = JSON.stringify({ id, method, params });

    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timeout: ${method}`));
      }, this.commandTimeout);

      this.pending.set(id, { resolve, reject, timeout });
    });

    this.ws.send(payload);
    return promise;
  }

  async evaluate(expression, options = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      ...options,
    });

    if (result.exceptionDetails) {
      const errorText =
        result.exceptionDetails.text ??
        result.exceptionDetails.exception?.description ??
        'Unknown evaluation error';
      throw new Error(`JavaScript evaluation failed: ${errorText}`);
    }

    return result.result?.value;
  }

  async waitFor(conditionFn, { timeout = 10000, interval = 200, description = 'condition' } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await conditionFn();
      if (result) {
        return result;
      }
      await sleep(interval);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }

  #handleMessage(raw) {
    if (!raw) return;
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      this.logger.warning(`Failed to parse CDP message: ${error.message}`);
      return;
    }

    if (process.env.DEBUG_CDP) {
      this.logger.info(`CDP message: ${JSON.stringify(message)}`);
    }

    if (Object.prototype.hasOwnProperty.call(message, 'id')) {
      const entry = this.pending.get(message.id);
      if (!entry) {
        return;
      }
      const { resolve, reject, timeout } = entry;
      clearTimeout(timeout);
      this.pending.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
    }
  }
}

module.exports = {
  CDPClient,
  DEFAULT_PORT,
  fetchJSON,
};


