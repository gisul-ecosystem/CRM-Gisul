"use client";

import { useMountEffect } from "@crm/ui/hooks/use-mount-effect";
import { createContext, use, useState } from "react";
import { CHAT } from "./chat-config";

type ChatSidebarContextValue = {
	open: boolean;
	collapse: () => void;
	expand: () => void;
	toggle: () => void;
};

const ChatSidebarContext = createContext<ChatSidebarContextValue | null>(null);

function readStoredOpen(): boolean {
	try {
		const raw = localStorage.getItem(CHAT.sidebar.storageKey);
		if (raw === "0") return false;
		if (raw === "1") return true;
	} catch {
		return CHAT.sidebar.defaultOpen;
	}
	return CHAT.sidebar.defaultOpen;
}

function writeStoredOpen(open: boolean) {
	try {
		localStorage.setItem(CHAT.sidebar.storageKey, open ? "1" : "0");
	} catch {
		return;
	}
}

export function ChatSidebarProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState<boolean>(CHAT.sidebar.defaultOpen);

	useMountEffect(() => {
		setOpen(readStoredOpen());
	});

	const setOpenPersist = (next: boolean) => {
		setOpen(next);
		writeStoredOpen(next);
	};

	return (
		<ChatSidebarContext
			value={{
				open,
				collapse: () => setOpenPersist(false),
				expand: () => setOpenPersist(true),
				toggle: () => setOpenPersist(!open),
			}}
		>
			{children}
		</ChatSidebarContext>
	);
}

export function useChatSidebar(): ChatSidebarContextValue | null {
	return use(ChatSidebarContext);
}
