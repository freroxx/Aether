import ModalOverhead, { ModalOverHeadScore } from "@/components/ModalOverhead";
import Subject from "@/database/models/Subject";
import Stack from "@/ui/components/Stack";
import TypographyLegacy from "@/ui/components/Typography";
import { getSubjectColor } from "@/utils/subjects/colors";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectName } from "@/utils/subjects/name";
import { Papicons } from "@getpapillon/papicons";
import { useRoute, useTheme } from "expo-router/react-navigation";
import React, { useMemo } from "react";
import { Platform, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { colorCheck } from '@/utils/colorCheck';
import adjust from "@/utils/adjustColor";
import i18n from "@/utils/i18n";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import Icon from "@/ui/components/Icon";
import { useSettingsStore } from "@/stores/settings";
import { formatScoreForDisplay, getGradeDisplayScale } from "@/utils/grades/scale";
import { getSubjectAverage } from "@/utils/grades/algorithms/subject";
import { Grade, GradeScore } from "@/services/shared/grade";

const SubjectInfo = () => {
  const { params } = useRoute();
  const theme = useTheme();
  const colors = theme.colors;

  const subject: Subject = params?.subject;
  // Garde-fous : le sujet peut arriver incomplet (moyennes jamais calculées
  // côté Pronote) → jamais de crash ni de dénominateur vide, "—" sinon.
  const studentAverage = (subject?.studentAverage ?? { disabled: true, status: "—" }) as GradeScore;
  const subjectOutOf = (subject?.outOf ?? { value: 20 }) as GradeScore;
  const classAverage = (subject?.classAverage ?? { disabled: true, status: "—" }) as GradeScore;
  const subjectMaximum = (subject?.maximum ?? { disabled: true, status: "—" }) as GradeScore;
  const subjectMinimum = (subject?.minimum ?? { disabled: true, status: "—" }) as GradeScore;
  const subjectGrades = subject?.grades ?? [];
  const displayScale = getGradeDisplayScale(useSettingsStore(state => state.personalization.gradesDisplayScale));
  const subjectColor = getSubjectColor(subject?.name);
  const subjectName = getSubjectName(subject?.name);
  const subjectEmoji = getSubjectEmoji(subject?.name);

  const displayedSubjectAverage = useMemo(() => {
    return formatScoreForDisplay(studentAverage.value, subjectOutOf.value, displayScale);
  }, [studentAverage.value, subjectOutOf.value, displayScale]);
  const displayedDenominator = useMemo(() => {
    return formatScoreForDisplay(0, subjectOutOf.value, displayScale).denominator;
  }, [subjectOutOf.value, displayScale]);
  const computedSubjectAverage = useMemo(() => {
    const computedSubjectAverageValue = getSubjectAverage(subjectGrades as unknown as Grade[]);
    if (computedSubjectAverageValue === -1) {
      return null;
    }
    return formatScoreForDisplay(computedSubjectAverageValue, subjectOutOf.value, displayScale);
  }, [subjectGrades, subjectOutOf.value, displayScale]);
  const isUnknownSubjectAverage = useMemo(() => {
    return studentAverage.disabled
      && String(studentAverage.status ?? "").trim().toLowerCase() === "unknown";
  }, [studentAverage.disabled, studentAverage.status]);
  const fallbackDisplayedDenominator = useMemo(() => {
    return isUnknownSubjectAverage && computedSubjectAverage
      ? computedSubjectAverage.denominator
      : displayedDenominator;
  }, [isUnknownSubjectAverage, computedSubjectAverage, displayedDenominator]);
  const fallbackOutOf = useMemo(() => {
    return fallbackDisplayedDenominator.startsWith("/")
      ? fallbackDisplayedDenominator.slice(1)
      : fallbackDisplayedDenominator;
  }, [fallbackDisplayedDenominator]);

  const averagesData = [
    {
      title: i18n.t("SubjectInfo_ClassAverage_Label"),
      subtitle: i18n.t("SubjectInfo_ClassAverage_Description"),
      disabled: classAverage.disabled,
      value: formatScoreForDisplay(classAverage.value, subjectOutOf.value, displayScale).value,
      status: classAverage.status,
      icon: "GraduationHat",
    },
    {
      title: i18n.t("SubjectInfo_MaxAverage_Label"),
      subtitle: i18n.t("SubjectInfo_MaxAverage_Description"),
      disabled: subjectMaximum.disabled,
      value: formatScoreForDisplay(subjectMaximum.value, subjectOutOf.value, displayScale).value,
      status: subjectMaximum.status,
      icon: "ArrowRightUp",
    },
    {
      title: i18n.t("SubjectInfo_MinAverage_Label"),
      subtitle: i18n.t("SubjectInfo_MinAverage_Description"),
      disabled: subjectMinimum.disabled,
      value: formatScoreForDisplay(subjectMinimum.value, subjectOutOf.value, displayScale).value,
      status: subjectMinimum.status,
      icon: "Minus",
    }
  ]

  return (
    <>
      {Platform.OS !== "android" && (
        <LinearGradient
          colors={[subjectColor, colors.background]}
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
        contentInsetAdjustmentBehavior="automatic"
        engine="FlashList"
        ListHeaderComponent={
          <View style={{ marginBottom: 24, alignItems: "center" }}>
            <ModalOverhead
              subject={subjectName}
              color={Platform.OS === "ios" ? subjectColor : colors.primary}
              emoji={subjectEmoji}
              overtitle={i18n.t("Grades_SubjectInfo_NbGrades", {
                number: subject.grades.length,
              })}
              overhead={
                <ModalOverHeadScore
                  color={Platform.OS === "ios" ? subjectColor : colors.primary}
                  score={
                    studentAverage.disabled
                      ? isUnknownSubjectAverage && computedSubjectAverage
                        ? String(computedSubjectAverage.value.toFixed(2))
                        : String(studentAverage.status ?? "—")
                      : String(displayedSubjectAverage.value.toFixed(2))
                  }
                  outOf={fallbackOutOf}
                />
              }
              style={{
                marginBottom:
                  !studentAverage.disabled &&
                  studentAverage.value === subjectMaximum.value
                    ? 12
                    : 0,
              }}
            />

            {!studentAverage.disabled &&
              studentAverage.value === subjectMaximum.value && (
                <Stack
                  direction="horizontal"
                  gap={8}
                  backgroundColor={adjust(
                    subjectColor,
                    theme.dark ? 0.3 : -0.3
                  )}
                  padding={[12, 6]}
                  radius={32}
                  hAlign="center"
                  vAlign="center"
                >
                  <Papicons
                    size={20}
                    name="crown"
                    color={
                      colorCheck("#FFFFFF", [
                        adjust(subjectColor, theme.dark ? 0.3 : -0.3),
                      ])
                        ? "#FFFFFF"
                        : "#000000"
                    }
                  />
                  <TypographyLegacy
                    color={
                      colorCheck("#FFFFFF", [
                        adjust(subjectColor, theme.dark ? 0.3 : -0.3),
                      ])
                        ? "#FFFFFF"
                        : "#000000"
                    }
                    variant="body2"
                  >
                    {i18n.t("SubjectInfo_MaxAverage_Description")}
                  </TypographyLegacy>
                </Stack>
              )}
          </View>
        }
        contentContainerStyle={{
          padding: 16,
        }}
      >
        <List.Section>
          <List.SectionTitle>
            <List.Label>{i18n.t("SubjectInfo_Stats_Header")}</List.Label>
          </List.SectionTitle>

          {averagesData.map((average, index) => (
            <List.Item>
              <List.Leading>
                <Icon>
                  <Papicons name={average.icon} />
                </Icon>
              </List.Leading>

              <Typography variant="title">{average.title}</Typography>
              <Typography variant="body1" color="textSecondary">
                {average.subtitle}
              </Typography>

              <List.Trailing>
                <Stack
                  gap={2}
                  direction="horizontal"
                  vAlign="center"
                  hAlign="end"
                >
                  <TypographyLegacy variant="header" weight="semibold" inline>
                    {average.disabled
                      ? average.status
                      : average.value.toFixed(2)}
                  </TypographyLegacy>
                  <TypographyLegacy variant="body2" inline color="secondary">
                    {displayedDenominator}
                  </TypographyLegacy>
                </Stack>
              </List.Trailing>
            </List.Item>
          ))}
        </List.Section>
      </List>
    </>
  );
};

export default SubjectInfo;
