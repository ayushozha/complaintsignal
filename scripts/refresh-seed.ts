import { buildLeadDataset } from "../src/lib/lead-service";
import { saveSeedDataset, seedPath } from "../src/lib/seed-store";

const dataset = await buildLeadDataset();
await saveSeedDataset(dataset);

console.log(`Saved ${dataset.leads.length} leads to ${seedPath()}`);
console.log(
  dataset.leads
    .map((lead) => `${lead.leadScore.toString().padStart(3, " ")} ${lead.company}`)
    .join("\n")
);
