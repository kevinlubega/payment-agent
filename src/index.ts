import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import { runPaymentAgent } from "./agent";
import { getLimitsStatus } from "./limits";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/limits", (_req, res) => {
  res.json(getLimitsStatus());
});

app.get("/", (_req, res) => {
  res.send(/* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Agent</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0a0a0a;
      color: #e0e0e0;
      font-family: "JetBrains Mono", "Fira Code", "Courier New", monospace;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .terminal {
      width: 100%;
      max-width: 680px;
    }

    .terminal-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot-red    { background: #ff5f57; }
    .dot-yellow { background: #febc2e; }
    .dot-green  { background: #28c840; }

    h1 {
      font-size: 0.85rem;
      color: #555;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-left: 0.75rem;
    }

    .prompt-line {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .caret {
      color: #00ff88;
      font-size: 1rem;
      user-select: none;
    }

    input[type="text"] {
      flex: 1;
      background: transparent;
      border: none;
      border-bottom: 1px solid #333;
      color: #e0e0e0;
      font-family: inherit;
      font-size: 0.95rem;
      padding: 0.4rem 0;
      outline: none;
      transition: border-color 0.2s;
    }

    input[type="text"]:focus { border-bottom-color: #00ff88; }
    input[type="text"]::placeholder { color: #444; }

    button {
      background: transparent;
      border: 1px solid #00ff88;
      color: #00ff88;
      font-family: inherit;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
      padding: 0.45rem 1.2rem;
      cursor: pointer;
      text-transform: uppercase;
      transition: background 0.15s, color 0.15s;
    }

    button:hover:not(:disabled) { background: #00ff88; color: #0a0a0a; }
    button:disabled { opacity: 0.35; cursor: not-allowed; }

    .divider {
      border: none;
      border-top: 1px solid #1e1e1e;
      margin: 1.75rem 0;
    }

    .result { display: none; }
    .result.visible { display: block; }

    .status-line {
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      margin-bottom: 1.25rem;
    }

    .status-line.success { color: #00ff88; }
    .status-line.error   { color: #ff5f57; }
    .status-line.pending { color: #febc2e; }

    .field { margin-bottom: 0.85rem; }

    .field-label {
      font-size: 0.68rem;
      color: #555;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }

    .field-value {
      font-size: 0.88rem;
      color: #e0e0e0;
      word-break: break-all;
    }

    .field-value.highlight { color: #00ff88; }

    .tx-link {
      color: #00ff88;
      text-decoration: none;
      font-size: 0.88rem;
      word-break: break-all;
    }
    .tx-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="terminal">
    <div class="terminal-header">
      <span class="dot dot-red"></span>
      <span class="dot dot-yellow"></span>
      <span class="dot dot-green"></span>
      <h1>USDC Payment Agent // Base Sepolia</h1>
    </div>

    <div class="prompt-line">
      <span class="caret">$</span>
      <input
        id="instruction"
        type="text"
        placeholder='Pay 5 USDC to 0xABC... for the coffee order'
        autocomplete="off"
        spellcheck="false"
      />
      <button id="sendBtn">Send</button>
    </div>

    <hr class="divider" />

    <div class="result" id="result">
      <div class="status-line" id="statusLine"></div>

      <div id="fields"></div>
    </div>
  </div>

  <script>
    const input    = document.getElementById('instruction');
    const sendBtn  = document.getElementById('sendBtn');
    const result   = document.getElementById('result');
    const statusLine = document.getElementById('statusLine');
    const fields   = document.getElementById('fields');

    function field(label, value, opts = {}) {
      return \`<div class="field">
        <div class="field-label">\${label}</div>
        <div class="field-value\${opts.highlight ? ' highlight' : ''}">\${value}</div>
      </div>\`;
    }

    function showPending() {
      result.classList.add('visible');
      statusLine.className = 'status-line pending';
      statusLine.textContent = '// processing...';
      fields.innerHTML = '';
    }

    function showSuccess(data) {
      statusLine.className = 'status-line success';
      statusLine.textContent = '// payment confirmed';
      const basescanUrl = 'https://sepolia.basescan.org/tx/' + data.txHash;
      fields.innerHTML =
        field('Amount', data.amount + ' USDC', { highlight: true }) +
        field('Recipient', data.recipient) +
        field('Memo', data.memo) +
        \`<div class="field">
          <div class="field-label">Transaction</div>
          <a class="tx-link" href="\${basescanUrl}" target="_blank" rel="noopener">\${data.txHash}</a>
        </div>\`;
    }

    function showError(msg) {
      statusLine.className = 'status-line error';
      statusLine.textContent = '// error';
      fields.innerHTML = field('Message', msg);
    }

    async function sendPayment() {
      const instruction = input.value.trim();
      if (!instruction) return;

      sendBtn.disabled = true;
      showPending();

      try {
        const res = await fetch('/agent/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction }),
        });

        const data = await res.json();

        if (data.success) {
          showSuccess(data);
        } else {
          showError(data.error || 'Unknown error');
        }
      } catch (err) {
        showError(err.message || 'Network error');
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', sendPayment);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendPayment();
    });
  </script>
</body>
</html>`);
});

app.post("/agent/pay", async (req, res) => {
  const { instruction } = req.body as { instruction?: string };

  if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
    res.status(400).json({ success: false, error: "instruction is required" });
    return;
  }

  try {
    const result = await runPaymentAgent(instruction.trim());
    res.json(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error });
  }
});

app.listen(PORT, () => {
  console.log(`Payment agent running on http://localhost:${PORT}`);
});
