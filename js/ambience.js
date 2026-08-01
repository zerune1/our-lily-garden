const LILY_EMOJIS = ["🌸", "🌷", "💮", "🏵️"];

export function setupAmbience({ starCount = 60, fireflyCount = 8, lilyCount = 12 } = {}) {
  const skyLayer = document.querySelector(".sky-layer");
  const liliesLayer = document.querySelector(".lilies-layer");

  if (skyLayer) {
    for (let i = 0; i < starCount; i++) {
      const s = document.createElement("div");
      s.className = "star";
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 60 + "%";
      s.style.animationDelay = Math.random() * 3 + "s";
      s.style.animationDuration = 2 + Math.random() * 3 + "s";
      skyLayer.appendChild(s);
    }
    for (let i = 0; i < fireflyCount; i++) {
      const f = document.createElement("div");
      f.className = "firefly";
      f.style.left = 10 + Math.random() * 80 + "%";
      f.style.top = 40 + Math.random() * 45 + "%";
      f.style.animationDelay = Math.random() * 8 + "s";
      f.style.animationDuration = 10 + Math.random() * 8 + "s";
      skyLayer.appendChild(f);
    }
  }

  if (liliesLayer) {
    for (let i = 0; i < lilyCount; i++) {
      const l = document.createElement("div");
      l.className = "lily";
      l.textContent = LILY_EMOJIS[Math.floor(Math.random() * LILY_EMOJIS.length)];
      l.style.left = Math.random() * 100 + "%";
      l.style.fontSize = 16 + Math.random() * 18 + "px";
      l.style.animationDuration = 12 + Math.random() * 10 + "s";
      l.style.animationDelay = Math.random() * 12 + "s";
      liliesLayer.appendChild(l);
    }
  }
}
