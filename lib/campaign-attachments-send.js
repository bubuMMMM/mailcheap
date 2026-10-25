// Custom (bubuMMMM): adds a campaign's attachments to each of its emails, and its tests: real attachments on SES,
// download links on providers without them. Without any, the email goes out unchanged.
import "server-only";
import { appendAttachmentLinks, loadAttachmentsForSend } from "@/lib/campaign-attachments";

const KINDS = new Set(["campaign", "test"]);

export async function withAttachments(email, message, provider) {
	if (!KINDS.has(message.kind) || !message.campaignId) return email;
	const files = await loadAttachmentsForSend(message.accountId, message.campaignId);
	if (files.length === 0) return email;
	return provider.id === "ses" ? { ...email, attachments: files } : appendAttachmentLinks(email, files);
}
