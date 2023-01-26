window.BITSMIST = window.BITSMIST || {};
window.BITSMIST.v1 = window.BITSMIST.v1 || {};

// Organizer

import RouteOrganizer from './organizer/route-organizer';
window.BITSMIST.v1.RouteOrganizer = RouteOrganizer;
BITSMIST.v1.OrganizerOrganizer.register(window.BITSMIST.v1.RouteOrganizer);

// Component

import Router from "./component/bm-router";
window.BITSMIST.v1.Router = Router;
