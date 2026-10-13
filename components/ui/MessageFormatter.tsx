"use client";

import React, { useState, type ReactNode } from "react";
import { toast } from "sonner";

interface MessageFormatterProps {
  content: string;
  searchNeedle?: string;
}

/**
 * دکمه کپی کد برای بلاک‌های کدهای چندخطی
 */
function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  return (
    <button
      type="button"
      className="tg-code-copy-btn"
      onClick={handleCopy}
      aria-label="Copy code block"
      title="Copy code"
    >
      {copied ? (
        <span className="tg-copy-ok">Copied!</span>
      ) : (
        <span className="tg-copy-action">Copy</span>
      )}
    </button>
  );
}

/**
 * کامپوننت اسپویلر با قابلیت لمس و افشا
 */
function SpoilerText({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      className={`tg-spoiler ${revealed ? "revealed" : ""}`}
      onClick={() => setRevealed(true)}
      title={revealed ? "" : "Click to reveal spoiler"}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setRevealed(true);
        }
      }}
    >
      {children}
    </span>
  );
}

/**
 * هایلایت کردن کلمات مورد جستجو در بخش‌های متنی
 */
function highlight(text: string, needle?: string): ReactNode {
  if (!needle || !needle.trim()) return text;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={`m-${part}-${i}`} className="tg-search-match">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * پردازش فرمت‌های درون‌خطی (Bold, Italic, Strikethrough, Code, Spoiler, Links)
 */
function formatInline(text: string, needle?: string): ReactNode[] {
  // الگوهای لینک، اسپویلر، کد اینلاین، بولد، ایتالیک، و خط‌خورده
  const tokenRegex =
    /(\|\|[\s\S]+?\|\|)|(`[^`\n]+`)|(\*\*[\s\S]+?\*\*|\*[^*\n]+?\*)|(__[\s\S]+?__|_[^_\n]+?_)|(~~[\s\S]+?~~)|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s]+)/g;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    // متن قبل از توکن
    if (match.index > lastIndex) {
      nodes.push(
        <React.Fragment key={`txt-${counter++}`}>
          {highlight(text.slice(lastIndex, match.index), needle)}
        </React.Fragment>
      );
    }

    const [full] = match;

    if (full.startsWith("||") && full.endsWith("||")) {
      // اسپویلر
      const inner = full.slice(2, -2);
      nodes.push(
        <SpoilerText key={`sp-${counter++}`}>
          {formatInline(inner, needle)}
        </SpoilerText>
      );
    } else if (full.startsWith("`") && full.endsWith("`")) {
      // کد اینلاین
      const inner = full.slice(1, -1);
      nodes.push(
        <code key={`code-${counter++}`} className="tg-inline-code" dir="ltr">
          {highlight(inner, needle)}
        </code>
      );
    } else if (
      (full.startsWith("**") && full.endsWith("**")) ||
      (full.startsWith("*") && full.endsWith("*"))
    ) {
      // بولد
      const len = full.startsWith("**") ? 2 : 1;
      const inner = full.slice(len, -len);
      nodes.push(
        <strong key={`b-${counter++}`}>
          {formatInline(inner, needle)}
        </strong>
      );
    } else if (
      (full.startsWith("__") && full.endsWith("__")) ||
      (full.startsWith("_") && full.endsWith("_"))
    ) {
      // ایتالیک
      const len = full.startsWith("__") ? 2 : 1;
      const inner = full.slice(len, -len);
      nodes.push(
        <em key={`i-${counter++}`}>
          {formatInline(inner, needle)}
        </em>
      );
    } else if (full.startsWith("~~") && full.endsWith("~~")) {
      // خط‌خورده
      const inner = full.slice(2, -2);
      nodes.push(
        <del key={`del-${counter++}`}>
          {formatInline(inner, needle)}
        </del>
      );
    } else if (full.startsWith("[") && full.includes("](") && full.endsWith(")")) {
      // لینک مارک‌داون
      const closeBracket = full.indexOf("](");
      const label = full.slice(1, closeBracket);
      const url = full.slice(closeBracket + 2, -1);
      nodes.push(
        <a
          key={`l-${counter++}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="tg-link"
        >
          {highlight(label, needle)}
        </a>
      );
    } else if (/^https?:\/\//.test(full)) {
      // لینک مستقیم
      nodes.push(
        <a
          key={`url-${counter++}`}
          href={full}
          target="_blank"
          rel="noreferrer"
          className="tg-link"
        >
          {highlight(full, needle)}
        </a>
      );
    } else {
      nodes.push(
        <React.Fragment key={`raw-${counter++}`}>
          {highlight(full, needle)}
        </React.Fragment>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  // باقی‌مانده متن
  if (lastIndex < text.length) {
    nodes.push(
      <React.Fragment key={`end-${counter++}`}>
        {highlight(text.slice(lastIndex), needle)}
      </React.Fragment>
    );
  }

  return nodes;
}

/**
 * مفسر جامع پیام‌های متنی با پشتیبانی از Code Blocks چندخطی، نقل‌قول‌ها و متون RTL
 */
export function MessageFormatter({ content, searchNeedle }: MessageFormatterProps) {
  if (!content) return null;

  // ۱. شناسایی بلاک‌های کد چندخطی (Code Blocks)
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const sections: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // متن قبل از بلاک کد
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      sections.push(renderTextParagraphs(textBefore, searchNeedle, `pre-${blockIndex}`));
    }

    const lang = (match[1] || "").trim();
    const codeBody = match[2];

    sections.push(
      <div key={`cb-${blockIndex}`} className="tg-code-block" dir="ltr">
        <div className="tg-code-header">
          <span className="tg-code-lang">{lang || "code"}</span>
          <CopyCodeButton code={codeBody} />
        </div>
        <pre className="tg-code-pre">
          <code>{codeBody}</code>
        </pre>
      </div>
    );

    blockIndex++;
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    const trailingText = content.slice(lastIndex);
    sections.push(renderTextParagraphs(trailingText, searchNeedle, `post-${blockIndex}`));
  }

  return <div className="tg-formatted-message">{sections}</div>;
}

/**
 * رندر پاراگراف‌ها، نقل‌قول‌ها (`>`) و خطوط شکسته
 */
function renderTextParagraphs(
  rawText: string,
  needle?: string,
  keyPrefix = "p"
): ReactNode {
  const lines = rawText.split("\n");
  const elements: ReactNode[] = [];
  let inQuote = false;
  let quoteBuffer: string[] = [];
  let lineIdx = 0;

  function flushQuote() {
    if (quoteBuffer.length > 0) {
      elements.push(
        <blockquote key={`${keyPrefix}-q-${lineIdx}`} className="tg-quote" dir="auto">
          {quoteBuffer.map((qLine, qIdx) => (
            <div key={`ql-${qIdx}`}>{formatInline(qLine, needle)}</div>
          ))}
        </blockquote>
      );
      quoteBuffer = [];
      inQuote = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("> ") || line === ">") {
      inQuote = true;
      quoteBuffer.push(line.replace(/^>\s?/, ""));
    } else {
      flushQuote();
      elements.push(
        <p key={`${keyPrefix}-l-${lineIdx++}`} className="tg-message-text" dir="auto">
          {line.trim() ? formatInline(line, needle) : <br />}
        </p>
      );
    }
  }
  flushQuote();

  return <React.Fragment key={keyPrefix}>{elements}</React.Fragment>;
}
