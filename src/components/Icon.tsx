const PATHS: Record<string, string> = {
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  prev: 'M18 5v14l-9-7zM6 5h2v14H6z',
  next: 'M6 5v14l9-7zM16 5h2v14h-2z',
  prevSection: 'M20 5v14l-7-7zM12 5v14l-7-7zM3 5h2v14H3z',
  nextSection: 'M4 5v14l7-7zM12 5v14l7-7zM19 5h2v14h-2z',
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z',
  captions: 'M3 5h18v14H3zM6 10.5h4M6 14h7M13 10.5h5M15 14h3',
  book: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 0 6.5 22H20',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  compare: 'M12 3v18M4 6h5M4 10h5M4 14h5M15 6h5M15 10h5M15 14h3',
  help: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 17.5h.01',
  close: 'M6 6l12 12M18 6L6 18',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  speaker: 'M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ear: 'M7 9a5 5 0 0 1 10 0c0 3-3 3.5-3 6.5a3 3 0 0 1-6 0M10 9a2 2 0 0 1 4 0',
  focus: 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M9 12h6',
  wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10',
  wave: 'M2 12h2M6 8v8M10 5v14M14 8v8M18 10v4M22 12h0',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  menu: 'M4 6h16M4 12h16M4 18h16',
  check: 'M4 12l5 5L20 6',
  lang: 'M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 4-3 8-7 9M13 21l4-9 4 9M14.5 18h5',
};

export function Icon({ name, label }: { name: keyof typeof PATHS | string; label?: string }) {
  const filled = ['play', 'pause', 'prev', 'next', 'prevSection', 'nextSection', 'mic'].includes(name);
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
