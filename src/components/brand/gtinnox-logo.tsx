'use client';

import React from 'react';
import Image from 'next/image';

interface GTInnoXLogoProps {
  className?: string;
  size?: number;
  width?: number;
  height?: number;
  variant?: 'image' | 'vector';
  showWordmark?: boolean;
}

/**
 * Official GT InnoX "+G" Brand Logo Component
 */
export function GTInnoXLogo({
  className = '',
  size = 32,
  width,
  height,
  variant = 'image',
  showWordmark = false,
}: GTInnoXLogoProps) {
  const resolvedWidth = width || size || 32;
  const resolvedHeight = height || (width ? Math.round(width * 0.6) : size ? Math.round(size * 0.6) : 20);

  if (variant === 'vector') {
    return (
      <svg
        viewBox="0 0 200 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ width: resolvedWidth, height: resolvedHeight }}
        aria-label="GT InnoX Logo"
      >
        {/* Navy Plus Symbol */}
        <path
          d="M20 52H45V27H59V52H84V66H59V91H45V66H20V52Z"
          className="fill-[#0c2a75] dark:fill-[#5b8def]"
        />
        {/* Top-Left Cyan Diamond */}
        <polygon
          points="32,23 42,33 32,43 22,33"
          fill="#1ba4df"
        />
        {/* Top-Right Purple Diamond */}
        <polygon
          points="72,23 82,33 72,43 62,33"
          fill="#9b4bc0"
        />
        {/* Bottom-Left Purple Diamond */}
        <polygon
          points="32,75 42,85 32,95 22,85"
          fill="#9b4bc0"
        />
        {/* Bottom-Right Cyan Diamond */}
        <polygon
          points="72,75 82,85 72,95 62,85"
          fill="#1ba4df"
        />
        {/* Navy Capital G */}
        <path
          d="M174 38.5L158.5 50C154.5 44 147.5 40 138 40C123 40 111.5 51 111.5 66.5C111.5 82 123 93 138 93C151 93 159 86 161 74H137V60H179V83.5C170.5 99 155.5 107 137.5 107C113 107 94 89 94 66.5C94 44 113 26 138 26C153 26 165.5 31 174 38.5Z"
          className="fill-[#0c2a75] dark:fill-[#5b8def]"
        />
      </svg>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden ${className}`}
      style={{ width: resolvedWidth, height: resolvedHeight }}
    >
      <Image
        src="/brand-logo.png"
        alt="GT InnoX"
        width={resolvedWidth * 2}
        height={resolvedHeight * 2}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        priority
      />
    </div>
  );
}
