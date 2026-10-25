// Custom (bubuMMMM): QStash wakes this when an A/B test's wait is over (lib/ab-test.js).
import { NextResponse } from "next/server";
import { decideAbTest } from "@/lib/ab-test";
import { withQStashSignature } from "@/lib/qstash-route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A sample still going out throws, so QStash tries again later.
async function handle(request) {
	const body = await request.json().catch(() => null);
	const result = await decideAbTest({ accountId: body?.accountId, campaignId: body?.campaignId });
	console.info(`[ab-decide] ${JSON.stringify({ campaignId: body?.campaignId, ...result })}`);
	return NextResponse.json(result);
}

export const POST = withQStashSignature(handle);
