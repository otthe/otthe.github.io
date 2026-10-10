
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const app = document.getElementById("viewer-app");
    const error = document.getElementById("viewer-error");

    try {
        const params = new URLSearchParams(
            window.location.hash.slice(1)
        );

        const encoded = params.get("data");

        if (!encoded) {
            throw new Error("No slideshow data in URL");
        }

        const data = decodeSlideshow(encoded);

        if (
            data.version !== 1 ||
            !Array.isArray(data.slides) ||
            data.slides.length === 0
        ) {
            throw new Error("Unsupported or empty slideshow");
        }

        // Restore the data while retaining defaults for older slides.
        slideshow.settings = data.settings || slideshow.settings;
        slideshow.slides = data.slides.map(slide => ({
            ...createSlide(slide),
            ...slide
        }));

        currentSlideIndex = 0;

        app.hidden = false;
        renderPreview();
        updateViewerNavigation();

    } catch (err) {
        console.error("Could not load slideshow:", err);
        error.hidden = false;
    }

    // document.getElementById("viewer-previous")
    //     .addEventListener("click", () => {
    //         if (currentSlideIndex > 0) {
    //             currentSlideIndex--;
    //             renderPreview();
    //             updateViewerNavigation();
    //         }
    //     });

    // document.getElementById("viewer-next")
    //     .addEventListener("click", () => {
    //         if (currentSlideIndex < slideshow.slides.length - 1) {
    //             currentSlideIndex++;
    //             renderPreview();
    //             updateViewerNavigation();
    //         }
    //     });

    //todo:
    document.getElementById("viewer-previous")
        .addEventListener("click", () => goToSlide(currentSlideIndex - 1));

    document.getElementById("viewer-next")
        .addEventListener("click", () => goToSlide(currentSlideIndex + 1));

    document.getElementById("viewer-fullscreen")
        .addEventListener("click", async () => {
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (err) {
                console.error("Full-screen mode is unavailable:", err);
            }
        });

    // document.addEventListener("keydown", event => {
    //     if (event.key === "ArrowRight") {
    //         document.getElementById("viewer-next").click();
    //     }

    //     if (event.key === "ArrowLeft") {
    //         document.getElementById("viewer-previous").click();
    //     }
    // });

    //todo:
    document.addEventListener("keydown", event => {
        // Don't intercept keyboard shortcuts while typing in a control.
        if (
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement
        ) {
            return;
        }

        if (["ArrowRight", "ArrowDown", " "].includes(event.key)) {
            event.preventDefault();
            document.getElementById("viewer-next").click();
        }

        if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            document.getElementById("viewer-previous").click();
        }
    });

    initSwipe();

});

function updateViewerNavigation() {
    document.getElementById("viewer-counter").textContent =
        `${currentSlideIndex + 1} / ${slideshow.slides.length}`;

    document.getElementById("viewer-previous").disabled =
        currentSlideIndex === 0;

    document.getElementById("viewer-next").disabled =
        currentSlideIndex === slideshow.slides.length - 1;

    document.getElementById("viewer-fullscreen").textContent =
        document.fullscreenElement ? "Exit full screen" : "Full screen";
}

document.addEventListener("fullscreenchange", () => {
    const button = document.getElementById("viewer-fullscreen");
    if (button) {
        button.textContent =
            document.fullscreenElement ? "Exit full screen" : "Full screen";
    }

    if (document.fullscreenElement) {
        console.log(`Element: ${document.fullscreenElement.id} entered fullscreen mode.`);
        document.querySelector('.viewer-toolbar').style.display = "none";
      } else {
        console.log("Leaving fullscreen mode.");
        document.querySelector('.viewer-toolbar').style.display = "flex";
    }
});



/*
|--------------------------------------------------------------------------
| Slide transitions
|--------------------------------------------------------------------------
*/

const TRANSITION_OUT_MS = 180;
const TRANSITION_IN_MS = 220;

// dir: 1 = moving forward, -1 = moving back
const TRANSITIONS = {
    fade: {
        out: () => [{ opacity: 1 }, { opacity: 0 }],
        in:  () => [{ opacity: 0 }, { opacity: 1 }]
    },
    slide: {
        out: dir => [
            { opacity: 1, transform: "translateX(0)" },
            { opacity: 0, transform: `translateX(${-dir * 8}%)` }
        ],
        in: dir => [
            { opacity: 0, transform: `translateX(${dir * 8}%)` },
            { opacity: 1, transform: "translateX(0)" }
        ]
    },
    none: null
};

let transitionPhase = "idle";   // "idle" | "out" | "in"
let transitionToken = 0;
let transitionDirection = 1;

function getTransitionName() {
    const name = slideshow.settings && slideshow.settings.transition;
    return name in TRANSITIONS ? name : "fade";
}

async function goToSlide(index) {
    if (
        index < 0 ||
        index >= slideshow.slides.length ||
        index === currentSlideIndex
    ) {
        return;
    }

    // Update state and the counter immediately so rapid key presses
    // keep counting from the right slide.
    transitionDirection = index > currentSlideIndex ? 1 : -1;
    currentSlideIndex = index;
    updateViewerNavigation();

    // Mid fade-out: the swap below will pick up the latest index.
    if (transitionPhase === "out") {
        return;
    }

    const preview = document.getElementById("slide-preview");
    const transition = TRANSITIONS[getTransitionName()];

    const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!transition || reduceMotion || typeof preview.animate !== "function") {
        transitionToken++;
        transitionPhase = "idle";
        renderPreview();
        return;
    }

    // Interrupt a fade-in that is still running.
    preview.getAnimations().forEach(animation => animation.cancel());

    const token = ++transitionToken;
    transitionPhase = "out";

    const outAnimation = preview.animate(
        transition.out(transitionDirection),
        { duration: TRANSITION_OUT_MS, easing: "ease-in", fill: "forwards" }
    );

    try {
        await outAnimation.finished;
    } catch {
        return;
    }

    if (token !== transitionToken) {
        return;
    }

    // Swap content while the slide is invisible, then animate it in.
    renderPreview();

    const inAnimation = preview.animate(
        transition.in(transitionDirection),
        { duration: TRANSITION_IN_MS, easing: "ease-out" }
    );

    outAnimation.cancel();
    transitionPhase = "in";

    try {
        await inAnimation.finished;
    } catch {
        return;
    }

    if (token === transitionToken) {
        transitionPhase = "idle";
    }
}


/*
|--------------------------------------------------------------------------
| Swipe navigation (touch devices)
|--------------------------------------------------------------------------
*/

const SWIPE_MIN_DISTANCE = 50;   // px the finger must travel horizontally
const SWIPE_MAX_TIME = 800;      // ms; slower drags aren't swipes
const SWIPE_DIRECTION_RATIO = 1.5; // horizontal must beat vertical by this

function initSwipe() {
    const stage = document.querySelector(".viewer-stage");

    if (!stage) {
        return;
    }

    let start = null;

    stage.addEventListener("touchstart", event => {
        // Ignore pinch/multi-finger gestures.
        if (event.touches.length !== 1) {
            start = null;
            return;
        }

        const touch = event.touches[0];

        start = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
    }, { passive: true });

    stage.addEventListener("touchmove", event => {
        // A second finger joined: cancel the swipe.
        if (event.touches.length > 1) {
            start = null;
        }
    }, { passive: true });

    stage.addEventListener("touchend", event => {
        if (!start) {
            return;
        }

        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        const elapsed = Date.now() - start.time;

        start = null;

        const isHorizontalSwipe =
            Math.abs(dx) >= SWIPE_MIN_DISTANCE &&
            Math.abs(dx) > Math.abs(dy) * SWIPE_DIRECTION_RATIO &&
            elapsed <= SWIPE_MAX_TIME;

        if (!isHorizontalSwipe) {
            return;
        }

        // Swipe left = next slide, swipe right = previous slide.
        goToSlide(currentSlideIndex + (dx < 0 ? 1 : -1));
    }, { passive: true });

    stage.addEventListener("touchcancel", () => {
        start = null;
    }, { passive: true });
}