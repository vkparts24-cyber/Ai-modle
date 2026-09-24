// =============================================================
// 1. CONFIGURATION & API KEYS SETUP
// =============================================================

// Aapki Teeno Gemini API Keys (AQ... format support ke sath)
const GEMINI_API_KEYS = [
  "AQ.Ab8RN6IWwGBqeQEqNnN-TW5LOpR1bU3S9VrnZA_ksZf-XkS7MQ",
  "AQ.Ab8RN6Lo2oTZvomNE7zRrA3w5kIUfw5VL4sxyzYxkQcl5hSmVA",
  ""
];

// Fish Audio Setup (Agar use kar rahe hain)
const FISH_AUDIO_API_KEY = "";
const FISH_MODEL_ID = "";

// Key Tracking Index
let currentKeyIndex = 0;

// Helper Function: Active Key Haasil Karne Ke Liye
function getActiveApiKey() {
  return GEMINI_API_KEYS[currentKeyIndex];
}

// Helper Function: Key Rotate Karne Ke Liye
function rotateApiKey() {
  const previousKey = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  console.warn(`[API ROTATION] Key #${previousKey + 1} limit hit/error! Switched to Key #${currentKeyIndex + 1}`);
}

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
  let attempts = 0;
  let success = false;
  let responseData = null;

  // Formatting conversation for Gemini REST API v1beta
  const contents = [
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "Heyyy! Main Riya hoon. Batao aaj kya chal raha hai?" }] },
    ...conversationHistory
  ];

  // Rotation Loop: Jab tak koi key kaam na kare ya teeno keys try na ho jayein
  while (attempts < GEMINI_API_KEYS.length && !success) {
    const activeKey = getActiveApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;

    try {
      console.log(`[REQUEST] Gemini Key #${currentKeyIndex + 1} se request bhej rahe hain...`);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: contents })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        responseData = data.candidates[0].content.parts[0].text;
        success = true;
        console.log(`[SUCCESS] Key #${currentKeyIndex + 1} se reply mil gaya!`);
      } else {
        throw new Error("Invalid response format from Gemini");
      }

    } catch (error) {
      console.error(`[ERROR] Key #${currentKeyIndex + 1} fail hui:`, error.message);
      attempts++;
      rotateApiKey(); // Agli key par switch karein
    }
  }

  if (!success) {
    throw new Error("Teeno Gemini API Keys limit exceed ho gayi hain ya kaam nahi kar rahi hain.");
  }

  return responseData;
}

// =============================================================
// 4. FISH AUDIO INTEGRATION (Voice Model)
// =============================================================
async function generateFishAudio(text) {
  // Agar Fish Audio setup nahi kiya hai to null return karein
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

    if (!response.ok) throw new Error("Fish Audio TTS failed");

    const audioBuffer = await response.arrayBuffer();
    return audioBuffer;
  } catch (err) {
    console.error("[FISH AUDIO ERROR]", err.message);
    return null;
  }
}

// Exporting logic for serverless / backend routes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchGeminiResponse, generateFishAudio };
}

