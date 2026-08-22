const reel = document.querySelector(".reel");
const veil = document.querySelector(".reel-veil");
const slots = Array.from(document.querySelectorAll(".clip-slot"));
const videos = slots.map((slot) => slot.querySelector(".clip-video"));

// Crossfade duration is read from CSS (--crossfade) so the two stay in sync —
// change it in one place (style.css) and both the fade and its timing follow.
const CROSSFADE_MS = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--crossfade")) || 2.6) * 1000;

const HOLD_MS = 16000; // how long each clip stays on screen before crossfading

// How long the cinematic push itself runs — kept comfortably longer than a
// clip's actual time on screen (HOLD_MS + the crossfade in and out) so the
// motion is still gliding, never completing and stalling, while it's visible.
const DRIFT_MS = HOLD_MS + CROSSFADE_MS * 2 + 3000;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Each clip gets its own bespoke, one-directional push — sized and aimed at
// what's actually in that footage — instead of a generic zoom/pan. A slow,
// monotonic move (never reversing, never fighting the footage's own camera
// motion) is what reads as "cinematic slide" instead of "shaky."
const playlist = [
	{
		// Misty ridge line: a slow rise toward the peak.
		src: "videos/misty-mountains.mp4",
		from: "scale(1.02) translate3d(0, 0, 0)",
		to: "scale(1.09) translate3d(0, -1%, 0)",
	},
	{
		// Aerial over forest canopy: gentle forward glide, matching its own drift.
		src: "videos/cloud-forest-aerial.mp4",
		from: "scale(1.03) translate3d(0, 0, 0)",
		to: "scale(1.1) translate3d(-0.8%, 0.6%, 0)",
	},
	{
		// Creek receding into the frame: a straight push toward the light.
		src: "videos/creek-steam.mp4",
		from: "scale(1.01) translate3d(0, 0, 0)",
		to: "scale(1.08) translate3d(0, -0.6%, 0)",
	},
	{
		// Misty forest: a slow lateral reveal through the haze.
		src: "videos/forest-morning-mist.mp4",
		from: "scale(1.02) translate3d(0, 0, 0)",
		to: "scale(1.09) translate3d(0.6%, 0, 0)",
	},
	{
		// Sunburst through branches: kept almost still — any pan makes a lens
		// flare look unstable, so this is a bare, faint creep.
		src: "videos/sunlight-through-branches.mp4",
		from: "scale(1) translate3d(0, 0, 0)",
		to: "scale(1.05) translate3d(0, 0, 0)",
	},
	{
		// Between tree trunks: a slow push deeper into the forest.
		src: "videos/ancient-cold-mossy-forest.mp4",
		from: "scale(1.02) translate3d(0, 0, 0)",
		to: "scale(1.1) translate3d(0, -0.8%, 0)",
	},
];

let activeIndex = 0; // which of the two slots is currently visible
let order = 0; // position in the playlist, wraps via modulo

function driftClip(video, item) {
	if (reduceMotion) {
		video.style.transition = "none";
		video.style.transform = "none";
		return;
	}
	// Snap to the start with no transition, force layout, then trigger the
	// transition to the end point. Every showing starts fresh at the same
	// point and moves in the same direction — it never picks up mid-cycle
	// and never reverses, which is what was reading as a "shake" before.
	video.style.transition = "none";
	video.style.transform = item.from;
	void video.offsetWidth;
	requestAnimationFrame(() => {
		video.style.transition = `transform ${DRIFT_MS}ms ease-in-out`;
		video.style.transform = item.to;
	});
}

function loadClip(video, item) {
	return new Promise((resolve) => {
		const onReady = () => resolve();
		video.addEventListener("canplay", onReady, { once: true });
		video.addEventListener("error", () => {
			reel.classList.add("is-static");
			resolve();
		}, { once: true });
		video.loop = true;
		video.src = item.src;
		video.load();
	});
}

async function start() {
	await loadClip(videos[0], playlist[0]);
	driftClip(videos[0], playlist[0]);
	slots[0].classList.add("is-active");
	videos[0].play().catch(() => reel.classList.add("is-static"));

	order = 1;
	await loadClip(videos[1], playlist[order % playlist.length]);

	scheduleNext();
}

function scheduleNext() {
	setTimeout(advance, HOLD_MS);
}

async function advance() {
	const incomingVideo = videos[(activeIndex + 1) % 2];
	const incomingSlot = slots[(activeIndex + 1) % 2];
	const outgoingSlot = slots[activeIndex];
	const outgoingVideo = videos[activeIndex];
	const item = playlist[order % playlist.length];

	driftClip(incomingVideo, item);
	incomingVideo.currentTime = 0;
	try {
		await incomingVideo.play();
	} catch {
		reel.classList.add("is-static");
	}

	// A brief dip-and-recover in brightness, timed to the crossfade, so a
	// dark-to-bright (or bright-to-dark) clip change reads as an intentional
	// beat rather than a jarring exposure jump.
	veil.classList.add("is-boosted");
	setTimeout(() => veil.classList.remove("is-boosted"), CROSSFADE_MS * 0.4);

	incomingSlot.classList.add("is-active");
	outgoingSlot.classList.remove("is-active");
	activeIndex = (activeIndex + 1) % 2;
	order += 1;

	// Wait for the outgoing clip's fade-out to fully finish before reusing its
	// element for the clip after next — reloading its src mid-fade would blank
	// it to black before it's actually invisible, which reads as a stutter.
	setTimeout(() => {
		loadClip(outgoingVideo, playlist[order % playlist.length]);
	}, CROSSFADE_MS + 100);

	scheduleNext();
}

start();
