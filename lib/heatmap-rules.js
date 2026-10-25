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

// links: [{ url, unique, total }] from the tracking; hrefs: the email's links in order. Each link in the email gets its
// position, its URL's clicks, and how many links share that URL: clicks are counted per URL, so duplicates share them.
export function buildHeat(hrefs, links, recipients) {
	const byKey = new Map();
	for (const l of links) {
		const key = heatKey(l.url);
		if (!key) continue;
		const prev = byKey.get(key) ?? { unique: 0, total: 0 };
		byKey.set(key, { unique: prev.unique + l.unique, total: prev.total + l.total });
	}
	const keys = hrefs.map(heatKey);
	const counts = new Map();
	for (const k of keys) if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
	const maxUnique = Math.max(1, ...[...byKey.values()].map((v) => v.unique));
	return keys.map((key, i) => {
		const stat = (key && byKey.get(key)) ?? { unique: 0, total: 0 };
		return {
			position: i + 1,
			key,
			unique: stat.unique,
			total: stat.total,
			pct: recipients ? Math.round((stat.unique / recipients) * 1000) / 10 : 0,
			intensity: stat.unique / maxUnique,
			sharedWith: key ? counts.get(key) - 1 : 0,
		};
	});
}
