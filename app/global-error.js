'use client';

import { BRAND_HEX } from '@/constants/brandColors';

// Global Error - MUST be self-contained (own html/body) for Next.js 16
// Cannot use root layout or any provider context — so it uses the sRGB
// equivalents of the tokens from constants/brandColors, same palette.

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error - Fourcast</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: ${BRAND_HEX.paperDeep};
            color: ${BRAND_HEX.ink};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }
          .container { text-align: center; max-width: 400px; }
          h1 { font-size: 1.5rem; font-weight: 300; margin-bottom: 1rem; }
          p { opacity: 0.7; margin-bottom: 2rem; font-size: 0.875rem; line-height: 1.5; }
          button {
            padding: 0.75rem 1.5rem;
            background: rgba(99,240,168,0.1);
            border: 1px solid rgba(99,240,168,0.35);
            border-radius: 0;
            color: ${BRAND_HEX.accent};
            cursor: pointer;
            font-size: 0.875rem;
            transition: background 0.2s;
          }
          button:hover { background: rgba(99,240,168,0.18); }
        `}} />
      </head>
      <body>
        <div className="container">
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please try again.</p>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
