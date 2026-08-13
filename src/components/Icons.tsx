import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
    </IconBase>
  );
}

export function PhoneOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m10.7 13.3-1.4 1.4a16 16 0 0 1-3-4.1" />
      <path d="M2 2l20 20" />
      <path d="M5.5 5.5A2 2 0 0 1 7.1 4h.3a2 2 0 0 1 2 1.7c.1.6.2 1.1.4 1.7" />
      <path d="M14.2 14.2a16 16 0 0 0 3.8 2.3l1.3-1.3a2 2 0 0 1 2.1-.4l.6.2" />
      <path d="M22 17v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2" />
    </IconBase>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </IconBase>
  );
}

export function MicOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 5v5a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.6-1.5" />
      <path d="M5 10a7 7 0 0 0 11.7 5.2M19 10c0 1.3-.4 2.5-1 3.5M12 17v5M8 22h8M2 2l20 20" />
    </IconBase>
  );
}

export function VolumeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
    </IconBase>
  );
}

export function VolumeOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5ZM22 9l-6 6M16 9l6 6" />
    </IconBase>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m15 18-6-6 6-6" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </IconBase>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </IconBase>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v7c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12v7c0 1.7 4 3 9 3s9-1.3 9-3v-7" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconBase>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </IconBase>
  );
}
