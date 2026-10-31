# Headroom

*Formerly AI Meter. The code keeps the old name in a few internal identifiers (`AIMeter`, `aimeter:` messages, the `aimeter.pos` storage key) so nothing a user has saved is lost.*

A Chrome extension that shows how much of your usage limit is left on **Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek, Qwen, Le Chat, Copilot, Meta AI, Poe — and any other AI chat site you add** — as a small draggable meter on the page, a toolbar badge, and a popup with every provider in one place. Desktop notifications fire at 75 / 90 / 100 % and again when a limit resets.

![icon](icons/icon128.png)

## Install (unpacked)

1. Clone or download this repo.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and pick the repo folder (the one with `manifest.json`).
4. A short "how it works" page opens on first install. Open any supported site: the meter appears bottom-right; drag it anywhere (or focus it with Tab and use Shift + arrow keys), click it or press Enter for details.

Also in Settings: **Export / Import settings** (a backup file with your limits, thresholds and Iris options, never usage data) and a link to the first-run guide.

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
| Gemini | `real` | Replays the `jSf9Qc` batchexecute RPC behind gemini.google.com/usage → 5h + weekly usage. Falls back to counting prompts. | yes (2026-10-17) |
| Grok | `real` | Per-model chat limits from `POST /rest/rate-limits` (`remainingQueries` / `totalQueries` over a 24h window on the free tier; counts down as you chat). The gRPC-web `GrokBuildBilling/GetGrokCreditsConfig` weekly pool is the separate Grok Build credit pool and is shown only if it reports usage. Sends detected on the `/ws/mgw` WebSocket. | yes (2026-10-17) |
| Perplexity | `real` | `GET /rest/rate-limit/all` → remaining Pro searches / research / labs. | no |
| Kimi | `real` | `MembershipService/GetSubscription` → `balances[].amountUsedRatio`. | no |
| DeepSeek, Qwen, Le Chat, Copilot (copilot.com, formerly copilot.microsoft.com), Meta AI, Poe | `estimate` | None of these expose usage; sends are counted (Le Chat default 25 / day). | no |
| Any site you add | `estimate` | Settings → Other AI sites. Sends detected heuristically (chat-like POST or WebSocket text frame). | — |

Every site also gets two free signals: the site's own limit notices (banner watcher) and HTTP 429 responses (with `Retry-After` as the reset time).

Estimate limits change often and differ by plan — set yours in **Settings → Estimate rules**.

## Iris

Iris, a white Persian with odd eyes, lives on top of the meter. She sits, blinks, grooms and walks
along the pill. Now and then she teeters off the edge, tumbles, sits dazed and leaps back up. Her
mood follows your session limit: calm, then worried, then stressed, and asleep in a loaf at 100%.
Click her for a reaction (eight quick clicks for a special one). Now and then she plays with a yarn ball, batting it along the pill until she knocks it off the edge.
- **Energy** (Settings → Iris): *Calm* is the default. She mostly sits, with 7–15 s between actions, short strolls, rare tumbles and page wanders every 4–8 min. *Lively* is busier.
- **Home spot:** she rests at the right end of the pill, clear of the chat box's send button, and walks back there after every stroll or game.
- **Pick her up:** drag Iris (not the pill) to carry her by the scruff. Let go over anything on the page and she drops onto the first edge below, sits a few seconds, then runs back and jumps onto the pill. A click still pets her.
- **Send Iris home:** a button in Settings, or the link at the bottom of the pill's panel. She says bye and walks off; "Bring Iris back" returns her.
She pauses in hidden tabs and sits still if you have reduced motion turned on.

**Trips** (Settings → "Let Iris explore the page", on by default): Iris leaves the pill for the page itself.
- **Reply watcher:** when you send a message she hops onto the chat box and watches until the reply finishes.
- **Greeter:** when the reply is done she hops onto the new message and mews, then goes home.
- **Limit alarm:** when the site shows its own limit notice, or usage crosses 90%, she stands on it looking stressed, with a "!".
- **Idle explorer:** at most one wander every 1–3 minutes, onto the chat box or header. Never while you're typing, never in a hidden tab, never with reduced motion.
- **Falls:** while she's perched, the spot is re-measured every frame. If it scrolls, resizes, moves or disappears, she falls, sits dazed and climbs back.

She only stands on top edges. Only her visible sprite takes clicks, so the page stays usable, and dragging the pill calls her home. Where she can stand on each site is in `src/core/perches.js`: selectors verified live on 2026-09-28 (signed out) for ChatGPT, Gemini, Grok, Perplexity, Kimi, Qwen and Meta AI. Other sites use a generic finder that looks for the lowest text box and its styled container.

**Animation engine** (`src/core/pet.js`, rebuilt with Claude Design): one `requestAnimationFrame` clock drives everything.
- **Walking:** a 12-frame walk cycle (files named `walk8-*` for historical reasons, registered by `src/core/walk8-frames.js`) advances by distance travelled, so her feet don't skate.
- **Springs** give squash, stretch and tilt on every pose change, take-off and landing.
- **Turns** between front and side views read as a quick squeeze instead of a snap.
- **Jumps and falls** follow real arcs.
- **Idle:** she breathes, trembles when stressed, and sways when dizzy.

Debug knobs: `AIMeter.irisGait = 'walk8' | 'hop' | 'frames'`, `AIMeter.irisTimeScale` (slow motion).

The other poses are 16 sprite frames in `src/assets/iris/`. The current art is the October 2026 redesign: three generated sheets, background keyed out, each pose scaled to one cat size and its fur colour matched across all frames. The sprites are committed; `scripts/build-sprites.py` documents the earlier pipeline and does **not** regenerate this art. The animation code only reads frames by name.


## Adding any AI site

Settings → **Other AI sites** → enter the hostname (e.g. `chat.example.com`), optional limit + window → **Add site**. Chrome asks for access to that one site only (`optional_host_permissions`); Headroom then registers its scripts there with `chrome.scripting.registerContentScripts`. Remove the site to revoke access.

## Privacy

The full policy is in [`docs/privacy.md`](docs/privacy.md). The short version:


- Everything stays in `chrome.storage.local` on your machine. No servers, no analytics.
- Sign-in, password, OAuth, MFA, checkout and payment requests are never read by the page hook, and secret-looking fields are masked in any body it does forward; the debug log masks emails, tokens and ids. Security review: [`docs/security-review-2026-10-31.md`](docs/security-review-2026-10-31.md). Accessibility review: [`docs/a11y-review-2026-10-31.md`](docs/a11y-review-2026-10-31.md).
- A page-world script mirrors network calls to the extension so it can spot sends and usage responses. Adapters only extract the **model name**; prompt text is never stored.
- The page-world script talks to the extension over a private `MessageChannel` (not `window.postMessage`, which every script on the page can read and forge), and every message is schema-validated. The bodies of sign-in, session, token, account and profile requests and responses are never forwarded. Tokens needed for a usage call (ChatGPT, Kimi) stay in memory and are sent only back to that provider's own domain.
- The debug log stores request bodies as key names only, full response bodies only for usage/limit endpoints, and just the JSON *shape* (keys and types) of anything else.
- Iris's code and sprites load into a tab only when she is switched on, and the sprites are web-accessible to the provider sites only (sites you add yourself get the meter without her).
- Usage requests are made from your own logged-in tab, to the provider's own domain, exactly as the site's settings page would.

## Not affiliated

Headroom is an independent project. It is not affiliated with, endorsed by or sponsored by Anthropic, OpenAI, Google, xAI, Perplexity, Moonshot AI, DeepSeek, Alibaba, Mistral AI, Microsoft, Meta or Quora. Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek, Qwen, Le Chat, Copilot, Meta AI and Poe, and all related names and logos, are trademarks of their respective owners. They are used here only to identify the services Headroom works with.

## Store listing

The Chrome Web Store copy, permission justifications and screenshot list are in [`docs/store/listing.md`](docs/store/listing.md). What only the publisher can do to submit it: [`docs/store/submit-checklist.md`](docs/store/submit-checklist.md).

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
  popup/  options/  welcome/   toolbar popup, settings page, first-run guide
  assets/iris/         Iris sprite pack (webp)
scripts/make-icons.mjs        renders icons/ with no dependencies
scripts/build-store-zip.mjs   builds the Web Store zip into release/<date>/ (npm run store-zip)
tools/                        preview pages for the popup, pill and settings, and the store-image builder
test/                         node:test suites (settings, background worker, widget, content, Iris engine, hooks, parsers)
docs/                         privacy policy, store listing and checklist, security and accessibility reviews
```

## Development

```bash
npm test            # node --test, no dependencies to install
npm run store-zip   # release/<date>/headroom-<version>.zip, the file you upload to the Web Store
```

Bump `manifest.json`, `package.json` and `CHANGELOG.md` together. One dated release folder, one zip.

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

## Smoke-testing every site

`tools/site-smoke/` injects the extension's real scripts into a live page with an in-memory `chrome.*` stub, for checking that it mounts, picks the right adapter, hooks the network and finds the chat box, header and perch selectors, without installing the extension. Run `node tools/site-smoke/build.mjs 8801`, serve the repo root with `python -m http.server 8801`, and open `http://localhost:8801/tools/site-smoke/loader.html?to=https://grok.com` in a browser (the bundle rides along in `window.name`; sites that isolate tabs, like ChatGPT, clear it and only the selector checks can run). Signed-out only: usage endpoints need a login. Last run 2026-10-27: see `docs/site-smoke-2026-10-27.md`.

## Development

```bash
npm test          # unit tests (Node 20+)
npm run icons     # regenerate icons
npm run zip       # package for the Chrome Web Store
```

## License

MIT
