// Custom (bubuMMMM): reads a tracking request's user agent and IP into what the campaign report shows, and says
// when an open or click comes from a machine rather than a reader. The IP is only read here, never stored.

const SCANNER_PATTERN =
	/bot|crawl|spider|preview|scan|proofpoint|mimecast|barracuda|safelinks|python|curl|wget|java\/|okhttp|go-http|headless|symantec|trendmicro|forcepoint|sophos|fortinet|cisco|ironport/i;
// Apple Mail Privacy Protection fetches every image from Apple's own network (17.0.0.0/8) as soon as the
// email arrives, with a bare user agent.
const APPLE_NET = /^17\./;
const BARE_MOZILLA = /^Mozilla\/5\.0$/;

function readOs(ua) {
	if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
	if (/Android/.test(ua)) return "Android";
	if (/Windows/.test(ua)) return "Windows";
	if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
	if (/CrOS/.test(ua)) return "ChromeOS";
	if (/Linux/.test(ua)) return "Linux";
	return "Inconnu";
}

function readDevice(ua) {
	if (/iPad|Tablet/.test(ua)) return "Tablette";
	if (/Mobi|iPhone|Android/.test(ua)) return "Mobile";
	if (/Windows|Macintosh|X11|CrOS/.test(ua)) return "Ordinateur";
	return "Inconnu";
}

function readClient(ua) {
	if (/GoogleImageProxy/.test(ua)) return "Gmail";
	if (/YahooMailProxy/.test(ua)) return "Yahoo Mail";
	if (/Outlook|Microsoft Office|ms-office/i.test(ua)) return "Outlook";
	if (/Thunderbird/.test(ua)) return "Thunderbird";
	if (/Edg\//.test(ua)) return "Edge";
	if (/Firefox\//.test(ua)) return "Firefox";
	if (/CriOS|Chrome\//.test(ua)) return "Chrome";
	if (/AppleWebKit/.test(ua) && /Mobile\//.test(ua) && !/Safari\//.test(ua)) return "Apple Mail";
	if (/Safari\//.test(ua)) return "Safari";
	if (/AppleWebKit/.test(ua)) return "Apple Mail";
	return "Autre";
}

// machine: null for a reader, else why it doesn't count: "apple-mpp", "scanner" or "prefetch".
export function classifyHit({ type, userAgent = "", ip = "", sentAt = null, now = Date.now() }) {
	const ua = String(userAgent).slice(0, 400);
	let machine = null;
	if (type === "open" && (APPLE_NET.test(ip) || BARE_MOZILLA.test(ua))) machine = "apple-mpp";
	else if (!ua || SCANNER_PATTERN.test(ua)) machine = "scanner";
	// A click seconds after the email left is a security gateway following every link, not a reader.
	else if (type === "click" && sentAt && now - new Date(sentAt).getTime() < 30_000) machine = "prefetch";
	const proxied = /GoogleImageProxy|YahooMailProxy/.test(ua);
	return {
		device: machine === "apple-mpp" ? "Apple (MPP)" : proxied ? "Inconnu" : readDevice(ua),
		os: machine === "apple-mpp" ? "Apple" : proxied ? "Inconnu" : readOs(ua),
		client: machine === "apple-mpp" ? "Apple Mail (MPP)" : readClient(ua),
		machine,
	};
}
