/**
 * Dynamic Protein Table Renderer for ASNaseDB
 *
 * Renders protein data tables from PROTEIN_DATA (loaded from general-data.js)
 * Maintains identical HTML structure and formatting to original static tables.
 */

const TableRenderer = (function () {
  /**
   * Create a tooltip span with the given indicator and text
   */
  function createTooltip(indicator, text, position = "") {
    if (!indicator || !text) return "";
    const posClass = position ? ` tooltip-${position}` : "";
    return `<span class="tooltip${posClass}">${indicator}<span class="tooltiptext">${escapeHtml(text)}</span></span>`;
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Render a cell with value, optional link, optional tooltip
   */
  function renderCell(value, link, note, noteLink, indicator) {
    let content = "";

    // Handle value display
    if (!value || value === "-") {
      content = "-";
    } else if (link) {
      content = `<a href="${escapeHtml(link)}" target="_blank">${escapeHtml(value)}</a>`;
    } else {
      content = escapeHtml(value);
    }

    // Add tooltip if indicator and note exist
    if (indicator && note) {
      content += " " + createTooltip(indicator, note, "right");
    }

    return content;
  }

  /**
   * Render kinetic value cell (Km, Vmax, Kcat) with DOI links
   */
  function renderKineticCell(value, dois, note, indicator) {
    if (!value) return "-";

    // Split multiple values by semicolon
    const values = value.split(";").map((v) => v.trim());
    const doiList = dois ? dois.split(";").map((d) => d.trim()) : [];

    let content = values
      .map((v, i) => {
        const doi = doiList[i] || doiList[0] || "";
        if (doi) {
          return `<a href="${escapeHtml(doi)}" target="_blank">${escapeHtml(v)}</a>`;
        }
        return escapeHtml(v);
      })
      .join("; ");

    // Add tooltip if present
    if (indicator && note) {
      content += " " + createTooltip(indicator, note);
    }

    return content;
  }

  /**
   * Render the AN (Accession Number) cell
   * Special handling: if no AN but has note, show only tooltip
   */
  function renderANCell(entry) {
    const an = entry.AN;
    const link = entry.AN_Link;
    const note = entry.AN_Note;
    const indicator = entry.AN_Indicator;

    if (!an && note && indicator) {
      // No AN, but has a note - show tooltip only
      return createTooltip(indicator, note, "right");
    }

    if (!an) return "-";

    let content = "";
    if (link) {
      content = `<a href="${escapeHtml(link)}" target="_blank">${escapeHtml(an)}</a>`;
    } else {
      content = escapeHtml(an);
    }

    if (indicator && note) {
      content += " " + createTooltip(indicator, note, "right");
    }

    return content;
  }

  /**
   * Render the Alt (Alternative name) cell
   */
  function renderAltCell(entry) {
    const alt = entry.Alt;
    const note = entry.Alt_Note;
    const indicator = entry.Alt_Indicator;

    if (!alt || alt === "-") {
      // If no alt but has note, just show tooltip
      if (note && indicator) {
        return createTooltip(indicator, note, "right");
      }
      return "-";
    }

    let content = escapeHtml(alt);
    if (indicator && note) {
      content += " " + createTooltip(indicator, note, "right");
    }

    return content;
  }

  /**
   * Render EC cell with multiple links
   */
  function renderECCell(entry) {
    const ec = entry.EC;
    const links = entry.EC_Links;

    if (!ec) return "-";

    // Multiple ECs separated by semicolon
    const ecValues = ec.split(";").map((e) => e.trim());
    const ecLinks = links ? links.split(";").map((l) => l.trim()) : [];

    return ecValues
      .map((e, i) => {
        const link = ecLinks[i] || "";
        if (link) {
          return `<a href="${escapeHtml(link)}" target="_blank">${escapeHtml(e)}</a>`;
        }
        return escapeHtml(e);
      })
      .join("; ");
  }

  /**
   * Render Organism cell with optional note
   */
  function renderOrganismCell(entry) {
    const organism = entry.Organism;
    const note = entry.Organism_Note;
    const indicator = entry.Organism_Indicator;

    if (!organism) return "-";

    let content = escapeHtml(organism);
    if (indicator && note) {
      content += " " + createTooltip(indicator, note);
    }

    return content;
  }

  /**
   * Render PDB cell with RCSB links and UniProt links
   */
  function renderPDBCell(entry) {
    const ids = entry.PDB_IDs;
    const rcsbLinks = entry.PDB_RCSB_Links;
    const uniprotLinks = entry.PDB_UniProt_Links;
    const note = entry.PDB_Note;
    const indicator = entry.PDB_Indicator;

    if (!ids) return "-";

    // Special case: "PDBs" with UniProt link only
    if (ids === "PDBs" && uniprotLinks) {
      let content = `<a href="${escapeHtml(uniprotLinks)}" target="_blank">PDBs</a>`;
      if (indicator && note) {
        content += " " + createTooltip(indicator, note);
      }
      return content;
    }

    // Multiple PDBs
    const pdbList = ids.split(";").map((p) => p.trim());
    const rcsbList = rcsbLinks ? rcsbLinks.split(";").map((l) => l.trim()) : [];

    let content = pdbList
      .map((pdb, i) => {
        const link = rcsbList[i] || "";
        if (link) {
          return `<a href="${escapeHtml(link)}" target="_blank">${escapeHtml(pdb)}</a>`;
        }
        return escapeHtml(pdb);
      })
      .join("; ");

    if (indicator && note) {
      content += " " + createTooltip(indicator, note);
    }

    return content;
  }

  /**
   * Render Structure cell with optional note
   */
  function renderStructureCell(entry) {
    const structure = entry.Structure;
    const note = entry.Structure_Note;
    const indicator = entry.Structure_Indicator;

    if (!structure || structure === "-") return "-";

    let content = escapeHtml(structure);
    if (indicator && note) {
      content += " " + createTooltip(indicator, note);
    }

    return content;
  }

  /**
   * Generate a single data row HTML
   * @param {Object} entry - protein data entry
   * @param {Object} options - rendering options
   *   - includeBlastColumns: boolean - add Score and E-val columns
   *   - includeDataRowClass: boolean - add class="data-row" to tr
   */
  function renderRow(entry, options = {}) {
    const includeBlastColumns = options.includeBlastColumns || false;
    const includeDataRowClass = options.includeDataRowClass || false;

    // Build data attributes for the row
    let dataAttrs = [];
    if (entry.AN) {
      dataAttrs.push(`data-an="${escapeHtml(entry.AN)}"`);
    }
    dataAttrs.push(`data-family="${escapeHtml(entry.Family)}"`);
    dataAttrs.push(`data-organism="${escapeHtml(entry.Organism)}"`);

    const rowClass = includeDataRowClass ? ' class="data-row"' : "";

    /* No newlines or indentation between the cells: the browser keeps that
       whitespace as a text node inside the row and hands it to the clipboard
       when a cell is selected, so copying an accession would yield
       "    Q86U10". The markup is written flat instead. */
    const cells = [`<td class="checkbox-column"><input class="entry-checkbox" type="checkbox" /></td>`];

    // Add BLAST columns if needed
    if (includeBlastColumns) {
      cells.push(`<td class="score-cell">-</td>`);
      cells.push(`<td class="evalue-cell">-</td>`);
    }

    // Family column
    cells.push(`<td><a href="${escapeHtml(entry.Family_Link)}">${escapeHtml(entry.Family)}</a></td>`);

    // Alt column
    cells.push(`<td>${renderAltCell(entry)}</td>`);

    // AN column
    cells.push(`<td>${renderANCell(entry)}</td>`);

    // Name column
    cells.push(`<td>${entry.Name ? escapeHtml(entry.Name) : ""}</td>`);

    // EC column
    cells.push(`<td>${renderECCell(entry)}</td>`);

    // Organism column
    cells.push(`<td>${renderOrganismCell(entry)}</td>`);

    // Cell-Loc column
    cells.push(
      `<td>${renderCell(entry.Cell_Loc, null, entry.Cell_Loc_Note, entry.Cell_Loc_Note_Link, entry.Cell_Loc_Indicator)}</td>`
    );

    // AAs column
    cells.push(`<td>${entry.AAs ? escapeHtml(entry.AAs) : "-"}</td>`);

    // Structure column
    cells.push(`<td>${renderStructureCell(entry)}</td>`);

    // PDB column
    cells.push(`<td>${renderPDBCell(entry)}</td>`);

    // Km column
    cells.push(`<td>${renderKineticCell(entry.Km, entry.Km_DOIs, entry.Km_Note, entry.Km_Indicator)}</td>`);

    // Vmax column
    cells.push(`<td>${renderKineticCell(entry.Vmax, entry.Vmax_DOIs, entry.Vmax_Note, entry.Vmax_Indicator)}</td>`);

    // Kcat column
    cells.push(`<td>${renderKineticCell(entry.Kcat, entry.Kcat_DOIs, entry.Kcat_Note, entry.Kcat_Indicator)}</td>`);

    return `<tr${rowClass} ${dataAttrs.join(" ")}>${cells.join("")}</tr>`;
  }

  /**
   * Filter protein data by criteria
   * @param {Array} data - PROTEIN_DATA array
   * @param {Object} filters
   *   - tableType: 'ESP' or 'Swiss-Prot'
   *   - family: specific family like '1-1-3'
   *   - classNum: class number like '1', '2', '3'
   *   - familySuffix: last part of family code like '3' to match '*-*-3'
   */
  function filterData(data, filters = {}) {
    return data.filter((entry) => {
      // Filter by table type
      if (filters.tableType && entry.Table_Type !== filters.tableType) {
        return false;
      }

      // Filter by exact family
      if (filters.family && entry.Family !== filters.family) {
        return false;
      }

      // Filter by class (first part of Family code like "1-1-3" -> "1")
      if (filters.classNum) {
        const entryClass = entry.Family.split("-")[0];
        if (entryClass !== filters.classNum) {
          return false;
        }
      }

      // Filter by family suffix (last part of Family code like "1-1-3" -> "3")
      // Used for family pages like class1-family3.html which shows all families ending in -3
      if (filters.familySuffix) {
        const parts = entry.Family.split("-");
        const entrySuffix = parts[parts.length - 1];
        if (entrySuffix !== filters.familySuffix) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Render all rows for a table
   * @param {Array} data - filtered protein data
   * @param {Object} options - rendering options
   */
  function renderAllRows(data, options = {}) {
    // Sort data: 1) by class, 2) by family, 3) alphabetically by AN
    const sortedData = [...data].sort((a, b) => {
      // Parse family codes (e.g., "1-2-3" -> class=1, family parts for comparison)
      const partsA = (a.Family || "").split("-");
      const partsB = (b.Family || "").split("-");
      
      // 1. Sort by class (first part of family code)
      const classA = parseInt(partsA[0]) || 0;
      const classB = parseInt(partsB[0]) || 0;
      if (classA !== classB) return classA - classB;
      
      // 2. Sort by family (compare full family code numerically)
      // Compare each part of the family code numerically
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = parseInt(partsA[i]) || 0;
        const numB = parseInt(partsB[i]) || 0;
        if (numA !== numB) return numA - numB;
      }
      
      // 3. Sort alphabetically by AN
      const anA = (a.AN || "").toLowerCase();
      const anB = (b.AN || "").toLowerCase();
      return anA.localeCompare(anB);
    });
    return sortedData.map((entry) => renderRow(entry, options)).join("");
  }

  /**
   * Initialize tables on page load
   * Looks for tbody elements with data-table-type attribute
   * and populates them with the appropriate data
   */
  function initTables() {
    // Check if PROTEIN_DATA is available
    if (typeof PROTEIN_DATA === "undefined") {
      console.error("PROTEIN_DATA not loaded. Include general-data.js before table-renderer.js");
      return;
    }

    // Find all table bodies that need to be populated
    const tableBodies = document.querySelectorAll("tbody[data-table-type]");

    // Skip if already initialized (prevent double initialization)
    if (tableBodies.length > 0 && tableBodies[0].querySelectorAll(".data-row").length > 0) {
      return;
    }

    tableBodies.forEach((tbody) => {
      const tableType = tbody.getAttribute("data-table-type");
      const family = tbody.getAttribute("data-family");
      const classNum = tbody.getAttribute("data-class");
      const familySuffix = tbody.getAttribute("data-family-suffix");
      const includeBlast = tbody.getAttribute("data-blast") === "true";
      const includeDataRow = tbody.getAttribute("data-row-class") === "true";

      // Build filters
      const filters = { tableType };
      if (family) filters.family = family;
      if (classNum) filters.classNum = classNum;
      if (familySuffix) filters.familySuffix = familySuffix;

      // Filter and render
      const filteredData = filterData(PROTEIN_DATA, filters);
      const options = {
        includeBlastColumns: includeBlast,
        includeDataRowClass: includeDataRow,
      };

      const rowsHtml = renderAllRows(filteredData, options);

      // Find the header row (first tr with th elements) and insert after it
      const headerRow = tbody.querySelector("tr:first-child");
      if (headerRow) {
        headerRow.insertAdjacentHTML("afterend", rowsHtml);
      } else {
        tbody.innerHTML = rowsHtml;
      }
    });
  }

  // Public API
  return {
    renderRow,
    renderAllRows,
    filterData,
    initTables,
    createTooltip,
    escapeHtml,
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", TableRenderer.initTables);
} else {
  // DOM already loaded
  TableRenderer.initTables();
}
