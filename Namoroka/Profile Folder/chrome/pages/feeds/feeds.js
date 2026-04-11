/**
 * about:feeds — Feed preview page for Firefox 3 style (Style 2).
 *
 * Parses the feed URL from the query string, fetches and previews the feed,
 * and provides a "Subscribe Now" button to create a live bookmark.
 */

(function () {
    const { LocaleUtils } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");
    const { NamorokaLivemarkService } = ChromeUtils.importESModule("chrome://modules/content/NamorokaLivemarkService.sys.mjs");

    const livemarkBundle = "chrome://namoroka/locale/properties/livemarks.properties";

    let feedURL = null;
    let feedData = null; // { title, subtitle, entries: [{title, href, date, content}] }

    function init() {
        // Set locale strings
        document.getElementById("subscribeUsingLabel").textContent =
            LocaleUtils.str(livemarkBundle, "livemark_subscribe_using");
        document.getElementById("liveBookmarksOption").textContent =
            LocaleUtils.str(livemarkBundle, "livemark_live_bookmarks");
        document.getElementById("subscribeButton").textContent =
            LocaleUtils.str(livemarkBundle, "livemark_subscribe_now");

        // Parse feed URL from the href — about: URIs don't support .search
        let href = window.location.href;
        let qIdx = href.indexOf("?");
        if (qIdx !== -1) {
            let params = new URLSearchParams(href.substring(qIdx + 1));
            feedURL = params.get("url");
        }

        // Also check if feed data was stashed on the browser by the livemarks script
        if (!feedURL) {
            try {
                let mainWindow = window.browsingContext?.topChromeWindow
                              || Services.wm.getMostRecentWindow("navigator:browser");
                if (mainWindow) {
                    let browser = mainWindow.gBrowser?.selectedBrowser;
                    if (browser?._namorokaActiveFeed) {
                        feedURL = browser._namorokaActiveFeed.href;
                    }
                }
            } catch (e) {}
        }

        if (!feedURL) {
            showError("No feed URL specified.");
            return;
        }

        document.getElementById("feedIntroText").textContent =
            LocaleUtils.str(livemarkBundle, "livemark_feed_preview_title");

        // Subscribe button handler
        document.getElementById("subscribeButton").addEventListener("click", onSubscribe);

        // Fetch and display the feed
        fetchFeed(feedURL);
    }

    async function fetchFeed(url) {
        // Show loading state
        let content = document.getElementById("feedContent");
        let loadingDiv = document.createElement("div");
        loadingDiv.id = "feedLoading";
        loadingDiv.textContent = LocaleUtils.str(livemarkBundle, "livemark_loading");
        content.appendChild(loadingDiv);

        try {
            let text = await new Promise((resolve, reject) => {
                let xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.setRequestHeader("X-Moz", "livebookmarks");
                xhr.responseType = "text";
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error("Network error"));
                xhr.send();
            });
            feedData = parseFeed(text, url);

            // Remove loading indicator
            loadingDiv.remove();

            // Populate the page
            displayFeed(feedData);
        } catch (e) {
            loadingDiv.remove();
            showError(LocaleUtils.str(livemarkBundle, "livemark_loadfailed"));
        }
    }

    function parseFeed(text, url) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(text, "application/xml");

        if (doc.documentElement.nodeName === "parsererror") {
            throw new Error("Feed XML parse error");
        }

        let result = {
            title: "",
            subtitle: "",
            siteURI: "",
            entries: [],
        };

        // RSS 2.0
        let channel = doc.querySelector("channel");
        if (channel) {
            let titleEl = channel.querySelector(":scope > title");
            let descEl = channel.querySelector(":scope > description");
            let linkEl = channel.querySelector(":scope > link");

            result.title = titleEl ? titleEl.textContent.trim() : "";
            result.subtitle = descEl ? descEl.textContent.trim() : "";
            result.siteURI = linkEl ? linkEl.textContent.trim() : "";

            let items = channel.querySelectorAll("item");
            for (let item of items) {
                let entryTitle = item.querySelector("title");
                let entryLink = item.querySelector("link");
                let entryDesc = item.querySelector("description");
                let entryDate = item.querySelector("pubDate");

                result.entries.push({
                    title: entryTitle ? entryTitle.textContent.trim() : "",
                    href: entryLink ? entryLink.textContent.trim() : "",
                    content: entryDesc ? entryDesc.textContent.trim() : "",
                    date: entryDate ? entryDate.textContent.trim() : "",
                });
            }

            return result;
        }

        // Atom
        let feed = doc.documentElement;
        if (feed.localName === "feed") {
            let titleEl = feed.querySelector(":scope > title");
            let subtitleEl = feed.querySelector(":scope > subtitle");
            let linkEl = feed.querySelector(':scope > link[rel="alternate"]')
                      || feed.querySelector(":scope > link");

            result.title = titleEl ? titleEl.textContent.trim() : "";
            result.subtitle = subtitleEl ? subtitleEl.textContent.trim() : "";
            result.siteURI = linkEl ? (linkEl.getAttribute("href") || "") : "";

            let entries = feed.querySelectorAll("entry");
            for (let entry of entries) {
                let entryTitle = entry.querySelector("title");
                let entryLink = entry.querySelector('link[rel="alternate"]')
                             || entry.querySelector("link");
                let entryContent = entry.querySelector("content")
                                || entry.querySelector("summary");
                let entryDate = entry.querySelector("published")
                             || entry.querySelector("updated");

                result.entries.push({
                    title: entryTitle ? entryTitle.textContent.trim() : "",
                    href: entryLink ? (entryLink.getAttribute("href") || "") : "",
                    content: entryContent ? entryContent.textContent.trim() : "",
                    date: entryDate ? entryDate.textContent.trim() : "",
                });
            }

            return result;
        }

        throw new Error("Unknown feed format");
    }

    function displayFeed(data) {
        document.title = data.title || LocaleUtils.str(livemarkBundle, "livemark_feed_preview_title");
        document.getElementById("feedTitleText").textContent = data.title;
        document.getElementById("feedSubtitleText").textContent = data.subtitle;

        let content = document.getElementById("feedContent");
        content.innerHTML = "";

        for (let entry of data.entries) {
            let div = document.createElement("div");
            div.className = "feedEntry";

            let titleP = document.createElement("p");
            titleP.className = "feedEntryTitle";
            let link = document.createElement("a");
            link.href = entry.href;
            link.textContent = entry.title || entry.href;
            link.target = "_blank";
            titleP.appendChild(link);
            div.appendChild(titleP);

            if (entry.date) {
                let dateP = document.createElement("p");
                dateP.className = "feedEntryDate";
                try {
                    dateP.textContent = new Date(entry.date).toLocaleDateString(undefined, {
                        year: "numeric", month: "long", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                    });
                } catch (e) {
                    dateP.textContent = entry.date;
                }
                div.appendChild(dateP);
            }

            if (entry.content) {
                let contentP = document.createElement("p");
                contentP.className = "feedEntryContent";
                // Strip HTML tags for safety, display as plain text
                let tmp = document.createElement("div");
                tmp.innerHTML = entry.content;
                contentP.textContent = tmp.textContent.substring(0, 300);
                if (tmp.textContent.length > 300) {
                    contentP.textContent += "\u2026";
                }
                div.appendChild(contentP);
            }

            content.appendChild(div);
        }
    }

    function showError(message) {
        let content = document.getElementById("feedContent");
        content.innerHTML = "";
        let errorDiv = document.createElement("div");
        errorDiv.id = "feedError";
        errorDiv.textContent = message;
        content.appendChild(errorDiv);
    }

    function onSubscribe() {
        if (!feedURL) return;

        let title = feedData ? feedData.title : "";
        let siteURI = feedData ? feedData.siteURI : "";

        // Get the parent window (main browser) to open the dialog
        let mainWindow = window.browsingContext?.topChromeWindow
                      || Services.wm.getMostRecentWindow("navigator:browser");

        if (mainWindow) {
            let args = {
                action: "add",
                feedURI: feedURL,
                siteURI: siteURI,
                title: title,
                accepted: false,
            };

            mainWindow.openDialog(
                "chrome://userchrome/content/windows/livemarkProperties/livemarkProperties.xhtml",
                "livemarkProperties",
                "chrome,dialog,centerscreen,modal",
                args
            );
        }
    }

    window.addEventListener("DOMContentLoaded", init);
})();
