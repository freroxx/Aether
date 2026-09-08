import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { t } from "i18next";
import React, { useEffect, useState } from "react";

import ModalOverhead from "@/components/ModalOverhead";
import { getHomeworkById, updateHomeworkIsDone } from "@/database/useHomework";
import { getManager } from "@/services/shared";
import { AttachmentType } from "@/services/shared/attachment";
import AnimatedPressable from "@/ui/components/AnimatedPressable";
import { useAlert } from "@/ui/components/AlertProvider";
import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import { formatHTML } from "@/utils/format/html";
import { getAttachmentIcon } from "@/utils/news/getAttachmentIcon";
import { getSubjectColor } from "@/utils/subjects/colors";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectName } from "@/utils/subjects/name";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import { Homework } from "@/services/shared/homework";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import { View } from "react-native";

const Task = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const colors = theme.colors;
  const alert = useAlert();
  const [task, setTask] = useState<Homework>();
  const [loading, setLoading] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHomeworkById(id)
      .then(result => {
        if (!cancelled) {
          setTask(result);
          setIsDone(result?.isDone ?? false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const formatedTask = formatHTML(task?.content ?? "")

  const subjectInfo = {
    color: getSubjectColor(task?.subject ?? ""),
    emoji: getSubjectEmoji(task?.subject ?? ""),
    name: getSubjectName(task?.subject ?? "")
  }

  const setAsDone = async (done: boolean) => {
    const manager = getManager();
    if (!task || toggling) return;
    const previous = isDone;
    setIsDone(done);
    setToggling(true);
    try {
      await manager?.setHomeworkCompletion(task, done);
      await updateHomeworkIsDone(id, done);
    } catch (err) {
      setIsDone(previous);
      try {
        await updateHomeworkIsDone(id, previous);
      } catch {
        // best-effort rollback
      }
      const message = String((err as Error)?.message ?? err);
      const outOfRange =
        message.includes("404") ||
        message.toLowerCase().includes("introuvable") ||
        message.toLowerCase().includes("hors p\u00e9riode");
      alert.showAlert({
        title: t("Task_ToggleFailed_Title"),
        description: outOfRange ? t("Task_OutOfPeriod") : t("Task_ToggleFailed_Description"),
        icon: "AlertTriangle",
        color: "#D60046",
        technical: message,
        delay: 4000,
      });
    } finally {
      setToggling(false);
    }
  }

  const insets = useSafeAreaInsets();
  const finalHeaderHeight = Platform.select({
    android: insets.top + 32,
    default: 0
  });

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View>;
  }

  if (!task) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Typography variant="title">{t("Tab_Tasks")}</Typography></View>;
  }

  return (
    <>
      {Platform.OS !== "android" && (
        <LinearGradient
          colors={[subjectInfo.color, `${subjectInfo.color}00`]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 300,
            width: "100%",
            zIndex: -9,
            opacity: 0.4,
          }}
        />
      )}

      <List
        ListHeaderComponent={
          <ModalOverhead
            emoji={subjectInfo.emoji}
            subject={subjectInfo.name}
            subjectVariant="header"
            color={Platform.OS === "ios" ? subjectInfo.color : colors.primary}
            date={new Date(task.dueDate)}
            style={{
              marginVertical: 24,
              paddingTop: finalHeaderHeight,
            }}
          />
        }
        style={{
          backgroundColor: "transparent",
        }}
        contentContainerStyle={{
          padding: 16,
        }}
      >
        <List.Section>
          <List.SectionTitle>
            <List.Label>{t("Modal_Task_Status")}</List.Label>
          </List.SectionTitle>

          <List.Item>
            <List.Leading>
              <AnimatedPressable onPress={() => setAsDone(!isDone)}>
                <Stack
                  backgroundColor={
                    isDone
                      ? Platform.OS === "ios"
                        ? subjectInfo.color
                        : theme.colors.primary
                      : theme.colors.card
                  }
                  card
                  radius={100}
                  width={28}
                  height={28}
                  vAlign="center"
                  hAlign="center"
                >
                  {isDone && <Papicons name="check" size={22} color="white" />}
                </Stack>
              </AnimatedPressable>
            </List.Leading>
            <Typography variant="title">
              {isDone ? t("Task_Done") : t("Task_Undone")}
            </Typography>
          </List.Item>
        </List.Section>

        <List.Section>
          <List.SectionTitle>
            <List.Label>{t("Modal_Task_Description")}</List.Label>
          </List.SectionTitle>

          <List.Item>
            <Typography>{formatedTask}</Typography>
          </List.Item>
        </List.Section>
        {task.attachments.length > 0 && (
          <List.Section>
            <List.SectionTitle>
              <List.Label>{t("Modal_Task_Attachments")}</List.Label>
            </List.SectionTitle>

            {task.attachments.map(attachment => {
              const rawType = (attachment as { type?: unknown }).type;
              const isLink =
                rawType === AttachmentType.LINK ||
                rawType === 0 ||
                rawType === "link" ||
                rawType === "LINK";
              const url = attachment.url ?? "";
              const canOpenLink = isLink && url.length > 0;
              return (
                <List.Item
                  key={`${attachment.name}-${url}`}
                  onPress={
                    canOpenLink
                      ? () => WebBrowser.openBrowserAsync(url)
                      : undefined
                  }
                >
                  <List.Leading>
                    <Icon>
                      <Papicons name={getAttachmentIcon(attachment)} />
                    </Icon>
                  </List.Leading>
                  <Typography variant="title" numberOfLines={1}>
                    {attachment.name || url}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="textSecondary"
                    numberOfLines={1}
                  >
                    {url}
                  </Typography>
                </List.Item>
              );
            })}
          </List.Section>
        )}
      </List>
    </>
  );
};
export default Task;
