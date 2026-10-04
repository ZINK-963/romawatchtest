const crypto = require("crypto");
const store = require("../db/store");

async function findUser(users, id) {
  return users.find((u) => u.id === id);
}

function publicProfile(user) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name || "",
    email: user.email || "",
    createdAt: user.createdAt,
    addresses: user.addresses || [],
  };
}

async function getProfile(req, res, next) {
  try {
    const users = await store.read("users", []);
    const user = await findUser(users, req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: "کاربر پیدا نشد." });
    res.json({ ok: true, user: publicProfile(user) });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, email } = req.body || {};
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ ok: false, error: "ایمیل معتبر نیست." });
    }
    const users = await store.read("users", []);
    const user = await findUser(users, req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: "کاربر پیدا نشد." });

    if (typeof name === "string") user.name = name.trim().slice(0, 80);
    if (typeof email === "string") user.email = email.trim().slice(0, 120);

    await store.write("users", users);
    res.json({ ok: true, user: publicProfile(user) });
  } catch (err) {
    next(err);
  }
}

function validateAddress(body) {
  const errors = [];
  const required = { title: "عنوان آدرس", province: "استان", city: "شهر", address: "آدرس کامل", postalCode: "کد پستی", receiverPhone: "شماره تماس گیرنده" };
  for (const [key, label] of Object.entries(required)) {
    if (!body[key] || !String(body[key]).trim()) errors.push(`${label} الزامی است.`);
  }
  const maxLengths = { title: 40, province: 50, city: 50, address: 300 };
  for (const [key, max] of Object.entries(maxLengths)) {
    if (body[key] && String(body[key]).trim().length > max) {
      errors.push(`${required[key]} نمی‌تونه بیشتر از ${max} کاراکتر باشه.`);
    }
  }
  if (body.postalCode && !/^\d{10}$/.test(String(body.postalCode).trim())) {
    errors.push("کد پستی باید ۱۰ رقم باشد.");
  }
  if (body.receiverPhone && !/^09\d{9}$/.test(String(body.receiverPhone).trim())) {
    errors.push("شماره تماس گیرنده معتبر نیست.");
  }
  return errors;
}

async function listAddresses(req, res, next) {
  try {
    const users = await store.read("users", []);
    const user = await findUser(users, req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: "کاربر پیدا نشد." });
    res.json({ ok: true, addresses: user.addresses || [] });
  } catch (err) {
    next(err);
  }
}

async function addAddress(req, res, next) {
  try {
    const errors = validateAddress(req.body || {});
    if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

    const users = await store.read("users", []);
    const user = await findUser(users, req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: "کاربر پیدا نشد." });

    if (!user.addresses) user.addresses = [];
    const addr = {
      id: crypto.randomUUID(),
      title: String(req.body.title).trim(),
      province: String(req.body.province).trim(),
      city: String(req.body.city).trim(),
      address: String(req.body.address).trim(),
      postalCode: String(req.body.postalCode).trim(),
      receiverPhone: String(req.body.receiverPhone).trim(),
      createdAt: new Date().toISOString(),
    };
    user.addresses.push(addr);
    await store.write("users", users);
    res.status(201).json({ ok: true, address: addr, addresses: user.addresses });
  } catch (err) {
    next(err);
  }
}

async function updateAddress(req, res, next) {
  try {
    const users = await store.read("users", []);
    const user = await findUser(users, req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: "کاربر پیدا نشد." });

    const addr = (user.addresses || []).find((a) => a.id === req.params.addressId);
    if (!addr) return res.status(404).json({ ok: false, error: "آدرس پیدا نشد." });

    const merged = { ...addr, ...req.body };
    const errors = validateAddress(merged);
    if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

    Object.assign(addr, {
      title: String(merged.title).trim(),
      province: String(merged.province).trim(),
      city: String(merged.city).trim(),
      address: String(merged.address).trim(),
      postalCode: String(merged.postalCode).trim(),
      receiverPhone: String(merged.receiverPhone).trim(),
    });

    await store.write("users", users);
    res.json({ ok: true, address: addr, addresses: user.addresses });
  } catch (err) {
    next(err);
  }
}

async function deleteAddress(req, res, next) {
  try {
    const users = await store.read("users", []);
    const user = await findUser(users, req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: "کاربر پیدا نشد." });

    const before = (user.addresses || []).length;
    user.addresses = (user.addresses || []).filter((a) => a.id !== req.params.addressId);
    if (user.addresses.length === before) {
      return res.status(404).json({ ok: false, error: "آدرس پیدا نشد." });
    }
    await store.write("users", users);
    res.json({ ok: true, addresses: user.addresses });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
};
