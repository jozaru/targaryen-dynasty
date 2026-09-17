// --- Placeholder SVG (Dragon Egg) ---
const placeholderImg = "assets/images/placeholder.svg";

// --- 1. Global State & DOM Selections ---
let currentLang = localStorage.getItem("targaryen_lang") || "en";
let rawDataCache = null;

const svg = d3.select("#tree-canvas");
const zoomGroup = d3.select("#zoom-group");
const linksGroup = d3.select("#links-group");
const nodesGroup = d3.select("#nodes-group");

// Configure Zoom behavior safely
const zoom = d3
  .zoom()
  .scaleExtent([0.1, 2.5])
  .on("zoom", (event) => {
    if (!zoomGroup.empty()) {
      zoomGroup.attr("transform", event.transform);
    }
  });

if (!svg.empty()) {
  svg.call(zoom);
}

const langSelect = document.getElementById("lang-select");
const searchInput = document.getElementById("search-input");
const bioDrawer = document.getElementById("bio-drawer");
const closeDrawerBtn = document.getElementById("close-drawer-btn");
const diligenceStatement = document.getElementById("diligence-statement");

// --- 2. Static UI Translation Dictionary ---
const translations = {
  en: {
    subtitle: "The Targaryen Dynasty",
    searchPlaceholder: "Search a Targaryen...",
    lblDragon: "Dragon",
    lblEra: "Reign / Era",
    none: "None",
    errorText: "Error loading lore data.",
    diligence:
      "<strong>AI Diligence Statement:</strong> In creating this Targaryen Dynasty genealogical project, I collaborated with Gemini AI to explore its capabilities in generating code and visual assets. I provided the project specifications and design direction without sharing any sensitive data. Gemini assisted with structuring the presentation, drafting the biography lore, and generating prompts for the character images. I affirm that all AI-generated content underwent thorough human review for stylistic consistency and relevance to George R.R. Martin's literature. While there may be minor discrepancies with the original book sources, the final output accurately reflects my intended vision. I maintain full responsibility for the project. This disclosure is made in the spirit of transparency.",
  },
  es: {
    subtitle: "La Dinastía Targaryen",
    searchPlaceholder: "Buscar un Targaryen...",
    lblDragon: "Dragón",
    lblEra: "Reinado / Era",
    none: "Ninguno",
    errorText: "Error al cargar los datos del árbol.",
    diligence:
      "<strong>Declaración de Diligencia de IA:</strong> En la creación de este proyecto genealógico de la Dinastía Targaryen, colaboré con Gemini AI para explorar sus capacidades en la generación de código y recursos visuales. Proporcioné las especificaciones del proyecto y la dirección de diseño sin compartir ningún dato confidencial. Gemini ayudó a estructurar la presentación, redactar la historia de las biografías y generar indicaciones (prompts) para las imágenes de los personajes. Confirmo que todo el contenido generado por IA se sometió a una exhaustiva revisión humana para garantizar la coherencia estilística y la relevancia con la literatura de George R.R. Martin. Aunque puede haber discrepancias menores con las fuentes originales de los libros, el resultado final refleja fielmente mi visión. Mantengo la total responsabilidad del proyecto. Esta divulgación se hace en aras de la transparencia.",
  },
};

// --- 3. UI Update Helpers ---
function updateStaticUI() {
  const dict = translations[currentLang] || translations.en;

  if (searchInput) searchInput.placeholder = dict.searchPlaceholder;

  const subtitleEl = document.getElementById("lbl-subtitle");
  if (subtitleEl) subtitleEl.textContent = dict.subtitle;

  const lblDragon = document.getElementById("lbl-dragon");
  if (lblDragon) lblDragon.textContent = dict.lblDragon;

  const lblEra = document.getElementById("lbl-era");
  if (lblEra) lblEra.textContent = dict.lblEra;

  if (diligenceStatement) {
    diligenceStatement.innerHTML = translations[currentLang].diligence;
  }
}

// Safely retrieve localized content with fallback to English
function getLocalized(nodeData) {
  if (!nodeData) return {};
  return nodeData[currentLang] || nodeData.en || {};
}

// Toggle Drawer Open/Close
function toggleDrawer(open = false) {
  if (bioDrawer) {
    if (open) bioDrawer.classList.add("open");
    else bioDrawer.classList.remove("open");
  }
}

if (closeDrawerBtn) {
  closeDrawerBtn.addEventListener("click", () => toggleDrawer(false));
}

// Initialize Language Selector Listener
if (langSelect) {
  langSelect.value = currentLang;
  langSelect.addEventListener("change", (e) => {
    currentLang = e.target.value;
    localStorage.setItem("targaryen_lang", currentLang);
    updateStaticUI();

    if (rawDataCache) {
      renderTreeFromData(rawDataCache);
    }
  });
}

updateStaticUI();

// --- 4. Main Render Function ---
async function renderTree() {
  try {
    const response = await fetch("targaryens.json");
    rawDataCache = await response.json();
    renderTreeFromData(rawDataCache);
  } catch (error) {
    console.error("Failed to render the Targaryen tree:", error);
  }
}

function renderTreeFromData(rawData) {
  linksGroup.selectAll("*").remove();
  nodesGroup.selectAll("*").remove();

  // --- Pre-processing for Union Knots ---
  const unionMap = new Map();
  const charMap = new Map();

  rawData.forEach((d) =>
    charMap.set(d.id, { ...d, parents: [...(d.parents || [])] }),
  );

  rawData.forEach((char) => {
    if (char.spouses && char.spouses.length > 0) {
      char.spouses.forEach((spouseId) => {
        const pair = [char.id, spouseId].sort();
        const unionId = `union_${pair[0]}_${pair[1]}`;

        if (!unionMap.has(unionId)) {
          unionMap.set(unionId, {
            id: unionId,
            isUnion: true,
            parents: [pair[0], pair[1]],
            name: "Marriage",
          });
        }
      });
    }
  });

  charMap.forEach((char) => {
    if (char.parents && char.parents.length === 2) {
      const pair = [...char.parents].sort();
      const unionId = `union_${pair[0]}_${pair[1]}`;

      if (unionMap.has(unionId)) {
        char.parents = [unionId];
      }
    }
  });

  const processedData = Array.from(charMap.values()).concat(
    Array.from(unionMap.values()),
  );

  // Build DAG Layout
  const dag = d3
    .graphStratify()
    .id((d) => d.id)
    .parentIds((d) => d.parents || [])(processedData);

  const layout = d3.sugiyama().nodeSize([160, 180]);

  layout(dag);

  const linksArray = Array.from(dag.links());
  const nodesArray = Array.from(dag.nodes());

  const lineGenerator = d3
    .line()
    .curve(d3.curveBumpY)
    .x((d) => d[0])
    .y((d) => d[1]);

  // Draw Links (Updated for visibility and dark theme matching)
  linksGroup
    .selectAll("path")
    .data(linksArray)
    .enter()
    .append("path")
    .attr("d", (d) => lineGenerator(d.points))
    .attr("fill", "none")
    .attr("stroke", "#c5a059") // Valyrian Gold color
    .attr("stroke-width", "2.5px") // Thicker line so it doesn't vanish when zooming
    .attr("opacity", "0.45"); // Slightly transparent

  // Render Nodes
  const nodeElements = nodesGroup
    .selectAll("g")
    .data(nodesArray)
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

  const characterNodes = nodeElements
    .filter((d) => !d.data.isUnion)
    .attr("class", "character-node");

  const unionNodes = nodeElements.filter((d) => d.data.isUnion);

  // Golden Marriage Dots
  unionNodes
    .append("circle")
    .attr("r", 5)
    .attr("fill", "var(--valyrian-gold)")
    .attr("stroke", "var(--bg-dark)")
    .attr("stroke-width", 2);

  // Attach Character Click & Hover Events
  characterNodes.style("cursor", "pointer").on("click", (event, d) => {
    openDrawer(d.data);
    d3.selectAll(".node-circle").attr("stroke", "var(--valyrian-gold)");
    d3.select(event.currentTarget)
      .select(".node-circle")
      .attr("stroke", "#ffffff");
  });

  // Portrait background & frame
  characterNodes.append("circle").attr("r", 45).attr("fill", "var(--bg-dark)");

  characterNodes
    .append("image")
    .attr("href", (d) => (d.data.image ? d.data.image : placeholderImg))
    .attr("x", -45)
    .attr("y", -45)
    .attr("width", 90)
    .attr("height", 90)
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("clip-path", "url(#avatar-clip)");

  characterNodes
    .append("circle")
    .attr("class", "node-circle")
    .attr("r", 45)
    .attr("fill", "none")
    .attr("stroke", "var(--valyrian-gold)")
    .attr("stroke-width", 3);

  // Dynamic Localized Labels
  characterNodes
    .append("text")
    .text((d) => {
      const loc = getLocalized(d.data);
      return loc.name || d.data.id;
    })
    .attr("y", 62)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-main)")
    .style("font-family", "var(--font-heading)")
    .style("font-size", "13px")
    .style("text-shadow", "0px 2px 4px #000000");

  characterNodes
    .append("text")
    .text((d) => {
      const loc = getLocalized(d.data);
      return loc.era || "";
    })
    .attr("y", 78)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--targaryen-red)")
    .style("font-size", "10px")
    .style("letter-spacing", "1px")
    .style("text-transform", "uppercase");

  // --- Initial Camera Centering on Aegon I ---
  const container = document.getElementById("canvas-container");
  const containerWidth = container ? container.clientWidth : window.innerWidth;
  const containerHeight = container
    ? container.clientHeight
    : window.innerHeight;

  const aegonNode = nodesArray.find((n) => n.data.id === "aegon_1");

  if (aegonNode) {
    const scale = 0.9; // Zoom level (1 is default, 0.9 is slightly zoomed out)

    // Center horizontally on Aegon, and position him about 15% down from the top
    const translateX = containerWidth / 2 - aegonNode.x * scale;
    const translateY = containerHeight * 0.15 - aegonNode.y * scale;

    svg
      .transition()
      .duration(750)
      .call(
        zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(scale),
      );
  } else {
    // Fallback if Aegon is missing: Center the whole graph
    const minX = d3.min(nodesArray, (d) => d.x);
    const maxX = d3.max(nodesArray, (d) => d.x);
    const graphCenterX = (minX + maxX) / 2;

    svg
      .transition()
      .duration(750)
      .call(
        zoom.transform,
        d3.zoomIdentity.translate(containerWidth / 2 - graphCenterX, 100),
      );
  }
}

// --- 5. Multilingual Detail Drawer ---
function openDrawer(characterData) {
  const loc = getLocalized(characterData);
  const dict = translations[currentLang] || translations.en;

  const nameEl = document.getElementById("drawer-name");
  const titlesEl = document.getElementById("drawer-titles");
  const dragonEl = document.getElementById("drawer-dragon");
  const eraEl = document.getElementById("drawer-era");
  const textEl = document.getElementById("drawer-text");
  const imgEl = document.getElementById("drawer-image");
  const tagsContainer = document.getElementById("drawer-tags");

  if (nameEl) nameEl.textContent = loc.name || characterData.id;
  if (titlesEl) titlesEl.textContent = (loc.titles || []).join(", ") || "---";
  if (dragonEl) dragonEl.textContent = characterData.dragon || dict.none;
  if (eraEl) eraEl.textContent = loc.era || "---";
  if (textEl) textEl.textContent = loc.biography || "";
  if (imgEl)
    imgEl.src = characterData.image ? characterData.image : placeholderImg;

  if (tagsContainer) {
    tagsContainer.innerHTML = "";
    const tags = loc.tags || [];
    tags.forEach((t) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      tagsContainer.appendChild(span);
    });
  }

  toggleDrawer(true);
}

// --- 6. Multilingual Search Listener ---
if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    const searchTerm = event.target.value.toLowerCase().trim();

    if (searchTerm === "") {
      d3.selectAll(".character-node")
        .transition()
        .duration(300)
        .style("opacity", 1);
      d3.selectAll("path").transition().duration(300).style("opacity", 0.45); // Restores to the new baseline opacity
      return;
    }

    d3.selectAll("path").transition().duration(300).style("opacity", 0.1);

    const allNodes = d3.selectAll(".character-node").data();
    const matchedNodes = allNodes.filter((d) => {
      const loc = getLocalized(d.data);
      const enLoc = d.data.en || {};

      const name = ((loc.name || "") + " " + (enLoc.name || "")).toLowerCase();
      const aliases = (
        (loc.aliases || []).join(" ") +
        " " +
        (enLoc.aliases || []).join(" ")
      ).toLowerCase();
      const tags = (
        (loc.tags || []).join(" ") +
        " " +
        (enLoc.tags || []).join(" ")
      ).toLowerCase();
      const dragon = (d.data.dragon || "").toLowerCase();

      return (
        name.includes(searchTerm) ||
        aliases.includes(searchTerm) ||
        tags.includes(searchTerm) ||
        dragon.includes(searchTerm)
      );
    });

    d3.selectAll(".character-node")
      .transition()
      .duration(300)
      .style("opacity", (d) => (matchedNodes.includes(d) ? 1 : 0.1));

    if (matchedNodes.length === 1) {
      const targetNode = matchedNodes[0];
      const container = document.getElementById("canvas-container");
      const cWidth = container ? container.clientWidth : window.innerWidth;
      const cHeight = container ? container.clientHeight : window.innerHeight;

      svg
        .transition()
        .duration(750)
        .call(
          zoom.transform,
          d3.zoomIdentity.translate(
            cWidth / 2 - targetNode.x,
            cHeight / 2 - targetNode.y,
          ),
        );
    }
  });
}

// Handle Window Resizing
window.addEventListener("resize", () => {
  if (rawDataCache) {
    renderTreeFromData(rawDataCache);
  }
});

// Run initial load
renderTree();
