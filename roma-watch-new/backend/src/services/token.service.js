const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { jwtSecret, jwtExpiresIn, adminPhones } = require("../config");

function signToken(user) {
  const jti = crypto.randomUUID(); // شناسه یکتای این توکن، برای امکان باطل کردنش هنگام خروج
  const role = adminPhones.includes(user.phone) ? "admin" : "user";
  const token = jwt.sign({ sub: user.id, phone: user.phone, role, jti }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
  return token;
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret); // اگه نامعتبر باشه خودش خطا میده
}

module.exports = { signToken, verifyToken };
