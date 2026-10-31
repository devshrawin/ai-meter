# Site smoke test, 2026-10-31

Signed-out, desktop viewport (1280x800), Claude desktop built-in browser, extension scripts from v0.9.2 + Stage 1 fixes. Same method as `site-smoke-2026-10-27.md` (`tools/site-smoke`). "Full" = the real scripts ran in the page with a `chrome.*` stub; "selectors" = the site wiped the injected bundle (COOP), so only the page selectors from `src/core/perches.js` were checked by hand.

| Site | Mode | Result |
|---|---|---|
| Claude | selectors | Redirects to `/login` signed out; sign-in page isolates the tab. Real numbers verified live earlier (2026-10-17). |
| ChatGPT | selectors | composer `form:has([data-composer-submit])`, header `header[data-slot="header"]` and the submit button all match. |
| Gemini | selectors | composer (`input-area-v2`) and header (`top-bar-actions`) match. |
| Grok | full | mounts, adapter `grok`, no errors. **New 0.9 state confirmed live: shows "Sign in to Grok to see your remaining queries."** instead of a fake number. Composer perch resolves. |
| Perplexity | full | mounts, no errors. **Signed out now reports `sign in` (0.9.0 change) instead of "0 left"**, confirmed live. Composer perch resolves. |
| Kimi | full | mounts, no errors, composer perch resolves. No meters and no problem signed out (waits for the subscription call). |
| Qwen | full | mounts, no errors, composer + header perches resolve. No meters until a send (limit unset by default). |
| Le Chat | full | mounts, no errors, estimate meter `0 / 25` per day, composer perch resolves. |
| DeepSeek | full | mounts on `/sign_in`, no errors, composer perch resolves. |
| Copilot | full | mounts on `copilot.com`, adapter `copilot`, no errors. Composer perch not found: the page is the sign-in wall (expected). Header perch resolves. |
| Meta AI | selectors | `input[aria-label="Ask Meta AI"]` matches. |
| Poe | none | Redirects to `/login`; the page isolates the tab and wiped the bundle. Host matches (unit-tested). |

## Result

- No script errors on any site where the bundle could run (9 of 12).
- No selector drift since 2026-10-27.
- The two Stage 0.9 behaviours (problem state, Perplexity sign-in) are now confirmed on live pages, not only in unit tests.

## Not verified (needs a signed-in session, so not done here)

Real numbers vs the site's own settings page: ChatGPT (`wham/usage`), Perplexity, Kimi. Send detection and reset time for DeepSeek, Qwen, Le Chat, Copilot, Meta AI, Poe. Iris trips on a live page. The README "Verified live" column is unchanged for these.
