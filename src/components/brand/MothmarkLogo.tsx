"use client";

import Image from "next/image";

import {useTheme} from "../theme/ThemeProvider";

type MothmarkLogoVariant = "basic" | "headerCompact" | "headerPrimary" | "vertical";

type MothmarkLogoProps = {
	className?: string;
	priority?: boolean;
	variant: MothmarkLogoVariant;
};

const variants: Record<MothmarkLogoVariant, {fileName: string; height: number; width: number}> = {
	basic: {fileName: "basic.png", height: 163, width: 188},
	headerCompact: {fileName: "header-compact.png", height: 108, width: 440},
	headerPrimary: {fileName: "header-primary.png", height: 157, width: 624},
	vertical: {fileName: "vertical.png", height: 208, width: 301},
};

export function MothmarkLogo({className, priority = false, variant}: MothmarkLogoProps) {
	const {theme} = useTheme();
	const asset = variants[variant];

	return (
		<Image
			alt=""
			aria-hidden="true"
			className={className}
			height={asset.height}
			priority={priority}
			src={`/logo/${theme}/${asset.fileName}`}
			unoptimized
			width={asset.width}
		/>
	);
}
