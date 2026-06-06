// =============================================================================
// state.js — Game State, Persistence & Data Integrity
// =============================================================================
// Single source of truth for all campaign data. Handles localStorage campaign
// slot management, state sanity/migration, and chronicle utilities.
// =============================================================================

// ---------------------------------------------------------------------------
// Safe in-memory storage fallback for private/incognito browsing
// ---------------------------------------------------------------------------
(function() {
    let localStorageAvailable = false;
    try {
        localStorage.setItem("__test__", "1");
        localStorage.removeItem("__test__");
        localStorageAvailable = true;
    } catch (e) {
        localStorageAvailable = false;
    }

    const memStorage = {};
    window.appStorage = {
        getItem(key) {
            if (localStorageAvailable) {
                try { return localStorage.getItem(key); } catch (e) {}
            }
            return memStorage[key] || null;
        },
        setItem(key, value) {
            if (localStorageAvailable) {
                try { localStorage.setItem(key, value); return; } catch (e) {}
            }
            memStorage[key] = String(value);
        },
        removeItem(key) {
            if (localStorageAvailable) {
                try { localStorage.removeItem(key); return; } catch (e) {}
            }
            delete memStorage[key];
        }
    };
})();

// ---------------------------------------------------------------------------
// Default state shape — authoritative definition, used everywhere a fresh
// state is needed. Spread/clone this instead of re-declaring inline.
// ---------------------------------------------------------------------------
window.DEFAULT_STATE = {
    campaignId: null,
    campaignName: null,
    week: 1,
    cash: 120000,
    burn: 8000,
    protoProgress: 0,
    active_campaign_phase: "",
    global_objectives: [],
    meta: {
        powertrain: "EV",
        segment: "Track Weapon",
        funding: "Bootstrapped",
        perk: "Corporate Dropout",
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
                condition: "Degraded",
                active_quirk: "Manual Feed Lever",
                rule_modifier: { target: "TECH", value: -1, trigger: "Chassis fabrication tasks" }
            }
        ],
        structural_flaws: [
            {
                id: "drafty_roof",
                label: "Drafty Roof",
                severity: "Minor",
                rule_modifier: { target: "TECH", value: -1, trigger: "Electronics tasks during rain" }
            }
        ],
        project_clocks: []
    },
    inventory: {
        vehicles: [
            {
                id: "chassis_03_track_ready",
                label: "Line Alpha: Vehicle Chassis 03",
                status: "Safe Stock",
                condition: "Optimal",
                powertrain: "EV Weapon Baseline",
                active_quirk: "Fully calibrated firmware loop",
                market_value: 120000
            },
            {
                id: "chassis_04_track_ready",
                label: "Line Alpha: Vehicle Chassis 04",
                status: "Safe Stock",
                condition: "Optimal",
                powertrain: "EV Weapon Baseline",
                active_quirk: "Fresh calibration profile validation",
                market_value: 120000
            }
        ],
        components: [
            {
                id: "carbon_monocoque_tubs",
                category: "Structural Raw Materials",
                label: "OmniControl Carbon Tubs",
                quantity: 2,
                unit: "Units",
                condition: "Optimal",
                rule_modifier: {
                    target: "NONE",
                    value: 0,
                    trigger: "Baseline chassis structure feedstock"
                }
            },
            {
                id: "elite_carbon_ceramic_brakes",
                category: "Performance Hardware",
                label: "Tier-1 Carbon-Ceramic Brake Kits",
                quantity: 3,
                unit: "Sets",
                condition: "Nominal",
                rule_modifier: {
                    target: "TECH",
                    value: 1,
                    trigger: "Track performance testing and validation sweeps"
                }
            }
        ]
    },
    personnel: {
        lucius: {
            role: "ARCHITECT",
            tech: 0,
            cha: 0,
            log: 0,
            per: 0,
            description: "Founder and visionary designer. Brilliant at structural pivots but currently struggling with severe operational paranoia. Commands boardroom strategy but fails at basic human perception.",
            progression: {
                tech_milestones: 0,
                cha_milestones: 0,
                log_milestones: 0,
                per_milestones: 0
            },
            current_assignment: null
        },
        sarah: {
            morale: 100,
            tech: 2,
            cha: -1,
            log: 0,
            per: 2,
            description: "Abrasive high-voltage cell architect. Controls all custom firmware loops and thermal configurations. Zero patience for bureaucracy; highly protective of shop engineering secrets.",
            progression: {
                tech_milestones: 0,
                cha_milestones: 0,
                log_milestones: 0,
                per_milestones: 0
            },
            current_assignment: null
        },
        leo: {
            morale: 100,
            tech: 1,
            cha: 1,
            log: 1,
            per: -1,
            description: "Veteran fabrication mechanic who anchors the physical assembly jigs. Fiercely loyal, but currently running on pure exhaustion from extreme shop floor overtime.",
            progression: {
                tech_milestones: 0,
                cha_milestones: 0,
                log_milestones: 0,
                per_milestones: 0
            },
            current_assignment: null
        },
        synergy: { sarah_and_leo: 0 }
    },
    storybook_images: {},
    facility_images: {},
    chronicle: [],
    history: []
};

// ---------------------------------------------------------------------------
// Active runtime state — initialized to null (no active campaign on load).
// Populated by compileMasterPrompt(), loadCampaignFromSlot(), or importDataSlateJson().
// ---------------------------------------------------------------------------
window.state = null;

// Character creation transient stats (not persisted to campaign state)
window.stats = { tech: 0, cha: 0, log: 0, per: 0 };
window.pointPool = 2;

// ---------------------------------------------------------------------------
// localStorage key — canonical app key (migrated from legacy "linc_motors_save_slate")
// ---------------------------------------------------------------------------
window.SAVE_KEY = "apex_blueprint_save_slate";
window.CAMPAIGN_LIST_KEY = "apex_blueprint_campaign_list";

// ---------------------------------------------------------------------------
// localStorage migration shim — runs once on first load. If an old
// "linc_motors_save_slate" entry exists and no new key exists yet, migrate it.
// ---------------------------------------------------------------------------
(function migrateLocalStorageKey() {
    const LEGACY_KEY = "linc_motors_save_slate";
    const legacyData = window.appStorage.getItem(LEGACY_KEY);
    if (legacyData && !window.appStorage.getItem(window.SAVE_KEY)) {
        window.appStorage.setItem(window.SAVE_KEY, legacyData);
        window.appStorage.removeItem(LEGACY_KEY);
        console.log("[state.js] Migrated save data from legacy key to apex_blueprint_save_slate.");
    }
})();

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------
window.saveState = function() {
    if (!window.state) return;
    window.appStorage.setItem(window.SAVE_KEY, JSON.stringify(window.state));
    if (window.state.campaignId) {
        window.saveCampaignToList(window.state);
    }
};

// ---------------------------------------------------------------------------
// Campaign slot management (multi-campaign localStorage list)
// ---------------------------------------------------------------------------
window.getCampaignsList = function() {
    const listJson = window.appStorage.getItem(window.CAMPAIGN_LIST_KEY);
    if (!listJson) return [];
    try {
        return JSON.parse(listJson);
    } catch (e) {
        return [];
    }
};

window.saveCampaignToList = function(stateObj) {
    if (!stateObj || !stateObj.campaignId) return;
    let list = window.getCampaignsList();

    const powertrain = stateObj.meta ? stateObj.meta.powertrain : "EV";
    const segment = stateObj.meta ? stateObj.meta.segment : "Track Weapon";
    const week = stateObj.week || 1;
    const name = stateObj.campaignName || `Campaign: ${powertrain} ${segment} (W${week})`;

    const existingIndex = list.findIndex(c => c.id === stateObj.campaignId);
    const campaignEntry = {
        id: stateObj.campaignId,
        name: name,
        timestamp: Date.now(),
        state: stateObj
    };

    if (existingIndex !== -1) {
        list[existingIndex] = campaignEntry;
    } else {
        list.push(campaignEntry);
    }

    window.appStorage.setItem(window.CAMPAIGN_LIST_KEY, JSON.stringify(list));
};

window.deleteCampaignFromList = function(campaignId) {
    let list = window.getCampaignsList();
    list = list.filter(c => c.id !== campaignId);
    window.appStorage.setItem(window.CAMPAIGN_LIST_KEY, JSON.stringify(list));

    if (window.state && window.state.campaignId === campaignId) {
        window.state = null;
        window.appStorage.removeItem(window.SAVE_KEY);
    }

    window.renderWelcomeScreen();
};

// ---------------------------------------------------------------------------
// State sanity / data migration
// Normalises synergy keys, removes lucius from synergy, seeds history array.
// Safe to call on any state object — no-ops if already clean.
// ---------------------------------------------------------------------------
window.ensureStateSanity = function() {
    if (!window.state) return;
    if (window.state.inventory && window.DEFAULT_STATE && window.state.inventory === window.DEFAULT_STATE.inventory) {
        window.state.inventory = JSON.parse(JSON.stringify(window.DEFAULT_STATE.inventory));
    }
    if (window.state.facility && window.DEFAULT_STATE && window.state.facility === window.DEFAULT_STATE.facility) {
        window.state.facility = JSON.parse(JSON.stringify(window.DEFAULT_STATE.facility));
    }
    if (!window.state.global_objectives) {
        window.state.global_objectives = [];
    }
    if (window.state.active_campaign_phase === undefined) {
        window.state.active_campaign_phase = "";
    }
    if (!window.state.facility_images) {
        window.state.facility_images = {};
    }
    if (!window.state.facility) {
        const oldFlaw = (window.state.facility_modifiers && window.state.facility_modifiers.flaw) || "Drafty Roof";
        window.state.facility = {
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
                    id: oldFlaw.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                    label: oldFlaw,
                    severity: "Minor",
                    rule_modifier: { target: "TECH", value: -1, trigger: "Electronics tasks during rain" }
                }
            ]
        };
    }
    if (!window.state.inventory) {
        window.state.inventory = {
            vehicles: [
                {
                    id: "chassis_03_track_ready",
                    label: "Line Alpha: Vehicle Chassis 03",
                    status: "Safe Stock",
                    condition: "Optimal",
                    powertrain: "EV Weapon Baseline",
                    active_quirk: "Fully calibrated firmware loop",
                    market_value: 120000
                },
                {
                    id: "chassis_04_track_ready",
                    label: "Line Alpha: Vehicle Chassis 04",
                    status: "Safe Stock",
                    condition: "Optimal",
                    powertrain: "EV Weapon Baseline",
                    active_quirk: "Fresh calibration profile validation",
                    market_value: 120000
                }
            ],
            components: [
                {
                    id: "carbon_monocoque_tubs",
                    category: "Structural Raw Materials",
                    label: "OmniControl Carbon Tubs",
                    quantity: 2,
                    unit: "Units",
                    condition: "Optimal",
                    rule_modifier: {
                        target: "NONE",
                        value: 0,
                        trigger: "Baseline chassis structure feedstock"
                    }
                },
                {
                    id: "elite_carbon_ceramic_brakes",
                    category: "Performance Hardware",
                    label: "Tier-1 Carbon-Ceramic Brake Kits",
                    quantity: 3,
                    unit: "Sets",
                    condition: "Nominal",
                    rule_modifier: {
                        target: "TECH",
                        value: 1,
                        trigger: "Track performance testing and validation sweeps"
                    }
                }
            ]
        };
    }
    if (window.state.facility && !window.state.facility.project_clocks) {
        window.state.facility.project_clocks = [];
    }
    if (!window.state.personnel) window.state.personnel = {};
    for (const [key, char] of Object.entries(window.state.personnel)) {
        if (key === "synergy") continue;
        if (!char.progression) {
            char.progression = {
                tech_milestones: 0,
                cha_milestones: 0,
                log_milestones: 0,
                per_milestones: 0
            };
        } else {
            if (char.progression.tech_milestones === undefined) char.progression.tech_milestones = 0;
            if (char.progression.cha_milestones === undefined) char.progression.cha_milestones = 0;
            if (char.progression.log_milestones === undefined) char.progression.log_milestones = 0;
            if (char.progression.per_milestones === undefined) char.progression.per_milestones = 0;
        }
        if (char.current_assignment === undefined) {
            char.current_assignment = null;
        }
    }
    if (!window.state.personnel.synergy) {
        window.state.personnel.synergy = {};
    }

    // Remove any legacy synergy keys that involve Lucius
    for (const synKey of Object.keys(window.state.personnel.synergy)) {
        if (synKey.includes("lucius")) {
            delete window.state.personnel.synergy[synKey];
        }
    }

    // Ensure every companion pair has a canonical sorted synergy key
    const characters = Object.keys(window.state.personnel).filter(
        k => k !== "synergy" && k !== "lucius"
    );

    for (let i = 0; i < characters.length; i++) {
        for (let j = i + 1; j < characters.length; j++) {
            const charA = characters[i];
            const charB = characters[j];

            const key1 = `${charA}_and_${charB}`;
            const key2 = `${charB}_and_${charA}`;

            const existingVal1 = window.state.personnel.synergy[key1];
            const existingVal2 = window.state.personnel.synergy[key2];

            const finalVal = existingVal1 !== undefined
                ? existingVal1
                : (existingVal2 !== undefined ? existingVal2 : 0);

            const sortedKey = [charA, charB].sort().join("_and_");
            window.state.personnel.synergy[sortedKey] = Math.min(
                Math.max(parseInt(finalVal, 10) || 0, -3), 3
            );

            if (sortedKey !== key1 && window.state.personnel.synergy[key1] !== undefined) {
                delete window.state.personnel.synergy[key1];
            }
            if (sortedKey !== key2 && window.state.personnel.synergy[key2] !== undefined) {
                delete window.state.personnel.synergy[key2];
            }
        }
    }

    // Upgrade legacy slates: seed history if missing
    if (!window.state.history || window.state.history.length === 0) {
        window.state.history = [
            {
                week: window.state.week !== undefined ? window.state.week : 1,
                cash: window.state.cash !== undefined ? window.state.cash : 0,
                burn: window.state.burn !== undefined ? window.state.burn : 0,
                protoProgress: window.state.protoProgress !== undefined ? window.state.protoProgress : 0
            }
        ];
    }
};

// ---------------------------------------------------------------------------
// Chronicle range expansion
// Expands "W1-W11: summary text" entries into individual week entries.
// ---------------------------------------------------------------------------
window.expandChronicleRanges = function(chronicle) {
    if (!chronicle) return [];
    const expanded = [];
    for (const entry of chronicle) {
        const rangeMatch = entry.match(/^W(\d+)-W?(\d+):(.*)$/i);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            const content = rangeMatch[3];
            for (let w = start; w <= end; w++) {
                expanded.push(`W${w}:${content}`);
            }
        } else {
            expanded.push(entry);
        }
    }
    return expanded;
};

// ---------------------------------------------------------------------------
// Dice Roll Interceptor Logic
// ---------------------------------------------------------------------------
window.interceptDiceRoll = function(attribute, context, baseRollValue = 0) {
    if (!window.state) {
        return baseRollValue;
    }
    
    let modifierTotal = 0;
    const attrUpper = String(attribute).toUpperCase();
    const contextLower = String(context).toLowerCase();

    // 1. Scan infrastructure_nodes
    if (window.state.facility) {
        const nodes = window.state.facility.infrastructure_nodes || [];
        for (const node of nodes) {
            const mod = node.rule_modifier;
            if (mod && String(mod.target).toUpperCase() === attrUpper) {
                const triggerText = String(mod.trigger || "").toLowerCase();
                if (contextLower.includes(triggerText) || triggerText.split(/\s+/).every(word => contextLower.includes(word))) {
                    modifierTotal += parseInt(mod.value) || 0;
                }
            }
        }

        // 2. Scan structural_flaws
        const flaws = window.state.facility.structural_flaws || [];
        for (const flaw of flaws) {
            const mod = flaw.rule_modifier;
            if (mod && String(mod.target).toUpperCase() === attrUpper) {
                const triggerText = String(mod.trigger || "").toLowerCase();
                if (contextLower.includes(triggerText) || triggerText.split(/\s+/).every(word => contextLower.includes(word))) {
                    modifierTotal += parseInt(mod.value) || 0;
                }
            }
        }
    }

    // 3. Scan components in inventory
    if (window.state.inventory && window.state.inventory.components) {
        const components = window.state.inventory.components || [];
        for (const comp of components) {
            if (comp.quantity && comp.quantity > 0) {
                const mod = comp.rule_modifier;
                if (mod && String(mod.target).toUpperCase() === attrUpper) {
                    const triggerText = String(mod.trigger || "").toLowerCase();
                    if (contextLower.includes(triggerText) || triggerText.split(/\s+/).every(word => contextLower.includes(word))) {
                        modifierTotal += parseInt(mod.value) || 0;
                    }
                }
            }
        }
    }

    return baseRollValue + modifierTotal;
};
