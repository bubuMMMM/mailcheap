// Custom (bubuMMMM): heatmap rules and link positions.
import assert from "node:assert/strict";
import test from "node:test";
import { buildHeat, heatColor, heatKey } from "../lib/heatmap-rules.js";
import { countUrls, readPosition, withPosition } from "../lib/link-position.js";

const row = (url, pos, h, a = h) => ({ url, pos, human: { unique: h[0], total: h[1] }, all: { unique: a[0], total: a[1] } });

test("withPosition numbers each URL's links separately, readPosition rejects junk", () => {
	const seen = new Map();
	assert.equal(withPosition("https://m/c/x", "https://a", seen), "https://m/c/x?n=1");
	assert.equal(withPosition("https://m/c/y", "https://b", seen), "https://m/c/y?n=1");
	assert.equal(withPosition("https://m/c/z", "https://a", seen), "https://m/c/z?n=2");
	const counts = countUrls(`<a href="https://a">1</a><a href='https://b'>2</a><a href="https://a">3</a>`, /(<a\b[^>]*?\shref\s*=\s*)(["'])(https?:\/\/[^"'\s]+)\2/gi);
	assert.equal(withPosition("https://m/c/b", "https://b", new Map(), counts), "https://m/c/b");
	assert.equal(counts.get("https://a"), 2);
	assert.equal(readPosition("3"), 3);
	for (const bad of [null, "", "0", "-1", "abc", "5000"]) assert.equal(readPosition(bad), null);
});

test("positioned clicks go to the right duplicate link", () => {
	const anchors = [{ href: "https://n0.pub" }, { href: "https://x.com/a" }, { href: "https://n0.pub/" }];
	const rows = [row("https://n0.pub", 1, [2, 3]), row("https://n0.pub", 2, [6, 8]), row("https://x.com/a", null, [1, 1])];
	const { items, max, ranking } = buildHeat(anchors, rows, { recipients: 40, clickers: 8 });
	assert.deepEqual(items.map((h) => h.value), [2, 1, 6]);
	assert.equal(items[0].shared, false);
	assert.equal(items[2].occurrence, 2);
	assert.equal(max, 6);
	assert.equal(items[2].intensity, 1);
	assert.equal(items[2].pctClickers, 75);
	assert.equal(items[2].ctr, 15);
	assert.deepEqual(ranking.map((h) => h.position), [3, 1, 2]);
});

test("older emails without positions share their URL's clicks", () => {
	const anchors = [{ href: "https://n0.pub" }, { href: "https://n0.pub?utm_source=x" }];
	const { items } = buildHeat(anchors, [row("https://n0.pub", null, [5, 7])], { metric: "total" });
	assert.deepEqual(items.map((h) => [h.value, h.shared]), [[7, true], [7, true]]);
});

test("human or all hits, and no clicks at all", () => {
	const anchors = [{ href: "https://a.io" }, { href: "mailto:x@y.z" }];
	const rows = [row("https://a.io", 1, [1, 1], [4, 9])];
	assert.equal(buildHeat(anchors, rows, { mode: "all" }).items[0].value, 4);
	assert.equal(buildHeat(anchors, rows, { mode: "all", metric: "total" }).items[0].value, 9);
	const empty = buildHeat(anchors, [], {});
	assert.equal(empty.max, 0);
	assert.ok(empty.items.every((h) => h.intensity === 0));
	assert.equal(heatKey("mailto:x@y.z"), null);
});

test("heatColor runs cool to hot", () => {
	assert.deepEqual(heatColor(0), [59, 130, 246]);
	assert.deepEqual(heatColor(1), [220, 38, 38]);
	assert.deepEqual(heatColor(7), [220, 38, 38]);
});

test("duplicate links carry their position, and removeTracking puts the original URL back", async () => {
	process.env.BETTER_AUTH_SECRET ??= "test-session-secret-with-at-least-32-characters";
	const { addTracking, removeTracking } = await import("../lib/tracking.js");
	const html = `<a href="https://n0.pub">a</a> <a href="https://x.io">b</a> <a href="https://n0.pub">c</a>`;
	const tracked = addTracking(html, { baseUrl: "https://mail.test", messageId: "6added3806e944f8a800df8a" });
	assert.equal((tracked.match(/\?n=1"/g) ?? []).length, 1);
	assert.equal((tracked.match(/\?n=2"/g) ?? []).length, 1);
	assert.equal((tracked.match(/\?n=/g) ?? []).length, 2);
	assert.ok(removeTracking(tracked).includes(html));
});
