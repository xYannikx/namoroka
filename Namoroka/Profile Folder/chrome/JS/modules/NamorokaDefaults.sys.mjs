var { PrefCalls } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");

// Common defaults for all browsers
const COMMON_DEFAULTS = {
    "Namoroka.Appearance.Style": 0,
    "Namoroka.Appearance.Small-Icons": false,
    "Namoroka.Appearance.Aero": false,
    "Namoroka.Tabbrowser.HideOnOneTab": true,
    "Namoroka.Unified-Extensions.Disabled": true,
    "Namoroka.Status-Bar.Enabled": true,
    "Namoroka.Livemarks.Initialized": false,
    "Namoroka.Parameter.FirstRun": false,
    "Namoroka.Option.Branding": "firefox",

    "browser.tabs.hoverPreview.enabled": false,
    "browser.theme.dark-private-windows": false,
    "browser.urlbar.trimURLs": false,
    "browser.urlbar.formatting.enabled": false,
    "browser.display.windows.non_native_menus": 0,
    "browser.startup.blankWindow": false,

    "toolkit.legacyUserProfileCustomizations.stylesheets": true,

    "widget.native-controls.scrollbar-style": 0,
    "widget.non-native-theme.enabled": false,

    "userChromeJS.firstRunShown": true, // DIE DIE DIE DIE
};

// Fork-specific overrides — keys match Services.appinfo.name
const FORK_DEFAULTS = {
    "Nocturne": {
        "nocturne.backgrounds.enabled": false,
        "security.sandbox.content.level": 7,
        "widget.native-controls.force-dwm-report-off": true
    },
};

// Channel-specific overrides — keys match Services.appinfo.defaultUpdateChannel
const CHANNEL_DEFAULTS = {
    "nightly": {
        "Namoroka.Option.Branding": "minefield",
    },
};

export function applyDefaults() {
    for (let [pref, value] of Object.entries(COMMON_DEFAULTS)) {
        PrefCalls.defaultPref(pref, value);
    }

    let appName = Services.appinfo.name;
    let forkDefaults = FORK_DEFAULTS[appName];
    if (forkDefaults) {
        for (let [pref, value] of Object.entries(forkDefaults)) {
            PrefCalls.defaultPref(pref, value);
        }
    }

    let channel = Services.appinfo.defaultUpdateChannel;
    let channelDefaults = CHANNEL_DEFAULTS[channel];
    if (channelDefaults) {
        for (let [pref, value] of Object.entries(channelDefaults)) {
            PrefCalls.setPref(pref, value);
        }
    }
}
