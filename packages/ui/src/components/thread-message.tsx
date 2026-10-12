import { FormattedText } from "@crm/ui/components/formatted-text";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { cn } from "@crm/ui/lib/utils";
import type * as React from "react";

function ThreadMessage({
	from,
	fromEmail,
	fromImageUrl,
	sentAt,
	direction,
	body,
	action,
	className,
	...props
}: Omit<React.ComponentProps<"article">, "children"> & {
	from: string;
	fromEmail: string;
	fromImageUrl?: string | null;
	sentAt: React.ReactNode;
	direction: "INBOUND" | "OUTBOUND";
	body: string | null;
	action?: React.ReactNode;
}) {
	const outbound = direction === "OUTBOUND";

	return (
		<article
			data-slot="thread-message"
			data-direction={direction}
			className={cn(
				"flex gap-2.5 border-l-2 py-3 pl-3",
				outbound ? "border-l-foreground/30" : "border-l-border",
				className,
			)}
			{...props}
		>
			<PersonAvatar
				src={fromImageUrl}
				name={from}
				email={fromEmail}
				size="sm"
				className="mt-0.5"
			/>

			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex min-w-0 items-baseline gap-2">
					<div className="flex min-w-0 flex-1 flex-col">
						<span className="truncate font-medium text-xs">{from}</span>
						<span className="truncate text-muted-foreground text-xs">
							{fromEmail}
						</span>
					</div>
					<span className="shrink-0 text-muted-foreground text-xs">
						{sentAt}
					</span>
				</div>

				{body?.trim() ? (
					<FormattedText text={body} />
				) : (
					<p className="text-muted-foreground text-xs italic">
						No message body.
					</p>
				)}

				{action ? <div className="flex flex-wrap gap-3 text-xs">{action}</div> : null}
			</div>
		</article>
	);
}

export { ThreadMessage };
