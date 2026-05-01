"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  Loader2,
  Mail,
  MessageCircle,
  Mic2,
  Phone,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Volume2,
  Waves
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lead, LeadDataset, OutreachPack } from "@/lib/types";

type DatasetPayload = LeadDataset & {
  source?: "seed" | "live";
};

type PackApiResponse = {
  pack: OutreachPack;
  source: "apify" | "openai" | "template";
  model: string;
  warning?: string;
};

type PackTab = "email" | "linkedin" | "call" | "crm";
type StatusTone = "idle" | "ok" | "warn" | "error";

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

export function ComplaintSignalApp({
  initialDataset
}: {
  initialDataset: LeadDataset | null;
}) {
  const [dataset, setDataset] = useState<DatasetPayload | null>(
    initialDataset ? { ...initialDataset, source: "seed" } : null
  );
  const [selectedLeadId, setSelectedLeadId] = useState(
    initialDataset?.leads[0]?.id ?? ""
  );
  const [pack, setPack] = useState<OutreachPack | null>(null);
  const [packTab, setPackTab] = useState<PackTab>("email");
  const [packSource, setPackSource] = useState<PackApiResponse["source"] | null>(
    null
  );
  const [loadingPack, setLoadingPack] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    tone: StatusTone;
    message: string;
  }>({ tone: "idle", message: "seed data loaded" });
  const audioRef = useRef<HTMLAudioElement>(null);

  const selectedLead = useMemo(() => {
    return (
      dataset?.leads.find((lead) => lead.id === selectedLeadId) ??
      dataset?.leads[0] ??
      null
    );
  }, [dataset, selectedLeadId]);

  const totals = useMemo(() => {
    const leads = dataset?.leads ?? [];
    const recent = leads.reduce((sum, lead) => sum + lead.recentCount, 0);
    const averageScore =
      leads.length > 0
        ? Math.round(leads.reduce((sum, lead) => sum + lead.leadScore, 0) / leads.length)
        : 0;

    return {
      leads: leads.length,
      recent,
      averageScore,
      topScore: leads[0]?.leadScore ?? 0,
      hot: leads.filter((lead) => lead.leadScore >= 60).length
    };
  }, [dataset]);

  useEffect(() => {
    return () => {
      if (voiceUrl) {
        URL.revokeObjectURL(voiceUrl);
      }
    };
  }, [voiceUrl]);

  function selectLead(id: string) {
    setSelectedLeadId(id);
    resetGeneratedState();
    setStatus({ tone: "idle", message: "lead selected" });
  }

  function resetGeneratedState() {
    setPack(null);
    setPackSource(null);
    setVoiceUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }

  async function refreshLeads() {
    setRefreshing(true);
    setStatus({ tone: "idle", message: "refreshing CFPB signals" });

    try {
      const response = await fetch("/api/leads?refresh=true", {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`Refresh failed with ${response.status}`);
      }

      const nextDataset = (await response.json()) as DatasetPayload;
      setDataset(nextDataset);
      if (!nextDataset.leads.some((lead) => lead.id === selectedLeadId)) {
        setSelectedLeadId(nextDataset.leads[0]?.id ?? "");
        resetGeneratedState();
      }
      setStatus({
        tone: "ok",
        message: `loaded ${nextDataset.leads.length} live leads`
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "refresh failed"
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function generatePack() {
    if (!selectedLead) {
      return;
    }

    setLoadingPack(true);
    setStatus({ tone: "idle", message: "generating outbound pack" });

    try {
      const response = await fetch("/api/outreach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ leadId: selectedLead.id })
      });

      if (!response.ok) {
        throw new Error(`Outreach request failed with ${response.status}`);
      }

      const result = (await response.json()) as PackApiResponse;
      setPack(result.pack);
      setPackSource(result.source);
      setPackTab("email");
      setStatus({
        tone: result.warning ? "warn" : "ok",
        message:
          result.warning ??
          `generated with ${formatPackSource(result.source, result.model)}`
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "outreach generation failed"
      });
    } finally {
      setLoadingPack(false);
    }
  }

  async function generateVoice() {
    if (!selectedLead) {
      return;
    }

    const script =
      pack?.voice_pitch_script ??
      `Hi, this is Callbook. ${selectedLead.whyNow} Callbook voice agents can handle borrower follow-up, payment reminders, and routing while your team focuses on higher judgment cases.`;

    setVoiceLoading(true);
    setStatus({ tone: "idle", message: "rendering voice pitch" });

    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: script,
          filename: `${selectedLead.id}-callbook-pitch.wav`
        })
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.includes("application/json")) {
        const body = (await response.json()) as {
          fallback?: string;
          error?: { code?: string; message?: string };
        };

        if (body.fallback === "browser_speech") {
          playBrowserFallback(script);
          setStatus({
            tone: "warn",
            message: "browser voice fallback active; add ElevenLabs key for stage audio"
          });
          return;
        }
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;

        throw new Error(body?.error?.message ?? `Voice request failed with ${response.status}`);
      }

      const blob = await response.blob();
      const nextUrl = URL.createObjectURL(blob);
      setVoiceUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return nextUrl;
      });
      setStatus({ tone: "ok", message: "voice pitch ready" });

      window.setTimeout(() => audioRef.current?.play().catch(() => null), 50);
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "voice generation failed"
      });
    } finally {
      setVoiceLoading(false);
    }
  }

  function playBrowserFallback(script: string) {
    if (!("speechSynthesis" in window)) {
      throw new Error("No voice playback engine is available in this browser.");
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.93;
    utterance.pitch = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  async function copyText(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1500);
  }

  if (!dataset || !selectedLead) {
    return (
      <main className="min-h-screen bg-[var(--bg)] p-5 text-[var(--text)]">
        <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
          <div className="rounded-[10px] border border-[var(--ink)] bg-white p-6 shadow-[4px_4px_0_var(--ink)]">
            <p className="font-mono text-sm">Run npm run seed:cfpb.</p>
          </div>
        </div>
      </main>
    );
  }

  const activeText = getPackText(pack, packTab);
  const dateRange = `${formatDate(dataset.dateWindows.recent.start)} - ${formatDate(
    dataset.dateWindows.recent.end
  )}`;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1240px] px-4 py-4 sm:px-6 lg:px-8">
        <Landing
          source={dataset.source ?? "seed"}
          topLead={selectedLead}
          onViewSignals={() => document.getElementById("signal-board")?.scrollIntoView({ behavior: "smooth" })}
        />

        <ScreenLabel id="signal-board" label="screen 02 -- dashboard / signal board" />
        <section className="rounded-[10px] border border-[var(--ink)] bg-white p-3 shadow-[4px_4px_0_var(--ink)]">
          <div className="flex flex-col gap-3 border-b border-[var(--ink)] pb-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <BrandMark />
              <span className="font-mono text-sm">complaintsignal</span>
              <span className="font-mono text-xs text-[var(--muted)]">/ signal board</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={status.tone} message={status.message} />
              <button
                type="button"
                onClick={refreshLeads}
                disabled={refreshing}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--ink)] bg-[var(--paper)] px-3 font-mono text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--lemon)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh signals
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip active>90d window</FilterChip>
            <FilterChip>debt collection</FilterChip>
            <FilterChip>vehicle loan</FilterChip>
            <FilterChip>consumer loan</FilterChip>
            <FilterChip>+ add</FilterChip>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Metric label="active leads" value={totals.leads} delta="+3 this week" icon={<Database size={16} />} />
            <Metric label="hot (60+)" value={totals.hot} delta="+2 since Mon" icon={<Sparkles size={16} />} />
            <Metric label="complaints tracked" value={numberFormatter.format(totals.recent)} delta="+18% WoW" icon={<FileText size={16} />} />
            <Metric label="avg score" value={totals.averageScore} delta="ranked / 100" icon={<Gauge size={16} />} />
          </div>

          <LeadTable
            leads={dataset.leads}
            selectedLeadId={selectedLead.id}
            onSelect={selectLead}
          />
        </section>

        <ScreenLabel id="lead-detail" label="screen 03 -- lead detail" />
        <LeadDetail lead={selectedLead} dateRange={dateRange} />

        <ScreenLabel id="outreach-pack" label="screen 04 -- outreach pack" />
        <OutreachPackSection
          lead={selectedLead}
          pack={pack}
          packTab={packTab}
          packSource={packSource}
          loadingPack={loadingPack}
          voiceLoading={voiceLoading}
          voiceUrl={voiceUrl}
          copiedKey={copiedKey}
          audioRef={audioRef}
          activeText={activeText}
          onGeneratePack={generatePack}
          onGenerateVoice={generateVoice}
          onChangeTab={setPackTab}
          onCopy={copyText}
        />
      </div>
    </main>
  );
}

function Landing({
  source,
  topLead,
  onViewSignals
}: {
  source: string;
  topLead: Lead;
  onViewSignals: () => void;
}) {
  return (
    <section className="pb-10">
      <ScreenLabel label="screen 01 -- landing" />
      <nav className="flex flex-col gap-3 rounded-[10px] border border-[var(--ink)] bg-white p-3 text-[var(--ink)] shadow-[4px_4px_0_var(--ink)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="font-mono text-sm">complaintsignal</span>
          <span className="rounded border border-[var(--ink)] px-2 py-1 font-mono text-xs">{source}</span>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <a href="#signal-board" className="hover:text-[var(--rose)]">Product</a>
          <a href="#lead-detail" className="hover:text-[var(--rose)]">How it works</a>
          <a href="#outreach-pack" className="hover:text-[var(--rose)]">Pricing</a>
          <button
            type="button"
            onClick={onViewSignals}
            className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--rose)]"
          >
            Open dashboard
          </button>
        </div>
      </nav>

      <div className="grid gap-8 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-end xl:gap-12">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--rose)]">
            For Callbook AE teams
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.9] text-[var(--ink)] sm:text-7xl xl:text-8xl">
            Find Buyers Bleeding In Public This Week
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            ComplaintSignal turns CFPB consumer complaints into a ranked pipeline of fintechs with fresh collections pain, paired with a ready-to-send outreach pack.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onViewSignals}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--ink)] bg-[var(--ink)] px-5 font-mono text-sm font-semibold text-white shadow-[3px_3px_0_var(--rose)] transition hover:-translate-y-0.5"
            >
              View today&apos;s signals <ArrowRight size={16} />
            </button>
            <a href="#outreach-pack" className="font-mono text-sm font-semibold text-[var(--ink)] hover:text-[var(--rose)]">
              See sample lead
            </a>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-2">
            <HeroProof label="CFPB feed" value={numberFormatter.format(topLead.recentCount)} />
            <HeroProof label="Lead score" value={topLead.leadScore} />
            <HeroProof label="Pack time" value="< 30s" />
          </div>
        </div>

        <HeroSignalVisual lead={topLead} />
      </div>
    </section>
  );
}

function HeroProof({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[var(--ink)] bg-white px-3 py-3 shadow-[2px_2px_0_var(--ink)]">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-[var(--ink)]">{value}</div>
    </div>
  );
}

function HeroSignalVisual({ lead }: { lead: Lead }) {
  const issue = lead.issueSummary[0] ?? "Payment friction";
  const scorePercent = Math.max(0, Math.min(100, lead.leadScore));

  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-[14px] border border-[var(--ink)] bg-white p-4 shadow-[6px_6px_0_var(--ink)] sm:p-5">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,17,17,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(17,17,17,0.045)_1px,transparent_1px)] bg-[size:34px_34px]" />
      <div className="relative flex items-center justify-between border-b border-[var(--ink)] pb-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            live buyer-signal cockpit
          </p>
          <h2 className="mt-2 text-3xl font-black leading-none">{lead.company}</h2>
        </div>
        <div className="rounded-md bg-[var(--rose)] px-4 py-3 text-center text-white shadow-[3px_3px_0_var(--ink)]">
          <div className="text-4xl font-black">{lead.leadScore}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em]">score</div>
        </div>
      </div>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-[10px] border border-[var(--ink)] bg-[var(--paper)] p-4 shadow-[4px_4px_0_var(--ink)]">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                public pain
              </p>
              <FileText size={16} className="text-[var(--rose)]" />
            </div>
            <p className="mt-3 text-sm font-bold leading-6">{lead.whyNow}</p>
          </div>

          <div className="rounded-[10px] border border-[var(--ink)] bg-white p-4 shadow-[4px_4px_0_var(--ink)]">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                apify evidence
              </p>
              <Sparkles size={16} className="text-[var(--blue)]" />
            </div>
            <div className="mt-4 rounded-md border border-[var(--ink)] bg-[var(--mint)] p-3">
              <p className="font-mono text-xs font-bold">"{lead.company}" CFPB complaint</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Search result context, public complaint receipts, issue clusters, and buyer timing.
              </p>
            </div>
          </div>
        </div>

        <div className="relative rounded-[12px] border border-[var(--ink)] bg-[var(--paper)] p-4 shadow-[4px_4px_0_var(--ink)]">
          <div className="absolute -right-4 top-9 hidden h-24 w-24 rotate-12 rounded-[14px] border border-[var(--ink)] bg-[var(--lemon)] shadow-[4px_4px_0_var(--ink)] md:block" />
          <div className="relative grid gap-4 sm:grid-cols-[150px_1fr]">
            <div className="grid place-items-center rounded-[10px] border border-[var(--ink)] bg-white p-4">
              <div
                className="grid h-28 w-28 place-items-center rounded-full border border-[var(--ink)]"
                style={{
                  background: `conic-gradient(var(--rose) ${scorePercent}%, #dfe6ee ${scorePercent}% 100%)`
                }}
              >
                <div className="grid h-20 w-20 place-items-center rounded-full border border-[var(--ink)] bg-white text-center">
                  <span className="text-3xl font-black">{lead.leadScore}</span>
                </div>
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                intent score
              </p>
            </div>

            <div className="rounded-[10px] border border-[var(--ink)] bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  90d spike
                </p>
                <BarChart3 size={16} className="text-[var(--blue)]" />
              </div>
              <div className="mt-4 flex h-28 items-end gap-2">
                {[34, 48, 41, 62, 58, 76, 92].map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-t border border-[var(--ink)] bg-[var(--rose)]"
                    style={{ height: `${height}%`, opacity: 0.42 + index * 0.08 }}
                  />
                ))}
              </div>
              <p className="mt-3 font-mono text-xs font-bold text-[var(--rose)]">
                {formatSpike(lead.spikePercent)} vs prior window
              </p>
            </div>
          </div>

          <div className="relative mt-4 rounded-[10px] border border-[var(--ink)] bg-white p-4">
            <div className="flex items-center gap-2">
              <Waves size={16} className="text-[var(--rose)]" />
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                voice-ready pack
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SignalTile icon={<Mail size={15} />} label="email" />
              <SignalTile icon={<MessageCircle size={15} />} label="dm" />
              <SignalTile icon={<Mic2 size={15} />} label="call" />
            </div>
          </div>

          <div className="relative mt-4 rounded-[10px] border border-[var(--ink)] bg-[var(--ink)] p-4 text-white shadow-[4px_4px_0_var(--rose)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
              top issue
            </p>
            <p className="mt-2 text-sm font-bold leading-5">{issue}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalTile({
  icon,
  label
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-md border border-[var(--ink)] bg-[var(--panel)] px-3 py-3 font-mono text-xs font-bold uppercase">
      {icon}
      {label}
    </div>
  );
}

function LeadTable({
  leads,
  selectedLeadId,
  onSelect
}: {
  leads: Lead[];
  selectedLeadId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--ink)]">
      <div className="grid grid-cols-[42px_1.5fr_0.65fr_0.65fr_1.3fr_42px] bg-[var(--ink)] px-3 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white max-md:hidden">
        <span>#</span>
        <span>Company</span>
        <span>Spike</span>
        <span>Score</span>
        <span>Top issue</span>
        <span />
      </div>
      <div>
        {leads.map((lead, index) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => onSelect(lead.id)}
            className={`grid w-full grid-cols-[42px_1fr_44px] gap-3 border-t border-[var(--ink)] px-3 py-3 text-left transition md:grid-cols-[42px_1.5fr_0.65fr_0.65fr_1.3fr_42px] md:items-center ${
              selectedLeadId === lead.id
                ? "bg-[var(--selected)]"
                : "bg-white hover:bg-[var(--paper)]"
            }`}
          >
            <span className="font-mono text-xs">0{index + 1}</span>
            <span>
              <span className="block text-sm font-black">{lead.company}</span>
              <span className="font-mono text-xs text-[var(--muted)]">
                {lead.segment} - {numberFormatter.format(lead.recentCount)} / 90d
              </span>
            </span>
            <span className="font-mono text-sm font-bold text-[var(--rose)] max-md:hidden">
              {formatSpike(lead.spikePercent)}
            </span>
            <span className="w-fit rounded-md bg-[var(--score)] px-3 py-1 font-mono text-xs font-bold text-white">
              {lead.leadScore}
            </span>
            <span className="text-sm text-[var(--muted)] max-md:hidden">
              {lead.issueSummary[0] ?? "Complaint pattern"}
            </span>
            <ArrowRight size={16} className="justify-self-end" />
          </button>
        ))}
      </div>
    </div>
  );
}

function LeadDetail({ lead, dateRange }: { lead: Lead; dateRange: string }) {
  const receiptText =
    lead.receipt?.narrative ||
    `${lead.receipt?.product ?? "Complaint"}: ${lead.receipt?.issue ?? "No narrative published"}`;

  return (
    <section className="space-y-4">
      <div className="rounded-[10px] border border-[var(--ink)] bg-white p-5 shadow-[4px_4px_0_var(--ink)]">
        <div className="grid gap-4 md:grid-cols-[1fr_120px] md:items-center">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              Rank 01 - {lead.segment}
            </p>
            <h2 className="mt-2 text-4xl font-black leading-none">{lead.company}</h2>
            <p className="mt-2 font-mono text-sm text-[var(--muted)]">
              {numberFormatter.format(lead.recentCount)} complaints / 90d - {dateRange} - {formatSpike(lead.spikePercent)}
            </p>
          </div>
          <div className="rounded-md border border-[var(--ink)] bg-[var(--rose)] p-3 text-center text-white">
            <div className="text-4xl font-black">{lead.leadScore}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em]">lead score</div>
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-[var(--ink)] bg-white p-5 shadow-[4px_4px_0_var(--ink)]">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Why now</p>
        <p className="mt-3 text-lg font-bold leading-7">{lead.whyNow}</p>
        <blockquote className="mt-5 border-l-4 border-[var(--rose)] bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--ink)]">
          &quot;{receiptText}&quot;
        </blockquote>
        <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-[var(--muted)]">
          <span>{lead.receipt?.product ?? "Product unavailable"}</span>
          <span>{lead.receipt?.dateReceived ? formatDate(lead.receipt.dateReceived) : "No date"}</span>
          <a href={lead.cfpbUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--blue)] hover:text-[var(--rose)]">
            CFPB complaint <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[10px] border border-[var(--ink)] bg-white p-5 shadow-[4px_4px_0_var(--ink)]">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Score breakdown</p>
          <div className="mt-5 space-y-4">
            <BreakdownBar label="Complaint spike / pressure" value={lead.breakdown.complaintSpike} max={35} />
            <BreakdownBar label="Collections relevance" value={lead.breakdown.collectionsRelevance} max={25} />
            <BreakdownBar label="Support pain phrases" value={lead.breakdown.supportPain} max={20} />
            <BreakdownBar label="Slow company response" value={lead.breakdown.slowResponse} max={10} />
            <BreakdownBar label="Industry / revenue fit" value={lead.breakdown.industryFit} max={10} />
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--ink)] bg-white p-5 shadow-[4px_4px_0_var(--ink)]">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Decision maker</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--blue)] font-mono text-sm font-bold text-white">
              VP
            </div>
            <div>
              <div className="font-bold">{lead.decisionMaker}</div>
              <div className="font-mono text-xs text-[var(--muted)]">likely buyer persona</div>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">{lead.painHypothesis}</p>
        </div>
      </div>
    </section>
  );
}

function OutreachPackSection({
  lead,
  pack,
  packTab,
  packSource,
  loadingPack,
  voiceLoading,
  voiceUrl,
  copiedKey,
  audioRef,
  activeText,
  onGeneratePack,
  onGenerateVoice,
  onChangeTab,
  onCopy
}: {
  lead: Lead;
  pack: OutreachPack | null;
  packTab: PackTab;
  packSource: PackApiResponse["source"] | null;
  loadingPack: boolean;
  voiceLoading: boolean;
  voiceUrl: string | null;
  copiedKey: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  activeText: string;
  onGeneratePack: () => void;
  onGenerateVoice: () => void;
  onChangeTab: (tab: PackTab) => void;
  onCopy: (key: string, value: string) => void;
}) {
  return (
    <section className="space-y-4 pb-16">
      <div className="rounded-[10px] border border-[var(--ink)] bg-white p-5 shadow-[4px_4px_0_var(--ink)]">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              Generate for - {lead.company}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Four channels, one sourced truth. Each pull is grounded in the CFPB receipt and keyed to {lead.decisionMaker}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGeneratePack}
              disabled={loadingPack}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--ink)] bg-[var(--ink)] px-4 font-mono text-sm font-semibold text-white shadow-[3px_3px_0_var(--rose)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPack ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Generate pack
            </button>
            <button
              type="button"
              onClick={onGenerateVoice}
              disabled={voiceLoading}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--ink)] bg-white px-4 font-mono text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--lemon)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {voiceLoading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
              Voice pitch
            </button>
          </div>
        </div>
        {packSource ? (
          <div className="mt-4 w-fit rounded border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 font-mono text-xs">
            source: {packSource}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PackCard
          title="Email"
          tab="email"
          activeTab={packTab}
          pack={pack}
          copiedKey={copiedKey}
          onChangeTab={onChangeTab}
          onCopy={onCopy}
        />
        <PackCard
          title="LinkedIn DM"
          tab="linkedin"
          activeTab={packTab}
          pack={pack}
          copiedKey={copiedKey}
          onChangeTab={onChangeTab}
          onCopy={onCopy}
        />
        <PackCard
          title="30-sec call script"
          tab="call"
          activeTab={packTab}
          pack={pack}
          copiedKey={copiedKey}
          onChangeTab={onChangeTab}
          onCopy={onCopy}
        />
        <PackCard
          title="CRM note"
          tab="crm"
          activeTab={packTab}
          pack={pack}
          copiedKey={copiedKey}
          onChangeTab={onChangeTab}
          onCopy={onCopy}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-[10px] border border-[var(--ink)] bg-white p-4 text-[var(--ink)] shadow-[4px_4px_0_var(--ink)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onGenerateVoice}
            className="grid h-12 w-12 place-items-center rounded-full bg-[var(--ink)] text-white transition hover:bg-[var(--rose)]"
          >
            <Play size={20} fill="currentColor" />
          </button>
          <div>
            <div className="font-bold">Voice pitch - {lead.company} cold call</div>
            <div className="font-mono text-xs text-[var(--muted)]">
              {voiceUrl ? "elevenlabs tts - ready" : "elevenlabs tts - browser fallback ready"}
            </div>
          </div>
        </div>
        {voiceUrl ? <audio ref={audioRef} controls src={voiceUrl} className="w-full max-w-sm" /> : null}
        <button
          type="button"
          onClick={() => onCopy("active", activeText)}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--ink)] px-4 font-mono text-sm transition hover:bg-[var(--lemon)]"
        >
          <Send size={15} />
          Send to AE
        </button>
      </div>
    </section>
  );
}

function PackCard({
  title,
  tab,
  activeTab,
  pack,
  copiedKey,
  onChangeTab,
  onCopy
}: {
  title: string;
  tab: PackTab;
  activeTab: PackTab;
  pack: OutreachPack | null;
  copiedKey: string | null;
  onChangeTab: (tab: PackTab) => void;
  onCopy: (key: string, value: string) => void;
}) {
  const text = getPackText(pack, tab);

  return (
    <article
      className={`rounded-[10px] border border-[var(--ink)] bg-white p-5 shadow-[4px_4px_0_var(--ink)] ${
        activeTab === tab ? "outline outline-2 outline-[var(--rose)]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ink)] pb-3">
        <button
          type="button"
          onClick={() => onChangeTab(tab)}
          className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)] hover:text-[var(--ink)]"
        >
          {title}
        </button>
        <button
          type="button"
          disabled={!pack}
          onClick={() => onCopy(tab, text)}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--ink)] px-2 py-1 font-mono text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copiedKey === tab ? <Check size={13} /> : <Copy size={13} />}
          copy
        </button>
      </div>
      {tab === "email" && pack ? (
        <p className="mt-4 text-sm font-bold">{pack.email.subject}</p>
      ) : null}
      <p className="mt-4 min-h-36 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
        {pack ? text : `Generate the outreach pack to populate ${title.toLowerCase()}.`}
      </p>
    </article>
  );
}

function Metric({
  label,
  value,
  delta,
  icon
}: {
  label: string;
  value: string | number;
  delta: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--ink)] bg-[var(--panel)] p-4">
      <div className="flex items-center justify-between text-[var(--muted)]">
        {icon}
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-black">{value}</div>
      <div className="mt-1 font-mono text-xs text-[var(--rose)]">{delta}</div>
    </div>
  );
}

function BreakdownBar({
  label,
  value,
  max
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[190px_1fr_52px] sm:items-center">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--panel)]">
        <div
          className="h-full rounded-full bg-[var(--rose)]"
          style={{ width: `${Math.max(4, Math.min(100, (value / max) * 100))}%` }}
        />
      </div>
      <span className="font-mono text-xs font-bold">
        {value} / {max}
      </span>
    </div>
  );
}

function MiniStep({
  number,
  title,
  body
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-[var(--ink)] bg-[var(--paper)] p-3">
      <p className="font-mono text-[11px] font-bold text-[var(--muted)]">{number} / signal</p>
      <h3 className="mt-2 text-sm font-black">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{body}</p>
    </div>
  );
}

function FilterChip({
  children,
  active = false
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`rounded-md border border-[var(--ink)] px-3 py-2 font-mono text-xs ${
        active ? "bg-[var(--blue)] text-white" : "bg-[var(--paper)] text-[var(--ink)]"
      }`}
    >
      {children}
    </span>
  );
}

function StatusPill({ tone, message }: { tone: StatusTone; message: string }) {
  const toneClass = {
    idle: "bg-[var(--paper)] text-[var(--muted)]",
    ok: "bg-[var(--mint)] text-[var(--ink)]",
    warn: "bg-[var(--lemon)] text-[var(--ink)]",
    error: "bg-[var(--rose)] text-white"
  }[tone];

  return (
    <div className={`inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--ink)] px-3 font-mono text-xs ${toneClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {message}
    </div>
  );
}

function BrandMark() {
  return <span className="h-2 w-2 bg-[var(--rose)]" aria-hidden="true" />;
}

function ScreenLabel({ label, id }: { label: string; id?: string }) {
  return (
    <div id={id} className="pb-3 pt-6 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
      {label}
    </div>
  );
}

function getPackText(pack: OutreachPack | null, tab: PackTab): string {
  if (!pack) {
    return "";
  }

  if (tab === "email") {
    return pack.email.body;
  }

  if (tab === "linkedin") {
    return pack.linkedin_dm;
  }

  if (tab === "call") {
    return pack.call_script_30s;
  }

  return pack.crm_note;
}

function formatPackSource(
  source: PackApiResponse["source"],
  model: string
): string {
  if (source === "openai") {
    return model;
  }

  if (source === "apify") {
    return "Apify search";
  }

  return "template";
}

function formatDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatSpike(value: number): string {
  if (value > 0) {
    return `+${value}%`;
  }

  if (value < 0) {
    return `${value}%`;
  }

  return "flat";
}
