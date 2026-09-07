"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small emoji picker with no dependency behind it.
 *
 * The obvious move is `emoji-mart` or `emoji-picker-react`, and both ship the
 * full Unicode set with search, skin tones and category icons — around 200 kB
 * over the wire, for a studio chat where the realistic vocabulary is a couple
 * of dozen reactions. This is that vocabulary, hand-picked, in a popover.
 *
 * If someone genuinely needs an emoji that is not here, the native picker is
 * still one keystroke away (ctrl+cmd+space on macOS, win+. on Windows) and
 * types straight into the same field.
 */
const GROUPS: Array<{ key: string; emojis: string[] }> = [
  {
    key: "reactions",
    emojis: ["👍", "👏", "🙌", "🔥", "✨", "🎉", "❤️", "💜", "😍", "🤩"],
  },
  {
    key: "faces",
    emojis: ["😀", "😅", "😂", "🙂", "😉", "😌", "🤔", "😬", "😴", "🥹"],
  },
  {
    key: "work",
    emojis: ["✅", "☑️", "❌", "⚠️", "📌", "📎", "📅", "⏰", "🚀", "💡"],
  },
  {
    key: "studio",
    emojis: ["🎨", "🖌️", "📷", "🎬", "📱", "💻", "📊", "📈", "💰", "🧾"],
  },
];

export function EmojiPicker({
  onPick,
  label,
}: {
  onPick: (emoji: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. Without the first, the panel stays
  // open behind the next thing you click; without the second, a keyboard user
  // who opened it has no way back to the field.
  useEffect(() => {
    if (!open) return;

    function onDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className="rounded-xl border border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden>🙂</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute bottom-full right-0 z-50 mb-2 w-[17.5rem] rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          {GROUPS.map((group) => (
            <div key={group.key} className="mb-1 last:mb-0">
              <div className="grid grid-cols-10 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    // The picker stays open: reactions come in runs ("👍🔥"),
                    // and closing after each one turns three emoji into three
                    // round trips through the button.
                    onClick={() => onPick(emoji)}
                    className="rounded-md p-1 text-lg leading-none transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden>{emoji}</span>
                    <span className="sr-only">{emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
