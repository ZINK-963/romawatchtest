const store = require("../db/store");
const { ORDER_STATUS } = require("../constants");
const { sendOrderStatusSms } = require("../services/sms.service");

async function listOrders(req, res, next) {
  try {
    const orders = await store.read("orders", []);
    const { status } = req.query;
    let list = orders;
    if (status && Object.values(ORDER_STATUS).includes(status)) {
      list = list.filter((o) => o.status === status);
    }
    list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ ok: true, orders: list });
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const orders = await store.read("orders", []);
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "سفارش پیدا نشد." });
    res.json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!Object.values(ORDER_STATUS).includes(status)) {
      return res.status(400).json({ ok: false, error: "وضعیت نامعتبره." });
    }
    const orders = await store.read("orders", []);
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "سفارش پیدا نشد." });

    order.status = status;
    order.updatedAt = new Date().toISOString();
    await store.write("orders", orders);

    sendOrderStatusSms(order.customer.phone, order).catch((err) =>
      console.error("ROMA order-status SMS (admin update) failed:", err.message)
    );

    res.json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

// آمار خیلی ساده برای بالای پنل مدیریت
async function stats(req, res, next) {
  try {
    const orders = await store.read("orders", []);
    const revenue = orders
      .filter((o) => [ORDER_STATUS.PAID, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED].includes(o.status))
      .reduce((sum, o) => sum + o.total, 0);
    res.json({
      ok: true,
      stats: {
        totalOrders: orders.length,
        pendingPayment: orders.filter((o) => o.status === ORDER_STATUS.PENDING_PAYMENT).length,
        paidOrProcessing: orders.filter((o) => [ORDER_STATUS.PAID, ORDER_STATUS.PROCESSING].includes(o.status)).length,
        revenue,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listOrders, getOrder, updateOrderStatus, stats };
