// =============================================================================
// render.js — DOM Rendering Functions
// =============================================================================
// All functions that read from window.state and write to the DOM.
// These are the "view layer" — they never mutate state, only render it.
// =============================================================================

// ---------------------------------------------------------------------------
// Top-level render coordinator
// Calls all sub-renderers. Call this after any state mutation.
// ---------------------------------------------------------------------------
window.renderStateToDashboard = function() {
    window.ensureStateSanity();
    if (window.state && window.state.chronicle) {
        window.state.chronicle = window.expandChronicleRanges(window.state.chronicle);
    }

    const cash = window.state && window.state.cash !== undefined ? formatCurrency(window.state.cash) : "0";
    const burn = window.state && window.state.burn !== undefined ? formatCurrency(window.state.burn) : "0";
    const progress = window.state && window.state.protoProgress !== undefined ? window.state.protoProgress : "0";
    const week = window.state && window.state.week !== undefined ? window.state.week : "1";

    const dashCash = document.getElementById("dash-cash");
    const dashBurn = document.getElementById("dash-burn");
    const txtProto = document.getElementById("txt-proto");
    const lblCurrentWeek = document.getElementById("lbl-current-week");

    if (dashCash) dashCash.innerText = `$${cash}`;
    if (dashBurn) dashBurn.innerText = `$${burn}`;
    if (txtProto) txtProto.innerText = `${progress}%`;
    if (lblCurrentWeek) lblCurrentWeek.innerText = `W${week}`;

    // Render active campaign phase card
    const dashActivePhase = document.getElementById("txt-active-phase");
    const activePhaseCard = document.getElementById("active-phase-card");
    if (dashActivePhase && activePhaseCard) {
        if (window.state && window.state.active_campaign_phase) {
            dashActivePhase.innerText = window.state.active_campaign_phase;
            activePhaseCard.style.display = "block";
        } else {
            activePhaseCard.style.display = "none";
        }
    }

    // Render global campaign objectives section
    window.renderGlobalObjectives();

    // Render facility infrastructure & utilities
    window.renderFacilityInfrastructure();

    // Render workshop inventory tracking
    window.renderInventory();

    if (window.state && window.state.meta) {
        const power = document.getElementById("lbl-meta-power");
        const seg = document.getElementById("lbl-meta-seg");
        const fund = document.getElementById("lbl-meta-fund");
        const perk = document.getElementById("lbl-meta-perk");
        if (power) power.innerText = window.state.meta.powertrain || "";
        if (seg) seg.innerText = window.state.meta.segment || "";
        if (fund) fund.innerText = window.state.meta.funding || "";
        if (perk) perk.innerText = window.state.meta.perk || "";
    }

    const timelineBox = document.getElementById("timeline-container");
    if (timelineBox) {
        if (window.state && window.state.chronicle && window.state.chronicle.length > 0) {
            timelineBox.innerHTML = [...window.state.chronicle].reverse()
                .map((item) => `<li class="ledger-entry">${item}</li>`)
                .join("");
        } else {
            timelineBox.innerHTML = `<li class="ledger-entry" style="color: var(--text-muted);">No records found. Paste game turns or import data slates.</li>`;
        }
    }

    window.updateCharacterUIPanels();

    if (window.state && !window.state.network) {
        window.state.network = {};
    }
    window.renderRolodexView();
    window.renderAnalyticsView();
};

// ---------------------------------------------------------------------------
// Resolve character avatar source (local FS fallback support)
// ---------------------------------------------------------------------------
window.getCharacterAvatarSrc = async function(key) {
    let imgSrc = `images/${key.toLowerCase()}_avatar.png`;
    const baseChars = ["lucius", "sarah", "leo"];
    if (!baseChars.includes(key.toLowerCase()) && window.dirHandle) {
        try {
            const permitted = await window.verifyDirectoryPermission(false);
            if (permitted) {
                const avatarsDir = await window.dirHandle.getDirectoryHandle("avatars", { create: false });
                const fileHandle = await avatarsDir.getFileHandle(`${key.toLowerCase()}_avatar.png`, { create: false });
                const file = await fileHandle.getFile();
                imgSrc = URL.createObjectURL(file);
            }
        } catch (e) {
            console.debug(`Local avatar for new char ${key} not found in avatars/ directory.`);
        }
    }
    return imgSrc;
};

// ---------------------------------------------------------------------------
// Crew Roster & Synergy Relationships
// ---------------------------------------------------------------------------
window.updateCharacterUIPanels = async function() {
    const container = document.getElementById("crew-roster-container");
    if (!container) return;

    if (!window.state || !window.state.personnel) {
        container.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted);">No crew members in state.</div>`;
        return;
    }

    const nameMap = {
        leo: "COUSIN LEO",
        lucius: "LUCIUS",
        sarah: "SARAH"
    };

    let html = "";
    for (const [key, charData] of Object.entries(window.state.personnel)) {
        if (key === "synergy") continue;
        const displayName = nameMap[key] || key.toUpperCase();

        const morale = charData.morale;
        let moraleColor = "";
        let borderStyle = "";
        let ringBorderStyle = "";

        if (morale !== undefined) {
            moraleColor = morale > 75
                ? "var(--comic-green)"
                : morale > 40
                    ? "var(--comic-amber)"
                    : "var(--comic-red)";
            borderStyle = `style="border-color: ${moraleColor};"`;
            ringBorderStyle = `style="border-color: ${moraleColor};"`;
        } else {
            ringBorderStyle = `style="border-color: var(--comic-amber);"`;
        }

        let roleText = "";
        let roleStyle = "";
        if (charData.role && morale !== undefined) {
            roleText = `${charData.role} | EFFICIENCY: ${morale}%`;
            roleStyle = `style="color: ${moraleColor};"`;
        } else if (charData.role) {
            roleText = charData.role;
        } else if (morale !== undefined) {
            roleText = `EFFICIENCY: ${morale}%`;
            roleStyle = `style="color: ${moraleColor};"`;
        }

        const imgSrc = await window.getCharacterAvatarSrc(key);

        const descriptionHtml = charData.description
            ? `<div class="crew-desc" style="margin-top: 4px; font-size: 12px; line-height: 1.35; color: var(--text-main);">"${charData.description}"</div>`
            : "";

        // Helper to render dual stat section (Attribute slider -3 to 5 and Leveling dots 0 to 3)
        const renderStatSection = (label, val, milestones) => {
            val = val !== undefined ? val : 0;
            const clampedVal = Math.min(5, Math.max(-3, val));
            const dotPct = ((clampedVal + 3) / 8) * 100;
            
            let dots = "";
            for (let i = 1; i <= 3; i++) {
                let dotColor = "rgba(255,255,255,0.08)";
                let border = "1px solid rgba(255,255,255,0.12)";
                let shadow = "";
                if (i <= milestones) {
                    if (i === 3) {
                        dotColor = "var(--comic-green)";
                        shadow = "box-shadow: 0 0 3px var(--comic-green);";
                    } else {
                        dotColor = "var(--comic-amber)";
                    }
                }
                dots += `<div style="flex: 1; height: 3px; background: ${dotColor}; border: ${border}; ${shadow}"></div>`;
            }
            
            const thumbColor = clampedVal >= 0 ? "var(--comic-amber)" : "var(--comic-red)";
            
            return `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; color: var(--text-muted);">
                        <span>${label}</span>
                        <span style="color: #fff; font-family: 'JetBrains Mono', monospace;">${clampedVal >= 0 ? '+' + clampedVal : clampedVal}</span>
                    </div>
                    
                    <!-- Value Bar (-3 to 5) -->
                    <div style="display: flex; height: 5px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); margin-top: 3px; position: relative;">
                        <!-- Center tick mark at 0 (37.5% position) -->
                        <div style="position: absolute; left: 37.5%; top: 0; width: 1px; height: 100%; background: rgba(255,255,255,0.25);"></div>
                        <!-- Thumb dot -->
                        <div style="position: absolute; left: ${dotPct}%; top: 50%; transform: translate(-50%, -50%); width: 7px; height: 7px; background: ${thumbColor}; border-radius: 50%; box-shadow: 0 0 4px ${thumbColor};"></div>
                    </div>
                    
                    <!-- Milestone Progression Bar (0 to 3) -->
                    <div style="display: flex; justify-content: space-between; font-size: 7px; color: var(--text-muted); margin-top: 4px; text-transform: uppercase;">
                        <span>Leveling</span>
                        <span>${milestones}/3</span>
                    </div>
                    <div style="display: flex; gap: 2px; margin-top: 2px;">
                        ${dots}
                    </div>
                </div>
            `;
        };

        // Render Assignment Progress Bar
        const assignment = charData.current_assignment;
        let assignmentHtml = "";
        
        if (assignment) {
            let barStr = "";
            let progressLabel = "";
            let detailsText = "";
            
            if (assignment.type === "Quiet Period") {
                barStr = "⚡ QUIET PERIOD";
                progressLabel = "DOWNTIME ACTIVE";
                detailsText = `Action: <strong>${assignment.action}</strong>`;
            } else {
                const total = assignment.total_weeks || (assignment.weeks_remaining !== undefined ? assignment.weeks_remaining + 2 : 4);
                const remaining = assignment.weeks_remaining !== undefined ? assignment.weeks_remaining : 0;
                const completed = Math.max(0, total - remaining);
                for (let i = 0; i < total; i++) {
                    barStr += i < completed ? "█" : "░";
                }
                progressLabel = `Week ${completed}/${total}`;
                detailsText = `Task: <strong>${assignment.action || 'Project Clock Mitigation'}</strong>`;
            }
            
            assignmentHtml = `
                <div class="crew-assignment-box" style="margin-bottom: 12px; padding: 8px 10px; background: rgba(0,0,0,0.25); border: var(--border-thin); border-color: var(--comic-amber); border-radius: 4px; line-height: 1.4;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <span style="font-size: 8px; color: var(--comic-amber); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Assignment Ledger</span>
                        <span style="font-size: 9px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">${progressLabel}</span>
                    </div>
                    <div style="font-size: 11px; color: #fff; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${assignment.action || ''}">
                        ${detailsText}
                    </div>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--comic-green); margin-top: 4px; letter-spacing: 1px;">
                        ${barStr}
                    </div>
                </div>
            `;
        } else {
            assignmentHtml = `
                <div class="crew-assignment-box" style="margin-bottom: 12px; padding: 8px 10px; background: rgba(0,0,0,0.15); border: 1px dashed rgba(255,255,255,0.08); border-radius: 4px; text-align: center;">
                    <div style="font-size: 10px; color: var(--text-muted);">No Active Assignment / Unassigned</div>
                </div>
            `;
        }

        html += `
            <div class="crew-card" ${borderStyle}>
                <!-- Row 1: Avatar + Name & Description side by side -->
                <div style="display: flex; gap: 16px; align-items: flex-start; width: 100%;">
                    <div class="avatar-pill-container" ${ringBorderStyle} style="flex-shrink: 0; margin: 0; position: relative;">
                        <img
                            src="${imgSrc}"
                            alt="${displayName}"
                            onerror="this.style.display = 'none'"
                        />
                        <button class="btn-char-desc" onclick="window.editCharDescription('${key}')" title="Edit character dossier">📝</button>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div class="crew-name" style="font-size: 16px; font-weight: bold; color: var(--comic-amber); margin: 0 0 2px 0;">${displayName}</div>
                        <div class="crew-role" ${roleStyle} style="font-size: 10px; font-weight: bold; text-transform: uppercase;">
                            ${roleText}
                        </div>
                        ${descriptionHtml}
                    </div>
                </div>
                
                <!-- Row 2: Full Width Active Assignment & Attribute / Progression grids -->
                <div style="width: 100%; margin-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 12px;">
                    ${assignmentHtml}
                    <div class="stat-badge-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(0, 0, 0, 0.2); padding: 8px; border-radius: 4px; border: var(--border-thin); box-sizing: border-box;">
                        <div>
                            ${renderStatSection("FIN", charData.tech, (charData.progression && charData.progression.tech_milestones) || 0)}
                            ${renderStatSection("CHA", charData.cha, (charData.progression && charData.progression.cha_milestones) || 0)}
                        </div>
                        <div>
                            ${renderStatSection("OPS", charData.log, (charData.progression && charData.progression.log_milestones) || 0)}
                            ${renderStatSection("INT", charData.per, (charData.progression && charData.progression.per_milestones) || 0)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    // Render synergy section
    const synergySection = document.getElementById("synergy-section");
    const synergyContainer = document.getElementById("synergy-relationship-container");
    const synergyObj = window.state.personnel.synergy || {};
    const synergyKeys = Object.keys(synergyObj).filter(synKey => {
        const parts = synKey.split("_and_");
        return parts.length === 2;
    });

    if (synergySection && synergyContainer) {
        if (synergyKeys.length > 0) {
            synergySection.style.display = "block";
            let synergyHtml = "";
            for (const synKey of synergyKeys) {
                const parts = synKey.split("_and_");
                const charKey1 = parts[0];
                const charKey2 = parts[1];
                const name1 = nameMap[charKey1] || charKey1.toUpperCase();
                const name2 = nameMap[charKey2] || charKey2.toUpperCase();
                const synVal = synergyObj[synKey];
                const val = Math.min(Math.max(parseInt(synVal, 10) || 0, -3), 3);

                let colorClass = "active-neutral";
                let iconSymbol = "🤝";
                let label = "STANDARD ALIGNMENT";
                if (val > 0) {
                    colorClass = "active-positive";
                    iconSymbol = "🤝";
                    label = "COOPERATIVE EFFICIENCY";
                } else if (val < 0) {
                    colorClass = "active-negative";
                    iconSymbol = val === -3 ? "💔" : "⚡";
                    label = "ACTIVE FRICTION NODE";
                }

                const formattedVal = val > 0 ? `+${val}` : val;

                let cellsHtml = "";
                for (let i = -3; i <= 3; i++) {
                    let fillClass = "";
                    if (i === val) {
                        if (val > 0) fillClass = "fill-positive";
                        else if (val < 0) fillClass = "fill-negative";
                        else fillClass = "fill-neutral";
                    }
                    cellsHtml += `<div class="synergy-mini-cell ${fillClass}"></div>`;
                }

                const avatarSrc1 = await window.getCharacterAvatarSrc(charKey1);
                const avatarSrc2 = await window.getCharacterAvatarSrc(charKey2);

                synergyHtml += `
                    <div class="synergy-relation-card ${colorClass}" title="${name1} & ${name2}: ${label}">
                        <div class="synergy-avatars-row">
                            <div class="synergy-mini-avatar" title="${name1}">
                                <img src="${avatarSrc1}" alt="${name1}" onerror="this.style.display = 'none'">
                            </div>
                            <div class="synergy-connection-icon ${colorClass}">${iconSymbol}</div>
                            <div class="synergy-mini-avatar" title="${name2}">
                                <img src="${avatarSrc2}" alt="${name2}" onerror="this.style.display = 'none'">
                            </div>
                        </div>
                        <div class="synergy-badge ${colorClass}">
                            ${name1} ✦ ${name2} (${formattedVal})
                        </div>
                        <div class="synergy-mini-visual-bar">
                            ${cellsHtml}
                        </div>
                    </div>
                `;
            }
            synergyContainer.innerHTML = synergyHtml;
        } else {
            synergySection.style.display = "none";
        }
    }
};

// ---------------------------------------------------------------------------
// NPC Rolodex
// ---------------------------------------------------------------------------
window.renderRolodexView = async function() {
    const grid = document.getElementById("rolodex-grid-container");
    if (!grid) return;

    if (!window.state || !window.state.network || Object.keys(window.state.network).length === 0) {
        grid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px; font-size: 13px;">No secondary contacts registered in network. Submit narrative slates introducing NPCs to build database.</div>`;
        return;
    }

    let html = "";
    for (const [npcId, npc] of Object.entries(window.state.network)) {
        const name = npc.name || npcId.toUpperCase();
        const role = npc.role || "Contact";
        const status = npc.status || "Neutral";
        const notes = npc.notes || "No description files saved.";

        let statusColor = "var(--comic-amber)";
        const sl = status.toLowerCase();
        if (sl.includes("favorable") || sl.includes("friendly") || sl.includes("ally")) {
            statusColor = "var(--comic-green)";
        } else if (sl.includes("unfavorable") || sl.includes("hostile") || sl.includes("enemy")) {
            statusColor = "var(--comic-red)";
        }

        const avatarSrc = await window.getNpcAvatarSrc(npcId);
        const imgHtml = avatarSrc
            ? `<img src="${avatarSrc}" alt="${name}" />`
            : `<div class="rolodex-avatar-fallback">NO DOSSIER IMAGERY FILE</div>`;

        html += `
            <div class="rolodex-card">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0;">
                    <div class="rolodex-avatar-pill" style="border-color: var(--comic-amber);">
                        ${imgHtml}
                    </div>
                    <label class="btn-utility-upload">
                        📁 UPLOAD
                        <input type="file" accept="image/*" style="display: none;" onchange="window.handleNpcAvatarUpload(event, '${npcId}')" />
                    </label>
                </div>
                <div class="crew-info-block">
                    <div class="crew-name" style="color: var(--comic-amber);">${name}</div>
                    <div class="crew-role" style="margin-bottom: 4px; color: var(--text-main); font-weight: bold; text-transform: uppercase;">${role}</div>
                    <div style="font-size: 10px; font-weight: bold; margin-bottom: 8px;">
                        STATUS: <span style="color: ${statusColor}; text-transform: uppercase;">${status}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); line-height: 1.3; background: rgba(0,0,0,0.2); padding: 8px; border: var(--border-thin); min-height: 48px; border-color: rgba(255,255,255,0.05);">
                        ${notes}
                    </div>
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
};

// ---------------------------------------------------------------------------
// Visual Storybook
// ---------------------------------------------------------------------------
window.renderStorybookView = async function() {
    const storybookBox = document.getElementById("storybook-container");
    if (!storybookBox) return;

    if (!window.state || !window.state.chronicle || window.state.chronicle.length === 0) {
        storybookBox.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:13px;">Your storybook canvas remains completely unwritten. Submit a log slate with active graphics to generate pages.</div>`;
        return;
    }

    // Phase 1: render skeleton cards immediately (reversed — latest week first)
    const reversedChronicle = [...window.state.chronicle].reverse();
    storybookBox.innerHTML = reversedChronicle.map((logString, index) => {
        const matchPattern = logString.match(/^W(\d+(?:-W?\d+)?):/i);
        const rawWeek = matchPattern ? matchPattern[1] : null;

        let weekTagText = "LOG SEGMENT";
        if (rawWeek) {
            if (rawWeek.includes("-")) {
                weekTagText = `WEEKS ${rawWeek.replace(/W/gi, "")}`;
            } else {
                weekTagText = `WEEK ${rawWeek.length < 2 ? '0' + rawWeek : rawWeek}`;
            }
        }

        return `
            <div class="storybook-card">
                <div class="storybook-image-frame" id="storybook-img-container-${index}">
                    <div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:10px; text-align:center; color:var(--text-muted); padding:10px; font-weight:bold;">LOADING...</div>
                </div>
                <div class="storybook-content">
                    <div class="storybook-week-tag">${weekTagText}</div>
                    <p class="storybook-desc" id="storybook-desc-${index}">${logString}</p>
                </div>
            </div>
        `;
    }).join("");

    // Phase 2: load images asynchronously (use same reversed array for index consistency)
    for (let index = 0; index < reversedChronicle.length; index++) {
        const logString = reversedChronicle[index];
        const matchPattern = logString.match(/^W(\d+(?:-W?\d+)?):/i);
        const rawWeek = matchPattern ? matchPattern[1] : null;

        const imgContainer = document.getElementById(`storybook-img-container-${index}`);
        if (!imgContainer) continue;

        const isRange = rawWeek && rawWeek.includes("-");
        const parsedWeek = (rawWeek && !isRange) ? rawWeek : null;

        if (parsedWeek) {
            try {
                const imgSrc = await window.getStorybookImageSrc(parsedWeek);
                if (imgSrc) {
                    imgContainer.innerHTML = `
                        <img src="${imgSrc}" alt="Week ${parsedWeek} Vector Frame" />
                        <div class="storybook-image-overlay">🔍 VIEW FULL BLUEPRINT</div>
                    `;
                    imgContainer.onclick = () => {
                        const descText = document.getElementById(`storybook-desc-${index}`).innerText;
                        window.openLightbox(imgSrc, `WEEK ${parsedWeek} ASSEMBLY RECORD`, descText);
                    };
                    imgContainer.style.cursor = "pointer";
                    continue;
                }
            } catch (e) {
                console.error(e);
            }
            imgContainer.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:10px; text-align:center; color:var(--text-muted); padding:10px; font-weight:bold; border-right:1px solid #1a3254;">IMAGE DECK EMPTY [W${parsedWeek}]</div>`;
            imgContainer.onclick = null;
            imgContainer.style.cursor = "default";
        } else {
            imgContainer.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:10px; text-align:center; color:var(--text-muted); padding:10px; font-weight:bold; border-right:1px solid #1a3254; background: #0c1c2e;">HISTORICAL RECORD</div>`;
            imgContainer.onclick = null;
            imgContainer.style.cursor = "default";
        }
    }
};

// ---------------------------------------------------------------------------
// Welcome screen (campaign slot list)
// ---------------------------------------------------------------------------
window.renderWelcomeScreen = function() {
    const listContainer = document.getElementById("welcome-campaign-list");
    if (!listContainer) return;

    const list = window.getCampaignsList();
    if (list.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 15px; color: var(--text-muted); font-size: 12px; font-family: 'JetBrains Mono', monospace; border: var(--border-thin); background: rgba(0,0,0,0.1);">No saved campaigns found. Start a new timeline above!</div>`;
    } else {
        listContainer.innerHTML = list.map(campaign => {
            const dateStr = new Date(campaign.timestamp).toLocaleString();
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); border: var(--border-thin); padding: 8px 12px; gap: 10px;">
                    <div style="flex-grow: 1; min-width: 0;">
                        <div style="font-weight: bold; font-family: 'JetBrains Mono', monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff;">${campaign.name}</div>
                        <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Saved: ${dateStr}</div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        <button class="btn-utility" style="padding: 4px 8px; font-size: 11px; background: var(--comic-green); color: var(--ink-black); font-weight: bold;" onclick="window.loadCampaignFromSlot('${campaign.id}')">LOAD</button>
                        <button class="btn-utility" style="padding: 4px 8px; font-size: 11px; background: var(--comic-red); color: #fff;" onclick="window.deleteCampaignFromList('${campaign.id}')">DELETE</button>
                    </div>
                </div>
            `;
        }).join("");
    }

    const folderOption = document.getElementById("welcome-folder-option");
    if (folderOption) {
        folderOption.style.display = "block";
    }
};

// ---------------------------------------------------------------------------
// Config tab view
// ---------------------------------------------------------------------------
window.renderConfigView = function() {
    window.updateDashboardFolderStatus();

    // Render Blueprint Courier Prompt reactively
    const blueprintPromptTextarea = document.getElementById("blueprint-prompt-textarea");
    if (blueprintPromptTextarea) {
        if (window.state && window.state.facility) {
            blueprintPromptTextarea.value = window.compileBlueprintPrompt(window.state.facility);
        } else {
            blueprintPromptTextarea.value = "Awaiting facility state matrix ingestion...";
        }
    }

    const statusNode = document.getElementById("dir-status-text");
    const folderNameNode = document.getElementById("dir-folder-name");
    const connectBtn = document.getElementById("btn-connect-dir");
    const manualBackupBtn = document.getElementById("btn-manual-backup");

    if (!window.showDirectoryPicker) {
        window.directoryStatus = "Unsupported";
    }

    if (window.directoryStatus === "Connected" && window.dirHandle) {
        if (statusNode) statusNode.innerHTML = `<span style="color: var(--comic-green)">CONNECTED</span>`;
        if (folderNameNode) folderNameNode.innerText = `📂 Folder: ${window.dirHandle.name}`;
        if (connectBtn) connectBtn.innerText = "🔌 DISCONNECT DIRECTORY";
        if (manualBackupBtn) manualBackupBtn.style.display = "inline-block";
    } else if (window.directoryStatus === "Re-auth Required") {
        if (statusNode) statusNode.innerHTML = `<span style="color: var(--comic-amber)">RE-AUTHORIZATION REQUIRED</span>`;
        if (folderNameNode) folderNameNode.innerText = `📂 Folder: ${window.dirHandle ? window.dirHandle.name : 'Unknown'} (Disconnected)`;
        if (connectBtn) connectBtn.innerText = "🔑 RE-AUTHORIZE DIRECTORY";
        if (manualBackupBtn) manualBackupBtn.style.display = "none";
    } else if (window.directoryStatus === "Unsupported") {
        if (statusNode) statusNode.innerHTML = `<span style="color: var(--comic-red)">UNSUPPORTED BROWSER</span>`;
        if (folderNameNode) folderNameNode.innerText = "Directory API not supported on this browser. Use Chrome, Edge, or Opera.";
        if (connectBtn) connectBtn.style.display = "none";
        if (manualBackupBtn) manualBackupBtn.style.display = "none";
    } else {
        if (statusNode) statusNode.innerHTML = `<span style="color: var(--text-muted)">DISCONNECTED</span>`;
        if (folderNameNode) folderNameNode.innerText = "No directory connected. Backups and images disabled.";
        if (connectBtn) connectBtn.innerText = "📁 CONNECT LOCAL DIRECTORY";
        if (manualBackupBtn) manualBackupBtn.style.display = "none";
    }

    // Reauth banner
    const banner = document.getElementById("reauth-banner");
    const reauthFolderName = document.getElementById("reauth-folder-name");
    if (window.directoryStatus === "Re-auth Required") {
        if (banner) {
            banner.style.display = "block";
            if (reauthFolderName && window.dirHandle) {
                reauthFolderName.innerText = window.dirHandle.name;
            }
        }
    } else {
        if (banner) banner.style.display = "none";
    }

    // Asset tracker table
    const trackerBody = document.getElementById("asset-tracker-body");
    if (!trackerBody) return;

    if (!window.state || !window.state.chronicle || window.state.chronicle.length === 0) {
        trackerBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No chronicle entries yet. Sync a delta slate to track assets.</td></tr>`;
        return;
    }

    trackerBody.innerHTML = window.state.chronicle.flatMap((logString) => {
        const matchPattern = logString.match(/^W(\d+):/i);
        const parsedWeek = matchPattern ? matchPattern[1] : null;
        if (!parsedWeek) return [];

        // 1. Storybook Row
        const storybookName = `storybook_week_${parsedWeek}.png`;
        const isStorybookTracked = window.state.storybook_images && window.state.storybook_images[parsedWeek] ? "Tracked" : "Not Tracked";
        const isStorybookTrackedColor = isStorybookTracked === "Tracked" ? "var(--comic-green)" : "var(--text-muted)";

        let storybookLocalStatus = "Disconnected";
        let storybookLocalColor = "var(--text-muted)";
        if (window.dirHandle) {
            const exists = window.localFilesMap && window.localFilesMap[parsedWeek];
            storybookLocalStatus = exists ? "Found in Folder" : "Not Found";
            storybookLocalColor = exists ? "var(--comic-green)" : "var(--comic-red)";
        } else if (!window.showDirectoryPicker) {
            storybookLocalStatus = "Unsupported";
            storybookLocalColor = "var(--comic-red)";
        }

        // 2. Facility Row
        const facilityName = `facility_week_${parsedWeek}.png`;
        const isFacilityTracked = window.state.facility_images && window.state.facility_images[parsedWeek] ? "Tracked" : "Not Tracked";
        const isFacilityTrackedColor = isFacilityTracked === "Tracked" ? "var(--comic-green)" : "var(--text-muted)";

        let facilityLocalStatus = "Disconnected";
        let facilityLocalColor = "var(--text-muted)";
        if (window.dirHandle) {
            const exists = window.localFacilityFilesMap && window.localFacilityFilesMap[parsedWeek];
            facilityLocalStatus = exists ? "Found in Folder" : "Not Found";
            facilityLocalColor = exists ? "var(--comic-green)" : "var(--comic-red)";
        } else if (!window.showDirectoryPicker) {
            facilityLocalStatus = "Unsupported";
            facilityLocalColor = "var(--comic-red)";
        }

        const rows = [
            `
            <tr>
                <td style="font-weight: bold; color: var(--comic-amber)">Week ${parsedWeek} (Scene)</td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">storybook/${storybookName}</td>
                <td style="color: ${isStorybookTrackedColor}; font-weight: bold;">${isStorybookTracked}</td>
                <td style="color: ${storybookLocalColor}; font-weight: bold;">${storybookLocalStatus}</td>
                <td>
                    <button class="btn-utility" style="padding: 4px 8px; font-size: 11px; margin: 0 auto; display: block;" onclick="window.bindAssetForWeek(${parsedWeek}, 'storybook')">
                        📁 UPLOAD & BIND
                    </button>
                </td>
            </tr>
            `
        ];

        const isCurrentWeek = parseInt(parsedWeek) === parseInt(window.state.week);
        const facilityExists = (isFacilityTracked === "Tracked" || facilityLocalStatus === "Found in Folder");

        if (isCurrentWeek || facilityExists) {
            rows.push(`
            <tr>
                <td style="font-weight: bold; color: var(--comic-amber)">Week ${parsedWeek} (Layout)</td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">facility/${facilityName}</td>
                <td style="color: ${isFacilityTrackedColor}; font-weight: bold;">${isFacilityTracked}</td>
                <td style="color: ${facilityLocalColor}; font-weight: bold;">${facilityLocalStatus}</td>
                <td>
                    <button class="btn-utility" style="padding: 4px 8px; font-size: 11px; margin: 0 auto; display: block;" onclick="window.bindAssetForWeek(${parsedWeek}, 'facility')">
                        📁 UPLOAD & BIND
                    </button>
                </td>
            </tr>
            `);
        }

        return rows;
    }).join("");
};

// ---------------------------------------------------------------------------
// Global Objectives Renderer
// ---------------------------------------------------------------------------
window.renderGlobalObjectives = function() {
    const container = document.getElementById("objectives-container");
    const section = document.getElementById("global-objectives-section");
    if (!container || !section) return;

    if (!window.state || !window.state.global_objectives || window.state.global_objectives.length === 0) {
        section.style.display = "none";
        container.innerHTML = "";
        return;
    }

    section.style.display = "block";

    let html = "";
    for (const obj of window.state.global_objectives) {
        const title = obj.title || "Campaign Objective";
        const metric = obj.target_metric || "Progress";
        const current = obj.current !== undefined ? obj.current : 0;
        const target = obj.target !== undefined ? obj.target : 1;
        const status = obj.status || "active";
        const bottleneck = obj.bottleneck || "";

        const pct = Math.round((current / Math.max(1, target)) * 100);

        // Status Badge Style
        let statusClass = "status-active";
        if (status === "blocked") statusClass = "status-blocked";
        else if (status === "completed" || status === "complete") statusClass = "status-completed";

        // Bottleneck HTML
        let bottleneckHtml = "";
        if (bottleneck && status !== "completed" && status !== "complete") {
            bottleneckHtml = `
                <div class="objective-bottleneck-box">
                    <div class="objective-bottleneck-label">
                        ⚠️ BOTTLENECK ACTIVE
                    </div>
                    <div>${bottleneck}</div>
                </div>
            `;
        }

        const progressBarHtml = renderObjectiveProgressBar(current, target, status);

        html += `
            <div class="objective-card">
                <div class="objective-header">
                    <div class="objective-title">${title}</div>
                    <div class="objective-status-badge ${statusClass}">${status}</div>
                </div>
                <div class="objective-metric-row">
                    <span>${metric}</span>
                    <span>${current} / ${target} (${pct}%)</span>
                </div>
                ${progressBarHtml}
                ${bottleneckHtml}
            </div>
        `;
    }

    container.innerHTML = html;
};

function renderObjectiveProgressBar(current, target, status) {
    target = Math.max(1, parseInt(target) || 1);
    current = Math.max(0, parseInt(current) || 0);
    const ratio = Math.min(1, current / target);
    
    let segmentsHtml = "";
    const colorClass = status === "blocked" ? "filled-blocked" : (status === "completed" || status === "complete" ? "filled-completed" : "filled-active");
    
    if (target <= 10) {
        for (let i = 0; i < target; i++) {
            const isFilled = i < current;
            segmentsHtml += `<div class="objective-progress-segment ${isFilled ? colorClass : ''}"></div>`;
        }
    } else {
        const filledSegments = Math.round(ratio * 10);
        for (let i = 0; i < 10; i++) {
            const isFilled = i < filledSegments;
            segmentsHtml += `<div class="objective-progress-segment ${isFilled ? colorClass : ''}"></div>`;
        }
    }
    
    return `
        <div class="objective-progress-container">
            ${segmentsHtml}
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Facility Infrastructure & Utilities Renderer
// ---------------------------------------------------------------------------
window.renderFacilityInfrastructure = function() {
    const section = document.getElementById("facility-infrastructure-section");
    const gridContainer = document.getElementById("environmental-grid-container");
    const nodesContainer = document.getElementById("infrastructure-nodes-container");
    
    if (!section || !gridContainer || !nodesContainer) return;

    if (!window.state || !window.state.facility) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";

    // 1. Environmental Grid (Utility Gauges)
    const envGrid = window.state.facility.environmental_grid || [];
    let gridHtml = "";
    if (envGrid.length === 0) {
        gridHtml = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted); font-size: 12px; padding: 12px; border: var(--border-thin); background: rgba(0,0,0,0.1);">No grid utility systems online.</div>`;
    } else {
        for (const grid of envGrid) {
            const current = parseFloat(grid.current) || 0;
            const ceiling = parseFloat(grid.ceiling) || 1;
            const pct = Math.min(100, Math.round((current / ceiling) * 100));
            const isOverload = current > ceiling;
            const barColor = isOverload ? "var(--comic-red)" : "var(--comic-amber)";
            const progressClass = isOverload ? "flashing-alert" : "";
            const alertBadge = isOverload ? `<span class="flashing-alert" style="color: #fff; font-weight: bold; font-size: 9px; padding: 2px 4px; border: var(--border-thin); border-color: var(--comic-red);">⚠️ OVERLOAD</span>` : "";

            gridHtml += `
                <div class="num-box" style="border-color: ${barColor}; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="num-label" style="color: ${isOverload ? 'var(--comic-red)' : 'var(--text-muted)'};">${grid.label}</div>
                        ${alertBadge}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <div class="num-val" style="font-size: 24px; margin-top: 0; color: ${barColor};">
                            ${current} <span style="font-size: 13px; font-family: 'JetBrains Mono', monospace; font-weight: bold; color: var(--text-main);">${grid.unit || ""}</span>
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); font-weight: bold;">
                            MAX: ${ceiling} ${grid.unit || ""}
                        </div>
                    </div>
                    <div style="background: rgba(0, 0, 0, 0.4); border: var(--border-thin); height: 12px; padding: 2px;">
                        <div class="${progressClass}" style="width: ${pct}%; height: 100%; background: ${barColor}; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        }
    }
    gridContainer.innerHTML = gridHtml;

    // 2. Infrastructure Nodes
    const nodes = window.state.facility.infrastructure_nodes || [];
    let nodesHtml = "";
    if (nodes.length === 0) {
        nodesHtml = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted); font-size: 12px; padding: 20px; border: var(--border-thin); background: rgba(0,0,0,0.1);">No active heavy machinery or workstations cataloged.</div>`;
    } else {
        for (const node of nodes) {
            const conditionLower = (node.condition || "").toLowerCase();
            const isAlert = conditionLower === "degraded" || conditionLower === "blown";
            const cardBorderColor = isAlert ? "var(--comic-red)" : "var(--comic-amber)";
            
            const conditionBadge = isAlert 
                ? `<span class="objective-status-badge status-blocked flashing-alert" style="margin-left: auto;">⚠️ ${node.condition.toUpperCase()}</span>`
                : `<span class="objective-status-badge status-active" style="margin-left: auto; background: var(--panel-bg); color: var(--text-main); border-color: var(--comic-amber);">${node.condition.toUpperCase()}</span>`;

            let ruleModHtml = "";
            if (node.rule_modifier && node.rule_modifier.target && node.rule_modifier.target !== "NONE") {
                const valSign = node.rule_modifier.value >= 0 ? `+${node.rule_modifier.value}` : node.rule_modifier.value;
                ruleModHtml = `
                    <div style="font-size: 11px; margin-top: 6px; padding: 4px 8px; background: rgba(0,0,0,0.15); border-left: 2px solid ${cardBorderColor}; color: var(--text-main);">
                        <strong>Roll Modifier:</strong> ${valSign} to ${node.rule_modifier.target} on <em>"${node.rule_modifier.trigger}"</em>
                    </div>
                `;
            }

            nodesHtml += `
                <div class="objective-card" style="border-color: ${cardBorderColor};">
                    <div class="objective-header" style="align-items: center; margin-bottom: 2px;">
                        <div class="objective-title" style="color: ${isAlert ? 'var(--comic-red)' : '#fff'};">${node.label}</div>
                        ${conditionBadge}
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); font-weight: bold; text-transform: uppercase; margin-bottom: 6px;">
                        ${node.category}
                    </div>
                    <div style="font-size: 11px; background: rgba(0,0,0,0.2); padding: 8px; border: var(--border-thin); border-color: rgba(255,255,255,0.05); min-height: 44px; line-height: 1.3;">
                        <span style="font-size: 9px; color: var(--text-muted); display: block; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Active Quirk</span>
                        ${node.active_quirk || "None registered."}
                    </div>
                    ${ruleModHtml}
                </div>
            `;
        }
    }
    nodesContainer.innerHTML = nodesHtml;

    // 3. Structural Flaws
    const flawsContainer = document.getElementById("structural-flaws-container");
    const flawsTitle = document.getElementById("structural-flaws-title-node");
    const flaws = window.state.facility.structural_flaws || [];
    if (flawsContainer) {
        if (flaws.length === 0) {
            if (flawsTitle) flawsTitle.style.display = "none";
            flawsContainer.style.display = "none";
        } else {
            if (flawsTitle) flawsTitle.style.display = "block";
            flawsContainer.style.display = "grid";
            
            let flawsHtml = "";
            for (const flaw of flaws) {
                const label = flaw.label || "Structural Flaw";
                const severity = flaw.severity || "Minor";
                const isCritical = severity.toLowerCase() === "major" || severity.toLowerCase() === "critical";
                const severityClass = isCritical ? "status-blocked" : "status-active";
                
                let ruleModHtml = "";
                if (flaw.rule_modifier && flaw.rule_modifier.target && flaw.rule_modifier.target !== "NONE") {
                    const valSign = flaw.rule_modifier.value >= 0 ? `+${flaw.rule_modifier.value}` : flaw.rule_modifier.value;
                    ruleModHtml = `
                        <div style="font-size: 11px; margin-top: 6px; padding: 4px 8px; background: rgba(0,0,0,0.15); border-left: 2px solid var(--comic-red); color: var(--text-main);">
                            <strong>Roll Modifier:</strong> ${valSign} to ${flaw.rule_modifier.target} on <em>"${flaw.rule_modifier.trigger}"</em>
                        </div>
                    `;
                }

                flawsHtml += `
                    <div class="objective-card" style="border-color: var(--comic-red);">
                        <div class="objective-header" style="align-items: center; margin-bottom: 4px;">
                            <div class="objective-title" style="color: var(--comic-red);">${label}</div>
                            <span class="objective-status-badge ${severityClass}" style="margin-left: auto;">${severity.toUpperCase()}</span>
                        </div>
                        ${ruleModHtml}
                    </div>
                `;
            }
            flawsContainer.innerHTML = flawsHtml;
        }
    }

    // Render Bays & Clocks
    window.renderBaysAndClocks();

    // Render Facility Carousel
    window.renderFacilityCarousel();
};

// ---------------------------------------------------------------------------
// Facility Blueprint State Carousel
// ---------------------------------------------------------------------------
window.facilityCarouselWeek = null;

window.renderFacilityCarousel = function() {
    const container = document.getElementById("facility-carousel-container");
    if (!container) return;

    if (!window.state || !window.state.week) {
        container.innerHTML = "";
        return;
    }

    // Get list of all weeks that actually have facility images
    const activeWeeks = [];
    if (window.state.facility_images) {
        for (const w of Object.keys(window.state.facility_images)) {
            const num = parseInt(w);
            if (!isNaN(num) && !activeWeeks.includes(num)) activeWeeks.push(num);
        }
    }
    if (window.localFacilityFilesMap) {
        for (const [w, exists] of Object.entries(window.localFacilityFilesMap)) {
            if (exists) {
                const num = parseInt(w);
                if (!isNaN(num) && !activeWeeks.includes(num)) activeWeeks.push(num);
            }
        }
    }
    activeWeeks.sort((a, b) => a - b);

    // If activeWeeks is empty, default to the current week
    if (activeWeeks.length === 0) {
        activeWeeks.push(window.state.week);
    }

    // Default to the last uploaded/available week
    if (window.facilityCarouselWeek === null || !activeWeeks.includes(window.facilityCarouselWeek)) {
        window.facilityCarouselWeek = activeWeeks[activeWeeks.length - 1];
    }

    const currentSlideWeek = window.facilityCarouselWeek;
    const currentIndex = activeWeeks.indexOf(currentSlideWeek);

    const prevWeek = currentIndex > 0 ? activeWeeks[currentIndex - 1] : null;
    const nextWeek = currentIndex < activeWeeks.length - 1 ? activeWeeks[currentIndex + 1] : null;

    container.innerHTML = `
        <div style="width: 100%; max-width: 600px; border: var(--border-thick); background: var(--panel-nested); box-shadow: 4px 4px 0px var(--ink-black); position: relative; overflow: hidden; display: flex; flex-direction: column;">
            <!-- Image Wrapper -->
            <div id="facility-carousel-img-frame" style="width: 100%; height: 320px; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; position: relative;">
                <div style="font-size: 12px; color: var(--text-muted); font-weight: bold;">LOADING ISOMETRIC BLUEPRINT [W${currentSlideWeek}]...</div>
            </div>
            <!-- Slide Label & Navigation -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--panel-bg); border-top: var(--border-thin); gap: 10px;">
                <button 
                    class="btn-utility" 
                    style="padding: 4px 12px; font-size: 11px; font-weight: bold; background: ${prevWeek !== null ? 'var(--comic-amber)' : 'rgba(0,0,0,0.2)'}; color: ${prevWeek !== null ? 'var(--ink-black)' : 'var(--text-muted)'}; border: var(--border-thin);"
                    onclick="window.changeFacilityCarouselWeek(-1)"
                    ${prevWeek !== null ? '' : 'disabled'}
                >
                    ◀ PREV IMAGE
                </button>
                <div style="text-align: center;">
                    <div style="font-family: 'Permanent Marker', cursive; font-size: 14px; color: #fff;">WEEK ${currentSlideWeek < 10 ? '0' + currentSlideWeek : currentSlideWeek} LAYOUT</div>
                    <div style="font-size: 10px; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">Blueprint Configuration</div>
                </div>
                <button 
                    class="btn-utility" 
                    style="padding: 4px 12px; font-size: 11px; font-weight: bold; background: ${nextWeek !== null ? 'var(--comic-amber)' : 'rgba(0,0,0,0.2)'}; color: ${nextWeek !== null ? 'var(--ink-black)' : 'var(--text-muted)'}; border: var(--border-thin);"
                    onclick="window.changeFacilityCarouselWeek(1)"
                    ${nextWeek !== null ? '' : 'disabled'}
                >
                    NEXT IMAGE ▶
                </button>
            </div>
        </div>
    `;

    // Resolve Image Asynchronously
    window.getFacilityImageSrc(currentSlideWeek).then((imgSrc) => {
        const frame = document.getElementById("facility-carousel-img-frame");
        if (!frame) return;

        if (imgSrc) {
            frame.innerHTML = `
                <img src="${imgSrc}" alt="Week ${currentSlideWeek} Facility Blueprint" style="max-width: 100%; max-height: 100%; object-fit: contain; cursor: pointer;" />
                <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: var(--comic-amber); font-size: 9px; padding: 2px 6px; font-weight: bold; text-transform: uppercase; border: var(--border-thin);">
                    🔍 VIEW SCHEMATIC
                </div>
            `;
            frame.onclick = () => {
                window.openLightbox(imgSrc, `WEEK ${currentSlideWeek} WORKSHOP BLUEPRINT`, `Technical isometric blueprint cross-section rendering for layout at week ${currentSlideWeek}.`);
            };
            frame.style.cursor = "pointer";
        } else {
            frame.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 20px; color: var(--text-muted);">
                    <div style="font-family: 'Permanent Marker', cursive; font-size: 16px; color: var(--comic-red);">NO BLUEPRINT SCHEMATIC RECORDED</div>
                    <div style="font-size: 11px; max-width: 320px; line-height: 1.4;">
                        No isometric layout renders have been uploaded or bound for Week ${currentSlideWeek}. Go to the <strong>CONFIG & ASSETS tab</strong> to upload layouts.
                    </div>
                </div>
            `;
            frame.onclick = null;
            frame.style.cursor = "default";
        }
    });
};

window.changeFacilityCarouselWeek = function(delta) {
    if (!window.state || !window.state.week) return;

    const activeWeeks = [];
    if (window.state.facility_images) {
        for (const w of Object.keys(window.state.facility_images)) {
            const num = parseInt(w);
            if (!isNaN(num) && !activeWeeks.includes(num)) activeWeeks.push(num);
        }
    }
    if (window.localFacilityFilesMap) {
        for (const [w, exists] of Object.entries(window.localFacilityFilesMap)) {
            if (exists) {
                const num = parseInt(w);
                if (!isNaN(num) && !activeWeeks.includes(num)) activeWeeks.push(num);
            }
        }
    }
    activeWeeks.sort((a, b) => a - b);

    if (activeWeeks.length === 0) {
        activeWeeks.push(window.state.week);
    }

    if (window.facilityCarouselWeek === null || !activeWeeks.includes(window.facilityCarouselWeek)) {
        window.facilityCarouselWeek = activeWeeks[activeWeeks.length - 1];
    }

    const currentIndex = activeWeeks.indexOf(window.facilityCarouselWeek);
    const targetIndex = currentIndex + delta;
    if (targetIndex >= 0 && targetIndex < activeWeeks.length) {
        window.facilityCarouselWeek = activeWeeks[targetIndex];
        window.renderFacilityCarousel();
    }
};

// ---------------------------------------------------------------------------
// Workshop Inventory Renderer
// ---------------------------------------------------------------------------
window.renderInventory = function() {
    const section = document.getElementById("inventory-section");
    const vehiclesContainer = document.getElementById("inventory-vehicles-container");
    const componentsContainer = document.getElementById("inventory-components-container");

    if (!section || !vehiclesContainer || !componentsContainer) return;

    if (!window.state || !window.state.inventory) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";

    // 1. Render Vehicles
    const vehicles = window.state.inventory.vehicles || [];
    let vehiclesHtml = "";
    if (vehicles.length === 0) {
        vehiclesHtml = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted); font-size: 12px; padding: 20px; border: var(--border-thin); background: rgba(0,0,0,0.1);">No vehicles cataloged in active stock.</div>`;
    } else {
        for (const vehicle of vehicles) {
            const condLower = (vehicle.condition || "").toLowerCase();
            const isAlert = condLower === "degraded" || condLower === "critical";
            const cardBorderColor = isAlert ? "var(--comic-red)" : "var(--comic-green)";
            const condColor = condLower === "optimal" ? "var(--comic-green)" : (condLower === "nominal" ? "var(--text-main)" : "var(--comic-red)");

            const statusBadge = `<span class="objective-status-badge status-active" style="margin-left: auto; background: var(--panel-bg); color: var(--comic-amber); border-color: var(--comic-amber);">${vehicle.status.toUpperCase()}</span>`;

            vehiclesHtml += `
                <div class="objective-card" style="border-color: ${cardBorderColor};">
                    <div class="objective-header" style="align-items: center; margin-bottom: 2px;">
                        <div class="objective-title" style="color: #fff;">${vehicle.label}</div>
                        ${statusBadge}
                    </div>
                    <div style="display: flex; gap: 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; color: var(--text-muted);">
                        <span>ID: ${vehicle.id}</span>
                        <span>|</span>
                        <span>Powertrain: <strong style="color: var(--text-main);">${vehicle.powertrain}</strong></span>
                    </div>
                    <div style="font-size: 11px; background: rgba(0,0,0,0.2); padding: 8px; border: var(--border-thin); border-color: rgba(255,255,255,0.05); min-height: 44px; line-height: 1.3; margin-bottom: 8px;">
                        <span style="font-size: 9px; color: var(--text-muted); display: block; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Active Quirk</span>
                        ${vehicle.active_quirk || "None registered."}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; margin-top: auto; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <div>Condition: <strong style="color: ${condColor};">${vehicle.condition}</strong></div>
                        <div style="font-family: 'JetBrains Mono', monospace; color: var(--comic-amber); font-weight: bold;">
                            Est. Value: $${formatCurrency(vehicle.market_value)}
                        </div>
                    </div>
                </div>
            `;
        }
    }
    vehiclesContainer.innerHTML = vehiclesHtml;

    // 2. Render Components
    const components = window.state.inventory.components || [];
    let componentsHtml = "";
    if (components.length === 0) {
        componentsHtml = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted); font-size: 12px; padding: 20px; border: var(--border-thin); background: rgba(0,0,0,0.1);">No feedstock or raw parts components cataloged.</div>`;
    } else {
        for (const comp of components) {
            const condLower = (comp.condition || "").toLowerCase();
            const isAlert = condLower === "degraded" || condLower === "blown" || condLower === "critical";
            const cardBorderColor = isAlert ? "var(--comic-red)" : "var(--comic-amber)";
            const condColor = condLower === "optimal" ? "var(--comic-green)" : (condLower === "nominal" ? "var(--text-main)" : "var(--comic-red)");

            const quantityBadge = `<span class="objective-status-badge status-active" style="margin-left: auto; background: var(--panel-bg); color: var(--text-main); border-color: var(--comic-amber); font-weight: bold;">${comp.quantity} ${comp.unit}</span>`;

            let ruleModHtml = "";
            if (comp.rule_modifier && comp.rule_modifier.target && comp.rule_modifier.target !== "NONE") {
                const valSign = comp.rule_modifier.value >= 0 ? `+${comp.rule_modifier.value}` : comp.rule_modifier.value;
                ruleModHtml = `
                    <div style="font-size: 11px; margin-top: 6px; padding: 4px 8px; background: rgba(0,0,0,0.15); border-left: 2px solid ${cardBorderColor}; color: var(--text-main);">
                        <strong>Roll Modifier:</strong> ${valSign} to ${comp.rule_modifier.target} on <em>"${comp.rule_modifier.trigger}"</em>
                    </div>
                `;
            }

            componentsHtml += `
                <div class="objective-card" style="border-color: ${cardBorderColor};">
                    <div class="objective-header" style="align-items: center; margin-bottom: 2px;">
                        <div class="objective-title" style="color: #fff;">${comp.label}</div>
                        ${quantityBadge}
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); font-weight: bold; text-transform: uppercase; margin-bottom: 6px;">
                        ${comp.category}
                    </div>
                    <div style="font-size: 11px; background: rgba(0,0,0,0.2); padding: 8px; border: var(--border-thin); border-color: rgba(255,255,255,0.05); min-height: 44px; line-height: 1.3; margin-bottom: 4px;">
                        <span style="font-size: 9px; color: var(--text-muted); display: block; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Condition & Context</span>
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <span>Status: <strong style="color: ${condColor};">${comp.condition}</strong></span>
                            <span style="font-size: 9px; color: var(--text-muted);">ID: ${comp.id}</span>
                        </div>
                    </div>
                    ${ruleModHtml}
                </div>
            `;
        }
    }
    componentsContainer.innerHTML = componentsHtml;
};

window.editCharDescription = function(charKey) {
    if (!window.state || !window.state.personnel) return;
    const char = window.state.personnel[charKey];
    if (!char) return;

    const existingDesc = char.description || "";
    const newDesc = prompt(`Enter a narrative dossier / description for ${charKey.toUpperCase()}:`, existingDesc);
    if (newDesc === null) return; // User cancelled

    char.description = newDesc.trim();
    window.saveState();
    window.updateCharacterUIPanels();
    window.updateMergedPromptDisplay();
    window.triggerToast("DOSSIER UPDATED", `Dossier details updated for ${charKey.toUpperCase()}.`);
};

// =============================================================================
// 📐 APEX BLUEPRINT: NEW MECHANICS INTEGRATION
// =============================================================================

// 1. Draw SVG segmented countdown circle
window.drawSegmentedCircle = function(total, filled) {
    if (!total || total <= 0) total = 4;
    if (filled === undefined || filled < 0) filled = 0;
    
    let paths = "";
    const cx = 50;
    const cy = 50;
    const r = 35;
    const strokeWidth = 8;
    
    for (let i = 0; i < total; i++) {
        const startAngle = i * (360 / total) + 4;
        const endAngle = (i + 1) * (360 / total) - 4;
        const isFilled = i < filled;
        
        // Convert to Cartesian
        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (endAngle - 90) * Math.PI / 180;
        
        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);
        
        const largeArc = (endAngle - startAngle > 180) ? 1 : 0;
        const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
        
        const strokeColor = isFilled ? "var(--comic-red)" : "rgba(255,255,255,0.12)";
        const pulseClass = (isFilled && filled === total) ? "class=\"flashing-clock-filled\"" : "";
        
        paths += `<path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" ${pulseClass} />`;
    }
    
    const textVal = `${filled}/${total}`;
    
    return `
        <svg viewBox="0 0 100 100" style="width: 100%; height: 100%; display: block;">
            ${paths}
            <text x="50" y="55" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">
                ${textVal}
            </text>
        </svg>
    `;
};

// 2. Render Active Bay Modules and Project Clocks
window.renderBaysAndClocks = function() {
    const container = document.getElementById("active-bays-container");
    if (!container) return;
    
    if (!window.state || !window.state.facility) {
        container.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted);">No facility configuration data.</div>`;
        return;
    }
    
    const bays = window.state.facility.bays || [];
    const clocks = window.state.facility.project_clocks || [];
    
    let html = "";
    
    if (bays.length === 0) {
        html = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted); font-size: 12px; padding: 12px; border: var(--border-thin); background: rgba(0,0,0,0.1);">No bays registered.</div>`;
    } else {
        for (const bay of bays) {
            const bayClocks = clocks.filter(c => c.bay_id === bay.id);
            
            let clocksHtml = "";
            if (bayClocks.length > 0) {
                for (const clock of bayClocks) {
                    clocksHtml += `
                        <div style="display: flex; gap: 12px; align-items: center; margin-top: 12px; background: rgba(0,0,0,0.25); padding: 8px; border: var(--border-thin); border-color: var(--comic-red);">
                            <div style="width: 60px; height: 60px; flex-shrink: 0;">
                                ${window.drawSegmentedCircle(clock.segments, clock.filled)}
                            </div>
                            <div style="min-width: 0; flex: 1;">
                                <div style="font-size: 11px; font-weight: bold; color: var(--comic-red); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${clock.title}">${clock.title}</div>
                                <div style="font-size: 10px; color: var(--text-main); margin-top: 2px;">
                                    ${clock.filled} / ${clock.segments} segments filled
                                </div>
                                <div style="font-size: 9px; color: var(--text-muted); margin-top: 4px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis;" title="${clock.penalty}">
                                    <strong>PENALTY:</strong> ${clock.penalty}
                                </div>
                            </div>
                        </div>
                    `;
                }
            } else {
                clocksHtml = `
                    <div style="margin-top: 12px; font-size: 10px; color: var(--text-muted); text-align: center; border: 1px dashed rgba(255,255,255,0.05); padding: 8px;">
                        🟢 No active threat clocks in this bay module.
                    </div>
                `;
            }
            
            html += `
                <div class="objective-card" style="border-color: var(--comic-amber); display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div class="objective-header" style="align-items: center; margin-bottom: 2px;">
                            <div class="objective-title" style="color: #fff; text-transform: uppercase;">${bay.contents}</div>
                            <span class="objective-status-badge status-active" style="margin-left: auto; background: var(--panel-bg); color: var(--text-main); border-color: var(--comic-amber); font-size: 8px;">${bay.footprint.toUpperCase()}</span>
                        </div>
                        <div style="font-size: 9px; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">
                            BAY ID: ${bay.id}
                        </div>
                    </div>
                    <div>
                        ${clocksHtml}
                    </div>
                </div>
            `;
        }
    }
    
    const orphanClocks = clocks.filter(c => !c.bay_id || !bays.some(b => b.id === c.bay_id));
    if (orphanClocks.length > 0) {
        for (const clock of orphanClocks) {
            html += `
                <div class="objective-card" style="border-color: var(--comic-red);">
                    <div class="objective-header" style="align-items: center; margin-bottom: 2px;">
                        <div class="objective-title" style="color: var(--comic-red); text-transform: uppercase;">⚠️ WORKSPACE THREAT CLOCK</div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center; margin-top: 8px;">
                        <div style="width: 60px; height: 60px; flex-shrink: 0;">
                            ${window.drawSegmentedCircle(clock.segments, clock.filled)}
                        </div>
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-size: 11px; font-weight: bold; color: var(--comic-red); text-transform: uppercase;">${clock.title}</div>
                            <div style="font-size: 10px; color: var(--text-main); margin-top: 2px;">
                                ${clock.filled} / ${clock.segments} segments filled
                            </div>
                            <div style="font-size: 9px; color: var(--text-muted); margin-top: 4px; line-height: 1.2;">
                                <strong>PENALTY:</strong> ${clock.penalty}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    container.innerHTML = html;
};

// 3. Update character assignment/Quiet Period status
window.updateCharAssignment = function(charKey, actionType) {
    if (!window.state || !window.state.personnel) return;
    const char = window.state.personnel[charKey];
    if (!char) return;
    
    if (actionType === "active") {
        char.current_assignment = null;
        window.triggerToast("⚔️ MISSION READY", `${charKey.toUpperCase()} marked as active for dilemmas.`);
    } else if (actionType === "maintenance") {
        char.current_assignment = {
            type: "Quiet Period",
            action: "Passive Maintenance",
            status: "In Progress"
        };
        window.triggerToast("🔧 PASSIVE MAINTENANCE", `${charKey.toUpperCase()} assigned to passive node maintenance.`);
    } else if (actionType === "rest") {
        char.current_assignment = {
            type: "Quiet Period",
            action: "Strategic Rest",
            status: "In Progress"
        };
        window.triggerToast("🛌 STRATEGIC REST", `${charKey.toUpperCase()} assigned to Rest and Morale recovery.`);
    } else if (actionType === "salvage") {
        char.current_assignment = {
            type: "Quiet Period",
            action: "Inventory Salvage",
            status: "In Progress"
        };
        window.triggerToast("♻️ INVENTORY SALVAGE", `${charKey.toUpperCase()} assigned to scrap inventory harvesting.`);
    }
    
    window.saveState();
    window.renderStateToDashboard();
    window.updateMergedPromptDisplay();
};



