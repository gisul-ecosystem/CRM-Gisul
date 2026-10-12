"use client";

import { useMountEffect } from "@crm/ui/hooks/use-mount-effect";
import { createContext, useContext, useMemo, useState } from "react";
import { APP_RAIL } from "./app-rail-config";

type AppRailContextValue = {
	open: boolean;
	collapse: () => void;
	expand: () => void;
	toggle: () => void;
};

const AppRailContext = createContext<AppRailContextValue | null>(null);

function readStoredOpen(): boolean {
	try {
		const raw = localStorage.getItem(APP_RAIL.storageKey);
		if (raw === "0") return false;
		if (raw === "1") return true;
	} catch {
		return APP_RAIL.defaultOpen;
	}
	return APP_RAIL.defaultOpen;
}

function writeStoredOpen(open: boolean) {
	try {
		localStorage.setItem(APP_RAIL.storageKey, open ? "1" : "0");
	} catch {
		return;
	}
}

export function AppRailProvider({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = useState<boolean>(APP_RAIL.defaultOpen);

	useMountEffect(() => {
		setOpen(readStoredOpen());
	});

	const value = useMemo<AppRailContextValue>(() => {
		const setOpenPersist = (next: boolean) => {
			setOpen(next);
			writeStoredOpen(next);
		};
		return {
			open,
			collapse: () => setOpenPersist(false),
			expand: () => setOpenPersist(true),
			toggle: () => setOpenPersist(!open),
		};
	}, [open]);

	return <AppRailContext.Provider value={value}>{children}</AppRailContext.Provider>;
}

export function useAppRail(): AppRailContextValue {
	const context = useContext(AppRailContext);
	if (!context) {
		throw new Error("useAppRail must be used within an AppRailProvider");
	}
	return context;
}
