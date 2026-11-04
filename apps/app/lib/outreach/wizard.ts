import type { CampaignDraft } from "./api";
import {
	CAMPAIGN,
	DEFAULT_BODY_TEMPLATE,
	OPT_OUT_PATTERN,
} from "./campaign-rules";
import type { Campaign, CampaignVariant, SendWindow } from "./schemas/campaign";
import type { ReadinessFix } from "./schemas/readiness";

export const WIZARD_STEPS = [
	"Name & list",
	"Inboxes",
	"Write email",
	"Send window",
	"Review",
] as const;

export type WizardStep = 0 | 1 | 2 | 3 | 4;
export const LAST_STEP: WizardStep = 4;

export type WizardForm = {
	name: string;
	listId: string | null;
	inboxIds: string[];
	subjectTemplate: string;
	bodyTemplate: string;
	bodyHtml: string | null;
	templateName: string;
	matchValues: string[];
	variantColumn: string;
	variants: CampaignVariant[];
	followUpOf: string | null;
	followUpAfterDays: number;
	sendWindow: SendWindow;
};

export function formFromCampaign(campaign?: Campaign | null): WizardForm {
	if (!campaign) {
		return {
			name: "",
			listId: null,
			inboxIds: [],
			subjectTemplate: "",
			bodyTemplate: DEFAULT_BODY_TEMPLATE,
			bodyHtml: null,
			templateName: "",
			matchValues: [],
			variantColumn: "",
			variants: [],
			followUpOf: null,
			followUpAfterDays: CAMPAIGN.followUp.defaultDays,
			sendWindow: {
				startMinute: CAMPAIGN.window.recommended.startMinute,
				endMinute: CAMPAIGN.window.recommended.endMinute,
				days: [...CAMPAIGN.window.recommended.days],
			},
		};
	}
	return {
		name: campaign.name,
		listId: campaign.listId,
		inboxIds: campaign.inboxIds,
		subjectTemplate: campaign.subjectTemplate,
		bodyTemplate: campaign.bodyTemplate,
		bodyHtml: campaign.bodyHtml,
		templateName: campaign.templateName,
		matchValues: campaign.matchValues,
		variantColumn: campaign.variantColumn,
		variants: campaign.variants,
		followUpOf: campaign.followUpOf,
		followUpAfterDays: campaign.followUpAfterDays,
		sendWindow: campaign.sendWindow,
	};
}

export function emailFields(form: WizardForm): CampaignDraft {
	return {
		subjectTemplate: form.subjectTemplate,
		bodyTemplate: form.bodyTemplate,
		bodyHtml: form.bodyHtml,
		templateName: form.templateName,
		matchValues: form.matchValues,
		variantColumn: form.variantColumn,
		variants: form.variants,
		followUpAfterDays: form.followUpAfterDays,
	};
}

export function versionsOf(form: WizardForm): CampaignVariant[] {
	return [
		{
			name: form.templateName,
			subjectTemplate: form.subjectTemplate,
			bodyTemplate: form.bodyTemplate,
			bodyHtml: form.bodyHtml,
			matchValues: form.matchValues,
		},
		...form.variants,
	];
}

export function versionLabel(version: CampaignVariant, index: number): string {
	return version.name.trim() || (index === 0 ? "Main" : `Version ${index + 1}`);
}

export function parseWords(text: string): string[] {
	return [
		...new Set(
			text
				.split(",")
				.map((word) => word.trim())
				.filter(Boolean),
		),
	];
}

export function sendWindowProblem(window: SendWindow): string | null {
	if (window.days.length === 0) return "Choose at least one day.";
	if (window.startMinute >= window.endMinute)
		return "The end time must be after the start time.";
	return null;
}

export function stepProblem(step: WizardStep, form: WizardForm): string | null {
	if (step === 0) {
		if (!form.name.trim()) return "Enter a campaign name.";
		if (!form.listId)
			return form.followUpOf !== null
				? "Choose the first campaign."
				: "Choose a contact list.";
	}
	if (step === 1 && form.inboxIds.length === 0)
		return "Choose at least one inbox.";
	if (step === 2) {
		if (!form.subjectTemplate.trim()) return "Write a subject.";
		if (!form.bodyTemplate.trim()) return "Write the email.";
		for (const [index, variant] of form.variants.entries()) {
			const label = variant.name.trim() || `Version ${index + 2}`;
			if (!variant.name.trim()) return `Give ${label} a name.`;
			if (!variant.subjectTemplate.trim() || !variant.bodyTemplate.trim())
				return `${label} needs a subject and an email.`;
		}
	}
	if (step === 3) return sendWindowProblem(form.sendWindow);
	return null;
}

export function applyFix(value: string, fix: ReadinessFix): string {
	if (fix.kind === "replace") {
		const at = value.indexOf(fix.find);
		return at < 0
			? value
			: value.slice(0, at) + fix.replace + value.slice(at + fix.find.length);
	}
	if (fix.kind !== "insert") return value;
	if (fix.at === "start") return `${fix.text}${value.replace(/^\s+/, "")}`;
	if (fix.at === "end") return `${value.trimEnd()}\n\n${fix.text}`;
	const lines = value.replace(/\r\n|\r/g, "\n").split("\n");
	const index = lines.findIndex((line) => OPT_OUT_PATTERN.test(line));
	if (index < 0) return `${value.trimEnd()}\n\n${fix.text}`;
	const before = lines.slice(0, index).join("\n").trimEnd();
	return `${before}\n\n${fix.text}\n\n${lines.slice(index).join("\n")}`;
}
