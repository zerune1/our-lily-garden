import { supabase } from "./supabaseClient.js";

let currentUser = null;

export async function initMemories() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  document.getElementById("app-root").style.visibility = "visible";
  document.getElementById("loading-gate").style.display = "none";

  wireUploadForm();
  await loadMemories();
}

function wireUploadForm() {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("memory-file");
  const captionInput = document.getElementById("memory-caption");
  const tagsInput = document.getElementById("memory-tags");
  const uploadBtn = document.getElementById("upload-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";

    const fileExt = file.name.split(".").pop();
    const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("memories")
      .upload(fileName, file);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Add memory 🌸";
      return;
    }

    const { data: urlData } = supabase.storage
      .from("memories")
      .getPublicUrl(fileName);

    const tags = tagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase.from("memories").insert({
      author_id: currentUser.id,
      image_url: urlData.publicUrl,
      caption: captionInput.value.trim(),
      tags,
    });

    if (!insertError) {
      await supabase.from("garden_events").insert({
        actor_id: currentUser.id,
        event_type: "memory",
        metadata: {},
      });
      form.reset();
    }

    uploadBtn.disabled = false;
    uploadBtn.textContent = "Add memory 🌸";
    await loadMemories();
  });
}

async function loadMemories() {
  const grid = document.getElementById("memories-grid");
  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");
  const countEl = document.getElementById("memory-count");

  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .order("created_at", { ascending: false });

  loadingState.style.display = "none";

  if (error) {
    emptyState.textContent = "Something went wrong loading memories.";
    emptyState.style.display = "block";
    return;
  }

  countEl.textContent = `${data.length} memor${data.length === 1 ? "y" : "ies"} saved so far.`;

  if (data.length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  grid.innerHTML = data.map(renderMemoryCard).join("");
}

function renderMemoryCard(memory) {
  const date = new Date(memory.created_at).toLocaleDateString();
  const caption = escapeHtml(memory.caption || "");
  const tags = (memory.tags || []).map((t) => `#${escapeHtml(t)}`).join(" ");

  return `
    <div class="polaroid">
      <img src="${memory.image_url}" alt="${caption}" loading="lazy" />
      <div class="caption">${caption || date}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
