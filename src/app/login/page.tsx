import { Suspense } from "react";
import GoogleLoginButton from "./google-login-button";
type LoginPageProps = { searchParams: Promise<{ error?: string }> };

/* Class strings kept identical to the original plain-CSS values. */
const LOGIN_PAGE =
  "relative grid min-h-dvh place-items-center overflow-hidden px-[20px] py-[32px] bg-[radial-gradient(ellipse_at_50%_12%,rgba(91,158,231,0.15),transparent_36%),var(--background)] [@media(max-width:420px)]:px-3 [@media(max-width:420px)]:py-[18px]";
const LOGIN_ORB =
  "pointer-events-none absolute aspect-square w-[360px] rounded-full border border-[rgba(78,144,218,0.1)] bg-[radial-gradient(circle,rgba(105,173,246,0.09),transparent_68%)]";
const LOGIN_CARD =
  "relative z-[1] w-[min(100%,520px)] border border-[rgba(255,255,255,0.84)] rounded-[27px] bg-[rgba(255,255,255,0.69)] p-[clamp(26px,6vw,48px)] shadow-[0_30px_90px_rgba(52,89,136,0.15),inset_0_1px_rgba(255,255,255,0.9)] backdrop-blur-[28px] [@media(max-width:420px)]:px-[20px] [@media(max-width:420px)]:py-[26px] [@media(max-width:420px)]:rounded-[22px]";
const LOGIN_BRAND =
  "flex items-center gap-[10px] font-[family-name:var(--font-display)] text-[15px] font-[weight:800] tracking-[4px] text-foreground";
const LOGIN_BRAND_MARK =
  "grid h-[35px] w-[35px] place-items-center rounded-xl border border-[rgba(255,255,255,0.4)] bg-[linear-gradient(145deg,#62aaff,#287fdf_74%)] text-white shadow-[0_7px_20px_rgba(48,137,231,0.24)] [&_svg]:h-5 [&_svg]:w-5";
const LOGIN_INTRO = "mt-[42px] mb-[27px] [@media(max-width:420px)]:mt-[34px]";
const LOGIN_TITLE =
  "mt-[13px] mb-[11px] font-[family-name:var(--font-display)] text-[length:clamp(34px,7vw,47px)] font-bold leading-[1.08] tracking-[3px] text-foreground";
const LOGIN_INTRO_P = "mt-0 mb-0 text-xs leading-[1.7] text-muted";
const LOGIN_PANEL =
  "border border-line rounded-[18px] bg-[rgba(243,248,255,0.76)] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.9)] [@media(max-width:420px)]:p-4";
const LOGIN_PANEL_HEADING =
  "mb-[19px] flex items-start justify-between gap-[12px]";
const LOGIN_PANEL_H2 =
  "mt-0 mb-[5px] text-[14px] font-[weight:650] tracking-[-0.2px] text-foreground";
const LOGIN_PANEL_P = "mt-0 mb-0 text-[10px] leading-[1.7] text-muted";
const LOGIN_STATUS_DOT =
  "block h-[7px] w-[7px] flex-none rounded-full bg-[#49bd8b] shadow-[0_0_11px_rgba(73,189,139,0.4)]";
const LOGIN_ERROR =
  "mt-0 mb-[14px] border border-[rgba(189,72,72,0.18)] rounded-[10px] bg-[rgba(255,239,239,0.85)] px-3 py-[10px] text-[11px] leading-[1.5] text-[#923d3d]";
const LOGIN_PRIVACY =
  "mx-1 mt-[13px] mb-0 text-center text-[9px] leading-[1.55] text-muted";
const LOGIN_FOOTER =
  "mt-[20px] flex justify-between gap-[12px] text-[9px] text-muted [@media(max-width:420px)]:flex-col";
const LOGIN_FOOTER_SPAN = "inline-flex items-center gap-[7px]";
const LOGIN_FOOTER_DOT =
  "block h-[6px] w-[6px] flex-none rounded-full bg-[#49bd8b] shadow-[0_0_11px_rgba(73,189,139,0.4)]";

const LOGIN_ERRORS: Record<string, string> = {
  AccessDenied: "Access was denied. Please try signing in again.",
  OAuthAccountNotLinked:
    "That Google account could not be linked. Contact support.",
  OAuthCallback: "Google sign-in could not be completed. Please try again.",
  OAuthSignin: "Google sign-in could not be started. Please try again.",
};

async function LoginError({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p className={LOGIN_ERROR} role="alert">
      {LOGIN_ERRORS[error] ??
        "Sign-in could not be completed. Please try again."}
    </p>
  );
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className={LOGIN_PAGE}>
      <div
        className={`${LOGIN_ORB} top-[-220px] right-[-120px]`}
        aria-hidden="true"
      />
      <div
        className={`${LOGIN_ORB} bottom-[-240px] left-[-140px] w-[440px]`}
        aria-hidden="true"
      />

      <section className={LOGIN_CARD} aria-labelledby="login-title">
        <div className={LOGIN_BRAND}>
          <span className={LOGIN_BRAND_MARK} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
              <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
            </svg>
          </span>
          <span>Nimbot</span>
        </div>

        <div className={LOGIN_INTRO}>
          <h1 className={LOGIN_TITLE} id="login-title">
            A little help,
            <br />
            right on time.
          </h1>
          <p className={LOGIN_INTRO_P}>
            Sign in to pick up where you left off. Your conversations stay saved
            to your workspace.
          </p>
        </div>

        <div className={LOGIN_PANEL}>
          <div className={LOGIN_PANEL_HEADING}>
            <div>
              <h2 className={LOGIN_PANEL_H2}>Welcome back</h2>
              <p className={LOGIN_PANEL_P}>
                Continue securely with your Google account.
              </p>
            </div>
            <span className={LOGIN_STATUS_DOT} aria-label="Secure sign-in" />
          </div>

          <Suspense fallback={null}>
            <LoginError searchParams={searchParams} />
          </Suspense>

          <GoogleLoginButton />
          <p className={LOGIN_PRIVACY}>
            By continuing, you agree to use your Nimbus account for this support
            workspace.
          </p>
        </div>

        <div className={LOGIN_FOOTER}>
          <span className={LOGIN_FOOTER_SPAN}>
            <i className={LOGIN_FOOTER_DOT} /> Secure Google sign-in
          </span>
          <span>Your workspace, kept private</span>
        </div>
      </section>
    </main>
  );
}
