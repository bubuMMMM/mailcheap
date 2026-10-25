// Custom (bubuMMMM): A/B tests on campaigns. The sample (samplePct of the audience, upstream's audienceLimit: the most
// engaged contacts first) goes out split A/B by contact; after waitHours, the variant with the better unique human
// open or click rate wins, becomes the campaign's content, and goes to the rest through upstream's "send to more".
import "server-only";
import mongoose from "mongoose";
import { scoped } from "@/lib/account-scope";
import { clampConfig, hasVariantB, pickWinner, sampleSize, variantOf } from "@/lib/ab-test-rules";
import { getAppUrl } from "@/lib/config";
import { connectDb } from "@/lib/db";
import AbTest from "@/models/AbTest";
import Campaign from "@/models/Campaign";
import Message from "@/models/Message";
import TrackingHit from "@/models/TrackingHit";

const oid = (v) => new mongoose.Types.ObjectId(String(v));

export async function getAbTest(account, campaignId) {
	await connectDb();
	return AbTest.findOne(scoped(account, { campaignId: oid(campaignId) })).lean();
}

export async function saveAbTest(account, campaign, input) {
	if (!["draft", "scheduled"].includes(campaign.status)) throw new Error("La campagne est déjà partie");
	const existing = await getAbTest(account, campaign._id);
	if (existing && existing.status !== "draft") throw new Error("Le test a déjà commencé");
	const config = clampConfig(input);
	if (config.enabled && !hasVariantB(config)) throw new Error("Ajoutez un sujet ou un contenu B");
	return AbTest.findOneAndUpdate(
		scoped(account, { campaignId: campaign._id }),
		{ $set: config, $setOnInsert: { status: "draft" } },
		{ upsert: true, new: true }
	).lean();
}

// Hook (lib/sending.js queueCampaign): a campaign with an A/B test goes out to its sample first.
export async function startAbTestIfAny(campaign) {
	const test = await AbTest.findOne({ accountId: campaign.accountId, campaignId: campaign._id, enabled: true, status: "draft" }).lean();
	if (!test || !hasVariantB(test)) return;
	const { countAudience, findCampaignSegmentFilter } = await import("@/lib/segment-queries");
	const { contacts } = await countAudience(campaign.accountId, campaign.newsletterId, await findCampaignSegmentFilter(campaign));
	const size = sampleSize(contacts, test.samplePct);
	if (size < 2 || size >= contacts) return;
	const now = new Date();
	const decideAt = new Date(now.getTime() + test.waitHours * 3600_000);
	campaign.audienceLimit = size;
	await Campaign.updateOne({ accountId: campaign.accountId, _id: campaign._id }, { $set: { audienceLimit: size } });
	await AbTest.updateOne({ accountId: test.accountId, _id: test._id }, { $set: { status: "testing", sampleSize: size, startedAt: now, decideAt } });
	await scheduleDecision({ accountId: campaign.accountId, campaignId: campaign._id, decideAt });
}

async function scheduleDecision({ accountId, campaignId, decideAt }) {
	try {
		const { publishJob } = await import("@/lib/sending");
		await publishJob({
			url: `${getAppUrl()}/api/jobs/ab-decide`,
			body: { accountId: String(accountId), campaignId: String(campaignId) },
			notBefore: Math.floor(decideAt.getTime() / 1000),
			retries: 3,
		});
	} catch (error) {
		// Without QStash the report offers "Envoyer le gagnant maintenant".
		await AbTest.updateOne({ accountId, campaignId }, { $set: { lastError: `Décision automatique impossible : ${String(error?.message ?? error).slice(0, 200)}` } });
	}
}

// Hook (lib/sending.js deliver): during the test, contacts on side B get B's subject and content.
const cache = new Map();
export async function withAbVariant(content, message) {
	if (message.kind !== "campaign" || !message.campaignId || !message.contactId) return content;
	const key = String(message.campaignId);
	let entry = cache.get(key);
	if (!entry || Date.now() - entry.at > 30_000) {
		const test = await AbTest.findOne({ accountId: message.accountId, campaignId: message.campaignId }).select({ status: 1, subjectB: 1, htmlB: 1 }).lean();
		entry = { at: Date.now(), test };
		cache.set(key, entry);
		if (cache.size > 200) cache.delete(cache.keys().next().value);
	}
	const { test } = entry;
	if (test?.status !== "testing" || variantOf(message.contactId) !== "B") return content;
	return { ...content, subject: test.subjectB || content.subject, html: test.htmlB?.trim() ? test.htmlB : content.html };
}

// Unique human readers per variant among the sample's emails.
export async function getAbStats(account, test) {
	const accountId = oid(account._id ?? account);
	const cutoff = test.decidedAt ?? new Date();
	const messages = await Message.find({ accountId, campaignId: test.campaignId, kind: "campaign", createdAt: { $lte: cutoff } })
		.select({ contactId: 1, sentAt: 1 })
		.lean();
	const side = new Map(messages.map((m) => [String(m._id), variantOf(m.contactId)]));
	const stats = { A: { sent: 0, opens: 0, clicks: 0 }, B: { sent: 0, opens: 0, clicks: 0 } };
	for (const m of messages) if (m.sentAt) stats[side.get(String(m._id))].sent++;
	const hits = await TrackingHit.aggregate([
		{ $match: { accountId, campaignId: test.campaignId, machine: null, messageId: { $in: messages.map((m) => m._id) } } },
		{ $group: { _id: { m: "$messageId", t: "$type" } } },
	]);
	for (const h of hits) {
		const v = side.get(String(h._id.m));
		if (v) stats[v][h._id.t === "open" ? "opens" : "clicks"]++;
	}
	return stats;
}

// Picks the winner (once) and sends it to the rest. manual: the "send winner now" button, before the wait is over.
export async function decideAbTest({ accountId, campaignId, manual = false }) {
	await connectDb();
	const account = { _id: oid(accountId) };
	const test = await getAbTest(account, campaignId);
	if (!test || test.status === "draft") return { skipped: "no test" };
	if (test.status === "testing" && !manual && test.decideAt > new Date()) return { skipped: "too early" };
	const campaign = await Campaign.findOne(scoped(account, { _id: campaignId })).lean();
	if (!campaign) return { skipped: "no campaign" };

	let winner = test.winner;
	if (test.status === "testing") {
		const stats = await getAbStats(account, test);
		winner = pickWinner(stats, test.metric);
		const set = { status: "decided", winner, decidedAt: new Date(), decidedBy: manual ? "manual" : "auto", results: stats };
		const content = winner === "B" ? { ...(test.subjectB && { subject: test.subjectB }), ...(test.htmlB?.trim() && { html: test.htmlB }) } : {};
		if (Object.keys(content).length) set.original = { subject: campaign.subject, html: campaign.html };
		// Claim the decision first so a retry never overwrites the stored original.
		const { modifiedCount } = await AbTest.updateOne({ accountId: test.accountId, _id: test._id, status: "testing" }, { $set: set });
		if (!modifiedCount) return { skipped: "already decided" };
		if (Object.keys(content).length) await Campaign.updateOne(scoped(account, { _id: campaign._id }), { $set: content });
		cache.delete(String(campaignId));
	}
	if (test.restSent) return { winner, skipped: "rest already sent" };
	if (campaign.status !== "sent") {
		const message = "L’envoi de l’échantillon n’est pas terminé : le gagnant partira quand il le sera.";
		await AbTest.updateOne({ accountId: test.accountId, _id: test._id }, { $set: { lastError: message } });
		if (manual) throw new Error(message);
		throw new Error("sample still sending");
	}
	const { sendToMoreContacts } = await import("@/lib/sending");
	try {
		const result = await sendToMoreContacts({ accountId: account._id, campaignId: campaign._id });
		await AbTest.updateOne({ accountId: test.accountId, _id: test._id }, { $set: { restSent: true }, $unset: { lastError: 1 } });
		return { winner, ...result };
	} catch (error) {
		await AbTest.updateOne({ accountId: test.accountId, _id: test._id }, { $set: { lastError: String(error?.message ?? error).slice(0, 300) } });
		throw error;
	}
}
