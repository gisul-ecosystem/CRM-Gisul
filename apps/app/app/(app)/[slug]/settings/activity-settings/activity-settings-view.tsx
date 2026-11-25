"use client";

import Add from "@carbon/icons-react/es/Add";
import Alarm from "@carbon/icons-react/es/Alarm";
import Calendar from "@carbon/icons-react/es/Calendar";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Email from "@carbon/icons-react/es/Email";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Phone from "@carbon/icons-react/es/Phone";
import Renew from "@carbon/icons-react/es/Renew";
import Time from "@carbon/icons-react/es/Time";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import UserFollow from "@carbon/icons-react/es/UserFollow";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type ActivitySettingsData = RouterOutputs["workspace"]["activitySettings"];
type ActivityTypeItem = ActivitySettingsData["activityTypes"][number];
type ActivityAssignmentRule = ActivitySettingsData["assignmentRules"][number];

const REMINDER_TIMING_OPTIONS = [
	"At time of activity",
	"5 minutes before",
	"15 minutes before",
	"1 hour before",
	"1 day before",
	"2 days before",
	"1 week before",
];

const DURATION_OPTIONS = [
	"15 minutes",
	"30 minutes",
	"45 minutes",
	"1 hour",
	"2 hours",
];

const AUTO_FOLLOW_UP_OPTIONS = [
	"None",
	"Log outcome",
	"Send follow-up email",
	"Create new task",
];

export function ActivitySettingsView() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		trpc.workspace.activitySettings.queryOptions(),
	);

	// Modals
	const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
	const [newTypeName, setNewTypeName] = useState("");
	const [newTypeIcon, setNewTypeIcon] = useState("checkmark");
	const [newTypeReminder, setNewTypeReminder] = useState("1 day before");
	const [newTypeFollowUp, setNewTypeFollowUp] = useState("None");

	const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
	const [newRuleName, setNewRuleName] = useState("");
	const [newRuleAppliesTo, setNewRuleAppliesTo] = useState("All Activities");
	const [newRuleCondition, setNewRuleCondition] = useState("");
	const [newRuleAssignTo, setNewRuleAssignTo] = useState("");

	// --- Mutations ---
	const updateDefaultSettingsMutation = useMutation(
		trpc.workspace.updateDefaultActivitySettings.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
				toast.success("Default settings updated");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateReminderRulesMutation = useMutation(
		trpc.workspace.updateReminderRules.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
				toast.success("Reminder rules updated");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateCompletionBehaviorMutation = useMutation(
		trpc.workspace.updateCompletionBehavior.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
				toast.success("Completion behavior updated");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createTypeMutation = useMutation(
		trpc.workspace.createActivityType.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
				toast.success("Activity type added");
				setIsAddTypeOpen(false);
				setNewTypeName("");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateTypeMutation = useMutation(
		trpc.workspace.updateActivityType.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteTypeMutation = useMutation(
		trpc.workspace.deleteActivityType.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
				toast.success("Activity type removed");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createAssignmentRuleMutation = useMutation(
		trpc.workspace.createActivityAssignmentRule.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
				toast.success("Assignment rule added");
				setIsAddRuleOpen(false);
				setNewRuleName("");
				setNewRuleCondition("");
				setNewRuleAssignTo("");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateAssignmentRuleMutation = useMutation(
		trpc.workspace.updateActivityAssignmentRule.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteAssignmentRuleMutation = useMutation(
		trpc.workspace.deleteActivityAssignmentRule.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.activitySettings.queryKey(),
				});
				toast.success("Assignment rule deleted");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	if (isLoading || !data) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<Spinner className="h-6 w-6 text-muted-foreground" />
			</div>
		);
	}

	const renderIcon = (type: ActivityTypeItem) => {
		const iconName = type.icon.toLowerCase();
		if (iconName.includes("phone") || iconName.includes("call")) {
			return (
				<div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
					<Icon icon={Phone} className="h-4 w-4" />
				</div>
			);
		}
		if (iconName.includes("calendar") || iconName.includes("meeting")) {
			return (
				<div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400">
					<Icon icon={Calendar} className="h-4 w-4" />
				</div>
			);
		}
		if (iconName.includes("mail")) {
			return (
				<div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
					<Icon icon={Email} className="h-4 w-4" />
				</div>
			);
		}
		if (iconName.includes("sync") || iconName.includes("renew") || iconName.includes("follow")) {
			return (
				<div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
					<Icon icon={Renew} className="h-4 w-4" />
				</div>
			);
		}
		return (
			<div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
				<Icon icon={Checkmark} className="h-4 w-4" />
			</div>
		);
	};

	const handleTimingToggle = (timing: string) => {
		const current = data.reminderRules.timingOptions || [];
		const next = current.includes(timing)
			? current.filter((t) => t !== timing)
			: [...current, timing];
		updateReminderRulesMutation.mutate({ timingOptions: next });
	};

	return (
		<div className="flex flex-col gap-6 pb-12">
			{/* SECTION 1: Activity Types */}
			<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
				<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div>
						<h3 className="text-base font-bold text-foreground">
							Activity Types
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Manage the activity types available in your CRM.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsAddTypeOpen(true)}
						className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-xl"
					>
						<Icon icon={Add} className="h-3.5 w-3.5" />
						Add Activity Type
					</Button>
				</div>

				<div className="mt-5 overflow-x-auto">
					<table className="w-full text-left text-xs">
						<thead>
							<tr className="border-b border-border/40 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
								<th className="pb-3 pl-1 font-semibold w-10">#</th>
								<th className="pb-3 font-semibold min-w-[120px]">TYPE</th>
								<th className="pb-3 font-semibold w-16">ICON</th>
								<th className="pb-3 font-semibold min-w-[170px]">
									DEFAULT REMINDER
								</th>
								<th className="pb-3 font-semibold min-w-[190px]">
									AUTO FOLLOW-UP
								</th>
								<th className="pb-3 font-semibold w-20 text-center">
									STATUS
								</th>
								<th className="pb-3 pr-2 font-semibold w-12 text-right">
									ACTIONS
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/30 font-medium">
							{data.activityTypes.map((type, index) => (
								<tr
									key={type.id}
									className="group hover:bg-muted/30 transition-colors"
								>
									<td className="py-3.5 pl-1 text-muted-foreground font-semibold">
										{index + 1}
									</td>
									<td className="py-3.5 font-semibold text-foreground">
										{type.name}
									</td>
									<td className="py-3.5">{renderIcon(type)}</td>
									<td className="py-3.5 pr-4">
										<Select
											value={type.defaultReminder}
											onValueChange={(val) => {
												updateTypeMutation.mutate({
													id: type.id,
													defaultReminder: val,
												});
											}}
										>
											<SelectTrigger className="h-8 w-[150px] text-xs rounded-lg border-border/60 bg-background/70">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{REMINDER_TIMING_OPTIONS.concat([
													"No reminder",
												]).map((opt) => (
													<SelectItem key={opt} value={opt} className="text-xs">
														{opt}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</td>
									<td className="py-3.5 pr-4">
										<Select
											value={type.autoFollowUp}
											onValueChange={(val) => {
												updateTypeMutation.mutate({
													id: type.id,
													autoFollowUp: val,
												});
											}}
										>
											<SelectTrigger className="h-8 w-[170px] text-xs rounded-lg border-border/60 bg-background/70">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{AUTO_FOLLOW_UP_OPTIONS.map((opt) => (
													<SelectItem key={opt} value={opt} className="text-xs">
														{opt}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</td>
									<td className="py-3.5 text-center">
										<Switch
											checked={type.status}
											onCheckedChange={(checked) => {
												updateTypeMutation.mutate({
													id: type.id,
													status: checked,
												});
											}}
											className="data-[state=checked]:bg-primary"
										/>
									</td>
									<td className="py-3.5 pr-2 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
												>
													<Icon
														icon={OverflowMenuVertical}
														className="h-4 w-4"
													/>
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() => {
														const newName = prompt(
															"Enter new name for activity type:",
															type.name,
														);
														if (newName && newName.trim()) {
															updateTypeMutation.mutate({
																id: type.id,
																name: newName.trim(),
															});
														}
													}}
												>
													Edit Name
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => {
														if (
															confirm(
																`Delete activity type "${type.name}"?`,
															)
														) {
															deleteTypeMutation.mutate({ id: type.id });
														}
													}}
												>
													<Icon
														icon={TrashCan}
														className="mr-2 h-3.5 w-3.5"
													/>
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* SECTION 2: Default Settings */}
			<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
				<h3 className="text-base font-bold text-foreground">
					Default Settings
				</h3>
				<p className="text-xs text-muted-foreground mt-1">
					Set default values for new activities.
				</p>

				<div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
					<div>
						<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1.5 block">
							Default Activity Type
						</FieldLabel>
						<Select
							value={data.defaultSettings.defaultActivityType}
							onValueChange={(val) => {
								updateDefaultSettingsMutation.mutate({
									defaultActivityType: val,
								});
							}}
						>
							<SelectTrigger className="h-10 text-xs rounded-xl border-border/60 bg-background/70">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{data.activityTypes.map((t) => (
									<SelectItem key={t.id} value={t.id} className="text-xs">
										{t.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1.5 block">
							Default Duration
						</FieldLabel>
						<Select
							value={data.defaultSettings.defaultDuration}
							onValueChange={(val) => {
								updateDefaultSettingsMutation.mutate({
									defaultDuration: val,
								});
							}}
						>
							<SelectTrigger className="h-10 text-xs rounded-xl border-border/60 bg-background/70">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DURATION_OPTIONS.map((dur) => (
									<SelectItem key={dur} value={dur} className="text-xs">
										{dur}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1.5 block">
							Default Reminder Time
						</FieldLabel>
						<Select
							value={data.defaultSettings.defaultReminderTime}
							onValueChange={(val) => {
								updateDefaultSettingsMutation.mutate({
									defaultReminderTime: val,
								});
							}}
						>
							<SelectTrigger className="h-10 text-xs rounded-xl border-border/60 bg-background/70">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{REMINDER_TIMING_OPTIONS.map((rem) => (
									<SelectItem key={rem} value={rem} className="text-xs">
										{rem}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<FieldLabel className="text-xs font-semibold text-muted-foreground mb-1.5 block">
							Default Owner
						</FieldLabel>
						<Select
							value={
								data.defaultSettings.defaultOwnerId ||
								data.members[0]?.id ||
								""
							}
							onValueChange={(val) => {
								updateDefaultSettingsMutation.mutate({
									defaultOwnerId: val,
								});
							}}
						>
							<SelectTrigger className="h-10 text-xs rounded-xl border-border/60 bg-background/70">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{data.members.map((m) => (
									<SelectItem key={m.id} value={m.id} className="text-xs">
										{m.name} ({m.role})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="mt-6 flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 p-4">
					<div>
						<p className="text-xs font-bold text-foreground">
							Add to Calendar
						</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">
							Automatically add meetings to Google Calendar
						</p>
					</div>
					<Switch
						checked={data.defaultSettings.addToCalendar}
						onCheckedChange={(checked) => {
							updateDefaultSettingsMutation.mutate({
								addToCalendar: checked,
							});
						}}
						className="data-[state=checked]:bg-primary"
					/>
				</div>
			</div>

			{/* SECTION 3: Two Side-by-Side Cards */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* 3A: Reminder & Notification Rules */}
				<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
					<h3 className="text-base font-bold text-foreground">
						Reminder & Notification Rules
					</h3>
					<p className="text-xs text-muted-foreground mt-1">
						Configure when and how reminders are sent.
					</p>

					<div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="space-y-4">
							<div className="flex items-start justify-between gap-3">
								<div className="flex gap-2.5">
									<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
										<Icon icon={Alarm} className="h-4 w-4" />
									</div>
									<div>
										<p className="text-xs font-semibold text-foreground">
											Enable activity reminders
										</p>
										<p className="text-[11px] text-muted-foreground">
											Send in-app and email reminders for upcoming
											activities
										</p>
									</div>
								</div>
								<Switch
									checked={data.reminderRules.enableActivityReminders}
									onCheckedChange={(checked) => {
										updateReminderRulesMutation.mutate({
											enableActivityReminders: checked,
										});
									}}
									className="data-[state=checked]:bg-primary shrink-0"
								/>
							</div>

							<div className="flex items-start justify-between gap-3">
								<div className="flex gap-2.5">
									<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
										<Icon icon={Email} className="h-4 w-4" />
									</div>
									<div>
										<p className="text-xs font-semibold text-foreground">
											Email reminders
										</p>
										<p className="text-[11px] text-muted-foreground">
											Send email notifications for activity reminders
										</p>
									</div>
								</div>
								<Switch
									checked={data.reminderRules.emailReminders}
									onCheckedChange={(checked) => {
										updateReminderRulesMutation.mutate({
											emailReminders: checked,
										});
									}}
									className="data-[state=checked]:bg-primary shrink-0"
								/>
							</div>

							<div className="flex items-start justify-between gap-3">
								<div className="flex gap-2.5">
									<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
										<Icon icon={Time} className="h-4 w-4" />
									</div>
									<div>
										<p className="text-xs font-semibold text-foreground">
											Overdue notifications
										</p>
										<p className="text-[11px] text-muted-foreground">
											Notify when an activity is past due date
										</p>
									</div>
								</div>
								<Switch
									checked={data.reminderRules.overdueNotifications}
									onCheckedChange={(checked) => {
										updateReminderRulesMutation.mutate({
											overdueNotifications: checked,
										});
									}}
									className="data-[state=checked]:bg-primary shrink-0"
								/>
							</div>
						</div>

						<div className="border-t border-border/40 pt-4 md:border-t-0 md:border-l md:pl-5 md:pt-0">
							<p className="text-xs font-bold text-foreground mb-3">
								Reminder Timing Options
							</p>
							<div className="space-y-2">
								{REMINDER_TIMING_OPTIONS.map((timing) => {
									const isChecked = (
										data.reminderRules.timingOptions || []
									).includes(timing);
									return (
										<label
											key={timing}
											className="flex items-center gap-2 cursor-pointer text-xs text-foreground/90 select-none hover:text-foreground"
										>
											<input
												type="checkbox"
												checked={isChecked}
												onChange={() => handleTimingToggle(timing)}
												className="h-3.5 w-3.5 rounded border-border/80 text-primary focus:ring-primary accent-purple-600"
											/>
											<span>{timing}</span>
										</label>
									);
								})}
							</div>
						</div>
					</div>
				</div>

				{/* 3B: Completion Behavior */}
				<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
					<h3 className="text-base font-bold text-foreground">
						Completion Behavior
					</h3>
					<p className="text-xs text-muted-foreground mt-1">
						Define what happens when an activity is marked as completed.
					</p>

					<div className="mt-5 space-y-4">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs font-semibold text-foreground">
									Allow adding notes
								</p>
								<p className="text-[11px] text-muted-foreground">
									Team members can add completion notes
								</p>
							</div>
							<Switch
								checked={data.completionBehavior.allowAddingNotes}
								onCheckedChange={(checked) => {
									updateCompletionBehaviorMutation.mutate({
										allowAddingNotes: checked,
									});
								}}
								className="data-[state=checked]:bg-primary shrink-0"
							/>
						</div>

						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs font-semibold text-foreground">
									Update deal stage (optional)
								</p>
								<p className="text-[11px] text-muted-foreground">
									Automatically suggest next stage
								</p>
							</div>
							<Switch
								checked={data.completionBehavior.updateDealStage}
								onCheckedChange={(checked) => {
									updateCompletionBehaviorMutation.mutate({
										updateDealStage: checked,
									});
								}}
								className="data-[state=checked]:bg-primary shrink-0"
							/>
						</div>

						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs font-semibold text-foreground">
									Create follow-up activity
								</p>
								<p className="text-[11px] text-muted-foreground">
									Show option to create next activity after completion
								</p>
							</div>
							<Switch
								checked={data.completionBehavior.createFollowUpActivity}
								onCheckedChange={(checked) => {
									updateCompletionBehaviorMutation.mutate({
										createFollowUpActivity: checked,
									});
								}}
								className="data-[state=checked]:bg-primary shrink-0"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* SECTION 4: Auto Assignment Rules */}
			<div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
				<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div>
						<h3 className="text-base font-bold text-foreground">
							Auto Assignment Rules
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Automatically assign activities to team members.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsAddRuleOpen(true)}
						className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-xl"
					>
						<Icon icon={Add} className="h-3.5 w-3.5" />
						Add Rule
					</Button>
				</div>

				<div className="mt-5 overflow-x-auto">
					<table className="w-full text-left text-xs">
						<thead>
							<tr className="border-b border-border/40 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
								<th className="pb-3 pl-1 font-semibold w-10">#</th>
								<th className="pb-3 font-semibold min-w-[150px]">
									RULE NAME
								</th>
								<th className="pb-3 font-semibold min-w-[140px]">
									APPLIES TO
								</th>
								<th className="pb-3 font-semibold min-w-[180px]">
									CONDITION
								</th>
								<th className="pb-3 font-semibold min-w-[170px]">
									ASSIGN TO
								</th>
								<th className="pb-3 font-semibold w-20 text-center">
									STATUS
								</th>
								<th className="pb-3 pr-2 font-semibold w-12 text-right">
									ACTIONS
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/30 font-medium">
							{data.assignmentRules.map((rule, index) => (
								<tr
									key={rule.id}
									className="group hover:bg-muted/30 transition-colors"
								>
									<td className="py-3.5 pl-1 text-muted-foreground font-semibold">
										{index + 1}
									</td>
									<td className="py-3.5 font-semibold text-foreground">
										{rule.name}
									</td>
									<td className="py-3.5 text-foreground/80">
										{rule.appliesTo}
									</td>
									<td className="py-3.5 text-muted-foreground">
										{rule.condition}
									</td>
									<td className="py-3.5 text-foreground font-medium">
										{rule.assignTo}
									</td>
									<td className="py-3.5 text-center">
										<Switch
											checked={rule.status}
											onCheckedChange={(checked) => {
												updateAssignmentRuleMutation.mutate({
													id: rule.id,
													status: checked,
												});
											}}
											className="data-[state=checked]:bg-primary"
										/>
									</td>
									<td className="py-3.5 pr-2 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
												>
													<Icon
														icon={OverflowMenuVertical}
														className="h-4 w-4"
													/>
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() => {
														const newName = prompt(
															"Enter rule name:",
															rule.name,
														);
														if (newName && newName.trim()) {
															updateAssignmentRuleMutation.mutate({
																id: rule.id,
																name: newName.trim(),
															});
														}
													}}
												>
													Edit Name
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => {
														if (
															confirm(
																`Delete assignment rule "${rule.name}"?`,
															)
														) {
															deleteAssignmentRuleMutation.mutate({
																id: rule.id,
															});
														}
													}}
												>
													<Icon
														icon={TrashCan}
														className="mr-2 h-3.5 w-3.5"
													/>
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Add Activity Type Modal */}
			<Dialog open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add Activity Type</DialogTitle>
						<DialogDescription>
							Create a new activity type for your CRM pipeline and workflow.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel>Activity Name</FieldLabel>
							<Input
								placeholder="e.g. Discovery Call, Site Visit"
								value={newTypeName}
								onChange={(e) => setNewTypeName(e.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel>Icon Style</FieldLabel>
							<Select value={newTypeIcon} onValueChange={setNewTypeIcon}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="checkmark">Task / Checkmark</SelectItem>
									<SelectItem value="phone">Call / Phone</SelectItem>
									<SelectItem value="calendar">Meeting / Calendar</SelectItem>
									<SelectItem value="email">Email / Envelope</SelectItem>
									<SelectItem value="sync">Follow-up / Refresh</SelectItem>
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel>Default Reminder</FieldLabel>
							<Select
								value={newTypeReminder}
								onValueChange={setNewTypeReminder}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{REMINDER_TIMING_OPTIONS.concat([
										"No reminder",
									]).map((opt) => (
										<SelectItem key={opt} value={opt}>
											{opt}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel>Auto Follow-Up Action</FieldLabel>
							<Select
								value={newTypeFollowUp}
								onValueChange={setNewTypeFollowUp}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{AUTO_FOLLOW_UP_OPTIONS.map((opt) => (
										<SelectItem key={opt} value={opt}>
											{opt}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							disabled={!newTypeName.trim() || createTypeMutation.isPending}
							onClick={() => {
								createTypeMutation.mutate({
									name: newTypeName.trim(),
									icon: newTypeIcon,
									defaultReminder: newTypeReminder,
									autoFollowUp: newTypeFollowUp,
									status: true,
								});
							}}
						>
							{createTypeMutation.isPending ? "Adding..." : "Add Activity Type"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add Assignment Rule Modal */}
			<Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add Assignment Rule</DialogTitle>
						<DialogDescription>
							Define auto-assignment logic based on activity type and criteria.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel>Rule Name</FieldLabel>
							<Input
								placeholder="e.g. VIP Client Demos"
								value={newRuleName}
								onChange={(e) => setNewRuleName(e.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel>Applies To</FieldLabel>
							<Input
								placeholder="e.g. Calls, Meetings, All Activities"
								value={newRuleAppliesTo}
								onChange={(e) => setNewRuleAppliesTo(e.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel>Condition</FieldLabel>
							<Input
								placeholder="e.g. Deal value > ₹1,00,000 or Source is Website"
								value={newRuleCondition}
								onChange={(e) => setNewRuleCondition(e.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel>Assign To</FieldLabel>
							<Input
								placeholder="e.g. Sales Team (Round Robin) or Member Name"
								value={newRuleAssignTo}
								onChange={(e) => setNewRuleAssignTo(e.target.value)}
							/>
						</Field>
					</div>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							disabled={
								!newRuleName.trim() ||
								!newRuleCondition.trim() ||
								!newRuleAssignTo.trim() ||
								createAssignmentRuleMutation.isPending
							}
							onClick={() => {
								createAssignmentRuleMutation.mutate({
									name: newRuleName.trim(),
									appliesTo: newRuleAppliesTo.trim(),
									condition: newRuleCondition.trim(),
									assignTo: newRuleAssignTo.trim(),
									status: true,
								});
							}}
						>
							{createAssignmentRuleMutation.isPending
								? "Adding..."
								: "Add Rule"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
