import express from "express"; import cors 
from "cors"; import dotenv from "dotenv"; 
import fetch from "node-fetch"; import OpenAI 
from "openai";

// 🌍 Free Translation Function using LibreTranslate
async function translateText(text, targetLang = "en") {
  try {
    const res = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: targetLang,
        format: "text",
      }),
    });

    const data = await res.json();
    return data.translatedText;
  } catch (err) {
    console.error("❌ Translation error:", err);
    return text; // fallback if translation fails
  }
}
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

app.post("/product", async (req, res) => {
  try {
    const userMessage = req.body.message?.toLowerCase() || "";

    // 🧠 Detect if user asked for best/top products
    const isBestProductQuery =
      userMessage.includes("best") ||
      userMessage.includes("top") ||
      userMessage.includes("popular") ||
      userMessage.includes("trending");

    // Extract price number if user mentions it
    const priceMatch = userMessage.match(/\d+/);
    const priceLimit = priceMatch ? parseInt(priceMatch[0]) : null;

    // 🛍️ Fetch all products from Shopify
    const shopifyRes = await fetch(`${process.env.SHOPIFY_API_URL}/products.json`, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
      },
    });

    const data = await shopifyRes.json();
    if (!data.products) return res.json({ error: "No products found" });

    let products = data.products.map((p) => {
      const variant = p.variants[0];
      return {
        title: p.title,
        price: parseFloat(variant.price),
        image: p.images?.[0]?.src || "",
        link: `https://${process.env.SHOPIFY_STORE_URL}/products/${p.handle}`,
      };
    });

    // ✅ If price filter mentioned
    if (priceLimit) {
      products = products.filter((p) => p.price <= priceLimit);
    }

    // ✅ If user asked for best/top products
    if (isBestProductQuery) {
      // Sort by Shopify’s default “updated_at” (newest → oldest)
      products.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      products = products.slice(0, 5); // Show top 5
    }

    if (products.length === 0) {
      return res.json({ reply: "❌ Product not found" });
    }

    // 🖼️ Create reply message
reply += `🛍️ Product: ${title}\n💸 Price: ₹${price}\n🔗 Buy now: ${url}\n\n`;
    res.json({ reply });
  } catch (err) {
    console.error("Product search error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// ✅ Order Tracking Route (via Mobile Number)
app.post("/track", async (req, res) => {
  const mobile = req.body.mobile?.trim();

  if (!mobile) {
    return res.status(400).json({ error: "Type onle mobile number" });  }

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

// ✅ FAQ / Return Policy Route
app.post("/faq", async (req, res) => {
  const userMessage = req.body.message?.toLowerCase() || "";
  let reply = "❓ Sorry, I didn’t understand your question.";

  if (userMessage.includes("return")) {
    reply = "🔁 You can request a return within 7 days of delivery. Click here: https://www.xefere.store/pages/return-policy";
  } else if (userMessage.includes("refund")) {
    reply = "💸 Refunds are processed within 3–5 business days after we receive your returned product.";
  } else if (userMessage.includes("cancel")) {
    reply = "🛑 You can cancel your order before it is shipped. Once shipped, cancellation isn’t possible.";
  } else if (userMessage.includes("track")) {
    reply = "🚚 To track your order, please provide your mobile number (e.g., Track 9876543210)";
  } else if (userMessage.includes("exchange")) {
    reply = "🔄 Exchange is available for damaged or defective products only within 7 days of delivery.";
  } else if (userMessage.includes("policy") || userMessage.includes("rules")) {
    reply = "📜 You can check our full return & refund policy here: https://www.xefere.store/pages/return-policy";
  } else if (userMessage.includes("help") || userMessage.includes("support")) {
    reply = "💬 Our support team is here to help! Email us at support@xefere.store or chat with us on WhatsApp.";
  }

  res.json({ reply });
});

app.post("/smart", async (req, res) => {
  let userMessage = req.body.message || "";

// 🌍 Auto translate to English
userMessage = await translateText(userMessage, "en");
 const SHOPIFY_API_URL =
    process.env.SHOPIFY_API_URL ||
    `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`;

  try {
    // 🎯 Detect intent using OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
            You are a smart Shopify chatbot intent detector for Xefere Store.
            Only handle Xefere Store queries — never show products from other sites.
            Respond ONLY with one word: track, product, faq, or chat.
          `,
        },
        { role: "user", content: userMessage },
      ],
    });

    const intent =
      completion.choices?.[0]?.message?.content?.trim().toLowerCase() || "chat";
    console.log("🧭 AI detected intent:", intent);

    let finalReply = "";

    if (intent === "track") {
      const trackRes = await fetch(`${process.env.BASE_URL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: userMessage.replace(/\D/g, "") }),
      });
      const data = await trackRes.json();
      finalReply = data.message || data.error || "Could not fetch tracking info.";
    }

    else if (intent === "product") {
      const productRes = await fetch(`${process.env.BASE_URL}/product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await productRes.json();
      finalReply = data.reply || data.error || "No products found.";
    }

    else if (intent === "faq") {
      const faqRes = await fetch(`${process.env.BASE_URL}/faq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await faqRes.json();
      finalReply = data.reply || "No FAQ found.";
    }

    else {
      // 💬 General chat
      const chatRes = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `              You are a polite assistant for Xefere Store.
              Only discuss Xefere Store products and policies.
              Never mention other platforms like Amazon or Flipkart.
            `,
          },
          { role: "user", content: userMessage },
        ],
      });

      finalReply =
        chatRes.choices?.[0]?.message?.content || "Sorry, I didn’t get that.";
    }

    res.json({ reply: finalReply });
  } catch (err) {
    console.error("🔥 Smart Router Error:", err);
    res.status(500).json({ error: "Something went wrong in smart router." });
  }
});


 // ✅ Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});









