"use client";

import { Button } from "@crm/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Textarea } from "@crm/ui/components/textarea";
import { useId, useRef } from "react";
import { toast } from "sonner";
import { LINKEDIN_SCRAPER } from "@/lib/linkedin-scraper/scraper-config";

const { maxChars, placeholders, fileAccept } = LINKEDIN_SCRAPER.template;

export function MessageTemplateField({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const id = useId();
	const textRef = useRef<HTMLTextAreaElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const insert = (placeholder: string) => {
		const token = `{{${placeholder}}}`;
		const box = textRef.current;
		const start = box?.selectionStart ?? value.length;
		const end = box?.selectionEnd ?? value.length;
		onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
		requestAnimationFrame(() => {
			box?.focus();
			box?.setSelectionRange(start + token.length, start + token.length);
		});
	};

	const upload = async (file: File | undefined) => {
		if (!file) return;
		const text = (await file.text()).replace(/\r\n/g, "\n").trim();
		if (text.length > maxChars) {
			toast.error(
				`The file has ${text.length} characters. Keep it under ${maxChars}.`,
			);
			return;
		}
		onChange(text);
		toast.success(`Loaded ${file.name}.`);
	};

	return (
		<Field>
			<div className="flex items-center justify-between gap-2">
				<FieldLabel htmlFor={id}>Message template</FieldLabel>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => fileRef.current?.click()}
				>
					Upload a file
				</Button>
				<input
					ref={fileRef}
					type="file"
					accept={fileAccept}
					hidden
					onChange={(event) => {
						void upload(event.target.files?.[0]);
						event.target.value = "";
					}}
				/>
			</div>
			<Textarea
				id={id}
				ref={textRef}
				rows={6}
				maxLength={maxChars}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={"Hi {{firstName}}, I saw your work at {{company}}…"}
			/>
			<div className="flex flex-wrap gap-2">
				{placeholders.map((placeholder) => (
					<Button
						key={placeholder}
						type="button"
						variant="outline"
						size="sm"
						onClick={() => insert(placeholder)}
					>
						{`{{${placeholder}}}`}
					</Button>
				))}
			</div>
			<FieldDescription>
				The same message for everyone. Each placeholder is filled from the
				person's profile. {value.length} / {maxChars} characters. Upload a .txt
				file to fill it.
			</FieldDescription>
		</Field>
	);
}
