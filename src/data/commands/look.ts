export const lookCommand = {
	id: {
		type: "command",
		id: "command-2",
	},
	name: "Look",
	enabled: true,
	patterns: [
		{
			blocks: [
				{
					id: {
						type: "command-block",
						id: "command-block-1",
					},
					type: "phrase",
					matches: ["look", "look around", "l", "look about"],
				},
			],
		},
	],
	scope: {
		scope: "global",
	},
	priority: 0,
	fallbacks: [],
	behavior: {
		id: {
			type: "condition-branch",
			id: "command-2-branch",
		},
		always: {
			id: {
				type: "effect",
				id: "command-2-effect",
			},
			name: "Response",
			type: "group",
			effects: [
				{
					type: "message",
					operation: "current-room-description",
					allowShorten: false,
				},
			],
			allowMultipleUsesInWorld: true,
		},
	},
};
