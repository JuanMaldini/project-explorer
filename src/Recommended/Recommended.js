import "./Recommended.css";
import { IoIosAddCircleOutline } from "react-icons/io";
import "../components/IconButton.css";

const Recommended = ({
  tags = [],
  selectedTags = [],
  onToggleTag,
  onClearTags,
  onAdd,
}) => {

  return (
    <>
      <div>
        <div className="wrap-title">
          <button
            type="button"
            className="icon-btn"
            aria-label="Add project"
            title="Add project"
            onClick={() => onAdd?.()}
          >
            <IoIosAddCircleOutline size={22} />
          </button>
        </div>
        <div className="recommended-flex">
          <button
            type="button"
            className={`btns tag-btn ${
              selectedTags.length === 0 ? "tag-btn-active" : ""
            }`}
            onClick={() => onClearTags?.()}
          >
            All Projects
          </button>

          {tags.map((tag) => {
            const isActive = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`btns tag-btn ${isActive ? "tag-btn-active" : ""}`}
                onClick={() => onToggleTag?.(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Recommended;
