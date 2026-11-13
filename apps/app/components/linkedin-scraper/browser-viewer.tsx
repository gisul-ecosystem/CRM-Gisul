"use client";

export function BrowserViewer({
	src,
	title = "LinkedIn sign-in browser",
}: {
	src: string;
	title?: string;
}) {
	return (
		<iframe
			src={src}
			title={title}
			className="aspect-video w-full rounded-lg border bg-muted"
			allow="clipboard-read; clipboard-write"
		/>
	);
}
