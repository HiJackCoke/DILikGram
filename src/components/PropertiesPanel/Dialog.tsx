export default function PropertiesPanelDialog() {
  return (
    <div className="max-w-md w-full">
      <p className="text-slate-300 mb-4">
        Are you sure you want to delete this node?
      </p>

      <ul className="text-sm text-slate-400 mb-4 space-y-2">
        <li>• All connections will be removed</li>
        <li>• Child nodes will become orphaned</li>
      </ul>

      <p className="text-sm text-yellow-400 mb-6">
        ⚠️ This action cannot be undone.
      </p>
    </div>
  );
}
