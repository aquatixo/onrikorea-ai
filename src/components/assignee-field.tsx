export function AssigneeField({
  label,
  options,
  defaultValue,
  error,
  chooseLabel,
}: {
  label: string;
  options: string[];
  defaultValue?: string;
  error?: string[];
  chooseLabel: string;
}) {
  // If the current value (e.g. "기타" on an item edited from the board-22 import)
  // isn't in the roster, keep it selectable anyway -- otherwise editing that item
  // would silently reassign it to whichever person happens to be first.
  const allOptions = defaultValue && !options.includes(defaultValue) ? [defaultValue, ...options] : options;

  return (
    <div className="space-y-1.5">
      <label htmlFor="assigneeName" className="text-sm font-medium">
        {label}
        <span className="text-destructive"> *</span>
      </label>
      <select
        id="assigneeName"
        name="assigneeName"
        required
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      >
        <option value="" disabled>
          {chooseLabel}
        </option>
        {allOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}
