"use client";

// Custom (bubuMMMM): the email as sent, with each link's unique and total human clicks on a badge, colored by how much
// it was clicked (lib/heatmap-rules.js). Links to the same URL share its clicks, and say so.
import { MousePointerClick } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildHeat } from "@/lib/heatmap-rules";

const nf = new Intl.NumberFormat("fr-FR");
const BASE_CSS = `body{margin:0;padding:24px;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b;background:#fff;overflow-x:hidden}
img{max-width:100%;height:auto}table{max-width:100%}
a[data-heat]{position:relative;border-radius:4px;outline:2px solid var(--heat-c);outline-offset:2px;background:var(--heat-bg)}
.mc-heat{display:inline-block;margin-left:4px;padding:1px 6px;border-radius:999px;font:600 11px/1.5 -apple-system,sans-serif;color:#fff;background:var(--heat-c);vertical-align:middle;white-space:nowrap;text-decoration:none}`;

function color(intensity) {
	// From pale blue (few clicks) to deep red (most clicked).
	const hue = Math.round(220 - 220 * intensity);
	return { c: `hsl(${hue} 85% ${50 - 8 * intensity}%)`, bg: `hsl(${hue} 90% 60% / ${0.08 + 0.25 * intensity})` };
}

export default function CampaignHeatmap({ html, links, recipients }) {
	const frame = useRef(null);
	const [height, setHeight] = useState(480);
	const [summary, setSummary] = useState(null);

	const paint = useCallback(() => {
		const doc = frame.current?.contentDocument;
		if (!doc?.body || doc.body.dataset.heatDone) return;
		doc.body.dataset.heatDone = "1";
		const anchors = [...doc.querySelectorAll("a[href]")].filter((a) => /^https?:/i.test(a.getAttribute("href")));
		const heat = buildHeat(anchors.map((a) => a.getAttribute("href")), links, recipients);
		anchors.forEach((a, i) => {
			const h = heat[i];
			const { c, bg } = color(h.intensity);
			a.dataset.heat = "1";
			a.style.setProperty("--heat-c", c);
			a.style.setProperty("--heat-bg", bg);
			a.removeAttribute("href");
			const badge = doc.createElement("span");
			badge.className = "mc-heat";
			badge.style.setProperty("--heat-c", c);
			badge.textContent = `#${h.position} · ${nf.format(h.unique)} (${String(h.pct).replace(".", ",")} %) · ${nf.format(h.total)} au total${h.sharedWith ? " · URL partagée" : ""}`;
			badge.title = h.sharedWith ? `Cette URL apparaît ${h.sharedWith + 1} fois : les clics sont comptés par URL et partagés entre ces liens.` : "";
			a.after(badge);
		});
		setSummary({ links: anchors.length, clicked: heat.filter((h) => h.unique > 0).length });
		setHeight(Math.min(4000, doc.documentElement.scrollHeight + 8));
	}, [links, recipients]);

	// The frame can finish loading before React listens to it.
	useEffect(() => {
		if (frame.current?.contentDocument?.readyState === "complete") paint();
	}, [paint]);

	if (!html) return null;
	const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${BASE_CSS}</style></head><body>${html}</body></html>`;
	return (
		<section className="mt-6 overflow-hidden rounded-xl bg-card shadow-border" aria-labelledby="hm-title">
			<div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
				<h2 id="hm-title" className="flex items-center gap-2 text-base font-semibold tracking-tight"><MousePointerClick className="size-4" /> Carte des clics</h2>
				<p className="text-xs text-muted-foreground">
					{summary ? `${summary.clicked} lien(s) cliqué(s) sur ${summary.links}` : "…"} · lecteurs réels · # = position du lien
				</p>
			</div>
			<div className="mt-3 border-t border-border bg-muted/30 p-2 sm:p-4">
				<iframe
					ref={frame}
					title="Aperçu de l’email avec les clics"
					sandbox="allow-same-origin"
					srcDoc={srcDoc}
					onLoad={paint}
					style={{ height }}
					className="mx-auto block w-full max-w-[640px] rounded-lg border border-border bg-white"
				/>
			</div>
		</section>
	);
}
