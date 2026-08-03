import { supabase } from "./supabaseClient.js";

let currentUser = null;
let profilesById = {};

export async function initGreetings() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  currentUser = session.user;

  await loadProfiles();
  wireButtons();
  await refreshStreaks();
}

async function loadProfiles() {
  const { data } = await supabase.from("profiles").select("*");
  profilesById = {};
  (data || []).forEach((p) => { profilesById[p.id] = p; });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function wireButtons() {
  document.getElementById("morning-btn").addEventListener("click", () => sendGreeting("morning"));
  document.getElementById("night-btn").addEventListener("click", () => sendGreeting("night"));
}

async function sendGreeting(type) {
  const btn = document.getElementById(`${type}-btn`);
  btn.disabled = true;

  await supabase.from("daily_greetings").insert({
    author_id: currentUser.id,
    greeting_type: type,
    greeting_date: todayStr(),
  });

  await refreshStreaks();
}

async function computeStreak(authorId, type) {
  const { data } = await supabase
    .from("daily_greetings")
    .select("greeting_date")
    .eq("author_id", authorId)
    .eq("greeting_type", type);

  if (!data || data.length === 0) return 0;

  const dates = new Set(data.map((d) => d.greeting_date));
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const ds = cursor.toISOString().slice(0, 10);
    if (dates.has(ds)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

async function refreshStreaks() {
  const ids = Object.keys(profilesById);
  const lines = [];

  for (const id of ids) {
    const name = id === currentUser.id ? "You" : (profilesById[id].nickname || "Partner");
    const m = await computeStreak(id, "morning");
    const n = await computeStreak(id, "night");
    lines.push(`${name}: 🌸${m}d · 🌙${n}d`);
  }

  const streaksEl = document.getElementById("streaks-text");
  if (streaksEl) streaksEl.textContent = lines.join("   ");

  const { data: mine } = await supabase
    .from("daily_greetings")
    .select("greeting_type")
    .eq("author_id", currentUser.id)
    .eq("greeting_date", todayStr());

  const doneTypes = new Set((mine || []).map((d) => d.greeting_type));

  const morningBtn = document.getElementById("morning-btn");
  const nightBtn = document.getElementById("night-btn");
  if (morningBtn) morningBtn.textContent = doneTypes.has("morning") ? "🌸 Said Good Morning ✓" : "🌸 Good Morning";
  if (nightBtn) nightBtn.textContent = doneTypes.has("night") ? "🌙 Said Good Night ✓" : "🌙 Good Night";
}
