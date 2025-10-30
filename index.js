// index.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const { SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN } = process.env;

// ✅ Route: Track Order by ID
app.get("/track/:orderId", async (req, res) => {
  const { orderId } = req.params;

  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/orders.json?name=#${orderId}`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!data.orders || data.orders.length === 0) {
      return res.json({ message: `No order found with ID #${orderId}` });
    }

    const order = data.orders[0];
    const status = order.fulfillment_status || "Processing";

    let reply = `🧾 Order #${orderId}\n`;
    reply += `Status: ${status}\n`;
    reply += `Total: ₹${order.current_total_price}\n`;
    reply += `Placed on: ${order.created_at}`;

    res.json({ message: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 5000}`);
});
