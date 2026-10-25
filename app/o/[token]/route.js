import { after } from "next/server";
import { findTrackedMessage, recordEngagement } from "@/lib/email-events";
import { readOpenToken } from "@/lib/tracking";
import { recordHit } from "@/lib/tracking-hits";

// A 1×1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// The image always loads; the open is recorded after the response, so readers never wait on it.
export async function GET(request, { params }) {
	const messageId = readOpenToken((await params).token);
	if (messageId) {
		after(() =>
			findTrackedMessage(messageId)
				.then((message) => Promise.all([recordEngagement({ message, type: "Open" }), recordHit({ message, type: "open", headers: request.headers })]))
				.catch((error) => console.error("[tracking] Open not recorded:", error))
		);
	}
	return new Response(PIXEL, {
		headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" },
	});
}
