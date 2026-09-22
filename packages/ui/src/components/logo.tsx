import { PRODUCT_BRAND } from "@crm/brand";
import type * as React from "react";
import { cn } from "../lib/utils";

const Logo = ({
	alt,
	className,
	...props
}: React.ImgHTMLAttributes<HTMLImageElement>) => (
	<img
		src={PRODUCT_BRAND.logoSrc}
		alt={alt ?? `${PRODUCT_BRAND.name} logo`}
		className={cn(
			"size-5 shrink-0 object-contain object-left dark:brightness-0 dark:invert",
			className,
		)}
		{...props}
	/>
);
export default Logo;
