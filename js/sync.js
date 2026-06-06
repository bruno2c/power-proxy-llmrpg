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
    if (delta.week !== undefined) window.state.week = delta.week;
    
    // Corporate fields
    if (delta.corporate_runway !== undefined) window.state.corporate_runway = delta.corporate_runway;
    if (delta.weekly_leverage_burn !== undefined) window.state.weekly_leverage_burn = delta.weekly_leverage_burn;

    if (delta.campaign_metrics) {
        window.state.campaign_metrics = { ...(window.state.campaign_metrics || {}), ...delta.campaign_metrics };
    }
    if (delta.boardroom_clocks !== undefined) {
        window.state.boardroom_clocks = delta.boardroom_clocks;
    }
    if (delta.boardroom_factions !== undefined) {
        window.state.boardroom_factions = delta.boardroom_factions;
    }

    if (delta.storybook_images !== undefined) window.state.storybook_images = delta.storybook_images;
    if (delta.facility_images !== undefined) window.state.facility_images = delta.facility_images;

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

    // Heirs merge (including synergy normalisation)
    if (!window.state.heirs) window.state.heirs = {};
    if (delta.heirs) {
        for (const [key, val] of Object.entries(delta.heirs)) {
            if (key === "synergy") {
                if (!window.state.heirs.synergy) window.state.heirs.synergy = {};
                for (const [synKey, synVal] of Object.entries(val)) {
                    const parts = synKey.split("_and_");
                    if (parts.length === 2) {
                        const sortedKey = parts.sort().join("_and_");
                        const clampedVal = Math.min(Math.max(parseInt(synVal, 10) || 0, -3), 3);
                        window.state.heirs.synergy[sortedKey] = clampedVal;
                    } else {
                        window.state.heirs.synergy[synKey] = synVal;
                    }
                }
            } else {
                if (!window.state.heirs[key]) window.state.heirs[key] = {};
                const heir = window.state.heirs[key];
                
                if (val.player_controlled !== undefined) heir.player_controlled = val.player_controlled;
                if (val.name !== undefined) heir.name = val.name;
                if (val.gender !== undefined) heir.gender = val.gender;
                if (val.avatar !== undefined) heir.avatar = val.avatar;
                if (val.persona_archetype !== undefined) heir.persona_archetype = val.persona_archetype;
                if (val.role !== undefined) heir.role = val.role;
                if (val.morale !== undefined) heir.morale = val.morale;

                if (val.attributes) {
                    heir.attributes = { ...(heir.attributes || {}), ...val.attributes };
                }
                if (val.finances) {
                    heir.finances = { ...(heir.finances || {}), ...val.finances };
                }
                if (val.progression) {
                    heir.progression = { ...(heir.progression || {}), ...val.progression };
                }
                if (val.hidden_vulnerabilities) {
                    heir.hidden_vulnerabilities = val.hidden_vulnerabilities;
                }
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
    const buyoutPressure = (window.state.campaign_metrics && window.state.campaign_metrics.buyout_pressure_pct) !== undefined
        ? window.state.campaign_metrics.buyout_pressure_pct
        : 0;

    const newRecord = {
        week: currentWeekNum,
        corporate_runway: window.state.corporate_runway !== undefined ? window.state.corporate_runway : 0,
        weekly_leverage_burn: window.state.weekly_leverage_burn !== undefined ? window.state.weekly_leverage_burn : 0,
        buyout_pressure_pct: buyoutPressure
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
            window.state.history = [{
                week: 1,
                corporate_runway: window.state.corporate_runway,
                weekly_leverage_burn: window.state.weekly_leverage_burn,
                buyout_pressure_pct: (window.state.campaign_metrics && window.state.campaign_metrics.buyout_pressure_pct) || 35
            }];
            window.setAppState("game");
        } else if (!window.state.campaignId) {
            window.state.campaignId = Date.now().toString();
        }

        // Auto-update campaign name if campaign_metrics or week changed
        if (!window.state.campaignName || delta.campaign_metrics || delta.week !== undefined) {
            const company = (delta.campaign_metrics && delta.campaign_metrics.holding_company_name) || (window.state.campaign_metrics && window.state.campaign_metrics.holding_company_name) || "Sterling & Roy Holdings";
            const wk = delta.week !== undefined ? delta.week : (window.state.week || 1);
            window.state.campaignName = `Campanha: ${company} (S${wk})`;
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
        dlAnchorNode.setAttribute("download", `poder_procuracao_semana_${window.state.week}_save.json`);
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
            if ((loadedState.cash === undefined && loadedState.corporate_runway === undefined) || loadedState.chronicle === undefined) {
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
