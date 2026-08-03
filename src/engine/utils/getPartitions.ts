export type PartitionSegment = {
	text: string;
	rawText: string;
};

export function getPartitionSegments(text: string): PartitionSegment[][] {
	const words = [...text.matchAll(/\S+/g)].map((match) => ({
		text: match[0],
		start: match.index,
		end: match.index + match[0].length,
	}));

	if (words.length === 0) {
		return [];
	}

	const partitions: PartitionSegment[][] = [];

	function buildPartition(index: number, current: PartitionSegment[]): void {
		if (index === words.length) {
			partitions.push(current);
			return;
		}

		for (let end = index; end < words.length; end += 1) {
			buildPartition(end + 1, [
				...current,
				{
					text: words
						.slice(index, end + 1)
						.map((word) => word.text)
						.join(" "),
					rawText: text.slice(words[index].start, words[end].end),
				},
			]);
		}
	}

	buildPartition(0, []);

	return partitions;
}

export function getPartitions(text: string): string[][] {
	return getPartitionSegments(text).map((partition) => partition.map((segment) => segment.text));
}
