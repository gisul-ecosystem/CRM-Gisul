"use client";

import Add from "@carbon/icons-react/es/Add";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Copy from "@carbon/icons-react/es/Copy";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { MembersTable } from "./members-table";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "./roles";

export function UsersTeamsView() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const teamNameId = useId();

	const [addTeamOpen, setAddTeamOpen] = useState(false);
	const [newTeamName, setNewTeamName] = useState("");
	const [copied, setCopied] = useState(false);

	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const teams = useQuery(trpc.workspace.teams.queryOptions());
	const roles = useQuery(trpc.workspace.roles.queryOptions());
	const invite = useQuery(trpc.workspace.invitationSettings.queryOptions());

	const canManage = workspace.data?.canChangeRoles ?? false;

	const createTeam = useMutation(
		trpc.workspace.createTeam.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				setAddTeamOpen(false);
				setNewTeamName("");
				toast.success("Team created.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const copySignInLink = async () => {
		if (!invite.data) return;
		try {
			await navigator.clipboard.writeText(invite.data.signInUrl);
			setCopied(true);
			toast.success("Sign-in link copied.");
		} catch {
			toast.error("Could not copy the link. Select it and copy it by hand.");
		}
	};

	const allowed = invite.data?.allowedDomains ?? [];

	return (
		<div className="flex w-full flex-col gap-6 pb-12">
			<Card>
				<CardHeader>
					<CardTitle>Team members</CardTitle>
					<CardDescription>
						Everyone who has signed in to this workspace.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<MembersTable />
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Teams</CardTitle>
						<CardDescription>
							Group members. Assign a team from the member menu.
						</CardDescription>
						{canManage ? (
							<CardAction>
								<Button variant="outline" onClick={() => setAddTeamOpen(true)}>
									<Icon icon={Add} data-icon="inline-start" />
									Add team
								</Button>
							</CardAction>
						) : null}
					</CardHeader>
					<CardContent>
						{teams.data && teams.data.length === 0 ? (
							<p className="text-muted-foreground text-sm">No teams yet.</p>
						) : (
							<ul className="flex flex-col divide-y">
								{(teams.data ?? []).map((team) => (
									<li
										key={team.id}
										className="flex items-center justify-between py-2 text-sm"
									>
										<span className="font-medium">{team.name}</span>
										<span className="text-muted-foreground">
											{team.memberCount}{" "}
											{team.memberCount === 1 ? "member" : "members"}
										</span>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Roles</CardTitle>
						<CardDescription>
							What each role can do. Change a role from the member menu.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ul className="flex flex-col divide-y">
							{(roles.data ?? []).map((role) => (
								<li
									key={role.id}
									className="flex items-start justify-between gap-4 py-2 text-sm"
								>
									<span className="flex flex-col">
										<span className="font-medium">{ROLE_LABEL[role.id]}</span>
										<span className="text-muted-foreground">
											{ROLE_DESCRIPTION[role.id]}
										</span>
									</span>
									<span className="shrink-0 text-muted-foreground">
										{role.userCount} {role.userCount === 1 ? "user" : "users"}
									</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Adding people</CardTitle>
					<CardDescription>
						There are no invitations. Anyone with an allowed email address signs
						in with this link and joins as a{" "}
						{ROLE_LABEL[invite.data?.defaultRole ?? "member"].toLowerCase()}.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex items-center gap-2">
						<Input
							readOnly
							aria-label="Sign-in link"
							value={invite.data?.signInUrl ?? ""}
						/>
						<Button
							variant="outline"
							onClick={copySignInLink}
							disabled={!invite.data}
						>
							<Icon icon={copied ? Checkmark : Copy} data-icon="inline-start" />
							{copied ? "Copied" : "Copy link"}
						</Button>
					</div>
					<p className="text-muted-foreground text-sm">
						{allowed.length > 0
							? `Allowed domains: ${allowed.join(", ")}. Change ALLOWED_SIGN_IN on the server to add more.`
							: "Only the single addresses in ALLOWED_SIGN_IN can sign in."}
					</p>
				</CardContent>
			</Card>

			<Dialog open={addTeamOpen} onOpenChange={setAddTeamOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add team</DialogTitle>
						<DialogDescription>
							Teams group members on this page.
						</DialogDescription>
					</DialogHeader>
					<form
						id="add-team"
						onSubmit={(event) => {
							event.preventDefault();
							const name = newTeamName.trim();
							if (name) createTeam.mutate({ name });
						}}
					>
						<Field>
							<FieldLabel htmlFor={teamNameId}>Team name</FieldLabel>
							<Input
								id={teamNameId}
								value={newTeamName}
								onChange={(event) => setNewTeamName(event.target.value)}
								placeholder="e.g. Enterprise"
							/>
						</Field>
					</form>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							type="submit"
							form="add-team"
							disabled={!newTeamName.trim() || createTeam.isPending}
						>
							{createTeam.isPending ? (
								<Spinner data-icon="inline-start" />
							) : null}
							Create team
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
