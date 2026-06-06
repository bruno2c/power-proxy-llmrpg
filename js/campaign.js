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
window.handleRoleChange = function(playerIndex) {
    const p1Role = document.getElementById("p1-role");
    const p2Role = document.getElementById("p2-role");
    if (!p1Role || !p2Role) return;
    
    if (playerIndex === 1) {
        if (p1Role.value === "O Liquidante") {
            p2Role.value = "O Governante";
        } else {
            p2Role.value = "O Liquidante";
        }
    } else {
        if (p2Role.value === "O Liquidante") {
            p1Role.value = "O Governante";
        } else {
            p1Role.value = "O Liquidante";
        }
    }
    
    window.updateRolePreviews();
};

window.updateRolePreviews = function() {
    const p1RoleVal = document.getElementById("p1-role").value;
    const p2RoleVal = document.getElementById("p2-role").value;
    
    const p1Preview = document.getElementById("p1-stats-preview");
    const p2Preview = document.getElementById("p2-stats-preview");
    
    const rolesData = {
        "O Liquidante": {
            title: "CHIEF OPERATING OFFICER (COO)",
            focus: "Forçar a aquisição da holding por terceiros, liquidar o patrimônio e realizar um exit massivo.",
            attributes: "CLOUT: -1 | LEVERAGE: +3 | LIQUIDITY: +2 | PERCEPTION: +1",
            finances: "Fundos Pessoais: $500,000 | Custo Operacional Semanal: $35,000"
        },
        "O Governante": {
            title: "CHIEF STRATEGY OFFICER (CSO)",
            focus: "Bloquear propostas de venda, expurgar a influência externa do conselho e consolidar o controle como CEO permanente.",
            attributes: "CLOUT: +4 | LEVERAGE: 0 | LIQUIDITY: -1 | PERCEPTION: +2",
            finances: "Fundos Pessoais: $200,000 | Custo Operacional Semanal: $15,000"
        }
    };
    
    if (p1Preview) {
        const data = rolesData[p1RoleVal];
        p1Preview.innerHTML = `
            <strong style="color: var(--comic-amber);">${data.title}</strong><br/>
            <strong>Foco:</strong> ${data.focus}<br/>
            <strong>Atributos base:</strong> <span style="font-family: 'JetBrains Mono', monospace; color: #fff;">${data.attributes}</span><br/>
            <strong>Finanças iniciais:</strong> ${data.finances}
        `;
    }
    if (p2Preview) {
        const data = rolesData[p2RoleVal];
        p2Preview.innerHTML = `
            <strong style="color: var(--comic-amber);">${data.title}</strong><br/>
            <strong>Foco:</strong> ${data.focus}<br/>
            <strong>Atributos base:</strong> <span style="font-family: 'JetBrains Mono', monospace; color: #fff;">${data.attributes}</span><br/>
            <strong>Finanças iniciais:</strong> ${data.finances}
        `;
    }
};

window.handleAvatarUpload = function(playerIndex, event) {
    const file = event.target.files[0];
    if (!file) return;

    if (playerIndex === 1) {
        window.p1AvatarFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            window.p1AvatarBase64 = e.target.result;
            const preview = document.getElementById("p1-avatar-preview");
            if (preview) preview.src = window.p1AvatarBase64;
        };
        reader.readAsDataURL(file);
    } else {
        window.p2AvatarFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            window.p2AvatarBase64 = e.target.result;
            const preview = document.getElementById("p2-avatar-preview");
            if (preview) preview.src = window.p2AvatarBase64;
        };
        reader.readAsDataURL(file);
    }
};

// Start new campaign wizard
window.startNewCampaignWizard = async function() {
    const success = await window.selectAndBootstrapNewCampaignDirectory();
    if (!success) return; 

    // Reset avatar tracking variables
    window.p1AvatarBase64 = "";
    window.p2AvatarBase64 = "";
    window.p1AvatarFile = null;
    window.p2AvatarFile = null;

    // Reset form elements
    const holdingName = document.getElementById("p-holding-name");
    if (holdingName) holdingName.value = "Sterling & Roy Holdings";

    const p1Name = document.getElementById("p1-name");
    if (p1Name) p1Name.value = "Lucius Sterling";

    const p2Name = document.getElementById("p2-name");
    if (p2Name) p2Name.value = "Leonora Sterling";

    const p1Gender = document.getElementById("p1-gender");
    if (p1Gender) p1Gender.selectedIndex = 0;

    const p2Gender = document.getElementById("p2-gender");
    if (p2Gender) p2Gender.selectedIndex = 0;

    const p1Role = document.getElementById("p1-role");
    if (p1Role) p1Role.value = "O Governante";

    const p2Role = document.getElementById("p2-role");
    if (p2Role) p2Role.value = "O Liquidante";

    const p1Preview = document.getElementById("p1-avatar-preview");
    if (p1Preview) p1Preview.src = "images/lucius_avatar.png";

    const p2Preview = document.getElementById("p2-avatar-preview");
    if (p2Preview) p2Preview.src = "images/sarah_avatar.png";

    const p1FileInput = document.getElementById("p1-avatar-file");
    if (p1FileInput) p1FileInput.value = "";

    const p2FileInput = document.getElementById("p2-avatar-file");
    if (p2FileInput) p2FileInput.value = "";

    document.getElementById("prompt-output").value = "";

    window.updateRolePreviews();
    window.setAppState("wizard");
};

// Compile campaign from wizard form — builds window.state, saves, copies prompt
window.compileMasterPrompt = function() {
    const holdingName = document.getElementById("p-holding-name").value.trim();
    const p1Name = document.getElementById("p1-name").value.trim();
    const p2Name = document.getElementById("p2-name").value.trim();
    
    if (!holdingName || !p1Name || !p2Name) {
        window.triggerToast("⚠️ NOME REQUERIDO", "Por favor, preencha o nome da holding e de ambos os herdeiros.");
        return;
    }

    const p1Gender = document.getElementById("p1-gender").value;
    const p1Role = document.getElementById("p1-role").value;
    
    const p2Gender = document.getElementById("p2-gender").value;
    const p2Role = document.getElementById("p2-role").value;

    const heirs = {
        player_1: {
            player_controlled: true,
            name: p1Name,
            gender: p1Gender,
            avatar: window.p1AvatarBase64 || "player_1_avatar.png",
            persona_archetype: p1Role,
            role: p1Role === "O Liquidante" ? "CHIEF OPERATING OFFICER (COO)" : "CHIEF STRATEGY OFFICER (CSO)",
            morale: 100,
            attributes: p1Role === "O Liquidante" 
                ? { clout: -1, leverage: 3, liquidity: 2, perception: 1 }
                : { clout: 4, leverage: 0, liquidity: -1, perception: 2 },
            finances: p1Role === "O Liquidante"
                ? { personal_cash: 500000, weekly_overhead_burn: 35000 }
                : { personal_cash: 200000, weekly_overhead_burn: 15000 },
            progression: { clout_milestones: 0, leverage_milestones: 0, liquidity_milestones: 0, perception_milestones: 0 },
            hidden_vulnerabilities: []
        },
        player_2: {
            player_controlled: true,
            name: p2Name,
            gender: p2Gender,
            avatar: window.p2AvatarBase64 || "player_2_avatar.png",
            persona_archetype: p2Role,
            role: p2Role === "O Liquidante" ? "CHIEF OPERATING OFFICER (COO)" : "CHIEF STRATEGY OFFICER (CSO)",
            morale: 100,
            attributes: p2Role === "O Liquidante" 
                ? { clout: -1, leverage: 3, liquidity: 2, perception: 1 }
                : { clout: 4, leverage: 0, liquidity: -1, perception: 2 },
            finances: p2Role === "O Liquidante"
                ? { personal_cash: 500000, weekly_overhead_burn: 35000 }
                : { personal_cash: 200000, weekly_overhead_burn: 15000 },
            progression: { clout_milestones: 0, leverage_milestones: 0, liquidity_milestones: 0, perception_milestones: 0 },
            hidden_vulnerabilities: []
        },
        synergy: {
            player_1_and_player_2: 0
        }
    };

    window.state = Object.assign({}, window.DEFAULT_STATE, {
        campaignId: Date.now().toString(),
        week: 1,
        corporate_runway: 4500000,
        weekly_leverage_burn: 45000,
        campaign_metrics: {
            holding_company_name: holdingName,
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
        heirs: heirs,
        storybook_images: {},
        chronicle: [],
        history: [{ 
            week: 1, 
            corporate_runway: 4500000, 
            weekly_leverage_burn: 45000, 
            buyout_pressure_pct: 35 
        }]
    });

    window.state.campaignName = `Holding: ${holdingName} (W${window.state.week})`;

    // Save custom avatars if local directory is bound
    if (window.dirHandle) {
        window.verifyDirectoryPermission(true).then(async (permitted) => {
            if (permitted) {
                try {
                    const avatarsDir = await window.dirHandle.getDirectoryHandle("avatars", { create: true });
                    if (window.p1AvatarFile) {
                        const fileHandle = await avatarsDir.getFileHandle("player_1.png", { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(window.p1AvatarFile);
                        await writable.close();
                        
                        const fileHandle2 = await avatarsDir.getFileHandle("player_1_avatar.png", { create: true });
                        const writable2 = await fileHandle2.createWritable();
                        await writable2.write(window.p1AvatarFile);
                        await writable2.close();
                    }
                    if (window.p2AvatarFile) {
                        const fileHandle = await avatarsDir.getFileHandle("player_2.png", { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(window.p2AvatarFile);
                        await writable.close();
                        
                        const fileHandle2 = await avatarsDir.getFileHandle("player_2_avatar.png", { create: true });
                        const writable2 = await fileHandle2.createWritable();
                        await writable2.write(window.p2AvatarFile);
                        await writable2.close();
                    }
                } catch (e) {
                    console.warn("Falha ao salvar avatares no diretório local:", e);
                }
            }
        });
    }

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
    window.triggerToast("📋 REGRAS E INSTRUÇÕES COMPILADAS", "As instruções iniciais do Game Master foram copiadas para a área de transferência.");

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

    // Remove avatars from heirs to reduce token size in AI prompt
    if (cleanState.heirs) {
        if (cleanState.heirs.player_1) delete cleanState.heirs.player_1.avatar;
        if (cleanState.heirs.player_2) delete cleanState.heirs.player_2.avatar;
    }

    // Omit legacy/unused top-level fields
    const allowedKeys = [
        "campaignId",
        "campaignName",
        "week",
        "corporate_runway",
        "weekly_leverage_burn",
        "campaign_metrics",
        "boardroom_clocks",
        "boardroom_factions",
        "heirs",
        "network",
        "chronicle"
    ];
    for (const key of Object.keys(cleanState)) {
        if (!allowedKeys.includes(key)) {
            delete cleanState[key];
        }
    }

    const activePayload = JSON.stringify(cleanState, null, 2);

    const isNewGame = window.state.week === 1 && (!window.state.history || window.state.history.length <= 1);
    const executionInstruction = isNewGame
        ? `🏁 EXECUTE INITIAL BOARDROOM ENGAGEMENT (WEEK 1)\nEstablish the initial dynamic corporate scenario and boardroom tension. Introduce both Player 1 (${window.state.heirs.player_1.name} as ${window.state.heirs.player_1.persona_archetype}) and Player 2 (${window.state.heirs.player_2.name} as ${window.state.heirs.player_2.persona_archetype}) using their defined attributes. Present the first week 1 strategic choice dilemma array for their executive consideration, highlighting the competitive boardroom dynamic in Brazilian Portuguese.`
        : `🔄 EXECUTE MID-GAME SYSTEM CONVERGENCE RESUMPTION\nRe-establish simulation timeline context natively directly on active Week ${window.state.week}. Reference previous historical ledger entries tracked in the 'chronicle' array to shape choices, and continue the competitive boardroom simulation in Brazilian Portuguese.`;

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
