import { GoogleGenerativeAI } from "@google/generative-ai";

// -------------------------------------------------------------
// DIRECT API KEYS & CONFIGURATION
// -------------------------------------------------------------
const GEMINI_API_KEYS = [
  "AQ.Ab8RN6LYLUjAFUANccjG_KbHBAvcaCSGIPZHqmAXa8TxOI15iw",
  "AQ.Ab8RN6Ixbslec5HJgTlEOAW7zMBLixuRX-NhltpHpdQgGdVulg",
  "AQ.Ab8RN6KdM0a8WsZYmxFWkAS5GSjYt6HThJ9tA2UppKRUzNf7Wg"// Yahan apni Gemini API Key daalein
];

const FISH_AUDIO_API_KEY = "sk-fish-MPYmavn6aQEufgpg5QnNQPJ_ESLSqt6NP0pyn0Ihfwk"; // Yahan Fish Audio API Key daalein
const FISH_MODEL_ID = "YOUR_FISH_MODEL_ID_HERE";             // Yahan Fish Audio Model ID daalein

// System Instructions for Assistant Personality
const SYSTEM_INSTRUCTION = `
Tum ek helpful, fast, aur smart Voice AI Assistant ho. 
Hinglish me chote, natural, aur aasaan jawab do jaise dost baat karte hain. 
Kabhi bhi lambi formatting, markdown bullets, ya taare (asterisks *) ka use mat karo kyunki jawab ko bol kar sunana hai.
`;

export default async function handler(req, res) {
  // CORS Headers for Frontend Access
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message field is required' });
    }

    // -------------------------------------------------------------
    // 1. GEMINI RESPONSE GENERATION
    // -------------------------------------------------------------
    let aiResponseText = "";
    let geminiError = null;

    // Cycle through API Keys for Fallback
    for (const apiKey of GEMINI_API_KEYS) {
      if (!apiKey || apiKey.includes("YOUR_GEMINI_API_KEY")) continue;

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: SYSTEM_INSTRUCTION
        });

        // Format history for Gemini
        const formattedHistory = conversationHistory.map(item => ({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content }]
        }));

        const chat = model.startChat({ history: formattedHistory });
        const result = await chat.sendMessage(message);
        aiResponseText = result.response.text();

        // Asterisk/Markdown clean up for natural audio output
        aiResponseText = aiResponseText.replace(/\*/g, '').trim();

        if (aiResponseText) break; // Successfully got response
      } catch (err) {
        console.error("Gemini API Error with current key:", err.message);
        geminiError = err;
      }
    }

    if (!aiResponseText) {
      throw new Error(geminiError ? geminiError.message : "All Gemini API keys failed or missing.");
    }

    // -------------------------------------------------------------
    // 2. FISH AUDIO TTS GENERATION
    // -------------------------------------------------------------
    let audioBase64 = null;

    if (
      FISH_AUDIO_API_KEY && 
      FISH_MODEL_ID && 
      !FISH_AUDIO_API_KEY.includes("YOUR_FISH_AUDIO")
    ) {
      try {
        const fishResponse = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FISH_AUDIO_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: aiResponseText,
            reference_id: FISH_MODEL_ID,
            format: "mp3",
            latency: "normal"
          })
        });

        if (fishResponse.ok) {
          const audioBuffer = await fishResponse.arrayBuffer();
          audioBase64 = Buffer.from(audioBuffer).toString('base64');
        } else {
          const errorText = await fishResponse.text();
          console.error("Fish Audio API Error:", errorText);
        }
      } catch (audioErr) {
        console.error("Fish Audio Fetch Exception:", audioErr.message);
      }
    }

    // -------------------------------------------------------------
    // 3. FINAL RESPONSE
    // -------------------------------------------------------------
    return res.status(200).json({
      text: aiResponseText,
      audio: audioBase64 // Base64 Audio string (or null if TTS failed)
    });

  } catch (error) {
    console.error("Server API Handler Error:", error);
    return res.status(500).json({ 
      error: "Kuch gadbad hui backend processing me.",
      details: error.message 
    });
  }
}

