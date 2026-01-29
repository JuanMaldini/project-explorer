import { useEffect } from "react";
import { FaRegSave  } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";



import "./modal.css";
import "../components/IconButton.css";

const Modal = ({ isOpen, title = "Modal", onClose }) => {
	useEffect(() => {
		if (!isOpen) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [isOpen]);

	if (!isOpen) return null;

	const handleOverlayMouseDown = (event) => {
		if (event.target !== event.currentTarget) return;
		onClose?.();
	};

	return (
		<div className="modal-overlay" onMouseDown={handleOverlayMouseDown}>
			<div
				className="modal-card"
				role="dialog"
				aria-modal="true"
				aria-label={title}
				onMouseDown={(event) => event.stopPropagation()}>
				<div className="modal-header">
                    
					<div className="modal-title">{title}</div>

                    <button
                        type="button"
                        className="icon-btn"
                        aria-label="Save"
                        title="Save"
                        >
                        <FaRegSave size={18} />
                    </button>

                    <button
                        type="button"
                        className="icon-btn"
                        aria-label="Close modal"
                        title="Close"
                        onClick={() => onClose?.()}>
                        <IoMdClose size={18} />
                    </button>
                    </div>

                <div className="modal-body">
                    <div>Title</div>
                    <div>Imagenes</div>
                    <div>path</div>
                    <div>Tags</div>
                </div>

			</div>
		</div>
	);
};

export default Modal;

