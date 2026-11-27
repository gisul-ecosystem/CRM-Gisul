import re


def _rx(words: str) -> re.Pattern:
    return re.compile(rf"\b(?:{words})\b", re.I)


IT_SERVICES = _rx(r"it services|software services|it consulting|technology consulting|it solutions company|"
                  r"software development (?:company|services)|offshore (?:development|delivery)|it outsourcing|"
                  r"digital transformation (?:services|partner|company)|system integrators?|managed it services|"
                  r"application development services")
GCC = _rx(r"global capability cent(?:re|er)s?|global in-house cent(?:re|er)s?|offshore development cent(?:re|er)s?|"
          r"india development cent(?:re|er)|global delivery cent(?:re|er)s?|global technology cent(?:re|er)|"
          r"captive (?:centre|center|unit)|engineering cent(?:re|er) in india|technology cent(?:re|er) in india")
STAFFING = _rx(r"staffing (?:company|firm|agency|services|solutions)|it staffing|recruitment (?:agency|firm|company|"
               r"services|solutions|consultants?)|rpo|recruitment process outsourcing|talent acquisition (?:services|"
               r"partner|solutions)|executive search|manpower (?:services|consultancy|consultants)|"
               r"placement (?:agency|consultancy|consultants)|hiring partner")
PRODUCT = _rx(r"saas|software products?|product company|product engineering|b2b software|cloud-native platform|"
              r"enterprise software|developer platform")
CAMPUS = _rx(r"training (?:and|&) placement|placement cell|placement (?:office|department|cell)|"
             r"campus (?:recruitment|placements?)|engineering college|institute of (?:technology|engineering)|"
             r"college of engineering|deemed (?:to be )?university|autonomous college")
EDTECH = _rx(r"coding bootcamps?|bootcamps?|coding school|edtech|upskilling platform|job[- ]ready programs?|"
             r"pay after placement|income share agreement|placement guarantee")
WORKFORCE = _rx(r"learning (?:and|&) development|talent management|skills? (?:assessment|mapping|gap analysis)|"
                r"competency (?:mapping|framework)|workforce (?:planning|development)|internal mobility")

SIGNALS = [
    ("uses an assessment tool", _rx(r"hackerrank|hackerearth|mettl|mercer mettl|imocha|codility|testgorilla|xobin|"
                                    r"talview|coderbyte|codesignal|glider\.?ai|hirevue|wheebox|amcat|cocubes|"
                                    r"elitmus|interviewbit"), 3),
    ("hiring at volume", _rx(r"walk-?in (?:drive|interviews?)|hiring drive|bulk hiring|mass hiring|hiring freshers|"
                             r"freshers? (?:hiring|drive|recruitment)|campus (?:drive|hiring|recruitment)|"
                             r"off-?campus (?:drive|hiring)|graduate (?:hiring|programs?)|trainee programs?|"
                             r"we(?:'re| are) hiring|open positions|current openings|join our growing team"), 3),
    ("screens with tests", _rx(r"online (?:assessments?|tests?)|coding (?:tests?|assessments?|rounds?|challenges?)|"
                               r"aptitude tests?|technical (?:screening|assessments?|tests?)|proctored|"
                               r"pre-employment (?:tests?|assessments?)|hackathons?"), 2),
    ("new centre or expansion", _rx(r"new (?:office|centre|center|campus|development cent(?:re|er)|delivery cent(?:re|er))|"
                                    r"expan(?:d|ds|ding|sion) (?:to|in|into) india|inaugurat\w+|"
                                    r"global capability cent(?:re|er)"), 2),
    ("large tech team", _rx(r"\d{1,3}(?:,\d{3})+\+? (?:engineers|developers|employees|professionals|consultants)|"
                            r"\d{3,}\+? (?:engineers|developers|employees|professionals|consultants)"), 2),
    ("raised funding", _rx(r"series [a-e]|raised \$?\d|funding round|seed round|pre-series"), 1),
]

JOB_LABEL = "hiring tech roles"
JOB = _rx(r"engineer|developer|sde|software|devops|data|qa|tester|analyst|intern|trainee|graduate|fresher|"
          r"recruiter|talent acquisition|full stack|frontend|backend|java|python|cloud")

TITLE_ATOMS = (
    r"co-?founders?|founders?|ceo|chief executive officer|cto|chief technology officer|coo|chief operating officer|"
    r"managing director|director|owner|partner|president|"
    r"chro|chief human resources officer|chief people officer|chief talent officer|"
    r"head of (?:talent acquisition|ta|recruitment|recruiting|hiring|hr|human resources|people|"
    r"campus (?:hiring|recruitment|relations)|engineering|l&d|learning)|"
    r"talent acquisition (?:head|lead|manager|director|partner|specialist)|"
    r"recruitment (?:head|manager|lead|director)|recruiting (?:manager|lead)|"
    r"hr (?:head|director|manager|business partner)|"
    r"vp,? (?:of )?(?:hr|human resources|people|talent|engineering)|"
    r"campus (?:hiring|recruitment) (?:lead|manager)|engineering manager|"
    r"training (?:and|&) placement officer|placement officer|tpo|principal|dean"
)
PRIORITY = [
    (re.compile(r"founder|ceo|chief executive|chro|chief human|chief people|chief talent|"
                r"head of (?:talent|ta|recruit|hiring|hr|human|people|campus)|vp,? (?:of )?(?:hr|human|people|talent)|"
                r"managing director|owner|president|partner", re.I), 0),
    (re.compile(r"talent acquisition|recruit|hr|placement|tpo|principal|dean|cto|chief technology|"
                r"engineering manager|head of engineering|coo", re.I), 1),
]
SEARCH_TITLES = ('(CHRO OR "head of talent acquisition" OR "talent acquisition manager" OR "HR head" OR '
                 '"recruitment head" OR founder OR CEO OR "placement officer")')

SOURCE_POINTS = {"competitors": 4, "funding": 3, "directory": 2}
SEED_POINTS = 2
SIGNAL_WORDS = re.compile(r"\b(?:hiring|freshers?|campus|walk-?in|assessment|coding test|aptitude|recruit|"
                          r"talent acquisition|placement|hackerrank|hackerearth|mettl|imocha|codility|testgorilla|"
                          r"talview|codesignal|capability cent|offshore development|staffing|rpo)", re.I)

TOPICS = ["IT services company", "software development company", "IT consulting company",
          "global capability centre", "offshore development centre", "IT staffing company",
          "IT recruitment agency", "RPO company", "SaaS company", "product engineering company",
          "engineering college", "autonomous engineering college", "coding bootcamp",
          "campus hiring drive", "walk-in drive for freshers"]
MAPS_TOPICS = ["IT company", "software company", "IT services company", "recruitment agency",
               "staffing agency", "placement consultancy", "engineering college"]

COMPETITOR_FILE = "aaptor_competitors.csv"
DIRECTORY_FILE = "aaptor_directories.csv"
SEED_DIR = "seeds_aaptor"

UNBLOCK = {"tcs.com", "infosys.com", "wipro.com", "accenture.com", "deloitte.com", "cisco.com", "dell.com",
           "hp.com", "ibm.com", "oracle.com", "sap.com", "samsung.com", "intel.com", "amd.com", "adobe.com",
           "salesforce.com"}
ALLOW_EDU = True
ALLOW_GOV = False

SEARCH_SKIP = {
    "hackerrank.com", "hackerearth.com", "mettl.com", "imocha.io", "codility.com", "testgorilla.com",
    "xobin.com", "talview.com", "coderbyte.com", "codesignal.com", "glider.ai", "hirevue.com",
    "wheebox.com", "amcat.com", "cocubes.com", "elitmus.com", "interviewbit.com", "aaptor.com",
    "shine.com", "monsterindia.com", "instahyre.com", "hirist.tech", "cutshort.io", "iimjobs.com",
    "timesjobs.com", "freshersworld.com", "internshala.com", "unstop.com", "apna.co", "workindia.in",
    "shiksha.com", "collegedunia.com", "careers360.com", "collegedekho.com", "nirfindia.org",
    "aicte-india.org", "ugc.gov.in", "getmyuni.com", "jobsforher.com", "naukri.com", "indeed.co.in",
}
