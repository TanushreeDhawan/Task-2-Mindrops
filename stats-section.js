document.addEventListener('DOMContentLoaded', () => {
    const statCards = document.querySelectorAll('.stat-card');
    if (!statCards.length) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DURATION = 1600; // ms

    // Ease-out curve so numbers settle rather than land abruptly
    function easeOutQuint(t) {
        return 1 - Math.pow(1 - t, 5);
    }

    function animateCount(card) {
        const valueEl = card.querySelector('.count-value');
        if (!valueEl) return;

        const target = parseInt(card.dataset.count, 10) || 0;

        if (prefersReducedMotion) {
            valueEl.textContent = target.toLocaleString();
            return;
        }

        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / DURATION, 1);
            const eased = easeOutQuint(progress);
            const current = Math.round(target * eased);
            valueEl.textContent = current.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                valueEl.textContent = target.toLocaleString();
            }
        }

        requestAnimationFrame(tick);
    }

    // Single observer, unobserves each card once triggered — no ongoing work
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const card = entry.target;
            card.classList.add('is-visible');
            animateCount(card);
            observer.unobserve(card);
        });
    }, {
        threshold: 0.35
    });

    statCards.forEach((card) => observer.observe(card));
});
