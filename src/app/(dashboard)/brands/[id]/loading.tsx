import { BrandMark } from "@/components/brand-mark";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <BrandMark animated size={72} />
    </div>
  );
}
