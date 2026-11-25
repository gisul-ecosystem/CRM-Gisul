"use client";

import { OutreachError, outreachHref, type QueryValue } from "./client";

export async function downloadFromOutreach(
	path: string,
	query: { [key: string]: QueryValue } = {},
): Promise<string> {
	const response = await fetch(outreachHref(path, query), {
		credentials: "same-origin",
	});

	if (!response.ok) {
		throw new OutreachError(
			response.status,
			"DOWNLOAD_FAILED",
			`The download failed with status ${response.status}.`,
		);
	}

	const disposition = response.headers.get("content-disposition") ?? "";
	const filename =
		/filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "download.csv";
	const url = URL.createObjectURL(await response.blob());
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
	return filename;
}
