# AI Meter v1.0.0 master prompt

Paste everything below the line into the original AI Meter session.

---

Goal: take AI Meter from 0.9.2 to a store-ready **v1.0.0**. I approve this MAJOR bump. Work from the gaps below, in order. Show a short plan first and wait for my OK before editing.

## Ground rules
- Follow my git workflow: one issue per workstream -> branch -> PR -> merge. No direct push to main. No `gh` (org-blocked): use git plus the browser pane for issues/PRs.
- No Co-Authored-By / "Generated with" lines in commits or PRs.
- Ask before spawning any agent, and propose Haiku for it.
- Versioning: dated release folder, one share zip. Bump manifest, package.json and CHANGELOG together.
- I do all sign-ins and clicks on provider sites. You only read DOM/network output on pages I have open. Never enter credentials.
- Audit means runtime: verify against the real extension loaded in Chrome and real pages, not just code review. When I paste back a live error, root-cause it.
- Analysis is not a go-ahead: finish each stage's report, then wait for my OK before the next.
- Do not touch Iris art or the popup design unless a stage below says so.

## Tools to set up first (ask before each install, one at a time, read its README first)
Clones are in `C:\Users\shrawin.sisodiya\Desktop\UR Files\Projects\claude-toolkit\`.
1. Playwright MCP: `claude mcp add playwright npx @playwright/mcp@latest`
2. superpowers (TDD/planning): `claude-toolkit\superpowers`
3. addy agent-skills (pre-ship review): `claude-toolkit\agent-skills`, copy only the skills you need
4. impeccable (visual polish): `claude-toolkit\impeccable`
5. Context7 (MV3 docs): `claude mcp add context7 -- npx -y @upstash/context7-mcp`
Skip ECC, gstack, oh-my-claudecode, claude-mem, Archon (overlap/overkill). Already available: `/security-review`, `design:accessibility-review`, `design:design-critique`, `engineering:testing-strategy`.

## Stages

### 1. Tests for untested logic (superpowers TDD)
Write failing tests first, then fix. Cover:
- `src/background.js`: 75/90/100% thresholds fire once, reset notification fires, no duplicate notifications after a restart.
- `src/core/widget.js`: render states (ok, estimate, stale, "can't read usage", "sign in").
- `src/content.js`: adapter selection per host, user-added sites.
- `src/core/pet.js`: state machine only (mood by usage %, reduced motion, hidden tab pause, falls and recovery). No pixel tests.
Done = `npm test` green, coverage gaps listed.

### 2. Live verification (Playwright MCP + me)
Re-run `tools/site-smoke` for all 12 sites, then verify signed in with me logged in:
- Unverified: ChatGPT, Perplexity, Kimi. Send-count sites: DeepSeek, Qwen, Le Chat, Copilot, Meta AI, Poe. Iris trips.
- For each: real number vs the site's own settings page, send detection, reset time.
- Fix selector/endpoint drift. Update the README "Verified live" column only for what you actually saw. Write `docs/site-smoke-<date>.md`.
Done = every provider marked verified, or honestly marked "estimate, unverified" with the reason.

### 3. Hardening and security
- Run `/security-review` and the agent-skills pre-ship checklist.
- Re-check: page-world channel, permissions vs `docs/store/listing.md` justifications, `optional_host_permissions`, no prompt text stored, tokens in memory only.
- Add a fail-safe so one broken adapter cannot break the others or the pill.
- Add graceful handling for provider API shape changes (clear "can't read usage" state, copy-debug-log).
Done = findings list with severity, all high/medium fixed.

### 4. Visual and accessibility pass (impeccable, design:accessibility-review)
- Pill, panel, options page: contrast, focus order, keyboard use, screen-reader labels, dark mode, reduced motion.
- Show before/after screenshots. Keep the lavender look.
Done = a11y issues fixed, screenshots attached.

### 5. Store readiness
- Screenshots per the shot list in `docs/store/listing.md`, final listing copy, privacy policy matches the actual behaviour, trademark disclaimer.
- First-run onboarding (what it reads, how to add a site, how to read the `real` / `estimate` / `banner` tags).
- Settings export/import so users don't lose custom limits.
Done = a Store-upload zip and a checklist of anything only I can do.

### 6. Release 1.0.0
- CHANGELOG, version bumps, dated release folder, one share zip, README refresh.
- Final full `npm test` plus a clean load-unpacked smoke on a fresh Chrome profile.
- Update my memory file for this project.
Do not publish to the Chrome Web Store or push tags without asking me.

## Reporting
After each stage: what changed, what was verified at runtime, what was not verified, and the one decision I need to make. Keep it terse.
