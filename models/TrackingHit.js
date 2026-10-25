// Custom (bubuMMMM): every open and click as it happened, for the detailed campaign and contact reports.
// Message keeps the first open and click (upstream); this keeps each one, with what made it.
import mongoose from "mongoose";
import { accountScoped } from "../lib/account-scope.js";

const trackingHitSchema = new mongoose.Schema(
	{
		type: { type: String, enum: ["open", "click"], required: true },
		at: { type: Date, default: Date.now },
		messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
		campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
		contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact" },
		url: String,
		device: String,
		os: String,
		client: String,
		country: String,
		// null for a reader; apple-mpp, scanner or prefetch for machines, which the report leaves out.
		machine: { type: String, default: null },
		secondsAfterSend: Number,
	},
	{ versionKey: false }
);

trackingHitSchema.plugin(accountScoped);
trackingHitSchema.index({ accountId: 1, campaignId: 1, at: 1 });
trackingHitSchema.index({ accountId: 1, contactId: 1, at: -1 });
// Kept a year.
trackingHitSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.models.TrackingHit || mongoose.model("TrackingHit", trackingHitSchema);
