import Category from "./Category/Category";
import "./Sidebar.css";

const Sidebar = ({ handleChange, categories = [] }) => {
  return (
    <>
      <section className="sidebar">
        <Category handleChange={handleChange} categories={categories} />
      </section>
    </>
  );
};

export default Sidebar;
