"use client";

// Custom (bubuMMMM): set up an A/B test on a draft (variant B's subject and/or content, sample, metric, wait), and on a
// sent campaign follow both variants and send the winner (lib/ab-test.js).
import { FlaskConical, Loader2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-FR");
const pct = (n, d) => (d ? `${(Math.round((n / d) * 1000) / 10).toString().replace(".", ",")} %` : "—");
const METRICS = { opens: "Ouvertures uniques", clicks: "Clics uniques" };

function VariantCard({ name, stats, metric, isWinner, subject }) {
	return (
		<div className={cn("rounded-xl border p-4", isWinner ? "border-emerald-500/60 bg-emerald-500/5" : "border-border")}>
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-semibold">Variante {name}</span>
				{isWinner && (
					<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
						<Trophy className="size-3" /> Gagnante
					</span>
				)}
			</div>
			{subject && <p className="mt-1 truncate text-xs text-muted-foreground" title={subject}>{subject}</p>}
			<dl className="mt-3 grid grid-cols-3 gap-2 text-center">
				<div><dt className="text-[11px] text-muted-foreground">Envoyés</dt><dd className="text-lg font-semibold tabular-nums">{nf.format(stats.sent)}</dd></div>
				<div><dt className="text-[11px] text-muted-foreground">Ouvertures</dt><dd className={cn("text-lg font-semibold tabular-nums", metric === "opens" && "text-primary")}>{pct(stats.opens, stats.sent)}</dd></div>
				<div><dt className="text-[11px] text-muted-foreground">Clics</dt><dd className={cn("text-lg font-semibold tabular-nums", metric === "clicks" && "text-primary")}>{pct(stats.clicks, stats.sent)}</dd></div>
			</dl>
		</div>
	);
}

export default function AbTestPanel({ campaignId, subjectA, htmlA, isDraft }) {
	const [data, setData] = useState(null);
	const [form, setForm] = useState(null);
	const [busy, setBusy] = useState(false);
	const base = `/api/campaigns/${campaignId}/ab-test`;

	useEffect(() => {
		fetch(base)
			.then((r) => (r.ok ? r.json() : { test: null }))
			.then((d) => {
				setData(d);
				const t = d.test ?? {};
				setForm({ enabled: t.enabled ?? false, subjectB: t.subjectB ?? "", htmlB: t.htmlB ?? "", samplePct: t.samplePct ?? 20, metric: t.metric ?? "opens", waitHours: t.waitHours ?? 4 });
			})
			.catch(() => setData({ test: null }));
	}, [base]);

	if (!data || !form) return null;
	const test = data.test;

	if (!isDraft) {
		if (!test || test.status === "draft") return null;
		const stats = test.results ?? data.stats;
		async function sendWinner() {
			if (!window.confirm("Choisir le gagnant maintenant et l’envoyer au reste de l’audience ?")) return;
			setBusy(true);
			const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send-winner" }) });
			const out = await res.json().catch(() => ({}));
			setBusy(false);
			if (!res.ok) return void toast.error(out.error ?? "Impossible pour l’instant");
			toast.success(`Variante ${out.winner} envoyée au reste de l’audience`);
			window.location.reload();
		}
		return (
			<section className="mt-6 rounded-xl bg-card p-4 shadow-border" aria-labelledby="ab-title">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 id="ab-title" className="flex items-center gap-2 text-base font-semibold tracking-tight"><FlaskConical className="size-4" /> Test A/B</h2>
					<p className="text-xs text-muted-foreground">
						Échantillon {test.samplePct} % ({nf.format(test.sampleSize ?? 0)}) · critère : {METRICS[test.metric]} (lecteurs réels) ·{" "}
						{test.status === "testing"
							? `décision ${new Date(test.decideAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
							: `décidé ${test.decidedBy === "manual" ? "manuellement" : "automatiquement"}${test.restSent ? ", envoyé au reste" : ""}`}
					</p>
				</div>
				{stats && (
					<div className="mt-3 grid gap-3 sm:grid-cols-2">
						<VariantCard name="A" stats={stats.A} metric={test.metric} isWinner={test.winner === "A"} subject={test.original?.subject ?? subjectA} />
						<VariantCard name="B" stats={stats.B} metric={test.metric} isWinner={test.winner === "B"} subject={test.subjectB || subjectA} />
					</div>
				)}
				{test.lastError && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{test.lastError}</p>}
				{!test.restSent && (
					<Button type="button" className="mt-3" onClick={sendWinner} disabled={busy}>
						{busy && <Loader2 className="size-4 animate-spin" />} Envoyer le gagnant maintenant
					</Button>
				)}
			</section>
		);
	}

	const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
	const locked = test && test.status !== "draft";
	async function save(next = form) {
		setBusy(true);
		const res = await fetch(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
		const out = await res.json().catch(() => ({}));
		setBusy(false);
		if (!res.ok) return void toast.error(out.error ?? "Enregistrement impossible");
		setData((d) => ({ ...d, test: out.test }));
		toast.success(next.enabled ? "Test A/B enregistré" : "Test A/B désactivé");
	}

	return (
		<section className="mx-auto mt-6 w-[calc(100%-2rem)] max-w-2xl rounded-xl bg-card p-4 shadow-border" aria-labelledby="ab-title">
			<div className="flex items-center justify-between gap-3">
				<h2 id="ab-title" className="flex items-center gap-2 text-sm font-medium"><FlaskConical className="size-4" /> Test A/B</h2>
				<Switch
					checked={form.enabled}
					disabled={locked || busy}
					onCheckedChange={(v) => {
						const next = { ...form, enabled: v };
						setForm(next);
						if (!v && test?.enabled) save(next);
					}}
					aria-label="Activer le test A/B"
				/>
			</div>
			<p className="mt-1 text-xs text-muted-foreground">
				Un échantillon reçoit A ou B (moitié-moitié) ; après l’attente, la variante avec le meilleur taux chez les lecteurs réels part au reste.
			</p>
			{form.enabled && (
				<div className="mt-4 space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="ab-subject">Sujet B</Label>
						<Input id="ab-subject" value={form.subjectB} onChange={set("subjectB")} placeholder={subjectA || "Sujet de la variante B"} disabled={locked} />
					</div>
					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<Label htmlFor="ab-html">Contenu B (HTML, optionnel)</Label>
							{!form.htmlB && htmlA && !locked && (
								<button type="button" className="text-xs text-primary hover:underline" onClick={() => setForm((f) => ({ ...f, htmlB: htmlA }))}>
									Partir du contenu A
								</button>
							)}
						</div>
						<Textarea id="ab-html" value={form.htmlB} onChange={set("htmlB")} rows={5} className="font-mono text-xs" placeholder="Vide : même contenu que A" disabled={locked} />
					</div>
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="space-y-1.5">
							<Label htmlFor="ab-pct">Échantillon : {form.samplePct} %</Label>
							<input id="ab-pct" type="range" min={10} max={50} step={5} value={form.samplePct} onChange={(e) => setForm((f) => ({ ...f, samplePct: Number(e.target.value) }))} className="w-full accent-primary" disabled={locked} />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="ab-metric">Critère gagnant</Label>
							<select id="ab-metric" value={form.metric} onChange={set("metric")} disabled={locked} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
								<option value="opens">Ouvertures uniques</option>
								<option value="clicks">Clics uniques</option>
							</select>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="ab-wait">Attente : {form.waitHours} h</Label>
							<input id="ab-wait" type="range" min={1} max={24} step={1} value={form.waitHours} onChange={(e) => setForm((f) => ({ ...f, waitHours: Number(e.target.value) }))} className="w-full accent-primary" disabled={locked} />
						</div>
					</div>
					{!locked && (
						<Button type="button" onClick={() => save()} disabled={busy}>
							{busy && <Loader2 className="size-4 animate-spin" />} Enregistrer le test
						</Button>
					)}
					<p className="text-[11px] text-muted-foreground">L’échantillon part avec le bouton d’envoi habituel. Sans QStash, le gagnant s’envoie depuis le rapport.</p>
				</div>
			)}
		</section>
	);
}
