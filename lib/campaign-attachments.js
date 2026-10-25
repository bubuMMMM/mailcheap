// Custom (bubuMMMM): campaign attachments. Files live on Vercel Blob; each email carries them as real MIME
// attachments on SES. PostShiba's inject API takes no attachments, so its emails list them as download links.
import "server-only";
import { del, put } from "@vercel/blob";
import mongoose from "mongoose";
import { scoped } from "@/lib/account-scope";
import { connectDb } from "@/lib/db";
import CampaignAttachment from "@/models/CampaignAttachment";

// Vercel stops a request body at 4.5 MB; SES takes 40 MB per email, but readers' inboxes often refuse past ~10 MB.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 10;
// Types inboxes accept; SES refuses executables anyway.
const BLOCKED = /\.(exe|bat|cmd|com|scr|js|vbs|msi|jar|ps1|sh|app|dll)$/i;

function oid(value) {
	return new mongoose.Types.ObjectId(String(value));
}

function toItem(a) {
	return { id: String(a._id), name: a.name, contentType: a.contentType, bytes: a.bytes, url: a.url };
}

export async function listAttachments(account, campaignId) {
	await connectDb();
	const rows = await CampaignAttachment.find(scoped(account, { campaignId: oid(campaignId) })).sort({ createdAt: 1 }).lean();
	return rows.map(toItem);
}

export async function addAttachment(account, campaignId, { name, contentType, bytes }) {
	const safeName = String(name || "fichier").replace(/[\\/\r\n"]/g, "_").slice(0, 150);
	if (BLOCKED.test(safeName)) throw new Error("Ce type de fichier n’est pas accepté par les messageries");
	if (bytes.length === 0) throw new Error("Fichier vide");
	if (bytes.length > MAX_FILE_BYTES) throw new Error("Chaque fichier doit faire moins de 4 Mo");
	const existing = await listAttachments(account, campaignId);
	if (existing.length >= MAX_FILES) throw new Error(`${MAX_FILES} pièces jointes au maximum`);
	const total = existing.reduce((s, a) => s + a.bytes, 0) + bytes.length;
	if (total > MAX_TOTAL_BYTES) throw new Error("10 Mo au total au maximum, pour que les messageries acceptent l’email");
	const type = String(contentType || "application/octet-stream").slice(0, 100);
	const blob = await put(`attachments/${String(account._id)}/${String(campaignId)}/${safeName}`, bytes, {
		access: "public",
		contentType: type,
		addRandomSuffix: true,
	});
	const doc = await CampaignAttachment.create({
		accountId: account._id,
		campaignId: oid(campaignId),
		name: safeName,
		contentType: type,
		bytes: bytes.length,
		url: blob.url,
	});
	return toItem(doc);
}

export async function removeAttachment(account, campaignId, id) {
	await connectDb();
	const doc = await CampaignAttachment.findOneAndDelete(scoped(account, { campaignId: oid(campaignId), _id: oid(id) })).lean();
	if (doc) await del(doc.url).catch(() => {});
	return Boolean(doc);
}

// One download per campaign per server instance, not one per reader.
const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

export async function loadAttachmentsForSend(accountId, campaignId) {
	if (!campaignId) return [];
	const key = String(campaignId);
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_MS) return hit.files;
	await connectDb();
	const rows = await CampaignAttachment.find({ accountId: oid(accountId), campaignId: oid(campaignId) }).sort({ createdAt: 1 }).lean();
	const files = await Promise.all(
		rows.map(async (a) => {
			const res = await fetch(a.url);
			if (!res.ok) throw new Error(`Pièce jointe ${a.name} introuvable (${res.status})`);
			return { name: a.name, contentType: a.contentType, url: a.url, bytes: a.bytes, data: new Uint8Array(await res.arrayBuffer()) };
		})
	);
	cache.set(key, { at: Date.now(), files });
	if (cache.size > 50) cache.delete(cache.keys().next().value);
	return files;
}

function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function formatSize(bytes) {
	return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

// For providers without attachments: the files as links at the end of the email.
export function appendAttachmentLinks(email, files) {
	if (!files.length) return email;
	const items = files
		.map((f) => `<li style="margin:4px 0"><a href="${escapeHtml(f.url)}" style="color:#2563eb">${escapeHtml(f.name)}</a> <span style="color:#71717a">(${formatSize(f.bytes)})</span></li>`)
		.join("");
	const block = `<div style="margin:24px auto 0;max-width:600px;padding:12px 16px;border:1px solid #e4e4e7;border-radius:8px;font:14px/1.5 -apple-system,Segoe UI,sans-serif"><strong>Pièces jointes</strong><ul style="margin:6px 0 0;padding-left:18px">${items}</ul></div>`;
	const html = /<\/body>/i.test(email.html) ? email.html.replace(/<\/body>/i, `${block}</body>`) : `${email.html}${block}`;
	const text = `${email.text}\n\nPièces jointes :\n${files.map((f) => `- ${f.name}: ${f.url}`).join("\n")}`;
	return { ...email, html, text };
}
