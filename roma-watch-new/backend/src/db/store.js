const fs = require("fs/promises");
const path = require("path");
const { dataDir } = require("../config");

// هر فایل دیتابیس یه صف نوشتن جدا داره تا دو نوشتن همزمان رو یه فایل باعث
// خراب شدن دیتا نشه (چون fs.writeFile عملیات اتمیک نیست).
const writeQueues = new Map();

function filePath(name) {
  return path.join(dataDir, `${name}.json`);
}

async function ensureFile(name, defaultValue) {
  const file = filePath(name);
  try {
    await fs.access(file);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(defaultValue, null, 2), "utf8");
  }
}

async function read(name, defaultValue) {
  await ensureFile(name, defaultValue);
  const raw = await fs.readFile(filePath(name), "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function write(name, data) {
  const prev = writeQueues.get(name) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      await ensureFile(name, data);
      const tmp = filePath(name) + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmp, filePath(name));
    });
  writeQueues.set(name, next);
  return next;
}

module.exports = { read, write };
