import { Icon } from "./icons";
import { TypingIndicator } from "./typing-indicator";

/* Class strings kept identical to the original plain-CSS values. */
const WELCOME =
  "m-auto w-[min(100%_-_72px,940px)] animate-[rise-in_420ms_ease_both] pt-[43px] pb-[46px] [@media(max-width:820px)]:w-[min(100%_-_44px,700px)] [@media(max-width:720px)]:w-[min(100%_-_32px,560px)] [@media(max-width:720px)]:pt-[31px] [@media(max-width:720px)]:pb-[34px]";
const WELCOME_HEADING = "mb-[31px] text-center [@media(max-width:720px)]:mb-6";
const EMBLEM_BASE =
  "grid flex-none place-items-center text-white shadow-[0_8px_26px_rgba(48,137,231,0.24)] bg-[linear-gradient(145deg,var(--accent-bright),var(--accent-dark))]";
const EMBLEM_WELCOME = `${EMBLEM_BASE} mx-auto mb-[17px] h-[53px] w-[53px] rounded-[17px] border border-[rgba(169,212,255,0.3)] [@media(max-width:720px)]:mb-[14px] [@media(max-width:720px)]:h-[47px] [@media(max-width:720px)]:w-[47px]`;
const EYEBROW =
  "mb-[13px] inline-flex items-center gap-2 text-[9px] font-bold tracking-[1.7px] text-accent-bright before:content-[''] before:h-px before:w-[17px] before:bg-current before:opacity-[0.55] after:content-[''] after:h-px after:w-[17px] after:bg-current after:opacity-[0.55]";
const WELCOME_TITLE =
  "m-0 font-[family-name:var(--font-display)] text-[length:clamp(32px,4vw,46px)] font-bold leading-[1.1] tracking-[2.2px] text-foreground [@media(max-width:720px)]:text-[36px]";
const WELCOME_COPY =
  "mt-3 mb-0 text-xs leading-[1.6] text-muted [@media(max-width:720px)]:mx-auto [@media(max-width:720px)]:mt-[11px] [@media(max-width:720px)]:max-w-[300px] [@media(max-width:720px)]:text-[11px]";

export function WelcomeScreen({ mode }: { mode: "loading" | "empty" }) {
  if (mode === "loading") {
    return (
      <div
        className={WELCOME}
        aria-live="polite"
        aria-label="Loading conversation"
      >
        <div className={WELCOME_HEADING}>
          <div className={EMBLEM_WELCOME}>
            <TypingIndicator />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={WELCOME}>
      <div className={WELCOME_HEADING}>
        <div className={EMBLEM_WELCOME}>
          <Icon name="spark" size={25} />
        </div>
        <p className={EYEBROW}>YOUR NIMBUS ASSISTANT</p>
        <h1 className={WELCOME_TITLE}>
          What can I help
          <br className="hidden [@media(max-width:720px)]:inline" /> you with?
        </h1>
        <p className={WELCOME_COPY}>
          Get quick answers about your workspace, account, and plans.
        </p>
      </div>
    </div>
  );
}
