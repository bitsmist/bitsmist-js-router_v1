window.BITSMIST = window.BITSMIST || {};
window.BITSMIST.v1 = window.BITSMIST.v1 || {};

// Organizer

import RouteOrganizer from './organizer/route-organizer';
BITSMIST.v1.OrganizerOrganizer.organizers.set("RouteOrganizer", {"object":RouteOrganizer, "targetWords":"routes", "targetEvents":["beforeStart", "afterSpecLoad"], "order":255});

// Router

import Router from './router';
window.BITSMIST.v1.Router = Router;