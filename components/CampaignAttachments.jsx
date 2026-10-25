"use client";

// Custom (bubuMMMM): attach files to a campaign by drag and drop or picking them. They go with every email:
// real attachments on Amazon SES, download links on PostShiba (lib/campaign-attachments.js).
import { FileText, Loader2, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const MAX_TOTAL = 10 * 1024 * 1024;

function formatSize(bytes) {
	return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

export default function CampaignAttachments({ campaignId, readOnly = false }) {
	const [items, setItems] = useState(null);
	const [busy, setBusy] = useState(0);
	const [dragging, setDragging] = useState(false);
	const input = useRef(null);
	const base = `/api/campaigns/${campaignId}/attachments`;

	useEffect(() => {
		fetch(base)
			.then((r) => (r.ok ? r.json() : { attachments: [] }))
			.then((d) => setItems(d.attachments ?? []))
			.catch(() => setItems([]));
	}, [base]);

	const upload = useCallback(
		async (files) => {
			for (const file of files) {
				setBusy((n) => n + 1);
				try {
					const res = await fetch(base, {
						method: "POST",
						body: file,
						headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
					});
					const data = await res.json().catch(() => ({}));
					if (!res.ok) throw new Error(data.error ?? "Envoi impossible");
					setItems((list) => [...(list ?? []), data.attachment]);
				} catch (error) {
					toast.error(`${file.name} : ${error.message}`);
				} finally {
					setBusy((n) => n - 1);
				}
			}
		},
		[base]
	);

	async function remove(id) {
		const res = await fetch(`${base}?attachment=${id}`, { method: "DELETE" });
		if (res.ok) setItems((list) => list.filter((a) => a.id !== id));
		else toast.error("Suppression impossible");
	}

	const total = (items ?? []).reduce((s, a) => s + a.bytes, 0);
	if (readOnly && !items?.length) return null;

	return (
		<section className="mx-auto mt-6 w-[calc(100%-2rem)] max-w-2xl rounded-xl bg-card p-4 shadow-border" aria-labelledby="att-title">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="att-title" className="flex items-center gap-2 text-sm font-medium">
					<Paperclip className="size-4" aria-hidden="true" /> Pièces jointes
				</h2>
				<span className="text-xs tabular-nums text-muted-foreground">
					{total ? formatSize(total) : "0 Ko"} / 10 Mo
				</span>
			</div>

			{!readOnly && (
				<div
					onDragOver={(e) => {
						if (!e.dataTransfer.types.includes("Files")) return;
						e.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={(e) => {
						e.preventDefault();
						setDragging(false);
						upload([...e.dataTransfer.files]);
					}}
					className={cn(
						"mt-3 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center transition-colors",
						dragging && "border-primary bg-primary/5"
					)}
				>
					{busy > 0 ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <UploadCloud className="size-5 text-muted-foreground" />}
					<p className="text-sm text-muted-foreground">Glissez des fichiers ici ou</p>
					<Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={total >= MAX_TOTAL}>
						Choisir des fichiers
					</Button>
					<input
						ref={input}
						type="file"
						multiple
						hidden
						onChange={(e) => {
							upload([...e.target.files]);
							e.target.value = "";
						}}
					/>
					<p className="text-[11px] text-muted-foreground">4 Mo par fichier, 10 Mo au total. Envoyées en vraie pièce jointe avec Amazon SES.</p>
				</div>
			)}

			{items?.length > 0 && (
				<ul className="mt-3 divide-y divide-border rounded-lg border border-border">
					{items.map((a) => (
						<li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
							<FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
								{a.name}
							</a>
							<span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatSize(a.bytes)}</span>
							{!readOnly && (
								<Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => remove(a.id)} aria-label={`Retirer ${a.name}`}>
									<Trash2 className="size-4" />
								</Button>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
