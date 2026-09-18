import { Redirect } from "expo-router";

// Any unmatched route (e.g. a stale deep link or a cold-start race on the
// standalone build) silently lands back on the app root instead of showing
// an expo-router "page not found" screen.
export default function NotFound() {
  return <Redirect href="/" />;
}
