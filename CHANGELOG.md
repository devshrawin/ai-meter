# Changelog

All notable changes to AI Meter. Versions follow `manifest.json`.

## 0.10.0 — 2026-10-31

### Changed
- **New Iris art.** Redrawn sprite pack: clearer worried/stressed faces, a soft lavender edge so she stands out on white pages, and a smooth 12-frame walk cycle. Fur colour and size are matched across every pose.

## Unreleased (1.0.0)

### Fixed
- Two tabs reporting usage at the same moment could each fire the same threshold notification; usage and reset handling now run one at a time.
- A reset notification was lost or garbled when a provider name or limit label contained a `|`.

### Tests
- New suites for the service worker (thresholds, reset, restart), the on-page widget (ok, estimate, can't-read, sign-in, chat stats, drag, Iris mood), content script host and adapter selection (including user-added sites) and Iris's state machine (alarm trips, falls and recovery, reduced motion, hidden tab, pick-up).

## 0.9.2 — 2026-10-28

### Changed
- **Popup is one line per service.** Each shows its status LED, name, and the limit closest to full with a mini bar; click to expand the full bars, counters and reset times. Cards you opened stay open across refreshes.

## 0.9.1 — 2026-10-28

### Changed
- **Popup redesign.** Pearl-lavender look to match the pill, with dark mode. Cards show a status LED, one source badge per card (real or est) instead of one per row, and sort fresh first, then closest to its limit. Percentage limits are compact bars; counter-only limits (e.g. "5 left") are chips, with extras folded behind "Show all N limits". Providers not updated for a day are dimmed and marked stale. Icon buttons, summary line, "+ Add site" link and a friendlier empty state.
- A reset time that has already passed now reads "reset due" / "frees up now" instead of "resets in now".
- Added `tools/popup-preview` (the real popup with a stubbed `chrome.*` and sample data) for looking at the popup in any browser.

## 0.9.0 — 2026-10-28

Pre-ship pass for the Chrome Web Store.

### Added
- **"Can't read usage here" and "Sign in to see limits" states.** When a provider's usage call fails or the parser finds nothing, the pill, panel and popup now say so (an error after 15 s so a slow page doesn't flash a warning, a definite sign-out at once) instead of a silent "—" or a wrong number. The panel and popup have a one-click **Copy debug log** button (provider, problem, meters and that provider's stored debug entries; never message text).
- Store paperwork: `docs/store/listing.md` (name, descriptions, single-purpose statement, justification for every permission and host, data-usage answers, screenshot shot list) and `docs/privacy.md` (standalone privacy policy).
- Trademark / non-affiliation disclaimer in the listing, README and privacy policy.
- Tests for the problem state, each adapter's failure path, Perplexity signed in and out, the page-world channel and the manifest.

### Changed
- **Perplexity signed out** now shows "Sign in to see limits" instead of "0 left" (it checks `/api/auth/session` first).
- **Page-world hook to content script channel** is now a private `MessageChannel` handed over in a `hello` that the page-world script swallows in the capture phase, instead of `window.postMessage`, which every script on the page can read and forge. Every message is schema-validated.
- Bodies of sign-in, session, token, account and profile requests are no longer forwarded to the extension at all (responses already were not).
- `web_accessible_resources` narrowed from `https://*/*` to the provider hosts.
- Iris's engine and sprites (`pet.js`, `iris-frames.js`, `walk8-frames.js`) load only when Iris is switched on, via `chrome.scripting`, instead of on every provider tab (about 47 KB less script per tab with Iris off). Sites you add yourself get the meter without Iris, since the sprites are no longer web-accessible to them.
- Debug log keeps adapter notes in their own slots so a chatty site can't push them out.

## 0.8.2 — 2026-10-27
- **Fixed Copilot:** `copilot.microsoft.com` now redirects to `copilot.com`, which the extension did not match, so it never ran there. Both addresses are supported.
- ChatGPT's header perch selector updated for its redesign.
- Added `tools/site-smoke` (inject the real scripts into a live page to smoke-test each site) and `docs/site-smoke-2026-10-27.md`.

## 0.8.1 — 2026-10-17
- **Fixed Grok:** real chat limits now come from `POST /rest/rate-limits` (remaining queries per model over a 24 h window, verified live). The Grok Build credit pool is shown only when it reports usage, so it no longer shows a made-up 0%.

## 0.8.0 — 2026-09-30
- Iris rests at the right end of the pill, clear of the chat box's send button, and returns there after every action.
- Pick Iris up by dragging her; drop her on the page and she runs back and jumps onto the pill.

## 0.7.0 — 2026-09-28
- Calmer Iris by default (energy setting), yarn-ball play, and a "Send Iris home" button in the panel.

## 0.6.0 — 2026-09-28
- Smooth single-clock animation engine and an 8-frame walk for Iris.

## 0.5.0 — 2026-09-28
- Iris trips onto the page: watches replies, greets new messages, reacts to limit alarms, falls when her perch moves.

## 0.4.0 — 2026-09-28
- Sprite-based Iris and a glossy capsule pill with a glowing LED.

## 0.3.0 — 2026-09-28
- Chat stats (length, cache timer, next-message cost) for Claude, ChatGPT and Gemini, and the first Iris.

## 0.2.0 — 2026-09-26
- Real usage for Gemini, Grok, ChatGPT Codex and Kimi; 12 sites; add any site in Settings; debug mode as endpoint discovery.

## 0.1.0 — 2026-09-26
- Initial AI Meter: usage-limit meters for 5 AI chat sites.
