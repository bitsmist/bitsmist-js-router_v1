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

    	RouteOrganizer.globalInit = function globalInit ()
    	{

    		RouteOrganizer.__skipPopstate = false;

    		// Catch if this page is loaded to prevent safari from extra popstate handling.
    		// Safari fires popstate when navigate back from different document context.
    		var ua = window.navigator.userAgent.toLowerCase();
    		if (ua.indexOf('safari') > -1 && ua.indexOf('chrome') == -1)
    		{
    			window.addEventListener("DOMContentLoaded", function (e) {
    				RouteOrganizer.__skipPopstate = true;
    			});
    		}

    	};

    	// -------------------------------------------------------------------------

    	/**
    	 * Init.
    	 *
    	 * @param	{Object}		conditions			Conditions.
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		settings			Settings.
    	 *
    	 * @return 	{Promise}		Promise.
    	 */
    	RouteOrganizer.init = function init (conditions, component, settings)
    	{

    		// Add properties
    		Object.defineProperty(component, 'routeInfo', { get: function get() { return this._routeInfo; }, });
    		Object.defineProperty(component, 'specs', { get: function get() { return this._specs; }, });

    		// Add methods
    		component.loadParameters = function() { return RouteOrganizer._loadParameters(); };
    		component.openRoute = function(routeInfo, options) { return RouteOrganizer._open(this, routeInfo, options); };
    		component.replaceRoute = function(routeInfo, options) { return RouteOrganizer._replace(this, routeInfo, options); };
    		component.jumpRoute = function(routeInfo, options) { return RouteOrganizer._jump(this, routeInfo, options); };
    		component.refreshRoute = function(routeInfo, options) { return RouteOrganizer._refresh(this, routeInfo, options); };
    		component.updateRoute = function(routeInfo, options) { return RouteOrganizer._update(this, routeInfo, options); };

    		// Init vars
    		component._routes = [];
    		component._specs = {};

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

    		// Load route info
    		var routes = component.settings.get("routes");
    		if (routes)
    		{
    			for(var i = 0; i < routes.length; i++)
    			{
    				RouteOrganizer._addRoute(component, routes[i]);
    			}

    			component._routeInfo = RouteOrganizer.__loadRouteInfo(component, window.location.href);
    		}

    		// Load spec info
    		var specs = component.settings.get("specs");
    		if (specs)
    		{
    			Object.keys(specs).forEach(function (key) {
    				component._specs[key] = specs[key];
    			});
    		}

    		return settings;

    	};

    	// -------------------------------------------------------------------------
    	//  Protected
    	// -------------------------------------------------------------------------

    	/**
    	* Add a route.
    	*
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
    	* @param	{Object}		routeInfo			Route information.
    	* @param	{Object}		options				Query options.
    	*
    	* @return  {string}		Url.
    	*/
    	RouteOrganizer._buildUrl = function _buildUrl (routeInfo, component)
    	{

    		var url;

    		if (routeInfo["url"])
    		{
    			url = routeInfo["url"];
    		}
    		else
    		{
    			url  = ( routeInfo["path"] ? routeInfo["path"] : component._routeInfo["path"] );
    			url += ( routeInfo["query"] ? "?" + routeInfo["query"] : "" );
    			url += ( routeInfo["queryParameters"] ? RouteOrganizer._buildUrlQuery(routeInfo["queryParameters"]) : "" );
    		}

    		return url;

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
    	RouteOrganizer._loadParameters = function _loadParameters ()
    	{

    		var vars = {};
    		var hash;
    		var value;

    		if (window.location.href.indexOf("?") > -1)
    		{
    			var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

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

    	// -----------------------------------------------------------------------------

    	/**
    	 * Open route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Query options.
    	 */
    	RouteOrganizer._open = function _open (component, routeInfo, options)
    	{

    		options = Object.assign({}, options);
    		options["pushState"] = ( options["pushState"] !== undefined ? options["pushState"] : true );

    		var url = RouteOrganizer._buildUrl(routeInfo, component);
    		var curRouteInfo = Object.assign({}, component._routeInfo);
    		var newRouteInfo = RouteOrganizer.__loadRouteInfo(component, url);
    		component._routeInfo = newRouteInfo;

    		if (options["jump"] || !newRouteInfo["name"] || ( curRouteInfo["name"] != newRouteInfo["name"]) )
    		{
    			RouteOrganizer._jump(component, {"url":url});
    			return;
    		}

    		return Promise.resolve().then(function () {
    			if (options["pushState"])
    			{
    				history.pushState(RouteOrganizer.__getState("_open.pushState"), null, url);
    			}
    		}).then(function () {
    			if ( curRouteInfo["specName"] != newRouteInfo["specName"] )
    			{
    				// Load another component and open
    				return RouteOrganizer._update(component, newRouteInfo, options);
    			}
    			else
    			{
    				// Refresh current component
    				return RouteOrganizer._refresh(component, routeInfo, options);
    			}
    		}).then(function () {
    			if (routeInfo["dispUrl"])
    			{
    				// Replace url
    				history.replaceState(RouteOrganizer.__getState("_open.dispUrl", window.history.state), null, routeInfo["dispUrl"]);
    			}
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
    	RouteOrganizer._jump = function _jump (component, routeInfo)
    	{

    		var url = RouteOrganizer._buildUrl(routeInfo, component);
    		window.location.href = url;

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Refresh route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Query options.
    	 */
    	RouteOrganizer._refresh = function _refresh (component, routeInfo, options)
    	{

    		var componentName = component._routeInfo["componentName"];
    		if (component._components && component._components[componentName])
    		{
    			return component._components[componentName].refresh({"sender":component, "pushState":false});
    		}

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Update route.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Query options.
    	 */
    	RouteOrganizer._update = function _update (component, routeInfo, options)
    	{

    		return Promise.resolve().then(function () {
    			return component.clearOrganizers();
    		}).then(function () {
    			return RouteOrganizer.__initSpec(component, routeInfo["specName"]);
    		});

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Replace current url.
    	 *
    	 * @param	{Component}		component			Component.
    	 * @param	{Object}		routeInfo			Route information.
    	 * @param	{Object}		options				Query options.
    	 */
    	RouteOrganizer._replace = function _replace (component, routeInfo, options)
    	{

    		history.replaceState(RouteOrganizer.__getState("replaceRoute", window.history.state), null, RouteOrganizer._buildUrl(routeInfo, component));
    		component._routeInfo = RouteOrganizer.__loadRouteInfo(component, window.location.href);

    	};

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
    	RouteOrganizer.__initSpec = function __initSpec (component, specName)
    	{

    		if (specName && !component._specs[specName])
    		{
    			return Promise.resolve().then(function () {
    				if (!component._specs[specName])
    				{
    					return RouteOrganizer.__loadSpec(specName, component.settings.get("system.specPath")).then(function (spec) {						component._specs[specName] = spec;
    					});
    				}
    			}).then(function () {
    				return component.callOrganizers("afterSpecLoad", component._specs[specName]);
    			}).then(function () {
    				return component.trigger("afterSpecLoad", component, {"spec":component._specs[component._routeInfo["specName"]]});
    			});
    		}

    	};

    	// -----------------------------------------------------------------------------

    	/**
    	 * Load the spec file for this page.
    	 *
    	 * @param	{String}		specName			Spec name.
    	 * @param	{String}		path				Path to spec.
    	 *
    	 * @return  {Promise}		Promise.
    	 */
    	RouteOrganizer.__loadSpec = function __loadSpec (specName, path)
    	{

    //		let urlCommon = BITSMIST.v1.Util.concatPath([path, "common.js"]);
    		var url = BITSMIST.v1.Util.concatPath([path, specName + ".js"]);
    		var spec;
    //		let specCommon;
    //		let specMerged;
    		var promises = [];

    		console.debug(("RouteOrganizer._loadSpec(): Loading spec file. url=" + url));

    		// Load specs
    		//promises.push(BITSMIST.v1.AjaxUtil.ajaxRequest({"url":urlCommon, "method":"GET"}));
    		promises.push(BITSMIST.v1.AjaxUtil.ajaxRequest({"url":url, "method":"GET"}));

    		return Promise.all(promises).then(function (result) {
    			// Convert to json
    			try
    			{
    				console.debug(("RouteOrganizer.__loadSpec(): Loaded spec file. url=" + url));

    //				specCommon = JSON.parse(result[0]);
    //				spec = JSON.parse(result[1]);
    				spec = JSON.parse(result[0].responseText);
    			}
    			catch(e)
    			{
    				if (e instanceof SyntaxError)
    				{
    					//throw new SyntaxError(`Illegal json string. url=${(specCommon ? url : urlCommon)}`);
    					throw new SyntaxError(("Illegal json string. url=" + url + ", message=" + (e.message)));
    				}
    				else
    				{
    					throw e;
    				}
    			}
    //			specMerged = BITSMIST.v1.Util.deepMerge(specCommon, spec);

    			//return specMerged;

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
    		var componentName;
    		var params = {};

    		for (var i = component._routes.length - 1; i >= 0; i--)
    		{
    			// Check origin
    			if ( !component._routes[i]["origin"] || (component._routes[i]["origin"] && parsedUrl.origin == component._routes[i]["origin"]))
    			{
    				// Check path
    				var result = ( !component._routes[i]["path"] ? [] : component._routes[i].re.exec(parsedUrl.pathname));
    				if (result)
    				{
    					routeName = component._routes[i].name;
    					specName = ( component._routes[i].specName ? component._routes[i].specName : "" );
    					componentName = component._routes[i].componentName;
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
    		}

    		routeInfo["name"] = routeName;
    		routeInfo["specName"] = specName;
    		routeInfo["componentName"] = componentName;
    		routeInfo["url"] = parsedUrl["href"];
    		routeInfo["path"] = parsedUrl.pathname;
    		routeInfo["query"] = parsedUrl.search;
    		routeInfo["parsedUrl"] = parsedUrl;
    		routeInfo["routeParameters"] = params;
    		routeInfo["queryParameters"] = RouteOrganizer._loadParameters();

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

    		if (window.history && window.history.pushState){
    			window.addEventListener("popstate", function (e) {
    				if (RouteOrganizer.__skipPopstate)
    				{
    					console.warn("Skipping popstate handling since this page is loaded.");
    					RouteOrganizer.__skipPopstate = false;
    					return;
    				}

    				var promise;
    				var componentName = component._routeInfo["componentName"];
    				if (component._components && component._components[componentName])
    				{
    					promise = component._components[componentName].trigger("beforePopState", component);
    				}

    				return Promise.all([promise]).then(function () {
    					return RouteOrganizer._open(component, RouteOrganizer.__loadRouteInfo(component, window.location.href), {"pushState":false});
    				}).then(function () {
    					var componentName = component._routeInfo["componentName"];
    					if (component._components && component._components[componentName])
    					{
    						return component._components[componentName].trigger("afterPopState", component);
    					}
    				});
    			});
    		}

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
    	var this$1 = this;


    	// Defaults
    	var defaults = {
    		"settings": {
    			"name":			"Router",
    			"autoSetup":	false,
    			"rootElement":	"body",
    		},
    		"organizers": {
    			"RouteOrganizer": "",
    		}
    	};
    	settings = BITSMIST.v1.Util.deepMerge(defaults, settings);

    	// Start
    	return BITSMIST.v1.Component.prototype.start.call(this, settings).then(function () {
    		this$1.changeState("routing");

    		// Get settings from attributes
    		var path = this$1.getAttribute("data-specpath") || "";
    		if (path)
    		{
    			this$1._settings.set("system.specPath", path);
    		}

    		// Load spec file
    		return RouteOrganizer.__initSpec(this$1, this$1._routeInfo["specName"]).then(function () {
    			this$1.changeState("routed");
    		});
    	});

    };

    window.BITSMIST = window.BITSMIST || {};
    window.BITSMIST.v1 = window.BITSMIST.v1 || {};
    BITSMIST.v1.OrganizerOrganizer.organizers.set("RouteOrganizer", {"object":RouteOrganizer, "targetWords":"routes", "targetEvents":["beforeStart", "afterSpecLoad"], "order":300});
    BITSMIST.v1.OrganizerOrganizer.organizers.get("ComponentOrganizer")["targetEvents"].push("afterSpecLoad");
    window.BITSMIST.v1.Router = Router;

}());
//# sourceMappingURL=bitsmist-js-router_v1.js.map
