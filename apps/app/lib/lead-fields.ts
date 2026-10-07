import { LeadSource, LeadStatus } from "@crm/db/enums";

export const LEAD_STATUS_OPTIONS = [
	{ value: LeadStatus.NEW, label: "New", color: "#4a63d6" },
	{ value: LeadStatus.CONTACTED, label: "Contacted", color: "#8a4fd0" },
	{ value: LeadStatus.QUALIFIED, label: "Qualified", color: "#1a9b6a" },
	{ value: LeadStatus.UNQUALIFIED, label: "Unqualified", color: "#e0457f" },
] as const;

export const LEAD_SOURCE_OPTIONS = [
	{ value: LeadSource.WEBSITE, label: "Website", color: "#5f3fa3" },
	{ value: LeadSource.LINKEDIN, label: "LinkedIn", color: "#5f3fa3" },
	{ value: LeadSource.REFERRAL, label: "Referral", color: "#b79ce8" },
	{ value: LeadSource.COLD_OUTREACH, label: "Cold Outreach", color: "#a888e0" },
	{ value: LeadSource.DIRECT, label: "Direct", color: "#c9b6ee" },
	{ value: LeadSource.OTHER, label: "Other", color: "#ddd0f5" },
] as const;

export const LEAD_STATUS_TABS = [
	{ id: "all", label: "All Leads" },
	{ id: "new", label: "New" },
	{ id: "contacted", label: "Contacted" },
	{ id: "qualified", label: "Qualified" },
	{ id: "unqualified", label: "Unqualified" },
] as const;

export function leadStatusLabel(status: LeadStatus): string {
	return (
		LEAD_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
		status
	);
}

export function leadSourceLabel(source: LeadSource): string {
	return (
		LEAD_SOURCE_OPTIONS.find((option) => option.value === source)?.label ??
		source
	);
}

export function toDateInputValue(value: string | null | undefined): string {
	if (!value) return "";
	return value.slice(0, 10);
}
