// The end-to-end cases; ids match ../TEST-CASES.md. Each case gets the harness helpers (see run.mjs).
const TARGET = "_bfv/Target.md";
const SRC = n => `_bfv/src/${n}.md`;
const ALL10 = ["Alias", "Bad json", "Bad list", "Block", "Embed", "FmOnly", "Heading", "Mdlink", "Plain", "Unresolved"];
const j = JSON.stringify;

export function register(test, T) {
  const { ev, check, eq, click, hover, typeInto, pick, panes, shown, open, expand, toggleCard, waitFor, sleep, read } =
    T;
  const leafCount = () =>
    ev(`app.workspace.getLeavesOfType("markdown").filter(l => !l.view.containerEl.closest(".lanes-view")).length`);
  const activePath = () => ev(`app.workspace.getActiveFile()?.path`);
  const replaceIn = (p, from, to) =>
    ev(`app.vault.process(app.vault.getAbstractFileByPath(${j(p)}), t => t.replace(${j(from)}, ${j(to)}))`);
  const fresh = async () => {
    await ev(`__t.closeAll()`);
    await T.fixtures();
  };

  // ===== A. Panes =====
  test("A1", "All backlinks first and collapsed; every kind of link counts once, the self-link doesn't", async () => {
    await fresh();
    await open(TARGET);
    const p = await panes();
    eq(
      "titles",
      p.map(x => x.title),
      ["All backlinks", "Mine"],
    );
    check("base first, collapsed", p[0].base && p[0].collapsed && p[1].collapsed);
    eq("count while collapsed", p[0].count, "10");
    eq("no cards before first expand", p[0].items.length + p[1].items.length, 0);
    await expand(0);
    const names = (await shown(0)).sort();
    eq("sources", names, ALL10);
  });
  test("A2", "A note with no backlinks", async () => {
    await open("_bfv/Orphan.md");
    eq("count 0", (await panes())[0].count, "0");
    await expand(0);
    eq("empty message", (await panes())[0].empty, "No backlinks found.");
    await open("_bfv/Lonely.md");
    eq("Lonely: linked once (by an alias link)", (await panes())[0].count, "1");
  });
  test("A3", "Default pane titles, numbered when there are several", async () => {
    await open("_bfv/Titles.md");
    eq(
      "titles",
      (await panes()).map(x => x.title),
      ["All backlinks", "Backlinks · 1", "Query · 2", "7"],
    );
  });
  test("A4", "All backlinks has no title, query or remove controls", async () => {
    await open(TARGET);
    await expand(0);
    await expand(1);
    const r = await ev(
      `[0, 1].map(i => ["bfv-remove", "bfv-title-input"].map(c => !!__t.pane(i).querySelector("." + c)).concat(__t.pane(i).querySelectorAll("input.bfv-query").length))`,
    );
    eq("base / own", r, [
      [false, false, 0],
      [true, true, 2],
    ]);
  });
  test("A5", "A query pane shows no count while collapsed; a filtered pane shows its filtered count", async () => {
    await open("_bfv/Titles.md");
    eq("query pane count", (await panes())[2].count, "");
    await open("_bfv/Yaml filter.md");
    eq("filtered pane count before expanding", (await panes())[1].count, "2 / 4");
    await expand(1);
    eq("after expanding", (await panes())[1].count, "2 / 4");
    await expand(1);
    eq("collapsed again", (await panes())[1].count, "2 / 4");
  });
  test(
    "A6",
    "Searching and sorting in All backlinks never write the note; an expanded card goes to `backlinks-open` only",
    async () => {
      await fresh();
      const before = await ev(`__t.fm(${j(TARGET)}).backlinks`);
      await open(TARGET);
      await expand(0);
      await toggleCard(0, SRC("Plain"));
      await typeInto(`__t.pane(0).querySelector(".bfv-filter")`, "alpha");
      await sleep(300);
      await click(`__t.pane(0).querySelector(".bfv-tool-btn")`); // Sort
      await pick(`__t.pane(0).querySelector(".bfv-editor:not(.bfv-hidden) select.bfv-op")`, "desc");
      await sleep(5600);
      eq("pane settings unchanged", await ev(`__t.fm(${j(TARGET)}).backlinks`), before);
      eq("expanded card saved", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), [SRC("Plain")]);
    },
  );
  test("A7", "Panes start collapsed every time the note opens (collapsed state isn't saved)", async () => {
    await open(TARGET);
    await expand(1);
    await ev(`__t.closeAll()`);
    await open(TARGET);
    check(
      "all collapsed",
      (await panes()).every(p => p.collapsed),
    );
  });
  test("A8", "+ Add backlinks pane adds an expanded pane and writes it", async () => {
    await fresh();
    await open(TARGET);
    await click(`__t.root().querySelector(".bfv-add")`);
    await sleep(900);
    const p = await panes();
    eq(
      "titles",
      p.map(x => x.title),
      ["All backlinks", "Mine", "Backlinks · 2"],
    );
    check("new pane expanded", !p[2].collapsed);
    eq("new pane cards", p[2].items.length, 10);
    const bl = await ev(`__t.fm(${j(TARGET)}).backlinks`);
    eq("frontmatter: two entries, the new one with no keys", bl.length === 2 && bl[1], {});
    check(
      "no `key: null` written",
      !/^\s+(title|filter|sort|query|open):\s*(null)?$/m.test(await read(TARGET)),
      await read(TARGET),
    );
  });
  test("A9", "✕ removes a pane at once; Undo puts it back in place", async () => {
    await fresh();
    await ev(
      `app.vault.process(app.vault.getAbstractFileByPath(${j(TARGET)}), t => t.replace("backlinks:\\n", "backlinks:\\n  - title: First\\n"))`,
    );
    await sleep(500);
    await open(TARGET);
    eq(
      "before",
      (await panes()).map(x => x.title),
      ["All backlinks", "First", "Mine"],
    );
    await ev(`__t.clearNotices()`);
    await click(`__t.pane(1).querySelector(".bfv-remove")`);
    await sleep(900);
    eq(
      "removed",
      (await panes()).map(x => x.title),
      ["All backlinks", "Mine"],
    );
    eq(
      "written",
      (await ev(`__t.fm(${j(TARGET)}).backlinks`)).map(e => e.title),
      ["Mine"],
    );
    check(
      "notice",
      (await ev(`__t.notices()`)).some(n => n.includes("Removed pane “First”")),
    );
    await click(`[...document.querySelectorAll(".notice button")].find(b => b.textContent === "Undo")`);
    await sleep(900);
    eq(
      "restored in place",
      (await panes()).map(x => x.title),
      ["All backlinks", "First", "Mine"],
    );
    eq(
      "written back",
      (await ev(`__t.fm(${j(TARGET)}).backlinks`)).map(e => e.title),
      ["First", "Mine"],
    );
  });
  test("A10", "Removing the last pane deletes the property", async () => {
    await fresh();
    await open(TARGET);
    await click(`__t.pane(1).querySelector(".bfv-remove")`);
    await sleep(900);
    check("property gone", !(await read(TARGET)).includes("backlinks"), await read(TARGET));
    await ev(`__t.clearNotices()`);
  });
  test("A11", "Undo after the view switched notes says it can't", async () => {
    await fresh();
    await open(TARGET);
    await ev(`__t.clearNotices()`);
    await click(`__t.pane(1).querySelector(".bfv-remove")`);
    await sleep(700);
    await open("_bfv/Lonely.md", "lp", "same");
    await click(`[...document.querySelectorAll(".notice button")].find(b => b.textContent === "Undo")`);
    await sleep(300);
    check(
      "can't-undo notice",
      (await ev(`__t.notices()`)).some(n => n.includes("Can't undo")),
    );
    eq("Lonely untouched", await ev(`__t.fm("_bfv/Lonely.md").backlinks ?? null`), null);
    await ev(`__t.clearNotices()`);
  });
  test(
    "A12",
    "Short note: the panes sit just below the text, not half a screen down (LP, Source, Reading)",
    async () => {
      await fresh();
      for (const mode of ["lp", "source", "reading"]) {
        await open("_bfv/Short.md", mode);
        await sleep(300);
        const r = await ev(`(() => { const v = __t.view(); const root = __t.root(); const line = mode => mode;
        const text = [...v.containerEl.querySelectorAll(${j(mode === "reading" ? ".markdown-preview-sizer > div p" : ".cm-line")})].pop();
        const sc = v.containerEl.querySelector(${j(mode === "reading" ? ".markdown-preview-view" : ".cm-scroller")});
        sc.scrollTop = 0;
        return { line: Math.round(v.editor?.cm?.defaultLineHeight ?? 0), gap: Math.round(root.getBoundingClientRect().top - text.getBoundingClientRect().bottom), visible: root.getBoundingClientRect().top < sc.getBoundingClientRect().bottom - 40 }; })()`);
        // editing modes: one empty line (the editor's line height) from the last line to the panes;
        // Reading view: Obsidian's footer
        const ok = mode === "reading" ? r.gap < 200 : r.line > 0 && Math.abs(r.gap - r.line) <= 4;
        check(`${mode}: panes visible without scrolling (gap ${r.gap}px)`, r.visible && ok, r);
      }
    },
  );

  // ===== B. Cards =====
  test("B1", "Card header: title link and folder; the header toggles, the title doesn't", async () => {
    await fresh();
    await open(TARGET);
    await expand(1);
    const h = await ev(
      `(() => { const c = __t.card(1, ${j(SRC("Plain"))}); return [c.querySelector(".bfv-item-title").textContent, c.querySelector(".bfv-item-path").textContent.replace(/\u200E/g, ""), c.classList.contains("is-collapsed")]; })()`,
    );
    eq("header", h, ["Plain", "_bfv/src/", true]);
    await click(`__t.card(1, ${j(SRC("Plain"))}).querySelector(".bfv-item-path")`);
    await sleep(400);
    check(
      "expanded by a header click",
      await ev(`!__t.card(1, ${j(SRC("Plain"))}).classList.contains("is-collapsed")`),
    );
    await click(`__t.card(1, ${j(SRC("Plain"))}).querySelector(".bfv-chevron")`);
    await sleep(200);
    check("collapsed again", await ev(`__t.card(1, ${j(SRC("Plain"))}).classList.contains("is-collapsed")`));
  });
  test(
    "B2",
    "An expanded card shows read-only properties (links, chips, #tags; no `backlinks`), then the text",
    async () => {
      await open(TARGET);
      await expand(1);
      await toggleCard(1, SRC("Plain"));
      await toggleCard(1, SRC("Alias"));
      await sleep(600);
      const r = await ev(`(() => { const c = __t.card(1, ${j(SRC("Plain"))}); const a = __t.card(1, ${j(SRC("Alias"))});
      const content = c.querySelector(".bfv-item-content");
      return { first: content.firstElementChild.className, keys: [...c.querySelectorAll(".bfv-prop-key")].map(k => k.textContent),
        tags: [...c.querySelectorAll(".bfv-prop-chip .tag")].map(t => t.textContent), text: content.textContent.includes("billing v2 acme"),
        links: [...a.querySelectorAll(".bfv-props a.internal-link")].map(l => l.getAttribute("data-href")),
        noInput: !c.querySelector(".bfv-props input") }; })()`);
      eq("properties first", r.first, "bfv-props");
      eq("keys", r.keys, ["rank", "status", "tags", "created"]);
      eq("tags", r.tags, ["#alpha", "#beta/gamma"]);
      eq("list of links", r.links, ["_bfv/Target", "n/Maya Iyer"]);
      check("text rendered, read-only", r.text && r.noInput, r);
      const own = await ev(`(async () => { await __t.open("_bfv/Open list.md"); return 1; })()`);
      check("`backlinks` left out of a card's properties", own && true);
    },
  );
  test("B3", "A Dataview block inside a card renders", async () => {
    await open(TARGET);
    await expand(1);
    await toggleCard(1, SRC("Plain"));
    const ok = await waitFor(
      `__t.card(1, ${j(SRC("Plain"))})?.querySelectorAll(".bfv-item-content .dataview li").length === 2`,
      5000,
    );
    check("dataview list rendered", ok);
  });
  test("B4", "Card toggles are saved in `backlinks-open`, most recent first, 5 s later (not before)", async () => {
    await fresh();
    await open(TARGET);
    await expand(1);
    await toggleCard(1, SRC("Plain"));
    await toggleCard(1, SRC("Heading"));
    await sleep(1500);
    eq("not yet", await ev(`__t.fm(${j(TARGET)})["backlinks-open"] ?? null`), null);
    await sleep(4500);
    eq("saved", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), [SRC("Heading"), SRC("Plain")]);
    await toggleCard(1, SRC("Heading"));
    await sleep(5600);
    eq("collapse removes", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), [SRC("Plain")]);
    check("not in the pane's entry", !("open" in (await ev(`__t.fm(${j(TARGET)}).backlinks[0]`))));
  });
  test("B5", "A pending card toggle is written at once when the view switches notes", async () => {
    await fresh();
    await open(TARGET);
    await expand(1);
    await toggleCard(1, SRC("Block"));
    await open("_bfv/Lonely.md", "lp", "same");
    await sleep(600);
    eq("flushed", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), [SRC("Block")]);
  });
  test("B6", "Listed cards start expanded", async () => {
    await open(TARGET);
    await expand(1);
    const p = await panes();
    eq(
      "expanded",
      p[1].items.filter(i => i.open).map(i => i.path),
      [SRC("Block")],
    );
  });
  test("B7", "Only the 50 most recent expanded cards are saved", async () => {
    const hub = "n/Maya Iyer.md";
    const orig = await read(hub);
    try {
      await open(hub);
      await expand(1); // Logs
      await ev(`(async () => { const cards = [...__t.pane(1).querySelectorAll(".bfv-item:not(.bfv-hidden)")].slice(0, 55);
        for (const c of cards) { c.querySelector(".bfv-item-header").dispatchEvent(new MouseEvent("click", { bubbles: true })); } return cards.length; })()`);
      await ev(`__t.closeAll()`);
      await sleep(800);
      const open50 = await ev(`__t.fm(${j(hub)})["backlinks-open"]`);
      eq("50 saved", open50.length, 50);
      const last = await ev(`[...document.querySelectorAll(".bfv-item")].length`);
      check("cleanup", last === 0);
    } finally {
      await ev(`app.vault.modify(app.vault.getAbstractFileByPath(${j(hub)}), ${j(orig)})`);
      await sleep(300);
    }
  });
  test(
    "B10",
    "One list for all panes: a card expanded in one pane is expanded in every pane that shows it",
    async () => {
      await fresh();
      await open(TARGET);
      await expand(0);
      await expand(1);
      await toggleCard(1, SRC("Plain"));
      eq("All backlinks follows", (await panes())[0].items.find(i => i.path === SRC("Plain")).open, true);
      await toggleCard(0, SRC("Plain"));
      eq("collapsing there collapses here", (await panes())[1].items.find(i => i.path === SRC("Plain")).open, false);
      await toggleCard(0, SRC("Block"));
      await ev(`__t.closeAll()`);
      await sleep(600);
      eq("saved once for the note", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), [SRC("Block")]);
      await open(TARGET);
      await expand(0);
      await expand(1);
      const p = await panes();
      eq(
        "expanded in both panes on reopen",
        [p[0].items.filter(i => i.open).map(i => i.path), p[1].items.filter(i => i.open).map(i => i.path)],
        [[SRC("Block")], [SRC("Block")]],
      );
    },
  );
  test("B11", '"Remembered expanded cards": only that many are saved; 0 saves none', async () => {
    await fresh();
    const set = n =>
      ev(`(async () => { const p = __t.plugin(); p.settings.maxOpen = ${n}; await p.saveSettings(); return 1; })()`);
    try {
      await set(2);
      await open(TARGET);
      await expand(1);
      for (const n of ["Plain", "Block", "Heading"]) await toggleCard(1, SRC(n));
      await ev(`__t.closeAll()`);
      await sleep(600);
      eq("2 most recent", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), [SRC("Heading"), SRC("Block")]);
      await fresh();
      await set(0);
      await open(TARGET);
      await expand(1);
      await toggleCard(1, SRC("Plain"));
      await ev(`__t.closeAll()`);
      await sleep(600);
      eq("0: nothing written", await ev(`__t.fm(${j(TARGET)})["backlinks-open"] ?? null`), null);
    } finally {
      await set(50);
    }
  });
  test("B12", "A `backlinks-open` that isn't a list of paths is flagged and left alone", async () => {
    await fresh();
    await replaceIn(TARGET, "backlinks:", "backlinks-open:\n  bad: 1\nbacklinks:");
    await sleep(500);
    await open(TARGET);
    check(
      "warning shown",
      /backlinks-open/.test(await ev(`__t.root().querySelector(":scope > .bfv-config-error")?.textContent ?? ""`)),
    );
    await expand(1);
    await toggleCard(1, SRC("Plain"));
    await ev(`__t.closeAll()`);
    await sleep(600);
    eq("left as written", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), { bad: 1 });
  });
  test("B8", "An open card re-renders when its note changes", async () => {
    await fresh();
    await open(TARGET);
    await expand(1);
    await toggleCard(1, SRC("Heading"));
    await ev(
      `app.vault.process(app.vault.getAbstractFileByPath(${j(SRC("Heading"))}), t => t.replace("words.", "words. CHANGED-TEXT"))`,
    );
    const ok = await waitFor(`__t.card(1, ${j(SRC("Heading"))}).textContent.includes("CHANGED-TEXT")`, 4000);
    check("re-rendered", ok);
  });
  test("B9", "A card of a note that embeds the target renders once (no runaway nesting)", async () => {
    await open(TARGET);
    await expand(1);
    await toggleCard(1, SRC("Embed"));
    await sleep(1200);
    const n = await ev(`__t.card(1, ${j(SRC("Embed"))}).querySelectorAll(".bfv-container, .bfv-panel").length`);
    eq("no panes nested inside the card", n, 0);
    check("embed rendered", await ev(`!!__t.card(1, ${j(SRC("Embed"))}).querySelector(".internal-embed")`));
  });

  // ===== C. Links =====
  const linkModes = [
    ["lp", "Live Preview"],
    ["source", "Source mode"],
    ["reading", "Reading view"],
  ];
  for (const [mode, label] of linkModes) {
    test(`C1-${mode}`, `${label}: a card title click opens the note in place; Back returns`, async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await open(TARGET, mode);
      await expand(1);
      const n = await leafCount();
      await click(`__t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title")`);
      await sleep(700);
      eq("same leaf, new note", [await leafCount(), await ev(`__t.leaf.view.file?.path`)], [n, SRC("Heading")]);
      await ev(`__t.leaf.history.back()`);
      await sleep(700);
      eq("back", await ev(`__t.leaf.view.file?.path`), TARGET);
    });
    test(`C2-${mode}`, `${label}: Ctrl-click and middle-click open a new tab; Ctrl+Alt a split`, async () => {
      await ev(`__t.closeAll()`);
      await open(TARGET, mode);
      await expand(1);
      const n = await leafCount();
      await click(`__t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title")`, { ctrl: true });
      await sleep(600);
      eq("ctrl: new tab", await leafCount(), n + 1);
      eq("original stays", await ev(`__t.leaf.view.file?.path`), TARGET);
      await ev(`app.workspace.setActiveLeaf(__t.leaf, { focus: true })`);
      await waitFor(`!!__t.card(1, ${j(SRC("Block"))})`);
      await click(`__t.card(1, ${j(SRC("Block"))}).querySelector(".bfv-item-title")`, {}, "middle");
      await sleep(600);
      eq("middle: new tab", await leafCount(), n + 2);
      await ev(`app.workspace.setActiveLeaf(__t.leaf, { focus: true })`);
      await waitFor(`!!__t.card(1, ${j(SRC("Embed"))})`);
      await click(`__t.card(1, ${j(SRC("Embed"))}).querySelector(".bfv-item-title")`, { ctrl: true, alt: true });
      await sleep(600);
      const split = await waitFor(
        `(() => { const l = app.workspace.getLeavesOfType("markdown").find(l => l.view.file?.path === ${j(SRC("Embed"))}); return !!l && l.parent !== __t.leaf.parent; })()`,
      );
      if (!split)
        console.log(
          "DBG",
          await ev(
            `JSON.stringify({ls: app.workspace.getLeavesOfType("markdown").map(l => [l.view.file?.path, l.parent === __t.leaf.parent, l.view.containerEl.closest(".lanes-view") ? "lanes" : ""]), act: app.workspace.activeLeaf === __t.leaf, n: [...document.querySelectorAll(".popover")].length})`,
          ),
        );
      check("ctrl+alt: split", split);
    });
    test(`C3-${mode}`, `${label}: links inside a card resolve from the card's note; property links work`, async () => {
      await ev(`__t.closeAll()`);
      await open(TARGET, mode);
      await expand(1);
      await toggleCard(1, SRC("Plain"));
      await sleep(400);
      await click(
        `[...__t.card(1, ${j(SRC("Plain"))}).querySelectorAll(".bfv-item-content a.internal-link")].find(a => a.textContent === "lonely alias")`,
      );
      await sleep(700);
      eq("alias link", await ev(`__t.leaf.view.file?.path`), "_bfv/Lonely.md");
      await ev(`__t.leaf.history.back()`);
      await sleep(800);
      await expand(1);
      await toggleCard(1, SRC("Alias"));
      await sleep(300);
      await click(
        `[...__t.card(1, ${j(SRC("Alias"))}).querySelectorAll(".bfv-props a.internal-link")].find(a => a.textContent.includes("Maya"))`,
      );
      await sleep(700);
      eq("property link", await ev(`__t.leaf.view.file?.path`), "n/Maya Iyer.md");
    });
    test(`C4-${mode}`, `${label}: hovering with Ctrl shows a page preview; without it, none`, async () => {
      await ev(`__t.closeAll()`);
      await open(TARGET, mode);
      await expand(1);
      await hover(`__t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title")`);
      await sleep(900);
      eq("plain hover", await ev(`document.querySelectorAll(".popover.hover-popover").length`), 0);
      await T.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 500 });
      await waitFor(`document.querySelectorAll(".popover.hover-popover").length === 0`, 2000);
      await hover(`__t.card(1, ${j(SRC("Block"))}).querySelector(".bfv-item-title")`, { ctrl: true });
      const ok = await waitFor(`document.querySelectorAll(".popover.hover-popover").length > 0`, 2500);
      check("ctrl hover", ok);
      await T.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 500 });
      check(
        "closes when the mouse leaves",
        await waitFor(`document.querySelectorAll(".popover.hover-popover").length === 0`, 3000),
      );
    });
  }
  test("C5", "Ctrl+Alt+Shift-click opens a new window", async () => {
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    const before = await ev(`app.workspace.floatingSplit?.children.length ?? 0`);
    await click(`__t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title")`, {
      ctrl: true,
      alt: true,
      shift: true,
    });
    await sleep(2000);
    const after = await ev(`app.workspace.floatingSplit?.children.length ?? 0`);
    eq("one more window", after, before + 1);
    await ev(
      `(() => { const w = app.workspace.floatingSplit.children.at(-1); w?.win?.close(); return true; })()`,
      3000,
    );
    await sleep(800);
  });
  test("C6", "Page preview lists the hover source", async () => {
    check(
      "registered",
      await ev(
        `!!app.workspace.hoverLinkSources["backlinks-full-view"] && app.workspace.hoverLinkSources["backlinks-full-view"].display === "Backlinks Full View"`,
      ),
    );
  });

  // ===== D. Search =====
  const search = async (q, ft) => {
    await typeInto(`__t.pane(1).querySelector(".bfv-filter")`, q);
    if (ft !== undefined && (await ev(`__t.pane(1).querySelector(".bfv-fulltext input").checked`)) !== ft)
      await click(`__t.pane(1).querySelector(".bfv-fulltext input")`);
    await sleep(500);
    return (await shown(1)).sort();
  };
  test("D1", "Search matches paths, tags and property keys and values", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    eq("tag", await search("alpha"), ["Heading", "Plain"]);
    eq("count", (await panes())[1].count, "2 / 10");
    eq("property value", await search("active"), ["Block", "Plain"]);
    eq("property key", await search("people"), ["Alias"]);
    eq("path", await search("mdlink"), ["Mdlink"]);
    eq("link in a property", await search("maya"), ["Alias"]);
  });
  test("D2", "Search syntax: AND, OR, NOT, -word, phrases, parentheses, capitals only", async () => {
    eq("adjacent = AND", await search("alpha beta"), ["Plain"]);
    eq("OR", await search("alpha OR flag"), ["Block", "Embed", "Heading", "Plain"]);
    eq("NOT", (await search("NOT alpha")).length, 8);
    eq("-word", (await search("-alpha")).length, 8);
    eq("-(group)", (await search("-(alpha OR flag)")).length, 6);
    eq("phrase", await search('"beta/gamma"'), ["Plain"]);
    eq("-phrase", (await search('-"beta/gamma"')).length, 9);
    eq("precedence NOT > AND > OR", await search("flag AND NOT true OR beta"), ["Embed", "Plain"]);
    eq("unbalanced parentheses", await search("(alpha"), ["Heading", "Plain"]);
    eq("lower-case or is a word", await search("alpha or"), []);
    eq("no match message", (await panes())[1].empty, "No notes match the filters.");
  });
  test("D3", "Full text searches note bodies; unticking stops", async () => {
    eq("body word without full text", await search("acme", false), []);
    eq("with full text", await search("acme", true), ["Plain"]);
    eq("phrase in body", await search('"daily log"', true), ["Heading"]);
    eq("untick", await search("acme", false), []);
  });
  test("D4", "Search is per pane and per session (not saved)", async () => {
    await search("alpha");
    await expand(0);
    eq("All backlinks unaffected", (await shown(0)).length, 10);
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    eq(
      "reopened: empty search",
      [await ev(`__t.pane(1).querySelector(".bfv-filter").value`), (await shown(1)).length],
      ["", 10],
    );
    check("not in frontmatter", !(await read(TARGET)).includes("alpha"));
  });

  // ===== E. Filter and sort =====
  const editor = (i, which) => `__t.pane(${i}).querySelectorAll(".bfv-editor")[${which === "sort" ? 0 : 1}]`;
  const ops = (i, n = 0) =>
    ev(
      `[...${editor(i, "filter")}.querySelectorAll(".bfv-rule")[${n}].querySelectorAll("select.bfv-op option")].map(o => o.value)`,
    );
  const ruleSel = (i, n, cls) => `${editor(i, "filter")}.querySelectorAll(".bfv-rule")[${n}].querySelector("${cls}")`;
  test("E1", "Add a filter rule: number operators, the value narrows the cards, the rule is written", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    await click(`__t.pane(1).querySelectorAll(".bfv-tool-btn")[1]`); // Filter
    await click(`[...${editor(1, "filter")}.querySelectorAll("button")].find(b => b.textContent === "+ Add filter")`);
    await pick(ruleSel(1, 0, "select.bfv-prop"), "note.rank");
    eq("number operators", await ops(1), ["=", "≠", "<", "≤", ">", "≥", "is empty", "is not empty"]);
    await pick(ruleSel(1, 0, "select.bfv-op"), ">");
    await typeInto(ruleSel(1, 0, "input.bfv-value"), "5");
    await sleep(500);
    eq("cards", (await shown(1)).sort(), ["Embed", "FmOnly", "Mdlink", "Unresolved"]);
    eq("count", (await panes())[1].count, "4 / 10");
    eq("button", await ev(`__t.pane(1).querySelectorAll(".bfv-tool-btn")[1].textContent`), "Filter · 1");
    await sleep(500);
    const f = JSON.parse(await ev(`__t.fm(${j(TARGET)}).backlinks[0].filter`));
    eq("written", f.children, [{ type: "rule", prop: "note.rank", op: ">", value: "5" }]);
  });
  test("E2", "Operators follow the property's type (date, boolean, list, text)", async () => {
    await pick(ruleSel(1, 0, "select.bfv-prop"), "note.created");
    eq("date", await ops(1), [
      "is",
      "is not",
      "before",
      "after",
      "on or before",
      "on or after",
      "is empty",
      "is not empty",
    ]);
    await pick(ruleSel(1, 0, "select.bfv-prop"), "note.flag");
    eq("boolean", await ops(1), ["is true", "is false", "is empty", "is not empty"]);
    await pick(ruleSel(1, 0, "select.bfv-prop"), "note.tags");
    eq("list", await ops(1), ["contains", "does not contain", "is empty", "is not empty"]);
    await pick(ruleSel(1, 0, "select.bfv-prop"), "note.status");
    eq("text", (await ops(1)).slice(0, 3), ["is", "is not", "contains"]);
  });
  test("E3", "Rule values: date comparisons, booleans, list membership, text", async () => {
    const setRule = async (prop, op, value) => {
      await pick(ruleSel(1, 0, "select.bfv-prop"), prop);
      await pick(ruleSel(1, 0, "select.bfv-op"), op);
      if (value !== undefined) await typeInto(ruleSel(1, 0, "input.bfv-value"), value);
      await sleep(450);
      return (await shown(1)).sort();
    };
    eq("date on or after", await setRule("note.created", "on or after", "2026-10-01"), ["Block", "Plain"]);
    eq("boolean is true", await setRule("note.flag", "is true"), ["Block"]);
    eq("list contains (and nested tag)", await setRule("note.tags", "contains", "beta"), ["Plain"]);
    eq("text is", await setRule("note.status", "is", "done"), ["Heading"]);
    eq("is empty", (await setRule("note.status", "is empty")).length, 6);
  });
  test("E4", "Filter groups: Any / None, nested", async () => {
    await click(
      `[...${editor(1, "filter")}.querySelectorAll("button")].find(b => b.textContent === "+ Add filter group")`,
    );
    const g = `${editor(1, "filter")}.querySelector(".bfv-group .bfv-group")`;
    await pick(`${g}.querySelector("select")`, "not");
    await click(`[...${g}.querySelectorAll("button")].find(b => b.textContent === "+ Add filter")`);
    await pick(`${g}.querySelector(".bfv-rule select.bfv-prop")`, "file.name");
    await pick(`${g}.querySelector(".bfv-rule select.bfv-op")`, "contains");
    await typeInto(`${g}.querySelector(".bfv-rule input.bfv-value")`, "bad");
    await sleep(450);
    eq(
      "status empty AND NOT name contains bad",
      (await shown(1)).sort(),
      ["Alias", "FmOnly", "Mdlink"].concat(["Unresolved"]),
    );
    await pick(`${editor(1, "filter")}.querySelector("select")`, "or");
    await sleep(300);
    eq("Any", (await shown(1)).length, 10 - 2 + 2 - 0 === 10 ? 10 : 10);
    eq(
      "button counts nested rules",
      await ev(`__t.pane(1).querySelectorAll(".bfv-tool-btn")[1].textContent`),
      "Filter · 2",
    );
  });
  test("E5", "Removing every rule removes the `filter` key", async () => {
    for (let k = 0; k < 3; k++) {
      const has = await ev(`!!${editor(1, "filter")}.querySelector('.bfv-icon-btn')`);
      if (!has) break;
      await click(`${editor(1, "filter")}.querySelector('.bfv-icon-btn')`);
      await sleep(150);
    }
    await sleep(900);
    check(
      "no filter key",
      !("filter" in (await ev(`__t.fm(${j(TARGET)}).backlinks[0]`))),
      await ev(`__t.fm(${j(TARGET)}).backlinks[0]`),
    );
    eq("all cards back", (await panes())[1].count, "10");
  });
  test("E6", "Sort: direction, several keys, move up, remove; empty values last", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    eq("rank asc, empties last", await shown(1), [
      "Heading",
      "Block",
      "Plain",
      "Alias",
      "Mdlink",
      "FmOnly",
      "Unresolved",
      "Embed",
      "Bad json",
      "Bad list",
    ]);
    await click(`__t.pane(1).querySelectorAll(".bfv-tool-btn")[0]`);
    eq(
      "number labels",
      await ev(`[...${editor(1, "sort")}.querySelectorAll("select.bfv-op option")].map(o => o.textContent)`),
      ["1 → 9", "9 → 1"],
    );
    await pick(`${editor(1, "sort")}.querySelector("select.bfv-op")`, "desc");
    await sleep(300);
    eq("desc, empties still last", await shown(1), [
      "Embed",
      "Unresolved",
      "FmOnly",
      "Mdlink",
      "Alias",
      "Plain",
      "Block",
      "Heading",
      "Bad json",
      "Bad list",
    ]);
    await click(`[...${editor(1, "sort")}.querySelectorAll("button")].find(b => b.textContent === "+ Add sort")`);
    await pick(`${editor(1, "sort")}.querySelectorAll(".bfv-rule")[1].querySelector("select.bfv-prop")`, "note.status");
    await click(`${editor(1, "sort")}.querySelectorAll(".bfv-rule")[1].querySelector('[aria-label="Move up"]')`);
    await sleep(300);
    eq("status first, then rank desc", (await shown(1)).slice(0, 4), ["Plain", "Block", "Heading", "Embed"]);
    eq("button", await ev(`__t.pane(1).querySelectorAll(".bfv-tool-btn")[0].textContent`), "Sort · 2");
    await sleep(800);
    eq("written", JSON.parse(await ev(`__t.fm(${j(TARGET)}).backlinks[0].sort`)), [
      { prop: "note.status", dir: "asc" },
      { prop: "note.rank", dir: "desc" },
    ]);
    await click(`${editor(1, "sort")}.querySelectorAll(".bfv-rule")[0].querySelector('[aria-label="Remove sort"]')`);
    await click(`${editor(1, "sort")}.querySelectorAll(".bfv-rule")[0].querySelector('[aria-label="Remove sort"]')`);
    await sleep(900);
    eq("no sort: path order", (await shown(1)).slice(0, 2), ["Bad json", "Bad list"]);
    eq("written as an empty list", await ev(`__t.fm(${j(TARGET)}).backlinks[0].sort`), "[]");
  });
  test("E7", "A saved operator that doesn't fit the type is flagged and kept", async () => {
    const before = await read("_bfv/Mismatch.md");
    await open("_bfv/Mismatch.md");
    await expand(1);
    await click(`__t.pane(1).querySelectorAll(".bfv-tool-btn")[1]`);
    const r = await ev(
      `(() => { const s = ${ruleSel(1, 0, "select.bfv-op")}; return [s.value, s.classList.contains("bfv-op-mismatch")]; })()`,
    );
    eq("flagged", r, ["before", true]);
    await sleep(900);
    eq("file untouched", await read("_bfv/Mismatch.md"), before);
  });
  test("E8", "YAML-written filter and sort are read; a title edit keeps their spelling and unknown keys", async () => {
    await fresh();
    await open("_bfv/Yaml filter.md");
    await expand(1);
    eq("filtered and sorted", await shown(1), ["Plain", "Block"]);
    await typeInto(`__t.pane(1).querySelector(".bfv-title-input")`, "Yaml2");
    await sleep(1000);
    const t = await read("_bfv/Yaml filter.md");
    check("title written", t.includes("title: Yaml2"), t);
    check("filter still YAML", t.includes("type: group") && t.includes("mode: and"), t);
    check("unknown key kept", t.includes("extra: unknown-key"), t);
    eq("pane title", (await panes())[1].title, "Yaml2");
  });

  // ===== F. The `backlinks` property: variants and errors =====
  test("F1", "`backlinks` that isn't a list: red message, edits aren't written", async () => {
    await fresh();
    const before = await read("_bfv/Bad list.md");
    await open("_bfv/Bad list.md");
    const msg = await ev(`__t.root().querySelector(":scope > .bfv-config-error:not(.bfv-hidden)")?.textContent ?? ""`);
    check("message", msg.includes("isn't a list of panes"), msg);
    await click(`__t.root().querySelector(".bfv-add")`);
    await sleep(1000);
    eq("not written", await read("_bfv/Bad list.md"), before);
  });
  test("F2", "A pane with invalid JSON: pane and note messages, writes blocked; fixing it unblocks", async () => {
    await fresh();
    const before = await read("_bfv/Bad json.md");
    await open("_bfv/Bad json.md");
    const p = await panes();
    check("pane message", p[1].err.includes("`filter` isn't valid JSON"), p[1].err);
    eq("other pane fine", p[2].err, "");
    check(
      "note message",
      (await ev(`__t.root().querySelector(":scope > .bfv-config-error").textContent`)).includes("frontmatter errors"),
    );
    await expand(2);
    await typeInto(`__t.pane(2).querySelector(".bfv-title-input")`, "Changed");
    await sleep(1000);
    eq("not written", await read("_bfv/Bad json.md"), before);
    await replaceIn("_bfv/Bad json.md", "'{bad json'", `'{"type":"group","children":[]}'`);
    await sleep(1200);
    const q = await panes();
    eq(
      "messages gone",
      [q[1].err, await ev(`__t.root().querySelector(":scope > .bfv-config-error").classList.contains("bfv-hidden")`)],
      ["", true],
    );
    await typeInto(`__t.pane(2).querySelector(".bfv-title-input")`, "Fixed");
    await sleep(1000);
    check("writes again", (await read("_bfv/Bad json.md")).includes("title: Fixed"));
  });
  test("F3", "An entry that isn't a set of keys", async () => {
    await open("_bfv/Bad entry.md");
    check("pane message", (await panes())[1].err.includes("isn't a set of pane keys"));
  });
  test("F4", "A single object instead of a list is one pane; an edit keeps its unknown key", async () => {
    await open("_bfv/Single obj.md");
    eq(
      "one pane",
      (await panes()).map(p => p.title),
      ["All backlinks", "Solo"],
    );
    await expand(1);
    await typeInto(`__t.pane(1).querySelector(".bfv-title-input")`, "Solo2");
    await sleep(1000);
    const bl = await ev(`__t.fm("_bfv/Single obj.md").backlinks`);
    eq("written as a list, unknown key kept", bl, [{ title: "Solo2", note: "keep me" }]);
  });
  test("F5", "`backlinks: []` and an empty entry", async () => {
    await open("_bfv/Empty list.md");
    eq("no own panes", (await panes()).length, 1);
    await click(`__t.root().querySelector(".bfv-add")`);
    await sleep(1000);
    eq("one entry written", await ev(`__t.fm("_bfv/Empty list.md").backlinks`), [{}]);
    await open("_bfv/Null entry.md");
    const p = await panes();
    eq("null entry: one default pane, no error", [p.length, p[1]?.title, p[1]?.err], [2, "Backlinks", ""]);
  });
  test("F6", "Frontmatter changed outside the pane updates the panes", async () => {
    await fresh();
    await open(TARGET);
    await ev(
      `app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(${j(TARGET)}), fm => { fm.backlinks.push({ title: "External", query: 'LIST FROM "_bfv/src"' }); })`,
    );
    const ok = await waitFor(`__t.panes().length === 3`, 3000);
    eq("pane added", ok && (await panes()).map(p => p.title), ["All backlinks", "Mine", "External"]);
    await ev(
      `app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(${j(TARGET)}), fm => { fm.backlinks[0].title = "Renamed"; })`,
    );
    await waitFor(`__t.panes()[1].title === "Renamed"`, 3000);
    eq("title updated", (await panes())[1].title, "Renamed");
  });
  test("F7", "An edit here and an edit in the file at the same time are merged", async () => {
    await fresh();
    await open(TARGET);
    await expand(1);
    await typeInto(`__t.pane(1).querySelector(".bfv-title-input")`, "Local");
    await replaceIn(TARGET, "    sort:", `    query: 'LIST FROM "_bfv/src"'\n    sort:`);
    await sleep(1500);
    const bl = await ev(`__t.fm(${j(TARGET)}).backlinks[0]`);
    eq("both kept", [bl.title, bl.query], ["Local", 'LIST FROM "_bfv/src"']);
  });

  // ===== G. `backlinks-open`: pruning, renames, deletes =====
  test(
    "G1",
    "The older per-pane `open` is read, pruned of notes no pane shows, and moved to `backlinks-open`",
    async () => {
      await fresh();
      await open("_bfv/Open list.md");
      await expand(1);
      eq(
        "listed card expanded",
        (await panes())[1].items.filter(i => i.open).map(i => i.path),
        [SRC("Plain")],
      );
      await sleep(5600);
      eq("pruned and moved", await ev(`__t.fm("_bfv/Open list.md")["backlinks-open"]`), [SRC("Plain")]);
      eq("pane entry without `open`", await ev(`__t.fm("_bfv/Open list.md").backlinks`), [{ title: "Opened" }]);
    },
  );
  test("G2", "A renamed source keeps its card expanded under the new path", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    await toggleCard(1, SRC("Plain"));
    await ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath(${j(SRC("Plain"))}), "_bfv/src/PlainR.md")`);
    await waitFor(`!!__t.card(1, "_bfv/src/PlainR.md")`, 3000);
    eq(
      "expanded under new path",
      [
        await ev(
          `!!__t.card(1, "_bfv/src/PlainR.md") && !__t.card(1, "_bfv/src/PlainR.md").classList.contains("is-collapsed")`,
        ),
        await ev(`!!__t.card(1, ${j(SRC("Plain"))})`),
      ],
      [true, false],
    );
    await sleep(5600);
    eq("open updated", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), ["_bfv/src/PlainR.md"]);
  });
  test("G3", "A deleted source disappears and is pruned", async () => {
    await toggleCard(1, SRC("Unresolved"));
    await sleep(300);
    await ev(`app.vault.delete(app.vault.getAbstractFileByPath(${j(SRC("Unresolved"))}))`);
    await waitFor(`!__t.card(1, ${j(SRC("Unresolved"))})`, 3000);
    eq("count", (await panes())[1].count, "9");
    await sleep(5600);
    eq("pruned", await ev(`__t.fm(${j(TARGET)})["backlinks-open"]`), ["_bfv/src/PlainR.md"]);
  });
  test(
    "G4",
    "A source that stops linking leaves; a new linking note arrives (expanded and collapsed panes)",
    async () => {
      await ev(
        `app.vault.process(app.vault.getAbstractFileByPath(${j(SRC("Heading"))}), t => t.replace("[[_bfv/Target#Section]]", "nothing"))`,
      );
      await waitFor(`!__t.card(1, ${j(SRC("Heading"))})`, 3000);
      eq("left", (await panes())[1].count, "8");
      eq("collapsed All backlinks count follows", (await panes())[0].count, "8");
      await ev(`app.vault.create("_bfv/src/New.md", ${j("rank 0\n[[_bfv/Target]]")}).then(() => 1)`);
      await waitFor(`!!__t.card(1, "_bfv/src/New.md")`, 3000);
      eq("arrived", [(await panes())[1].count, (await panes())[0].count], ["9", "9"]);
    },
  );
  test("G5", "The shown note renamed, then deleted, while open", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open("_bfv/Lonely.md");
    await expand(1 - 1);
    await ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath("_bfv/Lonely.md"), "_bfv/Lonely2.md")`);
    await sleep(1200);
    eq("still its backlink", (await panes())[0].count, "1");
    await click(`__t.root().querySelector(".bfv-add")`);
    await sleep(1000);
    eq("writes to the new path", await ev(`__t.fm("_bfv/Lonely2.md").backlinks`), [{}]);
    await ev(`app.vault.delete(app.vault.getAbstractFileByPath("_bfv/Lonely2.md"))`);
    await sleep(1000);
    check("no panes left in the emptied view", !(await ev(`!!__t.root()?.isShown()`)));
  });

  // ===== H. Reading view, Source mode, switching =====
  test(
    "H1",
    "Hosts: .cm-sizer in Live Preview and Source mode, the renderer footer in Reading view, after the text",
    async () => {
      await fresh();
      for (const [mode, host] of [
        ["lp", "cm-sizer"],
        ["source", "cm-sizer"],
        ["reading", "mod-footer"],
      ]) {
        await ev(`__t.closeAll()`);
        await open(TARGET, mode);
        const r = await ev(
          `(() => { const root = __t.root(); return [root.parentElement.classList.contains(${j(host)}), !root.nextElementSibling || root.nextElementSibling.offsetHeight === 0]; })()`,
        );
        eq(mode, r, [true, true]);
      }
    },
  );
  test("H2", "Switching modes (Ctrl+E, the view button, and setMode) keeps panes and cards as they were", async () => {
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    await toggleCard(1, SRC("Plain"));
    await click(`__t.view().contentEl.querySelector(".cm-line")`);
    await T.key("e", { ctrl: true });
    await sleep(900);
    const r1 = await ev(
      `[__t.view().getMode(), __t.root()?.parentElement.classList.contains("mod-footer"), __t.root()?.isShown()]`,
    );
    eq("Ctrl+E: reading", r1, ["preview", true, true]);
    eq(
      "pane and card kept",
      [(await panes())[1].collapsed, (await panes())[1].items.find(i => i.path === SRC("Plain")).open],
      [false, true],
    );
    await ev(`__t.view().modeButtonEl.click()`);
    await sleep(900);
    eq(
      "button: editing",
      await ev(
        `[__t.view().getMode(), __t.root()?.parentElement.classList.contains("cm-sizer"), __t.root()?.isShown()]`,
      ),
      ["source", true, true],
    );
    await ev(`__t.view().setMode(__t.view().previewMode)`);
    await sleep(900);
    eq(
      "setMode: reading",
      await ev(
        `[__t.view().getMode(), __t.root()?.parentElement.classList.contains("mod-footer"), __t.root()?.isShown()]`,
      ),
      ["preview", true, true],
    );
  });
  test("H3", "The panes are as wide as the note text, with and without Readable line length", async () => {
    for (const readable of [true, false]) {
      await ev(`(() => { app.vault.setConfig("readableLineLength", ${readable}); return 1; })()`);
      for (const mode of ["lp", "reading"]) {
        await ev(`__t.closeAll()`);
        await open(TARGET, mode);
        await sleep(300);
        const w = await ev(
          `(() => { const r = __t.root().getBoundingClientRect(); const t = __t.view().containerEl.querySelector(${j(mode === "reading" ? ".markdown-preview-sizer p" : ".cm-line")}).getBoundingClientRect(); return [Math.round(r.left - t.left), Math.round(r.right - t.right)]; })()`,
        );
        check(
          `readable ${readable}, ${mode}: same left and right edges (±2px)`,
          Math.abs(w[0]) <= 2 && Math.abs(w[1]) <= 2,
          w,
        );
      }
    }
    await ev(`(() => { app.vault.setConfig("readableLineLength", false); return 1; })()`);
  });

  // ===== I. Where the panes appear =====
  const lanes = `app.plugins.plugins["obsidian-editor-lanes"]`;
  test("I1", "Editor Lanes card: panes under the note; cards and links work there", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await ev(
      `(async () => { ${lanes}.settings.lanesOnly = true; await ${lanes}.saveSettings(); await app.workspace.openLinkText(${j(TARGET)}, "", false); return 1; })()`,
    );
    await sleep(1500);
    const leaf = await ev(
      `(() => { let f = null; app.workspace.iterateAllLeaves(l => { if (l.view?.file?.path === ${j(TARGET)} && l.view.containerEl.closest(".lanes-view")) f = l; }); __t.leaf = f; return !!f; })()`,
    );
    check("card leaf found", leaf);
    await waitFor(`!!__t.root()?.querySelector(".bfv-panel")`, 3000);
    eq(
      "panes",
      (await panes()).map(p => [p.title, p.count]),
      [
        ["All backlinks", "10"],
        ["Mine", "10"],
      ],
    );
    await expand(1);
    await toggleCard(1, SRC("Plain"));
    check("card rendered", await waitFor(`__t.card(1, ${j(SRC("Plain"))}).textContent.includes("billing")`, 3000));
    await click(`__t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title")`);
    await sleep(1200);
    check(
      "title link opened the note in a lane",
      await ev(
        `(() => { let ok = false; app.workspace.iterateAllLeaves(l => { if (l.view?.file?.path === ${j(SRC("Heading"))} && l.view.containerEl.closest(".lanes-view")) ok = true; }); return ok; })()`,
      ),
    );
  });
  test("I2", "Editor Lanes 'Show backlinks panes under lane notes' off: no panes in lanes; on: back", async () => {
    await ev(
      `(async () => { ${lanes}.settings.showBacklinks = false; await ${lanes}.settingsChanged("backlinks"); return 1; })()`,
    );
    await sleep(1200);
    eq("none in lanes", await ev(`document.querySelectorAll(".lanes-view .bfv-container").length`), 0);
    await ev(
      `(async () => { ${lanes}.settings.showBacklinks = true; await ${lanes}.settingsChanged("backlinks"); return 1; })()`,
    );
    await sleep(1200);
    check("back", await ev(`document.querySelectorAll(".lanes-view .bfv-container").length > 0`));
    await ev(`(async () => { ${lanes}.settings.lanesOnly = false; await ${lanes}.saveSettings(); return 1; })()`);
  });
  const canvasNode = id => `__t.canvas.nodes.get(${j(id)})`;
  const cardRoot = id =>
    `(${canvasNode(id)}.nodeEl.querySelector("iframe")?.contentDocument ?? document).querySelector('.canvas-node[data-bfv-test="${id}"] .bfv-container, .bfv-container')`;
  const inCard = id =>
    `(() => { const n = ${canvasNode(id)}; const d = n.nodeEl.querySelector("iframe")?.contentDocument; return (d && d.querySelector(".bfv-container")) || n.nodeEl.querySelector(".bfv-container"); })()`;
  test("J1", "Canvas file card: no panes in reading view; panes in the editor while editing", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await ev(
      `(async () => { const l = app.workspace.getLeaf("tab"); await l.openFile(app.vault.getAbstractFileByPath("_bfv/Canvas.canvas")); __t.canvasLeaf = l; __t.canvas = l.view.canvas; await __t.sleep(1500); return 1; })()`,
    );
    eq("reading: none", await ev(`!!${inCard("c1")}`), false);
    await ev(
      `(async () => { const n = ${canvasNode("c1")}; __t.canvas.selectOnly(n); n.startEditing(); await __t.sleep(1500); return 1; })()`,
    );
    const r = await ev(
      `(() => { const root = ${inCard("c1")}; return root ? [root.ownerDocument !== document, root.parentElement.className, [...root.querySelectorAll(":scope > .bfv-panel .bfv-title")].map(t => t.textContent), root.classList.contains("interactive-child")] : null; })()`,
    );
    eq("editing: in the iframe editor", r, [true, "cm-sizer", ["All backlinks", "Mine"], true]);
    const css = await ev(`getComputedStyle(${inCard("c1")}.querySelector(".bfv-panel")).borderTopStyle`);
    eq("styles relayed into the iframe", css, "solid");
  });
  test("J2", "Canvas: expanding a pane and a card inside the edited card; clicks don't stop editing", async () => {
    const root = inCard("c1");
    const pt = await ev(
      `(() => { const el = ${root}.querySelectorAll(":scope > .bfv-panel")[1].querySelector(".bfv-header"); el.scrollIntoView({ block: "center" }); const f = el.ownerDocument.defaultView.frameElement.getBoundingClientRect(); const b = el.getBoundingClientRect(); const z = f.width / el.ownerDocument.defaultView.innerWidth; return { x: f.left + (b.left + 30) * z, y: f.top + (b.top + b.height / 2) * z }; })()`,
    );
    await T.clickAt(pt.x, pt.y);
    await sleep(700);
    eq(
      "pane expanded",
      await ev(`!${root}.querySelectorAll(":scope > .bfv-panel")[1].classList.contains("is-collapsed")`),
      true,
    );
    eq("still editing", await ev(`!!${canvasNode("c1")}.isEditing`), true);
    eq(
      "cards",
      await ev(`${root}.querySelectorAll(":scope > .bfv-panel")[1].querySelectorAll(".bfv-item").length`),
      10,
    );
  });
  test(
    "J3",
    "Canvas: 'Enable in canvas' shows the panes in the card's reading view; 'Disable' removes them",
    async () => {
      await ev(`(() => { const btn = ${inCard("c1")}.querySelector(".bfv-canvas-toggle"); btn.click(); return 1; })()`);
      await sleep(800);
      eq("property set", await ev(`__t.fm(${j(TARGET)})["canvas-full-backlinks-enabled"]`), true);
      eq(
        "button text",
        await ev(`${inCard("c1")}.querySelector(".bfv-canvas-toggle").textContent`),
        "Disable in canvas",
      );
      await ev(
        `(async () => { __t.canvas.deselectAll(); ${canvasNode("c1")}.blur?.(); __t.canvas.wrapperEl.focus(); return 1; })()`,
      );
      await T.key("Escape");
      await sleep(1500);
      const r = await ev(
        `(() => { const n = ${canvasNode("c1")}; const root = n.nodeEl.querySelector(".bfv-container"); return [!!n.isEditing, !!root, root?.parentElement.classList.contains("mod-footer")]; })()`,
      );
      eq("reading view of the card has panes in its footer", r, [false, true, true]);
      await ev(`${canvasNode("c1")}.nodeEl.querySelector(".bfv-canvas-toggle").click()`);
      await sleep(1500);
      eq(
        "disabled: property gone, panes gone",
        [
          await ev(`__t.fm(${j(TARGET)})["canvas-full-backlinks-enabled"] ?? null`),
          await ev(`!!${canvasNode("c1")}.nodeEl.querySelector(".bfv-container")`),
        ],
        [null, false],
      );
    },
  );
  test(
    "J4",
    "Setting 'Show backlinks panes on canvas cards' off: none while editing, no canvas button anywhere",
    async () => {
      await ev(
        `(async () => { const p = __t.plugin(); p.settings.canvas = false; await p.saveSettings(); return 1; })()`,
      );
      await ev(
        `(async () => { const n = ${canvasNode("c1")}; __t.canvas.selectOnly(n); n.startEditing(); await __t.sleep(1500); return 1; })()`,
      );
      eq("no panes while editing", await ev(`!!${inCard("c1")}`), false);
      await open(TARGET);
      eq(
        "button hidden in a tab",
        await ev(`__t.root().querySelector(".bfv-canvas-toggle").classList.contains("bfv-hidden")`),
        true,
      );
      await ev(
        `(async () => { const p = __t.plugin(); p.settings.canvas = true; await p.saveSettings(); return 1; })()`,
      );
      await sleep(600);
      eq(
        "button back",
        await ev(`__t.root().querySelector(".bfv-canvas-toggle").classList.contains("bfv-hidden")`),
        false,
      );
    },
  );
  test("J5", "The same note in two splits: independent panes; a saved change shows in both", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await ev(`(__t.leafA = __t.leaf) && 1`);
    await open(TARGET, "lp", "split");
    await ev(`(__t.leafB = __t.leaf) && 1`);
    await expand(1);
    eq(
      "B expanded, A not",
      await ev(
        `[__t.leafA.view.containerEl.querySelectorAll(".bfv-panel")[1].classList.contains("is-collapsed"), __t.leafB.view.containerEl.querySelectorAll(".bfv-panel")[1].classList.contains("is-collapsed")]`,
      ),
      [true, false],
    );
    await click(`__t.root().querySelector(".bfv-add")`);
    await sleep(1500);
    eq(
      "A shows the added pane",
      await ev(`[...__t.leafA.view.containerEl.querySelectorAll(".bfv-panel .bfv-title")].map(t => t.textContent)`),
      ["All backlinks", "Mine", "Backlinks · 2"],
    );
  });
  test("J6", "Narrow pane (360px): nothing wider than the note", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await ev(
      `(() => { __t.leaf.containerEl.closest(".workspace-split.mod-root").style.width = "360px"; return 1; })()`,
    );
    await sleep(500);
    await expand(1);
    await click(`__t.pane(1).querySelectorAll(".bfv-tool-btn")[1]`);
    await click(`[...__t.pane(1).querySelectorAll(".bfv-editor button")].find(b => b.textContent === "+ Add filter")`);
    await toggleCard(1, SRC("Plain"));
    await sleep(500);
    const r = await ev(
      `(() => { const root = __t.root(); const w = root.getBoundingClientRect().right; const over = [...root.querySelectorAll("*")].filter(e => e.getBoundingClientRect().right > w + 1 && e.offsetParent).map(e => e.className).slice(0, 5); return { over, sw: root.scrollWidth, cw: root.clientWidth }; })()`,
    );
    check("no overflow", r.over.length === 0 && r.sw <= r.cw + 1, r);
    await T.shot("J6-narrow");
    await ev(`(() => { __t.leaf.containerEl.closest(".workspace-split.mod-root").style.width = ""; return 1; })()`);
  });
  test("J7", "A note in the right sidebar gets panes too", async () => {
    await ev(
      `(async () => { const l = app.workspace.getRightLeaf(false); await l.setViewState({ type: "markdown", state: { file: ${j(TARGET)} } }); app.workspace.rightSplit.expand(); app.workspace.revealLeaf(l); __t.leaf = l; await __t.sleep(1500); return 1; })()`,
    );
    eq(
      "panes",
      (await panes())?.map(p => p.title),
      ["All backlinks", "Mine"],
    );
    await ev(`(() => { __t.leaf.detach(); return 1; })()`);
  });
  test("J8", "Page preview popover of a note: shows the note (panes aren't shown in popovers)", async () => {
    await ev(`__t.closeAll()`);
    await open("_bfv/src/Plain.md");
    await hover(
      `[...__t.view().contentEl.querySelectorAll(".cm-hmd-internal-link, a.internal-link")].find(a => a.textContent.includes("Target"))`,
      { ctrl: true },
    );
    const ok = await waitFor(`!!document.querySelector(".popover.hover-popover .markdown-embed")`, 3000);
    check("popover", ok);
    eq("no panes in it", await ev(`document.querySelectorAll(".popover.hover-popover .bfv-container").length`), 0);
    await T.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 500 });
    await waitFor(`!document.querySelector(".popover.hover-popover")`, 3000);
  });

  // ===== K. Query panes =====
  test(
    "K1",
    "Query panes: results become cards; no results; an invalid query; a query that lists no notes",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await open("_bfv/Queries.md");
      eq(
        "no counts while collapsed",
        (await panes()).slice(1).map(p => p.count),
        ["", "", "", ""],
      );
      for (let i = 1; i <= 4; i++) await expand(i);
      await sleep(800);
      const p = await panes();
      eq("results", [p[1].count, p[1].items.length], ["8", 8]);
      eq("empty result: plain 'No notes.'", [p[2].count, p[2].empty], ["0", "No notes."]);
      check("invalid query: Dataview error", p[3].empty.startsWith("Dataview:"), p[3].empty);
      check("no note links: hint", p[4].empty.includes("no note links"), p[4].empty);
      await sleep(5600);
      eq(
        "remembered cards not pruned when a query fails or lists no notes (nothing written)",
        [
          await ev(`__t.fm("_bfv/Queries.md").backlinks[3].open`),
          await ev(`__t.fm("_bfv/Queries.md")["backlinks-open"] ?? null`),
        ],
        [[SRC("Plain")], null],
      );
    },
  );
  test("K2", "Typing a query in a new pane: title becomes Query, results follow, the query is written", async () => {
    await open(TARGET);
    await click(`__t.root().querySelector(".bfv-add")`);
    await sleep(600);
    await typeInto(`__t.pane(2).querySelectorAll("input.bfv-query")[1]`, 'LIST FROM "_bfv/src" WHERE rank < 3');
    await sleep(1500);
    const p = await panes();
    eq(
      "title and cards",
      [p[2].title, p[2].items.map(i => i.path).sort()],
      ["Query · 2", [SRC("Block"), SRC("Heading")]],
    );
    eq("written", await ev(`__t.fm(${j(TARGET)}).backlinks[1].query`), 'LIST FROM "_bfv/src" WHERE rank < 3');
  });
  test("K3", "A query pane follows Dataview: a new matching note appears after it reindexes", async () => {
    await ev(`app.vault.create("_bfv/src/Low.md", ${j("---\nrank: 0\n---\nlow")}).then(() => 1)`);
    const ok = await waitFor(`__t.panes()[2].items.some(i => i.path === "_bfv/src/Low.md")`, 8000);
    check("appeared", ok);
  });

  // ===== L. DataviewJS =====
  test("L1", "bfv.embed: open cards, collapsed with a limit, the note itself skipped", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await ev(
      `(async () => { const d = app.plugins.plugins.dataview; __t.dvjs = d.settings.enableDataviewJs; d.settings.enableDataviewJs = true; await d.saveSettings?.(); return 1; })()`,
    );
    await open("_bfv/DVJS.md", "reading");
    const pv = `__t.view().previewMode.containerEl`;
    await waitFor(
      `(${pv}.querySelector(".markdown-preview-view").scrollTop = 1e6) && ${pv}.querySelectorAll(".bfv-embeds").length === 3`,
      6000,
    );
    const r = await ev(
      `[...${pv}.querySelectorAll(".bfv-embeds")].map(w => [w.querySelectorAll(":scope > .bfv-item").length, w.querySelectorAll(":scope > .bfv-item:not(.is-collapsed)").length, w.querySelector(":scope > .bfv-empty")?.textContent ?? ""])`,
    );
    eq("blocks", r, [
      [8, 8, ""],
      [2, 0, "Showing 2 of 8 notes. Pass { limit: N } to show more."],
      [0, 0, "No notes to embed."],
    ]);
    await click(`${pv}.querySelector(".bfv-embeds .bfv-item-title")`);
    await sleep(700);
    eq("title link navigates", await ev(`__t.leaf.view.file?.path`), SRC("Alias"));
    await ev(
      `(async () => { const d = app.plugins.plugins.dataview; d.settings.enableDataviewJs = __t.dvjs; await d.saveSettings?.(); return 1; })()`,
    );
  });

  // ===== M. Commands, settings, lifecycle =====
  test("M1", "Show diagnostics", async () => {
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await ev(`app.commands.executeCommandById("obsidian-backlinks-full-view:diagnostics")`);
    await sleep(300);
    const n = (await ev(`__t.notices()`)).find(t => t.includes("Backlinks Full View diagnostics")) ?? "";
    check("notice", n.includes("Panes: 1 + All backlinks") && n.includes("Note views tracked"), n);
    await ev(`__t.clearNotices()`);
  });
  test("M2", "Disabling the plugin removes every pane and the global; enabling brings them back", async () => {
    await ev(`(async () => { await app.plugins.disablePlugin(${j("obsidian-backlinks-full-view")}); return 1; })()`);
    await sleep(500);
    eq(
      "gone",
      [await ev(`document.querySelectorAll(".bfv-container").length`), await ev(`typeof window.bfv`)],
      [0, "undefined"],
    );
    await ev(`(async () => { await app.plugins.enablePlugin(${j("obsidian-backlinks-full-view")}); return 1; })()`);
    check("back", await waitFor(`!!__t.root()?.querySelector(".bfv-panel")`, 4000));
  });
  test("M3", "A pending edit is written when the plugin unloads", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    await typeInto(`__t.pane(1).querySelector(".bfv-title-input")`, "Unload");
    await ev(
      `(async () => { await app.plugins.disablePlugin(${j("obsidian-backlinks-full-view")}); await __t.sleep(600); await app.plugins.enablePlugin(${j("obsidian-backlinks-full-view")}); return 1; })()`,
    );
    await sleep(500);
    eq("written", await ev(`__t.fm(${j(TARGET)}).backlinks[0].title`), "Unload");
  });

  test(
    "M4",
    "Unloading removes the plugin's patches (setMode, the editor's bottom padding); loading puts them back",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await open("_bfv/Short.md");
      const id = j("obsidian-backlinks-full-view");
      const fns = `(() => { const v = __t.view(); return [Object.getPrototypeOf(v).setMode, Object.getPrototypeOf(v.editMode).updateBottomPadding]; })()`;
      const r = await ev(`(async () => {
      const on = ${fns};
      await app.plugins.disablePlugin(${id}); await __t.sleep(300);
      const off = ${fns};
      const v = __t.view(); v.editMode.updateBottomPadding(v.editMode.containerEl.clientHeight);
      const pad = parseFloat(v.editMode.cm.contentDOM.style.paddingBottom), half = Math.round(v.editMode.containerEl.clientHeight / 2);
      await app.plugins.enablePlugin(${id}); await __t.sleep(1500);
      const again = ${fns};
      return [on[0] !== off[0], on[1] !== off[1], Math.abs(pad - half) <= 1, again[0] !== off[0], again[1] !== off[1]];
    })()`);
      eq("patched / removed / Obsidian's padding back / patched again", r, [true, true, true, true, true]);
      check("panes back", await waitFor(`!!__t.root()?.querySelector(".bfv-panel")`, 3000));
    },
  );

  // ===== N. Big notes =====
  const ms = async expr =>
    ev(`(async () => { const t = performance.now(); await (${expr}); return Math.round(performance.now() - t); })()`);
  test("N1", "A hub with 3,000 backlinks: open, expand All backlinks, search, full text", async () => {
    await ev(`__t.closeAll()`);
    const tOpen = await ms(`__t.open("n/Maya Iyer.md")`);
    check(`open with panes ready: ${tOpen} ms (< 2500)`, tOpen < 2500);
    eq("count (3,000 stress notes + Alias)", (await panes())[0].count, "3001");
    const tExp = await ms(
      `(async () => { __t.pane(0).querySelector(".bfv-header").click(); await __t.sleep(0); return 1; })()`,
    );
    await waitFor(`__t.panes()[0].items.length === 3000`, 5000);
    check(`expand 3,000 cards: ${tExp} ms (< 1500)`, tExp < 1500);
    const tSearch = await ms(
      `(async () => { const i = __t.pane(0).querySelector(".bfv-filter"); i.value = "standup"; i.dispatchEvent(new Event("input")); await __t.sleep(160); return 1; })()`,
    );
    check(`search: ${tSearch} ms (< 600)`, tSearch < 600);
    const tFt = await ms(
      `(async () => { __t.pane(0).querySelector(".bfv-fulltext input").click(); for (let k = 0; k < 100 && /Reading/.test(__t.panes()[0].count); k++) await __t.sleep(50); return 1; })()`,
    );
    check(`full text over 3,000 notes: ${tFt} ms (< 5000)`, tFt < 5000);
    const r = (await panes())[0].count;
    check("a result count", /^\d+ \/ 3001$/.test(r), r);
    const tLogs = await ms(
      `(async () => { __t.pane(1).querySelector(".bfv-header").click(); await __t.sleep(0); return 1; })()`,
    );
    check(`expand the filtered Logs pane: ${tLogs} ms (< 1500)`, tLogs < 1500);
  });
  test("N2", "Typing in a hub note with its big pane open stays responsive", async () => {
    await click(`__t.view().contentEl.querySelector(".cm-content .cm-line:last-child")`);
    await T.key("End", { ctrl: true });
    const t0 = Date.now();
    for (const ch of "quick typing test") await T.type(ch);
    const dt = Date.now() - t0;
    check(`17 keystrokes in ${dt} ms (< 1500)`, dt < 1500);
    await sleep(2500);
    const lag = await ms(`new Promise(r => requestAnimationFrame(() => r(1)))`);
    check(`frame after autosave + refresh: ${lag} ms (< 200)`, lag < 200);
    await ev(
      `(async () => { const f = app.vault.getAbstractFileByPath("n/Maya Iyer.md"); await app.vault.process(f, t => t.replace("quick typing test", "")); return 1; })()`,
    );
  });

  // ===== Q. Embedded notes as cards =====
  const EMB = {
    host: "_bfv/emb/Host.md",
    target: "_bfv/emb/Target.md",
    inner: "_bfv/emb/Inner.md",
    self: "_bfv/emb/Self.md",
  };
  const embFixtures = () =>
    ev(`(async () => {
      const mk = async (p, t) => { const f = app.vault.getAbstractFileByPath(p); if (f) await app.vault.modify(f, t); else await app.vault.create(p, t); };
      if (!app.vault.getAbstractFileByPath("_bfv/emb")) await app.vault.createFolder("_bfv/emb");
      await mk(${j(EMB.target)}, "---\\ntype: zettel\\ncreated: 2026-11-07\\n---\\n# Target\\n\\nBody text of target.\\n\\n## Sec\\n\\nSection text.\\n\\n![[_bfv/emb/Inner]]\\n");
      await mk(${j(EMB.inner)}, "Inner body.\\n");
      await mk(${j(EMB.self)}, "Self ![[_bfv/emb/Self]]\\n");
      app.plugins.plugins["obsidian-backlinks-full-view"].embedOpen.clear();
      await mk(${j(EMB.host)}, "Intro\\n\\n![[_bfv/emb/Target]]\\n\\n![[_bfv/emb/Target#Sec]]\\n\\nAfter\\n");
      await __t.sleep(300);
      return 1; })()`);
  // the visible mode's root of the open note, and what its embeds look like
  const embState = () =>
    ev(`(() => { const root = [...__t.view().containerEl.querySelectorAll(".markdown-reading-view, .markdown-source-view")].find(e => e.offsetParent);
      const outer = e => !e.parentElement.closest(".bfv-note-embed, .markdown-embed");
      const top = [...root.querySelectorAll(".bfv-note-embed")].filter(outer);
      const c0 = top[0], it = c0?.querySelector(":scope > .bfv-item");
      const native = [...root.querySelectorAll(".internal-embed.markdown-embed")].filter(outer);
      return { cards: top.length, native: native.map(e => e.getAttribute("src")), collapsed: it?.classList.contains("is-collapsed") ?? null,
        title: c0?.querySelector(".bfv-item-title")?.textContent ?? null, folder: c0?.querySelector(".bfv-item-path")?.textContent.replace(/\u200E/g, "") ?? null,
        border: it ? getComputedStyle(it).borderTopStyle : null, props: c0?.querySelector(".bfv-props")?.textContent.replace(/\\s+/g, " ").trim() ?? null,
        body: !!c0?.querySelector(".bfv-item-content")?.innerText.includes("Body text of target"),
        rawFm: !!c0?.querySelector(".bfv-item-content")?.innerText.includes("type: zettel"),
        nested: [...(c0?.querySelectorAll(".bfv-item-content .bfv-note-embed > .bfv-item") ?? [])].map(e => e.classList.contains("is-collapsed")) }; })()`);
  const embHeader = `[...__t.view().containerEl.querySelectorAll(".markdown-reading-view, .markdown-source-view")].find(e => e.offsetParent).querySelector(".bfv-note-embed > .bfv-item > .bfv-item-header")`;

  for (const mode of ["reading", "lp"]) {
    test(
      `Q1-${mode}`,
      "A whole-note embed is the panes' card: collapsed, bordered; expands to properties and the note",
      async () => {
        await fresh();
        await embFixtures();
        await open(EMB.host, mode);
        await sleep(900);
        const s = await embState();
        eq("one card for ![[Target]]", s.cards, 1);
        eq("the heading embed stays Obsidian's", s.native, ["_bfv/emb/Target#Sec"]);
        eq("collapsed at first, title, folder", [s.collapsed, s.title, s.folder], [true, "Target", "_bfv/emb/"]);
        eq("card border", s.border, "solid");
        check("nothing rendered while collapsed", !s.body && s.props === null, s);
        await click(embHeader);
        await sleep(900);
        const o = await embState();
        check("expanded by a header click", o.collapsed === false, o);
        check("properties table", !!o.props && o.props.includes("type") && o.props.includes("zettel"), o);
        check("note body, frontmatter not as text", o.body && !o.rawFm, o);
        eq("an embed inside it is a collapsed card too", o.nested, [true]);
      },
    );
  }
  test("Q2", "Source mode shows the embed's text; no card", async () => {
    await fresh();
    await embFixtures();
    await open(EMB.host, "source");
    await sleep(700);
    const s = await embState();
    eq("no card, no Obsidian embed", [s.cards, s.native.length], [0, 0]);
  });
  test("Q3", "The card's title opens the note; the card re-renders when the note changes", async () => {
    await fresh();
    await embFixtures();
    await open(EMB.host, "reading");
    await sleep(800);
    await click(embHeader);
    await sleep(800);
    await ev(
      `app.vault.process(app.vault.getAbstractFileByPath(${j(EMB.target)}), t => t.replace("Body text of target.", "Body text of target. Changed now."))`,
    );
    check("re-rendered", await waitFor(`${embHeader}.parentElement.textContent.includes("Changed now")`, 4000));
    await click(`${embHeader}.querySelector(".bfv-item-title")`);
    await sleep(800);
    eq("title opened the note", await activePath(), EMB.target);
  });
  test("Q4", "A note embedding itself, and the setting off: Obsidian's embed; on again: cards", async () => {
    await fresh();
    await embFixtures();
    await open(EMB.self, "reading");
    await sleep(700);
    eq("self-embed is Obsidian's", (await embState()).cards, 0);
    await open(EMB.host, "reading");
    await sleep(600);
    await ev(
      `(async () => { const p = app.plugins.plugins["obsidian-backlinks-full-view"]; p.settings.noteEmbeds = false; await p.saveSettings(); p.rerenderNoteEmbeds(); return 1; })()`,
    );
    await sleep(1200);
    let s = await embState();
    eq("setting off: Obsidian's embeds", [s.cards, s.native], [0, ["_bfv/emb/Target", "_bfv/emb/Target#Sec"]]);
    await ev(
      `(async () => { const p = app.plugins.plugins["obsidian-backlinks-full-view"]; p.settings.noteEmbeds = true; await p.saveSettings(); p.rerenderNoteEmbeds(); return 1; })()`,
    );
    await sleep(1200);
    s = await embState();
    eq("setting on: a card again", s.cards, 1);
  });
  test("Q5", "Disabling the plugin gives Obsidian's embeds back; enabling makes cards again", async () => {
    await fresh();
    await embFixtures();
    await open(EMB.host, "lp");
    await sleep(700);
    await ev(
      `(async () => { await app.plugins.disablePlugin("obsidian-backlinks-full-view"); await __t.sleep(1500); return 1; })()`,
    );
    const off = await ev(
      `(() => { const r = [...app.workspace.getLeavesOfType("markdown")].map(l => l.view.containerEl).find(e => e.querySelector('.internal-embed[src="_bfv/emb/Target"]')); return r ? [r.querySelectorAll(".bfv-note-embed").length, r.querySelectorAll('.markdown-embed[src="_bfv/emb/Target"]').length] : null; })()`,
    );
    eq("disabled: Obsidian's embed", off, [0, 1]);
    await ev(
      `(async () => { await app.plugins.enablePlugin("obsidian-backlinks-full-view"); await __t.sleep(2000); return 1; })()`,
    );
    const on = await ev(
      `(() => { const r = [...app.workspace.getLeavesOfType("markdown")].map(l => l.view.containerEl).find(e => e.querySelector('.internal-embed[src="_bfv/emb/Target"]')); return r ? r.querySelectorAll(".bfv-note-embed").length : null; })()`,
    );
    check("enabled: card again", on >= 1, on);
  });
  test("Q6", "A canvas file card of a note isn't turned into a card", async () => {
    await fresh();
    await embFixtures();
    const r =
      await ev(`(async () => { const p = "_bfv/emb/c.canvas"; const d = JSON.stringify({ nodes: [{ id: "a", type: "file", file: ${j(EMB.target)}, x: 0, y: 0, width: 500, height: 400 }], edges: [] });
      let f = app.vault.getAbstractFileByPath(p); if (f) await app.vault.modify(f, d); else f = await app.vault.create(p, d);
      const l = app.workspace.getLeaf("tab"); await l.openFile(f); await __t.sleep(2500);
      const el = l.view.containerEl; const node = el.querySelector(".canvas-node-content");
      const res = [node?.classList.contains("bfv-note-embed") || !!node?.querySelector('[data-bfv-path=${j(EMB.target)}]'), !!node?.textContent.includes("Body text of target"), node?.querySelectorAll('.bfv-note-embed [data-bfv-path=${j(EMB.inner)}]').length];
      l.detach(); return res; })()`);
    eq("canvas file card: the note itself, no card wrapper; its ![[Inner]] is a card", r, [false, true, 1]);
  });

  // ===== P. Popout windows =====
  test("P1", "A note in a popout window: panes in its editor; panes, cards and links work there", async () => {
    await fresh();
    await ev(
      `(async () => { const l = app.workspace.openPopoutLeaf(); await l.setViewState({ type: "markdown", state: { file: ${j(TARGET)}, mode: "source" } }); __t.leaf = l; await __t.sleep(2500); return 1; })()`,
    );
    eq(
      "in the popout's editor",
      await ev(`[__t.root()?.ownerDocument !== document, __t.root()?.parentElement.className]`),
      [true, "cm-sizer"],
    );
    // CDP input goes to the main window: the popout gets dispatched clicks
    await ev(`(() => { __t.pane(1).querySelector(".bfv-header").click(); return 1; })()`);
    await sleep(600);
    eq("cards", (await panes())[1].items.length, 10);
    await ev(`(() => { __t.card(1, ${j(SRC("Plain"))}).querySelector(".bfv-item-path").click(); return 1; })()`);
    check("card rendered", await waitFor(`__t.card(1, ${j(SRC("Plain"))}).textContent.includes("billing")`, 3000));
    await ev(`(() => { __t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title").click(); return 1; })()`);
    await sleep(800);
    eq("title link opens in the popout's leaf", await ev(`__t.leaf.view.file?.path`), SRC("Heading"));
    await ev(`(() => { __t.leaf.view.containerEl.win.close(); return 1; })()`);
    await sleep(800);
  });
}
