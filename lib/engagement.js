// Custom (bubuMMMM): each contact's engagement score from human opens and clicks (lib/engagement-rules.js), and the
// inactive contacts the user can, after confirming, unsubscribe or put to sleep. Nothing happens without that action.
import "server-only";
import mongoose from "mongoose";
import { scoped } from "@/lib/account-scope";
import { connectDb } from "@/lib/db";
import { engagementScore, isInactive, WINDOW_DAYS } from "@/lib/engagement-rules";
import Contact from "@/models/Contact";
import Message from "@/models/Message";
import TrackingHit from "@/models/TrackingHit";

const DAY = 86_400_000;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
export const MAX_ROWS = 5000;

async function engagementFor(accountId, contactIds, { now, days }) {
	const since = new Date(now - Math.max(days, WINDOW_DAYS) * DAY);
	const windowStart = new Date(now - WINDOW_DAYS * DAY);
	const periodStart = new Date(now - days * DAY);
	const [sends, hits] = await Promise.all([
		Message.aggregate([
			{ $match: { accountId, contactId: { $in: contactIds }, kind: "campaign", sentAt: { $gte: since } } },
			{
				$group: {
					_id: "$contactId",
					window: { $sum: { $cond: [{ $gte: ["$sentAt", windowStart] }, 1, 0] } },
					period: { $sum: { $cond: [{ $gte: ["$sentAt", periodStart] }, 1, 0] } },
				},
			},
		]),
		TrackingHit.aggregate([
			{ $match: { accountId, contactId: { $in: contactIds }, machine: null } },
			{
				$group: {
					_id: "$contactId",
					lastAt: { $max: "$at" },
					opened: { $addToSet: { $cond: [{ $and: [{ $eq: ["$type", "open"] }, { $gte: ["$at", windowStart] }] }, "$messageId", null] } },
					clicked: { $addToSet: { $cond: [{ $and: [{ $eq: ["$type", "click"] }, { $gte: ["$at", windowStart] }] }, "$messageId", null] } },
				},
			},
		]),
	]);
	const bySend = new Map(sends.map((s) => [String(s._id), s]));
	const byHit = new Map(hits.map((h) => [String(h._id), h]));
	return (id) => {
		const s = bySend.get(String(id));
		const h = byHit.get(String(id));
		const stats = {
			sends: s?.window ?? 0,
			sendsInPeriod: s?.period ?? 0,
			opened: (h?.opened ?? []).filter(Boolean).length,
			clicked: (h?.clicked ?? []).filter(Boolean).length,
			lastAt: h?.lastAt ?? null,
		};
		return { ...stats, score: engagementScore({ ...stats, now }) };
	};
}

export async function listEngagement(account, newsletterId, { days = 90, minSends = 3, now = Date.now() } = {}) {
	await connectDb();
	const accountId = oid(account._id);
	const contacts = await Contact.find(scoped(account, { newsletterId: oid(newsletterId), status: { $in: ["active", "dormant", "pending"] } }))
		.select({ email: 1, firstName: 1, status: 1, createdAt: 1 })
		.limit(MAX_ROWS)
		.lean();
	const read = await engagementFor(accountId, contacts.map((c) => c._id), { now, days });
	return contacts.map((c) => {
		const e = read(c._id);
		return {
			id: String(c._id),
			email: c.email,
			firstName: c.firstName ?? "",
			status: c.status,
			...e,
			lastAt: e.lastAt ? new Date(e.lastAt).toISOString() : null,
			inactive: c.status === "active" && isInactive({ ...e, now }, { minSends, days }),
		};
	});
}

export async function getContactEngagement(account, contactId, { now = Date.now() } = {}) {
	await connectDb();
	const read = await engagementFor(oid(account._id), [oid(contactId)], { now, days: WINDOW_DAYS });
	return read(contactId);
}

// The user's explicit choice from the confirmation dialog: only contacts still matching as inactive change.
export async function actOnInactive(account, user, { newsletterId, contactIds, action, days, minSends }) {
	const rows = await listEngagement(account, newsletterId, { days, minSends });
	const allowed = new Set(rows.filter((r) => r.inactive).map((r) => r.id));
	const ids = [...new Set(contactIds.map(String))].filter((id) => allowed.has(id)).map(oid);
	if (ids.length === 0) return { changed: 0 };
	const status = action === "unsubscribe" ? "unsubscribed" : "dormant";
	// Through upstream's own status change, one contact at a time, so each keeps its history and dates.
	const { changeContactStatus } = await import("@/lib/contacts");
	const contacts = await Contact.find(scoped(account, { _id: { $in: ids }, status: "active" })).lean();
	let changed = 0;
	for (const contact of contacts) {
		const result = await changeContactStatus({ account, contact, status, consent: false, actor: { via: "dashboard", userId: user?.id } });
		if (!result.problem) changed++;
	}
	return { changed };
}
