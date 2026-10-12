"use client";

import { toast } from "sonner";
import { APP_LAUNCH } from "./app-launch-config";

export function openAppOrBrowser({
	appUrl,
	webUrl,
	appName,
}: {
	appUrl: string;
	webUrl: string;
	appName: string;
}): void {
	let left = false;

	const markLeft = () => {
		left = true;
	};
	const onVisibility = () => {
		if (document.visibilityState === "hidden") markLeft();
	};

	window.addEventListener("blur", markLeft, { once: true });
	document.addEventListener("visibilitychange", onVisibility);

	window.setTimeout(() => {
		window.removeEventListener("blur", markLeft);
		document.removeEventListener("visibilitychange", onVisibility);
		if (left) return;

		toast(`${appName} did not open.`, {
			description: "It is not installed, or the browser blocked it.",
			duration: APP_LAUNCH.fallbackToastMs,
			action: {
				label: "Open in browser",
				onClick: () => window.open(webUrl, "_blank", "noreferrer"),
			},
		});
	}, APP_LAUNCH.fallbackAfterMs);

	window.location.href = appUrl;
}
