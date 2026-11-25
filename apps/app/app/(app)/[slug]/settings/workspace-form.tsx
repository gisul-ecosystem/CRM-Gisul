"use client";

import { Button } from "@crm/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
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
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceSlug } from "@/lib/use-workspace-url";
import { workspaceUrl } from "@/lib/workspace-url";

const INDUSTRIES = [
	"Technology",
	"Financial Services",
	"Healthcare & Biotech",
	"Retail & E-commerce",
	"Manufacturing",
	"Education & EdTech",
	"Media & Entertainment",
	"Professional Consulting",
	"Real Estate",
	"Other",
];

const COMPANY_SIZES = [
	"1-10 employees",
	"11-50 employees",
	"51-200 employees",
	"201-500 employees",
	"500+ employees",
];

const TIMEZONES = [
	"(GMT+05:30) Asia/Kolkata",
	"(GMT+00:00) UTC",
	"(GMT-05:00) Eastern Time (US & Canada)",
	"(GMT-06:00) Central Time (US & Canada)",
	"(GMT-08:00) Pacific Time (US & Canada)",
	"(GMT+01:00) London / Western Europe",
	"(GMT+02:00) Paris, Berlin, Rome",
	"(GMT+04:00) Dubai, Abu Dhabi",
	"(GMT+08:00) Singapore, Hong Kong",
	"(GMT+09:00) Tokyo, Seoul",
	"(GMT+10:00) Sydney, Melbourne",
];

const DATE_FORMATS = [
	"25 Sep 2025",
	"09/25/2025",
	"25/09/2025",
	"2025-09-25",
];

const TIME_FORMATS = [
	"12-hour (AM/PM)",
	"24-hour",
];

const CURRENCIES = [
	{ code: "INR", label: "INR (₹)" },
	{ code: "USD", label: "USD ($)" },
	{ code: "EUR", label: "EUR (€)" },
	{ code: "GBP", label: "GBP (£)" },
	{ code: "AED", label: "AED (AED)" },
	{ code: "SGD", label: "SGD (S$)" },
	{ code: "CAD", label: "CAD (C$)" },
	{ code: "AUD", label: "AUD (A$)" },
	{ code: "JPY", label: "JPY (¥)" },
];

export function WorkspaceForm() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const slug = useWorkspaceSlug();

	const nameId = useId();
	const websiteId = useId();
	const descId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const workspaceQuery = useQuery(trpc.workspace.get.queryOptions());

	const [name, setName] = useState<string | null>(null);
	const [website, setWebsite] = useState<string | null>(null);
	const [industry, setIndustry] = useState<string | null>(null);
	const [companySize, setCompanySize] = useState<string | null>(null);
	const [description, setDescription] = useState<string | null>(null);
	const [logoUrl, setLogoUrl] = useState<string | null>(null);

	const [timezone, setTimezone] = useState<string | null>(null);
	const [dateFormat, setDateFormat] = useState<string | null>(null);
	const [timeFormat, setTimeFormat] = useState<string | null>(null);
	const [currency, setCurrency] = useState<string | null>(null);

	const [showProductFilter, setShowProductFilter] = useState<boolean | null>(null);
	const [enableEmailNotifs, setEnableEmailNotifs] = useState<boolean | null>(null);
	const [autoAssignLeads, setAutoAssignLeads] = useState<boolean | null>(null);
	const [enableDesktopNotifs, setEnableDesktopNotifs] = useState<boolean | null>(null);
	const [allowDuplicateLeads, setAllowDuplicateLeads] = useState<boolean | null>(null);
	const [setFollowUpReminders, setSetFollowUpReminders] = useState<boolean | null>(null);

	const saveMutation = useMutation(
		trpc.workspace.update.mutationOptions({
			onSuccess: async (saved) => {
				await cache.workspace();
				toast.success("Company settings saved successfully.");

				if (saved.slug !== slug) {
					router.replace(workspaceUrl(saved.slug, "/settings"));
				}
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!workspaceQuery.data) return null;

	const ws = workspaceQuery.data;
	const canRename = ws.canRename;

	// Resolve local state with defaults from DB
	const currentName = name ?? ws.name;
	const currentWebsite = website ?? (ws.website || "https://www.gisul.ai");
	const currentIndustry = industry ?? (ws.industry || "Technology");
	const currentCompanySize = companySize ?? (ws.companySize || "11-50 employees");
	const currentDescription =
		description ??
		(ws.description ||
			"We build innovative products and solutions to help businesses grow. Our product ecosystem includes Aaptor, Racko and Kanonkode.");
	const currentLogoUrl = logoUrl ?? ws.logoUrl;

	const currentTimezone = timezone ?? (ws.timezone || "(GMT+05:30) Asia/Kolkata");
	const currentDateFormat = dateFormat ?? (ws.dateFormat || "25 Sep 2025");
	const currentTimeFormat = timeFormat ?? (ws.timeFormat || "12-hour (AM/PM)");
	const currentCurrency = currency ?? (ws.currency || "INR");

	const currentShowProductFilter =
		showProductFilter ?? (ws.preferences?.showProductFilterInAllModules ?? true);
	const currentEnableEmailNotifs =
		enableEmailNotifs ?? (ws.preferences?.enableEmailNotifications ?? true);
	const currentAutoAssignLeads =
		autoAssignLeads ?? (ws.preferences?.autoAssignNewLeads ?? false);
	const currentEnableDesktopNotifs =
		enableDesktopNotifs ?? (ws.preferences?.enableDesktopNotifications ?? true);
	const currentAllowDuplicateLeads =
		allowDuplicateLeads ?? (ws.preferences?.allowDuplicateLeads ?? false);
	const currentSetFollowUpReminders =
		setFollowUpReminders ?? (ws.preferences?.setFollowUpReminders ?? true);

	const handleSave = () => {
		saveMutation.mutate({
			name: currentName.trim(),
			website: currentWebsite.trim(),
			industry: currentIndustry,
			companySize: currentCompanySize,
			description: currentDescription.trim(),
			logoUrl: currentLogoUrl,
			timezone: currentTimezone,
			dateFormat: currentDateFormat,
			timeFormat: currentTimeFormat,
			currency: currentCurrency,
			preferences: {
				showProductFilterInAllModules: currentShowProductFilter,
				enableEmailNotifications: currentEnableEmailNotifs,
				autoAssignNewLeads: currentAutoAssignLeads,
				enableDesktopNotifications: currentEnableDesktopNotifs,
				allowDuplicateLeads: currentAllowDuplicateLeads,
				setFollowUpReminders: currentSetFollowUpReminders,
			},
		});
	};

	const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (event) => {
				setLogoUrl(event.target?.result as string);
				toast.success("Logo uploaded. Click Save Changes to apply.");
			};
			reader.readAsDataURL(file);
		}
	};

	return (
		<div className="flex w-full flex-col gap-6">
			{/* Hidden file input for logo change */}
			<input
				type="file"
				ref={fileInputRef}
				onChange={handleLogoUpload}
				accept="image/png, image/jpeg, image/jpg, image/svg+xml"
				className="hidden"
			/>

			{/* Section 1: COMPANY INFORMATION Card */}
			<div className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
				{/* Top Row: Title + Save Changes Button */}
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-base font-bold tracking-tight text-foreground uppercase">
							Company Information
						</h2>
						<p className="mt-0.5 text-xs text-muted-foreground">
							Manage your company details and branding.
						</p>
					</div>

					<Button
						disabled={!canRename || saveMutation.isPending}
						onClick={handleSave}
						className="h-9 rounded-xl bg-[#5e3da8] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#4d328a]"
					>
						{saveMutation.isPending ? (
							<Spinner className="mr-1.5 h-3.5 w-3.5" />
						) : null}
						Save Changes
					</Button>
				</div>

				{/* COMPANY LOGO Section */}
				<div className="flex flex-col gap-2 border-t border-border/40 pt-5">
					<span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
						Company Logo
					</span>
					<div className="flex flex-wrap items-center gap-3.5 pt-1">
						{/* Logo Display */}
						<div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-purple-200/80 bg-purple-100 font-extrabold text-base tracking-wide text-purple-700 shadow-2xs dark:border-purple-900/60 dark:bg-purple-950/60 dark:text-purple-300">
							{currentLogoUrl ? (
								<img
									src={currentLogoUrl}
									alt="Logo"
									className="h-full w-full object-contain p-1"
								/>
							) : (
								<span>GiSūl</span>
							)}
						</div>

						{/* Remove Button */}
						{currentLogoUrl ? (
							<Button
								type="button"
								variant="ghost"
								onClick={() => setLogoUrl(null)}
								disabled={!canRename}
								className="h-8 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
							>
								Remove
							</Button>
						) : (
							<Button
								type="button"
								variant="ghost"
								onClick={() => setLogoUrl(null)}
								disabled={!canRename}
								className="h-8 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
							>
								Remove
							</Button>
						)}

						{/* Change Logo Button */}
						<Button
							type="button"
							variant="outline"
							onClick={() => fileInputRef.current?.click()}
							disabled={!canRename}
							className="h-8 rounded-xl border-purple-200 px-3.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40"
						>
							Change Logo
						</Button>

						{/* Recommended Size Note */}
						<span className="text-[11px] text-muted-foreground">
							Recommended size: 200 × 200px (PNG, JPG)
						</span>
					</div>
				</div>

				{/* Form Fields Grid */}
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{/* Company Name */}
					<Field>
						<FieldLabel htmlFor={nameId} className="text-xs font-semibold text-foreground">
							Company Name
						</FieldLabel>
						<Input
							id={nameId}
							value={currentName}
							onChange={(e) => setName(e.target.value)}
							placeholder="Gisul Software Services Pvt. Ltd."
							disabled={!canRename || saveMutation.isPending}
							className="h-9 rounded-xl bg-background text-xs"
							required
						/>
					</Field>

					{/* Website */}
					<Field>
						<FieldLabel htmlFor={websiteId} className="text-xs font-semibold text-foreground">
							Website
						</FieldLabel>
						<Input
							id={websiteId}
							value={currentWebsite}
							onChange={(e) => setWebsite(e.target.value)}
							placeholder="https://www.gisul.ai"
							disabled={!canRename || saveMutation.isPending}
							className="h-9 rounded-xl bg-background text-xs"
							required
						/>
					</Field>

					{/* Industry */}
					<Field>
						<FieldLabel className="text-xs font-semibold text-foreground">
							Industry
						</FieldLabel>
						<Select
							value={currentIndustry}
							onValueChange={setIndustry}
							disabled={!canRename || saveMutation.isPending}
						>
							<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
								<SelectValue placeholder="Select industry" />
							</SelectTrigger>
							<SelectContent>
								{INDUSTRIES.map((item) => (
									<SelectItem key={item} value={item}>
										{item}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{/* Company Size */}
					<Field>
						<FieldLabel className="text-xs font-semibold text-foreground">
							Company Size
						</FieldLabel>
						<Select
							value={currentCompanySize}
							onValueChange={setCompanySize}
							disabled={!canRename || saveMutation.isPending}
						>
							<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
								<SelectValue placeholder="Select size" />
							</SelectTrigger>
							<SelectContent>
								{COMPANY_SIZES.map((item) => (
									<SelectItem key={item} value={item}>
										{item}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{/* Company Description */}
					<div className="col-span-1 md:col-span-2">
						<Field>
							<FieldLabel htmlFor={descId} className="text-xs font-semibold text-foreground">
								Company Description
							</FieldLabel>
							<Textarea
								id={descId}
								value={currentDescription}
								onChange={(e) => setDescription(e.target.value.slice(0, 500))}
								placeholder="Brief description about your company and offerings..."
								disabled={!canRename || saveMutation.isPending}
								className="rounded-xl bg-background text-xs resize-none"
								rows={3}
							/>
							<div className="flex justify-end pt-1">
								<span className="text-[10px] text-muted-foreground">
									{currentDescription.length}/500
								</span>
							</div>
						</Field>
					</div>
				</div>
			</div>

			{/* Section 2: REGIONAL SETTINGS Card */}
			<div className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
				<div>
					<h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
						Regional Settings
					</h3>
					<p className="mt-0.5 text-xs text-muted-foreground/80">
						Set your timezone, date format and currency preferences.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 border-t border-border/40 pt-4 md:grid-cols-3">
					{/* Timezone */}
					<Field>
						<FieldLabel className="text-xs font-semibold text-foreground">
							Timezone
						</FieldLabel>
						<Select
							value={currentTimezone}
							onValueChange={setTimezone}
							disabled={!canRename || saveMutation.isPending}
						>
							<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIMEZONES.map((item) => (
									<SelectItem key={item} value={item}>
										{item}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{/* Date Format */}
					<Field>
						<FieldLabel className="text-xs font-semibold text-foreground">
							Date Format
						</FieldLabel>
						<Select
							value={currentDateFormat}
							onValueChange={setDateFormat}
							disabled={!canRename || saveMutation.isPending}
						>
							<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DATE_FORMATS.map((item) => (
									<SelectItem key={item} value={item}>
										{item}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{/* Time Format */}
					<Field>
						<FieldLabel className="text-xs font-semibold text-foreground">
							Time Format
						</FieldLabel>
						<Select
							value={currentTimeFormat}
							onValueChange={setTimeFormat}
							disabled={!canRename || saveMutation.isPending}
						>
							<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIME_FORMATS.map((item) => (
									<SelectItem key={item} value={item}>
										{item}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{/* Currency */}
					<div className="col-span-1 md:col-span-3">
						<Field>
							<FieldLabel className="text-xs font-semibold text-foreground">
								Currency
							</FieldLabel>
							<Select
								value={currentCurrency}
								onValueChange={setCurrency}
								disabled={!canRename || saveMutation.isPending}
							>
								<SelectTrigger className="h-9 rounded-xl bg-background text-xs font-medium">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CURRENCIES.map((item) => (
										<SelectItem key={item.code} value={item.code}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>
				</div>
			</div>

			{/* Section 3: PREFERENCES Card */}
			<div className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
				<div>
					<h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
						Preferences
					</h3>
					<p className="mt-0.5 text-xs text-muted-foreground/80">
						Configure how you want to use Gisul CRM.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-6 border-t border-border/40 pt-5 md:grid-cols-2">
					{/* Left Column */}
					<div className="flex flex-col gap-5">
						{/* Show product filter in all modules */}
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Show product filter in all modules
								</div>
								<div className="text-[11px] text-muted-foreground leading-relaxed">
									Display product selection across leads, customers and deals
								</div>
							</div>
							<Switch
								checked={currentShowProductFilter}
								onCheckedChange={setShowProductFilter}
								disabled={!canRename || saveMutation.isPending}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>

						{/* Enable email notifications */}
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Enable email notifications
								</div>
								<div className="text-[11px] text-muted-foreground leading-relaxed">
									Get notified about important activities
								</div>
							</div>
							<Switch
								checked={currentEnableEmailNotifs}
								onCheckedChange={setEnableEmailNotifs}
								disabled={!canRename || saveMutation.isPending}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>

						{/* Auto-assign new leads */}
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Auto-assign new leads
								</div>
								<div className="text-[11px] text-muted-foreground leading-relaxed">
									Automatically assign leads to team members
								</div>
							</div>
							<Switch
								checked={currentAutoAssignLeads}
								onCheckedChange={setAutoAssignLeads}
								disabled={!canRename || saveMutation.isPending}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>
					</div>

					{/* Right Column */}
					<div className="flex flex-col gap-5">
						{/* Enable desktop notifications */}
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Enable desktop notifications
								</div>
								<div className="text-[11px] text-muted-foreground leading-relaxed">
									Show browser notifications for new activities
								</div>
							</div>
							<Switch
								checked={currentEnableDesktopNotifs}
								onCheckedChange={setEnableDesktopNotifs}
								disabled={!canRename || saveMutation.isPending}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>

						{/* Allow duplicate leads */}
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Allow duplicate leads
								</div>
								<div className="text-[11px] text-muted-foreground leading-relaxed">
									Let users create duplicate leads with same email/phone
								</div>
							</div>
							<Switch
								checked={currentAllowDuplicateLeads}
								onCheckedChange={setAllowDuplicateLeads}
								disabled={!canRename || saveMutation.isPending}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>

						{/* Set follow-up reminders */}
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-xs font-bold text-foreground">
									Set follow-up reminders
								</div>
								<div className="text-[11px] text-muted-foreground leading-relaxed">
									Get reminded about pending follow-ups
								</div>
							</div>
							<Switch
								checked={currentSetFollowUpReminders}
								onCheckedChange={setSetFollowUpReminders}
								disabled={!canRename || saveMutation.isPending}
								className="data-[state=checked]:bg-[#5e3da8]"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
