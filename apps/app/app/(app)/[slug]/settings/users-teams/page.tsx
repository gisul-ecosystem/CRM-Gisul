import { redirect } from "next/navigation";

export default async function UsersTeamsRedirect({
	params,
}: PageProps<"/[slug]/settings/users-teams">) {
	const { slug } = await params;
	redirect(`/${slug}/settings/members`);
}
