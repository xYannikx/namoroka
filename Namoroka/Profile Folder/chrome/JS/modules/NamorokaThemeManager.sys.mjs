export class NamorokaThemeManager
{
	root = null;
	prefs = [];

	_prefToAttr(pref)
	{
		return pref.replace(/\./g, "-").toLowerCase();
	}

	constructor(root, config = { style: true })
	{
		this.root = root;
		if (!root)
		{
			throw new Error("Root not specified");
		}

		this.prefs = config?.prefs;
		if (!config?.prefs || !Array.isArray(config?.prefs) || config?.prefs.length <= 0)
		{
			throw new Error("Prefs not specified or is not array");
		}

		for (const pref of this.prefs)
		{
			this._updatePref(pref);
		}

		if (config?.style)
		{
			this._refreshTheme();

			Services.prefs.addObserver("Namoroka.Appearance.Style", (function() {
				this.refreshTheme();
				this.root.ownerDocument.dispatchEvent(new CustomEvent("namoroka-appearance-change"));
			}).bind(this));
		}

		/* observe must be manually bound when passing or else its this is incorrect */
		Services.prefs.addObserver(null, this.observe.bind(this));
	}

	observe(subject, topic, data)
	{
		if (topic == "nsPref:changed" && this.prefs && this.prefs.includes(data))
		{
			this._updatePref(data);
		}
	}

	_refreshTheme()
	{
		let style = Services.prefs.getIntPref("Namoroka.Appearance.Style");
		
		for (let attr of this.root.getAttributeNames())
		{
			if (attr.indexOf("namoroka-style-") > -1)
			{
				this.root.removeAttribute(attr);
			}
		}
		
		for (let i = 1; i <= style; i++)
		{
			this.root.setAttribute(`namoroka-style-${i}`, "true");
		}
	}
	
	_updatePref(pref)
	{
		switch (Services.prefs.getPrefType(pref))
		{
			case Services.prefs.PREF_BOOL:
				Services.prefs.getBoolPref(pref, false)
				? this.root.setAttribute(this._prefToAttr(pref), "true")
				: this.root.removeAttribute(this._prefToAttr(pref));
				break;
			case Services.prefs.PREF_INT:
				this.root.setAttribute(
					this._prefToAttr(pref),
					String(Services.prefs.getIntPref(pref, 0))
				);
				break;
			case Services.prefs.PREF_STRING:
				this.root.setAttribute(
					this._prefToAttr(pref),
					Services.prefs.getStringPref(pref, "")
				);
				break;
		}
	}
}