import Link from "next/link";
import { db } from "@/lib/db";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Search, Filter, Globe, Building2, Plus, AlertCircle } from "lucide-react";

// Mock data used when database is not connected
const MOCK_BRANDS = [
  {
    id: "mock-1",
    excelNo: 1361,
    methodology: "Direct Outreach",
    name: "Bio Familia (familia 뮤즐리)",
    country: "스위스",
    category: "뮤즐리/시리얼",
    foundedYear: 1954,
    website: "bio-familia.com",
    coldEmailSent: false,
    replied: false,
    status: "IMPORTED",
  },
  {
    id: "mock-2",
    excelNo: 1362,
    methodology: "Trade Show",
    name: "Café-Konditorei Fürst",
    country: "오스트리아",
    category: "초콜릿/제과",
    foundedYear: 1884,
    website: "original-mozartkugel.com",
    coldEmailSent: false,
    replied: false,
    status: "IMPORTED",
  },
  {
    id: "mock-3",
    excelNo: 1366,
    methodology: "Direct Outreach",
    name: "Honey Acres",
    country: "미국",
    category: "꿀",
    foundedYear: 1852,
    website: "honeyacres.com",
    coldEmailSent: true,
    replied: true,
    status: "CONTACTED",
  },
];

export default async function BrandsPage() {
  let brands = [];
  let isUsingMock = false;

  try {
    brands = await db.brand.findMany({
      orderBy: { createdAt: "desc" },
    });
    
    // Fall back to mock data if database table is currently empty
    if (brands.length === 0) {
      brands = MOCK_BRANDS;
      isUsingMock = true;
    }
  } catch (err) {
    // Graceful fallback when Supabase connection string is missing/unreachable
    brands = MOCK_BRANDS;
    isUsingMock = true;
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Brand Sourcing Table</h1>
              <p className="text-xs text-muted-foreground">
                {brands.length} Record{brands.length === 1 ? "" : "s"} Displayed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> Import Excel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Mock Data Banner Notice */}
        {isUsingMock && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Database Preview Mode:</strong> Showing sample Excel brands. Connect Supabase to unlock live data syncing.
              </span>
            </div>
          </div>
        )}

        {/* Search Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by brand name or country..."
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filter Status
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Brand Name</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Category (SKU)</th>
                  <th className="px-4 py-3">Founded</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3 text-center">Cold Email</th>
                  <th className="px-4 py-3 text-center">Reply</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {brands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {brand.excelNo ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {brand.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {brand.country ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {brand.category ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-accent text-foreground font-medium">
                          {brand.category}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {brand.foundedYear ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {brand.website ? (
                        <a
                          href={brand.website.startsWith("http") ? brand.website : `https://${brand.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                        >
                          <Globe className="h-3 w-3" />
                          {brand.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          brand.coldEmailSent
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {brand.coldEmailSent ? "SENT" : "NO"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          brand.replied
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {brand.replied ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="px-3 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 text-xs font-medium rounded transition-colors">
                        Generate Pitch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}