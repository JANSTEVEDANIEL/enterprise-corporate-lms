"use client";
import React, { useState } from "react";
import { CheckSquare, Square, Copy, Check, Info, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) {
    return <div className="text-slate-400 italic">No content available.</div>;
  }

  // Pre-process content into blocks: code blocks, tables, lists, callouts, headers, paragraphs
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={`space-y-4 text-slate-800 leading-relaxed text-sm md:text-base ${className}`}>
      {blocks.map((block, idx) => (
        <BlockRenderer key={idx} block={block} />
      ))}
    </div>
  );
}

type BlockType =
  | "header"
  | "paragraph"
  | "code_block"
  | "table"
  | "checklist"
  | "list"
  | "blockquote"
  | "hr";

interface ParsedBlock {
  type: BlockType;
  level?: number;
  content?: string;
  language?: string;
  headers?: string[];
  rows?: string[][];
  items?: { text: string; checked?: boolean; isCheckbox?: boolean }[];
  isOrdered?: boolean;
  calloutType?: "note" | "warning" | "tip" | "info" | "default";
}

function parseMarkdownBlocks(text: string): ParsedBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "code_block",
        language,
        content: codeLines.join("\n"),
      });
      i++;
      continue;
    }

    // 2. Horizontal Rule
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 3. Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      blocks.push({
        type: "header",
        level: headerMatch[1].length,
        content: headerMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 4. Tables
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const rawHeaders = tableLines[0]
          .split("|")
          .map((c) => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

        const rows: string[][] = [];
        for (let r = 2; r < tableLines.length; r++) {
          const rowCells = tableLines[r]
            .split("|")
            .map((c) => c.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          rows.push(rowCells);
        }

        blocks.push({
          type: "table",
          headers: rawHeaders,
          rows,
        });
        continue;
      }
    }

    // 5. Blockquote / Callouts
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const fullQuote = quoteLines.join("\n").trim();
      let calloutType: "note" | "warning" | "tip" | "info" | "default" = "default";
      let cleanContent = fullQuote;

      if (fullQuote.startsWith("[!NOTE]")) {
        calloutType = "note";
        cleanContent = fullQuote.replace(/^\[!NOTE\]\s*/, "");
      } else if (fullQuote.startsWith("[!WARNING]")) {
        calloutType = "warning";
        cleanContent = fullQuote.replace(/^\[!WARNING\]\s*/, "");
      } else if (fullQuote.startsWith("[!TIP]")) {
        calloutType = "tip";
        cleanContent = fullQuote.replace(/^\[!TIP\]\s*/, "");
      }

      blocks.push({
        type: "blockquote",
        calloutType,
        content: cleanContent,
      });
      continue;
    }

    // 6. Checklists and Lists
    const isChecklist = /^[-*]\s+\[([ xX])\]\s+(.+)$/.test(line.trim());
    const isUnorderedList = /^[-*]\s+(.+)$/.test(line.trim());
    const isOrderedList = /^\d+\.\s+(.+)$/.test(line.trim());

    if (isChecklist || isUnorderedList || isOrderedList) {
      const isOrdered = isOrderedList;
      const items: { text: string; checked?: boolean; isCheckbox?: boolean }[] = [];

      while (i < lines.length) {
        const cur = lines[i].trim();
        const checkMatch = cur.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
        if (checkMatch) {
          items.push({
            isCheckbox: true,
            checked: checkMatch[1].toLowerCase() === "x",
            text: checkMatch[2],
          });
          i++;
          continue;
        }

        const unordMatch = cur.match(/^[-*]\s+(.+)$/);
        if (!isOrdered && unordMatch) {
          items.push({ text: unordMatch[1], isCheckbox: false });
          i++;
          continue;
        }

        const ordMatch = cur.match(/^\d+\.\s+(.+)$/);
        if (isOrdered && ordMatch) {
          items.push({ text: ordMatch[1], isCheckbox: false });
          i++;
          continue;
        }

        break;
      }

      blocks.push({
        type: items.some((it) => it.isCheckbox) ? "checklist" : "list",
        isOrdered,
        items,
      });
      continue;
    }

    // 7. Regular Paragraph
    if (line.trim() !== "") {
      const pLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].trim().startsWith("#") &&
        !lines[i].trim().startsWith("```") &&
        !lines[i].trim().startsWith(">") &&
        !lines[i].trim().startsWith("|") &&
        !/^[-*]\s+/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim())
      ) {
        pLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "paragraph",
        content: pLines.join(" "),
      });
      continue;
    }

    i++;
  }

  return blocks;
}

function BlockRenderer({ block }: { block: ParsedBlock }) {
  const [copied, setCopied] = useState(false);

  switch (block.type) {
    case "header": {
      const level = block.level || 1;
      const id = block.content?.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      if (level === 1) {
        return (
          <h1 id={id} className="text-2xl md:text-3xl font-extrabold text-slate-900 border-b border-slate-200 pb-2 mt-6 mb-3">
            <InlineText text={block.content || ""} />
          </h1>
        );
      }
      if (level === 2) {
        return (
          <h2 id={id} className="text-xl md:text-2xl font-bold text-slate-900 mt-6 mb-2">
            <InlineText text={block.content || ""} />
          </h2>
        );
      }
      if (level === 3) {
        return (
          <h3 id={id} className="text-lg md:text-xl font-bold text-slate-900 mt-4 mb-2">
            <InlineText text={block.content || ""} />
          </h3>
        );
      }
      return (
        <h4 id={id} className="text-base font-semibold text-slate-900 mt-3 mb-1">
          <InlineText text={block.content || ""} />
        </h4>
      );
    }

    case "paragraph":
      return (
        <p className="text-slate-700 leading-relaxed">
          <InlineText text={block.content || ""} />
        </p>
      );

    case "code_block": {
      const handleCopy = () => {
        if (block.content) {
          navigator.clipboard.writeText(block.content);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      };

      return (
        <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 my-4 text-xs font-mono shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              {block.language || "text"}
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="p-4 text-emerald-300 overflow-x-auto leading-relaxed">
            <code>{block.content}</code>
          </pre>
        </div>
      );
    }

    case "table":
      return (
        <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs md:text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {block.headers?.map((h, idx) => (
                  <th key={idx} className="px-4 py-2.5 font-bold text-slate-900">
                    <InlineText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {block.rows?.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2 text-slate-700">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "checklist":
      return (
        <div className="space-y-2 my-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
          {block.items?.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs md:text-sm">
              {item.checked ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              )}
              <span className={item.checked ? "line-through text-slate-400" : "text-slate-800"}>
                <InlineText text={item.text} />
              </span>
            </div>
          ))}
        </div>
      );

    case "list":
      if (block.isOrdered) {
        return (
          <ol className="list-decimal list-inside space-y-1 my-3 pl-2 text-slate-700">
            {block.items?.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                <InlineText text={item.text} />
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="list-disc list-inside space-y-1 my-3 pl-2 text-slate-700">
          {block.items?.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              <InlineText text={item.text} />
            </li>
          ))}
        </ul>
      );

    case "blockquote": {
      const type = block.calloutType || "default";
      const calloutConfig = {
        note: {
          bg: "bg-blue-50",
          border: "border-blue-400",
          text: "text-blue-900",
          icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
          title: "NOTE",
        },
        warning: {
          bg: "bg-amber-50",
          border: "border-amber-400",
          text: "text-amber-900",
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
          title: "WARNING",
        },
        tip: {
          bg: "bg-emerald-50",
          border: "border-emerald-400",
          text: "text-emerald-900",
          icon: <Check className="w-5 h-5 text-emerald-600 shrink-0" />,
          title: "PRO TIP",
        },
        info: {
          bg: "bg-indigo-50",
          border: "border-indigo-400",
          text: "text-indigo-900",
          icon: <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0" />,
          title: "INFORMATION",
        },
        default: {
          bg: "bg-slate-50",
          border: "border-slate-300",
          text: "text-slate-800",
          icon: null,
          title: "",
        },
      }[type];

      return (
        <div
          className={`p-4 my-4 rounded-xl border-l-4 ${calloutConfig.bg} ${calloutConfig.border} ${calloutConfig.text} shadow-sm`}
        >
          <div className="flex items-start gap-3">
            {calloutConfig.icon}
            <div className="flex-1">
              {calloutConfig.title && (
                <div className="font-bold text-xs uppercase tracking-wider mb-1">
                  {calloutConfig.title}
                </div>
              )}
              <div className="text-xs md:text-sm leading-relaxed">
                <InlineText text={block.content || ""} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "hr":
      return <hr className="border-slate-200 my-6" />;

    default:
      return null;
  }
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and links [text](url)
 */
function InlineText({ text }: { text: string }) {
  if (!text) return null;

  // Split tokens for bold, italic, code, links
  const tokens = parseInlineTokens(text);

  return (
    <>
      {tokens.map((token, idx) => {
        if (token.type === "bold") {
          return <strong key={idx} className="font-bold text-slate-900">{token.content}</strong>;
        }
        if (token.type === "italic") {
          return <em key={idx} className="italic text-slate-800">{token.content}</em>;
        }
        if (token.type === "code") {
          return (
            <code
              key={idx}
              className="px-1.5 py-0.5 rounded bg-slate-100 text-pink-600 font-mono text-[11px] md:text-xs font-semibold"
            >
              {token.content}
            </code>
          );
        }
        if (token.type === "link") {
          return (
            <a
              key={idx}
              href={token.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline font-medium hover:text-blue-800"
            >
              {token.content}
            </a>
          );
        }
        return <span key={idx}>{token.content}</span>;
      })}
    </>
  );
}

interface InlineToken {
  type: "text" | "bold" | "italic" | "code" | "link";
  content: string;
  href?: string;
}

function parseInlineTokens(str: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        content: str.substring(lastIndex, match.index),
      });
    }

    if (match[2]) {
      // Bold **...**
      tokens.push({ type: "bold", content: match[2] });
    } else if (match[3]) {
      // Italic *...*
      tokens.push({ type: "italic", content: match[3] });
    } else if (match[4]) {
      // Code `...`
      tokens.push({ type: "code", content: match[4] });
    } else if (match[5] && match[6]) {
      // Link [text](url)
      tokens.push({ type: "link", content: match[5], href: match[6] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    tokens.push({
      type: "text",
      content: str.substring(lastIndex),
    });
  }

  return tokens;
}
