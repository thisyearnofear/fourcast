'use client';

export default function PageNav({ currentPage, isNight }) {
  const textColor = isNight ? 'text-white' : 'text-black';
  
  const pages = [
    { name: 'Weather', href: '/', label: '🌤️' },
    { name: 'AI', href: '/ai', label: '🤖' },
    { name: 'Discovery', href: '/discovery', label: '🔍' }
  ];
  
  const otherPages = pages.filter(page => page.name !== currentPage);

  return (
    <div className="flex items-center space-x-2">
      {otherPages.map(page => (
        <a
          key={page.name}
          href={page.href}
          className={`flex items-center space-x-2 px-3 py-2 ${textColor} opacity-80 hover:opacity-100 transition-opacity text-sm font-light`}
        >
          <span>{page.label}</span>
          <span>{page.name}</span>
        </a>
      ))}
    </div>
  );
}
