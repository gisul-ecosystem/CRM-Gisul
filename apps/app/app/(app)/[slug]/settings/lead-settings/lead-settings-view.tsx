"use client";

import Add from "@carbon/icons-react/es/Add";
import Building from "@carbon/icons-react/es/Building";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Enterprise from "@carbon/icons-react/es/Enterprise";
import LinkIcon from "@carbon/icons-react/es/Link";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
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
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type LeadSettingsData = RouterOutputs["workspace"]["leadSettings"];
type LeadSource = LeadSettingsData["sources"][number];
type LeadField = LeadSettingsData["fields"][number];
type LeadStatus = LeadSettingsData["statuses"][number];
type LeadAssignmentRule = LeadSettingsData["assignmentRules"][number];

const STATUS_COLOR_OPTIONS = [
	{ hex: "#94a3b8", label: "Gray" },
	{ hex: "#3b82f6", label: "Blue" },
	{ hex: "#f97316", label: "Orange" },
	{ hex: "#eab308", label: "Yellow" },
	{ hex: "#22c55e", label: "Green" },
	{ hex: "#ef4444", label: "Red" },
	{ hex: "#8b5cf6", label: "Purple" },
	{ hex: "#ec4899", label: "Pink" },
];

export function LeadSettingsView() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(trpc.workspace.leadSettings.queryOptions());
	const membersQuery = useQuery(trpc.workspace.members.queryOptions({}));

	// Modal states
	const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
	const [newSourceName, setNewSourceName] = useState("");
	const [newSourceType, setNewSourceType] = useState<"online" | "offline">("online");

	const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
	const [newFieldName, setNewFieldName] = useState("");
	const [newFieldType, setNewFieldType] = useState<"text" | "email" | "phone" | "dropdown" | "textarea">("text");
	const [newFieldRequired, setNewFieldRequired] = useState(false);
	const [newFieldShowInForm, setNewFieldShowInForm] = useState(true);

	const [isAddStatusOpen, setIsAddStatusOpen] = useState(false);
	const [newStatusName, setNewStatusName] = useState("");
	const [newStatusColor, setNewStatusColor] = useState("#3b82f6");

	const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
	const [newRuleTitle, setNewRuleTitle] = useState("");
	const [newRuleDescription, setNewRuleDescription] = useState("");
	const [newRuleIcon, setNewRuleIcon] = useState("link");

	// --- Mutations ---
	const createSourceMutation = useMutation(
		trpc.workspace.createLeadSource.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Lead source added");
				setIsAddSourceOpen(false);
				setNewSourceName("");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateSourceMutation = useMutation(
		trpc.workspace.updateLeadSource.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Lead source updated");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteSourceMutation = useMutation(
		trpc.workspace.deleteLeadSource.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Lead source removed");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createFieldMutation = useMutation(
		trpc.workspace.createLeadField.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Lead field added");
				setIsAddFieldOpen(false);
				setNewFieldName("");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateFieldMutation = useMutation(
		trpc.workspace.updateLeadField.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteFieldMutation = useMutation(
		trpc.workspace.deleteLeadField.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Lead field removed");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createStatusMutation = useMutation(
		trpc.workspace.createLeadStatus.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Lead status added");
				setIsAddStatusOpen(false);
				setNewStatusName("");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteStatusMutation = useMutation(
		trpc.workspace.deleteLeadStatus.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Lead status removed");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createRuleMutation = useMutation(
		trpc.workspace.createLeadAssignmentRule.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Assignment rule created");
				setIsAddRuleOpen(false);
				setNewRuleTitle("");
				setNewRuleDescription("");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateRuleMutation = useMutation(
		trpc.workspace.updateLeadAssignmentRule.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteRuleMutation = useMutation(
		trpc.workspace.deleteLeadAssignmentRule.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Assignment rule removed");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateOwnerMutation = useMutation(
		trpc.workspace.updateDefaultLeadOwner.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.leadSettings.queryKey() });
				toast.success("Default lead owner updated");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner className="size-6 text-[#5e3da8]" />
			</div>
		);
	}

	const sources = data?.sources ?? [];
	const fields = data?.fields ?? [];
	const statuses = data?.statuses ?? [];
	const rules = data?.assignmentRules ?? [];
	const defaultOwner = data?.defaultOwner;
	const members = membersQuery.data?.rows ?? [];

	return (
		<div className="flex flex-col gap-6 pb-12">
			{/* Main 2-Column Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
				{/* LEFT COLUMN */}
				<div className="flex flex-col gap-6">
					{/* CARD 1: Lead Sources */}
					<div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
						<div className="flex items-center justify-between gap-4 pb-4 border-b border-border/40">
							<div>
								<h2 className="text-base font-bold text-foreground">Lead Sources</h2>
								<p className="text-xs text-muted-foreground mt-0.5">
									Manage the sources from which your leads come.
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setIsAddSourceOpen(true)}
								className="rounded-full border-[#5e3da8]/30 text-[#5e3da8] hover:bg-[#5e3da8]/10 hover:border-[#5e3da8] font-medium text-xs h-8 px-3.5 transition-all shadow-none"
							>
								<Icon icon={Add} className="size-3.5 mr-1" />
								Add Source
							</Button>
						</div>

						<div className="mt-3 overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="text-muted-foreground border-b border-border/30 font-medium">
										<th className="py-2.5 px-2 w-8">#</th>
										<th className="py-2.5 px-3">Source Name</th>
										<th className="py-2.5 px-3">Type</th>
										<th className="py-2.5 px-3 text-center">Leads</th>
										<th className="py-2.5 px-3 text-center">Status</th>
										<th className="py-2.5 px-2 w-8 text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/20">
									{sources.map((source, index) => (
										<tr key={source.id} className="hover:bg-muted/30 transition-colors group">
											<td className="py-3 px-2 text-muted-foreground font-mono">
												{index + 1}
											</td>
											<td className="py-3 px-3 font-semibold text-foreground">
												{source.name}
											</td>
											<td className="py-3 px-3">
												<span
													className={cn(
														"inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium capitalize",
														source.type === "online"
															? "bg-blue-50 text-blue-600 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400"
															: "bg-slate-100 text-slate-600 border border-slate-200/60 dark:bg-slate-800/40 dark:text-slate-400",
													)}
												>
													{source.type}
												</span>
											</td>
											<td className="py-3 px-3 text-center font-semibold text-foreground">
												{source.leadsCount}
											</td>
											<td className="py-3 px-3 text-center">
												<span
													className={cn(
														"inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold",
														source.status === "active"
															? "bg-emerald-50 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400"
															: "bg-neutral-100 text-neutral-500 border border-neutral-200/60 dark:bg-neutral-800/40 dark:text-neutral-400",
													)}
												>
													{source.status === "active" ? "Active" : "Inactive"}
												</span>
											</td>
											<td className="py-3 px-2 text-right">
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon-xs"
															className="size-7 rounded-md text-muted-foreground hover:text-foreground"
														>
															<Icon icon={OverflowMenuVertical} className="size-3.5" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="w-36">
														<DropdownMenuItem
															onClick={() =>
																updateSourceMutation.mutate({
																	id: source.id,
																	status: source.status === "active" ? "inactive" : "active",
																})
															}
														>
															{source.status === "active" ? "Mark Inactive" : "Mark Active"}
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem
															className="text-destructive focus:text-destructive"
															onClick={() => deleteSourceMutation.mutate({ id: source.id })}
														>
															<Icon icon={TrashCan} className="size-3.5 mr-2" />
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

					{/* CARD 2: Lead Fields */}
					<div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
						<div className="flex items-center justify-between gap-4 pb-4 border-b border-border/40">
							<div>
								<h2 className="text-base font-bold text-foreground">Lead Fields</h2>
								<p className="text-xs text-muted-foreground mt-0.5">
									Manage the information you capture for each lead.
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setIsAddFieldOpen(true)}
								className="rounded-full border-[#5e3da8]/30 text-[#5e3da8] hover:bg-[#5e3da8]/10 hover:border-[#5e3da8] font-medium text-xs h-8 px-3.5 transition-all shadow-none"
							>
								<Icon icon={Add} className="size-3.5 mr-1" />
								Add Field
							</Button>
						</div>

						<div className="mt-3 overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="text-muted-foreground border-b border-border/30 font-medium">
										<th className="py-2.5 px-2 w-8">#</th>
										<th className="py-2.5 px-3">Field Name</th>
										<th className="py-2.5 px-3">Type</th>
										<th className="py-2.5 px-3 text-center">Required</th>
										<th className="py-2.5 px-3 text-center">Show in Form</th>
										<th className="py-2.5 px-2 w-8 text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/20">
									{fields.map((field, index) => (
										<tr key={field.id} className="hover:bg-muted/30 transition-colors group">
											<td className="py-3 px-2 text-muted-foreground font-mono">
												{index + 1}
											</td>
											<td className="py-3 px-3 font-semibold text-foreground">
												{field.name}
											</td>
											<td className="py-3 px-3">
												<span
													className={cn(
														"inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium capitalize",
														field.type === "text" && "bg-blue-50 text-blue-600 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400",
														field.type === "email" && "bg-emerald-50 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400",
														field.type === "phone" && "bg-rose-50 text-rose-600 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400",
														field.type === "dropdown" && "bg-purple-50 text-purple-600 border border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-400",
														field.type === "textarea" && "bg-indigo-50 text-indigo-600 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-400",
													)}
												>
													{field.type}
												</span>
											</td>
											<td className="py-3 px-3 text-center">
												<div className="flex justify-center">
													<Switch
														checked={field.required}
														onCheckedChange={(checked) =>
															updateFieldMutation.mutate({
																id: field.id,
																required: checked,
															})
														}
														className="data-[state=checked]:bg-[#5e3da8]"
													/>
												</div>
											</td>
											<td className="py-3 px-3 text-center">
												<div className="flex justify-center">
													<Switch
														checked={field.showInForm}
														onCheckedChange={(checked) =>
															updateFieldMutation.mutate({
																id: field.id,
																showInForm: checked,
															})
														}
														className="data-[state=checked]:bg-[#5e3da8]"
													/>
												</div>
											</td>
											<td className="py-3 px-2 text-right">
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon-xs"
															className="size-7 rounded-md text-muted-foreground hover:text-foreground"
														>
															<Icon icon={OverflowMenuVertical} className="size-3.5" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="w-32">
														<DropdownMenuItem
															className="text-destructive focus:text-destructive"
															onClick={() => deleteFieldMutation.mutate({ id: field.id })}
														>
															<Icon icon={TrashCan} className="size-3.5 mr-2" />
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
				</div>

				{/* RIGHT COLUMN */}
				<div className="flex flex-col gap-6">
					{/* CARD 3: Lead Statuses */}
					<div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
						<div className="flex items-center justify-between gap-4 pb-4 border-b border-border/40">
							<div>
								<h2 className="text-base font-bold text-foreground">Lead Statuses</h2>
								<p className="text-xs text-muted-foreground mt-0.5">
									Define the status a lead can be in.
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setIsAddStatusOpen(true)}
								className="rounded-full border-[#5e3da8]/30 text-[#5e3da8] hover:bg-[#5e3da8]/10 hover:border-[#5e3da8] font-medium text-xs h-8 px-3.5 transition-all shadow-none"
							>
								<Icon icon={Add} className="size-3.5 mr-1" />
								Add Status
							</Button>
						</div>

						<div className="mt-3 overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="text-muted-foreground border-b border-border/30 font-medium">
										<th className="py-2.5 px-2 w-8">#</th>
										<th className="py-2.5 px-3">Status Name</th>
										<th className="py-2.5 px-3 text-center">Color</th>
										<th className="py-2.5 px-2 w-8 text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/20">
									{statuses.map((status, index) => (
										<tr key={status.id} className="hover:bg-muted/30 transition-colors group">
											<td className="py-3 px-2 text-muted-foreground font-mono">
												{index + 1}
											</td>
											<td className="py-3 px-3 font-semibold text-foreground">
												{status.name}
											</td>
											<td className="py-3 px-3 text-center">
												<div className="flex items-center justify-center">
													<span
														className="size-3 rounded-full border border-black/10 shadow-2xs inline-block"
														style={{ backgroundColor: status.color }}
													/>
												</div>
											</td>
											<td className="py-3 px-2 text-right">
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon-xs"
															className="size-7 rounded-md text-muted-foreground hover:text-foreground"
														>
															<Icon icon={OverflowMenuVertical} className="size-3.5" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="w-32">
														<DropdownMenuItem
															className="text-destructive focus:text-destructive"
															onClick={() => deleteStatusMutation.mutate({ id: status.id })}
														>
															<Icon icon={TrashCan} className="size-3.5 mr-2" />
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

					{/* CARD 4: Lead Assignment */}
					<div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
						<div className="flex items-center justify-between gap-4 pb-4 border-b border-border/40">
							<div>
								<h2 className="text-base font-bold text-foreground">Lead Assignment</h2>
								<p className="text-xs text-muted-foreground mt-0.5">
									Set rules for automatic lead assignment.
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setIsAddRuleOpen(true)}
								className="rounded-full border-[#5e3da8]/30 text-[#5e3da8] hover:bg-[#5e3da8]/10 hover:border-[#5e3da8] font-medium text-xs h-8 px-3.5 transition-all shadow-none"
							>
								<Icon icon={Add} className="size-3.5 mr-1" />
								Add Rule
							</Button>
						</div>

						<div className="mt-4 flex flex-col divide-y divide-border/20">
							{rules.map((rule) => {
								let iconBg = "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400";
								let ruleIcon = LinkIcon;

								if (rule.icon === "building") {
									iconBg = "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400";
									ruleIcon = Building;
								} else if (rule.icon === "social") {
									iconBg = "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400";
									ruleIcon = UserFollow;
								} else if (rule.icon === "users") {
									iconBg = "bg-purple-100 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400";
									ruleIcon = UserMultiple;
								}

								return (
									<div
										key={rule.id}
										className="py-3.5 flex items-center justify-between gap-4 group"
									>
										<div className="flex items-center gap-3 min-w-0">
											<div
												className={cn(
													"size-9 rounded-full flex items-center justify-center shrink-0",
													iconBg,
												)}
											>
												<Icon icon={ruleIcon} className="size-4" />
											</div>
											<div className="min-w-0">
												<p className="text-xs font-semibold text-foreground leading-snug">
													{rule.title}
												</p>
												<p className="text-[11px] text-muted-foreground truncate">
													{rule.description}
												</p>
											</div>
										</div>

										<div className="flex items-center gap-2 shrink-0">
											<Switch
												checked={rule.enabled}
												onCheckedChange={(checked) =>
													updateRuleMutation.mutate({
														id: rule.id,
														enabled: checked,
													})
												}
												className="data-[state=checked]:bg-[#5e3da8]"
											/>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon-xs"
														className="size-7 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
													>
														<Icon icon={OverflowMenuVertical} className="size-3.5" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-32">
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onClick={() => deleteRuleMutation.mutate({ id: rule.id })}
													>
														<Icon icon={TrashCan} className="size-3.5 mr-2" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* CARD 5: Default Lead Owner */}
					<div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
						<h2 className="text-base font-bold text-foreground">Default Lead Owner</h2>
						<p className="text-xs text-muted-foreground mt-0.5 mb-4">
							Choose default owner for new leads (if no rules match).
						</p>

						<Select
							value={defaultOwner?.userId ?? ""}
							onValueChange={(val) => updateOwnerMutation.mutate({ userId: val || null })}
						>
							<SelectTrigger className="w-full h-11 rounded-xl bg-background border-border/60">
								<SelectValue placeholder="Select default lead owner">
									{defaultOwner?.name ? (
										<div className="flex items-center gap-2">
											<span className="size-6 rounded-full bg-[#5e3da8]/15 text-[#5e3da8] text-xs font-semibold flex items-center justify-center">
												{defaultOwner.name.charAt(0)}
											</span>
											<span className="text-xs font-medium text-foreground">
												{defaultOwner.name}
												{defaultOwner.role ? (
													<span className="text-muted-foreground ml-1.5 font-normal">
														({defaultOwner.role})
													</span>
												) : null}
											</span>
										</div>
									) : (
										"Select Default Owner"
									)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{members.map((m) => (
									<SelectItem key={m.userId} value={m.userId}>
										<div className="flex items-center gap-2">
											<span className="size-5 rounded-full bg-[#5e3da8]/15 text-[#5e3da8] text-[10px] font-semibold flex items-center justify-center">
												{m.name.charAt(0)}
											</span>
											<span>
												{m.name}{" "}
												<span className="text-muted-foreground text-[11px]">
													({m.role})
												</span>
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{/* DIALOG 1: Add Lead Source */}
			<Dialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen}>
				<DialogContent className="max-w-md rounded-2xl">
					<DialogHeader>
						<DialogTitle>Add Lead Source</DialogTitle>
						<DialogDescription>
							Create a new acquisition source for incoming leads.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel>Source Name</FieldLabel>
							<Input
								placeholder="e.g. Conferences, Paid Ads"
								value={newSourceName}
								onChange={(e) => setNewSourceName(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Source Type</FieldLabel>
							<Select
								value={newSourceType}
								onValueChange={(v) => setNewSourceType(v as "online" | "offline")}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="online">Online</SelectItem>
									<SelectItem value="offline">Offline</SelectItem>
								</SelectContent>
							</Select>
						</Field>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							onClick={() =>
								createSourceMutation.mutate({
									name: newSourceName,
									type: newSourceType,
								})
							}
							disabled={!newSourceName.trim() || createSourceMutation.isPending}
							className="bg-[#5e3da8] hover:bg-[#5e3da8]/90 text-white"
						>
							{createSourceMutation.isPending ? (
								<Spinner className="size-4 mr-2" />
							) : null}
							Save Source
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* DIALOG 2: Add Lead Field */}
			<Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
				<DialogContent className="max-w-md rounded-2xl">
					<DialogHeader>
						<DialogTitle>Add Lead Field</DialogTitle>
						<DialogDescription>
							Configure a new custom data field for capturing lead info.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel>Field Name</FieldLabel>
							<Input
								placeholder="e.g. Budget, Timeframe"
								value={newFieldName}
								onChange={(e) => setNewFieldName(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Field Type</FieldLabel>
							<Select
								value={newFieldType}
								onValueChange={(v) => setNewFieldType(v as any)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="text">Text</SelectItem>
									<SelectItem value="email">Email</SelectItem>
									<SelectItem value="phone">Phone</SelectItem>
									<SelectItem value="dropdown">Dropdown</SelectItem>
									<SelectItem value="textarea">Textarea</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<div className="flex items-center justify-between pt-2">
							<span className="text-xs font-medium text-foreground">Required Field</span>
							<Switch
								checked={newFieldRequired}
								onCheckedChange={setNewFieldRequired}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-foreground">Show in Lead Form</span>
							<Switch
								checked={newFieldShowInForm}
								onCheckedChange={setNewFieldShowInForm}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							onClick={() =>
								createFieldMutation.mutate({
									name: newFieldName,
									type: newFieldType,
									required: newFieldRequired,
									showInForm: newFieldShowInForm,
								})
							}
							disabled={!newFieldName.trim() || createFieldMutation.isPending}
							className="bg-[#5e3da8] hover:bg-[#5e3da8]/90 text-white"
						>
							{createFieldMutation.isPending ? (
								<Spinner className="size-4 mr-2" />
							) : null}
							Save Field
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* DIALOG 3: Add Lead Status */}
			<Dialog open={isAddStatusOpen} onOpenChange={setIsAddStatusOpen}>
				<DialogContent className="max-w-md rounded-2xl">
					<DialogHeader>
						<DialogTitle>Add Lead Status</DialogTitle>
						<DialogDescription>
							Define a new stage or state for qualifying leads.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel>Status Name</FieldLabel>
							<Input
								placeholder="e.g. Discovery, Demo Scheduled"
								value={newStatusName}
								onChange={(e) => setNewStatusName(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Badge Color</FieldLabel>
							<div className="flex flex-wrap gap-2.5 pt-1">
								{STATUS_COLOR_OPTIONS.map((c) => (
									<button
										key={c.hex}
										type="button"
										onClick={() => setNewStatusColor(c.hex)}
										className={cn(
											"size-7 rounded-full transition-transform flex items-center justify-center shadow-xs",
											newStatusColor === c.hex
												? "scale-110 ring-2 ring-[#5e3da8] ring-offset-2"
												: "hover:scale-105",
										)}
										style={{ backgroundColor: c.hex }}
									>
										{newStatusColor === c.hex ? (
											<Icon icon={Checkmark} className="size-3.5 text-white stroke-2" />
										) : null}
									</button>
								))}
							</div>
						</Field>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							onClick={() =>
								createStatusMutation.mutate({
									name: newStatusName,
									color: newStatusColor,
								})
							}
							disabled={!newStatusName.trim() || createStatusMutation.isPending}
							className="bg-[#5e3da8] hover:bg-[#5e3da8]/90 text-white"
						>
							{createStatusMutation.isPending ? (
								<Spinner className="size-4 mr-2" />
							) : null}
							Save Status
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* DIALOG 4: Add Assignment Rule */}
			<Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
				<DialogContent className="max-w-md rounded-2xl">
					<DialogHeader>
						<DialogTitle>Add Assignment Rule</DialogTitle>
						<DialogDescription>
							Set condition and automation for routing incoming leads.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel>Rule Title</FieldLabel>
							<Input
								placeholder="e.g. Route enterprise leads to Enterprise Pod"
								value={newRuleTitle}
								onChange={(e) => setNewRuleTitle(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Rule Condition / Description</FieldLabel>
							<Input
								placeholder="e.g. Company size > 1000 or Source is Enterprise Form"
								value={newRuleDescription}
								onChange={(e) => setNewRuleDescription(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Icon Category</FieldLabel>
							<Select value={newRuleIcon} onValueChange={setNewRuleIcon}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="link">Link (Source matching)</SelectItem>
									<SelectItem value="building">Building (Company matching)</SelectItem>
									<SelectItem value="social">Social (Campaign/LinkedIn)</SelectItem>
									<SelectItem value="users">Users (Team/Round robin)</SelectItem>
								</SelectContent>
							</Select>
						</Field>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							onClick={() =>
								createRuleMutation.mutate({
									title: newRuleTitle,
									description: newRuleDescription,
									icon: newRuleIcon,
									enabled: true,
								})
							}
							disabled={!newRuleTitle.trim() || createRuleMutation.isPending}
							className="bg-[#5e3da8] hover:bg-[#5e3da8]/90 text-white"
						>
							{createRuleMutation.isPending ? (
								<Spinner className="size-4 mr-2" />
							) : null}
							Create Rule
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
