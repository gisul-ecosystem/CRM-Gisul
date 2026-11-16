const crypto = require('crypto');
const { BROWSER_SLOTS } = require('./config');

const byUser = new Map();
const byToken = new Map();

function slotInfo(index) {
  return {
    index,
    display: `:${BROWSER_SLOTS.firstDisplay + index}`,
    vncPort: BROWSER_SLOTS.firstVncPort + index,
    viewerPort: BROWSER_SLOTS.firstViewerPort + index,
  };
}

function release(userId) {
  const held = byUser.get(userId);
  if (!held) return;
  byToken.delete(held.token);
  byUser.delete(userId);
}

function claim(userId, activeUsers) {
  const now = Date.now();
  const held = byUser.get(userId);
  if (held) {
    held.claimedAt = now;
    return slotInfo(held.index);
  }
  const taken = new Set([...byUser.values()].map((entry) => entry.index));
  let index = -1;
  for (let i = 0; i < BROWSER_SLOTS.count; i += 1) {
    if (!taken.has(i)) {
      index = i;
      break;
    }
  }
  if (index < 0) {
    const idle = [...byUser.entries()].find(
      ([other, entry]) => !activeUsers.has(other) && now - entry.claimedAt > BROWSER_SLOTS.holdAfterClaimMs
    );
    if (!idle) return null;
    index = idle[1].index;
    release(idle[0]);
  }
  const token = crypto.randomBytes(BROWSER_SLOTS.tokenBytes).toString('hex');
  byUser.set(userId, { index, token, claimedAt: now });
  byToken.set(token, index);
  return slotInfo(index);
}

function displayFor(userId) {
  const held = byUser.get(userId);
  return held ? slotInfo(held.index).display : `:${BROWSER_SLOTS.firstDisplay}`;
}

function viewerPathFor(userId) {
  const held = byUser.get(userId);
  return held ? `websockify/${held.token}` : '';
}

function viewerPortForToken(token) {
  const index = byToken.get(String(token || ''));
  return index === undefined ? null : slotInfo(index).viewerPort;
}

function slotsInUse() {
  return byUser.size;
}

module.exports = { claim, release, displayFor, viewerPathFor, viewerPortForToken, slotsInUse, slotInfo };
