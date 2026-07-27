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

    // =========================================================
    // CAROUSEL CONTROLS
    // One dot per card (not per "page"), since card width changes
    // responsively — simpler and stays correct across breakpoints
    // without recalculating page groups on resize.
    // =========================================================
    const track = document.querySelector('.stats-carousel-track');
    const prevBtn = document.querySelector('.stats-carousel-arrow--prev');
    const nextBtn = document.querySelector('.stats-carousel-arrow--next');
    const dotsContainer = document.querySelector('.stats-carousel-dots');
    if (!track) return;

    const cards = Array.from(statCards);

    // --- Build dots ---
    const dots = cards.map((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Go to stat ${i + 1}`);
        dot.addEventListener('click', () => {
            track.scrollTo({ left: cards[i].offsetLeft - track.offsetLeft, behavior: 'smooth' });
        });
        dotsContainer?.appendChild(dot);
        return dot;
    });

    function updateActiveState() {
        // The "active" card is whichever one's left edge is closest to the
        // track's current scroll position (i.e. the leading visible card).
        const trackLeft = track.scrollLeft;
        let closestIndex = 0;
        let closestDist = Infinity;
        cards.forEach((card, i) => {
            const dist = Math.abs((card.offsetLeft - track.offsetLeft) - trackLeft);
            if (dist < closestDist) {
                closestDist = dist;
                closestIndex = i;
            }
        });
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === closestIndex));

        // Disable arrows at the very start/end (a couple px of tolerance
        // for sub-pixel scroll rounding across browsers)
        const maxScroll = track.scrollWidth - track.clientWidth;
        if (prevBtn) prevBtn.disabled = trackLeft <= 2;
        if (nextBtn) nextBtn.disabled = trackLeft >= maxScroll - 2;
    }

    // --- Arrow navigation: step by one card's width + the track gap ---
    function stepBy(direction) {
        const cardWidth = cards[0]?.getBoundingClientRect().width || 0;
        const gap = parseFloat(getComputedStyle(track).gap) || 0;
        track.scrollBy({ left: direction * (cardWidth + gap), behavior: 'smooth' });
    }
    prevBtn?.addEventListener('click', () => stepBy(-1));
    nextBtn?.addEventListener('click', () => stepBy(1));

    // --- Drag-to-scroll (mouse/touch via Pointer Events) ---
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let dragMoved = false;

    track.addEventListener('pointerdown', (e) => {
        isDragging = true;
        dragMoved = false;
        dragStartX = e.clientX;
        dragStartScroll = track.scrollLeft;
        track.classList.add('is-dragging');
        track.setPointerCapture(e.pointerId);
    });

    track.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const delta = e.clientX - dragStartX;
        if (Math.abs(delta) > 4) dragMoved = true; // small threshold so a plain click/tap isn't treated as a drag
        track.scrollLeft = dragStartScroll - delta;
    });

    function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        track.classList.remove('is-dragging');
        try { track.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', () => { if (isDragging) isDragging = false; track.classList.remove('is-dragging'); });

    // A drag that actually moved the track shouldn't also fire a click on
    // whatever card was under the pointer when it was released.
    track.addEventListener('click', (e) => {
        if (dragMoved) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    // Keep dots/arrows in sync as the user scrolls (drag, arrows, touch, or
    // native trackpad/wheel scroll all funnel through the same 'scroll' event)
    let scrollRaf = null;
    track.addEventListener('scroll', () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
            updateActiveState();
            scrollRaf = null;
        });
    });

    window.addEventListener('resize', updateActiveState);
    updateActiveState();
});
