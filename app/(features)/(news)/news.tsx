import { purgeOrphanNews, useNews } from '@/database/useNews'
import { getManager, subscribeManagerUpdate } from '@/services/shared'
import Avatar from '@/ui/components/Avatar'
import ChipButton from '@/ui/components/ChipButton'
import { Dynamic } from '@/ui/components/Dynamic'
import Icon from '@/ui/components/Icon'
import Search from '@/ui/components/Search'
import Stack from '@/ui/components/Stack'
import TabHeader from '@/ui/components/TabHeader'
import TabHeaderTitle from '@/ui/components/TabHeaderTitle'
import { useKeyboardHeight } from '@/ui/hooks/useKeyboardHeight'
import List from '@/ui/new/List'
import Typography from '@/ui/new/Typography'
import { AetherAppearIn, AetherAppearOut } from '@/ui/utils/Transition'
import { getProfileColorByName } from '@/utils/chats/colors'
import { getInitials } from '@/utils/chats/initials'
import { warn } from '@/utils/logger/logger'
import { Papicons } from '@getpapillon/papicons'
import { useTheme } from "expo-router/react-navigation"
import { router } from 'expo-router'
import { t } from 'i18next'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { RefreshControl } from 'react-native-gesture-handler'
import Reanimated, { LayoutAnimationConfig, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MainTabErrorBoundary from '@/ui/components/MainTabErrorBoundary'

const NewsView = () => {
  const theme = useTheme()
  const colors = theme.colors
  const insets = useSafeAreaInsets()

  const [headerHeight, setHeaderHeight] = useState(0)
  const bottomTabBarHeight = insets.bottom + 16;

  const [isLoading, setIsLoading] = useState(false)
  const [isManuallyLoading, setIsManuallyLoading] = useState(false)

  const keyboardHeight = useKeyboardHeight()

  const footerStyle = useAnimatedStyle(() => ({
    height: keyboardHeight.value - bottomTabBarHeight,
  }))

  const news = useNews()

  const [unreadOnly, setUnreadOnly] = useState(false)

  const sortedNews = useMemo(() => {
    return [...news].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [news])

  const fetchNews = useCallback(async (onlyUnread?: boolean) => {
    try {
      setIsLoading(true)
      const manager = getManager()
      if (!manager) {
        warn('Manager is null, skipping news fetch')
        return
      }
      await manager.getNews(onlyUnread ? { onlyUnread: true } : undefined)
      // Nettoie les actus orphelines (anciennes démos) en tâche de fond
      purgeOrphanNews().catch(() => {})
    } catch (error) {
      warn(`Error fetching news: ${String(error)}`)
    } finally {
      setIsLoading(false)
      setIsManuallyLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeManagerUpdate(() => {
      void fetchNews(unreadOnly)
    })

    return () => unsubscribe()
  }, [fetchNews, unreadOnly])

  const [searchText, setSearchText] = useState('')

  const filteredNews = useMemo(() => {
    const q = searchText.toLowerCase()
    return sortedNews.filter((item) => {
      if (unreadOnly && item.acknowledged) return false
      return (item.title ?? '').toLowerCase().includes(q)
    })
  }, [sortedNews, searchText, unreadOnly])

  return (
    <>
      <TabHeader
        showAndroidBackButton
        modal
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            color={colors.primary}
            leading={t('Tab_News')}
            chevron={false}
            loading={isLoading}
          />
        }
        bottom={<Search placeholder={t('News_Search_Placeholder')} color='#2B7ED6' onTextChange={(text) => setSearchText(text)} />}
        trailing={
          Platform.OS === 'ios' ? (
            <ChipButton single icon='cross' onPress={() => router.dismiss()} />
          ) : undefined
        }
      />

      <LayoutAnimationConfig skipEntering>
        <List
          animated
          contentContainerStyle={{
            paddingTop: headerHeight,
            paddingBottom: Platform.OS === "android" ? 16 : bottomTabBarHeight + 16,
            paddingHorizontal: 16,
            gap: 9,
            paddingLeft: insets.left + 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isManuallyLoading}
              onRefresh={() => {
                setIsManuallyLoading(true)
                void fetchNews(unreadOnly)
              }}
              progressViewOffset={headerHeight}
            />
          }
          ListHeaderComponent={
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setUnreadOnly(false)}
                hitSlop={8}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: !unreadOnly
                      ? theme.colors.primary
                      : theme.colors.card,
                  },
                ]}
              >
                <Typography
                  variant="caption"
                  weight="bold"
                  style={{ color: !unreadOnly ? "#FFFFFF" : theme.colors.text }}
                >
                  {t("Messages_Filter_All")}
                </Typography>
              </Pressable>
              <Pressable
                onPress={() => setUnreadOnly(true)}
                hitSlop={8}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: unreadOnly
                      ? theme.colors.primary
                      : theme.colors.card,
                  },
                ]}
              >
                <Typography
                  variant="caption"
                  weight="bold"
                  style={{ color: unreadOnly ? "#FFFFFF" : theme.colors.text }}
                >
                  {t("Messages_Filter_Unread")}
                </Typography>
              </Pressable>
            </View>
          }
          ListFooterComponent={<Reanimated.View style={footerStyle} />}
          scrollIndicatorInsets={{ top: headerHeight - insets.top }}
          ListEmptyComponent={
            <Dynamic animated key='empty-list:warn' entering={AetherAppearIn} exiting={AetherAppearOut}>
              <Stack
                hAlign='center'
                vAlign='center'
                flex
                style={{ width: '100%', marginTop: 16 }}
              >
                <Icon opacity={0.5} size={32} style={{ marginBottom: 3 }}>
                  <Papicons name={searchText ? 'Search' : 'Newspaper'} />
                </Icon>
                <Typography variant='h4' color='textPrimary' align='center'>
                  {searchText ? t('News_Search_NoResults') : t('News_Empty_Title')}
                </Typography>
                <Typography variant='body2' color='textSecondary' align='center'>
                  {searchText ? t('News_Search_NoResults_Description') : t('News_Empty_Description')}
                </Typography>
              </Stack>
            </Dynamic>
          }
        >
          {filteredNews.map((item) => {
            const profileColor = getProfileColorByName(item.author)
            const profileInitials = getInitials(item.author)

            return (
              <List.Item
                key={item.id}
                id={item.id}
                href={{ pathname: "/(features)/(news)/specific", params: { id: item.id } }}
              >
                <List.Leading>
                  <Avatar
                    size={40}
                    color={profileColor}
                    initials={profileInitials}
                  />
                </List.Leading>

                <Typography variant='title' numberOfLines={2}>
                  {item.title}
                </Typography>
                {(item.survey || item.question) && (
                  <View style={{ flexDirection: 'row', marginTop: 4, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${String(colors.primary)}1A`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Papicons name='pie' size={12} color={String(colors.primary)} />
                      <Typography variant='caption' weight='bold' style={{ color: colors.primary }}>
                        {t('News_Type_Survey')}
                      </Typography>
                    </View>
                    {item.anonymousResponse && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${String(colors.text)}0F` }}>
                        <Typography variant='caption' color='textSecondary'>
                          {t('News_Type_Anonymous', 'Anonyme')}
                        </Typography>
                      </View>
                    )}
                  </View>
                )}
                {!(item.survey || item.question) && item.anonymousResponse && (
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${String(colors.text)}0F` }}>
                      <Typography variant='caption' color='textSecondary'>
                        {t('News_Type_Anonymous', 'Anonyme')}
                      </Typography>
                    </View>
                  </View>
                )}
                <Typography variant='body1' color='textSecondary' numberOfLines={3}>
                  {item.content ? truncateString(cleanContent(item.content), 100) : ''}
                </Typography>

                <Stack
                  direction='horizontal'
                  gap={4}
                  style={{ marginTop: 4 }}
                  hAlign='center'
                >
                  <Typography nowrap weight='medium' style={{ flex: 1 }} variant='caption' color='textSecondary'>
                    {item.author}
                  </Typography>

                  <Typography nowrap weight='medium' variant='caption' color='textSecondary'>
                    {item.createdAt.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Typography>
                </Stack>

                {item.attachments.length > 0 && (
                  <List.Trailing>
                    <Icon size={18} opacity={0.4}>
                      <Papicons name='link' />
                    </Icon>
                  </List.Trailing>
                )}
              </List.Item>
            )
          })}
        </List>
      </LayoutAnimationConfig>
    </>
  )
}

function cleanContent(html: string): string {
  html = html.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  html = html.replace(/\n/g, ' ')
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength) + '...'
}

const NewsViewWithBoundary = () => (
  <MainTabErrorBoundary>
    <NewsView />
  </MainTabErrorBoundary>
)

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 4,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
})

export default NewsViewWithBoundary
