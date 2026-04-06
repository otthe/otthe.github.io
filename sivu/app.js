const sections = [
  { id: "intro", file: "content/intro.md" },
  { id: "syntax", file: "content/syntax.md" },
  { id: "get-started", file: "content/get-started.md" },
  { id: "functions", file: "content/functions.md" },
  { id: "superglobals", file: "content/superglobals.md" },
  { id: "considerations", file: "content/considerations.md" }
];

async function loadDocs() {
  const container = document.getElementById("content");

  for (const sec of sections) {
    const md = await fetch(sec.file).then(r => r.text());

    const sectionEl = document.createElement("section");
    sectionEl.id = sec.id;

    // ✅ Proper Markdown rendering
    sectionEl.innerHTML = marked.parse(md);

    container.appendChild(sectionEl);
  }
}

/* Mobile menu */
const toggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");

toggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

loadDocs();