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

// ✅ AI Chat Route (with OpenAI API)
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim().toLowerCase() || "";

    // Keywords to check if message is shopping-related
    const shoppingKeywords = [
      "order", "product", "refund", "return", "exchange",
      "cancel", "delivery", "track", "shipping", "price",
      "discount", "offer", "payment", "store", "shop"
    ];

    const isShoppingRelated = shoppingKeywords.some((word) =>
      userMessage.includes(word)
    );

    if (!isShoppingRelated) {
      return res.json({
        reply: "❌ Sorry, I can only help with shopping, orders, returns, and tracking."
      });
    }

    // ✅ Call OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful Shopify store assistant. Only answer shopping-related questions clearly and politely."
        },
        { role: "user", content: userMessage }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content || "Sorry, I couldn’t understand that.";
    res.json({ reply });
  } catch (error) {
    console.error("🛑 OpenAI Chat Error:", error);
    res.status(500).json({ error: "AI reply failed" });
  }
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
// ✅ AI Smart Message Router
app.post("/smart", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim().toLowerCase() || "";

    // Step 1: OpenAI se samjho user ka intent
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
          You are a Shopify chatbot. 
          Based on the message, decide the intent:
          - "track" if user wants order tracking.
          - "product" if user wants product details.
          - "faq" if user asks about return/refund/policy/cancel/exchange.
          - "chat" if it's a general shopping question.
          Respond ONLY with one word: track, product, faq, or chat.
          `
        },
        { role: "user", content: userMessage }
      ]
    });

    const intent = completion.choices?.[0]?.message?.content?.trim().toLowerCase() || "chat";
    console.log("🧭 AI detected intent:", intent);

    // Step 2: Intent ke hisab se backend API call
    let finalReply = "";

    if (intent === "track") {
      const trackRes = await fetch(`${process.env.BASE_URL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: userMessage.replace(/\D/g, "") })
      });
      const data = await trackRes.json();
      finalReply = data.message || data.error || "Could not fetch tracking info.";
    }

    else if (intent === "product") {
      const productRes = await fetch(`${process.env.BASE_URL}/product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await productRes.json();
      if (data.error) finalReply = data.error;
      else
        finalReply = `🛍️ ${data.title}\n💰 ${data.price}\n🔗 ${data.link}`;
    }

    else if (intent === "faq") {
      const faqRes = await fetch(`${process.env.BASE_URL}/faq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await faqRes.json();
      finalReply = data.reply || "No FAQ found.";
    }

    else {
      // General AI chat
      const chatRes = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a polite shopping assistant for Xefere Store." },
          { role: "user", content: userMessage }
        ]
      });
      finalReply = chatRes.choices?.[0]?.message?.content || "Sorry, I didn’t get that.";
    }

    res.json({ reply: finalReply });
  } catch (err) {
    console.error("🔥 Smart Router Error:", err);
    res.status(500).json({ error: "Something went wrong in smart router." });
  }
});

// ✅ Start Server
// ✅ Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Running on Render port: ${PORT}`);
});



