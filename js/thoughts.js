import { supabase } from "./supabaseClient.js";
import { markFeatureViewed } from "./badges.js";

let currentUser = null;
let profilesById = {};
let commentsByThought = {};
let openThreads = new Set();

export async function initThoughts() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  document.getElementById("app-root").style.visibility = "visible";
  document.getElementById("loading-gate").style.display = "none";

  markFeatureViewed("thoughts");

  await loadProfiles();
  wireForm();
  await loadThoughts();
}

async function loadProfiles() {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) return;
  profilesById = {};
  for (const p of data) profilesById[p.id] = p;
}

function wireForm() {
  const form = document.getElementById("write-form");
  const textarea = document.getElementById("thought-content");
  const writeBtn = document.getElementById("write-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = textarea.value.trim();
    if (!content) return;

    writeBtn.disabled = true;
    writeBtn.textContent = "Sharing…";

    const { error } = await supabase.from("deep_thoughts").insert({
      author_id: currentUser.id,
      content,
    });

    if (!error) {
      textarea.value = "";
    }

    writeBtn.disabled = false;
    writeBtn.textContent = "Share this 🌙";
    await loadThoughts();
  });
}

async function loadThoughts() {
  const list = document.getElementById("thoughts-list");
  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");
  const countEl = document.getElementById("thought-count");

  const { data, error } = await supabase
    .from("deep_thoughts")
    .select("*")
    .order("created_at", { ascending: false });

  loadingState.style.display = "none";

  if (error) {
    emptyState.textContent = "Something went wrong loading these.";
    emptyState.style.display = "block";
    return;
  }

  countEl.textContent = `${data.length} thought${data.length === 1 ? "" : "s"} shared here.`;

  if (data.length === 0) {
    list.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  const thoughtIds = data.map((t) => t.id);
  const { data: commentsData } = await supabase
    .from("comments")
    .select("*")
    .eq("item_type", "thought")
    .in("item_id", thoughtIds)
    .order("created_at", { ascending: true });

  commentsByThought = {};
  (commentsData || []).forEach((c) => {
    if (!commentsByThought[c.item_id]) commentsByThought[c.item_id] = [];
    commentsByThought[c.item_id].push(c);
  });

  list.innerHTML = data.map(renderThought).join("");

  list.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => editThought(btn.dataset.editId, btn.dataset.editContent));
  });
  list.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteThought(btn.dataset.deleteId));
  });
  list.querySelectorAll("[data-toggle-thread]").forEach((btn) => {
    btn.addEventListener("click", () => toggleThread(btn.dataset.toggleThread));
  });
  list.querySelectorAll("[data-comment-form]").forEach((form) => {
    form.addEventListener("submit", (e) => submitComment(e, form.dataset.commentForm));
  });
  list.querySelectorAll("[data-delete-comment]").forEach((btn) => {
    btn.addEventListener("click", () => deleteComment(btn.dataset.deleteComment, btn.dataset.thoughtId));
  });
}

function renderThought(thought) {
  const author = profilesById[thought.author_id]?.nickname || "Someone";
  const date = new Date(thought.created_at).toLocaleString();
  const isMine = thought.author_id === currentUser.id;
  const safeContent = escapeHtml(thought.content);
  const encodedContent = encodeURIComponent(thought.content);

  const comments = commentsByThought[thought.id] || [];
  const isOpen = openThreads.has(thought.id);

  const commentsHtml = comments.map((c) => {
    const cAuthor = profilesById[c.author_id]?.nickname || "Someone";
    const cMine = c.author_id === currentUser.id;
    return `
      <div style="font-size:0.78rem; padding:6px 0; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; gap:6px; color:rgba(255,248,240,0.8);">
        <span><strong>${escapeHtml(cAuthor)}:</strong> ${escapeHtml(c.content)}</span>
        ${cMine ? `<button data-delete-comment="${c.id}" data-thought-id="${thought.id}" style="background:none; border:none; cursor:pointer; opacity:0.5; color:rgba(255,248,240,0.8);">✕</button>` : ""}
      </div>
    `;
  }).join("");

  return `
    <div class="thought-card">
      <div class="thought-meta">
        <span>${escapeHtml(author)}</span>
        <span>${date}</span>
      </div>
      <div class="thought-content">${safeContent}</div>
      <div class="thought-actions">
        ${isMine ? `<button data-edit-id="${thought.id}" data-edit-content="${encodedContent}">✏️ Edit</button>` : ""}
        ${isMine ? `<button data-delete-id="${thought.id}">🗑️ Delete</button>` : ""}
        <button data-toggle-thread="${thought.id}">💬 ${comments.length}</button>
      </div>
      <div style="${isOpen ? "" : "display:none;"} margin-top:10px;">
        ${commentsHtml}
        <form data-comment-form="${thought.id}" style="display:flex; gap:6px; margin-top:8px;">
          <input type="text" placeholder="Reply…" required style="flex:1; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.08); color:var(--cream); padding:8px 10px; font-size:0.85rem; font-family:inherit;" />
          <button type="submit" style="border:none; border-radius:8px; padding:8px 14px; background:rgba(255,255,255,0.12); color:var(--cream); cursor:pointer; font-size:0.85rem;">➤</button>
        </form>
      </div>
    </div>
  `;
}

function toggleThread(id) {
  if (openThreads.has(id)) openThreads.delete(id);
  else openThreads.add(id);
  loadThoughts();
}

async function submitComment(e, thoughtId) {
  e.preventDefault();
  const input = e.target.querySelector("input");
  const content = input.value.trim();
  if (!content) return;

  openThreads.add(thoughtId);

  await supabase.from("comments").insert({
    item_type: "thought",
    item_id: thoughtId,
    author_id: currentUser.id,
    content,
  });

  await loadThoughts();
}

async function deleteComment(commentId, thoughtId) {
  openThreads.add(thoughtId);
  await supabase.from("comments").delete().eq("id", commentId);
  await loadThoughts();
}

async function editThought(id, encodedContent) {
  const current = decodeURIComponent(encodedContent);
  const updated = prompt("Edit your thought:", current);
  if (updated === null || updated.trim() === "") return;

  await supabase.from("deep_thoughts").update({ content: updated.trim() }).eq("id", id);
  await loadThoughts();
}

async function deleteThought(id) {
  const confirmed = confirm("Delete this? This can't be undone.");
  if (!confirmed) return;

  await supabase.from("deep_thoughts").delete().eq("id", id);
  await loadThoughts();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
