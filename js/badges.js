import { supabase } from "./supabaseClient.js";

const FEATURES = [
  { type: "memories", table: "memories", badgeId: "badge-memories" },
  { type: "letters", table: "open_when_letters", badgeId: "badge-letters" },
  { type: "jar", table: "love_reasons", badgeId: "badge-jar" },
  { type: "thoughts", table: "deep_thoughts", badgeId: "badge-thoughts" },
];

export async function loadBadges() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  const { data: views } = await supabase
    .from("feature_views")
    .select("*")
    .eq("user_id", userId);

  const viewedMap = {};
  (views || []).forEach((v) => { viewedMap[v.feature_type] = v.last_viewed_at; });

  for (const feature of FEATURES) {
    const lastViewed = viewedMap[feature.type] || "1970-01-01T00:00:00Z";

    const { count } = await supabase
      .from(feature.table)
      .select("id", { count: "exact", head: true })
      .neq("author_id", userId)
      .gt("created_at", lastViewed);

    const badgeEl = document.getElementById(feature.badgeId);
    if (!badgeEl) continue;

    if (count && count > 0) {
      badgeEl.textContent = count > 9 ? "9+" : String(count);
      badgeEl.style.display = "inline-flex";
    } else {
      badgeEl.style.display = "none";
    }
  }
}

export async function markFeatureViewed(featureType) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from("feature_views").upsert({
    user_id: session.user.id,
    feature_type: featureType,
    last_viewed_at: new Date().toISOString(),
  });
}
