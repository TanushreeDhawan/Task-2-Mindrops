/* =========================================================
   TILTED RAINBOW TECH ARC — node builder & animation
   Places 9 tech nodes along the SVG arc using
   path.getPointAtLength() (so positions always match the
   actual curve, viewBox: 420 x 640). The wrap's pixel size
   is set explicitly here (not via CSS aspect-ratio) so the
   node percentage math always lines up with the SVG exactly,
   on load and on every resize.

   Each node then drifts gently back and forth along the arc
   (requestAnimationFrame, sine-based — lightweight, no GSAP
   dependency needed). Hover reveals the bold tech label
   above the node.
   ========================================================= */
(function () {
    const wrap = document.querySelector('.tech-arc-wrap');
    const heroSection = document.querySelector('.hero-section');
    const pathEl = document.getElementById('techArcPath');

    if (!wrap || !pathEl) {
        console.warn('[tech-arc] wrap or path element not found — carousel skipped.');
        return;
    }

    const VB_W = 420, VB_H = 640, VB_RATIO = VB_W / VB_H;

    // ---------------------------------------------------
    // Explicit pixel sizing (keeps node math exactly in sync
    // with the SVG regardless of viewport / CSS quirks)
    // ---------------------------------------------------
    function sizeArc() {
        const viewportH = (heroSection && heroSection.clientHeight) || window.innerHeight;
        const viewportW = window.innerWidth;

        //let height = Math.min(viewportH * 0.82, 640);
        let height = Math.min(viewportH * 0.74, 560);

        height = Math.max(height, 380);

        let width = height * VB_RATIO;
        const maxWidth = Math.min(viewportW * 0.36, 430);
        //const maxWidth = Math.min(viewportW * 0.42, 480);

        if (width > maxWidth) {
            width = maxWidth;
            height = width / VB_RATIO;
        }

        wrap.style.width = width.toFixed(0) + 'px';
        wrap.style.height = height.toFixed(0) + 'px';
    }

    sizeArc();
    window.addEventListener('resize', sizeArc);

    // ---------------------------------------------------
    // Build the 9 tech nodes
    // ---------------------------------------------------
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const techs = [
        { label: 'HTML',       icon: 'fa-brands fa-html5',     color: '#ff4d4d', t: 0.06 },
        { label: 'CSS',        icon: 'fa-brands fa-css3-alt',  color: '#ff9142', t: 0.17 },
        { label: 'JavaScript', icon: 'fa-brands fa-square-js', color: '#ffd83d', t: 0.28 },
        { label: 'React JS',   icon: 'fa-brands fa-react',     color: '#7CFC6E', t: 0.39 },
        { label: 'Node.js',    icon: 'fa-brands fa-node-js',   color: '#3dd6c2', t: 0.50 },
        { label: 'PHP',        icon: 'fa-brands fa-php',       color: '#3dc7ff', t: 0.61 },
        { label: '.NET',       icon: 'fa-brands fa-microsoft', color: '#4d7dff', t: 0.72 },
        { label: 'Shopify',    icon: 'fa-brands fa-shopify',   color: '#8a4dff', t: 0.83 },
        { label: 'WordPress',  icon: 'fa-brands fa-wordpress', color: '#c34dff', t: 0.94 },
    ];

    const nodes = techs.map((tech) => {
        const node = document.createElement('div');
        node.className = 'tech-node';
        node.style.setProperty('--nc', tech.color);

        const counter = document.createElement('div');
        counter.className = 'tech-node-counter';

        const icon = document.createElement('div');
        icon.className = 'tech-node-icon';
        icon.innerHTML = `<i class="${tech.icon}"></i>`;

        const label = document.createElement('span');
        label.className = 'tech-node-label';
        label.textContent = tech.label;

        counter.appendChild(icon);
        counter.appendChild(label);
        node.appendChild(counter);
        wrap.appendChild(node);

        return {
            el: node,
            base: tech.t,
            phase: Math.random() * Math.PI * 2,
            amp: 0.012 + Math.random() * 0.01,   // how far it drifts along the arc
            speed: 0.22 + Math.random() * 0.16,  // drift speed
        };
    });

    // ---------------------------------------------------
    // Position along the path each frame
    // ---------------------------------------------------
    let totalLen = 0;
    function refreshLength() {
        try {
            totalLen = pathEl.getTotalLength();
        } catch (e) {
            totalLen = 0;
        }
    }
    refreshLength();
    window.addEventListener('resize', refreshLength);

    function pointAt(frac) {
        const clamped = Math.min(0.985, Math.max(0.015, frac));
        return pathEl.getPointAtLength(clamped * totalLen);
    }

    function render(now) {
        if (totalLen > 0) {
            const t = now / 1000;
            nodes.forEach((n) => {
                const frac = reduceMotion ? n.base : n.base + Math.sin(t * n.speed + n.phase) * n.amp;
                const pt = pointAt(frac);
                n.el.style.left = ((pt.x / VB_W) * 100).toFixed(3) + '%';
                n.el.style.top = ((pt.y / VB_H) * 100).toFixed(3) + '%';
            });
        }
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();
