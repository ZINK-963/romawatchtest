const crypto = require("crypto");
const store = require("../db/store");
const { sendOtpSms } = require("../services/sms.service");
const { signToken } = require("../services/token.service");
const revocation = require("../services/token-revocation.service");
const { otpExpiresMs, otpMaxAttempts, otpResendCooldownMs, adminPhones } = require("../config");

const PHONE_REGEX = /^09\d{9}$/;

function generateCode() {
  return String(crypto.randomInt(10000, 99999)); // کد ۵ رقمی
}

async function sendOtp(req, res, next) {
  try {
    const phone = String(req.body?.phone || "").trim();
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ ok: false, error: "شماره تلفن معتبر نیست. مثال: 09123456789" });
    }

    const otps = await store.read("otps", {});
    const existing = otps[phone];
    if (existing && existing.lastSentAt && Date.now() - existing.lastSentAt < otpResendCooldownMs) {
      const waitSec = Math.ceil((otpResendCooldownMs - (Date.now() - existing.lastSentAt)) / 1000);
      return res.status(429).json({ ok: false, error: `لطفاً ${waitSec} ثانیه دیگه دوباره تلاش کن.` });
    }

    const code = generateCode();
    otps[phone] = { code, expiresAt: Date.now() + otpExpiresMs, attempts: 0, lastSentAt: Date.now() };
    await store.write("otps", otps);

    await sendOtpSms(phone, code);

    const payload = { ok: true, message: "کد تایید ارسال شد." };
    // فقط در حالت توسعه، برای تست راحت‌تر کد رو توی جواب هم برمی‌گردونیم
    if (process.env.NODE_ENV !== "production") payload.devCode = code;

    res.json(payload);
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const phone = String(req.body?.phone || "").trim();
    const code = String(req.body?.code || "").trim();
    if (!PHONE_REGEX.test(phone) || !code) {
      return res.status(400).json({ ok: false, error: "شماره تلفن یا کد نامعتبره." });
    }

    const otps = await store.read("otps", {});
    const record = otps[phone];
    if (!record) {
      return res.status(400).json({ ok: false, error: "کدی برای این شماره درخواست نشده. دوباره کد بگیر." });
    }
    if (Date.now() > record.expiresAt) {
      delete otps[phone];
      await store.write("otps", otps);
      return res.status(400).json({ ok: false, error: "کد منقضی شده. دوباره درخواست بده." });
    }
    if (record.attempts >= otpMaxAttempts) {
      delete otps[phone];
      await store.write("otps", otps);
      return res.status(429).json({ ok: false, error: "تعداد تلاش زیاد بود. دوباره کد جدید بگیر." });
    }
    if (record.code !== code) {
      record.attempts += 1;
      await store.write("otps", otps);
      return res.status(400).json({ ok: false, error: "کد وارد شده اشتباهه." });
    }

    // کد درسته -> پاکش کن و کاربر رو پیدا/بساز
    delete otps[phone];
    await store.write("otps", otps);

    const users = await store.read("users", []);
    let user = users.find((u) => u.phone === phone);
    if (!user) {
      user = { id: crypto.randomUUID(), phone, createdAt: new Date().toISOString() };
      users.push(user);
      await store.write("users", users);
    }

    const token = signToken(user);
    const role = adminPhones.includes(user.phone) ? "admin" : "user";
    res.json({ ok: true, token, user: { id: user.id, phone: user.phone, role } });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ ok: true, user: req.user });
}

async function logout(req, res, next) {
  try {
    if (req.tokenInfo?.jti) {
      const expiresAtMs = req.tokenInfo.exp ? req.tokenInfo.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;
      await revocation.revoke(req.tokenInfo.jti, expiresAtMs);
    }
    res.json({ ok: true, message: "با موفقیت خارج شدید." });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendOtp, verifyOtp, me, logout };
