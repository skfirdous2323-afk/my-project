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

    // Check if response is JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Invalid response from translation API");
    }

    const data = await res.json();
    return data.translatedText || text;
  } catch (err) {
    console.error("❌ Translation error:", err);
    return text; // fallback: return original text
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

    // 🧠 Detect user intent
    const isBestProductQuery =
      userMessage.includes("best") ||
      userMessage.includes("top") ||
      userMessage.includes("popular") ||
      userMessage.includes("trending");

    const isLowToHigh = userMessage.includes("low to high");
    const isHighToLow = userMessage.includes("high to low");
    const isDiscount = userMessage.includes("discount") || userMessage.includes("offer");
    const isGift = userMessage.includes("gift");
    const isRandom = userMessage.includes("random") || userMessage.includes("surprise");

    // Extract price number if mentioned
    const priceMatch = userMessage.match(/\d+/);
    const priceLimit = priceMatch ? parseInt(priceMatch[0]) : null;

    // Detect category (e.g., kitchen, decor, etc.)
    const categoryKeywords = ["kitchen", "decor", "cleaner", "home", "office"];
    const detectedCategory = categoryKeywords.find((c) => userMessage.includes(c));

    // 🛍️ Fetch all products from Shopify
    const shopifyRes = await fetch(`${process.env.SHOPIFY_API_URL}/products.json`, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
      },
    });

    const data = await shopifyRes.json();
    if (!data.products) return res.json({ reply: "❌ No products found." });

    let products = data.products.map((p) => {
      const variant = p.variants[0];
      return {
        title: p.title,
        price: parseFloat(variant.price),
        image: p.images?.[0]?.src || "",
        link: `https://${process.env.SHOPIFY_STORE_URL}/products/${p.handle}`,
        available: variant.available,
        updated_at: p.updated_at,
        tags: p.tags?.toLowerCase() || "",
      };
    });

    // ✅ Apply filters
    if (priceLimit) {
      products = products.filter((p) => p.price <= priceLimit);
    }

    if (detectedCategory) {
      products = products.filter((p) =>
        p.tags.includes(detectedCategory) || p.title.toLowerCase().includes(detectedCategory)
      );
    }

    if (isDiscount) {
      products = products.filter((p) => p.tags.includes("discount") || p.tags.includes("offer"));
    }

    if (isBestProductQuery) {
      products.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    if (isLowToHigh) {
      products.sort((a, b) => a.price - b.price);
    } else if (isHighToLow) {
      products.sort((a, b) => b.price - a.price);
    }

    // Show only first 5 for clean output (pagination base)
    products = products.slice(0, 5);

    // Random suggestion
    if (isRandom && products.length > 0) {
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      products = [randomProduct];
    }

    // If no products
    if (products.length === 0) {
      return res.json({
        reply:
          "😔 Sorry, no matching products found.\nTry another keyword or check our best deals 🔥",
      });
    }

    // 🖼️ Create formatted reply
    let reply = "";

    if (isGift) {
      reply += "🎁 Here are some products perfect for gifting:\n\n";
    } else if (isBestProductQuery) {
      reply += "🌟 Our most popular & trending picks:\n\n";
    } else if (isDiscount) {
      reply += "💸 Products currently on discount:\n\n";
    } else {
      reply += "🛍️ Here are some products matching your request:\n\n";
    }

    for (const p of products) {
      reply += `✨ *${p.title}*\n💰 Price: ₹${p.price}\n🔗 ${p.link}\n`;
      if (!p.available) reply += `⚠️ Currently Out of Stock\n`;
      reply += `\n`;
    }

    // Smart fallback message if too generic query
    if (userMessage.trim().length < 3) {
      reply = "🤔 Could you please specify what type of product you're looking for?";
    }



   res.json({
  reply: "Check this product",
  products: products.map(p => ({
    title: p.title,
    price: p.price,
    link: p.link,
    image: p.image
  }))
});


  } catch (err) {
    console.error("🧨 Product search error:", err);
    res.status(500).json({ error: "Server error" });
  }
});





// ✅ Order Tracking Route (Enhanced)
app.post("/track", async (req, res) => {
  const mobile = req.body.mobile?.trim();

  if (!mobile) {
    return res.status(400).json({ error: "❌ Type only mobile number" });
  }

  try {
    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2025-01/orders.json?status=any`,
      {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    const orders = data.orders || [];

    // ✅ Allow partial match of mobile number (e.g., last 4 digits)
    const matchedOrders = orders.filter(
      (o) =>
        o.phone?.includes(mobile) ||
        o.shipping_address?.phone?.includes(mobile) ||
        o.note?.includes(mobile)
    );

    if (matchedOrders.length === 0) {
      return res.json({ message: "❌ No order found for this mobile number" });
    }

    // 🧠 Prepare AI-style reply for all matching orders
    let reply = `📱 Found ${matchedOrders.length} order(s) linked to this mobile:\n\n`;

    for (const order of matchedOrders) {
      let status = "Processing ⏳";
      if (order.fulfillment_status === "fulfilled") status = "Delivered ✅";
      else if (order.fulfillment_status === "partial") status = "Partially Shipped 📦";
      else if (order.fulfillment_status === "restocked") status = "Returned 🔁";
      else if (order.fulfillment_status === "pending") status = "Pending 🚀";

      // 🗓️ Calculate estimated delivery (3–5 days after created_at)
      const created = new Date(order.created_at);
      const deliveryDate = new Date(created);
      deliveryDate.setDate(created.getDate() + 4);
      const estDelivery = deliveryDate.toLocaleDateString("en-IN");

      reply += `🆔 Order #${order.id}\n👤 ${
        order.shipping_address?.name || "Customer"
      }\n💰 Total: ₹${order.total_price}\n📦 Status: ${status}\n🚚 Est. Delivery: ${estDelivery}\n🔗 Track: ${
        order.order_status_url || "Not available"
      }\n\n`;
    }

    // ✅ Return combined friendly reply
    res.json({ message: reply });
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


// ✅ Super-Smart Router for Xefere Store
app.post("/smart", async (req, res) => {
  let userMessage = req.body.message || "";

  try {
let userMessage = req.body.message || "";

try {
  // 🌍 Try translating to English
  userMessage = await translateText(userMessage, "en");
} catch (err) {
  console.error("❌ Translation error:", err);
  // Translation fail ho jaye to original message use karo
  userMessage = req.body.message || "";
}
    const SHOPIFY_API_URL =
      process.env.SHOPIFY_API_URL ||
      `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`;

    // 🎯 Detect intent using OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
            You are a super-smart Shopify chatbot intent detector for Xefere Store.
            Detect intent even if spelling is wrong, partial info is given, or message is in mixed language.
            Respond ONLY with one word: track, product, faq, or chat.
          `,
        },
        { role: "user", content: userMessage },
      ],
    });

    let intent =
      completion.choices?.[0]?.message?.content?.trim().toLowerCase() || "chat";

    console.log("🧭 AI detected intent:", intent);

    let finalReply = "";

    // ✅ Track Order
    if (intent === "track") {
      const trackRes = await fetch(`${process.env.BASE_URL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: userMessage.replace(/\D/g, "") }),
      });
      const data = await trackRes.json();
      finalReply = data.message || data.error || "Could not fetch tracking info.";
    }

    // ✅ Product
    else if (intent === "product") {
      const productRes = await fetch(`${process.env.BASE_URL}/product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await productRes.json();
      finalReply = data.reply || data.error || "No products found.";
    }

    // ✅ FAQ
    else if (intent === "faq") {
      const faqRes = await fetch(`${process.env.BASE_URL}/faq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await faqRes.json();
      finalReply = data.reply || "No FAQ found.";
    }

    // 💬 General Chat / fallback
    else {
      const chatRes = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
              You are a polite assistant for Xefere Store.
              Always respond in a friendly, emoji-rich style.
              Give fallback suggestions if user intent is unclear.
              Only discuss Xefere Store products and policies.
            `,
          },
          { role: "user", content: userMessage },
        ],
      });

      finalReply =
        chatRes.choices?.[0]?.message?.content ||
        "Sorry, I didn’t understand. Did you mean: track order, check products, or ask FAQ?";
    }

    // ✅ Return final reply
    res.json({ reply: finalReply });
  } catch (err) {
    console.error("🔥 Super-Smart Router Error:", err);
    res.status(500).json({
      error:
        "Something went wrong in smart router. Please try again or rephrase your query.",
    });
  }
});




 // ✅ Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});









