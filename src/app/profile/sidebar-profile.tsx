"use client";
import { getSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

type ProfileSummary = {
  name: string | null;
  email: string | null;
  avatar: string | null;
};

/* Class strings kept identical to the original plain-CSS values. */
const PROFILE_ROW =
  "group mt-[13px] flex w-full items-center gap-[10px] border-t border-line px-1 pt-[12px] pb-[2px] text-inherit no-underline transition-[background] duration-150 ease";
const PROFILE_AVATAR =
  "grid h-8 w-8 place-items-center rounded-full border border-[rgba(117,174,238,0.3)] bg-[linear-gradient(145deg,#e1efff,#c8e0fb)] text-[#164b82] text-[12px] font-[weight:650]";
const PROFILE_INFO = "min-w-0 flex-1";
const PROFILE_NAME =
  "block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold text-foreground";
const PROFILE_SUB = "mt-[3px] block text-[9px] text-muted";
const PROFILE_ARROW =
  "h-4 w-4 flex-none text-muted transition-[transform,color] duration-150 ease group-hover:translate-x-[2px] group-hover:text-accent";

export default function SidebarProfile() {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);

  useEffect(() => {
    let active = true;

    getSession()
      .then(async (session) => {
        if (!active || !session?.user) return;
        const account = {
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          avatar: session.user.image ?? null,
        };
        setProfile(account);

        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Profile settings could not be loaded.");
        }
        const data: unknown = await response.json();
        if (
          typeof data !== "object" ||
          data === null ||
          !("profile" in data) ||
          typeof data.profile !== "object" ||
          data.profile === null
        ) {
          throw new Error("The profile response was invalid.");
        }
        const savedProfile = data.profile;
        if (!active) return;
        setProfile({
          name:
            "preferredName" in savedProfile &&
            typeof savedProfile.preferredName === "string" &&
            savedProfile.preferredName
              ? savedProfile.preferredName
              : "fullName" in savedProfile &&
                  typeof savedProfile.fullName === "string" &&
                  savedProfile.fullName
                ? savedProfile.fullName
                : account.name,
          email: account.email,
          avatar:
            "avatar" in savedProfile && typeof savedProfile.avatar === "string"
              ? savedProfile.avatar
              : account.avatar,
        });
      })
      .catch((error: unknown) => {
        console.error("Could not load the signed-in profile.", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const displayName = profile?.name || profile?.email || "Your profile";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Link
      className={PROFILE_ROW}
      href="/profile"
      aria-label="Open your profile"
    >
      {profile?.avatar ? (
        // Avatar may be an inline upload or a Google-hosted image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={`${PROFILE_AVATAR} object-cover`}
          src={profile.avatar}
          alt=""
        />
      ) : (
        <span className={PROFILE_AVATAR}>{initial}</span>
      )}
      <span className={PROFILE_INFO}>
        <strong className={PROFILE_NAME}>{displayName}</strong>
        <span className={PROFILE_SUB}>
          {profile?.email || "Account profile"}
        </span>
      </span>
      <svg
        className={PROFILE_ARROW}
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}
