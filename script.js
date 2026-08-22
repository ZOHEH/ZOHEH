const cutout = document.querySelector(".cutout");
const eyebrow = document.querySelector(".eyebrow");
const tagline = document.querySelector(".tagline");
const footerCredit = document.querySelector(".footer-credit");
const reel = document.querySelector(".reel");
const veil = document.querySelector(".reel-veil");
const slots = Array.from(document.querySelectorAll(".clip-slot"));
const videos = slots.map((slot) => slot.querySelector(".clip-video"));

// Crossfade duration is read from CSS (--crossfade) so the two stay in sync —
// change it in one place (style.css) and both the fade and its timing follow.
const CROSSFADE_MS = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--crossfade")) || 2.6) * 1000;

const HOLD_MS = 16000; // how long each clip stays on screen before crossfading, at most

// Several source clips are shorter than HOLD_MS. Since they're set to loop,
// staying on screen for the full HOLD_MS would mean sitting through a hard
// cut back to frame 0 mid-view — which is what was reading as a "jump" on
// the shorter clips. Never show a clip longer than (its own length - a
// buffer), so we're always gone via crossfade before it ever has to loop.
function holdFor(video) {
	const durationMs = video.duration * 1000;
	if (!isFinite(durationMs) || durationMs <= 0) return HOLD_MS;
	return Math.min(HOLD_MS, Math.max(4000, Math.round(durationMs) - 500));
}

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
let lastSrc = null; // the clip currently (or about to be) on screen — never repeated back-to-back

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

// Resolves once the video is confirmed actually rendering frames (not just
// "play() was called") — with a safety timeout so a blocked/slow autoplay
// can never leave the page stuck dark.
function whenPlaying(video) {
	return new Promise((resolve) => {
		if (!video.paused && video.readyState >= 3) {
			resolve();
			return;
		}
		video.addEventListener("playing", resolve, { once: true });
		setTimeout(resolve, 1200);
	});
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The eyebrow and the wordmark begin appearing together — a matched
// simultaneous reveal, both starting right after the same opening beat on
// plain black — with the tagline and credit line trailing afterward once the
// wordmark's own reveal is well underway.
const TAGLINE_DELAY_MS = 2200; // after the wordmark starts revealing
const FOOTER_DELAY_MS = 2900;

async function start() {
	// A brief opening beat on plain black before anything starts, regardless
	// of how fast the clip loads.
	await wait(300);
	requestAnimationFrame(() => eyebrow.classList.add("is-revealed"));

	await loadClip(videos[0], playlist[0]);
	driftClip(videos[0], playlist[0]);
	slots[0].classList.add("is-active");
	let playable = true;
	try {
		await videos[0].play();
	} catch {
		playable = false;
		reel.classList.add("is-static");
	}
	if (playable) await whenPlaying(videos[0]);

	// The wordmark and the footage inside it only appear together, once a
	// frame is actually on screen — never the letter shape first and the
	// image a moment later.
	requestAnimationFrame(() => cutout.classList.add("is-revealed"));

	// Tagline and credit close out after the wordmark's own reveal is well underway.
	setTimeout(() => tagline.classList.add("is-revealed"), TAGLINE_DELAY_MS);
	setTimeout(() => footerCredit.classList.add("is-revealed"), FOOTER_DELAY_MS);

	lastSrc = playlist[0].src;

	order = 1;
	await loadClip(videos[1], playlist[order % playlist.length]);

	scheduleNext(holdFor(videos[0]));
}

function scheduleNext(ms) {
	setTimeout(advance, ms);
}

async function advance() {
	const incomingVideo = videos[(activeIndex + 1) % 2];
	const incomingSlot = slots[(activeIndex + 1) % 2];
	const outgoingSlot = slots[activeIndex];
	const outgoingVideo = videos[activeIndex];

	// Guaranteed never to repeat the clip currently on screen, however `order`
	// got here — not just because a plain round-robin happens not to.
	let item = playlist[order % playlist.length];
	while (item.src === lastSrc) {
		order += 1;
		item = playlist[order % playlist.length];
	}
	lastSrc = item.src;

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

	scheduleNext(holdFor(incomingVideo));
}

// If the browser restores this page from its back/forward cache — e.g. the
// visitor navigated away and hit "back" — it resumes the exact in-memory
// state instead of re-running the page, so the reveal would already be long
// finished and the video mid-cycle rather than starting over. Force a real
// reload so every visit, fresh or restored, always plays from the beginning.
window.addEventListener("pageshow", (event) => {
	if (event.persisted) {
		location.reload();
	}
});

start();
