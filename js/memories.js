import { supabase } from "./supabaseClient.js";

let currentUser = null;
let profilesById = {};
let commentsByMemory = {};
let openThreads = new Set();

export async function initMemories() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  document.getElementById("app-root").style.visibility = "visible";
  document.getElementById("loading-gate").style.display = "none";

  await loadProfiles();
  wireUploadForm();
  await loadMemories();
}

async function loadProfiles() {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) return;
  profilesById = {};
  for (const p of data) profilesById[p.id] = p;
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

  const memoryIds = data.map((m) => m.id);
  const { data: commentsData } = await supabase
    .from("comments")
    .select("*")
    .eq("item_type", "memory")
    .in("item_id", memoryIds)
    .order("created_at", { ascending: true });

  commentsByMemory = {};
  (commentsData || []).forEach((c) => {
    if (!commentsByMemory[c.item_id]) commentsByMemory[c.item_id] = [];
    commentsByMemory[c.item_id].push(c);
  });

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
  grid.querySelectorAll("[data-toggle-thread]").forEach((btn) => {
    btn.addEventListener("click", () => toggleThread(btn.dataset.toggleThread));
  });
  grid.querySelectorAll("[data-comment-form]").forEach((form) => {
    form.addEventListener("submit", (e) => submitComment(e, form.dataset.commentForm));
  });
  grid.querySelectorAll("[data-delete-comment]").forEach((btn) => {
    btn.addEventListener("click", () => deleteComment(btn.dataset.deleteComment, btn.dataset.memoryId));
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

  const comments = commentsByMemory[memory.id] || [];
  const isOpen = openThreads.has(memory.id);

  const commentsHtml = comments.map((c) => {
    const cAuthor = profilesById[c.author_id]?.nickname || "Someone";
    const cMine = c.author_id === currentUser.id;
    return `
      <div style="font-size:0.75rem; padding:5px 0; border-top:1px solid rgba(0,0,0,0.08); display:flex; justify-content:space-between; gap:6px; text-align:left;">
        <span><strong>${escapeHtml(cAuthor)}:</strong> ${escapeHtml(c.content)}</span>
        ${cMine ? `<button data-delete-comment="${c.id}" data-memory-id="${memory.id}" style="background:none; border:none; cursor:pointer; opacity:0.5;">✕</button>` : ""}
      </div>
    `;
  }).join("");

  return `
    <div class="polaroid">
      <img src="${memory.image_url}" alt="${caption}" loading="lazy" />
      <div class="caption">${caption || date}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      <div style="display:flex; gap:10px; justify-content:center; margin-top:8px;">
        ${isMine ? `<button data-edit-id="${memory.id}" data-edit-caption="${encodedCaption}" data-edit-tags="${encodedTags}" style="background:none; border:none; cursor:pointer; font-size:1rem;" title="Edit">✏️</button>` : ""}
        ${isMine ? `<button data-delete-id="${memory.id}" data-delete-path="${storagePath}" style="background:none; border:none; cursor:pointer; font-size:1rem;" title="Delete">🗑️</button>` : ""}
        <button data-toggle-thread="${memory.id}" style="background:none; border:none; cursor:pointer; font-size:0.85rem;" title="Replies">💬 ${comments.length}</button>
      </div>
      <div style="${isOpen ? "" : "display:none;"} margin-top:8px; text-align:left;">
        ${commentsHtml}
        <form data-comment-form="${memory.id}" style="display:flex; gap:6px; margin-top:8px;">
          <input type="text" placeholder="Reply…" required style="flex:1; border-radius:8px; border:1px solid rgba(0,0,0,0.15); padding:6px 8px; font-size:0.78rem; font-family:inherit;" />
          <button type="submit" style="border:none; border-radius:8px; padding:6px 10px; background:rgba(0,0,0,0.1); cursor:pointer; font-size:0.78rem;">➤</button>
        </form>
      </div>
    </div>
  `;
}

function toggleThread(id) {
  if (openThreads.has(id)) openThreads.delete(id);
  else openThreads.add(id);
  loadMemories();
}

async function submitComment(e, memoryId) {
  e.preventDefault();
  const input = e.target.querySelector("input");
  const content = input.value.trim();
  if (!content) return;

  openThreads.add(memoryId);

  await supabase.from("comments").insert({
    item_type: "memory",
    item_id: memoryId,
    author_id: currentUser.id,
    content,
  });

  await loadMemories();
}

async function deleteComment(commentId, memoryId) {
  openThreads.add(memoryId);
  await supabase.from("comments").delete().eq("id", commentId);
  await loadMemories();
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
