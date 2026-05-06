var { PrefCalls } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");

export class NamorokaLayoutTemplateManager {
    static CustomizableUI = ChromeUtils.importESModule("resource:///modules/CustomizableUI.sys.mjs").CustomizableUI;
    
    static TOOLBAR_LAYOUT_TEMPLATE = {
        "toolbar-menubar": [
            {
                id: "menubar-items",
                type: "toolbaritem",
            },
            {
                type: "spring",
            },
            {
                id: "navigator-throbber",
                type: "toolbarbutton",
            },
        ],
        "nav-bar": [
            {
                id: "back-button",
                type: "toolbarbutton",
            },
            {
                id: "forward-button",
                type: "toolbarbutton",
            },
            {
                id: "stop-reload-button",
                type: "toolbaritem",
            },
            {
                id: "home-button",
                type: "toolbarbutton",
            },
            {
                id: "urlbar-container",
                type: "toolbaritem",
            },
            {
                id: "search-container",
                type: "toolbaritem",
            },
            {
                id: "downloads-button",
                type: "toolbarbutton",
            },
            {
                id: "customizableui-special-spring1",
                behavior: "remove",
            },
            {
                id: "customizableui-special-spring2",
                behavior: "remove",
            }
        ],
        "PersonalToolbar": [
            {
                id: "import-button",
                behavior: "remove",
            }
        ]
    }

    static SPECIAL_WIDGET_TYPES = ["spring", "spacer", "separator"];

    /**
     * Resolves style-specific property overrides for a template item.
     */
    static getPropertyList(templateItem) {
        let out = {};

        for (let key in templateItem) {
            out[key] = templateItem[key];
        }

        if (templateItem.styleProperties) {
            let style = PrefCalls.getPref("Namoroka.Appearance.Style");

            if (templateItem.styleProperties[style]) {
                for (let key in templateItem.styleProperties[style]) {
                    out[key] = templateItem.styleProperties[style][key];
                }
            }
        }

        return out;
    }

    /**
     * Applies a single template item to a toolbar area.
     */
    static applyTemplateItemProps(props, area, position) {
        let id = props.id;
        let behavior = props.behavior ?? "add";
        let isSpecial = this.SPECIAL_WIDGET_TYPES.includes(props.type);

        switch (behavior) {
            case "add": {
                if (isSpecial) {
                    this.CustomizableUI.addWidgetToArea(props.type, area, position);
                } else {
                    this.CustomizableUI.addWidgetToArea(id, area, position);
                }
                break;
            }

            case "remove": {
                if (id) {
                    this.CustomizableUI.removeWidgetFromArea(id);
                }
                break;
            }
        }
    }

    /**
     * Applies the full layout template across all toolbar areas.
     */
    /**
     * Removes all existing springs/spacers/separators from an area.
     */
    static removeSpecialWidgets(area) {
        let widgetIds = this.CustomizableUI.getWidgetIdsInArea(area);
        for (let id of widgetIds) {
            if (this.SPECIAL_WIDGET_TYPES.some(type => id.startsWith("customizableui-special-" + type))) {
                this.CustomizableUI.removeWidgetFromArea(id);
            }
        }
    }

    static applyLayout(targetWindow, template = this.TOOLBAR_LAYOUT_TEMPLATE) {
        this.CustomizableUI.beginBatchUpdate();

        try {
            for (let area in template) {
                this.removeSpecialWidgets(area);
                let items = template[area];

                for (let i = 0; i < items.length; i++) {
                    let props = this.getPropertyList(items[i]);
                    this.applyTemplateItemProps(props, area, i);
                }
            }

            if (template == this.TOOLBAR_LAYOUT_TEMPLATE) {
                PrefCalls.setPref("browser.tabs.inTitlebar", 0);
                this.CustomizableUI.setToolbarVisibility("toolbar-menubar", true);
                
                PrefCalls.setPref("browser.toolbars.bookmarks.visibility", "always");
                this.CustomizableUI.setToolbarVisibility("toolbar-bookmarks", true);
            }

            this.CustomizableUI.dispatchToolboxEvent("aftercustomization", {}, targetWindow);
        } finally {
            this.CustomizableUI.endBatchUpdate(true);
        }
    }

    static applyDefaultLayout(targetWindow) {
        this.applyLayout(targetWindow, this.TOOLBAR_LAYOUT_TEMPLATE);
    }
}