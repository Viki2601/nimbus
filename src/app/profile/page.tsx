import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import ProfileEditor from "./profile-editor";

/* Class strings kept identical to the original plain-CSS values. */
const PROFILE_PAGE = "relative grid min-h-dvh place-items-center overflow-hidden px-[18px] py-[30px] bg-[radial-gradient(ellipse_at_50%_12%,rgba(91,158,231,0.15),transparent_36%),var(--background)] [@media(max-width:420px)]:px-3 [@media(max-width:420px)]:py-[14px]";
const PROFILE_ORB = "pointer-events-none absolute aspect-square w-[380px] rounded-full border border-[rgba(78,144,218,0.1)] bg-[radial-gradient(circle,rgba(105,173,246,0.09),transparent_68%)]";
const PROFILE_CARD = "relative z-[1] my-auto max-h-[650px] overflow-y-auto hide-scrollbar w-[min(100%,760px)] border border-[rgba(255,255,255,0.84)] rounded-[25px] bg-[rgba(255,255,255,0.72)] p-[clamp(24px,5vw,42px)] shadow-[0_30px_90px_rgba(52,89,136,0.15),inset_0_1px_rgba(255,255,255,0.9)] backdrop-blur-[28px] [@media(max-width:420px)]:px-[18px] [@media(max-width:420px)]:py-[24px] [@media(max-width:420px)]:rounded-[21px]";
const PROFILE_BACK_LINK = "inline-flex items-center gap-[7px] text-[11px] text-muted no-underline transition-[color] duration-[140ms] ease hover:text-accent [&_svg]:h-4 [&_svg]:w-4";
const PROFILE_HEADING = "mt-[35px] mb-[24px] font-[family-name:var(--font-display)] tracking-widest [@media(max-width:420px)]:mt-[28px]";
const PROFILE_KICKER = "text-[9px] font-black text-accent";
const PROFILE_H1 = "mt-[9px] mb-[7px] text-[length:clamp(30px,6vw,39px)] font-bold text-foreground";
const PROFILE_HEADING_P = "mt-0 mb-0 text-[11px] text-muted";
async function ProfileContent() {
  const session = await auth();
  const user = session?.user;

  if (!user) redirect("/login");

  return (
    <main className={PROFILE_PAGE}>
      <div className={`${PROFILE_ORB} top-[-250px] right-[-120px]`} aria-hidden="true" />
      <div className={`${PROFILE_ORB} bottom-[-270px] left-[-150px] w-[460px]`} aria-hidden="true" />

      <section className={PROFILE_CARD} aria-labelledby="profile-title">
        <Link className={PROFILE_BACK_LINK} href="/">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to chat
        </Link>

        <div className={PROFILE_HEADING}>
          <span className={PROFILE_KICKER}>ACCOUNT</span>
          <h1 className={PROFILE_H1} id="profile-title">Your profile</h1>
          <p className={PROFILE_HEADING_P}>Manage your account details and personalize Nimbot.</p>
        </div>

        <ProfileEditor initialName={user.name || ""} email={user.email || ""} googleAvatar={user.image || null} />
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className={PROFILE_PAGE} aria-busy="true" />}>
      <ProfileContent />
    </Suspense>
  );
}