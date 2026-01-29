import Category from "./Category/Category";
import "./Sidebar.css";

const Sidebar = ({ handleChange }) => {
  return (
    <>
      <section className="sidebar">
        <Category handleChange={handleChange} />
      </section>
    </>
  );
};

export default Sidebar;
