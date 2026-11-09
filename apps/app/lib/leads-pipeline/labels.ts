import type { StatusTone } from "@crm/ui/components/status-indicator";

const SOURCE_LABEL = new Map<string, string>(
	Object.entries({
		seeds: "Seed lists",
		incubators: "Incubators and VC portfolios",
		search: "Web search",
		maps: "Google Maps",
		funding: "Funding news",
		github: "GitHub",
		huggingface: "Hugging Face",
		hn: "Hacker News hiring",
		directories: "Training directories",
		competitors: "Competitor clients",
		yc: "Y Combinator",
	}),
);

export function sourceLabel(source: string): string {
	return SOURCE_LABEL.get(source) ?? source;
}

export function segmentLabel(segment: string): string {
	const words = segment.replaceAll("_", " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function segmentList(raw: string): string {
	return raw
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map(segmentLabel)
		.join(", ");
}

const VERIFIED_TONE = new Map<string, StatusTone>(
	Object.entries({
		valid: "success",
		risky: "warning",
		catch_all: "warning",
		unknown: "neutral",
		invalid: "error",
	}),
);

export function verifiedTone(status: string): StatusTone {
	return VERIFIED_TONE.get(status) ?? "neutral";
}

const INTENT_TONE = new Map<string, StatusTone>(
	Object.entries({ high: "success", medium: "info", low: "neutral" }),
);

export function intentTone(intent: string): StatusTone {
	return INTENT_TONE.get(intent) ?? "neutral";
}
