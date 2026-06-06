// =============================================================================
// sync.js — Inbound & Outbound Data Operations
// =============================================================================
// Handles the paste-and-sync delta workflow (syncDelta), JSON export, and
// JSON import. syncDelta is decomposed into focused private helpers to replace
// what was previously a 230-line god function.
// =============================================================================

// ---------------------------------------------------------------------------
// Private: parse raw textarea input
// Strips optional markdown code fences, returns parsed JSON object.
// Throws on invalid JSON.
// ---------------------------------------------------------------------------
function _parseRawInput(raw) {
    raw = raw.trim();
    raw = raw.replace(/^```json\s*/i, "");
    raw = raw.replace(/^```\s*/, "");
    raw = raw.replace(/\s*```$/, "");
    raw = raw.trim();
    return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Private: merge an incoming delta object into window.state
// Handles all fields: scalars, meta, personnel, network, chronicle, history.
// ---------------------------------------------------------------------------
function _mergeStateDelta(delta) {
    // Scalar fields
    if (delta.week !== undefined)          window.state.week = delta.week;
    if (delta.cash !== undefined)          window.state.cash = delta.cash;
    if (delta.burn !== undefined)          window.state.burn = delta.burn;
    if (delta.protoProgress !== undefined) window.state.protoProgress = delta.protoProgress;
    if (delta.storybook_images !== undefined) window.state.storybook_images = delta.storybook_images;
    if (delta.facility_images !== undefined) window.state.facility_images = delta.facility_images;
    if (delta.active_campaign_phase !== undefined) window.state.active_campaign_phase = delta.active_campaign_phase;
    if (delta.global_objectives !== undefined) window.state.global_objectives = delta.global_objectives;

    if (delta.meta) {
        window.state.meta = { ...(window.state.meta || {}), ...delta.meta };
    }
    if (delta.facility) {
        window.state.facility = { ...(window.state.facility || {}), ...delta.facility };
        if (delta.facility.bays) window.state.facility.bays = delta.facility.bays;
        if (delta.facility.environmental_grid) window.state.facility.environmental_grid = delta.facility.environmental_grid;
        if (delta.facility.infrastructure_nodes) window.state.facility.infrastructure_nodes = delta.facility.infrastructure_nodes;
        if (delta.facility.structural_flaws) window.state.facility.structural_flaws = delta.facility.structural_flaws;
        if (delta.facility.project_clocks) window.state.facility.project_clocks = delta.facility.project_clocks;
    }
    if (delta.inventory) {
        window.state.inventory = { ...(window.state.inventory || {}), ...delta.inventory };
        if (delta.inventory.vehicles) window.state.inventory.vehicles = delta.inventory.vehicles;
        if (delta.inventory.components) window.state.inventory.components = delta.inventory.components;
    }
    if (delta.facility_modifiers) {
        window.state.facility_modifiers = { ...(window.state.facility_modifiers || {}), ...delta.facility_modifiers };
    }

    // Chronicle merge or overwrite
    if (delta.chronicle !== undefined) {
        const chkOverwrite = document.getElementById("chk-overwrite-chronicle");
        const shouldOverwrite = chkOverwrite ? chkOverwrite.checked : false;

        if (shouldOverwrite) {
            window.state.chronicle = delta.chronicle;
        } else {
            if (!window.state.chronicle) window.state.chronicle = [];

            const recordedWeeks = new Set();
            const existing = new Set(window.state.chronicle);

            for (const entry of window.state.chronicle) {
                const match = entry.match(/^W(\d+)\s*:/i);
                if (match) recordedWeeks.add(parseInt(match[1], 10));
            }

            const incoming = Array.isArray(delta.chronicle) ? delta.chronicle : [delta.chronicle];
            for (const entry of incoming) {
                // Skip range groupings like "W1-W13: ..."
                if (/^W\d+\s*-\s*W?\d+\s*:/i.test(entry)) continue;

                const weekMatch = entry.match(/^W(\d+)\s*:/i);
                if (weekMatch) {
                    const weekNum = parseInt(weekMatch[1], 10);
                    if (recordedWeeks.has(weekNum)) continue;
                    recordedWeeks.add(weekNum);
                }

                if (!existing.has(entry)) {
                    window.state.chronicle.push(entry);
                    existing.add(entry);
                }
            }
        }
    }

    // Personnel merge (including synergy normalisation)
    if (!window.state.personnel) window.state.personnel = {};
    if (delta.personnel) {
        for (const [key, val] of Object.entries(delta.personnel)) {
            if (key === "synergy") {
                if (!window.state.personnel.synergy) window.state.personnel.synergy = {};
                for (const [synKey, synVal] of Object.entries(val)) {
                    const parts = synKey.split("_and_");
                    if (parts.length === 2) {
                        const sortedKey = parts.sort().join("_and_");
                        const clampedVal = Math.min(Math.max(parseInt(synVal, 10) || 0, -3), 3);
                        window.state.personnel.synergy[sortedKey] = clampedVal;
                    } else {
                        window.state.personnel.synergy[synKey] = synVal;
                    }
                }
            } else {
                window.state.personnel[key] = { ...(window.state.personnel[key] || {}), ...val };
            }
        }
    }

    // Network merge
    if (!window.state.network) window.state.network = {};
    if (delta.network) {
        for (const [key, val] of Object.entries(delta.network)) {
            window.state.network[key] = { ...(window.state.network[key] || {}), ...val };
        }
    }

    // Update analytics history
    if (!window.state.history) window.state.history = [];
    const currentWeekNum = window.state.week || 1;
    const existingRecordIndex = window.state.history.findIndex(h => h.week === currentWeekNum);
    const newRecord = {
        week: currentWeekNum,
        cash: window.state.cash !== undefined ? window.state.cash : 0,
        burn: window.state.burn !== undefined ? window.state.burn : 0,
        protoProgress: window.state.protoProgress !== undefined ? window.state.protoProgress : 0
    };
    if (existingRecordIndex >= 0) {
        window.state.history[existingRecordIndex] = newRecord;
    } else {
        window.state.history.push(newRecord);
    }
    window.state.history.sort((a, b) => a.week - b.week);

    if (!window.state.storybook_images) {
        window.state.storybook_images = {};
    }
    if (!window.state.facility_images) {
        window.state.facility_images = {};
    }
}

// ---------------------------------------------------------------------------
// Private: handle optional image upload attached to a sync
// Returns true if an async file write was started (caller must return early).
// ---------------------------------------------------------------------------
async function _handleImageUpload(weekNum, imgFile) {
    if (!imgFile) return false;

    const imgInput = document.getElementById("scenario-img-input");

    if (window.dirHandle) {
        const permitted = await window.verifyDirectoryPermission(true);
        if (permitted) {
            try {
                const storybookDirHandle = await window.dirHandle.getDirectoryHandle("storybook", { create: true });
                const fileName = `storybook_week_${weekNum}.png`;
                const fileHandle = await storybookDirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(imgFile);
                await writable.close();

                window.state.storybook_images[weekNum] = fileName;
                window.saveState();

                await window.scanLocalDirectoryFiles();
                window.renderStateToDashboard();
                window.renderStorybookView();
                window.renderConfigView();

                if (imgInput) imgInput.value = "";

                window.triggerToast(
                    "⚡ LOGS & IMAGES MOUNTED",
                    `MATRIX SYNCED // GRAPHICS WRITTEN TO local storybook/ AT WEEK ${weekNum}.`
                );

                await window.autosaveBackupToLocalDirectory();
            } catch (err) {
                console.error("Error writing uploaded file to folder:", err);
                window.triggerToast("🚨 WRITE FAILED", "Could not save uploaded scene artwork to local folder.");
            }
        } else {
            window.triggerToast("🚨 PERMISSION DENIED", "Write permission denied for local directory.");
        }
        return true; // async path handled
    } else {
        window.triggerToast(
            "⚠️ DIRECTORY DISCONNECTED",
            "A picture was attached but no folder is connected. Connect folder in CONFIG tab."
        );
        if (imgInput) imgInput.value = "";
        return false;
    }
}

// ---------------------------------------------------------------------------
// Private: post-sync render + autosave
// ---------------------------------------------------------------------------
function _postSyncRender(weekNum) {
    window.saveState();
    window.renderStateToDashboard();
    window.renderStorybookView();
    window.renderConfigView();
    window.triggerToast(
        "⚡ DEEP LINK SECURED",
        `MATRIX SYNCED // ALL ENVIRO-MODIFIERS LOCKED AT WEEK ${weekNum}.`
    );
    window.autosaveBackupToLocalDirectory();
}

// ---------------------------------------------------------------------------
// Public: syncDelta — main entry point (called by "TRANSMIT LEDGER UPDATE" button)
// ---------------------------------------------------------------------------
window.syncDelta = async function() {
    try {
        const deltaInputNode = document.getElementById("delta-input");
        if (!deltaInputNode) {
            console.error("delta-input element not found in DOM.");
            return;
        }

        const delta = _parseRawInput(deltaInputNode.value || "");

        // Bootstrap state if not yet initialised
        if (!window.state) {
            window.state = Object.assign({}, window.DEFAULT_STATE, {
                campaignId: Date.now().toString()
            });
            window.state.history = [{ week: 1, cash: window.state.cash, burn: window.state.burn, protoProgress: 0 }];
            window.setAppState("game");
        } else if (!window.state.campaignId) {
            window.state.campaignId = Date.now().toString();
        }

        // Auto-update campaign name if meta or week changed
        if (!window.state.campaignName || delta.meta || delta.week !== undefined) {
            const pt = (delta.meta && delta.meta.powertrain) || (window.state.meta && window.state.meta.powertrain) || "EV";
            const sg = (delta.meta && delta.meta.segment) || (window.state.meta && window.state.meta.segment) || "Track Weapon";
            const wk = delta.week !== undefined ? delta.week : (window.state.week || 1);
            window.state.campaignName = `Campaign: ${pt} ${sg} (W${wk})`;
        }

        _mergeStateDelta(delta);

        // Handle optional attached image
        const imgInput = document.getElementById("scenario-img-input");
        const imgFile = imgInput ? imgInput.files[0] : null;
        const asyncHandled = await _handleImageUpload(window.state.week, imgFile);
        if (asyncHandled) {
            deltaInputNode.value = "";
            return;
        }

        _postSyncRender(window.state.week);
        deltaInputNode.value = "";
    } catch (e) {
        console.error("syncDelta parsing error:", e);
        window.triggerToast(
            "🚨 PARSE EXCEPTION",
            "DEEP MATRIX DATA BLOCKS FAULTY. INSURE RAW PAYLOAD IS CLEAN VALID JSON."
        );
    }
};

// ---------------------------------------------------------------------------
// Export campaign state as a .json file download
// ---------------------------------------------------------------------------
window.exportDataSlateJson = function() {
    try {
        const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.state, null, 2));
        const dlAnchorNode = document.createElement("a");
        dlAnchorNode.setAttribute("href", dataString);
        dlAnchorNode.setAttribute("download", `apex_blueprint_week_${window.state.week}_save.json`);
        document.body.appendChild(dlAnchorNode);
        dlAnchorNode.click();
        dlAnchorNode.remove();
        window.triggerToast("💾 DATA SLATE EXPORTED", `Save file downloaded cleanly for Week ${window.state.week}.`);
    } catch (e) {
        window.triggerToast("🚨 EXPORT FAULT", "System blocked file formatting anchor.");
    }
};

// ---------------------------------------------------------------------------
// Import campaign state from a .json file
// ---------------------------------------------------------------------------
window.importDataSlateJson = function(event) {
    const fileNode = event.target.files[0];
    if (!fileNode) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loadedState = JSON.parse(e.target.result);
            if (loadedState.cash === undefined || loadedState.chronicle === undefined) {
                window.triggerToast("🚨 DATA REJECTION", "Save file missing required core structural properties keys.");
                return;
            }
            window.state = loadedState;
            if (!window.state.storybook_images) {
                window.state.storybook_images = {};
            }
            if (!window.state.facility_images) {
                window.state.facility_images = {};
            }
            window.appStorage.setItem(window.SAVE_KEY, JSON.stringify(window.state));

            window.scanLocalDirectoryFiles().then(() => {
                window.renderStateToDashboard();
                window.renderStorybookView();
                window.renderConfigView();
                window.triggerToast("📁 DATA SLATE MOUNTED", `Loaded campaign successfully from backup slot at Week ${window.state.week}.`);
            });
        } catch (err) {
            window.triggerToast("🚨 UNREADABLE SLATE", "JSON string format invalid or scrambled file stream blocks.");
        }
    };
    reader.readAsText(fileNode);
    if (event && event.target) {
        event.target.value = "";
    }
};
