'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getUserNotificationSettings, updateNotificationSettings } from '@/actions/notifications'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Bell, Webhook, Globe } from 'lucide-react'
import { toast } from 'sonner'

export default function NotificationSettingsClient() {
  const t = useTranslations('NotificationSettings')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 设置状态
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [browserPushEnabled, setBrowserPushEnabled] = useState(false)
  const [pushSubscription, setPushSubscription] = useState<any>(null)

  // 加载设置
  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await getUserNotificationSettings()
      if (result.success && result.data?.settings) {
        const { settings } = result.data
        setWebhookEnabled(settings.webhookEnabled)
        setWebhookUrl(settings.webhookUrl || '')
        setBrowserPushEnabled(settings.browserPushEnabled)
        setPushSubscription(settings.pushSubscription)
      }
    } catch (error) {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // 保存设置
  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await updateNotificationSettings({
        webhookEnabled,
        webhookUrl: webhookUrl.trim() || null,
        browserPushEnabled,
        pushSubscription: pushSubscription || null,
      })

      if (result.success) {
        toast.success(t('saveSuccess'))
      } else {
        toast.error(t('saveError'), {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // 请求浏览器推送权限
  const handleEnableBrowserPush = async () => {
    try {
      // 检查浏览器支持
      if (!('Notification' in window)) {
        toast.error(t('browserPush.notSupported'))
        return
      }

      // 请求权限
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error(t('browserPush.permissionDenied'))
        return
      }

      // 检查 Service Worker 和 Push Manager 支持
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error(t('browserPush.notSupported'))
        return
      }

      // 注册 Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // 获取 VAPID 公钥（需要从环境变量或API获取）
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        toast.error(t('browserPush.configError'))
        return
      }

      // 订阅推送
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      // 保存订阅信息
      setPushSubscription(subscription.toJSON())
      setBrowserPushEnabled(true)
      toast.success(t('browserPush.enabled'))
    } catch (error) {
      console.error('[BrowserPush] Failed to enable:', error)
      toast.error(t('browserPush.enableError'))
    }
  }

  // 禁用浏览器推送
  const handleDisableBrowserPush = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
        }
      }

      setPushSubscription(null)
      setBrowserPushEnabled(false)
      toast.success(t('browserPush.disabled'))
    } catch (error) {
      console.error('[BrowserPush] Failed to disable:', error)
      toast.error(t('browserPush.disableError'))
    }
  }

  // 测试 Webhook
  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast.error(t('webhook.urlRequired'))
      return
    }

    try {
      // 这里可以添加测试 Webhook 的逻辑
      toast.success(t('webhook.testSuccess'))
    } catch (error) {
      toast.error(t('webhook.testError'))
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* Webhook 设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            <CardTitle>{t('webhook.title')}</CardTitle>
          </div>
          <CardDescription>{t('webhook.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('webhook.enabled')}</Label>
            <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
          </div>

          {webhookEnabled && (
            <>
              <div className="space-y-2">
                <Label>{t('webhook.urlLabel')}</Label>
                <Input
                  type="url"
                  placeholder={t('webhook.urlPlaceholder')}
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">{t('webhook.urlHint')}</p>
              </div>

              <Button variant="outline" onClick={handleTestWebhook}>
                {t('webhook.test')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 浏览器推送设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>{t('browserPush.title')}</CardTitle>
          </div>
          <CardDescription>{t('browserPush.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('browserPush.enabled')}</Label>
              <p className="text-sm text-muted-foreground">{t('browserPush.hint')}</p>
            </div>
            <Switch
              checked={browserPushEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleEnableBrowserPush()
                } else {
                  handleDisableBrowserPush()
                }
              }}
            />
          </div>

          {browserPushEnabled && pushSubscription && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t('browserPush.subscribed')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            t('save')
          )}
        </Button>
      </div>
    </div>
  )
}

// 工具函数: 将 base64 字符串转换为 Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
