"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { DatePicker } from "@crm/ui/components/date-picker";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import {
	LEAD_CATEGORIES,
	LEAD_CATEGORY_LABEL,
	type LeadCategory,
} from "@crm/validation/lead-origin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useUnifersHealth } from "@/components/unifers/unifers-page";
import { useTRPC } from "@/lib/trpc/client";
import { campaignsApi } from "@/lib/unifers/api";
import { useUnifersCache } from "@/lib/unifers/cache";
import {
	defaultFollowUpDay,
	followUpSubject,
	senderNameForAccount,
	swapSenderName,
	waitDaysUntil,
} from "@/lib/unifers/single-send";
import { UNIFERS } from "@/lib/unifers/unifers-config";

export type EmailRecipient = {
	contactId: string;
	email: string;
	name: string;
	companyName: string | null;
	productId: string | null;
	nextFollowUpAt: string | null;
};

const NO_PRODUCT = "none";
const AUTO_CATEGORY = "auto";

function categoryOf(value: string): LeadCategory | null {
	return LEAD_CATEGORIES.find((category) => category === value) ?? null;
}

export function SendEmailDialog({
	open,
	onClose,
	recipient,
}: {
	open: boolean;
	onClose: () => void;
	recipient: EmailRecipient;
}) {
	const ids = {
		from: useId(),
		product: useId(),
		category: useId(),
		purpose: useId(),
		subject: useId(),
		body: useId(),
		followUp: useId(),
		followUpOn: useId(),
		followUpBody: useId(),
	};
	const trpc = useTRPC();
	const cache = useUnifersCache();
	const queryClient = useQueryClient();
	const accounts = useUnifersHealth();
	const products = useQuery(trpc.products.options.queryOptions());
	const productOptions = products.data?.options ?? [];
	const verified = (accounts.data?.accounts ?? []).filter(
		(account) => account.status === "verified",
	);

	const [sender, setSender] = useState("");
	const [productId, setProductId] = useState(recipient.productId ?? NO_PRODUCT);
	const [category, setCategory] = useState<string>(AUTO_CATEGORY);
	const [purpose, setPurpose] = useState("");
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [followUp, setFollowUp] = useState(true);
	const [followUpOn, setFollowUpOn] = useState(() =>
		defaultFollowUpDay(recipient.nextFollowUpAt),
	);
	const [followUpBody, setFollowUpBody] = useState("");
	const drafted = useRef(false);
	const activeSenderNameRef = useRef("");

	const chosenSender =
		sender ||
		verified.find((account) => account.isDefault)?.email ||
		verified[0]?.email ||
		"";

	const chosenAccount = verified.find(
		(account) => account.email === chosenSender,
	);
	const initialChosenName = senderNameForAccount(chosenAccount);
	if (!activeSenderNameRef.current && initialChosenName) {
		activeSenderNameRef.current = initialChosenName;
	}

	const draft = useMutation(
		trpc.contacts.draftEmail.mutationOptions({
			onSuccess: (result) => {
				setSubject(result.subject);
				const targetName =
					senderNameForAccount(
						verified.find((account) => account.email === chosenSender),
					) || activeSenderNameRef.current;
				const prevName = activeSenderNameRef.current;
				const updatedBody = targetName
					? swapSenderName(result.body, prevName, targetName)
					: result.body;
				const updatedFollowUp = targetName
					? swapSenderName(result.followUpBody, prevName, targetName)
					: result.followUpBody;
				setBody(updatedBody);
				setFollowUpBody(updatedFollowUp);
				if (targetName) {
					activeSenderNameRef.current = targetName;
				}
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const writeDraft = draft.mutate;
	useEffect(() => {
		if (!open || drafted.current) return;
		drafted.current = true;
		const initialAccount =
			verified.find((account) => account.isDefault) || verified[0];
		const initialName = senderNameForAccount(initialAccount);
		if (initialName) {
			activeSenderNameRef.current = initialName;
		}
		writeDraft({
			id: recipient.contactId,
			productId: recipient.productId,
			category: null,
			senderName: initialName || null,
			purpose: null,
		});
	}, [open, recipient.contactId, recipient.productId, verified, writeDraft]);

	const rewrite = (
		next: Partial<{ product: string; category: string; purpose: string }> = {},
	) => {
		const nextProduct = next.product ?? productId;
		draft.mutate({
			id: recipient.contactId,
			productId: nextProduct === NO_PRODUCT ? null : nextProduct,
			category: categoryOf(next.category ?? category),
			senderName: activeSenderNameRef.current || null,
			purpose: (next.purpose ?? purpose).trim() || null,
		});
	};

	const handleSenderChange = (nextEmail: string) => {
		setSender(nextEmail);
		const nextAccount = verified.find((account) => account.email === nextEmail);
		const nextName = senderNameForAccount(nextAccount);
		if (nextName) {
			const prevName = activeSenderNameRef.current;
			if (prevName !== nextName) {
				setBody((prev) => swapSenderName(prev, prevName, nextName));
				setFollowUpBody((prev) => swapSenderName(prev, prevName, nextName));
				activeSenderNameRef.current = nextName;
			}
		}
	};

	const logSend = useMutation(
		trpc.contacts.logUnifersSend.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.contacts.unifersSends.queryKey({
						id: recipient.contactId,
					}),
				}),
			onError: (error) =>
				toast.error(`Sent, but the CRM did not record it: ${error.message}`),
		}),
	);

	const withFollowUp = followUp && followUpBody.trim() !== "";

	const send = useMutation({
		mutationFn: () =>
			campaignsApi.create({
				name: `${UNIFERS.singleSend.namePrefix} ${recipient.name} · ${new Date().toLocaleString()}`,
				senders: [chosenSender],
				sequence: [
					{ subject: subject.trim(), body: body.trim(), waitDays: 0 },
					...(withFollowUp
						? [
								{
									subject: followUpSubject(subject),
									body: followUpBody.trim(),
									waitDays: waitDaysUntil(followUpOn),
								},
							]
						: []),
				],
				sendWindow: {
					...UNIFERS.singleSend.window,
					days: [...UNIFERS.singleSend.window.days],
					timeZone: UNIFERS.defaultTimeZone,
				},
				stopConditions: { ...UNIFERS.singleSend.stopConditions },
				startAt: "now",
				leads: [
					{
						email: recipient.email,
						fullName: recipient.name,
						...(recipient.companyName
							? { companyName: recipient.companyName }
							: {}),
					},
				],
			}),
		onSuccess: async (created) => {
			await cache.everything();
			const rejected = created.leads?.rejected[0];
			if (rejected) {
				toast.error(
					`Unifers did not accept ${recipient.email}: ${rejected.message}`,
				);
				return;
			}
			if (created.leads && created.leads.added === 0) {
				toast.error(
					`${recipient.email} is already in another Unifers campaign, so nothing was sent.`,
				);
				return;
			}
			await logSend.mutateAsync({
				contactId: recipient.contactId,
				campaignId: created.campaign.id,
				sender: chosenSender,
				subject: subject.trim(),
				body: body.trim(),
				followUpAt: withFollowUp ? followUpOn : null,
			});
			toast.success(
				withFollowUp
					? `Sending to ${recipient.email}. Follow-up on ${followUpOn} unless they reply.`
					: `Sending to ${recipient.email} from ${chosenSender}.`,
			);
			onClose();
		},
		onError: (error) => toast.error(error.message),
	});

	const ready =
		chosenSender !== "" &&
		subject.trim() !== "" &&
		body.trim() !== "" &&
		(!followUp || followUpBody.trim() !== "") &&
		!draft.isPending &&
		!send.isPending;

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
			<DialogContent className="sm:max-w-(--container-sheet)">
				<DialogHeader>
					<DialogTitle>Email {recipient.name}</DialogTitle>
					<DialogDescription>
						Claude writes the email from what the CRM knows about{" "}
						{recipient.email}. Unifers sends it now from the mailbox you pick.
					</DialogDescription>
				</DialogHeader>
				<DialogBody>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={ids.from}>From</FieldLabel>
							{verified.length > 0 ? (
								<Select value={chosenSender} onValueChange={handleSenderChange}>
									<SelectTrigger id={ids.from}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{verified.map((account) => (
											<SelectItem key={account.email} value={account.email}>
												{account.fromName
													? `${account.fromName} <${account.email}>`
													: account.email}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<FieldDescription>
									{accounts.isPending
										? "Loading Unifers mailboxes…"
										: accounts.isError
											? accounts.error.message
											: "No verified Unifers mailbox. Connect one in Outreach → Campaigns."}
								</FieldDescription>
							)}
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.product}>Product</FieldLabel>
							<Select
								value={productId}
								disabled={draft.isPending}
								onValueChange={(next) => {
									setProductId(next);
									rewrite({ product: next });
								}}
							>
								<SelectTrigger id={ids.product}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_PRODUCT}>No product</SelectItem>
									{productOptions.map((product) => (
										<SelectItem key={product.id} value={product.id}>
											{product.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								Claude writes the email about this product. Changing it rewrites
								the draft.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.category}>Lead type</FieldLabel>
							<Select
								value={category}
								disabled={draft.isPending}
								onValueChange={(next) => {
									setCategory(next);
									rewrite({ category: next });
								}}
							>
								<SelectTrigger id={ids.category}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={AUTO_CATEGORY}>
										From how the lead was found
									</SelectItem>
									{LEAD_CATEGORIES.map((value) => (
										<SelectItem key={value} value={value}>
											{LEAD_CATEGORY_LABEL[value]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								Sets the pitch: GPU compute, training labs, or an alternative to
								their current cloud. Leads added from Lead generation already
								carry it.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.purpose}>
								What is this email for?
							</FieldLabel>
							<div className="flex gap-2">
								<Input
									id={ids.purpose}
									value={purpose}
									placeholder="A first introduction"
									onChange={(event) => setPurpose(event.target.value)}
								/>
								<Button
									variant="outline"
									disabled={draft.isPending}
									onClick={() => rewrite()}
								>
									{draft.isPending ? "Writing…" : "Rewrite"}
								</Button>
							</div>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.subject}>Subject</FieldLabel>
							<Input
								id={ids.subject}
								value={subject}
								disabled={draft.isPending}
								placeholder={draft.isPending ? "Claude is writing…" : ""}
								onChange={(event) => setSubject(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={ids.body}>Message</FieldLabel>
							<Textarea
								id={ids.body}
								rows={8}
								value={body}
								disabled={draft.isPending}
								placeholder={draft.isPending ? "Claude is writing…" : ""}
								onChange={(event) => setBody(event.target.value)}
							/>
						</Field>
						<Field orientation="horizontal">
							<Checkbox
								id={ids.followUp}
								checked={followUp}
								onCheckedChange={(checked) => setFollowUp(checked === true)}
							/>
							<FieldLabel htmlFor={ids.followUp}>
								Send a follow-up if they do not reply
							</FieldLabel>
						</Field>
						{followUp ? (
							<>
								<Field>
									<FieldLabel htmlFor={ids.followUpOn}>Follow-up on</FieldLabel>
									<DatePicker
										id={ids.followUpOn}
										value={followUpOn}
										onChange={(day) =>
											setFollowUpOn(day || defaultFollowUpDay(null))
										}
									/>
									<FieldDescription>
										Starts from the contact's next follow-up date. Sending saves
										this date on the contact. A reply stops the follow-up.
									</FieldDescription>
								</Field>
								<Field>
									<FieldLabel htmlFor={ids.followUpBody}>
										Follow-up message
									</FieldLabel>
									<Textarea
										id={ids.followUpBody}
										rows={5}
										value={followUpBody}
										disabled={draft.isPending}
										placeholder={draft.isPending ? "Claude is writing…" : ""}
										onChange={(event) => setFollowUpBody(event.target.value)}
									/>
								</Field>
							</>
						) : null}
					</FieldGroup>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button disabled={!ready} onClick={() => send.mutate()}>
						{send.isPending ? "Sending…" : "Send now"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
