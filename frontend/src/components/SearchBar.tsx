import { type FormEvent, useRef } from "react";

type TSearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmitTerm: () => void;
  speechSupported: boolean;
  listening: boolean;
  onMicClick: () => void;
  micHint: string | null;
};

export function SearchBar({
  value,
  onChange,
  onSubmitTerm,
  speechSupported,
  listening,
  onMicClick,
  micHint,
}: TSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmitTerm();
  }

  return (
    <form
      onSubmit={onFormSubmit}
      className="mx-auto flex w-full max-w-xl flex-col gap-2 sm:gap-3"
    >
      <div
        className={`flex h-12 items-stretch overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md sm:h-14 ${listening ? "ring-2 ring-blue-400/60" : ""}`}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入想了解的 AI 术语（中/英均可）"
          maxLength={64}
          className="min-w-0 flex-1 border-0 bg-transparent px-4 text-base text-gray-800 outline-none placeholder:text-gray-400 sm:px-5 sm:text-lg"
          autoComplete="off"
          aria-label="AI 术语"
        />
        <button
          type="button"
          onClick={onMicClick}
          disabled={!speechSupported}
          title={
            speechSupported
              ? "语音输入"
              : "当前浏览器不支持语音或需使用 HTTPS"
          }
          className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border-l border-gray-100 text-gray-500 transition hover:bg-gray-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${listening ? "animate-pulse-mic text-blue-600" : ""}`}
          aria-label="语音输入"
        >
          <MicIcon />
        </button>
      </div>
      {micHint ? (
        <p className="text-center text-sm text-amber-700">{micHint}</p>
      ) : listening ? (
        <p className="text-center text-sm text-blue-600">请说出术语…</p>
      ) : null}
    </form>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
