const { LocaleUtils,
        PrefCalls } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");
const { NamorokaLivemarkService } = ChromeUtils.importESModule("chrome://modules/content/NamorokaLivemarkService.sys.mjs");
const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");

ChromeUtils.defineESModuleGetters(window, {
    NamorokaThemeManager: "chrome://modules/content/NamorokaThemeManager.sys.mjs",
});

let g_themeManager = new NamorokaThemeManager;
g_themeManager.init(
    document.documentElement,
    { style: true }
);

const gLivemarkBundle = "chrome://namoroka/locale/properties/livemarks.properties";

var gLivemarkProperties = {
    _action: null,      // "add" or "edit"
    _guid:   null,      // existing livemark guid (edit mode)
    _feedURI: "",
    _siteURI: "",
    _title:   "",
    _parentGuid: null,
    _folderMap: [],     // [{guid, title}] for folder picker

    async init() {
        let args = window.arguments?.[0] || {};
        this._action      = args.action      || "add";
        this._feedURI     = args.feedURI     || "";
        this._siteURI     = args.siteURI     || "";
        this._title       = args.title       || "";
        this._guid        = args.guid        || null;

        // Set dialog title
        let dialog = document.documentElement;
        if (this._action === "edit") {
            dialog.setAttribute("title", LocaleUtils.str(gLivemarkBundle, "livemark_dialog_title_edit"));
        } else {
            dialog.setAttribute("title", LocaleUtils.str(gLivemarkBundle, "livemark_dialog_title_add"));
        }

        // Set labels
        document.getElementById("nameLabel").value =
            LocaleUtils.str(gLivemarkBundle, "livemark_name_label");
        document.getElementById("feedLocationLabel").value =
            LocaleUtils.str(gLivemarkBundle, "livemark_feedurl_label");
        document.getElementById("siteLocationLabel").value =
            LocaleUtils.str(gLivemarkBundle, "livemark_siteurl_label");
        document.getElementById("folderLabel").value =
            LocaleUtils.str(gLivemarkBundle, "livemark_folder_label");

        // Set accept button label
        dialog.getButton("accept").label =
            this._action === "edit"
                ? LocaleUtils.str(gLivemarkBundle, "livemark_save_label")
                : LocaleUtils.str(gLivemarkBundle, "livemark_subscribe_button");

        // Populate fields
        document.getElementById("nameField").value = this._title;
        document.getElementById("feedLocationField").value = this._feedURI;
        document.getElementById("siteLocationField").value = this._siteURI;

        if (this._action === "add") {
            // Add mode: only show Name and Create In
            document.getElementById("feedLocationRow").hidden = true;
            document.getElementById("siteLocationRow").hidden = true;
            await this._populateFolderPicker();
        } else {
            // Edit mode: show all fields except folder picker
            document.getElementById("folderRow").hidden = true;
        }

        // Validate on input
        document.getElementById("nameField").addEventListener("input", () => this._validate());
        document.getElementById("feedLocationField").addEventListener("input", () => this._validate());
        this._validate();
    },

    async _populateFolderPicker() {
        let popup = document.getElementById("folderPickerPopup");
        let picker = document.getElementById("folderPicker");

        // Clear existing items
        while (popup.firstChild) {
            popup.removeChild(popup.firstChild);
        }

        this._folderMap = [];

        // Add the built-in root folders
        const rootFolders = [
            { guid: PlacesUtils.bookmarks.menuGuid,    title: "Bookmarks Menu" },
            { guid: PlacesUtils.bookmarks.toolbarGuid,  title: "Bookmarks Toolbar" },
            { guid: PlacesUtils.bookmarks.unfiledGuid,  title: "Other Bookmarks" },
        ];

        for (let folder of rootFolders) {
            let item = document.createXULElement("menuitem");
            item.setAttribute("label", folder.title);
            item.setAttribute("value", folder.guid);
            popup.appendChild(item);
            this._folderMap.push(folder);
        }

        // Add user-created subfolders from each root
        for (let root of rootFolders) {
            await this._addChildFolders(popup, root.guid, 1);
        }

        // Default to Bookmarks Toolbar
        let defaultIdx = this._folderMap.findIndex(f => f.guid === PlacesUtils.bookmarks.toolbarGuid);
        if (defaultIdx !== -1) {
            picker.selectedIndex = defaultIdx;
        } else if (this._folderMap.length > 0) {
            picker.selectedIndex = 0;
        }
    },

    async _addChildFolders(popup, parentGuid, depth) {
        let children = [];
        await PlacesUtils.bookmarks.fetch({ parentGuid }, (child) => {
            if (child.type === PlacesUtils.bookmarks.TYPE_FOLDER) {
                children.push(child);
            }
        });

        for (let child of children) {
            // Skip tags root
            if (child.guid === PlacesUtils.bookmarks.tagsGuid) continue;

            let indent = "\u00A0\u00A0\u00A0\u00A0".repeat(depth);
            let title = child.title || child.guid;

            let item = document.createXULElement("menuitem");
            item.setAttribute("label", indent + title);
            item.setAttribute("value", child.guid);
            popup.appendChild(item);
            this._folderMap.push({ guid: child.guid, title });

            // Recurse into subfolders (limit depth to avoid huge trees)
            if (depth < 5) {
                await this._addChildFolders(popup, child.guid, depth + 1);
            }
        }
    },

    _validate() {
        let nameField = document.getElementById("nameField");
        let dialog = document.documentElement;

        let valid = nameField.value.trim().length > 0;

        // In edit mode, also validate feed location
        if (this._action === "edit") {
            let feedField = document.getElementById("feedLocationField");
            valid = valid && feedField.value.trim().length > 0
                         && this._isValidURL(feedField.value.trim());
        } else {
            // In add mode, feedURI comes from args — must be present
            valid = valid && this._feedURI.length > 0;
        }

        dialog.getButton("accept").disabled = !valid;
    },

    _isValidURL(str) {
        try {
            new URL(str);
            return true;
        } catch (e) {
            return false;
        }
    },

    async onDialogAccept() {
        let name        = document.getElementById("nameField").value.trim();

        if (this._action === "edit" && this._guid) {
            // Update existing livemark
            let feedURI = document.getElementById("feedLocationField").value.trim();
            let siteURI = document.getElementById("siteLocationField").value.trim();

            await NamorokaLivemarkService.setTitle(this._guid, name);
            await NamorokaLivemarkService.setSiteURI(this._guid, siteURI);
            await NamorokaLivemarkService.setFeedURI(this._guid, feedURI);
        } else {
            // Create new livemark — feedURI and siteURI from args
            let picker = document.getElementById("folderPicker");
            let parentGuid = picker.selectedItem?.value
                          || PlacesUtils.bookmarks.toolbarGuid;

            await NamorokaLivemarkService.createLivemark(
                parentGuid, name, this._feedURI, this._siteURI
            );
        }

        // Signal success to opener
        if (window.arguments?.[0]) {
            window.arguments[0].accepted = true;
        }
    },
};

window.addEventListener("DOMContentLoaded", () => gLivemarkProperties.init());
window.addEventListener("dialogaccept", (e) => {
    e.preventDefault();
    gLivemarkProperties.onDialogAccept().then(() => {
        window.close();
    });
});
