import { supabase } from "./supabaseClient.js";
import { markFeatureViewed } from "./badges.js";

let currentUser = null;
let profilesOrdered = [];
let reasonsByAuthor = {};
let colorByAuthor = {};

export async function initJar() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  document.getElementById("app-root").style.visibility = "visible";
  document.getElementById("loading-gate").style.display = "none";

  markFeatureViewed("jar");

  await loadProfilesAndColors();
  wireAddForm();
  await loadReasons();
}

async function loadProfilesAndColors() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return;

  profilesOrdered = data;
  colorByAuthor = {};
  const palette = ["#B39DDB", "#F2A6C6"]; // purple, pink — assigned in signup order, fixed for everyone
  data.forEach((p, i) => {
    colorByAuthor[p.id] = palette[i] || "#CBB8E8";
  });
}

function wireAddForm() {
  const form = document.getElementById("add-form");
  const input = document.getElementById("reason-input");
  const addBtn = document.getElementById("add-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reason = input.value.trim();
    if (!reason) return;

    addBtn.disabled = true;
    addBtn.textContent = "Adding…";

    const { error } = await supabase.from("love_reasons").insert({
      author_id: currentUser.id,
      reason,
    });

    if (!error) {
      await supabase.from("garden_events").insert({
        actor_id: currentUser.id,
        event_type: "achievement",
        metadata: { type: "reason_added" },
      });
      form.reset();
    }

    addBtn.disabled = false;
    addBtn.textContent = "Add to my jar 🫙";
    await loadReasons();
  });
}

async function loadReasons() {
  const countEl = document.getElementById("reason-count");
  const jarsRow = document.getElementById("jars-row");
  const listEl = document.getElementById("my-reasons-list");

  const { data, error } = await supabase
    .from("love_reasons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    countEl.textContent = "Something went wrong loading the jars.";
    return;
  }

  reasonsByAuthor = {};
  for (const p of profilesOrdered) reasonsByAuthor[p.id] = [];
  data.forEach((r) => {
    if (!reasonsByAuthor[r.author_id]) reasonsByAuthor[r.author_id] = [];
    reasonsByAuthor[r.author_id].push(r);
  });

  countEl.textContent = `${data.length} reason${data.length === 1 ? "" : "s"} across both jars.`;

  jarsRow.innerHTML = profilesOrdered.map((p) => {
    const color = colorByAuthor[p.id];
    const label = p.id === currentUser.id ? "Your jar" : `${p.nickname}'s jar`;
    return `
      <div class="jar-col">
        <button class="jar-btn" data-jar-author="${p.id}">🫙</button>
        <div class="jar-label" style="color:${color};">${label}</div>
        <div class="jar-reason" id="jar-reason-${p.id}" style="background:${color}22; border:1px solid ${color}66; color:var(--cream);"></div>
      </div>
    `;
  }).join("");

  jarsRow.querySelectorAll("[data-jar-author]").forEach((btn) => {
    btn.addEventListener("click", () => revealReason(btn.dataset.jarAuthor));
  });

  const myReasons = reasonsByAuthor[currentUser.id] || [];
  if (myReasons.length === 0) {
    listEl.innerHTML = `<p style="font-size:0.8rem; opacity:0.6; margin-top:8px;">You haven't added any yet.</p>`;
  } else {
    listEl.innerHTML = myReasons.map((r) => `
      <div class="reason-item">
        <span>${escapeHtml(r.reason)}</span>
        <div class="actions">
          <button data-edit-reason="${r.id}" data-edit-text="${encodeURIComponent(r.reason)}" title="Edit">✏️</button>
          <button data-delete-reason="${r.id}" title="Delete">🗑️</button>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll("[data-edit-reason]").forEach((btn) => {
      btn.addEventListener("click", () => editReason(btn.dataset.editReason, btn.dataset.editText));
    });
    listEl.querySelectorAll("[data-delete-reason]").forEach((btn) => {
      btn.addEventListener("click", () => deleteReason(btn.dataset.deleteReason));
    });
  }
}

function revealReason(authorId) {
  const box = document.getElementById(`jar-reason-${authorId}`);
  const list = reasonsByAuthor[authorId] || [];

  if (list.length === 0) {
    box.textContent = "Nothing in here yet 🌱";
    box.classList.add("show");
    return;
  }

  box.classList.remove("show");
  setTimeout(() => {
    const random = list[Math.floor(Math.random() * list.length)];
    box.textContent = random.reason;
    box.classList.add("show");
  }, 150);
}

async function editReason(id, encodedText) {
  const current = decodeURIComponent(encodedText);
  const updated = prompt("Edit this reason:", current);
  if (updated === null || updated.trim() === "") return;

  await supabase.from("love_reasons").update({ reason: updated.trim() }).eq("id", id);
  await loadReasons();
}

async function deleteReason(id) {
  const confirmed = confirm("Delete this reason? This can't be undone.");
  if (!confirmed) return;

  await supabase.from("love_reasons").delete().eq("id", id);
  await loadReasons();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
