import { buildCfpbUrl } from "./cfpb";
import type {
  CallbookFeature,
  CallbookProductMap,
  ComplaintRecord,
  ComplaintWindow,
  Lead,
  ProductMapEntry,
  SignalBreakdown,
  TargetCompany
} from "./types";

const COLLECTIONS_KEYWORDS = [
  "collection",
  "collect",
  "debt",
  "delinquen",
  "past due",
  "late payment",
  "payment",
  "billing",
  "repossession",
  "foreclosure",
  "charge-off",
  "charge off",
  "loan servicing"
];

const MULTICHANNEL_PAIN_PHRASES = [
  "called",
  "calling",
  "voicemail",
  "voice mail",
  "left a message",
  "left messages",
  "no callback",
  "never called back",
  "tried to reach",
  "messaged",
  "texted",
  "text message",
  "email",
  "emailed",
  "no answer",
  "no response",
  "no reply",
  "never responded",
  "never replied",
  "after hours",
  "after-hours"
];

const CONTACTABILITY_PAIN_PHRASES = [
  "could not reach",
  "couldn't reach",
  "cannot reach",
  "can't reach",
  "unable to reach",
  "no one answered",
  "nobody answered",
  "no one answers",
  "cannot get through",
  "can't get through",
  "never got a response",
  "never got through",
  "kept getting transferred",
  "transferred multiple times",
  "wait on hold",
  "hold for hours",
  "on hold for",
  "tried calling",
  "tried to call",
  "called multiple times",
  "called several times",
  "called and called",
  "no one ever",
  "not return my call",
  "did not return",
  "didn't return",
  "did not respond",
  "didn't respond",
  "no return call",
  "automated system",
  "no human"
];

const VOICE_QUALITY_PAIN_PHRASES = [
  "rude",
  "unprofessional",
  "yelled",
  "yelling",
  "harassed",
  "harassment",
  "harassing",
  "threatened",
  "threatening",
  "abusive",
  "robotic",
  "scripted",
  "would not listen",
  "did not listen"
];

const DEBT_COLLECTION_PRODUCT = "debt collection";

export function scoreLead(
  target: TargetCompany,
  recent: ComplaintWindow,
  previous: ComplaintWindow
): Lead {
  const spikePercent = calculateSpikePercent(recent.count, previous.count);
  const sample = recent.complaints;
  const sampleSize = sample.length;

  const debtCollectionShare = computeShare(
    sample,
    (c) => c.product.toLowerCase().includes(DEBT_COLLECTION_PRODUCT)
  );

  const multichannel = scanEvidence(sample, MULTICHANNEL_PAIN_PHRASES);
  const contactability = scanEvidence(sample, CONTACTABILITY_PAIN_PHRASES);
  const voiceQuality = scanEvidence(sample, VOICE_QUALITY_PAIN_PHRASES);

  const complianceHeatRate = computeShare(sample, (c) => {
    if (c.timely === "No") return true;
    const response = c.companyResponse?.toLowerCase() ?? "";
    return response.includes("in progress") || response.includes("untimely");
  });

  const collectionsRelevanceRate = computeShare(sample, isCollectionsRelevant);

  const complaintSpike = scoreComplaintSpike(spikePercent, recent.count);
  const collectionsRelevance = Math.round(
    Math.max(collectionsRelevanceRate, debtCollectionShare) * 20
  );
  const multichannelPain = Math.round(Math.min(1, multichannel.rate * 1.6) * 15);
  const contactabilityPain = Math.round(Math.min(1, contactability.rate * 2) * 10);
  const complianceHeat = Math.round(Math.min(1, complianceHeatRate * 2) * 20);

  const callbookFitRaw =
    multichannel.rate * 0.35 +
    contactability.rate * 0.25 +
    complianceHeatRate * 0.20 +
    debtCollectionShare * 0.10 +
    volumeFactor(recent.count) * 0.10;
  const callbookFit = Math.round(Math.min(1, callbookFitRaw) * 100);
  const callbookFitPoints = Math.round((callbookFit / 100) * 10);

  const breakdown: SignalBreakdown = {
    complaintSpike,
    collectionsRelevance,
    multichannelPain,
    contactabilityPain,
    complianceHeat,
    callbookFit: callbookFitPoints
  };

  const leadScore = Math.min(
    100,
    Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  );

  const productMap: CallbookProductMap = {
    entries: buildProductMap({
      multichannelRate: multichannel.rate,
      multichannelPhrases: multichannel.phrases,
      contactabilityRate: contactability.rate,
      contactabilityPhrases: contactability.phrases,
      voiceQualityRate: voiceQuality.rate,
      voiceQualityPhrases: voiceQuality.phrases,
      complianceHeatRate,
      recentCount: recent.count,
      sampleSize
    })
  };

  const issueSummary = summarizeIssues(sample);
  const receipt = selectReceipt(sample);

  return {
    id: target.id,
    company: target.displayName,
    cfpbSearchTerm: target.cfpbSearchTerm,
    segment: target.segment,
    decisionMaker: target.decisionMaker,
    leadScore,
    callbookFit,
    spikePercent,
    recentCount: recent.count,
    previousCount: previous.count,
    breakdown,
    whyNow: buildWhyNow({
      target,
      recentCount: recent.count,
      spikePercent,
      issueSummary,
      multichannelRate: multichannel.rate,
      contactabilityRate: contactability.rate,
      complianceHeatRate
    }),
    painHypothesis: buildPainHypothesis({
      multichannelRate: multichannel.rate,
      contactabilityRate: contactability.rate,
      complianceHeatRate,
      voiceQualityRate: voiceQuality.rate,
      issueSummary
    }),
    issueSummary,
    receipt,
    recentComplaints: sample,
    previousComplaints: previous.complaints,
    cfpbUrl: buildCfpbUrl(target, {
      start: recent.start,
      end: recent.end
    }),
    productMap,
    multichannelPainRate: multichannel.rate,
    contactabilityPainRate: contactability.rate,
    complianceHeatRate,
    debtCollectionShare
  };
}

function calculateSpikePercent(recentCount: number, previousCount: number): number {
  if (recentCount === 0) {
    return 0;
  }

  if (previousCount === 0) {
    return 100;
  }

  return Math.round(((recentCount - previousCount) / previousCount) * 100);
}

function scoreComplaintSpike(spikePercent: number, recentCount: number): number {
  if (recentCount === 0) {
    return 0;
  }

  const spikeScore = spikePercent > 0 ? Math.round((spikePercent / 100) * 25) : 0;
  const volumePressure = Math.round(
    Math.min(20, (Math.log10(recentCount + 1) / Math.log10(7000)) * 20)
  );

  return Math.min(25, Math.max(spikeScore, volumePressure));
}

function volumeFactor(recentCount: number): number {
  if (recentCount === 0) return 0;
  return Math.min(1, Math.log10(recentCount + 1) / Math.log10(7000));
}

interface EvidenceScan {
  rate: number;
  matchCount: number;
  total: number;
  phrases: string[];
}

function scanEvidence(
  complaints: ComplaintRecord[],
  phrases: string[]
): EvidenceScan {
  if (complaints.length === 0) {
    return { rate: 0, matchCount: 0, total: 0, phrases: [] };
  }

  const matchedPhraseSet = new Set<string>();
  let matched = 0;

  for (const complaint of complaints) {
    const haystack = complaintText(complaint);
    let hit = false;
    for (const phrase of phrases) {
      if (haystack.includes(phrase)) {
        matchedPhraseSet.add(phrase);
        hit = true;
      }
    }
    if (hit) matched += 1;
  }

  return {
    rate: matched / complaints.length,
    matchCount: matched,
    total: complaints.length,
    phrases: [...matchedPhraseSet].slice(0, 4)
  };
}

function computeShare(
  complaints: ComplaintRecord[],
  predicate: (c: ComplaintRecord) => boolean
): number {
  if (complaints.length === 0) return 0;
  const matched = complaints.filter(predicate).length;
  return matched / complaints.length;
}

function isCollectionsRelevant(complaint: ComplaintRecord): boolean {
  const haystack = complaintText(complaint);
  return COLLECTIONS_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function complaintText(complaint: ComplaintRecord): string {
  return [
    complaint.product,
    complaint.issue,
    complaint.subIssue ?? "",
    complaint.narrative
  ]
    .join(" ")
    .toLowerCase();
}

function selectReceipt(complaints: ComplaintRecord[]): ComplaintRecord | null {
  const isMultichannelHit = (c: ComplaintRecord) =>
    MULTICHANNEL_PAIN_PHRASES.some((p) => complaintText(c).includes(p));
  const isContactabilityHit = (c: ComplaintRecord) =>
    CONTACTABILITY_PAIN_PHRASES.some((p) => complaintText(c).includes(p));

  return (
    complaints.find((c) => c.narrative && isContactabilityHit(c)) ??
    complaints.find((c) => c.narrative && isMultichannelHit(c)) ??
    complaints.find((c) => c.narrative && isCollectionsRelevant(c)) ??
    complaints.find((c) => c.narrative) ??
    complaints[0] ??
    null
  );
}

function summarizeIssues(complaints: ComplaintRecord[]): string[] {
  const counts = new Map<string, number>();

  for (const complaint of complaints) {
    const key = [complaint.product, complaint.issue].filter(Boolean).join(": ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([issue, count]) => `${issue} (${count})`);
}

interface WhyNowArgs {
  target: TargetCompany;
  recentCount: number;
  spikePercent: number;
  issueSummary: string[];
  multichannelRate: number;
  contactabilityRate: number;
  complianceHeatRate: number;
}

function buildWhyNow(args: WhyNowArgs): string {
  const { target, recentCount, spikePercent, issueSummary } = args;
  const issueText =
    issueSummary.length > 0
      ? ` Top CFPB issue clusters: ${issueSummary.slice(0, 2).join("; ")}.`
      : "";

  const multichannelPct = Math.round(args.multichannelRate * 100);
  const contactabilityPct = Math.round(args.contactabilityRate * 100);
  const compliancePct = Math.round(args.complianceHeatRate * 100);

  const productAngle = pickProductAngle({
    multichannelPct,
    contactabilityPct,
    compliancePct
  });

  const spikeText =
    spikePercent > 0
      ? `up ${spikePercent}% vs the prior 90 days`
      : `holding ${recentCount.toLocaleString()} complaints in 90 days`;

  return `${target.displayName} has ${recentCount.toLocaleString()} CFPB complaints over the last 90 days, ${spikeText}. ${productAngle}${issueText}`;
}

function pickProductAngle({
  multichannelPct,
  contactabilityPct,
  compliancePct
}: {
  multichannelPct: number;
  contactabilityPct: number;
  compliancePct: number;
}): string {
  const top = [
    {
      label: `${contactabilityPct}% of borrowers explicitly say they could not reach the company`,
      value: contactabilityPct
    },
    {
      label: `${multichannelPct}% of borrower narratives reference failed calls, voicemails, or unanswered messages`,
      value: multichannelPct
    },
    {
      label: `${compliancePct}% of CFPB cases were flagged not-timely or unresolved`,
      value: compliancePct
    }
  ]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)[0];

  if (!top) {
    return "The signal is volume-led: enough sustained CFPB activity to justify automated outreach capacity.";
  }

  return `${top.label} - the exact gap Callbook's voice + WhatsApp + SMS + email orchestration is built to close.`;
}

interface PainArgs {
  multichannelRate: number;
  contactabilityRate: number;
  complianceHeatRate: number;
  voiceQualityRate: number;
  issueSummary: string[];
}

function buildPainHypothesis(args: PainArgs): string {
  if (args.contactabilityRate >= 0.2) {
    return "Right-party contact is the visible bottleneck. Callbook's multichannel orchestration (voice + WhatsApp + SMS + email) is positioned to lift contactability into the 50-70% band the product page advertises.";
  }

  if (args.multichannelRate >= 0.3) {
    return "Borrowers describe missed calls, dead voicemails, and unreplied messages. Callbook's AI voice agents and channel switching turn that load into automated cadence with audit-trail compliance.";
  }

  if (args.complianceHeatRate >= 0.05) {
    return "CFPB is already flagging untimely or unresolved responses. Callbook's SOC 2 compliance plus full call recording is a direct, regulator-defensible answer.";
  }

  if (args.voiceQualityRate >= 0.05) {
    return "Borrower complaints describe rude or unprofessional agent behavior. Callbook's 'indistinguishable from human' voice agents standardize tone, script, and escalation thresholds.";
  }

  return "Sustained complaint volume implies a high-cadence collections operation. Callbook's voice agents reduce the per-borrower contact cost while keeping human reps on exception cases.";
}

interface BuildProductMapArgs {
  multichannelRate: number;
  multichannelPhrases: string[];
  contactabilityRate: number;
  contactabilityPhrases: string[];
  voiceQualityRate: number;
  voiceQualityPhrases: string[];
  complianceHeatRate: number;
  recentCount: number;
  sampleSize: number;
}

function buildProductMap(args: BuildProductMapArgs): ProductMapEntry[] {
  const entries: ProductMapEntry[] = [
    {
      feature: "multichannel" as CallbookFeature,
      label: "Multichannel orchestration",
      description: `${Math.round(args.multichannelRate * 100)}% of borrower narratives reference failed calls, voicemails, or unanswered messages. Callbook orchestrates voice + WhatsApp + SMS + email so the next channel is automatic.`,
      matchRate: args.multichannelRate,
      matchCount: Math.round(args.multichannelRate * args.sampleSize),
      totalSampled: args.sampleSize,
      evidencePhrases: args.multichannelPhrases
    },
    {
      feature: "contactability" as CallbookFeature,
      label: "Right-party contactability (50-70%)",
      description: `${Math.round(args.contactabilityRate * 100)}% of borrowers explicitly say they could not reach the company. Callbook claims a 50-70% contactability band - this is the lender that needs it.`,
      matchRate: args.contactabilityRate,
      matchCount: Math.round(args.contactabilityRate * args.sampleSize),
      totalSampled: args.sampleSize,
      evidencePhrases: args.contactabilityPhrases
    },
    {
      feature: "compliance" as CallbookFeature,
      label: "SOC 2 + audit trail",
      description: `${Math.round(args.complianceHeatRate * 100)}% of CFPB responses for this lender were flagged not-timely or still in progress. Callbook is SOC 2 compliant and ships full call recording / audit trail by default.`,
      matchRate: args.complianceHeatRate,
      matchCount: Math.round(args.complianceHeatRate * args.sampleSize),
      totalSampled: args.sampleSize,
      evidencePhrases: []
    },
    {
      feature: "voice_quality" as CallbookFeature,
      label: "Voice agent quality",
      description: `${Math.round(args.voiceQualityRate * 100)}% of borrowers describe rude, scripted, or harassing agent behavior. Callbook's voice agents standardize tone and stay inside FDCPA / Reg F guardrails.`,
      matchRate: args.voiceQualityRate,
      matchCount: Math.round(args.voiceQualityRate * args.sampleSize),
      totalSampled: args.sampleSize,
      evidencePhrases: args.voiceQualityPhrases
    },
    {
      feature: "volume" as CallbookFeature,
      label: "Collections volume tier",
      description: `${args.recentCount.toLocaleString()} public complaints in 90 days implies enough call cadence that AI voice agent ROI compounds quickly. Callbook is built for this volume tier.`,
      matchRate: volumeFactor(args.recentCount),
      matchCount: args.recentCount,
      totalSampled: args.sampleSize,
      evidencePhrases: []
    }
  ];

  return entries
    .filter((entry) => entry.matchRate > 0 || entry.feature === "volume")
    .sort((a, b) => b.matchRate - a.matchRate);
}
