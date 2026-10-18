import { Fragment, type ReactNode } from "react";

// Bangumi writes its summaries in BBCode: [url=…]text[/url], [url]…[/url], [b], [i], [u], [s],
// [mask] (a spoiler), [img], [size=…], [color=…]; bare URLs appear too. This turns that into React
// nodes (never raw HTML): links only for http(s) addresses, images dropped, size and colour ignored,
// anything unknown or unbalanced left as the text it was.
const TAG = /\[(\/?)(url|b|i|u|s|mask|img|size|color)(?:=([^\]]*))?\]/gi;
const BARE_URL = /https?:\/\/[^\s[\]<>"'，。、）)]+/g;

type Node = { tag: string | null; value?: string; children: (Node | string)[] };

function safeUrl(value: string | undefined) {
  const url = value?.trim() ?? "";
  return /^https?:\/\/\S+$/i.test(url) ? url : null;
}

function link(href: string, children: ReactNode, key: number) {
  return (
    <a key={key} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

// Plain text with its bare URLs made into links.
function autolink(text: string, keyBase: number): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(BARE_URL)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(link(match[0], match[0], keyBase + out.length));
    last = start + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function parse(text: string): Node {
  const root: Node = { tag: null, children: [] };
  const stack: Node[] = [root];
  let last = 0;
  for (const match of text.matchAll(TAG)) {
    const start = match.index ?? 0;
    const top = stack[stack.length - 1];
    if (start > last) top.children.push(text.slice(last, start));
    last = start + match[0].length;
    const [raw, closing, name, value] = match;
    const tag = name.toLowerCase();
    if (!closing) {
      const node: Node = { tag, value, children: [] };
      top.children.push(node);
      stack.push(node);
      continue;
    }
    // A closing tag closes the nearest open tag of its kind; a stray one stays as text.
    const at = stack.map((node) => node.tag).lastIndexOf(tag);
    if (at > 0) stack.length = at;
    else top.children.push(raw);
  }
  if (last < text.length) stack[stack.length - 1].children.push(text.slice(last));
  return root;
}

function plain(node: Node | string): string {
  return typeof node === "string" ? node : node.children.map(plain).join("");
}

// inLink: inside a link already, so bare URLs stay text (no link within a link).
function render(node: Node | string, key: number, inLink = false): ReactNode {
  if (typeof node === "string")
    return <Fragment key={key}>{inLink ? node : autolink(node, key * 1000)}</Fragment>;
  const children = node.children.map((child, index) => render(child, index, inLink || node.tag === "url"));
  switch (node.tag) {
    case "url": {
      const href = safeUrl(node.value ?? plain(node));
      return href ? link(href, node.value ? children : href, key) : <Fragment key={key}>{children}</Fragment>;
    }
    case "b":
      return <strong key={key}>{children}</strong>;
    case "i":
      return <em key={key}>{children}</em>;
    case "u":
      return (
        <span key={key} style={{ textDecoration: "underline" }}>
          {children}
        </span>
      );
    case "s":
      return <s key={key}>{children}</s>;
    case "mask":
      return (
        <span key={key} className="bbcode-mask">
          {children}
        </span>
      );
    case "img":
      return null;
    default:
      return <Fragment key={key}>{children}</Fragment>;
  }
}

export function BangumiText({ text }: { text: string }) {
  return <>{render(parse(text), 0)}</>;
}
