// Custom (bubuMMMM): the campaign editor's attachments (lib/campaign-attachments.js).
import { isValidObjectId } from "mongoose";
import { scoped } from "@/lib/account-scope";
import { getCurrentAccount } from "@/lib/auth";
import { addAttachment, listAttachments, MAX_FILE_BYTES, removeAttachment } from "@/lib/campaign-attachments";
import Campaign from "@/models/Campaign";

async function load(params, { forEdit = false } = {}) {
	const current = await getCurrentAccount();
	if (!current) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
	const { id } = await params;
	if (!isValidObjectId(id)) return { error: Response.json({ error: "Not found" }, { status: 404 }) };
	const campaign = await Campaign.findOne(scoped(current.account, { _id: id })).select({ status: 1 }).lean();
	if (!campaign) return { error: Response.json({ error: "Not found" }, { status: 404 }) };
	if (forEdit && !["draft", "scheduled"].includes(campaign.status)) {
		return { error: Response.json({ error: "La campagne est déjà partie" }, { status: 409 }) };
	}
	return { account: current.account, campaignId: id };
}

export async function GET(_request, { params }) {
	const { error, account, campaignId } = await load(params);
	if (error) return error;
	return Response.json({ attachments: await listAttachments(account, campaignId) });
}

export async function POST(request, { params }) {
	const site = request.headers.get("sec-fetch-site");
	if (site && site !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
	const { error, account, campaignId } = await load(params, { forEdit: true });
	if (error) return error;
	const bytes = Buffer.from(await request.arrayBuffer());
	if (bytes.length > MAX_FILE_BYTES) return Response.json({ error: "Chaque fichier doit faire moins de 4 Mo" }, { status: 413 });
	try {
		const attachment = await addAttachment(account, campaignId, {
			name: decodeURIComponent(request.headers.get("x-file-name") ?? "fichier"),
			contentType: request.headers.get("content-type"),
			bytes,
		});
		return Response.json({ attachment }, { status: 201 });
	} catch (e) {
		return Response.json({ error: e.message }, { status: 400 });
	}
}

export async function DELETE(request, { params }) {
	const { error, account, campaignId } = await load(params, { forEdit: true });
	if (error) return error;
	const attachmentId = new URL(request.url).searchParams.get("attachment");
	if (!isValidObjectId(attachmentId)) return Response.json({ error: "Not found" }, { status: 404 });
	const ok = await removeAttachment(account, campaignId, attachmentId);
	return ok ? new Response(null, { status: 204 }) : Response.json({ error: "Not found" }, { status: 404 });
}
