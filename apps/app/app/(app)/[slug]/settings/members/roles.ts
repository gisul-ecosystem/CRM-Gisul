export type Role = "owner" | "admin" | "member";

export const WORKSPACE_ROLE_ORDER: readonly Role[] = [
	"owner",
	"admin",
	"member",
];

export const ROLE_LABEL = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
} as const satisfies Record<Role, string>;

export const ROLE_DESCRIPTION = {
	owner:
		"Changes roles, teams and every workspace setting. The last owner cannot be demoted.",
	admin: "The same permissions as an owner.",
	member: "Uses the CRM. Cannot change roles or workspace settings.",
} as const satisfies Record<Role, string>;
