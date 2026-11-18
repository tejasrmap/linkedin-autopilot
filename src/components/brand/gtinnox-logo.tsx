import Image from 'next/image';

interface GTInnoXLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

/**
 * Shared GT InnoX brand asset. Keep the icon and wordmark sourced from the
 * public brand files so the sidebar and auth screens stay visually consistent.
 */
export function GTInnoXLogo({ className, size, showWordmark = false }: GTInnoXLogoProps) {
  const wordmark = showWordmark;
  const width = wordmark ? 520 : 100;
  const height = wordmark ? 120 : 100;

  return (
    <Image
      src={wordmark ? '/gtinnox-logo.svg' : '/gtinnox-icon.svg'}
      alt={wordmark ? 'GT InnoX LLP' : 'GT InnoX'}
      width={width}
      height={height}
      className={className || (wordmark ? 'h-9 w-auto' : 'h-9 w-9')}
      style={size ? { width: size, height: size } : undefined}
      unoptimized
    />
  );
}
