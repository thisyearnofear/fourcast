'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AutopilotRedirect() {
 const router = useRouter();

 useEffect(() => {
 router.replace('/labs/autopilot');
 }, [router]);

 return (
 <div className="w-screen h-screen flex items-center justify-center bg-black">
 <div className="flex flex-col items-center">
 <div className="w-8 h-8 border-3 border-current/30 border-t-current animate-spin text-white mb-3" />
 <p className="text-white/60 text-sm font-light">Redirecting to Labs...</p>
 </div>
 </div>
 );
}

// Legacy redirect — /autopilot moved to /labs/autopilot
