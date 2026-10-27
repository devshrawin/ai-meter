# Site smoke test, 2026-10-27

Signed-out, desktop viewport (1280x800), Claude desktop built-in browser. "Full" = the real extension scripts ran in the page with a `chrome.*` stub; "selectors" = only the page selectors were checked (the site isolates the tab and wiped the injected bundle).

| Site | Mode | Result |
|---|---|---|
| Grok | full | mounts, adapter `grok`, network hook active, composer selector matches. Usage calls 401 while signed out (expected); no errors. |
| Gemini | selectors | composer + header selectors match. |
| ChatGPT | selectors | composer matches. **Header selector was stale** (the page now uses `header[data-slot="header"]`): fixed. |
| Perplexity | full | mounts, hook active, composer perch resolves. Shows "0 left" signed out (accurate for an anonymous visitor). |
| Kimi | full | mounts, hook active, composer perch resolves. Waits for the app's subscription call (auth cookie not readable signed out). |
| Qwen | full | mounts, hook active, composer + header perches resolve. |
| Meta AI | selectors | composer input selector matches. |
| Le Chat (chat.mistral.ai) | full | mounts, hook active, estimate pill, generic composer perch. |
| DeepSeek | full | mounts and hooks on the sign-in page after its bot check. |
| Copilot | page | **`copilot.microsoft.com` now redirects to `copilot.com`, which the extension did not match, so it never ran on Copilot.** Fixed: `copilot.com` / `www.copilot.com` added to host permissions, content scripts and the provider table. |
| Poe | page | stays on poe.com (login wall); host matches. |
| Claude | skipped | login page isolates the tab; real usage numbers were verified live earlier. |

Not testable signed out: real usage numbers for ChatGPT (wham/usage), Perplexity, Kimi; send detection (needs a message sent) for the estimate-only sites; Iris trips.
