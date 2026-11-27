import type { LeadCategory } from "@crm/validation/lead-origin";

export const GISUL = [
	"## Who is writing",
	"Gisul Software Services, Bengaluru. 100+ active clients across India, USA, UAE, Malaysia, Singapore and South Africa.",
	"- Racko (racko.ai): managed private cloud and IaaS. Bare metal, VM provisioning, dedicated CPU and GPU compute, remote infrastructure management. Gisul owns the hardware; it does not resell AWS or Azure. 30,000+ CPUs provisioned across EdTech and AI clients, 286 TB storage, 193 active services.",
	"- KanonKode (kanonkode.com): live, cohort-based tech training with 1:1 mentoring and real projects in AI and machine learning, data engineering, AI-powered full stack, cloud and DevOps, and cybersecurity. For companies: role-based upskilling paths, virtual instructor-led training, hands-on labs and readiness tracking across cohorts. For colleges: curriculum integration, campus workshops, faculty development and placement preparation.",
	"- Aaptor (aaptor.com): AI skills-assessment platform for hiring and for measuring employees' skill gaps. Ready assessments in 8 areas (DSA, AI/ML, SQL, cloud, DevOps, data engineering, prompt engineering, UI/UX), AI-generated custom questions, real code execution, AI scoring, and proctoring with identity checks and anti-cheating. Campus hiring to enterprise hiring. A 30-minute demo comes with free credits to build and take assessments.",
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
	gaming: [
		"## Why we are writing (gaming lead)",
		"A gaming company that needs GPUs: an esports or tournament organiser, a gaming community or game jam, a gaming café or LAN centre, a game studio, a cloud gaming or Pixel Streaming company, or a game dev academy.",
		"Pitch Racko GPU cloud PCs and vGPU workstations on hardware Gisul owns: identical cloud PCs for online qualifiers and broadcast rigs, remote workstations for artists, build and shader farms, Pixel Streaming hosting, at a predictable monthly cost. Tie it to what the signal says they run.",
		"Ask a small question about their next tournament, build or launch, or offer a short trial environment for it.",
	].join("\n"),
	aaptor: [
		"## Why we are writing (Aaptor lead)",
		"An organisation that hires tech people at volume or must measure its staff's skills: an IT services firm, a global capability centre, a staffing or RPO firm, a software company, a college placement cell or a bootcamp. The signal says what we saw: a hiring drive, open roles, a new centre, or an assessment tool they already use.",
		"Pitch Aaptor: ready coding and technical assessments, AI scoring with a skill-gap report per candidate, and proctoring, so screening takes less time and fewer weak candidates reach interviews. Offer the 30-minute demo with free credits. Never name or criticise a tool they use now; say 'your current screening'.",
		"Ask how they screen candidates for their next hiring drive, or whether a free trial assessment for one role would help.",
	].join("\n"),
	kanonkode: [
		"## Why we are writing (KanonKode lead)",
		"An organisation that must upskill tech teams, or a college that needs industry training: an IT services firm, a global capability centre, a tech company, an enterprise moving to AI or cloud, an L&D team, or an engineering college. The signal says what we saw: an upskilling plan, an AI or cloud programme, L&D hiring, or a training provider they already use.",
		"Pitch KanonKode: live instructor-led cohorts with real projects and 1:1 mentoring in AI and machine learning, data, full stack, cloud and DevOps, and cybersecurity, with role-based paths, hands-on labs and readiness tracking. For a college, offer campus workshops, curriculum integration and placement preparation. Mention Aaptor only to measure skill gaps before or after training. Never name or criticise a provider they use now.",
		"Ask which team or skill they need to build next, or offer a short skill-gap check for one team.",
	].join("\n"),
	partners: [
		"## Why we are writing (partnership lead)",
		"A small systems integrator or software firm that recently won a government contract in AI, cloud, data or application development; the signal names the agency and the award.",
		"Offer Gisul as their delivery partner: our engineers do the build and run work under their contract and their client relationship, on Racko infrastructure where it fits. Name the award from the signal; never claim to know the contract's details beyond it.",
		"Ask whether they need delivery capacity for this contract or the next one.",
	].join("\n"),
} as const satisfies Record<LeadCategory, string>;
