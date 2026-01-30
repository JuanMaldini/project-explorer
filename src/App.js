import { useCallback, useEffect, useMemo, useState } from "react";
import Products from "./Products/Products";
import Recommended from "./Recommended/Recommended";
import Card from "./components/Card";
import Modal from "./modal/modal";
import "./App.css";
import "./index.css";

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Project");
  const [modalMode, setModalMode] = useState("add");
  const [modalProject, setModalProject] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const sanitizeRawPathJson = (text) => {
      const sanitizeField = (input, fieldName) =>
        String(input ?? "").replace(
          new RegExp(
            `"${fieldName}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`,
            "g",
          ),
          (match, fieldValue) => {
            const escaped = String(fieldValue).replace(/\\/g, "\\\\");
            return match.replace(fieldValue, escaped);
          },
        );

      // Allows writing Windows paths with single backslashes inside fields
      // by converting them to valid JSON escape sequences before JSON.parse.
      const s1 = sanitizeField(text, "path");
      return sanitizeField(s1, "img");
    };

    const load = async () => {
      try {
        const raw = await (async () => {
          const api =
            typeof window !== "undefined" ? window.electronAPI : undefined;
          if (api?.readDataJson) return await api.readDataJson();

          const base = process.env.PUBLIC_URL || "";
          const url = `${base}/data.json`;
          const res = await fetch(url, { cache: "no-store" });
          return await res.text();
        })();
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
    setModalMode("add");
    setModalProject(null);
    setIsModalOpen(true);
  };

  const openEditModal = (project) => {
    setModalTitle("Edit Project");
    setModalMode("edit");
    setModalProject(project ?? null);
    setIsModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalProject(null);
  }, []);

  const persistProjects = useCallback(async (nextProjects) => {
    try {
      const api =
        typeof window !== "undefined" ? window.electronAPI : undefined;
      if (api?.saveProjects) await api.saveProjects(nextProjects);
    } catch {
      // keep UI state even if persistence fails
    }
  }, []);

  const deleteProject = useCallback(
    async (projectToDelete) => {
      setProjects((prev) => {
        const nextProjects = prev.filter((p) => p !== projectToDelete);

        persistProjects(nextProjects);

        return nextProjects;
      });
    },
    [persistProjects],
  );

  const saveFromModal = useCallback(
    async (draft) => {
      setProjects((prev) => {
        let nextProjects = prev;

        if (modalMode === "edit" && modalProject) {
          nextProjects = prev.map((p) =>
            p === modalProject ? { ...p, ...draft } : p,
          );
        } else {
          nextProjects = [...prev, draft];
        }

        persistProjects(nextProjects);
        return nextProjects;
      });

      closeModal();
    },
    [closeModal, modalMode, modalProject, persistProjects],
  );

  const handleInputChange = (event) => {
    setQuery(event.target.value);
  };

  const selectCategory = (category) => {
    setSelectedCategory(category);
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
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

  const visibleProjects = useMemo(() => {
    const q = String(query ?? "").toLowerCase();

    return projects.filter((p) => {
      const title = String(p?.title ?? "").toLowerCase();
      const desc = String(p?.description ?? "").toLowerCase();
      const matchesQuery = !q || title.includes(q) || desc.includes(q);

      const matchesCategory =
        !selectedCategory || p?.category === selectedCategory;

      const tagsArr = Array.isArray(p?.tag) ? p.tag : [];
      const matchesTags =
        !selectedTags.length || selectedTags.some((t) => tagsArr.includes(t));

      return matchesQuery && matchesCategory && matchesTags;
    });
  }, [projects, query, selectedCategory, selectedTags]);

  const result = useMemo(
    () =>
      visibleProjects.map((project, index) => (
        <Card
          key={`${project?.title ?? "project"}-${index}`}
          img={project?.img}
          title={project?.title}
          description={project?.description}
          path={project?.path}
          onEdit={() => openEditModal(project)}
          onDelete={() => deleteProject(project)}
        />
      )),
    [visibleProjects, deleteProject],
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
            <div className="spacerbar-section" />
            <Products result={result} />
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        title={modalTitle}
        mode={modalMode}
        project={modalProject}
        categories={categories}
        onSave={saveFromModal}
        onClose={closeModal}
      />
    </>
  );
}

export default App;
