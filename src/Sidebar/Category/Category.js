import "./Category.css";
import Input from "../../components/Input";

function Category({ handleChange }) {
  return (
    <div>
      <h2 className="sidebar-title">Category</h2>

      <div>
        <label className="sidebar-label-container">
          <input onChange={handleChange} type="radio" value="" name="test" />
          <span className="checkmark"></span>All
        </label>
        <Input
          handleChange={handleChange}
          value="category_01"
          title="Category 01"
          name="test"
        />
        <Input
          handleChange={handleChange}
          value="category_02"
          title="Category 02"
          name="test"
        />
      </div>
    </div>
  );
}

export default Category;
