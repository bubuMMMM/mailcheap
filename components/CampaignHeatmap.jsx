"use client";

// Custom (bubuMMMM): a click heatmap of the email as sent. Each link (text, button or image) is outlined and tinted on a
// single cool-to-hot scale; details come in a tooltip on hover or tap; a ranked list beside the preview stays in sync
// with it. Unique or total clicks, readers only or every hit, desktop or mobile width. Rules: lib/heatmap-rules.js.
import { Eye, EyeOff, Image as ImageIcon, Monitor, MousePointerClick, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildHeat, HEAT_GRADIENT, heatColor } from "@/lib/heatmap-rules";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-FR");
const pct = (n) => `${String(n).replace(".", ",")} %`;
const WIDTHS = { desktop: 640, mobile: 375 };
const FRAME_CSS = `html,body{margin:0}body{padding:20px;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b;background:#fff;overflow-x:hidden;word-wrap:break-word}
img{max-width:100%;height:auto}table{max-width:100%!important}
[data-mc]{cursor:pointer;transition:outline-width .12s,box-shadow .12s,opacity .12s}
body.mc-on [data-mc]{outline:2px solid rgb(var(--c));outline-offset:2px;border-radius:3px;box-shadow:inset 0 0 0 999px rgb(var(--c) / var(--a));-webkit-box-decoration-break:clone;box-decoration-break:clone}
body.mc-on [data-mc][data-zero]{outline:1.5px dashed #a1a1aa;box-shadow:none}
body.mc-on [data-mc][data-img]{display:inline-block;position:relative;line-height:0;box-shadow:none}
body.mc-on [data-mc][data-img] .mc-fill{position:absolute;inset:0;border-radius:3px;background:rgb(var(--c) / var(--a));pointer-events:none}
body.mc-on [data-mc][data-zero] .mc-fill,body:not(.mc-on) .mc-fill{display:none}
body.mc-on [data-mc].mc-act{outline-width:3px;outline-style:solid;outline-color:rgb(var(--c))}
body.mc-on.mc-focus [data-mc]:not(.mc-act){opacity:.35}`;

function Segmented({ value, onChange, options, label }) {
	return (
		<div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={value === o.value}
					title={o.title}
					onClick={() => onChange(o.value)}
					className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors", value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
				>
					{o.icon}
					{o.label}
				</button>
			))}
		</div>
	);
}

function shortUrl(href) {
	try {
		const u = new URL(href);
		return `${u.host.replace(/^www\./, "")}${u.pathname.length > 1 ? u.pathname : ""}`;
	} catch {
		return href;
	}
}

function Tip({ h, meta, metric }) {
	return (
		<div className="w-64 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
			<p className="truncate font-medium" title={meta.href}>{shortUrl(meta.href)}</p>
			<p className="mt-0.5 text-muted-foreground">
				Lien #{h.position}
				{h.copies > 1 && ` · ${h.occurrence}${h.occurrence === 1 ? "er" : "e"} des ${h.copies} liens vers cette URL`}
			</p>
			<dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
				<dt className="text-muted-foreground">Clics uniques</dt>
				<dd className={cn("text-right tabular-nums", metric === "unique" && "font-semibold")}>{nf.format(h.unique)}</dd>
				<dt className="text-muted-foreground">Clics au total</dt>
				<dd className={cn("text-right tabular-nums", metric === "total" && "font-semibold")}>{nf.format(h.total)}</dd>
				<dt className="text-muted-foreground">Part des cliqueurs</dt>
				<dd className="text-right tabular-nums">{pct(h.pctClickers)}</dd>
				<dt className="text-muted-foreground">Taux de clic</dt>
				<dd className="text-right tabular-nums">{pct(h.ctr)}</dd>
			</dl>
			{h.shared && <p className="mt-2 text-amber-600 dark:text-amber-400">URL partagée : email envoyé avant le suivi par position, les clics de cette URL sont comptés pour chacun de ses liens.</p>}
			{h.unplaced > 0 && <p className="mt-2 text-muted-foreground">+ {nf.format(h.unplaced)} clic(s) sur cette URL sans position connue.</p>}
		</div>
	);
}

export default function CampaignHeatmap({ html, data, recipients }) {
	const frame = useRef(null);
	const box = useRef(null);
	const marker = useRef(null);
	const els = useRef([]);
	const [meta, setMeta] = useState(null);
	const [metric, setMetric] = useState("unique");
	const [mode, setMode] = useState("human");
	const [overlay, setOverlay] = useState(true);
	const [device, setDevice] = useState("desktop");
	const [hover, setHover] = useState(null);
	const [pinned, setPinned] = useState(null);
	const [focus, setFocus] = useState(null); // from the list: dims the other links
	const [frameH, setFrameH] = useState(480);
	const [boxW, setBoxW] = useState(640);
	const [rects, setRects] = useState([]);

	const width = WIDTHS[device];
	const scale = Math.min(1, boxW / width);
	const clickers = data?.clickers?.[mode] ?? 0;
	const heat = useMemo(() => (meta ? buildHeat(meta, data?.rows ?? [], { mode, metric, recipients, clickers }) : null), [meta, data, mode, metric, recipients, clickers]);
	const shown = hover ?? pinned;

	const measure = useCallback(() => {
		const doc = frame.current?.contentDocument;
		if (!doc?.body) return;
		setFrameH(Math.min(6000, doc.body.scrollHeight));
		setRects(els.current.map((a) => {
			const r = a.getBoundingClientRect();
			return { left: r.left, top: r.top, bottom: r.bottom };
		}));
	}, []);

	// Read the email's links once it's loaded, and listen to them from here (the frame itself runs no script).
	const setup = useCallback(() => {
		const doc = frame.current?.contentDocument;
		if (!doc?.body || doc.body.hasAttribute("data-mc-ready")) return;
		doc.body.setAttribute("data-mc-ready", "1");
		const anchors = [...doc.querySelectorAll("a[href]")].filter((a) => /^https?:/i.test(a.getAttribute("href")));
		els.current = anchors;
		setMeta(
			anchors.map((a, i) => {
				const img = a.querySelector("img");
				const text = a.textContent.replace(/\s+/g, " ").trim();
				a.dataset.mc = String(i);
				a.dataset.href = a.getAttribute("href");
				a.removeAttribute("href");
				a.setAttribute("tabindex", "0");
				if (img && !text) {
					a.dataset.img = "1";
					const fill = doc.createElement("span");
					fill.className = "mc-fill";
					a.append(fill);
				}
				a.addEventListener("mouseenter", () => setHover(i));
				a.addEventListener("mouseleave", () => setHover(null));
				a.addEventListener("click", (e) => {
					e.preventDefault();
					setPinned((p) => (p === i ? null : i));
				});
				return { href: a.dataset.href, label: text || (img ? `Image${img.alt ? ` : ${img.alt}` : ""}` : a.dataset.href), isImage: Boolean(img && !text) };
			})
		);
		doc.addEventListener("click", (e) => {
			if (!e.target.closest?.("[data-mc]")) setPinned(null);
		});
		for (const img of doc.querySelectorAll("img")) if (!img.complete) img.addEventListener("load", measure);
		measure();
	}, [measure]);

	useEffect(() => {
		if (frame.current?.contentDocument?.readyState === "complete") setup();
	}, [setup]);

	useEffect(() => {
		const el = box.current;
		if (!el) return;
		let first = true;
		const ro = new ResizeObserver(([entry]) => {
			const w = Math.floor(entry.contentRect.width);
			// On a phone, start with the mobile width rather than a shrunken desktop one.
			if (first && w < WIDTHS.desktop - 100) setDevice("mobile");
			first = false;
			setBoxW(w);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// The email reflows at the other width: measure again once it has.
	useEffect(() => {
		const t = setTimeout(measure, 60);
		return () => clearTimeout(t);
	}, [device, measure]);

	// Paint: colors, active link, dimming.
	useEffect(() => {
		const doc = frame.current?.contentDocument;
		if (!doc?.body || !heat) return;
		doc.body.classList.toggle("mc-on", overlay);
		doc.body.classList.toggle("mc-focus", focus !== null);
		heat.items.forEach((h, i) => {
			const a = els.current[i];
			if (!a) return;
			a.style.setProperty("--c", heatColor(h.intensity).join(" "));
			a.style.setProperty("--a", String(0.1 + 0.3 * h.intensity));
			a.toggleAttribute("data-zero", h.value === 0);
			a.classList.toggle("mc-act", i === shown || i === focus);
		});
	}, [heat, overlay, shown, focus]);

	const goTo = (i) => {
		if (!rects[i]) return;
		const top = rects[i].top * scale;
		if (marker.current) {
			marker.current.style.top = `${Math.max(0, top - 80)}px`;
			marker.current.scrollIntoView({ behavior: "smooth", block: "start" });
		}
		setPinned(i);
	};

	let tip = null;
	if (shown !== null && heat?.items[shown] && rects[shown]) {
		const r = rects[shown];
		tip = { left: Math.max(0, Math.min(r.left * scale, width * scale - 256)), top: r.bottom * scale + 8 };
	}

	if (!html) return null;
	const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${FRAME_CSS}</style></head><body>${html}</body></html>`;
	const noLinks = meta && meta.length === 0;
	const noClicks = heat && heat.max === 0;
	const unit = metric === "unique" ? "clics uniques" : "clics";

	return (
		<section className="mt-6 overflow-hidden rounded-xl bg-card shadow-border" aria-labelledby="hm-title">
			<div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
				<div>
					<h2 id="hm-title" className="flex items-center gap-2 text-base font-semibold tracking-tight"><MousePointerClick className="size-4" /> Carte de chaleur des clics</h2>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{heat ? `${heat.items.filter((h) => h.value > 0).length} lien(s) cliqué(s) sur ${heat.items.length} · ${nf.format(clickers)} cliqueur(s) · ${nf.format(recipients)} destinataire(s)` : "Chargement…"}
					</p>
				</div>
				<button type="button" onClick={() => setOverlay((o) => !o)} aria-pressed={overlay} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
					{overlay ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} {overlay ? "Superposition activée" : "Superposition masquée"}
				</button>
			</div>
			<div className="flex flex-wrap items-center gap-2 px-4 pt-3">
				<Segmented label="Mesure" value={metric} onChange={setMetric} options={[{ value: "unique", label: "Uniques" }, { value: "total", label: "Total" }]} />
				<Segmented label="Clics comptés" value={mode} onChange={setMode} options={[{ value: "human", label: "Lecteurs réels" }, { value: "all", label: "Tous", title: "Robots, scanners et préchargements inclus" }]} />
				<Segmented
					label="Largeur de l’aperçu"
					value={device}
					onChange={setDevice}
					options={[{ value: "desktop", label: "Ordinateur", icon: <Monitor className="size-3.5" /> }, { value: "mobile", label: "Mobile", icon: <Smartphone className="size-3.5" /> }]}
				/>
				<div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground" aria-label="Légende">
					<span className="inline-block size-3 rounded-sm border-[1.5px] border-dashed border-zinc-400" /> 0
					<span className="inline-block h-2.5 w-28 rounded-full" style={{ background: HEAT_GRADIENT }} />
					<span className="tabular-nums">{nf.format(heat?.max ?? 0)} {unit}</span>
				</div>
			</div>

			<div className="mt-3 grid border-t border-border lg:grid-cols-[minmax(0,1fr)_300px]">
				<div className="min-w-0 bg-muted/30 p-2 sm:p-4">
					<div ref={box} className="relative mx-auto w-full" style={{ maxWidth: width }}>
						<div ref={marker} className="pointer-events-none absolute left-0 h-px w-px" aria-hidden />
						<div style={{ height: frameH * scale }} className="overflow-hidden">
							<iframe
								ref={frame}
								title="Aperçu de l’email avec ses clics"
								sandbox="allow-same-origin"
								srcDoc={srcDoc}
								onLoad={setup}
								scrolling="no"
								style={{ width, height: frameH, transform: `scale(${scale})`, transformOrigin: "0 0" }}
								className="block rounded-lg border border-border bg-white"
							/>
						</div>
						{tip && (
							<div className="pointer-events-none absolute z-10" style={{ left: tip.left, top: tip.top }}>
								<Tip h={heat.items[shown]} meta={meta[shown]} metric={metric} />
							</div>
						)}
					</div>
				</div>

				<aside className="border-t border-border p-3 lg:border-t-0 lg:border-l" aria-label="Classement des liens">
					<p className="px-1 pb-2 text-xs font-medium text-muted-foreground">Liens par {unit}</p>
					{noLinks && <p className="px-1 py-6 text-center text-sm text-muted-foreground">Cet email ne contient aucun lien suivi.</p>}
					{noClicks && !noLinks && (
						<div className="mb-2 rounded-lg bg-muted/60 px-3 py-4 text-center text-sm">
							<p className="font-medium">Aucun clic pour l’instant</p>
							<p className="mt-1 text-xs text-muted-foreground">{mode === "human" ? "Aucun lecteur réel n’a cliqué. Essayez « Tous » pour voir les robots." : "Les clics apparaîtront ici dès les premiers."}</p>
						</div>
					)}
					<ol className="max-h-[520px] space-y-1 overflow-y-auto">
						{heat?.ranking.map((h) => {
							const m = meta[h.index];
							const [r, g, b] = heatColor(h.intensity);
							return (
								<li key={h.index}>
									<button
										type="button"
										onMouseEnter={() => setFocus(h.index)}
										onMouseLeave={() => setFocus(null)}
										onFocus={() => setFocus(h.index)}
										onBlur={() => setFocus(null)}
										onClick={() => goTo(h.index)}
										className={cn("w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted", (pinned === h.index || focus === h.index) && "bg-muted")}
									>
										<div className="flex items-center gap-2">
											<span className="w-6 shrink-0 text-[11px] tabular-nums text-muted-foreground">#{h.position}</span>
											<span className="min-w-0 flex-1 truncate text-sm">
												{m.isImage && <ImageIcon className="mr-1 inline size-3.5 align-[-2px] text-muted-foreground" />}
												{m.label}
											</span>
											<span className="shrink-0 text-sm font-semibold tabular-nums">{nf.format(h.value)}</span>
										</div>
										<div className="mt-1 flex items-center gap-2 pl-8">
											<span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{shortUrl(m.href)}{h.shared && " · URL partagée"}</span>
											<span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
												<span className="block h-full rounded-full" style={{ width: `${Math.max(h.value ? 6 : 0, h.intensity * 100)}%`, background: `rgb(${r} ${g} ${b})` }} />
											</span>
										</div>
									</button>
								</li>
							);
						})}
					</ol>
				</aside>
			</div>
		</section>
	);
}
