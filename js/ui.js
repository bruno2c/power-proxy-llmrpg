// =============================================================================
// ui.js — UI Primitives (no state dependencies)
// =============================================================================
// Pure UI utilities: toast notifications, tab switching, lightbox, stat
// counters for the character creator. No game logic, no state reads.
// =============================================================================

// ---------------------------------------------------------------------------
// Currency formatting helper
// ---------------------------------------------------------------------------
function formatCurrency(val) {
    if (val === undefined || val === null) return "0";
    if (typeof val === 'string' && (val.includes(',') || val.includes('$'))) {
        return val.replace('$', '').trim();
    }
    const num = Number(val);
    if (isNaN(num)) {
        return String(val).replace('$', '').trim();
    }
    return num.toLocaleString();
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------
window.triggerToast = function(title, message) {
    document.getElementById("toast-title").innerText = title;
    document.getElementById("toast-msg").innerText = message;
    const box = document.getElementById("toast-layer");
    box.classList.add("active");
    setTimeout(() => box.classList.remove("active"), 4000);
};

// ---------------------------------------------------------------------------
// Tab routing
// Uses data-tab attribute for reliable active button lookup.
// ---------------------------------------------------------------------------
window.switchTab = function(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    const tabContent = document.getElementById(tabId);
    if (tabContent) tabContent.classList.add("active");

    // Find the button with a matching data-tab attribute
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (targetBtn) {
        targetBtn.classList.add("active");
    }
};

// ---------------------------------------------------------------------------
// Lightbox (storybook image full-screen review)
// ---------------------------------------------------------------------------
window.openLightbox = function(imgSrc, title, desc) {
    const modal = document.getElementById("blueprint-lightbox-modal");
    const img = document.getElementById("lightbox-img-node");
    const titleNode = document.getElementById("lightbox-title-node");
    const descNode = document.getElementById("lightbox-desc-node");

    if (modal && img && titleNode && descNode) {
        img.src = imgSrc;
        titleNode.innerText = title;
        descNode.innerText = desc;
        modal.classList.add("active");
    }
};

window.closeLightbox = function() {
    const modal = document.getElementById("blueprint-lightbox-modal");
    const img = document.getElementById("lightbox-img-node");
    if (modal) {
        modal.classList.remove("active");
        setTimeout(() => {
            if (img && !modal.classList.contains("active")) {
                img.src = "";
            }
        }, 300);
    }
};

// ---------------------------------------------------------------------------
// Character creation stat counter
// ---------------------------------------------------------------------------
window.adjustStat = function(stat, delta) {
    if (delta > 0 && window.pointPool > 0 && window.stats[stat] < 2) {
        window.stats[stat]++;
        window.pointPool--;
    } else if (delta < 0 && window.stats[stat] > -1) {
        window.stats[stat]--;
        window.pointPool++;
    }
    document.getElementById(`v-${stat}`).innerText = window.stats[stat];
    document.getElementById("pool-display").innerText = window.pointPool;
};

window.validateCreation = function(tech, cha, log, per) {
    const stats = [tech, cha, log, per];
    const sum = stats.reduce((a, b) => a + b, 0);
    const boundsCheck = stats.every(val => val >= -1 && val <= 2);
    return sum === 2 && boundsCheck;
};
