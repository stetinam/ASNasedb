/**
 * Reference layer for the ASNaseDB entry tables.
 *
 * Adds a numbered citation marker to every value whose source is known, and
 * builds the reference list at the bottom of the page. Nothing else on the page
 * is touched: the markers hold no text (the number is drawn by CSS), so the
 * search box, the Km range filter and the TSV/clipboard exports keep seeing
 * exactly the values they saw before.
 *
 * Requires, in this order:
 *   scripts/general-data.js      PROTEIN_DATA
 *   scripts/references-data.js   REFERENCE_DATA, PDB_DOI
 *   scripts/table-renderer.js    renders the rows this decorates
 *
 * Page markup needed:
 *   <div id="reflist" data-page-refs="alphafold,uniref"></div>
 *   ...anywhere; conventionally the last thing before the footer.
 *   data-page-refs is optional and may name any key of PAGE_REFERENCES below.
 *
 * If any of the data files is missing this script does nothing at all, and the
 * page renders exactly as it did before the reference layer existed.
 */

(function () {
  "use strict";

  if (typeof REFERENCE_DATA === "undefined" || typeof PROTEIN_DATA === "undefined") {
    return;
  }

  var PDB_MAP = typeof PDB_DOI !== "undefined" ? PDB_DOI : {};
  var LETTERS = "abcdefghijklmnopqrstuvwxyz";

  /* Page-level sources are lettered rather than numbered. Which DOI each key
     means lives here; the citation text and the licence note come from the
     generated data, so nothing editorial is written into this file. */
  var PAGE_REF_DOI = {
    alphafold: "10.1093/nar/gkad1011",
    uniref: "10.1093/bioinformatics/btm098",
    uniprot: "10.1093/nar/gkae1010"
  };

  var SITE_REFS = typeof SITE_REFERENCES !== "undefined" ? SITE_REFERENCES : [];

  function siteNote(doi) {
    for (var i = 0; i < SITE_REFS.length; i++) {
      if (SITE_REFS[i].doi === doi) return SITE_REFS[i].note || "";
    }
    return "";
  }

  /* ------------------------------------------------------------------ utils */

  /* A DOI suffix is case-insensitive, but the citation cache is keyed by
     whichever spelling Crossref returned. Every lookup is folded through one
     canonical spelling so that two spellings of the same paper cannot become
     two numbered references. */
  var CANONICAL = {};
  Object.keys(REFERENCE_DATA).forEach(function (doi) {
    var folded = doi.toLowerCase();
    if (!(folded in CANONICAL)) CANONICAL[folded] = doi;
  });

  /* Trim before stripping the prefix, not after: the pattern is anchored, so a
     stray space in the TSV would otherwise leave the whole URL in place and the
     citation would be dropped without a word. */
  function bare(doi) {
    var value = String(doi || "").trim().replace(/^https?:\/\/(dx\.|www\.)?doi\.org\//i, "");
    return CANONICAL[value.toLowerCase()] || value;
  }

  function known(doi) {
    return doi && Object.prototype.hasOwnProperty.call(REFERENCE_DATA, doi);
  }

  function splitDois(value) {
    var out = [];
    String(value || "").split(";").forEach(function (part) {
      var doi = bare(part);
      if (doi && known(doi) && out.indexOf(doi) === -1) out.push(doi);
    });
    return out;
  }

  function pdbIdsOf(entry) {
    var out = [];
    String(entry.PDB_IDs || "").split(";").forEach(function (part) {
      var id = part.trim().toUpperCase();
      if (/^[0-9][A-Z0-9]{3}$/.test(id) && out.indexOf(id) === -1) out.push(id);
    });
    return out;
  }

  /* Whether the row has any experimental structure at all, which is not the
     same as having a citable one: a PDB entry may still be unpublished, and the
     literal "PDBs" cell links out to UniProt's list instead of naming entries.
     Either way the oligomeric state came from a structure, so the row must not
     fall through to its kinetics for a source. */
  function hasStructureEntry(entry) {
    var raw = String(entry.PDB_IDs || "").trim();
    return raw !== "" && raw !== "-";
  }

  function citationHtml(doi) {
    var m = REFERENCE_DATA[doi];
    if (!m) return doi;
    var who = m.authors.slice(0, 3).join(", ") + (m.authors.length > 3 ? " et al." : "");
    var volume = m.volume ? " <strong>" + m.volume + "</strong>" : "";
    var pages = m.page ? ", " + m.page : "";
    return (
      who + " (" + m.year + "). <span class='ct-title'>" + m.title + ".</span> <em>" +
      m.journal + "</em>" + volume + pages + ". " +
      "<a class='ct-doi' href='https://doi.org/" + doi + "' target='_blank' rel='noopener'>doi:" +
      doi + "</a>"
    );
  }

  /* ------------------------------------------------- which papers back a row */

  /**
   * Structure cites the primary publication of the row's PDB entries. With no
   * PDB entry it falls back to the DOIs behind the row's kinetic values, since
   * that is where the oligomeric state was reported. Structure_DOIs in the
   * master TSV overrides both.
   */
  function referencesFor(entry) {
    var refs = {
      Structure: [],
      PDB: {},
      Km: splitDois(entry.Km_DOIs),
      Vmax: splitDois(entry.Vmax_DOIs),
      Kcat: splitDois(entry.Kcat_DOIs)
    };

    pdbIdsOf(entry).forEach(function (id) {
      var doi = bare(PDB_MAP[id]);
      if (known(doi)) refs.PDB[id] = doi;
    });

    if (entry.Structure && entry.Structure !== "-") {
      var override = splitDois(entry.Structure_DOIs);
      if (override.length) {
        refs.Structure = override;
      } else if (Object.keys(refs.PDB).length) {
        Object.keys(refs.PDB).forEach(function (id) {
          if (refs.Structure.indexOf(refs.PDB[id]) === -1) refs.Structure.push(refs.PDB[id]);
        });
      } else if (!hasStructureEntry(entry)) {
        ["Km", "Vmax", "Kcat"].forEach(function (field) {
          refs[field].forEach(function (doi) {
            if (refs.Structure.indexOf(doi) === -1) refs.Structure.push(doi);
          });
        });
      }
    }
    return refs;
  }

  /* index the entries so a rendered row can find the record behind it */
  var ENTRY_INDEX = {};
  function indexKey(tableType, family, an, organism) {
    return [tableType, family, an || "", organism || ""].join("|");
  }
  PROTEIN_DATA.forEach(function (entry) {
    ENTRY_INDEX[indexKey(entry.Table_Type, entry.Family, entry.AN, entry.Organism)] = entry;
  });

  /* --------------------------------------------------------- numbering state */

  var numbers = {};   // doi -> number
  var order = [];     // dois in the order they were first cited
  var back = {};      // doi -> [{id, label}]

  function markerFor(doi, rowLabel, field, via) {
    if (!known(doi)) return null;
    if (!(doi in numbers)) {
      numbers[doi] = order.length + 1;
      order.push(doi);
      back[doi] = [];
    }
    var n = numbers[doi];
    var id = "cite-" + n + "-" + (back[doi].length + 1);
    back[doi].push({ id: id, label: rowLabel + " · " + field });

    /* A <sup>, not a <button>: a button is an atomic inline box and browsers
       may break the line beside it, which would strand the number on a line of
       its own. An inline element with no whitespace before it cannot be split
       from the word it follows. */
    var mark = document.createElement("sup");
    mark.className = "cite" + (via ? " src-pdb" : "");
    mark.id = id;
    mark.setAttribute("role", "button");
    mark.setAttribute("tabindex", "0");
    mark.setAttribute("data-n", n);          /* CSS draws the number from here */
    mark.setAttribute("data-doi", doi);
    mark.setAttribute("data-label", rowLabel + " · " + field);
    mark.setAttribute(
      "data-gen",
      via ? "Crossref lookup of PDB " + via + "'s primary citation"
          : "Crossref lookup of the value's DOI"
    );
    mark.setAttribute("aria-label", "Reference " + n + " for " + field + " of " + rowLabel);
    return mark;
  }

  /* --------------------------------------------------------------- placement */

  function lastTextNode(cell) {
    for (var i = cell.childNodes.length - 1; i >= 0; i--) {
      var node = cell.childNodes[i];
      if (node.nodeType === 3 && node.textContent.trim()) return node;
    }
    return cell.lastChild;
  }

  function place(cell, after, marks) {
    marks.forEach(function (mark) {
      if (after && after.parentNode === cell) cell.insertBefore(mark, after.nextSibling);
      else cell.appendChild(mark);
      after = mark;
    });
  }

  /* ------------------------------------------------------------ column lookup */

  /**
   * Column positions differ between pages - blast.html inserts Score and E-val
   * before Fam - so they are read from the header labels rather than assumed.
   */
  function columnsOf(tbody) {
    var headerRow = tbody.querySelector("tr");
    if (!headerRow) return null;
    var columns = {};
    Array.prototype.forEach.call(headerRow.children, function (th, i) {
      /* Only the tooltip bubbles come out. Some headers wrap their label in a
         <span> for nowrap (Vmax, Kcat), so stripping every span would leave the
         column nameless and its values uncited. */
      var clone = th.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll(".tooltip"), function (el) {
        el.parentNode.removeChild(el);
      });
      var label = clone.textContent.replace(/\s+/g, "");
      if (label) columns[label] = i;
    });
    return columns;
  }

  /* ------------------------------------------------------------- decoration */

  function decorate(row, columns, tableType) {
    var an = row.getAttribute("data-an") || "";
    var organism = row.getAttribute("data-organism") || "";
    var family = row.getAttribute("data-family") || "";
    var entry = ENTRY_INDEX[indexKey(tableType, family, an, organism)];
    if (!entry) return;

    var refs = referencesFor(entry);
    var label = an || organism || family;
    var cells = row.children;

    if (columns.Structure !== undefined && refs.Structure.length) {
      var structureCell = cells[columns.Structure];
      if (structureCell) {
        place(structureCell, lastTextNode(structureCell), refs.Structure.map(function (doi) {
          var via = "";
          Object.keys(refs.PDB).forEach(function (id) { if (refs.PDB[id] === doi) via = id; });
          return markerFor(doi, label, "Structure", via);
        }).filter(Boolean));
      }
    }

    if (columns.PDB !== undefined) {
      var pdbCell = cells[columns.PDB];
      if (pdbCell) {
        Array.prototype.forEach.call(pdbCell.querySelectorAll("a"), function (link) {
          var id = link.textContent.trim().toUpperCase();
          var doi = refs.PDB[id];
          if (!doi) return;
          var mark = markerFor(doi, label, "PDB " + link.textContent.trim(), id);
          if (mark) place(pdbCell, link, [mark]);
        });
      }
    }

    /* Each kinetic value is rendered as a link to its own DOI, so the markers
       are placed from the links rather than from a list of papers: a DOI shared
       by two values marks both of them and they share one number, and a value
       whose DOI resolved to no citation is simply left unmarked instead of
       pushing its neighbours' markers onto the wrong number. */
    [["Km", "Km"], ["Vmax", "Vmax"], ["Kcat", "kcat"]].forEach(function (pair) {
      var column = columns[pair[0]];
      if (column === undefined) return;
      var cell = cells[column];
      if (!cell) return;
      Array.prototype.forEach.call(cell.querySelectorAll("a"), function (link) {
        var mark = markerFor(bare(link.getAttribute("href")), label, pair[1], "");
        if (mark) place(cell, link, [mark]);
      });
    });
  }

  /* ------------------------------------------------------- the reference box */

  function buildList(box) {
    var keys = (box.getAttribute("data-page-refs") || "")
      .split(",").map(function (s) { return s.trim(); }).filter(Boolean);

    /* Letters are assigned per page, in the order the page lists them, so a
       page carrying only one page-level source labels it A rather than B. */
    /* Letters are assigned per page, in the order the page lists them, so a
       page carrying only one page-level source labels it A rather than B. */
    var pageRefs = keys
      .map(function (key) { return PAGE_REF_DOI[key]; })
      .filter(function (doi) { return doi && known(doi); })
      .map(function (doi, i) {
        return {
          letter: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(i),
          doi: doi,
          note: siteNote(doi)
        };
      });

    var html =
      "<div class='reflist-head'><h3>References</h3>" +
      "<a class='reflist-all' href='/references.html'>All database references &rarr;</a></div>";

    /* The blurb describes the numbered table citations, so it only belongs on a
       page that has some. A page with an empty table still shows its lettered
       data sources. */
    if (order.length) {
      html +=
        "<p class='sub'>K<sub>m</sub>, V<sub>max</sub> and k<sub>cat</sub> cite their recorded DOI; " +
        "Structure and PDB cite the PDB entry's primary publication from RCSB. Citation text is " +
        "generated with Crossref.</p>";
    }
    html += "<div class='reflist-scroll'>";

    if (pageRefs.length) {
      html += "<ul class='page-refs'>";
      pageRefs.forEach(function (ref) {
        html +=
          "<li id='ref-" + ref.letter + "'><span class='pref-letter'>" +
          "<a href='#pref-" + ref.letter.toLowerCase() + "'>" + ref.letter + "</a></span>" +
          "<span class='ct'>" + citationHtml(ref.doi) +
          (ref.note ? " " + ref.note : "") + "</span></li>";
      });
      html += "</ul>";
    }

    if (order.length) html += "<ol>";
    order.forEach(function (doi) {
      var cites = back[doi];
      var links;
      if (cites.length === 1) {
        links = "<a class='backref' href='#" + cites[0].id + "' title='" + cites[0].label +
          "'>&#8593;</a>";
      } else {
        links = cites.map(function (cite, i) {
          return "<a class='backref-letter' href='#" + cite.id + "' title='" + cite.label + "'>" +
            LETTERS[i % 26] + "</a>";
        }).join(" ");
      }
      var viaPdb = Object.keys(PDB_MAP).some(function (id) { return bare(PDB_MAP[id]) === doi; });
      html +=
        "<li id='ref-" + numbers[doi] + "'><span class='backrefs'>" + links + "</span>" +
        "<span class='ct'>" + citationHtml(doi) + "</span> " +
        (viaPdb ? "<span class='src-tag pdb'>from PDB</span>"
                : "<span class='src-tag tsv'>from DOI</span>") +
        "</li>";
    });
    if (order.length) html += "</ol>";
    html += "</div>";

    box.innerHTML = html;
  }

  /* ---------------------------------------------------------------- popover */

  var popover;

  function hidePopover() {
    if (!popover) return;
    popover.classList.remove("on");
    var active = document.querySelector(".cite.active");
    if (active) active.classList.remove("active");
  }

  function showPopover(mark) {
    popover.innerHTML =
      "<span class='pop-label'>Reference " + mark.getAttribute("data-n") + " &middot; " +
      mark.getAttribute("data-label") + "</span><span class='ct'>" +
      citationHtml(mark.getAttribute("data-doi")) + "</span>" +
      "<span class='pop-foot'>" + mark.getAttribute("data-gen") + "</span>";
    popover.classList.add("on");

    var rect = mark.getBoundingClientRect();
    var size = popover.getBoundingClientRect();
    var left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - size.width / 2),
      window.innerWidth - size.width - 8
    );
    var top = rect.bottom + 8;
    if (top + size.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - size.height - 8);
    }
    popover.style.left = left + "px";
    popover.style.top = top + "px";

    var active = document.querySelector(".cite.active");
    if (active) active.classList.remove("active");
    mark.classList.add("active");
  }

  function flash(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.remove("flash");
    void element.offsetWidth;
    element.classList.add("flash");
  }

  function pulse(mark) {
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    var start = function () {
      mark.classList.remove("pulse");
      void mark.offsetWidth;
      mark.classList.add("pulse");
    };
    if ("onscrollend" in window) {
      var done = false;
      var onEnd = function () {
        if (done) return;
        done = true;
        window.removeEventListener("scrollend", onEnd);
        start();
      };
      window.addEventListener("scrollend", onEnd);
      setTimeout(onEnd, 900);
    } else {
      setTimeout(start, 500);
    }
  }

  function wire() {
    var hideTimer;

    document.querySelectorAll(".cite").forEach(function (mark) {
      mark.addEventListener("mouseenter", function () {
        clearTimeout(hideTimer);
        showPopover(mark);
      });
      mark.addEventListener("mouseleave", function () {
        hideTimer = setTimeout(hidePopover, 160);
      });
      mark.addEventListener("focus", function () { showPopover(mark); });
      mark.addEventListener("blur", hidePopover);
      mark.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          mark.click();
        }
      });
      mark.addEventListener("click", function () {
        flash(document.getElementById("ref-" + mark.getAttribute("data-n")));
        hidePopover();
      });
    });

    document.querySelectorAll("a.backref, a.backref-letter").forEach(function (link) {
      link.addEventListener("click", function (ev) {
        ev.preventDefault();
        var mark = document.querySelector(link.getAttribute("href"));
        if (!mark) return;
        hidePopover();
        pulse(mark);
      });
    });

    /* the lettered markers in the page body jump to their entry in the box */
    document.querySelectorAll("sup.pref-mark[data-ref-jump]").forEach(function (sup) {
      sup.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();   /* some sit inside a link of their own */
        flash(document.getElementById("ref-" + sup.getAttribute("data-ref-jump")));
      });
    });

    popover.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });
    popover.addEventListener("mouseleave", function () {
      hideTimer = setTimeout(hidePopover, 120);
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") hidePopover();
    });
    window.addEventListener("scroll", hidePopover, true);
    document.addEventListener("animationend", function (ev) {
      if (ev.animationName.indexOf("citepulse") === 0) ev.target.classList.remove("pulse");
    });
  }

  /* ------------------------------------------------------------------- init */

  /**
   * How many rows the data says a tbody should hold. A family page may
   * legitimately have an empty table, and asking the data tells that apart from
   * "table-renderer.js has not run yet" - otherwise a page that will never grow
   * a row waits for one forever and never gets its reference box.
   */
  function expectedRows(tbody) {
    var type = tbody.getAttribute("data-table-type");
    var family = tbody.getAttribute("data-family");
    var classNum = tbody.getAttribute("data-class");
    var suffix = tbody.getAttribute("data-family-suffix");
    var total = 0;
    PROTEIN_DATA.forEach(function (entry) {
      var parts = String(entry.Family || "").split("-");
      if (type && entry.Table_Type !== type) return;
      if (family && entry.Family !== family) return;
      if (classNum && parts[0] !== classNum) return;
      if (suffix && parts[parts.length - 1] !== suffix) return;
      total++;
    });
    return total;
  }

  function run() {
    var bodies = document.querySelectorAll("tbody[data-table-type]");
    var box = document.getElementById("reflist");
    if (!bodies.length && !box) return;

    var pending = 0;
    Array.prototype.forEach.call(bodies, function (tbody) {
      pending += expectedRows(tbody) - tbody.querySelectorAll("tr[data-family]").length;
    });
    if (pending > 0) return false;     // table-renderer.js has not finished yet

    Array.prototype.forEach.call(bodies, function (tbody) {
      var columns = columnsOf(tbody);
      if (!columns) return;
      var tableType = tbody.getAttribute("data-table-type");
      Array.prototype.forEach.call(tbody.querySelectorAll("tr[data-family]"), function (row) {
        decorate(row, columns, tableType);
      });
    });

    /* The lettered page-level sources are attribution required by the licences
       of the data they name, so a page that declares them gets its box built
       whether or not its table cited anything. */
    var declared = box && box.getAttribute("data-page-refs");
    if (!order.length && !declared) return true;

    popover = document.createElement("div");
    popover.id = "pop";
    popover.setAttribute("role", "tooltip");
    document.body.appendChild(popover);

    if (box) buildList(box);
    wire();
    return true;
  }

  function start() {
    applyAccent();
    injectStyles();
    var attempts = 0;
    (function attempt() {
      if (run() !== false) return;
      if (++attempts > 50) return;
      setTimeout(attempt, 60);
    })();
  }

  /* The four page families use different accents (green site pages, and one
     colour per class). The tints are derived from whichever accent the page
     declares, so a new theme needs no change here. */
  function applyAccent() {
    var box = document.getElementById("reflist");
    var accent = (box && box.getAttribute("data-accent")) || "#17b470";
    var hex = accent.replace("#", "");
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    var mix = function (target, amount) {
      return "rgb(" +
        Math.round(r + (target - r) * amount) + "," +
        Math.round(g + (target - g) * amount) + "," +
        Math.round(b + (target - b) * amount) + ")";
    };
    var root = document.documentElement.style;
    root.setProperty("--ref-accent", accent);
    root.setProperty("--ref-accent-ink", mix(0, 0.3));      /* text on white */
    root.setProperty("--ref-accent-soft", mix(255, 0.86));  /* marker background */
    root.setProperty("--ref-accent-mid", mix(255, 0.45));   /* pulse midpoint */
    root.setProperty("--ref-accent-glow", "rgba(" + r + "," + g + "," + b + ",0.3)");
  }

  /* Styles ship with the behaviour so a page only has to include this file. */
  function injectStyles() {
    var css = [
      ".cite{display:inline;font-family:inherit;font-size:9.5px;font-weight:700;line-height:1;",
      "vertical-align:super;margin-left:1px;padding:1px 2px;border:0;border-radius:3px;",
      "cursor:pointer;font-variant-numeric:tabular-nums;background:var(--ref-accent-soft);color:var(--ref-accent-ink)}",
      ".cite::after{content:attr(data-n)}",
      ".cite+.cite{margin-left:2px}",
      ".cite:hover,.cite:focus-visible,.cite.active{background:var(--ref-accent);color:#fff;outline:none}",
      ".cite:focus-visible{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--ref-accent)}",
      ".cite.src-pdb{background:#e2eff1;color:#1d6b78}",
      ".cite.src-pdb:hover,.cite.src-pdb:focus-visible,.cite.src-pdb.active{background:#1d6b78;color:#fff}",
      ".cite.pulse{animation:citepulse 1.05s ease-in-out 2}",
      "@keyframes citepulse{0%{background:var(--ref-accent-soft);color:var(--ref-accent-ink);box-shadow:0 0 0 0 transparent}",
      "50%{background:var(--ref-accent-mid);color:#fff;box-shadow:0 0 0 5px var(--ref-accent-glow)}",
      "100%{background:var(--ref-accent-soft);color:var(--ref-accent-ink);box-shadow:0 0 0 0 transparent}}",
      ".cite.src-pdb.pulse{animation-name:citepulse-pdb}",
      "@keyframes citepulse-pdb{0%{background:#e2eff1;color:#1d6b78;box-shadow:0 0 0 0 rgba(29,107,120,0)}",
      "50%{background:#4e97a3;color:#fff;box-shadow:0 0 0 5px rgba(29,107,120,.3)}",
      "100%{background:#e2eff1;color:#1d6b78;box-shadow:0 0 0 0 rgba(29,107,120,0)}}",
      ".seq-table th{white-space:nowrap}",
      ".seq-table td,.seq-table th{padding-left:8px;padding-right:8px}",
      "#reflist{width:1300px;max-width:calc(100% - 30px);margin:0 auto 80px;padding-top:42px;",
      "border-top:1px solid #e6e6ec;text-align:left}",
      "#reflist .reflist-head{display:flex;align-items:baseline;justify-content:space-between;",
      "gap:16px;flex-wrap:wrap}",
      "#reflist h3{margin:0 0 4px;font-size:22px;color:var(--ref-accent)}",
      "#reflist .reflist-all{font-size:14.5px;white-space:nowrap}",
      "#reflist .sub{margin:0 0 10px;padding:0;font-size:13.5px;line-height:1.5;color:#7b7b85;",
      "text-align:left;max-width:none}",
      "#reflist .reflist-scroll{max-height:340px;max-height:min(45vh,340px);overflow-y:auto;",
      "padding:14px 20px 16px;background:#fff;border:1px solid #e0e0e6;border-radius:10px}",
      "#reflist .page-refs{margin:0 0 10px;padding:0 0 10px;list-style:none;border-bottom:1px solid #ececf2}",
      "#reflist .page-refs li{display:flex;gap:10px;margin-bottom:9px;font-size:14.5px;",
      "line-height:1.5;color:#444}",
      "#reflist .page-refs li:last-child{margin-bottom:0}",
      /* no numbered list under it: nothing to rule off from */
      "#reflist .page-refs:last-child{margin-bottom:0;padding-bottom:0;border-bottom:0}",
      ".pref-letter{font-weight:700;color:var(--ref-accent-ink);flex:none;min-width:14px}",
      ".pref-letter a{color:inherit;text-decoration:none}",
      ".pref-letter a:hover{text-decoration:underline}",
      "sup.pref-mark{font-size:15px;font-weight:inherit;color:inherit;cursor:pointer}",
      "sup.pref-mark:hover{text-decoration:underline}",
      "#reflist ol{margin:0;padding-left:26px}",
      "#reflist li{margin-bottom:9px;font-size:14.5px;line-height:1.5;color:#444;scroll-margin-top:90px}",
      "#reflist ol li::marker{color:var(--ref-accent-ink);font-weight:700}",
      "#reflist li.flash{animation:refflash 2.8s ease}",
      "@keyframes refflash{0%,65%{background:var(--ref-accent-soft);box-shadow:-6px 0 0 var(--ref-accent-soft),6px 0 0 var(--ref-accent-soft)}",
      "100%{background:transparent;box-shadow:none}}",
      ".ct{font-family:Georgia,'Times New Roman',serif}",
      ".ct .ct-title{color:#1f1f1f}",
      ".ct .ct-doi{font-family:inherit;font-size:13px}",
      ".backrefs{margin-right:7px}",
      ".backref,.backref-letter{color:var(--ref-accent-ink);font-weight:700;text-decoration:none;font-size:13px}",
      ".backref-letter{font-style:italic}",
      ".backref:hover,.backref-letter:hover{text-decoration:underline}",
      ".src-tag{display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace;",
      "font-size:10.5px;padding:1px 6px;border-radius:999px;vertical-align:1px;white-space:nowrap}",
      ".src-tag.tsv{background:var(--ref-accent-soft);color:var(--ref-accent-ink)}",
      ".src-tag.pdb{background:#e2eff1;color:#1d6b78}",
      "#pop{position:fixed;z-index:2000;max-width:410px;background:#fff;border:1px solid #cfcfd6;",
      "border-radius:7px;box-shadow:0 5px 20px rgba(30,26,60,.18);padding:12px 14px;font-size:14px;",
      "line-height:1.5;color:#333;text-align:left;opacity:0;visibility:hidden;transition:opacity .14s ease}",
      "#pop.on{opacity:1;visibility:visible}",
      "#pop .pop-label{display:block;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;",
      "color:#8c8c96;margin-bottom:6px}",
      "#pop .pop-foot{display:block;margin-top:8px;font-size:12px;color:#8c8c96}",
      "@media (prefers-reduced-motion:reduce){.cite.pulse,#reflist li.flash{animation:none}}"
    ].join("");

    var style = document.createElement("style");
    style.setAttribute("data-source", "references.js");
    style.textContent = css;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
