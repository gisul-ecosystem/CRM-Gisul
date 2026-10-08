"use client";

import Add from "@carbon/icons-react/es/Add";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import Copy from "@carbon/icons-react/es/Copy";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import Search from "@carbon/icons-react/es/Search";
import UserFollow from "@carbon/icons-react/es/UserFollow";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
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
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const AVATAR_COLORS = [
	"bg-indigo-600 text-white",
	"bg-blue-600 text-white",
	"bg-violet-600 text-white",
	"bg-purple-600 text-white",
	"bg-pink-600 text-white",
	"bg-amber-600 text-white",
	"bg-emerald-600 text-white",
	"bg-cyan-600 text-white",
];

function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
	}
	return (name.slice(0, 2) || "U").toUpperCase();
}

function RoleBadge({ role }: { role: string }) {
	const normalized = role.toLowerCase();
	if (normalized.includes("manager") && normalized.includes("sales")) {
		return (
			<span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
				Sales Manager
			</span>
		);
	}
	if (normalized.includes("executive")) {
		return (
			<span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
				Sales Executive
			</span>
		);
	}
	if (normalized.includes("product")) {
		return (
			<span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
				Product Manager
			</span>
		);
	}
	if (normalized.includes("marketing") || normalized.includes("market")) {
		return (
			<span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
				Marketing
			</span>
		);
	}
	if (normalized.includes("customer") || normalized.includes("success")) {
		return (
			<span className="inline-flex items-center rounded-md bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
				Customer Success
			</span>
		);
	}
	return (
		<span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
			{role}
		</span>
	);
}

function StatusBadge({ status }: { status: "active" | "pending" | "inactive" }) {
	if (status === "active") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
				<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
				Active
			</span>
		);
	}
	if (status === "pending") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
				<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
				Pending
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
			<span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
			Inactive
		</span>
	);
}

export function UsersTeamsView() {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [searchQuery, setSearchQuery] = useState("");
	const [teamFilter, setTeamFilter] = useState("all");
	const [roleFilter, setRoleFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");

	const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
	const [addTeamOpen, setAddTeamOpen] = useState(false);
	const [newTeamName, setNewTeamName] = useState("");
	const [addRoleOpen, setAddRoleOpen] = useState(false);
	const [newRoleName, setNewRoleName] = useState("");
	const [newRoleDesc, setNewRoleDesc] = useState("");

	const [allowInvites, setAllowInvites] = useState(true);
	const [defaultRole, setDefaultRole] = useState("Viewer");
	const [copied, setCopied] = useState(false);
	const [statusOverrides, setStatusOverrides] = useState<
		Record<string, "active" | "pending" | "inactive">
	>({});
	const [roleOverrides, setRoleOverrides] = useState<Record<string, string>>({});
	const [teamOverrides, setTeamOverrides] = useState<Record<string, string>>({});

	const workspaceQuery = useQuery(trpc.workspace.get.queryOptions());
	const membersQuery = useQuery(
		trpc.workspace.members.queryOptions({
			page: 1,
			pageSize: 50,
			q: searchQuery,
		}),
	);
	const teamsQuery = useQuery(trpc.workspace.teams.queryOptions());
	const rolesQuery = useQuery(trpc.workspace.roles.queryOptions());
	const inviteSettingsQuery = useQuery(
		trpc.workspace.invitationSettings.queryOptions(),
	);

	const setMemberRole = useMutation(
		trpc.workspace.setMemberRole.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				toast.success("Role updated successfully.");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const setMemberTeam = useMutation(
		trpc.workspace.updateMemberTeam.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				toast.success("Team updated successfully.");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const setMemberStatus = useMutation(
		trpc.workspace.updateMemberStatus.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createTeamMutation = useMutation(
		trpc.workspace.createTeam.mutationOptions({
			onSuccess: () => {
				setAddTeamOpen(false);
				setNewTeamName("");
				toast.success("Team created successfully.");
			},
		}),
	);

	const createRoleMutation = useMutation(
		trpc.workspace.createRole.mutationOptions({
			onSuccess: () => {
				setAddRoleOpen(false);
				setNewRoleName("");
				setNewRoleDesc("");
				toast.success("Role created successfully.");
			},
		}),
	);

	const allUsers = useMemo(() => {
		const dbRows = membersQuery.data?.rows ?? [];

		const baseList = dbRows.map((r, idx) => ({
			id: r.id,
			userId: r.userId,
			name: r.name,
			email: r.email,
			image: r.image,
			role: r.role === "owner" ? "Sales Manager" : r.role === "admin" ? "Product Manager" : "Sales Executive",
			team: r.team || (idx % 2 === 0 ? "Sales" : "Product"),
			status: (r.status || "active") as "active" | "pending" | "inactive",
			lastActive: r.lastActive ? "Today, 11:20 AM" : "Today",
			joinedAt: r.joinedAt,
			isViewer: r.isViewer,
		}));

		return baseList.map((u) => ({
			...u,
			status: statusOverrides[u.id] ?? u.status,
			role: roleOverrides[u.id] ?? u.role,
			team: teamOverrides[u.id] ?? u.team,
		}));
	}, [membersQuery.data?.rows, statusOverrides, roleOverrides, teamOverrides]);

	const filteredUsers = useMemo(() => {
		return allUsers.filter((user) => {
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const matches =
					user.name.toLowerCase().includes(q) ||
					user.email.toLowerCase().includes(q);
				if (!matches) return false;
			}
			if (teamFilter !== "all" && user.team.toLowerCase() !== teamFilter.toLowerCase()) {
				return false;
			}
			if (roleFilter !== "all" && user.role.toLowerCase() !== roleFilter.toLowerCase()) {
				return false;
			}
			if (statusFilter !== "all" && user.status.toLowerCase() !== statusFilter.toLowerCase()) {
				return false;
			}
			return true;
		});
	}, [allUsers, searchQuery, teamFilter, roleFilter, statusFilter]);

	const allSelected =
		filteredUsers.length > 0 &&
		filteredUsers.every((u) => selectedRows[u.id]);

	const handleToggleAll = () => {
		if (allSelected) {
			setSelectedRows({});
		} else {
			const next: Record<string, boolean> = {};
			for (const u of filteredUsers) {
				next[u.id] = true;
			}
			setSelectedRows(next);
		}
	};

	const handleCopyInviteLink = () => {
		const link =
			inviteSettingsQuery.data?.inviteLink ||
			`https://crm.gisul.id/invite/${workspaceQuery.data?.slug || "workspace"}`;
		navigator.clipboard.writeText(link);
		setCopied(true);
		toast.success("Invite link copied to clipboard!");
		setTimeout(() => setCopied(false), 2000);
	};

	const teamsList = teamsQuery.data ?? [
		{ id: "sales", name: "Sales", memberCount: 3, icon: "user" },
		{ id: "product", name: "Product", memberCount: 2, icon: "grid" },
		{ id: "marketing", name: "Marketing", memberCount: 3, icon: "chart" },
		{ id: "customer-success", name: "Customer Success", memberCount: 1, icon: "headset" },
	];

	const rolesList = rolesQuery.data ?? [
		{ id: "sales-manager", name: "Sales Manager", description: "Full access to sales data", userCount: 3 },
		{ id: "sales-executive", name: "Sales Executive", description: "Manage leads and deals", userCount: 2 },
		{ id: "product-manager", name: "Product Manager", description: "Access to product data", userCount: 1 },
		{ id: "marketing", name: "Marketing", description: "Access to marketing data", userCount: 2 },
		{ id: "viewer", name: "Viewer", description: "Read-only access", userCount: 1 },
	];

	const inviteLink =
		inviteSettingsQuery.data?.inviteLink ||
		`https://crm.gisul.id/invite/${workspaceQuery.data?.slug || "gisul-software-services"}`;

	return (
		<div className="flex w-full flex-col gap-6 pb-12">
			{/* Main Card: TEAM MEMBERS */}
			<div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
				<div className="flex flex-col gap-4">
					{/* Card Header with Filters */}
					<div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
						<div>
							<h2 className="text-sm font-bold tracking-tight uppercase text-foreground">
								Team Members
							</h2>
							<p className="text-[11px] text-muted-foreground">
								View and manage all users in your workspace.
							</p>
						</div>

						{/* Dropdown Filters */}
						<div className="flex flex-wrap items-center gap-2">
							<Select value={teamFilter} onValueChange={setTeamFilter}>
								<SelectTrigger className="h-8 w-28 rounded-lg bg-background text-[11px] font-medium">
									<SelectValue placeholder="All Teams" />
								</SelectTrigger>
								<SelectContent align="end">
									<SelectItem value="all">All Teams</SelectItem>
									<SelectItem value="Sales">Sales</SelectItem>
									<SelectItem value="Product">Product</SelectItem>
									<SelectItem value="Marketing">Marketing</SelectItem>
									<SelectItem value="Customer Success">Customer Success</SelectItem>
								</SelectContent>
							</Select>

							<Select value={roleFilter} onValueChange={setRoleFilter}>
								<SelectTrigger className="h-8 w-28 rounded-lg bg-background text-[11px] font-medium">
									<SelectValue placeholder="All Roles" />
								</SelectTrigger>
								<SelectContent align="end">
									<SelectItem value="all">All Roles</SelectItem>
									<SelectItem value="Sales Manager">Sales Manager</SelectItem>
									<SelectItem value="Sales Executive">Sales Executive</SelectItem>
									<SelectItem value="Product Manager">Product Manager</SelectItem>
									<SelectItem value="Marketing">Marketing</SelectItem>
									<SelectItem value="Customer Success">Customer Success</SelectItem>
									<SelectItem value="Viewer">Viewer</SelectItem>
								</SelectContent>
							</Select>

							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="h-8 w-28 rounded-lg bg-background text-[11px] font-medium">
									<SelectValue placeholder="All Statuses" />
								</SelectTrigger>
								<SelectContent align="end">
									<SelectItem value="all">All Statuses</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="pending">Pending</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Search Bar */}
					<div className="relative w-full">
						<Icon
							icon={Search}
							className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search users by name or email..."
							className="h-8.5 w-full rounded-xl bg-muted/40 pl-9 text-xs placeholder:text-muted-foreground/70 focus-visible:bg-background"
						/>
					</div>

					{/* Members Table */}
					<div className="overflow-x-auto rounded-xl border border-border/40">
						<table className="w-full text-left text-xs">
							<thead className="bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase">
								<tr className="border-b border-border/40">
									<th className="w-9 px-3 py-2.5 text-center">
										<Checkbox
											checked={allSelected}
											onCheckedChange={handleToggleAll}
											aria-label="Select all"
										/>
									</th>
									<th className="px-3 py-2.5">Name</th>
									<th className="px-3 py-2.5">Role</th>
									<th className="px-3 py-2.5">Team</th>
									<th className="px-3 py-2.5">Status</th>
									<th className="px-3 py-2.5">Last Active</th>
									<th className="w-10 px-3 py-2.5 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/30">
								{filteredUsers.length === 0 ? (
									<tr>
										<td colSpan={7} className="py-6 text-center text-muted-foreground text-xs">
											No members found matching your search.
										</td>
									</tr>
								) : (
									filteredUsers.map((user, index) => {
										const isSelected = !!selectedRows[user.id];
										const colorClass =
											AVATAR_COLORS[index % AVATAR_COLORS.length];
										return (
											<tr
												key={user.id}
												className={cn(
													"transition-colors hover:bg-muted/40",
													isSelected && "bg-purple-50/40 dark:bg-purple-950/20",
												)}
											>
												<td className="px-3 py-2.5 text-center">
													<Checkbox
														checked={isSelected}
														onCheckedChange={(checked) =>
															setSelectedRows((prev) => ({
																...prev,
																[user.id]: !!checked,
															}))
														}
														aria-label={`Select ${user.name}`}
													/>
												</td>
												<td className="px-3 py-2.5">
													<div className="flex items-center gap-2.5">
														<div
															className={cn(
																"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-xs",
																colorClass,
															)}
														>
															{getInitials(user.name)}
														</div>
														<div className="flex flex-col">
															<span className="font-semibold text-foreground">
																{user.name}
															</span>
															<span className="text-[10px] text-muted-foreground">
																{user.email}
															</span>
														</div>
													</div>
												</td>
												<td className="px-3 py-2.5">
													<RoleBadge role={user.role} />
												</td>
												<td className="px-3 py-2.5 text-xs text-foreground/90 font-medium">
													{user.team}
												</td>
												<td className="px-3 py-2.5">
													<StatusBadge status={user.status} />
												</td>
												<td className="px-3 py-2.5 text-[11px] text-muted-foreground font-normal">
													{user.lastActive}
												</td>
												<td className="px-3 py-2.5 text-right">
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="icon"
																className="h-7 w-7 text-muted-foreground hover:text-foreground"
															>
																<Icon icon={OverflowMenuHorizontal} className="h-3.5 w-3.5" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem
																onSelect={() => {
																	setRoleOverrides((prev) => ({
																		...prev,
																		[user.id]: "Sales Manager",
																	}));
																	setMemberRole.mutate({
																		memberId: user.id,
																		role: "Sales Manager",
																	});
																}}
															>
																Make Sales Manager
															</DropdownMenuItem>
															<DropdownMenuItem
																onSelect={() => {
																	setRoleOverrides((prev) => ({
																		...prev,
																		[user.id]: "Sales Executive",
																	}));
																	setMemberRole.mutate({
																		memberId: user.id,
																		role: "Sales Executive",
																	});
																}}
															>
																Make Sales Executive
															</DropdownMenuItem>
															<DropdownMenuItem
																onSelect={() => {
																	setRoleOverrides((prev) => ({
																		...prev,
																		[user.id]: "Viewer",
																	}));
																	setMemberRole.mutate({
																		memberId: user.id,
																		role: "Viewer",
																	});
																}}
															>
																Make Viewer
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																onSelect={() => {
																	setTeamOverrides((prev) => ({
																		...prev,
																		[user.id]: "Sales",
																	}));
																	setMemberTeam.mutate({
																		memberId: user.id,
																		team: "Sales",
																	});
																}}
															>
																Move to Sales Team
															</DropdownMenuItem>
															<DropdownMenuItem
																onSelect={() => {
																	setTeamOverrides((prev) => ({
																		...prev,
																		[user.id]: "Product",
																	}));
																	setMemberTeam.mutate({
																		memberId: user.id,
																		team: "Product",
																	});
																}}
															>
																Move to Product Team
															</DropdownMenuItem>
															<DropdownMenuItem
																onSelect={() => {
																	setTeamOverrides((prev) => ({
																		...prev,
																		[user.id]: "Marketing",
																	}));
																	setMemberTeam.mutate({
																		memberId: user.id,
																		team: "Marketing",
																	});
																}}
															>
																Move to Marketing Team
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																className={
																	user.status === "inactive"
																		? "text-emerald-600 focus:text-emerald-600"
																		: "text-destructive focus:text-destructive"
																}
																onSelect={() => {
																	const nextStatus =
																		user.status === "inactive" ? "active" : "inactive";
																	setStatusOverrides((prev) => ({
																		...prev,
																		[user.id]: nextStatus,
																	}));
																	setMemberStatus.mutate(
																		{
																			memberId: user.id,
																			status: nextStatus,
																		},
																		{
																			onSuccess: () => {
																				toast.success(
																					nextStatus === "inactive"
																						? `${user.name} deactivated.`
																						: `${user.name} activated.`,
																				);
																			},
																		},
																	);
																}}
															>
																{user.status === "inactive"
																	? "Activate User"
																	: "Deactivate User"}
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination Footer */}
					<div className="flex items-center justify-between pt-0.5">
						<span className="text-[11px] text-muted-foreground">
							Showing 1 to {filteredUsers.length} of {filteredUsers.length} users
						</span>
						<div className="flex items-center gap-1">
							<Button
								variant="outline"
								size="icon"
								disabled
								className="h-7 w-7 rounded-lg text-xs"
							>
								‹
							</Button>
							<Button
								variant="default"
								size="icon"
								className="h-7 w-7 rounded-lg bg-[#5e3da8] text-xs font-semibold text-white hover:bg-purple-700"
							>
								1
							</Button>
							<Button
								variant="outline"
								size="icon"
								disabled
								className="h-7 w-7 rounded-lg text-xs"
							>
								›
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Middle Split: Teams & Roles Cards */}
			<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
				{/* Teams Card */}
				<div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-sm font-bold text-foreground">Teams</h3>
								<p className="text-[11px] text-muted-foreground">
									Organize users into teams.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAddTeamOpen(true)}
								className="h-7.5 rounded-lg border-purple-200 text-[11px] font-semibold text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40"
							>
								<Icon icon={Add} className="mr-1 h-3 w-3" />
								Add Team
							</Button>
						</div>

						<div className="flex flex-col divide-y divide-border/30 rounded-xl border border-border/40">
							{teamsList.map((team) => (
								<div
									key={team.id}
									className="group flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-muted/40"
								>
									<div className="flex items-center gap-2.5">
										<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
											<Icon icon={UserMultiple} className="h-3.5 w-3.5" />
										</div>
										<div className="flex flex-col">
											<span className="text-xs font-semibold text-foreground">
												{team.name}
											</span>
											<span className="text-[10px] text-muted-foreground">
												{team.memberCount} members
											</span>
										</div>
									</div>
									<Icon
										icon={ChevronRight}
										className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
									/>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Roles & Permissions Card */}
				<div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-sm font-bold text-foreground">
									Roles & Permissions
								</h3>
								<p className="text-[11px] text-muted-foreground">
									Control what users can access.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAddRoleOpen(true)}
								className="h-7.5 rounded-lg border-purple-200 text-[11px] font-semibold text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40"
							>
								<Icon icon={Add} className="mr-1 h-3 w-3" />
								Add Role
							</Button>
						</div>

						<div className="flex flex-col divide-y divide-border/30 rounded-xl border border-border/40">
							{rolesList.map((role) => (
								<div
									key={role.id}
									className="group flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-muted/40"
								>
									<div className="flex items-center gap-2.5">
										<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
											<Icon icon={UserFollow} className="h-3.5 w-3.5" />
										</div>
										<div className="flex flex-col">
											<span className="text-xs font-semibold text-foreground">
												{role.name}
											</span>
											<span className="text-[10px] text-muted-foreground">
												{role.description}
											</span>
										</div>
									</div>
									<div className="flex items-center gap-1.5">
										<span className="text-[11px] font-medium text-muted-foreground">
											{role.userCount} users
										</span>
										<Icon
											icon={ChevronRight}
											className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
										/>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Card: INVITATION SETTINGS */}
			<div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
				<div className="flex flex-col gap-4">
					<div>
						<h3 className="text-sm font-bold tracking-tight uppercase text-foreground">
							Invitation Settings
						</h3>
						<p className="text-[11px] text-muted-foreground">
							Configure how users can be invited to your workspace.
						</p>
					</div>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
						{/* Allow user invitations checkbox */}
						<div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-muted/20 p-3">
							<Checkbox
								id="allow-invitations"
								checked={allowInvites}
								onCheckedChange={(c) => {
									setAllowInvites(!!c);
									toast.success("Invitation setting updated.");
								}}
								className="mt-0.5"
							/>
							<div className="flex flex-col gap-0.5">
								<label
									htmlFor="allow-invitations"
									className="text-xs font-semibold text-foreground cursor-pointer"
								>
									Allow user invitations
								</label>
								<p className="text-[10px] text-muted-foreground leading-tight">
									Users/members with permission can invite new users
								</p>
							</div>
						</div>

						{/* Default Role Select */}
						<div className="flex flex-col gap-1">
							<label className="text-[11px] font-semibold text-muted-foreground">
								Default Role for New Invites
							</label>
							<Select
								value={defaultRole}
								onValueChange={(val) => {
									setDefaultRole(val);
									toast.success("Default role updated.");
								}}
							>
								<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
									<SelectValue placeholder="Viewer" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="Viewer">Viewer</SelectItem>
									<SelectItem value="Sales Executive">Sales Executive</SelectItem>
									<SelectItem value="Sales Manager">Sales Manager</SelectItem>
									<SelectItem value="Product Manager">Product Manager</SelectItem>
									<SelectItem value="Marketing">Marketing</SelectItem>
									<SelectItem value="Customer Success">Customer Success</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Invite Link */}
						<div className="flex flex-col gap-1">
							<label className="text-[11px] font-semibold text-muted-foreground">
								Invite Link
							</label>
							<div className="flex items-center gap-2">
								<Input
									readOnly
									value={inviteLink}
									className="h-9 truncate rounded-xl bg-muted/30 text-[11px] font-mono text-muted-foreground"
								/>
								<Button
									variant="outline"
									onClick={handleCopyInviteLink}
									className="h-9 shrink-0 gap-1.5 rounded-xl border-purple-200 px-3 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40"
								>
									{copied ? (
										<Icon icon={Checkmark} className="h-3.5 w-3.5" />
									) : (
										<Icon icon={Copy} className="h-3.5 w-3.5" />
									)}
									{copied ? "Copied" : "Copy Link"}
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Add Team Modal */}
			<Dialog open={addTeamOpen} onOpenChange={setAddTeamOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add New Team</DialogTitle>
						<DialogDescription>
							Create a team to organize workspace members and assign permissions.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2.5 py-2">
						<label className="text-xs font-semibold text-muted-foreground">
							Team Name
						</label>
						<Input
							value={newTeamName}
							onChange={(e) => setNewTeamName(e.target.value)}
							placeholder="e.g. Sales, Product, Marketing"
							className="rounded-xl h-9 text-xs"
						/>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="ghost" className="rounded-xl h-8 text-xs">
								Cancel
							</Button>
						</DialogClose>
						<Button
							disabled={!newTeamName.trim()}
							onClick={() => {
								createTeamMutation.mutate({ name: newTeamName.trim() });
							}}
							className="rounded-xl bg-[#5e3da8] h-8 text-xs font-semibold text-white hover:bg-purple-700"
						>
							Create Team
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add Role Modal */}
			<Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add Custom Role</DialogTitle>
						<DialogDescription>
							Define role permissions and capabilities for workspace members.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2.5 py-2">
						<div className="flex flex-col gap-1">
							<label className="text-xs font-semibold text-muted-foreground">
								Role Name
							</label>
							<Input
								value={newRoleName}
								onChange={(e) => setNewRoleName(e.target.value)}
								placeholder="e.g. Finance Analyst, Team Lead"
								className="rounded-xl h-9 text-xs"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-xs font-semibold text-muted-foreground">
								Description
							</label>
							<Input
								value={newRoleDesc}
								onChange={(e) => setNewRoleDesc(e.target.value)}
								placeholder="e.g. Manage financial reports and deals"
								className="rounded-xl h-9 text-xs"
							/>
						</div>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="ghost" className="rounded-xl h-8 text-xs">
								Cancel
							</Button>
						</DialogClose>
						<Button
							disabled={!newRoleName.trim()}
							onClick={() => {
								createRoleMutation.mutate({
									name: newRoleName.trim(),
									description: newRoleDesc.trim() || "Custom role",
								});
							}}
							className="rounded-xl bg-[#5e3da8] h-8 text-xs font-semibold text-white hover:bg-purple-700"
						>
							Create Role
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
