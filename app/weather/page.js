import { redirect } from 'next/navigation';

// Legacy redirect — /weather moved to /labs/weather
export default function WeatherRedirect() {
  redirect('/labs/weather');
}
