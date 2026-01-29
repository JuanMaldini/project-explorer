import { FaRegEdit, FaRegFolderOpen } from "react-icons/fa";

import "./Card.css";
import "./IconButton.css";

const Card = ({
  img,
  title,
  onEdit,
}) => {
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
            aria-label="Open location"
            title="Open location"
            onClick={() => onEdit?.()}
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
