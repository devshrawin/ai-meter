---
title: AI Meter privacy policy
permalink: /privacy
---

# AI Meter privacy policy

Effective 28 October 2026 · Applies to AI Meter 0.9.0 and later

**In one paragraph:** AI Meter runs entirely in your browser. It has no server, no account and no analytics, and it sends nothing to its developer or to any third party. It reads your usage from the AI sites you already use, from your own logged-in tab, and keeps the numbers on your machine. It never stores the text of your messages.

## What AI Meter is

AI Meter is a Chrome extension that shows how much of your usage limit is left on AI chat sites (Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek, Qwen, Le Chat, Copilot, Meta AI, Poe, and any site you add yourself). It draws a small meter on the page, a toolbar badge and popup, and can show desktop notifications.

## What it reads, and why

| What | Where it comes from | What AI Meter keeps | Leaves your device? |
|---|---|---|---|
| **Usage and limit figures** (percent used, remaining queries, reset times) | The provider's own usage endpoint, called from your tab; or the same response the site itself already receives | The latest numbers per provider, in `chrome.storage.local` | No |
| **That a message was sent, and which model** | The page's own network request (the request is observed, not changed) | A timestamp and the model name, to count messages. Never the text | No |
| **Chat length** (for the "This chat" figures) | The number of characters in the open conversation on the page | A character and message count only. Never the text | No |
| **Your settings** | You | Estimate limits, thresholds, added sites, Iris on or off, in `chrome.storage.local` | No |
| **Meter position** | You, when you drag the meter | The pill position, saved under the key `aimeter.pos` in the page's own `localStorage` | No |
| **Debug log** (off by default) | The extension itself, only if you tick Debug | Key names and short model-like values of requests, full bodies only of usage and limit endpoints, and only the *shape* (keys and types) of anything else. Emails, tokens and long ids in it are masked. Stored locally, capped to the latest entries; clear it any time in Settings | No, unless you choose to copy and paste it yourself |

## How the page-world script works

To spot message sends and usage responses, AI Meter injects a small script into the page itself (a "page-world" script, because a normal extension script cannot see the page's own network calls). It wraps `fetch`, `XMLHttpRequest` and `WebSocket.send` and mirrors what it sees to the extension over a private channel inside the page.

Being plain about what that means:

- It **sees** each request the page makes, including the body of a message you send, because that is where the model name is.
- Request and response bodies are held **in memory only for as long as it takes to read the model name or the usage figures**. Message text is **never written to storage**, never logged by the debug log, and never sent anywhere.
- The bodies of requests to, and responses from, sign-in, session, token, account and profile endpoints are **never forwarded** to the extension at all.
- It only does anything on the sites listed above and on sites you add.
- It does not change, block or delay any request.

## Sign-in credentials

AI Meter does not collect your password or ask you to sign in to anything. Two providers need a credential to answer a usage call, and AI Meter uses the one your browser already holds:

- **ChatGPT:** the access token from the site's own `/api/auth/session` response is kept **in memory only** and sent only back to `chatgpt.com`, as the site's own usage request would.
- **Kimi:** the sign-in cookie that the Kimi web app itself reads is kept **in memory only** and sent only back to `kimi.com`.
- **Claude:** the organisation id from the site's `lastActiveOrg` cookie is used to build the usage URL on `claude.ai`.

These values are never written to storage, never put in the debug log and never sent to any other domain.

## Where requests go

Usage requests go from **your tab to the provider's own domain**, the same place the site's settings page would send them. AI Meter makes no request to any server run by its developer or by anyone else, and contains no analytics, advertising or tracking code.

## Permissions

Each permission, and why the extension asks for it, is listed in the Chrome Web Store listing and in the repository (`docs/store/listing.md`). In short: `storage` for settings and the latest numbers, `alarms` for the reset notification, `notifications` for the optional alerts, `scripting` to register scripts for sites you add and to load Iris only when she is on, and host access to the listed provider sites. Access to any other site is optional and asked for one site at a time, when you click **Add site**.

## Your control

- Turn off notifications, Iris, the chat figures or the whole on-page meter in Settings.
- Remove a site you added in Settings, which also revokes its permission.
- Tick or untick **Debug**, and **Clear log**, in Settings.
- Uninstalling the extension deletes everything it stored. Clearing the site's data removes the saved pill position.

## Sharing, sale and children

AI Meter does not sell, rent or share any data, because it does not collect any off your device. It is not directed at children.

## Changes

If this policy changes, the new version is published at this address with a new effective date, and the change is listed in `CHANGELOG.md` in the repository.

## Contact

Open an issue at <https://github.com/devshrawin/ai-meter/issues>.

## Not affiliated

AI Meter is an independent project. It is not affiliated with, endorsed by or sponsored by Anthropic, OpenAI, Google, xAI, Perplexity, Moonshot AI, DeepSeek, Alibaba, Mistral AI, Microsoft, Meta or Quora. Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek, Qwen, Le Chat, Copilot, Meta AI and Poe, and all related names and logos, are trademarks of their respective owners. They are used here only to identify the services AI Meter works with.
