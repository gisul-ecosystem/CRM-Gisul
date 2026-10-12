export function downloadText(
	filename: string,
	contents: string,
	type = "text/csv;charset=utf-8",
) {
	const blob = new Blob([contents], { type });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
