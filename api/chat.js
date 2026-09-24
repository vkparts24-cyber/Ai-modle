import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Multiple Gemini API Keys Rotation Setup
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
];

let keyIndex = 0;

function getGeminiClient() {
  const apiKey = GEMINI_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % GEMINI_KEYS.length;
  return new GoogleGenerativeAI(apiKey);
}

export default async function handler(req, res) {
  // CORS Headers set karein taaki app/web request block na ho
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // A. GEMINI AI RESPONSE GENERATION (With Fallback Rotation)
    let aiResponseText = "";
    let geminiSuccess = false;

    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      try {
        const ai = getGeminiClient();
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const systemPrompt = `Aap ek pyaari aur helpful voice assistant hain. User ke sawaal ka bilkul chhota aur natural 1-2 line me Hinglish me jawab do. User Input: ${message}`;
        const result = await model.generateContent(systemPrompt);
        aiResponseText = result.response.text();
        geminiSuccess = true;
        break;
      } catch (err) {
        console.log(`Gemini Key ${i + 1} failed, trying next key...`);
      }
    }

    if (!geminiSuccess) {
      aiResponseText = "Maaf karna, abhi mera connection thoda slow hai. Thodi der me baat karte hain.";
    }

    // B. FISH AUDIO API - CLONED VOICE GENERATION
    const fishAudioResponse = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: aiResponseText,
        reference_id: process.env.FISH_MODEL_ID, // Aapka Model ID
        format: "mp3",
        latency: "normal"
      })
    });

    if (!fishAudioResponse.ok) {
      throw new Error(`Fish Audio API error: ${fishAudioResponse.statusText}`);
    }

    // Audio stream ko base64 format me convert karke app ko bhejna
    const audioArrayBuffer = await fishAudioResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioArrayBuffer).toString("base64");

    return res.status(200).json({
      text: aiResponseText,
      audio: `data:audio/mp3;base64,${audioBase64}`
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}

