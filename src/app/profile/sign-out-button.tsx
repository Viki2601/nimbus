"use client";
import { signOut } from "next-auth/react";
import { useState } from "react";

/* Class strings kept identical to the original plain-CSS values. */
const SIGNOUT_WRAP = "border-t border-line pt-[18px]";
const SIGNOUT_BUTTON =
  "inline-flex min-h-[39px] cursor-pointer items-center gap-[9px] rounded-[11px] border border-[rgba(187,78,78,0.22)] bg-[rgba(255,247,247,0.86)] px-[13px] text-[11px] font-semibold text-[#9c4545] transition-[border-color,background,transform] duration-[140ms] ease hover:enabled:-translate-y-px hover:enabled:border-[rgba(187,78,78,0.42)] hover:enabled:bg-white disabled:cursor-progress disabled:opacity-65";
const SIGNOUT_SVG = "h-4 w-4";
const SIGNOUT_ERROR = "mt-[10px] mb-0 text-[10px] text-[#923d3d]";

export default function SignOutButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setError(null);
    try {
      await signOut({ redirectTo: "/login" });
    } catch (reason) {
      console.error("Could not sign out.", reason);
      setError("Sign out could not be completed. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className={SIGNOUT_WRAP}>
      <button
        className={SIGNOUT_BUTTON}
        type="button"
        onClick={handleSignOut}
        disabled={pending}
      >
        <svg
          className={SIGNOUT_SVG}
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
        <span>{pending ? "Signing out..." : "Sign out"}</span>
      </button>
      {error && (
        <p className={SIGNOUT_ERROR} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
