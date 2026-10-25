// Custom (bubuMMMM): A/B test rules with no server dependency, so they're unit tested (tests/ab-test-rules.test.mjs).
import { createHash } from "node:crypto";

export const AB_LIMITS = { minPct: 10, maxPct: 50, minHours: 1, maxHours: 24 };
export const AB_METRICS = ["opens", "clicks"];

// Each contact always gets the same variant: half of the test sample each, by a stable hash of its id.
export function variantOf(contactId) {
	if (!contactId) return "A";
	return createHash("sha1").update(String(contactId)).digest()[0] % 2 === 0 ? "A" : "B";
}

export function clampConfig(input = {}) {
	const pct = Math.round(Number(input.samplePct ?? 20));
	const hours = Math.round(Number(input.waitHours ?? 4));
	return {
		enabled: Boolean(input.enabled),
		subjectB: String(input.subjectB ?? "").trim().slice(0, 300),
		htmlB: String(input.htmlB ?? "").slice(0, 500_000),
		samplePct: Math.min(AB_LIMITS.maxPct, Math.max(AB_LIMITS.minPct, Number.isFinite(pct) ? pct : 20)),
		metric: AB_METRICS.includes(input.metric) ? input.metric : "opens",
		waitHours: Math.min(AB_LIMITS.maxHours, Math.max(AB_LIMITS.minHours, Number.isFinite(hours) ? hours : 4)),
	};
}

export function hasVariantB(config) {
	return Boolean(config?.subjectB || config?.htmlB?.trim());
}

// At least one email per variant.
export function sampleSize(audience, pct) {
	if (!audience) return 0;
	return Math.min(audience, Math.max(2, Math.ceil((audience * pct) / 100)));
}

// stats: { A: { sent, opens, clicks }, B: {...} } in unique human readers. Rates compare; a tie keeps A.
export function pickWinner(stats, metric) {
	const rate = (v) => (v.sent ? v[metric] / v.sent : 0);
	return rate(stats.B) > rate(stats.A) ? "B" : "A";
}
