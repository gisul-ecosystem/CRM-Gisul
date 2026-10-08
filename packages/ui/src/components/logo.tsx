import { PRODUCT_BRAND } from "@crm/brand";
import type * as React from "react";
import { cn } from "../lib/utils";

const Logo = ({
	alt,
	className,
	variant = "wordmark",
	...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
	variant?: "wordmark" | "mark";
}) => (
	<img
		src={
			variant === "mark" ? PRODUCT_BRAND.loadingLogoSrc : PRODUCT_BRAND.logoSrc
		}
		alt={alt ?? `${PRODUCT_BRAND.name} logo`}
		className={cn(
			variant === "mark"
				? "size-5 shrink-0 object-contain object-center dark:brightness-0 dark:invert"
				: "h-5 w-auto max-w-[140px] shrink-0 object-contain object-left",
			className,
		)}
		{...props}
	/>
);
export default Logo;
