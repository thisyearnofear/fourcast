import { redirect } from 'next/navigation';

// Legacy redirect — /autopilot moved to /labs/autopilot
export default function AutopilotRedirect() {
  redirect('/labs/autopilot');
}
