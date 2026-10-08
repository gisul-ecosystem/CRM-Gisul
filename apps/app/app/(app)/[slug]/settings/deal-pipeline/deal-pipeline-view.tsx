"use client";

import Add from "@carbon/icons-react/es/Add";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Close from "@carbon/icons-react/es/Close";
import Draggable from "@carbon/icons-react/es/Draggable";
import Filter from "@carbon/icons-react/es/Filter";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Pause from "@carbon/icons-react/es/Pause";
import TrashCan from "@carbon/icons-react/es/TrashCan";
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
import { formatMoney } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type PipelineStage = RouterOutputs["deals"]["pipelineOverview"]["stages"][number];

const STAGE_COLORS = [
	"#6C5CE7",
	"#3B82F6",
	"#F59E0B",
	"#F97316",
	"#10B981",
	"#EF4444",
	"#8B5CF6",
	"#EC4899",
	"#14B8A6",
	"#64748B",
];

const STAGE_THEMES: Record<string, { bg: string; text: string }> = {
	DEMO_BOOKED: { bg: "#dcd6f7", text: "#5e3da8" },
	QUALIFIED_TO_BUY: { bg: "#cbe0fb", text: "#2563eb" },
	DECISION_MAKER_BOUGHT_IN: { bg: "#fbe6cb", text: "#d97706" },
	CONTRACT_SENT: { bg: "#fcd5d1", text: "#e11d48" },
	CLOSED_WON: { bg: "#c7f4da", text: "#059669" },
	CLOSED_LOST: { bg: "#cce0fa", text: "#2563eb" },
};

export function DealPipelineView() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const overviewQuery = useQuery(trpc.deals.pipelineOverview.queryOptions());

	const [addStageOpen, setAddStageOpen] = useState(false);
	const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);

	const [stageName, setStageName] = useState("");
	const [stageProb, setStageProb] = useState(50);
	const [stageColor, setStageColor] = useState("#6C5CE7");
	const [stageKind, setStageKind] = useState<"open" | "won" | "lost">("open");
	const [stageStatus, setStageStatus] = useState<"active" | "won" | "lost" | "inactive">("active");

	const nameId = useId();
	const probId = useId();

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.deals.pipelineOverview.queryKey(),
		});

	const updateSettingsMutation = useMutation(
		trpc.deals.updatePipelineSettings.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Pipeline settings saved.");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createStageMutation = useMutation(
		trpc.deals.createPipelineStage.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Stage added to pipeline.");
				setAddStageOpen(false);
				resetForm();
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateStageMutation = useMutation(
		trpc.deals.updatePipelineStage.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Stage updated successfully.");
				setEditingStage(null);
				resetForm();
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteStageMutation = useMutation(
		trpc.deals.deletePipelineStage.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Stage deleted from pipeline.");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const resetForm = () => {
		setStageName("");
		setStageProb(50);
		setStageColor("#6C5CE7");
		setStageKind("open");
		setStageStatus("active");
	};

	const openEditModal = (stage: PipelineStage) => {
		setEditingStage(stage);
		setStageName(stage.name);
		setStageProb(stage.probability);
		setStageColor(stage.color);
		setStageKind(stage.kind);
		setStageStatus(stage.status);
	};

	if (overviewQuery.isLoading) {
		return (
			<div className="flex justify-center py-20">
				<Spinner className="h-7 w-7 text-[#5e3da8]" />
			</div>
		);
	}

	const data = overviewQuery.data ?? {
		stages: [],
		stats: { totalStages: 0, activeStages: 0, closedWon: 0, closedLost: 0 },
		currency: "USD",
		settings: {
			enableProbabilityTracking: true,
			requireStageUpdateNotes: true,
			autoAssignDeals: false,
			defaultStage: "DEMO_BOOKED",
			applyToAllProducts: true,
			allowSkippingStages: false,
		},
		canManage: true,
	};

	const { stages, stats, currency, settings, canManage } = data;

	return (
		<div className="flex w-full flex-col gap-6">
			{/* Top Header Row with + Add Stage Button */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-bold tracking-tight text-foreground uppercase">
						Deal Pipeline
					</h2>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Customize your deal stages and settings.
					</p>
				</div>
				<Button
					disabled={!canManage}
					onClick={() => {
						resetForm();
						setAddStageOpen(true);
					}}
					className="h-9 gap-1.5 rounded-xl bg-[#5e3da8] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#4d328a]"
				>
					<Icon icon={Add} className="h-3.5 w-3.5" />
					Add Stage
				</Button>
			</div>

			{/* Top 4 Summary Metric Cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{/* Total Stages */}
				<div className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
						<Icon icon={Filter} className="h-5 w-5" />
					</div>
					<div>
						<div className="text-xl font-bold text-foreground">{stats.totalStages}</div>
						<div className="text-[11px] font-medium text-muted-foreground">Total Stages</div>
					</div>
				</div>

				{/* Active Stages */}
				<div className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
						<span className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
					</div>
					<div>
						<div className="text-xl font-bold text-foreground">{stats.activeStages}</div>
						<div className="text-[11px] font-medium text-muted-foreground">Active Stages</div>
					</div>
				</div>

				{/* Closed Won */}
				<div className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
						<Icon icon={Pause} className="h-5 w-5" />
					</div>
					<div>
						<div className="text-xl font-bold text-foreground">{stats.closedWon}</div>
						<div className="text-[11px] font-medium text-muted-foreground">Closed Won</div>
					</div>
				</div>

				{/* Closed Lost */}
				<div className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
						<Icon icon={Close} className="h-5 w-5" />
					</div>
					<div>
						<div className="text-xl font-bold text-foreground">{stats.closedLost}</div>
						<div className="text-[11px] font-medium text-muted-foreground">Closed Lost</div>
					</div>
				</div>
			</div>

			{/* Deal Stages Table Container */}
			<div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
				<div>
					<h3 className="text-sm font-bold text-foreground">Deal Stages</h3>
					<p className="text-xs text-muted-foreground">
						Define and manage the stages in your sales pipeline.
					</p>
				</div>

				<div className="overflow-x-auto rounded-xl border border-border/40">
					<table className="w-full text-left text-xs">
						<thead className="bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase">
							<tr className="border-b border-border/40">
								<th className="w-12 px-4 py-3 text-center">#</th>
								<th className="px-4 py-3">Stage Name</th>
								<th className="px-4 py-3 text-center">Probability</th>
								<th className="px-4 py-3 text-center">Color</th>
								<th className="px-4 py-3 text-center">Status</th>
								<th className="w-12 px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/30">
							{stages.map((stage, idx) => (
								<tr
									key={stage.id}
									className="group transition-colors hover:bg-muted/40"
								>
									{/* Drag handle + Position */}
									<td className="px-4 py-3 text-center">
										<div className="flex items-center justify-center gap-1 text-muted-foreground">
											<Icon
												icon={Draggable}
												className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100"
											/>
											<span className="font-semibold">{idx + 1}</span>
										</div>
									</td>

									{/* Stage Name + Dot */}
									<td className="px-4 py-3">
										<div className="flex items-center gap-2.5">
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{ backgroundColor: stage.color }}
											/>
											<span className="font-bold text-foreground">{stage.name}</span>
										</div>
									</td>

									{/* Probability */}
									<td className="px-4 py-3 text-center font-semibold text-muted-foreground">
										{stage.probability}%
									</td>

									{/* Color Badge */}
									<td className="px-4 py-3 text-center">
										<span
											className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold"
											style={{
												backgroundColor: `${stage.color}15`,
												color: stage.color,
											}}
										>
											{stage.color}
										</span>
									</td>

									{/* Status */}
									<td className="px-4 py-3 text-center">
										{stage.kind === "won" ? (
											<span className="inline-flex rounded-lg border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
												Closed Won
											</span>
										) : stage.kind === "lost" ? (
											<span className="inline-flex rounded-lg border border-rose-200/80 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
												Closed Lost
											</span>
										) : (
											<Select
												value={stage.status}
												onValueChange={(val) =>
													updateStageMutation.mutate({
														id: stage.id,
														status: val as any,
													})
												}
												disabled={!canManage}
											>
												<SelectTrigger className="h-7 w-24 rounded-lg border-emerald-200 bg-emerald-50/70 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100/70 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="active">Active</SelectItem>
													<SelectItem value="inactive">Inactive</SelectItem>
												</SelectContent>
											</Select>
										)}
									</td>

									{/* Actions */}
									<td className="px-4 py-3 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
												>
													<Icon icon={OverflowMenuVertical} className="h-3.5 w-3.5" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-40 rounded-xl">
												<DropdownMenuItem
													disabled={!canManage}
													onClick={() => openEditModal(stage)}
													className="text-xs font-medium"
												>
													Edit Stage
												</DropdownMenuItem>
												<DropdownMenuItem
													disabled={!canManage}
													onClick={() =>
														createStageMutation.mutate({
															name: `${stage.name} (Copy)`,
															probability: stage.probability,
															color: stage.color,
															kind: stage.kind,
															status: stage.status,
														})
													}
													className="text-xs font-medium"
												>
													Duplicate Stage
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													disabled={!canManage}
													onClick={() => {
														if (confirm(`Delete stage "${stage.name}"?`)) {
															deleteStageMutation.mutate({ id: stage.id });
														}
													}}
													className="text-xs font-medium text-rose-600 focus:text-rose-600 dark:text-rose-400"
												>
													<Icon icon={TrashCan} className="h-3.5 w-3.5" />
													Delete Stage
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

			{/* Pipeline Preview Section */}
			<div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
				<div>
					<h3 className="text-sm font-bold text-foreground">Pipeline Preview</h3>
					<p className="text-xs text-muted-foreground">
						Visual representation of your deal pipeline.
					</p>
				</div>

				{/* Chevron Arrow Stage Flow */}
				<div className="overflow-x-auto pb-2">
					<div className="flex min-w-[760px] items-stretch gap-2.5 pt-2">
						{stages.map((stage) => {
							const theme =
								STAGE_THEMES[stage.stage] || {
									bg: `${stage.color}25`,
									text: stage.color,
								};

							return (
								<div key={stage.id} className="flex flex-1 flex-col gap-2.5">
									{/* Chevron Arrow Block */}
									<div
										className="relative flex h-[62px] flex-col items-center justify-center pl-5 pr-5 text-center transition-transform hover:scale-[1.02]"
										style={{
											clipPath:
												"polygon(0% 0%, calc(100% - 15px) 0%, 100% 50%, calc(100% - 15px) 100%, 0% 100%, 15px 50%)",
											backgroundColor: theme.bg,
										}}
									>
										<span
											className="truncate text-xs font-semibold leading-tight"
											style={{ color: theme.text }}
										>
											{stage.name}
										</span>
										<span
											className="mt-0.5 text-[11px] font-medium opacity-90"
											style={{ color: theme.text }}
										>
											{stage.probability}%
										</span>
									</div>

									{/* Deals stats below */}
									<div className="flex flex-col items-center text-center">
										<span className="text-[11px] font-normal text-muted-foreground">
											{stage.dealCount} {stage.dealCount === 1 ? "deals" : "deals"}
										</span>
										<span className="text-xs font-bold text-foreground mt-0.5">
											{formatMoney(stage.totalValueCents, currency)}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* Bottom 2 Settings Cards */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{/* PIPELINE SETTINGS */}
				<div className="flex flex-col justify-between gap-5 rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
					<div>
						<h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
							Pipeline Settings
						</h3>
						<p className="mt-0.5 text-xs text-muted-foreground/80">
							Configure how the pipeline works for your team.
						</p>
					</div>

					<div className="flex flex-col gap-4 border-t border-border/40 pt-4">
						{/* Enable probability tracking */}
						<div className="flex items-center justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Enable probability tracking
								</div>
								<div className="text-[11px] text-muted-foreground">
									Set win probability for each stage
								</div>
							</div>
							<Switch
								checked={settings.enableProbabilityTracking}
								onCheckedChange={(checked) =>
									updateSettingsMutation.mutate({
										enableProbabilityTracking: checked,
									})
								}
								disabled={!canManage}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>

						{/* Require stage update notes */}
						<div className="flex items-center justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Require stage update notes
								</div>
								<div className="text-[11px] text-muted-foreground">
									Add notes when moving a deal to next stage
								</div>
							</div>
							<Switch
								checked={settings.requireStageUpdateNotes}
								onCheckedChange={(checked) =>
									updateSettingsMutation.mutate({
										requireStageUpdateNotes: checked,
									})
								}
								disabled={!canManage}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>

						{/* Auto-assign deals */}
						<div className="flex items-center justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Auto-assign deals
								</div>
								<div className="text-[11px] text-muted-foreground">
									Automatically assign deals to team members
								</div>
							</div>
							<Switch
								checked={settings.autoAssignDeals}
								onCheckedChange={(checked) =>
									updateSettingsMutation.mutate({
										autoAssignDeals: checked,
									})
								}
								disabled={!canManage}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>
					</div>
				</div>

				{/* DEFAULT STAGE FOR NEW DEALS */}
				<div className="flex flex-col justify-between gap-5 rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
					<div>
						<h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
							Default Stage for New Deals
						</h3>
						<p className="mt-0.5 text-xs text-muted-foreground/80">
							Choose the initial stage when new deals are created.
						</p>
					</div>

					<div className="flex flex-col gap-4 border-t border-border/40 pt-4">
						{/* Default stage dropdown */}
						<Select
							value={settings.defaultStage}
							onValueChange={(val) =>
								updateSettingsMutation.mutate({ defaultStage: val })
							}
							disabled={!canManage}
						>
							<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{stages.map((s) => (
									<SelectItem key={s.id} value={s.stage}>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* Apply to all products */}
						<div className="flex items-center justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Apply to all products
								</div>
								<div className="text-[11px] text-muted-foreground">
									Use the same pipeline for all products
								</div>
							</div>
							<Switch
								checked={settings.applyToAllProducts}
								onCheckedChange={(checked) =>
									updateSettingsMutation.mutate({
										applyToAllProducts: checked,
									})
								}
								disabled={!canManage}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>

						{/* Allow skipping stages */}
						<div className="flex items-center justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Allow skipping stages
								</div>
								<div className="text-[11px] text-muted-foreground">
									Let users move deals to non-sequential stages
								</div>
							</div>
							<Switch
								checked={settings.allowSkippingStages}
								onCheckedChange={(checked) =>
									updateSettingsMutation.mutate({
										allowSkippingStages: checked,
									})
								}
								disabled={!canManage}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Add / Edit Stage Modal */}
			<Dialog
				open={addStageOpen || Boolean(editingStage)}
				onOpenChange={(open) => {
					if (!open) {
						setAddStageOpen(false);
						setEditingStage(null);
						resetForm();
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingStage ? "Edit Pipeline Stage" : "Add Pipeline Stage"}
						</DialogTitle>
						<DialogDescription>
							{editingStage
								? "Update the stage name, win probability, and visual indicator."
								: "Add a new stage to your sales funnel."}
						</DialogDescription>
					</DialogHeader>

					<form
						className="flex flex-col gap-4 py-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (editingStage) {
								updateStageMutation.mutate({
									id: editingStage.id,
									name: stageName,
									probability: Number(stageProb),
									color: stageColor,
									status: stageStatus,
								});
							} else {
								createStageMutation.mutate({
									name: stageName,
									probability: Number(stageProb),
									color: stageColor,
									kind: stageKind,
									status: stageStatus,
								});
							}
						}}
					>
						<Field>
							<FieldLabel htmlFor={nameId}>Stage Name</FieldLabel>
							<Input
								id={nameId}
								value={stageName}
								onChange={(e) => setStageName(e.target.value)}
								placeholder="e.g. Qualification, Discovery, Proposal"
								className="rounded-xl"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={probId}>Win Probability (%)</FieldLabel>
							<Input
								id={probId}
								type="number"
								min={0}
								max={100}
								value={stageProb}
								onChange={(e) => setStageProb(Number(e.target.value))}
								className="rounded-xl"
								required
							/>
							<FieldDescription>
								Expected probability of winning a deal at this stage.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel>Stage Color</FieldLabel>
							<div className="flex flex-wrap gap-2.5 pt-1">
								{STAGE_COLORS.map((swatch) => (
									<button
										key={swatch}
										type="button"
										className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
										style={{
											backgroundColor: swatch,
											borderColor:
												stageColor.toLowerCase() === swatch.toLowerCase()
													? "#1c1a2e"
													: "transparent",
											boxShadow:
												stageColor.toLowerCase() === swatch.toLowerCase()
													? "0 0 0 2px rgba(94,61,168,0.4)"
													: "none",
										}}
										onClick={() => setStageColor(swatch)}
									/>
								))}
							</div>
						</Field>

						<DialogFooter className="mt-3 gap-2">
							<DialogClose asChild>
								<Button type="button" variant="outline" className="rounded-xl">
									Cancel
								</Button>
							</DialogClose>
							<Button
								type="submit"
								disabled={
									createStageMutation.isPending || updateStageMutation.isPending
								}
								className="rounded-xl bg-[#5e3da8] text-white hover:bg-[#4d328a]"
							>
								{createStageMutation.isPending || updateStageMutation.isPending ? (
									<Spinner className="mr-1.5 h-3.5 w-3.5" />
								) : null}
								{editingStage ? "Save Changes" : "Create Stage"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
