"use client";

// Custom (bubuMMMM): contacts by engagement score: sort, filter, search, and the inactive ones to unsubscribe or put to
// sleep. Nothing changes without ticking contacts and typing the confirmation.
import { ArrowDownUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { scoreLabel } from "@/lib/engagement-rules";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const FILTERS = { all: "Tous", high: "Engagés (≥ 40)", low: "Tièdes (< 40)", inactive: "Inactifs", new: "Nouveaux" };
const PAGE = 100;

export function ScoreBadge({ score }) {
	const tone =
		score == null ? "bg-muted text-muted-foreground" : score >= 70 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : score >= 40 ? "bg-sky-500/15 text-sky-700 dark:text-sky-400" : score >= 15 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-rose-500/15 text-rose-700 dark:text-rose-400";
	return (
		<span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", tone)} title={scoreLabel(score)}>
			{score ?? "—"} <span className="font-normal opacity-80">{scoreLabel(score)}</span>
		</span>
	);
}

export default function EngagementTable({ rows, newsletterId, days, minSends, capped }) {
	const router = useRouter();
	const [filter, setFilter] = useState("all");
	const [sort, setSort] = useState("desc");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(new Set());
	const [dialog, setDialog] = useState(null);
	const [typed, setTyped] = useState("");
	const [busy, setBusy] = useState(false);
	const [limit, setLimit] = useState(PAGE);

	const inactiveCount = rows.filter((r) => r.inactive).length;
	const list = useMemo(() => {
		const q = query.trim().toLowerCase();
		const out = rows.filter((r) => {
			if (q && !r.email.includes(q) && !r.firstName.toLowerCase().includes(q)) return false;
			if (filter === "high") return r.score != null && r.score >= 40;
			if (filter === "low") return r.score != null && r.score < 40;
			if (filter === "inactive") return r.inactive;
			if (filter === "new") return r.score == null;
			return true;
		});
		const val = (r) => (r.score == null ? -1 : r.score);
		return out.sort((a, b) => (sort === "desc" ? val(b) - val(a) : val(a) - val(b)));
	}, [rows, filter, sort, query]);

	const selectedInactive = [...selected].filter((id) => rows.find((r) => r.id === id)?.inactive);

	function setPeriod(next) {
		const url = new URL(window.location.href);
		for (const [k, v] of Object.entries(next)) url.searchParams.set(k, String(v));
		router.push(`${url.pathname}${url.search}`);
	}

	async function run() {
		setBusy(true);
		const res = await fetch("/api/engagement/inactive", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ confirm: true, newsletterId, contactIds: selectedInactive, action: dialog, days, minSends }),
		});
		const out = await res.json().catch(() => ({}));
		setBusy(false);
		if (!res.ok) return void toast.error(out.error ?? "Action impossible");
		toast.success(`${out.changed} contact(s) ${dialog === "unsubscribe" ? "désabonné(s)" : "mis en sommeil"}`);
		setDialog(null);
		setTyped("");
		setSelected(new Set());
		router.refresh();
	}

	const word = String(selectedInactive.length);
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				{Object.entries(FILTERS).map(([k, label]) => (
					<button
						key={k}
						type="button"
						onClick={() => setFilter(k)}
						className={cn("rounded-full border px-3 py-1 text-sm transition-colors", filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
					>
						{label}
						{k === "inactive" && ` (${inactiveCount})`}
					</button>
				))}
				<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="h-9 w-full sm:ml-auto sm:w-56" />
			</div>
			<div className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm shadow-border">
				<span className="text-muted-foreground">Inactif = aucune ouverture ni clic réel depuis</span>
				<select value={days} onChange={(e) => setPeriod({ days: e.target.value })} className="h-8 rounded-md border border-input bg-transparent px-2">
					{[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} jours</option>)}
				</select>
				<span className="text-muted-foreground">après au moins</span>
				<select value={minSends} onChange={(e) => setPeriod({ sends: e.target.value })} className="h-8 rounded-md border border-input bg-transparent px-2">
					{[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} envoi(s)</option>)}
				</select>
			</div>
			{selected.size > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
					<span>{selected.size} sélectionné(s), dont {selectedInactive.length} inactif(s)</span>
					<div className="ml-auto flex gap-2">
						<Button type="button" variant="outline" size="sm" disabled={!selectedInactive.length} onClick={() => setDialog("dormant")}>Mettre en sommeil</Button>
						<Button type="button" variant="destructive" size="sm" disabled={!selectedInactive.length} onClick={() => setDialog("unsubscribe")}>Désabonner</Button>
					</div>
				</div>
			)}
			<div className="overflow-x-auto rounded-xl bg-card shadow-border">
				<table className="w-full min-w-[560px] text-sm">
					<thead className="text-left text-xs text-muted-foreground">
						<tr>
							<th className="w-10 px-3 py-2">
								<input
									type="checkbox"
									aria-label="Tout sélectionner"
									checked={list.length > 0 && list.slice(0, limit).every((r) => selected.has(r.id))}
									onChange={(e) => setSelected(e.target.checked ? new Set(list.slice(0, limit).map((r) => r.id)) : new Set())}
								/>
							</th>
							<th className="w-[38%] px-3 py-2 font-normal">Contact</th>
							<th className="px-3 py-2 font-normal">
								<button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => (s === "desc" ? "asc" : "desc"))}>
									Score <ArrowDownUp className="size-3" /> {sort === "desc" ? "↓" : "↑"}
								</button>
							</th>
							<th className="px-3 py-2 text-right font-normal">Envois 90 j</th>
							<th className="px-3 py-2 text-right font-normal">Ouverts / cliqués</th>
							<th className="px-3 py-2 font-normal">Dernière activité</th>
						</tr>
					</thead>
					<tbody>
						{list.slice(0, limit).map((r) => (
							<tr key={r.id} className="border-t border-border">
								<td className="px-3 py-2">
									<input
										type="checkbox"
										aria-label={`Sélectionner ${r.email}`}
										checked={selected.has(r.id)}
										onChange={(e) => setSelected((s) => { const n = new Set(s); e.target.checked ? n.add(r.id) : n.delete(r.id); return n; })}
									/>
								</td>
								<td className="max-w-0 px-3 py-2">
									<Link href={`/contacts/${r.id}`} className="block truncate hover:underline">{r.email}</Link>
									{r.inactive && <span className="text-[11px] text-rose-600">Inactif</span>}
								</td>
								<td className="px-3 py-2"><ScoreBadge score={r.score} /></td>
								<td className="px-3 py-2 text-right tabular-nums">{r.sends}</td>
								<td className="px-3 py-2 text-right tabular-nums">{r.opened} / {r.clicked}</td>
								<td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{r.lastAt ? new Date(r.lastAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "Jamais"}</td>
							</tr>
						))}
					</tbody>
				</table>
				{list.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun contact.</p>}
			</div>
			{list.length > limit && (
				<Button type="button" variant="ghost" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>Afficher plus ({list.length - limit})</Button>
			)}
			{capped && <p className="text-xs text-muted-foreground">Les 5 000 premiers contacts sont affichés.</p>}

			<Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && !busy && (setDialog(null), setTyped(""))}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{dialog === "unsubscribe" ? "Désabonner" : "Mettre en sommeil"} {selectedInactive.length} contact(s) inactif(s) ?</DialogTitle>
						<DialogDescription>
							{dialog === "unsubscribe"
								? "Ils ne recevront plus aucun email. Ils pourront se réabonner eux-mêmes ; rien n’est supprimé."
								: "Ils ne recevront plus vos numéros mais restent abonnés ; vous pourrez les réactiver. Rien n’est supprimé."}{" "}
							Tapez <strong>{word}</strong> pour confirmer.
						</DialogDescription>
					</DialogHeader>
					<Input value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="numeric" aria-label="Confirmation" autoFocus />
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>Annuler</Button>
						<Button type="button" variant={dialog === "unsubscribe" ? "destructive" : "default"} disabled={typed !== word || busy} onClick={run}>
							{busy && <Loader2 className="size-4 animate-spin" />} Confirmer
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
