import { createHash } from "node:crypto";
import { blobEnabled } from "@crm/db/blob";
import { BadRequestException } from "@nestjs/common";

const MAX_LOGO_BYTES = 512 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/svg+xml": "svg",
};

export async function storeProductLogo(logo: {
	contentType: string;
	dataBase64: string;
}): Promise<string> {
	const extension = EXTENSION_BY_TYPE[logo.contentType];
	if (!extension) {
		throw new BadRequestException(
			"Use a PNG, JPEG, WebP, GIF, or SVG logo.",
		);
	}

	const bytes = Buffer.from(logo.dataBase64, "base64");
	if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) {
		throw new BadRequestException("Logo must be an image under 512 KB.");
	}

	if (blobEnabled()) {
		try {
			const { put } = await import("@vercel/blob");
			const digest = createHash("sha256")
				.update(bytes)
				.digest("hex")
				.slice(0, 12);
			const blob = await put(`product-logo-${digest}.${extension}`, bytes, {
				access: "public",
				contentType: logo.contentType,
				addRandomSuffix: false,
				allowOverwrite: true,
			});
			return blob.url;
		} catch {
			return dataUrl(logo.contentType, logo.dataBase64);
		}
	}

	return dataUrl(logo.contentType, logo.dataBase64);
}

function dataUrl(contentType: string, dataBase64: string): string {
	return `data:${contentType};base64,${dataBase64}`;
}
