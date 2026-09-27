import { useEffect, useMemo, useState } from "react";

import type { DaySection } from "./useRessourcesData";

const normHay = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Filtres Contenus et ressources : recherche debounced (200 ms),
 *  matière, thème, jours repliables. */
export function useRessourcesFilters(sections: DaySection[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(searchTerm.trim()),
      200
    );
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const toggleGroup = (id: string) =>
    setCollapsedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );

  const filtered = useMemo(() => {
    const q = normHay(debouncedSearch);
    return sections
      .map((section) => ({
        ...section,
        lessons: section.lessons.filter((lesson) => {
          if (
            selectedSubject !== "all" &&
            lesson.subjectKey !== selectedSubject
          ) {
            return false;
          }
          if (selectedTheme !== "all") {
            const hasTheme = lesson.contents.some(
              (r) => r.theme === selectedTheme
            );
            if (!hasTheme) return false;
          }
          if (q.length > 0 && !lesson.searchHay.includes(q)) return false;
          return true;
        }),
      }))
      .filter((s) => s.lessons.length > 0);
  }, [sections, debouncedSearch, selectedSubject, selectedTheme]);

  const isFiltering =
    debouncedSearch.trim().length > 0 ||
    selectedSubject !== "all" ||
    selectedTheme !== "all";

  return {
    searchTerm,
    setSearchTerm,
    selectedSubject,
    setSelectedSubject,
    selectedTheme,
    setSelectedTheme,
    collapsedGroups,
    toggleGroup,
    filtered,
    isFiltering,
  };
}
