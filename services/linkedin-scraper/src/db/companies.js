const { getDb } = require('./mongo');

const COLLECTION = 'companies';
const LIST_FIELDS = [
  'name', 'industry', 'companySize', 'headquarters', 'country', 'website', 'founded',
  'companyType', 'specialties', 'followers', 'tagline', 'overview', 'linkedinUrl',
  'employeesOnLinkedIn', 'phone', 'search', 'foundAt', 'scrapedAt',
];

async function knownCompanySlugs(ownerId) {
  const rows = await getDb()
    .collection(COLLECTION)
    .find({ ownerId }, { projection: { slug: 1 } })
    .toArray();
  return new Set(rows.map((row) => row.slug));
}

async function upsertCompany(ownerId, record, search) {
  const now = new Date();
  await getDb().collection(COLLECTION).updateOne(
    { ownerId, slug: record.slug },
    {
      $set: { ...record, ownerId, search, scrapedAt: now },
      $setOnInsert: { foundAt: now },
    },
    { upsert: true }
  );
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listCompanies(ownerId, { q = '', country = '', industry = '', limit = 50, skip = 0 } = {}) {
  const filter = { ownerId };
  if (country) filter.country = country;
  if (industry) filter.industry = industry;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { industry: rx }, { headquarters: rx }, { specialties: rx }, { website: rx }];
  }
  const collection = getDb().collection(COLLECTION);
  const projection = Object.fromEntries([['_id', 0], ['slug', 1], ...LIST_FIELDS.map((f) => [f, 1])]);
  const [rows, total, countries, industries] = await Promise.all([
    collection.find(filter, { projection }).sort({ foundAt: -1, name: 1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
    collection.distinct('country', { ownerId }),
    collection.distinct('industry', { ownerId }),
  ]);
  return {
    companies: rows,
    total,
    countries: countries.filter(Boolean).sort(),
    industries: industries.filter(Boolean).sort(),
  };
}

async function allCompanies(ownerId) {
  return getDb().collection(COLLECTION).find({ ownerId }, { projection: { _id: 0 } }).sort({ foundAt: -1 }).toArray();
}

module.exports = { knownCompanySlugs, upsertCompany, listCompanies, allCompanies };
