import { BrandMark } from "@/components/brand-mark";

// Next.js shows this automatically as the Suspense fallback while a route segment's
// data is loading. `fixed inset-0` makes it cover the whole viewport (sidebar included)
// even though it renders inside the layout's children slot.
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <BrandMark animated size={72} />
    </div>
  );
}
