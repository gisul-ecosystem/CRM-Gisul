import { defineTool } from "eve/tools";
import { z } from "zod";
import {
	LINKEDIN_SOURCE,
	linkedinReadable,
	unavailable,
} from "../lib/capabilities";
import { contactProfileSlug } from "../lib/crm";
import { spend } from "../lib/focus";
import { profileByUrl } from "../lib/people";

export default defineTool({
	description:
		"Read the LinkedIn profile already on a CRM contact — bio, current role and full work history. For writing a summary of somebody already identified. Cannot be used to identify anyone: use resolve_linkedin_profile and get_linkedin_profile for that.",
	inputSchema: z.object({
		contactId: z.string(),
	}),
	async execute({ contactId }) {
		if (!(await linkedinReadable())) {
			return { found: false as const, ...unavailable(LINKEDIN_SOURCE) };
		}

		const profileRef = await contactProfileSlug(contactId);
		if (!profileRef) {
			return {
				found: false as const,
				reason: "This contact has no LinkedIn URL on file.",
			};
		}

		const charge = spend(2);
		if (!charge.ok) return { found: false as const, reason: charge.reason };

		const result = await profileByUrl(profileRef.profileUrl);
		if (result.outcome !== "found") {
			return { found: false as const, reason: result.reason };
		}

		return {
			found: true as const,
			profile: result.person,
			sourceUrl: profileRef.profileUrl,
			note: "Everything here is self-reported by the person. Write only what it says.",
		};
	},
});
