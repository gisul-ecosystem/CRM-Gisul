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

		const mailOutcome = await this.outlook.sync(row);
		await this.calendar.sync(row);
		return mailOutcome;
	}

	async runForUser(userId: string): Promise<void> {
		for (const source of MICROSOFT_SYNC_SOURCES) {
			await this.runOne(userId, source);
		}
	}
}
