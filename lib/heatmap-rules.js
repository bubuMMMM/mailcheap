// Custom (bubuMMMM): matching an email's links to their clicks for the heatmap (tests/heatmap-rules.test.mjs).
export function heatKey(href) {
	try {
		const url = new URL(String(href).trim());
		if (!["http:", "https:"].includes(url.protocol)) return null;
		url.hash = "";
		for (const name of [...url.searchParams.keys()]) if (/^(utm_|mc_|fbclid|gclid)/i.test(name)) url.searchParams.delete(name);
		const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "";
		return `${url.host.toLowerCase().replace(/^www\./, "")}${path}${url.search}`;
	} catch {
		return null;
	}
}

// One gradient, cool to hot, for every link: 0 → slate blue, max → red (through teal, yellow and orange).
const STOPS = [
	[0, [59, 130, 246]],
	[0.25, [20, 184, 166]],
	[0.5, [234, 179, 8]],
	[0.75, [249, 115, 22]],
	[1, [220, 38, 38]],
];
export function heatColor(intensity) {
	const t = Math.min(1, Math.max(0, Number(intensity) || 0));
	let i = 1;
	while (i < STOPS.length - 1 && STOPS[i][0] < t) i++;
	const [t0, c0] = STOPS[i - 1];
	const [t1, c1] = STOPS[i];
	const f = (t - t0) / (t1 - t0 || 1);
	return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
}
export const HEAT_GRADIENT = `linear-gradient(90deg, ${STOPS.map(([t, c]) => `rgb(${c.join(" ")}) ${t * 100}%`).join(", ")})`;

const ZERO = { unique: 0, total: 0 };
const add = (a, b) => ({ unique: a.unique + b.unique, total: a.total + b.total });

// anchors: the email's tracked links in order ({ href }). rows: lib/heatmap.js ({ url, pos, human, all }). mode: "human"
// or "all"; metric: "unique" or "total". Links to the same URL are told apart by their position when the email was sent
// with positions; otherwise (older emails) they share their URL's clicks and say so (shared).
export function buildHeat(anchors, rows, { mode = "human", metric = "unique", recipients = 0, clickers = 0 } = {}) {
	const byKey = new Map();
	for (const row of rows ?? []) {
		const key = heatKey(row.url);
		if (!key) continue;
		const entry = byKey.get(key) ?? { placed: new Map(), legacy: ZERO, any: ZERO };
		const stat = row[mode] ?? ZERO;
		if (row.pos) entry.placed.set(row.pos, add(entry.placed.get(row.pos) ?? ZERO, stat));
		else entry.legacy = add(entry.legacy, stat);
		entry.any = add(entry.any, stat);
		byKey.set(key, entry);
	}
	const keys = anchors.map((a) => heatKey(a.href));
	const dupes = new Map();
	for (const k of keys) if (k) dupes.set(k, (dupes.get(k) ?? 0) + 1);
	const seen = new Map();
	const items = keys.map((key, i) => {
		const occurrence = key ? (seen.get(key) ?? 0) + 1 : 0;
		if (key) seen.set(key, occurrence);
		const entry = key && byKey.get(key);
		const copies = key ? dupes.get(key) : 1;
		let stat = ZERO;
		let shared = false;
		let unplaced = 0;
		if (entry && copies === 1) stat = entry.any;
		else if (entry && entry.placed.size) {
			stat = entry.placed.get(occurrence) ?? ZERO;
			unplaced = entry.legacy[metric];
		} else if (entry) {
			stat = entry.legacy;
			shared = true;
		}
		return {
			index: i,
			position: i + 1,
			key,
			copies,
			occurrence,
			shared,
			unplaced,
			unique: stat.unique,
			total: stat.total,
			value: stat[metric],
			pctClickers: clickers ? round1((stat.unique / clickers) * 100) : 0,
			ctr: recipients ? round1((stat.unique / recipients) * 100) : 0,
		};
	});
	const max = Math.max(0, ...items.map((h) => h.value));
	for (const h of items) h.intensity = max ? h.value / max : 0;
	return { items, max, ranking: [...items].sort((a, b) => b.value - a.value || a.index - b.index) };
}

function round1(n) {
	return Math.round(n * 10) / 10;
}
