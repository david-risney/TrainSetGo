// "Now playing" status widget: a spinning disc, the current song + artist, a Next button,
// and a music mute toggle. It is a small reusable component mounted into a screen's status
// bar (overworld + in-game). It subscribes to the AudioView's music changes so the title
// and spin state stay in sync, and unsubscribes on dispose. (User: now-playing status)

import { button, el } from "./dom.js";

export function createNowPlaying(app) {
  const audio = app.audio;

  const disc = el("span", {
    class: "np-disc",
    "data-testid": "np-disc",
    "aria-hidden": "true",
    text: "💿",
  });

  const label = el("span", { class: "np-label", "data-testid": "np-label" });

  const nextBtn = button("⏭", {
    class: "btn np-btn",
    "data-testid": "np-next",
    title: "Next track",
    "aria-label": "Next track",
    onClick: () => audio.nextTrack(),
  });

  const muteBtn = button("🔊", {
    class: "btn np-btn",
    "data-testid": "np-mute",
    title: "Mute music",
    "aria-label": "Mute music",
    onClick: () => app.updateSettings({ musicMuted: !audio.isMusicMuted() }),
  });

  const root = el("div", { class: "now-playing", "data-testid": "now-playing" }, [
    disc,
    label,
    nextBtn,
    muteBtn,
  ]);

  function refresh() {
    const track = audio.nowPlaying();
    label.textContent = track ? `${track.title} — ${track.author}` : "—";
    label.title = label.textContent;

    const muted = audio.isMusicMuted();
    // The disc spins only while music is actually audible.
    disc.classList.toggle("paused", !audio.isMusicPlaying());
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.title = muted ? "Unmute music" : "Mute music";
    muteBtn.setAttribute("aria-label", muteBtn.title);
    root.setAttribute("data-muted", String(muted));
  }

  const unsubscribe = audio.onMusicChange(refresh);
  refresh();

  return { el: root, dispose: unsubscribe };
}
