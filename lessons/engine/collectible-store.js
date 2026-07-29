export const XP_PER_NODE = 100;

export const COLLECTIBLE_GIFTS = [
  { id: "start", requiredXp: 300, name: "Huy hiệu Khởi Hành", glyph: "✦" },
  { id: "bronze", requiredXp: 700, name: "Phiếu Quà Đồng", glyph: "◆" },
  { id: "choice", requiredXp: 1200, name: "Phiếu Chọn Quà", glyph: "◇" },
  { id: "silver", requiredXp: 1800, name: "Phiếu Quà Bạc", glyph: "❖" },
  { id: "gold", requiredXp: 2500, name: "Phiếu Quà Vàng", glyph: "★" },
];

export const collectibleAwardKey = (track, nodeId) => `magicdust.collectible.award.${track}.${nodeId}`;
export const collectibleGiftKey = giftId => `magicdust.collectible.gift.${giftId}`;
export const COLLECTIBLE_LAST_ACTIVITY_KEY = "magicdust.collectible.lastActivityAt";

function validReward(reward) {
  return reward
    && typeof reward.track === "string"
    && reward.track.length > 0
    && Number.isInteger(reward.nodeId)
    && Number.isFinite(reward.xp)
    && reward.xp > 0;
}

function readAward(storage, reward) {
  const raw = storage.getItem(collectibleAwardKey(reward.track, reward.nodeId));
  if (!raw) return null;
  if (raw === "1") return { xp: reward.xp, dust: 0, at: 0 };
  try { return JSON.parse(raw); } catch { return { xp: reward.xp, dust: 0, at: 0 }; }
}

export function momentumDust(storage, now = Date.now()) {
  const last = Number(storage.getItem(COLLECTIBLE_LAST_ACTIVITY_KEY));
  if (!Number.isFinite(last) || last <= 0) return { dust: 20, daysAway: null, label: "Lần học đầu tiên" };
  const daysAway = Math.max(0, Math.floor((now - last) / 86_400_000));
  if (daysAway <= 3) return { dust: 30, daysAway, label: "Portal đang sáng mạnh" };
  if (daysAway <= 7) return { dust: 20, daysAway, label: "Portal còn ấm" };
  if (daysAway <= 14) return { dust: 10, daysAway, label: "Portal đang nguội" };
  return { dust: 0, daysAway, label: "Portal cần được nạp lại" };
}

export function awardSagaXp(storage, reward, { now = Date.now(), retroactive = false } = {}) {
  if (!validReward(reward)) return { awarded: false, reason: "invalid-reward" };
  if (readAward(storage, reward)) return { awarded: false, reason: "already-awarded", xp: reward.xp };
  const momentum = retroactive ? { dust: 0, daysAway: null, label: "Đồng bộ tiến độ cũ" } : momentumDust(storage, now);
  storage.setItem(collectibleAwardKey(reward.track, reward.nodeId), JSON.stringify({ xp: reward.xp, dust: momentum.dust, at: now }));
  if (!retroactive) storage.setItem(COLLECTIBLE_LAST_ACTIVITY_KEY, String(now));
  return { awarded: true, xp: reward.xp, dust: momentum.dust, momentum, collectible: reward.collectible || null };
}

export function syncCompletedRewards(storage, records) {
  const newlyAwarded = [];
  for (const record of records) {
    if (storage.getItem(record.completionKey) !== "1") continue;
    const result = awardSagaXp(storage, record, { retroactive: true });
    if (result.awarded) newlyAwarded.push(record);
  }
  return newlyAwarded;
}

export function collectibleSnapshot(storage, records) {
  const earned = records.filter(record => readAward(storage, record));
  const totalXp = earned.reduce((sum, record) => sum + record.xp, 0);
  const totalDust = earned.reduce((sum, record) => sum + (Number(readAward(storage, record)?.dust) || 0), 0);
  const gifts = COLLECTIBLE_GIFTS.map(gift => ({
    ...gift,
    unlocked: totalXp >= gift.requiredXp,
    code: storage.getItem(collectibleGiftKey(gift.id)),
  }));
  return { totalXp, totalDust, earned, gifts };
}

function voucherSuffix(cryptoSource) {
  const bytes = new Uint8Array(3);
  cryptoSource.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(36).padStart(2, "0")).join("").toUpperCase();
}

export function claimCollectibleGift(storage, giftId, totalXp, cryptoSource = globalThis.crypto) {
  const gift = COLLECTIBLE_GIFTS.find(item => item.id === giftId);
  if (!gift) return { claimed: false, reason: "unknown-gift" };
  if (totalXp < gift.requiredXp) return { claimed: false, reason: "not-enough-xp", gift };
  const key = collectibleGiftKey(gift.id);
  const existing = storage.getItem(key);
  if (existing) return { claimed: false, reason: "already-claimed", gift, code: existing };
  if (!cryptoSource?.getRandomValues) return { claimed: false, reason: "no-random-source", gift };
  const code = `KOTO-${gift.id.toUpperCase()}-${voucherSuffix(cryptoSource)}`;
  storage.setItem(key, code);
  return { claimed: true, gift, code };
}
