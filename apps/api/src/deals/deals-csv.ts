import { DealStage } from "@crm/db";
import { DEAL_STAGE_CATALOG, dealStageLabel } from "@crm/db/deal-stage";
import { BadRequestException } from "@nestjs/common";
import { MAX_AMOUNT_CENTS } from "./deals.contracts";
import { DEAL_IO, type DealCsvHeader } from "./deals-io-config";

export type DealCsvRow = {
	name: string;
	company: string;
	ownerEmail: string;
	product: string;
	stage: string;
	amount: string;
	currency: string;
	expectedCloseDate: string;
	closedReason: string;
};

const HEADER_SET = new Set<string>(DEAL_IO.headers);

const STAGE_BY_LABEL: Record<string, DealStage> = Object.fromEntries(
	DEAL_STAGE_CATALOG.flatMap((entry) => [
		[entry.label.toLowerCase(), entry.stage],
		[entry.stage.toLowerCase().replaceAll("_", " "), entry.stage],
	]),
);

export function dealCsvTemplate(): string {
	return `${DEAL_IO.headers.join(",")}\n`;
}

export function serializeDealCsv(rows: DealCsvRow[]): string {
	const lines = [DEAL_IO.headers.join(",")];
	for (const row of rows) {
		lines.push(
			DEAL_IO.headers.map((header) => escapeCsv(row[header])).join(","),
		);
	}
	return `${lines.join("\n")}\n`;
}

export function parseDealCsv(csv: string): DealCsvRow[] {
	if (csv.length > DEAL_IO.import.maxBytes) {
		throw new BadRequestException(
			`CSV is larger than ${DEAL_IO.import.maxBytes / (1024 * 1024)} MB.`,
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

	const rows: DealCsvRow[] = [];
	for (let i = 1; i < records.length; i += 1) {
		const cells = records[i] ?? [];
		if (cells.every((cell) => cell.trim() === "")) continue;

		const read = (header: DealCsvHeader) => {
			const at = index.get(header);
			return at === undefined ? "" : (cells[at] ?? "").trim();
		};

		rows.push({
			name: read("name"),
			company: read("company"),
			ownerEmail: read("ownerEmail"),
			product: read("product"),
			stage: read("stage"),
			amount: read("amount"),
			currency: read("currency"),
			expectedCloseDate: read("expectedCloseDate"),
			closedReason: read("closedReason"),
		});
	}

	if (rows.length === 0) {
		throw new BadRequestException("CSV has no data rows.");
	}
	if (rows.length > DEAL_IO.import.maxRows) {
		throw new BadRequestException(
			`CSV has more than ${DEAL_IO.import.maxRows} rows.`,
		);
	}

	return rows;
}

export function parseDealStage(value: string): DealStage | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const upper = trimmed.toUpperCase().replace(/\s+/g, "_");
	if ((Object.values(DealStage) as string[]).includes(upper)) {
		return upper as DealStage;
	}
	return STAGE_BY_LABEL[trimmed.toLowerCase()];
}

export function formatDealStage(stage: DealStage): string {
	return dealStageLabel(stage);
}

export function parseAmountCents(value: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const amount = Number(trimmed);
	if (!Number.isFinite(amount) || amount < 0) {
		throw new BadRequestException(`"${value}" is not a valid amount.`);
	}
	const cents = Math.round(amount * 100);
	if (cents > MAX_AMOUNT_CENTS) {
		throw new BadRequestException("That amount is too large to record.");
	}
	return cents;
}

export function formatAmount(amount: { toFixed: (digits: number) => string } | null): string {
	return amount === null ? "" : amount.toFixed(2);
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
