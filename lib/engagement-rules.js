// Custom (bubuMMMM): a contact's engagement score, 0 to 100, from human opens and clicks only (bots and Apple MPP
// left out by lib/ua-classify.js). Half recency of the last human open or click, half frequency over the last sends.
export const WINDOW_DAYS = 90;
const DAY = 86_400_000;

// sends: issues received in the window; opened/clicked: those of them opened or clicked by a human;
// lastAt: the last human open or click, any time. null when nothing was sent yet: no score to give.
export function engagementScore({ sends = 0, opened = 0, clicked = 0, lastAt = null, now = Date.now() }) {
	if (!sends && !lastAt) return null;
	const days = lastAt ? (now - new Date(lastAt).getTime()) / DAY : Infinity;
	const recency = Number.isFinite(days) ? Math.max(0, 1 - days / WINDOW_DAYS) : 0;
	const frequency = sends ? Math.min(1, (opened + 2 * clicked) / (sends * 1.5)) : 0;
	return Math.round(100 * (0.5 * recency + 0.5 * frequency));
}

export function scoreLabel(score) {
	if (score == null) return "Nouveau";
	if (score >= 70) return "Très engagé";
	if (score >= 40) return "Engagé";
	if (score >= 15) return "Tiède";
	return "Inactif";
}

// Inactive: received at least minSends issues in the last `days` days and never opened or clicked one as a human there.
export function isInactive({ sendsInPeriod = 0, lastAt = null, now = Date.now() }, { minSends = 3, days = 90 } = {}) {
	if (sendsInPeriod < minSends) return false;
	return !lastAt || now - new Date(lastAt).getTime() > days * DAY;
}
