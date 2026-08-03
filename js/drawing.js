import { supabase } from "./supabaseClient.js";

let currentUser = null;
let profilesById = {};
let selectedColor = "#F2A6C6";
let brushSize = 8;
let erasing = false;
let drawing = false;
let selectedTemplateKey = null;

const COLORS = ["#F2A6C6","#B39DDB","#AEDCEE","#BFE3CB","#FFE066","#F2A98F","#FF8FA3","#8ED1C2","#4A3B4E","#FFFFFF"];

const TEMPLATES = [
  { key: "flower", name: "Flower", draw: drawFlower },
  { key: "heart", name: "Heart", draw: drawHeart },
  { key: "cat", name: "Cat", draw: drawCat },
  { key: "house", name: "House", draw: drawHouse },
  { key: "rainbow", name: "Rainbow", draw: drawRainbow },
  { key: "moon", name: "Moon & Stars", draw: drawMoonStars },
];

export async function initDrawing() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;

  document.getElementById("app-root").style.visibility = "visible";
  document.getElementById("loading-gate").style.display = "none";

  await loadProfiles();
  renderTemplatePicker();
  renderPalette();
  wireToolbar();
  wireCanvasDrawing();

  const todays = getTodaysTemplates();
  selectTemplate(todays[0].key);

  await loadGallery();
}

async function loadProfiles() {
  const { data } = await supabase.from("profiles").select("*");
  profilesById = {};
  (data || []).forEach((p) => { profilesById[p.id] = p; });
}

function getTodaysTemplates() {
  const dayNumber = Math.floor(Date.now() / 86400000);
  const start = dayNumber % TEMPLATES.length;
  return [0, 1, 2].map((i) => TEMPLATES[(start + i) % TEMPLATES.length]);
}

function renderTemplatePicker() {
  const picker = document.getElementById("template-picker");
  const todays = getTodaysTemplates();

  picker.innerHTML = todays.map((t) => `
    <div class="template-thumb" data-template="${t.key}">
      <canvas width="70" height="65" data-thumb="${t.key}"></canvas>
    </div>
  `).join("");

  todays.forEach((t) => {
    const c = picker.querySelector(`canvas[data-thumb="${t.key}"]`);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    t.draw(ctx, c.width, c.height, 0.4);
  });

  picker.querySelectorAll("[data-template]").forEach((el) => {
    el.addEventListener("click", () => selectTemplate(el.dataset.template));
  });
}

function selectTemplate(key) {
  selectedTemplateKey = key;
  document.querySelectorAll(".template-thumb").forEach((el) => {
    el.classList.toggle("active", el.dataset.template === key);
  });

  const template = TEMPLATES.find((t) => t.key === key);
  const templateCanvas = document.getElementById("template-canvas");
  const drawCanvas = document.getElementById("draw-canvas");
  const tctx = templateCanvas.getContext("2d");
  const dctx = drawCanvas.getContext("2d");

  tctx.clearRect(0, 0, templateCanvas.width, templateCanvas.height);
  tctx.fillStyle = "#fff";
  tctx.fillRect(0, 0, templateCanvas.width, templateCanvas.height);
  template.draw(tctx, templateCanvas.width, templateCanvas.height, 1);

  dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function renderPalette() {
  const palette = document.getElementById("palette");
  palette.innerHTML = COLORS.map((c, i) =>
    `<div class="swatch ${i === 0 ? "active" : ""}" data-color="${c}" style="background:${c};"></div>`
  ).join("");

  palette.querySelectorAll(".swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      selectedColor = sw.dataset.color;
      erasing = false;
      palette.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
      sw.classList.add("active");
      document.getElementById("eraser-btn").classList.remove("active");
    });
  });
}

function wireToolbar() {
  document.getElementById("brush-size").addEventListener("input", (e) => {
    brushSize = Number(e.target.value);
  });

  const eraserBtn = document.getElementById("eraser-btn");
  eraserBtn.addEventListener("click", () => {
    erasing = !erasing;
    eraserBtn.classList.toggle("active", erasing);
  });

  document.getElementById("clear-btn").addEventListener("click", () => {
    const drawCanvas = document.getElementById("draw-canvas");
    drawCanvas.getContext("2d").clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  });

  document.getElementById("submit-btn").addEventListener("click", submitDrawing);
}

function getPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function wireCanvasDrawing() {
  const canvas = document.getElementById("draw-canvas");
  const ctx = canvas.getContext("2d");
  let last = null;

  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    last = getPos(canvas, e);
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const pos = getPos(canvas, e);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = brushSize;

    if (erasing) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = selectedColor;
    }

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    last = pos;
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
    canvas.addEventListener(evt, () => { drawing = false; last = null; });
  });
}

async function submitDrawing() {
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  const templateCanvas = document.getElementById("template-canvas");
  const drawCanvas = document.getElementById("draw-canvas");

  const output = document.createElement("canvas");
  output.width = templateCanvas.width;
  output.height = templateCanvas.height;
  const octx = output.getContext("2d");
  octx.drawImage(templateCanvas, 0, 0);
  octx.drawImage(drawCanvas, 0, 0);

  const blob = await new Promise((resolve) => output.toBlob(resolve, "image/png"));
  const fileName = `${currentUser.id}-${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from("drawings")
    .upload(fileName, blob, { contentType: "image/png" });

  if (uploadError) {
    alert("Couldn't save: " + uploadError.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "✨ Submit my drawing";
    return;
  }

  const { data: urlData } = supabase.storage.from("drawings").getPublicUrl(fileName);

  await supabase.from("drawing_submissions").insert({
    author_id: currentUser.id,
    template_key: selectedTemplateKey,
    image_url: urlData.publicUrl,
    storage_path: fileName,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "✨ Submit my drawing";
  await loadGallery();
}

async function loadGallery() {
  const grid = document.getElementById("gallery-grid");
  const countEl = document.getElementById("gallery-count");

  const { data, error } = await supabase
    .from("drawing_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    countEl.textContent = "Couldn't load the gallery.";
    return;
  }

  countEl.textContent = `${data.length} drawing${data.length === 1 ? "" : "s"} shared so far.`;

  grid.innerHTML = data.map((d) => {
    const author = profilesById[d.author_id]?.nickname || "Someone";
    const isMine = d.author_id === currentUser.id;
    return `
      <div class="draw-card">
        ${isMine ? `<button class="del" data-delete-id="${d.id}" data-delete-path="${d.storage_path}">🗑️</button>` : ""}
        <img src="${d.image_url}" alt="drawing" />
        <div class="who">${escapeHtml(author)}</div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteDrawing(btn.dataset.deleteId, btn.dataset.deletePath));
  });
}

async function deleteDrawing(id, path) {
  const confirmed = confirm("Delete this drawing?");
  if (!confirmed) return;

  if (path) await supabase.storage.from("drawings").remove([path]);
  await supabase.from("drawing_submissions").delete().eq("id", id);
  await loadGallery();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Template line-art (hand-drawn shapes) ----------

function drawFlower(ctx, w, h, scale = 1) {
  ctx.strokeStyle = "#555"; ctx.lineWidth = 5 * scale; ctx.lineJoin = "round";
  const cx = w / 2, cy = h / 2 - 20 * scale;
  ctx.beginPath(); ctx.moveTo(cx, cy + 40 * scale); ctx.lineTo(cx, h - 30 * scale); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx - 25 * scale, h - 70 * scale, 18 * scale, 8 * scale, Math.PI / 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx + 25 * scale, h - 90 * scale, 18 * scale, 8 * scale, -Math.PI / 4, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(angle) * 35 * scale, py = cy + Math.sin(angle) * 35 * scale;
    ctx.beginPath(); ctx.ellipse(px, py, 22 * scale, 14 * scale, angle, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, 18 * scale, 0, Math.PI * 2); ctx.stroke();
}

function drawHeart(ctx, w, h, scale = 1) {
  ctx.strokeStyle = "#555"; ctx.lineWidth = 5 * scale;
  const cx = w / 2, cy = h / 2;
  function heartPath(s) {
    ctx.beginPath();
    const topY = cy - 40 * s;
    ctx.moveTo(cx, cy + 60 * s);
    ctx.bezierCurveTo(cx - 90 * s, cy - 10 * s, cx - 50 * s, topY - 40 * s, cx, topY + 10 * s);
    ctx.bezierCurveTo(cx + 50 * s, topY - 40 * s, cx + 90 * s, cy - 10 * s, cx, cy + 60 * s);
    ctx.stroke();
  }
  heartPath(scale); heartPath(0.5 * scale);
}

function drawCat(ctx, w, h, scale = 1) {
  ctx.strokeStyle = "#555"; ctx.lineWidth = 5 * scale;
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, 60 * scale, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 50 * scale, cy - 40 * scale); ctx.lineTo(cx - 65 * scale, cy - 85 * scale); ctx.lineTo(cx - 20 * scale, cy - 55 * scale); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 50 * scale, cy - 40 * scale); ctx.lineTo(cx + 65 * scale, cy - 85 * scale); ctx.lineTo(cx + 20 * scale, cy - 55 * scale); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - 22 * scale, cy - 5 * scale, 8 * scale, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 22 * scale, cy - 5 * scale, 8 * scale, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 6 * scale, cy + 15 * scale); ctx.lineTo(cx + 6 * scale, cy + 15 * scale); ctx.lineTo(cx, cy + 24 * scale); ctx.closePath(); ctx.stroke();
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 30 * scale, cy + (10 + i * 8) * scale);
      ctx.lineTo(cx + side * 70 * scale, cy + (2 + i * 8) * scale);
      ctx.stroke();
    }
  });
}

function drawHouse(ctx, w, h, scale = 1) {
  ctx.strokeStyle = "#555"; ctx.lineWidth = 5 * scale;
  const cx = w / 2, cy = h / 2 + 20 * scale, bw = 140 * scale, bh = 100 * scale;
  ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
  ctx.beginPath(); ctx.moveTo(cx - bw / 2 - 15 * scale, cy - bh / 2); ctx.lineTo(cx, cy - bh / 2 - 70 * scale); ctx.lineTo(cx + bw / 2 + 15 * scale, cy - bh / 2); ctx.stroke();
  ctx.strokeRect(cx - 18 * scale, cy + bh / 2 - 55 * scale, 36 * scale, 55 * scale);
  ctx.strokeRect(cx - bw / 2 + 15 * scale, cy - bh / 2 + 15 * scale, 30 * scale, 30 * scale);
  ctx.strokeRect(cx + bw / 2 - 45 * scale, cy - bh / 2 + 15 * scale, 30 * scale, 30 * scale);
  ctx.strokeRect(cx + 40 * scale, cy - bh / 2 - 60 * scale, 20 * scale, 35 * scale);
}

function drawRainbow(ctx, w, h, scale = 1) {
  ctx.strokeStyle = "#555"; ctx.lineWidth = 4 * scale;
  const cx = w / 2, cy = h / 2 + 70 * scale;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (90 - i * 16) * scale, Math.PI, 0);
    ctx.stroke();
  }
  [cx - 95 * scale, cx + 95 * scale].forEach((x) => {
    ctx.beginPath(); ctx.arc(x, cy, 20 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 15 * scale, cy + 5 * scale, 14 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 15 * scale, cy + 5 * scale, 14 * scale, 0, Math.PI * 2); ctx.stroke();
  });
}

function drawMoonStars(ctx, w, h, scale = 1) {
  ctx.strokeStyle = "#555"; ctx.lineWidth = 5 * scale;
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, 50 * scale, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 25 * scale, cy - 10 * scale, 45 * scale, 0, Math.PI * 2); ctx.stroke();
  function star(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.3, y - s * 0.3); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.3, y + s * 0.3);
    ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.3, y + s * 0.3); ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.3, y - s * 0.3);
    ctx.closePath(); ctx.stroke();
  }
  star(cx - 90 * scale, cy - 60 * scale, 14 * scale);
  star(cx + 90 * scale, cy + 50 * scale, 10 * scale);
  star(cx - 70 * scale, cy + 70 * scale, 8 * scale);
}
