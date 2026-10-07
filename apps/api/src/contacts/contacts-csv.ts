import { LeadSource, LeadStatus } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import {
	CONTACT_IO,
	type ContactCsvHeader,
} from "./contacts-io-config";

export type ContactCsvRow = {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	title: string;
	company: string;
	ownerEmail: string;
	product: string;
	leadStatus: string;
	leadSource: string;
	nextFollowUpAt: string;
};

const HEADER_SET = new Set<string>(CONTACT_IO.headers);

const STATUS_BY_LABEL: Record<string, LeadStatus> = {
	new: LeadStatus.NEW,
	contacted: LeadStatus.CONTACTED,
	qualified: LeadStatus.QUALIFIED,
	unqualified: LeadStatus.UNQUALIFIED,
};

const SOURCE_BY_LABEL: Record<string, LeadSource> = {
	website: LeadSource.WEBSITE,
	linkedin: LeadSource.LINKEDIN,
	referral: LeadSource.REFERRAL,
	"cold outreach": LeadSource.COLD_OUTREACH,
	cold_outreach: LeadSource.COLD_OUTREACH,
	direct: LeadSource.DIRECT,
	other: LeadSource.OTHER,
};

export function contactCsvTemplate(): string {
	return `${CONTACT_IO.headers.join(",")}\n`;
}

export function serializeContactCsv(rows: ContactCsvRow[]): string {
	const lines = [CONTACT_IO.headers.join(",")];
	for (const row of rows) {
		lines.push(
			CONTACT_IO.headers.map((header) => escapeCsv(row[header])).join(","),
		);
	}
	return `${lines.join("\n")}\n`;
}

export function parseContactCsv(csv: string): ContactCsvRow[] {
	if (csv.length > CONTACT_IO.import.maxBytes) {
		throw new BadRequestException(
			`CSV is larger than ${CONTACT_IO.import.maxBytes / (1024 * 1024)} MB.`,
		);
	}

	const records = parseCsvRecords(csv);
	if (records.length === 0) {
		throw new BadRequestException("CSV is empty.");
	}

	const headerRow = records[0] ?? [];
	const headers = headerRow.map((value) => value.trim());
	const index = new Map<string, number>();
	for (const [i, header] of headers.entries()) {
		if (HEADER_SET.has(header)) index.set(header, i);
	}

	if (!index.has("firstName")) {
		throw new BadRequestException('CSV needs a "firstName" column.');
	}

	const rows: ContactCsvRow[] = [];
	for (let i = 1; i < records.length; i += 1) {
		const cells = records[i] ?? [];
		if (cells.every((cell) => cell.trim() === "")) continue;

		const read = (header: ContactCsvHeader) => {
			const at = index.get(header);
			return at === undefined ? "" : (cells[at] ?? "").trim();
		};

		rows.push({
			firstName: read("firstName"),
			lastName: read("lastName"),
			email: read("email"),
			phone: read("phone"),
			title: read("title"),
			company: read("company"),
			ownerEmail: read("ownerEmail"),
			product: read("product"),
			leadStatus: read("leadStatus"),
			leadSource: read("leadSource"),
			nextFollowUpAt: read("nextFollowUpAt"),
		});
	}

	if (rows.length === 0) {
		throw new BadRequestException("CSV has no data rows.");
	}
	if (rows.length > CONTACT_IO.import.maxRows) {
		throw new BadRequestException(
			`CSV has more than ${CONTACT_IO.import.maxRows} rows.`,
		);
	}

	return rows;
}

export function parseLeadStatus(value: string): LeadStatus | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const upper = trimmed.toUpperCase().replace(/\s+/g, "_");
	if ((Object.values(LeadStatus) as string[]).includes(upper)) {
		return upper as LeadStatus;
	}
	return STATUS_BY_LABEL[trimmed.toLowerCase()];
}

export function parseLeadSource(value: string): LeadSource | null | undefined {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const upper = trimmed.toUpperCase().replace(/\s+/g, "_");
	if ((Object.values(LeadSource) as string[]).includes(upper)) {
		return upper as LeadSource;
	}
	return SOURCE_BY_LABEL[trimmed.toLowerCase()];
}

function escapeCsv(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}

function parseCsvRecords(csv: string): string[][] {
	const records: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let inQuotes = false;

	for (let i = 0; i < csv.length; i += 1) {
		const char = csv[i] ?? "";
		const next = csv[i + 1] ?? "";

		if (inQuotes) {
			if (char === '"' && next === '"') {
				cell += '"';
				i += 1;
				continue;
			}
			if (char === '"') {
				inQuotes = false;
				continue;
			}
			cell += char;
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}
		if (char === ",") {
			row.push(cell);
			cell = "";
			continue;
		}
		if (char === "\n") {
			row.push(cell);
			records.push(row);
			row = [];
			cell = "";
			continue;
		}
		if (char === "\r") continue;
		cell += char;
	}

	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		records.push(row);
	}

	return records;
}
