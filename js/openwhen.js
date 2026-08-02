import { supabase } from "./supabaseClient.js";

let currentUser = null;
let lettersData = [];
let currentLetterId = null;

export async function initOpenWhen() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  document.getElementById("app-root").style.visibility = "visible";
  document.getElementById("loading-gate").style.display = "none";

  wireWriteForm();
  wireModal();
  await loadLetters();
}

function wireWriteForm() {
  const form = document.getElementById("write-form");
  const titleInput = document.getElementById("letter-title");
  const contentInput = document.getElementById("letter-content");
  const writeBtn = document.getElementById("write-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title || !content) return;

    writeBtn.disabled = true;
    writeBtn.textContent = "Sealing…";

    const { error } = await supabase.from("open_when_letters").insert({
      author_id: currentUser.id,
      title,
      content,
    });

    if (!error) {
      await supabase.from("garden_events").insert({
        actor_id: currentUser.id,
        event_type: "letter",
        metadata: {},
      });
      form.reset();
    }

    writeBtn.disabled = false;
    writeBtn.textContent = "Seal the letter 💌";
    await loadLetters();
  });
}

function wireModal() {
  const modal = document.getElementById("letter-modal");
  const closeBtn = document.getElementById("modal-close");
  const editBtn = document.getElementById("modal-edit-btn");
  const deleteBtn = document.getElementById("modal-delete-btn");

  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });

  editBtn.addEventListener("click", async () => {
    const letter = lettersData.find((l) => l.id === currentLetterId);
    if (!letter) return;

    const newTitle = prompt("Edit title:", letter.title);
    if (newTitle === null) return;

    const newContent = prompt("Edit letter:", letter.content);
    if (newContent === null) return;

    await supabase
      .from("open_when_letters")
      .update({ title: newTitle.trim(), content: newContent.trim() })
      .eq("id", currentLetterId);

    modal.classList.remove("open");
    await loadLetters();
  });

  deleteBtn.addEventListener("click", async () => {
    const confirmed = confirm("Delete this letter? This can't be undone.");
    if (!confirmed) return;

    await supabase.from("open_when_letters").delete().eq("id", currentLetterId);
    modal.classList.remove("open");
    await loadLetters();
  });
}

function openLetter(id) {
  const letter = lettersData.find((l) => l.id === id);
  if (!letter) return;

  currentLetterId = id;

  document.getElementById("modal-title").textContent = letter.title;
  document.getElementById("modal-content").textContent = letter.content;

  const ownerActions = document.getElementById("modal-owner-actions");
  ownerActions.style.display = letter.author_id === currentUser.id ? "flex" : "none";

  document.getElementById("letter-modal").classList.add("open");
}

async function loadLetters() {
  const grid = document.getElementById("envelopes-grid");
  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");

  const { data, error } = await supabase
    .from("open_when_letters")
    .select("*")
    .order("created_at", { ascending: false });

  loadingState.style.display = "none";

  if (error) {
    emptyState.textContent = "Something went wrong loading letters.";
    emptyState.style.display = "block";
    return;
  }

  lettersData = data;

  if (data.length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  grid.innerHTML = data.map(renderEnvelope).join("");

  grid.querySelectorAll("[data-letter-id]").forEach((btn) => {
    btn.addEventListener("click", () => openLetter(btn.dataset.letterId));
  });
}

function renderEnvelope(letter) {
  const title = escapeHtml(letter.title);
  return `
    <div class="envelope" data-letter-id="${letter.id}">
      <span class="icon">💌</span>
      ${title}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
