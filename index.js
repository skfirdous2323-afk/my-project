import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// ✅ Test Route
app.get("/api/info", (req, res) => {
  res.json({
    success: true,
    message: "✅ Shopify Backend is Live!",
    time: new Date().toLocaleString(),
  });
});

// ✅ Orders Route
app.get("/orders", async (req, res) => {
  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE_URL}/admin/api/2025-01/orders.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ✅ Single Product Route
app.post("/product", async (req, res) => {
  const query = req.body.message?.toLowerCase() || "";
  try {
    const shopifyRes = await fetch(
      `https://${SHOPIFY_STORE_URL}/admin/api/2025-01/products.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await shopifyRes.json();
    const products = data.products || [];

    const product = products.find((p) =>
      p.title.toLowerCase().includes(query)
    );

    if (!product) {
      return res.json({ error: "❌ Product not found" });
    }

    res.json({
      title: product.title,
      price: product.variants[0].price,
      image: product.image?.src || "No image",
      link: `https://${SHOPIFY_STORE_URL}/products/${product.handle}`,
    });
  } catch (err) {
    console.error("Error fetching Shopify product:", err);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

// ✅ NEW: Order Tracking Route (via Mobile Number)
app.post("/track", async (req, res) => {
  const mobile = req.body.mobile?.trim();

  if (!mobile) {
    return res.status(400).json({ error: "❌ Mobile number is required" });
  }

  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE_URL}/admin/api/2025-01/orders.json?status=any`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    const orders = data.orders || [];

    // Find order by mobile number (in phone or shipping address)
    const order = orders.find(
      (o) =>
        o.phone?.includes(mobile) ||
        o.shipping_address?.phone?.includes(mobile) ||
        o.note?.includes(mobile)
    );

    if (!order) {
      return res.json({ message: "❌ No order found for this mobile number" });
    }

    let status = "Processing ⏳";
    if (order.fulfillment_status === "fulfilled") status = "Delivered ✅";
    else if (order.fulfillment_status === "partial") status = "Partially Shipped 📦";
    else if (order.fulfillment_status === "restocked") status = "Returned 🔁";
    else if (order.fulfillment_status === "pending") status = "Pending 🚀";

    res.json({
      message: `📦 Order #${order.id} for ${order.shipping_address?.name || "Customer"} is ${status}`,
      order_total: `${order.total_price} ${order.currency}`,
      order_status: order.fulfillment_status,
      estimated_delivery: order.created_at
        ? new Date(order.created_at).toLocaleDateString()
        : "N/A",
      order_link: order.order_status_url || null,
    });
  } catch (error) {
    console.error("Error tracking order:", error);
    res.status(500).json({ error: "Failed to track order" });
  }
});
// ✅ Order Tracking Route
app.post("/track", async (req, res) => {
  // ... tracking code here
});


// ✅ Auto FAQ + Return/Refund Assistant
app.post("/faq", async (req, res) => {
  const userMessage = req.body.message?.toLowerCase() || "";

  let reply = "❓ Sorry, I didn’t understand your question.";

  if (userMessage.includes("return")) {
    reply = "🔁 You can request a return within 7 days of delivery. Click here to start: https://www.xefere.store/pages/return-policy";
  } 
  else if (userMessage.includes("refund")) {
    reply = "💸 Refunds are processed within 3–5 business days after we receive your returned product.";
  } 
  else if (userMessage.includes("cancel")) {
    reply = "🛑 You can cancel your order before it is shipped. Once shipped, cancellation isn’t possible.";
  } 
  else if (userMessage.includes("track")) {
    reply = "🚚 To track your order, please provide your mobile number (e.g., type: Track 9876543210)";
  } 
  else if (userMessage.includes("exchange")) {
    reply = "🔄 Exchange is available for damaged or defective products only within 7 days of delivery.";
  } 
  else if (userMessage.includes("policy") || userMessage.includes("rules")) {
    reply = "📜 You can check our full return & refund policy here: https://www.xefere.store/pages/return-policy";
  } 
  else if (userMessage.includes("help") || userMessage.includes("support")) {
    reply = "💬 Our support team is here to help! Email us at support@xefere.store or chat with us on WhatsApp.";
  }

  res.json({ reply });
});


// ✅ Start Server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


