# Chrome Web Store: what only you can do

Prepared in Stage 5 (2026-10-31). Everything that can be done from the repo is done; the items below need your account, your browser, or your judgement. Tick them in order.

## 0. Blockers: do these before you submit

- [ ] **Confirm the real-number claims you can't see in code.** The listing says AI Meter reads real numbers for Perplexity and Kimi (and ChatGPT's Codex usage). Those three have only been checked signed out, not signed in (`README.md`, "Verified live" says no). Either (a) load the unpacked extension in your Chrome, sign in, and check the pill against each site's own usage page, or (b) delete those lines from the long description in `docs/store/listing.md` so the store text only claims what is verified. Claude, Gemini and Grok are verified.
- [ ] **Try the exact build.** `chrome://extensions` → Developer mode → Load unpacked → pick the `AI Meter` folder (or unzip `dist/store/ai-meter-<version>.zip` and load that folder: it is what the store will get). Open a supported site: pill appears, click opens the panel, Iris moves. Open the toolbar popup and Settings. Remove the extension and load it again: the welcome page should open once.
- [ ] **Try Export / Import** in Settings: export, change a limit, import the file, check the limit came back.

## 1. One-time setup

- [ ] A Chrome Web Store developer account: <https://chrome.google.com/webstore/devconsole> (one-time registration fee, paid by you, and two-step verification on the Google account).
- [ ] **Publish the privacy policy.** Repo on GitHub → Settings → Pages → Deploy from a branch → `main` / `/docs`. Then open `https://devshrawin.github.io/ai-meter/privacy` in a private window: it must load without signing in. (The Stage 3 to 5 branches must be merged to `main` first, or the page shows the old policy.)
- [ ] Merge the release branches into `main` (open the PRs, review, merge). The store upload should come from a commit that is on `main`.

## 2. Upload

- [ ] Build the zip: `npm run store-zip` (writes `dist/store/ai-meter-<version>.zip`; it refuses to build if something is wrong). Do this **after** Stage 6 bumps the version to 1.0.0.
- [ ] Dev console → **New item** → upload the zip.

## 3. Store listing tab

- [ ] Fill the fields from `docs/store/listing.md`: name, short description, long description, category (Productivity), language, support URL, homepage URL.
- [ ] Upload screenshots from `dist/store/shots/` (1, 2, 3, 4 and 6 recommended, max five), the promo tile (`promo-tile-440x280.png`) and optionally the marquee (`marquee-1400x560.png`). If you want live captures instead, follow the table in the listing and keep personal data out of frame.
- [ ] Icon: the 128 px icon in the package is used automatically.

## 4. Privacy practices tab

- [ ] Paste the **single-purpose statement**.
- [ ] Paste each **permission justification** (`storage`, `alarms`, `notifications`, `scripting`, the host permissions, the optional host permission, remote code = No).
- [ ] Answer the **data usage** questions using the table in the listing, **checking them against the dashboard's current wording** (the questions change). Tick all three certifications.
- [ ] Privacy policy URL: `https://devshrawin.github.io/ai-meter/privacy`.

## 5. Distribution and submit

- [ ] Visibility: Public (or Unlisted for a first trial). Regions: all, unless you want to limit them.
- [ ] **Submit for review.** Review can take from a day to a few weeks. Broad host permissions (18 named sites, plus an optional one) can lengthen the review: if the reviewer asks, the justification table in the listing answers it.
- [ ] After approval: choose manual or automatic publish, then check the live listing page once.

## 6. After publishing

- [ ] Tag the release in git (`v1.0.0`) and add the store link to the README. I will not tag or publish anything without you saying so.
- [ ] Keep the "Verified live" column in the README honest as you check the remaining providers.

## Known small things (not blockers)

- Iris, when asleep at the far right of the page, is clipped by a few pixels at the window edge (her sleeping sprite is wider than the standing one).
- The store screenshots are composed images of the real UI with sample numbers, not captures of a live signed-in page.
- Desktop notifications could not be screenshotted outside the browser, so there is no notification image.
