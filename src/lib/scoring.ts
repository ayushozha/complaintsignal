import { buildCfpbUrl } from "./cfpb";
import type {
  ComplaintRecord,
  ComplaintWindow,
  Lead,
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

const SUPPORT_PAIN_KEYWORDS = [
  "called",
  "call",
  "phone",
  "no one",
  "nobody",
  "hold",
  "wait",
  "unable to reach",
  "could not reach",
  "couldn't reach",
  "never received",
  "no response",
  "representative",
  "customer service",
  "escalate",
  "harass"
];

export function scoreLead(
  target: TargetCompany,
  recent: ComplaintWindow,
  previous: ComplaintWindow
): Lead {
  const spikePercent = calculateSpikePercent(recent.count, previous.count);
  const complaintSpike = scoreComplaintSpike(spikePercent, recent.count);
  const collectionsRelevance = scoreCollectionsRelevance(recent.complaints);
  const supportPain = scoreSupportPain(recent.complaints);
  const slowResponse = scoreSlowResponse(recent.complaints);

  const breakdown = {
    complaintSpike,
    collectionsRelevance,
    supportPain,
    slowResponse,
    industryFit: target.industryFit
  };

  const leadScore = Math.min(
    100,
    Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  );

  const receipt = selectReceipt(recent.complaints);
  const issueSummary = summarizeIssues(recent.complaints);

  return {
    id: target.id,
    company: target.displayName,
    cfpbSearchTerm: target.cfpbSearchTerm,
    segment: target.segment,
    decisionMaker: target.decisionMaker,
    leadScore,
    spikePercent,
    recentCount: recent.count,
    previousCount: previous.count,
    breakdown,
    whyNow: buildWhyNow(target, recent.count, previous.count, spikePercent, issueSummary),
    painHypothesis: buildPainHypothesis(recent.complaints, issueSummary),
    issueSummary,
    receipt,
    recentComplaints: recent.complaints,
    previousComplaints: previous.complaints,
    cfpbUrl: buildCfpbUrl(target, {
      start: recent.start,
      end: recent.end
    })
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

  const spikeScore = spikePercent > 0 ? Math.round((spikePercent / 100) * 35) : 0;
  const volumePressure = Math.round(
    Math.min(25, (Math.log10(recentCount + 1) / Math.log10(7000)) * 25)
  );

  return Math.min(35, Math.max(spikeScore, volumePressure));
}

function scoreCollectionsRelevance(complaints: ComplaintRecord[]): number {
  if (complaints.length === 0) {
    return 0;
  }

  const relevant = complaints.filter(isCollectionsRelevant).length;
  return Math.round((relevant / complaints.length) * 25);
}

function scoreSupportPain(complaints: ComplaintRecord[]): number {
  if (complaints.length === 0) {
    return 0;
  }

  const painful = complaints.filter(hasSupportPain).length;
  return Math.round((painful / complaints.length) * 20);
}

function scoreSlowResponse(complaints: ComplaintRecord[]): number {
  if (complaints.length === 0) {
    return 0;
  }

  const notTimely = complaints.filter((complaint) => complaint.timely === "No").length;
  return Math.round((notTimely / complaints.length) * 10);
}

function isCollectionsRelevant(complaint: ComplaintRecord): boolean {
  const haystack = complaintText(complaint);
  return COLLECTIONS_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function hasSupportPain(complaint: ComplaintRecord): boolean {
  const haystack = complaintText(complaint);
  return SUPPORT_PAIN_KEYWORDS.some((keyword) => haystack.includes(keyword));
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
  return (
    complaints.find((complaint) => complaint.narrative && hasSupportPain(complaint)) ??
    complaints.find((complaint) => complaint.narrative && isCollectionsRelevant(complaint)) ??
    complaints.find((complaint) => complaint.narrative) ??
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

function buildWhyNow(
  target: TargetCompany,
  recentCount: number,
  previousCount: number,
  spikePercent: number,
  issueSummary: string[]
): string {
  const issueText =
    issueSummary.length > 0
      ? ` Top CFPB issue clusters: ${issueSummary.join("; ")}.`
      : "";

  if (spikePercent > 0) {
    return `${target.displayName} has ${recentCount} CFPB complaints in the last 90 days, up ${spikePercent}% from the prior 90-day window.${issueText}`;
  }

  return `${target.displayName} still has ${recentCount} fresh CFPB complaints in the last 90 days, creating a visible servicing signal even without a positive quarter-over-quarter spike.${issueText}`;
}

function buildPainHypothesis(
  complaints: ComplaintRecord[],
  issueSummary: string[]
): string {
  if (complaints.some(hasSupportPain)) {
    return "Borrower support appears strained around payment, escalation, and response workflows; Callbook can position voice agents as capacity relief for follow-up and routing.";
  }

  if (issueSummary.some((issue) => issue.toLowerCase().includes("payment"))) {
    return "Payment and servicing complaints suggest manual follow-up load that can be reduced with AI voice reminders, routing, and borrower status checks.";
  }

  return "The public complaint pattern suggests servicing friction that can be converted into a timely operations conversation.";
}
