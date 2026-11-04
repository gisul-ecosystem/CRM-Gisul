export function Meter({
	value,
	max,
	label,
}: {
	value: number;
	max: number;
	label: string;
}) {
	const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

	return (
		<div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
			<span className="sr-only">
				{label}: {percent}%
			</span>
			<div
				aria-hidden
				className="h-full bg-primary"
				style={{ width: `${percent}%` }}
			/>
		</div>
	);
}
