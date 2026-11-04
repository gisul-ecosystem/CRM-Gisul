import { signHs256Jwt } from "./hs256-jwt";

const ISSUER = "crm-app";
const AUDIENCE = "crm-agent";

const TTL_SECONDS = 120;

export const AGENT_URL = process.env.AGENT_URL ?? "http://127.0.0.1:2000";

export function bridgeConfigured(): boolean {
	return Boolean(process.env.AGENT_BRIDGE_SECRET);
}

type BridgeClaims = {
	iss: string;
	aud: string;
	sub: string;
	email: string;
	name: string;
	contactId?: string;
	companyId?: string;
	dealId?: string;
	iat: number;
	nbf: number;
	exp: number;
};

export async function mintBridgeToken(
	user: {
		id: string;
		email: string;
		name: string;
	},
	record: { contactId?: string; companyId?: string; dealId?: string } = {},
): Promise<string> {
	const secret = process.env.AGENT_BRIDGE_SECRET;
	if (!secret) throw new Error("AGENT_BRIDGE_SECRET is not set.");

	const now = Math.floor(Date.now() / 1000);

	const payload: BridgeClaims = {
		iss: ISSUER,
		aud: AUDIENCE,
		sub: user.id,
		email: user.email,
		name: user.name,
		iat: now,
		nbf: now - 5,
		exp: now + TTL_SECONDS,
	};

	if (record.contactId) payload.contactId = record.contactId;
	if (record.companyId) payload.companyId = record.companyId;
	if (record.dealId) payload.dealId = record.dealId;

	return signHs256Jwt(secret, payload);
}
