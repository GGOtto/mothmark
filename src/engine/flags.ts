export function getRoomVisitedFlag(roomId: string) {
	return `room:${roomId}.visited`;
}

export function getRoomViewedFlag(roomId: string) {
	return `room:${roomId}.viewed`;
}

export function getFeatureExaminedFlag(roomId: string, featureId: string) {
	return `feature:${roomId}.${featureId}.examined`;
}
