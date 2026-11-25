const { MESSAGE_TEMPLATE } = require('./config');
const { firstName } = require('./utils');
const { cleanCompanyName, companyFromAtPhrase } = require('./profile');

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

function normalizeTemplate(raw) {
  const template = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!template) return '';
  if (template.length > MESSAGE_TEMPLATE.maxChars) {
    throw new Error(`Keep the template under ${MESSAGE_TEMPLATE.maxChars} characters`);
  }
  const unknown = [...template.matchAll(PLACEHOLDER_RE)]
    .map((match) => match[1])
    .filter((name) => !MESSAGE_TEMPLATE.placeholders.includes(name));
  if (unknown.length) {
    throw new Error(
      `Unknown placeholder {{${unknown[0]}}}. Use ${MESSAGE_TEMPLATE.placeholders.map((p) => `{{${p}}}`).join(', ')}`
    );
  }
  return template;
}

function templateValues(profile) {
  const company =
    cleanCompanyName(profile.company || '') || companyFromAtPhrase(profile.jobTitle || profile.headline || '');
  return {
    firstName: firstName(profile.name),
    name: String(profile.name || '').trim(),
    company,
    title: String(profile.jobTitle || '').trim(),
    location: String(profile.location || '').trim(),
  };
}

function renderTemplate(template, profile) {
  const values = templateValues(profile);
  return template.replace(PLACEHOLDER_RE, (_match, name) => values[name] || MESSAGE_TEMPLATE.fallbacks[name] || '');
}

module.exports = { normalizeTemplate, renderTemplate };
