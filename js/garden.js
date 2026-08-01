import { supabase } from "./supabaseClient.js";

let currentUser = null;
let currentProfile = null;
let profilesById = {};
let selectedStyle = "sticky";

const STYLE_ICON = { sticky: "📝", lily: "🌸", cat: "🐱" };

export async function initGarden() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  await loadProfiles();
  wireNavbar();
  wireComposer();
  await loadDailyNote();
  await loadNotes();
  subscribeToNoteChanges();

  document.getElementById("app-root").style.visibility = "visible";
  document.getElementById("loading-gate").style.display = "none";
}

async function loadProfiles() {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) return;

  profilesById = {};
  for (const p of data) profilesById[p.id] = p;
  currentProfile = profilesById[currentUser.id];

  const greeting = document.getElementById("greeting");
  if (greeting && currentProfile) {
    greeting.textContent = `Hi, ${currentProfile.nickname} ${currentProfile.cat_emoji || "🐱"}`;
  }

  const leftCat = document.getElementById("cat-left");
  if (leftCat && currentProfile) {
    leftCat.textContent = currentProfile.cat_emoji || "🐱";
  }
}

function wireNavbar() {
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
  });
}

async function loadDailyNote() {
  const { data, error } = await supabase
    .from("daily_note_bank")
    .select("content")
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return;

  const dayNumber = Math.floor(Date.now() / 86400000);
  const index = dayNumber % data.length;

  const banner = document.getElementById("daily-banner");
  const textEl = document.getElementById("daily-banner-text");
  textEl.textContent = data[index].content;
  banner.style.display = "block";
}

function wireComposer() {
  const pills = document.querySelectorAll(".style-pill");
  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      selectedStyle = pill.dataset.style;
    });
  });

  const form = document.getElementById("composer-form");
  const textarea = document.getElementById("note-content");
  const sendBtn = document.getElementById("send-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = textarea.value.trim();
    if (!content) return;

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";

    const { error } = await supabase.from("love_notes").insert({
      author_id: currentUser.id,
      content,
      style: selectedStyle,
    });

    if (!error) {
      await supabase.from("garden_events").insert({
        actor_id: currentUser.id,
        event_type: "note",
        metadata: { style: selectedStyle },
      });
      textarea.value = "";
    }

    sendBtn.disabled = false;
    sendBtn.textContent = "Leave note";
    await loadNotes();
  });
}

async function loadNotes() {
  const grid = document.getElementById("notes-grid");
  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");
  const countEl = document.getElementById("note-count");

  const { data, error } = await supabase
    .from("love_notes")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  loadingState.style.display = "none";

  if (error) {
    grid.innerHTML = "";
    emptyState.textContent = "Something went wrong loading notes.";
    emptyState.style.display = "block";
    return;
  }

  countEl.textContent = `${data.length} note${data.length === 1 ? "" : "s"} planted so far — keep growing it together.`;

  if (data.length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  grid.innerHTML = data.map(renderNoteCard).join("");

  grid.querySelectorAll("[data-pin-id]").forEach((btn) => {
    btn.addEventListener("click", () => togglePin(btn.dataset.pinId, btn.dataset.pinState !== "true"));
  });
  grid.querySelectorAll("[data-fav-id]").forEach((btn) => {
    btn.addEventListener("click", () => toggleFavorite(btn.dataset.favId, btn.dataset.favState !== "true"));
  });

  const liliesLayer = document.querySelector(".lilies-layer");
  if (liliesLayer && liliesLayer.childElementCount === 0) {
    const growthStage = Math.min(Math.floor(data.length / 3), 5);
    import("./ambience.js").then(({ setupAmbience }) => {
      setupAmbience({ starCount: 40, fireflyCount: 6, lilyCount: 6 + growthStage * 2 });
    });
  }
}

function renderNoteCard(note) {
  const author = profilesById[note.author_id]?.nickname || "Someone";
  const icon = STYLE_ICON[note.style] || "📝";
  const date = new Date(note.created_at).toLocaleDateString();
  const safeContent = escapeHtml(note.content);

  return `
    <div class="note-card style-${note.style}">
      <div class="note-meta">
        <span>${icon} ${escapeHtml(author)}</span>
        <span>${date}</span>
      </div>
      <div class="note-content">${safeContent}</div>
      <div class="note-actions">
        <button data-pin-id="${note.id}" data-pin-state="${note.is_pinned}" class="${note.is_pinned ? "active" : ""}" title="Pin">📌</button>
        <button data-fav-id="${note.id}" data-fav-state="${note.is_favorite}" class="${note.is_favorite ? "active" : ""}" title="Favorite">${note.is_favorite ? "❤️" : "🤍"}</button>
      </div>
    </div>
  `;
}

async function togglePin(id, next) {
  await supabase.from("love_notes").update({ is_pinned: next }).eq("id", id);
  await loadNotes();
}

async function toggleFavorite(id, next) {
  await supabase.from("love_notes").update({ is_favorite: next }).eq("id", id);
  await loadNotes();
}

function subscribeToNoteChanges() {
  supabase
    .channel("love_notes_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "love_notes" }, () => {
      loadNotes();
    })
    .subscribe();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
