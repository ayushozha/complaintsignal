export interface TargetCompany {
  id: string;
  displayName: string;
  cfpbSearchTerm: string;
  segment: string;
  decisionMaker: string;
  industryFit: number;
}

export interface DateWindow {
  start: string;
  end: string;
}

export interface ComplaintRecord {
  id: string;
  company: string;
  product: string;
  issue: string;
  subIssue: string | null;
  narrative: string;
  dateReceived: string;
  timely: "Yes" | "No" | "Unknown";
  companyResponse: string | null;
  submittedVia: string | null;
  state: string | null;
  tags: string | null;
  hasNarrative: boolean;
}

export interface ComplaintWindow {
  start: string;
  end: string;
  count: number;
  complaints: ComplaintRecord[];
}

export interface SignalBreakdown {
  complaintSpike: number;
  collectionsRelevance: number;
  multichannelPain: number;
  contactabilityPain: number;
  complianceHeat: number;
  callbookFit: number;
}

export type CallbookFeature =
  | "multichannel"
  | "contactability"
  | "compliance"
  | "voice_quality"
  | "volume";

export interface ProductMapEntry {
  feature: CallbookFeature;
  label: string;
  description: string;
  matchRate: number;
  matchCount: number;
  totalSampled: number;
  evidencePhrases: string[];
}

export interface CallbookProductMap {
  entries: ProductMapEntry[];
}

export interface Lead {
  id: string;
  company: string;
  cfpbSearchTerm: string;
  segment: string;
  decisionMaker: string;
  leadScore: number;
  callbookFit: number;
  spikePercent: number;
  recentCount: number;
  previousCount: number;
  breakdown: SignalBreakdown;
  whyNow: string;
  painHypothesis: string;
  issueSummary: string[];
  receipt: ComplaintRecord | null;
  recentComplaints: ComplaintRecord[];
  previousComplaints: ComplaintRecord[];
  cfpbUrl: string;
  productMap: CallbookProductMap;
  multichannelPainRate: number;
  contactabilityPainRate: number;
  complianceHeatRate: number;
  debtCollectionShare: number;
}

export interface LeadDataset {
  generatedAt: string;
  dateWindows: {
    recent: DateWindow;
    previous: DateWindow;
  };
  leads: Lead[];
}

export interface OutreachPack {
  lead_score: number;
  why_now: string;
  pain_hypothesis: string;
  callbook_angle: string;
  decision_maker: string;
  email: {
    subject: string;
    body: string;
  };
  linkedin_dm: string;
  call_script_30s: string;
  voice_pitch_script: string;
  crm_note: string;
}
