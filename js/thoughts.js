import { supabase } from "./supabaseClient.js";

let currentUser = null;
let profilesById = {};

export async function initThoughts() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  document.getElementById("app-root").style.visibility = "visible";
  document.getElementById("loading-gate").style.display = "none";

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
  list.innerHTML = data.map(renderThought).join("");

  list.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => editThought(btn.dataset.editId, btn.dataset.editContent));
  });
  list.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteThought(btn.dataset.deleteId));
  });
}

function renderThought(thought) {
  const author = profilesById[thought.author_id]?.nickname || "Someone";
  const date = new Date(thought.created_at).toLocaleDateString();
  const isMine = thought.author_id === currentUser.id;
  const safeContent = escapeHtml(thought.content);
  const encodedContent = encodeURIComponent(thought.content);

  return `
    <div class="thought-card">
      <div class="thought-meta">
        <span>${escapeHtml(author)}</span>
        <span>${date}</span>
      </div>
      <div class="thought-content">${safeContent}</div>
      ${isMine ? `
        <div class="thought-actions">
          <button data-edit-id="${thought.id}" data-edit-content="${encodedContent}">✏️ Edit</button>
          <button data-delete-id="${thought.id}">🗑️ Delete</button>
        </div>
      ` : ""}
    </div>
  `;
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
