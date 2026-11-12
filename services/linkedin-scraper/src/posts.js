const { POST_SEARCH } = require('./config');
const { gotoAndSettle } = require('./connections');
const { sleep, slugFromProfileUrl, normalizeProfileUrl } = require('./utils');

function buildPostSearchUrl({ keywords, datePosted }) {
  const params = new URLSearchParams();
  params.set('keywords', keywords);
  params.set('datePosted', JSON.stringify(datePosted));
  params.set('sortBy', JSON.stringify('date_posted'));
  params.set('origin', 'FACETED_SEARCH');
  return `https://www.linkedin.com/search/results/content/?${params.toString()}`;
}

async function extractPosts(page, maxChars) {
  return page.evaluate((limit) => {
    const containers = Array.from(
      document.querySelectorAll(
        'div[data-urn^="urn:li:activity"], div.feed-shared-update-v2, div[data-view-name="feed-full-update"]'
      )
    );
    const seen = new Set();
    const out = [];
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    for (const el of containers) {
      const holder = el.closest('[data-urn^="urn:li:activity"]') || el;
      const urn = holder.getAttribute('data-urn') || el.getAttribute('data-urn') || '';
      const key = urn || holder;
      if (seen.has(key)) continue;
      seen.add(key);

      const actor =
        holder.querySelector('.update-components-actor__container, .update-components-actor') || holder;
      const authorLink = Array.from(actor.querySelectorAll('a[href*="/in/"]'))[0];
      if (!authorLink) continue;

      const nameEl = actor.querySelector(
        '.update-components-actor__title span[aria-hidden="true"], .update-components-actor__name span[aria-hidden="true"]'
      );
      const headlineEl = actor.querySelector('.update-components-actor__description');
      const timeEl = actor.querySelector('.update-components-actor__sub-description');
      const textEl = holder.querySelector(
        '.update-components-text, .feed-shared-inline-show-more-text, .feed-shared-update-v2__description'
      );
      const text = clean(textEl ? textEl.innerText : '');
      if (!text) continue;

      out.push({
        urn,
        authorUrl: authorLink.href,
        authorName: clean(nameEl ? nameEl.innerText : authorLink.innerText).split(' • ')[0],
        authorHeadline: clean(headlineEl ? headlineEl.innerText : ''),
        postedAgo: (() => {
          const raw = clean(timeEl ? timeEl.innerText : '');
          const token = raw.match(/^\d+\s?(?:mo|[smhdwy])\b/i);
          return token ? token[0].replace(/\s/g, '') : raw.split('•')[0].trim();
        })(),
        text: text.slice(0, limit),
      });
    }
    return out;
  }, maxChars);
}

async function collectPosts(page, { keywords, datePosted, maxPosts, shouldStop = () => false, log = console.log }) {
  const url = buildPostSearchUrl({ keywords, datePosted });
  await log(`Post search: ${url}`);
  await gotoAndSettle(page, url);
  await sleep(POST_SEARCH.settleMs);

  const posts = [];
  const seenAuthors = new Set();
  let stale = 0;

  for (let round = 0; round < POST_SEARCH.maxScrollRounds && posts.length < maxPosts; round += 1) {
    if (shouldStop()) break;
    const before = posts.length;
    for (const raw of await extractPosts(page, POST_SEARCH.maxPostChars)) {
      const profileUrl = normalizeProfileUrl(raw.authorUrl.split('?')[0]);
      const slug = slugFromProfileUrl(profileUrl);
      if (!slug || seenAuthors.has(slug)) continue;
      seenAuthors.add(slug);
      posts.push({
        profileUrl,
        slug,
        authorName: raw.authorName,
        authorHeadline: raw.authorHeadline,
        postedAgo: raw.postedAgo,
        text: raw.text,
        url: raw.urn ? `https://www.linkedin.com/feed/update/${raw.urn}/` : '',
      });
      if (posts.length >= maxPosts) break;
    }
    stale = posts.length === before ? stale + 1 : 0;
    if (stale >= 3) break;
    await page.mouse.wheel(0, 2200);
    await sleep(POST_SEARCH.scrollPauseMs);
    const more = page.locator('button.scaffold-finite-scroll__load-button').first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => {});
      await sleep(POST_SEARCH.scrollPauseMs);
    }
  }

  await log(`Post search found ${posts.length} post(s) by people`);
  return posts.slice(0, maxPosts);
}

module.exports = { buildPostSearchUrl, collectPosts };
