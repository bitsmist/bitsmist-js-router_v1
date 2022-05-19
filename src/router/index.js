window.BITSMIST = window.BITSMIST || {};
window.BITSMIST.v1 = window.BITSMIST.v1 || {};

// Organizer

import RouteOrganizer from './organizer/route-organizer';
BITSMIST.v1.OrganizerOrganizer.register("RouteOrganizer", {"object":RouteOrganizer, "targetWords":"routes", "targetEvents":["beforeStart", "afterSpecLoad"], "order":900});

// Component

import Router from "./component/bm-router";
window.BITSMIST.v1.Router = Router;
