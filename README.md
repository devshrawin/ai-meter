# AI Meter

A Chrome extension that shows how much of your usage limit is left on **Claude, ChatGPT, Gemini, Grok and Perplexity** — as a small draggable meter on the page, a toolbar badge, and a popup with every provider in one place. Desktop notifications fire at 75 / 90 / 100 % and again when a limit resets.

![icon](icons/icon128.png)

## Install (unpacked)

1. Clone or download this repo.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and pick the repo folder (the one with `manifest.json`).
4. Open any supported site. The meter appears bottom-right; drag it anywhere, click it for details.

## How each provider is measured

Every meter is tagged with where its number came from:

| Tag | Meaning |
|---|---|
| `real` | Read from the provider's own usage data |
| `estimate` | Counted locally from your sends, compared against limits you set |
| `banner` | Picked up from the site's own "limit reached" / "N messages left" notice |

| Provider | Source | How |
|---|---|---|
| Claude | `real` | Reads `/api/organizations/{org}/usage` — the same endpoint behind Settings › Usage. Session (5h) and weekly utilization + reset times. Refreshes every minute and after each message. |
| ChatGPT | `estimate` + `real` | Counts sends per model against editable rules (defaults: 160 msgs / 3h, Thinking 3000 / week). Also picks up `limits_progress` counters (deep research, images…) when the app loads them. |
| Gemini | `estimate` | Counts prompts, tagged with the model from the mode picker (default: Pro/Thinking 100 / day). |
| Grok | `real` | Captures `/rest/rate-limits` responses (remaining / total queries per model) and re-queries after each send. |
| Perplexity | `real` or `estimate` | Uses remaining-query counters from the app's settings / rate-limit calls when present, otherwise counts queries. |

Estimate limits change often and differ by plan — set yours in **Settings → Estimate rules**.

## Privacy

- Everything stays in `chrome.storage.local` on your machine. No servers, no analytics.
- A page-world script mirrors network calls to the extension so it can spot sends and usage responses. Adapters only extract the **model name**; prompt text is never stored.
- Usage requests are made from your own logged-in tab, to the provider's own domain, exactly as the site's settings page would.

## Debugging endpoints

Providers change internal APIs without notice. If a meter stops updating:

1. Settings → Debug → enable **Log limit-related network responses**.
2. Use the site normally (send a message, open its usage/settings page).
3. Back in Settings, **Copy log** — it lists POST endpoints and any JSON responses matching `rate-limit|usage|limits|quota`.
4. Update the matching file in `src/adapters/`.

## Project layout

```
manifest.json
src/
  inject.js            page-world fetch/XHR hook → postMessage
  content.js           picks the adapter for this site, wires events, publishes meters
  background.js        badge, threshold + reset notifications
  core/
    quotas.js          providers, default estimate rules, settings merge
    common.js          pure helpers: limit parsing, rolling counts, reset-time parsing
    store.js           chrome.storage helpers, local send counter
    banner.js          watches for the site's own limit notices
    widget.js          on-page meter (shadow DOM)
  adapters/            one file per provider
  popup/  options/
scripts/make-icons.mjs   renders icons/ with no dependencies
test/                    node:test unit tests for core logic
```

## Adding a provider

Create `src/adapters/<name>.js`:

```js
AIMeter.register({
  id: 'example', name: 'Example', hosts: ['example.com'],
  init(ctx) {
    ctx.onResponse((d) => { /* d.url, d.status, d.body, d.reqBody */ });
    ctx.onRequest((d) => { /* d.url, d.method, d.body */ });
    ctx.report('real', [{ id: 'daily', label: 'Daily', used: 3, limit: 50, resetAt: Date.now() + 3600e3, source: 'real' }]);
  },
  refresh() {},
});
```

Then add it to `content_scripts` + `host_permissions` in `manifest.json` and to `AM.PROVIDERS` in `src/core/quotas.js`.

## Development

```bash
npm test          # unit tests (Node 20+)
npm run icons     # regenerate icons
npm run zip       # package for the Chrome Web Store
```

## License

MIT
