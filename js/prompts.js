// System Prompts and Prompt Templates for APEX BLUEPRINT
window.RULES_PROMPT = `[SYSTEM_LAWS: APEX BLUEPRINT SIMULATION GAME MASTER]
⚠️ LOCAL RUNTIME DIRECTORY ACCESS BLOCK (CORS Policy Security Exception)
====================================================================
The core system rules cannot be loaded dynamically because index.html is being run locally via the direct file:// protocol.

To resolve this and load the full rules playbook:
1. Start a local HTTP server in this directory:
   python3 -m http.server 8000
   or
   npx serve
2. Open your browser and navigate to: http://localhost:8000
3. Alternatively, play the live canonical build at:
   https://bruno2c.github.io/apex-blueprint/`;

window.DYNAMIC_TEMPLATE = null;

window.getDynamicPrompt = function(activePayload, executionInstruction) {
    const template = window.DYNAMIC_TEMPLATE || `[SAVE_DATA_LOAD: RUNTIME DEEP MATRIX]
=========================================
💾 COMPLETE SNAPSHOT RUNTIME DATA (SOURCE OF TRUTH)
=========================================
{{activePayload}}

=========================================
⚙️ ENGINE ACTION COMMAND
=========================================
{{executionInstruction}}`;

    return template
        .replace("{{activePayload}}", activePayload)
        .replace("{{executionInstruction}}", executionInstruction);
};

window.loadPromptsFromFiles = async function() {
    try {
        const rulesResponse = await fetch('prompts/system_rules.md');
        if (rulesResponse.ok) {
            window.RULES_PROMPT = await rulesResponse.text();
            // Synchronize UI component if it's already rendered
            const manualPromptNode = document.getElementById("manual-prompt-node");
            if (manualPromptNode) {
                manualPromptNode.value = window.RULES_PROMPT;
            }
        }
    } catch (err) {
        console.warn("Could not fetch prompts/system_rules.md, using static fallback:", err);
    }

    try {
        const templateResponse = await fetch('prompts/dynamic_template.md');
        if (templateResponse.ok) {
            window.DYNAMIC_TEMPLATE = await templateResponse.text();
        }
    } catch (err) {
        console.warn("Could not fetch prompts/dynamic_template.md, using static fallback:", err);
    }
};

// ---------------------------------------------------------------------------
// Boardroom concept illustration compiler (dynamic template literal engine)
// ---------------------------------------------------------------------------
window.compileBlueprintPrompt = function() {
    if (!window.state) return "Aguardando inicialização da campanha...";
    
    const holdingName = (window.state.campaign_metrics && window.state.campaign_metrics.holding_company_name) || "Sterling & Roy Holdings";
    const p1 = window.state.heirs.player_1;
    const p2 = window.state.heirs.player_2;
    
    const p1Desc = p1 ? `${p1.name} (${p1.role})` : "Executivo 1";
    const p2Desc = p2 ? `${p2.name} (${p2.role})` : "Executivo 2";
    
    const clocks = (window.state.boardroom_clocks || []).map(c => `• ${c.name} (${c.segments_filled}/${c.total_segments} segmentos)`).join("\n    ") || "Nenhum relógio de ameaça ativo.";

    return `[SCENE ARTWORK DIRECTIVE: PODER & PROCURAÇÃO]
Generate a prestige cinematic photograph representing the current high-stakes boardroom tension for the holding company "${holdingName}".

=========================================
👥 ACTIVE CHARACTERS IN CONFLICT
=========================================
- Player 1: ${p1Desc}
- Player 2: ${p2Desc}
- Current Faction Clocks/Threats:
    ${clocks}

=========================================
🎨 IMMUTABLE PRESTIGE ART DIRECTION
=========================================
- STYLE RULES: Prestige analog cinematic style, shallow depth of field, 35mm cinema lenses, sharp symmetrical and razor-sharp framing, high-luxury brutalist or modern corporate penthouse architecture. Subtle and elegant film grain texture.
- COLOR THEORY: Minimalist and austere palette based on corporate navy blue, polished concrete slate grey, and sharp, warm tungsten lights (#f6ad55) reflecting off penthouse boardroom glass surfaces and executive desks. No neon or futuristic elements.
- COMPOSITION: Wide cinematic shot showing two rival executives, ${p1Desc} and ${p2Desc}, positioned in a cold, symmetric corporate setting. High contrast, sharp corporate drama atmosphere.`;
};

// ---------------------------------------------------------------------------
// Copy Blueprint Concept Prompt & Flash Action feedback
// ---------------------------------------------------------------------------
window.copyBlueprintPromptToClipboard = function() {
    const textarea = document.getElementById("blueprint-prompt-textarea");
    const btn = document.getElementById("btn-copy-blueprint-prompt");
    if (!textarea || !btn) return;

    const promptText = textarea.value;
    
    const performCopy = () => {
        const originalText = btn.innerHTML;
        btn.innerHTML = "✓ COPIED TO DATA SLATE";
        btn.style.backgroundColor = "var(--comic-green)";
        btn.style.color = "var(--ink-black)";

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.backgroundColor = "var(--comic-amber)";
            btn.style.color = "var(--ink-black)";
        }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(promptText)
            .then(performCopy)
            .catch(() => {
                textarea.select();
                document.execCommand("copy");
                performCopy();
            });
    } else {
        textarea.select();
        document.execCommand("copy");
        performCopy();
    }
};
