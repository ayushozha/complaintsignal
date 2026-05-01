import type {
  ComplaintRecord,
  ComplaintWindow,
  DateWindow,
  TargetCompany
} from "./types";

const CFPB_ENDPOINT =
  "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/";

const RECENT_COMPLAINT_SAMPLE_SIZE = 30;
const PRIOR_COMPLAINT_SAMPLE_SIZE = 10;
const MAX_NARRATIVE_CHARS = 1600;

interface CfpbHit {
  _id: string;
  _source: {
    company?: string;
    product?: string;
    issue?: string;
    sub_issue?: string | null;
    complaint_what_happened?: string;
    date_received?: string;
    timely?: string;
    company_response?: string | null;
    submitted_via?: string | null;
    state?: string | null;
    tags?: string | null;
    has_narrative?: boolean;
    complaint_id?: string;
  };
}

interface CfpbSearchResponse {
  hits?: {
    total?: number | { value?: number; relation?: string };
    hits?: CfpbHit[];
  };
}

export function buildDateWindows(now = new Date()): {
  recent: DateWindow;
  previous: DateWindow;
} {
  const end = startOfDayUtc(now);
  const recentStart = addDays(end, -90);
  const previousEnd = addDays(recentStart, -1);
  const previousStart = addDays(previousEnd, -90);

  return {
    recent: {
      start: toIsoDate(recentStart),
      end: toIsoDate(end)
    },
    previous: {
      start: toIsoDate(previousStart),
      end: toIsoDate(previousEnd)
    }
  };
}

export function buildCfpbUrl(target: TargetCompany, window?: DateWindow): string {
  const params = new URLSearchParams({
    search_term: target.cfpbSearchTerm,
    field: "company",
    size: String(RECENT_COMPLAINT_SAMPLE_SIZE),
    sort: "created_date_desc",
    no_aggs: "true"
  });

  if (window) {
    params.set("date_received_min", window.start);
    params.set("date_received_max", window.end);
  }

  return `${CFPB_ENDPOINT}?${params.toString()}`;
}

export async function fetchComplaintWindow(
  target: TargetCompany,
  window: DateWindow,
  sampleSize = RECENT_COMPLAINT_SAMPLE_SIZE,
  options: { preferNarratives?: boolean } = {}
): Promise<ComplaintWindow> {
  if (options.preferNarratives) {
    const [countBody, narrativeBody] = await Promise.all([
      fetchCfpbSearch(target, window, 0),
      fetchCfpbSearch(target, window, sampleSize, { hasNarrative: true })
    ]);

    const narrativeHits = narrativeBody.hits?.hits ?? [];

    return {
      start: window.start,
      end: window.end,
      count: readTotal(countBody),
      complaints: narrativeHits.map(normalizeComplaint)
    };
  }

  const body = await fetchCfpbSearch(target, window, sampleSize);
  const hits = body.hits?.hits ?? [];

  return {
    start: window.start,
    end: window.end,
    count: readTotal(body),
    complaints: hits.map(normalizeComplaint)
  };
}

async function fetchCfpbSearch(
  target: TargetCompany,
  window: DateWindow,
  sampleSize: number,
  options: { hasNarrative?: boolean } = {}
): Promise<CfpbSearchResponse> {
  const params = new URLSearchParams({
    search_term: target.cfpbSearchTerm,
    field: "company",
    date_received_min: window.start,
    date_received_max: window.end,
    size: String(sampleSize),
    sort: "created_date_desc",
    no_aggs: "true"
  });

  if (options.hasNarrative) {
    params.set("has_narrative", "true");
  }

  const response = await fetch(`${CFPB_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `CFPB request failed for ${target.displayName}: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as CfpbSearchResponse;
}

export async function fetchLeadWindows(
  target: TargetCompany,
  windows = buildDateWindows()
): Promise<{ recent: ComplaintWindow; previous: ComplaintWindow }> {
  const [recent, previous] = await Promise.all([
    fetchComplaintWindow(target, windows.recent, RECENT_COMPLAINT_SAMPLE_SIZE, {
      preferNarratives: true
    }),
    fetchComplaintWindow(target, windows.previous, PRIOR_COMPLAINT_SAMPLE_SIZE)
  ]);

  return { recent, previous };
}

function readTotal(body: CfpbSearchResponse): number {
  const total = body.hits?.total;

  if (typeof total === "number") {
    return total;
  }

  return total?.value ?? 0;
}

function normalizeComplaint(hit: CfpbHit): ComplaintRecord {
  const source = hit._source;
  const narrative = source.complaint_what_happened?.trim() ?? "";

  return {
    id: source.complaint_id ?? hit._id,
    company: source.company ?? "Unknown company",
    product: source.product ?? "Unknown product",
    issue: source.issue ?? "Unknown issue",
    subIssue: source.sub_issue ?? null,
    narrative:
      narrative.length > MAX_NARRATIVE_CHARS
        ? `${narrative.slice(0, MAX_NARRATIVE_CHARS).trim()}...`
        : narrative,
    dateReceived: source.date_received ?? "",
    timely: normalizeTimely(source.timely),
    companyResponse: source.company_response ?? null,
    submittedVia: source.submitted_via ?? null,
    state: source.state ?? null,
    tags: source.tags ?? null,
    hasNarrative: Boolean(source.has_narrative || narrative)
  };
}

function normalizeTimely(value: string | undefined): "Yes" | "No" | "Unknown" {
  if (value === "Yes" || value === "No") {
    return value;
  }

  return "Unknown";
}

function startOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
