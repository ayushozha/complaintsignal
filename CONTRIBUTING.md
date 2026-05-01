# Contributing to ComplaintSignal

Thanks for taking the time to contribute. ComplaintSignal was built in a 2.5-hour hackathon, so a lot of corners are deliberately cut. The contribution bar is therefore: **make the demo more credible, or make a new signal source plug in cleanly.** Anything else can wait.

---

## Ground rules

1. **The demo is the spec.** If a change is not visible during the 3-minute pitch and does not strengthen a fallback path, it probably should not land.
2. **Receipts over vibes.** Every signal must trace back to a verifiable artifact (a CFPB complaint, a review, an earnings line). No invented data.
3. **Fail open.** Every external dependency (CFPB, Apify, OpenAI, ElevenLabs) must have a graceful fallback. The demo must remain playable on stage with no internet.
4. **One PR, one concern.** Refactors and feature work go in separate PRs.

---

## Getting set up

```bash
git clone <repo>
cd <repo>
npm install
cp .env.example .env.local
# fill in keys you have; the rest will fall back to demo-safe defaults
npm run dev
```

Run before pushing:

```bash
npm run lint
npm run typecheck
```

---

## Branch and commit conventions

- Branch: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
- Commit messages: imperative, present tense. *"Add 10-Q snippet to lead detail panel"* not *"Added"* or *"Adds"*.
- One logical change per commit when reasonable. Don't squash unrelated things together.

---

## Adding a new signal source

This is the most common contribution. The pattern:

1. Add a client module under `src/lib/<source>.ts` that exposes a single typed function returning normalized records.
2. Add the source's contribution to `src/lib/scoring.ts` — give it a weight and document why.
3. Surface a receipt in `src/components/complaint-signal-app.tsx` so judges (and prospects) can verify the claim.
4. Add a fallback: a tiny seeded JSON in `data/`, or a deterministic template, so the demo never goes blank if the source is down.
5. Update the architecture diagram and "Signal layers" section in `README.md`.

Open an issue first — we'll align on weighting and UI surface area before you write code.

---

## Code style

- TypeScript strict mode. No `any` unless you can defend it in review.
- Zod-validate every API boundary.
- Server-only secrets stay in `process.env`. Never ship a key to the client.
- No new top-level dependencies without a one-line justification in the PR description.
- Prefer composition over abstraction. If a helper is used once, inline it.
- No comments that restate what the code does. Comments explain *why*.

---

## UI changes

Attach a screenshot or 15-second Loom to any PR that touches `complaint-signal-app.tsx` or `globals.css`. The judge-facing surface is the product; reviewers should be able to see the change without checking out the branch.

---

## Reporting a bug

Open an issue with:

- What you expected
- What happened instead
- Steps to reproduce, including which env vars were set
- Browser + OS if it's a UI bug
- The relevant lines from `npm run dev` output, if any

If the bug is "the demo lead's outreach pack came back weird," paste the prompt and the response. The LLM is the most common source of demo-day surprises.

---

## License

By contributing you agree that your contributions will be licensed under the [MIT License](./LICENSE).
