const { verifyToken } = require("../services/token.service");
const revocation = require("../services/token-revocation.service");

/**
 * این روت فقط برای کاربر لاگین‌شده کار می‌کنه.
 * توکن باید توی هدر باشه: Authorization: Bearer <token>
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ ok: false, error: "برای این عملیات باید وارد حساب کاربری بشید." });
  }
  try {
    const payload = verifyToken(token);
    if (await revocation.isRevoked(payload.jti)) {
      return res.status(401).json({ ok: false, error: "نشست شما پایان یافته، دوباره وارد بشید." });
    }
    req.user = { id: payload.sub, phone: payload.phone, role: payload.role || "user" };
    req.tokenInfo = { jti: payload.jti, exp: payload.exp };
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "نشست شما منقضی شده، دوباره وارد بشید." });
  }
}

/**
 * اگه توکن معتبر بود کاربر رو ست می‌کنه، در غیر این صورت رد نمیشه
 * (برای روت‌هایی که هم مهمان هم کاربر لاگین‌شده می‌تونن ازش استفاده کنن)
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const payload = verifyToken(token);
      if (!(await revocation.isRevoked(payload.jti))) {
        req.user = { id: payload.sub, phone: payload.phone, role: payload.role || "user" };
        req.tokenInfo = { jti: payload.jti, exp: payload.exp };
      }
    } catch {
      // توکن نامعتبر -> مثل مهمان درنظر گرفته میشه
    }
  }
  next();
}

/**
 * باید بعد از requireAuth بیاد. فقط کاربرهایی که نقش admin دارن (شماره‌شون
 * توی ADMIN_PHONES هست) اجازه‌ی عبور دارن - مثلاً برای روت‌های /api/admin/*.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "دسترسی مدیریتی لازمه." });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
