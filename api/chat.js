// =============================================================
// 1. CONFIGURATION & ENVIRONMENT KEYS SETUP
// =============================================================

const GEMINI_API_KEYS = [
  process.env.GEMINI_KEY_1 || "AQ.Ab8RN6IWwGBqeQEqNnN-TW5LOpR1bU3S9VrnZA_ksZf-XkS7MQ",
  process.env.GEMINI_KEY_2 || "AQ.Ab8RN6Lo2oTZvomNE7zRrA3w5kIUfw5VL4sxyzYxkQcl5hSmVA",
  process.env.GEMINI_KEY_3 || "AQ.Ab8RN6KF9mD7yIaIuoD80NbJUCWpnRqm0oKLCArKP2jksgt__Q"
];

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY || "sk-fish-IshdwBNzlaxOSM1rlkmzyXbFUOAulC5bDk-tbKBJVZY";
const FISH_MODEL_ID = process.env.FISH_MODEL_ID || "64e121555e134819989048e5415846d6";

// =============================================================
// 2. STRICT GIRLY & WITTY SYSTEM PROMPT
// =============================================================
const SYSTEM_PROMPT = `
Tumhara naam Riya hai. Tum ek super energetic, witty, caring aur thodi chulbuli Indian ladki ho jo user ki sabse acchi dost ki tarah baat karti hai.

Strict Rules for Personality & Behavior:
1. Girl Persona: Tumhara baat karne ka tarz ek friendly Indian ladki jaisa hona chahiye (e.g., "Arrey yaar!", "Pata hai kya?", "Acha aisa hai kya?", "Aww", "Sach me?").
2. Tone & Language: Hamesha conversational Natural Hinglish (Hindi + English mix) me bolna hai. Robot ya kitabi bhasha bilkul allow nahi hai.
3. Short Answers: Jawab max 1-3 short sentences me hi hone chahiye taaki voice conversation fast aur natural rahe.
4. Memory & Context: User ne jo pehle bataya ho use dhyan me rakhte hue apne mood aur reply ko adjust karna.
5. Music Request Handling: Jab bhi user kisi gaane ya music ke liye bole (e.g. "Arijit Singh ka gaana bajao"), to response ke aakhir me ye tag lagao:
   "PLAY_SONG: <Song Name>"
   Example: "Awww mera favorite! Chalo main tumhare liye chala deti hoon. PLAY_SONG: Arijit Singh romantic hits"
`;

// =============================================================
// 3. GEMINI API CALL WITH 3-KEY ROTATION LOOP
// =============================================================
async function fetchGeminiResponse(conversationHistory) {
  let success = false;
  let responseData = null;
  let lastError = null;

  const contents = [
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "Heyyy! Main Riya hoon. Batao aaj kya chal raha hai?" }] },
    ...conversationHistory
  ];

  for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
    const activeKey = GEMINI_API_KEYS[i];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;

    try {
      console.log(`[REQUEST] Gemini Key #${i + 1} se request bhej rahe hain...`);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: contents })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        responseData = data.candidates[0].content.parts[0].text;
        success = true;
        console.log(`[SUCCESS] Key #${i + 1} se response mil gaya!`);
        break;
      } else {
        throw new Error("Invalid response JSON format from Gemini API");
      }

    } catch (error) {
      console.warn(`[API WARN] Key #${i + 1} fail hui: ${error.message}`);
      lastError = error;
    }
  }

  if (!success) {
    throw new Error(`Sabhi Gemini API Keys fail ho gayi hain. Last error: ${lastError?.message}`);
  }

  return responseData;
}

// =============================================================
// 4. FISH AUDIO TTS INTEGRATION
// =============================================================
async function generateFishAudio(text) {
  if (!FISH_AUDIO_API_KEY || FISH_AUDIO_API_KEY.includes("YOUR_FISH_AUDIO")) {
    return null;
  }

  try {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FISH_AUDIO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        reference_id: FISH_MODEL_ID,
        format: "mp3",
        latency: "normal"
      })
    });

    if (!response.ok) throw new Error(`Fish Audio API Failed: ${response.status}`);

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");

  } catch (err) {
    console.error("[FISH AUDIO ERROR]", err.message);
    return null;
  }
}

// =============================================================
// 5. VERCEL SERVERLESS HANDLER
// =============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { history } = req.body;

    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: 'Valid history array is required in request body.' });
    }

    const geminiReply = await fetchGeminiResponse(history);

    let audioBase64 = null;
    try {
      const cleanTextForAudio = geminiReply.replace(/PLAY_SONG:.*$/g, "").trim();
      if (cleanTextForAudio) {
        audioBase64 = await generateFishAudio(cleanTextForAudio);
      }
    } catch (e) {
      console.warn("Audio generation skipped due to error.");
    }

    return res.status(200).json({ 
      reply: geminiReply,
      audio: audioBase64
    });

  } catch (error) {
    console.error("[HANDLER ERROR]", error.message);
    return res.status(500).json({ 
      error: error.message || "Internal Server Error" 
    });
  }
}
