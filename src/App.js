import { useCallback, useEffect, useMemo, useState } from "react";
import Products from "./Products/Products";
import Recommended from "./Recommended/Recommended";
import Card from "./components/Card";
import Modal from "./modal/modal";
import "./App.css";
import "./index.css";

const normalizeStoredPath = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Keep URLs as-is.
  if (/^(https?:|data:|blob:|file:)/i.test(raw)) return raw;

  // UNC path (\\server\share\folder). Keep exactly two leading backslashes.
  if (/^[\\/]{2,}/.test(raw)) {
    const rest = raw.replace(/^[\\/]+/, "");
    const cleaned = rest.replace(/[\\/]+/g, "\\");
    return `\\\\${cleaned}`;
  }

  // Drive path (C:\folder). Collapse repeated separators.
  if (/^[a-zA-Z]:[\\/]/.test(raw)) {
    return raw.replace(/[\\/]+/g, "\\");
  }

  return raw;
};

const normalizeProjectPaths = (project) => {
  if (!project || typeof project !== "object") return project;
  return {
    ...project,
    img: normalizeStoredPath(project.img),
    path: normalizeStoredPath(project.path),
  };
};

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

    const sanitizeRawPathJsonIfNeeded = (text) => {
      const sanitizeField = (input, fieldName) =>
        String(input ?? "").replace(
          new RegExp(
            `"${fieldName}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`,
            "g",
          ),
          (match, fieldValue) => {
            const fixed = String(fieldValue).replace(
              /\\(?!["\\/bfnrtu])/g,
              "\\\\",
            );
            return match.replace(fieldValue, fixed);
          },
        );

      const s1 = sanitizeField(text, "path");
      return sanitizeField(s1, "img");
    };

    const parseProjectsText = (text) => {
      try {
        return JSON.parse(String(text ?? ""));
      } catch {
        const sanitized = sanitizeRawPathJsonIfNeeded(text);
        return JSON.parse(String(sanitized ?? ""));
      }
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

        const parsed = parseProjectsText(raw);
        const array = Array.isArray(parsed) ? parsed : [];
        const normalized = array.map(normalizeProjectPaths);

        if (!cancelled) setProjects(normalized);

        try {
          const api =
            typeof window !== "undefined" ? window.electronAPI : undefined;
          if (api?.saveProjects) {
            const changed = normalized.some((p, i) => {
              const prev = array[i];
              return (
                String(prev?.img ?? "") !== String(p?.img ?? "") ||
                String(prev?.path ?? "") !== String(p?.path ?? "")
              );
            });
            if (changed) await api.saveProjects(normalized);
          }
        } catch {
          // ignore auto-heal failures
        }
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
      if (api?.saveProjects) {
        const normalized = Array.isArray(nextProjects)
          ? nextProjects.map(normalizeProjectPaths)
          : [];
        await api.saveProjects(normalized);
      }
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
      const normalizedDraft = normalizeProjectPaths(draft);
      setProjects((prev) => {
        let nextProjects = prev;

        if (modalMode === "edit" && modalProject) {
          nextProjects = prev.map((p) =>
            p === modalProject ? { ...p, ...normalizedDraft } : p,
          );
        } else {
          nextProjects = [...prev, normalizedDraft];
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

  const exportAllProjects = useCallback(async () => {
    try {
      const api =
        typeof window !== "undefined" ? window.electronAPI : undefined;

      const payload = Array.isArray(projects)
        ? projects.map(normalizeProjectPaths)
        : [];

      if (api?.exportProjects) {
        await api.exportProjects(payload);
        return;
      }

      // Web fallback: download JSON.
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-explorer-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, [projects]);

  const importAllProjects = useCallback(async () => {
    try {
      const api =
        typeof window !== "undefined" ? window.electronAPI : undefined;

      if (api?.importProjects) {
        const imported = await api.importProjects();
        if (Array.isArray(imported)) {
          const normalized = imported.map(normalizeProjectPaths);
          setProjects(normalized);
          setSelectedCategory("");
          setSelectedTags([]);
        }
        return;
      }

      // Web fallback: file picker.
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) return;
          const normalized = parsed.map(normalizeProjectPaths);
          setProjects(normalized);
          setSelectedCategory("");
          setSelectedTags([]);
        } catch {
          // ignore
        }
      };
      input.click();
    } catch {
      // ignore
    }
  }, []);

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
              onExport={exportAllProjects}
              onImport={importAllProjects}
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
        tags={tags}
        onSave={saveFromModal}
        onClose={closeModal}
      />
    </>
  );
}

export default App;
