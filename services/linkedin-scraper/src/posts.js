const fs = require('fs');
const path = require('path');
const { POST_SEARCH } = require('./config');
const { gotoAndSettle } = require('./connections');
const { sleepBetween, slugFromProfileUrl, normalizeProfileUrl } = require('./utils');

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
    const URN_RE = /urn:li:(?:activity|ugcPost|share):\d+/;
    const OWNER_LINK = 'a[href*="/in/"], a[href*="/company/"], a[href*="/school/"], a[href*="/showcase/"]';
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('main') || document.body;

    const urnOf = (el) => {
      for (const name of el.getAttributeNames()) {
        if (name === 'href') continue;
        const match = String(el.getAttribute(name)).match(URN_RE);
        if (match) return match[0];
      }
      return '';
    };

    const byUrn = new Map();
    for (const el of root.querySelectorAll('*')) {
      const urn = urnOf(el);
      if (urn && !byUrn.has(urn)) byUrn.set(urn, el);
    }
    for (const link of root.querySelectorAll('a[href*="/feed/update/"]')) {
      const match = link.href.match(URN_RE);
      if (!match || byUrn.has(match[0])) continue;
      let box = link;
      while (box.parentElement && box.parentElement !== root) {
        box = box.parentElement;
        if (box.querySelector(OWNER_LINK) && clean(box.innerText).length > 80) break;
      }
      byUrn.set(match[0], box);
    }

    const containers = [];
    for (const [urn, el] of byUrn) {
      const inner = Array.from(byUrn.values()).some((other) => other !== el && other.contains(el));
      if (!inner) containers.push([urn, el]);
    }

    const ACTIVITY_RE = /(?:activity|ugcPost|share)[-:](\d{10,})/;
    const BUTTONS = 'button, [role="button"]';
    const label = (el) => `${el.getAttribute('aria-label') || ''} ${clean(el.innerText)}`.trim();
    const isLike = (el) =>
      [el.getAttribute('aria-label') || '', clean(el.innerText)].some((value) =>
        /^(like|react|reaction)\b/i.test(value.trim())
      );
    const inSocialBar = (button) => {
      let bar = button.parentElement;
      for (let depth = 0; bar && bar !== root && depth < 6; depth += 1) {
        const labels = Array.from(bar.querySelectorAll(BUTTONS)).map(label);
        if (labels.some((l) => /^reply\b/i.test(l))) return false;
        if (labels.some((l) => /comment/i.test(l)) && labels.some((l) => /repost|share|send/i.test(l))) {
          return true;
        }
        bar = bar.parentElement;
      }
      return false;
    };
    const likeButtons = Array.from(root.querySelectorAll(BUTTONS)).filter(
      (b) => isLike(b) && inSocialBar(b)
    );
    const likesIn = (el) => likeButtons.filter((b) => el.contains(b)).length;

    if (!containers.length && likeButtons.length) {
      const boxes = new Set();
      for (const link of root.querySelectorAll('a[href*="/in/"]')) {
        let box = null;
        let el = link.parentElement;
        while (el && el !== root) {
          const count = likesIn(el);
          if (count > 1) break;
          if (count === 1) box = el;
          el = el.parentElement;
        }
        if (box) boxes.add(box);
      }
      for (const box of boxes) {
        if (Array.from(boxes).some((other) => other !== box && other.contains(box))) continue;
        let urn = '';
        for (const a of box.querySelectorAll('a[href]')) {
          const match = a.href.match(URN_RE) || a.href.match(ACTIVITY_RE);
          if (match) {
            urn = match[0].startsWith('urn:') ? match[0] : `urn:li:activity:${match[1]}`;
            break;
          }
        }
        containers.push([urn, box]);
      }
    }

    const stats = {
      title: document.title,
      urns: byUrn.size,
      containers: containers.length,
      likeButtons: likeButtons.length,
      profileLinks: root.querySelectorAll('a[href*="/in/"]').length,
      noResults: /no results found/i.test(root.innerText || ''),
    };

    const out = [];
    for (const [urn, box] of containers) {
      const ownerLinks = Array.from(box.querySelectorAll(OWNER_LINK));
      const first = ownerLinks[0];
      if (!first || !/\/in\//.test(first.getAttribute('href') || first.href)) continue;
      const ownerPath = first.pathname.replace(/\/+$/, '');
      const owner =
        ownerLinks.find((l) => l.pathname.replace(/\/+$/, '') === ownerPath && clean(l.innerText)) || first;
      const postLike = likeButtons.find((b) => box.contains(b));
      const beforeLike = (el) =>
        !postLike || Boolean(el.compareDocumentPosition(postLike) & Node.DOCUMENT_POSITION_FOLLOWING);

      const hidden = owner.querySelector('span[aria-hidden="true"]');
      const nameLines = String((hidden || owner).innerText || '')
        .split('\n')
        .map(clean)
        .filter(Boolean);
      const authorName = (nameLines[0] || '').split(' • ')[0];

      const known = box.querySelector(
        '[data-testid="expandable-text-box"], .update-components-text, .feed-shared-inline-show-more-text, .feed-shared-update-v2__description'
      );
      let text = clean(known ? known.innerText : '');
      if (!text) {
        let best = '';
        for (const el of box.querySelectorAll('[dir="ltr"], .break-words, p, span')) {
          if (ownerLinks.some((l) => l.contains(el)) || el.querySelector(BUTTONS) || !beforeLike(el)) continue;
          const value = clean(el.innerText);
          if (value.length > best.length && value.length < 4000) best = value;
        }
        text = best;
      }
      if (text.length < 20) continue;

      const headlineEl = box.querySelector('.update-components-actor__description');
      const boxText = clean(box.innerText);
      const ago = boxText.match(/\b(\d+\s?(?:mo|[smhdwy]))\s*•/i);

      out.push({
        urn,
        authorUrl: owner.href,
        authorName,
        authorHeadline: clean(headlineEl ? headlineEl.innerText : nameLines[2] || ''),
        postedAgo: ago ? ago[1].replace(/\s/g, '') : '',
        text: text.slice(0, limit),
      });
    }
    return { posts: out, stats };
  }, maxChars);
}

async function collectPosts(
  page,
  { keywords, datePosted, maxPosts, shouldStop = () => false, log = console.log, debugDir = '' }
) {
  const url = buildPostSearchUrl({ keywords, datePosted });
  await log('Warm-up: reading the feed for a moment before the search');
  for (let i = 0; i < POST_SEARCH.warmup.scrolls && !shouldStop(); i += 1) {
    await page.mouse.wheel(0, 900 + Math.round(Math.random() * 900));
    await sleepBetween(POST_SEARCH.warmup.pause);
  }
  await log(`Post search: ${url}`);
  await gotoAndSettle(page, url);
  await sleepBetween(POST_SEARCH.settle);

  const posts = [];
  const seenAuthors = new Set();
  let stale = 0;
  let lastStats = null;

  for (let round = 0; round < POST_SEARCH.maxScrollRounds && posts.length < maxPosts; round += 1) {
    if (shouldStop()) break;
    const before = posts.length;
    const { posts: batch, stats } = await extractPosts(page, POST_SEARCH.maxPostChars);
    lastStats = stats;
    for (const raw of batch) {
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
        url: raw.urn
          ? `https://www.linkedin.com/feed/update/${raw.urn}/`
          : `${profileUrl}/recent-activity/all/`,
      });
      if (posts.length >= maxPosts) break;
    }
    stale = posts.length === before ? stale + 1 : 0;
    if (stale >= 3) break;
    await page.mouse.wheel(0, 1400 + Math.round(Math.random() * 1200));
    await sleepBetween(POST_SEARCH.scrollPause);
    const more = page.locator('button.scaffold-finite-scroll__load-button').first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => {});
      await sleepBetween(POST_SEARCH.scrollPause);
    }
  }

  await log(`Post search found ${posts.length} post(s) by people`);
  if (!posts.length && lastStats) {
    await log(
      `Post search page check: url=${page.url()} | title="${lastStats.title}" | post ids=${lastStats.urns} | post boxes=${lastStats.containers} | like buttons=${lastStats.likeButtons} | profile links=${lastStats.profileLinks} | "no results" shown=${lastStats.noResults}`
    );
    if (debugDir) {
      const shot = path.join(debugDir, 'post-search-debug.png');
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      await log(`Post search screenshot saved: ${shot}`);
      const html = path.join(debugDir, 'post-search-debug.html');
      const markup = await page.content().catch(() => '');
      if (markup) {
        await fs.promises.writeFile(html, markup).catch(() => {});
        await log(`Post search page saved: ${html}`);
      }
    }
  }
  return posts.slice(0, maxPosts);
}

module.exports = { buildPostSearchUrl, collectPosts };
