const { getDb } = require('./mongo');
const { todayKey } = require('./send-limits');

async function getDailyPostRuns(ownerId, date = todayKey()) {
  const row = await getDb().collection('daily_post_search_stats').findOne({ ownerId, date });
  return { ownerId, date, runCount: Number(row?.runCount || 0) };
}

async function recordPostRun(ownerId, date = todayKey()) {
  await getDb().collection('daily_post_search_stats').updateOne(
    { ownerId, date },
    { $inc: { runCount: 1 }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  return getDailyPostRuns(ownerId, date);
}

module.exports = { getDailyPostRuns, recordPostRun };
