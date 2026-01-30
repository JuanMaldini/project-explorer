import "./Recommended.css";
import { IoIosAddCircleOutline } from "react-icons/io";
import { CiExport } from "react-icons/ci";
import { CiImport } from "react-icons/ci";
import { RiSignalTowerLine } from "react-icons/ri";
import "../components/IconButton.css";

const Recommended = ({
  query = "",
  onQueryChange,
  tags = [],
  categories = [],
  selectedTags = [],
  selectedCategory = "",
  onToggleTag,
  onClearTags,
  onSelectCategory,
  onAdd,
  onExport,
  onImport,
  onToggleServerSync,
  serverSyncEnabled = false,
  serverSyncFolderPath = "",
}) => {
  const hasServerSyncFolder = Boolean(String(serverSyncFolderPath ?? "").trim());
  const serverSyncTitle = serverSyncEnabled
    ? `Server sync (ON)\n${serverSyncFolderPath}`
    : hasServerSyncFolder
      ? `Server sync (OFF)\n${serverSyncFolderPath}`
      : "Server sync (OFF)\nSelect shared folder";

  const serverSyncClass = serverSyncEnabled
    ? "icon-btn icon-btn--connected"
    : hasServerSyncFolder
      ? "icon-btn icon-btn--ready"
      : "icon-btn icon-btn--inactive";

  return (
    <>
      <div className="recommended-panel">
        <div className="recommended-titlebar">
          <h2 className="recommended-title">Project</h2>

          <button
            type="button"
            className="icon-btn"
            aria-label="Add project"
            title="Add project"
            onClick={() => onAdd?.()}
          >
            <IoIosAddCircleOutline size={22} />
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label="Export projects"
            title="Export projects"
            onClick={() => onExport?.()}
          >
            <CiExport size={22} />
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label="Import projects"
            title="Import projects (overwrite active data)"
            onClick={() => onImport?.()}
          >
            <CiImport size={22} />
          </button>

          <button
            type="button"
            className={serverSyncClass}
            aria-label="Server sync"
            title={serverSyncTitle}
            onClick={() => onToggleServerSync?.()}
          >
            <RiSignalTowerLine size={22} />
          </button>

          <input
            className="recommended-search"
            type="text"
            onChange={onQueryChange}
            value={query}
            placeholder="Search"
          />

         </div>

        <div className="recommended-columns">
          <div className="recommended-col">
            <div className="recommended-col-title">Tags</div>
            <div className="recommended-flex">
              <button
                type="button"
                className={`btns tag-btn ${
                  selectedTags.length === 0 ? "tag-btn-active" : ""
                }`}
                onClick={() => onClearTags?.()}
              >
                All Tags
              </button>

              {tags.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`btns tag-btn ${
                      isActive ? "tag-btn-active" : ""
                    }`}
                    onClick={() => onToggleTag?.(tag)}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="recommended-col">
            <div className="recommended-col-title">Categories</div>
            <div className="recommended-flex">
              <button
                type="button"
                className={`btns tag-btn ${
                  !selectedCategory ? "tag-btn-active" : ""
                }`}
                onClick={() => onSelectCategory?.("")}
              >
                All Categories
              </button>

              {categories.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    className={`btns tag-btn ${
                      isActive ? "tag-btn-active" : ""
                    }`}
                    onClick={() => onSelectCategory?.(category)}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Recommended;
