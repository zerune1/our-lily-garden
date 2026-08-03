import { supabase } from "./supabaseClient.js";
import { markFeatureViewed } from "./badges.js";

let currentUser = null;
let allReasons = [];

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

  wireJarButton();
  wireAddForm();
  await loadReasons();
}

function wireJarButton() {
  const jarBtn = document.getElementById("jar-button");
  const reasonBox = document.getElementById("jar-reason-box");

  jarBtn.addEventListener("click", () => {
    if (allReasons.length === 0) {
      reasonBox.textContent = "The jar is empty — add a reason below 🌱";
      reasonBox.classList.add("show");
      return;
    }

    reasonBox.classList.remove("show");

    setTimeout(() => {
      const random = allReasons[Math.floor(Math.random() * allReasons.length)];
      reasonBox.textContent = random.reason;
      reasonBox.classList.add("show");
    }, 150);
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
    addBtn.textContent = "Add to jar 🫙";
    await loadReasons();
  });
}

async function loadReasons() {
  const countEl = document.getElementById("reason-count");

  const { data, error } = await supabase
    .from("love_reasons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    countEl.textContent = "Something went wrong loading the jar.";
    return;
  }

  allReasons = data;
  countEl.textContent = `${data.length} reason${data.length === 1 ? "" : "s"} in the jar so far.`;
}
