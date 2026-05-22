import { FaTimes } from "react-icons/fa";

function SmallSizeModel({
  title = "Confirm",
  children,
  onClose,
  width = "max-w-lg", // Tailwind width control
}) {
  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full ${width}  bg-white rounded-xl shadow-lg border border-gray-200 animate-slideUp`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold">{title}</h3>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-gray-100"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 text-sm text-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
}

export default SmallSizeModel;