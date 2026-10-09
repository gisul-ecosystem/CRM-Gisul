export function ProductMark({
	name,
	color,
	iconUrl,
	className,
}: {
	name: string;
	color: string;
	iconUrl?: string | null;
	className?: string;
}) {
	if (iconUrl) {
		return (
			<span
				className={className}
				title={name}
				style={{ background: color, overflow: "hidden", padding: 0 }}
			>
				<img
					src={iconUrl}
					alt=""
					style={{ width: "100%", height: "100%", objectFit: "cover" }}
				/>
			</span>
		);
	}

	return (
		<span
			className={className}
			title={name}
			style={{ background: color, color: "#fff" }}
		>
			{name.charAt(0).toUpperCase()}
		</span>
	);
}
