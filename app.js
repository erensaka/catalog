const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtVmDRnzdNDmXwYzrUfaNrBumsDNqsW6OQKEd_i93mgkvOH8hP3hXceb9SFVLdm-Mu3UgRyjfAZojt/pub?output=csv";

const CATEGORY_LABELS = {
  GIDA: "Gıda",
  OYUNCAK: "Oyuncak",
  EV_TEMIZLIK: "Ev & Temizlik",
  KIRTASIYE: "Kırtasiye",
  PET: "Pet",
};

const els = {
  status: document.getElementById("status"),
  search: document.getElementById("search"),

  categoryView: document.getElementById("categoryView"),
  categories: document.getElementById("categories"),
  catEmpty: document.getElementById("catEmpty"),

  productView: document.getElementById("productView"),
  products: document.getElementById("products"),
  prodEmpty: document.getElementById("prodEmpty"),

  back: document.getElementById("back"),
  viewTitle: document.getElementById("viewTitle"),
  viewSubtitle: document.getElementById("viewSubtitle"),
};

let allProducts = [];
let currentCategory = null;

function showStatus(msg, type = "info") {
  els.status.textContent = msg;
  els.status.classList.remove("hidden", "error");
  if (type === "error") els.status.classList.add("error");
}

function hideStatus() {
  els.status.classList.add("hidden");
  els.status.textContent = "";
  els.status.classList.remove("error");
}

function detectDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  return semiCount > commaCount ? ";" : ",";
}

function splitCSVLine(line, delimiter) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out.map(v => v.trim());
}

function parseCSV(text) {
  const clean = text.trim();
  if (!clean) return [];

  const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines.shift(), delimiter);

  return lines.map(line => {
    const values = splitCSVLine(line, delimiter);
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] ?? "");
    return obj;
  });
}

function normalizeRow(r) {
  return {
    category: (r.category || "").trim(),
    name: (r.name || "").trim(),
    pack: (r.pack || "").trim(),
    price: (r.price || "").trim(),
    image: (r.image || "").trim(),
    sku: (r.sku || "").trim(),
  };
}

function validateProducts(rows) {
  return rows.filter(p => p.category && p.name);
}

function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key;
}

function getCategories(products) {
  const map = new Map();
  products.forEach(p => map.set(p.category, (map.get(p.category) || 0) + 1));

  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key, "tr"));
}

function renderCategories(products) {
  const cats = getCategories(products);

  if (cats.length === 0) {
    els.categories.innerHTML = "";
    els.catEmpty.classList.remove("hidden");
    return;
  }

  els.catEmpty.classList.add("hidden");

  els.categories.innerHTML = cats.map(c => `
    <button class="cat-card" data-cat="${escapeHtml(c.key)}">
      <div class="cat-title">${escapeHtml(categoryLabel(c.key))}</div>
      <div class="cat-count">${c.count} ürün</div>
    </button>
  `).join("");
}

function renderProducts(list) {
  if (!list || list.length === 0) {
    els.products.innerHTML = "";
    els.prodEmpty.classList.remove("hidden");
    return;
  }

  els.prodEmpty.classList.add("hidden");

  els.products.innerHTML = list.map(p => {
    const imgHtml = p.image
      ? `<img class="prod-img" src="img/${encodeURI(p.image)}" alt="${escapeHtml(p.name)}"
           onerror="this.style.display='none'">`
      : `<div class="prod-img" style="display:grid;place-items:center;font-size:10px;color:rgba(255,255,255,.35);">
           no image
         </div>`;

    return `
      <div class="prod-card">
        ${imgHtml}
        <div>
          <div class="prod-name">${escapeHtml(p.name)}</div>
          ${p.pack ? `<div class="prod-meta">${escapeHtml(p.pack)}</div>` : ""}
          ${p.sku ? `<div class="prod-meta">SKU: ${escapeHtml(p.sku)}</div>` : ""}
          ${p.price ? `<div class="prod-price">${escapeHtml(p.price)} TL</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function showCategoriesScreen() {
  currentCategory = null;
  els.productView.classList.add("hidden");
  els.categoryView.classList.remove("hidden");
  renderCategories(allProducts);
}

function showProductsScreen(title, subtitle = "") {
  els.categoryView.classList.add("hidden");
  els.productView.classList.remove("hidden");
  els.viewTitle.textContent = title;
  els.viewSubtitle.textContent = subtitle;
}

function openCategory(catKey) {
  currentCategory = catKey;
  const label = categoryLabel(catKey);
  const filtered = allProducts.filter(p => p.category === catKey);

  showProductsScreen(label, `${filtered.length} ürün`);
  renderProducts(filtered);
}

function applySearch() {
  const q = els.search.value.trim().toLowerCase();

  if (!q) {
    if (currentCategory) openCategory(currentCategory);
    else showCategoriesScreen();
    return;
  }

  const results = allProducts.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    (p.sku && p.sku.toLowerCase().includes(q))
  );

  showProductsScreen("Arama Sonuçları", `${results.length} ürün`);
  renderProducts(results);
}

async function loadData() {
  hideStatus();

  try {
    const url = SHEET_CSV_URL + "&v=" + Date.now();
    const res = await fetch(url);

    if (!res.ok) throw new Error("CSV fetch failed: " + res.status);

    const text = await res.text();
    const rows = parseCSV(text).map(normalizeRow);
    allProducts = validateProducts(rows);

    if (allProducts.length === 0) {
      showStatus(
        "Ürün bulunamadı. Google Sheets başlıklarını kontrol edin (category, name, price, image...).",
        "error"
      );
    }

    showCategoriesScreen();
  } catch (err) {
    console.error(err);
    showStatus(
      "Veri yüklenemedi. Google Sheets linkinin 'Publish to web' olduğundan emin olun.",
      "error"
    );
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.categories.addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-card");
  if (!btn) return;
  const cat = btn.dataset.cat;
  if (cat) openCategory(cat);
});

els.back.addEventListener("click", () => {
  els.search.value = "";
  showCategoriesScreen();
});

els.search.addEventListener("input", applySearch);

loadData();
