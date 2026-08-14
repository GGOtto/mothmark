"use client";

import {HugeiconsIcon} from "@hugeicons/react";
import type {ItemIconCategory} from "./itemIconCatalog";
import {ITEM_ICON_LIBRARY} from "./itemIconLibrary";

export function ItemIcon({category, size}: {category: ItemIconCategory; size: number}) {
	const entry = ITEM_ICON_LIBRARY[category];
	return (
		<HugeiconsIcon
			aria-hidden="true"
			data-icon-category={category}
			data-icon-name={entry.iconName}
			icon={entry.icon}
			size={size}
			strokeWidth={0.75}
		/>
	);
}
