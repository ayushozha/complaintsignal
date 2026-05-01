import OpenAI from "openai";
import {
  fetchLeadSearchEvidence,
  hasApifyConfig,
  type ApifySearchEvidence
} from "./apify";
import type { Lead, OutreachPack } from "./types";

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

let openaiClient: OpenAI | null = null;

export async function generateOutreachPack(lead: Lead): Promise<{
  pack: OutreachPack;
  source: "apify" | "openai" | "template";
  model: string;
  warning?: string;
}> {
  let apifyWarning: string | undefined;

  if (hasApifyConfig()) {
    try {
      const evidence = await fetchLeadSearchEvidence(lead);
      return {
        pack: apifyOutreachPack(lead, evidence),
        source: "apify",
        model: process.env.APIFY_GOOGLE_SEARCH_ACTOR || "apify~google-search-scraper",
        warning:
          evidence.length > 0
            ? undefined
            : "Apify returned no search evidence; generated from CFPB lead data."
      };
    } catch (error) {
      apifyWarning =
        error instanceof Error
          ? `Apify fallback: ${error.message}`
          : "Apify fallback: search failed.";

      return {
        pack: templateOutreachPack(lead),
        source: "template",
        model: process.env.APIFY_GOOGLE_SEARCH_ACTOR || "apify~google-search-scraper",
        warning: apifyWarning
      };
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
    return {
      pack: templateOutreachPack(lead),
      source: "template",
      model,
      warning:
        apifyWarning ??
        "APIFY_API_TOKEN and OPENAI_API_KEY are not set; returned deterministic template output."
    };
  }

  try {
    const client = getOpenAIClient(apiKey);
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You write concise, evidence-grounded B2B outbound for Callbook AI. Return only JSON that matches the schema."
        },
        {
          role: "user",
          content: JSON.stringify({
            product:
              "Callbook AI voice agents for collections, borrower follow-up, reminders, routing, and servicing capacity relief.",
            lead
          })
        }
      ],
      text: {
        format: outreachJsonSchema
      }
    });

    const outputText = readResponseText(response);

    return {
      pack: JSON.parse(outputText) as OutreachPack,
      source: "openai",
      model,
      warning: apifyWarning
    };
  } catch (error) {
    const openAiWarning =
      error instanceof Error
        ? `OpenAI fallback failed: ${error.message}`
        : "OpenAI fallback failed.";

    return {
      pack: templateOutreachPack(lead),
      source: "template",
      model,
      warning: [apifyWarning, openAiWarning].filter(Boolean).join(" ")
    };
  }
}

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

function readResponseText(response: OpenAI.Responses.Response): string {
  const directText = (response as { output_text?: string }).output_text;

  if (directText) {
    return directText;
  }

  const output = (response as {
    output?: Array<{ content?: Array<{ text?: string }> }>;
  }).output;

  const text = (output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return text;
}

export function templateOutreachPack(lead: Lead): OutreachPack {
  const receiptLine = lead.receipt
    ? `A recent CFPB complaint cites ${lead.receipt.issue.toLowerCase()} in ${lead.receipt.product.toLowerCase()}.`
    : "Recent CFPB complaint activity points to servicing friction.";

  return {
    lead_score: lead.leadScore,
    why_now: lead.whyNow,
    pain_hypothesis: lead.painHypothesis,
    callbook_angle:
      "Callbook AI voice agents can absorb borrower follow-up, payment reminders, and first-pass routing while keeping servicing teams focused on exceptions.",
    decision_maker: lead.decisionMaker,
    email: {
      subject: `Reducing borrower follow-up pressure at ${lead.company}`,
      body: `Hi - noticed ${lead.company} has ${lead.recentCount} public CFPB complaints in the last 90 days. ${receiptLine}\n\nCallbook helps collections and servicing teams use AI voice agents for borrower reminders, follow-up, and routing, so human agents spend time on the cases that need judgment.\n\nWorth comparing notes on where voice automation could take pressure off your team this quarter?`
    },
    linkedin_dm: `${lead.company} showed a fresh CFPB servicing signal: ${lead.whyNow} Callbook helps teams turn that kind of follow-up load into AI voice workflows. Open to a quick compare?`,
    call_script_30s: `Hi, this is Callbook. I noticed ${lead.company} has a fresh CFPB complaint signal around servicing and borrower follow-up. We help collections teams use AI voice agents for payment reminders, routing, and status checks. Is improving borrower reachability on your team radar this quarter?`,
    voice_pitch_script: `Hi, this is Callbook. We noticed ${lead.company} is showing a fresh public signal in CFPB complaints around servicing friction. Callbook voice agents can handle borrower follow-up, payment reminders, and routing so your collections team can focus on the higher judgment cases. Would it be worth a short conversation this week?`,
    crm_note: `${lead.company}: score ${lead.leadScore}. ${lead.whyNow} Suggested persona: ${lead.decisionMaker}.`
  };
}

function apifyOutreachPack(
  lead: Lead,
  evidence: ApifySearchEvidence[]
): OutreachPack {
  const receiptLine = lead.receipt
    ? `A CFPB receipt cites ${lead.receipt.issue.toLowerCase()} in ${lead.receipt.product.toLowerCase()}.`
    : "CFPB activity points to borrower servicing friction.";

  const evidenceLine = buildEvidenceLine(evidence);
  const contextLine = [receiptLine, evidenceLine].filter(Boolean).join(" ");

  return {
    lead_score: lead.leadScore,
    why_now: lead.whyNow,
    pain_hypothesis: lead.painHypothesis,
    callbook_angle:
      "Callbook AI voice agents can absorb borrower follow-up, payment reminders, and first-pass routing while keeping servicing teams focused on exceptions.",
    decision_maker: lead.decisionMaker,
    email: {
      subject: `Public servicing pressure at ${lead.company}`,
      body: `Hi - I was looking at public borrower-service signals for ${lead.company}. ${contextLine}\n\nThat usually creates repetitive follow-up work: payment reminders, status calls, routing, and escalation triage.\n\nCallbook helps servicing and collections teams move that load into AI voice workflows while keeping complex cases with human agents.\n\nWorth comparing where voice automation could remove pressure from your team this quarter?`
    },
    linkedin_dm: `${lead.company} has a fresh public servicing signal: ${lead.whyNow} ${evidenceLine || "CFPB data is already enough to see borrower follow-up pressure."} Callbook turns this kind of follow-up load into AI voice workflows. Open to a quick compare?`,
    call_script_30s: `Hi, this is Callbook. I noticed public CFPB and web signals around borrower servicing pressure at ${lead.company}. We help collections and servicing teams use AI voice agents for payment reminders, routing, and status checks, so reps can focus on exceptions. Is reducing repetitive borrower follow-up on your team's radar?`,
    voice_pitch_script: `Hi, this is Callbook. We noticed ${lead.company} is showing public borrower servicing pressure. ${lead.whyNow} Callbook voice agents can handle borrower follow-up, payment reminders, and routing so your team can focus on higher judgment cases. Would it be worth a short conversation this week?`,
    crm_note: `${lead.company}: score ${lead.leadScore}. Apify query evidence: ${summarizeEvidence(evidence)} ${lead.whyNow} Suggested persona: ${lead.decisionMaker}.`
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
  return `Apify search surfaced ${formatEvidenceTitle(best)}${description}.`;
}

function summarizeEvidence(evidence: ApifySearchEvidence[]): string {
  if (evidence.length === 0) {
    return "none";
  }

  return evidence
    .slice(0, 3)
    .map((item) => (isUrlLike(item.title) ? readHostname(item.url) : item.title))
    .join(" | ");
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

const outreachJsonSchema = {
  type: "json_schema",
  name: "outreach_pack",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "lead_score",
      "why_now",
      "pain_hypothesis",
      "callbook_angle",
      "decision_maker",
      "email",
      "linkedin_dm",
      "call_script_30s",
      "voice_pitch_script",
      "crm_note"
    ],
    properties: {
      lead_score: { type: "integer" },
      why_now: { type: "string" },
      pain_hypothesis: { type: "string" },
      callbook_angle: { type: "string" },
      decision_maker: { type: "string" },
      email: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "body"],
        properties: {
          subject: { type: "string" },
          body: { type: "string" }
        }
      },
      linkedin_dm: { type: "string" },
      call_script_30s: { type: "string" },
      voice_pitch_script: { type: "string" },
      crm_note: { type: "string" }
    }
  }
} as const;
