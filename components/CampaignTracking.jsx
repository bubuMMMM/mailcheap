// Custom (bubuMMMM): the detailed tracking under a campaign's report: unique vs total, machines left out, timeline,
// devices, clients, countries, links and the latest activity. Server component; data from lib/tracking-hits.js.
import CardStat from "@/components/CardStat";
import { getCountryName } from "@/lib/countries";

const nf = new Intl.NumberFormat("fr-FR");
const fmt = (n) => nf.format(n ?? 0);

function formatDelay(s) {
	if (s == null) return null;
	if (s < 60) return `${s} s`;
	if (s < 3600) return `${Math.round(s / 60)} min`;
	if (s < 86400) return `${(s / 3600).toFixed(1).replace(".", ",")} h`;
	return `${(s / 86400).toFixed(1).replace(".", ",")} j`;
}

function Timeline({ points }) {
	if (points.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Pas encore d’ouverture ni de clic.</p>;
	const W = 600;
	const H = 140;
	const max = Math.max(1, ...points.map((p) => Math.max(p.open, p.click)));
	const x = (i) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
	const y = (v) => H - (v / max) * (H - 8);
	const line = (key) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
	const area = `${line("open")} L${W},${H} L0,${H} Z`;
	const first = new Date(points[0].at);
	const last = new Date(points.at(-1).at);
	const label = (d) => d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
	return (
		<div>
			<svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none" role="img" aria-label="Ouvertures et clics par heure">
				<defs>
					<linearGradient id="ct-open" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
						<stop offset="100%" stopColor="currentColor" stopOpacity="0" />
					</linearGradient>
				</defs>
				<g className="text-primary">
					<path d={area} fill="url(#ct-open)" />
					<path d={line("open")} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
				</g>
				<path d={line("click")} fill="none" className="text-emerald-500" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
			</svg>
			<div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
				<span>{label(first)}</span>
				<span className="flex gap-3">
					<span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-primary" />Ouvertures</span>
					<span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-emerald-500" />Clics</span>
				</span>
				<span>{label(last)}</span>
			</div>
		</div>
	);
}

function Breakdown({ title, rows, format = (l) => l }) {
	const total = rows.reduce((s, r) => s + r.value, 0) || 1;
	return (
		<div className="rounded-xl bg-card p-4 shadow-border">
			<h3 className="text-[13px] text-muted-foreground">{title}</h3>
			{rows.length === 0 ? (
				<p className="mt-3 text-sm text-muted-foreground">—</p>
			) : (
				<ul className="mt-3 space-y-2">
					{rows.map((r) => (
						<li key={r.label} className="text-sm">
							<div className="flex justify-between gap-2">
								<span className="truncate">{format(r.label)}</span>
								<span className="shrink-0 tabular-nums text-muted-foreground">{Math.round((r.value / total) * 100)} %</span>
							</div>
							<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
								<div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.value / total) * 100}%` }} />
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

const MACHINE_LABELS = { "apple-mpp": "Apple MPP", scanner: "Scanner", prefetch: "Préchargement" };

export default function CampaignTracking({ data }) {
	if (!data) return null;
	const { opens, clicks, machine } = data;
	const machineTotal = machine.appleMpp + machine.scanner + machine.prefetch;
	return (
		<section className="mt-6 space-y-3" aria-labelledby="ct-title">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="ct-title" className="text-base font-semibold tracking-tight">Suivi détaillé</h2>
				<p className="text-xs text-muted-foreground">Lecteurs réels uniquement · {fmt(machineTotal)} ouverture(s)/clic(s) automatiques exclus</p>
			</div>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<CardStat label="Ouvertures uniques" value={fmt(opens.unique)} detail={`${fmt(opens.total)} au total`} />
				<CardStat label="Clics uniques" value={fmt(clicks.unique)} detail={`${fmt(clicks.total)} au total`} />
				<CardStat label="Délai médian d’ouverture" value={formatDelay(data.medianSecondsToOpen)} detail="Après l’envoi" />
				<CardStat
					label="Automatiques exclus"
					value={fmt(machineTotal)}
					detail={`MPP ${fmt(machine.appleMpp)} · scanners ${fmt(machine.scanner + machine.prefetch)}`}
				/>
			</div>
			<div className="rounded-xl bg-card p-4 shadow-border">
				<h3 className="mb-2 text-[13px] text-muted-foreground">Activité par heure</h3>
				<Timeline points={data.timeline} />
			</div>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Breakdown title="Appareils" rows={data.devices} />
				<Breakdown title="Systèmes" rows={data.os} />
				<Breakdown title="Clients mail" rows={data.clients} />
				<Breakdown title="Pays" rows={data.countries} format={(c) => getCountryName(c) ?? c} />
			</div>
			<div className="overflow-hidden rounded-xl bg-card shadow-border">
				<h3 className="px-4 pt-4 text-[13px] text-muted-foreground">Clics par lien</h3>
				{data.links.length === 0 ? (
					<p className="px-4 py-4 text-sm text-muted-foreground">Aucun clic pour l’instant.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="mt-2 w-full min-w-[420px] text-sm">
							<thead className="text-left text-xs text-muted-foreground">
								<tr><th className="px-4 py-2 font-normal">Lien</th><th className="px-4 py-2 text-right font-normal">Uniques</th><th className="px-4 py-2 text-right font-normal">Total</th></tr>
							</thead>
							<tbody>
								{data.links.map((l) => (
									<tr key={l.url} className="border-t border-border">
										<td className="max-w-0 truncate px-4 py-2"><a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{l.url.replace(/^https?:\/\//, "")}</a></td>
										<td className="px-4 py-2 text-right tabular-nums">{fmt(l.unique)}</td>
										<td className="px-4 py-2 text-right tabular-nums">{fmt(l.total)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
			<div className="overflow-hidden rounded-xl bg-card shadow-border">
				<h3 className="px-4 pt-4 text-[13px] text-muted-foreground">Dernières activités</h3>
				{data.recent.length === 0 ? (
					<p className="px-4 py-4 text-sm text-muted-foreground">Rien pour l’instant.</p>
				) : (
					<ul className="mt-2 divide-y divide-border">
						{data.recent.map((r) => (
							<li key={r._id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
								<span className={`rounded-full px-2 py-0.5 text-[11px] ${r.type === "click" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
									{r.type === "click" ? "Clic" : "Ouverture"}
								</span>
								<span className="min-w-0 flex-1 truncate">{r.email ?? "—"}</span>
								<span className="text-xs text-muted-foreground">
									{[r.client, r.device, r.country].filter(Boolean).join(" · ")}
									{r.machine && ` · ${MACHINE_LABELS[r.machine]} (exclu)`}
								</span>
								<time className="text-xs tabular-nums text-muted-foreground" dateTime={r.at}>
									{new Date(r.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
								</time>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
