(() => {
  "use strict";

  const STORAGE_KEY = "blogger-theme-studio-v1";
  const fontStacks = {
    system: "Arial, Helvetica, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Courier New', monospace",
  };
  const googleFontFamilies = {
    inter: "Inter",
    roboto: "Roboto",
    "open-sans": "Open Sans",
    lato: "Lato",
    montserrat: "Montserrat",
    poppins: "Poppins",
    "playfair-display": "Playfair Display",
    merriweather: "Merriweather",
    "source-serif-4": "Source Serif 4",
    nunito: "Nunito",
    oswald: "Oswald",
  };
  const googleFontWeights = "400;500;600;700";
  const maxBlockInstances = { header: 1, blog: 1, layout: 1, sidebar: 4, footer: 2, analytics: 1 };
  const samples = {
    header: {
      title: "Field Notes",
      description: "Stories, ideas, and things worth remembering.",
    },
    text: {
      title: "A little space for your ideas",
      text: "Introduce your blog, share what inspires you, or welcome readers to your corner of the internet. Select this section to make it your own.",
    },
    image: {
      title: "A moment worth keeping",
      imageUrl: "",
      alt: "A scenic landscape",
    },
    button: {
      label: "Explore the stories",
      url: "#stories",
    },
    analytics: { measurementId: "" },
    blog: { title: "Latest stories" },
    sidebar: { title: "Gadget area" },
    layout: {
      stack: "vertical",
    },
    footer: {
      copyright: "© {year} Field Notes. All rights reserved.",
    },
  };

  function createDefaultDesign() {
    return {
      background: "#ffffff",
      ink: "#202124",
      accent: "#6558d3",
      font: "system",
      googleFont: "",
      width: 1120,
      siteTitleColor: "#202124",
      siteTitleFont: "theme",
      siteTitleSize: 36,
      headingColor: "#202124",
      headingFont: "theme",
      headingSize: 20,
      postTitleColor: "#202124",
      postTitleFont: "theme",
      postTitleSize: 18,
      bodySize: 16,
      linkColor: "#6558d3",
      linkHoverColor: "#5748c2",
      footerBackground: "#ffffff",
      footerText: "#858b9a",
    };
  }

  const state = {
    name: "My Blogger theme",
    page: "home",
    device: "desktop",
    view: "design",
    selectedId: null,
    blocks: [],
    design: createDefaultDesign(),
  };

  const elements = {
    preview: document.querySelector("#site-preview"),
    frame: document.querySelector(".browser-frame"),
    designPanel: document.querySelector("#design-panel"),
    codePanel: document.querySelector("#code-panel"),
    pageSwitcher: document.querySelector("#page-switcher"),
    deviceSwitcher: document.querySelector("#device-switcher"),
    count: document.querySelector("#block-count"),
    inspectorTitle: document.querySelector("#inspector-title"),
    inspectorContent: document.querySelector("#inspector-content"),
    delete: document.querySelector("#delete-block"),
    status: document.querySelector("#status-message"),
    statusDot: document.querySelector("#status-dot"),
    xml: document.querySelector("#xml-output"),
    exportMessage: document.querySelector("#validation-message"),
  };

  let draggedBlockId = null;
  let dragLibraryType = null;
  let sidebarDragActive = false;
  let dirty = true;

  function makeBlock(type, values = {}) {
    return { id: `block-${crypto.randomUUID()}`, type, ...structuredClone(samples[type]), ...values };
  }

  function setStatus(message, warning = false) {
    elements.status.textContent = message;
    elements.statusDot.classList.toggle("warning", warning);
  }

  function markDirty(message = "Unsaved changes") {
    dirty = true;
    setStatus(message, true);
  }

  function safeUrl(value) {
    const input = String(value ?? "").trim();
    if (!input || input.startsWith("#") || input.startsWith("/")) return input || "#";
    try {
      const url = new URL(input);
      return ["http:", "https:", "mailto:"].includes(url.protocol) ? input : "#";
    } catch {
      return "#";
    }
  }

  function selectedBlock() {
    return state.blocks.find((block) => block.id === state.selectedId) ?? null;
  }

  function safeGoogleFontFamily(value) {
    const family = String(value ?? "").trim();
    return family && /^[\p{L}\p{N}][\p{L}\p{N} -]{0,79}$/u.test(family) ? family : "";
  }

  function selectedGoogleFont() {
    return safeGoogleFontFamily(state.design.googleFont) || googleFontFamilies[state.design.font] || "";
  }

  function selectedGoogleFonts() {
    return [...new Set([
      selectedGoogleFont(),
      googleFontFamilies[state.design.siteTitleFont],
      googleFontFamilies[state.design.headingFont],
      googleFontFamilies[state.design.postTitleFont],
    ].filter(Boolean))];
  }

  function fontStackForDesign() {
    const googleFont = selectedGoogleFont();
    return googleFont
      ? `"${googleFont}", ${fontStacks.system}`
      : fontStacks[state.design.font] ?? fontStacks.system;
  }

  function fontStackForRole(role) {
    if (role === "theme") return fontStackForDesign();
    const googleFont = googleFontFamilies[role];
    return googleFont ? `"${googleFont}", ${fontStacks.system}` : fontStacks[role] ?? fontStackForDesign();
  }

  function googleFontStylesheetUrl(families) {
    if (!families.length) return "";
    const requests = families.map((family) => {
      const encodedFamily = encodeURIComponent(family).replaceAll("%20", "+");
      return `family=${encodedFamily}:wght@${googleFontWeights}`;
    });
    return `https://fonts.googleapis.com/css2?${requests.join("&")}&display=swap`;
  }

  function blocksInRegion(regionId, columnIndex) {
    return state.blocks.filter((block) => regionId
      ? block.regionId === regionId && block.columnIndex === columnIndex
      : !block.regionId);
  }

  function blockRegion(block) {
    return block.regionId
      ? { regionId: block.regionId, columnIndex: block.columnIndex }
      : { regionId: null, columnIndex: null };
  }

  function siblingBlocks(block) {
    const region = blockRegion(block);
    return blocksInRegion(region.regionId, region.columnIndex);
  }

  function ensureSidebarLayout(candidate = null) {
    let layout = state.blocks.find((block) => block.type === "layout");
    if (!layout) {
      layout = candidate ?? makeBlock("layout");
      if (!candidate) state.blocks.push(layout);
    }
    state.blocks.forEach((block) => {
      if (block.type === "sidebar" && !block.regionId) {
        block.regionId = layout.id;
        block.columnIndex = 2;
      }
    });
    return layout;
  }

  function nextSidebarSlot(layout, excludingId = null) {
    const occupied = new Set(state.blocks
      .filter((block) => block.type === "sidebar" && block.regionId === layout.id && block.id !== excludingId)
      .map((block) => block.columnIndex));
    return [0, 1, 2, 3].find((slot) => !occupied.has(slot));
  }

  function getBlockLabel(type) {
    return {
      header: "Site header",
      text: "Text section",
      image: "Image",
      button: "Button",
      blog: "Blog posts",
      analytics: "Google Analytics",
      layout: "Sidebar positions",
      sidebar: "Gadget area",
      footer: "Site footer",
    }[type] ?? "Section";
  }

  function createPreviewBlock(block, content) {
    const wrapper = document.createElement("section");
    wrapper.className = `preview-block${block.id === state.selectedId ? " selected" : ""}`;
    wrapper.dataset.id = block.id;
    wrapper.dataset.label = getBlockLabel(block.type);
    wrapper.draggable = true;
    wrapper.append(content);
    return wrapper;
  }

  function addText(parent, tag, text, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    parent.append(node);
    return node;
  }

  function renderBlock(block) {
    let content;
    switch (block.type) {
      case "header": {
        content = document.createElement("header");
        content.className = "preview-header";
        addText(content, "h1", block.title, "");
        addText(content, "p", block.description, "");
        const gadgetHint = document.createElement("aside");
        gadgetHint.className = "preview-inline-gadget-hint";
        gadgetHint.textContent = "Blogger gadgets can be added here in Layout";
        content.append(gadgetHint);
        break;
      }
      case "text": {
        content = document.createElement("section");
        content.className = "preview-section";
        addText(content, "h2", block.title, "");
        addText(content, "p", block.text, "");
        break;
      }
      case "image": {
        content = document.createElement("figure");
        content.className = "preview-image-wrap";
        const image = document.createElement("img");
        image.className = "preview-image";
        image.alt = block.alt || "";
        const imageUrl = safeUrl(block.imageUrl);
        if (imageUrl !== "#") image.src = imageUrl;
        else {
          image.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 400'%3E%3Cdefs%3E%3ClinearGradient id='g'%3E%3Cstop stop-color='%23e4e4f6'/%3E%3Cstop offset='.55' stop-color='%23f5ded2'/%3E%3Cstop offset='1' stop-color='%23e6f0e5'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23g)' d='M0 0h1200v400H0z'/%3E%3C/svg%3E";
        }
        content.append(image);
        addText(content, "figcaption", block.title, "preview-caption");
        break;
      }
      case "button": {
        content = document.createElement("div");
        content.className = "preview-cta-wrap";
        const link = addText(content, "a", block.label, "preview-cta");
        link.href = safeUrl(block.url);
        break;
      }
      case "analytics": {
        content = document.createElement("aside");
        content.className = "preview-analytics";
        const validId = /^G-[A-Z0-9]{6,}$/i.test(block.measurementId.trim());
        addText(content, "strong", "Google Analytics", "");
        addText(content, "small", validId
          ? `Tracking enabled · ${block.measurementId.trim()}`
          : "Setup only · enter a GA4 measurement ID in the settings", "");
        break;
      }
      case "blog": {
        content = document.createElement("section");
        content.className = `preview-blog${state.page === "post" ? " is-post" : ""}${state.page === "search" ? " is-search" : ""}`;
        const heading = state.page === "post" ? "A story from the blog" : state.page === "search" ? "Search results for “design”" : block.title;
        addText(content, "h2", heading, "preview-blog-heading");
        const grid = document.createElement("div");
        grid.className = "preview-post-grid";
        const entries = state.page === "post" ? [
          ["A story from the blog", "A longer preview of your post content appears here. The real post body is supplied by Blogger."],
        ] : [
          ["Small things, thoughtfully made", "A few words from your latest post appear right here."],
          ["Notes from a slower morning", "A glimpse into another story on your blog."],
        ];
        entries.forEach(([title, summary], index) => {
          const card = document.createElement("article");
          card.className = "sample-post";
          const image = document.createElement("div");
          image.className = `sample-image${index === 1 ? " image-two" : ""}`;
          image.setAttribute("aria-hidden", "true");
          card.append(image);
          const titleHeading = document.createElement("h3");
          const titleLink = addText(titleHeading, "a", title, "");
          titleLink.href = "#";
          card.append(titleHeading);
          addText(card, "p", summary, "");
          const storyLink = addText(card, "a", "Read story", "preview-post-link");
          storyLink.href = "#";
          grid.append(card);
        });
        content.append(grid);
        break;
      }
      case "layout":
        content = document.createElement("div");
        content.className = "preview-layout-settings";
        addText(content, "strong", "Sidebar positions", "");
        addText(content, "small", "Two side-by-side positions on each side of the main content", "");
        break;
      case "sidebar": {
        content = document.createElement("aside");
        content.className = "preview-gadget";
        addText(content, "strong", block.title, "");
        addText(content, "small", "Blogger gadgets added in Layout will appear here.", "");
        break;
      }
      case "footer": {
        content = document.createElement("footer");
        content.className = "preview-footer";
        addText(content, "span", block.copyright.replace("{year}", String(new Date().getFullYear())), "");
        const gadgetHint = document.createElement("aside");
        gadgetHint.className = "preview-inline-gadget-hint";
        gadgetHint.textContent = "Blogger gadgets can be added here in Layout";
        content.append(gadgetHint);
        break;
      }
      default:
        content = document.createElement("div");
    }
    return createPreviewBlock(block, content);
  }

  function createDropZone(text, regionId = null, columnIndex = null) {
    const dropTarget = document.createElement("div");
    dropTarget.className = "drop-placeholder";
    dropTarget.textContent = text;
    dropTarget.dataset.dropEnd = "true";
    if (regionId) {
      dropTarget.dataset.regionId = regionId;
      dropTarget.dataset.columnIndex = String(columnIndex);
    }
    return dropTarget;
  }

  function sidebarGridTemplate(active) {
    const leftCount = active ? 2 : Math.min(2, state.blocks.filter((block) => block.type === "sidebar" && block.columnIndex < 2).length);
    const rightCount = active ? 2 : Math.min(2, state.blocks.filter((block) => block.type === "sidebar" && block.columnIndex >= 2).length);
    const sideTracks = (count) => count ? `repeat(${count}, minmax(74px, 1fr)) ` : "";
    return `${sideTracks(leftCount)}${leftCount || rightCount ? "minmax(190px, 4fr)" : "minmax(0, 1fr)"}${rightCount ? ` ${sideTracks(rightCount).trimEnd()}` : ""}`;
  }

  function setSidebarDragActive(active) {
    sidebarDragActive = active;
    elements.preview.classList.toggle("sidebar-drag-active", active);
    const page = elements.preview.querySelector(".preview-site-layout");
    if (page) page.style.gridTemplateColumns = sidebarGridTemplate(active);
  }

  function renderPage() {
    const layout = state.blocks.find((block) => block.type === "layout");
    const topHeader = state.blocks.find((block) => block.type === "header" && block.placement === "top");
    const pageFooters = state.blocks.filter((block) => block.type === "footer" && block.placement === "page-bottom");
    const mainFooters = state.blocks.filter((block) => block.type === "footer" && block.placement !== "page-bottom");
    const rootBlocks = blocksInRegion(null, null).filter((block) => block.type !== "layout"
      && block.type !== "sidebar"
      && !(block.type === "header" && block.placement === "top")
      && block.type !== "footer");
    const sidebarBlocks = [0, 1, 2, 3].map((slot) => layout
      ? blocksInRegion(layout.id, slot).filter((block) => block.type === "sidebar")
      : []);
    if (!layout) {
      sidebarBlocks[2] = state.blocks.filter((block) => block.type === "sidebar");
    }

    const page = document.createElement("div");
    const hasLeft = sidebarBlocks[0].length + sidebarBlocks[1].length > 0;
    const hasRight = sidebarBlocks[2].length + sidebarBlocks[3].length > 0;
    page.className = `preview-site-layout${hasLeft ? " has-left-sidebar" : ""}${hasRight ? " has-right-sidebar" : ""}`;
    page.style.gridTemplateColumns = sidebarGridTemplate(sidebarDragActive);
    const createSidebarSlot = (slotIndex, blocks) => {
      const side = slotIndex < 2 ? "left" : "right";
      const position = slotIndex % 2 + 1;
      const sidebar = document.createElement("aside");
      sidebar.className = `preview-sidebar-slot preview-sidebar-${side}${blocks.length ? " occupied-sidebar-slot" : " empty-sidebar-slot"}`;
      sidebar.dataset.sidebarSlot = String(slotIndex);
      sidebar.dataset.regionId = layout?.id ?? "";
      sidebar.dataset.columnIndex = String(slotIndex);
      sidebar.setAttribute("aria-label", `${side} sidebar position ${position}`);
      if (blocks.length) {
        sidebar.append(renderBlock(blocks[0]));
      } else {
        const target = createDropZone(`Drop sidebar here · ${side} ${position}`);
        target.classList.add("sidebar-drop-target");
        target.setAttribute("aria-label", `Drop a sidebar in the ${side} position ${position}`);
        sidebar.append(target);
      }
      return sidebar;
    };

    const main = document.createElement("main");
    main.className = "preview-main-column";
    rootBlocks.forEach((block) => main.append(renderBlock(block)));
    main.append(createDropZone("Drop sections into the main content", null, null));
    const mainFooterPosition = document.createElement("div");
    mainFooterPosition.className = `preview-footer-position main-footer-position${mainFooters.length ? " occupied-footer-position" : ""}`;
    mainFooterPosition.dataset.footerPosition = "main-bottom";
    mainFooterPosition.setAttribute("aria-label", "Footer position below the main content");
    if (mainFooters.length) {
      mainFooters.forEach((block) => mainFooterPosition.append(renderBlock(block)));
    } else {
      const footerTarget = createDropZone("Drop the footer here to place it below the main content");
      footerTarget.classList.add("footer-drop-target");
      footerTarget.setAttribute("aria-label", "Drop the footer below the main content");
      mainFooterPosition.append(footerTarget);
    }
    main.append(mainFooterPosition);

    const headerPosition = document.createElement("div");
    headerPosition.className = `preview-header-position${topHeader ? " occupied-header-position" : ""}`;
    headerPosition.dataset.headerPosition = "top";
    headerPosition.setAttribute("aria-label", "Header position above all sidebars and main content");
    if (topHeader) {
      headerPosition.append(renderBlock(topHeader));
    } else {
      const headerTarget = createDropZone("Drop the header here to place it above all sections");
      headerTarget.classList.add("header-drop-target");
      headerTarget.setAttribute("aria-label", "Drop the header above all sidebars and main content");
      headerPosition.append(headerTarget);
    }
    elements.preview.append(headerPosition);
    page.append(createSidebarSlot(0, sidebarBlocks[0]));
    page.append(createSidebarSlot(1, sidebarBlocks[1]));
    page.append(main);
    page.append(createSidebarSlot(2, sidebarBlocks[2]));
    page.append(createSidebarSlot(3, sidebarBlocks[3]));
    elements.preview.append(page);
    const pageFooterPosition = document.createElement("div");
    pageFooterPosition.className = `preview-footer-position page-footer-position${pageFooters.length ? " occupied-footer-position" : ""}`;
    pageFooterPosition.dataset.footerPosition = "page-bottom";
    pageFooterPosition.setAttribute("aria-label", "Footer position below the entire layout");
    if (pageFooters.length) {
      pageFooters.forEach((block) => pageFooterPosition.append(renderBlock(block)));
    } else {
      const footerTarget = createDropZone("Drop the footer here to place it below all sections and sidebars");
      footerTarget.classList.add("footer-drop-target");
      footerTarget.setAttribute("aria-label", "Drop the footer below all sections and sidebars");
      pageFooterPosition.append(footerTarget);
    }
    elements.preview.append(pageFooterPosition);
  }

  function applyDesign() {
    elements.preview.style.setProperty("--preview-bg", state.design.background);
    elements.preview.style.setProperty("--preview-ink", state.design.ink);
    elements.preview.style.setProperty("--preview-accent", state.design.accent);
    elements.preview.style.setProperty("--preview-font", fontStackForDesign());
    elements.preview.style.setProperty("--preview-width", `${state.design.width}px`);
    elements.preview.style.setProperty("--preview-title-color", state.design.siteTitleColor);
    elements.preview.style.setProperty("--preview-title-font", fontStackForRole(state.design.siteTitleFont));
    elements.preview.style.setProperty("--preview-title-size", `${state.design.siteTitleSize}px`);
    elements.preview.style.setProperty("--preview-heading-color", state.design.headingColor);
    elements.preview.style.setProperty("--preview-heading-font", fontStackForRole(state.design.headingFont));
    elements.preview.style.setProperty("--preview-heading-size", `${state.design.headingSize}px`);
    elements.preview.style.setProperty("--preview-post-title-color", state.design.postTitleColor);
    elements.preview.style.setProperty("--preview-post-title-font", fontStackForRole(state.design.postTitleFont));
    elements.preview.style.setProperty("--preview-post-title-size", `${state.design.postTitleSize}px`);
    elements.preview.style.setProperty("--preview-body-size", `${state.design.bodySize}px`);
    elements.preview.style.setProperty("--preview-link", state.design.linkColor);
    elements.preview.style.setProperty("--preview-link-hover", state.design.linkHoverColor);
    elements.preview.style.setProperty("--preview-footer-bg", state.design.footerBackground);
    elements.preview.style.setProperty("--preview-footer-text", state.design.footerText);
    const fontLinkId = "google-font-stylesheet";
    const fontUrl = googleFontStylesheetUrl(selectedGoogleFonts());
    let fontLink = document.getElementById(fontLinkId);
    if (fontUrl) {
      if (!fontLink) {
        fontLink = document.createElement("link");
        fontLink.id = fontLinkId;
        fontLink.rel = "stylesheet";
        document.head.append(fontLink);
      }
      fontLink.href = fontUrl;
    } else {
      fontLink?.remove();
    }
    document.querySelectorAll("[data-design]").forEach((input) => {
      input.value = state.design[input.dataset.design];
      if (input.type === "color") {
        const picker = input.closest(".color-picker-control");
        picker.style.setProperty("--swatch-color", input.value);
        picker.querySelector(".color-picker-value").textContent = input.value.toUpperCase();
      }
    });
    document.querySelector("#width-output").value = state.design.width;
    document.querySelectorAll("[data-design-output]").forEach((output) => {
      output.value = state.design[output.dataset.designOutput];
    });
  }

  function initializeColorPickers() {
    document.querySelectorAll('.setting-row input[type="color"]').forEach((input) => {
      const wrapper = document.createElement("div");
      wrapper.className = "color-picker-control";
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "color-swatch";
      swatch.setAttribute("aria-label", input.getAttribute("aria-label") || "Choose color");
      swatch.setAttribute("aria-haspopup", "dialog");
      swatch.setAttribute("aria-expanded", "false");

      const popover = document.createElement("div");
      popover.className = "color-picker-popover";
      popover.id = `${input.id}-popover`;
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-label", `${input.getAttribute("aria-label") || "Color"} picker`);
      popover.hidden = true;
      swatch.setAttribute("aria-controls", popover.id);

      const value = document.createElement("span");
      value.className = "color-picker-value";
      value.textContent = input.value.toUpperCase();
      const done = document.createElement("button");
      done.type = "button";
      done.className = "color-picker-done";
      done.setAttribute("aria-label", "Apply color and close picker");
      done.title = "Apply color";
      done.textContent = "✓";

      input.className = "color-picker-input";
      input.tabIndex = -1;
      wrapper.style.setProperty("--swatch-color", input.value);
      input.parentElement.replaceChild(wrapper, input);
      popover.append(input, value, done);
      wrapper.append(swatch, popover);

      swatch.addEventListener("click", () => {
        document.querySelectorAll(".color-picker-popover:not([hidden])").forEach((openPopover) => {
          openPopover.hidden = true;
          openPopover.parentElement.querySelector(".color-swatch").setAttribute("aria-expanded", "false");
        });
        popover.hidden = false;
        swatch.setAttribute("aria-expanded", "true");
        if (typeof input.showPicker === "function") input.showPicker();
        else input.click();
      });

      done.addEventListener("click", () => {
        popover.hidden = true;
        swatch.setAttribute("aria-expanded", "false");
        swatch.focus();
      });
    });

    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".color-picker-control")) return;
      document.querySelectorAll(".color-picker-popover:not([hidden])").forEach((popover) => {
        popover.hidden = true;
        popover.parentElement.querySelector(".color-swatch").setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".color-picker-popover:not([hidden])").forEach((popover) => {
        popover.hidden = true;
        const swatch = popover.parentElement.querySelector(".color-swatch");
        swatch.setAttribute("aria-expanded", "false");
        swatch.focus();
      });
    });
  }

  function renderCanvas() {
    elements.preview.replaceChildren();
    applyDesign();
    renderPage();
    elements.count.textContent = String(state.blocks.filter((block) => block.type !== "layout").length);
    renderBlockLibrary();
    renderInspector();
    updateExportCode();
  }

  function renderBlockLibrary() {
    document.querySelectorAll(".library-entry").forEach((entry) => {
      const type = entry.dataset.libraryType;
      const blocks = state.blocks.filter((block) => block.type === type);
      const count = blocks.length;
      const limit = maxBlockInstances[type];
      const complete = Number.isFinite(limit) && count >= limit;
      const addButton = entry.querySelector("[data-block-type]");
      const status = entry.querySelector(".library-status");
      const removeButton = entry.querySelector("[data-remove-type]");

      entry.classList.toggle("complete", complete);
      entry.classList.toggle("partial", count > 0 && !complete);
      addButton.disabled = complete;
      addButton.setAttribute("aria-label", count
        ? `${getBlockLabel(type)}${Number.isFinite(limit) ? `, ${count} of ${limit} added` : `, ${count} added`}${complete ? ", complete" : ", add another"}`
        : `Add ${getBlockLabel(type)}`);
      status.textContent = complete ? "✓" : count > 0
        ? Number.isFinite(limit) ? `${count}/${limit}` : String(count)
        : "+";
      status.setAttribute("aria-label", complete ? "Complete" : count > 0 ? `${count} added` : "Add");
      removeButton.hidden = count === 0;
      removeButton.setAttribute("aria-label", count > 1
        ? `Remove last ${getBlockLabel(type).toLowerCase()}`
        : `Remove ${getBlockLabel(type).toLowerCase()}`);
      removeButton.title = removeButton.getAttribute("aria-label");
    });
  }

  function renderPreview() {
    elements.preview.replaceChildren();
    renderPage();
    elements.count.textContent = String(state.blocks.filter((block) => block.type !== "layout").length);
    updateExportCode();
  }

  function createField(labelText, field, value, options = {}) {
    const label = document.createElement("label");
    label.className = "field";
    const title = document.createElement("span");
    title.textContent = labelText;
    label.append(title);
    let input;
    if (options.multiline) {
      input = document.createElement("textarea");
    } else {
      input = document.createElement("input");
      input.type = options.type ?? "text";
    }
    input.dataset.field = field;
    input.value = value ?? "";
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.type === "color") input.className = "color-field";
    if (options.maxLength) input.maxLength = options.maxLength;
    label.append(input);
    return label;
  }

  function renderInspector() {
    const block = selectedBlock();
    elements.inspectorContent.replaceChildren();
    elements.delete.disabled = !block || block.type === "layout";
    if (!block) {
      elements.inspectorTitle.textContent = "Nothing selected";
      const empty = document.createElement("div");
      empty.className = "empty-inspector";
      const illustration = document.createElement("div");
      illustration.className = "empty-illustration";
      illustration.setAttribute("aria-hidden", "true");
      illustration.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
      addText(empty, "strong", "Select a block", "");
      addText(empty, "p", "Click a section on the canvas to edit its text, links and details.", "");
      empty.prepend(illustration);
      elements.inspectorContent.append(empty);
      return;
    }

    elements.inspectorTitle.textContent = getBlockLabel(block.type);
    const group = document.createElement("section");
    group.className = "property-group";
    const groupTitle = document.createElement("h3");
    groupTitle.className = "property-group-title";
    groupTitle.textContent = "Content";
    group.append(groupTitle);

    if (block.type === "header") {
      group.append(createField("Blog title", "title", block.title, { maxLength: 100 }));
      group.append(createField("Description", "description", block.description, { multiline: true, maxLength: 240 }));
      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent = "This Header section accepts additional Blogger gadgets. Add them later in Blogger → Layout.";
      group.append(hint);
    } else if (block.type === "text") {
      group.append(createField("Heading", "title", block.title, { maxLength: 120 }));
      group.append(createField("Paragraph", "text", block.text, { multiline: true, maxLength: 1000 }));
    } else if (block.type === "image") {
      group.append(createField("Image URL", "imageUrl", block.imageUrl, { placeholder: "https://example.com/image.jpg" }));
      group.append(createField("Alt text", "alt", block.alt, { maxLength: 180 }));
      group.append(createField("Caption", "title", block.title, { maxLength: 150 }));
      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent = "Use a public image URL. Blogger-hosted images can be resized in the exported theme.";
      group.append(hint);
    } else if (block.type === "button") {
      group.append(createField("Button label", "label", block.label, { maxLength: 80 }));
      group.append(createField("Link URL", "url", block.url, { placeholder: "https://example.com" }));
    } else if (block.type === "analytics") {
      group.append(createField("GA4 measurement ID", "measurementId", block.measurementId, {
        maxLength: 30,
        placeholder: "G-XXXXXXXXXX",
      }));
      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent = "Paste the GA4 Measurement ID from Google Analytics. The exported theme inserts Google's standard tracking script in the page head; this setup block is not shown to blog visitors.";
      group.append(hint);
    } else if (block.type === "blog") {
      group.append(createField("Section heading", "title", block.title, { maxLength: 100 }));
      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent = "This block exports as Blogger's dynamic Blog widget. Posts, links and pagination are filled by Blogger.";
      group.append(hint);
    } else if (block.type === "layout") {
      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent = "Four sidebar positions are available: two on either side of the single main content area.";
      group.append(hint);
    } else if (block.type === "sidebar") {
      group.append(createField("Layout area name", "title", block.title, { maxLength: 80 }));
      const hint = document.createElement("p");
      hint.className = "field-hint";
      const side = block.columnIndex < 2 ? "left" : "right";
      const position = block.columnIndex % 2 + 1;
      hint.textContent = `This area is in position ${position} on the ${side}. Drag it to any empty sidebar slot.`;
      group.append(hint);
    } else if (block.type === "footer") {
      group.append(createField("Copyright text", "copyright", block.copyright, { maxLength: 160 }));
      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent = `${block.placement === "page-bottom"
        ? "This footer sits below the entire layout, including both sidebars."
        : "This footer sits below the main content, between the sidebars."} This Footer section accepts additional Blogger gadgets in Blogger → Layout. Use {year} to insert the current year.`;
      group.append(hint);
    }
    elements.inspectorContent.append(group);

    if (["text", "button"].includes(block.type)) {
      const styleGroup = document.createElement("section");
      styleGroup.className = "property-group";
      const styleTitle = document.createElement("h3");
      styleTitle.className = "property-group-title";
      styleTitle.textContent = "Style";
      styleGroup.append(styleTitle);
      const alignment = document.createElement("label");
      alignment.className = "field";
      const label = document.createElement("span");
      label.textContent = "Alignment";
      const select = document.createElement("select");
      select.dataset.field = "align";
      ["left", "center", "right"].forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value[0].toUpperCase() + value.slice(1);
        option.selected = (block.align ?? "left") === value;
        select.append(option);
      });
      alignment.append(label, select);
      styleGroup.append(alignment);
      elements.inspectorContent.append(styleGroup);
    }

    const actions = document.createElement("div");
    actions.className = "block-actions";
    const up = document.createElement("button");
    up.className = "button button-quiet";
    up.type = "button";
    up.dataset.move = "-1";
    up.textContent = "↑ Move up";
    const down = document.createElement("button");
    down.className = "button button-quiet";
    down.type = "button";
    down.dataset.move = "1";
    down.textContent = "↓ Move down";
    const siblings = siblingBlocks(block);
    const siblingIndex = siblings.indexOf(block);
    up.disabled = siblingIndex === 0;
    down.disabled = siblingIndex === siblings.length - 1;
    actions.append(up, down);
    elements.inspectorContent.append(actions);
  }

  function insertBlock(type, index = state.blocks.length, region = null) {
    if (!(type in samples)) return;
    if (region?.placement === "top" && type !== "header") {
      setStatus("Only the Header block can be placed above the sidebar and main content.", true);
      return;
    }
    if (region?.placement && ["main-bottom", "page-bottom"].includes(region.placement) && type !== "footer") {
      setStatus("Only the Footer block can be placed in a footer position.", true);
      return;
    }
    if ((region?.regionId || Number.isInteger(region?.slotIndex)) && type !== "sidebar") {
      setStatus("Only gadget areas can be placed in a sidebar. Other sections stay in the main content.", true);
      return;
    }
    const typeCount = state.blocks.filter((block) => block.type === type).length;
    const instanceLimit = maxBlockInstances[type];
    if (Number.isFinite(instanceLimit) && typeCount >= instanceLimit) {
      setStatus(`All ${instanceLimit} ${getBlockLabel(type).toLowerCase()}${instanceLimit === 1 ? "" : "s"} are already added.`, true);
      return;
    }
    const block = makeBlock(type);
    if (type === "header" && region?.placement === "top") block.placement = "top";
    if (type === "footer") {
      const requestedPlacement = region?.placement;
      const occupiedPlacements = new Set(state.blocks
        .filter((item) => item.type === "footer")
        .map((item) => item.placement === "page-bottom" ? "page-bottom" : "main-bottom"));
      if (requestedPlacement && occupiedPlacements.has(requestedPlacement)) {
        setStatus("A footer already occupies that position. Choose the other footer position.", true);
        return;
      }
      block.placement = requestedPlacement
        || (occupiedPlacements.has("main-bottom") ? "page-bottom" : "main-bottom");
    }
    if (type === "layout") {
      ensureSidebarLayout(block);
    } else if (type === "sidebar") {
      if (state.blocks.filter((item) => item.type === "sidebar").length >= 4) {
        setStatus("All four sidebar positions are full. Remove an area before adding another.", true);
        return;
      }
      const layout = ensureSidebarLayout();
      block.regionId = layout.id;
      const slot = Number.isInteger(region?.slotIndex)
        ? region.slotIndex
        : Number.isInteger(region?.columnIndex) ? region.columnIndex : nextSidebarSlot(layout);
      const occupied = state.blocks.some((item) => item.type === "sidebar" && item.regionId === layout.id && item.columnIndex === slot);
      if (slot < 0 || slot > 3 || occupied) {
        setStatus("That sidebar position is already occupied. Choose an empty slot.", true);
        return;
      }
      block.columnIndex = slot;
    }
    state.blocks.splice(Math.max(0, Math.min(index, state.blocks.length)), 0, block);
    state.selectedId = block.id;
    renderCanvas();
    markDirty(`${getBlockLabel(type)} added`);
  }

  function removeBlockById(blockId, message = "Block removed") {
    const index = state.blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return false;
    const [removed] = state.blocks.splice(index, 1);
    if (removed.type === "layout") {
      state.blocks.forEach((block) => {
        if (block.regionId === removed.id) {
          delete block.regionId;
          delete block.columnIndex;
        }
      });
    }
    if (state.selectedId === removed.id) state.selectedId = null;
    renderCanvas();
    markDirty(message);
    return true;
  }

  function moveBlock(sourceId, targetId, end = false, destination = null) {
    const from = state.blocks.findIndex((block) => block.id === sourceId);
    if (from < 0) return;
    const source = state.blocks[from];
    if (destination?.placement === "top" && source.type !== "header") {
      setStatus("Only the Header block can be placed above the sidebar and main content.", true);
      return;
    }
    if (destination?.placement && ["main-bottom", "page-bottom"].includes(destination.placement)
      && source.type !== "footer") {
      setStatus("Only the Footer block can be placed in a footer position.", true);
      return;
    }
    const targetSlot = Number.isInteger(destination?.slotIndex)
      ? destination.slotIndex
      : destination?.regionId ? destination.columnIndex : null;
    if ((targetSlot !== null && (source.type !== "sidebar" || targetSlot < 0 || targetSlot > 3))
      || (!destination?.regionId && !Number.isInteger(destination?.slotIndex) && source.type === "sidebar")) {
      setStatus(source.type === "sidebar"
        ? "Drop the gadget area into one of the four sidebar positions."
        : "Only gadget areas can be placed in a sidebar. Other sections stay in the main content.", true);
      return;
    }
    if (Number.isInteger(targetSlot) && source.columnIndex !== targetSlot) {
      const layout = ensureSidebarLayout();
      const occupant = state.blocks.find((block) => block.type === "sidebar"
        && block.regionId === layout.id && block.columnIndex === targetSlot && block.id !== sourceId);
      if (occupant) occupant.columnIndex = source.columnIndex;
      source.regionId = layout.id;
      source.columnIndex = targetSlot;
    }
    const [block] = state.blocks.splice(from, 1);
    if (destination) {
      if (destination.placement === "top") {
        delete block.regionId;
        delete block.columnIndex;
        block.placement = "top";
      } else if (destination.placement === "main-bottom" || destination.placement === "page-bottom") {
        delete block.regionId;
        delete block.columnIndex;
        block.placement = destination.placement;
      } else if (Number.isInteger(targetSlot)) {
        block.regionId = ensureSidebarLayout().id;
        block.columnIndex = targetSlot;
      } else if (destination.regionId) {
        block.regionId = destination.regionId;
        block.columnIndex = destination.columnIndex;
      } else {
        delete block.regionId;
        delete block.columnIndex;
        if (block.type === "header") delete block.placement;
        if (block.type === "footer") block.placement = "main-bottom";
      }
    }
    let to = targetId ? state.blocks.findIndex((item) => item.id === targetId) : -1;
    if (to < 0 && end && block.regionId) {
      const siblings = blocksInRegion(block.regionId, block.columnIndex);
      to = siblings.length ? state.blocks.indexOf(siblings[siblings.length - 1]) + 1 : state.blocks.findIndex((item) => item.id === block.regionId) + 1;
    }
    if (to < 0) to = state.blocks.length;
    state.blocks.splice(to, 0, block);
    state.selectedId = block.id;
    renderCanvas();
    markDirty("Block order updated");
  }

  function xmlText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function xmlAttr(value) {
    return xmlText(value);
  }

  function cdataText(value) {
    const cdataEnd = "]]" + ">";
    const cdataSplit = "]]" + "]]" + "><![CDATA[>";
    return String(value).replaceAll(cdataEnd, cdataSplit);
  }

  function blogMarkup(block) {
    const title = xmlText(block.title || "Latest stories");
    return `<section class='blog-content'>
      <b:section id='theme_section_main' class='main' maxwidgets='1' name='Posts' showaddelement='no'>
        <b:widget id='Blog1' locked='true' title='Blog Posts' type='Blog' version='2' visible='true'>
          <b:includable id='postMetadataJSON'/>
          <b:includable id='post-jsonld' var='post'>
            <script type='application/ld+json'>{
              "@context": "https://schema.org",
              "@type": "<b:if cond='data:view.isPage'>WebPage<b:else/>BlogPosting</b:if>",
              "mainEntityOfPage": "<data:post.url.canonical.jsonEscaped/>",
              "headline": "<data:post.title.jsonEscaped/>",
              "description": "<b:eval expr='snippet(data:post.snippets.long, { length: 160, links: false }).jsonEscaped'/>",
              <b:if cond='data:view.isPost'>
              "datePublished": "<data:post.date.iso8601.jsonEscaped/>",
              "dateModified": "<data:post.lastUpdated.iso8601.jsonEscaped/>",
              </b:if>
              <b:if cond='data:post.featuredImage'>
              <b:with value='resizeImage(data:post.featuredImage, 1280, "16:9")' var='image'>
              "image": { "@type": "ImageObject", "url": "<data:image.jsonEscaped/>", "width": <b:eval expr='data:image.width ?: 1280'/>, "height": <b:eval expr='data:image.height ?: 720'/> },
              </b:with>
              </b:if>
              "author": { "@type": "Person", "name": "<data:post.author.name.jsonEscaped/>", "url": "<b:eval expr='(data:post.author.profileUrl ?: data:blog.homepageUrl.canonical).jsonEscaped'/>" },
              "publisher": { "@type": "Organization", "name": "<data:blog.title.jsonEscaped/>" }
            }</script>
          </b:includable>
          <b:includable id='main'>
            <b:if cond='data:view.isError'>
              <h1>Page not found</h1>
              <p><data:navMessage/></p>
            <b:elseif cond='data:view.isMultipleItems'/>
              <h2>${title}</h2>
              <b:if cond='data:posts.empty'><p><data:messages.noResultsFound/></p></b:if>
              <div class='post-grid'>
                <b:with value='data:posts first (p => p.featuredImage)' var='firstImagePost'>
                  <b:loop values='data:posts' var='post'>
                    <article class='post-card'>
                      <b:if cond='data:post.featuredImage'>
                        <a expr:href='data:post.url'>
                          <img expr:alt='data:post.title' expr:src='resizeImage(data:post.featuredImage, 640, "16:9")' expr:srcset='sourceSet(data:post.featuredImage, [320, 640, 960], "16:9")' sizes='(max-width: 760px) 100vw, (max-width: 1120px) 50vw, 360px' width='640' height='360' decoding='async'>
                            <b:attr expr:value='data:post.id == data:firstImagePost.id ? "eager" : "lazy"' name='loading'/>
                            <b:attr cond='data:post.id == data:firstImagePost.id' name='fetchpriority' value='high'/>
                          </img>
                        </a>
                      </b:if>
                      <h2><a expr:href='data:post.url'><data:post.title/></a></h2>
                      <p class='post-meta'>
                        <span class='post-author'><data:post.author.name/></span>
                        <time expr:datetime='data:post.date.iso8601'><data:post.date/></time>
                      </p>
                      <p><data:post.snippets.short/></p>
                    </article>
                  </b:loop>
                </b:with>
              </div>
              <nav class='pager' aria-label='Post pages'>
                <b:if cond='data:newerPageUrl'><a expr:href='data:newerPageUrl'>Newer posts</a></b:if>
                <b:if cond='data:olderPageUrl'><a expr:href='data:olderPageUrl'>Older posts</a></b:if>
              </nav>
            <b:else/>
              <b:loop values='data:posts' var='post'>
                <article class='post-full'>
                  <h1><data:post.title/></h1>
                  <p class='post-meta'>
                    <span class='post-author'><data:post.author.name/></span>
                    <time expr:datetime='data:post.date.iso8601'><data:post.date/></time>
                  </p>
                  <div class='post-body'><data:post.body/></div>
                  <b:include cond='data:view.isSingleItem' data='post' name='post-jsonld'/>
                </article>
              </b:loop>
            </b:if>
          </b:includable>
        </b:widget>
      </b:section>
    </section>`;
  }

  function blockToXml(block, counters) {
    switch (block.type) {
      case "header":
        counters.Header += 1;
        return `<header class='site-header'>
      <b:section id='theme_section_header${counters.Header}' class='header' maxwidgets='10' name='Header' showaddelement='yes'>
        <b:widget id='Header${counters.Header}' locked='true' title='Blog Header' type='Header' version='2' visible='true'>
          <b:includable id='main'>
            <div class='site-branding'>
              <b:if cond='data:view.isSingleItem'><p class='site-title'><a expr:href='data:blog.homepageUrl'><data:title/></a></p><b:else/><h1 class='site-title'><a expr:href='data:blog.homepageUrl'><data:title/></a></h1></b:if>
              <b:if cond='data:description'><p class='site-description'><data:description/></p></b:if>
            </div>
          </b:includable>
        </b:widget>
      </b:section>
    </header>`;
      case "text": {
        const align = ["left", "center", "right"].includes(block.align) ? block.align : "left";
        return `<section class='content-section' style='text-align:${align}'>
      <h2>${xmlText(block.title)}</h2>
      <p>${xmlText(block.text)}</p>
    </section>`;
      }
      case "image": {
        const url = safeUrl(block.imageUrl);
        const image = url === "#" ? "" : `<img src='${xmlAttr(url)}' alt='${xmlAttr(block.alt)}' loading='lazy'/>`;
        return `<figure class='image-section'>${image}<figcaption>${xmlText(block.title)}</figcaption></figure>`;
      }
      case "button": {
        const align = ["left", "center", "right"].includes(block.align) ? block.align : "left";
        return `<div class='button-section' style='text-align:${align}'><a class='theme-button' href='${xmlAttr(safeUrl(block.url))}'>${xmlText(block.label)}</a></div>`;
      }
      case "analytics":
        return "";
      case "blog":
        return blogMarkup(block);
      case "layout":
        return "";
      case "sidebar":
        counters.HTML += 1;
        return `<aside class='sidebar'>
      <b:section id='theme_section_sidebar${counters.HTML}' class='sidebar' name='${xmlAttr(block.title || "Sidebar")}' showaddelement='yes'>
        <b:widget id='HTML${counters.HTML}' locked='false' title='${xmlAttr(block.title || "Sidebar gadget")}' type='HTML' version='2' visible='true'>
          <b:includable id='main'><div class='widget-content'><data:content/></div></b:includable>
        </b:widget>
      </b:section>
    </aside>`;
      case "footer":
        counters.HTML += 1;
        return `<footer class='site-footer'>
      <b:section id='theme_section_footer${counters.HTML}' class='footer' maxwidgets='10' name='Footer' showaddelement='yes'>
        <b:widget id='HTML${counters.HTML}' locked='false' title='Footer content' type='HTML' version='2' visible='true'>
          <b:includable id='main'><div class='widget-content'><data:content/></div></b:includable>
        </b:widget>
      </b:section>
      <p>${xmlText(block.copyright.replaceAll("{year}", String(new Date().getFullYear())))}</p>
    </footer>`;
      default:
        return "";
    }
  }

  function buildThemeCss(design, font) {
    const fontValue = (family, size) => `normal normal ${size}px ${family.replaceAll('"', "'")}`;
    const variables = `/*
<Group description="Colors" selector="body">
  <Variable name="body.background.color" description="Page background" type="color" default="${design.background}"/>
  <Variable name="body.text.color" description="Body text" type="color" default="${design.ink}"/>
  <Variable name="accent.color" description="Button color" type="color" default="${design.accent}"/>
  <Variable name="site.title.color" description="Site title color" type="color" default="${design.siteTitleColor}"/>
  <Variable name="section.title.color" description="Section heading color" type="color" default="${design.headingColor}"/>
  <Variable name="post.title.color" description="Post title color" type="color" default="${design.postTitleColor}"/>
  <Variable name="body.link.color" description="Link color" type="color" default="${design.linkColor}"/>
  <Variable name="body.link.hover.color" description="Link hover color" type="color" default="${design.linkHoverColor}"/>
  <Variable name="footer.background.color" description="Footer background" type="color" default="${design.footerBackground}"/>
  <Variable name="footer.text.color" description="Footer text" type="color" default="${design.footerText}"/>
</Group>
<Group description="Fonts" selector="body">
  <Variable name="body.text.font" description="Body font" type="font" default="${fontValue(font, design.bodySize)}"/>
  <Variable name="body.text.size" description="Body text size" type="length" default="${design.bodySize}px" min="12px" max="22px"/>
  <Variable name="site.title.font" description="Site title font" type="font" default="${fontValue(fontStackForRole(design.siteTitleFont), design.siteTitleSize)}"/>
  <Variable name="site.title.size" description="Site title size" type="length" default="${design.siteTitleSize}px" min="24px" max="48px"/>
  <Variable name="section.title.font" description="Section heading font" type="font" default="${fontValue(fontStackForRole(design.headingFont), design.headingSize)}"/>
  <Variable name="section.title.size" description="Section heading size" type="length" default="${design.headingSize}px" min="16px" max="36px"/>
  <Variable name="post.title.font" description="Post title font" type="font" default="${fontValue(fontStackForRole(design.postTitleFont), design.postTitleSize)}"/>
  <Variable name="post.title.size" description="Post title size" type="length" default="${design.postTitleSize}px" min="14px" max="30px"/>
</Group>
<Group description="Layout" selector="body">
  <Variable name="layout.width" description="Content width" type="length" default="${design.width}px" min="720px" max="1440px"/>
</Group>
*/`;
    const css = `*{box-sizing:border-box}body{margin:0;color:$(body.text.color);background:$(body.background.color);font:$(body.text.font);font-size:$(body.text.size);line-height:1.6}a{color:$(body.link.color)}a:hover{color:$(body.link.hover.color)}.site-header,.site-footer,.content-section,.image-section,.button-section,.blog-content{width:min(calc(100% - 2rem),$(layout.width));margin-inline:auto}.site-header{padding:2rem 0;border-bottom:1px solid #e6e8ec}    .site-title{margin:0;color:$(site.title.color);font:$(site.title.font);font-size:$(site.title.size);line-height:1.15}.site-title a{color:inherit}.site-description{color:#737987}.content-section{padding:2rem 0}.content-section h2,.blog-content h2,.main-column article h2{color:$(section.title.color);font:$(section.title.font);font-size:$(section.title.size)}.content-section p{max-width:700px;line-height:1.8}.image-section{padding:1rem 0}.image-section img{display:block;width:100%;height:auto;border-radius:10px}.image-section figcaption{color:#777;font-size:.9rem}.button-section{padding:1rem 0}.theme-button{display:inline-block;padding:.7rem 1rem;border-radius:7px;background:$(accent.color);color:#fff;text-decoration:none}.post-title,.card-title,.main-column article h1 a,.main-column article h2 a{color:$(post.title.color);font:$(post.title.font);font-size:$(post.title.size)}.post-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:1.5rem}.post-card img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.pager{display:flex;justify-content:space-between;margin:2rem 0}.site-footer{padding:1.5rem 0;border-top:1px solid #e6e8ec;background:$(footer.background.color);color:$(footer.text.color)}.site-columns{display:grid;width:min(calc(100% - 2rem),$(layout.width));margin:0 auto;gap:1.5rem;grid-template-columns:minmax(0,1fr)}.site-columns.has-left-sidebar:not(.has-right-sidebar){grid-template-columns:minmax(180px,260px) minmax(0,1fr)}.site-columns.has-right-sidebar:not(.has-left-sidebar){grid-template-columns:minmax(0,1fr) minmax(180px,260px)}.site-columns.has-left-sidebar.has-right-sidebar{grid-template-columns:minmax(180px,240px) minmax(0,1fr) minmax(180px,240px)}.sidebar-column{min-width:0}.sidebar-column .sidebar{width:100%;margin:0 0 1rem}.sidebar-column.has-two-areas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;align-content:start}.sidebar-column.has-two-areas .sidebar{margin:0}.sidebar-column .sidebar{min-width:0}.sidebar-column .sidebar .widget-content{overflow-wrap:anywhere}@media(max-width:760px){.site-columns{display:flex;flex-direction:column}.site-columns .main-column{order:1}.site-columns .sidebar-left,.site-columns .sidebar-right{order:2}.sidebar-column.has-two-areas{grid-template-columns:minmax(0,1fr)}.post-grid{grid-template-columns:1fr}}`;
    return `${variables}${css}.site-footer{width:100%}.site-footer>*{width:min(calc(100% - 2rem),$(layout.width));margin-inline:auto}.post-meta{display:flex;flex-wrap:wrap;gap:.35rem .8rem;margin:.35rem 0 .75rem;color:#737987;font-size:.875rem}.post-meta>*+*::before{content:'·';margin-right:.8rem;color:#a0a5b2}.post-card img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.post-full>h1{color:$(post.title.color);font:$(post.title.font);font-size:$(post.title.size);line-height:1.2}.post-body{overflow-wrap:anywhere}.post-body img,.post-body iframe,.post-body video{max-width:100%}.post-body img{height:auto}.post-body table{max-width:100%;overflow-x:auto}`;
  }

  function buildXml() {
    const counters = { Header: 0, HTML: 0, Region: 0 };
    const mainBlocks = state.blocks
      .filter((block) => !block.regionId && block.type !== "layout" && block.type !== "sidebar"
        && !(block.type === "header" && block.placement === "top")
        && block.type !== "footer")
      .map((block) => blockToXml(block, counters))
      .filter(Boolean)
      .join("\n    ");
    const topHeader = state.blocks.find((block) => block.type === "header" && block.placement === "top");
    const topHeaderMarkup = topHeader ? blockToXml(topHeader, counters) : "";
    const mainFooterMarkup = state.blocks
      .filter((block) => block.type === "footer" && block.placement !== "page-bottom")
      .map((block) => blockToXml(block, counters))
      .join("\n    ");
    const pageFooterMarkup = state.blocks
      .filter((block) => block.type === "footer" && block.placement === "page-bottom")
      .map((block) => blockToXml(block, counters))
      .join("\n    ");
    const layout = state.blocks.find((block) => block.type === "layout");
    const sidebarBlocks = [0, 1, 2, 3].map((slot) => layout
      ? blocksInRegion(layout.id, slot).filter((block) => block.type === "sidebar")
      : []);
    if (!layout) sidebarBlocks[2] = state.blocks.filter((block) => block.type === "sidebar");
    const sidebarMarkup = sidebarBlocks.map((blocks) => blocks
      .map((block) => blockToXml(block, counters))
      .filter(Boolean)
      .join("\n"));
    const mainArea = `<main class='main-column'>${mainBlocks || blogMarkup({ title: "Latest stories" })}${mainFooterMarkup}</main>`;
    const hasLeft = sidebarBlocks[0].length + sidebarBlocks[1].length > 0;
    const hasRight = sidebarBlocks[2].length + sidebarBlocks[3].length > 0;
    const hasTwoLeft = sidebarBlocks[0].length + sidebarBlocks[1].length > 1;
    const hasTwoRight = sidebarBlocks[2].length + sidebarBlocks[3].length > 1;
    const sideClasses = `${hasLeft ? " has-left-sidebar" : ""}${hasRight ? " has-right-sidebar" : ""}${hasTwoLeft ? " has-two-left-sidebars" : ""}${hasTwoRight ? " has-two-right-sidebars" : ""}`;
    const leftMarkup = hasLeft ? `<aside class='sidebar-column sidebar-left${hasTwoLeft ? " has-two-areas" : ""}'>${sidebarMarkup[0]}${sidebarMarkup[1]}</aside>` : "";
    const rightMarkup = hasRight ? `<aside class='sidebar-column sidebar-right${hasTwoRight ? " has-two-areas" : ""}'>${sidebarMarkup[2]}${sidebarMarkup[3]}</aside>` : "";
    const pageColumns = hasLeft || hasRight
      ? `<div class='site-columns${sideClasses}'>${leftMarkup}${mainArea}${rightMarkup}</div>`
      : `<div class='site-columns no-sidebar'>${mainArea}</div>`;
    const design = state.design;
    const font = fontStackForDesign();
    const fontUrl = googleFontStylesheetUrl(selectedGoogleFonts());
    const googleFontImport = fontUrl ? `@import url('${fontUrl}');` : "";
    const analyticsBlock = state.blocks.find((block) => block.type === "analytics");
    const measurementId = analyticsBlock?.measurementId.trim() ?? "";
    const analyticsMarkup = /^G-[A-Z0-9]{6,}$/i.test(measurementId)
      ? `<script async='async' src='https://www.googletagmanager.com/gtag/js?id=${xmlAttr(measurementId)}'></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${xmlText(measurementId)}');</script>`
      : "";
    const css = buildThemeCss(design, font);
    const layoutResponsiveCss = `.site-columns.no-sidebar{grid-template-columns:minmax(0,1fr)}`;
    const cdataEnd = "]]" + ">";
    return `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html b:css='false' b:defaultwidgetversion='2' b:layoutsVersion='3' b:responsive='true' b:templateVersion='1.0.0' expr:dir='data:blog.languageDirection' expr:lang='data:blog.locale' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
  <head>
    <meta content='width=device-width, initial-scale=1' name='viewport'/>
    <title><data:view.title.escaped/></title>
    <b:include data='blog' name='all-head-content'/>
    ${analyticsMarkup}
    <b:skin><![CDATA[${cdataText(googleFontImport + css + layoutResponsiveCss)}${cdataEnd}</b:skin>
    <b:template-skin><![CDATA[body#layout .sidebar{min-height:80px}body#layout .site-columns{display:flex;gap:20px}body#layout .main-column,body#layout .sidebar-column{flex:1;min-width:120px}${cdataEnd}</b:template-skin>
  </head>
  <body>
    <div class='theme-page'>
    ${topHeaderMarkup}
    ${pageColumns}
    ${pageFooterMarkup}
    </div>
  </body>
</html>`;
  }

  function validateXml(xml) {
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    const errors = parsed.getElementsByTagName("parsererror");
    if (errors.length) return { valid: false, message: errors[0].textContent.trim() };
    const mainElements = parsed.getElementsByTagName("main");
    if (mainElements.length !== 1) return { valid: false, message: `Expected exactly one main content area; found ${mainElements.length}.` };
    const bNamespace = "http://www.google.com/2005/gml/b";
    const skins = parsed.getElementsByTagNameNS(bNamespace, "skin");
    if (skins.length !== 1) return { valid: false, message: `Expected exactly one b:skin; found ${skins.length}.` };
    const sectionIds = [...parsed.getElementsByTagNameNS(bNamespace, "section")].map((node) => node.getAttribute("id"));
    if (new Set(sectionIds).size !== sectionIds.length) return { valid: false, message: "Section IDs must be unique." };
    const widgetIds = [...parsed.getElementsByTagNameNS(bNamespace, "widget")].map((node) => node.getAttribute("id"));
    if (new Set(widgetIds).size !== widgetIds.length) return { valid: false, message: "Widget IDs must be unique." };
    return { valid: true, message: "XML is well-formed and ready to export." };
  }

  function updateExportCode() {
    const xml = buildXml();
    const validation = validateXml(xml);
    elements.xml.value = xml;
    elements.exportMessage.classList.toggle("invalid", !validation.valid);
    elements.exportMessage.querySelector("span:last-child").textContent = validation.message;
    elements.exportMessage.querySelector("span:first-child").textContent = validation.valid ? "✓" : "!";
  }

  function setEditorView(view) {
    state.view = view;
    const showCode = view === "code";
    elements.designPanel.hidden = showCode;
    elements.codePanel.hidden = !showCode;
    elements.pageSwitcher.hidden = showCode;
    elements.deviceSwitcher.hidden = showCode;
    document.querySelectorAll("[data-view-tab]").forEach((tab) => {
      const selected = tab.dataset.viewTab === view;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    if (showCode) updateExportCode();
  }

  function saveProject() {
    if (state.design.googleFont.trim() && !safeGoogleFontFamily(state.design.googleFont)) {
      setStatus("Cannot save: Google Font names can contain letters, numbers, spaces, and hyphens only.", true);
      return;
    }
    const project = {
      version: 10,
      name: state.name,
      blocks: state.blocks,
      design: state.design,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      dirty = false;
      setStatus("Saved in this browser");
    } catch (error) {
      setStatus(`Could not save locally: ${error.message}`, true);
    }
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const project = JSON.parse(raw);
      if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(project.version) || !Array.isArray(project.blocks) || !project.design) {
        throw new Error("Saved project has an unsupported format.");
      }
      const allowedTypes = new Set(Object.keys(samples));
      if (project.blocks.some((block) => !allowedTypes.has(block.type) || typeof block.id !== "string")) {
        throw new Error("Saved project contains an unsupported block.");
      }
      const layoutBlocks = project.blocks.filter((block) => block.type === "layout");
      const primaryLayout = layoutBlocks[0] ?? null;
      const layouts = new Map(layoutBlocks.map((block) => [block.id, block]));
      for (const layout of layoutBlocks) {
        if (layout.regionId) throw new Error("Saved project contains a nested page layout.");
      }
      for (const block of project.blocks) {
        if (block.type === "layout" || !block.regionId) continue;
        const parent = layouts.get(block.regionId);
        const legacyColumnCount = { "main-sidebar": 2, "two-columns": 2, "three-columns": 3 }[parent?.preset];
        if (!parent || !Number.isInteger(block.columnIndex)
          || block.columnIndex < 0
          || (project.version < 4
            ? block.columnIndex >= (legacyColumnCount ?? 1)
            : block.columnIndex > (project.version < 5 ? 1 : 3))) {
          throw new Error("Saved project contains a block assigned to an invalid sidebar.");
        }
      }
      for (const singleInstanceType of ["header", "blog"]) {
        if (project.blocks.filter((block) => block.type === singleInstanceType).length > 1) {
          throw new Error(`Saved project contains more than one ${getBlockLabel(singleInstanceType)} block.`);
        }
      }
      const ids = project.blocks.map((block) => block.id);
      if (new Set(ids).size !== ids.length) throw new Error("Saved project has duplicate block IDs.");
      state.name = typeof project.name === "string" ? project.name : state.name;
      state.blocks = project.blocks.filter((block) => block.type !== "layout" || block === primaryLayout).map((block) => {
        const normalized = { ...makeBlock(block.type), ...block };
        if (block.type === "layout") {
          normalized.stack = ["horizontal", "vertical"].includes(block.stack) ? block.stack : "vertical";
          delete normalized.preset;
          delete normalized.regionNames;
          delete normalized.side;
          delete normalized.regionId;
          delete normalized.columnIndex;
        } else {
          for (const key of Object.keys(samples[block.type])) {
            normalized[key] = String(normalized[key] ?? "");
          }
          const parent = block.regionId ? layouts.get(block.regionId) : null;
          if (parent && block.type === "sidebar" && primaryLayout) {
            normalized.regionId = primaryLayout.id;
            normalized.columnIndex = project.version < 5
              ? block.columnIndex === 0 && project.version >= 4 ? 0 : 2
              : block.columnIndex;
          } else {
            delete normalized.regionId;
            delete normalized.columnIndex;
          }
          if (block.type === "sidebar" && primaryLayout) {
            normalized.regionId = primaryLayout.id;
            normalized.columnIndex = project.version < 5
              ? block.columnIndex === 0 && project.version >= 4 ? 0 : 2
              : Number.isInteger(block.columnIndex) ? block.columnIndex : 2;
          }
          if (block.type === "header") {
            normalized.placement = block.placement === "top" ? "top" : "main";
          } else if (block.type === "footer") {
            if (project.version >= 7 && block.placement !== undefined
              && !["main-bottom", "page-bottom"].includes(block.placement)) {
              throw new Error("Saved project contains an invalid footer position.");
            }
            normalized.placement = block.placement === "page-bottom" ? "page-bottom" : "main-bottom";
          } else {
            delete normalized.placement;
          }
        }
        return normalized;
      });
      const sidebarAreas = state.blocks.filter((block) => block.type === "sidebar");
      if (sidebarAreas.length > 4) {
        throw new Error("Saved project has more than four sidebar areas, which do not fit the new four-position layout.");
      }
      if (project.version < 5) {
        const occupiedSlots = new Set();
        for (const block of sidebarAreas) {
          const preferredSide = block.columnIndex < 2 ? 0 : 2;
          const candidates = preferredSide === 0 ? [0, 1, 2, 3] : [2, 3, 0, 1];
          const availableSlot = candidates.find((slot) => !occupiedSlots.has(slot));
          if (availableSlot === undefined) {
            throw new Error("Saved project sidebar areas could not be moved into the four available positions.");
          }
          block.columnIndex = availableSlot;
          occupiedSlots.add(availableSlot);
        }
      } else {
        const occupiedSlots = sidebarAreas.map((block) => block.columnIndex);
        if (new Set(occupiedSlots).size !== occupiedSlots.length) {
          throw new Error("Saved project assigns multiple sidebar areas to the same position.");
        }
      }
      if (!primaryLayout && state.blocks.some((block) => block.type === "sidebar")) {
        ensureSidebarLayout();
      }
      const colorOrDefault = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
      const widthValue = Number(project.design.width);
      const googleFont = String(project.design.googleFont ?? "");
      if (googleFont.trim() && !safeGoogleFontFamily(googleFont)) {
        throw new Error("Saved project contains an invalid Google Font family name.");
      }
      const designDefaults = createDefaultDesign();
      const validThemeFont = (value) => Object.prototype.hasOwnProperty.call(fontStacks, value)
        || Object.prototype.hasOwnProperty.call(googleFontFamilies, value);
      const validRoleFont = (value) => value === "theme"
        || Object.prototype.hasOwnProperty.call(fontStacks, value)
        || ["inter", "playfair-display", "merriweather"].includes(value);
      const boundedSize = (value, fallback, min, max) => {
        const size = Number(value);
        return Number.isFinite(size) ? Math.max(min, Math.min(max, size)) : fallback;
      };
      state.design = {
        ...designDefaults,
        background: colorOrDefault(project.design.background, "#ffffff"),
        ink: colorOrDefault(project.design.ink, "#202124"),
        accent: colorOrDefault(project.design.accent, "#6558d3"),
        font: validThemeFont(project.design.font) ? project.design.font : "system",
        googleFont: safeGoogleFontFamily(googleFont),
        width: Number.isFinite(widthValue) ? Math.max(720, Math.min(1440, widthValue)) : 1120,
        siteTitleColor: colorOrDefault(project.design.siteTitleColor, designDefaults.siteTitleColor),
        siteTitleFont: validRoleFont(project.design.siteTitleFont) ? project.design.siteTitleFont : designDefaults.siteTitleFont,
        siteTitleSize: boundedSize(project.design.siteTitleSize, designDefaults.siteTitleSize, 24, 48),
        headingColor: colorOrDefault(project.design.headingColor, designDefaults.headingColor),
        headingFont: validRoleFont(project.design.headingFont) ? project.design.headingFont : designDefaults.headingFont,
        headingSize: boundedSize(project.design.headingSize, designDefaults.headingSize, 16, 36),
        postTitleColor: colorOrDefault(project.design.postTitleColor, designDefaults.postTitleColor),
        postTitleFont: validRoleFont(project.design.postTitleFont) ? project.design.postTitleFont : designDefaults.postTitleFont,
        postTitleSize: boundedSize(project.design.postTitleSize, designDefaults.postTitleSize, 14, 30),
        bodySize: boundedSize(project.design.bodySize, designDefaults.bodySize, 12, 22),
        linkColor: colorOrDefault(project.design.linkColor, designDefaults.linkColor),
        linkHoverColor: colorOrDefault(project.design.linkHoverColor, designDefaults.linkHoverColor),
        footerBackground: colorOrDefault(project.design.footerBackground, designDefaults.footerBackground),
        footerText: colorOrDefault(project.design.footerText, designDefaults.footerText),
      };
      state.selectedId = null;
      document.querySelector("#project-name").textContent = state.name;
      renderCanvas();
      dirty = false;
      setStatus("Loaded saved project");
      return true;
    } catch (error) {
      setStatus(`Could not load saved project: ${error.message}`, true);
      return false;
    }
  }

  function exportProject() {
    updateExportCode();
    setEditorView("code");
    const validation = validateXml(elements.xml.value);
    setStatus(validation.valid ? "Export code is up to date" : "Export code needs attention", !validation.valid);
  }

  function updateField(field, value) {
    const block = selectedBlock();
    if (!block) return;
    block[field] = value;
    renderPreview();
    markDirty("Block updated");
  }

  document.querySelector("#block-library").addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-type]");
    if (removeButton) {
      const block = state.blocks.filter((item) => item.type === removeButton.dataset.removeType).slice(-1)[0];
      if (block) removeBlockById(block.id, `${getBlockLabel(block.type)} removed`);
      return;
    }
    const button = event.target.closest("[data-block-type]");
    if (!button || button.disabled) return;
    insertBlock(button.dataset.blockType);
  });

  document.querySelector("#block-library").addEventListener("dragstart", (event) => {
    const button = event.target.closest("[data-block-type]");
    if (!button || button.disabled) {
      event.preventDefault();
      return;
    }
    dragLibraryType = button.dataset.blockType;
    draggedBlockId = null;
    setSidebarDragActive(dragLibraryType === "sidebar");
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", dragLibraryType);
  });

  document.querySelector("#block-library").addEventListener("dragend", () => {
    setSidebarDragActive(false);
    elements.preview.querySelectorAll(".drop-target-hover").forEach((node) => node.classList.remove("drop-target-hover"));
    dragLibraryType = null;
  });

  elements.preview.addEventListener("click", (event) => {
    const target = event.target.closest(".preview-block");
    if (!target) return;
    if (event.target.closest("a")) event.preventDefault();
    state.selectedId = target.dataset.id;
    renderCanvas();
  });

  elements.preview.addEventListener("dragstart", (event) => {
    const target = event.target.closest(".preview-block");
    if (!target) return;
    draggedBlockId = target.dataset.id;
    dragLibraryType = null;
    const sourceBlock = state.blocks.find((block) => block.id === draggedBlockId);
    setSidebarDragActive(sourceBlock?.type === "sidebar");
    target.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedBlockId);
  });

  elements.preview.addEventListener("dragend", () => {
    draggedBlockId = null;
    dragLibraryType = null;
    setSidebarDragActive(false);
    elements.preview.querySelectorAll(".dragging").forEach((node) => node.classList.remove("dragging"));
    elements.preview.querySelectorAll(".drop-target-hover").forEach((node) => node.classList.remove("drop-target-hover"));
  });

  elements.preview.addEventListener("dragover", (event) => {
    if (!draggedBlockId && !dragLibraryType) return;
    event.preventDefault();
    const slot = event.target.closest("[data-sidebar-slot]");
    const headerPosition = event.target.closest("[data-header-position]");
    const footerPosition = event.target.closest("[data-footer-position]");
    const source = state.blocks.find((block) => block.id === draggedBlockId);
    elements.preview.querySelectorAll(".drop-target-hover").forEach((node) => node.classList.remove("drop-target-hover"));
    if (slot && sidebarDragActive) {
      const slotIndex = Number(slot.dataset.sidebarSlot);
      const occupied = state.blocks.some((block) => block.type === "sidebar" && block.columnIndex === slotIndex);
      const valid = !occupied || Boolean(draggedBlockId);
      slot.classList.toggle("drop-target-hover", valid);
      event.dataTransfer.dropEffect = valid ? (dragLibraryType ? "copy" : "move") : "none";
    } else if (headerPosition) {
      const isHeader = source?.type === "header" || dragLibraryType === "header";
      headerPosition.classList.toggle("drop-target-hover", isHeader);
      event.dataTransfer.dropEffect = isHeader ? (dragLibraryType ? "copy" : "move") : "none";
    } else if (footerPosition) {
      const isFooter = source?.type === "footer" || dragLibraryType === "footer";
      footerPosition.classList.toggle("drop-target-hover", isFooter);
      event.dataTransfer.dropEffect = isFooter ? (dragLibraryType ? "copy" : "move") : "none";
    } else if (dragLibraryType) {
      event.dataTransfer.dropEffect = "copy";
    } else {
      event.dataTransfer.dropEffect = "move";
    }
  });

  elements.preview.addEventListener("drop", (event) => {
    if (!draggedBlockId && !dragLibraryType) return;
    event.preventDefault();
    const sourceId = draggedBlockId;
    const libraryType = dragLibraryType;
    const dropSlot = event.target.closest("[data-sidebar-slot]");
    const headerPosition = event.target.closest("[data-header-position]");
    const footerPosition = event.target.closest("[data-footer-position]");
    const dropZone = event.target.closest("[data-drop-end]");
    const target = event.target.closest(".preview-block");
    const targetBlock = target ? state.blocks.find((block) => block.id === target.dataset.id) : null;
    const destination = headerPosition
      ? { placement: headerPosition.dataset.headerPosition }
      : footerPosition
      ? { placement: footerPosition.dataset.footerPosition }
      : dropSlot
      ? {
        slotIndex: Number(dropSlot.dataset.sidebarSlot),
        regionId: dropSlot.dataset.regionId || null,
        columnIndex: Number(dropSlot.dataset.columnIndex),
      }
      : dropZone?.dataset.regionId
      ? { regionId: dropZone.dataset.regionId, columnIndex: Number(dropZone.dataset.columnIndex) }
      : targetBlock
        ? blockRegion(targetBlock)
        : { regionId: null, columnIndex: null };
    const end = Boolean(dropZone || dropSlot || footerPosition);
    setSidebarDragActive(false);
    elements.preview.querySelectorAll(".drop-target-hover").forEach((node) => node.classList.remove("drop-target-hover"));
    if (libraryType) {
      let index;
      if (targetBlock) {
        index = state.blocks.indexOf(targetBlock);
      } else if (Number.isInteger(destination.slotIndex)) {
        index = state.blocks.length;
      } else if (destination.regionId) {
        const siblings = blocksInRegion(destination.regionId, destination.columnIndex);
        index = siblings.length
          ? state.blocks.indexOf(siblings[siblings.length - 1]) + 1
          : state.blocks.findIndex((block) => block.id === destination.regionId) + 1;
      } else {
        index = state.blocks.length;
      }
      insertBlock(libraryType, index, destination);
    } else if (targetBlock && targetBlock.id !== sourceId) {
      moveBlock(sourceId, targetBlock.id, false, destination);
    } else if (end) {
      moveBlock(sourceId, null, true, destination);
    }
    draggedBlockId = null;
    dragLibraryType = null;
  });

  elements.inspectorContent.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    updateField(field, event.target.value);
  });

  elements.inspectorContent.addEventListener("change", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    updateField(field, event.target.value);
  });

  elements.inspectorContent.addEventListener("click", (event) => {
    const button = event.target.closest("[data-move]");
    if (!button) return;
    const block = selectedBlock();
    if (!block) return;
    const siblings = siblingBlocks(block);
    const index = siblings.indexOf(block);
    const direction = Number(button.dataset.move);
    const target = direction < 0 ? siblings[index - 1] : siblings[index + 2];
    if (direction < 0 && target) {
      moveBlock(block.id, target.id, false, blockRegion(block));
    } else if (direction > 0) {
      const next = siblings[index + 1];
      if (next) moveBlock(block.id, target?.id ?? null, !target, blockRegion(block));
    }
  });

  elements.delete.addEventListener("click", () => {
    const block = selectedBlock();
    if (block) removeBlockById(block.id);
  });

  document.querySelectorAll("[data-design]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.design;
      state.design[key] = input.type === "range" ? Number(input.value) : input.value;
      applyDesign();
      updateExportCode();
      markDirty("Theme design updated");
      if (key === "googleFont" && input.value.trim() && !safeGoogleFontFamily(input.value)) {
        setStatus("Google Font names can contain letters, numbers, spaces, and hyphens only.", true);
      }
    });
  });

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = button.dataset.page;
      document.querySelectorAll("[data-page]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      renderCanvas();
    });
  });

  document.querySelectorAll("[data-device]").forEach((button) => {
    button.addEventListener("click", () => {
      state.device = button.dataset.device;
      document.querySelectorAll("[data-device]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      elements.frame.classList.remove("device-tablet", "device-mobile");
      if (state.device !== "desktop") elements.frame.classList.add(`device-${state.device}`);
    });
  });

  document.querySelector("#save-project").addEventListener("click", saveProject);
  document.querySelector("#export-project").addEventListener("click", exportProject);
  document.querySelectorAll("[data-view-tab]").forEach((tab) => {
    tab.addEventListener("click", () => setEditorView(tab.dataset.viewTab));
  });

  document.querySelector("#copy-xml").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.xml.value);
      setStatus("Blogger XML copied to clipboard");
    } catch (error) {
      elements.xml.focus();
      elements.xml.select();
      setStatus(`Clipboard access was denied (${error.message}); XML selected for manual copying.`, true);
    }
  });

  document.querySelector("#download-xml").addEventListener("click", () => {
    updateExportCode();
    const validation = validateXml(elements.xml.value);
    if (!validation.valid) {
      setStatus(`Download stopped: ${validation.message}`, true);
      return;
    }
    const blob = new Blob([elements.xml.value], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "blogger-theme"}.xml`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Theme XML downloaded");
  });

  document.querySelector("#new-project").addEventListener("click", () => {
    if (dirty && !window.confirm("Start a new theme? Unsaved changes will be lost.")) return;
    state.name = "My Blogger theme";
    state.blocks = [
      makeBlock("header"),
      makeBlock("text"),
      makeBlock("blog"),
      makeBlock("footer"),
    ];
    state.selectedId = null;
    state.design = createDefaultDesign();
    document.querySelector("#project-name").textContent = state.name;
    renderCanvas();
    markDirty("New theme created");
  });

  initializeColorPickers();
  const restored = loadProject();
  if (!restored) {
    state.blocks = [
      makeBlock("header"),
      makeBlock("text"),
      makeBlock("blog"),
      makeBlock("footer"),
    ];
    renderCanvas();
    dirty = false;
    setStatus("Ready to customize");
  }
})();
