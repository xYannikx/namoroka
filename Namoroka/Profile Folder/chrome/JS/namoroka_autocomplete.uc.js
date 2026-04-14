// ==UserScript==
// @name			Namoroka :: Search Autocomplete
// @description 	Firefox 3 PopupAutoCompleteRichResult for modern Firefox
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript==

var g_namorokaAutocomplete;

{
	var { waitForElement } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");
	waitForElement = waitForElement.bind(window);

	class PopupAutoCompleteRichResult {
		maxRows = 6;
		maxResults = 20;

		_currentIndex = 0;
		_matchCount = 0;
		_results = [];
		_searchString = "";
		_boundaryCutoff = null;

		_mainPopupSet = document.getElementById("mainPopupSet");
		_fragment = null;
		_urlbar = null;
		_inputField = null;
		_originalViewOpen = null;

		// =================== Panel Setup ===================

		get panelFragment()
		{
			if (!this._fragment) {
				this._fragment = window.MozXULElement.parseXULToFragment(`
					<panel id="PopupAutoCompleteRichResult" type="autocomplete-richlistbox" noautofocus="true" level="top">
						<richlistbox flex="1" class="autocomplete-richlistbox">
						</richlistbox>
					</panel>
				`).firstChild;
			}

			return this._fragment;
		}

		get panel()
		{
			let panel = document.getElementById("PopupAutoCompleteRichResult");
			Object.defineProperty(this, "panel", {
				value: panel,
				writable: false
			});
			return panel;
		}

		get richlistbox()
		{
			return this.panelFragment.querySelector("richlistbox");
		}

		get mPopupOpen()
		{
			return this.panel.state === "open" || this.panel.state === "showing";
		}

		get selectedIndex()
		{
			return this.richlistbox.selectedIndex;
		}

		set selectedIndex(val)
		{
			this.richlistbox.selectedIndex = val;
			let item = this.richlistbox.selectedItem || this.richlistbox.firstChild;
			if (item) {
				this.richlistbox.ensureElementIsVisible(item);
			}
			return val;
		}

		// =================== Init ===================

		init()
		{
			this._urlbar = gURLBar;
			this._inputField = this._urlbar.inputField;

			if (!this._inputField)
				return;

			this._mainPopupSet.appendChild(this.panelFragment);

			// Suppress the modern UrlbarView.
			// #openPanel is a private class field and cannot be patched,
			// but these public methods call it internally. No-opping them
			// prevents the modern view from ever rendering or opening.
			let view = this._urlbar.view;
			view.onQueryResults = function() {};
			view.onQueryFinished = function() {};
			view.autoOpen = function() { return false; };

			// Intercept keyboard before the UrlbarController.
			// The controller's handleKeyNavigation() calls preventDefault()
			// for arrow keys and Enter, consuming them before our handler.
			// Patch it to yield when our popup is open.
			let controller = this._urlbar.controller;
			this._origHandleKeyNav = controller.handleKeyNavigation.bind(controller);
			controller.handleKeyNavigation = (event, executeAction) => {
				if (this.mPopupOpen) {
					this._onKeydown(event);
					return;
				}
				this._origHandleKeyNav(event, executeAction);
			};

			// Hook into the UrlbarController query listener system.
			// Results arrive asynchronously — no more setTimeout polling.
			this._urlbar.controller.addQueryListener(this);

			this._inputField.addEventListener("blur", this);
		}

		// =================== Query Listeners ===================

		onQueryResults(queryContext)
		{
			this._searchString = (queryContext.searchString || "").trim();
			this._results = this._filterResults(queryContext.results || []);
			this._matchCount = Math.min(this._results.length, this.maxResults);

			if (this._matchCount === 0) {
				this.hidePopup();
				return;
			}

			this._openPopup();
			this._invalidate();
		}

		onQueryFinished(queryContext)
		{
			// Final render pass — results are complete
			this._searchString = (queryContext.searchString || "").trim();
			this._results = this._filterResults(queryContext.results || []);
			this._matchCount = Math.min(this._results.length, this.maxResults);

			if (this._matchCount === 0) {
				this.hidePopup();
				return;
			}

			this._invalidate();
		}

		onQueryCancelled(queryContext)
		{
			// Don't hide — keep showing whatever we have
		}

		onViewClose()
		{
			this.hidePopup();
		}

		// =================== Result Filtering ===================

		_filterResults(results)
		{
			let filtered = [];

			for (let result of results) {
				// Skip heuristic (first-result autoselect), TabToSearch, and non-navigational types
				if (result.heuristic)
					continue;
				if (result.providerName === "TabToSearch")
					continue;

				let type = result.type;
				if (type === UrlbarUtils.RESULT_TYPE.SEARCH ||
					type === UrlbarUtils.RESULT_TYPE.TAB_SWITCH ||
					type === UrlbarUtils.RESULT_TYPE.DYNAMIC ||
					type === UrlbarUtils.RESULT_TYPE.TIP ||
					type === UrlbarUtils.RESULT_TYPE.RESTRICT)
					continue;

				// Map to Firefox 3 type string
				let fx3Type = "";
				if (result.payload?.tags && result.payload.tags.length > 0) {
					fx3Type = "tag";
				} else if (result.source === UrlbarUtils.RESULT_SOURCE.BOOKMARKS) {
					fx3Type = "bookmark";
				}

				let url = result.payload?.url || "";
				let title = result.title || result.payload?.title || "";
				let icon = result.payload?.icon;
				let tags = result.payload?.tags || [];

				// Unescape the URL for display, like Firefox 3 did
				try {
					url = Services.textToSubURI.unEscapeURIForUI(url);
				} catch (e) {}

				filtered.push({ url, title, icon, type: fx3Type, tags });
			}

			return filtered;
		}

		// =================== Popup Management ===================

		_openPopup()
		{
			if (this.mPopupOpen)
				return;

			let urlbarElem = this._urlbar.textbox;
			let rect = urlbarElem.getBoundingClientRect();
			let width = rect.width;

			this.panel.style.width = width + "px";
			this.panel.openPopup(urlbarElem, "after_start", 0, 0, false, false);
		}

		hidePopup()
		{
			let disableAutohide = Services.prefs.getBoolPref("ui.popup.disable_autohide", false);
			if (!disableAutohide) {
				this.panel.hidePopup();
			}
		}

		// =================== Invalidate & Render ===================

		_invalidate()
		{
			// Collapsed if no matches
			this.richlistbox.collapsed = (this._matchCount === 0);

			// Adjust height now and after row contents update
			this.adjustHeight();
			setTimeout(() => this.adjustHeight(), 0);

			// Collapse existing items that won't be used
			let existingCount = this.richlistbox.childNodes.length;
			for (let i = this._matchCount; i < existingCount; i++) {
				this.richlistbox.childNodes[i].collapsed = true;
			}

			this._currentIndex = 0;
			this.selectedIndex = -1;
			this._appendCurrentResult();
		}

		_appendCurrentResult()
		{
			// Process maxRows items per batch for responsiveness
			for (let i = 0; i < this.maxRows; i++) {
				if (this._currentIndex >= this._matchCount) {
					this._measureUrlColumnWidth();
					return;
				}

				let result = this._results[this._currentIndex];
				let existingCount = this.richlistbox.childNodes.length;
				let item;

				if (this._currentIndex < existingCount) {
					// Re-use existing item
					item = this.richlistbox.childNodes[this._currentIndex];

					// If same content, just un-collapse and skip
					if (item.getAttribute("text") === this._searchString &&
						item.getAttribute("url") === result.url) {
						item.collapsed = false;
						this._currentIndex++;
						continue;
					}
				} else {
					// Create new item with Firefox 3 XBL structure
					item = this._createRichListItem();
				}

				// Set attributes before adjusting content (matches Firefox 3 order)
				item.setAttribute("image", result.icon);
				item.setAttribute("url", result.url);
				item.setAttribute("title", result.title);
				item.setAttribute("type", result.type);
				item.setAttribute("text", this._searchString);

				if (result.type === "tag") {
					item.setAttribute("tags", result.tags.join(", "));
				} else {
					item.removeAttribute("tags");
				}

				if (this._currentIndex < existingCount) {
					this._adjustAcItem(item);
					item.collapsed = false;
				} else {
					this.richlistbox.appendChild(item);
					this._adjustAcItem(item);
				}

				this._currentIndex++;
			}

			// Yield after each batch so typing stays responsive
			setTimeout(() => this._appendCurrentResult(), 0);
		}

		// =================== RichListItem DOM (Firefox 3 Structure) ===================

		_createRichListItem()
		{
			let item = document.createXULElement("richlistitem");
			item.className = "autocomplete-richlistitem";

			// ---- Title row ----
			let titleRow = document.createXULElement("hbox");
			titleRow.setAttribute("align", "center");

			let siteIcon = document.createXULElement("image");
			siteIcon.className = "ac-site-icon";

			let titleBox = document.createXULElement("hbox");
			titleBox.className = "ac-title";
			titleBox.setAttribute("flex", "1");

			let titleDesc = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "description");
			titleDesc.className = "ac-normal-text ac-comment";
			titleDesc.setAttribute("anonid", "title");

			let extraBox = document.createXULElement("hbox");
			extraBox.className = "ac-extra";
			extraBox.setAttribute("align", "center");
			extraBox.setAttribute("anonid", "extra-box");
			extraBox.hidden = true;

			let extraTagIcon = document.createXULElement("image");
			extraTagIcon.className = "ac-result-type-tag";

			let extraDesc = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "description");
			extraDesc.className = "ac-normal-text ac-comment";
			extraDesc.setAttribute("anonid", "extra");

			extraBox.appendChild(extraTagIcon);
			extraBox.appendChild(extraDesc);

			titleBox.appendChild(titleDesc);
			titleBox.appendChild(extraBox);

			let typeImage = document.createXULElement("image");
			typeImage.className = "ac-type-icon";
			typeImage.setAttribute("anonid", "type-image");

			titleRow.appendChild(siteIcon);
			titleRow.appendChild(titleBox);
			titleRow.appendChild(typeImage);

			// ---- URL row ----
			let urlRow = document.createXULElement("hbox");
			urlRow.setAttribute("align", "center");

			let siteSpacer = document.createXULElement("spacer");
			siteSpacer.className = "ac-site-icon";

			let urlBox = document.createXULElement("hbox");
			urlBox.className = "ac-url";
			urlBox.setAttribute("flex", "1");

			let urlDesc = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "description");
			urlDesc.className = "ac-normal-text ac-url-text";
			urlDesc.setAttribute("anonid", "url");

			urlBox.appendChild(urlDesc);

			let typeSpacer = document.createXULElement("spacer");
			typeSpacer.className = "ac-type-icon";

			urlRow.appendChild(siteSpacer);
			urlRow.appendChild(urlBox);
			urlRow.appendChild(typeSpacer);

			// Assemble
			item.appendChild(titleRow);
			item.appendChild(urlRow);

			// Event listeners
			item.addEventListener("mouseover", () => {
				this.richlistbox.selectedItem = item;
			});

			item.addEventListener("mousedown", (e) => {
				e.preventDefault(); // prevent focus loss / blur
				if (this._blurTimeout) {
					clearTimeout(this._blurTimeout);
					this._blurTimeout = null;
				}
				let url = item.getAttribute("url");
				if (url) {
					this.navigateToUrl(url);
					this.hidePopup();
				}
			});

			return item;
		}

		// =================== Adjust Item Content (Firefox 3 _adjustAcItem) ===================

		_adjustAcItem(item)
		{
			let url = item.getAttribute("url");
			let title = item.getAttribute("title");
			let type = item.getAttribute("type");
			let image = item.getAttribute("image");

			let siteIcon = item.querySelector(".ac-site-icon");
			let titleDesc = item.querySelector('[anonid="title"]');
			let extraBox = item.querySelector('[anonid="extra-box"]');
			let extraDesc = item.querySelector('[anonid="extra"]');
			let typeImage = item.querySelector('[anonid="type-image"]');
			let urlDesc = item.querySelector('[anonid="url"]');

			// Set favicon
			if (siteIcon) siteIcon.setAttribute("src", image);

			// Tag handling — matches Firefox 3's _adjustAcItem
			if (type === "tag") {
				extraBox.hidden = false;
				extraBox.setAttribute("flex", "1");
				extraBox.style.justifyContent = "flex-end";

				// Title is separated from tags by an endash in tagged results
				let tagMatch = title.match(/^(.+) \u2013 (.+)$/);
				if (tagMatch) {
					title = tagMatch[1];
					let sortedTags = tagMatch[2].split(",").map(s => s.trim()).sort().join(", ");
					this._setUpDescription(extraDesc, sortedTags);
				} else {
					// Tags from payload
					let tags = item.getAttribute("tags") || "";
					let sortedTags = tags.split(",").map(s => s.trim()).sort().join(", ");
					this._setUpDescription(extraDesc, sortedTags);
				}

				// Tagged matches display as bookmarks for the star icon
				type = "bookmark";
			} else {
				extraBox.hidden = true;
			}

			// Type icon class
			typeImage.className = "ac-type-icon" + (type ? " ac-result-type-" + type : "");

			// Show URL as title if no title
			if (!title) title = url;

			// Emphasize matching search terms
			this._setUpDescription(titleDesc, title);
			this._setUpDescription(urlDesc, url);
		}

		// =================== Search Term Emphasis (Firefox 3 _setUpDescription) ===================

		_getSearchTokens(search)
		{
			return search.toLowerCase().split(/\s+/);
		}

		get boundaryCutoff()
		{
			if (!this._boundaryCutoff) {
				try {
					this._boundaryCutoff = Services.prefs.getIntPref("toolkit.autocomplete.richBoundaryCutoff");
				} catch (e) {
					this._boundaryCutoff = 200;
				}
			}
			return this._boundaryCutoff;
		}

		_getBoundaryIndices(aText, aSearchTokens)
		{
			// Short circuit for empty search
			if (aSearchTokens == "")
				return [0, aText.length];

			let regions = [];
			for (let search of aSearchTokens) {
				let matchIndex;
				let startIndex = 0;
				let searchLen = search.length;

				let lowerText = aText.toLowerCase().substring(0, this.boundaryCutoff);
				while ((matchIndex = lowerText.indexOf(search, startIndex)) >= 0) {
					startIndex = matchIndex + searchLen;
					regions.push([matchIndex, startIndex]);
				}
			}

			// Sort by start position then end position
			regions.sort((a, b) => {
				let start = a[0] - b[0];
				return start === 0 ? a[1] - b[1] : start;
			});

			// Generate boundary indices from each region
			let start = 0;
			let end = 0;
			let boundaries = [];
			for (let i = 0; i < regions.length; i++) {
				let region = regions[i];
				if (region[0] > end) {
					boundaries.push(start);
					boundaries.push(end);
					start = region[0];
				}
				end = Math.max(end, region[1]);
			}

			boundaries.push(start);
			boundaries.push(end);

			if (end < aText.length)
				boundaries.push(aText.length);

			// Skip the first item because it's always 0
			return boundaries.slice(1);
		}

		_needsAlternateEmphasis(aText)
		{
			for (let i = aText.length; --i >= 0; ) {
				let charCode = aText.charCodeAt(i);
				if (0x0600 <= charCode && charCode <= 0x109F)
					return true;
			}
			return false;
		}

		_setUpDescription(aDescriptionElement, aText)
		{
			// Clear previous content
			while (aDescriptionElement.hasChildNodes())
				aDescriptionElement.removeChild(aDescriptionElement.firstChild);

			let search = this._searchString;
			let tokens = this._getSearchTokens(search);
			let indices = this._getBoundaryIndices(aText, tokens);

			let checkAlt = this._needsAlternateEmphasis(search);

			let start = 0;
			let len = indices.length;
			for (let i = indices[0] === 0 ? 1 : 0; i < len; i++) {
				let next = indices[i];
				let text = aText.substring(start, next);
				start = next;

				if (i % 2 === 0) {
					// Emphasize matched text
					let span = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
					span.className = checkAlt && this._needsAlternateEmphasis(text) ?
						"ac-emphasize-alt" : "ac-emphasize-text";
					span.textContent = text;
					aDescriptionElement.appendChild(span);
				} else {
					// Plain text
					aDescriptionElement.appendChild(document.createTextNode(text));
				}
			}
		}

		// =================== Height =====================

		adjustHeight()
		{
			let rows = this.richlistbox.childNodes;
			let numRows = Math.min(this._matchCount, this.maxRows, rows.length);

			let height = 0;
			if (numRows) {
				// Use the first non-collapsed row to measure
				let firstRow = null;
				let lastRow = null;
				let counted = 0;
				for (let i = 0; i < rows.length && counted < numRows; i++) {
					if (!rows[i].collapsed) {
						if (!firstRow) firstRow = rows[i];
						lastRow = rows[i];
						counted++;
					}
				}

				if (firstRow && lastRow) {
					let firstRect = firstRow.getBoundingClientRect();
					let lastRect = lastRow.getBoundingClientRect();
					height = (lastRect.y + lastRect.height) - firstRect.y;
				}
			}

			if (height && height !== this._lastHeight) {
				this.richlistbox.style.height = height + "px";
				this.richlistbox.style.maxHeight = height + "px";
				this._lastHeight = height;
			}
		}

		// =================== URL Column Measurement ===================

		_measureUrlColumnWidth()
		{
			let maxWidth = 0;
			let rows = this.richlistbox.childNodes;
			for (let i = 0; i < this._matchCount && i < rows.length; i++) {
				if (rows[i].collapsed) continue;
				let urlDesc = rows[i].querySelector('[anonid="url"]');
				if (urlDesc) {
					maxWidth = Math.max(maxWidth, urlDesc.scrollWidth);
				}
			}
			if (maxWidth > 0) {
				this.panel.style.setProperty("--url-col-width", (maxWidth + 10) + "px");
			}
		}

		// =================== Navigation ===================

		isValidURL(str)
		{
			try {
				let uri = Services.io.newURI(str);
				return uri.scheme && (uri.scheme.startsWith("http") || uri.scheme === "about" || uri.scheme === "file");
			}
			catch (e) {
				return false;
			}
		}

		fixURL(str)
		{
			if (str.includes(".") && !str.includes("://")) {
				return "http://" + str;
			}
			return str;
		}

		async navigateToUrl(url)
		{
			if (this.isValidURL(url))
			{
				let fixedUrl = this.fixURL(url);

				gBrowser.selectedBrowser.loadURI(
					Services.io.newURI(fixedUrl),
					{ triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }
				);
			}
			else
			{
				let searchUrl = (await Services.search.defaultEngine.getSubmission(encodeURIComponent(url)))?.uri.spec;

				gBrowser.selectedBrowser.loadURI(
					Services.io.newURI(searchUrl),
					{ triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }
				);
			}

			gBrowser.selectedBrowser.focus();
		}

		// =================== Keyboard Navigation (Firefox 3 selectBy) ===================

		selectBy(aReverse, aPage)
		{
			let amount = aPage ? 5 : 1;
			let newIdx = this._getNextIndex(aReverse, amount, this.selectedIndex, this._matchCount - 1);
			this.selectedIndex = newIdx;

			// Show the selected item's URL in the urlbar input,
			// or restore the original search string if deselected.
			if (newIdx >= 0 && this.richlistbox.selectedItem) {
				this._inputField.value = this.richlistbox.selectedItem.getAttribute("url") || "";
			} else {
				this._inputField.value = this._searchString;
			}
		}

		_getNextIndex(aReverse, aAmount, aCurrent, aMaxRow)
		{
			if (aCurrent === -1) {
				return aReverse ? aMaxRow : 0;
			}

			let newIdx = aCurrent + (aReverse ? -aAmount : aAmount);
			if (newIdx < 0) return -1;
			if (newIdx > aMaxRow) return -1;
			return newIdx;
		}

		// =================== Event Handling ===================

		handleEvent(event)
		{
			if (event.target.id !== "urlbar-input")
				return;

			if (event.type === "blur") {
				this._blurTimeout = setTimeout(() => this.hidePopup(), 150);
			}
		}

		_onKeydown(e)
		{
			if (!this.mPopupOpen)
				return;

			switch (e.key) {
				case "Enter":
					if (this.richlistbox.selectedItem) {
						e.preventDefault();
						e.stopPropagation();
						let url = this.richlistbox.selectedItem.getAttribute("url");
						if (url) {
							this.navigateToUrl(url);
							this.hidePopup();
						}
					} else {
						// No selection — close popup and let the urlbar handle Enter
						this.hidePopup();
						this._origHandleKeyNav(e, true);
					}
					break;

				case "ArrowDown":
					e.preventDefault();
					e.stopPropagation();
					this.selectBy(false, false);
					break;

				case "ArrowUp":
					e.preventDefault();
					e.stopPropagation();
					this.selectBy(true, false);
					break;

				case "PageDown":
					e.preventDefault();
					e.stopPropagation();
					this.selectBy(false, true);
					break;

				case "PageUp":
					e.preventDefault();
					e.stopPropagation();
					this.selectBy(true, true);
					break;

				case "Escape":
					e.preventDefault();
					e.stopPropagation();
					this.hidePopup();
					this.selectedIndex = -1;
					break;
			}
		}
	}

	g_namorokaAutocomplete = new PopupAutoCompleteRichResult;

	waitForElement("#urlbar").then(e => {
		g_namorokaAutocomplete.init();
	});
}