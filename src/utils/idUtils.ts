export type Identifiable = {
	id: string;
};

export function generateUniqueId(prefix: string, existingItems: Identifiable[]) {
	const usedIds = new Set(existingItems.map((item) => item.id));

	let nextNumber = 1;
	let nextId = `${prefix}-${nextNumber}`;

	while (usedIds.has(nextId)) {
		nextNumber += 1;
		nextId = `${prefix}-${nextNumber}`;
	}

	return nextId;
}
