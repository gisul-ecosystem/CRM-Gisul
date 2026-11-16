const ACTIVITY_RE = /urn:li:(?:activity|ugcPost|share):(\d{10,})/;
const PROFILE_RE = /linkedin\.com\/in\/[^/?#]+/i;
const DATA_URL_RE = /linkedin\.com\/(?:voyager\/api|flagship-web)\//i;
const MAX_DEPTH = 40;
const MAX_NODES = 200000;

function textOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return textOf(value.text);
    if (value.text && typeof value.text === 'object') return textOf(value.text);
    if (typeof value.accessibilityText === 'string') return textOf(value.accessibilityText);
  }
  return '';
}

function profileUrlOf(actor) {
  const candidates = [
    actor?.navigationContext?.actionTarget,
    actor?.navigationUrl,
    actor?.image?.attributes?.[0]?.detailData?.actionTarget,
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string' && PROFILE_RE.test(raw)) return raw.split('?')[0];
  }
  return '';
}

function activityOf(node) {
  const fields = [
    node.entityUrn,
    node.urn,
    node.updateMetadata?.urn,
    node.metadata?.backendUrn,
    node.metadata?.shareUrn,
    node.socialDetail?.urn,
    node.socialContent?.shareUrl,
  ];
  for (const value of fields) {
    const match = typeof value === 'string' ? value.match(ACTIVITY_RE) : null;
    if (match) return `urn:li:activity:${match[1]}`;
  }
  return '';
}

function postsFromPayload(payload, maxChars) {
  const out = [];
  let visited = 0;
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || visited > MAX_NODES) return;
    visited += 1;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (node.commentary && node.actor) {
      const text = textOf(node.commentary.text ?? node.commentary);
      const authorUrl = profileUrlOf(node.actor);
      if (text.length >= 20 && authorUrl) {
        const ago = textOf(node.actor.subDescription).match(/\b(\d+\s?(?:mo|[smhdwy]))\b/i);
        out.push({
          urn: activityOf(node),
          authorUrl,
          authorName: textOf(node.actor.name).split(' • ')[0],
          authorHeadline: textOf(node.actor.description),
          postedAgo: ago ? ago[1].replace(/\s/g, '') : '',
          text: text.slice(0, maxChars),
        });
      }
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') walk(value, depth + 1);
    }
  };
  walk(payload, 0);
  return out;
}

function watchPostData(page, maxChars) {
  const posts = [];
  const stats = { dataResponses: 0, jsonResponses: 0, otherResponses: 0, failures: 0 };
  const onResponse = async (response) => {
    const url = response.url();
    if (!DATA_URL_RE.test(url)) return;
    stats.dataResponses += 1;
    const type = String(response.headers()['content-type'] || '');
    if (!/json/i.test(type)) {
      stats.otherResponses += 1;
      return;
    }
    try {
      const payload = await response.json();
      stats.jsonResponses += 1;
      posts.push(...postsFromPayload(payload, maxChars));
    } catch {
      stats.failures += 1;
    }
  };
  page.on('response', onResponse);
  return {
    posts,
    stats,
    stop: () => page.off('response', onResponse),
  };
}

module.exports = { postsFromPayload, watchPostData };
