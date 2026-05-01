<div align="center">

# ComplaintSignal

### Buying-intent radar for fintech collections — not a phonebook.

<br />

<p>
  <img alt="status" src="https://img.shields.io/badge/status-hackathon%20build-FF4F58?style=for-the-badge" />
  <img alt="next" src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="tailwind" src="https://img.shields.io/badge/Tailwind-4.2-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img alt="elevenlabs" src="https://img.shields.io/badge/ElevenLabs-TTS-111111?style=for-the-badge" />
  <img alt="apify" src="https://img.shields.io/badge/Apify-actors-97D700?style=for-the-badge" />
</p>

<br />

<table>
  <tr>
    <td align="center" width="900">
      <h3>Find fintech lenders with fresh, public collections pain — and hand sales a ready-to-fire outbound pack for each lead.</h3>
      <em>Built for the Fintech GTM Hackathon — Callbook AI × Lynk · Frontier Tower SF · 2.5-hour build.</em>
    </td>
  </tr>
</table>

</div>

---

## The Problem

> **Callbook AI sells voice agents for collections. The hardest GTM problem is not the product — it is knowing _which_ lenders are bleeding right now.**

Lead-generation tools today are phonebooks. They tell you a company exists, that it operates in a vertical, that it employs N people. They do not tell you whether that company has a *reason to buy this week*.

For a category like AI collections, "reason to buy this week" is a real, measurable thing: borrowers are publicly complaining about being unable to reach support, payments going to the wrong account, harassing call cadence, reps that disappear. The information is sitting in public databases, and it is fresher than any sales-intel tool surfaces it.

Sales reps end up cold-emailing lists of "fintech lenders" with a generic pitch. Reply rates collapse. The judges in this room have all lived this.

---

## Why This Wins

> **ZoomInfo tells you who is a fintech lender. ComplaintSignal tells you which lender's borrowers are publicly accusing them of doing the exact things Callbook's product fixes — and maps each accusation to the Callbook feature that addresses it.**

Four reasons this isn't another AI SDR tool:

1. **Callbook-shaped ICP, not generic fintech.** Every target is hand-picked against Callbook's actual buyer profile (subprime auto, BNPL, student loan servicing, private-label cards, subprime personal loans). No noise companies that won't buy a collections platform.
2. **Causal signal, not static keywords.** We answer *why now* from CFPB borrower-voice data, not *who's in the vertical*. The signal moves before the buyer's intent shows up anywhere else.
3. **Receipts, not vibes.** Every product-fit chip cites the literal borrower phrase from the CFPB narrative. Judges and prospects can verify the claim in two seconds.
4. **Product-map moat.** Each borrower-voice pattern is mapped to a specific Callbook feature it justifies — multichannel orchestration, 50–70% contactability, SOC 2 audit trail, voice-agent quality. The pitch writes itself because the math wrote it.

---

## What We Built

A live signal board for Callbook's sales team that:

- **Pulls real CFPB complaint data** for ten hand-picked Callbook-ICP lenders: Credit Acceptance, Westlake, OneMain, Enova (CashNetUSA / NetCredit), Navient, Affirm, Klarna, Synchrony, Bread Financial, Upstart.
- **Mines borrower narratives** for the patterns that map 1:1 to Callbook's product page — multichannel pain, contactability gaps, compliance heat, voice-agent quality issues — and surfaces literal phrases as receipts.
- **Computes a 0–100 lead score plus a 0–100 Callbook fit score**, then renders a "Callbook product fit map" panel per lead with per-feature match rates and the borrower phrases that triggered each.
- **Generates a complete outbound pack** per lead via a single LLM call grounded in (a) the CFPB receipt, (b) Apify public-search evidence, and (c) Callbook's actual product positioning. Output: cold email, LinkedIn DM, 30-second call script, voice-pitch script, CRM note, decision-maker, "why now," "pain hypothesis."
- **Voices the pitch through ElevenLabs** so the rep hears the call before they make it — and the demo closes with audio in the room.
- **Falls back gracefully**: deterministic Callbook-language templates if the LLM is down, browser speech synthesis if ElevenLabs is unreachable, seeded JSON if the CFPB API is slow.

---

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CFPB API       │────▶│  Signal Engine  │────▶│  Lead Ranking   │
│  (primary)      │     │  spike + LLM    │     │  0–100 score    │
└─────────────────┘     │  extraction     │     └────────┬────────┘
                        └─────────────────┘              │
┌─────────────────┐              ▲                       ▼
│  Apify Actors   │──────────────┤              ┌─────────────────┐
│  (enrichment)   │              │              │ Outreach Pack   │
└─────────────────┘              │              │ Generator (LLM) │
                                 │              └────────┬────────┘
┌─────────────────┐              │                       │
│  Earnings JSON  │──────────────┘                       ▼
│  (curated)      │                            ┌─────────────────┐
└─────────────────┘                            │ ElevenLabs TTS  │
                                               │  Voice Pitch    │
                                               └─────────────────┘
```

### Signal layers (in priority order)

1. **CFPB Consumer Complaint Database** — the primary signal. Free public API, updated daily. We pull 90-day rolling windows per company and compare against the prior 90 days to detect spikes.
2. **Apify enrichment** — Google search actors mining buyer-signal queries (support-delay phrases, collections complaints, hiring posts) for each ranked lead.
3. **Earnings / 10-Q snippets** — curated quotes per public lender. Charge-off rates, allowance movements, support-volume disclosures — the financial-pain dimension that complements the customer-voice signal.

### Lead-score formula (Callbook-tuned)

```
Total /100 =
  Complaint volume + 90d spike:           25 pts
  Collections relevance (CFPB taxonomy):  20 pts   (debt-collection product share)
  Multichannel pain rate:                 15 pts   ("called", "voicemail", "no response", "emailed")
  Right-party contactability gap:         10 pts   ("could not reach", "tried calling", "no one answered")
  Compliance heat:                        20 pts   (timely=No / "in progress" rate)
  Callbook product fit (derived):         10 pts   (composite of the four above + volume tier)
```

Cap at 100. Each dimension maps directly to a Callbook product feature, so the score *is* the pitch.

### Callbook product fit map

For every lead, ComplaintSignal computes a per-feature match rate from the borrower narratives and surfaces it as a chip in the lead detail. Each chip shows the literal phrases that triggered it.

| Chip | What triggers it | Maps to |
|---|---|---|
| **Multichannel orchestration** | % narratives mentioning failed calls, voicemails, unanswered messages | Voice + WhatsApp + SMS + email switching |
| **Right-party contactability (50–70%)** | % narratives explicitly saying "could not reach" / "tried calling" | Callbook's headline contactability claim |
| **SOC 2 + audit trail** | % CFPB cases flagged not-timely or "in progress" | Callbook's SOC 2 + full call recording |
| **Voice agent quality** | % narratives describing rude, scripted, harassing agents | Callbook's "indistinguishable from human" voice |
| **Collections volume tier** | log-scaled 90d complaint count | Volume justifies AI voice ROI |

### Outreach pack (single structured LLM call)

```jsonc
{
  "lead_score": 91,
  "why_now": "Complaints rose 106% over the last 90 days, concentrated in payment-process and support-delay issues.",
  "pain_hypothesis": "Borrower support team likely overwhelmed; manual collections workflow at capacity.",
  "callbook_angle": "Callbook AI voice agents handle borrower follow-ups, reminders, and routing while preserving call quality and compliance.",
  "decision_maker": "VP Collections or Head of Servicing",
  "email":         { "subject": "...", "body": "..." },
  "linkedin_dm":   "...",
  "call_script_30s": "...",
  "voice_pitch_script": "...",
  "crm_note": "...",
  "call_flow": {
    "opener": "...",
    "hook": "...",
    "pain_probe": "...",
    "product_anchor": "...",
    "soft_ask": "...",
    "objection_handlers": [
      { "objection": "...", "response": "..." }
    ]
  }
}
```

The `voice_pitch_script` is what gets sent to ElevenLabs and played in the demo. The `call_flow` is the structured plan the voice agent follows step-by-step — rendered as its own panel above the voice pitch button so the audience sees the *structure* the audio is executing.

---

## Technologies

| Layer            | Choice                                  | Why                                                           |
|------------------|------------------------------------------|----------------------------------------------------------------|
| Frontend         | **Next.js 16** + React 19 + Tailwind 4   | Single-deployment app router, fast iteration, judge-friendly  |
| API              | Next.js Route Handlers (Node runtime)    | No separate server; one deployable                             |
| Language         | TypeScript 6                             | Strict types, structured outputs, fewer demo-day surprises     |
| Schemas          | Zod 4                                    | Runtime validation on every API boundary                       |
| LLM              | **Anthropic Claude** (`claude-opus-4-7`) | Structured JSON outputs via Zod, prompt caching on the static Callbook system prompt |
| TTS              | **ElevenLabs** (`eleven_turbo_v2_5`)     | Sponsored, low-latency, expressive voice for the demo close    |
| Data ingestion   | CFPB v1 search API + Apify actors        | Free public API + flexible enrichment without scraping infra   |
| Storage          | `data/seed.json` + in-memory cache       | Deterministic demo, zero infra, recoverable from API outage    |
| Tooling          | tsx, ESLint, Tailwind PostCSS pipeline   | Standard Next 16 tooling                                       |

**Deliberately not used:** Postgres, Supabase, auth, Docker, queue workers, CRM integrations. None of it earns its build cost in a 2.5-hour hackathon, and none of it is on screen during the 3-minute demo.

---

## Project Layout

```
.
├── data/
│   └── seed.json                        # CFPB-derived seed for 8–10 lenders
├── scripts/
│   └── refresh-seed.ts                  # One-shot CFPB pull → seed.json
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/route.ts          # GET  — env wiring check
│   │   │   ├── leads/route.ts           # GET  — ranked lead board
│   │   │   ├── leads/refresh/route.ts   # POST — re-pull CFPB + rescore
│   │   │   ├── outreach/route.ts        # POST — generate outbound pack
│   │   │   └── voice/route.ts           # POST — ElevenLabs TTS render
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── icon.svg
│   ├── components/
│   │   └── complaint-signal-app.tsx     # The full dashboard
│   └── lib/
│       ├── apify.ts                     # Apify actor invocations
│       ├── cfpb.ts                      # CFPB v1 search client
│       ├── elevenlabs.ts                # ElevenLabs TTS client
│       ├── http.ts                      # JSON error helpers
│       ├── lead-service.ts              # Orchestrates seed → ranking
│       ├── outreach.ts                  # LLM outreach-pack generator
│       ├── scoring.ts                   # 0–100 lead-score formula
│       ├── seed-store.ts                # In-memory seed cache
│       ├── targets.ts                   # Pre-vetted lender list
│       └── types.ts                     # Shared types
└── spec.md                              # Hackathon brief (source of truth)
```

---

## Quickstart

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env.local
# edit .env.local — see "Environment" below

# 3. (optional) refresh CFPB seed
npm run seed:cfpb

# 4. run
npm run dev
```

Open <http://127.0.0.1:3000>.

### Environment

| Variable                         | Required | Purpose                                                |
|----------------------------------|----------|--------------------------------------------------------|
| `APIFY_API_TOKEN`                | optional | Enables Apify enrichment for top ranked leads          |
| `APIFY_GOOGLE_SEARCH_ACTOR`      | optional | Defaults to `apify~google-search-scraper`              |
| `APIFY_SEARCH_RESULTS_PER_PAGE`  | optional | Default `5`                                            |
| `APIFY_SEARCH_MAX_PAGES`         | optional | Default `1`                                            |
| `APIFY_SEARCH_TIMEOUT_SECONDS`   | optional | Default `60`                                           |
| `ANTHROPIC_API_KEY`              | demo     | Used for the outreach-pack generator                   |
| `ANTHROPIC_MODEL`                | optional | Default `claude-opus-4-7`                              |
| `ELEVENLABS_API_KEY`             | demo     | Required for sponsored TTS (browser fallback otherwise)|
| `ELEVENLABS_VOICE_ID`            | demo     | The voice persona used at the demo close               |
| `ELEVENLABS_MODEL_ID`            | optional | Default `eleven_turbo_v2_5`                            |
| `ELEVENLABS_OUTPUT_FORMAT`       | optional | Default `mp3_44100_128`                                |
| `ELEVENLABS_API_BASE_URL`        | optional | Default `https://api.elevenlabs.io`                    |
| `REFRESH_TOKEN`                  | optional | Bearer token guarding `POST /api/leads/refresh`        |

Without an LLM key the outreach generator falls back to a deterministic, demo-safe template. Without an ElevenLabs key the voice pitch falls back to the browser's speech-synthesis voice — the demo flow stays playable but loses the sponsor moment.

---

## API

| Method | Path                  | Description                                                   |
|--------|-----------------------|---------------------------------------------------------------|
| `GET`  | `/api/health`         | Reports which integrations are wired                          |
| `GET`  | `/api/leads`          | Returns the ranked signal board                               |
| `GET`  | `/api/leads?refresh=true` | Forces a re-pull of CFPB data                              |
| `POST` | `/api/leads/refresh`  | Same as above, idempotent, optionally token-guarded           |
| `POST` | `/api/outreach`       | Generates the full outbound pack for one lead                 |
| `POST` | `/api/voice`          | Renders a `voice_pitch_script` to MP3 via ElevenLabs          |

The `/api/voice` endpoint returns a `200 { fallback: "browser_speech" }` JSON body when no ElevenLabs key is configured, so the client can switch to the local voice without surfacing an error to the demo.

---

## Demo Flow

A rehearsed three-minute pitch:

| Time         | Beat                                                                    |
|--------------|-------------------------------------------------------------------------|
| 0:00 – 0:20  | Frame the GTM problem. *"Most tools build phonebooks; we built a radar."* |
| 0:20 – 1:30  | Open the ranked board. Click the top lead. Show the literal CFPB complaint quote. Generate the outreach pack live. |
| 1:30 – 2:30  | **The ElevenLabs moment.** Click "Generate voice pitch" → play 20–30 s through the room speakers. |
| 2:30 – 3:00  | Close. *"One signal. One pack. One ready-to-call lead."*                |

---

## Demo-Day Risk Plan

| Risk                                      | Mitigation                                                                                  |
|-------------------------------------------|---------------------------------------------------------------------------------------------|
| CFPB API slow or down at demo time        | Seeded JSON in `data/seed.json` — never call the API live during the demo                   |
| ElevenLabs API hiccup                     | Pre-render the top-lead voice pitch as MP3 during build, embed as fallback                  |
| Wifi flaky at the venue                   | `npm run build && npm start` locally; have local screenshots for every screen               |
| LLM gives bad output for the demo lead    | Hardcoded outreach pack for the #1 demo company — never re-rolled live                      |
| "Is this real data?" from a judge         | Open a browser tab to live CFPB search results and read off the same complaint              |

---

## Submission Checklist

- [x] CFPB seed pulled and ranked
- [x] Outreach pack generator wired
- [x] ElevenLabs TTS playable on stage
- [x] Browser-speech fallback for offline demo
- [x] Apify enrichment integrated
- [ ] One demo lead hardcoded to look flawless
- [ ] 90-second pitch memorized
- [ ] Pre-recorded backup video of the full demo

---

## Roadmap

If we kept building past the buzzer:

- **Live source ingestion** — replace seeded JSON with a 30-min cron, store in Postgres, surface deltas as alerts.
- **Borrower-review enrichment** — TrustPilot, BBB, Reddit threads via Apify; same spike-and-extract pattern as CFPB.
- **Earnings-call transcripts** — pull from Seeking Alpha or AlphaSense, mine collections-cost language for an additional pain dimension.
- **CRM push** — one-click write to HubSpot / Salesforce so the lead is logged the moment the rep clicks "Generate."
- **Multi-tenant** — let any AI-collections vendor (or any vertical with public complaint data) plug in their target list.
- **Reply-rate measurement** — wire the generated emails back through the rep's inbox and close the loop on which "why now" framings actually convert.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the contribution workflow, code style, and how to propose new signal sources.

In short:

1. Open an issue describing the signal source or feature before writing code.
2. Branch from `main`, name the branch `feat/<topic>` or `fix/<topic>`.
3. Run `npm run lint` and `npm run typecheck` before pushing.
4. Open a PR with a screenshot or short Loom for any UI change.

---

## License

[MIT](./LICENSE) © 2026 ComplaintSignal contributors.

---

## Acknowledgements

- **Callbook AI × Lynk** — for hosting the Fintech GTM Hackathon and framing the problem.
- **CFPB** — for keeping the Consumer Complaint Database public and free.
- **ElevenLabs** — for the voice that closes the demo.
- **Apify** — for the actor ecosystem that made enrichment a one-line call.
- **Frontier Tower SF** — for the room.
