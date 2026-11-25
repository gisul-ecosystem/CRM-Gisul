export type JwtClaims = {
	[claim: string]: string | number | undefined;
};

export async function signHs256Jwt(
	secret: string,
	claims: JwtClaims,
): Promise<string> {
	const header = { alg: "HS256", typ: "JWT" };
	const signingInput = `${base64url(encode(JSON.stringify(header)))}.${base64url(
		encode(JSON.stringify(claims)),
	)}`;

	const key = await crypto.subtle.importKey(
		"raw",
		encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign("HMAC", key, encode(signingInput));

	return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

function encode(input: string) {
	return new TextEncoder().encode(input);
}

function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}
