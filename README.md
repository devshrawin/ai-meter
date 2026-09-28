# AI Meter

A Chrome extension that shows how much of your usage limit is left on **Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek, Qwen, Le Chat, Copilot, Meta AI, Poe — and any other AI chat site you add** — as a small draggable meter on the page, a toolbar badge, and a popup with every provider in one place. Desktop notifications fire at 75 / 90 / 100 % and again when a limit resets.

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

| Provider | Source | How | Verified live |
|---|---|---|---|
| Claude | `real` | `GET /api/organizations/{org}/usage` — the endpoint behind Settings › Usage. Session (5h) + weekly utilization and reset times. | yes |
| ChatGPT | `estimate` + `real` | Chat caps aren't exposed anywhere, so sends are counted per model (defaults: 160 / 3h, Thinking 3000 / week). Real Codex 5h / weekly windows from `GET /backend-api/wham/usage` (Bearer from `/api/auth/session`, kept in memory only), plus `limits_progress` feature counters. | no |
| Gemini | `real` | Replays the `jSf9Qc` batchexecute RPC behind gemini.google.com/usage → 5h + weekly usage. Falls back to counting prompts. | no |
| Grok | `real` | Weekly percentage pool from `GrokBuildBilling/GetGrokCreditsConfig` (gRPC-web protobuf, decoded in-extension). Sends detected on the `/ws/mgw` WebSocket. | endpoints yes, numbers no |
| Perplexity | `real` | `GET /rest/rate-limit/all` → remaining Pro searches / research / labs. | no |
| Kimi | `real` | `MembershipService/GetSubscription` → `balances[].amountUsedRatio`. | no |
| DeepSeek, Qwen, Le Chat, Copilot, Meta AI, Poe | `estimate` | None of these expose usage; sends are counted (Le Chat default 25 / day). | no |
| Any site you add | `estimate` | Settings → Other AI sites. Sends detected heuristically (chat-like POST or WebSocket text frame). | — |

Every site also gets two free signals: the site's own limit notices (banner watcher) and HTTP 429 responses (with `Retry-After` as the reset time).

Estimate limits change often and differ by plan — set yours in **Settings → Estimate rules**.

## Iris

Iris, a white Persian with odd eyes, lives on top of the meter. She sits, blinks, grooms and walks
along the pill. Now and then she teeters off the edge, tumbles, sits dazed and leaps back up. Her
mood follows your session limit: calm, then worried, then stressed, and asleep in a loaf at 100%.
Click her for a reaction (eight quick clicks for a special one). You can turn her off in Settings.
She pauses in hidden tabs and sits still if you have reduced motion turned on.

She's drawn from 20 sprite frames in `src/assets/iris/`, cut from the reference sheets in `art/source/` by

```bash
python scripts/build-sprites.py   # needs Pillow + numpy
```

The script removes the drawn pill, hearts and motion lines, matches every frame to one scale using
the pill width, and writes each frame's size and pill-top anchor to `src/core/iris-frames.js`. To
use cleaner art later, drop in per-pose transparent PNGs and rerun. The animation code only reads
the frames by name.

## Adding any AI site

Settings → **Other AI sites** → enter the hostname (e.g. `chat.example.com`), optional limit + window → **Add site**. Chrome asks for access to that one site only (`optional_host_permissions`); AI Meter then registers its scripts there with `chrome.scripting.registerContentScripts`. Remove the site to revoke access.

## Privacy

- Everything stays in `chrome.storage.local` on your machine. No servers, no analytics.
- A page-world script mirrors network calls to the extension so it can spot sends and usage responses. Adapters only extract the **model name**; prompt text is never stored.
- Auth/session responses are never forwarded. Tokens needed for a usage call (ChatGPT, Kimi) stay in memory and are sent only back to that provider's own domain.
- The debug log stores request bodies as key names only, full response bodies only for usage/limit endpoints, and just the JSON *shape* (keys and types) of anything else.
- Usage requests are made from your own logged-in tab, to the provider's own domain, exactly as the site's settings page would.

## Debugging endpoints

Providers change internal APIs without notice. If a meter stops updating:

1. Settings → Debug → enable logging, then reload the site's tab.
2. Use the site normally (send a message, open its usage/settings page).
3. Back in Settings, **Copy log**. It shows whether the network hook is active, every POST / WebSocket send (body keys only), full usage/limit responses, the shape of other JSON responses, and adapter errors.
4. Update the matching file in `src/adapters/` (parsers live in `src/core/parsers.js` with tests in `test/`).

## Credits

Endpoint shapes for ChatGPT `wham/usage`, Gemini `jSf9Qc`, Grok credits protobuf and Kimi were learned from the MIT-licensed [RateBucket](https://github.com/Chihiro521/RateBucket-rate-limit-bucket), [claudetuner](https://github.com/chaehyun2/claudetuner) and [CodexBar](https://github.com/steipete/CodexBar). Parsers here are independent JS implementations.

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
    parsers.js         pure provider parsers (ChatGPT, Gemini, Grok protobuf, Kimi)
    store.js           chrome.storage helpers, local send counter
    banner.js          watches for the site's own limit notices
    widget.js          on-page meter (shadow DOM)
  adapters/            one file per provider; generic.js = counting sites + user-added sites
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
