// =============================================================================
// campaign.js — Campaign Lifecycle Management
// =============================================================================
// Handles the full arc of a campaign: creation wizard, loading from slots
// or a connected folder, exiting to the main menu, and AI prompt compilation.
// =============================================================================

// ---------------------------------------------------------------------------
// App state machine
// Controls which tabs are visible and which tab is active.
// States: "welcome" | "wizard" | "game"
// ---------------------------------------------------------------------------
window.setAppState = function(appState) {
    const welcomeTab = document.getElementById("welcome-tab");
    const navTabs = document.getElementById("main-navigation-tabs");
    const btnExit = document.getElementById("btn-exit-menu");

    const btnLive   = document.getElementById("btn-live-dashboard");
    const btnStory  = document.getElementById("btn-storybook-tab");
    const btnInit   = document.getElementById("btn-init-matrix");
    const btnConfig = document.getElementById("btn-config-tab");
    const btnAnalytics = document.getElementById("btn-analytics-tab");
    const btnRolodex = document.getElementById("btn-rolodex-tab");
    const mainHeader = document.getElementById("main-header");

    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    if (appState === "welcome") {
        if (welcomeTab) welcomeTab.classList.add("active");
        if (navTabs) navTabs.style.display = "none";
        if (btnExit) btnExit.style.display = "none";
        if (mainHeader) mainHeader.style.display = "none";
        window.renderWelcomeScreen();

    } else if (appState === "wizard") {
        if (mainHeader) mainHeader.style.display = "flex";
        if (navTabs) {
            navTabs.style.display = "flex";
            if (btnLive)   btnLive.style.display   = "none";
            if (btnStory)  btnStory.style.display  = "none";
            if (btnAnalytics) btnAnalytics.style.display = "none";
            if (btnRolodex) btnRolodex.style.display = "none";
            if (btnConfig) btnConfig.style.display = "none";
            if (btnInit) {
                btnInit.style.display = "inline-block";
                btnInit.innerText = "📊 CHARACTER CREATOR";
            }
        }
        if (btnExit) btnExit.style.display = "inline-block";
        window.switchTab("init-matrix");

    } else if (appState === "game") {
        if (mainHeader) mainHeader.style.display = "flex";
        if (navTabs) {
            navTabs.style.display = "flex";
            if (btnLive)   btnLive.style.display   = "inline-block";
            if (btnStory)  btnStory.style.display  = "inline-block";
            if (btnAnalytics) btnAnalytics.style.display = "inline-block";
            if (btnRolodex) btnRolodex.style.display = "inline-block";
            if (btnConfig) btnConfig.style.display = "inline-block";
            if (btnInit)   btnInit.style.display   = "none";
        }
        if (btnExit) btnExit.style.display = "inline-block";

        window.updateMergedPromptDisplay();

        const activeTab = Array.from(document.querySelectorAll(".tab-content")).find(el => el.classList.contains("active"));
        if (!activeTab || activeTab.id === "init-matrix" || activeTab.id === "welcome-tab") {
            window.switchTab("live-dashboard");
        }
    }
};

// ---------------------------------------------------------------------------
// Start new campaign wizard
// ---------------------------------------------------------------------------
window.startNewCampaignWizard = async function() {
    // Prompt for a new local folder selection and bootstrap it
    const success = await window.selectAndBootstrapNewCampaignDirectory();
    if (!success) return; // User aborted or conflict occurred

    window.stats = { tech: 0, cha: 0, log: 0, per: 0 };
    window.pointPool = 2;

    document.getElementById("p-powertrain").selectedIndex = 0;
    document.getElementById("p-segment").selectedIndex = 0;
    document.getElementById("p-funding").selectedIndex = 0;
    document.getElementById("p-perk").selectedIndex = 0;
    document.getElementById("p-flaw").selectedIndex = 0;

    document.getElementById("v-tech").innerText = "0";
    document.getElementById("v-cha").innerText  = "0";
    document.getElementById("v-log").innerText  = "0";
    document.getElementById("v-per").innerText  = "0";
    document.getElementById("pool-display").innerText = "2";

    document.getElementById("prompt-output").value = "";

    window.setAppState("wizard");
};

// ---------------------------------------------------------------------------
// Compile campaign from wizard form — builds window.state, saves, copies prompt
// ---------------------------------------------------------------------------
window.compileMasterPrompt = function() {
    if (!window.validateCreation(window.stats.tech, window.stats.cha, window.stats.log, window.stats.per)) {
        window.triggerToast("⚠️ STRUCTURAL FAULT", "ALLOCATE ALL REMAINING MATRIX ENERGY CAPACITY STACK CAPS.");
        return;
    }

    const powertrain = document.getElementById("p-powertrain").value;
    const segment    = document.getElementById("p-segment").value;
    const funding    = document.getElementById("p-funding").value;
    const perk       = document.getElementById("p-perk").value;
    const flaw       = document.getElementById("p-flaw").value;

    let classDesignation = "ENGINEER ARCHITECT";
    if (window.stats.cha >= 2)      classDesignation = "PROJECT DIRECTOR";
    else if (window.stats.log >= 2) classDesignation = "OPERATIONS CHIEF";
    else if (window.stats.per >= 2) classDesignation = "PRODUCT STRATEGIST";

    const startCash = funding.includes("500k") ? 500000
        : (funding.includes("250k") ? 250000 : 120000);

    window.state = Object.assign({}, window.DEFAULT_STATE, {
        campaignId: Date.now().toString(),
        week: 1,
        cash: startCash,
        burn: 8000,
        protoProgress: 0,
        meta: {
            powertrain: powertrain.split(" ")[0],
            segment:    segment.split(" ")[0],
            funding:    funding.split(" ")[0],
            perk:       perk.split(" ")[0],
        },
        network: {},
        facility: {
            name: "District-9 Industrial Bay",
            bays: [
                { id: "bay_1", contents: "Line Alpha Assembly", footprint: "Large" },
                { id: "bay_2", contents: "Prototype Diagnostic Bench", footprint: "Small" }
            ],
            environmental_grid: [
                { id: "power_grid", label: "Grid Power", current: 45, ceiling: 50, unit: "kW", status: "Nominal" }
            ],
            infrastructure_nodes: [
                {
                    id: "stamping_press",
                    category: "Heavy Machinery",
                    label: "Hydraulic Stamping Press",
                    condition: "Nominal",
                    active_quirk: "Improvised Alignment",
                    rule_modifier: { target: "TECH", value: 0, trigger: "Chassis fabrication tasks" }
                }
            ],
            structural_flaws: [
                {
                    id: flaw.split("(")[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                    label: flaw.split("(")[0].trim(),
                    severity: "Minor",
                    rule_modifier: (function() {
                        const flawId = flaw.split("(")[0].trim().toLowerCase();
                        if (flawId.includes("anxious")) {
                            return { target: "CHA", value: -1, trigger: "Interactions under budget pressure" };
                        } else if (flawId.includes("improvised")) {
                            return { target: "TECH", value: -1, trigger: "Precision machining or assembly" };
                        }
                        return { target: "TECH", value: -1, trigger: "Electronics tasks during rain" };
                    })()
                }
            ]
        },
        personnel: {
            lucius: {
                role: classDesignation,
                tech: window.stats.tech,
                cha:  window.stats.cha,
                log:  window.stats.log,
                per:  window.stats.per,
                description: "Founder and lead designer of the workshop, responsible for driving the prototype's high-performance engineering vision and coordinating garage operations."
            },
            sarah: {
                morale: 100,
                tech: 2,
                cha: -1,
                log: 0,
                per: 2,
                description: "Abrasive high-voltage cell architect. Controls all custom firmware loops and thermal configurations. Zero patience for bureaucracy; highly protective of shop engineering secrets."
            },
            leo: {
                morale: 100,
                tech: 1,
                cha: 1,
                log: 1,
                per: -1,
                description: "Experienced fabrication mechanic who handles heavy tooling, metalwork, and physical vehicle assembly on the shop floor."
            },
            synergy: { sarah_and_leo: 0 }
        },
        storybook_images: {},
        chronicle: [],
        history: [{ week: 1, cash: startCash, burn: 8000, protoProgress: 0 }]
    });

    if (perk.includes("Academic")) {
        window.state.cash -= 10000;
    }

    window.state.campaignName = `Campaign: ${window.state.meta.powertrain} ${window.state.meta.segment} (W${window.state.week})`;

    window.saveState();
    if (window.dirHandle && typeof window.saveDirHandle === "function") {
        window.saveDirHandle(window.dirHandle, window.state.campaignId);
    }
    window.renderStateToDashboard();
    window.renderStorybookView();
    window.renderConfigView();
    window.updateMergedPromptDisplay();

    // Copy merged prompt to clipboard
    const manualPromptNode = document.getElementById("manual-prompt-node");
    if (manualPromptNode) {
        const promptText = manualPromptNode.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(promptText).catch(() => {
                // Fallback for browsers that restrict clipboard without user gesture
                manualPromptNode.select();
                document.execCommand("copy");
            });
        } else {
            manualPromptNode.select();
            document.execCommand("copy");
        }
    }

    window.setAppState("game");
    window.switchTab("config-tab");
    window.triggerToast("📋 RULES & TIMELINE COMPILED", "Unified Game Master initial instructions copied to clipboard.");

    window.autosaveBackupToLocalDirectory();
};

// ---------------------------------------------------------------------------
// Load campaign from a saved slot (localStorage campaign list)
// ---------------------------------------------------------------------------
window.loadCampaignFromSlot = async function(campaignId) {
    const list = window.getCampaignsList();
    const campaign = list.find(c => c.id === campaignId);
    if (campaign) {
        let handle = null;
        if (typeof window.loadDirHandle === "function") {
            handle = await window.loadDirHandle(campaignId);
        }

        if (handle) {
            window.dirHandle = handle;
            window.directoryName = handle.name;
            try {
                const permitted = await window.verifyDirectoryPermission(true);
                if (permitted) {
                    window.directoryStatus = "Connected";
                    if (typeof window.saveDirHandle === "function") {
                        await window.saveDirHandle(handle, campaignId);
                    }
                    await window.scanLocalDirectoryFiles();
                    window.triggerToast("⚡ AUTOMATIC RECONNECTION", `Reconnected to folder: ${handle.name}`);
                } else {
                    window.directoryStatus = "Re-auth Required";
                }
            } catch (e) {
                console.warn("Reconnection failed:", e);
                window.directoryStatus = "Re-auth Required";
            }
        } else if (window.showDirectoryPicker) {
            // Prompt to select the directory for this campaign
            try {
                window.triggerToast("📂 DIRECTORY REQUIRED", "Please select the workspace folder for this campaign.");
                const newHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                window.dirHandle = newHandle;
                window.directoryName = newHandle.name;
                window.directoryStatus = "Connected";
                if (typeof window.saveDirHandle === "function") {
                    await window.saveDirHandle(newHandle, campaignId);
                }
                await window.scanLocalDirectoryFiles();
            } catch (e) {
                console.warn("Directory selection skipped or cancelled during slot load:", e);
                window.dirHandle = null;
                window.directoryName = "";
                window.directoryStatus = "Disconnected";
            }
        }

        window.state = campaign.state;
        window.appStorage.setItem(window.SAVE_KEY, JSON.stringify(window.state));

        window.renderStateToDashboard();
        window.renderStorybookView();
        window.renderConfigView();
        window.setAppState("game");
        window.triggerToast("🎰 CAMPAIGN ACTIVATED", `Restored campaign: ${campaign.name}`);
    } else {
        window.triggerToast("🚨 LOAD FAILED", "Could not find selected campaign slot.");
    }
};

// ---------------------------------------------------------------------------
// Load campaign from connected folder backup
// ---------------------------------------------------------------------------
window.loadCampaignFromConnectedFolder = async function() {
    if (!window.dirHandle) {
        if (window.showDirectoryPicker) {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                window.dirHandle = handle;
                window.directoryName = handle.name;
                window.directoryStatus = "Connected";
                if (typeof window.saveDirHandle === "function") {
                    await window.saveDirHandle(handle);
                }
            } catch (e) {
                window.triggerToast("🚨 LOAD FAILED", "No folder selected.");
                return;
            }
        } else {
            window.triggerToast("⚠️ NOT SUPPORTED", "Your browser does not support local directory access.");
            return;
        }
    }

    try {
        const permitted = await window.verifyDirectoryPermission(false);
        if (!permitted) {
            window.triggerToast("🔑 RE-AUTHORIZATION REQUIRED", "Accept permissions to read backup file from folder.");
            return;
        }

        const backupsDir = await window.dirHandle.getDirectoryHandle("backups", { create: false });
        const fileHandle = await backupsDir.getFileHandle("campaign_state.json", { create: false });
        const file = await fileHandle.getFile();
        const content = await file.text();
        const loadedState = JSON.parse(content);

        if (loadedState && loadedState.week !== undefined) {
            if (!loadedState.campaignId) {
                loadedState.campaignId = Date.now().toString();
            }
            if (!loadedState.campaignName) {
                const pt = loadedState.meta ? loadedState.meta.powertrain : "EV";
                const sg = loadedState.meta ? loadedState.meta.segment : "Track Weapon";
                loadedState.campaignName = `Imported Folder - Week ${loadedState.week} (${pt} ${sg})`;
            }

            window.state = loadedState;
            window.appStorage.setItem(window.SAVE_KEY, JSON.stringify(window.state));
            window.saveCampaignToList(window.state);

            if (window.dirHandle && typeof window.saveDirHandle === "function") {
                await window.saveDirHandle(window.dirHandle, loadedState.campaignId);
            }

            await window.scanLocalDirectoryFiles();
            window.renderStateToDashboard();
            window.renderStorybookView();
            window.renderConfigView();
            window.setAppState("game");

            window.triggerToast("💾 DIRECTORY SYNCED", "Successfully imported campaign state from connected folder.");
        }
    } catch (e) {
        console.error("Folder import failed:", e);
        const errMsg = e instanceof SyntaxError
            ? "The campaign_state.json file contains invalid JSON syntax."
            : "Could not find or parse campaign_state.json backup in directory.";
        window.triggerToast("🚨 IMPORT FAILED", errMsg);
    }
};

// ---------------------------------------------------------------------------
// Exit to main menu — saves current campaign, clears active state
// ---------------------------------------------------------------------------
window.exitToMainMenu = function() {
    if (window.state && window.state.campaignId) {
        window.saveCampaignToList(window.state);
    }

    window.appStorage.removeItem(window.SAVE_KEY);
    window.state = null;

    // Disconnect the active directory handle on exit to main menu
    if (typeof window.disconnectDirectory === "function") {
        window.disconnectDirectory();
    }

    window.setAppState("welcome");
    window.triggerToast("🚪 RETURNED TO MENU", "Timeline session suspended safely.");
};

// ---------------------------------------------------------------------------
// AI Prompt display & copy
// ---------------------------------------------------------------------------
window.updateMergedPromptDisplay = function() {
    const manualPromptNode = document.getElementById("manual-prompt-node");
    if (!manualPromptNode) return;

    if (!window.state || !window.state.campaignId) {
        manualPromptNode.value = window.RULES_PROMPT || "";
        return;
    }

    // Clone state, strip bulky fields not needed by the GM
    const cleanState = JSON.parse(JSON.stringify(window.state));

    // Omit bulky image and history fields
    delete cleanState.history;
    delete cleanState.storybook_images;
    delete cleanState.facility_images;

    // Remove avatars from network NPCs to reduce token size
    if (cleanState.network) {
        for (const npcId in cleanState.network) {
            if (cleanState.network[npcId]) {
                delete cleanState.network[npcId].avatar;
            }
        }
    }

    // Omit legacy/unused top-level fields (e.g. saraMorale, leoMorale, facility_modifiers, etc.)
    const allowedKeys = [
        "campaignId",
        "campaignName",
        "week",
        "cash",
        "burn",
        "protoProgress",
        "active_campaign_phase",
        "global_objectives",
        "meta",
        "network",
        "facility",
        "inventory",
        "personnel",
        "chronicle"
    ];
    for (const key of Object.keys(cleanState)) {
        if (!allowedKeys.includes(key)) {
            delete cleanState[key];
        }
    }

    const activePayload = JSON.stringify(cleanState, null, 2);

    const isNewGame = window.state.week === 1 && window.state.protoProgress === 0;
    const executionInstruction = isNewGame
        ? `🏁 EXECUTE INITIAL ASSEMBLY LINE ENGAGEMENT (WEEK 1)\nEstablish the initial aged blueprint workshop setting. Introduce Companion Sarah & Companion Leo utilizing their defined companion stats, and issue the first week 1 strategic mechanical choice check array.`
        : `🔄 EXECUTE MID-GAME SYSTEM CONVERGENCE RESUMPTION\nRe-establish simulation timeline context natively directly on active Week ${window.state.week}. Reference previous historical ledger entries tracked in the 'chronicle' array to shape choices.`;

    const dynamicPrompt = window.getDynamicPrompt(activePayload, executionInstruction);
    const rules = window.RULES_PROMPT || "";

    manualPromptNode.value = `${rules}\n\n=========================================\n\n${dynamicPrompt}`;
};

window.copyManualPrompt = function() {
    const targetTextNode = document.getElementById("manual-prompt-node");
    if (!targetTextNode) return;

    const promptText = targetTextNode.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(promptText)
            .then(() => window.triggerToast("🎮 PROMPT EXPORTED", "AI RULES & DYNAMIC CONFIGURATION COPIED TO CLIPBOARD LAYER."))
            .catch(() => {
                targetTextNode.select();
                document.execCommand("copy");
                window.triggerToast("🎮 PROMPT EXPORTED", "AI RULES & DYNAMIC CONFIGURATION COPIED TO CLIPBOARD LAYER.");
            });
    } else {
        targetTextNode.select();
        document.execCommand("copy");
        window.triggerToast("🎮 PROMPT EXPORTED", "AI RULES & DYNAMIC CONFIGURATION COPIED TO CLIPBOARD LAYER.");
    }
};
