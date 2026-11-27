import re

from .aaptor import GCC, IT_SERVICES, PRODUCT


def _rx(words: str) -> re.Pattern:
    return re.compile(rf"\b(?:{words})\b", re.I)


ENTERPRISE = _rx(r"banking|bank|insurance|nbfc|financial services|bfsi|manufactur\w+|retail|pharma\w*|"
                 r"automotive|telecom\w*|logistics|energy|utilities|conglomerate|fmcg|healthcare provider")
COLLEGE = _rx(r"engineering college|institute of (?:technology|engineering|management)|college of engineering|"
              r"deemed (?:to be )?university|autonomous college|university|polytechnic|"
              r"training (?:and|&) placement|placement cell")
LEARNING_TEAM = _rx(r"learning (?:and|&) development|l&d|talent development|employee (?:training|upskilling|"
                    r"learning|development)|learning academy|corporate university|capability building|"
                    r"technical academy")
SKILLING = _rx(r"skill development (?:mission|corporation|council|centre|center)|sector skill council|nsdc|"
               r"skilling (?:mission|programmes?|programs?|initiative)|csr (?:initiative|programmes?|programs?)|"
               r"skill india")

SIGNALS = [
    ("plans upskilling", _rx(r"upskill\w*|reskill\w*|cross-?skill\w*|learning (?:and|&) development|l&d|"
                             r"training programs? for (?:our )?(?:employees|engineers|teams|staff)|"
                             r"employee (?:training|development)|learning academy|corporate university|"
                             r"capability building"), 3),
    ("uses a training provider", _rx(r"simplilearn|upgrad|great learning|coursera|udemy business|"
                                     r"udemy for business|pluralsight|linkedin learning|niit|edureka|scaler|"
                                     r"skillsoft|degreed|o'reilly learning|jigsaw academy|intellipaat"), 3),
    ("moving to AI or cloud", _rx(r"ai transformation|ai adoption|generative ai (?:initiative|strategy|adoption|"
                                  r"programme|program)|digital transformation|cloud migration|ai-first|"
                                  r"cent(?:re|er) of excellence|coe"), 2),
    ("college: industry ties", _rx(r"industry[- ]academia|industry interface|industry (?:connect|partnership)|"
                                   r"mou with|value[- ]added courses?|skill development (?:cell|centre|center)|"
                                   r"placement training|finishing school|naac|nba accredit\w*|nirf"), 2),
    ("large workforce", _rx(r"\d{1,3}(?:,\d{3})+\+? (?:employees|professionals|engineers|associates)|"
                            r"\d{3,}\+? (?:engineers|developers|employees|professionals|associates)"), 2),
    ("new centre or expansion", _rx(r"new (?:office|centre|center|campus|development cent(?:re|er)|delivery cent(?:re|er))|"
                                    r"expan(?:d|ds|ding|sion) (?:to|in|into) india|inaugurat\w+|"
                                    r"global capability cent(?:re|er)"), 2),
]

JOB_LABEL = "hiring trainers or L&D"
JOB = _rx(r"trainer|instructor|learning|l&d|training|instructional design\w*|faculty|content developer|"
          r"academy|capability|enablement")

TITLE_ATOMS = (
    r"co-?founders?|founders?|ceo|chief executive officer|cto|chief technology officer|coo|"
    r"managing director|director|owner|president|"
    r"chief learning officer|clo|chro|chief human resources officer|chief people officer|"
    r"head of (?:l&d|learning|learning (?:and|&) development|training|talent development|capability|academy|"
    r"people|hr|human resources|engineering|technology)|"
    r"l&d (?:head|manager|lead|director|partner|specialist)|"
    r"learning (?:and|&) development (?:head|manager|lead|director|partner)|"
    r"training (?:head|manager|director|lead)|talent development (?:head|manager|lead)|"
    r"hr (?:head|director|business partner)|vp,? (?:of )?(?:hr|people|learning|engineering|technology)|"
    r"principal|dean|vice[- ]chancellor|pro[- ]vice[- ]chancellor|registrar|"
    r"head of (?:the )?department|hod|training (?:and|&) placement officer|placement officer|tpo"
)
PRIORITY = [
    (re.compile(r"chief learning|\bclo\b|head of (?:l&d|learning|training|talent development|capability|academy)|"
                r"chro|chief human|chief people|founder|ceo|chief executive|principal|vice[- ]chancellor|"
                r"managing director", re.I), 0),
    (re.compile(r"l&d|learning|training|talent development|hr|dean|hod|head of (?:the )?department|placement|"
                r"tpo|registrar|cto|chief technology|vp", re.I), 1),
]
SEARCH_TITLES = ('("head of L&D" OR "learning and development" OR CHRO OR "chief learning officer" OR '
                 'principal OR dean OR "training and placement officer")')

SOURCE_POINTS = {"competitors": 4, "funding": 3, "directory": 2}
SEED_POINTS = 2
SIGNAL_WORDS = re.compile(r"\b(?:upskill|reskill|l&d|learning and development|training|academy|"
                          r"capability|simplilearn|upgrad|great learning|coursera|pluralsight|edureka|"
                          r"ai transformation|digital transformation|capability cent|industry[- ]academia|"
                          r"placement|naac|nba)", re.I)

TOPICS = ["IT services company", "global capability centre", "software company",
          "product engineering company", "BFSI technology centre", "engineering college",
          "autonomous engineering college", "private university", "deemed university",
          "skill development mission", "corporate training partner"]
MAPS_TOPICS = ["IT company", "software company", "engineering college", "university",
               "institute of technology"]

COMPETITOR_FILE = "kanonkode_competitors.csv"
DIRECTORY_FILE = "kanonkode_directories.csv"
SEED_DIR = "seeds_kanonkode"

UNBLOCK = {"tcs.com", "infosys.com", "wipro.com", "accenture.com", "deloitte.com", "cisco.com", "dell.com",
           "hp.com", "ibm.com", "oracle.com", "sap.com", "samsung.com", "intel.com", "amd.com", "adobe.com",
           "salesforce.com"}
ALLOW_EDU = True
ALLOW_GOV = True

SEARCH_SKIP = {
    "simplilearn.com", "upgrad.com", "mygreatlearning.com", "greatlearning.in", "coursera.org",
    "udemy.com", "business.udemy.com", "pluralsight.com", "linkedin.com", "niit.com", "edureka.co",
    "scaler.com", "skillsoft.com", "degreed.com", "oreilly.com", "jigsawacademy.com", "intellipaat.com",
    "kanonkode.com", "shiksha.com", "collegedunia.com", "careers360.com", "collegedekho.com",
    "nirfindia.org", "aicte-india.org", "ugc.gov.in", "getmyuni.com", "naukri.com", "indeed.co.in",
    "shine.com", "monsterindia.com", "internshala.com", "unstop.com",
}
