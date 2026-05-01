# ComplaintSignal — Callbook GTM Lead Engine

> **Hackathon spec for Fintech GTM Hackathon by Callbook AI × Lynk**
> Frontier Tower SF · 2.5-hour build · Submission 8:00 PM

---

## 1. One-liner

**ComplaintSignal finds fintech lenders with fresh, public collections pain — and hands Callbook's sales team a ready-to-fire outbound pack for each lead.**

Most lead-gen tools build phonebooks. ComplaintSignal builds **buying intent**, grounded in CFPB complaints, borrower reviews, and (stretch) earnings disclosures.

---

## 2. Why this wins this room

### Judge alignment

| Judge | Background | What this hits |
|---|---|---|
| Deon Meneses (Virelity CEO) | GTM operator | "Why now" lead intelligence, not phonebook |
| Rishabh Chanana (Observee, YC S25) | ML/observability | Signal extraction from unstructured data |
| Yash Raj (ex-LunaBill) | B2B sales tooling | Outbound pack with personalization |
| Manav Modi (AgentPhone) | Voice agents | Voice pitch generation as final output |
| Viktor / Kajo / Alexander (KugelAudio, YC S26) | TTS | **KugelAudio TTS is the demo closer — not an afterthought** |

### Differentiators

- **Causal signal**, not static keywords. We answer "why now" instead of "they're a lender."
- **Receipts in the demo.** Every claim references the literal complaint text, the literal review, the literal quarter's number. Judges trust what they can verify in 2 seconds.
- **Self-evident GTM logic.** Callbook sells AI for collections. We surface lenders whose collections operations are *publicly visibly failing*. There's no leap of faith required.

---

## 3. Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CFPB API       │────▶│  Signal Engine  │────▶│  Lead Ranking   │
│  (primary)      │     │  (LLM extract + │     │  (0–100 score)  │
└─────────────────┘     │   spike calc)   │     └────────┬────────┘
                        └─────────────────┘              │
┌─────────────────┐              ▲                       ▼
│ Google Reviews  │──────────────┤              ┌─────────────────┐
│ (Apify, stretch)│              │              │ Outreach Pack   │
└─────────────────┘              │              │ Generator (LLM) │
                                 │              └────────┬────────┘
┌─────────────────┐              │                       │
│ Earnings 10-Q   │──────────────┘                       ▼
│ (hardcoded JSON)│                            ┌─────────────────┐
└─────────────────┘                            │ KugelAudio TTS  │
                                               │ Voice Pitch     │
                                               └─────────────────┘
```

**Signal layers (in priority order):**

1. **CFPB Consumer Complaint Database** — primary signal, free public API, updated daily
2. **Google Reviews via Apify** — stretch signal, borrower-voice pain mining
3. **Earnings/10-Q snippets** — hardcoded JSON for public lenders, financial pain dimension

---

## 4. Data sources

### 4.1 CFPB Complaint Database (primary)

- **Endpoint:** `https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/`
- **Auth:** None (free, public)
- **Filters:** `date_received_min`, `date_received_max`, `product`, `company`, `size`
- **Target products:**
  - Debt collection
  - Vehicle loan or lease
  - Payday loan, title loan, or personal loan
  - Credit card or prepaid card
  - Mortgage
  - Student loan
  - Credit reporting, credit repair services, or other personal consumer reports

**Two queries per target company:**
- Last 90 days complaint count
- Previous 90 days complaint count (for spike calculation)

### 4.2 Pre-vetted target list (HARDCODE for demo safety)

Don't rely on "discovery" at runtime — pre-pick 8-10 companies known to have CFPB activity. Examples:

```
Capital One, Affirm Holdings, LendingClub, Upstart Network,
OneMain Financial, SoFi, Synchrony Financial, Discover,
Bread Financial, Goldman Sachs (Marcus)
```

For each, pre-fetch the CFPB JSON during the build, save to `/data/seed.json`. This gives you:
- Zero API risk during demo
- Deterministic ranking
- Real, verifiable complaint data on stage

### 4.3 Google Reviews (STRETCH — only if Tier 1 ships by 1:30 mark)

- Apify Actor: `compass/google-maps-reviews-scraper`
- Pull reviews for the top 3 ranked companies' branch locations
- LLM mines pain phrases: "no one answers," "called X times," "couldn't reach," "harassment," "wrong amount"

### 4.4 Earnings snippets (STRETCH — pre-built JSON, no API)

Hardcode 3-5 real recent quotes:
```json
{
  "company": "Capital One",
  "quarter": "Q1 2026",
  "metric": "domestic card net charge-off rate",
  "value": "5.93%",
  "movement": "up 47bps YoY",
  "quote": "..."
}
```

---

## 5. Lead scoring formula

```
Total /100 =
   Complaint spike (90d vs prior 90d):     35 pts
   Collections-relevance of issues:        25 pts  (debt collection, payment, support)
   Customer support pain phrases:          20 pts  (response delays, "couldn't reach")
   Slow/non-timely company response rate:  10 pts  (CFPB has this field)
   Industry/revenue fit:                   10 pts
```

Cap at 100. Display as animated counter on the demo.

---

## 6. Output: Outreach Pack

For every lead, the LLM generates **one structured object**:

```json
{
  "lead_score": 91,
  "why_now": "Complaints rose 106% over the last 90 days, concentrated in payment-process and support-delay issues.",
  "pain_hypothesis": "Borrower support team likely overwhelmed; manual collections workflow at capacity.",
  "callbook_angle": "Callbook AI voice agents handle borrower follow-ups, reminders, and routing while preserving call quality and compliance.",
  "decision_maker": "VP Collections or Head of Servicing",
  "email": {
    "subject": "Reducing borrower follow-up pressure at {company}",
    "body": "..."
  },
  "linkedin_dm": "...",
  "call_script_30s": "...",
  "voice_pitch_script": "...",   // <-- this gets fed to KugelAudio
  "crm_note": "..."
}
```

**Single LLM call per lead.** Use a strict JSON schema response.

---

## 7. The demo (THIS IS WHAT WINS)

3 minutes total. Rehearse twice before submission.

### 0:00–0:20 — Frame the problem

> "Callbook sells AI employees for collections. Their hardest GTM problem isn't building the product — it's knowing which lenders are bleeding *right now*. Most tools give you phonebooks. We built a buying-intent radar."

### 0:20–1:30 — The product

1. Show signal board ranked by lead score (8 real companies, real numbers)
2. Click top lead → "Why now" panel opens with **the actual CFPB complaint quote** highlighted
3. Click "Generate Outreach Pack" → email + LinkedIn DM + call script render in real-time

### 1:30–2:30 — **THE KUGELAUDIO MOMENT** ⭐

> "But Callbook is a voice company. So is the buyer. So we close the loop."

Click **"Generate voice pitch"** → KugelAudio TTS renders the call script with empathetic prosody → play 20-30 seconds through the room speakers.

This is the moment three judges decide.

### 2:30–3:00 — Close

> "We don't find every lender. We find the lender with a reason to buy this week. Callbook's AE opens this email tomorrow morning, and the call's already half-pitched."

---

## 8. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 + Tailwind | Fast, judge-friendly UI, deploy to Vercel in 30s |
| Backend | Next.js API routes | Single deployment, no separate server |
| LLM | Claude Sonnet 4.6 or GPT-4o-mini | Structured outputs, fast |
| TTS | **KugelAudio API** | Sponsor; demo-critical |
| Data fetch | CFPB API (fetch), Apify SDK | Both no-friction |
| Storage | `/data/seed.json` + in-memory | Zero infra |
| Hosting | Vercel | Free tier, instant URL |

**Don't use:** Supabase, auth, Postgres, Docker, real Callbook API. None of it earns its build cost.

---

## 9. Build plan — 2.5 hours WITH buffer

| Time | Phase | Deliverable | Hard stop? |
|---|---|---|---|
| **0:00–0:20** | Skeleton | Next.js running, Vercel deployed, blank dashboard | Yes |
| **0:20–0:50** | Seed data + CFPB | `/data/seed.json` with 8 companies, both 90d buckets, real complaint counts | Yes |
| **0:50–1:20** | Scoring + UI | Ranked table working, click-to-detail, complaint quote display | Yes |
| **1:20–1:50** | Outreach generator | LLM produces full JSON pack, email + script render | Yes |
| **1:50–2:10** | KugelAudio TTS | Voice pitch playback wired, tested with real audio | **Critical** |
| **2:10–2:25** | Polish + ONE perfect lead | Demo target hardcoded to look flawless | Yes |
| **2:25–2:30** | Rehearse demo twice | Out loud, with timer | Yes |

**Stretch (only if 1:50 hits with everything green):**
- Google Reviews enrichment for top lead
- Earnings snippet panel
- Lead score animation

**Cut list (drop these the moment you fall behind):**
1. Google Reviews (cut at 2:00)
2. Earnings snippets (cut at 1:45)
3. LinkedIn DM (cut at 1:30 — keep email + voice only)
4. Lead score animation (cut at 2:15)

---

## 10. Fallbacks and demo-day risks

| Risk | Mitigation |
|---|---|
| CFPB API slow/down at demo | Seeded JSON means we never call it live during the demo |
| KugelAudio API hiccup | Pre-render the voice pitch as MP3 during build, embed as fallback |
| Wifi flaky at venue | Run locally with `npm run dev`, have local screenshots for every screen |
| LLM gives bad output for demo lead | Hardcode the perfect outreach pack for the #1 demo company |
| Judges ask "is this real data?" | Open browser tab to live CFPB site, show the actual complaints |

**The single demo lead must be perfect.** Nail one company end-to-end before adding the seventh.

---

## 11. What NOT to build

To save you from yourself in hour 2:

- ❌ Authentication / login
- ❌ Persistent database
- ❌ Real-time webhooks
- ❌ Multi-user support
- ❌ Settings/preferences UI
- ❌ A "search" bar that hits live APIs
- ❌ Callbook API integration (the brief said it's not required)
- ❌ Charts beyond a single bar/spike visual
- ❌ Multi-step forms

If a feature isn't on screen during the 3-minute demo, **it doesn't exist for judging purposes.**

---

## 12. The 90-second pitch (memorize)

> "Callbook sells AI employees for collections. The hardest GTM problem isn't the product — it's knowing which lenders are bleeding right now.
>
> Most lead-gen tools build phonebooks. We built ComplaintSignal — a buying-intent radar grounded in CFPB consumer complaints.
>
> We pull every public complaint about debt collection and loan servicing in the last 90 days, detect spikes, and surface the lenders whose operations are visibly failing. For each one, we generate the receipts — the actual complaint quote, the why-now brief — and a complete outbound pack: email, LinkedIn DM, call script, and a voice pitch ready for Callbook's AE.
>
> [Click into top lead. Show CFPB quote. Show outreach pack.]
>
> Last move — because Callbook is a voice company:
>
> [Play KugelAudio TTS rendering of voice pitch.]
>
> One signal. One pack. One ready-to-call lead. Callbook's AE opens this tomorrow morning and the conversation's already started."

---

## 13. Submission checklist

- [ ] Live URL on Vercel (one-click access for judges)
- [ ] GitHub repo public
- [ ] One demo lead hardcoded to look flawless
- [ ] KugelAudio voice pitch playable on stage
- [ ] Local fallback ready if Wifi fails
- [ ] 90-second pitch memorized
- [ ] One-slide summary of what + why + how
- [ ] Pre-recorded backup video of full demo (insurance)

---

**Now stop reading specs and start building. Good luck. 🚀**
