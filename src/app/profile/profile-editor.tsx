"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import SignOutButton from "./sign-out-button";

type Profile = {
  fullName: string;
  preferredName: string;
  occupation: string;
  instructions: string;
  avatar: string | null;
};

type ProfileEditorProps = {
  initialName: string;
  email: string;
  googleAvatar: string | null;
};

const EMPTY_PROFILE: Profile = {
  fullName: "",
  preferredName: "",
  occupation: "",
  instructions: "",
  avatar: null,
};
const SECTION =
  "border-t border-line pt-[22px] [&:first-child]:border-0 [&:first-child]:pt-0";
const SECTION_TITLE = "m-0 text-[14px] font-semibold text-foreground";
const SECTION_DESCRIPTION = "mt-[5px] mb-[16px] text-[11px] leading-[1.6] text-muted";
const FIELD = "grid gap-[7px]";
const LABEL = "text-[11px] font-semibold text-foreground";
const INPUT =
  "min-h-[42px] w-full rounded-[10px] border border-line bg-[rgba(255,255,255,0.8)] px-[12px] text-[12px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const TEXTAREA =
  "min-h-[116px] w-full resize-y rounded-[10px] border border-line bg-[rgba(255,255,255,0.8)] px-[12px] py-[10px] text-[12px] leading-[1.6] text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const HELP = "m-0 text-[10px] leading-[1.5] text-muted";
const BUTTON =
  "inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-[10px] border border-line bg-[rgba(255,255,255,0.72)] px-[13px] text-[11px] font-semibold text-foreground transition-[background,border-color] hover:enabled:border-[rgba(40,127,223,0.35)] hover:enabled:bg-white disabled:cursor-progress disabled:opacity-60";

function getErrorMessage(value: unknown, fallback: string) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

export default function ProfileEditor({
  initialName,
  email,
  googleAvatar,
}: ProfileEditorProps) {
  const [profile, setProfile] = useState<Profile>({
    ...EMPTY_PROFILE,
    fullName: initialName,
  });
  const [loaded, setLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok) {
          throw new Error(getErrorMessage(data, "Could not load your profile."));
        }
        if (
          typeof data !== "object" ||
          data === null ||
          !("profile" in data) ||
          typeof data.profile !== "object" ||
          data.profile === null
        ) {
          throw new Error("The profile response was invalid.");
        }
        const value = data.profile;
        if (!active) return;
        setProfile({
          fullName:
            "fullName" in value && typeof value.fullName === "string"
            ? value.fullName
              : initialName,
          preferredName:
            "preferredName" in value && typeof value.preferredName === "string"
              ? value.preferredName
              : "",
          occupation:
            "occupation" in value && typeof value.occupation === "string"
              ? value.occupation
              : "",
          instructions:
            "instructions" in value && typeof value.instructions === "string"
              ? value.instructions
              : "",
          avatar:
            "avatar" in value && typeof value.avatar === "string"
              ? value.avatar
              : null,
        });
        setLoadingError(null);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Could not load profile settings.", error);
        setLoadingError(
          error instanceof Error
            ? error.message
            : "Could not load your saved profile.",
        );
      });

    return () => {
      active = false;
    };
  }, [initialName]);

  function updateField(key: keyof Omit<Profile, "avatar">, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setAvatarError(null);
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 512 * 1024) {
      setAvatarError("Choose an image smaller than 512 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setAvatarError("This image could not be read.");
        return;
      }
      setProfile((current) => ({ ...current, avatar: reader.result }));
      setSaved(false);
    };
    reader.onerror = () => setAvatarError("This image could not be read.");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Your profile could not be saved."));
      }
      setSaved(true);
    } catch (error) {
      console.error("Could not save profile settings.", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Your profile could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const avatar = profile.avatar || googleAvatar;
  const initials = (profile.preferredName || profile.fullName || initialName)
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="grid gap-[26px]">
      <div className="flex items-center gap-[14px] rounded-[15px] border border-line bg-[rgba(243,248,255,0.76)] p-[15px]">
        {avatar ? (
          // Avatar may be an inline upload or a Google-hosted image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="h-[54px] w-[54px] flex-none rounded-full border border-line object-cover"
            src={avatar}
            alt=""
          />
        ) : (
          <span
            className="grid h-[54px] w-[54px] flex-none place-items-center rounded-full border border-[rgba(117,174,238,0.3)] bg-[linear-gradient(145deg,#e1efff,#c8e0fb)] text-[18px] font-semibold text-[#164b82]"
            aria-hidden="true"
          >
            {initials || "N"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-foreground">
            {profile.preferredName || profile.fullName || initialName}
          </strong>
          <span className="mt-1 block text-[10px] text-muted">
            Signed in with Google
          </span>
        </div>
        <span className="inline-flex items-center gap-[6px] text-[10px] text-[#328661]">
          <i className="h-[6px] w-[6px] rounded-full bg-[#49bd8b]" />
          Connected
        </span>
      </div>

      {loadingError && (
        <div className="rounded-[10px] border border-[#e7b6b6] bg-[#fff7f7] p-[12px] text-[11px] text-[#923d3d]" role="alert">
          <p className="m-0">{loadingError}</p>
          <button
            className={`${BUTTON} mt-[10px]`}
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload profile
          </button>
        </div>
      )}

      <form className="grid gap-[24px]" onSubmit={handleSubmit}>
        <section className={SECTION} aria-labelledby="profile-details-title">
          <h2 className={SECTION_TITLE} id="profile-details-title">
            Profile
          </h2>
          <p className={SECTION_DESCRIPTION}>
            Personalize how you appear and how Nimbot addresses you.
          </p>

          <div className="mb-[17px] flex items-center justify-between gap-4">
            <div className="grid gap-[4px]">
              <span className={LABEL}>Profile photo</span>
              <span className={HELP}>PNG, JPEG, or WebP, up to 512 KB.</span>
            </div>
            <div className="flex flex-none gap-2">
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                aria-label="Choose profile photo"
              />
              <button
                className={BUTTON}
                type="button"
                onClick={() => fileInput.current?.click()}
              >
                Upload
              </button>
              {profile.avatar && (
                <button
                  className={BUTTON}
                  type="button"
                  onClick={() => {
                    setProfile((current) => ({ ...current, avatar: null }));
                    setSaved(false);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {avatarError && (
            <p className="mb-[14px] text-[10px] text-[#923d3d]" role="alert">
              {avatarError}
            </p>
          )}

          <div className="grid gap-[15px]">
            <label className={FIELD}>
              <span className={LABEL}>Full name</span>
              <input
                className={INPUT}
                autoComplete="name"
                maxLength={80}
                value={profile.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder="Your name"
              />
            </label>
            <label className={FIELD}>
              <span className={LABEL}>What should Nimbot call you?</span>
              <input
                className={INPUT}
                autoComplete="nickname"
                maxLength={40}
                value={profile.preferredName}
                onChange={(event) =>
                  updateField("preferredName", event.target.value)
                }
                placeholder="Your preferred name"
              />
            </label>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="personalization-title">
          <h2 className={SECTION_TITLE} id="personalization-title">
            Personalization
          </h2>
          <p className={SECTION_DESCRIPTION}>
            Add context that helps Nimbot tailor answers to you.
          </p>
          <div className="grid gap-[15px]">
            <label className={FIELD}>
              <span className={LABEL}>What best describes your work?</span>
              <input
                className={INPUT}
                maxLength={120}
                value={profile.occupation}
                onChange={(event) => updateField("occupation", event.target.value)}
                placeholder="e.g. Product designer, student, developer"
              />
            </label>
            <label className={FIELD}>
              <span className={LABEL}>Instructions for Nimbot</span>
              <span className={HELP}>
                Preferences for tone, format, or level of detail. These are
                considered in future chats.
              </span>
              <textarea
                className={TEXTAREA}
                maxLength={1500}
                value={profile.instructions}
                onChange={(event) =>
                  updateField("instructions", event.target.value)
                }
                placeholder="e.g. Keep explanations concise and include practical examples."
              />
              <span className={`${HELP} text-right`}>
                {profile.instructions.length}/1500
              </span>
            </label>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="account-title">
          <h2 className={SECTION_TITLE} id="account-title">
            Account
          </h2>
          <p className={SECTION_DESCRIPTION}>
            Your sign-in details are managed by Google.
          </p>
          <div className="grid gap-0 rounded-[12px] border border-line bg-[rgba(255,255,255,0.54)] px-[13px] [&>div+div]:border-t [&>div+div]:border-line">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-[12px] py-[12px]">
              <span className="text-[10px] text-muted">Email address</span>
              <span className="break-all text-[10px] font-medium text-foreground">
                {email || "Not provided"}
              </span>
            </div>
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-[12px] py-[12px]">
              <span className="text-[10px] text-muted">Sign-in method</span>
              <span className="text-[10px] font-medium text-foreground">
                Google
              </span>
            </div>
          </div>
        </section>

        {(saveError || saved) && (
          <p
            className={`m-0 text-[11px] ${saveError ? "text-[#923d3d]" : "text-[#328661]"}`}
            role={saveError ? "alert" : "status"}
            aria-live="polite"
          >
            {saveError || "Your profile has been saved."}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-[18px]">
          <SignOutButton />
          <button
            className="inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-[10px] border border-accent bg-accent px-[17px] text-[11px] font-semibold text-white transition-colors hover:enabled:bg-accent-dark disabled:cursor-progress disabled:opacity-60"
            type="submit"
            disabled={!loaded || saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
