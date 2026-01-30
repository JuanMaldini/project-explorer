import { useEffect, useMemo, useState } from "react";
import { IoMdClose } from "react-icons/io";
import "./modal.css";
import "../components/IconButton.css";

const toDisplayImageSrc = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^(https?:|data:|blob:|file:)/i.test(raw)) return raw;

  if (/^[a-zA-Z]:\\/.test(raw) || /^[a-zA-Z]:\//.test(raw)) {
    const normalized = raw.replace(/\\/g, "/");
    return encodeURI(`file:///${normalized}`);
  }

  if (/^\\\\/.test(raw)) {
    const normalized = raw.replace(/\\/g, "/");
    return encodeURI(`file:${normalized}`);
  }

  return raw;
};

const Modal = ({
  isOpen,
  title = "Modal",
  description = "",
  mode = "add", // "add" | "edit"
  project,
  categories = [],
  onSave,
  onClose,
}) => {
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImg, setFormImg] = useState("");
  const [formPath, setFormPath] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTags, setFormTags] = useState("");

  const isEdit = mode === "edit";
  const canUseDialogs =
    typeof window !== "undefined" &&
    window.electronAPI?.selectImage &&
    window.electronAPI?.selectFolder;

  const previewSrc = useMemo(() => toDisplayImageSrc(formImg), [formImg]);
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (isEdit && project) {
      setFormTitle(String(project?.title ?? ""));
      setFormDescription(String(project?.description ?? description ?? ""));
      setFormImg(String(project?.img ?? ""));
      setFormPath(String(project?.path ?? ""));
      setFormCategory(String(project?.category ?? ""));
      setFormTags(
        Array.isArray(project?.tag)
          ? project.tag.map((t) => String(t)).join(", ")
          : "",
      );
      return;
    }

    // Add mode
    setFormTitle("");
    setFormDescription(String(description ?? ""));
    setFormImg("");
    setFormPath("");
    setFormCategory("");
    setFormTags("");
  }, [isOpen, isEdit, project, description]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setFormTitle("");
    setFormDescription(String(description ?? ""));
    setFormImg("");
    setFormPath("");
    setFormCategory("");
    setFormTags("");
    onClose?.();
  };

  const handleOverlayMouseDown = (event) => {
    if (event.target !== event.currentTarget) return;
    resetAndClose();
  };

  const parseTags = (text) => {
    const list = String(text ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  };

  const handleBrowseImage = async () => {
    try {
      const selected = await window.electronAPI.selectImage();
      if (selected) setFormImg(String(selected));
    } catch {
      // ignore
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await window.electronAPI.selectFolder();
      if (selected) setFormPath(String(selected));
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const next = {
      title: String(formTitle ?? "").trim(),
      description: String(formDescription ?? "").trim(),
      img: String(formImg ?? "").trim(),
      path: String(formPath ?? "").trim(),
      category: String(formCategory ?? "").trim(),
      tag: parseTags(formTags),
    };

    if (!next.title) return;

    await onSave?.(next);
    resetAndClose();
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{title}</div>

          <button
            type="button"
            className="icon-btn"
            aria-label="Close modal"
            title="Close"
            onClick={resetAndClose}
          >
            <IoMdClose size={18} />
          </button>
        </div>

        <div className="modal-body">
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="title">Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Project title"
                  autoFocus
                />
              </div>

              <div className="form-group form-span-2">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Short description (optional)"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category</label>
                <input
                  type="text"
                  id="category"
                  name="category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Residential"
                  list="categories-list"
                />
                <datalist id="categories-list">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="form-group form-span-2">
                <label htmlFor="img">Image</label>
                <div className="input-row">
                  <input
                    type="text"
                    id="img"
                    name="img"
                    value={formImg}
                    onChange={(e) => setFormImg(e.target.value)}
                    placeholder="C:\\Images\\thumb.png  or  \\\\server\\share\\thumb.png"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleBrowseImage}
                    disabled={!canUseDialogs}
                    title={
                      canUseDialogs
                        ? "Browse image"
                        : "Browse is available in Electron"
                    }
                  >
                    Browse
                  </button>
                </div>
                {previewSrc ? (
                  <div className="img-preview">
                    <img src={previewSrc} alt="Preview" />
                  </div>
                ) : null}
              </div>

              <div className="form-group form-span-2">
                <label htmlFor="path">Path</label>
                <div className="input-row">
                  <input
                    type="text"
                    id="path"
                    name="path"
                    value={formPath}
                    onChange={(e) => setFormPath(e.target.value)}
                    placeholder="C:\\Projects\\001  or  \\\\server\\share\\Project"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleBrowseFolder}
                    disabled={!canUseDialogs}
                    title={
                      canUseDialogs
                        ? "Browse folder"
                        : "Browse is available in Electron"
                    }
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div className="form-group form-span-2">
                <label htmlFor="tags">Tags (comma separated)</label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={resetAndClose}
              >
                Cancel
              </button>

              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Modal;
