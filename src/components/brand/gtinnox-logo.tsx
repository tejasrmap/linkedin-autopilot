import React from 'react';

interface GTInnoXLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export function GTInnoXLogo({ className = 'w-9 h-9', size, showWordmark = false }: GTInnoXLogoProps) {
  if (showWordmark) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <svg
          viewBox="0 0 100 100"
          className="w-9 h-9 flex-shrink-0"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="gtGrad_wm" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5FF" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <linearGradient id="shieldGrad_wm" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E1B4B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
            </linearGradient>
            <filter id="neonGlow_wm" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <polygon
            points="50,4 92,26 92,74 50,96 8,74 8,26"
            fill="url(#shieldGrad_wm)"
            stroke="url(#gtGrad_wm)"
            strokeWidth="4"
            filter="url(#neonGlow_wm)"
          />
          <polygon
            points="50,9 87,28 87,72 50,91 13,72 13,28"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
            strokeDasharray="4,3"
          />
          <path
            d="M 52 26 C 36 26 26 36 26 50 C 26 64 36 74 52 74 C 62 74 68 70 71 63 L 71 52 L 48 52 L 48 44 L 79 44 L 79 66 C 72 77 62 81 50 81 C 30 81 18 68 18 50 C 18 32 30 19 51 19 C 62 19 70 23 76 29 L 70 35 C 65 30 59 26 52 26 Z"
            fill="url(#gtGrad_wm)"
          />
          <path
            d="M 40 33 L 78 33 L 78 40 L 63 40 L 63 67 L 55 67 L 55 40 L 40 40 Z"
            fill="#FFFFFF"
            opacity="0.95"
          />
          <circle cx="78" cy="22" r="3.5" fill="#00F5FF" filter="url(#neonGlow_wm)" />
        </svg>
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline gap-1 font-black tracking-tight text-slate-900 dark:text-white">
            <span className="bg-gradient-to-r from-[#00F5FF] via-[#6366F1] to-[#EC4899] bg-clip-text text-transparent">GT</span>
            <span className="tracking-wider">INNOX</span>
          </div>
          <span className="text-[9px] font-semibold tracking-widest text-[#00F5FF] uppercase">LLP</span>
        </div>
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GT InnoX Logo"
    >
      <defs>
        <linearGradient id="gtGrad_icon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F5FF" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="shieldGrad_icon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E1B4B" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
        </linearGradient>
        <filter id="neonGlow_icon" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Hexagonal Glow Shield */}
      <polygon
        points="50,4 92,26 92,74 50,96 8,74 8,26"
        fill="url(#shieldGrad_icon)"
        stroke="url(#gtGrad_icon)"
        strokeWidth="4"
        filter="url(#neonGlow_icon)"
      />
      {/* Circuit dashed border */}
      <polygon
        points="50,9 87,28 87,72 50,91 13,72 13,28"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.5"
        strokeDasharray="4,3"
      />
      {/* Stylized Geometric G */}
      <path
        d="M 52 26 C 36 26 26 36 26 50 C 26 64 36 74 52 74 C 62 74 68 70 71 63 L 71 52 L 48 52 L 48 44 L 79 44 L 79 66 C 72 77 62 81 50 81 C 30 81 18 68 18 50 C 18 32 30 19 51 19 C 62 19 70 23 76 29 L 70 35 C 65 30 59 26 52 26 Z"
        fill="url(#gtGrad_icon)"
      />
      {/* Stylized Spark T */}
      <path
        d="M 40 33 L 78 33 L 78 40 L 63 40 L 63 67 L 55 67 L 55 40 L 40 40 Z"
        fill="#FFFFFF"
        opacity="0.95"
      />
      {/* Spark node */}
      <circle cx="78" cy="22" r="3.5" fill="#00F5FF" filter="url(#neonGlow_icon)" />
    </svg>
  );
}

