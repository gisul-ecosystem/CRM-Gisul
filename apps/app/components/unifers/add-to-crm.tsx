"use client";

import { Button } from "@crm/ui/components/button";
import { Link as TextLink } from "@crm/ui/components/link";
import { Spinner } from "@crm/ui/components/spinner";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import NextLink from "next/link";
import { toast } from "sonner";
import { leadsApi } from "@/lib/leads-pipeline/api";
import { LEADS_PIPELINE } from "@/lib/leads-pipeline/pipeline-config";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import {
	type CampaignPerson,
	crmImportsFor,
	type PipelineMatch,
} from "@/lib/unifers/crm-leads";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function useCrmMatches(people: readonly CampaignPerson[]) {
	const trpc = useTRPC();
	const listed = people.slice(0, LEADS_PIPELINE.addToCrm.maxLeads);
	const matches = useQuery(
		trpc.contacts.matchLeads.queryOptions(
			{
				leads: listed.map((person) => ({
					key: person.email.toLowerCase(),
					fullName: person.name,
					email: person.email,
					domain: "",
					linkedinUrl: "",
				})),
			},
			{ enabled: listed.length > 0, placeholderData: keepPreviousData },
		),
	);
	const contactOf = new Map(
		(matches.data?.matches ?? []).map((match) => [match.key, match.contactId]),
	);
	return {
		contactOf: (email: string) => contactOf.get(email.toLowerCase()) ?? null,
		loading: matches.isPending && listed.length > 0,
	};
}

async function pipelineMatches(
	emails: readonly string[],
): Promise<PipelineMatch[]> {
	try {
		return (await leadsApi.lookup(emails)).matches;
	} catch {
		return [];
	}
}

export function useAddToCrm(activity: string) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const importLeads = useMutation(trpc.contacts.importLeads.mutationOptions());

	return useMutation({
		mutationFn: async (people: readonly CampaignPerson[]) => {
			const picked = people.slice(0, LEADS_PIPELINE.addToCrm.maxLeads);
			const matches = await pipelineMatches(
				picked.map((person) => person.email),
			);
			const totals = { created: 0, existing: 0, failed: 0, found: 0 };
			const errors: string[] = [];
			for (const batch of crmImportsFor(
				picked,
				matches,
				activity,
				LEADS_PIPELINE.addToCrm.defaultLeadSource,
			)) {
				const result = await importLeads.mutateAsync(batch);
				totals.created += result.created;
				totals.existing += result.existing;
				totals.failed += result.failed;
				for (const error of result.errors) {
					errors.push(`${error.name}: ${error.message}`);
				}
			}
			totals.found = matches.length;
			return { totals, errors };
		},
		onSuccess: async ({ totals, errors }) => {
			await Promise.all([
				cache.contact(),
				cache.company(),
				queryClient.invalidateQueries({
					queryKey: trpc.contacts.matchLeads.queryKey(),
				}),
			]);
			const parts = [
				totals.created > 0 ? `${totals.created} added` : null,
				totals.existing > 0 ? `${totals.existing} already in the CRM` : null,
				totals.failed > 0 ? `${totals.failed} failed` : null,
				totals.found > 0
					? `${totals.found} with lead generation details`
					: null,
			].filter(Boolean);
			toast.success(parts.join(" · ") || "Nothing to add.");
			if (errors[0]) toast.message(errors[0]);
		},
		onError: (error) => toast.error(error.message),
	});
}

export function CrmCell({
	person,
	contactId,
	loading,
	adding,
	onAdd,
}: {
	person: CampaignPerson;
	contactId: string | null;
	loading: boolean;
	adding: boolean;
	onAdd: (person: CampaignPerson) => void;
}) {
	const href = useWorkspaceUrl();
	if (loading) return <Spinner />;
	if (contactId) {
		return (
			<TextLink asChild>
				<NextLink href={href(`/contacts/${contactId}`)}>In CRM</NextLink>
			</TextLink>
		);
	}
	return (
		<Button
			variant="outline"
			size="sm"
			disabled={adding}
			onClick={() => onAdd(person)}
		>
			Add to CRM
		</Button>
	);
}
