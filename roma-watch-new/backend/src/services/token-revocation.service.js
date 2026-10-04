const store = require("../db/store");

const FILE = "revoked_tokens";

// وقتی کاربر خروج می‌زنه، jti همون توکن اینجا ثبت میشه تا حتی اگه توکن
// هنوز از نظر زمانی منقضی نشده، دیگه قابل استفاده نباشه.
async function revoke(jti, expiresAtMs) {
  if (!jti) return;
  const list = await store.read(FILE, []);
  list.push({ jti, expiresAt: expiresAtMs });
  // پاکسازی موارد قدیمی که خودشون از نظر زمانی منقضی شدن (دیگه لازم نیست نگهشون داریم)
  const now = Date.now();
  const cleaned = list.filter((x) => x.expiresAt > now);
  await store.write(FILE, cleaned);
}

async function isRevoked(jti) {
  if (!jti) return false;
  const list = await store.read(FILE, []);
  return list.some((x) => x.jti === jti);
}

module.exports = { revoke, isRevoked };
