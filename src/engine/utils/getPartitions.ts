export function getPartitions(text: string): string[][] {
	const words = text.trim().split(/\s+/).filter(Boolean);

	if (words.length === 0) {
		return [];
	}

	const partitions: string[][] = [];

	function buildPartition(index: number, current: string[]): void {
		if (index === words.length) {
			partitions.push(current);
			return;
		}

		let phrase = "";

		for (let end = index; end < words.length; end += 1) {
			phrase = phrase ? `${phrase} ${words[end]}` : words[end];

			buildPartition(end + 1, [...current, phrase]);
		}
	}

	buildPartition(0, []);

	return partitions;
}
