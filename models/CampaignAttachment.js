// Custom (bubuMMMM): files attached to a campaign, sent with each email (lib/campaign-attachments.js).
import mongoose from "mongoose";
import { accountScoped } from "../lib/account-scope.js";

const campaignAttachmentSchema = new mongoose.Schema(
	{
		campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
		name: { type: String, required: true },
		contentType: { type: String, required: true },
		bytes: { type: Number, required: true },
		url: { type: String, required: true },
	},
	{ timestamps: true, versionKey: false }
);

campaignAttachmentSchema.plugin(accountScoped);
campaignAttachmentSchema.index({ accountId: 1, campaignId: 1, createdAt: 1 });

export default mongoose.models.CampaignAttachment || mongoose.model("CampaignAttachment", campaignAttachmentSchema);
