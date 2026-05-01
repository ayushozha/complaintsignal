import type { Lead } from "./types";

const DEFAULT_APIFY_API_BASE_URL = "https://api.apify.com/v2";
const DEFAULT_GOOGLE_SEARCH_ACTOR = "apify~google-search-scraper";
const DEFAULT_RESULTS_PER_PAGE = 5;
const DEFAULT_MAX_PAGES = 1;
const DEFAULT_TIMEOUT_SECONDS = 60;

export interface ApifySearchEvidence {
  query: string;
  title: string;
  url: string;
  description: string;
  position: number | null;
}

type UnknownRecord = Record<string, unknown>;

export function hasApifyConfig(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN);
}

export function buildLeadSearchQuery(lead: Lead): string {
  const issue =
    cleanIssueLabel(lead.issueSummary[0]) ??
    lead.receipt?.issue ??
    "CFPB complaints";

  return [
    `"${lead.company}"`,
    "CFPB complaint",
    `"${issue}"`,
    "collections",
    "payment",
    "customer service"
  ].join(" ");
}

export async function fetchLeadSearchEvidence(
  lead: Lead
): Promise<ApifySearchEvidence[]> {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    throw new Error("APIFY_API_TOKEN is not set.");
  }

  const query = buildLeadSearchQuery(lead);
  const actorId = normalizeActorId(
    process.env.APIFY_GOOGLE_SEARCH_ACTOR || DEFAULT_GOOGLE_SEARCH_ACTOR
  );
  const timeoutSeconds = readPositiveInteger(
    process.env.APIFY_SEARCH_TIMEOUT_SECONDS,
    DEFAULT_TIMEOUT_SECONDS
  );
  const resultsPerPage = readPositiveInteger(
    process.env.APIFY_SEARCH_RESULTS_PER_PAGE,
    DEFAULT_RESULTS_PER_PAGE
  );
  const maxPages = readPositiveInteger(
    process.env.APIFY_SEARCH_MAX_PAGES,
    DEFAULT_MAX_PAGES
  );

  const url = new URL(
    `/v2/acts/${actorId}/run-sync-get-dataset-items`,
    process.env.APIFY_API_BASE_URL || DEFAULT_APIFY_API_BASE_URL
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("clean", "true");
  url.searchParams.set("timeout", String(timeoutSeconds));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      queries: query,
      countryCode: "us",
      languageCode: "en",
      searchLanguage: "en",
      resultsPerPage,
      maxPagesPerQuery: maxPages,
      forceExactMatch: false
    }),
    cache: "no-store",
    signal: AbortSignal.timeout((timeoutSeconds + 10) * 1000)
  });

  if (!response.ok) {
    throw new Error(
      `Apify search failed with ${response.status} ${response.statusText}.`
    );
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Apify search returned an unexpected payload.");
  }

  return normalizeSearchItems(query, payload).slice(0, resultsPerPage);
}

function normalizeActorId(value: string): string {
  return value.trim().replace("/", "~");
}

function cleanIssueLabel(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/\s+\(\d+\)\s*$/, "").trim() || null;
}

function normalizeSearchItems(
  query: string,
  items: unknown[]
): ApifySearchEvidence[] {
  const flattened: UnknownRecord[] = [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    const organicResults = item.organicResults;
    if (Array.isArray(organicResults)) {
      for (const result of organicResults) {
        if (isRecord(result)) {
          flattened.push({
            ...result,
            query: readQuery(item) ?? query
          });
        }
      }
      continue;
    }

    flattened.push(item);
  }

  return flattened
    .map((item, index): ApifySearchEvidence | null => {
      const title = readString(item.title) ?? readString(item.name);
      const url =
        readString(item.url) ??
        readString(item.link) ??
        readString(item.href) ??
        readString(item.displayedUrl);
      const description =
        readString(item.description) ??
        readString(item.snippet) ??
        readString(item.text) ??
        "";

      if (!title || !url) {
        return null;
      }

      return {
        query: readQuery(item) ?? query,
        title,
        url,
        description,
        position:
          readNumber(item.position) ??
          readNumber(item.rank) ??
          readNumber(item.index) ??
          index + 1
      };
    })
    .filter((item): item is ApifySearchEvidence => Boolean(item));
}

function readQuery(item: UnknownRecord): string | null {
  const searchQuery = item.searchQuery;
  if (typeof searchQuery === "string") {
    return searchQuery;
  }

  if (isRecord(searchQuery)) {
    return (
      readString(searchQuery.term) ??
      readString(searchQuery.query) ??
      readString(searchQuery.searchQuery)
    );
  }

  return readString(item.query);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
