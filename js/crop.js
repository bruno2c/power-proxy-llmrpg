// =============================================================================
// crop.js — Avatar Image Crop Tool
// =============================================================================
// Fully self-contained module for the NPC dossier avatar crop modal.
// Manages crop state, modal open/close, canvas export, and all
// mouse/touch/slider event listeners.
// =============================================================================

// ---------------------------------------------------------------------------
// Crop tool state — scoped to this feature, still on window for HTML onclick access
// ---------------------------------------------------------------------------
window.activeCropNpcId = null;
window.cropPanX = 0;
window.cropPanY = 0;
window.cropZoom = 1;
window.isDraggingCropImg = false;
window.dragStartX = 0;
window.dragStartY = 0;

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------
window.openCropModal = function(imageSrc, npcId) {
    window.activeCropNpcId = npcId;
    window.cropPanX = 0;
    window.cropPanY = 0;
    window.cropZoom = 1;

    const modal = document.getElementById("crop-modal");
    const imgNode = document.getElementById("crop-img-node");
    const slider = document.getElementById("crop-zoom-slider");

    if (imgNode) {
        imgNode.src = imageSrc;
        imgNode.style.display = "block";
        imgNode.style.transform = `translate(0px, 0px) scale(1)`;
    }
    if (slider) {
        slider.value = 1;
    }
    if (modal) {
        modal.classList.add("active");
    }
};

window.cancelAvatarCrop = function() {
    const modal = document.getElementById("crop-modal");
    if (modal) modal.classList.remove("active");
    window.activeCropNpcId = null;
};

// ---------------------------------------------------------------------------
// Apply crop — renders canvas, saves base64 to state, optionally writes to
// File System API (avatars/ subdirectory), then re-renders rolodex.
// ---------------------------------------------------------------------------
window.applyAvatarCrop = function() {
    const npcId = window.activeCropNpcId;
    if (!npcId) return;

    const imgNode = document.getElementById("crop-img-node");
    if (!imgNode || !imgNode.src) return;

    const canvas = document.createElement("canvas");
    canvas.width = 168;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#102a43";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const zoom = window.cropZoom;
    const dx = window.cropPanX - 56;
    const dy = window.cropPanY - 55;

    ctx.drawImage(
        imgNode,
        dx,
        dy,
        imgNode.naturalWidth * zoom,
        imgNode.naturalHeight * zoom
    );

    const base64Data = canvas.toDataURL("image/png");

    if (!window.state.network) window.state.network = {};
    if (!window.state.network[npcId]) window.state.network[npcId] = {};
    window.state.network[npcId].avatar = base64Data;

    window.saveState();
    window.renderRolodexView();
    window.triggerToast("📁 DOSSIER UPDATED", "Aligned dossier photo saved for contact.");

    // Optionally write PNG to local directory avatars/ folder
    canvas.toBlob(async (blob) => {
        if (blob && window.dirHandle) {
            try {
                const avatarsDir = await window.dirHandle.getDirectoryHandle("avatars", { create: true });
                const fileHandle = await avatarsDir.getFileHandle(`${npcId}_avatar.png`, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`Binary avatar file saved locally under avatars/${npcId}_avatar.png`);
            } catch (err) {
                console.error("Local file system directory save failed:", err);
            }
        }
    }, "image/png");

    window.cancelAvatarCrop();
};

// ---------------------------------------------------------------------------
// File upload handler (triggers from rolodex card upload button)
// ---------------------------------------------------------------------------
window.handleNpcAvatarUpload = function(event, npcId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        window.openCropModal(e.target.result, npcId);
        event.target.value = "";
    };
    reader.readAsDataURL(file);
};

// ---------------------------------------------------------------------------
// Event listener registration (called from init.js on DOMContentLoaded)
// ---------------------------------------------------------------------------
window.initCropEventListeners = function() {
    const viewport = document.getElementById("crop-viewport-container");
    const imgNode = document.getElementById("crop-img-node");
    const slider = document.getElementById("crop-zoom-slider");

    if (!viewport || !imgNode || !slider) return;

    viewport.addEventListener("mousedown", (e) => {
        e.preventDefault();
        window.isDraggingCropImg = true;
        window.dragStartX = e.clientX - window.cropPanX;
        window.dragStartY = e.clientY - window.cropPanY;
        viewport.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
        if (!window.isDraggingCropImg) return;
        window.cropPanX = e.clientX - window.dragStartX;
        window.cropPanY = e.clientY - window.dragStartY;
        imgNode.style.transform = `translate(${window.cropPanX}px, ${window.cropPanY}px) scale(${window.cropZoom})`;
    });

    window.addEventListener("mouseup", () => {
        window.isDraggingCropImg = false;
        viewport.style.cursor = "move";
    });

    // Touch support
    viewport.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            window.isDraggingCropImg = true;
            window.dragStartX = e.touches[0].clientX - window.cropPanX;
            window.dragStartY = e.touches[0].clientY - window.cropPanY;
        }
    });

    viewport.addEventListener("touchmove", (e) => {
        if (!window.isDraggingCropImg || e.touches.length !== 1) return;
        window.cropPanX = e.touches[0].clientX - window.dragStartX;
        window.cropPanY = e.touches[0].clientY - window.dragStartY;
        imgNode.style.transform = `translate(${window.cropPanX}px, ${window.cropPanY}px) scale(${window.cropZoom})`;
    });

    viewport.addEventListener("touchend", () => {
        window.isDraggingCropImg = false;
    });

    slider.addEventListener("input", (e) => {
        window.cropZoom = parseFloat(e.target.value);
        imgNode.style.transform = `translate(${window.cropPanX}px, ${window.cropPanY}px) scale(${window.cropZoom})`;
    });
};
