"""Rules for the training profile: organisations that need VMs for training labs and courses
(online upskilling platforms, IT training institutes, colleges and universities, corporate
training teams). Everything specific to this profile lives here; the GPU profile's rules are
untouched. Tune the words and weights here.
"""
import re


def _rx(words: str) -> re.Pattern:
    return re.compile(rf"\b(?:{words})\b", re.I)


# ---------------------------------------------------------------- kinds of organisation (segments)
UPSKILLING = _rx(r"ed-?tech|upskilling|reskilling|online courses?|online programs?|online programmes?|"
                 r"bootcamps?|e-?learning|online learning|learning platform|skilling|online certifications?|"
                 r"certification (?:courses?|programs?|programmes?)|pg (?:diploma|certificate|programs?)|"
                 r"executive (?:education|programs?)|career (?:tracks?|programs?)|cohort[- ]based|"
                 r"live online (?:classes|courses|training)|job[- ](?:guarantee|assistance)|placement assistance")
INSTITUTE = _rx(r"training institutes?|training (?:centre|center)s?|it training|software training|"
                r"classroom training|instructor[- ]led training|authori[sz]ed (?:training )?(?:partner|centre|center)|"
                r"training partners?|certification training|technical training|training academy|"
                r"(?:cloud|devops|linux|networking|cyber ?security|data science) (?:training|academy|institute)")
UNIVERSITY = _rx(r"universit(?:y|ies)|deemed to be university|engineering colleges?|institute of technology|"
                 r"online degrees?|distance (?:education|learning)|centre for (?:online|distance) (?:learning|education)|"
                 r"college of engineering|school of (?:engineering|computing|computer science)")
CORPORATE = _rx(r"corporate training|learning (?:and|&) development|l&d|employee (?:training|upskilling)|"
                r"talent development|fresher training|campus to corporate|hire[- ]train[- ]deploy|"
                r"enterprise (?:learning|training)|workforce (?:training|upskilling)")

# Courses that need a machine per learner: the organisation must teach at least one of these.
LAB_TOPICS = _rx(r"cloud computing|aws|amazon web services|azure|gcp|google cloud|devops|kubernetes|docker|"
                 r"linux|red hat|rhce|rhcsa|cyber ?security|ethical hacking|penetration testing|soc analyst|"
                 r"data science|data analytics|data engineering|machine learning|artificial intelligence|"
                 r"deep learning|generative ai|full[- ]stack|web development|software (?:development|testing)|"
                 r"python|java|networking|ccna|ccnp|salesforce|sap|power bi|tableau|big data|hadoop|spark|"
                 r"blockchain|iot|embedded systems|vlsi|mlops|terraform|ansible|jenkins|automation testing|selenium")


def teaches_lab_topics(text: str) -> bool:
    return bool(LAB_TOPICS.search(text or ""))


# ---------------------------------------------------------------- buying signals (intent)
SIGNALS = [
    ("offers hands-on / virtual labs", _rx(r"hands[- ]on labs?|virtual labs?|cloud labs?|practice labs?|live labs?|"
                                          r"lab environments?|lab access|sandbox(?:es)?|lab sessions?|lab exercises?|"
                                          r"guided labs?|labs? for (?:every|each) (?:learner|student)"), 3),
    ("teaches lab-heavy courses", LAB_TOPICS, 2),
    ("projects / capstones", _rx(r"capstone projects?|industry projects?|live projects?|real[- ]world projects?|"
                                 r"hands[- ]on projects?|project[- ]based learning"), 2),
    ("runs batches / cohorts", _rx(r"new batch(?:es)?|upcoming batch(?:es)?|next batch|batch starts?|cohorts?|"
                                   r"weekend batch(?:es)?|enrol(?:l)? now|admissions? (?:open|closing)|apply now"), 1),
    ("certification programmes", _rx(r"certification (?:training|courses?|programs?|programmes?)|aws certified|"
                                     r"azure (?:certification|certified)|red hat certified|ccna|ceh|comptia|"
                                     r"kubernetes (?:certification|cka|ckad)|pg (?:diploma|certificate)"), 1),
    ("delivers online", _rx(r"online (?:classes|training|programs?|programmes?|degrees?)|live online|"
                            r"instructor[- ]led online|remote learning|lms"), 1),
    # evidence against: they already run or buy a lab platform
    ("already has a lab platform", _rx(r"powered by (?:cloudlabs|skillable|kodekloud|whizlabs|qwiklabs|instruqt)|"
                                       r"our (?:own )?lab platform|in[- ]house lab platform"), -2),
]
JOB = _rx(r"lab|labs|trainer|instructor|faculty|teaching assistant|mentor|technical support|it support|"
          r"system admin(?:istrator)?|sysadmin|devops|cloud|infrastructure|academic|learning experience")

# ---------------------------------------------------------------- decision makers
TITLE_ATOMS = (
    r"co-?founders?|founders?|ceo|chief executive officer|cto|chief technology officer|coo|"
    r"chief operating officer|chief learning officer|clo|chief academic officer|managing director|"
    r"director|executive director|program(?:me)? director|academic director|director of (?:training|academics|"
    r"learning|programs?|programmes?|operations|technology|it)|"
    r"head of (?:training|academics?|learning|l&d|learning (?:and|&) development|operations|academic operations|"
    r"delivery|programs?|programmes?|partnerships|alliances|technology|it|content|learning experience|"
    r"department|school)|"
    r"academic head|training (?:head|manager|director|lead)|l&d (?:head|manager)|"
    r"learning (?:and|&) development (?:head|manager)|program(?:me)? (?:head|manager)|"
    r"(?:centre|center) (?:head|manager|director)|principal|dean|hod|vice[- ]chancellor|pro[- ]vice[- ]chancellor|"
    r"registrar|president|owner"
)
PRIORITY = [
    (re.compile(r"founder|ceo|chief executive|owner|managing director|vice[- ]chancellor|president|principal|"
                r"chief learning|chief academic|executive director|^director$", re.I), 0),
    (re.compile(r"head of (?:training|academic|learning|l&d|delivery|programs?|programmes?|technology|it|partnerships)|"
                r"academic (?:head|director)|program(?:me)? director|training (?:head|director)|l&d head|cto|"
                r"chief technology|dean|hod|director of", re.I), 1),
]
# public search for people (people_search.py)
SEARCH_TITLES = ('(founder OR director OR CEO OR "head of training" OR "academic head" OR '
                 '"program director" OR "head of learning")')

# ---------------------------------------------------------------- scoring
SOURCE_POINTS = {"directory": 3, "funding": 3, "incubator": 2, "github": 2}
SEED_POINTS = 2
SIGNAL_WORDS = re.compile(r"lab|hands[- ]on|upskill|bootcamp|certification|training|course|cohort|"
                          r"edtech|ed-tech|learning platform|online degree", re.I)


# ---------------------------------------------------------------- size (small & medium only)
# A site that says any of these is a large organisation and is dropped (SMALL_ONLY=1, default).
MAX_LEARNERS, MAX_CENTRES, MAX_STAFF = 50_000, 10, 300
_MULT = {"k": 1e3, "thousand": 1e3, "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5, "million": 1e6,
         "mn": 1e6, "m": 1e6, "cr": 1e7, "crore": 1e7, "crores": 1e7}
_NUM = r"(\d{1,3}(?:[,.]\d{2,3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|million|mn|m|cr|crores?)?\s*\+?"
LEARNERS_RE = re.compile(_NUM + r"\s*(?:happy |satisfied |successful )?(?:learners|students|alumni|"
                         r"professionals(?: trained)?|candidates trained|students trained|careers transformed)\b", re.I)
CENTRES_RE = re.compile(r"(\d+)\s*\+?\s*(?:training |learning )?(?:centres|centers|branches|campuses|"
                        r"offices|locations|cities)\b", re.I)
STAFF_RE = re.compile(_NUM + r"\s*(?:employees|staff members|team members|people strong|strong team)\b", re.I)
LISTED_RE = re.compile(r"\binvestor relations\b|\blisted on (?:the )?(?:nse|bse)\b|\b(?:nse|bse)\s*:\s*[a-z]+|"
                       r"\bannual reports?\b|\bshareholder", re.I)


def _amount(num: str, unit: str) -> float:
    return float(num.replace(",", "")) * _MULT.get((unit or "").lower(), 1)  # "12,00,000" / "1.5" lakh


def size_verdict(text: str) -> str:
    """'' (small / medium, or no sign) or the reason it is large, e.g. 'large: 10 lakh learners'."""
    text = text or ""
    for m in LEARNERS_RE.finditer(text):
        if _amount(m.group(1), m.group(2)) > MAX_LEARNERS:
            return f"large: {m.group(0).strip()}"
    for m in CENTRES_RE.finditer(text):
        if int(m.group(1)) > MAX_CENTRES:
            return f"large: {m.group(0).strip()}"
    for m in STAFF_RE.finditer(text):
        if _amount(m.group(1), m.group(2)) > MAX_STAFF:
            return f"large: {m.group(0).strip()}"
    m = LISTED_RE.search(text)
    return f"large: {m.group(0).strip()}" if m else ""


# ---------------------------------------------------------------- search-based discovery
# "<topic> in <city>" through the Brave Search API (sources/search.py); each query once.
CITIES = ["Bengaluru", "Hyderabad", "Pune", "Chennai", "Mumbai", "Delhi", "Noida", "Gurgaon", "Kolkata",
          "Ahmedabad", "Kochi", "Coimbatore", "Jaipur", "Chandigarh", "Indore", "Lucknow", "Nagpur",
          "Bhubaneswar", "Visakhapatnam", "Thiruvananthapuram", "Mysuru", "Vadodara", "Surat", "Bhopal", "Mangaluru"]
TOPICS = ["DevOps training institute", "AWS training institute", "Azure training institute",
          "cloud computing course", "data science training institute", "cyber security training institute",
          "ethical hacking course", "Linux training institute", "full stack developer course",
          "Python training institute", "CCNA networking training", "software testing training institute",
          "Kubernetes training", "machine learning course"]
# Results from these are listings, social media, marketplaces or large brands, not small institutes.
SEARCH_SKIP = {
    "justdial.com", "sulekha.com", "urbanpro.com", "indiamart.com", "quora.com", "reddit.com", "youtube.com",
    "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "glassdoor.co.in", "glassdoor.com",
    "ambitionbox.com", "naukri.com", "indeed.com", "shiksha.com", "collegedunia.com", "careers360.com",
    "collegedekho.com", "coursera.org", "udemy.com", "edx.org", "wikipedia.org", "medium.com", "blogspot.com",
    "wordpress.com", "google.com", "yelp.com", "trustpilot.com", "classcentral.com", "skillshare.com",
    "simplilearn.com", "upgrad.com", "greatlearning.in", "mygreatlearning.com", "edureka.co", "intellipaat.com",
    "scaler.com", "niit.com", "aptech-worldwide.com", "koenig-solutions.com", "byjus.com", "unacademy.com",
    "amazon.com", "amazon.in", "microsoft.com", "aws.amazon.com", "redhat.com", "cisco.com", "oracle.com",
    "geeksforgeeks.org", "w3schools.com", "tutorialspoint.com", "javatpoint.com", "slideshare.net",
    "jobs.lever.co", "internshala.com", "foundit.in", "timesjobs.com", "magicbricks.com", "zaubacorp.com",
    "tofler.in", "economictimes.indiatimes.com", "thehindu.com", "indiatoday.in", "hindustantimes.com",
}
