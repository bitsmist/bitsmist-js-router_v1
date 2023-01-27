import BM from "./bm";

// Organizer

import RouteOrganizer from "./organizer/route-organizer";
window.BITSMIST.v1.RouteOrganizer = RouteOrganizer;
BM.OrganizerOrganizer.register(RouteOrganizer);

// Component

import Router from "./component/bm-router";
window.BITSMIST.v1.Router = Router;
