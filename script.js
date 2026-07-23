document.addEventListener('DOMContentLoaded', () => {
    // 1. Grouped Slide Data containing all 5 requested text points
    const slides = [
        {
            tag: "A Mobile & App Development Company",
            headline: "Thinking together,<br>creating together.",
            subtitle: "Joint prototype development."
        },
        {
            tag: "Bringing brands, influencers & customers together",
            headline: "Taking digital technology<br>to new heights.",
            subtitle: "Joint prototype development."
        },
        {
            tag: "A Mobile & App Development Company",
            headline: "Turn Ideas<br>into reality.",
            subtitle: "Bringing brands, influencers & customers together."
        }
    ];

    let currentIndex = 0;
    let autoPlayTimer = null;
    const INTERVAL_TIME = 5000; // 5 Seconds Auto-Play Interval

    // DOM Elements
    const heroTag = document.querySelector('.hero-tag span');
    const heroHeadline = document.querySelector('.hero-headline');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const heroContent = document.querySelector('.hero-content');
    const inkCanvas = document.getElementById('ink-canvas');

    // Function to update content with smooth fade-out and fade-in
    function updateSlide(nextIndex) {
        if (!heroContent) return;

        // Step 1: Add fade-out class to trigger CSS transition
        heroContent.classList.add('fade-out');

        // Step 2: After transition finishes, change text and fade back in
        setTimeout(() => {
            currentIndex = nextIndex;
            const currentSlide = slides[currentIndex];

            if (heroTag) heroTag.textContent = currentSlide.tag;
            if (heroHeadline) heroHeadline.innerHTML = currentSlide.headline;
            if (heroSubtitle) heroSubtitle.textContent = currentSlide.subtitle;

            // Remove fade-out class to trigger fade-in animation
            heroContent.classList.remove('fade-out');
        }, 350); // 350ms matches CSS transition time
    }

    function nextSlide() {
        const newIndex = (currentIndex + 1) % slides.length;
        updateSlide(newIndex);
    }

    // Auto-Rotate System (5 seconds interval)
    function startAutoPlay() {
        stopAutoPlay();
        autoPlayTimer = setInterval(nextSlide, INTERVAL_TIME);
    }

    function stopAutoPlay() {
        if (autoPlayTimer) {
            clearInterval(autoPlayTimer);
            autoPlayTimer = null;
        }
    }

    // Manual Override Sync: Triggers immediately when 3D scene/arrow is clicked
    function handleManualInteraction() {
        nextSlide();
        startAutoPlay(); // Reset 5-second timer
    }

    // Attach Event Listeners on canvas
    if (inkCanvas) {
        inkCanvas.addEventListener('click', handleManualInteraction);
    }

    // Start Auto-Play System
    startAutoPlay();
});