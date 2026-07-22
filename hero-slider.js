/* ==========================================================================
   HERO TEXT TRANSITION SYSTEM
   Hybrid auto-play + manual click sync for the hero section text block.

   - Groups the 5 supplied text points into 3 slide objects (tag/title/desc).
   - Auto-rotates every 5s with a smooth fade-out -> swap -> fade-in.
   - Listens for clicks on the arrow buttons inside the <spline-viewer> 3D
     scene and, on click, immediately advances the slide + resets the timer,
     so manual interaction and auto-play never fight each other.
   ========================================================================== */

(function () {
    "use strict";

    /* ----------------------------------------------------------------------
       1. SLIDE DATA
       The 5 requested text points are distributed across 3 logical slides.
       Each slide has: tag (pill text), title (headline), desc (subtitle).
    ---------------------------------------------------------------------- */
    const slides = [
        {
            tag: "Joint Prototype Development",
            title: "Thinking together,<br>creating together.",
            desc: "Taking digital technology to new heights."
        },
        {
            tag: "A Mobile & App Development Company",
            title: "Turn Ideas into reality.",
            desc: "From concept to launch, we engineer mobile and web experiences built to scale."
        },
        {
            tag: "Brand & Influencer Marketing",
            title: "Bringing brands, influencers<br>&amp; customers together.",
            desc: "We connect audiences and communities through campaigns that convert."
        }
    ];

    /* ----------------------------------------------------------------------
       2. DOM REFERENCES
    ---------------------------------------------------------------------- */
    const tagEl = document.getElementById("heroTag");
    const titleEl = document.getElementById("heroHeadline");
    const descEl = document.getElementById("heroSubtitle");
    const splineViewer = document.querySelector("spline-viewer");

    // Bail out gracefully if the hero markup isn't present on this page.
    if (!tagEl || !titleEl || !descEl) {
        return;
    }

    const FADE_DURATION = 500;   // must match the CSS transition duration (0.5s)
    const AUTO_ROTATE_INTERVAL = 5000; // 5 seconds, per requirement

    let currentIndex = 0;
    let autoRotateTimer = null;

    /* ----------------------------------------------------------------------
       3. CORE RENDER FUNCTION
       Fades the text out, swaps the content, then fades it back in.
       Shared by both the auto-rotate timer and the manual Spline click sync.
    ---------------------------------------------------------------------- */
    function renderSlide(index) {
        // Step 1: fade out current text
        tagEl.classList.add("hero-fade-out");
        titleEl.classList.add("hero-fade-out");
        descEl.classList.add("hero-fade-out");

        // Step 2: after the fade-out finishes, swap the copy and fade back in
        window.setTimeout(function () {
            const slide = slides[index];
            tagEl.innerHTML = slide.tag;
            titleEl.innerHTML = slide.title;
            descEl.innerHTML = slide.desc;

            // Removing the class triggers the reverse (fade-in) transition
            tagEl.classList.remove("hero-fade-out");
            titleEl.classList.remove("hero-fade-out");
            descEl.classList.remove("hero-fade-out");
        }, FADE_DURATION);
    }

    function goToSlide(index) {
        currentIndex = index;
        renderSlide(currentIndex);
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % slides.length;
        renderSlide(currentIndex);
    }

    /* ----------------------------------------------------------------------
       4. AUTO-ROTATE (every 5 seconds)
    ---------------------------------------------------------------------- */
    function startAutoRotate() {
        autoRotateTimer = window.setInterval(nextSlide, AUTO_ROTATE_INTERVAL);
    }

    function resetAutoRotate() {
        if (autoRotateTimer) {
            window.clearInterval(autoRotateTimer);
        }
        startAutoRotate();
    }

    /* ----------------------------------------------------------------------
       5. MANUAL OVERRIDE SYNC — listens for arrow/button clicks inside the
          Spline 3D scene and immediately advances + resets the auto-timer.

          The Spline viewer web component dispatches its own interaction
          events (not plain DOM clicks) because the scene renders to a
          canvas: "mouseDown", "mouseUp", "mouseHover", etc. Each event's
          `target` is the Spline object that was interacted with, exposing
          its `name` (the object name you gave it inside the Spline editor).

          NOTE: Update the string(s) matched below ("arrow", "next", "btn")
          to match the actual object name(s) of your arrow/button in the
          Spline scene — open the browser console, click your arrow, and
          check the logged name to confirm.
    ---------------------------------------------------------------------- */
    function isNavigationTarget(objectName) {
        if (!objectName) return false;
        const name = objectName.toLowerCase();
        return (
            name.includes("arrow") ||
            name.includes("next") ||
            name.includes("btn") ||
            name.includes("button")
        );
    }

    function handleSplineInteraction(event) {
        const clickedName = event && event.target ? event.target.name : null;

        // Helpful while wiring this up to your specific Spline scene:
        // console.log("Spline object clicked:", clickedName);

        if (isNavigationTarget(clickedName)) {
            nextSlide();       // Sync hero text to the click immediately
            resetAutoRotate(); // Restart the 5s auto-play window from zero
        }
    }

    if (splineViewer) {
        // "mouseDown" is the Spline runtime event fired when a user clicks
        // an interactive object inside the 3D scene (arrows/buttons included).
        splineViewer.addEventListener("mouseDown", handleSplineInteraction);
    }

    /* ----------------------------------------------------------------------
       6. INIT
    ---------------------------------------------------------------------- */
    goToSlide(0);        // Render the first slide's content immediately
    startAutoRotate();   // Kick off the 5-second auto-rotate loop
})();
