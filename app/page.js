import WeatherPage from './WeatherPage';

export async function generateMetadata() {
  const frameMetadata = {
    "fc:frame": "vNext",
    "fc:frame:image": `${process.env.NEXT_PUBLIC_HOST}/logo.png`,
    "og:image": `${process.env.NEXT_PUBLIC_HOST}/logo.png`,
    "fc:frame:post_url": `${process.env.NEXT_PUBLIC_HOST}/api/weather`,
    "fc:frame:button:1": "Get Forecast",
  };

  return {
    title: "Fourcast",
    description: "A decentralized weather application.",
    other: frameMetadata,
  };
}

export default function HomePage() {
  return <WeatherPage />;
}
