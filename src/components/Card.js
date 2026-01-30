import { FaRegEdit, FaRegFolderOpen } from "react-icons/fa";
import { MdDeleteOutline } from "react-icons/md";

import "./Card.css";
import "./IconButton.css";

const toDisplayImageSrc = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Keep normal URLs as-is.
  if (/^(https?:|data:|blob:|file:)/i.test(raw)) return raw;

  // Windows drive path: C:\foo\bar.png -> file:///C:/foo/bar.png
  if (/^[a-zA-Z]:\\/.test(raw) || /^[a-zA-Z]:\//.test(raw)) {
    const normalized = raw.replace(/\\/g, "/");
    return encodeURI(`file:///${normalized}`);
  }

  // UNC path: \\server\share\img.png -> file://server/share/img.png
  if (/^\\\\/.test(raw)) {
    const normalized = raw.replace(/\\/g, "/"); // starts with //server/share...
    return encodeURI(`file:${normalized}`);
  }

  // Fallback: allow relative assets (e.g. ./img.png) if used.
  return raw;
};

const Card = ({ img, title, path, onEdit, onDelete }) => {
  const handleOpenFolder = async () => {
    const raw = String(path ?? "");
    if (!raw) return;

    try {
      const api =
        typeof window !== "undefined" ? window.electronAPI : undefined;
      if (api?.openPath) {
        await api.openPath(raw);
        return;
      }

      // Web fallback: cannot open local folders; copy path instead.
      await navigator.clipboard.writeText(raw);
    } catch {
      window.prompt("Path:", raw);
    }
  };

  return (
    <>
      <section className="card">
        <img src={toDisplayImageSrc(img)} alt={title} className="card-img" />
        <div className="card-details">
          <h3 className="card-title">{title}</h3>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Open folder"
            title="Open folder"
            onClick={handleOpenFolder}
          >
            <FaRegFolderOpen size={18} />
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label="Edit"
            title="Edit"
            onClick={() => onEdit?.()}
          >
            <FaRegEdit size={18} />
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label="Delete"
            title="Delete"
            onClick={() => onDelete?.()}
          >
            <MdDeleteOutline size={18} />
          </button>
        </div>
      </section>
    </>
  );
};

export default Card;
