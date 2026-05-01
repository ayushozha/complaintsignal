import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  fetchLeadSearchEvidence,
  hasApifyConfig,
  type ApifySearchEvidence
} from "./apify";
import type { Lead, OutreachPack } from "./types";

const DEFAULT_MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4096;
const APIFY_TEMPLATE_MODEL = "apify-google-search-template";
const CFPB_TEMPLATE_MODEL = "cfpb-template";

const CALLBOOK_POSITIONING = `Callbook AI is an AI-powered collections platform.
- Voice agents indistinguishable from humans, plus WhatsApp, SMS, and email channels under one orchestration layer.
- Claims 50-70% right-party contactability.
- SOC 2 compliant; ships full call recording and audit trail by default.
- Sells to fintech lenders, BNPL, subprime auto, student loan servicers, private-label card issuers, and consumer installment lenders.
- Buyer is typically VP Collections, Head of Servicing, or VP Customer / Contact Center Operations.
- Competitive set: Salient, Prodigal, Cresta, Skit.ai, WIZ.ai. Differentiation is multichannel orchestration + voice quality + SOC 2.`;

const SYSTEM_PROMPT = `You are a senior B2B outbound writer for Callbook AI's GTM team. You write evidence-grounded outreach for fintech lenders. Every claim must trace to a CFPB datapoint or a public search snippet provided in the user payload. Prefer specifics (numbers, borrower phrases) over adjectives. Reference Callbook's actual product features (multichannel orchestration, 50-70% contactability, SOC 2 + audit trail, voice quality). Never invent statistics. Return only JSON matching the provided schema.

${CALLBOOK_POSITIONING}`;

const OutreachPackSchema = z.object({
  lead_score: z.number().int(),
  why_now: z.string(),
  pain_hypothesis: z.string(),
  callbook_angle: z.string(),
  decision_maker: z.string(),
  email: z.object({
    subject: z.string(),
    body: z.string()
  }),
  linkedin_dm: z.string(),
  call_script_30s: z.string(),
  voice_pitch_script: z.string(),
  crm_note: z.string()
});

let anthropicClient: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

export async function generateOutreachPack(lead: Lead): Promise<{
  pack: OutreachPack;
  source: "apify" | "claude" | "claude+apify" | "template";
  model: string;
  warning?: string;
}> {
  let apifyEvidence: ApifySearchEvidence[] = [];
  let apifyWarning: string | undefined;

  if (hasApifyConfig()) {
    try {
      apifyEvidence = await fetchLeadSearchEvidence(lead);
    } catch (error) {
      apifyWarning =
        error instanceof Error
          ? `Apify enrichment failed: ${error.message}`
          : "Apify enrichment failed.";
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const hasApifyEvidence = apifyEvidence.length > 0;

  if (!apiKey) {
    return {
      pack: templateOutreachPack(lead, apifyEvidence),
      source: hasApifyEvidence ? "apify" : "template",
      model: hasApifyEvidence ? APIFY_TEMPLATE_MODEL : CFPB_TEMPLATE_MODEL,
      warning:
        apifyWarning ??
        (hasApifyEvidence
          ? undefined
          : "ANTHROPIC_API_KEY is not set and Apify returned no evidence; returned CFPB-only template output.")
    };
  }

  try {
    const client = getClient(apiKey);

    const userPayload = {
      instructions:
        "Generate the outbound pack for this lead. Lead with the strongest borrower-voice evidence (contactability > multichannel > compliance > volume). Tie every channel back to a Callbook product feature. The voice_pitch_script will be rendered by an AI voice agent; keep it conversational, under 35 seconds, and end with a soft ask.",
      lead: {
        company: lead.company,
        segment: lead.segment,
        decision_maker: lead.decisionMaker,
        lead_score: lead.leadScore,
        callbook_fit: lead.callbookFit,
        recent_complaint_count: lead.recentCount,
        previous_complaint_count: lead.previousCount,
        spike_percent: lead.spikePercent,
        top_issues: lead.issueSummary,
        multichannel_pain_rate: lead.multichannelPainRate,
        contactability_pain_rate: lead.contactabilityPainRate,
        compliance_heat_rate: lead.complianceHeatRate,
        debt_collection_share: lead.debtCollectionShare,
        product_map: lead.productMap.entries.map((entry) => ({
          feature: entry.feature,
          label: entry.label,
          match_rate: entry.matchRate,
          evidence_phrases: entry.evidencePhrases
        })),
        receipt: lead.receipt
          ? {
              product: lead.receipt.product,
              issue: lead.receipt.issue,
              sub_issue: lead.receipt.subIssue,
              narrative: lead.receipt.narrative.slice(0, 1200),
              timely: lead.receipt.timely,
              company_response: lead.receipt.companyResponse,
              date_received: lead.receipt.dateReceived
            }
          : null
      },
      apify_search_evidence: apifyEvidence.slice(0, 4).map((item) => ({
        title: item.title,
        url: item.url,
        description: item.description
      }))
    };

    const response = await client.messages.parse({
      model,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [
        {
          role: "user",
          content: JSON.stringify(userPayload)
        }
      ],
      output_config: {
        format: zodOutputFormat(OutreachPackSchema)
      }
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("Claude response did not parse against the outreach schema.");
    }

    return {
      pack: parsed as OutreachPack,
      source: hasApifyEvidence ? "claude+apify" : "claude",
      model,
      warning: apifyWarning
    };
  } catch (error) {
    const claudeWarning =
      error instanceof Error
        ? `Claude generation failed: ${error.message}`
        : "Claude generation failed.";

    return {
      pack: templateOutreachPack(lead, apifyEvidence),
      source: hasApifyEvidence ? "apify" : "template",
      model: hasApifyEvidence ? APIFY_TEMPLATE_MODEL : CFPB_TEMPLATE_MODEL,
      warning: [apifyWarning, claudeWarning].filter(Boolean).join(" ")
    };
  }
}

export function templateOutreachPack(
  lead: Lead,
  evidence: ApifySearchEvidence[] = []
): OutreachPack {
  const topProduct = lead.productMap.entries[0];
  const productLabel = topProduct?.label ?? "Callbook's multichannel orchestration";
  const productLine =
    topProduct?.description ??
    "Callbook's voice agents handle borrower follow-up, payment reminders, and routing while keeping servicing teams on exceptions.";

  const receiptLine = lead.receipt
    ? `A recent CFPB complaint cites ${lead.receipt.issue.toLowerCase()} in ${lead.receipt.product.toLowerCase()}.`
    : "Recent CFPB complaint activity points to servicing friction.";

  const evidenceLine = buildEvidenceLine(evidence);
  const contextLine = [receiptLine, evidenceLine].filter(Boolean).join(" ");

  return {
    lead_score: lead.leadScore,
    why_now: lead.whyNow,
    pain_hypothesis: lead.painHypothesis,
    callbook_angle: productLine,
    decision_maker: lead.decisionMaker,
    email: {
      subject: `${lead.company}: closing the borrower-contactability gap`,
      body: `Hi - I was looking at public CFPB signals for ${lead.company}. ${contextLine}\n\nThe pattern that stands out: ${productLabel.toLowerCase()}. ${productLine}\n\nCallbook is SOC 2 compliant, ships full call recording, and pairs voice agents with WhatsApp / SMS / email so the next channel is automatic when one fails.\n\nWorth a 15-minute compare on where ${lead.company} is leaving contactability on the floor today?`
    },
    linkedin_dm: `${lead.company} has a fresh public CFPB pattern: ${lead.whyNow.split(".")[0]}. Callbook AI's multichannel collections platform (voice + WhatsApp + SMS + email, SOC 2) is built to close exactly that gap. Open to a quick compare?`,
    call_script_30s: `Hi, this is Callbook. I noticed ${lead.company} has ${lead.recentCount.toLocaleString()} CFPB complaints in 90 days, and the borrower narratives keep mentioning failed calls and unreached messages. Callbook is the AI voice + WhatsApp + SMS + email orchestration platform behind 50-70% contactability for collections, with SOC 2 and full call recording out of the box. Is improving right-party contact on your team's roadmap this quarter?`,
    voice_pitch_script: `Hi - this is Callbook. Quick reason for the call. We pulled CFPB complaints for ${lead.company} and the borrower-voice pattern is clear: missed calls, dead voicemails, and unanswered messages. Callbook is the AI collections platform with voice agents indistinguishable from humans, plus WhatsApp, SMS, and email orchestration. We help lenders like ${lead.company} push right-party contactability into the 50 to 70 percent band, with SOC 2 and full call recording on day one. Worth a 15-minute conversation this week?`,
    crm_note: `${lead.company} - lead score ${lead.leadScore}, Callbook fit ${lead.callbookFit}. ${lead.whyNow} Top product map: ${lead.productMap.entries.slice(0, 2).map((e) => e.label).join(" | ")}. Persona: ${lead.decisionMaker}.`
  };
}

function buildEvidenceLine(evidence: ApifySearchEvidence[]): string {
  const best =
    evidence.find((item) => !isUrlLike(item.title) && item.description) ??
    evidence.find((item) => !isUrlLike(item.title)) ??
    evidence.find((item) => item.description) ??
    evidence[0];

  if (!best) {
    return "";
  }

  const description = best.description ? `: ${trimSentence(best.description)}` : "";
  return `Public search surfaced ${formatEvidenceTitle(best)}${description}.`;
}

function formatEvidenceTitle(item: ApifySearchEvidence): string {
  if (!isUrlLike(item.title)) {
    return `"${item.title}"`;
  }

  const hostname = readHostname(item.url);
  return hostname ? `a public ${hostname} result` : "a public search result";
}

function isUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^www\./i.test(value);
}

function readHostname(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function trimSentence(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  const sliced = compact.length > 220 ? `${compact.slice(0, 217).trim()}...` : compact;
  return sliced.replace(/\.+$/, "");
}
