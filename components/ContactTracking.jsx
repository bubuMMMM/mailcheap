// Custom (bubuMMMM): a contact's every open and click with device, mail client and country (lib/tracking-hits.js).
const MACHINE = { "apple-mpp": "Apple MPP", scanner: "Scanner", prefetch: "Préchargement" };

import { ScoreBadge } from "@/components/EngagementTable";

export default function ContactTracking({ hits, engagement }) {
	if (!hits?.length && !engagement) return null;
	return (
		<section className="mt-4 rounded-xl bg-card shadow-border animate-enter">
			<h2 className="flex h-12 items-center justify-between gap-2 px-4 text-sm font-medium">
				Suivi détaillé
				{engagement && (
					<span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
						Engagement <ScoreBadge score={engagement.score} />
					</span>
				)}
			</h2>
			{engagement && (
				<p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
					{engagement.sends} envoi(s) sur 90 jours · {engagement.opened} ouvert(s) · {engagement.clicked} cliqué(s) par un lecteur réel
				</p>
			)}
			{hits?.length > 0 && <ul className="divide-y divide-border/60 border-t border-border/60">
				{hits.map((h) => (
					<li key={h._id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
						<span className={`rounded-full px-2 py-0.5 text-[11px] ${h.type === "click" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
							{h.type === "click" ? "Clic" : "Ouverture"}
						</span>
						<span className="min-w-0 flex-1 truncate text-muted-foreground">{h.url ? h.url.replace(/^https?:\/\//, "") : [h.client, h.device, h.os].filter(Boolean).join(" · ")}</span>
						{h.machine && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{MACHINE[h.machine]} · exclu</span>}
						<time className="text-xs tabular-nums text-muted-foreground" dateTime={h.at}>
							{new Date(h.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
						</time>
					</li>
				))}
			</ul>}
		</section>
	);
}
