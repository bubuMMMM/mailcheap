import assert from "node:assert/strict";
import test from "node:test";
import { classifyHit } from "../lib/ua-classify.js";

test("Apple MPP opens are machines", () => {
	assert.equal(classifyHit({ type: "open", userAgent: "Mozilla/5.0", ip: "17.58.1.2" }).machine, "apple-mpp");
});
test("Gmail proxy opens count, as Gmail", () => {
	const r = classifyHit({ type: "open", userAgent: "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)", ip: "66.249.1.1" });
	assert.equal(r.machine, null);
	assert.equal(r.client, "Gmail");
});
test("iPhone Safari click is a mobile reader", () => {
	const r = classifyHit({ type: "click", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", sentAt: new Date(Date.now() - 3600e3) });
	assert.deepEqual([r.machine, r.device, r.os, r.client], [null, "Mobile", "iOS", "Safari"]);
});
test("clicks right after sending are prefetch", () => {
	assert.equal(classifyHit({ type: "click", userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120", sentAt: new Date() }).machine, "prefetch");
});
test("scanners", () => {
	assert.equal(classifyHit({ type: "click", userAgent: "Mimecast Link Scanner" }).machine, "scanner");
});
