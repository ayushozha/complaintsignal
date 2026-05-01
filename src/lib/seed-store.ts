import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LeadDataset } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SEED_PATH = path.join(DATA_DIR, "seed.json");

export async function loadSeedDataset(): Promise<LeadDataset | null> {
  try {
    const raw = await readFile(SEED_PATH, "utf8");
    return JSON.parse(raw) as LeadDataset;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function saveSeedDataset(dataset: LeadDataset): Promise<string> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SEED_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  return SEED_PATH;
}

export function seedPath(): string {
  return SEED_PATH;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
