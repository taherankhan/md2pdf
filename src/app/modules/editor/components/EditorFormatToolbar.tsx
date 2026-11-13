import { FC, RefObject, useRef, useState } from 'react';
import type { MarkdownEditorHandle } from '../lib/editorHandle';
import { AnalyticsService } from '../../../../services/AnalyticsService';

interface EditorFormatToolbarProps {
  editorRef: RefObject<MarkdownEditorHandle | null>;
  onRequestLink: () => void;
}

const EditorFormatToolbar: FC<EditorFormatToolbarProps> = ({
  editorRef,
  onRequestLink,
}) => {
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  const run = (action: string, fn: () => void) => {
    fn();
    editorRef.current?.focus();
    AnalyticsService.events.editorFormat(action);
  };

  const editor = () => editorRef.current;

  return (
    <div className="editor-format-toolbar" role="toolbar" aria-label="Formatting">
      <div className="editor-format-group" ref={headingRef}>
        <button
          type="button"
          className="editor-format-btn has-caret"
          title="Heading"
          aria-expanded={headingOpen}
          onClick={() => setHeadingOpen((o) => !o)}
        >
          <span className="editor-format-heading-icon">H</span>
          <i className="bi bi-chevron-down editor-format-caret" aria-hidden />
        </button>
        {headingOpen && (
          <div className="editor-format-dropdown">
            {([1, 2, 3, 4, 5, 6] as const).map((level) => (
              <button
                key={level}
                type="button"
                className="editor-format-dropdown-item"
                onClick={() => {
                  run(`heading-${level}`, () => editor()?.setHeading(level));
                  setHeadingOpen(false);
                }}
              >
                Heading {level}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="editor-format-divider" aria-hidden />

      <button
        type="button"
        className="editor-format-btn"
        title="Bold"
        onClick={() => run('bold', () => editor()?.toggleBold())}
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Italic"
        onClick={() => run('italic', () => editor()?.toggleItalic())}
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Strikethrough"
        onClick={() => run('strike', () => editor()?.toggleStrikethrough())}
      >
        <s>S</s>
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Link"
        onClick={() => {
          onRequestLink();
          AnalyticsService.events.editorFormat('link');
        }}
      >
        <i className="bi bi-link-45deg" aria-hidden />
      </button>

      <span className="editor-format-divider" aria-hidden />

      <button
        type="button"
        className="editor-format-btn"
        title="Bullet list"
        onClick={() => run('bullet-list', () => editor()?.toggleBulletList())}
      >
        <i className="bi bi-list-ul" aria-hidden />
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Numbered list"
        onClick={() => run('ordered-list', () => editor()?.toggleOrderedList())}
      >
        <i className="bi bi-list-ol" aria-hidden />
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Task list"
        onClick={() => run('task-list', () => editor()?.toggleTaskList())}
      >
        <i className="bi bi-check2-square" aria-hidden />
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Blockquote"
        onClick={() => run('blockquote', () => editor()?.toggleBlockquote())}
      >
        <i className="bi bi-quote" aria-hidden />
      </button>

      <span className="editor-format-divider" aria-hidden />

      <button
        type="button"
        className="editor-format-btn"
        title="Inline code"
        onClick={() => run('inline-code', () => editor()?.toggleInlineCode())}
      >
        <i className="bi bi-code" aria-hidden />
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Code block"
        onClick={() => run('code-block', () => editor()?.insertCodeBlock())}
      >
        <i className="bi bi-file-code" aria-hidden />
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Table"
        onClick={() => run('table', () => editor()?.insertTable())}
      >
        <i className="bi bi-table" aria-hidden />
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Horizontal rule"
        onClick={() => run('hr', () => editor()?.insertHorizontalRule())}
      >
        <i className="bi bi-dash-lg" aria-hidden />
      </button>

      <span className="editor-format-divider" aria-hidden />

      <button
        type="button"
        className="editor-format-btn"
        title="Undo"
        onClick={() => run('undo', () => editor()?.undo())}
      >
        <i className="bi bi-arrow-counterclockwise" aria-hidden />
      </button>
      <button
        type="button"
        className="editor-format-btn"
        title="Redo"
        onClick={() => run('redo', () => editor()?.redo())}
      >
        <i className="bi bi-arrow-clockwise" aria-hidden />
      </button>
    </div>
  );
};

export default EditorFormatToolbar;
