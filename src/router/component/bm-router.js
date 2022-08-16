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
