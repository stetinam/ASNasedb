/*
 * Shared "The Asparaginase Database asparaginase classification" box.
 *
 * Used by help.html and index.html so both pages always show the same content.
 * To place it on a page, add a mount point and load this script:
 *
 *   <div data-classification-box></div>
 *   <script src="/scripts/classification-box.js"></script>
 *
 * All rules are scoped under .classification-container so page-level styles
 * (e.g. `.content p`) cannot change how the box looks from page to page.
 */
(function () {
  const STYLE_ID = "classification-box-styles";

  const CSS = `
    .classification-container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      padding: 1.25rem 1.5rem;
      margin: 1.5rem 0;
      font-family: "Source Sans Pro", sans-serif;
      text-align: left;
    }

    .classification-container .classification-header {
      text-align: center;
      margin-bottom: 1rem;
    }

    .classification-container .classification-header h3 {
      color: #17b470;
      font-size: 1.2rem;
      margin: 0 0 0.2rem;
    }

    .classification-container .classification-header p {
      color: #6c757d;
      font-size: 1rem;
      margin: 0;
      text-align: center;
    }

    /* Hierarchy visualization */
    .classification-container .hierarchy-visual {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      position: relative;
      padding: 0.5rem 0;
    }

    .classification-container .hierarchy-level {
      flex: 1;
      text-align: center;
      position: relative;
      z-index: 2;
    }

    .classification-container .hierarchy-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #17b470, #01ad62);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 0.45rem;
      color: white;
      font-size: 1.35rem;
      font-weight: bold;
      box-shadow: 0 3px 10px rgba(23, 180, 112, 0.3);
    }

    .classification-container .hierarchy-level:nth-child(2) .hierarchy-icon {
      background: linear-gradient(135deg, #4fc896, #17b470);
    }

    .classification-container .hierarchy-level:nth-child(3) .hierarchy-icon {
      background: linear-gradient(135deg, #7dd9aa, #4fc896);
    }

    .classification-container .hierarchy-title {
      font-size: 1.15rem;
      font-weight: 600;
      color: #333;
      margin-bottom: 0.25rem;
    }

    .classification-container .hierarchy-description {
      font-size: 1rem;
      color: #6c757d;
      max-width: 260px;
      margin: 0 auto;
      line-height: 1.4;
    }

    /* Arrow indicators */
    .classification-container .arrow-right {
      position: absolute;
      top: 18px;
      right: -20px;
      width: 0;
      height: 0;
      border-left: 12px solid #4fc896;
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      z-index: 3;
    }

    /* Code example */
    .classification-container .code-example {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-top: 1rem;
      border: 2px dashed #17b470;
    }

    .classification-container .code-example h4 {
      color: #17b470;
      margin: 0 0 0.5rem;
      font-size: 1.05rem;
      text-align: center;
    }

    .classification-container .code-display {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      margin: 0;
    }

    .classification-container .code-part {
      background: white;
      padding: 0.4rem 0.9rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      font-size: 1.1rem;
      font-weight: bold;
      color: #17b470;
      text-align: center;
    }

    .classification-container .code-part span {
      display: block;
      font-size: 0.85rem;
      color: #6c757d;
      font-weight: normal;
      margin-top: 0.2rem;
    }

    .classification-container .code-separator {
      font-size: 1.5rem;
      color: #ccc;
    }

    .classification-container .code-explanation {
      text-align: center;
      color: #6c757d;
      font-style: italic;
      font-size: 1.05rem;
      line-height: 1.5;
      margin: 0;
      padding: 1.5rem 0.5rem;
    }

    /* Feature cards */
    .classification-container .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      gap: 0.85rem;
      margin-top: 0;
    }

    .classification-container .feature-card {
      background: #f8f9fa;
      padding: 0.9rem 1.1rem;
      border-radius: 8px;
      border-left: 3px solid #17b470;
      transition:
        transform 0.3s ease,
        box-shadow 0.3s ease;
    }

    .classification-container .feature-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
    }

    .classification-container .feature-card h5 {
      color: #17b470;
      margin: 0 0 0.35rem;
      font-size: 1.1rem;
    }

    .classification-container .feature-card p {
      color: #6c757d;
      font-size: 1rem;
      margin: 0;
      line-height: 1.45;
      text-align: left;
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .classification-container .hierarchy-visual {
        flex-direction: column;
        gap: 1rem;
        padding: 0.25rem 0;
      }

      .classification-container .arrow-right {
        display: none;
      }

      .classification-container .code-display {
        flex-direction: column;
        gap: 0.3rem;
      }

      .classification-container .code-separator {
        transform: rotate(90deg);
      }

      .classification-container .hierarchy-icon {
        width: 42px;
        height: 42px;
        font-size: 1.1rem;
      }
    }
  `;

  const HTML = `
    <div class="classification-container">
      <div class="classification-header">
        <h3>Hierarchical Classification System</h3>
      </div>

      <div class="hierarchy-visual">
        <div class="hierarchy-level">
          <div class="hierarchy-icon">1</div>
          <div class="hierarchy-title">Class</div>
          <div class="hierarchy-description">
            Three distinct classes with unique sequences and structures
          </div>
          <div class="arrow-right"></div>
        </div>

        <div class="hierarchy-level">
          <div class="hierarchy-icon">1</div>
          <div class="hierarchy-title">Clan</div>
          <div class="hierarchy-description">
            Larger phylogenetic groups within each class
          </div>
          <div class="arrow-right"></div>
        </div>

        <div class="hierarchy-level">
          <div class="hierarchy-icon">1</div>
          <div class="hierarchy-title">Family</div>
          <div class="hierarchy-description">
            Most specific grouping with shared sequence and/or structure
            features
          </div>
        </div>
      </div>

      <div class="code-example">
        <h4>Classification Code Format</h4>
        <div class="code-display">
          <div class="code-part">
            1
            <span>Class</span>
          </div>
          <div class="code-separator">-</div>
          <div class="code-part">
            1
            <span>Clan</span>
          </div>
          <div class="code-separator">-</div>
          <div class="code-part">
            1
            <span>Family</span>
          </div>
        </div>
      </div>
      <p class="code-explanation">
        <strong>Example:</strong> the Escherichia coli type I
        (<a href="https://www.uniprot.org/uniprotkb/P0A962/entry" target="_blank"
          >P0A962</a
        >) asparaginase belongs to
        <a href="/html-files/class1-family16.html">1-5-16 </a> or
        <a href="/html-files/class1.html">Class 1</a>, Clan 5, and
        <a href="/html-files/class1-family16.html">Family 16</a> in The
        Asparaginase Database classification<br />
        <strong>Note:</strong> class must always be specified as clan and family
        numbers repeat across classes.
      </p>
      <div class="feature-grid">
        <div class="feature-card">
          <h5>Home page structures</h5>
          <p>
            Click on the turning protein structures on the home page to travel
            to the class overviews
          </p>
        </div>
        <div class="feature-card">
          <h5>Phylogenetic tree</h5>
          <p>
            Click on the branches of phylogenetic trees to travel to detailed
            family pages
          </p>
        </div>
        <div class="feature-card">
          <h5>Family links</h5>
          <p>
            Click on coloured links and buttons to also travel to detailed
            family pages.
          </p>
        </div>
        <div class="feature-card">
          <h5>Home button</h5>
          <p>
            Click on The Asparaginase Database logo in the top left corner to go
            back to the home page
          </p>
        </div>
      </div>
    </div>
  `;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function render() {
    const mounts = document.querySelectorAll("[data-classification-box]");
    if (!mounts.length) return;
    injectStyles();
    mounts.forEach(function (mount) {
      mount.innerHTML = HTML;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
