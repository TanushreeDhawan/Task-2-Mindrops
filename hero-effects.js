/* =========================================================
   HERO ENHANCEMENT LOGIC
   1. Magnetic + subtle 3D tilt hover for floating tech badges
   2. Mouse-driven parallax for ambient background water drops
   Both run on requestAnimationFrame with lerped values so
   motion stays smooth and never fights the CSS float keyframes
   (which live on a separate parent element).
   Respects prefers-reduced-motion.
   ========================================================= */
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------------------------------------------
       1. MAGNETIC TILT ON TECH BADGES
       --------------------------------------------------- */
    const badgeInners = document.querySelectorAll('.tech-badge-inner');

    if (badgeInners.length && !reduceMotion) {
        const RADIUS = 140;       // px — cursor influence range
        const MAX_OFFSET = 14;    // px — max magnetic pull
        const MAX_TILT = 9;       // deg — max 3D tilt
        const EASE = 0.16;        // lerp speed

        const badgeState = [];
        badgeInners.forEach((el) => {
            badgeState.push({ el, rect: null, tx: 0, ty: 0, trx: 0, try_: 0, x: 0, y: 0, rx: 0, ry: 0 });
        });

        function cacheRects() {
            badgeState.forEach((s) => { s.rect = s.el.getBoundingClientRect(); });
        }
        cacheRects();
        window.addEventListener('resize', cacheRects);
        window.addEventListener('scroll', cacheRects, { passive: true });

        window.addEventListener('pointermove', (e) => {
            badgeState.forEach((s) => {
                if (!s.rect) return;
                const cx = s.rect.left + s.rect.width / 2;
                const cy = s.rect.top + s.rect.height / 2;
                const dx = e.clientX - cx;
                const dy = e.clientY - cy;
                const dist = Math.hypot(dx, dy);

                if (dist < RADIUS) {
                    const strength = 1 - dist / RADIUS;
                    s.tx = (dx / RADIUS) * MAX_OFFSET * strength;
                    s.ty = (dy / RADIUS) * MAX_OFFSET * strength;
                    s.trx = (-dy / RADIUS) * MAX_TILT * strength;
                    s.try_ = (dx / RADIUS) * MAX_TILT * strength;
                    s.el.classList.add('is-active');
                } else {
                    s.tx = 0; s.ty = 0; s.trx = 0; s.try_ = 0;
                    s.el.classList.remove('is-active');
                }
            });
        }, { passive: true });

        (function tick() {
            badgeState.forEach((s) => {
                s.x += (s.tx - s.x) * EASE;
                s.y += (s.ty - s.y) * EASE;
                s.rx += (s.trx - s.rx) * EASE;
                s.ry += (s.try_ - s.ry) * EASE;
                s.el.style.transform =
                    `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) ` +
                    `perspective(600px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg)`;
            });
            requestAnimationFrame(tick);
        })();
    }

    /* ---------------------------------------------------
       2. PARALLAX FOR AMBIENT WATER DROPS
       --------------------------------------------------- */
    const ambientLayer = document.querySelector('.ambient-drops');

    if (ambientLayer && !reduceMotion) {
        const drops = ambientLayer.querySelectorAll('.ambient-drop');
        let mouseX = 0, mouseY = 0, curX = 0, curY = 0;

        window.addEventListener('pointermove', (e) => {
            mouseX = (e.clientX / window.innerWidth) - 0.5;
            mouseY = (e.clientY / window.innerHeight) - 0.5;
        }, { passive: true });

        (function tick() {
            curX += (mouseX - curX) * 0.05;
            curY += (mouseY - curY) * 0.05;
            drops.forEach((d) => {
                const depth = parseFloat(d.dataset.depth || '1');
                const px = (curX * depth * 26).toFixed(2);
                const py = (curY * depth * 18).toFixed(2);
                d.style.transform = `translate3d(${px}px, ${py}px, 0)`;
            });
            requestAnimationFrame(tick);
        })();
    }
})();
