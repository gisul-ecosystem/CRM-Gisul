import { PRODUCT_BRAND } from "@crm/brand";
import { cn } from "@crm/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const spinnerVariants = cva(
	"relative inline-flex shrink-0 items-center justify-center",
	{
		variants: {
			size: {
				default: "size-4",
				lg: "size-10",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
);

function Spinner({
	className,
	size,
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof spinnerVariants>) {
	return (
		<span
			data-slot="spinner"
			role="status"
			aria-label="Loading"
			className={cn(spinnerVariants({ size }), className)}
			{...props}
		>
			<span
				aria-hidden
				className="absolute inset-0 animate-spin rounded-full border-2 border-ring/25 border-t-ring"
			/>
			<img
				src={PRODUCT_BRAND.logoSrc}
				alt=""
				className="relative z-10 max-h-[58%] max-w-[58%] object-contain object-center dark:brightness-0 dark:invert"
			/>
		</span>
	);
}

export { Spinner };
