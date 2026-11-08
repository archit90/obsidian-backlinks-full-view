// The end-to-end cases; ids match ../TEST-CASES.md. Each case gets the harness helpers (see run.mjs).
const TARGET = "_bfv/Target.md";
const HUB = "n/Maya Iyer.md"; // 3,000 backlinks (e2e/make-vault.mjs)
const SRC = n => `_bfv/src/${n}.md`;
const ALL10 = ["Alias", "Bad json", "Bad list", "Block", "Embed", "FmOnly", "Heading", "Mdlink", "Plain", "Unresolved"];
const j = JSON.stringify;

export function register(test, T) {
  const {
    ev,
    check,
    eq,
    click,
    hover,
    typeInto,
    pick,
    panes,
    shown,
    open,
    expand,
    toggleCard,
    waitFor,
    sleep,
    read,
    errors,
  } = T;
  const leafCount = () => ev(`app.workspace.getLeavesOfType("markdown").filter(l => !__t.inLanes(l)).length`);
  // a plugin setting changed for a case, and put back to what it was after it
  const withSetting = async (key, value, fn) => {
    const was = await ev(`__t.plugin().settings[${j(key)}]`);
    const set = v =>
      ev(
        `(async () => { const p = __t.plugin(); p.settings[${j(key)}] = ${j(v)}; await p.saveSettings(); return 1; })()`,
      );
    await set(value);
    try {
      return await fn();
    } finally {
      await set(was);
    }
  };
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
  test(
    "B1",
    "Card header: full path, or title link and folder (setting); the header toggles, the title doesn't",
    async () => {
      await fresh();
      await open(TARGET);
      await expand(1);
      const header = () =>
        ev(
          `(() => { const c = __t.card(1, ${j(SRC("Plain"))}); return [c.querySelector(".bfv-item-title").textContent, c.querySelector(".bfv-item-path")?.textContent.replace(/\u200E/g, "") ?? null, c.classList.contains("is-collapsed")]; })()`,
        );
      eq("full path (default)", await header(), ["_bfv/src/Plain", null, true]);
      const was = await ev(`__t.plugin().settings.cardFullPath`);
      await ev(`(() => { const p = __t.plugin(); p.settings.cardFullPath = false; p.applyCardTitles(); return 1; })()`);
      await sleep(300);
      try {
        eq("setting off: name and folder", await header(), ["Plain", "_bfv/src/", true]);
        await click(`__t.card(1, ${j(SRC("Plain"))}).querySelector(".bfv-item-path")`);
        await sleep(400);
        check(
          "expanded by a header click",
          await ev(`!__t.card(1, ${j(SRC("Plain"))}).classList.contains("is-collapsed")`),
        );
        await click(`__t.card(1, ${j(SRC("Plain"))}).querySelector(".bfv-chevron")`);
        await sleep(200);
        check("collapsed again", await ev(`__t.card(1, ${j(SRC("Plain"))}).classList.contains("is-collapsed")`));
      } finally {
        await ev(
          `(async () => { const p = __t.plugin(); p.settings.cardFullPath = ${j(was)}; await p.saveSettings(); p.applyCardTitles(); return 1; })()`,
        );
      }
      await sleep(300);
      eq("setting on again", (await header())[0], "_bfv/src/Plain");
    },
  );
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
      // Block holds backlinks-open and canvas-full-backlinks-enabled, Bad json only a `backlinks` list
      await toggleCard(1, SRC("Block"));
      await toggleCard(1, "_bfv/Bad json.md");
      await sleep(600);
      const own =
        await ev(`(() => { const keys = p => [...__t.card(1, p).querySelectorAll(".bfv-prop-key")].map(k => k.textContent);
        return [keys(${j(SRC("Block"))}), keys("_bfv/Bad json.md")]; })()`);
      eq("this plugin's own keys left out of a card's properties", own, [["rank", "status", "created", "flag"], []]);
    },
  );
  test(
    "B3",
    "A Dataview block inside a card renders",
    async () => {
      await open(TARGET);
      await expand(1);
      await toggleCard(1, SRC("Plain"));
      const ok = await waitFor(
        `__t.card(1, ${j(SRC("Plain"))})?.querySelectorAll(".bfv-item-content .dataview li").length === 2`,
        5000,
      );
      check("dataview list rendered", ok);
    },
    { needs: ["dataview"] },
  );
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
    const hub = HUB;
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
    const was = await ev(`__t.plugin().settings.maxOpen`);
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
      await set(was);
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

  test("B13", "Keyboard: pane and card headers are buttons; Enter or Space toggles the focused one", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    const state = () =>
      ev(`(() => { const h = __t.pane(1).querySelector(".bfv-header"), c = __t.card(1, ${j(SRC("Plain"))})?.querySelector(".bfv-item-header");
        const a = e => [e.getAttribute("role"), e.tabIndex, e.getAttribute("aria-expanded")];
        return [a(h), c ? a(c) : null]; })()`);
    eq("a pane header: a button, collapsed", (await state())[0], ["button", 0, "false"]);
    await ev(`(() => { __t.pane(1).querySelector(".bfv-header").focus(); return 1; })()`);
    await T.key("Enter");
    await sleep(500);
    const s1 = await state();
    eq("Enter on the focused pane header: expanded", [s1[0][2], (await panes())[1].collapsed], ["true", false]);
    eq("a card header: a button too, collapsed", s1[1], ["button", 0, "false"]);
    await ev(`(() => { __t.card(1, ${j(SRC("Plain"))}).querySelector(".bfv-item-header").focus(); return 1; })()`);
    await T.key("Space");
    await sleep(500);
    eq(
      "Space on the focused card header: expanded",
      [(await state())[1][2], (await panes())[1].items.find(i => i.path === SRC("Plain")).open],
      ["true", true],
    );
    await T.key("Enter");
    await sleep(400);
    eq("Enter again: collapsed", (await state())[1][2], "false");
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
      // a leaf of the note outside the original's tab group; Lanes' card leaves (together runs) don't count, as in
      // leafCount: a card showing the same note isn't the split
      const split = await waitFor(
        `app.workspace.getLeavesOfType("markdown").some(l => !__t.inLanes(l) && l.view.file?.path === ${j(SRC("Embed"))} && l.parent !== __t.leaf.parent)`,
      );
      check(
        "ctrl+alt: split",
        split,
        split
          ? undefined
          : await ev(
              `JSON.stringify(app.workspace.getLeavesOfType("markdown").map(l => ({ p: l.view.file?.path, inLanes: __t.inLanes(l), sameGroup: l.parent === __t.leaf.parent })))`,
            ),
      );
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
      eq("property link", await ev(`__t.leaf.view.file?.path`), HUB);
    });
    test(
      `C4-${mode}`,
      `${label}: hovering with Ctrl shows a page preview; without it, none`,
      async () => {
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
      },
      { needs: ["core:page-preview"] },
    );
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

  test(
    "C7",
    "Hovering a card's links sends Page preview this plugin's hover source, the link and the card's note",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await open(TARGET, "reading");
      await expand(1);
      await toggleCard(1, SRC("Plain"));
      await sleep(400);
      await ev(
        `(() => { __t.hovers = []; __t.hoverRef = app.workspace.on("hover-link", e => __t.hovers.push([e.source, e.linktext, e.sourcePath, !!e.targetEl, !!e.hoverParent])); return 1; })()`,
      );
      try {
        await hover(`__t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title")`);
        await sleep(200);
        await hover(
          `[...__t.card(1, ${j(SRC("Plain"))}).querySelectorAll(".bfv-item-content a.internal-link")].find(a => a.textContent === "lonely alias")`,
        );
        await sleep(300);
        const got = await ev(`__t.hovers`);
        eq(
          "ours only (none from the note's own preview), per link",
          [...new Map(got.map(h => [JSON.stringify(h), h])).values()],
          [
            ["backlinks-full-view", SRC("Heading"), SRC("Heading"), true, true],
            ["backlinks-full-view", "_bfv/Lonely", SRC("Plain"), true, true],
          ],
        );
      } finally {
        await ev(`(() => { app.workspace.offref(__t.hoverRef); return 1; })()`);
        await T.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 500 });
      }
    },
  );

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
    eq("path (Block's backlinks-open lists Mdlink: not searched)", await search("mdlink"), ["Mdlink"]);
    eq("link in a property", await search("maya"), ["Alias"]);
    eq(
      "this plugin's own keys and pane settings aren't searched",
      [await search("backlinks"), await search("broken")],
      [[], []],
    );
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
    const props = await ev(`[...${ruleSel(1, 0, "select.bfv-prop")}.querySelectorAll("option")].map(o => o.value)`);
    check(
      "the property list leaves this plugin's own keys out",
      props.includes("note.flag") && !props.some(v => /^note\.(backlinks|canvas-full)/.test(v)),
      props,
    );
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
    eq("Any: status empty OR name without bad = all", (await shown(1)).length, 10);
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

  test(
    "F8",
    "Frontmatter that isn't valid YAML: an edit isn't saved, a notice says so; fixed, it's saved",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      const p = "_bfv/Bad yaml.md";
      const before = await read(p);
      await open(p);
      await ev(`__t.clearNotices()`);
      await errors();
      await click(`__t.root().querySelector(".bfv-add")`);
      await sleep(1500);
      eq("file untouched", await read(p), before);
      check(
        "a notice says why",
        (await ev(`__t.notices()`)).some(n => n.includes("couldn't save this note's pane settings")),
        await ev(`__t.notices()`),
      );
      // logged once; Obsidian may log its own YAML complaint too
      const errs = await errors();
      check(
        "logged once",
        errs.filter(e => e.includes("couldn't save pane settings")).length === 1 &&
          errs.every(e => e.includes("couldn't save pane settings") || /yaml/i.test(e)),
        errs,
      );
      eq(
        "the new pane stays",
        (await panes()).map(x => x.title),
        ["All backlinks", "Backlinks"],
      );
      await replaceIn(p, "[unclosed", "fixed");
      check(
        "saved once the YAML is fixed",
        await waitFor(`JSON.stringify(__t.fm(${j(p)})?.backlinks) === "[{}]"`, 4000),
        await read(p),
      );
      await ev(`__t.clearNotices()`);
    },
  );

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
    await expand(0);
    await ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath("_bfv/Lonely.md"), "_bfv/Lonely2.md")`);
    await sleep(1200);
    eq("still its backlink", (await panes())[0].count, "1");
    await click(`__t.root().querySelector(".bfv-add")`);
    await sleep(1000);
    eq("writes to the new path", await ev(`__t.fm("_bfv/Lonely2.md").backlinks`), [{}]);
    // not awaited over CDP: deleting the open note tears its view down, and that promise can be collected unsettled
    await ev(`(() => { void app.vault.delete(app.vault.getAbstractFileByPath("_bfv/Lonely2.md")); return 1; })()`);
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
    const was = await ev(`app.vault.getConfig("readableLineLength")`);
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
    await ev(`(() => { app.vault.setConfig("readableLineLength", ${j(was)}); return 1; })()`);
  });

  // ===== I. Where the panes appear: hosts of other plugins, and the contracts with them =====
  // Editor Multiple Lanes, through its test API only: settings lanesOnly / showBacklinks with settingsChanged
  // (T.lanes, which returns the old values), its view type "editor-lanes", and cards found by `.lanes-view`.
  const LANES = "editor-multiple-lanes";
  const laneLeaf = path =>
    `(() => { let f = null; app.workspace.iterateAllLeaves(l => { if (!f && l.view?.file?.path === ${j(path)} && __t.inLanes(l)) f = l; }); return f; })()`;
  const closeLanes = () =>
    ev(`(() => { for (const l of app.workspace.getLeavesOfType("editor-lanes")) l.detach(); return 1; })()`);
  /** Opens `path` in an Editor Multiple Lanes card ("lanes only" on meanwhile) and makes it __t.leaf. */
  const inLanes = async (path, fn) => {
    const was = await ev(`__t.lanes({ lanesOnly: true })`);
    try {
      await ev(`app.workspace.openLinkText(${j(path)}, "", false)`);
      check("card leaf found", await waitFor(`!!(__t.leaf = ${laneLeaf(path)})`, 5000));
      await fn();
    } finally {
      await ev(`__t.lanes(${j(was)})`);
    }
  };
  test(
    "I1",
    "Editor Multiple Lanes card: panes under the note; cards and links work there",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await closeLanes();
      await inLanes(TARGET, async () => {
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
        // where a link clicked in a card opens is Editor Multiple Lanes' routing: its own suite checks it
        eq("cards carry their note's path", await ev(`__t.card(1, ${j(SRC("Plain"))}).dataset.bfvPath`), SRC("Plain"));
      });
    },
    { needs: [LANES] },
  );
  test(
    "I2",
    "Editor Multiple Lanes 'Show backlinks panes under lane notes' off: no panes in lanes; on: back",
    async () => {
      await inLanes(TARGET, async () => {
        await waitFor(`!!__t.root()?.querySelector(".bfv-panel")`, 3000);
        const was = await ev(`__t.lanes({ showBacklinks: false })`);
        try {
          await sleep(1200);
          eq("none in lanes", await ev(`document.querySelectorAll(".lanes-view .bfv-container").length`), 0);
        } finally {
          await ev(`__t.lanes(${j(was)})`);
        }
        await sleep(1200);
        check("back", await ev(`document.querySelectorAll(".lanes-view .bfv-container").length > 0`));
      });
      await closeLanes();
    },
    { needs: [LANES] },
  );
  test("I3", "Every card carries data-bfv-path; a link in a card opens with that note as its source", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    await toggleCard(1, SRC("Plain"));
    await toggleCard(1, SRC("Embed"));
    await sleep(500);
    // pane cards, and the embed card inside Embed's card
    const paths = await ev(
      `[...__t.root().querySelectorAll(".bfv-item")].map(i => [i.dataset.bfvPath, !!app.vault.getAbstractFileByPath(i.dataset.bfvPath ?? "")])`,
    );
    check(
      "every card has its note's path",
      paths.length >= 11 && paths.every(([, ok]) => ok) && paths.some(([p]) => p === TARGET),
      paths,
    );
    // what a partner gets: openLinkText(link, the card's note, how to open) instead of a link without a source
    await ev(`(() => { const ws = app.workspace; __t.calls = []; __t.olt = [Object.prototype.hasOwnProperty.call(ws, "openLinkText"), ws.openLinkText];
      ws.openLinkText = function (...a) { __t.calls.push(a.slice(0, 3)); return Promise.resolve(); }; return 1; })()`);
    try {
      await click(
        `[...__t.card(1, ${j(SRC("Plain"))}).querySelectorAll(".bfv-item-content a.internal-link")].find(a => a.textContent === "lonely alias")`,
      );
      await click(`__t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title")`, { ctrl: true });
      eq("calls", await ev(`__t.calls`), [
        ["_bfv/Lonely", SRC("Plain"), false],
        [SRC("Heading"), SRC("Heading"), "tab"],
      ]);
    } finally {
      await ev(
        `(() => { const ws = app.workspace, [own, f] = __t.olt; if (own) ws.openLinkText = f; else delete ws.openLinkText; return 1; })()`,
      );
    }
  });
  test(
    "I4",
    "data-bfv-skip on an ancestor: hidden at once, no panes after the next refresh; removed: back",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await open("_bfv/Short.md");
      const tracked = () => ev(`__t.plugin().views.size`);
      const n0 = await tracked();
      await ev(`(() => { __t.leaf.containerEl.setAttribute("data-bfv-skip", "e2e"); return 1; })()`);
      try {
        eq("hidden by the CSS before any refresh", await ev(`getComputedStyle(__t.root()).display`), "none");
        await ev(`(() => { app.workspace.trigger("layout-change"); return 1; })()`);
        await sleep(800);
        eq("no panes there, the view untracked", [await ev(`!!__t.root()`), await tracked()], [false, n0 - 1]);
        const pad = await ev(
          `(() => { const em = __t.view().editMode; return [Math.round(parseFloat(em.cm.contentDOM.style.paddingBottom)), Math.round(em.containerEl.clientHeight / 2)]; })()`,
        );
        check("the editor's own bottom padding back", Math.abs(pad[0] - pad[1]) <= 2, pad);
      } finally {
        await ev(
          `(() => { __t.leaf.containerEl.removeAttribute("data-bfv-skip"); app.workspace.trigger("layout-change"); return 1; })()`,
        );
      }
      check(
        "attribute gone, layout-change: panes back",
        await waitFor(`!!__t.root()?.querySelector(".bfv-panel")`, 3000),
      );
    },
  );
  test("I5", "A host that forces the editor's bottom padding keeps it: no room added under the panes", async () => {
    await ev(`__t.closeAll()`);
    await open("_bfv/Short.md");
    const look = () =>
      ev(
        `(() => { const em = __t.view().editMode; em.updateBottomPadding(em.containerEl.clientHeight); return { min: __t.root().style.minHeight, pad: getComputedStyle(em.cm.contentDOM).paddingBottom }; })()`,
      );
    const before = await look();
    check("normally the panes take the room to scroll past the end", parseFloat(before.min) > 0, before);
    await ev(`(() => { const s = document.createElement("style"); s.id = "bfv-e2e-host"; s.textContent = ".bfv-e2e-host .cm-content { padding-bottom: 0 !important; }";
      document.head.append(s); __t.view().containerEl.addClass("bfv-e2e-host"); return 1; })()`);
    try {
      eq("a host's own padding is kept, none added", await look(), { min: "", pad: "0px" });
    } finally {
      await ev(
        `(() => { document.getElementById("bfv-e2e-host")?.remove(); __t.view().containerEl.removeClass("bfv-e2e-host"); return 1; })()`,
      );
    }
    check("without it: the room is back", parseFloat((await look()).min) > 0);
  });
  const canvasNode = id => `__t.canvas.nodes.get(${j(id)})`;
  const inCard = id =>
    `(() => { const n = ${canvasNode(id)}; const d = n.nodeEl.querySelector("iframe")?.contentDocument; return (d && d.querySelector(".bfv-container")) || n.nodeEl.querySelector(".bfv-container"); })()`;
  test(
    "J1",
    "Canvas file card: no panes in reading view; panes in the editor while editing",
    async () => {
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
    },
    { needs: ["core:canvas"] },
  );
  test(
    "J2",
    "Canvas: expanding a pane and a card inside the edited card; clicks don't stop editing",
    async () => {
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
    },
    { needs: ["core:canvas"] },
  );
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
    { needs: ["core:canvas"] },
  );
  test(
    "J4",
    "Setting 'Show backlinks panes on canvas cards' off: none while editing, no canvas button anywhere",
    async () => {
      await withSetting("canvas", false, async () => {
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
      });
      await sleep(600);
      eq(
        "setting back on: button back",
        await ev(`__t.root().querySelector(".bfv-canvas-toggle").classList.contains("bfv-hidden")`),
        false,
      );
    },
    { needs: ["core:canvas"] },
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
  test(
    "J8",
    "Page preview popover of a note: shows the note (panes aren't shown in popovers)",
    async () => {
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
    },
    { needs: ["core:page-preview"] },
  );

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
    { needs: ["dataview"] },
  );
  test(
    "K2",
    "Typing a query in a new pane: title becomes Query, results follow, the query is written",
    async () => {
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
    },
    { needs: ["dataview"] },
  );
  test(
    "K3",
    "A query pane follows Dataview: a new matching note appears after it reindexes",
    async () => {
      await ev(`app.vault.create("_bfv/src/Low.md", ${j("---\nrank: 0\n---\nlow")}).then(() => 1)`);
      const ok = await waitFor(`__t.panes()[2].items.some(i => i.path === "_bfv/src/Low.md")`, 8000);
      check("appeared", ok);
    },
    { needs: ["dataview"] },
  );

  // Dataview's side of query panes, simulated: K4 without it (a loaded Dataview is hidden from the plugin
  // meanwhile), K5 with a stand-in answering as Dataview's API does
  const dvHide = () =>
    ev(`(() => { __t.realDv = app.plugins.plugins.dataview; delete app.plugins.plugins.dataview; return 1; })()`);
  const dvBack = () =>
    ev(`(() => { delete app.plugins.plugins.dataview; if (__t.realDv) { app.plugins.plugins.dataview = __t.realDv; app.metadataCache.trigger("dataview:index-ready"); }
      __t.realDv = undefined; return 1; })()`);
  test(
    "K4",
    "Without Dataview: a query pane says so, diagnostics too, and remembered cards aren't pruned",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await dvHide();
      try {
        await open("_bfv/Queries.md");
        await expand(1);
        await sleep(400);
        const p = await panes();
        eq("the query pane", [p[1].count, p[1].empty], ["0", "Dataview plugin is not installed or enabled."]);
        await ev(`__t.clearNotices()`);
        await ev(`app.commands.executeCommandById("backlinks-full-view:diagnostics")`);
        await sleep(300);
        check(
          "diagnostics",
          (await ev(`__t.notices()`)).some(n => n.includes("Dataview: not enabled")),
        );
        await ev(`__t.clearNotices()`);
        await sleep(5600);
        eq(
          "nothing pruned or written",
          [
            await ev(`__t.fm("_bfv/Queries.md").backlinks[3].open`),
            await ev(`__t.fm("_bfv/Queries.md")["backlinks-open"] ?? null`),
          ],
          [[SRC("Plain")], null],
        );
      } finally {
        await dvBack();
      }
    },
  );
  test(
    "K5",
    "A stand-in Dataview: results, no rows, an error, rows without links; it gets the query and the note; re-runs once its index is quiet",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await dvHide();
      await ev(`(() => {
        const L = p => ({ path: p, type: "file" });
        __t.dvCalls = [];
        __t.dvAnswers = {
          'LIST FROM "_bfv/src" SORT file.name': { successful: true, value: { type: "list", values: [L("_bfv/src/Plain.md"), L("_bfv/src/Block.md")] } },
          'LIST FROM "_bfv/src" WHERE rank > 1000': { successful: true, value: { type: "list", values: [] } },
          "LIST FROM WHERE (((": { successful: false, error: "stand-in parse error" },
          'TABLE WITHOUT ID rank FROM "_bfv/src"': { successful: true, value: { type: "table", values: [[3], [1]] } },
        };
        app.plugins.plugins.dataview = { manifest: { version: "stand-in" }, index: { initialized: true },
          api: { query: async (q, origin) => { __t.dvCalls.push([q, origin]); return __t.dvAnswers[q] ?? { successful: false, error: "unknown query" }; } } };
        app.metadataCache.trigger("dataview:index-ready");
        return 1; })()`);
      try {
        await open("_bfv/Queries.md");
        for (let i = 1; i <= 4; i++) await expand(i);
        await sleep(600);
        const p = await panes();
        eq("results, as cards", [p[1].count, p[1].items.map(i => i.path)], ["2", [SRC("Block"), SRC("Plain")]]);
        eq("no rows", [p[2].count, p[2].empty], ["0", "No notes."]);
        eq("an error", p[3].empty, "Dataview: stand-in parse error");
        check("rows without note links: the hint", p[4].empty.includes("no note links"), p[4].empty);
        check(
          "asked with the query and the pane's note",
          (await ev(`__t.dvCalls`)).some(
            ([q, o]) => q === 'LIST FROM "_bfv/src" SORT file.name' && o === "_bfv/Queries.md",
          ),
        );
        await ev(`(() => { __t.dvAnswers['LIST FROM "_bfv/src" SORT file.name'].value.values.push({ path: "_bfv/src/Heading.md", type: "file" });
          app.metadataCache.trigger("dataview:metadata-change"); return 1; })()`);
        await sleep(1000);
        eq("not while Dataview is still reindexing", (await panes())[1].count, "2");
        check("re-run once it's quiet (2.5 s)", await waitFor(`__t.panes()[1].count === "3"`, 5000));
      } finally {
        await dvBack();
      }
    },
  );

  // ===== L. DataviewJS =====
  test(
    "L1",
    "bfv.embed: open cards, collapsed with a limit, the note itself skipped",
    async () => {
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
    },
    { needs: ["dataview"] },
  );

  test(
    "L2",
    "bfv.embed called directly: an element or a dv-like target, every form of pages, open or collapsed, a limit, the note and its ancestors skipped, the depth limit",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await open("_bfv/Short.md", "reading");
      const r = await ev(`(() => {
        const Component = __t.Component();
        const host = __t.view().contentEl.createDiv({ cls: "bfv-e2e-embeds" });
        const look = w => [w.querySelectorAll(":scope > .bfv-item").length, w.querySelectorAll(":scope > .bfv-item:not(.is-collapsed)").length,
          w.querySelector(":scope > .bfv-empty")?.textContent ?? "", [...w.querySelectorAll(":scope > .bfv-item")].map(i => i.dataset.bfvPath)];
        const comp = new Component(); comp.load(); __t.l2comp = comp;
        const out = {
          element: look(bfv.embed(host.createDiv(), ["_bfv/src/Plain.md", "_bfv/src/Heading"])),
          dvLike: look(bfv.embed({ container: host.createDiv(), component: comp, currentFilePath: "_bfv/src/Plain.md" },
            { values: [{ file: { path: "_bfv/src/Plain.md" } }, { path: "_bfv/src/Block.md" }, "_bfv/src/Heading.md"] }, { collapsed: true, limit: 1 })),
          set: look(bfv.embed(host.createDiv(), new Set(["_bfv/src/Block.md"]))),
          none: look(bfv.embed(host.createDiv(), [])),
        };
        const anc = host.createDiv({ attr: { "data-bfv-path": "_bfv/src/Block.md" } });
        out.ancestor = look(bfv.embed(anc.createDiv(), ["_bfv/src/Block.md", "_bfv/src/Embed.md"]));
        let deep = host;
        for (const p of ["_bfv/src/Alias.md", "_bfv/src/Mdlink.md", "_bfv/src/FmOnly.md"]) deep = deep.createDiv({ attr: { "data-bfv-path": p } });
        out.deep = look(bfv.embed(deep.createDiv(), ["_bfv/src/Plain.md"]));
        return out; })()`);
      eq("an element; paths and a link path: open cards", r.element, [2, 2, "", [SRC("Plain"), SRC("Heading")]]);
      eq("a dv-like target: its note skipped, collapsed, limit 1", r.dvLike, [
        1,
        0,
        "Showing 1 of 2 notes. Pass { limit: N } to show more.",
        [SRC("Block")],
      ]);
      eq("a Set", r.set, [1, 1, "", [SRC("Block")]]);
      eq("no notes", r.none, [0, 0, "No notes to embed.", []]);
      eq("a note a card above shows is skipped", r.ancestor, [1, 1, "", [SRC("Embed")]]);
      eq("embeds 3 deep: the limit", r.deep, [0, 0, "Embed depth limit reached.", []]);
    },
  );
  test(
    "L3",
    "bfv.embed cards: an open one renders again when its note changes; unloaded with their component; a plain element's let go once it's gone",
    async () => {
      // L2's embeds are still open in Short
      await replaceIn(SRC("Plain"), "billing v2 acme", "billing v2 acme L3-CHANGED");
      check(
        "the open card renders again",
        await waitFor(
          `[...document.querySelectorAll(".bfv-e2e-embeds .bfv-item")].some(i => i.dataset.bfvPath === ${j(SRC("Plain"))} && i.textContent.includes("L3-CHANGED"))`,
          4000,
        ),
      );
      await ev(`(() => { const Component = __t.Component(); const c = new Component(); c.load(); __t.l3comp = c;
        bfv.embed({ container: document.querySelector(".bfv-e2e-embeds").createDiv({ cls: "bfv-e2e-l3" }), component: c }, [${j(SRC("Heading"))}]); return 1; })()`);
      await sleep(600);
      await ev(`(() => { __t.l3comp.unload(); return 1; })()`);
      await replaceIn(SRC("Heading"), "words.", "words. L3-AFTER");
      await sleep(1500);
      check(
        "unloaded with its component: it no longer renders",
        !(await ev(`document.querySelector(".bfv-e2e-l3").textContent.includes("L3-AFTER")`)),
      );
      await ev(
        `(() => { __t.l2comp.unload(); document.querySelector(".bfv-e2e-embeds").remove(); bfv.embed(document.createElement("div"), []); return 1; })()`,
      );
      check(
        "a removed element's cards are let go on the next call",
        await ev(`[...__t.plugin().looseEmbeds].every(x => x.wrap.isConnected || !x.seen)`),
      );
    },
  );

  // ===== M. Commands, settings, lifecycle =====
  test("M1", "Show diagnostics", async () => {
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await ev(`app.commands.executeCommandById("backlinks-full-view:diagnostics")`);
    await sleep(300);
    const n = (await ev(`__t.notices()`)).find(t => t.includes("Backlinks Full View diagnostics")) ?? "";
    check("notice", n.includes("Panes: 1 + All backlinks") && n.includes("Note views tracked"), n);
    check("every Obsidian internal it relies on is there", /Obsidian internals: ok \(\d+ checked\)/.test(n), n);
    await ev(`__t.clearNotices()`);
  });
  test("M2", "Disabling the plugin removes every pane and the global; enabling brings them back", async () => {
    await ev(`(async () => { await app.plugins.disablePlugin(${j("backlinks-full-view")}); return 1; })()`);
    await sleep(500);
    eq(
      "gone",
      [await ev(`document.querySelectorAll(".bfv-container").length`), await ev(`typeof window.bfv`)],
      [0, "undefined"],
    );
    await ev(`(async () => { await app.plugins.enablePlugin(${j("backlinks-full-view")}); return 1; })()`);
    check("back", await waitFor(`!!__t.root()?.querySelector(".bfv-panel")`, 4000));
  });
  test("M3", "A pending edit is written when the plugin unloads", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await expand(1);
    await typeInto(`__t.pane(1).querySelector(".bfv-title-input")`, "Unload");
    await ev(
      `(async () => { await app.plugins.disablePlugin(${j("backlinks-full-view")}); await __t.sleep(600); await app.plugins.enablePlugin(${j("backlinks-full-view")}); return 1; })()`,
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
      const id = j("backlinks-full-view");
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

  test(
    "M5",
    "Disabling leaves nothing of the plugin on the views that stay open (enabled and disabled again)",
    async () => {
      await fresh();
      await ev(`__t.closeAll()`);
      await open(TARGET);
      await ev(`(async () => { const l = app.workspace.getLeaf("split"); await l.openFile(app.vault.getAbstractFileByPath("_bfv/Canvas.canvas"));
        __t.m5 = [__t.leaf.view, l.view]; await __t.sleep(1500); return 1; })()`);
      const id = j("backlinks-full-view");
      const counts = () => ev(`__t.m5.map(v => [v._children?.length ?? -1, v._events?.length ?? -1])`);
      await ev(`(async () => { await app.plugins.disablePlugin(${id}); await __t.sleep(500); return 1; })()`);
      const before = await counts();
      check(
        "a view's components and hooks can be counted",
        before.flat().every(n => n >= 0),
        before,
      );
      await ev(`(async () => { await app.plugins.enablePlugin(${id}); await __t.sleep(1500); return 1; })()`);
      eq(
        "hooked while loaded",
        await ev(`[__t.plugin().viewHooks.has(__t.m5[0]), __t.plugin().canvasHooks.has(__t.m5[1])]`),
        [true, true],
      );
      await ev(`(async () => { await app.plugins.disablePlugin(${id}); await __t.sleep(500); return 1; })()`);
      eq("enabled and disabled again: the views are as before", await counts(), before);
      await ev(`(async () => { await app.plugins.enablePlugin(${id}); await __t.sleep(1500); return 1; })()`);
      await ev(`(() => { for (const l of app.workspace.getLeavesOfType("canvas")) l.detach(); return 1; })()`);
      await sleep(300);
      eq("a closed canvas is let go", await ev(`__t.plugin().canvasHooks.size`), 0);
      check("panes back", await waitFor(`!!__t.root()?.querySelector(".bfv-panel")`, 4000));
    },
    { needs: ["core:canvas"] },
  );
  test("M6", "A view whose refresh fails doesn't stop the others", async () => {
    await fresh();
    await ev(`__t.closeAll()`);
    await open(TARGET);
    await ev(`(__t.m6a = __t.leaf) && 1`);
    await open("_bfv/Lonely.md", "lp", "split");
    await errors();
    await ev(`(() => { const p = __t.plugin(), a = __t.m6a.view; let thrown = false;
      p.observeView = function (v) { if (!thrown && v === a) { thrown = true; throw new Error("e2e: a view that fails"); }
        return Object.getPrototypeOf(this).observeView.call(this, v); };
      return 1; })()`);
    try {
      await open("_bfv/Orphan.md", "lp", "same");
      check(
        "the other view still got its panes",
        await waitFor(`__t.plugin().views.get(__t.leaf.view)?.notePath === "_bfv/Orphan.md"`, 3000),
      );
      const errs = await errors();
      check(
        "the failure is logged",
        errs.some(e => e.includes("refresh failed") && e.includes("e2e: a view that fails")),
        errs,
      );
    } finally {
      await ev(`(() => { delete __t.plugin().observeView; return 1; })()`);
    }
  });

  // ===== N. Big notes =====
  const ms = async expr =>
    ev(`(async () => { const t = performance.now(); await (${expr}); return Math.round(performance.now() - t); })()`);
  // time limits scale with BFV_PERF_SCALE (T.perf), for slower machines
  const under = (what, t, limit) => check(`${what}: ${t} ms (< ${T.perf(limit)})`, t < T.perf(limit));
  test("N1", "A hub with 3,000 backlinks: open, expand All backlinks, search, full text", async () => {
    await ev(`__t.closeAll()`);
    const tOpen = await ms(`__t.open(${j(HUB)})`);
    under("open with panes ready", tOpen, 2500);
    eq("count (3,000 log notes + Alias)", (await panes())[0].count, "3001");
    const tExp = await ms(
      `(async () => { __t.pane(0).querySelector(".bfv-header").click(); await __t.sleep(0); return 1; })()`,
    );
    check("3,001 cards", await waitFor(`__t.panes()[0].items.length === 3001`, 5000));
    under("expand 3,001 cards", tExp, 1500);
    const tSearch = await ms(
      `(async () => { const i = __t.pane(0).querySelector(".bfv-filter"); i.value = "standup"; i.dispatchEvent(new Event("input")); await __t.sleep(160); return 1; })()`,
    );
    under("search", tSearch, 600);
    const tFt = await ms(
      `(async () => { __t.pane(0).querySelector(".bfv-fulltext input").click(); for (let k = 0; k < 100 && /Reading/.test(__t.panes()[0].count); k++) await __t.sleep(50); return 1; })()`,
    );
    under("full text over 3,001 notes", tFt, 5000);
    const r = (await panes())[0].count;
    check("a result count", /^\d+ \/ 3001$/.test(r), r);
    const tLogs = await ms(
      `(async () => { __t.pane(1).querySelector(".bfv-header").click(); await __t.sleep(0); return 1; })()`,
    );
    under("expand the filtered Logs pane", tLogs, 1500);
  });
  test("N2", "Typing in a hub note with its big pane open stays responsive", async () => {
    await click(`__t.view().contentEl.querySelector(".cm-content .cm-line:last-child")`);
    await T.key("End", { ctrl: true });
    const t0 = Date.now();
    for (const ch of "quick typing test") await T.type(ch);
    const dt = Date.now() - t0;
    under("17 keystrokes", dt, 1500);
    await sleep(2500);
    const lag = await ms(`new Promise(r => requestAnimationFrame(() => r(1)))`);
    under("frame after autosave + refresh", lag, 200);
    await ev(
      `(async () => { const f = app.vault.getAbstractFileByPath(${j(HUB)}); await app.vault.process(f, t => t.replace("quick typing test", "")); return 1; })()`,
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
      app.plugins.plugins["backlinks-full-view"].embedOpen.clear();
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
        eq(
          "collapsed at first, full path as title, no folder label",
          [s.collapsed, s.title, s.folder],
          [true, "_bfv/emb/Target", null],
        );
        eq("card border", s.border, "solid");
        const setFull = v =>
          ev(
            `(async () => { const p = __t.plugin(); p.settings.cardFullPath = ${v}; await p.saveSettings(); p.applyCardTitles(); await __t.sleep(300); return 1; })()`,
          );
        const was = await ev(`__t.plugin().settings.cardFullPath`);
        try {
          await setFull(false);
          const n = await embState();
          eq("setting off: name and folder label", [n.title, n.folder], ["Target", "_bfv/emb/"]);
        } finally {
          await setFull(was);
        }
        eq("setting on again: full path", (await embState()).title, "_bfv/emb/Target");
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
  for (const mode of ["reading", "lp"]) {
    test(`Q8-${mode}`, "An embed in a list item or a sentence stays on its line; one alone is a block", async () => {
      await fresh();
      await embFixtures();
      const p = "_bfv/emb/Inline.md";
      await ev(`(async () => { const t = ${j("Alone:\n\n![[_bfv/emb/Inner]]\n\n- one\n- ![[_bfv/emb/Inner]]\n- three\n\nSee ![[_bfv/emb/Inner]] here.\n")};
        const f = app.vault.getAbstractFileByPath(${j(p)}); if (f) await app.vault.modify(f, t); else await app.vault.create(${j(p)}, t); return 1; })()`);
      await open(p, mode);
      await sleep(1200);
      const look = () =>
        ev(`(() => { const root = [...__t.view().containerEl.querySelectorAll(".markdown-reading-view, .markdown-source-view")].find(e => e.offsetParent);
          const es = [...root.querySelectorAll(".bfv-note-embed")];
          const line = e => e.closest(".cm-line, li, p") ?? e.parentElement;
          return es.map(e => ({ inline: e.classList.contains("bfv-inline"), dy: Math.round(e.getBoundingClientRect().top - line(e).getBoundingClientRect().top),
            w: Math.round(e.getBoundingClientRect().width), lw: Math.round(line(e).getBoundingClientRect().width) })); })()`);
      const a = await look();
      eq(
        "inline: alone, list item, sentence",
        a.map(x => x.inline),
        [false, true, true],
      );
      check("alone: full width", a[0].w >= a[0].lw - 2, a[0]);
      check(
        "list item and sentence: on their line, as wide as the title",
        a.slice(1).every(x => x.dy < 8 && x.w < x.lw / 2),
        a,
      );
      const cur = () => ev(`__t.view().getMode() === "source" ? __t.view().editor.getCursor().line : -1`);
      const before = await cur();
      // a real click on the header's chevron
      await click(
        `[...__t.view().containerEl.querySelectorAll(".markdown-reading-view, .markdown-source-view")].find(e => e.offsetParent).querySelectorAll(".bfv-note-embed")[1].querySelector(".bfv-chevron")`,
      );
      await sleep(800);
      eq("toggling doesn't move the cursor onto the embed's line", await cur(), before);
      const b = (await look())[1];
      check(
        "expanded in the list item: still on the bullet's line, most of its width",
        b.inline && b.dy < 8 && b.w > b.lw * 0.8,
        b,
      );
    });
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
    await ev(`__t.closeAll()`);
    await open(EMB.self, "reading");
    await sleep(700);
    eq("self-embed is Obsidian's", (await embState()).cards, 0);
    // a note without embeds, open in Live Preview: it isn't rebuilt when the setting changes
    await open("_bfv/Short.md", "lp");
    await ev(`(() => { __t.plain = [__t.leaf, __t.leaf.view]; return 1; })()`);
    await open(EMB.host, "reading");
    await sleep(600);
    const set = v =>
      ev(
        `(async () => { const p = app.plugins.plugins["backlinks-full-view"]; p.settings.noteEmbeds = ${v}; await p.saveSettings(); p.rerenderNoteEmbeds(); return 1; })()`,
      );
    const was = await ev(`__t.plugin().settings.noteEmbeds`);
    try {
      await set(false);
      await sleep(1200);
      const s = await embState();
      eq("setting off: Obsidian's embeds", [s.cards, s.native], [0, ["_bfv/emb/Target", "_bfv/emb/Target#Sec"]]);
    } finally {
      await set(was);
    }
    await sleep(1200);
    eq("setting on: a card again", (await embState()).cards, 1);
    check("a note without embeds wasn't rebuilt", await ev(`__t.plain[0].view === __t.plain[1]`));
  });
  test("Q5", "Disabling the plugin gives Obsidian's embeds back; enabling makes cards again", async () => {
    await fresh();
    await embFixtures();
    await open(EMB.host, "lp");
    await sleep(700);
    await ev(
      `(async () => { await app.plugins.disablePlugin("backlinks-full-view"); await __t.sleep(1500); return 1; })()`,
    );
    const off = await ev(
      `(() => { const r = [...app.workspace.getLeavesOfType("markdown")].map(l => l.view.containerEl).find(e => e.querySelector('.internal-embed[src="_bfv/emb/Target"]')); return r ? [r.querySelectorAll(".bfv-note-embed").length, r.querySelectorAll('.markdown-embed[src="_bfv/emb/Target"]').length] : null; })()`,
    );
    eq("disabled: Obsidian's embed", off, [0, 1]);
    await ev(
      `(async () => { await app.plugins.enablePlugin("backlinks-full-view"); await __t.sleep(2000); return 1; })()`,
    );
    const on = await ev(
      `(() => { const r = [...app.workspace.getLeavesOfType("markdown")].map(l => l.view.containerEl).find(e => e.querySelector('.internal-embed[src="_bfv/emb/Target"]')); return r ? r.querySelectorAll(".bfv-note-embed").length : null; })()`,
    );
    check("enabled: card again", on >= 1, on);
  });
  test(
    "Q6",
    "A canvas file card of a note isn't turned into a card",
    async () => {
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
    },
    { needs: ["core:canvas"] },
  );

  test(
    "Q7",
    "Editor Multiple Lanes card: an embedded note is a collapsed card; expanding shows its properties and the note",
    async () => {
      await fresh();
      await embFixtures();
      await ev(`__t.closeAll()`);
      await closeLanes();
      await inLanes(EMB.host, async () => {
        const visibleRoot = `[...__t.view().containerEl.querySelectorAll(".markdown-reading-view, .markdown-source-view")].find(e => e.offsetParent)`;
        check("a card for ![[Target]]", await waitFor(`!!${visibleRoot}?.querySelector(".bfv-note-embed")`, 5000));
        const s = await embState();
        eq("one card, collapsed", [s.cards, s.collapsed], [1, true]);
        await click(embHeader);
        await sleep(900);
        const o = await embState();
        check(
          "expanded: its properties and the note",
          o.collapsed === false && !!o.props?.includes("zettel") && o.body,
          o,
        );
      });
      await closeLanes();
    },
    { needs: [LANES] },
  );
  test(
    "Q9",
    "A note with Excalidraw's frontmatter key keeps Obsidian's own embed (Excalidraw draws those)",
    async () => {
      await fresh();
      await embFixtures();
      await ev(`(async () => { const mk = async (p, t) => { const f = app.vault.getAbstractFileByPath(p); if (f) await app.vault.modify(f, t); else await app.vault.create(p, t); };
      await mk("_bfv/emb/Drawing.md", "---\\nexcalidraw-plugin: parsed\\n---\\n# Drawing\\n\\nText of the drawing.\\n");
      await mk("_bfv/emb/DrawHost.md", "![[_bfv/emb/Drawing]]\\n\\n![[_bfv/emb/Inner]]\\n");
      await __t.sleep(400); return 1; })()`);
      await open("_bfv/emb/DrawHost.md", "reading");
      await sleep(900);
      // the visible mode only (the hidden editor may have drawn its embeds too)
      const r =
        await ev(`(() => { const root = [...__t.view().containerEl.querySelectorAll(".markdown-reading-view, .markdown-source-view")].find(e => e.offsetParent);
      return [[...root.querySelectorAll(".bfv-note-embed .bfv-item")].map(i => i.dataset.bfvPath), !!root.querySelector('.internal-embed[src="_bfv/emb/Drawing"]:not(.bfv-note-embed)')]; })()`);
      eq("only the plain note is a card; the drawing stays Obsidian's (or Excalidraw's) embed", r, [
        ["_bfv/emb/Inner.md"],
        true,
      ]);
    },
  );

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
    await ev(`(() => { __t.card(1, ${j(SRC("Plain"))}).querySelector(".bfv-chevron").click(); return 1; })()`);
    check("card rendered", await waitFor(`__t.card(1, ${j(SRC("Plain"))}).textContent.includes("billing")`, 3000));
    await ev(`(() => { __t.card(1, ${j(SRC("Heading"))}).querySelector(".bfv-item-title").click(); return 1; })()`);
    await sleep(800);
    eq("title link opens in the popout's leaf", await ev(`__t.leaf.view.file?.path`), SRC("Heading"));
    await ev(`(() => { __t.leaf.view.containerEl.win.close(); return 1; })()`);
    await sleep(800);
  });
}
