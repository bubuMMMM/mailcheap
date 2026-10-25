import { redirect } from "next/navigation";
import { getMissingSetup, getSetupLists } from "@/lib/setup-required";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuration requise", robots: { index: false } };

function Row({ item }) {
	return (
		<li className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
			<span aria-hidden className={`mt-1 size-2.5 shrink-0 rounded-full ${item.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
			<div className="min-w-0">
				<p className="break-all font-mono text-[13px] font-medium">{item.name}</p>
				<p className="mt-0.5 text-sm text-muted-foreground">{item.what}</p>
			</div>
			<span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs ${item.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
				{item.ok ? "OK" : "À renseigner"}
			</span>
		</li>
	);
}

export default function SetupRequiredPage() {
	if (getMissingSetup().length === 0) redirect("/");
	const { required, optional } = getSetupLists();
	const done = required.filter((r) => r.ok).length;
	return (
		<main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
			<p className="text-sm font-medium text-muted-foreground">MailCheap</p>
			<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Presque prêt : quelques réglages manquent</h1>
			<p className="mt-2 text-sm text-muted-foreground sm:text-base">
				Ajoutez ces variables dans Vercel → Project Settings → Environment Variables (Production), puis redéployez. Aucune valeur
				n’est affichée ici.
			</p>
			<div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
				<div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / required.length) * 100}%` }} />
			</div>
			<p className="mt-2 text-xs text-muted-foreground">{done} / {required.length} réglages obligatoires renseignés</p>
			<h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Obligatoire</h2>
			<ul className="mt-3 space-y-2">{required.map((r) => <Row key={r.name} item={r} />)}</ul>
			<h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pour envoyer</h2>
			<ul className="mt-3 space-y-2">{optional.map((r) => <Row key={r.name} item={r} />)}</ul>
		</main>
	);
}
