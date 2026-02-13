"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
}

export default function DashboardPage() {
  const router = useRouter();
  const [industry, setIndustry] = useState("both");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim()) return;

    setLoading(true);
    setSearched(true);
    setSelected(new Set());

    try {
      const queries: string[] = [];
      if (industry === "moving" || industry === "both") {
        queries.push("moving companies");
      }
      if (industry === "warehouse" || industry === "both") {
        queries.push("warehouse companies");
      }

      const allResults: Place[] = [];

      for (const query of queries) {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `${query} in ${location}` }),
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.ok) {
          const data = await res.json();
          allResults.push(...data.results);
        }
      }

      // Deduplicate by place id
      const unique = Array.from(
        new Map(allResults.map((p) => [p.id, p])).values()
      );
      setResults(unique);
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

  function exportCSV() {
    const data = getSelectedResults();
    if (data.length === 0) return;

    const headers = ["Name", "Address", "Phone", "Rating", "Reviews", "Website", "Google Maps"];
    const rows = data.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.address.replace(/"/g, '""')}"`,
      `"${p.phone}"`,
      p.rating ?? "",
      p.userRatingsTotal ?? "",
      `"${p.website}"`,
      `"${p.mapsUrl}"`,
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
    doc.text(`Location: ${location} | Industry: ${industry} | ${data.length} results`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Name", "Address", "Phone", "Rating", "Reviews", "Website"]],
      body: data.map((p) => [
        p.name,
        p.address,
        p.phone,
        p.rating?.toString() ?? "N/A",
        p.userRatingsTotal?.toString() ?? "N/A",
        p.website || "N/A",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [23, 23, 23] },
    });

    doc.save("leads.pdf");
  }

  async function exportExcel() {
    const data = getSelectedResults();
    if (data.length === 0) return;

    const XLSX = await import("xlsx");
    const wsData = [
      ["Name", "Address", "Phone", "Rating", "Reviews", "Website", "Google Maps"],
      ...data.map((p) => [
        p.name,
        p.address,
        p.phone,
        p.rating ?? "N/A",
        p.userRatingsTotal ?? "N/A",
        p.website || "N/A",
        p.mapsUrl,
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

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">Synergic Lead Generator</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        {/* Search Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Search Leads</CardTitle>
            <CardDescription>
              Find moving and warehouse companies by location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Los Angeles, CA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 w-full sm:w-48">
                <Label>Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="moving">Moving Companies</SelectItem>
                    <SelectItem value="warehouse">Warehouse Companies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={loading}>
                  {loading ? "Searching..." : "Search"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    {results.length} {results.length === 1 ? "lead" : "leads"} found
                    {selected.size > 0 && ` (${selected.size} selected)`}
                  </CardDescription>
                </div>
                {results.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportCSV}>
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportPDF}>
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportExcel}>
                      Excel
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No results found. Try a different location or industry.
                </p>
              ) : (
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
                        <TableHead>Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Map</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((place) => (
                        <TableRow key={place.id}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(place.id)}
                              onCheckedChange={() => toggleSelect(place.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {place.name}
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate text-muted-foreground">
                            {place.address}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {place.phone || "—"}
                          </TableCell>
                          <TableCell>
                            {place.rating ? (
                              <Badge variant="secondary">
                                {place.rating} ({place.userRatingsTotal})
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {place.website ? (
                              <a
                                href={place.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary underline underline-offset-4"
                              >
                                Visit
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <a
                              href={place.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary underline underline-offset-4"
                            >
                              View
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
