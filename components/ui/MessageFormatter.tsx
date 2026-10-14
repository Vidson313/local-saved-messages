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
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  return (
    <button
      type="button"
      className="tg-code-copy-btn"
      onClick={() => {
        void handleCopy();
      }}
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
      onClick={() => {
        setRevealed(true);
      }}
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
 * هایلایت کردن کلمات مورد جستجو با اسکنر خطی (بدون ساخت رجکس پویا جهت جلوگیری از ReDoS)
 */
function highlight(text: string, needle?: string): ReactNode {
  if (!needle || !needle.trim()) return text;
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const needleLen = lowerNeedle.length;
  if (needleLen === 0) return text;

  const nodes: ReactNode[] = [];
  let startIndex = 0;
  let matchIndex = lowerText.indexOf(lowerNeedle, startIndex);

  if (matchIndex === -1) return text;

  let key = 0;
  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      nodes.push(text.slice(startIndex, matchIndex));
    }
    nodes.push(
      <mark key={`m-${key++}`} className="tg-search-match">
        {text.slice(matchIndex, matchIndex + needleLen)}
      </mark>
    );
    startIndex = matchIndex + needleLen;
    matchIndex = lowerText.indexOf(lowerNeedle, startIndex);
  }

  if (startIndex < text.length) {
    nodes.push(text.slice(startIndex));
  }

  return nodes;
}

const MAX_INLINE_LENGTH = 4000;
const MAX_INLINE_TOKENS = 250;
const MAX_RECURSION_DEPTH = 2;

/**
 * پردازش فرمت‌های درون‌خطی (Bold, Italic, Strikethrough, Code, Spoiler, Links)
 * مجهز به Parsing Budget و الگوهای کراندار جهت جلوگیری از ReDoS و مصرف بیش از حد CPU
 */
function formatInline(text: string, needle?: string, depth = 0): ReactNode[] {
  if (!text) return [];

  // در صورت طولانی بودن غیرعادی خط یا رسیدن به سقف عمق تودرتویی، به عنوان متن ساده امن رندر می‌شود
  if (text.length > MAX_INLINE_LENGTH || depth >= MAX_RECURSION_DEPTH) {
    return [highlight(text, needle)];
  }

  // الگوهای کراندار جهت تضمین پیچیدگی زمانی خطی
  const tokenRegex =
    /(\|\|[^\n]{1,1000}?\|\|)|(`[^`\n]{1,1000}`)|(\*\*[^\n]{1,1000}?\*\*|\*[^*\n]{1,500}?\*)|(__[^\n]{1,1000}?__|_[^_\n]{1,500}?_)|(~~[^\n]{1,1000}?~~)|(\[[^\]\n]{1,300}\]\(https?:\/\/[^\s)\n]{1,2000}\))|(https?:\/\/[^\s]+)/g;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    // جلوگیری از مصرف بی‌پایان نخ اصلی مرورگر در متون پرتوکن
    if (counter >= MAX_INLINE_TOKENS) {
      break;
    }

    if (match.index > lastIndex) {
      nodes.push(
        <React.Fragment key={`txt-${counter++}`}>
          {highlight(text.slice(lastIndex, match.index), needle)}
        </React.Fragment>
      );
    }

    const [full] = match;

    if (full.startsWith("||") && full.endsWith("||")) {
      const inner = full.slice(2, -2);
      nodes.push(
        <SpoilerText key={`sp-${counter++}`}>
          {formatInline(inner, needle, depth + 1)}
        </SpoilerText>
      );
    } else if (full.startsWith("`") && full.endsWith("`")) {
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
      const len = full.startsWith("**") ? 2 : 1;
      const inner = full.slice(len, -len);
      nodes.push(
        <strong key={`b-${counter++}`}>
          {formatInline(inner, needle, depth + 1)}
        </strong>
      );
    } else if (
      (full.startsWith("__") && full.endsWith("__")) ||
      (full.startsWith("_") && full.endsWith("_"))
    ) {
      const len = full.startsWith("__") ? 2 : 1;
      const inner = full.slice(len, -len);
      nodes.push(
        <em key={`i-${counter++}`}>
          {formatInline(inner, needle, depth + 1)}
        </em>
      );
    } else if (full.startsWith("~~") && full.endsWith("~~")) {
      const inner = full.slice(2, -2);
      nodes.push(
        <del key={`del-${counter++}`}>
          {formatInline(inner, needle, depth + 1)}
        </del>
      );
    } else if (full.startsWith("[") && full.includes("](") && full.endsWith(")")) {
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

  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const sections: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
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
          <code>{searchNeedle ? highlight(codeBody, searchNeedle) : codeBody}</code>
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

  for (const line of lines) {
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
