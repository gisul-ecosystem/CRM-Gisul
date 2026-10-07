export const DUMMY_ACTIVITIES = [
	{
		id: "da-1",
		time: "10:42 AM",
		tone: "tBlue" as const,
		body: 'Rahul moved "Acme Enterprise" from Proposal ',
		accent: "→ Negotiation",
		meta: "Deal · Aaptor",
	},
	{
		id: "da-2",
		time: "10:10 AM",
		tone: "tYellow" as const,
		body: "Priya added a new lead",
		accent: null,
		meta: "Nova Systems · Racko",
	},
	{
		id: "da-3",
		time: "Yesterday",
		tone: "tGreen" as const,
		body: "Ananya completed follow-up with ByteWorks",
		accent: null,
		meta: null,
	},
	{
		id: "da-4",
		time: "Yesterday",
		tone: "tYellow" as const,
		body: 'Deal "Aaptor Enterprise" marked as ',
		won: "Won",
		meta: null,
	},
] as const;
