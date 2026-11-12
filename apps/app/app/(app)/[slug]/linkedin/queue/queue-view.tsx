"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { JobLog } from "@/components/linkedin-scraper/job-log";
import { MessageTemplateField } from "@/components/linkedin-scraper/message-template-field";
import { ProfileSheet } from "@/components/linkedin-scraper/profile-sheet";
import { ScraperPage } from "@/components/linkedin-scraper/scraper-page";
import { ConfirmDialog } from "@/components/outreach/confirm-dialog";
import { Meter } from "@/components/outreach/meter";
import { OutreachToolbar, SearchBox } from "@/components/outreach/toolbar";
import { queueApi } from "@/lib/linkedin-scraper/api";
import { scraperKeys, useScraperCache } from "@/lib/linkedin-scraper/cache";
import { JOB_STATUS } from "@/lib/linkedin-scraper/labels";
import type { ScrapedProfile } from "@/lib/linkedin-scraper/schemas";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";
import { useScraperStatus } from "@/lib/linkedin-scraper/use-status";
import { COUNT, plural } from "@/lib/outreach/format";
import { useDebounced } from "@/lib/outreach/use-debounced";

type Pending = { kind: "send" | "clear"; slugs: string[] } | null;

export function QueueView() {
	return (
		<ScraperPage
			title="Message queue"
			description="Drafts waiting for review. Edit a draft, put one template on all of them, skip, or send from the shared LinkedIn account."
		>
			<QueueBody />
		</ScraperPage>
	);
}

function QueueBody() {
	const cache = useScraperCache();
	const status = useScraperStatus();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [open, setOpen] = useState<ScrapedProfile | null>(null);
	const [pending, setPending] = useState<Pending>(null);
	const [templateOpen, setTemplateOpen] = useState(false);
	const [template, setTemplate] = useState("");
	const query = useDebounced(search, LINKEDIN_SCRAPER.searchDebounceMs)
		.trim()
		.toLowerCase();

	const sendJob = status.data?.sendJob;
	const budget = status.data?.sendBudget ?? null;
	const sending = sendJob?.status === "running";
	const scraping = status.data?.scrapeJob.status === "running";

	const queue = useQuery({
		queryKey: scraperKeys.queue,
		queryFn: () => queueApi.list(),
		refetchInterval: sending
			? LINKEDIN_SCRAPER.refresh.activeJobMs
			: LINKEDIN_SCRAPER.refresh.listMs,
	});

	const done = (message: string) => {
		toast.success(message);
		setSelected(new Set());
		setPending(null);
		void cache.queue();
	};

	const send = useMutation({
		mutationFn: (slugs: string[]) => queueApi.send(slugs),
		onSuccess: (result) => done(result.message || "Sending started."),
		onError: (error) => toast.error(error.message),
	});
	const skip = useMutation({
		mutationFn: (slugs: string[]) => queueApi.skip(slugs),
		onSuccess: (result) =>
			done(`Skipped ${plural(result.skipped, "draft", "drafts")}.`),
		onError: (error) => toast.error(error.message),
	});
	const clear = useMutation({
		mutationFn: (slugs: string[]) => queueApi.clear(slugs),
		onSuccess: (result) => done(result.message),
		onError: (error) => toast.error(error.message),
	});

	const applyTemplate = useMutation({
		mutationFn: (slugs: string[]) =>
			queueApi.applyTemplate(template.trim(), slugs),
		onSuccess: (result) => {
			setTemplateOpen(false);
			done(result.message);
		},
		onError: (error) => toast.error(error.message),
	});

	const items = queue.data?.items ?? [];
	const filtered = items.filter(
		(item) =>
			!query ||
			[item.name, item.company, item.productName, item.aiMessage].some(
				(value) => value.toLowerCase().includes(query),
			),
	);
	const { pageSize } = LINKEDIN_SCRAPER;
	const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
	const picked = [...selected];
	const allOnPage =
		rows.length > 0 && rows.every((row) => selected.has(row.slug));

	const toggle = (slug: string) =>
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(slug)) next.delete(slug);
			else next.add(slug);
			return next;
		});

	const sendCount = pending?.slugs.length ? pending.slugs.length : items.length;
	const willSend = budget ? Math.min(sendCount, budget.remaining) : sendCount;

	return (
		<div className="flex flex-col gap-6">
			{budget && budget.remaining === 0 ? (
				<Alert variant="warning">
					<AlertTitle>Today's limit is reached</AlertTitle>
					<AlertDescription>
						{COUNT.format(budget.sent)} of {COUNT.format(budget.limit)} messages
						are sent today. Sending starts again tomorrow ({budget.timeZone}).
					</AlertDescription>
				</Alert>
			) : null}

			{sendJob && sendJob.status !== "idle" ? (
				<Card>
					<CardHeader>
						<CardTitle>Sending</CardTitle>
						<CardDescription>
							{budget
								? `Batches of ${budget.batchSize}, then a ${budget.batchPauseMinutes} min pause. ${COUNT.format(budget.remaining)} left today.`
								: "Messages go out one at a time."}
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<div className="flex items-center justify-between gap-2">
							<StatusIndicator
								tone={JOB_STATUS[sendJob.status].tone}
								label={JOB_STATUS[sendJob.status].label}
								pulse={sending}
								size="sm"
							/>
							<span className="text-muted-foreground text-xs tabular-nums">
								{COUNT.format(sendJob.sent)} sent ·{" "}
								{COUNT.format(sendJob.failed)} failed
							</span>
						</div>
						{sendJob.total > 0 ? (
							<Meter
								value={sendJob.processed}
								max={sendJob.total}
								label="Send progress"
							/>
						) : null}
						<JobLog entries={sendJob.logs} />
					</CardContent>
				</Card>
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-2">
				<OutreachToolbar>
					<SearchBox
						value={search}
						onChange={(value) => {
							setSearch(value);
							setPage(1);
						}}
						placeholder="Search name, company or message"
					/>
				</OutreachToolbar>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={items.length === 0 || sending}
						onClick={() => setTemplateOpen(true)}
					>
						Use one template
					</Button>
					{picked.length > 0 ? (
						<>
							<Button
								variant="outline"
								size="sm"
								disabled={skip.isPending || sending}
								onClick={() => skip.mutate(picked)}
							>
								Skip {COUNT.format(picked.length)}
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={sending}
								onClick={() => setPending({ kind: "clear", slugs: picked })}
							>
								Clear {COUNT.format(picked.length)}
							</Button>
						</>
					) : items.length > 0 ? (
						<Button
							variant="outline"
							size="sm"
							disabled={sending}
							onClick={() => setPending({ kind: "clear", slugs: [] })}
						>
							Clear all
						</Button>
					) : null}
					<Button
						size="sm"
						disabled={
							items.length === 0 ||
							sending ||
							scraping ||
							budget?.remaining === 0
						}
						onClick={() => setPending({ kind: "send", slugs: picked })}
					>
						{picked.length > 0
							? `Send ${COUNT.format(picked.length)}`
							: "Send all"}
					</Button>
				</div>
			</div>

			<Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Use one template</DialogTitle>
						<DialogDescription>
							{picked.length > 0
								? `Replaces the draft of the ${plural(picked.length, "selected person", "selected people")} with your template.`
								: `Replaces every queued draft (${COUNT.format(items.length)}) with your template.`}{" "}
							Each placeholder is filled from that person's profile.
						</DialogDescription>
					</DialogHeader>
					<MessageTemplateField value={template} onChange={setTemplate} />
					<DialogFooter>
						<Button variant="outline" onClick={() => setTemplateOpen(false)}>
							Cancel
						</Button>
						<Button
							disabled={!template.trim() || applyTemplate.isPending}
							onClick={() => applyTemplate.mutate(picked)}
						>
							{picked.length > 0
								? `Apply to ${COUNT.format(picked.length)}`
								: "Apply to all"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{queue.isPending ? (
				<Skeleton className="h-48 w-full rounded-lg" />
			) : queue.isError ? (
				<p className="text-destructive text-xs">{queue.error.message}</p>
			) : rows.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>
							{items.length === 0 ? "The queue is empty" : "No match"}
						</EmptyTitle>
						<EmptyDescription>
							{items.length === 0
								? "Drafts arrive here when a scrape writes an AI message for a matching person."
								: "Change the search."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{
							id: "pick",
							header: (
								<Checkbox
									checked={allOnPage}
									onCheckedChange={(checked) =>
										setSelected((current) => {
											const next = new Set(current);
											for (const row of rows) {
												if (checked === true) next.add(row.slug);
												else next.delete(row.slug);
											}
											return next;
										})
									}
									aria-label="Select this page"
								/>
							),
							width: "w-10",
						},
						{ id: "name", header: "Person" },
						{ id: "product", header: "Product" },
						{ id: "message", header: "Draft" },
					]}
				>
					{rows.map((item) => (
						<SimpleTableRow
							key={item.slug}
							clickable
							onClick={() => setOpen(item)}
						>
							<TableCell className="px-3">
								<Checkbox
									checked={selected.has(item.slug)}
									onCheckedChange={() => toggle(item.slug)}
									onClick={(event) => event.stopPropagation()}
									aria-label={`Select ${item.name || item.slug}`}
								/>
							</TableCell>
							<TableCell className="max-w-56 px-3">
								<p className="truncate">{item.name || item.slug}</p>
								<p className="truncate text-muted-foreground text-xs">
									{[item.jobTitle, item.company].filter(Boolean).join(" · ")}
								</p>
							</TableCell>
							<TableCell className="whitespace-nowrap px-3">
								{item.productName || "—"}
								{item.relevanceScore !== null ? (
									<span className="ml-1 text-muted-foreground text-xs tabular-nums">
										{item.relevanceScore}
									</span>
								) : null}
							</TableCell>
							<TableCell className="max-w-md truncate px-3 text-muted-foreground">
								{item.aiMessage || item.lastMessage}
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			{filtered.length > pageSize ? (
				<TablePagination
					page={page}
					totalPages={Math.ceil(filtered.length / pageSize)}
					pageSize={pageSize}
					total={filtered.length}
					onPageChange={setPage}
					loading={queue.isFetching}
				/>
			) : null}

			<ProfileSheet profile={open} onClose={() => setOpen(null)}>
				{open ? (
					<DraftEditor
						key={open.slug}
						profile={open}
						disabled={sending}
						onSaved={(saved) => {
							setOpen(saved);
							void cache.queue();
						}}
					/>
				) : null}
			</ProfileSheet>

			<ConfirmDialog
				open={pending?.kind === "send"}
				title={`Send ${plural(willSend, "message", "messages")} on LinkedIn?`}
				description={
					budget && willSend < sendCount
						? `Only ${COUNT.format(willSend)} fit in today's limit. The rest stay in the queue for tomorrow. Messages go out from the shared LinkedIn account and cannot be taken back.`
						: "Messages go out from the shared LinkedIn account and cannot be taken back."
				}
				action="Send"
				destructive={false}
				pending={send.isPending}
				onConfirm={() => {
					if (pending) send.mutate(pending.slugs);
				}}
				onClose={() => setPending(null)}
			/>
			<ConfirmDialog
				open={pending?.kind === "clear"}
				title={
					pending?.slugs.length
						? `Clear ${plural(pending.slugs.length, "draft", "drafts")}?`
						: "Clear every draft in the queue?"
				}
				description="Cleared drafts leave the queue and are not sent. The profiles stay."
				action="Clear"
				pending={clear.isPending}
				onConfirm={() => {
					if (pending) clear.mutate(pending.slugs);
				}}
				onClose={() => setPending(null)}
			/>
		</div>
	);
}

function DraftEditor({
	profile,
	disabled,
	onSaved,
}: {
	profile: ScrapedProfile;
	disabled: boolean;
	onSaved: (profile: ScrapedProfile) => void;
}) {
	const [message, setMessage] = useState(profile.aiMessage);
	const messageId = useId();
	const save = useMutation({
		mutationFn: () => queueApi.edit(profile.slug, message.trim()),
		onSuccess: (result) => {
			toast.success("Draft saved.");
			onSaved(result.item);
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate();
			}}
		>
			<Field>
				<FieldLabel htmlFor={messageId}>Edit the draft</FieldLabel>
				<Textarea
					id={messageId}
					rows={8}
					value={message}
					onChange={(event) => setMessage(event.target.value)}
				/>
			</Field>
			<div>
				<Button
					type="submit"
					size="sm"
					disabled={
						disabled ||
						save.isPending ||
						!message.trim() ||
						message.trim() === profile.aiMessage.trim()
					}
				>
					Save draft
				</Button>
			</div>
		</form>
	);
}
