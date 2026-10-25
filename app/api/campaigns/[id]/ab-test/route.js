// Custom (bubuMMMM): the campaign page's A/B test (lib/ab-test.js).
import { isValidObjectId } from "mongoose";
import { scoped } from "@/lib/account-scope";
import { decideAbTest, getAbStats, getAbTest, saveAbTest } from "@/lib/ab-test";
import { getCurrentAccount } from "@/lib/auth";
import Campaign from "@/models/Campaign";

async function load(params) {
	const current = await getCurrentAccount();
	if (!current) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
	const { id } = await params;
	if (!isValidObjectId(id)) return { error: Response.json({ error: "Not found" }, { status: 404 }) };
	const campaign = await Campaign.findOne(scoped(current.account, { _id: id })).lean();
	if (!campaign) return { error: Response.json({ error: "Not found" }, { status: 404 }) };
	return { account: current.account, campaign };
}

function sameOrigin(request) {
	const site = request.headers.get("sec-fetch-site");
	return !site || site === "same-origin";
}

export async function GET(_request, { params }) {
	const { error, account, campaign } = await load(params);
	if (error) return error;
	const test = await getAbTest(account, campaign._id);
	const stats = test && test.status !== "draft" ? await getAbStats(account, test) : null;
	return Response.json({ test, stats });
}

export async function PUT(request, { params }) {
	if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
	const { error, account, campaign } = await load(params);
	if (error) return error;
	try {
		return Response.json({ test: await saveAbTest(account, campaign, await request.json()) });
	} catch (e) {
		return Response.json({ error: e.message }, { status: 400 });
	}
}

// { action: "send-winner" }: decides now and sends the winner to the rest.
export async function POST(request, { params }) {
	if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
	const { error, account, campaign } = await load(params);
	if (error) return error;
	try {
		return Response.json(await decideAbTest({ accountId: account._id, campaignId: campaign._id, manual: true }));
	} catch (e) {
		return Response.json({ error: e.message }, { status: 409 });
	}
}
