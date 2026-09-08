import { Papicons } from '@getpapillon/papicons';
import { useIsFocused } from "expo-router/react-navigation";
import { useRouter } from 'expo-router';
import { t } from 'i18next';
import React from 'react';
import { FlatList, Platform, RefreshControl, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccountStore } from '@/stores/account';
import { useSettingsStore } from '@/stores/settings';

import HomeHeader from './atoms/HomeHeader';
import HomeTopBar from './atoms/HomeTopBar';
import Wallpaper from './atoms/Wallpaper';
import HomeWidget, { HomeWidgetItem } from './components/HomeWidget';
import { useHomeData } from './hooks/useHomeData';
import { useTimetableWidgetData } from './hooks/useTimetableWidgetData';
import { useTimetableWidgetTitle } from './hooks/useTimetableWidgetTitle';
import HomeTimeTableWidget from './widgets/timetable';
import GradesWidget from './widgets/Grades';
import EvaluationsWidget from './widgets/evaluations';
import SanctionsWidget from './widgets/sanctions';
import LessonContentWidget from './widgets/LessonContent';
import MaskedView from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';
import MainTabErrorBoundary from '@/ui/components/MainTabErrorBoundary';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = insets.bottom + 16;
  const focused = useIsFocused();

  // Account
  const store = useAccountStore();
  const accounts = useAccountStore((state) => state.accounts);
  const account = accounts.find(a => a.id === store.lastUsedAccount);
  const router = useRouter();
  const welcomeModalSeen = useSettingsStore(state => state.personalization.welcomeModalSeen);
  const mutateSettings = useSettingsStore(state => state.mutateProperty);

  React.useEffect(() => {
    if (accounts.length === 0) {
      router.replace("/(onboarding)/welcome");
      return;
    }
  }, [account, accounts.length, router, store]);

  const { refresh } = useHomeData();
  const [homeRefreshing, setHomeRefreshing] = React.useState(false);
  const onHomeRefresh = React.useCallback(async () => {
    setHomeRefreshing(true);
    try {
      await refresh();
    } finally {
      setHomeRefreshing(false);
    }
  }, [refresh]);
  const { courses } = useTimetableWidgetData();
  const timetableTitle = useTimetableWidgetTitle(courses);

  const [gradesWidgetHidden, setGradesWidgetHidden] = React.useState(true);
  const [lessonContentHidden, setLessonContentHidden] = React.useState(true);
  const [evaluationsWidgetHidden, setEvaluationsWidgetHidden] = React.useState(true);
  const [sanctionsWidgetHidden, setSanctionsWidgetHidden] = React.useState(true);

  const renderTimeTable = React.useCallback(() => <HomeTimeTableWidget />, []);
  const renderGrades = React.useCallback(
    () => <GradesWidget onEmptyStateChange={setGradesWidgetHidden} />,
    []
  );
  const renderLessonContent = React.useCallback(
    () => <LessonContentWidget onEmptyStateChange={setLessonContentHidden} />,
    []
  );
  const renderEvaluations = React.useCallback(
    () => <EvaluationsWidget onEmptyStateChange={setEvaluationsWidgetHidden} />,
    []
  );
  const renderSanctions = React.useCallback(
    () => <SanctionsWidget onEmptyStateChange={setSanctionsWidgetHidden} />,
    []
  );

  const data: HomeWidgetItem[] = React.useMemo(() => [
    {
      icon: <Papicons name={"Info"} />,
      title: t("Home_Widget_LessonContent", "Contenu et ressources"),
      redirect: "(tabs)/calendar",
      hidden: lessonContentHidden,
      render: renderLessonContent
    },
    {
      icon: <Papicons name={"Calendar"} />,
      title: timetableTitle,
      redirect: "(tabs)/calendar",
      render: renderTimeTable
    },
    {
      icon: <Papicons name={"Grades"} />,
      title: t("Home_Widget_Grades_Average"),
      redirect: "(tabs)/grades",
      hidden: gradesWidgetHidden,
      render: renderGrades
    },
    {
      icon: <Papicons name={"Grades"} />,
      title: t("Home_Evaluations_Title"),
      redirect: "(features)/evaluations",
      hidden: evaluationsWidgetHidden,
      render: renderEvaluations
    },
    {
      icon: <Papicons name={"AlertTriangle"} />,
      title: t("Home_Sanctions_Title"),
      redirect: "(features)/sanctions",
      hidden: sanctionsWidgetHidden,
      render: renderSanctions
    }
  ], [renderTimeTable, renderGrades, renderLessonContent, renderEvaluations, renderSanctions, gradesWidgetHidden, lessonContentHidden, evaluationsWidgetHidden, sanctionsWidgetHidden, timetableTitle]);

  React.useEffect(() => {
    if (!account || welcomeModalSeen) {
      return;
    }

    mutateSettings("personalization", { welcomeModalSeen: true });
    router.navigate("/(modals)/welcome");
  }, [account, mutateSettings, router, welcomeModalSeen]);

  return (
    <>
      <Wallpaper />
      <HomeTopBar />
      {focused && <StatusBar translucent animated barStyle={'light-content'} />}
      <HomeViewContainer key={"home"}>
        <FlatList
          renderItem={({ item }) => <HomeWidget item={item} />}
          keyExtractor={(item) => item.title}
          ListHeaderComponent={<HomeHeader />}
          refreshControl={
            <RefreshControl refreshing={homeRefreshing} onRefresh={onHomeRefresh} />
          }
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: Platform.OS === 'ios' ? bottomTabBarHeight : 16,
            paddingHorizontal: 16,
            flexGrow: 1,
            gap: 12,
            marginTop: 6,
            paddingLeft: insets.left + 16,
            width: '100%',
            maxWidth: 670,
            marginHorizontal: 'auto',
          }}
          data={data}
        />
      </HomeViewContainer>
    </>
  );
};

const HomeViewContainer = ({ children }) => {
  const insets = useSafeAreaInsets();

  return (
    <MaskedView
      maskElement={
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <LinearGradient
            colors={['#ff000022', 'white']}
            locations={[0.5, 1]}
            style={{ height: insets.top + 68 }}
          />
          <View style={{ flex: 1, backgroundColor: 'white' }} />
        </View>
      }
      style={{ flex: 1 }}
    >
      {children}
    </MaskedView>
  )
}

const HomeScreenWithBoundary = () => (
  <MainTabErrorBoundary>
    <HomeScreen />
  </MainTabErrorBoundary>
);

export default HomeScreenWithBoundary;
