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
    corporate_runway: 4500000,
    weekly_leverage_burn: 45000,
    campaign_metrics: {
        holding_company_name: "Sterling & Roy Holdings",
        current_board_trajectory: "Instável (Vácuo de Poder)",
        buyout_pressure_pct: 35,
        legacy_stabilization_pct: 35,
        status: "active"
    },
    boardroom_clocks: [],
    boardroom_factions: [
        {
            id: "institutional_hedge_funds",
            label: "Bloco de Fundos de Investimento Institucional (18% Votos)",
            loyalty_stance: "Neutro",
            current_lean: "Inclinado para a Venda",
            rule_modifier: {
                target: "LIQUIDITY",
                value: 1,
                trigger: "Ações de compra de ações ou alocação de capital direto"
            }
        }
    ],
    heirs: {
        player_1: {
            player_controlled: true,
            name: "Lucius Sterling",
            gender: "Masculino",
            avatar: "player_1_avatar.png",
            persona_archetype: "O Governante",
            role: "CHIEF STRATEGY OFFICER (CSO)",
            morale: 100,
            attributes: { clout: 4, leverage: 0, liquidity: -1, perception: 2 },
            finances: { personal_cash: 200000, weekly_overhead_burn: 15000 },
            progression: { clout_milestones: 0, leverage_milestones: 0, liquidity_milestones: 0, perception_milestones: 0 },
            hidden_vulnerabilities: []
        },
        player_2: {
            player_controlled: true,
            name: "Leonora Sterling",
            gender: "Feminino",
            avatar: "player_2_avatar.png",
            persona_archetype: "O Liquidante",
            role: "CHIEF OPERATING OFFICER (COO)",
            morale: 100,
            attributes: { clout: -1, leverage: 3, liquidity: 2, perception: 1 },
            finances: { personal_cash: 500000, weekly_overhead_burn: 35000 },
            progression: { clout_milestones: 0, leverage_milestones: 0, liquidity_milestones: 0, perception_milestones: 0 },
            hidden_vulnerabilities: []
        },
        synergy: {
            player_1_and_player_2: 0
        }
    },
    network: {},
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
window.SAVE_KEY = "power_proxy_save_slate";
window.CAMPAIGN_LIST_KEY = "power_proxy_campaign_list";

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
    
    // Seed new competitive keys if they are missing (gracefully upgrading old layouts)
    if (window.state.corporate_runway === undefined) {
        window.state.corporate_runway = window.state.cash !== undefined ? window.state.cash : 4500000;
    }
    if (window.state.weekly_leverage_burn === undefined) {
        window.state.weekly_leverage_burn = window.state.burn !== undefined ? window.state.burn : 45000;
    }
    if (!window.state.campaign_metrics) {
        window.state.campaign_metrics = {
            holding_company_name: (window.state.meta && window.state.meta.holding_company_name) || "Sterling & Roy Holdings",
            current_board_trajectory: window.state.active_campaign_phase || "Instável (Vácuo de Poder)",
            buyout_pressure_pct: window.state.protoProgress !== undefined ? window.state.protoProgress : 35,
            legacy_stabilization_pct: 35,
            status: "active"
        };
    }
    if (!window.state.boardroom_clocks) {
        window.state.boardroom_clocks = (window.state.facility && window.state.facility.project_clocks) ? window.state.facility.project_clocks : [];
    }
    if (!window.state.boardroom_factions) {
        window.state.boardroom_factions = [
            {
                id: "institutional_hedge_funds",
                label: "Bloco de Fundos de Investimento Institucional (18% Votos)",
                loyalty_stance: "Neutro",
                current_lean: "Inclinado para a Venda",
                rule_modifier: {
                    target: "LIQUIDITY",
                    value: 1,
                    trigger: "Ações de compra de ações ou alocação de capital direto"
                }
            }
        ];
    }
    if (!window.state.heirs) {
        window.state.heirs = {
            player_1: {
                player_controlled: true,
                name: "Lucius Sterling",
                gender: "Masculino",
                avatar: "player_1_avatar.png",
                persona_archetype: "O Governante",
                role: "CHIEF STRATEGY OFFICER (CSO)",
                morale: 100,
                attributes: { clout: 4, leverage: 0, liquidity: -1, perception: 2 },
                finances: { personal_cash: 200000, weekly_overhead_burn: 15000 },
                progression: { clout_milestones: 0, leverage_milestones: 0, liquidity_milestones: 0, perception_milestones: 0 },
                hidden_vulnerabilities: []
            },
            player_2: {
                player_controlled: true,
                name: "Leonora Sterling",
                gender: "Feminino",
                avatar: "player_2_avatar.png",
                persona_archetype: "O Liquidante",
                role: "CHIEF OPERATING OFFICER (COO)",
                morale: 100,
                attributes: { clout: -1, leverage: 3, liquidity: 2, perception: 1 },
                finances: { personal_cash: 500000, weekly_overhead_burn: 35000 },
                progression: { clout_milestones: 0, leverage_milestones: 0, liquidity_milestones: 0, perception_milestones: 0 },
                hidden_vulnerabilities: []
            },
            synergy: {
                player_1_and_player_2: 0
            }
        };
    }
    // Synergy validation
    if (!window.state.heirs.synergy) {
        window.state.heirs.synergy = { player_1_and_player_2: 0 };
    }
    if (window.state.heirs.synergy.player_1_and_player_2 === undefined) {
        window.state.heirs.synergy.player_1_and_player_2 = 0;
    }
    
    // Support history array
    if (!window.state.history || window.state.history.length === 0) {
        window.state.history = [
            {
                week: window.state.week !== undefined ? window.state.week : 1,
                corporate_runway: window.state.corporate_runway,
                weekly_leverage_burn: window.state.weekly_leverage_burn,
                buyout_pressure_pct: window.state.campaign_metrics.buyout_pressure_pct
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
