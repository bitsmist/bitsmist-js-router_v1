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
                    { throw new TypeError("Missing parameter name at " + i); }
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
                    { throw new TypeError("Unbalanced pattern at " + i); }
                if (!pattern)
                    { throw new TypeError("Missing pattern at " + i); }
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
                { return tokens[i++].value; }
        };
        var mustConsume = function (type) {
            var value = tryConsume(type);
            if (value !== undefined)
                { return value; }
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
            { return path; }
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
                        { keys.push(token); }
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
                { route += delimiter + "?"; }
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
            { return regexpToRegexp(path, keys); }
        if (Array.isArray(path))
            { return arrayToRegexp(path, keys, options); }
        return stringToRegexp(path, keys, options);
    }

    // =============================================================================

    // =============================================================================
    //	Route organizer class
    // =============================================================================

    var RouteOrganizer = /*@__PURE__*/(function (superclass) {
    	function RouteOrganizer () {
    		superclass.apply(this, arguments);
    	}

    	if ( superclass ) RouteOrganizer.__proto__ = superclass;
    	RouteOrganizer.prototype = Object.create( superclass && superclass.prototype );
    	RouteOrganizer.prototype.constructor = RouteOrganizer;

    	RouteOrganizer.init = function init (component, settings)
    	{

    		// Add properties
    		Object.defineProperty(component, 'routeInfo', { get: function get() { return this._routeInfo; }, });
    		Object.defineProperty(component, 'specs', { get: function get() { return this._specs; }, });
    		Object.defineProperty(component, 'spec', { get: function get() { return this._spec; }, });

    		// Add methods
    		component.loadParameters = function(url) { return RouteOrganizer._loadParameters(url); };
    		component.switchSpec = function(specName) { return RouteOrganizer._switchSpec(this, specName); };
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
    		Object.defineProperty(component, "settings", { get: function get() { return this._spec; }, }); // Tweak to see settings through spec

    		// Init popstate handler
    		RouteOrganizer.__initPopState(component);

    		// Set state on the first page
    		history.replaceState(RouteOrganizer.__getState("connect"), null, null);

    	};

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
    	RouteOrganizer.organize = function organize (conditions, component, settings)
    	{

    		// Load settings from attributes
    		RouteOrganizer.__loadAttrSettings(component);

    		// Load route info
    		var routes = settings["routes"];
    		if (routes)
    		{
    			for(var i = 0; i < routes.length; i++)
    			{
    				RouteOrganizer._addRoute(component, routes[i]);
    			}
    		}

    		// Set current route info.
    		component._routeInfo = RouteOrganizer.__loadRouteInfo(component, window.location.href);

    		// Load spec info
    		var specs = component.settings.get("specs");
    		if (specs)
    		{
    			Object.keys(specs).forEach(function (key) {
    				component._specs[key] = specs[key];
    			});
    		}

    	};

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
    	RouteOrganizer._addRoute = function _addRoute (component, routeInfo, first)
    	{

    		var keys = [];
    		var route = {
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

    	};

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
    	RouteOrganizer._buildUrl = function _buildUrl (component, routeInfo, options)
    	{

    		var url = "";

    		url += ( routeInfo["url"] ? routeInfo["url"] : "" );
    		url += ( routeInfo["path"] ? routeInfo["path"] : "" );
    		url += ( routeInfo["query"] ? "?" + routeInfo["query"] : "" );

    		if (routeInfo["queryParameters"])
    		{
    			var params = {};
    			if (options && options["mergeParameters"])
    			{
    				params = Object.assign(params, component.routeInfo["queryParameters"]);
    			}
    			params = Object.assign(params, routeInfo["queryParameters"]);
    			url += RouteOrganizer._buildUrlQuery(params);
    		}

    		return ( url ? url : "/" );

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Build query string from the options object.
    	 *
    	 * @param	{Object}		options				Query options.
    	 *
    	 * @return	{String}		Query string.
    	 */
    	RouteOrganizer._buildUrlQuery = function _buildUrlQuery (options)
    	{

    		var query = "";

    		if (options)
    		{
    			query = Object.keys(options).reduce(function (result, current) {
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

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Create options array from the current url.
    	 *
    	 * @return  {Array}			Options array.
    	 */
    	RouteOrganizer._loadParameters = function _loadParameters (url)
    	{

    		url = url || window.location.href;
    		var vars = {};
    		var hash;
    		var value;

    		if (window.location.href.indexOf("?") > -1)
    		{
    			var hashes = url.slice(url.indexOf('?') + 1).split('&');

    			for(var i = 0; i < hashes.length; i++) {
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

    	};

    	// -------------------------------------------------------------------------

    	/**
    	 * Load a spec and init.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		specName			Spec name.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	RouteOrganizer._switchSpec = function _switchSpec (component, specName)
    	{

    		BITSMIST.v1.Util.assert(specName, "RouteOrganizer._switchSpec(): A spec name not specified.", TypeError);

    		return Promise.resolve().then(function () {
    			if (!component._specs[specName])
    			{
    				return RouteOrganizer.__loadSpec(component, specName, component.settings.get("system.specPath")).then(function (spec) {					component._specs[specName] = spec;
    				});
    			}
    		}).then(function () {
    			component._spec.items = component._specs[specName];
    		}).then(function () {
    			return component.addOrganizers(component._specs[specName]);
    		}).then(function () {
    			return component.callOrganizers("afterSpecLoad", component._specs[specName]);
    		}).then(function () {
    			return component.trigger("afterSpecLoad", {"spec":component._specs[component._routeInfo["specName"]]});
    		});

    	};

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
    	RouteOrganizer._open = function _open (component, routeInfo, options)
    	{

    		options = Object.assign({}, options);
    		var pushState = BITSMIST.v1.Util.safeGet(options, "pushState", ( routeInfo ? true : false ));

    		// Current route info
    		var curRouteInfo = component._routeInfo;

    		var newUrl;
    		var newRouteInfo;
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

    		return Promise.resolve().then(function () {
    			// Replace URL
    			if (pushState)
    			{
    				history.pushState(RouteOrganizer.__getState("_open.pushState"), null, newUrl);
    			}
    			component._routeInfo = newRouteInfo;
    		}).then(function () {
    			// Load other component when new spec is different from the current spec
    			if (curRouteInfo["specName"] != newRouteInfo["specName"])
    			{
    				return RouteOrganizer._updateRoute(component, curRouteInfo, newRouteInfo, options);
    			}
    		}).then(function () {
    			// Validate URL
    			return RouteOrganizer._validateRoute(component, newUrl);
    		}).then(function () {
    			// Refresh
    			return RouteOrganizer._refreshRoute(component, newRouteInfo, options);
    		}).then(function () {
    			// Normalize URL
    			return RouteOrganizer._normalizeRoute(component, window.location.href);
    		});

    	};
    	// -----------------------------------------------------------------------------

    	/**
    	 * Jump to url.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Query options.
    	 */
    	RouteOrganizer._jumpRoute = function _jumpRoute (component, routeInfo, options)
    	{

    		var url = RouteOrganizer._buildUrl(component, routeInfo, options);
    		window.location.href = url;

    	};

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
    	RouteOrganizer._updateRoute = function _updateRoute (component, curRouteInfo, newRouteInfo, options)
    	{

    		return Promise.resolve().then(function () {
    			return component.changeState("routing");
    		}).then(function () {
    			return component.clearOrganizers("afterStart", component._specs[curRouteInfo["specName"]]);
    		}).then(function () {
    			return component.clearOrganizers("afterSpecLoad", component._specs[curRouteInfo["specName"]]);
    		}).then(function () {
    			return RouteOrganizer._switchSpec(component, newRouteInfo["specName"]);
    		}).then(function () {
    			// Started
    			return component._postStart();
    		});

    	};

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
    	RouteOrganizer._refreshRoute = function _refreshRoute (component, routeInfo, options)
    	{

    		return component.refresh();

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Replace current url.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Query options.
    	 */
    	RouteOrganizer._replaceRoute = function _replaceRoute (component, routeInfo, options)
    	{

    		history.replaceState(RouteOrganizer.__getState("replaceRoute", window.history.state), null, RouteOrganizer._buildUrl(component, routeInfo, options));
    		component._routeInfo = RouteOrganizer.__loadRouteInfo(component, window.location.href);

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Validate route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		url					Url to validate.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	RouteOrganizer._validateRoute = function _validateRoute (component, url)
    	{

    		component.validationResult["result"] = true;

    		return Promise.resolve().then(function () {
    			return component.trigger("beforeValidate");
    		}).then(function () {
    			// Validate URL (by organizers)
    			return component.callOrganizers("doCheckValidity", {
    				"item":				RouteOrganizer._loadParameters(url),
    				"validationName":	component.settings.get("settings.validationName")
    			});
    		}).then(function () {
    			// Fix URL
    			if (!component.validationResult["result"] && component.settings.get("settings.autoFixURL"))
    			{
    				return RouteOrganizer.__fixRoute(component, url);
    			}
    		}).then(function () {
    			return component.trigger("doValidateURL");
    		}).then(function () {
    			return component.trigger("afterValidate");
    		}).then(function () {
    			// Validation failed?
    			if (!component.validationResult["result"])
    			{
    				RouteOrganizer.__dumpValidationErrors(component);
    				throw new URIError("URL validation failed.");
    			}
    		});

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Normalize route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		url					Url to validate.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	RouteOrganizer._normalizeRoute = function _normalizeRoute (component, url)
    	{

    		return Promise.resolve().then(function () {
    			return component.trigger("beforeNormalizeURL");
    		}).then(function () {
    			return component.trigger("doNormalizeURL");
    		}).then(function () {
    			return component.trigger("afterNormalizeURL");
    		});

    	};

    	// -------------------------------------------------------------------------
    	//  Privates
    	// -------------------------------------------------------------------------

    	/**
    	 * Get settings from element's attribute.
    	 *
    	 * @param	{Component}		component			Component.
    	 */
    	RouteOrganizer.__loadAttrSettings = function __loadAttrSettings (component)
    	{

    		// Get spec path from  bm-specpath
    		var path = component.getAttribute("bm-specpath");
    		if (path)
    		{
    			component.settings.set("system.specPath", path);
    		}

    	};

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
    	RouteOrganizer.__loadSpec = function __loadSpec (component, specName, path)
    	{

    		var spec;
    //		let specCommon;
    		var promises = [];

    		console.debug(("RouteOrganizer._loadSpec(): Loading spec file. name=" + (component.name) + ", specName=" + specName + ", path=" + path));

    		// Load specs
    		var type = "js";
    		promises.push(component.loadSettingFile(specName, path, type));

    		return Promise.all(promises).then(function (result) {
    			spec = result[0];
    //			specCommon = result[0];
    //			spec = BITSMIST.v1.Util.deepMerge(specCommon, result[1]);

    			return spec;
    		});

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Get route info from the url.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		url					Url.
    	 *
    	 * @return  {Object}		Route info.
    	 */
    	RouteOrganizer.__loadRouteInfo = function __loadRouteInfo (component, url)
    	{

    		var routeInfo = {};
    		var routeName;
    		var parsedUrl = new URL(url, window.location.href);
    		var specName;
    		var params = {};

    		// Find a matching route
    		for (var i = component._routes.length - 1; i >= 0; i--)
    		{
    			// Check origin
    			if (component._routes[i]["origin"] && parsedUrl.origin != component._routes[i]["origin"])
    			{
    				continue;
    			}

    			// Check path
    			var result = ( !component._routes[i]["path"] ? [] : component._routes[i].re.exec(parsedUrl.pathname) );
    			if (result)
    			{
    				routeName = component._routes[i].name;
    				specName = ( component._routes[i].specName ? component._routes[i].specName : "" );
    				for (var j = 0; j < result.length - 1; j++)
    				{
    					params[component._routes[i].keys[j].name] = result[j + 1];
    					var keyName = component._routes[i].keys[j].name;
    					var value = result[j + 1];
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

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Init pop state handling.
    	 *
    	 * @param	{Component}		component			Component.
    	 */
    	RouteOrganizer.__initPopState = function __initPopState (component)
    	{

    		window.addEventListener("popstate", function (e) {
    			return Promise.resolve().then(function () {
    				return component.trigger("beforePopState");
    			}).then(function () {
    				return RouteOrganizer._open(component, {"url":window.location.href}, {"pushState":false});
    			}).then(function () {
    				return component.trigger("afterPopState");
    			});
    		});

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Return history state.
    	 *
    	 * @param	{String}		msg					Message to store in state.
    	 *
    	 * @return	{String}		State.
    	 */
    	RouteOrganizer.__getState = function __getState (msg, options)
    	{

    		var newState = {
    			"msg": msg,
    		};

    		if (options)
    		{
    			newState = Object.assign({}, options, newState);
    		}

    		return newState;

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Fix route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{String}		url					Url to validate.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	RouteOrganizer.__fixRoute = function __fixRoute (component, url)
    	{

    		var isOk = true;
    		var newParams = RouteOrganizer._loadParameters(url);

    		// Fix invalid paramters
    		Object.keys(component.validationResult["invalids"]).forEach(function (key) {
    			var item = component.validationResult["invalids"][key];

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

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Dump validation errors.
    	 *
    	 * @param	{Component}		component			Component.
    	 */
    	RouteOrganizer.__dumpValidationErrors = function __dumpValidationErrors (component)
    	{

    		Object.keys(component.validationResult["invalids"]).forEach(function (key) {
    			var item = component.validationResult["invalids"][key];

    			if (item.failed)
    			{
    				for (var i = 0; i < item.failed.length; i++)
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

    	};

    	return RouteOrganizer;
    }(BITSMIST.v1.Organizer));

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
    //  Methods
    // -----------------------------------------------------------------------------

    /**
     * Start component.
     *
     * @param	{Object}		settings			Settings.
     *
     * @return  {Promise}		Promise.
     */
    Router.prototype.start = function(settings)
    {
    	var this$1$1 = this;


    	// Defaults
    	var defaults = {
    		"settings": {
    			"name":						"Router",
    			"autoFixURL":				false,
    			"autoFetch":				false,
    			"autoSetup":				false,
    			"autoPostStart":			false,
    			"autoRefresh":				false,
    			"hasTemplate":				false,
    			"rootElement":				document.body,
    			"ignoreGlobalSuspend":		true,
    		},
    		"organizers": {
    			"AutoloadOrganizer":		{"settings":{"attach":false}},
    			"RouteOrganizer":			{"settings":{"attach":true}},
    			"ValidationOrganizer":		{"settings":{"attach":true}},
    		}
    	};
    	settings = ( settings ? BITSMIST.v1.Util.deepMerge(defaults, settings) : defaults);

    	return Promise.resolve().then(function () {
    		// super()
    		return BITSMIST.v1.Component.prototype.start.call(this$1$1, settings);
    	}).then(function () {
    		// Load spec file
    		return this$1$1.switchSpec(this$1$1.routeInfo["specName"]);
    	}).then(function () {
    		// Started
    		return this$1$1._postStart();
    	}).then(function () {
    		// Open route
    		return this$1$1.openRoute();
    	});

    };

    window.BITSMIST = window.BITSMIST || {};
    window.BITSMIST.v1 = window.BITSMIST.v1 || {};
    BITSMIST.v1.OrganizerOrganizer.register("RouteOrganizer", {"object":RouteOrganizer, "targetWords":"routes", "targetEvents":["beforeStart", "afterSpecLoad"], "order":900});
    window.BITSMIST.v1.Router = Router;

}());
//# sourceMappingURL=bitsmist-js-router_v1.js.map
