/** Gold confetti burst (CSS only). Respects prefers-reduced-motion via CSS. */
export function confetti(n = 28) {
  const host = document.createElement("div"); host.className = "confetti";
  const colors = ["#e6c87a", "#c9a24a", "#fff3c4", "#8c6c25", "#f4f1ea"];
  for (let i = 0; i < n; i++) { const el = document.createElement("i"); el.style.left = Math.random() * 100 + "vw"; el.style.setProperty("--c", colors[i % colors.length]); el.style.setProperty("--d", 1.2 + Math.random() * 1.2 + "s"); el.style.setProperty("--r", Math.random() * 360 + "deg"); el.style.animationDelay = Math.random() * 0.4 + "s"; host.appendChild(el); }
  document.body.appendChild(host); setTimeout(() => host.remove(), 3000);
}
