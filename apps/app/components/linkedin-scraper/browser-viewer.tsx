"use client";

export function BrowserViewer({ src }: { src: string }) {
	return (
		<iframe
			src={src}
			title="LinkedIn sign-in browser"
			className="aspect-video w-full rounded-lg border bg-muted"
			allow="clipboard-read; clipboard-write"
		/>
	);
}
