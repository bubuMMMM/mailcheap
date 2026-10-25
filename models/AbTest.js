// Custom (bubuMMMM): a campaign's A/B test (lib/ab-test.js).
import mongoose from "mongoose";
import { accountScoped } from "../lib/account-scope.js";

const abTestSchema = new mongoose.Schema(
	{
		campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
		enabled: { type: Boolean, default: false },
		subjectB: { type: String, default: "" },
		htmlB: { type: String, default: "" },
		samplePct: { type: Number, default: 20 },
		metric: { type: String, enum: ["opens", "clicks"], default: "opens" },
		waitHours: { type: Number, default: 4 },
		// draft: being set up; testing: the sample went out; decided: the winner is known (and sent to the rest).
		status: { type: String, enum: ["draft", "testing", "decided"], default: "draft" },
		sampleSize: Number,
		startedAt: Date,
		decideAt: Date,
		decidedAt: Date,
		decidedBy: { type: String, enum: ["auto", "manual"] },
		winner: { type: String, enum: ["A", "B"] },
		// Variant A as it was, when B won and became the campaign's content.
		original: { subject: String, html: String },
		results: { type: mongoose.Schema.Types.Mixed },
		restSent: { type: Boolean, default: false },
		lastError: String,
	},
	{ timestamps: true, versionKey: false }
);

abTestSchema.plugin(accountScoped);
abTestSchema.index({ accountId: 1, campaignId: 1 }, { unique: true });

export default mongoose.models.AbTest || mongoose.model("AbTest", abTestSchema);
