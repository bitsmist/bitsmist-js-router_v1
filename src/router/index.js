window.BITSMIST = window.BITSMIST || {};
window.BITSMIST.v1 = window.BITSMIST.v1 || {};

// Organizer

import RouteOrganizer from './organizer/route-organizer';
BITSMIST.v1.OrganizerOrganizer.organizers.set("RouteOrganizer", {"object":RouteOrganizer, "targetWords":"routes", "targetEvents":["beforeStart", "afterSpecLoad"], "order":4100});

// Widget

import Router from "./widget/bm-router";
window.BITSMIST.v1.Router = Router;

// Add new target events to organizers
BITSMIST.v1.OrganizerOrganizer.organizers.get("EventOrganizer")["targetEvents"].push("afterSpecLoad");
BITSMIST.v1.OrganizerOrganizer.organizers.get("ComponentOrganizer")["targetEvents"].push("afterSpecLoad");


