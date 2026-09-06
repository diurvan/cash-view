"use client";

import { brand, appName } from "@/lib/brand";

type LogoProps = {
  withText?: boolean;
  size?: number;
  className?: string;
};

export function Logo({ withText = true, size = 28, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {withText && (
        <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          cash<span style={{ color: brand.primary }}>view</span>
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="23" stroke={brand.primary} strokeOpacity="0.2" strokeWidth="2" />
      <circle cx="24" cy="26" r="10.5" fill={brand.primary} />
      <circle cx="24" cy="26" r="7" fill={brand.onPrimary} />
      <circle cx="18.5" cy="15.5" r="4.2" fill={brand.primary} />
      <circle cx="31" cy="13.5" r="3.2" fill={brand.primary} fillOpacity="0.55" />
    </svg>
  );
}

export { appName };
