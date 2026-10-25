import assert from "node:assert/strict";
import test from "node:test";
import { clampConfig, pickWinner, sampleSize, variantOf } from "../lib/ab-test-rules.js";
import { engagementScore, isInactive, scoreLabel } from "../lib/engagement-rules.js";
import { buildHeat, heatKey } from "../lib/heatmap-rules.js";

const DAY = 86_400_000;

test("A/B: variants are stable and split about evenly", () => {
	assert.equal(variantOf("abc"), variantOf("abc"));
	let b = 0;
	for (let i = 0; i < 2000; i++) if (variantOf(`c${i}`) === "B") b++;
	assert.ok(b > 900 && b < 1100, `B got ${b}`);
});
test("A/B: config is clamped", () => {
	const c = clampConfig({ samplePct: 90, waitHours: 0, metric: "x" });
	assert.deepEqual([c.samplePct, c.waitHours, c.metric], [50, 1, "opens"]);
});
test("A/B: sample size", () => {
	assert.equal(sampleSize(1000, 20), 200);
	assert.equal(sampleSize(3, 10), 2);
	assert.equal(sampleSize(0, 10), 0);
});
test("A/B: winner by rate, tie keeps A", () => {
	assert.equal(pickWinner({ A: { sent: 100, opens: 30 }, B: { sent: 50, opens: 20 } }, "opens"), "B");
	assert.equal(pickWinner({ A: { sent: 10, clicks: 1 }, B: { sent: 10, clicks: 1 } }, "clicks"), "A");
});
test("engagement: recent and frequent scores high, none is null", () => {
	const now = Date.now();
	assert.equal(engagementScore({ now }), null);
	assert.equal(engagementScore({ sends: 4, opened: 4, clicked: 2, lastAt: new Date(now), now }), 100);
	assert.equal(engagementScore({ sends: 5, lastAt: null, now }), 0);
	const mid = engagementScore({ sends: 4, opened: 1, lastAt: new Date(now - 45 * DAY), now });
	assert.ok(mid > 20 && mid < 40, String(mid));
	assert.equal(scoreLabel(80), "Très engagé");
});
test("engagement: inactive needs enough sends and no recent human engagement", () => {
	const now = Date.now();
	assert.equal(isInactive({ sendsInPeriod: 2, now }, { minSends: 3 }), false);
	assert.equal(isInactive({ sendsInPeriod: 5, lastAt: null, now }), true);
	assert.equal(isInactive({ sendsInPeriod: 5, lastAt: new Date(now - 10 * DAY), now }, { days: 30 }), false);
});
test("heatmap: keys ignore tracking params and trailing slashes", () => {
	assert.equal(heatKey("https://www.n0.pub/?utm_source=x"), heatKey("https://n0.pub"));
	assert.equal(heatKey("https://a.com/x/#top"), heatKey("https://a.com/x"));
	assert.equal(buildHeat([], []).max, 0);
});
