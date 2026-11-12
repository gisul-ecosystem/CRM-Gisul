"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { StatCard } from "@crm/ui/components/stat-card";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation, useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { BrowserViewer } from "@/components/linkedin-scraper/browser-viewer";
import { JobLog } from "@/components/linkedin-scraper/job-log";
import { ScraperPage } from "@/components/linkedin-scraper/scraper-page";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { Meter } from "@/components/outreach/meter";
import { linkedInApi, scraperApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys, useScraperCache } from "@/lib/linkedin-scraper/cache";
import { JOB_STATUS } from "@/lib/linkedin-scraper/labels";
import type {
	ScrapeJob,
	ScraperStatus,
	SendJob,
} from "@/lib/linkedin-scraper/schemas";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { useScraperStatus } from "@/lib/linkedin-scraper/use-status";
import { COUNT } from "@/lib/outreach/format";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function LinkedInOverview({
	viewerBaseUrl,
}: {
	viewerBaseUrl: string | null;
}) {
	return (
		<ScraperPage
			title="LinkedIn"
			description="Scrape LinkedIn profiles, draft a message for each person with AI, and send from one shared LinkedIn account."
		>
			<OverviewBody viewerBaseUrl={viewerBaseUrl} />
		</ScraperPage>
	);
}

function OverviewBody({ viewerBaseUrl }: { viewerBaseUrl: string | null }) {
	const status = useScraperStatus();
	const data = status.data;
	if (!data) return null;

	return (
		<div className="flex flex-col gap-6">
			{data.mongo.ok ? null : (
				<Alert variant="destructive">
					<AlertTitle>The scraper cannot reach its database</AlertTitle>
					<AlertDescription>
						Profiles and the queue do not load until the scraper's MongoDB runs.
					</AlertDescription>
				</Alert>
			)}

			<Card>
				<div className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
					<StatCard label="Profiles" value={COUNT.format(data.totalProfiles)} />
					<StatCard
						label="Drafts in queue"
						value={COUNT.format(data.queueCount)}
					/>
					<StatCard
						label="Sent today"
						value={
							data.sendBudget
								? `${COUNT.format(data.sendBudget.sent)} / ${COUNT.format(data.sendBudget.limit)}`
								: "—"
						}
					/>
					<StatCard
						label="Left today"
						value={
							data.sendBudget ? COUNT.format(data.sendBudget.remaining) : "—"
						}
					/>
				</div>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<ConnectionCard status={data} viewerBaseUrl={viewerBaseUrl} />
				<KnowledgeCard />
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<JobCard
					title="Scrape"
					description="Reads profiles and writes a draft for each person."
					job={data.scrapeJob}
					link={{ path: "/linkedin/scrape", label: "Search and scrape" }}
				/>
				<JobCard
					title="Send"
					description={
						data.sendBudget
							? `Sends in batches of ${data.sendBudget.batchSize}, then pauses ${data.sendBudget.batchPauseMinutes} min. The day ends in ${data.sendBudget.timeZone}.`
							: "Sends approved drafts from the queue."
					}
					job={data.sendJob}
					link={{ path: "/linkedin/queue", label: "Open queue" }}
				/>
			</div>
		</div>
	);
}

function ConnectionCard({
	status,
	viewerBaseUrl,
}: {
	status: ScraperStatus;
	viewerBaseUrl: string | null;
}) {
	const cache = useScraperCache();
	const [confirmLogout, setConfirmLogout] = useState(false);
	const connecting = status.linkedInJob.status === "running";

	const onDone = (message: string) => {
		toast.success(message);
		void cache.status();
	};

	const connect = useMutation({
		mutationFn: () => linkedInApi.connect(),
		onSuccess: () => onDone("The LinkedIn sign-in browser is opening."),
		onError: (error) => toast.error(error.message),
	});
	const back = useMutation({
		mutationFn: () => linkedInApi.backToLinkedIn(),
		onSuccess: (result) =>
			onDone(result.message || "The browser is back on LinkedIn."),
		onError: (error) => toast.error(error.message),
	});
	const logout = useMutation({
		mutationFn: () => linkedInApi.logout(),
		onSuccess: (result) => {
			setConfirmLogout(false);
			onDone(result.message || "LinkedIn is disconnected.");
		},
		onError: (error) => toast.error(error.message),
	});

	const viewer =
		status.inDocker && viewerBaseUrl
			? `${viewerBaseUrl}${status.browserViewerUrl}`
			: null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>LinkedIn account</CardTitle>
				<CardDescription>
					Everyone in the CRM shares this one LinkedIn sign-in.
				</CardDescription>
				<CardAction>
					<StatusIndicator
						tone={status.linkedInConnected ? "success" : "warning"}
						label={status.linkedInConnected ? "Connected" : "Not connected"}
						size="sm"
					/>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-muted-foreground text-xs">
					{status.inDocker
						? viewer
							? "Click Connect LinkedIn, then sign in in the browser below. Use email and password, not Google."
							: "The scraper runs in Docker. Set LINKEDIN_SCRAPER_VIEWER_URL to open its browser viewer from here."
						: "A Chromium window opens on the scraper's computer. Sign in there with email and password, not Google."}
				</p>
				<div className="flex flex-wrap gap-2">
					{status.linkedInConnected ? null : (
						<Button
							size="sm"
							disabled={connecting || connect.isPending}
							onClick={() => connect.mutate()}
						>
							Connect LinkedIn
						</Button>
					)}
					{viewer ? (
						<Button asChild variant="outline" size="sm">
							<a href={viewer} target="_blank" rel="noreferrer">
								Open in a new tab
							</a>
						</Button>
					) : null}
					{connecting ? (
						<Button
							variant="outline"
							size="sm"
							disabled={back.isPending}
							onClick={() => back.mutate()}
						>
							Back to LinkedIn
						</Button>
					) : null}
					{status.linkedInConnected ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setConfirmLogout(true)}
						>
							Disconnect
						</Button>
					) : null}
				</div>
				{viewer && connecting ? <BrowserViewer src={viewer} /> : null}
				{status.linkedInJob.logs.length > 0 ? (
					<JobLog
						entries={status.linkedInJob.logs.map((msg) => ({ at: null, msg }))}
					/>
				) : null}
			</CardContent>
			<ConfirmDialog
				open={confirmLogout}
				title="Disconnect LinkedIn?"
				description="Scraping and sending stop for everyone until someone connects LinkedIn again."
				action="Disconnect"
				pending={logout.isPending}
				onConfirm={() => logout.mutate()}
				onClose={() => setConfirmLogout(false)}
			/>
		</Card>
	);
}

function KnowledgeCard() {
	const cache = useScraperCache();
	const products = useQuery({
		queryKey: scraperKeys.products,
		queryFn: () => scraperApi.products(),
		staleTime: LINKEDIN_SCRAPER.refresh.listMs,
	});
	const rebuild = useMutation({
		mutationFn: () => scraperApi.rebuildKnowledge(),
		onSuccess: (result) => {
			toast.success(
				`Product knowledge rebuilt: ${result.chunkCount} passages.`,
			);
			void cache.everything();
		},
		onError: (error) => toast.error(error.message),
	});

	const data = products.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>AI drafting</CardTitle>
				<CardDescription>
					The AI matches each person to a product and writes the message from
					the product notes.
				</CardDescription>
				<CardAction>
					<Button
						variant="outline"
						size="sm"
						disabled={rebuild.isPending}
						onClick={() => rebuild.mutate()}
					>
						Rebuild knowledge
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{products.isError ? (
					<p className="text-destructive text-xs">{products.error.message}</p>
				) : data ? (
					<>
						<StatusIndicator
							tone={data.aiConfigured ? "success" : "error"}
							label={
								data.aiConfigured
									? `AI on (${data.provider === "claude" ? "Claude" : "OpenAI"})`
									: "AI off: the scraper has no AI key"
							}
							size="sm"
						/>
						<StatusIndicator
							tone={data.rag.fresh ? "success" : "warning"}
							label={
								data.rag.exists
									? `Knowledge ${data.rag.fresh ? "current" : "out of date"}: ${COUNT.format(data.rag.chunkCount)} passages`
									: "Knowledge not built yet"
							}
							size="sm"
						/>
						<ul className="flex flex-col gap-2">
							{data.products.map((product) => (
								<li key={product.id} className="text-sm">
									<span className="font-medium">{product.name}</span>
									<span className="text-muted-foreground">
										{" "}
										— {product.tagline}
									</span>
								</li>
							))}
						</ul>
					</>
				) : (
					<p className="text-muted-foreground text-xs">Loading…</p>
				)}
			</CardContent>
		</Card>
	);
}

function JobCard({
	title,
	description,
	job,
	link,
}: {
	title: string;
	description: string;
	job: ScrapeJob | SendJob;
	link: { path: string; label: string };
}) {
	const href = useWorkspaceUrl();
	const label = JOB_STATUS[job.status];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<NextLink href={href(link.path)}>{link.label}</NextLink>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-2">
					<StatusIndicator
						tone={label.tone}
						label={label.label}
						pulse={job.status === "running"}
						size="sm"
					/>
					{job.total > 0 ? (
						<span className="text-muted-foreground text-xs tabular-nums">
							{COUNT.format(job.processed)} / {COUNT.format(job.total)}
						</span>
					) : null}
				</div>
				{job.total > 0 ? (
					<Meter value={job.processed} max={job.total} label={title} />
				) : null}
				{job.current ? (
					<p className="truncate text-muted-foreground text-xs">
						Now: {job.current}
					</p>
				) : null}
				<JobLog entries={job.logs} />
			</CardContent>
		</Card>
	);
}
