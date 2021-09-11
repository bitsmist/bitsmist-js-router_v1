// =============================================================================
/**
 * BitsmistJS - Javascript Web Client Framework
 *
 * @copyright		Masaki Yasutake
 * @link			https://bitsmist.com/
 * @license			https://github.com/bitsmist/bitsmist/blob/master/LICENSE
 */
// =============================================================================

import { pathToRegexp } from 'path-to-regexp';

// =============================================================================
//	Route organizer class
// =============================================================================

export default class RouteOrganizer extends BITSMIST.v1.Organizer
{

	// -------------------------------------------------------------------------
	//  Methods
	// -------------------------------------------------------------------------

	/**
	 * Init.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{Object}		settings			Settings.
	 *
	 * @return 	{Promise}		Promise.
	 */
	static init(component, settings)
	{

		// Add properties
		Object.defineProperty(component, 'routeInfo', { get() { return this._routeInfo; }, });
		Object.defineProperty(component, 'specs', { get() { return this._specs; }, });
		Object.defineProperty(component, 'spec', { get() { return this._spec; }, });

		// Add methods
		component.loadParameters = function(url) { return RouteOrganizer._loadParameters(url); }
		component.validateRoute = function() { return RouteOrganizer._validateRoute(this); }
		component.openRoute = function(routeInfo, options) { return RouteOrganizer._open(this, routeInfo, options); }
		component.replaceRoute = function(routeInfo, options) { return RouteOrganizer._replace(this, routeInfo, options); }
		component.jumpRoute = function(routeInfo, options) { return RouteOrganizer._jump(this, routeInfo, options); }
		component.refreshRoute = function(routeInfo, options) { return RouteOrganizer._refresh(this, routeInfo, options); }
		component.updateRoute = function(routeInfo, options) { return RouteOrganizer._update(this, routeInfo, options); }

		// Add properties
		Object.defineProperty(component, "settings", {
			get() { return this._spec; },
		});

		// Init vars
		component._routes = [];
		component._specs = {};
		component._spec = new BITSMIST.v1.ChainableStore({"chain":component._settings});

		// Init popstate handler
		RouteOrganizer.__initPopState(component);

		// Set state on the first page
		history.replaceState(RouteOrganizer.__getState("connect"), null, null);

	}

	// -------------------------------------------------------------------------

	/**
	 * Organizer.
	 *
	 * @param	{Object}		conditions			Conditions.
	 * @param	{Component}		component			Component.
	 * @param	{Object}		settings			Settings.
	 *
	 * @return 	{Promise}		Promise.
	 */
	static organize(conditions, component, settings)
	{

		// Load settings from attributes
		RouteOrganizer.__loadAttrSettings(component);

		// Load route info
		let routes = component.settings.get("routes");
		if (routes)
		{
			for(let i = 0; i < routes.length; i++)
			{
				RouteOrganizer._addRoute(component, routes[i]);
			}

			component._routeInfo = RouteOrganizer.__loadRouteInfo(component, window.location.href);
		}

		// Load spec info
		let specs = component.settings.get("specs");
		if (specs)
		{
			Object.keys(specs).forEach((key) => {
				component._specs[key] = specs[key];
			});
		}

	}

	// -------------------------------------------------------------------------
	//  Protected
	// -------------------------------------------------------------------------

	/**
	 * Add a route.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{Object}		routeInfo			Route info.
	 * @param	{Boolean}		first				Add to top when true.
	 */
	static _addRoute(component, routeInfo, first)
	{

		let keys = [];
		let route = {
			"origin": routeInfo["origin"],
			"name": routeInfo["name"],
			"path": routeInfo["path"],
			"keys": keys,
			"specName": routeInfo["specName"],
			"componentName": routeInfo["componentName"],
			"re": pathToRegexp(routeInfo["path"], keys)
		};

		if (first)
		{
			component._routes.unshift(route);
		}
		else
		{
			component._routes.push(route);
		}

	}

	// -------------------------------------------------------------------------

	/**
	 * Build url from route info.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{Object}		routeInfo			Route information.
	 * @param	{Object}		options				Options.
	 *
	 * @return  {String}		Url.
	 */
	static _buildUrl(component, routeInfo, options)
	{

		let url = "";

		url += ( routeInfo["url"] ? routeInfo["url"] : "" );
		url += ( routeInfo["path"] ? routeInfo["path"] : "" );
		url += ( routeInfo["query"] ? "?" + routeInfo["query"] : "" );

		if (routeInfo["queryParameters"])
		{
			let params = {};
			if (options && options["mergeParameters"])
			{
				params = Object.assign(params, component.routeInfo["queryParameters"]);
			}
			params = Object.assign(params, routeInfo["queryParameters"]);
			url += RouteOrganizer._buildUrlQuery(params);
		}

		return url;

	}

	// -----------------------------------------------------------------------------

	/**
	 * Build query string from the options object.
	 *
	 * @param	{Object}		options				Query options.
	 *
	 * @return	{String}		Query string.
	 */
	static _buildUrlQuery(options)
	{

		let query = "";

		if (options)
		{
			query = Object.keys(options).reduce((result, current) => {
				if (Array.isArray(options[current]))
				{
					result += encodeURIComponent(current) + "=" + encodeURIComponent(options[current].join()) + "&";
				}
				else if (options[current])
				{
					result += encodeURIComponent(current) + "=" + encodeURIComponent(options[current]) + "&";
				}

				return result;
			}, "");
		}

		return ( query ? "?" + query.slice(0, -1) : "");

	}

	// -----------------------------------------------------------------------------

	/**
	 * Create options array from the current url.
	 *
	 * @return  {Array}			Options array.
	 */
	static _loadParameters(url)
	{

		url = url || window.location.href;
		let vars = {}
		let hash;
		let value;

		if (window.location.href.indexOf("?") > -1)
		{
			let hashes = url.slice(url.indexOf('?') + 1).split('&');

			for(let i = 0; i < hashes.length; i++) {
				hash = hashes[i].split('=');
				if (hash[1]){
					value = hash[1].split('#')[0];
				} else {
					value = hash[1];
				}
				vars[hash[0]] = decodeURIComponent(value);
			}
		}

		return vars;

	}

	// -----------------------------------------------------------------------------

	/**
	 * Validate route.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{String}		url					Url to validate.
	 *
	 * @return 	{Promise}		Promise.
	 */
	static _validateRoute(component, url)
	{

		component._validationResult["result"] = true;

		return Promise.resolve().then(() => {
			return component.trigger("beforeValidate");
		}).then(() => {
			// Validate URL (by organizers)
			return component.callOrganizers("doCheckValidity", {
				"item":				RouteOrganizer._loadParameters(url),
				"validationName":	component.settings.get("settings.validationName")
			});
		}).then(() => {
			return component.trigger("doValidateURL");
		}).then(() => {
			return component.trigger("afterValidate");
		}).then(() => {
			// Validation failed?
			if (!component._validationResult["result"])
			{
				throw new Error("URL validation failed", component._validationResult["invalids"]);
			}
		});

	}

	// -----------------------------------------------------------------------------

	/**
	 * Normalize route.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{String}		url					Url to validate.
	 *
	 * @return 	{Promise}		Promise.
	 */
	static _normalizeRoute(component, url)
	{

		return Promise.resolve().then(() => {
			return component.trigger("beforeNormalizeURL");
		}).then(() => {
			return component.trigger("doNormalizeURL");
		}).then(() => {
			return component.trigger("afterNormalizeURL");
		});

	}

	// -----------------------------------------------------------------------------

	/**
	 * Open route.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{Object}		routeInfo			Route information.
	 * @param	{Object}		options				Query options.
	 *
	 * @return 	{Promise}		Promise.
	 */
	static _open(component, routeInfo, options)
	{

		options = Object.assign({}, options);
		let newRouteInfo;
		let newUrl;

		// Current route info
		let curRouteInfo = component._routeInfo;
		let curUrl = window.location.href;

		// New route info
		if (routeInfo)
		{
			newUrl = RouteOrganizer._buildUrl(component, routeInfo, options);
			newRouteInfo = RouteOrganizer.__loadRouteInfo(component, newUrl);
			component._routeInfo = newRouteInfo;
			options["pushState"] = BITSMIST.v1.Util.safeGet(options, "pushState", true);
		}
		else
		{
			newUrl = window.location.href;
			newRouteInfo = curRouteInfo;
			options["pushState"] = false;
		}

		// Jump to another page
		if (options["jump"] || !newRouteInfo["name"] || ( curRouteInfo["name"] != newRouteInfo["name"])
			|| ( curRouteInfo["specName"] != newRouteInfo["specName"]) // <--- remove this when _update() is ready.
		)
		{
			RouteOrganizer._jump(component, {"url":newUrl});
			return;
		}

		return Promise.resolve().then(() => {
			// Replace URL
			if (options["pushState"])
			{
				history.pushState(RouteOrganizer.__getState("_open.pushState"), null, newUrl);
			}
		}).then(() => {
			// Validate URL
			return RouteOrganizer._validateRoute(component, newUrl);
		}).then(() => {
			/*
			// Load another component when new spec is different from current
			if (curRouteInfo["specName"] != newRouteInfo["specName"])
			{
				return RouteOrganizer._update(component, newRouteInfo, options);
			}
			*/
		}).then(() => {
			// Refresh
			return RouteOrganizer._refresh(component, routeInfo, options);
		}).then(() => {
			// Normalize URL
			return RouteOrganizer._normalizeRoute(component, window.location.href);
		});

	}

	// -----------------------------------------------------------------------------

	/**
	 * Jump to url.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{Object}		routeInfo			Route information.
	 * @param	{Object}		options				Query options.
	 */
	static _jump(component, routeInfo, options)
	{

		let url = RouteOrganizer._buildUrl(component, routeInfo, options);
		window.location.href = url;

	}

	// -----------------------------------------------------------------------------

	/**
	 * Refresh route.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{Object}		routeInfo			Route information.
	 * @param	{Object}		options				Query options.
	 *
	 * @return 	{Promise}		Promise.
	 */
	static _refresh(component, routeInfo, options)
	{

		return Promise.resolve().then(() => {
			return component.trigger("beforeRefresh");
		}).then(() => {
			return component.trigger("doRefresh");
		}).then(() => {
			return component.trigger("afterRefresh");
		});

	}

	// -----------------------------------------------------------------------------

	/**
	 * Update route.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{Object}		routeInfo			Route information.
	 * @param	{Object}		options				Query options.
	 *
	 * @return 	{Promise}		Promise.
	 */
	static _update(component, routeInfo, options)
	{

		return Promise.resolve().then(() => {
			return component.clearOrganizers();
		}).then(() => {
			return RouteOrganizer.__initSpec(component, routeInfo["specName"]);
		});

	}

	// -----------------------------------------------------------------------------

	/**
	 * Replace current url.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{Object}		routeInfo			Route information.
	 * @param	{Object}		options				Query options.
	 */
	static _replace(component, routeInfo, options)
	{

		history.replaceState(RouteOrganizer.__getState("replaceRoute", window.history.state), null, RouteOrganizer._buildUrl(component, routeInfo, options));
		component._routeInfo = RouteOrganizer.__loadRouteInfo(component, window.location.href);

	}

	// -------------------------------------------------------------------------
	//  Privates
	// -------------------------------------------------------------------------

	/**
	 * Load a spec and init.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{String}		specName			Spec name.
	 *
	 * @return 	{Promise}		Promise.
	 */
	static __initSpec(component, specName)
	{

		BITSMIST.v1.Util.assert(specName, "A spec name not specified.", TypeError);

		return Promise.resolve().then(() => {
			if (!component._specs[specName])
			{
				return RouteOrganizer.__loadSpec(component, specName, component.settings.get("system.specPath")).then((spec) => {;
					component._specs[specName] = spec;
					component._spec.items = spec;
				});
			}
		}).then(() => {
			return component.addOrganizers(component._specs[specName]);
		}).then(() => {
			return component.callOrganizers("afterSpecLoad", component._specs[specName]);
		}).then(() => {
			return component.trigger("afterSpecLoad", component, {"spec":component._specs[component._routeInfo["specName"]]});
		});

	}

	// -----------------------------------------------------------------------------

	/**
	 * Load the spec file for this page.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{String}		specName			Spec name.
	 * @param	{String}		path				Path to spec.
	 *
	 * @return  {Promise}		Promise.
	 */
	static __loadSpec(component, specName, path)
	{

		let spec;
//		let specCommon;
		let promises = [];

		console.debug(`RouteOrganizer._loadSpec(): Loading spec file. name=${component.name}, specName=${specName}, path=${path}`);

		// Load specs
		let type = "js";
//		promises.push(BITSMIST.v1.SettingOrganizer.loadSetting(component, "common", path, type));
		promises.push(BITSMIST.v1.SettingOrganizer.loadSetting(component, specName, path, type));

		return Promise.all(promises).then((result) => {
			spec = result[0];
//			specCommon = result[0];
//			spec = BITSMIST.v1.Util.deepMerge(specCommon, result[1]);

			return spec;
		});

	}

	// -----------------------------------------------------------------------------

	/**
	 * Get route info from the url.
	 *
	 * @param	{Component}		component			Component.
	 * @param	{String}		url					Url.
	 *
	 * @return  {Object}		Route info.
	 */
	static __loadRouteInfo(component, url)
	{

		let routeInfo = {};
		let routeName;
		let parsedUrl = new URL(url, window.location.href);
		let specName;
		let params = {};

		// Find a matching route
		for (let i = component._routes.length - 1; i >= 0; i--)
		{
			// Check origin
			if (component._routes[i]["origin"] && parsedUrl.origin != component._routes[i]["origin"])
			{
				continue;
			}

			// Check path
			let result = ( !component._routes[i]["path"] ? [] : component._routes[i].re.exec(parsedUrl.pathname) );
			if (result)
			{
				routeName = component._routes[i].name;
				specName = ( component._routes[i].specName ? component._routes[i].specName : "" );
				for (let j = 0; j < result.length - 1; j++)
				{
					params[component._routes[i].keys[j].name] = result[j + 1];
					let keyName = component._routes[i].keys[j].name;
					let value = result[j + 1];
					specName = specName.replace("{{:" + keyName + "}}", value);
				}

				break;
			}
		}

		routeInfo["name"] = routeName;
		routeInfo["specName"] = specName;
		routeInfo["url"] = parsedUrl["href"];
		routeInfo["path"] = parsedUrl.pathname;
		routeInfo["query"] = parsedUrl.search;
		routeInfo["parsedUrl"] = parsedUrl;
		routeInfo["routeParameters"] = params;
		routeInfo["queryParameters"] = RouteOrganizer._loadParameters(url);

		return routeInfo;

	}

	// -----------------------------------------------------------------------------

	/**
	 * Init pop state handling.
	 *
	 * @param	{Component}		component			Component.
	 */
	static __initPopState(component)
	{

		window.addEventListener("popstate", (e) => {
			return Promise.resolve().then(() => {
				return component.trigger("beforePopState");
			}).then(() => {
				return RouteOrganizer._open(component);
			}).then(() => {
				return component.trigger("afterPopState");
			});
		});

	}

	// -----------------------------------------------------------------------------

	/**
	 * Return history state.
	 *
	 * @param	{String}		msg					Message to store in state.
	 *
	 * @return	{String}		State.
	 */
	static __getState(msg, options)
	{

		let newState = {
			"msg": msg,
		};

		if (options)
		{
			newState = Object.assign({}, options, newState);
		}

		return newState;

	}

	// -----------------------------------------------------------------------------

	/**
	 * Get settings from element's attribute.
	 *
	 * @param	{Component}		component			Component.
	 */
	static __loadAttrSettings(component)
	{

		// Get spec path from  bm-specpath
		let path = component.getAttribute("bm-specpath");
		if (path)
		{
			component.settings.set("system.specPath", path);
		}

	}

}
