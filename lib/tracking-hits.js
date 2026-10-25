// Custom (bubuMMMM): records each open and click (models/TrackingHit.js) and builds the detailed report from them.
import "server-only";
import mongoose from "mongoose";
import { readCountry } from "@/lib/countries";
import { connectDb } from "@/lib/db";
import { classifyHit } from "@/lib/ua-classify";
import TrackingHit from "@/models/TrackingHit";

function readIp(headers) {
	return String(headers?.get("x-forwarded-for") ?? "").split(",")[0].trim();
}

// Never throws: tracking must not break the pixel or the redirect.
export async function recordHit({ message, type, headers, url = null, pos = null }) {
	try {
		if (!message?._id || !message.accountId) return;
		await connectDb();
		const sentAt = message.sentAt ?? null;
		const now = Date.now();
		const info = classifyHit({ type, userAgent: headers?.get("user-agent") ?? "", ip: readIp(headers), sentAt, now });
		await TrackingHit.create({
			accountId: message.accountId,
			type,
			at: new Date(now),
			messageId: message._id,
			campaignId: message.campaignId,
			contactId: message.contactId,
			url: url ? String(url).slice(0, 2000) : undefined,
			...(pos && { pos }),
			...info,
			country: readCountry(headers),
			secondsAfterSend: sentAt ? Math.max(0, Math.round((now - new Date(sentAt).getTime()) / 1000)) : undefined,
		});
	} catch (error) {
		console.error("[tracking] Hit not recorded:", error);
	}
}

function oid(value) {
	return new mongoose.Types.ObjectId(String(value));
}

function top(rows, limit = 6) {
	return rows
		.filter((r) => r._id)
		.sort((a, b) => b.n - a.n)
		.slice(0, limit)
		.map((r) => ({ label: r._id, value: r.n }));
}

// Everything the detailed report shows for one campaign; machine hits only as their own counts.
export async function getCampaignTracking(account, campaignId) {
	await connectDb();
	const match = { accountId: oid(account._id ?? account), campaignId: oid(campaignId) };
	const [facet] = await TrackingHit.aggregate([
		{ $match: match },
		{
			$facet: {
				totals: [{ $group: { _id: { type: "$type", machine: "$machine" }, n: { $sum: 1 }, people: { $addToSet: "$messageId" } } }],
				timeline: [
					{ $match: { machine: null } },
					{ $group: { _id: { type: "$type", h: { $dateTrunc: { date: "$at", unit: "hour" } } }, n: { $sum: 1 } } },
					{ $sort: { "_id.h": 1 } },
				],
				devices: [{ $match: { machine: null } }, { $group: { _id: "$device", n: { $sum: 1 } } }],
				os: [{ $match: { machine: null } }, { $group: { _id: "$os", n: { $sum: 1 } } }],
				clients: [{ $match: { machine: null, type: "open" } }, { $group: { _id: "$client", n: { $sum: 1 } } }],
				countries: [{ $match: { machine: null } }, { $group: { _id: "$country", n: { $sum: 1 } } }],
				links: [
					{ $match: { machine: null, type: "click" } },
					{ $group: { _id: "$url", n: { $sum: 1 }, people: { $addToSet: "$messageId" } } },
					{ $project: { n: 1, unique: { $size: "$people" } } },
					{ $sort: { n: -1 } },
					{ $limit: 100 },
				],
				firstOpens: [
					{ $match: { machine: null, type: "open", secondsAfterSend: { $ne: null } } },
					{ $group: { _id: "$messageId", s: { $min: "$secondsAfterSend" } } },
					{ $sort: { s: 1 } },
					{ $group: { _id: null, all: { $push: "$s" } } },
				],
				recent: [
					{ $sort: { at: -1 } },
					{ $limit: 12 },
					{ $lookup: { from: "messages", localField: "messageId", foreignField: "_id", as: "m", pipeline: [{ $project: { email: 1 } }] } },
					{ $project: { type: 1, at: 1, url: 1, device: 1, os: 1, client: 1, country: 1, machine: 1, email: { $first: "$m.email" } } },
				],
			},
		},
	  ]);

	const count = (type, human) =>
		facet.totals
			.filter((t) => t._id.type === type && (human ? t._id.machine === null : t._id.machine !== null))
			.reduce((acc, t) => ({ total: acc.total + t.n, unique: acc.unique + t.people.length }), { total: 0, unique: 0 });
	const machineBy = (reason) => facet.totals.filter((t) => t._id.machine === reason).reduce((s, t) => s + t.n, 0);
	const delays = facet.firstOpens[0]?.all ?? [];
	const median = delays.length ? delays[Math.floor(delays.length / 2)] : null;

	const hours = new Map();
	for (const row of facet.timeline) {
		const key = row._id.h.toISOString();
		const entry = hours.get(key) ?? { at: key, open: 0, click: 0 };
		entry[row._id.type] = row.n;
		hours.set(key, entry);
	}

	return {
		opens: count("open", true),
		clicks: count("click", true),
		machine: { appleMpp: machineBy("apple-mpp"), scanner: machineBy("scanner"), prefetch: machineBy("prefetch") },
		medianSecondsToOpen: median,
		timeline: [...hours.values()],
		devices: top(facet.devices),
		os: top(facet.os),
		clients: top(facet.clients),
		countries: top(facet.countries),
		links: facet.links.map((l) => ({ url: l._id, total: l.n, unique: l.unique })),
		recent: facet.recent.map((r) => ({ ...r, _id: String(r._id), at: r.at.toISOString() })),
	};
}

export async function getContactTracking(account, contactId, limit = 50) {
	await connectDb();
	const rows = await TrackingHit.find({ accountId: oid(account._id ?? account), contactId: oid(contactId) })
		.sort({ at: -1 })
		.limit(limit)
		.lean();
	return rows.map((r) => ({ ...r, _id: String(r._id), at: r.at.toISOString(), campaignId: r.campaignId ? String(r.campaignId) : null }));
}
