"use client";

import { cn } from "@crm/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;
const LINK_LABEL_LENGTH = 48;
const DEFAULT_COLLAPSE_AT = 900;
const SEPARATOR_LINE = /^[\s*_=~-]{8,}$/gm;
const ENTITIES: Record<string, string> = {
	"&nbsp;": " ",
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};

function stripHtml(text: string): string {
	return text
		.replace(/<(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n")
		.replace(/<li[^>]*>/gi, "• ")
		.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi, " $1 ")
		.replace(/<[^>]+>/g, "")
		.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

function tidy(text: string): string {
	return text
		.replace(/\r\n/g, "\n")
		.replace(SEPARATOR_LINE, "")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function linkLabel(href: string): string {
	let label = href;
	try {
		const url = new URL(href);
		label = `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
	} catch {}
	return label.length > LINK_LABEL_LENGTH
		? `${label.slice(0, LINK_LABEL_LENGTH)}…`
		: label;
}

function linkify(text: string): React.ReactNode[] {
	return text.split(URL_PATTERN).map((part, index) => {
		if (index % 2 === 0) return part;

		const trailing = TRAILING_PUNCTUATION.exec(part)?.[0] ?? "";
		const href = trailing ? part.slice(0, -trailing.length) : part;

		return (
			<span key={`${index}-${href}`}>
				<a
					href={href}
					target="_blank"
					rel="noreferrer"
					title={href}
					className="text-foreground underline underline-offset-3 hover:text-muted-foreground"
				>
					{linkLabel(href)}
				</a>
				{trailing}
			</span>
		);
	});
}

function FormattedText({
	text,
	html = false,
	collapseAt = DEFAULT_COLLAPSE_AT,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	text: string;
	html?: boolean;
	collapseAt?: number;
}) {
	const [expanded, setExpanded] = useState(false);
	const clean = tidy(html ? stripHtml(text) : text);
	const long = clean.length > collapseAt;
	const shown =
		long && !expanded ? `${clean.slice(0, collapseAt).trimEnd()}…` : clean;

	return (
		<div
			data-slot="formatted-text"
			className={cn("flex flex-col gap-1.5", className)}
			{...props}
		>
			<p className="whitespace-pre-wrap text-pretty break-words text-foreground/80 text-xs/5 [overflow-wrap:anywhere]">
				{linkify(shown)}
			</p>
			{long ? (
				<button
					type="button"
					onClick={() => setExpanded((value) => !value)}
					className="self-start text-muted-foreground text-xs underline underline-offset-3 hover:text-foreground"
				>
					{expanded ? "Show less" : "Show more"}
				</button>
			) : null}
		</div>
	);
}

export { FormattedText };
