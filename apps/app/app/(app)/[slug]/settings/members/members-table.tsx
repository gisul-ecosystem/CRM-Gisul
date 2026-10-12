"use client";

import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { membersSearchParams } from "./members-search-params";
import { ROLE_LABEL, type Role, WORKSPACE_ROLE_ORDER } from "./roles";

type MemberRow = RouterOutputs["workspace"]["members"]["rows"][number];

type Team = RouterOutputs["workspace"]["teams"][number];

const STATUS_LABEL = {
	active: "Active",
	inactive: "Inactive",
} as const satisfies Record<MemberRow["status"], string>;

type MemberActions = {
	canManage: boolean;
	teams: Team[];
	pending: boolean;
	onChangeRole: (member: MemberRow, role: Role) => void;
	onChangeTeam: (member: MemberRow, teamId: string | null) => void;
};

function columns(actions: MemberActions): DataTableColumn<MemberRow>[] {
	return [
		{
			id: "name",
			header: "Name",
			sortable: true,
			hideable: false,
			width: "w-[30%]",
			cell: (row) => (
				<span className="flex min-w-0 items-center gap-2">
					<PersonAvatar
						size="sm"
						src={row.image}
						name={row.name}
						email={row.email}
					/>
					<span className="flex min-w-0 flex-col">
						<span className="truncate font-medium">
							{row.name}
							{row.isViewer ? (
								<span className="text-muted-foreground"> (you)</span>
							) : null}
						</span>
						<span className="truncate text-muted-foreground text-xs">
							{row.email}
						</span>
					</span>
				</span>
			),
		},
		{
			id: "role",
			header: "Role",
			sortable: true,
			width: "w-[12%]",
			cell: (row) => (
				<span className="text-muted-foreground">{ROLE_LABEL[row.role]}</span>
			),
		},
		{
			id: "team",
			header: "Team",
			width: "w-[16%]",
			hideBelow: "md",
			cell: (row) => (
				<span className="text-muted-foreground">{row.team ?? "—"}</span>
			),
		},
		{
			id: "status",
			header: "Status",
			width: "w-[12%]",
			hideBelow: "sm",
			cell: (row) => (
				<Badge variant={row.status === "active" ? "secondary" : "outline"}>
					{STATUS_LABEL[row.status]}
				</Badge>
			),
		},
		{
			id: "lastActive",
			header: "Last active",
			width: "w-[12%]",
			hideBelow: "lg",
			cell: (row) => (
				<span className="text-muted-foreground">
					{row.lastActive ? (
						<LocalRelativeTime date={row.lastActive} />
					) : (
						"Never"
					)}
				</span>
			),
		},
		{
			id: "joinedAt",
			header: "Joined",
			label: "Joined date",
			sortable: true,
			align: "right",
			width: "w-[12%]",
			hideBelow: "sm",
			cell: (row) => (
				<span className="text-muted-foreground">
					<LocalRelativeTime date={row.joinedAt} />
				</span>
			),
		},
		{
			id: "actions",
			header: <span className="sr-only">Actions</span>,
			label: "Actions",
			hideable: false,
			align: "right",
			width: "w-[6%]",
			cell: (row) =>
				actions.canManage ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" disabled={actions.pending}>
								<Icon icon={OverflowMenuHorizontal} />
								<span className="sr-only">Manage {row.name}</span>
							</Button>
						</DropdownMenuTrigger>

						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Role</DropdownMenuLabel>
							{WORKSPACE_ROLE_ORDER.map((role) => (
								<DropdownMenuItem
									key={role}
									data-checked={row.role === role}
									onSelect={() => {
										if (row.role === role) return;
										actions.onChangeRole(row, role);
									}}
								>
									Make {ROLE_LABEL[role].toLowerCase()}
								</DropdownMenuItem>
							))}

							<DropdownMenuSeparator />
							<DropdownMenuLabel>Team</DropdownMenuLabel>
							{actions.teams.map((team) => (
								<DropdownMenuItem
									key={team.id}
									data-checked={row.teamId === team.id}
									onSelect={() => {
										if (row.teamId === team.id) return;
										actions.onChangeTeam(row, team.id);
									}}
								>
									{team.name}
								</DropdownMenuItem>
							))}
							<DropdownMenuItem
								disabled={row.teamId === null}
								onSelect={() => actions.onChangeTeam(row, null)}
							>
								No team
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null,
		},
	];
}

export function MembersTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { query, input } = useTableQuery(membersSearchParams);

	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const teams = useQuery(trpc.workspace.teams.queryOptions());
	const members = useQuery({
		...trpc.workspace.members.queryOptions(input),
		placeholderData: (previous) => previous,
	});

	const setRole = useMutation(
		trpc.workspace.setMemberRole.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				toast.success("Role changed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setTeam = useMutation(
		trpc.workspace.updateMemberTeam.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				toast.success("Team changed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const facetCounts = members.data?.facetCounts;
	const teamList = teams.data ?? [];

	const facets: DataTableFacet[] = [
		{
			id: "role",
			label: "Role",
			options: WORKSPACE_ROLE_ORDER.flatMap((role) =>
				(facetCounts?.role?.[role] ?? 0) > 0
					? [{ value: role, label: ROLE_LABEL[role] }]
					: [],
			),
		},
		{
			id: "team",
			label: "Team",
			options: teamList.map((team) => ({ value: team.id, label: team.name })),
		},
		{
			id: "status",
			label: "Status",
			options: (Object.keys(STATUS_LABEL) as MemberRow["status"][]).map(
				(status) => ({ value: status, label: STATUS_LABEL[status] }),
			),
		},
	];

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search by name or email…" />}
			columns={columns({
				canManage: workspace.data?.canChangeRoles ?? false,
				teams: teamList,
				pending: setRole.isPending || setTeam.isPending,
				onChangeRole: (member, role) =>
					setRole.mutate({ memberId: member.id, role }),
				onChangeTeam: (member, teamId) =>
					setTeam.mutate({ memberId: member.id, teamId }),
			})}
			rows={members.data?.rows ?? []}
			total={members.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			getRowId={(row) => row.id}
			loading={members.isFetching}
			empty="Nobody matches this view."
		/>
	);
}
