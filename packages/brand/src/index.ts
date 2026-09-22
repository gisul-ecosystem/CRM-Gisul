export const PRODUCT_BRAND = {
	name: "Gisul",
	productName: "Gisul CRM",
	websiteUrl: "https://gisul.co.in",
	slackAppName: "Gisul",
	logoSrc: "/gisul-logo.png",
} as const;

export function slackInviteCommand(): string {
	return `/invite @${PRODUCT_BRAND.slackAppName}`;
}
