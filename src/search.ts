// ---------- search query: terms, "quoted phrases", AND / OR / NOT (or a leading -), parentheses ----------
//   maya standup             both terms (adjacent terms are ANDed)
//   (billing AND v2) OR acme
//   NOT draft   /   -draft   /   -"daily log"   /   -(a OR b)
// Operators are recognised in upper case only, so a lower-case "and" / "or" is searched as a word.
// Precedence: NOT > AND > OR. Unbalanced parentheses are tolerated.
export type SearchNode = { t: "term"; v: string } | { t: "not"; c: SearchNode } | { t: "and" | "or"; c: SearchNode[] };

export function parseSearch(q: string): SearchNode | null {
  const toks: string[] = [];
  // groups: 1 "-" before "(", 2 "(", 3 ")", 4 "-" before a phrase, 5 phrase, 6 "-" before a word, 7 word
  const re = /\s*(?:(-?)(\()|(\))|(-?)"([^"]*)"?|(-?)([^\s()"]+))/y;
  let m: RegExpExecArray | null;
  while (re.lastIndex < q.length && (m = re.exec(q))) {
    if (m[2]) {
      if (m[1]) toks.push("NOT");
      toks.push("(");
    } else if (m[3]) toks.push(")");
    else if (m[5] !== undefined) {
      if (m[5].trim()) {
        if (m[4]) toks.push("NOT");
        toks.push("t:" + m[5].toLowerCase());
      }
    } else if (m[7]) {
      if (m[6]) toks.push("NOT");
      toks.push(["AND", "OR", "NOT"].includes(m[7]) && !m[6] ? m[7] : "t:" + m[7].toLowerCase());
    }
  }
  let i = 0;
  const atom = (): SearchNode | null => {
    const tk = toks[i];
    if (tk === undefined) return null;
    if (tk === "NOT") {
      i++;
      const c = atom();
      return c ? { t: "not", c } : null;
    }
    if (tk === "(") {
      i++;
      const e = or();
      if (toks[i] === ")") i++;
      return e;
    }
    if (tk.startsWith("t:")) {
      i++;
      return { t: "term", v: tk.slice(2) };
    }
    return null; // a stray AND / OR / ")"
  };
  const and = (): SearchNode | null => {
    const c: SearchNode[] = [];
    while (i < toks.length && toks[i] !== "OR" && toks[i] !== ")") {
      if (toks[i] === "AND") {
        i++;
        continue;
      }
      const a = atom();
      if (a) c.push(a);
      else if (toks[i] !== "OR" && toks[i] !== ")") i++;
    }
    return c.length === 0 ? null : c.length === 1 ? c[0] : { t: "and", c };
  };
  const or = (): SearchNode | null => {
    const c: SearchNode[] = [];
    for (;;) {
      const a = and();
      if (a) c.push(a);
      if (toks[i] === "OR") {
        i++;
        continue;
      }
      break;
    }
    return c.length === 0 ? null : c.length === 1 ? c[0] : { t: "or", c };
  };
  const out: SearchNode[] = [];
  while (i < toks.length) {
    const e = or();
    if (e) out.push(e);
    if (toks[i] === ")") i++;
  }
  return out.length === 0 ? null : out.length === 1 ? out[0] : { t: "and", c: out };
}

export function evalSearch(n: SearchNode, has: (term: string) => boolean): boolean {
  switch (n.t) {
    case "term":
      return has(n.v);
    case "not":
      return !evalSearch(n.c, has);
    case "and":
      return n.c.every(c => evalSearch(c, has));
    case "or":
      return n.c.some(c => evalSearch(c, has));
  }
}
