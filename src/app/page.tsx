import { ComplaintSignalApp } from "@/components/complaint-signal-app";
import { loadSeedDataset } from "@/lib/seed-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dataset = await loadSeedDataset();

  return <ComplaintSignalApp initialDataset={dataset} />;
}
