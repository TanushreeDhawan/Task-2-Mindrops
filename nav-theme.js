document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar');
    const statsSection = document.querySelector('.stats-section');
    if (!navbar || !statsSection) return;

    // Toggle .dark-nav the moment .stats-section starts entering the viewport
    // from below, and remove it once it has fully scrolled past above.
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            navbar.classList.toggle('dark-nav', entry.isIntersecting);
        });
    }, {
        root: null,
        // Fires as soon as the top edge of .stats-section crosses just below
        // the sticky navbar, and un-fires once it scrolls back below that line.
        rootMargin: '-72px 0px -85% 0px',
        threshold: 0
    });

    observer.observe(statsSection);
});
