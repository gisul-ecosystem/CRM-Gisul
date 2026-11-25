"use client";

import { useEffect, useState } from "react";
import { OUTREACH } from "./outreach-config";

export function useDebounced<T>(
	value: T,
	delayMs: number = OUTREACH.searchDebounceMs,
): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);

	return debounced;
}
