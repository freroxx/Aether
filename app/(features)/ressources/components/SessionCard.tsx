import { Papicons } from "@getpapillon/papicons";
import { t } from "i18next";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "expo-router/react-navigation";

import { hapticFor } from "@/utils/haptics";
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
    const [filesOpen, setFilesOpen] = useState(false);
    const longBody = content.body.length > 180;
    const fileCount = content.attachments.length;
    return (
      <View style={{ gap: 6 }}>
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
              numberOfLines={expanded ? undefined : 2}
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
        {fileCount > 0 && (
          <View style={{ gap: 2 }}>
            <Pressable
              onPress={() => {
                void hapticFor("selection");
                setFilesOpen((v) => !v);
              }}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 8,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
            >
              <Typography
                variant="body1"
                weight="bold"
                style={{ color: RESSOURCES_ACCENT, flex: 1 }}
                numberOfLines={1}
              >
                {t("Ressources_Attachments", "{{count}} pièces jointes", {
                  count: fileCount,
                })}
              </Typography>
              <View
                style={{
                  transform: [{ rotate: filesOpen ? "90deg" : "0deg" }],
                }}
              >
                <Papicons
                  name="chevronright"
                  size={16}
                  color={String(RESSOURCES_ACCENT)}
                />
              </View>
            </Pressable>
            {filesOpen &&
              content.attachments.map((a, aIdx) => {
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
    const subLine = [session.room, session.teacher]
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(" · ");
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          gap: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: `${session.color}1F`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16 }}>{session.emoji}</Text>
          </View>
          <Typography
            variant="title"
            weight="bold"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {session.pretty}
          </Typography>
          {session.slot ? (
            <Typography variant="caption" color="secondary" numberOfLines={1}>
              {session.slot}
            </Typography>
          ) : null}
        </View>
        {subLine ? (
          <Typography variant="caption" color="secondary" numberOfLines={1}>
            {subLine}
          </Typography>
        ) : null}
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
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={t(
              "Ressources_SeeHomework",
              "Voir le travail à faire"
            )}
          >
            <Typography
              variant="body1"
              weight="bold"
              color="primary"
              numberOfLines={1}
            >
              {t("Ressources_SeeHomeworkArrow", "Voir le travail à faire →")}
            </Typography>
          </Pressable>
        ) : null}
      </View>
    );
  }
);

SessionCard.displayName = "SessionCard";

export default SessionCard;
