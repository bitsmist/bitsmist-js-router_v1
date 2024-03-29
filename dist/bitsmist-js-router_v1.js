(function () {
    'use strict';

    /**
     * Tokenize input string.
     */
    function lexer(str) {
        var tokens = [];
        var i = 0;
        while (i < str.length) {
            var char = str[i];
            if (char === "*" || char === "+" || char === "?") {
                tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
                continue;
            }
            if (char === "\\") {
                tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
                continue;
            }
            if (char === "{") {
                tokens.push({ type: "OPEN", index: i, value: str[i++] });
                continue;
            }
            if (char === "}") {
                tokens.push({ type: "CLOSE", index: i, value: str[i++] });
                continue;
            }
            if (char === ":") {
                var name = "";
                var j = i + 1;
                while (j < str.length) {
                    var code = str.charCodeAt(j);
                    if (
                    // `0-9`
                    (code >= 48 && code <= 57) ||
                        // `A-Z`
                        (code >= 65 && code <= 90) ||
                        // `a-z`
                        (code >= 97 && code <= 122) ||
                        // `_`
                        code === 95) {
                        name += str[j++];
                        continue;
                    }
                    break;
                }
                if (!name)
                    throw new TypeError("Missing parameter name at " + i);
                tokens.push({ type: "NAME", index: i, value: name });
                i = j;
                continue;
            }
            if (char === "(") {
                var count = 1;
                var pattern = "";
                var j = i + 1;
                if (str[j] === "?") {
                    throw new TypeError("Pattern cannot start with \"?\" at " + j);
                }
                while (j < str.length) {
                    if (str[j] === "\\") {
                        pattern += str[j++] + str[j++];
                        continue;
                    }
                    if (str[j] === ")") {
                        count--;
                        if (count === 0) {
                            j++;
                            break;
                        }
                    }
                    else if (str[j] === "(") {
                        count++;
                        if (str[j + 1] !== "?") {
                            throw new TypeError("Capturing groups are not allowed at " + j);
                        }
                    }
                    pattern += str[j++];
                }
                if (count)
                    throw new TypeError("Unbalanced pattern at " + i);
                if (!pattern)
                    throw new TypeError("Missing pattern at " + i);
                tokens.push({ type: "PATTERN", index: i, value: pattern });
                i = j;
                continue;
            }
            tokens.push({ type: "CHAR", index: i, value: str[i++] });
        }
        tokens.push({ type: "END", index: i, value: "" });
        return tokens;
    }
    /**
     * Parse a string for the raw tokens.
     */
    function parse(str, options) {
        if (options === void 0) { options = {}; }
        var tokens = lexer(str);
        var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a;
        var defaultPattern = "[^" + escapeString(options.delimiter || "/#?") + "]+?";
        var result = [];
        var key = 0;
        var i = 0;
        var path = "";
        var tryConsume = function (type) {
            if (i < tokens.length && tokens[i].type === type)
                return tokens[i++].value;
        };
        var mustConsume = function (type) {
            var value = tryConsume(type);
            if (value !== undefined)
                return value;
            var _a = tokens[i], nextType = _a.type, index = _a.index;
            throw new TypeError("Unexpected " + nextType + " at " + index + ", expected " + type);
        };
        var consumeText = function () {
            var result = "";
            var value;
            // tslint:disable-next-line
            while ((value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR"))) {
                result += value;
            }
            return result;
        };
        while (i < tokens.length) {
            var char = tryConsume("CHAR");
            var name = tryConsume("NAME");
            var pattern = tryConsume("PATTERN");
            if (name || pattern) {
                var prefix = char || "";
                if (prefixes.indexOf(prefix) === -1) {
                    path += prefix;
                    prefix = "";
                }
                if (path) {
                    result.push(path);
                    path = "";
                }
                result.push({
                    name: name || key++,
                    prefix: prefix,
                    suffix: "",
                    pattern: pattern || defaultPattern,
                    modifier: tryConsume("MODIFIER") || ""
                });
                continue;
            }
            var value = char || tryConsume("ESCAPED_CHAR");
            if (value) {
                path += value;
                continue;
            }
            if (path) {
                result.push(path);
                path = "";
            }
            var open = tryConsume("OPEN");
            if (open) {
                var prefix = consumeText();
                var name_1 = tryConsume("NAME") || "";
                var pattern_1 = tryConsume("PATTERN") || "";
                var suffix = consumeText();
                mustConsume("CLOSE");
                result.push({
                    name: name_1 || (pattern_1 ? key++ : ""),
                    pattern: name_1 && !pattern_1 ? defaultPattern : pattern_1,
                    prefix: prefix,
                    suffix: suffix,
                    modifier: tryConsume("MODIFIER") || ""
                });
                continue;
            }
            mustConsume("END");
        }
        return result;
    }
    /**
     * Escape a regular expression string.
     */
    function escapeString(str) {
        return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
    }
    /**
     * Get the flags for a regexp from the options.
     */
    function flags(options) {
        return options && options.sensitive ? "" : "i";
    }
    /**
     * Pull out keys from a regexp.
     */
    function regexpToRegexp(path, keys) {
        if (!keys)
            return path;
        var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
        var index = 0;
        var execResult = groupsRegex.exec(path.source);
        while (execResult) {
            keys.push({
                // Use parenthesized substring match if available, index otherwise
                name: execResult[1] || index++,
                prefix: "",
                suffix: "",
                modifier: "",
                pattern: ""
            });
            execResult = groupsRegex.exec(path.source);
        }
        return path;
    }
    /**
     * Transform an array into a regexp.
     */
    function arrayToRegexp(paths, keys, options) {
        var parts = paths.map(function (path) { return pathToRegexp(path, keys, options).source; });
        return new RegExp("(?:" + parts.join("|") + ")", flags(options));
    }
    /**
     * Create a path regexp from string input.
     */
    function stringToRegexp(path, keys, options) {
        return tokensToRegexp(parse(path, options), keys, options);
    }
    /**
     * Expose a function for taking tokens and returning a RegExp.
     */
    function tokensToRegexp(tokens, keys, options) {
        if (options === void 0) { options = {}; }
        var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function (x) { return x; } : _d;
        var endsWith = "[" + escapeString(options.endsWith || "") + "]|$";
        var delimiter = "[" + escapeString(options.delimiter || "/#?") + "]";
        var route = start ? "^" : "";
        // Iterate over the tokens and create our regexp string.
        for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
            var token = tokens_1[_i];
            if (typeof token === "string") {
                route += escapeString(encode(token));
            }
            else {
                var prefix = escapeString(encode(token.prefix));
                var suffix = escapeString(encode(token.suffix));
                if (token.pattern) {
                    if (keys)
                        keys.push(token);
                    if (prefix || suffix) {
                        if (token.modifier === "+" || token.modifier === "*") {
                            var mod = token.modifier === "*" ? "?" : "";
                            route += "(?:" + prefix + "((?:" + token.pattern + ")(?:" + suffix + prefix + "(?:" + token.pattern + "))*)" + suffix + ")" + mod;
                        }
                        else {
                            route += "(?:" + prefix + "(" + token.pattern + ")" + suffix + ")" + token.modifier;
                        }
                    }
                    else {
                        route += "(" + token.pattern + ")" + token.modifier;
                    }
                }
                else {
                    route += "(?:" + prefix + suffix + ")" + token.modifier;
                }
            }
        }
        if (end) {
            if (!strict)
                route += delimiter + "?";
            route += !options.endsWith ? "$" : "(?=" + endsWith + ")";
        }
        else {
            var endToken = tokens[tokens.length - 1];
            var isEndDelimited = typeof endToken === "string"
                ? delimiter.indexOf(endToken[endToken.length - 1]) > -1
                : // tslint:disable-next-line
                    endToken === undefined;
            if (!strict) {
                route += "(?:" + delimiter + "(?=" + endsWith + "))?";
            }
            if (!isEndDelimited) {
                route += "(?=" + delimiter + "|" + endsWith + ")";
            }
        }
        return new RegExp(route, flags(options));
    }
    /**
     * Normalize the given path string, returning a regular expression.
     *
     * An empty array can be passed in for the keys, which will hold the
     * placeholder key descriptions. For example, using `/user/:id`, `keys` will
     * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
     */
    function pathToRegexp(path, keys, options) {
        if (path instanceof RegExp)
            return regexpToRegexp(path, keys);
        if (Array.isArray(path))
            return arrayToRegexp(path, keys, options);
        return stringToRegexp(path, keys, options);
    }

    // =============================================================================

    // =============================================================================
    //	Route organizer class
    // =============================================================================

    class RouteOrganizer extends BITSMIST.v1.Organizer
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
    		component.loadParameters = function(url) { return RouteOrganizer._loadParameters(url); };
    		component.switchSpec = function(specName, options) { return RouteOrganizer._switchSpec(this, specName, options); };
    		component.openRoute = function(routeInfo, options) { return RouteOrganizer._open(this, routeInfo, options); };
    		component.jumpRoute = function(routeInfo, options) { return RouteOrganizer._jumpRoute(this, routeInfo, options); };
    		component.updateRoute = function(routeInfo, options) { return RouteOrganizer._updateRoute(this, routeInfo, options); };
    		component.refreshRoute = function(routeInfo, options) { return RouteOrganizer._refreshRoute(this, routeInfo, options); };
    		component.replaceRoute = function(routeInfo, options) { return RouteOrganizer._replaceRoute(this, routeInfo, options); };
    		component.validateRoute = function() { return RouteOrganizer._validateRoute(this); };
    		component.normalizeRoute = function() { return RouteOrganizer._normalizeRoute(this); };

    		// Init vars
    		component._routes = [];
    		component._specs = {};
    		component._spec = new BITSMIST.v1.ChainableStore({"chain":component.settings, "writeThrough":true});
    		Object.defineProperty(component, "settings", { get() { return this._spec; }, }); // Tweak to see settings through spec

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
    		RouteOrganizer._loadAttrSettings(component);

    		// Load route info
    		let routes = settings["routes"];
    		if (routes)
    		{
    			for(let i = 0; i < routes.length; i++)
    			{
    				RouteOrganizer._addRoute(component, routes[i]);
    			}
    		}

    		// Set current route info.
    		component._routeInfo = RouteOrganizer.__loadRouteInfo(component, window.location.href);

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

    		return ( url ? url : "/" );

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
    		let vars = {};
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

    	// -------------------------------------------------------------------------

    	/**
    	 * Load a spec and init.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		specName			Spec name.
    	 * @param	{Object}		options				Options.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	static _switchSpec(component, specName, options)
    	{

    		BITSMIST.v1.Util.assert(specName, "RouteOrganizer._switchSpec(): A spec name not specified.", TypeError);

    		return Promise.resolve().then(() => {
    			if (!component._specs[specName])
    			{
    				return RouteOrganizer._loadSpec(component, specName, options).then((spec) => {
    					component._specs[specName] = spec;
    				});
    			}
    		}).then(() => {
    			component._spec.items = component._specs[specName];
    		}).then(() => {
    			return component.addOrganizers(component._specs[specName]);
    		}).then(() => {
    			if (component.settings.get("settings.hasExtender"))
    			{
    				return RouteOrganizer._loadExtender(component, specName, options);
    			}
    		}).then(() => {
    			return component.callOrganizers("afterSpecLoad", component._specs[specName]);
    		}).then(() => {
    			return component.trigger("afterSpecLoad", {"spec":component._specs[component._routeInfo["specName"]]});
    		});

    	}

    	// -----------------------------------------------------------------------------

    	/**
    	 * Open route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Options.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	static _open(component, routeInfo, options)
    	{

    		options = Object.assign({}, options);
    		let pushState = BITSMIST.v1.Util.safeGet(options, "pushState", ( routeInfo ? true : false ));

    		// Current route info
    		let curRouteInfo = component._routeInfo;

    		let newUrl;
    		let newRouteInfo;
    		if (routeInfo)
    		{
    			newUrl = RouteOrganizer._buildUrl(component, routeInfo, options);
    			newRouteInfo = RouteOrganizer.__loadRouteInfo(component, newUrl);
    		}
    		else
    		{
    			newUrl = window.location.href;
    			newRouteInfo = curRouteInfo;
    		}

    		// Jump to another page
    		if (options["jump"] || !newRouteInfo["name"]
    				|| ( curRouteInfo["specName"] != newRouteInfo["specName"]) // <--- remove this when _update() is ready.
    		)
    		{
    			RouteOrganizer._jumpRoute(component, {"url":newUrl});
    			return;
    		}

    		return Promise.resolve().then(() => {
    			// Replace URL
    			if (pushState)
    			{
    				history.pushState(RouteOrganizer.__getState("_open.pushState"), null, newUrl);
    			}
    			component._routeInfo = newRouteInfo;
    		}).then(() => {
    			// Load other component when new spec is different from the current spec
    			if (curRouteInfo["specName"] != newRouteInfo["specName"])
    			{
    				return RouteOrganizer._updateRoute(component, curRouteInfo, newRouteInfo, options);
    			}
    		}).then(() => {
    			// Validate URL
    			return RouteOrganizer._validateRoute(component, newUrl);
    		}).then(() => {
    			// Refresh
    			return RouteOrganizer._refreshRoute(component, newRouteInfo, options);
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
    	 * @param	{Object}		options				Options.
    	 */
    	static _jumpRoute(component, routeInfo, options)
    	{

    		let url = RouteOrganizer._buildUrl(component, routeInfo, options);
    		window.location.href = url;

    	}

    	// -----------------------------------------------------------------------------

    	/**
    	 * Update route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Options.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	static _updateRoute(component, curRouteInfo, newRouteInfo, options)
    	{

    		return Promise.resolve().then(() => {
    			return component.changeState("routing");
    		}).then(() => {
    			return component.clearOrganizers("afterStart", component._specs[curRouteInfo["specName"]]);
    		}).then(() => {
    			return component.clearOrganizers("afterSpecLoad", component._specs[curRouteInfo["specName"]]);
    		}).then(() => {
    			return RouteOrganizer._switchSpec(component, newRouteInfo["specName"]);
    		}).then(() => {
    			// Started
    			return component._postStart();
    		});

    	}

    	// -----------------------------------------------------------------------------

    	/**
    	 * Refresh route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Options.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	static _refreshRoute(component, routeInfo, options)
    	{

    		return component.refresh(options);

    	}

    	// -----------------------------------------------------------------------------

    	/**
    	 * Replace current url.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Options.
    	 */
    	static _replaceRoute(component, routeInfo, options)
    	{

    		history.replaceState(RouteOrganizer.__getState("replaceRoute", window.history.state), null, RouteOrganizer._buildUrl(component, routeInfo, options));
    		component._routeInfo = RouteOrganizer.__loadRouteInfo(component, window.location.href);

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

    		component.validationResult["result"] = true;

    		return Promise.resolve().then(() => {
    			return component.trigger("beforeValidate");
    		}).then(() => {
    			// Validate URL (by organizers)
    			return component.callOrganizers("doCheckValidity", {
    				"item":				RouteOrganizer._loadParameters(url),
    				"validationName":	component.settings.get("settings.validationName")
    			});
    		}).then(() => {
    			// Fix URL
    			if (!component.validationResult["result"] && component.settings.get("settings.autoFixURL"))
    			{
    				return RouteOrganizer.__fixRoute(component, url);
    			}
    		}).then(() => {
    			return component.trigger("doValidate");
    		}).then(() => {
    			return component.trigger("afterValidate");
    		}).then(() => {
    			// Validation failed?
    			if (!component.validationResult["result"])
    			{
    				RouteOrganizer.__dumpValidationErrors(component);
    				throw new URIError("URL validation failed.");
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

    	// -------------------------------------------------------------------------

    	/**
    	 * Get settings from element's attribute.
    	 *
    	 * @param	{Component}		component			Component.
    	 */
    	static _loadAttrSettings(component)
    	{

    		// Get spec path from  bm-specpath
    		let path = component.getAttribute("bm-specpath");
    		if (path)
    		{
    			component.settings.set("loadings.specPath", path);
    		}

    	}

    	// -----------------------------------------------------------------------------

    	/**
    	 * Load the spec file for this page.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		specName			Spec name.
    	 * @param	{Object}		loadOptions			Load options.
    	 *
    	 * @return  {Promise}		Promise.
    	 */
    	static _loadSpec(component, specName, loadOptions)
    	{

    		let spec;
    //		let specCommon;
    		let promises = [];

    		console.debug(`RouteOrganizer._loadSpec(): Loading spec file. name=${component.name}, specName=${specName}`);

    		// Path
    		let path = BITSMIST.v1.Util.safeGet(loadOptions, "path",
    			BITSMIST.v1.Util.concatPath([
    				component.settings.get("loadings.appBaseUrl", BITSMIST.v1.settings.get("system.appBaseUrl", "")),
    				component.settings.get("loadings.specPath", BITSMIST.v1.settings.get("system.specPath", ""))
    			])
    		);

    		// Load specs
    		let options = BITSMIST.v1.Util.deepMerge({"type": "js", "bindTo": this}, loadOptions);
    		promises.push(component.loadSettingFile(specName, path, options));

    		return Promise.all(promises).then((result) => {
    			spec = result[0];
    //			specCommon = result[0];
    //			spec = BITSMIST.v1.Util.deepMerge(specCommon, result[1]);

    			return spec;
    		});

    	}

    	// -----------------------------------------------------------------------------

    	/**
    	 * Load the extender file for this page.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		specName			Spec name.
    	 * @param	{Object}		loadOptions			Load options.
    	 *
    	 * @return  {Promise}		Promise.
    	 */
    	static _loadExtender(component, extenderName, loadOptions)
    	{

    		console.debug(`RouteOrganizer._loadExtender(): Loading extender file. name=${component.name}, extenderName=${extenderName}`);

    		let query = BITSMIST.v1.Util.safeGet(loadOptions, "query");
    		let path = BITSMIST.v1.Util.safeGet(loadOptions, "path",
    			BITSMIST.v1.Util.concatPath([
    				component.settings.get("loadings.appBaseUrl", BITSMIST.v1.settings.get("system.appBaseUrl", "")),
    				component.settings.get("loadings.specPath", BITSMIST.v1.settings.get("system.specPath", ""))
    			])
    		);
    		let url = path + extenderName + ".extender.js" + (query ? "?" + query : "");

    		return BITSMIST.v1.AjaxUtil.loadScript(url);

    	}

    	// -------------------------------------------------------------------------
    	//  Privates
    	// -------------------------------------------------------------------------

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
    				return RouteOrganizer._open(component, {"url":window.location.href}, {"pushState":false});
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
    	 * @param	{Object}		options				Optional values to store in state.
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
    			newState = BITSMIST.v1.Util.deepMerge(BITSMIST.v1.Util.deepClone(options), newState);
    		}

    		return newState;

    	}

    	// -----------------------------------------------------------------------------

    	/**
    	 * Fix route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		url					Url to validate.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	static __fixRoute(component, url)
    	{

    		let isOk = true;
    		let newParams = RouteOrganizer._loadParameters(url);

    		// Fix invalid paramters
    		Object.keys(component.validationResult["invalids"]).forEach((key) => {
    			let item = component.validationResult["invalids"][key];

    			if (item["fix"] !== undefined)
    			{
    				newParams[item["key"]] = item["fix"];
    			}
    			else if (item["failed"][0]["validity"] === "notAllowed")
    			{
    				delete newParams[item["key"]];
    			}
    			else
    			{
    				isOk = false;
    			}
    		});

    		if (isOk)
    		{
    			// Replace URL
    			RouteOrganizer._replaceRoute(component, {"queryParameters":newParams});

    			// Fixed
    			component.validationResult["result"] = true;
    		}

    	}

    	// -----------------------------------------------------------------------------

    	/**
    	 * Dump validation errors.
    	 *
    	 * @param	{Component}		component			Component.
    	 */
    	static __dumpValidationErrors(component)
    	{

    		Object.keys(component.validationResult["invalids"]).forEach((key) => {
    			let item = component.validationResult["invalids"][key];

    			if (item.failed)
    			{
    				for (let i = 0; i < item.failed.length; i++)
    				{
    					console.warn("URL validation failed.",
    						"key=" + item.key +
    						", value=" + item.value +
    						", rule=" + item.failed[i].rule +
    						", validity=" + item.failed[i].validity
    					);
    				}
    			}
    		});

    	}

    }

    // =============================================================================

    // =============================================================================
    //	Router class
    // =============================================================================

    // -----------------------------------------------------------------------------
    //  Constructor
    // -----------------------------------------------------------------------------

    /**
     * Constructor.
     */
    function Router()
    {

    	// super()
    	return Reflect.construct(BITSMIST.v1.Component, [], this.constructor);

    }

    BITSMIST.v1.ClassUtil.inherit(Router, BITSMIST.v1.Component);
    customElements.define("bm-router", Router);

    // -----------------------------------------------------------------------------
    //  Protected
    // -----------------------------------------------------------------------------

    Router.prototype._getSettings = function(settings)
    {

    	let defaults = {
    		"settings": {
    			"name":						"Router",
    			"autoFixURL":				false,
    			"autoFetch":				false,
    			"autoSetup":				false,
    			"autoRefresh":				false,
    			"hasTemplate":				false,
    			"rootElement":				document.body,
    		},
    		"organizers": {
    			"RouteOrganizer":			{"settings":{"attach":true}},
    			"ValidationOrganizer":		{"settings":{"attach":true}},
    		},
    		"events": {
    			"this": {
    				"handlers": {
    					"doStart": ["onDoStart"],
    					"afterStart": ["onAfterStart"]
    				}
    			}
    		}
    	};

    	settings = ( settings ? BITSMIST.v1.Util.deepMerge(settings, defaults) : defaults);

    	return settings;

    };

    // -----------------------------------------------------------------------------
    //  Event Handlers
    // -----------------------------------------------------------------------------

    Router.prototype.onDoStart = function(sender, e, ex)
    {

    	if (this.routeInfo["specName"])
    	{
    		let options = {
    			"query": this.settings.get("loadings.query")
    		};

    		return this.switchSpec(this.routeInfo["specName"], options);
    	}

    };

    Router.prototype.onAfterStart = function(sender, e, ex)
    {

    	return this.openRoute();

    };

    window.BITSMIST = window.BITSMIST || {};
    window.BITSMIST.v1 = window.BITSMIST.v1 || {};
    BITSMIST.v1.OrganizerOrganizer.register("RouteOrganizer", {"object":RouteOrganizer, "targetWords":"routes", "targetEvents":["beforeStart", "afterSpecLoad"], "order":900});
    window.BITSMIST.v1.Router = Router;

})();
//# sourceMappingURL=bitsmist-js-router_v1.js.map
