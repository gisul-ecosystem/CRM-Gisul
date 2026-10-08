import { describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "../src/workspace/workspace.service";

describe("WorkspaceService Integrations", () => {
	const mockDb = {
		organization: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		mailboxSync: {
			findFirst: vi.fn(),
		},
		slackInstallation: {
			findFirst: vi.fn(),
		},
	};

	const mockAgent = {
		workspaceChanged: vi.fn().mockResolvedValue(undefined),
	} as any;

	it("retrieves integrations overview with live DB connection states and summary metrics", async () => {
		mockDb.organization.findUnique.mockResolvedValue({
			id: "ws-1",
			metadata: JSON.stringify({
				integrations: {
					linkedin: { connected: true, enabled: true },
					notion: { connected: false, enabled: false },
				},
			}),
		});

		// Google connected
		mockDb.mailboxSync.findFirst.mockImplementation(async ({ where }: any) => {
			if (where?.source === "google") {
				return { id: "sync-google-1", user: { email: "user@gmail.com" } };
			}
			return null;
		});

		// Slack connected
		mockDb.slackInstallation.findFirst.mockResolvedValue({
			teamName: "GISUL Workspace",
		});

		const service = new WorkspaceService(mockDb as any, mockAgent);
		const result = await service.integrations("u-1");

		expect(result.summary.total).toBe(11);
		expect(result.summary.connected).toBeGreaterThanOrEqual(3);

		const gmail = result.integrations.find((i) => i.id === "gmail");
		expect(gmail?.connected).toBe(true);
		expect(gmail?.accountName).toBe("user@gmail.com");
		expect(gmail?.category).toBe("communication");

		const slack = result.integrations.find((i) => i.id === "slack");
		expect(slack?.connected).toBe(true);
		expect(slack?.accountName).toBe("GISUL Workspace");
		expect(slack?.category).toBe("collaboration");

		const apiAccess = result.integrations.find((i) => i.id === "api-access");
		expect(apiAccess?.status).toBe("enabled");
		expect(apiAccess?.connected).toBe(true);
	});

	it("toggles integration state and persists into workspace metadata", async () => {
		let currentMeta = "{}";
		mockDb.organization.findUnique.mockImplementation(async () => ({
			id: "ws-1",
			metadata: currentMeta,
		}));
		mockDb.organization.update.mockImplementation(async ({ data }: any) => {
			if (data?.metadata) currentMeta = data.metadata;
			return { id: "ws-1", metadata: currentMeta };
		});
		mockDb.mailboxSync.findFirst.mockResolvedValue(null);
		mockDb.slackInstallation.findFirst.mockResolvedValue(null);

		const service = new WorkspaceService(mockDb as any, mockAgent);

		const updated = await service.toggleIntegration("u-1", {
			id: "hubspot",
			enabled: true,
		});

		expect(updated.id).toBe("hubspot");
		expect(updated.enabled).toBe(true);
		expect(updated.connected).toBe(true);
		expect(mockDb.organization.update).toHaveBeenCalled();
	});
});
