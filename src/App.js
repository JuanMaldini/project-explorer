import { useMemo, useState } from "react";
import Navigation from "./Navigation/Nav";
import Products from "./Products/Products";
import initialData from "./db/data.json";
import Recommended from "./Recommended/Recommended";
import Sidebar from "./Sidebar/Sidebar";
import Card from "./components/Card";
import Modal from "./modal/modal";
import "./index.css";

function App() {
  const [projects] = useState(() => (Array.isArray(initialData) ? initialData : []));
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Project");

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

  const handleChange = (event) => {
    setSelectedCategory(event.target.value);
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
      visibleProjects.map(({ img, title }, index) => (
        <Card
          key={`${title}-${index}`}
          img={img}
          title={title}
          onEdit={openEditModal}
        />
      )),
    [visibleProjects]
  );

  return (
    <>
      <div className="app-shell">
        <div className="app-sidebar">
          <Sidebar handleChange={handleChange} categories={categories} />
        </div>

        <div className="app-main">
          <div className="app-main-header">
            <Navigation query={query} handleInputChange={handleInputChange} />
          </div>

          <div className="app-main-content">
            <Recommended
              tags={tags}
              selectedTags={selectedTags}
              onToggleTag={toggleTag}
              onClearTags={clearTags}
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
