// Custom (bubuMMMM): the open newsletter's contacts by engagement score, sortable and filterable, with the inactive ones
// to unsubscribe or put to sleep after confirming (lib/engagement.js).
import EngagementTable from "@/components/EngagementTable";
import { listEngagement, MAX_ROWS } from "@/lib/engagement";
import { getSelectedNewsletter, openNewsletter } from "@/lib/selected-newsletter";

export const metadata = { title: "Engagement" };

export default async function EngagementPage({ searchParams }) {
	const [view, params] = await Promise.all([getSelectedNewsletter(), searchParams]);
	openNewsletter(view, params.newsletter, "/contacts/engagement");
	const { account, selected } = view;
	const days = Math.min(365, Math.max(7, Number.parseInt(params.days, 10) || 90));
	const minSends = Math.min(50, Math.max(1, Number.parseInt(params.sends, 10) || 3));
	const rows = selected ? await listEngagement(account, selected._id, { days, minSends }) : [];
	return (
		<div className="mx-auto w-full max-w-5xl">
			<header className="mb-6">
				<h1 className="text-2xl font-semibold tracking-tight">Engagement</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Score de 0 à 100 d’après les ouvertures et clics de lecteurs réels (récence et fréquence sur 90 jours ; robots et Apple MPP exclus).
				</p>
			</header>
			{selected ? (
				<EngagementTable rows={rows} newsletterId={String(selected._id)} days={days} minSends={minSends} capped={rows.length >= MAX_ROWS} />
			) : (
				<p className="text-sm text-muted-foreground">Créez d’abord une newsletter.</p>
			)}
		</div>
	);
}
