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
// Blueprint concept illustration compiler (dynamic template literal engine)
// ---------------------------------------------------------------------------
window.compileBlueprintPrompt = function(facility) {
    if (!facility) return "Awaiting facility state matrix ingestion...";
    
    const activeBays = (facility.bays || []).map((b, i) => `Bay ${i+1}: ${b.contents} (${b.footprint} footprint)`).join("\n    ");
    const machinery = (facility.infrastructure_nodes || []).map(m => `${m.label} [Status: ${m.condition}] - Visual details: ${m.active_quirk}`).join("\n    ");
    const flaws = (facility.structural_flaws || []).map(f => `${f.label} [Severity: ${f.severity}] - Visual details: ${f.active_quirk}`).join("\n    ");

    return `[ARCHITECTURAL RE-RENDER SYSTEM DIRECTIVE]
You are an expert concept artist and drafting specialist specializing in technical isometric cross-sections. Generate a detailed architectural schematic of a mechanical workshop based on the active inventory configuration.

=========================================
🎨 IMMUTABLE GRAPHIC NOVEL ART DIRECTION
=========================================
- STYLE: Heavy, raw ink-black line work, distressed paper texture overlays, and deep architectural cross-hatching shadows. No soft 3D airbrushing or modern gradients.
- CAMERA PERSPECTIVE: Fixed 3/4 isometric cutaway profile view, looking down from a high, fixed angle into a three-bay industrial warehouse. Camera position must never shift.
- PALETTE: Strictly restricted dual-tone palette utilizing vintage blueprint navy (#1a365d) for structural lines/shadows and rich industrial mechanical amber (#f6ad55) for active indicators, equipment screens, or sparks.

=========================================
📊 LIVE INFRASTRUCTURE CONFIGURATION DATA
=========================================
Translate the following structural entities, machinery slots, and environmental data directly into the isometric layout framework:

- ACTIVE BAY SLOTS:
    ${activeBays || "All workshop bays currently clear and empty."}

- INFRASTRUCTURE & HEAVY TOOLS:
    ${machinery || "No heavy machinery installed on shop floor."}

- MECHANICAL & STRUCTURAL FLAWS:
    ${flaws || "No active structural defects or damage visible."}

Ensure every object listed above is assigned a distinct, logical spatial location within the three warehouse bays. Maintain the exact same structural perimeter lines as past iterations. Render the complete updated layout now.`;
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
