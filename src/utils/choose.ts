/**
 * Choose a random element from an array
 */
export function choose<T>(arr: T[]): T | undefined {
	return arr[Math.floor(Math.random() * arr.length)];
}
