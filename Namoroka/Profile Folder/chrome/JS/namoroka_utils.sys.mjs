// ==UserScript==
// @name			 Namoroka :: Utils
// @description 	 Common utilities for Namoroka scripts.
// @author			 ephemeralViolette
// @include			 main
// @include          chrome://browser/content/browser.xhtml
// @include			 chrome://browser/content/aboutDialog.xhtml
// @loadOrder        1
// @backgroundmodule
// ==/UserScript==

export function renderElement(nodeName, attrMap = {}, childrenArr = []) {
    let prefix = null;
    let localName = nodeName;

    if (nodeName.includes(":")) 
	{
        [prefix, localName] = nodeName.split(":");
    }

    let namespaceURI;

    if (prefix) 
	{
        namespaceURI = this.document.documentElement.lookupNamespaceURI(prefix);

        if (!namespaceURI) 
		{
            throw new Error(`Unknown namespace prefix: ${prefix}`);
        }
    } else {
        namespaceURI = this.document.documentElement.lookupNamespaceURI(null) || "http://www.w3.org/1999/xhtml";
    }

    const element = this.document.createElementNS(namespaceURI, nodeName);

    for (let key in attrMap) 
	{
        if (key.includes(":")) 
		{
            const [attrPrefix, attrName] = key.split(":");
            const attrNS = this.document.documentElement.lookupNamespaceURI(attrPrefix);

            if (!attrNS) {
                throw new Error(`Unknown attribute namespace: ${attrPrefix}`);
            }

            element.setAttributeNS(attrNS, key, attrMap[key]);
        } 
		else {
            element.setAttribute(key, attrMap[key]);
        }
    }

    for (let i = 0; i < childrenArr.length; i++) {
        const child = childrenArr[i];

        if (typeof child == "string") 
		{
            element.appendChild(this.document.createTextNode(child));
        } 
		else 
		{
            element.appendChild(child);
        }
    }

    return element;
}

export async function waitForElement(query, parent = this.document, timeout = -1)
{
	let startTime = Date.now();
	
	while (parent.querySelector(query) == null)
	{
		if (timeout > -1 && Date.now() > startTime + timeout)
		{
			return null;
		}
		await new Promise(r => this.requestAnimationFrame(r));
	}
	
	return parent.querySelector(query);
}

export class PrefCalls
{
	static getPrefBranch()
	{
		return Services.prefs.getBranch(null);
	}

	static getDefaultPrefBranch()
	{
		return Services.prefs.getDefaultBranch(null);
	}

	static setPref(prefName, value, defaultBranch)
	{
		try 
		{
			let prefBranch = defaultBranch ? this.getDefaultPrefBranch() : this.getPrefBranch();

			switch (typeof value)
			{
				case "string":
					prefBranch.setStringPref(prefName, value);
					break;
				case "number":
					prefBranch.setIntPref(prefName, value);
					break;
				case "boolean":
					prefBranch.setBoolPref(prefName, value);
					break;
				default:
					return;
			}
		} 
		catch (e) 
		{
			throw e;
		}
	}

	static defaultPref(prefName, value)
	{
		this.setPref(prefName, value, true);
	}

	static lockPref(prefName, value)
	{
		try 
		{
			let prefBranch = this.getPrefBranch();

			if (prefBranch.prefIsLocked(prefName))
				prefBranch.unlockPref(prefName);

			this.defaultPref(prefName, value);

			prefBranch.lockPref(prefName);
		} 
		catch (e) 
		{
			throw e;
		}
	}
	
	static unlockPref(prefName)
	{
		try 
		{
			let prefBranch = this.getPrefBranch();

			prefBranch.unlockPref(prefName);
		} 
		catch (e) 
		{
			throw e;
		}
	}

	
	static getPref(prefName) {
		try 
		{
			let prefBranch = this.getPrefBranch();

			switch (prefBranch.getPrefType(prefName)) 
			{
				case prefBranch.PREF_STRING:
					return prefBranch.getStringPref(prefName);
				case prefBranch.PREF_INT:
					return prefBranch.getIntPref(prefName);
				case prefBranch.PREF_BOOL:
					return prefBranch.getBoolPref(prefName);
				default:
					return null;
			}
		} 
		catch (e) 
		{
			throw e;
		}
	}

	static clearPref(prefName) {
		try
		{
			let prefBranch = this.getPrefBranch();
			prefBranch.clearUserPref(prefName);
		} catch (e) {};
	}
}

export class BrandUtils
{	
	static bundle = Services.strings.createBundle("chrome://branding/locale/brand.properties");

	static getBrandingKey(key)
	{
		return this.bundle.GetStringFromName(key);
	}
}

export class LocaleUtils
{
	
	static str(bundle, l10nId, ...extra)
    {
        try
        {
            if (arguments.length > 2)
            {
                return Services.strings.createBundle(bundle).formatStringFromName(l10nId, extra);
            }
            else
            {
                return Services.strings.createBundle(bundle).GetStringFromName(l10nId);
            }
        }
        catch (e)
        {
			try {
				let stringBundle = Services.strings.createBundle(`chrome://userchrome/content/locale/en-US/properties/${bundle.split("/").pop()}`);

				if (arguments.length > 2)
				{
					return Services.strings.createBundle(stringBundle).formatStringFromName(l10nId, extra);
				}
				else
				{
					return Services.strings.createBundle(stringBundle).GetStringFromName(l10nId);
				}
			}
			catch (e)
			{
				return "<" + l10nId + ">";
			}
        }
    }
}

export class setAttributes
{
	static set(element, attributes) {
		Object.keys(attributes).forEach(attr => {
			element.setAttribute(attr, attributes[attr]);
		});	
	}

	static remove(element, attributes) {
		Object.keys(attributes).forEach(attr => {
			element.removeAttribute(attr);
		});	
	}
}

export class NamorokaInfo
{
	static versionTextInfo() {
		return [
			{
				"style": 0,
				"version": "1.0",
				"copyright": "2004",
				"renderingVersion": "1.7.5",
				"engineBuild": "20041107",
			},
			{
				"style": 1,
				"version": "2.0",
				"copyright": "2006",
				"renderingVersion": "1.8.1",
				"engineBuild": "20061010",
			},
			{
				"style": 2,
				"version": "3.0",
				"copyright": "2008",
				"renderingVersion": "1.9",
				"engineBuild": "2008052906",
			},
		]
	}

	static userAgentSpoof() {
		return [
			{
				"name": "win95",
				"platform": "win",
				"version": "4.00"
			},
			{
				"name": "win98",
				"platform": "win",
				"version": "4.10"
			},
			{
				"name": "win2000",
				"platform": "winnt",
				"version": "5.0"
			},
			{
				"name": "winxp",
				"platform": "winnt",
				"version": "5.1"
			},
			{
				"name": "winsrv2003",
				"platform": "winnt",
				"version": "5.2"
			},
			{
				"name": "winvista",
				"platform": "winnt",
				"version": "6.0"
			},
			{
				"name": "win7",
				"platform": "winnt",
				"version": "6.1"
			},
		]
	}

	static populateUserAgentString()
	{
		let aboutDialogBundle =  Services.strings.createBundle("chrome://namoroka/locale/properties/aboutDialog.properties");

		// Mozilla/5.0 (Windows; U; Windows NT 6.2; en-US; rv:1.8.1) Gecko/20061010 Firefox/2.0
		var style = Services.prefs.getIntPref("Namoroka.Appearance.Style");

		var spoof = Services.prefs.getCharPref("Namoroka.About.UserAgentSpoof", Cc["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).userAgent);

		let info = this.versionTextInfo()[style];

		var platformVersion;
		var spoofId;

		switch (spoof) {
			case "win95":
				spoofId = 0;
				break;
			case "win98":
				spoofId = 1;
				break;
			case "win2000":
				spoofId = 2;
				break;
			case "winxp":
				spoofId = 3;
				break;
			case "winsrv2003":
				spoofId = 4;
				break;
			case "winvista":
				spoofId = 5;
				break;
			case "win7":
				spoofId = 6;
				break;
			default:
				return spoof;
		}

		var platform = this.userAgentSpoof()[spoofId].platform;

		if (platform == "winnt") {
			platformVersion = aboutDialogBundle.formatStringFromName("useragent_platform_windows_nt", [this.userAgentSpoof()[spoofId].version]);
		}
		else if (platform == "win") {
			let platformName = this.userAgentSpoof()[spoofId].name;

			if (platformName == "win95") {
				platformVersion = aboutDialogBundle.GetStringFromName("useragent_platform_windows_95");
			}
			else if (platformName == "win98") {
				platformVersion = aboutDialogBundle.GetStringFromName("useragent_platform_windows_98");
			}
		}

		let userAgentTable = {
			"locale": Services.locale.appLocaleAsBCP47,
			"renderingVersion": info?.renderingVersion,
			"engineBuild": info?.engineBuild,
			"version": info?.version,
			"browserName": BrandUtils.getBrandingKey("brandShortName")
		}

		var userAgentString = `Mozilla/5.0 (${aboutDialogBundle.GetStringFromName("useragent_platform_windows")}; U; ${platformVersion}; ${userAgentTable.locale}; rv:${userAgentTable.renderingVersion}) Gecko/${userAgentTable.engineBuild} ${userAgentTable.browserName}/${userAgentTable.version}`;

		return userAgentString;
	}
}