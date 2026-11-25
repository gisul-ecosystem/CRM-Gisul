import { Injectable } from "@nestjs/common";
import { SyncStateService } from "../mailbox/sync-state.service";
import {
	MICROSOFT_SYNC_SOURCES,
	type MicrosoftSyncSource,
} from "./microsoft.constants";
import { OutlookCalendarSyncService } from "./outlook-calendar-sync.service";
import {
	type OutlookSyncOutcome,
	OutlookSyncService,
} from "./outlook-sync.service";

@Injectable()
export class MicrosoftSyncService {
	constructor(
		private readonly state: SyncStateService,
		private readonly outlook: OutlookSyncService,
		private readonly calendar: OutlookCalendarSyncService,
	) {}

	async runOne(userId: string, source: MicrosoftSyncSource): Promise<OutlookSyncOutcome | null> {
		const row = await this.state.get(userId, source);
		if (!row) return null;

		let mailOutcome: OutlookSyncOutcome | null = null;
		// Drain all available message pages in a single sync session (up to 5 continuous passes)
		for (let pass = 0; pass < 5; pass += 1) {
			const currentRow = await this.state.get(userId, source);
			if (!currentRow) break;
			mailOutcome = await this.outlook.sync(currentRow);
			if (
				!mailOutcome ||
				mailOutcome.status !== "synced" ||
				(mailOutcome.messagesWritten ?? 0) === 0
			) {
				break;
			}
		}

		await this.calendar.sync(row);
		return mailOutcome;
	}

	async runForUser(userId: string): Promise<void> {
		for (const source of MICROSOFT_SYNC_SOURCES) {
			await this.runOne(userId, source);
		}
	}
}
