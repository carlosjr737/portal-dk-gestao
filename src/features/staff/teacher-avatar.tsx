"use client";

import { useState } from "react";
import { getTeacherInitials, getTeacherPhotoUrl } from "@/features/staff/teacher-photo";

type TeacherAvatarProps = {
  name: string;
  photoPath?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

export function TeacherAvatar({
  name,
  photoPath,
  size = "md",
}: TeacherAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const photoUrl = imageFailed ? null : getTeacherPhotoUrl(photoPath);
  const initials = getTeacherInitials(name);

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full border border-border object-cover`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${sizeClasses[size]} inline-flex shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 font-bold text-primary`}
      aria-label={name}
    >
      {initials}
    </span>
  );
}
