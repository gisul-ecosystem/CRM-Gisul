import { PRODUCT_BRAND } from "@crm/brand";
import Logo from "@crm/ui/components/logo";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthShader } from "@/components/auth-shader";

export function AuthShell({ children }: { children: ReactNode }) {
	return (
		<main className="relative min-h-svh overflow-hidden bg-[#fdfdff] text-foreground">
			<AuthShader />

			<div className="relative z-10 mx-auto grid min-h-svh w-full max-w-[1280px] gap-10 px-6 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,440px)] lg:items-center lg:gap-12 lg:px-10 xl:px-14">
				<section className="flex flex-col gap-8 lg:gap-10">
					<Link
						href="/"
						aria-label={`${PRODUCT_BRAND.name} homepage`}
						className="w-fit"
					>
						<Logo className="h-9 w-auto max-w-[180px] shrink-0" />
					</Link>

					<div className="flex max-w-xl flex-col gap-4">
						<h1 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] font-bold tracking-tight text-[#1c1a22] uppercase">
							Welcome back. Pick up where you left off.
						</h1>
						<p className="max-w-[36ch] text-base leading-6 text-[#6b6575]">
							Manage your leads, follow-ups and deals from one workspace.
						</p>
					</div>

				</section>

				<section className="flex justify-center lg:justify-end">
					<div className="flex w-full max-w-[420px] flex-col gap-8 rounded-xl border border-[#ece8f4]/90 bg-white/95 p-7 shadow-[0_20px_50px_rgba(70,55,120,0.12)] backdrop-blur-sm sm:p-9">
						{children}
					</div>
				</section>
			</div>
		</main>
	);
}

export function AuthHeading({
	title,
	description,
}: {
	title: string;
	description: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<h2 className="text-[1.75rem] leading-none font-bold tracking-tight text-[#1c1a22] uppercase">
				{title}
			</h2>
			<p className="text-sm text-[#7a7485]">{description}</p>
		</div>
	);
}
