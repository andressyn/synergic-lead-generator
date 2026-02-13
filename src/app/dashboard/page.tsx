"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

// -- Helper components --

function LeadScoreBadge({ label }: { label: "Hot" | "Warm" | "Cold" }) {
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
      {label}
    </Badge>
  );
}

function SkeletonResults() {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Skeleton className="h-4 w-4" /></TableHead>
                <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                <TableHead className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableHead>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-8 w-44" /></TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Main component --

export default function DashboardPage() {
  const router = useRouter();
  const [industry, setIndustry] = useState("both");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
      const industries: string[] = [];
      if (industry === "moving" || industry === "both") industries.push("moving");
      if (industry === "warehouse" || industry === "both") industries.push("warehouse");

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: location.trim(), industries }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch {
      console.error("Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
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
      "Name", "Lead Score", "Business Type", "Address", "Phone",
      "Rating", "Reviews", "Website", "Google Maps", "Description",
    ];
    const rows = data.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.leadLabel,
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
    doc.text(
      `Location: ${location} | Industry: ${industry} | ${data.length} leads`,
      14,
      22
    );

    autoTable(doc, {
      startY: 28,
      head: [["Lead", "Name", "Type", "Phone", "Rating", "Reviews", "Website"]],
      body: data.map((p) => [
        p.leadLabel,
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
        "Name", "Lead Score", "Business Type", "Address", "Phone",
        "Rating", "Reviews", "Website", "Google Maps", "Description",
      ],
      ...data.map((p) => [
        p.name,
        p.leadLabel,
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
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-[#482aff] sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/synergic-logo-white.svg"
            alt="Synergic"
            width={140}
            height={44}
          />
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
      </header>

      <main className="container mx-auto p-4 space-y-6 mt-2">
        {/* Search Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search Leads
            </CardTitle>
            <CardDescription>
              Find moving and warehouse companies by location. Results are scored and ranked by lead quality.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              {/* Location with autocomplete */}
              <div className="space-y-2 flex-1 relative" ref={wrapperRef}>
                <Label htmlFor="location">Location</Label>
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
              <div className="space-y-2 w-full sm:w-52">
                <Label>Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Industries</SelectItem>
                    <SelectItem value="moving">Moving Companies</SelectItem>
                    <SelectItem value="warehouse">Warehouse Companies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={loading} className="gap-2">
                  <Search className="h-4 w-4" />
                  {loading ? "Searching..." : "Search"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Loading skeleton */}
        {searched && loading && <SkeletonResults />}

        {/* Empty state */}
        {searched && !loading && results.length === 0 && (
          <Card className="animate-fade-in">
            <CardContent className="py-16">
              <div className="text-center space-y-3">
                <Search className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-lg font-medium">No leads found</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Try broadening your search with a larger area (e.g. a state instead of a city)
                  or switch to &quot;Both Industries&quot; for more results.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {searched && !loading && results.length > 0 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle>Results</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {results.length} leads
                    </Badge>
                    {selected.size > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {selected.size} selected
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-green-600">
                      <Flame className="h-3 w-3" /> {hotCount} Hot
                    </span>
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Sun className="h-3 w-3" /> {warmCount} Warm
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                      <Snowflake className="h-3 w-3" /> {coldCount} Cold
                    </span>
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selected.size === results.length && results.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-20">Lead</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="hidden lg:table-cell">Review</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((place) => (
                      <TableRow key={place.id} className="group">
                        <TableCell>
                          <Checkbox
                            checked={selected.has(place.id)}
                            onCheckedChange={() => toggleSelect(place.id)}
                          />
                        </TableCell>

                        {/* Lead score */}
                        <TableCell>
                          <LeadScoreBadge label={place.leadLabel} />
                        </TableCell>

                        {/* Company info */}
                        <TableCell className="max-w-[280px]">
                          <div className="space-y-0.5">
                            <p className="font-medium truncate">{place.name}</p>
                            {place.businessType && (
                              <p className="text-xs text-muted-foreground">{place.businessType}</p>
                            )}
                            {place.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {place.description}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Contact */}
                        <TableCell>
                          <div className="space-y-1">
                            {place.phone ? (
                              <a
                                href={`tel:${place.phone}`}
                                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline whitespace-nowrap"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                {place.phone}
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">No phone</span>
                            )}
                            {place.website && (
                              <a
                                href={place.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Website
                              </a>
                            )}
                          </div>
                        </TableCell>

                        {/* Rating */}
                        <TableCell>
                          {place.rating ? (
                            <div className="flex items-center gap-1.5">
                              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm font-medium">{place.rating}</span>
                              <span className="text-xs text-muted-foreground">
                                ({place.userRatingsTotal})
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </TableCell>

                        {/* Review snippet */}
                        <TableCell className="hidden lg:table-cell max-w-[220px]">
                          {place.recentReview && place.recentReview.text ? (
                            <div className="space-y-0.5">
                              <p className="text-xs text-muted-foreground line-clamp-2 italic">
                                &quot;{place.recentReview.text}&quot;
                              </p>
                              <p className="text-[10px] text-muted-foreground/70">
                                {place.recentReview.author && `${place.recentReview.author} · `}
                                {place.recentReview.timeDescription}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No reviews</span>
                          )}
                        </TableCell>

                        {/* Location */}
                        <TableCell className="max-w-[200px]">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground truncate">
                              {place.address}
                            </p>
                            <a
                              href={place.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <MapPin className="h-3 w-3" />
                              View Map
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
