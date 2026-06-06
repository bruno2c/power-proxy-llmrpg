// =============================================================================
// init.js — Application Bootstrap
// =============================================================================
// The single DOMContentLoaded listener that wires up the application on page
// load. Initialises crop events, loads prompts, restores state from
// localStorage, restores the directory handle from IndexedDB, then decides
// whether to show the welcome screen or jump straight into the game.
// =============================================================================

window.addEventListener("DOMContentLoaded", () => {

    // 1. Initialise crop tool event listeners (defined in crop.js)
    window.initCropEventListeners();

    // 2. Load system prompt files (defined in prompts.js)
    if (typeof window.loadPromptsFromFiles === "function") {
        window.loadPromptsFromFiles();
    }

    // 3. Attempt to restore the active campaign from safe storage
    //    (migration shim in state.js already moved any legacy key data)
    const localCache = window.appStorage.getItem(window.SAVE_KEY);
    if (localCache) {
        try {
            window.state = JSON.parse(localCache);
            if (!window.state.storybook_images) {
                window.state.storybook_images = {};
            }
            if (!window.state.facility_images) {
                window.state.facility_images = {};
            }
        } catch (e) {
            console.error("Fault parsing cached local save state nodes.");
            window.state = null;
        }
    } else {
        window.state = null;
    }

    // 4. Restore the FileSystem directory handle from IndexedDB, then
    //    attempt to auto-load the latest backup and run the initial render.
    window.loadDirHandle().then(async (handle) => {
        if (handle) {
            window.dirHandle = handle;
            window.directoryName = handle.name;

            const options = { mode: 'read' };
            try {
                if (await handle.queryPermission(options) === 'granted') {
                    window.directoryStatus = "Connected";
                    await window.scanLocalDirectoryFiles();

                    // Try to auto-load campaign_state.json from the backup folder
                    await window.tryLoadCampaignFromBackup(handle);
                } else {
                    window.directoryStatus = "Re-auth Required";
                }
            } catch (err) {
                window.directoryStatus = "Re-auth Required";
            }
        } else {
            window.directoryStatus = "Disconnected";
        }

        // 5. Route to correct initial app state
        if (window.state && window.state.campaignId) {
            window.setAppState("game");
            window.renderStateToDashboard();
            window.renderStorybookView();
            window.renderConfigView();
        } else {
            window.setAppState("welcome");
        }

        // 6. Boot toast
        if (window.dirHandle && window.directoryStatus === "Connected") {
            window.triggerToast(
                "🎰 AUTO-LOAD COMPLETE",
                `Restored campaign tracking slate & bound folder: ${window.dirHandle.name}`
            );
        } else {
            const currentWeek = window.state ? window.state.week : 1;
            window.triggerToast(
                "🎰 AUTO-LOAD COMPLETE",
                `Restored company tracking slate smoothly at Week ${currentWeek}.`
            );
        }

    }).catch(err => {
        console.error("IndexedDB handle retrieval error:", err);
        if (window.state && window.state.campaignId) {
            window.setAppState("game");
            window.renderStateToDashboard();
            window.renderStorybookView();
            window.renderConfigView();
        } else {
            window.setAppState("welcome");
        }
    });
});
