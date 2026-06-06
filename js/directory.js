// =============================================================================
// directory.js — File System Access API & IndexedDB Persistence
// =============================================================================
// All logic related to the browser's File System Access API (showDirectoryPicker,
// FileSystemDirectoryHandle) and IndexedDB handle persistence. Also manages
// avatar image sources and storybook image sources from the connected folder.
// =============================================================================

// ---------------------------------------------------------------------------
// Directory state globals
// ---------------------------------------------------------------------------
window.dirHandle = null;
window.directoryName = "";
window.directoryStatus = "Disconnected"; // "Disconnected" | "Connected" | "Re-auth Required" | "Unsupported"
window.localFilesMap = {}; // { [week]: Boolean }

// ---------------------------------------------------------------------------
// IndexedDB — persists the FileSystemDirectoryHandle across page reloads
// ---------------------------------------------------------------------------
window.saveDirHandle = function(handle, campaignId = null) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("ApexBlueprintDB", 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("handles")) {
                db.createObjectStore("handles");
            }
        };
        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction("handles", "readwrite");
            const store = tx.objectStore("handles");
            store.put(handle, "dirHandle");
            if (campaignId) {
                store.put(handle, campaignId);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
    });
};

window.loadDirHandle = function(campaignId = null) {
    return new Promise((resolve, reject) => {
        try {
            if (!window.indexedDB) {
                resolve(null);
                return;
            }
            const request = indexedDB.open("ApexBlueprintDB", 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("handles")) {
                    db.createObjectStore("handles");
                }
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction("handles", "readonly");
                const store = tx.objectStore("handles");
                const getReq = store.get(campaignId || "dirHandle");
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => reject(getReq.error);
            };
            request.onerror = () => resolve(null);
        } catch (e) {
            console.warn("IndexedDB access is restricted or unavailable:", e);
            resolve(null);
        }
    });
};

// ---------------------------------------------------------------------------
// Directory selection & permission management
// ---------------------------------------------------------------------------
window.selectLocalDirectory = async function() {
    if (!window.showDirectoryPicker) {
        window.directoryStatus = "Unsupported";
        window.renderConfigView();
        window.triggerToast("⚠️ NOT SUPPORTED", "Your browser does not support local directory access. Use Chrome/Edge/Opera.");
        return;
    }
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        window.dirHandle = handle;
        window.directoryName = handle.name;
        window.directoryStatus = "Connected";

        await window.saveDirHandle(handle);
        await window.scanLocalDirectoryFiles();
        window.renderConfigView();
        window.renderStorybookView();
        window.triggerToast("⚡ DIRECTORY BOUND", `Connected to folder: ${handle.name}`);
    } catch (e) {
        console.error(e);
        window.triggerToast("🚨 CONNECTION FAILED", "Could not connect directory or access denied.");
    }
};

window.selectAndBootstrapNewCampaignDirectory = async function() {
    if (!window.showDirectoryPicker) {
        window.directoryStatus = "Unsupported";
        window.renderConfigView();
        window.triggerToast("⚠️ NOT SUPPORTED", "Your browser does not support local directory access. Use Chrome/Edge/Opera.");
        return false;
    }
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        
        // Check if there is an existing campaign in this folder to prevent overriding
        let exists = false;
        try {
            const backupsDir = await handle.getDirectoryHandle("backups", { create: false });
            await backupsDir.getFileHandle("campaign_state.json", { create: false });
            exists = true;
        } catch (e) {
            // backups folder or campaign_state.json does not exist
        }

        if (exists) {
            window.triggerToast("🚨 FOLDER CONFLICT", "This directory already contains an active campaign. Please choose a new, empty folder.");
            return false;
        }

        // Bootstrap folders
        await handle.getDirectoryHandle("backups", { create: true });
        await handle.getDirectoryHandle("storybook", { create: true });
        await handle.getDirectoryHandle("facility", { create: true });
        const avatarsDir = await handle.getDirectoryHandle("avatars", { create: true });

        // Download default crew avatars (Lucius, Sarah, Leo)
        const avatarsToDownload = ["lucius_avatar.png", "sarah_avatar.png", "leo_avatar.png"];
        for (const filename of avatarsToDownload) {
            try {
                let response;
                try {
                    response = await fetch(`images/${filename}`);
                    if (!response.ok) throw new Error("Relative fetch failed");
                } catch (fetchErr) {
                    const githubUrl = `https://raw.githubusercontent.com/bruno2c/apex-blueprint/main/images/${filename}`;
                    response = await fetch(githubUrl);
                    if (!response.ok) throw new Error("GitHub fetch failed");
                }

                const blob = await response.blob();
                const fileHandle = await avatarsDir.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`Successfully bootstrapped default avatar: ${filename}`);
            } catch (err) {
                console.warn(`Could not bootstrap avatar ${filename}:`, err);
            }
        }

        // Bind directory state
        window.dirHandle = handle;
        window.directoryName = handle.name;
        window.directoryStatus = "Connected";

        await window.saveDirHandle(handle);
        await window.scanLocalDirectoryFiles();
        window.renderConfigView();
        window.renderStorybookView();
        window.triggerToast("⚡ DIRECTORY BOOTSTRAPPED", `New folder bound and prepared with crew avatars: ${handle.name}`);
        return true;
    } catch (e) {
        console.error(e);
        window.triggerToast("🚨 BOOTSTRAP FAILED", "Could not connect directory or access denied.");
        return false;
    }
};

window.verifyDirectoryPermission = async function(writeRequired = false) {
    if (!window.dirHandle) return false;
    const opts = { mode: writeRequired ? 'readwrite' : 'read' };
    try {
        if ((await window.dirHandle.queryPermission(opts)) === 'granted') {
            window.directoryStatus = "Connected";
            return true;
        }
        if (await window.dirHandle.requestPermission(opts) === 'granted') {
            window.directoryStatus = "Connected";
            return true;
        }
    } catch (err) {
        console.warn("Permission request rejected:", err);
    }
    window.directoryStatus = "Re-auth Required";
    return false;
};

window.disconnectDirectory = function() {
    window.dirHandle = null;
    window.directoryName = "";
    window.directoryStatus = "Disconnected";
    window.localFilesMap = {};
    window.localFacilityFilesMap = {};

    // Remove handle from IndexedDB
    const request = indexedDB.open("ApexBlueprintDB", 1);
    request.onsuccess = (e) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains("handles")) {
            const tx = db.transaction("handles", "readwrite");
            tx.objectStore("handles").delete("dirHandle");
        }
    };

    if (typeof window.renderConfigView === "function") window.renderConfigView();
    if (typeof window.renderStorybookView === "function") window.renderStorybookView();
};

window.toggleDirectoryConnection = async function() {
    if (window.directoryStatus === "Connected" || window.directoryStatus === "Re-auth Required") {
        window.disconnectDirectory();
        window.triggerToast("🔌 DIRECTORY DISCONNECTED", "Folder connection released.");
    } else {
        await window.selectLocalDirectory();
    }
};

// ---------------------------------------------------------------------------
// Directory scan & status display
// ---------------------------------------------------------------------------
window.scanLocalDirectoryFiles = async function() {
    if (!window.dirHandle) return;
    try {
        const permitted = await window.verifyDirectoryPermission(false);
        if (!permitted) return;

        const maxWeeksToScan = Math.max((window.state ? window.state.week : 1) + 5, 20);

        // 1. Scan storybook
        const storybookDirHandle = await window.dirHandle.getDirectoryHandle("storybook", { create: true });
        const scannedMap = {};
        for (let w = 1; w <= maxWeeksToScan; w++) {
            try {
                await storybookDirHandle.getFileHandle(`storybook_week_${w}.png`);
                scannedMap[w] = true;
            } catch (e) {
                scannedMap[w] = false;
            }
        }
        window.localFilesMap = scannedMap;

        // 2. Scan facility
        const facilityDirHandle = await window.dirHandle.getDirectoryHandle("facility", { create: true });
        const scannedFacilityMap = {};
        for (let w = 1; w <= maxWeeksToScan; w++) {
            try {
                await facilityDirHandle.getFileHandle(`facility_week_${w}.png`);
                scannedFacilityMap[w] = true;
            } catch (e) {
                scannedFacilityMap[w] = false;
            }
        }
        window.localFacilityFilesMap = scannedFacilityMap;
    } catch (e) {
        console.error("Error scanning storybook & facility directories:", e);
    }
};

window.updateDashboardFolderStatus = function() {
    const statusDiv = document.getElementById("dashboard-folder-status");
    if (!statusDiv) return;

    if (window.directoryStatus === "Connected" && window.dirHandle) {
        statusDiv.innerHTML = `🟢 Bound to folder: <strong style="color: #fff;">${window.dirHandle.name}</strong>`;
    } else if (window.directoryStatus === "Re-auth Required") {
        statusDiv.innerHTML = `⚠️ Connection suspended. <a href="#" onclick="window.restoreDirectoryConnection(); return false;" style="color: var(--comic-amber); text-decoration: underline; font-weight: bold;">Click here to re-authorize</a>`;
    } else if (window.directoryStatus === "Unsupported") {
        statusDiv.innerHTML = `🔴 Directory Access not supported.`;
    } else {
        statusDiv.innerHTML = `🔴 Folder disconnected. Connect in <a href="#" onclick="window.switchTab('config-tab'); return false;" style="color: var(--comic-amber); text-decoration: underline; font-weight: bold;">CONFIG tab</a> to save scene artwork.`;
    }
};

// ---------------------------------------------------------------------------
// Backup utilities
// ---------------------------------------------------------------------------
window.autosaveBackupToLocalDirectory = async function() {
    if (!window.dirHandle) return;
    try {
        const permitted = await window.verifyDirectoryPermission(true);
        if (!permitted) {
            console.warn("Autosave skipped: directory write permissions not authorized.");
            return;
        }

        const serialized = JSON.stringify(window.state, null, 2);
        const backupsDirHandle = await window.dirHandle.getDirectoryHandle("backups", { create: true });

        // Rolling campaign_state.json
        const rootSaveHandle = await backupsDirHandle.getFileHandle("campaign_state.json", { create: true });
        const writableRoot = await rootSaveHandle.createWritable();
        await writableRoot.write(serialized);
        await writableRoot.close();

        // Archived weekly save
        const archiveName = `save_week_${window.state.week}.json`;
        const archiveSaveHandle = await backupsDirHandle.getFileHandle(archiveName, { create: true });
        const writableArchive = await archiveSaveHandle.createWritable();
        await writableArchive.write(serialized);
        await writableArchive.close();

        console.log("Autosave backing files generated successfully.");
        window.triggerToast("💾 BACKUP SECURED", `Autosaved campaign_state.json & save_week_${window.state.week}.json to backups/ folder.`);
    } catch (e) {
        console.error("Autosave backup failed:", e);
        window.triggerToast("🚨 AUTOSAVE FAILED", "Could not write save files to backups/ directory.");
    }
};

window.triggerManualBackup = async function() {
    if (!window.dirHandle) {
        window.triggerToast("⚠️ DIRECTORY DISCONNECTED", "Connect a local folder in the CONFIG tab to save backups.");
        return;
    }
    try {
        const permitted = await window.verifyDirectoryPermission(true);
        if (permitted) {
            await window.autosaveBackupToLocalDirectory();
        } else {
            window.triggerToast("🚨 PERMISSION DENIED", "Write permission denied for directory.");
        }
    } catch (e) {
        console.error("Manual backup failed:", e);
        window.triggerToast("🚨 BACKUP FAILED", "Could not complete backup.");
    }
};

// ---------------------------------------------------------------------------
// Re-authorization flow
// ---------------------------------------------------------------------------
window.restoreDirectoryConnection = async function() {
    if (!window.dirHandle) return;
    try {
        const permitted = await window.verifyDirectoryPermission(true);
        if (permitted) {
            await window.scanLocalDirectoryFiles();

            // Auto-load campaign state from local directory backups
            try {
                const backupsDir = await window.dirHandle.getDirectoryHandle("backups", { create: false });
                const fileHandle = await backupsDir.getFileHandle("campaign_state.json", { create: false });
                const file = await fileHandle.getFile();
                const content = await file.text();
                const loadedState = JSON.parse(content);
                if (loadedState && loadedState.week !== undefined) {
                    window.state = loadedState;
                    window.appStorage.setItem(window.SAVE_KEY, JSON.stringify(window.state));
                    if (window.state.campaignId) {
                        window.saveCampaignToList(window.state);
                    }
                }
            } catch (backupErr) {
                if (backupErr instanceof SyntaxError) {
                    window.triggerToast("🚨 CORRUPT BACKUP", "The campaign_state.json file contains invalid JSON formatting/syntax errors.");
                    console.error("campaign_state.json JSON parse error:", backupErr);
                } else {
                    console.log("No backup file campaign_state.json found in backups/ folder.");
                }
            }

            window.renderStateToDashboard();
            window.renderStorybookView();
            window.renderConfigView();
            window.setAppState("game");

            const banner = document.getElementById("reauth-banner");
            if (banner) banner.style.display = "none";

            window.triggerToast("⚡ CONNECTION RESTORED", `Successfully re-authorized access and synchronized with folder: ${window.dirHandle.name}`);
        }
    } catch (e) {
        console.error("Re-authorization failed:", e);
    }
};

// ---------------------------------------------------------------------------
// Image source resolvers
// ---------------------------------------------------------------------------
window.getNpcAvatarSrc = async function(npcId) {
    if (window.dirHandle) {
        try {
            const permitted = await window.verifyDirectoryPermission(false);
            if (permitted) {
                const avatarsDir = await window.dirHandle.getDirectoryHandle("avatars", { create: false });
                const fileHandle = await avatarsDir.getFileHandle(`${npcId}_avatar.png`, { create: false });
                const file = await fileHandle.getFile();
                return URL.createObjectURL(file);
            }
        } catch (e) {
            console.debug(`Local avatar file avatars/${npcId}_avatar.png not found.`);
        }
    }
    if (window.state && window.state.network && window.state.network[npcId] && window.state.network[npcId].avatar) {
        return window.state.network[npcId].avatar;
    }
    return null;
};

window.getStorybookImageSrc = async function(week) {
    if (window.dirHandle) {
        try {
            const permitted = await window.verifyDirectoryPermission(false);
            if (permitted) {
                const storybookDirHandle = await window.dirHandle.getDirectoryHandle("storybook", { create: true });
                const fileName = `storybook_week_${week}.png`;
                const fileHandle = await storybookDirHandle.getFileHandle(fileName);
                const file = await fileHandle.getFile();
                return URL.createObjectURL(file);
            }
        } catch (e) {
            console.debug(`Image storybook_week_${week}.png not found in storybook/ directory.`);
        }
    }
    return null;
};

window.getFacilityImageSrc = async function(week) {
    if (window.dirHandle) {
        try {
            const permitted = await window.verifyDirectoryPermission(false);
            if (permitted) {
                const facilityDirHandle = await window.dirHandle.getDirectoryHandle("facility", { create: true });
                const fileName = `facility_week_${week}.png`;
                const fileHandle = await facilityDirHandle.getFileHandle(fileName);
                const file = await fileHandle.getFile();
                return URL.createObjectURL(file);
            }
        } catch (e) {
            console.debug(`Image facility_week_${week}.png not found in facility/ directory.`);
        }
    }
    return null;
};

// ---------------------------------------------------------------------------
// Asset binding (config tab — upload image directly for a given week)
// ---------------------------------------------------------------------------
window.bindAssetForWeek = async function(weekNum, type = "storybook") {
    if (!window.dirHandle) {
        window.triggerToast("⚠️ DIRECTORY DISCONNECTED", "Connect a local folder in this CONFIG tab to bind assets.");
        return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const permitted = await window.verifyDirectoryPermission(true);
        if (permitted) {
            try {
                if (type === "facility") {
                    const facilityDirHandle = await window.dirHandle.getDirectoryHandle("facility", { create: true });
                    const fileName = `facility_week_${weekNum}.png`;
                    const fileHandle = await facilityDirHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(file);
                    await writable.close();

                    if (!window.state.facility_images) {
                        window.state.facility_images = {};
                    }
                    window.state.facility_images[weekNum] = fileName;

                    window.saveState();
                    await window.scanLocalDirectoryFiles();
                    window.renderStateToDashboard();
                    window.renderConfigView();
                    window.triggerToast("⚡ FACILITY STATE BOUND", `Successfully bound and saved ${fileName} for Week ${weekNum}.`);
                } else {
                    const storybookDirHandle = await window.dirHandle.getDirectoryHandle("storybook", { create: true });
                    const fileName = `storybook_week_${weekNum}.png`;
                    const fileHandle = await storybookDirHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(file);
                    await writable.close();

                    if (!window.state.storybook_images) {
                        window.state.storybook_images = {};
                    }
                    window.state.storybook_images[weekNum] = fileName;

                    window.saveState();
                    await window.scanLocalDirectoryFiles();
                    window.renderStateToDashboard();
                    window.renderStorybookView();
                    window.renderConfigView();
                    window.triggerToast("⚡ IMAGE BOUND", `Successfully bound and saved ${fileName} for Week ${weekNum}.`);
                }

                await window.autosaveBackupToLocalDirectory();
            } catch (err) {
                console.error("Binding failed:", err);
                window.triggerToast("🚨 BINDING FAILED", "Could not write image file to folder.");
            }
        } else {
            window.triggerToast("🚨 PERMISSION DENIED", "Write permission is required for directory.");
        }
    };
    input.click();
};

// ---------------------------------------------------------------------------
// Utility: try to auto-load backup from a connected directory handle.
// Used during init and re-auth flows. Returns true if state was updated.
// ---------------------------------------------------------------------------
window.tryLoadCampaignFromBackup = async function(handle) {
    try {
        const backupsDir = await handle.getDirectoryHandle("backups", { create: false });
        const fileHandle = await backupsDir.getFileHandle("campaign_state.json", { create: false });
        const file = await fileHandle.getFile();
        const content = await file.text();
        const loadedState = JSON.parse(content);
        if (loadedState && loadedState.week !== undefined) {
            window.state = loadedState;
            window.appStorage.setItem(window.SAVE_KEY, JSON.stringify(window.state));
            if (window.state.campaignId) {
                window.saveCampaignToList(window.state);
            }
            return true;
        }
    } catch (backupErr) {
        if (backupErr instanceof SyntaxError) {
            window.triggerToast("🚨 CORRUPT BACKUP", "The campaign_state.json file contains invalid JSON formatting/syntax errors.");
            console.error("campaign_state.json JSON parse error:", backupErr);
        } else {
            console.log("No initial campaign_state.json backup found in backups/ folder.");
        }
    }
    return false;
};
