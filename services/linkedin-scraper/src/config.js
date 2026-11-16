require('dotenv').config();

const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'output');
const AUTH_DIR = path.join(ROOT, '.auth');
const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'storage-state.json');
const PROGRESS_PATH = path.join(OUT_DIR, 'connections-progress.json');

const HEADLESS = String(process.env.HEADLESS || 'false').toLowerCase() === 'true';
const ACTION_DELAY_MS = Math.max(500, Number(process.env.ACTION_DELAY_MS || 2500));
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS || 0);
const START_INDEX = Math.max(0, Number(process.env.START_INDEX || 0));
const SEND_MESSAGES = String(process.env.SEND_MESSAGES || 'false').toLowerCase() === 'true';
const SKIP_ALREADY_MESSAGED =
  String(process.env.SKIP_ALREADY_MESSAGED || 'true').toLowerCase() === 'true';
const FOLLOWUP_DAYS = Math.max(1, Number(process.env.FOLLOWUP_DAYS || 7));

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL || '';
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || '';

const CONNECTIONS_URL =
  process.env.CONNECTIONS_URL ||
  'https://www.linkedin.com/mynetwork/invite-connect/connections/';

const PORT = Number(process.env.PORT || 6363);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
const AI_MESSAGES = String(process.env.AI_MESSAGES || 'true').toLowerCase() === 'true';
const RAG_TTL_MS = Math.max(60_000, Number(process.env.RAG_TTL_MS || 24 * 60 * 60 * 1000)); // 1 day
const RAG_TOP_K = Math.max(1, Number(process.env.RAG_TOP_K || 4));
// Model relevanceScore gate (0–100) — not a RAG cosine floor. RAG_MIN_SCORE kept as legacy alias.
const AI_CONFIDENCE_MIN_SCORE = Math.max(
  0,
  Number(process.env.AI_CONFIDENCE_MIN_SCORE || process.env.RAG_MIN_SCORE || 60)
);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'linkedin_scrapper';
const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI || '';
const ATLAS_BACKUP_MS = Math.max(60_000, Number(process.env.ATLAS_BACKUP_MS || 60 * 60 * 1000));

// LinkedIn outbound pacing
const DAILY_SEND_LIMIT = Math.max(1, Number(process.env.DAILY_SEND_LIMIT || 60));
const SEND_BATCH_SIZE = Math.max(1, Number(process.env.SEND_BATCH_SIZE || 20));
const SEND_BATCH_PAUSE_MS = Math.max(
  0,
  Number(process.env.SEND_BATCH_PAUSE_MS || 10 * 60 * 1000)
);
const SEND_DAY_TZ = process.env.SEND_DAY_TZ || 'Asia/Kolkata';
const SECOND_MS = 1000;
const STOP_CHECK_MS = SECOND_MS;
const POST_SEARCH = {
  defaultMaxPosts: 10,
  maxPostsCap: 25,
  dailyRunLimit: Math.max(1, Number(process.env.POST_SEARCH_DAILY_RUNS || 1)),
  maxScrollRounds: 8,
  warmup: { scrolls: 2, pause: { minMs: 3 * SECOND_MS, maxMs: 7 * SECOND_MS } },
  settle: { minMs: 5 * SECOND_MS, maxMs: 10 * SECOND_MS },
  scrollPause: { minMs: 4 * SECOND_MS, maxMs: 9 * SECOND_MS },
  profilePause: { minMs: 25 * SECOND_MS, maxMs: 60 * SECOND_MS },
  minIntentScore: 60,
  maxPostChars: 1500,
  maxKeywordChars: 300,
  datePosted: ['past-24h', 'past-week', 'past-month'],
  defaultDatePosted: 'past-week',
};
const COMPANY_SEARCH = {
  defaultMaxCompanies: 20,
  maxCompaniesCap: 40,
  maxResultPages: 5,
  maxKeywordChars: 120,
  maxFilters: 10,
  dailyRunLimit: Math.max(1, Number(process.env.COMPANY_SEARCH_DAILY_RUNS || 2)),
  settle: { minMs: 4 * SECOND_MS, maxMs: 8 * SECOND_MS },
  pagePause: { minMs: 6 * SECOND_MS, maxMs: 12 * SECOND_MS },
  companyPause: { minMs: 20 * SECOND_MS, maxMs: 45 * SECOND_MS },
  maxOverviewChars: 2000,
  industries: [
    { id: '132', label: 'E-Learning' },
    { id: '105', label: 'Professional Training & Coaching' },
    { id: '69', label: 'Education Management' },
    { id: '68', label: 'Higher Education' },
    { id: '96', label: 'IT Services & IT Consulting' },
    { id: '4', label: 'Software Development' },
    { id: '6', label: 'Internet' },
    { id: '118', label: 'Computer & Network Security' },
    { id: '84', label: 'Information Services' },
    { id: '8', label: 'Telecommunications' },
    { id: '11', label: 'Management Consulting' },
    { id: '104', label: 'Staffing & Recruiting' },
    { id: '43', label: 'Financial Services' },
    { id: '41', label: 'Banking' },
    { id: '14', label: 'Hospitals & Health Care' },
    { id: '12', label: 'Biotechnology' },
    { id: '15', label: 'Pharmaceuticals' },
    { id: '70', label: 'Research' },
    { id: '80', label: 'Marketing & Advertising' },
    { id: '127', label: 'Animation' },
    { id: '109', label: 'Computer Games' },
    { id: '57', label: 'Oil & Energy' },
    { id: '48', label: 'Construction' },
    { id: '44', label: 'Real Estate' },
    { id: '116', label: 'Logistics & Supply Chain' },
    { id: '27', label: 'Retail' },
  ],
  countries: [
    { id: '104305776', label: 'United Arab Emirates', match: ['united arab emirates', 'uae', 'dubai', 'abu dhabi', 'sharjah', 'ajman'] },
    { id: '100459316', label: 'Saudi Arabia', match: ['saudi arabia', 'riyadh', 'jeddah', 'dammam', 'khobar'] },
    { id: '104170880', label: 'Qatar', match: ['qatar', 'doha'] },
    { id: '103239229', label: 'Kuwait', match: ['kuwait'] },
    { id: '100425729', label: 'Bahrain', match: ['bahrain', 'manama'] },
    { id: '103619019', label: 'Oman', match: ['oman', 'muscat'] },
    { id: '102713980', label: 'India', match: ['india'] },
    { id: '102454443', label: 'Singapore', match: ['singapore'] },
    { id: '106808692', label: 'Malaysia', match: ['malaysia', 'kuala lumpur'] },
    { id: '102478259', label: 'Indonesia', match: ['indonesia', 'jakarta'] },
    { id: '105146118', label: 'Thailand', match: ['thailand', 'bangkok'] },
    { id: '101165590', label: 'United Kingdom', match: ['united kingdom', 'england', 'london', 'scotland', 'wales'] },
    { id: '103644278', label: 'United States', match: ['united states', 'usa'] },
  ],
};
const SCRAPER_USERS = {
  header: 'x-crm-user-id',
  fallback: 'local',
  idPattern: /^[A-Za-z0-9_-]{1,64}$/,
};
const MESSAGE_TEMPLATE = {
  maxChars: 2000,
  placeholders: ['firstName', 'name', 'company', 'title', 'location'],
  fallbacks: { firstName: 'there', name: '', company: 'your organisation', title: 'your role', location: 'your area' },
};

module.exports = {
  ROOT,
  OUT_DIR,
  AUTH_DIR,
  STORAGE_STATE_PATH,
  PROGRESS_PATH,
  HEADLESS,
  ACTION_DELAY_MS,
  STOP_CHECK_MS,
  POST_SEARCH,
  COMPANY_SEARCH,
  MESSAGE_TEMPLATE,
  SCRAPER_USERS,
  MAX_CONNECTIONS,
  START_INDEX,
  SEND_MESSAGES,
  SKIP_ALREADY_MESSAGED,
  FOLLOWUP_DAYS,
  LINKEDIN_EMAIL,
  LINKEDIN_PASSWORD,
  CONNECTIONS_URL,
  LOGIN_URL: 'https://www.linkedin.com/login',
  FEED_URL: 'https://www.linkedin.com/feed/',
  PORT,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  ANTHROPIC_API_KEY,
  CLAUDE_MODEL,
  AI_MESSAGES,
  RAG_TTL_MS,
  RAG_TOP_K,
  AI_CONFIDENCE_MIN_SCORE,
  /** @deprecated use AI_CONFIDENCE_MIN_SCORE */
  RAG_MIN_SCORE: AI_CONFIDENCE_MIN_SCORE,
  MONGODB_URI,
  MONGODB_DB,
  MONGODB_ATLAS_URI,
  ATLAS_BACKUP_MS,
  DAILY_SEND_LIMIT,
  SEND_BATCH_SIZE,
  SEND_BATCH_PAUSE_MS,
  SEND_DAY_TZ,
};