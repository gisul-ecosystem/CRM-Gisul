import Logo from "@crm/ui/components/logo";
import { cn } from "@crm/ui/lib/utils";

export function Wordmark({ className }: { className?: string }) {
	return (
		<span className={cn("flex shrink-0 select-none items-center", className)}>
			<Logo className="h-7 w-auto max-w-[140px] shrink-0" />
		</span>
	);
}
