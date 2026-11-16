import type { LeadCategory } from "@crm/validation/lead-origin";

export const GISUL = [
	"## Who is writing",
	"Gisul Software Services, Bengaluru. 100+ active clients across India, USA, UAE, Malaysia, Singapore and South Africa.",
	"- Racko (racko.ai): managed private cloud and IaaS. Bare metal, VM provisioning, dedicated CPU and GPU compute, remote infrastructure management. Gisul owns the hardware; it does not resell AWS or Azure. 30,000+ CPUs provisioned across EdTech and AI clients, 286 TB storage, 193 active services.",
	"- KanonKode (kanonkode.com): enterprise tech upskilling. AI literacy, GCC leadership development, embedded systems, applied L&D, delivered virtually and in person.",
	"- Aaptor (aaptor.com): AI candidate assessment and interview automation. Voice AI interviews, live proctoring, skill assessments.",
].join("\n");

export const PROOF_BY_REGION = [
	"## Client references (pick the one closest to the reader's country and industry; never open with India clients for a reader outside India)",
	"- India EdTech / training: Manipal Global Education, upGrad, TeamLease, Unext, Edforce, Jigsaw Academy, Intellipaat, CloudThat",
	"- India enterprise tech: Dassault Systèmes, Sigmoid, Graymatter, StratiformAI. India BFSI: FinCare Small Finance Bank",
	"- UAE / Gulf: TechMantra Gulf (anchor), SIG Combibloc Obeikan FZCO",
	"- Singapore: Aventis Learning Group (anchor), Changi Group, National Insurance Singapore",
	"- Malaysia: RHB Bank, PTPTN Malaysia, DB Solve, Virtual Calibre Sdn Bhd",
	"- USA: Y&L Consulting, Kalopsee Services, Meridian Technology Solutions, PBI Lab",
	"- South Africa: Praxis Computing",
	"- No close match: say 30,000+ CPUs run for EdTech and enterprise clients across Asia and the Middle East.",
].join("\n");

export const CATEGORY_BRIEF = {
	gpu: [
		"## Why we are writing (GPU lead)",
		"An early-stage company whose work runs on GPUs: AI/ML training or inference, VFX and animation, game development, drug discovery, video analytics, AR/VR or 3D.",
		"Pitch Racko dedicated GPU and bare-metal compute: hardware Gisul owns, predictable monthly cost instead of hourly hyperscaler bills, no noisy neighbours, set up for their workload. Tie it to what the signal says they build.",
		"Ask a small question about their current GPU setup or what slows their training or rendering.",
	].join("\n"),
	training: [
		"## Why we are writing (training lead)",
		"An organisation that teaches hands-on technical courses: an IT training institute, an EdTech or upskilling platform, a university or a corporate L&D team.",
		"Pitch Racko lab VMs: a ready lab environment per learner for cloud, DevOps, cybersecurity, data and AI courses, spun up for each batch and torn down after, on hardware Gisul owns. Mention KanonKode only if they also run corporate upskilling.",
		"Ask how they run labs for their learners today.",
	].join("\n"),
	competitors: [
		"## Why we are writing (competitor client)",
		"A company that already uses another cloud or compute provider; we found them in that provider's case study or testimonial.",
		"Pitch Racko as an alternative for the same workload: dedicated hardware Gisul owns, lower and predictable cost, direct engineering support. Never name or criticise their current provider; say 'your current setup'.",
		"Ask whether a cost or performance comparison for one workload would be useful.",
	].join("\n"),
} as const satisfies Record<LeadCategory, string>;
