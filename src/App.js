import { useEffect, useMemo, useState } from "react";
import Products from "./Products/Products";
import Recommended from "./Recommended/Recommended";
import Card from "./components/Card";
import Modal from "./modal/modal";
import "./index.css";

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Project");

  useEffect(() => {
    let cancelled = false;

    const sanitizeRawPathJson = (text) => {
      // Allows writing Windows paths with single backslashes inside the "path" field
      // by converting them to valid JSON escape sequences before JSON.parse.
      return String(text ?? "").replace(
        /"path"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
        (match, pathValue) => {
          const escaped = String(pathValue).replace(/\\/g, "\\\\");
          return match.replace(pathValue, escaped);
        }
      );
    };

    const load = async () => {
      try {
        const res = await fetch("/data.json", { cache: "no-store" });
        const raw = await res.text();
        const sanitized = sanitizeRawPathJson(raw);
        const parsed = JSON.parse(sanitized);
        if (!cancelled) setProjects(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (!cancelled) setProjects([]);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openAddModal = () => {
    setModalTitle("Add Project");
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    setModalTitle("Edit Project");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (event) => {
    setQuery(event.target.value);
  };

  const selectCategory = (category) => {
    setSelectedCategory(category);
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  const categories = useMemo(() => {
    const list = projects
      .flatMap((p) => {
        const c = p?.category;
        if (Array.isArray(c)) return c;
        if (typeof c === "string") return [c];
        return [];
      })
      .map((c) => String(c).trim())
      .filter(Boolean);

    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const tags = useMemo(() => {
    const list = projects
      .flatMap((p) => (Array.isArray(p?.tag) ? p.tag : []))
      .map((t) => String(t).trim())
      .filter(Boolean);

    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const visibleProjects = useMemo(
    () => {
      const q = String(query ?? "").toLowerCase();

      return projects.filter((p) => {
        const title = String(p?.title ?? "").toLowerCase();
        const matchesQuery = !q || title.includes(q);

        const matchesCategory =
          !selectedCategory || p?.category === selectedCategory;

        const tagsArr = Array.isArray(p?.tag) ? p.tag : [];
        const matchesTags =
          !selectedTags.length || selectedTags.some((t) => tagsArr.includes(t));

        return matchesQuery && matchesCategory && matchesTags;
      });
    },
    [projects, query, selectedCategory, selectedTags]
  );

  const result = useMemo(
    () =>
      visibleProjects.map(({ img, title, path }, index) => (
        <Card
          key={`${title}-${index}`}
          img={img}
          title={title}
          path={path}
          onEdit={openEditModal}
        />
      )),
    [visibleProjects]
  );

  return (
    <>
      <div className="app-shell">
        <div className="app-main">
          <div className="app-main-content">
            <Recommended
              query={query}
              onQueryChange={handleInputChange}
              tags={tags}
              categories={categories}
              selectedTags={selectedTags}
              selectedCategory={selectedCategory}
              onToggleTag={toggleTag}
              onClearTags={clearTags}
              onSelectCategory={selectCategory}
              onAdd={openAddModal}
            />
            <Products result={result} />
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} title={modalTitle} onClose={closeModal} />
    </>
  );
}

export default App;
