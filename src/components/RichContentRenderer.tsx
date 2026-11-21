import React from 'react';

interface RichContentRendererProps {
  content: string;
  enableDropCap?: boolean;
}

/**
 * Safely renders structured editorial prose (headings, paragraphs, lists, pull quotes,
 * and markdown tables) into React elements with zero raw HTML injection.
 */
export function RichContentRenderer({ content, enableDropCap = true }: RichContentRendererProps) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let firstParagraphRendered = false;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    // Markdown table block
    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      const rows = tableLines
        .filter((row) => !/^\|[\s\-:|]+\|$/.test(row))
        .map((row) =>
          row
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim())
        );

      if (rows.length > 0) {
        const [header, ...bodyRows] = rows;
        blocks.push(
          <div key={`tbl-${i}`} className="my-8 overflow-x-auto border border-[#E5E2DC] dark:border-[#232A36]">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-[#F4F1EA] dark:bg-[#171D28] border-b border-[#E5E2DC] dark:border-[#232A36]">
                  {header.map((col, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-3 font-semibold text-[#141413] dark:text-[#F3F4F6] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="bg-white dark:bg-[#11151D]">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-4 py-3 text-[#292524] dark:text-[#D1D5DB] tabular-nums"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(
        <h3
          key={`h3-${i}`}
          className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-8 mb-3"
        >
          {line.slice(4)}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2
          key={`h2-${i}`}
          className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-10 mb-4"
        >
          {line.slice(3)}
        </h2>
      );
      i += 1;
      continue;
    }

    // Editorial Pull Quote (clean top/bottom hairlines, never thick left accent border)
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${i}`}
          className="my-8 py-6 border-y border-[#D6D1C7] dark:border-[#2B3444] font-serif italic text-xl leading-relaxed text-[#292524] dark:text-[#E5E7EB]"
        >
          {quoteLines.join(' ')}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-5 space-y-2.5 pl-5 list-disc text-[#292524] dark:text-[#D1D5DB] leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-5 space-y-2.5 pl-5 list-decimal text-[#292524] dark:text-[#D1D5DB] leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph
    const isDropCap = enableDropCap && !firstParagraphRendered && line.length > 60 && /^[A-Za-z]/.test(line);
    firstParagraphRendered = true;
    blocks.push(
      <p
        key={`p-${i}`}
        className={`my-5 text-[16px] leading-[1.8] text-[#292524] dark:text-[#D1D5DB] ${
          isDropCap
            ? 'first-letter:font-serif first-letter:text-5xl first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none first-letter:text-[#141413] dark:first-letter:text-[#F3F4F6]'
            : ''
        }`}
      >
        {renderInlineFormatting(line)}
      </p>
    );
    i += 1;
  }

  return <div className="max-w-prose">{blocks}</div>;
}

function renderInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#141413] dark:text-[#F3F4F6]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
