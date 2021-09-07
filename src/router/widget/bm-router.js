// =============================================================================
/**
 * BitsmistJS - Javascript Web Client Framework
 *
 * @copyright		Masaki Yasutake
 * @link			https://bitsmist.com/
 * @license			https://github.com/bitsmist/bitsmist/blob/master/LICENSE
 */
// =============================================================================

import RouteOrganizer from "../organizer/route-organizer.js";

// =============================================================================
//	Router class
// =============================================================================

// -----------------------------------------------------------------------------
//  Constructor
// -----------------------------------------------------------------------------

/**
 * Constructor.
 */
export default function Router()
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

	// Defaults
	let defaults = {
		"settings": {
			"name":						"Router",
			"autoSetup":				false,
			"autoPostStart":			false,
			"rootElement":				document.body,
		},
		"events": {
			"this": {
				"handlers": {
					"afterPopState": 	"onAfterPopState",
					"doValidateURL": 	"onDoValidateURL",
					"doNormalizeURL": 	"onDoNormalizeURL",
					"doRefresh": 		"onDoRefresh"
				}
			}
		},
		"organizers": {
			"RouteOrganizer":			{"settings":{"attach":true}},
		}
	};
	settings = ( settings ? BITSMIST.v1.Util.deepMerge(defaults, settings) : defaults);

	return Promise.resolve().then(() => {
		// super()
		return BITSMIST.v1.Component.prototype.start.call(this, settings);
	}).then(() => {
		// Started
		return this._postStart();
	}).then(() => {
		// Load spec file
		return RouteOrganizer.__initSpec(this, this._routeInfo["specName"]);
	}).then(() => {
		// Open route
		return this.openRoute({"url":window.location.href}, {"pushState":false});
	});

}

// Need to override
Router.prototype.onAfterPopState = function() {};
Router.prototype.onDoValidateURL = function() {};
Router.prototype.onDoNormalizeURL = function() {};
Router.prototype.onDoRefresh = function() {};
