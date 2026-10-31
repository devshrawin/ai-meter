# Prompt: rename AI Meter
> Done: the name chosen was **Headroom** (2026-10-31). Kept for the record.

Paste everything below the line into a model that can reason about names and, ideally, search the web (Claude, ChatGPT, etc.). Attach nothing; the product is described in the prompt.

---

You are a brand namer. Propose a new name for a small Chrome extension. Be concrete: a ranked shortlist with honest risk notes, not a list of puns.

## The product

A Chrome extension (Manifest V3) that shows **how much of your usage limit is left on AI chat sites** (Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek, Qwen, Le Chat, Copilot, Meta AI, Poe, plus any site the user adds). It draws a small meter on the chat page, a toolbar badge and popup, and optional desktop notifications. It has a mascot, **Iris**, a white Persian cat with odd eyes (one blue, one amber) who sits on the meter and whose mood follows the usage: calm, worried, stressed, asleep when the limit is hit.

Today it is called **AI Meter**. That name is generic, hard to search for, and sounds like a utility.

Who uses it: people who work in AI chat all day (developers, analysts, writers) and hit limits at bad moments. It is quiet, private (no account, no server, never stores message text) and a little playful through the cat. It is free and independent, not affiliated with any AI company.

## Constraints

- 4 to 16 characters, easy to say, spell and remember; works as a Chrome Web Store title, a GitHub repo name and a toolbar tooltip.
- **Must not contain or imitate** any AI provider or product name or trademark (Claude, ChatGPT, OpenAI, Anthropic, Gemini, Grok, Perplexity, Kimi, Copilot, Meta AI, Poe, and similar). The Chrome Web Store requires that a name does not suggest affiliation.
- Should hint at the idea (a limit, a gauge, a cat, running low) without sounding like a warning, a billing product or a monitoring tool for companies.
- Not obviously taken: avoid names that are already well-known software, extensions or companies. For your top picks, state what you checked and what you could not check (domain, Chrome Web Store, GitHub, trademark search). Do not claim a name is free unless you actually looked.
- The mascot may carry the name (Iris), but the product name should also work without the cat.
- Plain English, no unusual spellings that people will mistype (no dropped vowels, no numbers).

## Deliver

1. **Ten candidates**, each with: the name, one line on the idea, a possible tagline (under 8 words), and a risk note (confusable with something, hard to spell, trademark worry).
2. **A ranked top three** with a short reason each, and which one you would pick.
3. For the top pick:
   - the **store title** (at most 45 characters, name plus a short descriptor),
   - the **short description** (under 132 characters),
   - the **tagline**,
   - how the name would appear on the pill, the popup header and the icon (a wordmark sketch is enough).
4. **A migration note**: everywhere the current name appears that would need to change, as a checklist: manifest name and description, store listing, privacy policy, README, first-run welcome page, notification titles, popup and settings headings, the "AI Meter" label in the on-page panel, the GitHub repository name.

## How I will judge it

- The shortlist contains no provider names or near-misses of them.
- Every claim about availability says what was actually checked and what was not.
- I could pick one and start the migration without asking a question.
