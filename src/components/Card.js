import { FaRegEdit, FaRegFolderOpen } from "react-icons/fa";

import "./Card.css";
import "./IconButton.css";

const Card = ({
  img,
  title,
  path,
  onEdit,
}) => {
  const handleCopyPath = async () => {
    const raw = String(path ?? "");
    if (!raw) return;

    try {
      await navigator.clipboard.writeText(raw);
    } catch {
      window.prompt("Copy path:", raw);
    }
  };

  return (
    <>
      <section className="card">
        <img src={img} alt={title} className="card-img" />
        <div className="card-details">
          <h3 className="card-title">{title}</h3>
        </div>

        <div className="card-actions">

          <button
            type="button"
            className="icon-btn"
            aria-label="Copy path"
            title="Copy path"
            onClick={handleCopyPath}
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

        </div>
      </section>
    </>
  );
};

export default Card;
