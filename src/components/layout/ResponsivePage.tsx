import {forwardRef, type ElementType, type HTMLAttributes, type ReactNode} from "react";

import "./ResponsivePage.scss";

type PageShellVariant = "catalog" | "document" | "workspace";

type PageShellProps = HTMLAttributes<HTMLElement> & {
	as?: ElementType;
	children: ReactNode;
	variant?: PageShellVariant;
};

function classes(...values: Array<string | undefined>) {
	return values.filter(Boolean).join(" ");
}

export function PageShell({
	as: Component = "div",
	children,
	className,
	variant = "document",
	...props
}: PageShellProps) {
	return (
		<Component className={classes("pageShell", `pageShell--${variant}`, className)} {...props}>
			{children}
		</Component>
	);
}

export function PageShellHeader({className, ...props}: HTMLAttributes<HTMLElement>) {
	return <header className={classes("pageShellHeader", className)} {...props} />;
}

export const PageShellBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	function PageShellBody({className, ...props}, ref) {
		return <div className={classes("pageShellBody", className)} ref={ref} {...props} />;
	},
);
