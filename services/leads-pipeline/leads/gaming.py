import re


def _rx(words: str) -> re.Pattern:
    return re.compile(rf"\b(?:{words})\b", re.I)


ESPORTS = _rx(r"e-?sports?|esports (?:league|tournaments?|organi[sz](?:er|ation)s?|events?|production)|"
              r"gaming tournaments?|game tournaments?|tournament organi[sz]ers?|online qualifiers?|"
              r"lan (?:party|parties|events?|tournaments?)|college (?:esports|gaming) leagues?|"
              r"bgmi|valorant|free fire|counter-?strike|cs2|dota ?2?|league of legends|"
              r"call of duty mobile|codm|pubg|fortnite|rocket league|tekken")
COMMUNITY = _rx(r"gaming communit(?:y|ies)|gamer communit(?:y|ies)|gaming clubs?|gaming clans?|"
                r"discord (?:servers?|communit(?:y|ies))|game jams?|gaming creators?|"
                r"community tournaments?|gaming network|gamers? hub")
CAFE = _rx(r"gaming caf(?:e|é)s?|gaming lounges?|gaming zones?|gaming arenas?|gaming centres?|"
           r"gaming centers?|esports arenas?|lan cent(?:re|er)s?|cyber caf(?:e|é)s?|vr arcades?|"
           r"gaming parlou?rs?")
STUDIO = _rx(r"game studio|games studio|gaming studio|game development|game developers?|"
             r"indie games?|indie studio|mobile games?|pc games?|console games?|video games?|"
             r"game art|co-?development|unreal engine|unity3d|unity developers?|godot")
STUDIO_SHORT = _rx(STUDIO.pattern[len(r"\b(?:"):-len(r")\b")] + r"|games|gaming")
CLOUD = _rx(r"cloud gaming|game streaming|pixel streaming|remote play|cloud pcs?|gaming pcs? in the cloud|"
            r"gaming as a service|game hosting|game servers?|streamed games?")
XR = _rx(r"metaverse|virtual reality|augmented reality|mixed reality|ar/vr|xr|webxr|"
         r"virtual showrooms?|digital twins?|real-?time 3d|3d configurators?")
AI = _rx(r"ai npcs?|ai (?:game|gaming)|generative (?:game|3d) (?:assets|content)|"
         r"ai-?generated (?:assets|levels|worlds)|procedural (?:generation|content)|game ai")
ACADEMY = _rx(r"game (?:design|development|art|programming) (?:academy|institute|college|school|courses?)|"
              r"(?:animation|vfx) (?:and|&) gaming (?:institute|academy|college|courses?)|"
              r"gaming (?:academy|institute|courses?)|esports academy")

SIGNALS = [
    ("streams games or desktops", _rx(r"pixel streaming|parsec|hp anyware|teradici|nvidia (?:vgpu|grid)|"
                                      r"vgpus?|cloud gaming|game streaming|moonlight|sunshine"), 3),
    ("build or shader farm", _rx(r"build farms?|incredibuild|shader compil\w*|horde|build servers?|"
                                 r"ci for (?:unreal|unity)|perforce"), 3),
    ("mentions GPUs", _rx(r"gpus?|cuda|nvidia|rtx ?[2-5]0[6-9]0|rtx|geforce|radeon"), 3),
    ("runs tournaments", _rx(r"online qualifiers?|prize pool|tournaments?|leagues?|lan events?|"
                             r"registrations? (?:open|now open)|register your team|brackets?|scrims?"), 2),
    ("remote artists or workstations", _rx(r"remote workstations?|virtual workstations?|fully remote|"
                                           r"work from anywhere|remote (?:artists?|team)|vdi"), 2),
    ("game close to launch", _rx(r"coming soon on steam|wishlist (?:now|on steam|it)|playtest|early access|"
                                 r"closed beta|open beta|beta sign-?ups?|launch trailer"), 2),
    ("rents cloud GPUs now", _rx(r"aws g[456]\w*|g4dn|g5 instances?|g6 instances?|nv-?series|"
                                 r"gpu instances?|ec2 gpu"), 2),
    ("says GPUs cost too much", _rx(r"gpu costs?|aws bills?|cloud bills?|slow builds?|expensive hardware|"
                                    r"hardware costs?"), 2),
    ("uses a game engine", _rx(r"unreal engine|unreal|unity|godot|cryengine"), 1),
    ("uses cloud", _rx(r"aws|amazon web services|google cloud|gcp|microsoft azure|azure"), 1),
]

JOB = _rx(r"devops|build engineer|build and release|technical artist|rendering|graphics|unreal|unity|"
          r"pixel streaming|it|infrastructure|platform|network|systems? admin|esports|tournament|"
          r"broadcast|production|game server|backend|3d artist|animator")

TITLE_ATOMS = (
    r"co-?founders?|founders?|ceo|chief executive officer|cto|chief technology officer|"
    r"coo|chief operating officer|managing director|general manager|director|owner|president|partner|"
    r"head of (?:esports|tournaments?|production|operations|ops|technology|tech|engineering|it|"
    r"infrastructure|infra|devops|community|events|broadcast|studio|product|gaming)|"
    r"esports (?:manager|director|head|lead)|tournament (?:director|manager|organi[sz]er|admin|lead)|"
    r"production (?:head|director|manager)|broadcast (?:director|manager|head)|"
    r"community (?:manager|head|lead)|technical director|game director|studio head|creative director|"
    r"it head|it manager|lab head|head of department|dean|principal"
)
PRIORITY = [
    (re.compile(r"founder|ceo|chief executive|owner|president|managing director|partner", re.I), 0),
    (re.compile(r"cto|chief technology|coo|chief operating|head of|esports|tournament|production|"
                r"broadcast|technical director|studio head|it head|lab head|dean", re.I), 1),
]
SEARCH_TITLES = ('(founder OR CEO OR CTO OR "head of esports" OR "tournament director" OR '
                 '"head of production" OR "technical director" OR owner)')

SOURCE_POINTS = {"funding": 3, "github": 2}
SEED_POINTS = 2
SIGNAL_WORDS = re.compile(r"\b(?:gpu|vgpu|pixel streaming|cloud gaming|game streaming|parsec|build farm|"
                          r"shader|render|unreal|unity|e-?sports|tournament|qualifier|lan (?:event|part|cent)|"
                          r"gaming caf|remote workstation|virtual workstation|cloud pc)", re.I)

TOPICS = ["esports tournament organiser", "esports company", "esports production company",
          "gaming tournament organiser", "college esports league", "BGMI tournament organiser",
          "Valorant tournament organiser", "gaming community", "game jam", "gaming cafe",
          "LAN gaming centre", "esports arena", "game development studio", "indie game studio",
          "mobile game studio", "game art outsourcing studio", "cloud gaming company",
          "game streaming platform", "pixel streaming company", "metaverse company",
          "AI gaming startup", "game development institute"]
MAPS_TOPICS = ["gaming cafe", "gaming zone", "gaming lounge", "LAN gaming centre", "esports arena",
               "VR gaming arcade", "esports company", "game development studio",
               "game development institute"]

SEARCH_SKIP = {
    "liquipedia.net", "start.gg", "smash.gg", "battlefy.com", "toornament.com", "challengermode.com",
    "faceit.com", "esl.com", "eslgaming.com", "steampowered.com", "store.steampowered.com",
    "steamcommunity.com", "itch.io", "discord.com", "discord.gg", "twitch.tv", "kick.com",
    "epicgames.com", "unrealengine.com", "unity.com", "gamedev.net", "gamedeveloper.com",
    "gamesindustry.biz", "ign.com", "kotaku.com", "polygon.com", "pcgamer.com", "sportskeeda.com",
    "afkgaming.com", "esportsinsider.com", "dotesports.com", "talkesport.com", "insidesport.in",
    "fandom.com", "play.google.com", "apps.apple.com", "krafton.com", "riotgames.com",
    "playvalorant.com", "battlegroundsmobileindia.com", "ff.garena.com", "garena.com",
}
