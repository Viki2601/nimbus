"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

/* Class strings kept identical to the original plain-CSS values. */
const GOOGLE_BUTTON =
  "flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-[11px] rounded-xl border border-[rgba(38,71,116,0.17)] bg-[rgba(255,255,255,0.9)] px-[14px] text-[12px] font-[weight:620] text-[#1c2a3e] transition-[transform,border-color,box-shadow] duration-150 ease hover:enabled:-translate-y-px hover:enabled:border-[rgba(40,127,223,0.35)] hover:enabled:shadow-[0_7px_22px_rgba(57,104,159,0.12)] disabled:cursor-progress disabled:opacity-[0.68]";
const GOOGLE_ARROW = "ml-auto h-[15px] w-[15px] text-muted";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.7 9.5 24 9.5Z"
        transform="translate(0 6)"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.1 11.1 0 0 1-4.8 7.28l7.73 6C44.38 38.05 46.98 31.9 46.98 24.55Z"
        transform="translate(0 0)"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z"
        transform="translate(0 6)"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.3 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
        transform="translate(0 0)"
      />
    </svg>
  );
}

export default function GoogleLoginButton() {
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setPending(true);
    try {
      await signIn("google", { redirectTo: "/" });
    } catch (error) {
      console.error("Google sign-in could not be started.", error);
      setPending(false);
    }
  }

  return (
    <button
      className={GOOGLE_BUTTON}
      type="button"
      onClick={handleSignIn}
      disabled={pending}
    >
      <GoogleMark />
      <span>
        {pending ? "Connecting to Google..." : "Continue with Google"}
      </span>
      <svg
        className={GOOGLE_ARROW}
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </svg>
    </button>
  );
}
