"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Download,
  FileText,
  ExternalLink,
  MapPin,
  Phone,
  Flame,
  Sun,
  Snowflake,
  LogOut,
  Search,
  Star,
  FileSpreadsheet,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  X,
  ChevronUp,
  ChevronDown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// -- Types --

interface ScoreBreakdown {
  hasPhone: boolean;
  hasWebsite: boolean;
  hasReviews: boolean;
  highRating: boolean;
  manyReviews: "high" | "medium" | false;
  currentlyOpen: boolean;
}

interface Place {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating: number | null;
  userRatingsTotal: number | null;
  website: string;
  mapsUrl: string;
  types: string[];
  openNow: boolean | null;
  description: string;
  businessType: string;
  weekdayHours: string[];
  leadScore: number;
  leadLabel: "Hot" | "Warm" | "Cold";
  scoreBreakdown: ScoreBreakdown;
  recentReview: {
    text: string;
    rating: number | null;
    author: string;
    timeDescription: string;
  } | null;
}

interface Suggestion {
  description: string;
  placeId: string;
}

// -- Industry definitions --

const INDUSTRIES = [
  { key: "construction", label: "Construction" },
  { key: "logistics", label: "Logistics & Transportation" },
  { key: "moving", label: "Moving Companies" },
  { key: "warehouse", label: "Warehousing & Storage" },
  { key: "service", label: "Service Providers" },
  { key: "trucking", label: "Trucking & Freight" },
  { key: "field_services", label: "Field Services" },
] as const;

// -- Helper components --

function LeadScoreBadge({ label, score }: { label: "Hot" | "Warm" | "Cold"; score: number }) {
  const config = {
    Hot: {
      className: "bg-green-500/15 text-green-700 border-green-300",
      icon: Flame,
    },
    Warm: {
      className: "bg-yellow-500/15 text-yellow-700 border-yellow-300",
      icon: Sun,
    },
    Cold: {
      className: "bg-gray-500/10 text-gray-500 border-gray-300",
      icon: Snowflake,
    },
  };
  const c = config[label];
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn("font-semibold gap-1", c.className)}>
      <Icon className="h-3 w-3" />
      {label} ({score}/9)
    </Badge>
  );
}

function ScoreBreakdownView({ breakdown }: { breakdown: ScoreBreakdown }) {
  const items = [
    { label: "Has phone", value: breakdown.hasPhone, points: "+2" },
    { label: "Has website", value: breakdown.hasWebsite, points: "+2" },
    { label: "Has reviews", value: breakdown.hasReviews, points: "+1" },
    { label: "Rating > 4.0", value: breakdown.highRating, points: "+1" },
    {
      label: breakdown.manyReviews === "high" ? "50+ reviews" : "20+ reviews",
      value: !!breakdown.manyReviews,
      points: breakdown.manyReviews === "high" ? "+2" : "+1",
    },
    { label: "Currently open", value: breakdown.currentlyOpen, points: "+1" },
  ];

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          {item.value ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
          )}
          <span className={item.value ? "text-foreground" : "text-muted-foreground"}>
            {item.label}
          </span>
          <span className={cn(
            "ml-auto font-mono text-xs",
            item.value ? "text-green-600" : "text-muted-foreground/50"
          )}>
            {item.points}
          </span>
        </div>
      ))}
    </div>
  );
}

function SkeletonAccordion() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-28 ml-auto" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// -- Main component --

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(new Set());
  const [showOther, setShowOther] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleIndustry(key: string) {
    setSelectedIndustries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleLocationChange(value: string) {
    setLocation(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: value }),
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          setShowSuggestions((data.suggestions || []).length > 0);
        }
      } catch {
        // silently fail
      }
    }, 300);
  }

  function selectSuggestion(suggestion: Suggestion) {
    setLocation(suggestion.description);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim()) return;

    setLoading(true);
    setSearched(true);
    setSelected(new Set());
    setShowSuggestions(false);

    try {
      const industries = Array.from(selectedIndustries);

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: location.trim(),
          industries,
          customQuery: showOther ? customQuery : undefined,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setSearchCollapsed(true);
      }
    } catch {
      console.error("Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === results.length
        ? new Set()
        : new Set(results.map((r) => r.id))
    );
  }, [results]);

  function getSelectedResults(): Place[] {
    if (selected.size === 0) return results;
    return results.filter((r) => selected.has(r.id));
  }

  // -- Exports --

  function exportCSV() {
    const data = getSelectedResults();
    if (data.length === 0) return;

    const headers = [
      "Name", "Lead Score", "Score Value", "Business Type", "Address", "Phone",
      "Rating", "Reviews", "Website", "Google Maps", "Description",
    ];
    const rows = data.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.leadLabel,
      p.leadScore,
      `"${p.businessType}"`,
      `"${p.address.replace(/"/g, '""')}"`,
      `"${p.phone}"`,
      p.rating ?? "",
      p.userRatingsTotal ?? "",
      `"${p.website}"`,
      `"${p.mapsUrl}"`,
      `"${(p.description || "").replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadFile(csv, "leads.csv", "text/csv");
  }

  async function exportPDF() {
    const data = getSelectedResults();
    if (data.length === 0) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Synergic Lead Generator - Export", 14, 15);
    doc.setFontSize(10);
    const industryStr = selectedIndustries.size > 0
      ? Array.from(selectedIndustries).join(", ")
      : "All Industries";
    doc.text(
      `Location: ${location} | Industries: ${industryStr} | ${data.length} leads`,
      14,
      22
    );

    autoTable(doc, {
      startY: 28,
      head: [["Lead", "Score", "Name", "Type", "Phone", "Rating", "Reviews", "Website"]],
      body: data.map((p) => [
        p.leadLabel,
        `${p.leadScore}/9`,
        p.name,
        p.businessType || "N/A",
        p.phone || "N/A",
        p.rating?.toString() ?? "N/A",
        p.userRatingsTotal?.toString() ?? "N/A",
        p.website || "N/A",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [72, 42, 255] },
    });

    doc.save("leads.pdf");
  }

  async function exportExcel() {
    const data = getSelectedResults();
    if (data.length === 0) return;

    const XLSX = await import("xlsx");
    const wsData = [
      [
        "Name", "Lead Score", "Score Value", "Business Type", "Address", "Phone",
        "Rating", "Reviews", "Website", "Google Maps", "Description",
      ],
      ...data.map((p) => [
        p.name,
        p.leadLabel,
        p.leadScore,
        p.businessType || "N/A",
        p.address,
        p.phone || "N/A",
        p.rating ?? "N/A",
        p.userRatingsTotal ?? "N/A",
        p.website || "N/A",
        p.mapsUrl,
        p.description || "N/A",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "leads.xlsx");
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // -- Counts --
  const hotCount = results.filter((r) => r.leadLabel === "Hot").length;
  const warmCount = results.filter((r) => r.leadLabel === "Warm").length;
  const coldCount = results.filter((r) => r.leadLabel === "Cold").length;

  return (
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Header */}
      <header className="border-b bg-[#482aff] flex-shrink-0 z-40">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/synergic-logo-white.svg"
            alt="Synergic"
            width={140}
            height={44}
          />
          <div className="flex items-center gap-4">
            {session?.user?.name && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <User className="h-4 w-4" />
                {session.user.name}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Search Panel */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Search Leads</h2>
            </div>
            {searched && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchCollapsed(!searchCollapsed)}
                className="h-7 px-2 text-xs"
              >
                {searchCollapsed ? (
                  <><ChevronDown className="h-3 w-3 mr-1" /> Expand</>
                ) : (
                  <><ChevronUp className="h-3 w-3 mr-1" /> Collapse</>
                )}
              </Button>
            )}
          </div>

          {!searchCollapsed && (
            <form onSubmit={handleSearch} className="space-y-3 animate-fade-in">
              {/* Location */}
              <div className="relative" ref={wrapperRef}>
                <Label htmlFor="location" className="text-xs font-medium mb-1 block">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="e.g. Los Angeles, CA"
                    value={location}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    required
                    autoComplete="off"
                    className="pl-9"
                  />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((s) => (
                      <li
                        key={s.placeId}
                        className="px-3 py-2.5 text-sm cursor-pointer hover:bg-accent transition-colors flex items-center gap-2"
                        onMouseDown={() => selectSuggestion(s)}
                      >
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        {s.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Industries multi-select */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Industries</Label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind.key}
                      type="button"
                      onClick={() => toggleIndustry(ind.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        selectedIndustries.has(ind.key)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {ind.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowOther(!showOther)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      showOther
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    Other
                  </button>
                </div>
                {selectedIndustries.size === 0 && !showOther && (
                  <p className="text-xs text-muted-foreground mt-1">No selection = search all industries</p>
                )}
              </div>

              {/* Other input */}
              {showOther && (
                <div className="animate-fade-in">
                  <Label htmlFor="customQuery" className="text-xs font-medium mb-1 block">Custom Search Term</Label>
                  <Input
                    id="customQuery"
                    placeholder="e.g. landscaping companies"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                  />
                </div>
              )}

              {/* Search button */}
              <Button type="submit" disabled={loading} className="gap-2">
                <Search className="h-4 w-4" />
                {loading ? "Searching..." : "Search"}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Results Area - fills remaining space, scrolls internally */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Loading skeleton */}
        {searched && loading && (
          <div className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-4">
              <SkeletonAccordion />
            </div>
          </div>
        )}

        {/* Empty state */}
        {searched && !loading && results.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Search className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              <p className="text-lg font-medium">No leads found</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Try broadening your search with a larger area or select different industries.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {searched && !loading && results.length > 0 && (
          <>
            {/* Results header - sticky */}
            <div className="flex-shrink-0 border-b bg-background">
              <div className="container mx-auto px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selected.size === results.length && results.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm font-semibold">Results</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {results.length} leads
                    </Badge>
                    {selected.size > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {selected.size} selected
                      </Badge>
                    )}
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Flame className="h-3 w-3" /> {hotCount}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-yellow-600">
                      <Sun className="h-3 w-3" /> {warmCount}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Snowflake className="h-3 w-3" /> {coldCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowScoreInfo(!showScoreInfo)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Lead score info"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-8 text-xs">
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5 h-8 text-xs">
                      <FileText className="h-3 w-3" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5 h-8 text-xs">
                      <FileSpreadsheet className="h-3 w-3" /> Excel
                    </Button>
                  </div>
                </div>

                {/* Score info tooltip */}
                {showScoreInfo && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 border text-xs animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Lead Score Criteria (max 9 points)</span>
                      <button onClick={() => setShowScoreInfo(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-muted-foreground">
                      <span>Has phone: +2</span>
                      <span>Has website: +2</span>
                      <span>Has reviews: +1</span>
                      <span>Rating &gt; 4.0: +1</span>
                      <span>50+ reviews: +2 (20+: +1)</span>
                      <span>Currently open: +1</span>
                    </div>
                    <div className="mt-2 pt-2 border-t flex gap-4 text-muted-foreground">
                      <span><Flame className="h-3 w-3 inline text-green-600" /> Hot: 7-9</span>
                      <span><Sun className="h-3 w-3 inline text-yellow-600" /> Warm: 4-6</span>
                      <span><Snowflake className="h-3 w-3 inline text-gray-400" /> Cold: 0-3</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable accordion results */}
            <div className="flex-1 overflow-auto">
              <div className="container mx-auto px-4 py-2">
                <Accordion type="multiple" className="space-y-1">
                  {results.map((place) => (
                    <AccordionItem
                      key={place.id}
                      value={place.id}
                      className="border rounded-lg px-3 data-[state=open]:bg-muted/20"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selected.has(place.id)}
                          onCheckedChange={() => toggleSelect(place.id)}
                          className="flex-shrink-0"
                        />
                        <AccordionTrigger className="hover:no-underline py-3 gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <LeadScoreBadge label={place.leadLabel} score={place.leadScore} />
                            <span className="font-medium truncate text-sm">{place.name}</span>
                            {place.phone && (
                              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                <Phone className="h-3 w-3" />
                                {place.phone}
                              </span>
                            )}
                            {place.rating && (
                              <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                {place.rating}
                              </span>
                            )}
                          </div>
                        </AccordionTrigger>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 pb-2 pl-8">
                          {/* Overview */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Overview</h4>
                            <div className="space-y-2">
                              <p className="text-sm font-medium">{place.name}</p>
                              {place.businessType && (
                                <p className="text-xs text-muted-foreground">{place.businessType}</p>
                              )}
                              {place.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed">{place.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" />
                                {place.address}
                              </p>
                            </div>

                            {/* Contact */}
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider pt-2">Contact</h4>
                            <div className="space-y-2">
                              {place.phone ? (
                                <a
                                  href={`tel:${place.phone}`}
                                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  {place.phone}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">No phone listed</span>
                              )}
                              {place.website && (
                                <a
                                  href={place.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  Website
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              <a
                                href={place.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                              >
                                <MapPin className="h-3.5 w-3.5" />
                                View on Google Maps
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>

                          {/* Ratings & Reviews */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Ratings & Reviews</h4>
                            {place.rating ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        className={cn(
                                          "h-4 w-4",
                                          i < Math.round(place.rating!)
                                            ? "text-yellow-500 fill-yellow-500"
                                            : "text-gray-200"
                                        )}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-sm font-medium">{place.rating}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({place.userRatingsTotal} reviews)
                                  </span>
                                </div>
                                {place.recentReview && place.recentReview.text && (
                                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                                    <p className="text-xs italic text-muted-foreground leading-relaxed">
                                      &quot;{place.recentReview.text}&quot;
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/70">
                                      {place.recentReview.author && `${place.recentReview.author} · `}
                                      {place.recentReview.timeDescription}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No ratings available</p>
                            )}

                            {/* Hours */}
                            {place.weekdayHours.length > 0 && (
                              <>
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider pt-2">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  Business Hours
                                </h4>
                                <div className="space-y-0.5">
                                  {place.weekdayHours.map((h, i) => (
                                    <p key={i} className="text-xs text-muted-foreground">{h}</p>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Lead Score Breakdown */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Lead Score Breakdown</h4>
                            <div className="flex items-center gap-2 mb-2">
                              <LeadScoreBadge label={place.leadLabel} score={place.leadScore} />
                            </div>
                            <ScoreBreakdownView breakdown={place.scoreBreakdown} />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </>
        )}

        {/* Initial state */}
        {!searched && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Search className="h-8 w-8 text-primary/50" />
              </div>
              <p className="text-lg font-medium">Find your next leads</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Select industries and enter a location to discover fleet management prospects for Skye.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
