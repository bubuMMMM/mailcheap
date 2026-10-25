// Custom (bubuMMMM): unsubscribes or puts to sleep the inactive contacts the user ticked and confirmed (lib/engagement.js).
import { isValidObjectId } from "mongoose";
import { getCurrentAccount } from "@/lib/auth";
import { actOnInactive } from "@/lib/engagement";

export async function POST(request) {
	const site = request.headers.get("sec-fetch-site");
	if (site && site !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
	const current = await getCurrentAccount();
	if (!current) return Response.json({ error: "Unauthorized" }, { status: 401 });
	const body = await request.json().catch(() => ({}));
	if (body.confirm !== true) return Response.json({ error: "Confirmation requise" }, { status: 400 });
	if (!isValidObjectId(body.newsletterId) || !Array.isArray(body.contactIds) || body.contactIds.length > 5000) {
		return Response.json({ error: "Requête invalide" }, { status: 400 });
	}
	if (!["unsubscribe", "dormant"].includes(body.action)) return Response.json({ error: "Action inconnue" }, { status: 400 });
	const result = await actOnInactive(current.account, current.user, {
		newsletterId: body.newsletterId,
		contactIds: body.contactIds.filter(isValidObjectId),
		action: body.action,
		days: Math.min(365, Math.max(7, Number(body.days) || 90)),
		minSends: Math.min(50, Math.max(1, Number(body.minSends) || 3)),
	});
	return Response.json(result);
}
