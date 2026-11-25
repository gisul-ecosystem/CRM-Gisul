"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import type { ReactNode } from "react";

export function ConfirmDialog({
	open,
	title,
	description,
	action,
	destructive = true,
	pending = false,
	onConfirm,
	onClose,
}: {
	open: boolean;
	title: ReactNode;
	description: ReactNode;
	action: string;
	destructive?: boolean;
	pending?: boolean;
	onConfirm: () => void;
	onClose: () => void;
}) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant={destructive ? "destructive" : "default"}
						disabled={pending}
						onClick={(event) => {
							event.preventDefault();
							onConfirm();
						}}
					>
						{action}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
