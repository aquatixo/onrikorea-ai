import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Building2, 
  Mail, 
  CheckCircle2, 
  ArrowRight, 
  Upload, 
  Sparkles, 
  Database 
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Top Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
              O
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">
                ONRIKOREA<span className="text-blue-600 dark:text-blue-500">.AI</span>
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                Enterprise B2B
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/brands"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"
            >
              View Brands Table <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/10 via-card to-card border border-border p-8 md:p-12 shadow-sm">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400 font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Next-Gen Outreach Engine
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              Global Brand Sourcing & Cold Email Automation
            </h1>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              Ingest corporate sourcing spreadsheets, run AI evaluation workflows, and directly dispatch personalized pitches into your Microsoft Outlook mailbox.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <Link
                href="/brands"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-2 shadow-md shadow-blue-500/20"
              >
                Explore Sourcing Records <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-card border border-border shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ingested Brands
              </p>
              <p className="text-3xl font-extrabold">0</p>
              <p className="text-xs text-muted-foreground">Synced from Excel Data</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="h-6 w-6" />
            </div>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Drafts Generated
              </p>
              <p className="text-3xl font-extrabold">0</p>
              <p className="text-xs text-muted-foreground">Ready in M365 Folder</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Mail className="h-6 w-6" />
            </div>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Database Engine
              </p>
              <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">Active</p>
              <p className="text-xs text-muted-foreground">Supabase PostgreSQL</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Database className="h-6 w-6" />
            </div>
          </div>
        </section>

        {/* System Workflow Status */}
        <section className="p-6 rounded-xl bg-card border border-border shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Automation Pipeline Roadmap</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-accent/50 border border-border space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 1. Workspace Ready
              </div>
              <p className="text-xs text-muted-foreground">
                Next.js 15, Prisma ORM, and Shadcn UI components initialized.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-accent/50 border border-border space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Upload className="h-4 w-4 text-blue-500" /> 2. Excel Ingestion
              </div>
              <p className="text-xs text-muted-foreground">
                Run database push and parse brand sourcing sheets into Supabase.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-accent/50 border border-border space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-purple-500" /> 3. Outlook Drafts
              </div>
              <p className="text-xs text-muted-foreground">
                Generate LLM pitches and push via Microsoft Graph API.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}