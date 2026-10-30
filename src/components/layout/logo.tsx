import Image from "next/image";
import mark from "./mark.png";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-[-0.02em] ${className}`}>
      <Image src={mark} alt="" width={26} height={22} priority />
      Tacet
    </span>
  );
}
