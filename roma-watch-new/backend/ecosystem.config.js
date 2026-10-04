// راه‌اندازی با PM2 (روی VPS):
//   cd backend
//   pm2 start ecosystem.config.js --env production
//   pm2 save
//   pm2 startup      (خروجی این دستور رو اجرا کن تا PM2 بعد از ریبوت سرور خودش بالا بیاد)
//
// دستورهای مفید بعدش:
//   pm2 logs roma-backend
//   pm2 restart roma-backend
//   pm2 status

module.exports = {
  apps: [
    {
      name: "roma-backend",
      script: "server.js",
      cwd: __dirname,
      instances: 1, // چون دیتا روی فایل JSON ذخیره میشه (نه دیتابیس واقعی)، چند instance
      // همزمان می‌تونه باعث Race Condition روی فایل‌ها بشه - فعلاً همیشه ۱ بمونه.
      exec_mode: "fork",
      autorestart: true,
      watch: false, // توی production نباید فایل‌ها رو watch کنه
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      time: true,
    },
  ],
};
