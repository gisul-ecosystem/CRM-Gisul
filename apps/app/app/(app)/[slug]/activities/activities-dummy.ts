import {
	ACTIVITIES,
	type ActivityStatus,
	type ActivityTypeKey,
} from "./activities-config";

export type ActivityItem = {
	id: number;
	type: ActivityTypeKey;
	title: string;
	desc: string;
	company: string;
	owner: string;
	date: string;
	min: number;
	done: boolean;
};

export const ACTIVITY_TYPE_META = {
	call: {
		label: "Call",
		dot: "#5f4a9e",
		bg: "#e1f7ec",
		fg: "#10a36f",
		lead: "Call with",
		desc: "Discuss Aaptor assessment requirements",
	},
	meeting: {
		label: "Meeting",
		dot: "#10b981",
		bg: "#ebe7fa",
		fg: "#5f4a9e",
		lead: "Demo with",
		desc: "Walk through product roadmap",
	},
	email: {
		label: "Email",
		dot: "#f5b82e",
		bg: "#fff3d1",
		fg: "#c98b00",
		lead: "Send proposal to",
		desc: "Share pricing and onboarding details",
	},
	task: {
		label: "Task",
		dot: "#fb7185",
		bg: "#ffe4e8",
		fg: "#e0455a",
		lead: "Review contract for",
		desc: "Check terms before sending",
	},
} as const satisfies Record<
	ActivityTypeKey,
	{
		label: string;
		dot: string;
		bg: string;
		fg: string;
		lead: string;
		desc: string;
	}
>;

const OWN_ROT = [
	"Rahul Kumar",
	"Rahul Kumar",
	"Priya Sen",
	"Ananya Das",
] as const;

const PEOPLE = [
	["Rahul Shah", "Acme Technologies"],
	["Priya Mehta", "Nova Systems"],
	["David Roy", "ByteWorks"],
	["Ananya Das", "PixelGrid"],
] as const;

const CYC = [
	"call",
	"call",
	"call",
	"meeting",
	"email",
	"call",
	"task",
] as const satisfies readonly ActivityTypeKey[];

export function pad(n: number) {
	return String(n).padStart(2, "0");
}

export function dateKey(d: Date) {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(k: string) {
	const [y, m, d] = k.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number) {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
}

export function weekStart(d: Date) {
	return addDays(d, -d.getDay());
}

export function formatTime(min: number) {
	const h = Math.floor(min / 60);
	const mm = min % 60;
	return `${pad(((h + 11) % 12) + 1)}:${pad(mm)} ${h < 12 ? "AM" : "PM"}`;
}

export const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

export const DAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

export function demoToday() {
	const { year, monthIndex, day } = ACTIVITIES.demo;
	return new Date(year, monthIndex, day);
}

export function activityStatus(
	a: ActivityItem,
	todayKey: string,
): ActivityStatus {
	if (a.done) return "completed";
	if (a.date < todayKey) return "overdue";
	return "pending";
}

export function buildDemoActivities(): ActivityItem[] {
	const TODAY = demoToday();
	const acts: ActivityItem[] = [];
	let uid = 1;

	function gen(date: Date, count: number, done: number) {
		for (let i = 0; i < count; i++) {
			const t = CYC[i % CYC.length];
			const [person, company] = PEOPLE[(i + date.getDate() + 3) % 4];
			acts.push({
				id: uid++,
				type: t,
				title: `${ACTIVITY_TYPE_META[t].lead} ${person}`,
				desc: ACTIVITY_TYPE_META[t].desc,
				company,
				owner: OWN_ROT[(i + date.getDate() + 3) % 4],
				date: dateKey(date),
				min: 630 + i * 40,
				done: i < done,
			});
		}
	}

	gen(TODAY, 12, 8);
	(
		[
			[21, 2, 2],
			[22, 3, 2],
			[23, 2, 1],
			[24, 4, 3],
			[26, 3, 0],
			[27, 2, 0],
		] as const
	).forEach(([d, c, n]) => gen(new Date(2025, 8, d), c, n));
	(
		[
			[29, 3],
			[31, 3],
			[33, 2],
			[36, 2],
		] as const
	).forEach(([d, c]) => gen(addDays(new Date(2025, 8, 1), d - 1), c, 0));
	[11, 12, 14, 15, 17, 18].forEach((d) => gen(new Date(2025, 8, d), 1, 1));
	for (let i = 0; i < 64; i++) {
		gen(new Date(2025, 7, 1 + (i % 31)), 1, 1);
	}

	return acts;
}

export function initials(name: string) {
	return name
		.split(" ")
		.map((w) => w[0])
		.join("");
}
