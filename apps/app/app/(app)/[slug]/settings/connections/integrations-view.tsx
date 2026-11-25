"use client";

import Api from "@carbon/icons-react/es/Api";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Code from "@carbon/icons-react/es/Code";
import Connect from "@carbon/icons-react/es/Connect";
import Grid from "@carbon/icons-react/es/Grid";
import LinkIcon from "@carbon/icons-react/es/Link";
import Locked from "@carbon/icons-react/es/Locked";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Renew from "@carbon/icons-react/es/Renew";
import Search from "@carbon/icons-react/es/Search";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceSlug } from "@/lib/use-workspace-url";

type IntegrationItem = RouterOutputs["workspace"]["integrations"]["integrations"][number];

const CATEGORIES = [
	{
		id: "communication",
		title: "Communication & Email",
		subtitle: "Connect your email and communication tools to sync conversations and activities.",
	},
	{
		id: "collaboration",
		title: "Collaboration & Productivity",
		subtitle: "Bring in data from your team's tools and keep everyone aligned.",
	},
	{
		id: "marketing",
		title: "Marketing & Lead Capture",
		subtitle: "Capture leads from your marketing tools directly into GISUL CRM.",
	},
	{
		id: "development",
		title: "Development & Custom",
		subtitle: "Connect with other tools or use our API to build custom integrations.",
	},
];

export function IntegrationsView() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const slug = useWorkspaceSlug();

	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [activeIntegrationForModal, setActiveIntegrationForModal] = useState<IntegrationItem | null>(null);

	const { data, isLoading } = useQuery(trpc.workspace.integrations.queryOptions());

	const toggleMutation = useMutation(
		trpc.workspace.toggleIntegration.mutationOptions({
			onSuccess: (updated) => {
				queryClient.invalidateQueries({
					queryKey: trpc.workspace.integrations.queryKey(),
				});
				toast.success(
					updated.enabled
						? `${updated.name} integration enabled`
						: `${updated.name} integration disabled`,
				);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const items = data?.integrations ?? [];
	const summary = data?.summary ?? {
		total: 11,
		connected: 5,
		available: 2,
		notConnected: 4,
	};

	const filteredItems = useMemo(() => {
		return items.filter((item) => {
			const matchesSearch =
				!searchQuery ||
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.category.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesCategory =
				selectedCategory === "all" || item.category === selectedCategory;

			return matchesSearch && matchesCategory;
		});
	}, [items, searchQuery, selectedCategory]);

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner className="size-6 text-[#5e3da8]" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 pb-12">
			{/* 4 Summary Metric Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{/* 1. Total Integrations */}
				<div className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3.5 shadow-2xs">
					<div className="size-10 rounded-xl bg-violet-100 text-[#5e3da8] dark:bg-violet-950/50 dark:text-violet-400 flex items-center justify-center shrink-0">
						<Icon icon={Grid} className="size-5" />
					</div>
					<div>
						<p className="text-lg font-bold text-foreground leading-none">
							{summary.total}
						</p>
						<p className="text-xs text-muted-foreground mt-1">Total Integrations</p>
					</div>
				</div>

				{/* 2. Connected */}
				<div className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3.5 shadow-2xs">
					<div className="size-10 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0">
						<Icon icon={LinkIcon} className="size-5" />
					</div>
					<div>
						<p className="text-lg font-bold text-foreground leading-none">
							{summary.connected}
						</p>
						<p className="text-xs text-muted-foreground mt-1">Connected</p>
					</div>
				</div>

				{/* 3. Available */}
				<div className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3.5 shadow-2xs">
					<div className="size-10 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center shrink-0">
						<Icon icon={Locked} className="size-5" />
					</div>
					<div>
						<p className="text-lg font-bold text-foreground leading-none">
							{summary.available}
						</p>
						<p className="text-xs text-muted-foreground mt-1">Available</p>
					</div>
				</div>

				{/* 4. Not Connected */}
				<div className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3.5 shadow-2xs">
					<div className="size-10 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center shrink-0">
						<Icon icon={Renew} className="size-5" />
					</div>
					<div>
						<p className="text-lg font-bold text-foreground leading-none">
							{summary.notConnected}
						</p>
						<p className="text-xs text-muted-foreground mt-1">Not Connected</p>
					</div>
				</div>
			</div>

			{/* Search & Category Filter Bar */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3">
				<div className="relative w-full sm:w-96">
					<Icon
						icon={Search}
						className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						placeholder="Search integrations by name or category..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9 h-10 rounded-xl bg-card border-border/60 text-xs"
					/>
				</div>

				<Select value={selectedCategory} onValueChange={setSelectedCategory}>
					<SelectTrigger className="w-full sm:w-48 h-10 rounded-xl bg-card border-border/60 text-xs">
						<SelectValue placeholder="All Categories" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Categories</SelectItem>
						<SelectItem value="communication">Communication & Email</SelectItem>
						<SelectItem value="collaboration">Collaboration & Productivity</SelectItem>
						<SelectItem value="marketing">Marketing & Lead Capture</SelectItem>
						<SelectItem value="development">Development & Custom</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Categorized Integration Grids */}
			<div className="flex flex-col gap-8">
				{CATEGORIES.map((category) => {
					const categoryItems = filteredItems.filter(
						(item) => item.category === category.id,
					);
					if (categoryItems.length === 0) return null;

					return (
						<section key={category.id} className="flex flex-col gap-3.5">
							{/* Section Header */}
							<div>
								<h2 className="text-sm font-bold text-foreground tracking-tight">
									{category.title}
								</h2>
								<p className="text-xs text-muted-foreground mt-0.5">
									{category.subtitle}
								</p>
							</div>

							{/* 3-Column Cards Grid */}
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{categoryItems.map((item) => (
									<IntegrationCard
										key={item.id}
										item={item}
										slug={slug}
										onToggle={(enabled) =>
											toggleMutation.mutate({
												id: item.id,
												enabled,
											})
										}
										onOpenDetails={() => setActiveIntegrationForModal(item)}
									/>
								))}
							</div>
						</section>
					);
				})}
			</div>

			{/* Details / Configure Dialog */}
			{activeIntegrationForModal ? (
				<Dialog
					open={Boolean(activeIntegrationForModal)}
					onOpenChange={(open) => !open && setActiveIntegrationForModal(null)}
				>
					<DialogContent className="max-w-md rounded-2xl">
						<DialogHeader>
							<div className="flex items-center gap-3">
								<IntegrationLogo id={activeIntegrationForModal.id} className="size-8" />
								<div>
									<DialogTitle>{activeIntegrationForModal.name}</DialogTitle>
									<DialogDescription className="text-xs mt-0.5">
										{activeIntegrationForModal.category.toUpperCase()} INTEGRATION
									</DialogDescription>
								</div>
							</div>
						</DialogHeader>

						<div className="py-3 space-y-3 text-xs">
							<p className="text-muted-foreground">
								{activeIntegrationForModal.description}
							</p>

							<div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground">Status</span>
									<span className="font-semibold capitalize text-foreground">
										{activeIntegrationForModal.connected ? "Connected" : "Not Connected"}
									</span>
								</div>
								{activeIntegrationForModal.accountName ? (
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground">Account</span>
										<span className="font-medium text-foreground">
											{activeIntegrationForModal.accountName}
										</span>
									</div>
								) : null}
							</div>
						</div>

						<DialogFooter>
							<DialogClose asChild>
								<Button variant="outline">Close</Button>
							</DialogClose>
							{activeIntegrationForModal.settingsUrl ? (
								<Button asChild className="bg-[#5e3da8] hover:bg-[#5e3da8]/90 text-white">
									<Link
										href={`/${slug}/settings/${activeIntegrationForModal.settingsUrl}`}
									>
										Open Settings
									</Link>
								</Button>
							) : null}
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	);
}

function IntegrationCard({
	item,
	slug,
	onToggle,
	onOpenDetails,
}: {
	item: IntegrationItem;
	slug: string;
	onToggle: (enabled: boolean) => void;
	onOpenDetails: () => void;
}) {
	const isConnected = item.connected;

	return (
		<div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col justify-between hover:shadow-sm transition-all group">
			<div>
				{/* Top Row: Logo + Name + Switch + Overflow Menu */}
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2.5 min-w-0">
						<IntegrationLogo id={item.id} className="size-6 shrink-0" />
						<h3 className="text-sm font-bold text-foreground truncate">
							{item.name}
						</h3>
					</div>

					<div className="flex items-center gap-1.5 shrink-0">
						<Switch
							checked={item.enabled}
							onCheckedChange={onToggle}
							className="data-[state=checked]:bg-[#5e3da8]"
						/>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									className="size-7 rounded-md text-muted-foreground hover:text-foreground"
								>
									<Icon icon={OverflowMenuVertical} className="size-3.5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-36">
								<DropdownMenuItem onClick={onOpenDetails}>
									View Details
								</DropdownMenuItem>
								{item.settingsUrl ? (
									<DropdownMenuItem asChild>
										<Link href={`/${slug}/settings/${item.settingsUrl}`}>
											Configure
										</Link>
									</DropdownMenuItem>
								) : null}
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => onToggle(!item.enabled)}>
									{item.enabled ? "Disable" : "Enable"}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Middle: Description */}
				<p className="text-xs text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed min-h-8">
					{item.description}
				</p>
			</div>

			{/* Bottom Row: Status Dot + Action Button */}
			<div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/30">
				<div className="flex items-center gap-1.5">
					<span
						className={cn(
							"size-2 rounded-full shrink-0",
							isConnected ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600",
						)}
					/>
					<span
						className={cn(
							"text-xs font-medium",
							isConnected
								? "text-emerald-600 dark:text-emerald-400"
								: "text-muted-foreground",
						)}
					>
						{item.id === "api-access"
							? "Enabled"
							: isConnected
								? "Connected"
								: "Not Connected"}
					</span>
				</div>

				{item.id === "api-access" ? (
					<Button
						asChild
						size="sm"
						variant="outline"
						className="h-7 px-3 text-xs rounded-lg border-border/60 hover:border-[#5e3da8] hover:text-[#5e3da8] transition-colors"
					>
						<Link href={`/${slug}/settings/api-keys`}>View Docs</Link>
					</Button>
				) : isConnected ? (
					item.settingsUrl ? (
						<Button
							asChild
							size="sm"
							variant="outline"
							className="h-7 px-3 text-xs rounded-lg border-border/60 hover:border-[#5e3da8] hover:text-[#5e3da8] transition-colors"
						>
							<Link href={`/${slug}/settings/${item.settingsUrl}`}>Configure</Link>
						</Button>
					) : (
						<Button
							size="sm"
							variant="outline"
							onClick={onOpenDetails}
							className="h-7 px-3 text-xs rounded-lg border-border/60 hover:border-[#5e3da8] hover:text-[#5e3da8] transition-colors"
						>
							Configure
						</Button>
					)
				) : (
					item.settingsUrl ? (
						<Button
							asChild
							size="sm"
							variant="outline"
							className="h-7 px-3 text-xs rounded-lg border-border/60 hover:border-[#5e3da8] hover:text-[#5e3da8] transition-colors"
						>
							<Link href={`/${slug}/settings/${item.settingsUrl}`}>Connect</Link>
						</Button>
					) : (
						<Button
							size="sm"
							variant="outline"
							onClick={() => onToggle(true)}
							className="h-7 px-3 text-xs rounded-lg border-border/60 hover:border-[#5e3da8] hover:text-[#5e3da8] transition-colors"
						>
							Connect
						</Button>
					)
				)}
			</div>
		</div>
	);
}

function IntegrationLogo({ id, className }: { id: string; className?: string }) {
	switch (id) {
		case "gmail":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<path
						fill="#EA4335"
						d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
					/>
				</svg>
			);
		case "outlook":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<rect width="24" height="24" rx="4" fill="#0078D4" />
					<circle cx="12" cy="12" r="5" fill="#FFFFFF" fillOpacity="0.3" />
					<text
						x="12"
						y="16"
						fill="#FFFFFF"
						fontSize="12"
						fontWeight="bold"
						textAnchor="middle"
					>
						O
					</text>
				</svg>
			);
		case "google-calendar":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<rect width="24" height="24" rx="4" fill="#4285F4" />
					<rect x="4" y="8" width="16" height="12" rx="2" fill="#FFFFFF" />
					<path d="M4 6h16v3H4z" fill="#1A73E8" />
					<text
						x="12"
						y="17"
						fill="#4285F4"
						fontSize="8"
						fontWeight="bold"
						textAnchor="middle"
					>
						31
					</text>
				</svg>
			);
		case "slack":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<path
						fill="#E01E5A"
						d="M6 14.5a2.5 2.5 0 1 0-2.5-2.5V14.5H6zm0 1.5H3.5A2.5 2.5 0 0 0 6 18.5V16zm9.5-10a2.5 2.5 0 1 0-2.5-2.5V6h2.5zm-1.5 0V3.5A2.5 2.5 0 0 0 11.5 6H14z"
					/>
					<path
						fill="#36C5F0"
						d="M14.5 18a2.5 2.5 0 1 0 2.5 2.5V18h-2.5zm-1.5 0h2.5A2.5 2.5 0 0 0 18 15.5H13V18zm-8.5-8.5a2.5 2.5 0 1 0 2.5 2.5V9.5H4.5zm1.5 0V7a2.5 2.5 0 0 0-2.5 2.5H6z"
					/>
					<path
						fill="#2EB67D"
						d="M18 9.5a2.5 2.5 0 1 0 2.5 2.5V9.5H18zm0-1.5h2.5A2.5 2.5 0 0 0 18 5.5V8z"
					/>
					<path
						fill="#ECB22E"
						d="M9.5 6a2.5 2.5 0 1 0-2.5-2.5V6h2.5zm0 1.5H7A2.5 2.5 0 0 0 9.5 10V7.5z"
					/>
				</svg>
			);
		case "teams":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<rect width="24" height="24" rx="4" fill="#6264A7" />
					<circle cx="16" cy="8" r="3" fill="#8B8CC7" />
					<rect x="13" y="12" width="6" height="7" rx="2" fill="#8B8CC7" />
					<rect x="4" y="6" width="10" height="13" rx="2" fill="#FFFFFF" />
					<text
						x="9"
						y="15"
						fill="#6264A7"
						fontSize="9"
						fontWeight="bold"
						textAnchor="middle"
					>
						T
					</text>
				</svg>
			);
		case "notion":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<rect width="24" height="24" rx="4" fill="#000000" />
					<text
						x="12"
						y="17"
						fill="#FFFFFF"
						fontSize="13"
						fontWeight="bold"
						fontFamily="serif"
						textAnchor="middle"
					>
						N
					</text>
				</svg>
			);
		case "hubspot":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<circle cx="12" cy="12" r="11" fill="#FF7A59" />
					<circle cx="12" cy="12" r="3" fill="#FFFFFF" />
					<path
						d="M12 4v4m0 8v4m-8-8h4m8 0h4"
						stroke="#FFFFFF"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			);
		case "linkedin":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<rect width="24" height="24" rx="4" fill="#0A66C2" />
					<text
						x="12"
						y="16"
						fill="#FFFFFF"
						fontSize="11"
						fontWeight="bold"
						fontFamily="sans-serif"
						textAnchor="middle"
					>
						in
					</text>
				</svg>
			);
		case "meta-ads":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<rect width="24" height="24" rx="4" fill="#0081FB" />
					<path
						fill="#FFFFFF"
						d="M16.5 8c-1.8 0-3 1.2-3.8 2.5C11.9 9.2 10.7 8 8.9 8 6.5 8 5 10 5 12.2c0 2.4 1.8 4.3 4.1 4.3 1.8 0 3-1.2 3.8-2.5.8 1.3 2 2.5 3.8 2.5 2.3 0 4.1-1.9 4.1-4.3C20.8 9.9 19 8 16.5 8z"
					/>
				</svg>
			);
		case "zapier":
			return (
				<svg viewBox="0 0 24 24" className={className}>
					<rect width="24" height="24" rx="4" fill="#FF4A00" />
					<path
						d="M12 4v16m-8-8h16m-12-6l8 12m0-12l-8 12"
						stroke="#FFFFFF"
						strokeWidth="2.5"
						strokeLinecap="round"
					/>
				</svg>
			);
		case "api-access":
			return (
				<div
					className={cn(
						"rounded-md bg-[#5e3da8]/10 text-[#5e3da8] flex items-center justify-center font-mono font-bold text-xs",
						className,
					)}
				>
					{"</>"}
				</div>
			);
		default:
			return <Icon icon={Connect} className={className} />;
	}
}
