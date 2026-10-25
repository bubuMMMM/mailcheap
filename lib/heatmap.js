// Custom (bubuMMMM): a campaign's clicks per link (URL and position), for readers only and for every hit, with how many
// people clicked at all. Feeds lib/heatmap-rules.js.
import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import TrackingHit from "@/models/TrackingHit";

export async function getHeatmapData(account, campaignId) {
	await connectDb();
	const match = { accountId: new mongoose.Types.ObjectId(String(account._id ?? account)), campaignId: new mongoose.Types.ObjectId(String(campaignId)), type: "click" };
	const [facet] = await TrackingHit.aggregate([
		{ $match: match },
		{
			$facet: {
				links: [
					{ $addFields: { human: { $eq: [{ $ifNull: ["$machine", null] }, null] } } },
					{
						$group: {
							_id: { url: "$url", pos: { $ifNull: ["$pos", null] } },
							total: { $sum: 1 },
							humanTotal: { $sum: { $cond: ["$human", 1, 0] } },
							people: { $addToSet: "$messageId" },
							humanPeople: { $addToSet: { $cond: ["$human", "$messageId", "$$REMOVE"] } },
						},
					},
					{ $project: { total: 1, humanTotal: 1, unique: { $size: "$people" }, humanUnique: { $size: "$humanPeople" } } },
					{ $limit: 1000 },
				],
				clickers: [{ $group: { _id: { $eq: [{ $ifNull: ["$machine", null] }, null] }, people: { $addToSet: "$messageId" } } }],
			},
		},
	]);
	const people = (human) => facet.clickers.filter((c) => !human || c._id).reduce((set, c) => (c.people.forEach((p) => set.add(String(p))), set), new Set()).size;
	return {
		rows: facet.links.map((l) => ({
			url: l._id.url,
			pos: l._id.pos,
			human: { unique: l.humanUnique, total: l.humanTotal },
			all: { unique: l.unique, total: l.total },
		})),
		clickers: { human: people(true), all: people(false) },
	};
}
