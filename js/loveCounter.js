import { supabase } from "./supabaseClient.js";

export async function startLoveCounter() {
  const el = document.getElementById("love-counter-text");
  if (!el) return;

  const { data, error } = await supabase
    .from("relationship_info")
    .select("anniversary_date")
    .eq("id", 1)
    .single();

  if (error || !data || !data.anniversary_date) {
    el.textContent = "Set your anniversary date in Supabase to start the counter 🌸";
    return;
  }

  const startDate = new Date(data.anniversary_date + "T00:00:00");

  function update() {
    const now = new Date();
    const diffMs = now - startDate;

    if (diffMs < 0) {
      el.textContent = "Counting down to our beginning… 🌸";
      return;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const years = Math.floor(days / 365.25);
    const remainingDays = Math.floor(days - years * 365.25);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    let text = "";
    if (years > 0) text += `${years} year${years === 1 ? "" : "s"}, `;
    text += `${remainingDays} day${remainingDays === 1 ? "" : "s"}, `;
    text += `${hours}h ${minutes}m 💕`;

    el.textContent = text;
  }

  update();
  setInterval(update, 60000);
}
