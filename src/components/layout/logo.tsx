export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-display text-[17px] font-semibold tracking-[-0.02em] ${className}`}>
      Tacet
    </span>
  );
}
