import { Papicons } from "@getpapillon/papicons";
import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { t } from "i18next";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getHomeworkRouteId, getHomeworksFromCache, getWeekNumberFromDate } from "@/database/useHomework";
import { getNewsRouteId, useNews } from "@/database/useNews";
import type { Homework } from "@/services/shared/homework";
import type { News } from "@/services/shared/news";
import Avatar from "@/ui/components/Avatar";
import Icon from "@/ui/components/Icon";
import Search from "@/ui/components/Search";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import { getInitials } from "@/utils/chats/initials";
import { getProfileColorByName } from "@/utils/chats/colors";
import { getSubjectColor } from "@/utils/subjects/colors";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectName } from "@/utils/subjects/name";
import { formatHTML } from "@/utils/format/html";

const normalize = (value: string) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const stripHtml = (html: string) => {
  try {
    return formatHTML(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return String(html ?? "");
  }
};

export default function SearchView() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [query, setQuery] = useState("");
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const news = useNews();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = getWeekNumberFromDate(new Date());
        const weeks = [current - 1, current, current + 1, current + 2];
        const chunks = await Promise.all(weeks.map(w => getHomeworksFromCache(w).catch(() => [] as Homework[])));
        const merged = new Map<string, Homework>();
        for (const list of chunks) {
          for (const hw of list) {
            const key = getHomeworkRouteId(hw);
            if (!merged.has(key)) merged.set(key, hw);
          }
        }
        if (!cancelled) setHomeworks(Array.from(merged.values()));
      } catch {
        if (!cancelled) setHomeworks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = normalize(query.trim());

  const matchedHomeworks = useMemo(() => {
    if (q.length < 2) return [];
    return homeworks
      .filter(hw => {
        const content = normalize(stripHtml(hw.content));
        const subject = normalize(hw.subject);
        const subjectName = normalize(getSubjectName(hw.subject));
        return content.includes(q) || subject.includes(q) || subjectName.includes(q);
      })
      .slice(0, 10);
  }, [homeworks, q]);

  const matchedNews = useMemo(() => {
    if (q.length < 2) return [];
    return (news as News[])
      .filter(item => {
        const title = normalize(item.title ?? "");
        const content = normalize(stripHtml(item.content ?? ""));
        const author = normalize(item.author ?? "");
        return title.includes(q) || content.includes(q) || author.includes(q);
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);
  }, [news, q]);

  const matchedSubjects = useMemo(() => {
    if (q.length < 2) return [];
    const seen = new Map<string, string>();
    for (const hw of homeworks) {
      const display = getSubjectName(hw.subject);
      if (normalize(display).includes(q) || normalize(hw.subject).includes(q)) {
        if (!seen.has(display)) seen.set(display, hw.subject);
      }
    }
    return Array.from(seen.entries()).slice(0, 6);
  }, [homeworks, q]);

  const hasQuery = q.length >= 2;
  const isEmpty = matchedHomeworks.length === 0 && matchedNews.length === 0 && matchedSubjects.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <TabHeader
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            leading={t("Tab_Search")}
            subtitle={hasQuery ? `${matchedHomeworks.length + matchedNews.length + matchedSubjects.length}` : undefined}
          />
        }
        bottom={
          <Search
            placeholder={t("Search_Placeholder")}
            color={String(theme.colors.primary)}
            onTextChange={setQuery}
          />
        }
      />

      <List
        contentContainerStyle={{
          paddingTop: headerHeight + 8,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
      >
        {!hasQuery ? (
          <List.Section>
            <List.Item>
              <List.Leading>
                <Icon opacity={0.5}>
                  <Papicons name="Search" />
                </Icon>
              </List.Leading>
              <Typography variant="title">{t("Search_Empty_Title")}</Typography>
              <Typography color="textSecondary" numberOfLines={3}>
                {t("Search_Empty_Description")}
              </Typography>
            </List.Item>
          </List.Section>
        ) : isEmpty ? (
          <List.Section>
            <List.Item>
              <List.Leading>
                <Icon opacity={0.5}>
                  <Papicons name="Search" />
                </Icon>
              </List.Leading>
              <Typography variant="title">{t("Search_NoResults_Title")}</Typography>
              <Typography color="textSecondary" numberOfLines={3}>
                {t("Search_NoResults_Description", { query: query.trim() })}
              </Typography>
            </List.Item>
          </List.Section>
        ) : (
          <>
            {matchedSubjects.length > 0 && (
              <List.Section>
                <List.SectionTitle>
                  <List.Label>{t("Search_Section_Subjects")}</List.Label>
                </List.SectionTitle>
                {matchedSubjects.map(([display, raw]) => (
                  <List.Item
                    key={`subject-${display}`}
                    onPress={() => router.push("/(tabs)/grades")}
                  >
                    <List.Leading>
                      <Avatar
                        size={40}
                        initials={getSubjectEmoji(raw) || getInitials(display)}
                        color={getSubjectColor(raw)}
                        shape="circle"
                      />
                    </List.Leading>
                    <Typography variant="title" numberOfLines={1}>
                      {display}
                    </Typography>
                    <Typography color="textSecondary" numberOfLines={1}>
                      {raw !== display ? raw : t("Search_Section_Subjects")}
                    </Typography>
                    <List.Trailing>
                      <Papicons name="ChevronRight" size={20} opacity={0.5} />
                    </List.Trailing>
                  </List.Item>
                ))}
              </List.Section>
            )}

            {matchedHomeworks.length > 0 && (
              <List.Section>
                <List.SectionTitle>
                  <List.Label>{t("Search_Section_Homework")}</List.Label>
                </List.SectionTitle>
                {matchedHomeworks.map(hw => (
                  <List.Item
                    key={getHomeworkRouteId(hw)}
                    href={{
                      pathname: "/(tabs)/tasks/[id]",
                      params: { id: getHomeworkRouteId(hw) },
                    }}
                  >
                    <List.Leading>
                      <Avatar
                        size={40}
                        initials={getSubjectEmoji(hw.subject) || getInitials(getSubjectName(hw.subject))}
                        color={getSubjectColor(hw.subject)}
                        shape="circle"
                      />
                    </List.Leading>
                    <Typography variant="title" numberOfLines={1}>
                      {getSubjectName(hw.subject)}
                    </Typography>
                    <Typography color="textSecondary" numberOfLines={2}>
                      {stripHtml(hw.content).slice(0, 120)}
                    </Typography>
                    <List.Trailing>
                      <Papicons name="ChevronRight" size={20} opacity={0.5} />
                    </List.Trailing>
                  </List.Item>
                ))}
              </List.Section>
            )}

            {matchedNews.length > 0 && (
              <List.Section>
                <List.SectionTitle>
                  <List.Label>{t("Search_Section_News")}</List.Label>
                </List.SectionTitle>
                {matchedNews.map(item => (
                  <List.Item
                    key={item.id}
                    href={{
                      pathname: "/(features)/(news)/specific",
                      params: { id: getNewsRouteId(item) },
                    }}
                  >
                    <List.Leading>
                      <Avatar
                        size={40}
                        initials={getInitials(item.author || item.title || "?")}
                        color={getProfileColorByName(item.author || "")}
                      />
                    </List.Leading>
                    <Typography variant="title" numberOfLines={2}>
                      {item.title}
                    </Typography>
                    <Typography variant="body1" color="textSecondary" numberOfLines={2}>
                      {stripHtml(item.content ?? "").slice(0, 100)}
                    </Typography>
                    <List.Trailing>
                      <Papicons name="ChevronRight" size={20} opacity={0.5} />
                    </List.Trailing>
                  </List.Item>
                ))}
              </List.Section>
            )}
          </>
        )}
      </List>
    </View>
  );
}
