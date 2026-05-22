export default function NotificationDropdown() {
  const notifications = [
    "New order received",
    "Book out of stock",
    "New user registered",
  ];

  return (
    <div className="absolute right-0 mt-2 w-64 bg-white shadow rounded-lg p-3">
      <h4 className="font-bold mb-2">Notifications</h4>
      <ul className="space-y-1">
        {notifications.map((note, i) => (
          <li key={i} className="text-sm text-gray-700">
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}
