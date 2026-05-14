/**
 * NamorokaLivemarkService.sys.mjs
 *
 * Reimplementation of Firefox 3's nsLivemarkService for modern Firefox.
 * Manages RSS/Atom "live bookmark" folders — bookmark folders whose children
 * are automatically populated from an RSS/Atom feed.
 *
 * Storage: JSON file in the profile directory (annotations API was removed).
 * Feed parsing: nsIFeedProcessor (@mozilla.org/feed-processor;1).
 */

const { setInterval, clearInterval } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");

const STORAGE_FILENAME = "namoroka-livemarks.json";

const DEFAULT_EXPIRATION = 3600000;   // 1 hour
const ERROR_EXPIRATION   = 600000;    // 10 minutes
const IDLE_TIMELIMIT     = 1800000;   // 30 minutes
const CHECK_INTERVAL     = 60000;     // 1 minute timer tick



/**
 * Internal storage entry shape:
 * {
 *   guid:        string,   // Places bookmark GUID of the folder
 *   feedURI:     string,   // RSS/Atom feed URL
 *   siteURI:     string,   // Associated website URL (optional)
 *   expiration:  number,   // Timestamp (ms) when next refresh is due
 *   loadFailed:  boolean,  // Whether the last load failed
 *   locked:      boolean   // Whether a fetch is currently in progress
 * }
 */

let _livemarks = [];
let _storageFile = null;
let _timerID = null;
let _initialized = false;

async function _getStoragePath() {
	if (!_storageFile) {
		_storageFile = PathUtils.join(PathUtils.profileDir, STORAGE_FILENAME);
	}
	return _storageFile;
}

async function _loadStorage() {
	try {
		let path = await _getStoragePath();
		let data = await IOUtils.readJSON(path);
		if (Array.isArray(data)) {
			_livemarks = data.map(entry => ({
				guid:       entry.guid       || "",
				feedURI:    entry.feedURI     || "",
				siteURI:    entry.siteURI     || "",
				expiration: entry.expiration  || 0,
				loadFailed: entry.loadFailed  || false,
				locked:     false,
			}));
		}
	} catch (e) {
		// File doesn't exist yet or is corrupt — start fresh
		_livemarks = [];
	}
}

async function _saveStorage() {
	let path = await _getStoragePath();
	let data = _livemarks.map(entry => ({
		guid:       entry.guid,
		feedURI:    entry.feedURI,
		siteURI:    entry.siteURI,
		expiration: entry.expiration,
		loadFailed: entry.loadFailed,
	}));
	await IOUtils.writeJSON(path, data);
}

function _findEntry(guid) {
	return _livemarks.find(e => e.guid === guid) || null;
}

/**
 * Fetch and parse a feed URL. Returns an array of {title, href} objects.
 */
async function _fetchAndParseFeed(feedURISpec) {
	let uri = Services.io.newURI(feedURISpec);
	let channel = Services.io.newChannelFromURI(
		uri,
		null, // loadingNode
		Services.scriptSecurityManager.getSystemPrincipal(),
		null, // triggeringPrincipal
		Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_SEC_CONTEXT_IS_NULL,
		Ci.nsIContentPolicy.TYPE_OTHER
	);

	// Set the livebookmarks header via the HTTP channel
	if (channel instanceof Ci.nsIHttpChannel) {
		channel.setRequestHeader("X-Moz", "livebookmarks", false);
	}

	let text = await new Promise((resolve, reject) => {
		let listener = Cc["@mozilla.org/network/stream-loader;1"]
			.createInstance(Ci.nsIStreamLoader);
		listener.init({
			onStreamComplete(loader, context, status, resultLength, result) {
				if (!Components.isSuccessCode(status)) {
					reject(new Error("Network error fetching feed: " + status));
					return;
				}
				// result may be a plain Array in some Firefox versions
				let bytes = result instanceof Uint8Array ? result : new Uint8Array(result);
				let decoder = new TextDecoder();
				resolve(decoder.decode(bytes));
			},
		});
		channel.asyncOpen(listener);
	});

	return _parseFeedText(text);
}

/**
 * Parse RSS/Atom feed text using DOMParser borrowed from a browser window.
 * nsIFeedProcessor and nsISAXXMLReader were removed in modern Firefox.
 */
function _parseFeedText(text) {
	let win = Services.wm.getMostRecentWindow("navigator:browser");
	if (!win) throw new Error("No browser window available for XML parsing");

	let parser = new win.DOMParser();
	let doc = parser.parseFromString(text, "application/xml");

	// Check for parse errors
	let parseError = doc.querySelector("parsererror");
	if (parseError) throw new Error("XML parse error: " + parseError.textContent);

	let root = doc.documentElement;
	let rootTag = root.localName.toLowerCase();

	if (rootTag === "feed") {
		return _parseAtomDoc(doc);
	}
	// RSS 2.0 (<rss>) or RSS 1.0 / RDF (<rdf:RDF>)
	return _parseRSSDoc(doc);
}

/**
 * Parse Atom feed document.
 */
function _parseAtomDoc(doc) {
	let entries = [];
	const ATOM_NS = "http://www.w3.org/2005/Atom";

	let entryNodes = doc.getElementsByTagNameNS(ATOM_NS, "entry");
	if (entryNodes.length === 0) {
		// Try without namespace (some feeds omit it)
		entryNodes = doc.getElementsByTagName("entry");
	}

	for (let entry of entryNodes) {
		let titleEl = entry.getElementsByTagNameNS(ATOM_NS, "title")[0]
		           || entry.getElementsByTagName("title")[0];

		let linkEls = entry.getElementsByTagNameNS(ATOM_NS, "link");
		if (linkEls.length === 0) linkEls = entry.getElementsByTagName("link");

		let href = "";
		for (let link of linkEls) {
			let rel = link.getAttribute("rel") || "alternate";
			if (rel === "alternate") {
				href = link.getAttribute("href") || "";
				break;
			}
		}
		if (!href && linkEls.length > 0) {
			href = linkEls[0].getAttribute("href") || "";
		}

		let title = titleEl ? titleEl.textContent.trim() : "";
		if (title && href) {
			entries.push({ title, href });
		}
	}

	return entries;
}

/**
 * Parse RSS (1.0 / 2.0) feed document.
 */
function _parseRSSDoc(doc) {
	let entries = [];
	let items = doc.getElementsByTagName("item");

	for (let item of items) {
		let titleEl = item.getElementsByTagName("title")[0];
		let linkEl  = item.getElementsByTagName("link")[0];

		let title = titleEl ? titleEl.textContent.trim() : "";
		let href  = linkEl  ? linkEl.textContent.trim()  : "";

		if (title && href) {
			entries.push({ title, href });
		}
	}

	return entries;
}

/**
 * Remove all children of a livemark bookmark folder and insert new entries.
 */
async function _updateLivemarkChildren(guid, feedEntries) {
	// Get existing children
	let folderNode = await PlacesUtils.bookmarks.fetch(guid);
	if (!folderNode) return;

	// Remove existing children by fetching all children of this folder
	let children = [];
	await PlacesUtils.bookmarks.fetch({ parentGuid: guid }, (child) => {
		children.push(child);
	});
	for (let child of children) {
		try {
			await PlacesUtils.bookmarks.remove(child.guid);
		} catch (e) { /* child may already be gone */ }
	}

	// Insert new entries
	for (let entry of feedEntries) {
		try {
			await PlacesUtils.bookmarks.insert({
				parentGuid: guid,
				type: PlacesUtils.bookmarks.TYPE_BOOKMARK,
				title: entry.title,
				url: entry.href,
			});
		} catch (e) {
			// Skip entries with invalid URLs
		}
	}
}

/**
 * Reload a single livemark by guid.
 */
async function _reloadLivemark(entry, forceUpdate = false) {
	if (entry.locked) return;

	// Check expiration (unless forced)
	if (!forceUpdate && entry.expiration > Date.now()) {
		return;
	}

	// Check user idle time
	try {
		let idleService = Cc["@mozilla.org/widget/useridleservice;1"]
			.getService(Ci.nsIUserIdleService);
		if (idleService.idleTime > IDLE_TIMELIMIT) {
			return;
		}
	} catch (e) { /* ignore */ }

	entry.locked = true;

	try {
		let feedEntries = await _fetchAndParseFeed(entry.feedURI);
		await _updateLivemarkChildren(entry.guid, feedEntries);
		entry.loadFailed = false;
		entry.expiration = Date.now() + DEFAULT_EXPIRATION;
	} catch (e) {
		console.error("NamorokaLivemarkService: Feed reload error for", entry.feedURI, e);
		entry.loadFailed = true;
		entry.expiration = Date.now() + ERROR_EXPIRATION;
	} finally {
		entry.locked = false;
		await _saveStorage();
		try {
			Services.obs.notifyObservers(null, "namoroka-livemark-changed", entry.guid);
		} catch (e) {}
	}
}

/**
 * Timer callback: check all livemarks for expiration.
 */
async function _checkAllLivemarks() {
	for (let entry of _livemarks) {
		await _reloadLivemark(entry);
	}
}

/**
 * Observe bookmark removals to clean up our JSON storage.
 */
let _bookmarkObserver = {
	handlePlacesEvents(events) {
		for (let event of events) {
			if (event.type === "bookmark-removed" && event.isFolder) {
				let idx = _livemarks.findIndex(e => e.guid === event.guid);
				if (idx !== -1) {
					_livemarks.splice(idx, 1);
					_saveStorage();
				}
			}
		}
	},
};


export class NamorokaLivemarkService {
	/**
	 * Initialize the livemark service — load storage and start timer.
	 */
	static async init() {
		if (_initialized) return;
		_initialized = true;

		await _loadStorage();

		// Start periodic check
		_timerID = setInterval(() => _checkAllLivemarks(), CHECK_INTERVAL);

		// Watch for bookmark deletions
		try {
			PlacesUtils.observers.addListener(
				["bookmark-removed"],
				_bookmarkObserver.handlePlacesEvents
			);
		} catch (e) { /* observer API may differ */ }

		// Trigger initial refresh for expired livemarks
		_checkAllLivemarks();
	}

	/**
	 * Create a new livemark folder.
	 *
	 * @param {string} parentGuid - Parent folder GUID
	 * @param {string} name       - Livemark name
	 * @param {string} feedURI    - RSS/Atom feed URL
	 * @param {string} siteURI    - Associated website URL (optional)
	 * @param {number} index      - Position in parent (-1 for append)
	 * @returns {string} The GUID of the created bookmark folder
	 */
	static async createLivemark(parentGuid, name, feedURI, siteURI = "", index = PlacesUtils.bookmarks.DEFAULT_INDEX) {
		let folder = await PlacesUtils.bookmarks.insert({
			parentGuid,
			type:  PlacesUtils.bookmarks.TYPE_FOLDER,
			title: name,
			index,
		});

		let entry = {
			guid:       folder.guid,
			feedURI:    feedURI,
			siteURI:    siteURI,
			expiration: 0,
			loadFailed: false,
			locked:     false,
		};

		_livemarks.push(entry);
		await _saveStorage();

		// Trigger initial feed load and wait for it
		try {
			await _reloadLivemark(entry, true);
		} catch (e) {
			console.error("NamorokaLivemarkService: Initial feed load failed:", e);
		}

		return folder.guid;
	}

	/**
	 * Remove a livemark (deletes the bookmark folder and JSON entry).
	 */
	static async removeLivemark(guid) {
		let idx = _livemarks.findIndex(e => e.guid === guid);
		if (idx !== -1) {
			_livemarks.splice(idx, 1);
			await _saveStorage();
		}

		try {
			await PlacesUtils.bookmarks.remove(guid);
		} catch (e) { /* folder may already be gone */ }
	}

	/**
	 * Check whether a bookmark GUID is a livemark.
	 */
	static isLivemark(guid) {
		return !!_findEntry(guid);
	}

	/**
	 * Get all registered livemarks.
	 * @returns {Array<{guid, feedURI, siteURI, expiration, loadFailed}>}
	 */
	static getLivemarks() {
		return _livemarks.map(e => ({
			guid:       e.guid,
			feedURI:    e.feedURI,
			siteURI:    e.siteURI,
			expiration: e.expiration,
			loadFailed: e.loadFailed,
		}));
	}

	/**
	 * Get the feed URI for a livemark.
	 */
	static getFeedURI(guid) {
		let entry = _findEntry(guid);
		return entry ? entry.feedURI : null;
	}

	/**
	 * Set the feed URI for a livemark.
	 */
	static async setFeedURI(guid, feedURI) {
		let entry = _findEntry(guid);
		if (entry) {
			entry.feedURI = feedURI;
			entry.expiration = 0;
			await _saveStorage();
			// Auto-reload with the new feed URL
			try {
				await _reloadLivemark(entry, true);
			} catch (e) {
				console.error("NamorokaLivemarkService: Reload after setFeedURI failed:", e);
			}
		}
	}

	/**
	 * Get the site URI for a livemark.
	 */
	static getSiteURI(guid) {
		let entry = _findEntry(guid);
		return entry ? entry.siteURI : null;
	}

	/**
	 * Set the site URI for a livemark.
	 */
	static async setSiteURI(guid, siteURI) {
		let entry = _findEntry(guid);
		if (entry) {
			entry.siteURI = siteURI;
			await _saveStorage();
		}
	}

	/**
	 * Force reload a single livemark.
	 */
	static async reloadLivemark(guid) {
		let entry = _findEntry(guid);
		if (entry) {
			await _reloadLivemark(entry, true);
		}
	}

	/**
	 * Force reload all livemarks.
	 */
	static async reloadAllLivemarks() {
		for (let entry of _livemarks) {
			await _reloadLivemark(entry, true);
		}
	}

	/**
	 * Update the title of a livemark folder.
	 */
	static async setTitle(guid, title) {
		await PlacesUtils.bookmarks.update({ guid, title });
	}
}
