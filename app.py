import streamlit as st
import json
import os
import requests
from streamlit_mic_recorder import speech_to_text

# ==========================================
# 1. PAGE SETUP & CONFIG
# ==========================================
st.set_page_config(page_title="Voice AI Assistant", page_icon="🎀")
st.title("🎀 My Personal AI Assistant")

# Streamlit Secrets se API Keys read karein
GROQ_API_KEY = st.secrets.get("GROQ_API_KEY", "")
FISH_AUDIO_API_KEY = st.secrets.get("FISH_AUDIO_API_KEY", "")
FISH_REF_ID = st.secrets.get("FISH_REF_ID", "")

MEMORY_FILE = "memory.json"

# ==========================================
# 2. LONG TERM MEMORY MANAGEMENT
# ==========================================
def load_memory():
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
            
    # Default Setup
    return {
        "profile": {
            "bot_name": "Riya",
            "user_name": "Dost",
            "user_habits": []
        },
        "history": []
    }

def save_memory(data):
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if "memory_data" not in st.session_state:
    st.session_state.memory_data = load_memory()

# ==========================================
# 3. AI BRAIN (GROQ LLM)
# ==========================================
def get_ai_response(user_text):
    data = st.session_state.memory_data
    profile = data["profile"]
    user_lower = user_text.lower()

    # --- FORGET COMMAND CHECK ---
    if any(phrase in user_lower for phrase in ["sab bhool jao", "forget everything", "clear memory", "sab delete kar do"]):
        st.session_state.memory_data = {
            "profile": {
                "bot_name": profile.get("bot_name", "Riya"),
                "user_name": profile.get("user_name", "Dost"),
                "user_habits": []
            },
            "history": []
        }
        save_memory(st.session_state.memory_data)
        return f"Theek hai {profile.get('user_name', 'Dost')}, maine apni purani saari baatein aur memory delete kar di hai. Ab hum bilkul naye sir se shuru karenge."

    # --- DYNAMIC NAME CHANGE CHECKS ---
    if "mera naam" in user_lower and ("rakh" in user_lower or "hai" in user_lower or "badal" in user_lower):
        words = user_text.split()
        for i, w in enumerate(words):
            if w.lower() in ["naam", "naam:"] and i + 1 < len(words):
                new_name = words[i+1].strip(".,!?")
                profile["user_name"] = new_name
                break

    if ("tumhara naam" in user_lower or "apna naam" in user_lower) and ("rakh" in user_lower or "hai" in user_lower or "badal" in user_lower):
        words = user_text.split()
        for i, w in enumerate(words):
            if w.lower() in ["naam", "naam:"] and i + 1 < len(words):
                new_bot_name = words[i+1].strip(".,!?")
                profile["bot_name"] = new_bot_name
                break

    # Dynamic System Prompt Build Karein
    system_prompt = f"""
    Aap ek ladki hain. Aapka naam {profile['bot_name']} hai.
    Aap user se baat kar rahi hain jinka naam {profile['user_name']} hai.

    Aapka Swabhav (Behavior):
    - Aap bahut pyaari, friendly, caring aur thodi witty ladki ke roop me baat karti hain.
    - User ki pasand, na-pasand, aur habits ko samajhein aur uske according apni personality aur baaton ko adapt karein.
    - Hamesha short, natural aur conversational Hindi/Hinglish me 1-3 sentences me jawab dein taaki bolne me natural lage.
    """

    messages = [{"role": "system", "content": system_prompt}]
    
    # Recent History (Last 10 Turns) Include Karein
    recent_history = data["history"][-10:]
    for msg in recent_history:
        messages.append(msg)
        
    messages.append({"role": "user", "content": user_text})

    # Groq API Request
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "max_tokens": 150,
        "temperature": 0.7
    }

    res = requests.post(url, headers=headers, json=payload)
    if res.status_code == 200:
        reply = res.json()["choices"][0]["message"]["content"]
        
        # Memory Save
        data["history"].append({"role": "user", "content": user_text})
        data["history"].append({"role": "assistant", "content": reply})
        save_memory(data)
        
        return reply
    else:
        return "Mujhe samajhne me thodi dikkat hui, dobara bolo?"

# ==========================================
# 4. FISH AUDIO TTS (CLONED VOICE)
# ==========================================
def get_cloned_voice_audio(text):
    url = "https://api.fish.audio/v1/tts"
    headers = {
        "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "text": text,
        "reference_id": FISH_REF_ID,
        "format": "mp3",
        "latency": "normal"
    }

    res = requests.post(url, headers=headers, json=payload)
    if res.status_code == 200:
        return res.content
    return None

# ==========================================
# 5. USER INTERFACE (STREAMLIT)
# ==========================================
bot_current_name = st.session_state.memory_data["profile"].get("bot_name", "Riya")
user_current_name = st.session_state.memory_data["profile"].get("user_name", "Dost")

st.write(f"**Bot Name:** {bot_current_name} | **User Name:** {user_current_name}")
st.write("Niche mic icon par click karke baat karein:")

# Speech Recognition Button
user_speech = speech_to_text(
    start_prompt="🎙️ Bolne ke liye Click Karein",
    stop_prompt="⏹️ Stop & Send",
    language='hi-IN',
    key='mic_input'
)

if user_speech:
    st.chat_message("user").write(user_speech)
    
    with st.spinner("Soch rahi hoon..."):
        ai_reply = get_ai_response(user_speech)
        audio_bytes = get_cloned_voice_audio(ai_reply)

    st.chat_message("assistant").write(ai_reply)
    
    if audio_bytes:
        st.audio(audio_bytes, format="audio/mp3", autoplay=True)
  
