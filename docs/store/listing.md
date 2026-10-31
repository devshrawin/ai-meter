# Chrome Web Store listing: AI Meter

Everything below is written to paste into the Chrome Web Store developer dashboard. Facts come from the code and the README; if the code changes, update this file with it.

## Store fields

| Field | Value |
|---|---|
| Name | AI Meter: AI usage limit tracker |
| Category | Productivity |
| Language | English |
| Package version | 1.0.0 |
| Privacy policy URL | `https://devshrawin.github.io/ai-meter/privacy` (publish `docs/privacy.md` with GitHub Pages: Settings → Pages → Deploy from branch → `main` / `/docs`) |
| Support URL | `https://github.com/devshrawin/ai-meter/issues` |
| Homepage URL | `https://github.com/devshrawin/ai-meter` |

## Short description (max 132 characters)

> See how much of your usage limit is left on Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi and other AI chat sites.

(116 characters. This is also the `description` in `manifest.json`.)

## Long description

> AI Meter shows how much of your usage limit is left on the AI chat sites you use, right on the page, before you hit the wall.
>
> A small glossy pill sits in the corner of the chat page. It shows the percentage used and when the limit resets. Click it for the details. A cat called Iris keeps you company on top of it: she is calm while you have plenty left, worried near the limit, stressed when you are about to run out, and asleep when you have.
>
> **Real numbers where the provider gives them**
> • Claude: session (5 hour) and weekly usage, with reset times
> • Gemini: 5 hour and weekly usage
> • Grok: your remaining chat queries per model
> • Perplexity: remaining Pro searches, research and labs
> • Kimi: your membership balance
> • ChatGPT: Codex usage windows, plus a message count for chat
>
> **Counted for the rest**
> DeepSeek, Qwen, Le Chat, Copilot, Meta AI and Poe do not show usage, so AI Meter counts your sends against limits you set yourself.
>
> **Any other AI site**
> Add any site in Settings. AI Meter asks for permission for that one site only.
>
> **Also included**
> • Toolbar badge with the current percentage
> • A popup with every provider in one place
> • Optional desktop notifications at 75, 90 and 100 percent, and when a limit resets
> • Chat length and a rough cost for your next message on Claude, ChatGPT and Gemini
> • A visible message when a provider's usage cannot be read, with a one-click copy of the debug details
> • A short first-run guide that explains the real / estimate / banner tags
> • Export and import your settings, so custom limits are never lost
> • Works from the keyboard: Tab to the meter, Enter to open it, Shift and the arrow keys to move it
>
> **Private by design**
> Everything stays on your machine. There is no server, no account and no analytics. Usage requests go from your own logged-in tab to the provider's own site, exactly as its settings page would send them. Message text is never stored. See the privacy policy for the details.
>
> AI Meter is an independent project. It is not affiliated with, endorsed by or sponsored by Anthropic, OpenAI, Google, xAI, Perplexity, Moonshot AI, DeepSeek, Alibaba, Mistral AI, Microsoft, Meta or Quora. Product and company names are trademarks of their respective owners and are used only to say which services AI Meter works with.

## Single-purpose statement

> AI Meter has one purpose: to show how much of your usage limit remains on the AI chat websites you use, as an on-page meter, a toolbar badge and popup, and optional threshold notifications.

## Permission justifications

Paste each into the matching box on the **Privacy practices** tab.

### `storage`
Saves your settings (estimate limits, notification thresholds, added sites, Iris on or off), the latest usage numbers for each provider, a short list of send timestamps used for message counting, and the opt-in debug log. All in `chrome.storage.local`. Nothing is synced or sent anywhere.

### `alarms`
Schedules a single alarm for the moment a limit resets, so AI Meter can tell you "your limit has reset" and clear the old warning state. No polling, no background work beyond that.

### `notifications`
Shows the optional desktop notifications when a meter crosses 75, 90 or 100 percent, and when a limit resets. Turn off in Settings. Notifications contain only the provider name, the meter name and the percentage.

### `scripting`
Used for two things only: (1) registering the content scripts for sites you add yourself in Settings, on the permission you grant for that one site, and (2) loading the Iris cat's code and images into a page only when Iris is switched on. No remote code is ever fetched or run.

### Host permissions (the provider sites)
Each host below gets the content script and the page-world hook so AI Meter can read that provider's own usage data from your logged-in tab. The extension does not run on any other site unless you add it.

| Host | Why it is needed |
|---|---|
| `https://claude.ai/*` | Read `/api/organizations/{org}/usage` (session and weekly usage) and the open chat's length |
| `https://chatgpt.com/*`, `https://chat.openai.com/*` | Count sends; read Codex usage from `/backend-api/wham/usage`; chat length |
| `https://gemini.google.com/*` | Read the usage figures behind gemini.google.com/usage; count prompts; chat length |
| `https://grok.com/*` | Read `/rest/rate-limits` (remaining queries per model); detect sends |
| `https://www.perplexity.ai/*`, `https://perplexity.ai/*` | Read `/rest/rate-limit/all` (remaining Pro searches, research, labs) |
| `https://www.kimi.com/*`, `https://kimi.com/*` | Read the membership balance from Kimi's subscription call |
| `https://chat.deepseek.com/*` | Detect sends so they can be counted (the site shows no usage) |
| `https://chat.qwen.ai/*` | Detect sends so they can be counted |
| `https://chat.mistral.ai/*` | Detect sends so they can be counted |
| `https://copilot.microsoft.com/*`, `https://copilot.com/*`, `https://www.copilot.com/*` | Detect sends so they can be counted (Copilot moved from copilot.microsoft.com to copilot.com) |
| `https://www.meta.ai/*`, `https://meta.ai/*` | Detect sends so they can be counted |
| `https://poe.com/*` | Detect sends so they can be counted |

The `www.` and bare-domain entries are listed separately because Chrome match patterns do not cover both with one entry.

### Optional host permission `https://*/*`
Requested only when you click **Add site** in Settings for a specific site you want measured, and Chrome then asks for that one origin (for example `https://example-ai.com/*`). It is never granted up front and the extension does nothing on a site you have not added.

### Remote code
**No.** All code ships in the package. The Iris images are packaged files. Nothing is downloaded and executed.

## Data usage answers (Privacy practices tab)

Suggested answers. Review them against the dashboard wording on the day you submit, because the questions change.

| Question | Answer |
|---|---|
| Personally identifiable information | No. Not collected |
| Health, financial, location, personal communications | No |
| Authentication information | Handled in memory only (the ChatGPT access token and the Kimi sign-in cookie), used only to call that same provider's usage endpoint, never stored and never sent to the developer or any third party. Disclose it if the dashboard asks about handling, not just collection |
| Website content | The extension reads the page only to measure chat length and to spot message sends. It keeps counts and timestamps, never message text. Sign-in, password, payment and similar requests are never read, and secret-looking fields are masked |
| Web history, user activity | No browsing history is read. It sees network calls made by the supported AI sites only |
| Sold to third parties / used for unrelated purposes / used for creditworthiness | No / No / No |
| Data leaves the device | No. The only network calls are to each provider's own site, from your own tab |

Tick all three **certifications** (limited use, no sale, no unrelated purpose).

## Screenshots

Chrome Web Store wants 1 to 5 screenshots at **1280 x 800** (or 640 x 400), plus an optional small promo tile (**440 x 280**) and marquee (**1400 x 560**). Ready-made images are generated by `tools/store-shots` into `dist/store/shots/` (run it again after any UI change, steps are in the file header).

They show the real extension UI (the on-page meter, popup and settings page, rendered from the actual code) on a neutral mock chat page with sample numbers, on the lavender ground, so no account name, chat title or brand logo appears. They are **composed images, not live captures**. If you prefer live captures, the original shot list is the last column.

| # | File | What it shows | Caption (on the image) | Live-capture equivalent |
|---|---|---|---|---|
| 1 | `1-hero.png` | The meter with Iris on a chat page, panel closed | See your AI limit before you hit it | Claude or Gemini page, pill bottom-right, panel closed |
| 2 | `2-panel.png` | Panel open: session and weekly bars tagged "real", reset times, chat length | Real numbers, straight from the provider | Same page, panel open |
| 3 | `3-moods.png` | Iris calm (32%), worried (80%), stressed (96%) and asleep (100%) | Iris gets stressed so you don't have to | Four crops of the pill |
| 4 | `4-popup.png` | Toolbar popup with several providers | Every provider in one popup | Popup after visiting a few sites |
| 5 | `5-settings.png` | Settings: added site, estimate rules, backup | Add any AI site, set your own limits | Settings page |
| 6 | `6-problem.png` | The "can't read usage here" state with Copy debug log | Tells you when it can't read a number | A provider whose usage cannot be read |
| – | `promo-tile-440x280.png`, `marquee-1400x560.png` | Icon, name and "Know your limit before the cat does." | | |

Upload 1 to 5 screenshots (the store allows five); 1, 2, 3, 4 and 6 are the strongest set. A desktop-notification shot is not included: a notification cannot be rendered outside the browser.

## Trademark disclaimer (use verbatim in the listing, README and privacy policy)

> AI Meter is an independent project. It is not affiliated with, endorsed by or sponsored by Anthropic, OpenAI, Google, xAI, Perplexity, Moonshot AI, DeepSeek, Alibaba, Mistral AI, Microsoft, Meta or Quora. Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek, Qwen, Le Chat, Copilot, Meta AI and Poe, and all related names and logos, are trademarks of their respective owners. They are used here only to identify the services AI Meter works with.

## Before you submit

- [ ] `manifest.json` and `package.json` both say 1.0.0
- [ ] Zip built with `npm run store-zip` (it refuses to build if versions disagree, a file is missing or something that should not ship is included)
- [ ] Privacy policy URL is live and loads without sign-in
- [ ] Single-purpose statement and every permission justification pasted
- [ ] Screenshots chosen from `dist/store/shots/` (no personal data in any of them)
- [ ] Full steps and the list of things only you can do: `docs/store/submit-checklist.md`
- [ ] Reviewed the "Data usage" answers against the current dashboard wording
