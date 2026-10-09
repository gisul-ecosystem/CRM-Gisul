"use client";

import { useMountEffect } from "@crm/ui/hooks/use-mount-effect";
import { useState } from "react";

export function useColumnVisibility<T extends string>(
	storageKey: string,
	defaults: Record<T, boolean>,
) {
	const [visible, setVisible] = useState(defaults);

	useMountEffect(() => {
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return;
			const parsed = JSON.parse(raw) as Partial<Record<T, boolean>>;
			setVisible((current) => {
				const next = { ...current };
				for (const key of Object.keys(current) as T[]) {
					if (typeof parsed[key] === "boolean") next[key] = parsed[key];
				}
				return next;
			});
		} catch {
			return;
		}
	});

	function toggle(id: T) {
		setVisible((current) => {
			const next = { ...current, [id]: !current[id] };
			try {
				localStorage.setItem(storageKey, JSON.stringify(next));
			} catch {
				return next;
			}
			return next;
		});
	}

	return { visible, toggle };
}
