type TTermCardProps = {
  label: string;
  onPick: () => void;
};

export function TermCard({ label, onPick }: TTermCardProps) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-800 shadow-sm transition duration-200 hover:scale-[1.02] hover:border-blue-200 hover:shadow-md active:scale-[0.98] sm:text-base"
    >
      {label}
    </button>
  );
}
