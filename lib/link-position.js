// Custom (bubuMMMM): which of an email's links to the same URL was clicked. Sent links end with ?n=<k>, k being the
// link's place among those to its URL (1 = first). It sits outside the signed token, so it only ever affects the
// heatmap, and links sent before it existed (no n) still work and count as "not placed".
// Only links whose URL appears more than once get it: a single link stays as upstream makes it.
export function countUrls(html, pattern) {
	const counts = new Map();
	for (const m of html.matchAll(pattern)) {
		const url = m[3].replace(/&amp;|&#0*38;|&#x0*26;/gi, "&");
		counts.set(url, (counts.get(url) ?? 0) + 1);
	}
	return counts;
}

export function withPosition(clickUrl, url, seen, counts) {
	if (counts && (counts.get(url) ?? 0) < 2) return clickUrl;
	const n = (seen.get(url) ?? 0) + 1;
	seen.set(url, n);
	return `${clickUrl}?n=${n}`;
}

export function readPosition(value) {
	const n = Number.parseInt(String(value ?? ""), 10);
	return Number.isInteger(n) && n > 0 && n < 1000 ? n : null;
}
