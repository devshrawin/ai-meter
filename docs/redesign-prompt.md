# Prompt: redesign AI Meter

Paste everything below the line into a design-capable model (Claude Design, ChatGPT, etc.). Attach, from the repo: `dist/a11y-after/*.jpg` (pill, popup, settings today) and `dist/store/shots/*.png` (store images today).

---

You are a senior product designer. Redesign a small Chrome extension. Be concrete: deliver finished, buildable designs, not a mood board.

## The product

A Chrome extension (Manifest V3) that shows **how much of your usage limit is left on AI chat sites** (Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek, Qwen, Le Chat, Copilot, Meta AI, Poe, plus any site the user adds). It has a mascot, **Iris**, a white Persian cat with odd eyes (one blue, one amber) who sits on the meter and whose mood follows the usage: calm under 75%, worried from 75%, stressed from 90%, asleep at 100%.

Who uses it: people who work in AI chat all day (developers, analysts, writers) and hit limits at bad moments. They glance at it, they do not study it. It must be quiet, fast to read, and never get in the way of the chat.

What it never does (the design must not imply otherwise): it has no account, no server, never stores message text, never asks for a password.

## Surfaces to redesign (all of them, light and dark)

1. **The pill**, a small draggable capsule fixed bottom-right of any chat page. Shows: status light, provider name, percent used, time to reset, optional chat length and cache timer. Iris sits on top of it. About 28 px tall, must fit on someone else's page without clashing with it. Shadow DOM, so no site CSS reaches it.
2. **The panel** that opens above the pill (280 px wide): a "this chat" block (length, cache, next-message cost), then one row per limit (label, value, bar, reset text, source tag), then a "Send Iris home" button. A **problem box** replaces the rows when usage cannot be read ("Can't read usage here" + a "Copy debug log" button).
3. **The toolbar popup** (360 px wide): header with avatar, summary line and two icon buttons (refresh, settings); one collapsible line per service (status light, name, the limit closest to full with a mini bar); expanded card shows meta, bars, counter chips; footer legend of the tags and "+ Add site".
4. **The settings page**: general toggles, Iris options, "Other AI sites" (add a site), estimate rules (a table of editable limits per provider), backup (export and import), debug log.
5. **The first-run guide** (opens once on install): getting started, how to read the `real` / `estimate` / `banner` tags, Iris and the colours, what it reads, how to add a site.
6. **Store assets**: icon (16, 32, 48, 128 px), 1280x800 screenshots with a caption, a 440x280 promo tile, a 1400x560 marquee.

## Meanings the design must carry

- Usage level: **ok** (under 75%), **close** (75 to 89%), **critical** (90% and over), **empty** (100%), and **unknown** (no number).
- Source of a number: **real** (from the provider), **estimate** (counted locally from the user's sends), **banner** (the site itself said a limit was hit). These three tags must be unmistakable and not rely on colour alone.
- States: signed out ("sign in"), cannot read usage (error), stale data (not updated for a day), no data yet, many services at once, a counter with no percentage ("5 left").
- Iris: five moods (calm, worried, stressed, asleep, plus happy after a send) and her place on the pill. You may redraw her, or keep the current art and only redesign the UI around her; say which you chose and why.

## Hard constraints

- **Accessibility, WCAG 2.2 AA:** text 4.5:1 and UI parts 3:1 in both themes; never colour alone for status; visible focus rings; the pill is a keyboard-operable button; honour reduced motion; touch targets at least 24 px.
- **Rendering:** plain HTML and CSS with CSS variables, no frameworks, no web fonts loaded from the network (system fonts only), no images except the sprite pack and icons. Everything must work offline and inside a shadow root.
- **Size:** the pill must stay compact; the popup stays 360 px wide; nothing may need a layout above 760 px except the settings page.
- **Dark mode** follows `prefers-color-scheme`. Design both, do not just invert.
- **Do not change behaviour, data or permissions.** This is a visual and wording redesign. Keep every control that exists today (list above); you may reorder, regroup or restyle them.
- **Keep the product name "AI Meter"** in every design. A separate task may rename it later.
- **Tone:** calm, a little playful through Iris, never alarmist. The look today is "pearl and lavender" (background `#f7f6fc`, text `#1f1d2b`, accent `#9a80e0` and a darker text accent `#6f52c9`, status green `#22c55e`, amber `#f59e0b`, red `#ef4444`). Keep it, evolve it, or replace it, but justify the choice.

## Deliver

1. **Design direction** in 5 sentences: what the product should feel like, what you are keeping, what you are changing and why.
2. **Design tokens** as a CSS `:root` block for light and dark (colours with contrast ratios stated, radii, spacing, type scale, shadows, motion durations), plus a one-line rule for each of the three source tags.
3. **Each surface above**, light and dark, as finished HTML + CSS I can drop in (one self-contained file per surface, sample data included), covering the ok, close, critical, empty, signed-out, error, stale, empty-list and many-services states where they apply.
4. **Pill variants**: collapsed, collapsed with chat stats, with a problem, and the panel open.
5. **Iris placement and moods** on the pill (and, if you redraw her, the sprite brief: poses, grid, background `#FF00FF` for keying, baseline rule).
6. **Store images** laid out at the exact sizes, with captions.
7. A short **changes list**: what is different from today, per surface, and what you deliberately left alone.

## How I will judge it

- I can build each surface from what you give me without asking a question.
- Contrast numbers are shown and they pass.
- The three source tags and the five usage levels are distinguishable in greyscale.
- The pill looks at home on a white page, a dark page and a busy page.
