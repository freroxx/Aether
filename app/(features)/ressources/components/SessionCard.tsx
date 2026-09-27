import { Papicons } from "@getpapillon/papicons";
import { t } from "i18next";
import React from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "expo-router/react-navigation";

import ActivityIndicator from "@/ui/components/ActivityIndicator";
import Icon from "@/ui/components/Icon";
import Typography from "@/ui/components/Typography";
import { getAttachmentIcon } from "@/utils/news/getAttachmentIcon";

import type { BuiltAttachment, SessionItem } from "../hooks/useRessourcesData";

export const RESSOURCES_ACCENT = "#29947A";

interface SessionCardProps {
  session: SessionItem;
  downloadingKey: string | null;
  onOpenFile: (attachment: BuiltAttachment, dueDate: Date) => void;
  onOpenHomework: (routeId: string) => void;
}

const SessionCard = React.memo(
  ({ session, downloadingKey, onOpenFile, onOpenHomework }: SessionCardProps) => {
    const { colors } = useTheme();
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 14,
          gap: 8,
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
        <Typography variant="title" weight="bold" numberOfLines={1}>
          {session.emoji} {session.pretty}
        </Typography>
        <Typography variant="caption" color="secondary" numberOfLines={1}>
          {session.slot}
          {session.room ? ` · ${session.room}` : ""}
          {session.teacher ? ` · ${session.teacher}` : ""}
        </Typography>
        {session.contents.map((content, cIdx) => (
          <View key={cIdx} style={{ gap: 4 }}>
            {content.theme ? (
              <Typography variant="caption" color="secondary">
                {content.theme}
              </Typography>
            ) : null}
            {content.title ? (
              <Typography variant="title" numberOfLines={2}>
                {content.title}
              </Typography>
            ) : null}
            {content.body ? (
              <Typography variant="body1" color="secondary" numberOfLines={4}>
                {content.body}
              </Typography>
            ) : null}
            {content.attachments.map((a, aIdx) => {
              const key = `${a.name ?? ""}-${a.url ?? ""}`;
              return (
                <Pressable
                  key={aIdx}
                  onPress={() => onOpenFile(a, session.from)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 6,
                  }}
                >
                  <Icon>
                    <Papicons name={getAttachmentIcon(a as never)} />
                  </Icon>
                  <Typography
                    variant="body1"
                    numberOfLines={1}
                    style={{ flex: 1 }}
                  >
                    {a.name || a.url}
                  </Typography>
                  {downloadingKey === key && <ActivityIndicator size={18} />}
                </Pressable>
              );
            })}
          </View>
        ))}
        {session.homeworkRouteId ? (
          <Pressable
            onPress={() => onOpenHomework(session.homeworkRouteId as string)}
            style={{
              marginTop: 4,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: `${RESSOURCES_ACCENT}1A`,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            accessibilityLabel={t(
              "Ressources_SeeHomework",
              "Voir le travail à faire"
            )}
          >
            <Papicons
              name="tasks"
              size={18}
              color={RESSOURCES_ACCENT}
            />
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
