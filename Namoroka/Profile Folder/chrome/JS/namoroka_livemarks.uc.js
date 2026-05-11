// ==UserScript==
// @name			Namoroka :: Livemarks
// @description 	Restores Firefox 3 Live Bookmarks (RSS/Atom feed subscription).
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include         main
// ==/UserScript==

{
	var { PrefCalls, LocaleUtils, waitForElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
	var { NamorokaLivemarkService } = ChromeUtils.importESModule("chrome://modules/content/NamorokaLivemarkService.sys.mjs");
	waitForElement = waitForElement.bind(window);

	let livemarkBundle = "chrome://namoroka/locale/properties/livemarks.properties";

	var NamorokaLivemarks = {

		// =====================================================================
		// Initialization
		// =====================================================================

		async init() {
			await NamorokaLivemarkService.init();
			this._initFeedInterception();
			this._initBookmarkMenuIntegration();
			this._initContextMenu();
			this._initDefaultLivemark();
			this._initLivemarkObserver();
		},

		/**
		 * Listen for livemark changes (create, reload, feed URL change)
		 * and re-mark bookmark toolbar items so they get the livemark icon.
		 */
		_initLivemarkObserver() {
			this._livemarkChangedObserver = {
				observe: (subject, topic, data) => {
					// data = guid of the changed livemark
					// Re-mark all visible bookmark containers
					let toolbar = document.getElementById("PlacesToolbarItems");
					if (toolbar) {
						// Slight delay: Places may not have updated the DOM yet
						window.setTimeout(() => {
							this._markLivemarkItems(toolbar);
						}, 500);
					}
				},
			};
			Services.obs.addObserver(this._livemarkChangedObserver, "namoroka-livemark-changed");
		},

		// =====================================================================
		// Feed Content-Type Interception
		// =====================================================================

		/**
		 * Intercept direct navigation to RSS/Atom feeds and open the
		 * subscribe dialog, like Firefox 3's FeedConverter.
		 */
		_initFeedInterception() {
			const FEED_TYPES = [
				"application/rss+xml",
				"application/atom+xml",
				"application/x.atom+xml",
				"application/rdf+xml",
			];

			this._feedResponseObserver = {
				observe(subject, topic, data) {
					if (topic !== "http-on-examine-response" &&
						topic !== "http-on-examine-cached-response") {
						return;
					}

					let channel;
					try {
						channel = subject.QueryInterface(Ci.nsIHttpChannel);
					} catch (e) { return; }

					// Only intercept top-level document loads
					let loadInfo = channel.loadInfo;
					if (!loadInfo ||
						loadInfo.externalContentPolicyType !== Ci.nsIContentPolicy.TYPE_DOCUMENT) {
						return;
					}

					// Skip if Content-Disposition: attachment
					try {
						let disposition = channel.getResponseHeader("Content-Disposition");
						if (disposition && disposition.toLowerCase().startsWith("attachment")) {
							return;
						}
					} catch (e) { /* header not present — OK */ }

					// Check content type
					let contentType = "";
					try {
						contentType = channel.contentType.toLowerCase();
					} catch (e) { return; }

					let isFeed = FEED_TYPES.includes(contentType);

					if (!isFeed && (contentType === "text/xml" ||
									contentType === "application/xml")) {
						return;
					}

					if (!isFeed) return;

					// Cancel and open subscribe dialog with the feed URL
					let feedURI = channel.URI.spec;
					channel.cancel(Cr.NS_BINDING_ABORTED);

					let browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
					if (browserWindow && browserWindow.gBrowser) {
						browserWindow.setTimeout(() => {
							let args = {
								action:  "add",
								feedURI: feedURI,
								siteURI: "",
								title:   "",
								accepted: false,
							};

							browserWindow.openDialog(
								"chrome://namoroka/content/windows/livemarkProperties/livemarkProperties.xhtml",
								"livemarkProperties",
								"chrome,dialog,centerscreen,modal",
								args
							);

							if (args.accepted) {
								let toolbar = browserWindow.document.getElementById("PlacesToolbarItems");
								if (toolbar) {
									browserWindow.setTimeout(() => {
										browserWindow.NamorokaLivemarks?._markLivemarkItems(toolbar);
									}, 500);
								}
							}
						}, 0);
					}
				},
			};

			Services.obs.addObserver(this._feedResponseObserver, "http-on-examine-response");
			Services.obs.addObserver(this._feedResponseObserver, "http-on-examine-cached-response");
		},

		// =====================================================================
		// Subscription
		// =====================================================================

		_subscribeDirect(feed) {
			let args = {
				action:  "add",
				feedURI: feed.href,
				siteURI: gBrowser.currentURI?.spec || "",
				title:   feed.title,
				accepted: false,
			};

			window.openDialog(
				"chrome://namoroka/content/windows/livemarkProperties/livemarkProperties.xhtml",
				"livemarkProperties",
				"chrome,dialog,centerscreen,modal",
				args
			);

			if (args.accepted) {
				let toolbar = document.getElementById("PlacesToolbarItems");
				if (toolbar) {
					window.setTimeout(() => this._markLivemarkItems(toolbar), 500);
				}
			}
		},

		// =====================================================================
		// Bookmark Menu Integration
		// =====================================================================

		_initBookmarkMenuIntegration() {
			// Hook into bookmark menu popups to mark livemark folders
			let popupIDs = [
				"#bookmarksMenuPopup",
			];

			for (let selector of popupIDs) {
				waitForElement(selector).then((popup) => {
					popup.addEventListener("popupshowing", (e) => {
						this._markLivemarkItems(e.target);
					});
				}).catch(() => {});
			}

			// Mark toolbar items directly and observe changes
			waitForElement("#PlacesToolbarItems").then((toolbar) => {
				// Mark existing items
				this._markLivemarkItems(toolbar);

				// Observe for new items being added to the toolbar
				let observer = new MutationObserver(() => {
					this._markLivemarkItems(toolbar);
				});
				observer.observe(toolbar, { childList: true });

				// Also hook into any subpopups
				toolbar.addEventListener("popupshowing", (e) => {
					this._markLivemarkItems(e.target);
				});
			}).catch(() => {});
		},

		_markLivemarkItems(container) {
			let items = container.children;
			for (let item of items) {
				let node = item._placesNode;
				if (!node) continue;

				let guid = node.bookmarkGuid;
				if (guid && NamorokaLivemarkService.isLivemark(guid)) {
					item.setAttribute("livemark", "true");
					item.setAttribute("container", "true");
				}
			}
		},

		// =====================================================================
		// Context Menu Integration
		// =====================================================================

		_initContextMenu() {
			waitForElement("#placesContext").then((contextMenu) => {
				contextMenu.addEventListener("popupshowing", () => {
					this._onPlacesContextShowing(contextMenu);
				});
			}).catch(() => {});
		},

		_reloadMenuItem: null,
		_propertiesMenuItem: null,

		_onPlacesContextShowing(contextMenu) {
			// Remove previously added items
			if (this._reloadMenuItem) {
				this._reloadMenuItem.remove();
				this._reloadMenuItem = null;
			}
			if (this._propertiesMenuItem) {
				this._propertiesMenuItem.remove();
				this._propertiesMenuItem = null;
			}

			try {
				let triggerNode = contextMenu.triggerNode;
				if (!triggerNode) return;

				let controller = PlacesUIUtils.getViewForNode(triggerNode);
				if (!controller) return;

				let selectedNode = controller.selectedNode;
				if (!selectedNode || !selectedNode.bookmarkGuid) return;

				let guid = selectedNode.bookmarkGuid;
				if (!NamorokaLivemarkService.isLivemark(guid)) return;

				// Add "Reload Live Bookmark" item
				let reloadItem = document.createXULElement("menuitem");
				reloadItem.setAttribute("label",
					LocaleUtils.str(livemarkBundle, "livemark_reload_label"));
				reloadItem.setAttribute("accesskey",
					LocaleUtils.str(livemarkBundle, "livemark_reload_accesskey"));
				reloadItem.addEventListener("command", () => {
					NamorokaLivemarkService.reloadLivemark(guid);
				});
				contextMenu.appendChild(reloadItem);
				this._reloadMenuItem = reloadItem;

				// Add "Properties" item
				let propsItem = document.createXULElement("menuitem");
				propsItem.setAttribute("label",
					LocaleUtils.str(livemarkBundle, "livemark_properties_label"));
				propsItem.setAttribute("accesskey",
					LocaleUtils.str(livemarkBundle, "livemark_properties_accesskey"));
				propsItem.addEventListener("command", () => {
					let feedURI = NamorokaLivemarkService.getFeedURI(guid);
					let siteURI = NamorokaLivemarkService.getSiteURI(guid);

					window.openDialog(
						"chrome://namoroka/content/windows/livemarkProperties/livemarkProperties.xhtml",
						"livemarkProperties",
						"chrome,dialog,centerscreen,modal",
						{
							action:  "edit",
							guid:    guid,
							feedURI: feedURI || "",
							siteURI: siteURI || "",
							title:   selectedNode.title || "",
						}
					);
				});
				contextMenu.appendChild(propsItem);
				this._propertiesMenuItem = propsItem;
			} catch (e) {
				// Not a Places node or view — ignore
			}
		},

		// =====================================================================
		// Default Livemark (First Run)
		// =====================================================================

		async _initDefaultLivemark() {
			try {
				let initialized = PrefCalls.getPref("Namoroka.Livemarks.Initialized");
				if (initialized) return;
			} catch (e) {
				// Pref doesn't exist — first run
			}

			try {
				let title = LocaleUtils.str(livemarkBundle, "livemark_latest_headlines");
				await NamorokaLivemarkService.createLivemark(
					PlacesUtils.bookmarks.toolbarGuid,
					title,
					"https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
					"https://news.google.com/"
				);
				PrefCalls.setPref("Namoroka.Livemarks.Initialized", true);
			} catch (e) {
				console.error("Namoroka Livemarks: Failed to create default livemark:", e);
			}
		},
	};

	// Initialize after browser startup is complete
	let delayedStartupObserver = (aSubject, aTopic, aData) => {
		if (aSubject == window) {
			Services.obs.removeObserver(delayedStartupObserver, "browser-delayed-startup-finished");
			NamorokaLivemarks.init();
		}
	};
	Services.obs.addObserver(delayedStartupObserver, "browser-delayed-startup-finished");
}
