import { Papicons } from "@getpapillon/papicons";
import { t } from "i18next";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "expo-router/react-navigation";

import { hapticFor } from "@/utils/haptics";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";

import type {
  BuiltAttachment,
  BuiltContent,
  SessionItem,
} from "../hooks/useRessourcesData";
import AttachmentRow from "./AttachmentRow";

export const RESSOURCES_ACCENT = "#29947A";

interface SessionCardProps {
  session: SessionItem;
  downloadingKey: string | null;
  onOpenFile: (attachment: BuiltAttachment, dueDate: Date) => void;
  onOpenHomework: (routeId: string) => void;
}

const BODY_PREVIEW_LINES = 3;

const ChapterBlock = React.memo(
  ({
    content,
    sessionFrom,
    downloadingKey,
    onOpenFile,
  }: {
    content: BuiltContent;
    sessionFrom: Date;
    downloadingKey: string | null;
    onOpenFile: SessionCardProps["onOpenFile"];
  }) => {
    const [expanded, setExpanded] = useState(false);
    const longBody =
      content.body.length > 220 || content.attachments.length > 2;
    return (
      <View style={{ gap: 6 }}>
        {content.theme ? (
          <View style={{ flexDirection: "row" }}>
            <View
              style={{
                backgroundColor: `${RESSOURCES_ACCENT}1A`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 300,
              }}
            >
              <Typography
                variant="caption"
                weight="bold"
                style={{
                  color: RESSOURCES_ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
                numberOfLines={1}
              >
                {content.theme}
              </Typography>
            </View>
          </View>
        ) : null}
        {content.title ? (
          <Typography variant="title" weight="bold" numberOfLines={2}>
            {content.title}
          </Typography>
        ) : null}
        {content.body ? (
          <>
            <Typography
              variant="body1"
              color="secondary"
              numberOfLines={expanded ? undefined : BODY_PREVIEW_LINES}
            >
              {content.body}
            </Typography>
            {longBody && (
              <Pressable
                onPress={() => {
                  void hapticFor("selection");
                  setExpanded((v) => !v);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Typography variant="caption" weight="bold" color="primary">
                  {expanded
                    ? t("Ressources_ReadLess", "Lire moins")
                    : t("Ressources_ReadMore", "Lire plus")}
                </Typography>
              </Pressable>
            )}
          </>
        ) : null}
        {content.attachments.length > 0 && (
          <View style={{ gap: 2 }}>
            {content.attachments.map((a, aIdx) => {
              const key = `${a.name ?? ""}-${a.url ?? ""}`;
              return (
                <AttachmentRow
                  key={`${key}-${aIdx}`}
                  attachment={a}
                  downloading={downloadingKey === key}
                  onOpen={(att) => onOpenFile(att, sessionFrom)}
                />
              );
            })}
          </View>
        )}
      </View>
    );
  }
);

ChapterBlock.displayName = "ChapterBlock";

const SessionCard = React.memo(
  ({
    session,
    downloadingKey,
    onOpenFile,
    onOpenHomework,
  }: SessionCardProps) => {
    const { colors } = useTheme();
    const metaLine = [session.slot, session.room, session.teacher]
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(" · ");
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 14,
          paddingLeft: 16,
          gap: 10,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: session.color,
          }}
        />
        <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: `${session.color}1F`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 24 }}>{session.emoji}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="title" weight="bold" numberOfLines={1}>
              {session.pretty}
            </Typography>
            {session.meta ? (
              <Typography variant="caption" color="secondary" numberOfLines={1}>
                {session.meta}
              </Typography>
            ) : null}
          </View>
          {session.fileCount > 0 && (
            <View
              style={{
                backgroundColor: `${session.color}1A`,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 20,
              }}
            >
              <Typography variant="caption" weight="bold">
                {t("Home_LessonContent_Files", "{{count}} fichiers", {
                  count: session.fileCount,
                })}
              </Typography>
            </View>
          )}
        </Stack>
        {session.contents.map((content, cIdx) => (
          <ChapterBlock
            key={cIdx}
            content={content}
            sessionFrom={session.from}
            downloadingKey={downloadingKey}
            onOpenFile={onOpenFile}
          />
        ))}
        {session.homeworkRouteId ? (
          <Pressable
            onPress={() => {
              void hapticFor("selection");
              onOpenHomework(session.homeworkRouteId as string);
            }}
            style={({ pressed }) => [
              {
                marginTop: 2,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: `${RESSOURCES_ACCENT}1A`,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t(
              "Ressources_SeeHomework",
              "Voir le travail à faire"
            )}
          >
            <Papicons name="tasks" size={18} color={RESSOURCES_ACCENT} />
            <Typography
              variant="button"
              style={{ color: RESSOURCES_ACCENT, flex: 1 }}
              numberOfLines={1}
            >
              {t("Ressources_SeeHomework", "Voir le travail à faire")}
            </Typography>
            <Papicons
              name="chevronright"
              size={18}
              color={RESSOURCES_ACCENT}
            />
          </Pressable>
        ) : null}
      </View>
    );
  }
);

SessionCard.displayName = "SessionCard";

export default SessionCard;
