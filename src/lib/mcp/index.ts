import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMySalons from "./tools/list-my-salons";
import listBookings from "./tools/list-bookings";
import listServices from "./tools/list-services";
import listBarbers from "./tools/list-barbers";
import createBooking from "./tools/create-booking";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "snipshop-mcp",
  title: "SnipShop MCP",
  version: "0.1.0",
  instructions:
    "Tools for salon owners on SnipShop. Read your salons, services, barbers, and bookings, and create walk-in bookings. All calls act as the signed-in salon owner.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMySalons, listServices, listBarbers, listBookings, createBooking],
});
