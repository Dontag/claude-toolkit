import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

interface Props {
  initial: string;
  onChange: (value: string) => void;
}

export function Editor({ initial, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const view = new EditorView({
      parent: el,
      state: EditorState.create({
        doc: initial,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown(),
          oneDark,
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
          }),
          EditorView.theme({
            "&": { fontSize: "13px", height: "100%" },
            ".cm-scroller": { fontFamily: "ui-monospace, Consolas, monospace" },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mounted once per file open; `initial` is fixed for the modal's lifetime

  return <div ref={host} className="h-full min-h-0 overflow-hidden rounded-xl border border-border" />;
}
