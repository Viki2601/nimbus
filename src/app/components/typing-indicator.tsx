export function TypingIndicator({ label }: { label?: string }) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <i className="h-[5px] w-[5px] rounded-full bg-accent-bright animate-[typing_1s_ease-in-out_infinite]" />
      <i className="h-[5px] w-[5px] rounded-full bg-accent-bright animate-[typing_1s_ease-in-out_infinite] [animation-delay:120ms]" />
      <i className="h-[5px] w-[5px] rounded-full bg-accent-bright animate-[typing_1s_ease-in-out_infinite] [animation-delay:240ms]" />
    </span>
  );
}
