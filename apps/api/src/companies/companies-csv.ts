import { BadRequestException } from "@nestjs/common";
import { COMPANY_IO, type CompanyCsvHeader } from "./companies-io-config";

export type CompanyCsvRow = {
	name: string;
	domain: string;
	ownerEmail: string;
	industry: string;
	website: string;
	phone: string;
	email: string;
};

const HEADER_SET = new Set<string>(COMPANY_IO.headers);

export function companyCsvTemplate(): string {
	return `${COMPANY_IO.headers.join(",")}\n`;
}

export function serializeCompanyCsv(rows: CompanyCsvRow[]): string {
	const lines = [COMPANY_IO.headers.join(",")];
	for (const row of rows) {
		lines.push(
			COMPANY_IO.headers.map((header) => escapeCsv(row[header])).join(","),
		);
	}
	return `${lines.join("\n")}\n`;
}

export function parseCompanyCsv(csv: string): CompanyCsvRow[] {
	if (csv.length > COMPANY_IO.import.maxBytes) {
		throw new BadRequestException(
			`CSV is larger than ${COMPANY_IO.import.maxBytes / (1024 * 1024)} MB.`,
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

	if (!index.has("name")) {
		throw new BadRequestException('CSV needs a "name" column.');
	}

	const rows: CompanyCsvRow[] = [];
	for (let i = 1; i < records.length; i += 1) {
		const cells = records[i] ?? [];
		if (cells.every((cell) => cell.trim() === "")) continue;

		const read = (header: CompanyCsvHeader) => {
			const at = index.get(header);
			return at === undefined ? "" : (cells[at] ?? "").trim();
		};

		rows.push({
			name: read("name"),
			domain: read("domain"),
			ownerEmail: read("ownerEmail"),
			industry: read("industry"),
			website: read("website"),
			phone: read("phone"),
			email: read("email"),
		});
	}

	if (rows.length === 0) {
		throw new BadRequestException("CSV has no data rows.");
	}
	if (rows.length > COMPANY_IO.import.maxRows) {
		throw new BadRequestException(
			`CSV has more than ${COMPANY_IO.import.maxRows} rows.`,
		);
	}

	return rows;
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
