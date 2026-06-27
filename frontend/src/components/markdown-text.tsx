"use client";

/**
 * MarkdownText — lightweight inline markdown renderer.
 *
 * Handles the subset the LLM agents actually produce:
 *   **bold**, *italic*, `code`, numbered/bulleted lists, ### headings, blank-line paragraphs.
 *
 * No external deps — pure React + CSS.
 */

import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  /** Raw markdown string from the LLM */
  text: string;
  className?: string;
}

export function MarkdownText({ text, className }: MarkdownTextProps) {
  if (!text) return null;

  const blocks = parseBlocks(text);

  return (
    <div className={cn("space-y-3 text-[14.5px] leading-relaxed text-ink-soft max-w-2xl", className)}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet_list"; items: string[] }
  | { type: "numbered_list"; items: string[] }
  | { type: "blank" };

// ─── Block parser ─────────────────────────────────────────────────────────────

function parseBlocks(raw: string): Block[] {
  // Normalise line endings
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      blocks.push({
        type: "heading",
        level: Math.min(hMatch[1].length, 3) as 1 | 2 | 3,
        text: hMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Bullet list item
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      const items: string[] = [bulletMatch[1]];
      i++;
      while (i < lines.length) {
        const next = lines[i].match(/^[-*]\s+(.+)$/);
        if (next) { items.push(next[1]); i++; }
        else break;
      }
      blocks.push({ type: "bullet_list", items });
      continue;
    }

    // Numbered list item
    const numMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (numMatch) {
      const items: string[] = [numMatch[1]];
      i++;
      while (i < lines.length) {
        const next = lines[i].match(/^\d+[.)]\s+(.+)$/);
        if (next) { items.push(next[1]); i++; }
        else break;
      }
      blocks.push({ type: "numbered_list", items });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue; // collapse blanks — spacing is handled by space-y-3
    }

    // Paragraph — accumulate until blank or next block-level element
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (
        next.trim() === "" ||
        next.match(/^#{1,3}\s/) ||
        next.match(/^[-*]\s/) ||
        next.match(/^\d+[.)]\s/)
      ) break;
      paraLines.push(next);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case "heading":
      return (
        <p key={key} className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink mt-4 mb-1">
          {renderInline(block.text)}
        </p>
      );
    case "paragraph":
      return (
        <p key={key} className="text-[14.5px] leading-relaxed text-ink-soft">
          {renderInline(block.text)}
        </p>
      );
    case "bullet_list":
      return (
        <ul key={key} className="space-y-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft">
              <span className="text-ink-mute select-none mt-[2px] shrink-0">·</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "numbered_list":
      return (
        <ol key={key} className="space-y-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft">
              <span className="font-mono text-[11px] text-ink-mute select-none mt-[3px] shrink-0 w-4">
                {i + 1}.
              </span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

// ─── Inline renderer ──────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // Strip leading/trailing whitespace
  text = text.trim();
  if (!text) return null;

  // Tokenise: **bold**, *italic*, `code`
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));

    if (match[2] !== undefined) {
      // **bold**
      parts.push(<strong key={match.index} className="font-semibold text-ink">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      // *italic*
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    } else if (match[4] !== undefined) {
      // `code`
      parts.push(
        <code key={match.index} className="font-mono text-[13px] bg-paper-2 px-1 rounded-[2px] text-ink">
          {match[4]}
        </code>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
