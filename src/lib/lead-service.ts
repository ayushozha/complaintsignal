import { buildDateWindows, fetchLeadWindows } from "./cfpb";
import { scoreLead } from "./scoring";
import { TARGET_COMPANIES } from "./targets";
import type { LeadDataset, TargetCompany } from "./types";

const CONCURRENCY = 3;

export async function buildLeadDataset(now = new Date()): Promise<LeadDataset> {
  const dateWindows = buildDateWindows(now);
  const leads = await mapWithConcurrency(
    TARGET_COMPANIES,
    CONCURRENCY,
    async (target) => {
      const windows = await fetchLeadWindows(target, dateWindows);
      return scoreLead(target, windows.recent, windows.previous);
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    dateWindows,
    leads: leads.sort((a, b) => b.leadScore - a.leadScore)
  };
}

export function findLead(dataset: LeadDataset, leadId: string) {
  return dataset.leads.find((lead) => lead.id === leadId);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items.entries()];

  async function worker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        return;
      }

      const [index, item] = next;
      results[index] = await mapper(item);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    )
  );

  return results;
}

export function getTargetById(id: string): TargetCompany | undefined {
  return TARGET_COMPANIES.find((target) => target.id === id);
}
