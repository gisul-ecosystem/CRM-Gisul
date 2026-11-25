const fs = require('fs');
const path = require('path');
const { COMPANY_SEARCH } = require('./config');
const { gotoAndSettle } = require('./connections');
const { sleepBetween } = require('./utils');

const COMPANY_PATH = /linkedin\.com\/company\/([^/?#]+)/i;
const NOT_COMPANIES = new Set(['setup', 'unavailable', 'pages']);

function companySlug(url) {
  const match = String(url || '').match(COMPANY_PATH);
  if (!match) return '';
  const slug = decodeURIComponent(match[1]).trim().toLowerCase();
  return slug && !NOT_COMPANIES.has(slug) ? slug : '';
}

function pickFilters(ids, options) {
  const known = new Map(options.map((option) => [option.id, option]));
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const option = known.get(String(id));
    if (option && !out.includes(option)) out.push(option);
  }
  return out.slice(0, COMPANY_SEARCH.maxFilters);
}

function buildCompanySearchUrl({ keywords = '', industries = [], countries = [], page = 1 }) {
  const params = new URLSearchParams();
  if (keywords) params.set('keywords', keywords);
  if (countries.length) params.set('companyHqGeo', JSON.stringify(countries.map((c) => c.id)));
  if (industries.length) params.set('industryCompanyVertical', JSON.stringify(industries.map((i) => i.id)));
  params.set('origin', 'FACETED_SEARCH');
  if (page > 1) params.set('page', String(page));
  return `https://www.linkedin.com/search/results/companies/?${params.toString()}`;
}

async function readResultCards(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('main') || document.body;
    const cards = [];
    const seen = new Set();
    for (const link of root.querySelectorAll('a[href*="/company/"]')) {
      const match = link.href.match(/linkedin\.com\/company\/([^/?#]+)/i);
      if (!match) continue;
      const slug = decodeURIComponent(match[1]).toLowerCase();
      if (seen.has(slug)) continue;
      const box = link.closest('li') || link.parentElement;
      const lines = String(box?.innerText || '')
        .split('\n')
        .map(clean)
        .filter(Boolean);
      const linkLines = String(link.innerText || '')
        .split('\n')
        .map(clean)
        .filter(Boolean);
      const name = linkLines[0] || lines[0] || '';
      if (!name) continue;
      seen.add(slug);
      const rest = lines.filter(
        (line) => line !== name && !/^follow(ing)?$/i.test(line) && !/followers?$/i.test(line)
      );
      const dotted = lines.find((line) => line.includes('•') && line !== name);
      cards.push({
        slug,
        name,
        line: dotted || (rest.length >= 2 ? `${rest[0]} • ${rest[1]}` : ''),
        followers: (lines.find((line) => /followers?$/i.test(line)) || '').replace(/\s*followers?$/i, ''),
      });
    }
    const noResults = /no results found/i.test(root.innerText || '');
    return { cards, noResults, title: document.title };
  });
}

async function readAboutPage(page) {
  return page.evaluate((maxChars) => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('main') || document.body;
    const fields = {};
    for (const dt of root.querySelectorAll('dl dt')) {
      const label = clean(dt.innerText).toLowerCase();
      const values = [];
      let el = dt.nextElementSibling;
      while (el && el.tagName === 'DD') {
        values.push(el);
        el = el.nextElementSibling;
      }
      if (!label || !values.length) continue;
      const link = values[0].querySelector('a[href]');
      fields[label] = {
        text: clean(values[0].innerText),
        extra: values.slice(1).map((v) => clean(v.innerText)).filter(Boolean),
        href: link ? link.href : '',
      };
    }

    const lines = String(root.innerText || '')
      .split('\n')
      .map(clean)
      .filter(Boolean);
    const LABELS = ['website', 'phone', 'industry', 'company size', 'headquarters', 'founded', 'specialties', 'type'];
    for (let i = 0; i < lines.length - 1; i += 1) {
      const label = lines[i].toLowerCase();
      if (LABELS.includes(label) && !fields[label]) {
        fields[label] = { text: lines[i + 1], extra: [], href: '' };
      }
    }

    let overview = '';
    const heading = Array.from(root.querySelectorAll('h2, h3')).find((h) => /^overview$/i.test(clean(h.innerText)));
    if (heading) {
      let el = heading.nextElementSibling;
      while (el && !overview) {
        overview = clean(el.innerText);
        el = el.nextElementSibling;
      }
    }

    const h1 = root.querySelector('h1');
    const top = h1 ? h1.closest('section') || h1.parentElement : null;
    const topLines = top
      ? String(top.innerText || '').split('\n').map(clean).filter(Boolean)
      : [];
    const followersLine = lines.find((line) => /\bfollowers\b/i.test(line)) || '';
    const followers = (followersLine.match(/([\d.,]+\s*[KM]?)\s+followers/i) || [])[1] || '';
    const employeesLine = lines.find((line) => /\bemployees?\b/i.test(line) && /\d/.test(line)) || '';

    return {
      name: clean(h1 ? h1.innerText : ''),
      tagline: topLines.length > 1 && topLines[1] !== topLines[0] ? topLines[1] : '',
      fields,
      overview: overview.slice(0, maxChars),
      followers: clean(followers),
      employeesLine,
      unavailable: /this page doesn.t exist|page not found/i.test(root.innerText || ''),
    };
  }, COMPANY_SEARCH.maxOverviewChars);
}

function realWebsite(field) {
  if (!field) return '';
  const raw = field.href || field.text || '';
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (/linkedin\.com$/i.test(url.hostname) && url.searchParams.get('url')) {
      return url.searchParams.get('url');
    }
    if (/linkedin\.com$/i.test(url.hostname)) return field.text && !/linkedin/i.test(field.text) ? field.text : '';
    return url.toString();
  } catch {
    return field.text || '';
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TOKEN_PATTERNS = new Map();

function tokenPattern(token) {
  if (!TOKEN_PATTERNS.has(token)) {
    TOKEN_PATTERNS.set(token, new RegExp(`(^|[^a-z])${escapeRegex(token)}($|[^a-z])`, 'i'));
  }
  return TOKEN_PATTERNS.get(token);
}

function matchedCountry(text, countries) {
  const value = String(text || '').toLowerCase().replace(/\s+/g, ' ');
  if (!value) return null;
  return countries.find((country) => country.match.some((token) => tokenPattern(token).test(value))) || null;
}

function companyRecord(card, about, search) {
  const f = about.fields;
  const value = (label) => (f[label] ? f[label].text : '');
  const sizeExtra = f['company size'] ? f['company size'].extra.join(' ') : '';
  const headquarters = value('headquarters');
  const known = search.countries.length ? search.countries : COMPANY_SEARCH.countries;
  const country = matchedCountry(headquarters, known) || matchedCountry(card.line, known);
  return {
    slug: card.slug,
    linkedinUrl: `https://www.linkedin.com/company/${card.slug}/`,
    name: about.name || card.name,
    tagline: about.tagline,
    website: realWebsite(f.website),
    phone: value('phone'),
    industry: value('industry') || (card.line.split('•')[0] || '').trim(),
    companySize: value('company size'),
    employeesOnLinkedIn: (sizeExtra.match(/[\d,]+/) || [])[0] || '',
    headquarters: headquarters || (card.line.split('•')[1] || '').trim(),
    country: country ? country.label : '',
    founded: value('founded'),
    companyType: value('type'),
    specialties: value('specialties'),
    followers: about.followers || card.followers,
    overview: about.overview,
  };
}

async function saveDebug(page, dir, log) {
  if (!dir) return;
  const shot = path.join(dir, 'company-search-debug.png');
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
  const markup = await page.content().catch(() => '');
  if (markup) await fs.promises.writeFile(path.join(dir, 'company-search-debug.html'), markup).catch(() => {});
  await log(`Company search page saved for checking: ${shot}`);
}

async function collectCompanies(
  page,
  { keywords, industries, countries, maxCompanies, known = new Set(), shouldStop = () => false, log = console.log, debugDir = '' }
) {
  const found = [];
  const seen = new Set();
  let skippedKnown = 0;
  for (let pageNo = 1; pageNo <= COMPANY_SEARCH.maxResultPages && found.length < maxCompanies; pageNo += 1) {
    if (shouldStop()) break;
    const url = buildCompanySearchUrl({ keywords, industries, countries, page: pageNo });
    await log(`Company search page ${pageNo}: ${url}`);
    await gotoAndSettle(page, url);
    await sleepBetween(COMPANY_SEARCH.settle);
    const { cards, noResults, title } = await readResultCards(page);
    if (!cards.length) {
      await log(`Page ${pageNo}: no companies (${noResults ? 'LinkedIn shows no results' : `title "${title}"`})`);
      if (pageNo === 1) await saveDebug(page, debugDir, log);
      break;
    }
    let added = 0;
    for (const card of cards) {
      if (!card.slug || seen.has(card.slug)) continue;
      seen.add(card.slug);
      if (known.has(card.slug)) {
        skippedKnown += 1;
        continue;
      }
      found.push(card);
      added += 1;
      if (found.length >= maxCompanies) break;
    }
    await log(`Page ${pageNo}: ${cards.length} companies, ${added} new`);
    if (pageNo < COMPANY_SEARCH.maxResultPages && found.length < maxCompanies) {
      await sleepBetween(COMPANY_SEARCH.pagePause);
    }
  }
  if (skippedKnown) await log(`Skipped ${skippedKnown} companies already saved`);
  return found;
}

async function scrapeCompanies(
  page,
  cards,
  search,
  { shouldStop = () => false, log = console.log, onCompany, debugDir = '' }
) {
  const strict = search.countries.length > 0;
  let kept = 0;
  let outside = 0;
  let emptyAbout = 0;
  for (let i = 0; i < cards.length; i += 1) {
    if (shouldStop()) break;
    const card = cards[i];
    if (i > 0) await sleepBetween(COMPANY_SEARCH.companyPause);
    try {
      await gotoAndSettle(page, `https://www.linkedin.com/company/${card.slug}/about/`);
      await sleepBetween(COMPANY_SEARCH.settle);
      const about = await readAboutPage(page);
      if (about.unavailable) {
        await log(`[${i + 1}/${cards.length}] ${card.name}: page not available`);
        continue;
      }
      if (!Object.keys(about.fields).length) {
        emptyAbout += 1;
        if (emptyAbout === 1 && debugDir) {
          const markup = await page.content().catch(() => '');
          if (markup) {
            await fs.promises.writeFile(path.join(debugDir, 'company-about-debug.html'), markup).catch(() => {});
          }
          await log(`About page check: no labelled fields read on ${page.url()} (saved company-about-debug.html)`);
        }
      }
      const record = companyRecord(card, about, search);
      if (strict && !record.country) {
        outside += 1;
        await log(`[${i + 1}/${cards.length}] SKIP ${record.name}: headquarters "${record.headquarters || 'unknown'}" is outside the chosen countries`);
        continue;
      }
      await onCompany(record);
      kept += 1;
      await log(
        `[${i + 1}/${cards.length}] ${record.name} | ${record.industry || 'industry ?'} | ${record.companySize || 'size ?'} | ${record.headquarters || 'HQ ?'} | ${record.website || 'no website'}`
      );
    } catch (err) {
      await log(`[${i + 1}/${cards.length}] ${card.name}: ${err.message}`);
      if (/session expired|sign-in|reconnect|blocked|checkpoint|restricted|authwall/i.test(err.message)) throw err;
    }
  }
  if (strict && outside && !kept) {
    await log('No company had its headquarters in the chosen countries. Check the country filter on LinkedIn.');
  }
  return { kept, outside };
}

module.exports = {
  buildCompanySearchUrl,
  collectCompanies,
  companyRecord,
  companySlug,
  matchedCountry,
  pickFilters,
  readAboutPage,
  readResultCards,
  realWebsite,
  scrapeCompanies,
};
