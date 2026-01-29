import "./Nav.css";

const Nav = ({ handleInputChange, query }) => {
  return (
    <nav>
      <div>
        <input
          type="text"
          onChange={handleInputChange}
          value={query}
          placeholder="Search"
        />
      </div>
    </nav>
  );
};

export default Nav;
