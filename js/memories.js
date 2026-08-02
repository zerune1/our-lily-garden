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
      storage_path: fileName,
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

  grid.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () =>
      editMemory(btn.dataset.editId, btn.dataset.editCaption, btn.dataset.editTags)
    );
  });
  grid.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteMemory(btn.dataset.deleteId, btn.dataset.deletePath)
    );
  });
}

function renderMemoryCard(memory) {
  const date = new Date(memory.created_at).toLocaleDateString();
  const caption = escapeHtml(memory.caption || "");
  const tags = (memory.tags || []).map((t) => `#${escapeHtml(t)}`).join(" ");
  const isMine = memory.author_id === currentUser.id;
  const encodedCaption = encodeURIComponent(memory.caption || "");
  const encodedTags = encodeURIComponent((memory.tags || []).join(", "));
  const storagePath = memory.storage_path || "";

  return `
    <div class="polaroid">
      <img src="${memory.image_url}" alt="${caption}" loading="lazy" />
      <div class="caption">${caption || date}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      ${isMine ? `
        <div style="display:flex; gap:10px; justify-content:center; margin-top:8px;">
          <button data-edit-id="${memory.id}" data-edit-caption="${encodedCaption}" data-edit-tags="${encodedTags}" style="background:none; border:none; cursor:pointer; font-size:1rem;" title="Edit">✏️</button>
          <button data-delete-id="${memory.id}" data-delete-path="${storagePath}" style="background:none; border:none; cursor:pointer; font-size:1rem;" title="Delete">🗑️</button>
        </div>
      ` : ""}
    </div>
  `;
}

async function editMemory(id, encodedCaption, encodedTags) {
  const currentCaption = decodeURIComponent(encodedCaption);
  const currentTags = decodeURIComponent(encodedTags);

  const newCaption = prompt("Edit caption:", currentCaption);
  if (newCaption === null) return;

  const newTagsRaw = prompt("Edit tags (comma separated):", currentTags);
  if (newTagsRaw === null) return;

  const tags = newTagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  await supabase
    .from("memories")
    .update({ caption: newCaption.trim(), tags })
    .eq("id", id);

  await loadMemories();
}

async function deleteMemory(id, storagePath) {
  const confirmed = confirm("Delete this memory? This can't be undone.");
  if (!confirmed) return;

  if (storagePath) {
    await supabase.storage.from("memories").remove([storagePath]);
  }

  await supabase.from("memories").delete().eq("id", id);
  await loadMemories();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
