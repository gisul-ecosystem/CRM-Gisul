import "@crm/env/load";

import { z } from "zod";
import type { Person, PersonMatch, Role } from "./people";
import { UNIFERS } from "./unifers-config";

const optionalText = z.string().nullish();

const errorBody = z.object({
	error: z.literal(true),
	message: z.string(),
	code: z.string().optional(),
});

const enrichResponse = z.object({
	error: z.literal(false),
	peopleData: z.object({
		refId: z.string(),
		firstName: optionalText,
		lastName: optionalText,
		fullName: optionalText,
		headline: optionalText,
		summary: optionalText,
		jobTitle: optionalText,
		company: z
			.object({
				name: z.string(),
				websiteDomain: optionalText,
				linkedinUrl: optionalText,
			})
			.nullish(),
		companyName: optionalText,
		linkedinUrl: optionalText,
		country: optionalText,
		stateName: optionalText,
		city: optionalText,
		skills: z.array(z.string()).nullish(),
	}),
	creditsCharged: z.number(),
	logId: z.string(),
});

export type UnifersProfile = z.infer<typeof enrichResponse>["peopleData"];

const revealOutcome = z.enum([
	"revealed",
	"not_found",
	"daily_limit_reached",
	"not_in_plan",
]);

export type RevealOutcome = z.infer<typeof revealOutcome>;

const revealResponse = z.object({
	error: z.literal(false),
	peopleData: z.object({
		professionalEmails: z.array(z.string()),
		personalEmails: z.array(z.string()),
		mobiles: z.array(z.string()),
	}),
	fields: z.object({
		email: revealOutcome.optional(),
		phone: revealOutcome.optional(),
	}),
	creditsCharged: z.number(),
	logId: z.string(),
});

export type RevealResult = z.infer<typeof revealResponse>;

export type UnifersCall<T> =
	| { outcome: "ok"; data: T }
	| {
			outcome: "failed";
			status: number;
			code: string | null;
			reason: string;
			retryable: boolean;
	  };

export function unifersKey(): string | null {
	return process.env.UNIFERS_API_KEY?.trim() || null;
}

function baseUrl(): string {
	return (process.env.UNIFERS_API_URL?.trim() || UNIFERS.defaultUrl).replace(
		/\/+$/,
		"",
	);
}

async function post<T>(
	path: string,
	body: Record<string, unknown>,
	schema: z.ZodType<T>,
): Promise<UnifersCall<T>> {
	const key = unifersKey();
	if (!key) {
		return {
			outcome: "failed",
			status: 0,
			code: null,
			reason: "Unifers is not configured.",
			retryable: false,
		};
	}

	let response: Response;
	try {
		response = await fetch(`${baseUrl()}${path}`, {
			method: "POST",
			headers: { "X-API-Key": key, "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(UNIFERS.timeoutMs),
		});
	} catch (error) {
		return {
			outcome: "failed",
			status: 0,
			code: null,
			reason: `Unifers did not answer: ${error instanceof Error ? error.message : String(error)}`,
			retryable: true,
		};
	}

	const json: unknown = await response.json().catch(() => null);

	if (!response.ok) {
		const failure = errorBody.safeParse(json);
		return {
			outcome: "failed",
			status: response.status,
			code: failure.success ? (failure.data.code ?? null) : null,
			reason: failure.success
				? failure.data.message
				: `Unifers answered HTTP ${response.status}.`,
			retryable: response.status === 429 || response.status >= 500,
		};
	}

	const parsed = schema.safeParse(json);
	if (!parsed.success) {
		return {
			outcome: "failed",
			status: response.status,
			code: null,
			reason: `Unifers sent a response this CRM cannot read: ${parsed.error.issues
				.map((issue) => `${issue.path.join(".")} ${issue.message}`)
				.join("; ")}`,
			retryable: false,
		};
	}

	return { outcome: "ok", data: parsed.data };
}

export async function personFromUnifers(
	profileUrl: string,
): Promise<PersonMatch> {
	if (!unifersKey()) {
		return { outcome: "skipped", reason: "Unifers is not configured." };
	}

	const call = await post(
		UNIFERS.paths.enrich,
		{ linkedin: profileUrl, fallback: UNIFERS.useFallbackProvider },
		enrichResponse,
	);

	if (call.outcome === "failed") {
		if (call.status === 404) {
			return {
				outcome: "skipped",
				reason: "Unifers has no profile data for that LinkedIn URL.",
			};
		}
		return {
			outcome: "failed",
			reason: call.reason,
			retryable: call.retryable,
		};
	}

	return {
		outcome: "found",
		person: personFrom(call.data.peopleData, profileUrl),
	};
}

export function personFrom(
	profile: UnifersProfile,
	requestedUrl: string,
): Person {
	const location =
		[profile.city, profile.stateName, profile.country]
			.filter((part): part is string => Boolean(part?.trim()))
			.join(", ") || null;
	const employer = profile.company?.name ?? profile.companyName ?? null;
	const profileUrl = profile.linkedinUrl ?? requestedUrl;

	const current: Role[] =
		profile.jobTitle || employer
			? [
					{
						title: profile.jobTitle ?? null,
						organisation: {
							name: employer,
							domain: profile.company?.websiteDomain ?? null,
						},
						startDate: null,
						endDate: null,
						location,
						description: null,
						isCurrent: true,
					},
				]
			: [];

	return {
		firstName: profile.firstName ?? null,
		lastName: profile.lastName ?? null,
		fullName: profile.fullName ?? null,
		bio: profile.summary ?? profile.headline ?? null,
		location,
		email: null,
		photoUrl: null,
		profileUrl,
		socialUrls: [profileUrl],
		websiteUrls: [],
		skills: profile.skills ?? [],
		currentRoles: current,
		experience: current,
		education: [],
	};
}

export async function revealContacts(
	profileUrl: string,
	want: { email: boolean; phone: boolean },
): Promise<UnifersCall<RevealResult>> {
	return post(
		UNIFERS.paths.reveal,
		{
			linkedin: profileUrl,
			revealContacts: want,
			fallback: UNIFERS.useFallbackProvider,
		},
		revealResponse,
	);
}
